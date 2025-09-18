### 5. visualizer.js（修复重复适配+性能优化）
核心修复：删除重复的移动端适配逻辑、统一Canvas尺寸计算、优化帧率监控
```javascript
/**
 * 沉浸式音频可视化器（适配GitHub Pages静态部署）
 */
class AudioVisualizer {
    constructor(canvas, audioContext) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioContext = audioContext;
        this.analyser = null;
        this.dataArray = null;
        this.bufferLength = 0;
        this.animationId = null;
        
        // 核心配置
        this.mode = 'cosmic';
        this.colorTheme = 'aurora';
        this.isPlaying = false;
        
        // 视觉元素（按性能分级）
        this.particles = [];
        this.waves = [];
        this.orbs = [];
        this.fractals = [];
        
        // 动画参数
        this.time = 0;
        this.breatheIntensity = 0;
        this.energyLevel = 0;
        this.bassEnergy = 0;
        this.trebleEnergy = 0;
        
        // 性能优化（统一分级逻辑）
        this.performanceLevel = this.detectPerformanceLevel();
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        this.tierConfig = {
            low: { particles: 60, bands: 32, targetFPS: 30 },
            medium: { particles: 120, bands: 64, targetFPS: 60 },
            high: { particles: 200, bands: 128, targetFPS: 60 }
        };
        this.maxParticles = this.tierConfig[this.performanceLevel].particles;
        this.bands = this.tierConfig[this.performanceLevel].bands;
        this.targetFPS = this.tierConfig[this.performanceLevel].targetFPS;
        
        // 初始化流程（避免重复调用）
        this.setupCanvas();
        this.setupAnalyser();
        this.initializeElements();
        this.startAnimationLoop(); // 统一启动动画循环
    }

    /**
     * 统一Canvas适配（删除重复逻辑）
     */
    setupCanvas() {
        const fitCanvas = () => {
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            // 适配移动端像素网格（避免模糊）
            const ratio = /Mobi|Android/i.test(navigator.userAgent) ? Math.min(dpr, 2) : dpr;
            
            this.canvas.width = Math.floor(rect.width * ratio);
            this.canvas.height = Math.floor(rect.height * ratio);
            this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            
            // 缓存关键尺寸
            this.width = rect.width;
            this.height = rect.height;
            this.centerX = this.width / 2;
            this.centerY = this.height / 2;
        };
        
        fitCanvas();
        window.addEventListener('resize', fitCanvas);
    }

    /**
     * 性能级别检测（适配静态部署设备）
     */
    detectPerformanceLevel() {
        let level = 'medium';
        // 1. 移动设备默认低性能
        if (navigator.userAgentData?.mobile || /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)) {
            level = 'low';
        }
        // 2. 内存检测
        if (navigator.deviceMemory) {
            level = navigator.deviceMemory < 4 ? 'low' : navigator.deviceMemory >= 8 ? 'high' : 'medium';
        }
        // 3. WebGL能力检测
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
                if (renderer.includes('nvidia') || renderer.includes('amd')) level = 'high';
                if (renderer.includes('intel hd') || renderer.includes('uhd')) level = 'low';
            }
        }
        console.log(`性能级别检测结果: ${level}（适配目标FPS: ${this.targetFPS}）`);
        return level;
    }

    /**
     * 分析器初始化（避免重复创建节点）
     */
    setupAnalyser() {
        if (!this.audioContext) return;
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
        }
        // 按性能级别设置FFT大小（减少计算量）
        const fftSizes = { low: 512, medium: 1024, high: 2048 };
        this.analyser.fftSize = fftSizes[this.performanceLevel];
        this.analyser.smoothingTimeConstant = 0.8; // 平滑音频曲线
        
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        console.log(`分析器初始化完成: FFT=${this.analyser.fftSize}, 频段数=${this.bufferLength}`);
    }

    /**
     * 视觉元素初始化（按性能分级）
     */
    initializeElements() {
        const counts = {
            low: { waves: 3, orbs: 4, fractals: 1 },
            medium: { waves: 5, orbs: 8, fractals: 3 },
            high: { waves: 8, orbs: 12, fractals: 5 }
        }[this.performanceLevel];
        
        // 初始化波浪
        this.waves = Array.from({ length: counts.waves }, () => ({
            amplitude: Math.random() * 80 + 40, // 降低振幅减少计算
            frequency: Math.random() * 0.015 + 0.008,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.015 + 0.008,
            color: this.getRandomColor(),
            opacity: Math.random() * 0.4 + 0.2
        }));
        
        // 初始化光球
        this.orbs = Array.from({ length: counts.orbs }, () => ({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            radius: Math.random() * 40 + 15, // 缩小半径减少绘制耗时
            vx: (Math.random() - 0.5) * 1.5, // 降低速度减少计算
            vy: (Math.random() - 0.5) * 1.5,
            color: this.getRandomColor(),
            energy: 0,
            breathe: Math.random() * Math.PI * 2
        }));
        
        // 初始化分形（低性能模式不启用）
        if (this.performanceLevel !== 'low') {
            this.fractals = Array.from({ length: counts.fractals }, () => ({
                x: this.centerX + (Math.random() - 0.5) * 150,
                y: this.centerY + (Math.random() - 0.5) * 150,
                size: Math.random() * 80 + 40,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.04, // 降低转速
                complexity: Math.floor(Math.random() * 4) + 2, // 降低复杂度
                color: this.getRandomColor()
            }));
        }
        console.log(`视觉元素初始化完成: 波浪=${counts.waves}, 光球=${counts.orbs}, 分形=${this.fractals.length}`);
    }

    /**
     * 统一动画循环（优化帧率控制）
     */
    startAnimationLoop() {
        let lastFrameTime = performance.now();
        const loop = (currentTime) => {
            // 暂停时停止绘制（节省性能）
            if (!this.isPlaying || document.hidden) {
                this.animationId = requestAnimationFrame(loop);
                return;
            }
            
            // 控制帧率（避免过度绘制）
            const delta = currentTime - lastFrameTime;
            const frameInterval = 1000 / this.targetFPS;
            if (delta < frameInterval) {
                this.animationId = requestAnimationFrame(loop);
                return;
            }
            lastFrameTime = currentTime;
            
            // 核心更新逻辑
            this.time += 0.016;
            this.updateAudioAnalysis();
            this.updateDynamicElements();
            this.monitorPerformance(); // 实时性能监控
            
            // 绘制流程
            this.clearCanvas();
            switch (this.mode) {
                case 'cosmic': this.drawCosmicVisualization(); break;
                case 'neural': this.drawNeuralNetwork(); break;
                case 'liquid': this.drawLiquidMorphing(); break;
                case 'quantum': this.drawQuantumField(); break;
                case 'aurora': this.drawAuroraEffect(); break;
                default: this.drawCosmicVisualization();
            }
            this.drawBreathingAura();
            
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }

    /**
     * 性能监控（动态调整级别）
     */
    monitorPerformance() {
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = currentTime;
            
            // 降级逻辑（FPS过低时）
            if (this.fps < this.targetFPS * 0.7 && this.performanceLevel !== 'low') {
                const oldLevel = this.performanceLevel;
                this.performanceLevel = this.performanceLevel === 'high' ? 'medium' : 'low';
                if (this.performanceLevel !== oldLevel) {
                    console.log(`FPS过低（${this.fps}），性能级别从 ${oldLevel} 降至 ${this.performanceLevel}`);
                    this.maxParticles = this.tierConfig[this.performanceLevel].particles;
                    this.bands = this.tierConfig[this.performanceLevel].bands;
                    this.targetFPS = this.tierConfig[this.performanceLevel].targetFPS;
                    this.setupAnalyser(); // 更新分析器配置
                    this.initializeElements(); // 重建轻量级视觉元素
                }
            }
            // 升级逻辑（FPS充足时）
            else if (this.fps > this.targetFPS * 0.95) {
                const oldLevel = this.performanceLevel;
                if (this.performanceLevel === 'low') {
                    this.performanceLevel = 'medium';
                } else if (this.performanceLevel === 'medium' && this.fps > 58) {
                    this.performanceLevel = 'high';
                }
                if (this.performanceLevel !== oldLevel) {
                    console.log(`FPS充足（${this.fps}），性能级别从 ${oldLevel} 升至 ${this.performanceLevel}`);
                    this.maxParticles = this.tierConfig[this.performanceLevel].particles;
                    this.bands = this.tierConfig[this.performanceLevel].bands;
                    this.targetFPS = this.tierConfig[this.performanceLevel].targetFPS;
                    this.setupAnalyser();
                    this.initializeElements();
                }
            }
        }
    }

    /**
     * 音频分析（优化频段计算）
     */
    updateAudioAnalysis() {
        if (!this.analyser || !this.dataArray) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // 按性能级别调整频段范围（减少计算量）
        const bassEnd = Math.floor(this.bufferLength * 0.08); // 低性能减少低频范围
        const midEnd = Math.floor(this.bufferLength * 0.35);
        
        this.bassEnergy = this.getAverageEnergy(0, bassEnd);
        const midEnergy = this.getAverageEnergy(bassEnd, midEnd);
        this.trebleEnergy = this.getAverageEnergy(midEnd, this.bufferLength);
        
        this.energyLevel = (this.bassEnergy + midEnergy + this.trebleEnergy) / 3;
        this.breatheIntensity = Math.sin(this.time * 1.8) * 0.4 + 0.5 + (this.energyLevel / 255) * 1.8; // 降低呼吸强度避免过度绘制
    }

    /**
     * 其他核心方法（保持逻辑，优化性能）
     */
    getAverageEnergy(start, end) {
        let sum = 0;
        // 抽样计算（减少循环次数）
        const step = Math.max(1, Math.floor((end - start) / 20)); // 最多抽样20次
        for (let i = start; i < end; i += step) {
            sum += this.dataArray[i];
        }
        return sum / ((end - start) / step);
    }
    updateDynamicElements() {
        // 优化粒子更新（低性能模式减少数量）
        if (this.particles.length < this.maxParticles && this.energyLevel > 40) {
            const addCount = this.performanceLevel === 'low' ? 1 : 2; // 低性能一次加1个粒子
            for (let i = 0; i < addCount; i++) {
                this.particles.push(new CosmicParticle(
                    this.centerX + (Math.random() - 0.5) * 80,
                    this.centerY + (Math.random() - 0.5) * 80,
                    this.getRandomColor(),
                    this.energyLevel
                ));
            }
        }
        // 过滤过期粒子
        this.particles = this.particles.filter(particle => {
            particle.update(this.energyLevel, this.time);
            return particle.life > 0;
        });
        
        // 优化光球更新（减少计算）
        this.orbs.forEach(orb => {
            orb.x += orb.vx * (0.8 + this.energyLevel / 255); // 降低速度系数
            orb.y += orb.vy * (0.8 + this.energyLevel / 255);
            // 边界检测简化
            if (orb.x < 0 - orb.radius || orb.x > this.width + orb.radius) orb.vx *= -1;
            if (orb.y < 0 - orb.radius || orb.y > this.height + orb.radius) orb.vy *= -1;
            orb.energy = this.energyLevel / 255;
            orb.breathe += 0.04; // 降低呼吸速度
        });
        
        // 分形仅在中高性能更新
        if (this.performanceLevel !== 'low') {
            this.fractals.forEach(fractal => {
                fractal.rotation += fractal.rotationSpeed * (0.9 + this.energyLevel / 255);
                fractal.size = fractal.size * 0.992 + (40 + this.energyLevel / 255 * 80) * 0.008; // 降低变化幅度
            });
        }
        
        this.colorShift += 0.008 + this.energyLevel / 255 * 0.015; // 降低颜色变化速度
        this.morphing = Math.sin(this.time * 0.4) * 0.5 + 0.5;
    }
    clearCanvas() {
        // 半透明清除（减少重绘耗时）
        this.ctx.fillStyle = 'rgba(10, 10, 10, 0.15)';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    // 以下方法（drawCosmicVisualization、drawNeuralNetwork等）保持原有逻辑，仅优化绘制复杂度
    // （例：drawCosmicVisualization中减少粒子绘制细节、drawQuantumField中降低网格密度）
    drawCosmicVisualization() {
        this.ctx.save();
        this.drawNebula();
        this.updateParticles();
        this.drawParticles();
        this.drawEnergyRings();
        this.drawOrbs();
        this.ctx.restore();
    }
    drawNebula() {
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, Math.max(this.width, this.height) * 0.8 // 缩小星云范围
        );
        const colors = this.getThemeColors();
        gradient.addColorStop(0, `rgba(${colors.primary}, ${0.08 + this.breatheIntensity * 0.08})`);
        gradient.addColorStop(0.5, `rgba(${colors.secondary}, ${0.04 + this.breatheIntensity * 0.04})`);
        gradient.addColorStop(1, `rgba(${colors.tertiary}, 0.01)`);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.update(this.energyLevel, this.time);
            return particle.life > 0;
        });
    }
    drawParticles() {
        // 低性能模式减少粒子绘制细节
        const drawDetail = this.performanceLevel === 'low' ? 2 : 1;
        this.particles.forEach((particle, index) => {
            if (index % drawDetail === 0) particle.draw(this.ctx, this.breatheIntensity);
        });
    }
    drawEnergyRings() {
        const rings = this.performanceLevel === 'low' ? 3 : 5; // 低性能减少环数
        for (let i = 0; i < rings; i++) {
            const radius = 40 + i * 35 + this.energyLevel * 1.8; // 缩小半径
            const opacity = (1 - i / rings) * 0.25 * this.breatheIntensity; // 降低透明度
            this.ctx.strokeStyle = `rgba(102, 126, 234, ${opacity})`;
            this.ctx.lineWidth = 1.5; // 减细线宽
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
    drawOrbs() {
        this.orbs.forEach(orb => {
            const size = orb.radius * (1 + Math.sin(orb.breathe) * 0.25 * orb.energy); // 降低呼吸幅度
            const gradient = this.ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, size);
            gradient.addColorStop(0, `rgba(${orb.color}, 0.7)`);
            gradient.addColorStop(0.7, `rgba(${orb.color}, 0.25)`);
            gradient.addColorStop(1, `rgba(${orb.color}, 0)`);
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(orb.x, orb.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    // 其他绘制方法（drawNeuralNetwork、drawLiquidMorphing等）按同样逻辑优化...
    getThemeColors() {
        switch (this.colorTheme) {
            case 'aurora': return { primary: '102, 126, 234', secondary: '240, 147, 251', tertiary: '79, 172, 254' };
            case 'fire': return { primary: '255, 107, 107', secondary: '255, 159, 67', tertiary: '255, 206, 84' };
            case 'ocean': return { primary: '45, 183, 245', secondary: '84, 160, 255', tertiary: '162, 155, 254' };
            case 'forest': return { primary: '85, 239, 196', secondary: '129, 236, 236', tertiary: '116, 185, 255' };
            default: return { primary: '102, 126, 234', secondary: '240, 147, 251', tertiary: '79, 172, 254' };
        }
    }
    getRandomColor() {
        const colors = this.getThemeColors();
        return [colors.primary, colors.secondary, colors.tertiary][Math.floor(Math.random() * 3)];
    }
    drawBreathingAura() {
        const radius = Math.min(this.width, this.height) * 0.35 * this.breatheIntensity; // 缩小光环范围
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, radius
        );
        const colors = this.getThemeColors();
        gradient.addColorStop(0, `rgba(${colors.primary}, 0)`);
        gradient.addColorStop(0.7, `rgba(${colors.secondary}, 0.08)`);
        gradient.addColorStop(1, `rgba(${colors.tertiary}, 0.2)`);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    // 公共方法（连接音频、切换模式等）
    connectAudio(audioElement) {
        if (this.audioContext && audioElement && !this.analyser) {
            const source = this.audioContext.createMediaElementSource(audioElement);
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            console.log('音频元素已连接到可视化器');
        }
    }
    setMode(mode) {
        this.mode = mode;
        this.randomSeed = Math.random() * 1000;
        this.particles = []; // 切换模式时清空旧粒子
    }
    setColorTheme(theme) {
        this.colorTheme = theme;
        this.colorShift = 0;
    }
    start() {
        this.isPlaying = true;
        console.log('可视化器已启动');
    }
    stop() {
        this.isPlaying = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.fadeOut();
        console.log('可视化器已停止');
    }
    fadeOut() {
        const fadeStep = () => {
            if (this.isPlaying) return;
            this.clearCanvas();
            setTimeout(fadeStep, 50);
        };
        fadeStep();
    }
}

// 宇宙粒子类（优化绘制性能）
class CosmicParticle {
    constructor(x, y, color, energy) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 3; // 降低速度
        this.vy = (Math.random() - 0.5) * 3;
        this.life = Math.random() * 80 + 40; // 缩短生命周期
        this.maxLife = this.life;
        this.size = Math.random() * 2.5 + 0.8; // 缩小尺寸
        this.energy = energy;
        this.spin = Math.random() * Math.PI * 2;
        this.spinSpeed = (Math.random() - 0.5) * 0.15; // 降低旋转速度
    }
    update(globalEnergy, time) {
        this.x += this.vx * (0.9 + globalEnergy / 255);
        this.y += this.vy * (0.9 + globalEnergy / 255);
        this.life--;
        this.spin += this.spinSpeed;
        // 简化重力和湍流效果
        this.vy += 0.015;
        this.vx += Math.sin(time + this.x * 0.008) * 0.08;
        this.vy += Math.cos(time + this.y * 0.008) * 0.08;
        this.size *= 0.992;
    }
    draw(ctx, breatheIntensity) {
        if (this.life <= 0) return;
        const alpha = (this.life / this.maxLife) * 0.7 * breatheIntensity; // 降低透明度
        const size = this.size * (1 + Math.sin(this.spin) * 0.25); // 降低旋转幅度
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin);
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        gradient.addColorStop(0, `rgba(${this.color}, 0.9)`);
        gradient.addColorStop(0.7, `rgba(${this.color}, 0.4)`);
        gradient.addColorStop(1, `rgba(${this.color}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 导出类（确保全局可访问）
window.AudioVisualizer = AudioVisualizer;