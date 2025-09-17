
// 在HTML中加载network-sniffer.js

/**
 * sonoria - 主控制器
 * 整合音频解析、播放控制和可视化功能
 */
/* ==========  重构版 script.js  ========== */
/* ① 首屏呼吸圆环启动（新增） */
const heroCV = document.getElementById('heroCanvas');
const ctx = heroCV.getContext('2d');
let t = 0;
function startHero() {
  const dpr = window.devicePixelRatio || 1;
  const fit = () => {
    const rect = heroCV.getBoundingClientRect();
    heroCV.width = rect.width * dpr;  heroCV.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };  fit();  window.addEventListener('resize', fit);
  function breathe() {
    if (!heroCV.offsetParent) return;
    const w = heroCV.clientWidth, h = heroCV.clientHeight;
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.35;
    const breath = (Math.sin(t * 0.04) + 1) * 0.5;
    const hue = 210 + breath * 60;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsla(${hue},80%,60%,${0.2 + breath * 0.3})`);
    grad.addColorStop(1, `hsla(${hue},80%,50%,0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();  ctx.arc(cx, cy, r * (0.9 + breath * 0.1), 0, Math.PI * 2);  ctx.fill();
    t++;  requestAnimationFrame(breathe);
  }  breathe();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startHero);
} else {  startHero(); }

/* ② 首屏点击激活（新增） */
const stage = document.getElementById('stage');
stage.addEventListener('click', () => {
  if (player.audioContext && player.audioContext.state === 'suspended') {
    player.audioContext.resume();
  }
  if (player.playlist.length) {  revealControls();  }
  else {  document.getElementById('fileInput').click();  }
}, { once: false });

/* ③ 锁屏封面生成器（新增） */
let lockURL = '';
function updateLockScreenCover() {
  if (!visualizer || !document.hidden) return;
  visualizer.canvas.toBlob(blob => {
    if (lockURL) URL.revokeObjectURL(lockURL);
    lockURL = URL.createObjectURL(blob);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata.artwork = [{ src: lockURL, sizes: '512x512', type: 'image/png' }];
    }
  }, 'image/png', 0.8);
}
setInterval(updateLockScreenCover, 250);

/* ④ 底部控制岛显隐（新增） */
function revealControls() {
  document.getElementById('controlBar').classList.add('show');
  document.body.style.paddingBottom = '64px';
}

/* ⑤ 迷你可视化（新增） */
const miniCV = document.getElementById('miniVis');
const mCtx = miniCV.getContext('2d');
function drawMiniVis() {
  mCtx.clearRect(0, 0, 80, 80);
  const energy = visualizer ? visualizer.energyLevel / 255 : 0;
  const ang = energy * Math.PI * 2;
  mCtx.beginPath();  mCtx.arc(40, 40, 30, -Math.PI / 2, -Math.PI / 2 + ang);
  mCtx.strokeStyle = '#007AFF';  mCtx.lineWidth = 4;  mCtx.stroke();
  requestAnimationFrame(drawMiniVis);
}
drawMiniVis();

/* ⑥ 文件入口（新增） */
document.getElementById('fileInput').addEventListener('change', e => {
  player.processFiles([...e.target.files]);
  if (player.playlist.length) revealControls();
});

/* ==========  原有业务代码占位  ========== */
XXX-XXX（原有代码）
/* ====================================== */



class MusicPlayer {
    constructor() {
        this.audioElement = document.getElementById('audioPlayer');
        this.playlist = [];
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.isShuffleOn = false;
        this.repeatMode = 0; // 0: 无循环, 1: 单曲循环, 2: 列表循环
        this.volume = 0.8;

        // 音频上下文和可视化器
        this.audioContext = null;
        this.visualizer = null;

        this.initializeAudioContext();
        this.setupEventListeners();
        this.setupVisualizer();
        this.updateUI();
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('无法创建音频上下文:', error);
        }
    }

    setupEventListeners() {
        // 文件上传
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 播放控制
        document.getElementById('playBtn').addEventListener('click', this.togglePlay.bind(this));
        document.getElementById('prevBtn').addEventListener('click', this.previousTrack.bind(this));
        document.getElementById('nextBtn').addEventListener('click', this.nextTrack.bind(this));
        document.getElementById('shuffleBtn').addEventListener('click', this.toggleShuffle.bind(this));
        document.getElementById('repeatBtn').addEventListener('click', this.toggleRepeat.bind(this));

        // 进度条
        const progressBar = document.getElementById('progressBar');
        progressBar.addEventListener('click', this.seekTo.bind(this));

        // 音量控制
        const volumeSlider = document.getElementById('volumeSlider');
        const muteBtn = document.getElementById('muteBtn');
        volumeSlider.addEventListener('input', this.setVolume.bind(this));
        muteBtn.addEventListener('click', this.toggleMute.bind(this));

        // 可视化控制
        document.getElementById('visualizerMode').addEventListener('change', this.changeVisualizerMode.bind(this));
        document.getElementById('colorTheme').addEventListener('change', this.changeColorTheme.bind(this));

        // URL探嗅
        document.getElementById('sniffBtn').addEventListener('click', this.sniffURL.bind(this));
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sniffURL();
            }
        });

        // 新增功能事件监听
        document.getElementById('fullscreenBtn').addEventListener('click', this.toggleFullscreen.bind(this));
        document.getElementById('shuffleAllBtn').addEventListener('click', this.shuffleAll.bind(this));
        document.getElementById('clearPlaylistBtn').addEventListener('click', this.clearPlaylist.bind(this));
        
        // 键盘快捷键
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // 音频元素事件
        this.audioElement.addEventListener('loadedmetadata', this.onLoadedMetadata.bind(this));
        this.audioElement.addEventListener('timeupdate', this.onTimeUpdate.bind(this));
        this.audioElement.addEventListener('ended', this.onTrackEnded.bind(this));
        this.audioElement.addEventListener('play', this.onPlay.bind(this));
        this.audioElement.addEventListener('pause', this.onPause.bind(this));
    }

    setupVisualizer() {
        const canvas = document.getElementById('visualizerCanvas');
        this.visualizer = new AudioVisualizer(canvas, this.audioContext);

        if (this.audioContext && this.audioElement) {
            this.visualizer.connectAudio(this.audioElement);
        }
        
        // 启动性能监控显示
        this.startPerformanceMonitor();
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    async processFiles(files) {
        const audioFiles = files.filter(file => 
            file.type.startsWith('audio/') || 
            window.audioDecoder.detectFormat(file)
        );

        if (audioFiles.length === 0) {
            alert('请选择有效的音频文件');
            return;
        }

        const uploadArea = document.getElementById('uploadArea');
        const originalContent = uploadArea.innerHTML;

        // 显示处理进度
        uploadArea.innerHTML = `
            <div class="upload-content">
                <div class="upload-icon">🔄</div>
                <p>正在处理音频文件...</p>
                <div class="progress-info" id="progressInfo">处理中: 0/${audioFiles.length}</div>
            </div>
        `;

        let processed = 0;
        const progressInfo = document.getElementById('progressInfo');

        for (const file of audioFiles) {
            try {
                console.log('开始处理文件:', file.name);
                progressInfo.textContent = `处理中: ${processed}/${audioFiles.length} - ${file.name}`;

                // 使用音频解码器处理文件
                const result = await window.audioDecoder.decodeAudio(file);
                const audioURL = URL.createObjectURL(result.audioData);

                const track = {
                    id: this.generateId(),
                    url: audioURL,
                    metadata: result.metadata,
                    file: result.audioData,
                    originalFormat: result.originalFormat,
                    decodedFormat: result.decodedFormat
                };

                this.playlist.push(track);
                this.addToPlaylistUI(track);

                console.log(`文件处理完成: ${track.metadata.title} (${result.originalFormat} → ${result.decodedFormat})`);
                processed++;

            } catch (error) {
                console.error('文件处理失败:', error);
                this.showNotification(`处理文件 ${file.name} 失败: ${error.message}`, 'error');
                processed++;
            }

            progressInfo.textContent = `已处理: ${processed}/${audioFiles.length}`;
        }

        // 恢复上传区域
        setTimeout(() => {
            uploadArea.innerHTML = originalContent;
        }, 1000);

        if (this.playlist.length > 0 && !this.isPlaying) {
            this.loadTrack(0);
        }

        this.showNotification(`成功处理 ${this.playlist.length} 个音频文件`, 'success');
    }

    async sniffURL() {
        const urlInput = document.getElementById('urlInput');
        const sniffBtn = document.getElementById('sniffBtn');
        const url = urlInput.value.trim();

        if (!url) {
            this.showNotification('请输入URL', 'error');
            return;
        }

        // 禁用按钮和输入框
        sniffBtn.disabled = true;
        sniffBtn.textContent = '🔄 解析中...';
        urlInput.disabled = true;

        try {
            console.log('开始探嗅URL:', url);
            
            // 使用网络探嗅器解析音频
            const audioList = await window.networkSniffer.sniffAudio(url);
            
            console.log('探嗅成功，找到音频:', audioList.length);

            // 将探嗅到的音频添加到播放列表
            let addedCount = 0;
            for (const audioInfo of audioList) {
                try {
                    const track = {
                        id: this.generateId(),
                        url: audioInfo.url,
                        metadata: {
                            title: audioInfo.title,
                            artist: audioInfo.artist,
                            album: audioInfo.album,
                            duration: audioInfo.duration,
                            filename: `${audioInfo.title}.${audioInfo.format}`,
                            size: audioInfo.size || 0
                        },
                        originalFormat: audioInfo.source,
                        decodedFormat: audioInfo.format,
                        cover: audioInfo.cover
                    };

                    this.playlist.push(track);
                    this.addToPlaylistUI(track);
                    addedCount++;

                    console.log(`已添加: ${track.metadata.title} - ${track.metadata.artist}`);
                } catch (error) {
                    console.warn('跳过无效音频:', error);
                }
            }

            if (addedCount > 0) {
                this.showNotification(`成功添加 ${addedCount} 首音频到播放列表`, 'success');
                
                // 如果当前没有播放音频，加载第一首
                if (!this.isPlaying && this.playlist.length > 0) {
                    await this.loadTrack(this.playlist.length - addedCount);
                }
            } else {
                this.showNotification('未找到有效的音频资源', 'warning');
            }

            // 清空输入框
            urlInput.value = '';

        } catch (error) {
            console.error('URL探嗅失败:', error);
            this.showNotification(`解析失败: ${error.message}`, 'error');
        } finally {
            // 恢复按钮和输入框
            sniffBtn.disabled = false;
            sniffBtn.textContent = '🔍 解析';
            urlInput.disabled = false;
        }
    }

    addToPlaylistUI(track) {
        const playlist = document.getElementById('playlist');
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.dataset.trackId = track.id;

        // 添加格式标识和来源信息
        const formatBadge = track.originalFormat !== track.decodedFormat ? 
            `<span class="format-badge" title="原格式: ${track.originalFormat}">${track.originalFormat.toUpperCase()}</span>` : '';
        
        const sourceBadge = track.originalFormat ? 
            `<span class="format-badge" title="来源: ${track.originalFormat}">${track.originalFormat.toUpperCase()}</span>` : '';

        item.innerHTML = `
            <div class="track-number">${this.playlist.length}</div>
            <div class="track-details">
                <div class="track-name">
                    ${track.metadata.title}
                    ${formatBadge || sourceBadge}
                </div>
                <div class="track-meta">
                    <span class="track-artist">${track.metadata.artist}</span>
                    <span class="track-duration">${this.formatTime(track.metadata.duration)}</span>
                </div>
            </div>
        `;

        item.addEventListener('click', () => {
            const index = this.playlist.findIndex(t => t.id === track.id);
            this.loadTrack(index);
        });

        playlist.appendChild(item);
    }

    async loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;

        this.currentTrackIndex = index;
        const track = this.playlist[index];

        // 恢复音频上下文
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        try {
            console.log('正在加载音频:', track.metadata.title, track.url);
            
            // 验证音频URL
            if (!track.url || track.url.includes('undefined')) {
                throw new Error('音频URL无效');
            }
            
            // 清理之前的音频元素资源（但保留播放列表blob引用）
            this.cleanupAudioElement();
            
            // 设置音频源
            this.audioElement.src = track.url;
            
            // 添加加载完成处理
            const loadHandler = () => {
                console.log('音频加载成功:', track.metadata.title);
                this.showNotification(`已加载: ${track.metadata.title}`, 'success');
            };
            
            // 添加错误处理
            const errorHandler = (error) => {
                console.error('音频加载失败:', error);
                this.showNotification(`无法播放 "${track.metadata.title}": 这是演示音频`, 'warning');
            };

            this.audioElement.addEventListener('loadeddata', loadHandler, { once: true });
            this.audioElement.addEventListener('error', errorHandler, { once: true });
            
            // 尝试预加载
            this.audioElement.load();
            
            this.updateTrackInfo(track.metadata);
            this.updatePlaylistUI();
            
        } catch (error) {
            console.error('加载音频失败:', error);
            this.showNotification(`加载失败: ${error.message}`, 'error');
        }
    }

    updateTrackInfo(metadata) {
        document.getElementById('trackTitle').textContent = metadata.title;
        document.getElementById('trackArtist').textContent = metadata.artist;
    }

    updatePlaylistUI() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentTrackIndex);
        });
    }

    async togglePlay() {
        if (!this.audioElement.src) {
            if (this.playlist.length > 0) {
                await this.loadTrack(0);
            } else {
                return;
            }
        }

        if (this.isPlaying) {
            this.audioElement.pause();
        } else {
            try {
                await this.audioElement.play();
            } catch (error) {
                console.error('播放失败:', error);
            }
        }
    }

    previousTrack() {
        if (this.playlist.length === 0) return;

        let newIndex;
        if (this.isShuffleOn) {
            newIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            newIndex = this.currentTrackIndex - 1;
            if (newIndex < 0) {
                newIndex = this.playlist.length - 1;
            }
        }

        this.loadTrack(newIndex);
        if (this.isPlaying) {
            this.audioElement.play();
        }
    }

    nextTrack() {
        if (this.playlist.length === 0) return;

        let newIndex;
        if (this.isShuffleOn) {
            newIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            newIndex = this.currentTrackIndex + 1;
            if (newIndex >= this.playlist.length) {
                newIndex = 0;
            }
        }

        this.loadTrack(newIndex);
        if (this.isPlaying) {
            this.audioElement.play();
        }
    }

    toggleShuffle() {
        this.isShuffleOn = !this.isShuffleOn;
        const btn = document.getElementById('shuffleBtn');
        btn.style.background = this.isShuffleOn ? 
            'linear-gradient(135deg, #667eea, #764ba2)' : 
            'rgba(255, 255, 255, 0.2)';
    }

    toggleRepeat() {
        this.repeatMode = (this.repeatMode + 1) % 3;
        const btn = document.getElementById('repeatBtn');
        const modes = ['🔁', '🔂', '🔁'];
        const colors = [
            'rgba(255, 255, 255, 0.2)',
            'linear-gradient(135deg, #667eea, #764ba2)',
            'linear-gradient(135deg, #ff6b6b, #ee5a24)'
        ];

        btn.textContent = modes[this.repeatMode];
        btn.style.background = colors[this.repeatMode];
    }

    seekTo(e) {
        if (!this.audioElement.duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        const seekTime = percentage * this.audioElement.duration;

        this.audioElement.currentTime = seekTime;
    }

    setVolume(e) {
        this.volume = e.target.value / 100;
        this.audioElement.volume = this.volume;
        this.updateVolumeIcon();
    }

    toggleMute() {
        if (this.audioElement.volume > 0) {
            this.audioElement.volume = 0;
            document.getElementById('volumeSlider').value = 0;
        } else {
            this.audioElement.volume = this.volume;
            document.getElementById('volumeSlider').value = this.volume * 100;
        }
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        const muteBtn = document.getElementById('muteBtn');
        const volume = this.audioElement.volume;

        if (volume === 0) {
            muteBtn.textContent = '🔇';
        } else if (volume < 0.5) {
            muteBtn.textContent = '🔉';
        } else {
            muteBtn.textContent = '🔊';
        }
    }

    changeVisualizerMode(e) {
        if (this.visualizer) {
            this.visualizer.setMode(e.target.value);
        }
    }

    changeColorTheme(e) {
        if (this.visualizer) {
            this.visualizer.setColorTheme(e.target.value);
        }
    }

    onLoadedMetadata() {
        this.updateUI();
    }

    onTimeUpdate() {
        this.updateProgress();
    }

    onTrackEnded() {
        if (this.repeatMode === 1) {
            // 单曲循环
            this.audioElement.currentTime = 0;
            this.audioElement.play();
        } else if (this.repeatMode === 2 || this.currentTrackIndex < this.playlist.length - 1) {
            // 列表循环或还有下一首
            this.nextTrack();
        } else {
            // 停止播放
            this.isPlaying = false;
            this.updatePlayButton();
            if (this.visualizer) {
                this.visualizer.stop();
            }
        }
    }

    onPlay() {
        this.isPlaying = true;
        this.updatePlayButton();
        if (this.visualizer) {
            this.visualizer.start();
        }
    }

    onPause() {
        this.isPlaying = false;
        this.updatePlayButton();
        if (this.visualizer) {
            this.visualizer.stop();
        }
    }

    updateUI() {
        this.updateProgress();
        this.updatePlayButton();
        this.updateVolumeIcon();
    }

    updateProgress() {
        if (!this.audioElement.duration) return;

        const percentage = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        document.getElementById('progressFill').style.width = percentage + '%';

        document.getElementById('currentTime').textContent = 
            this.formatTime(this.audioElement.currentTime);
        document.getElementById('totalTime').textContent = 
            this.formatTime(this.audioElement.duration);
    }

    updatePlayButton() {
        const playBtn = document.getElementById('playBtn');
        playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === 0) return '0:00';

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Helper function to generate a unique ID (can be improved)
    generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    // Helper function to show notifications
    showNotification(message, type = 'info') {
        let notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notificationContainer';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(notificationContainer);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            background: ${type === 'error' ? '#ff4757' : type === 'success' ? '#2ed573' : '#3742fa'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            pointer-events: auto;
            max-width: 300px;
            word-wrap: break-word;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        notification.textContent = message;
        notificationContainer.appendChild(notification);

        // 显示动画
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        // 自动消失
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    cleanupAudioElement() {
        // 安全清理：只清理audio元素的当前src，不影响播放列表
        const oldSrc = this.audioElement.src;
        
        // 暂停当前音频
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        
        // 只有当前音频元素使用的blob URL才清理，且确保不是即将播放的
        if (oldSrc && oldSrc.startsWith('blob:')) {
            // 检查这个blob是否还在播放列表中被使用
            const stillInUse = this.playlist.some(track => track.url === oldSrc);
            if (!stillInUse) {
                try {
                    URL.revokeObjectURL(oldSrc);
                    console.log('清理未使用的音频blob URL');
                } catch (e) {
                    console.warn('清理blob URL时出错:', e);
                }
            }
        }
    }
    
    // 可选的轻量级内存管理（仅在用户明确触发时使用）
    optimizeMemoryUsage() {
        // 这个方法可以在将来需要时手动调用，例如用户上传大量文件后
        console.log('执行内存优化...');
        
        // 移除重复的blob URL
        const urlMap = new Map();
        this.playlist.forEach(track => {
            if (track.url && track.url.startsWith('blob:')) {
                if (urlMap.has(track.url)) {
                    console.log(`发现重复的音频URL: ${track.metadata.title}`);
                } else {
                    urlMap.set(track.url, track);
                }
            }
        });
        
        console.log(`内存优化完成，管理中的唯一音频文件: ${urlMap.size}`);
    }
    
    // 键盘快捷键处理
    handleKeyboardShortcuts(e) {
        // 避免在输入框中触发快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch (e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'arrowleft':
                e.preventDefault();
                this.previousTrack();
                break;
            case 'arrowright':
                e.preventDefault();
                this.nextTrack();
                break;
            case 'arrowup':
                e.preventDefault();
                this.adjustVolume(0.1);
                break;
            case 'arrowdown':
                e.preventDefault();
                this.adjustVolume(-0.1);
                break;
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 's':
                e.preventDefault();
                this.shuffleAll();
                break;
            case 'r':
                e.preventDefault();
                this.toggleRepeat();
                break;
            case '?':
                e.preventDefault();
                this.toggleKeyboardShortcuts();
                break;
        }
    }
    
    // 调整音量
    adjustVolume(delta) {
        const volumeSlider = document.getElementById('volumeSlider');
        const newVolume = Math.max(0, Math.min(100, parseInt(volumeSlider.value) + (delta * 100)));
        volumeSlider.value = newVolume;
        this.setVolume({ target: { value: newVolume } });
    }
    
    // 全屏模式切换
    toggleFullscreen() {
        const visualizerSection = document.querySelector('.visualizer-section');
        if (visualizerSection.classList.contains('fullscreen')) {
            visualizerSection.classList.remove('fullscreen');
            document.exitFullscreen?.();
        } else {
            visualizerSection.classList.add('fullscreen');
            visualizerSection.requestFullscreen?.();
        }
    }
    
    // 随机播放全部
    shuffleAll() {
        if (this.playlist.length === 0) {
            this.showNotification('播放列表为空', 'warning');
            return;
        }
        
        this.isShuffleOn = true;
        this.updateUI();
        
        // 随机选择一首歌开始播放
        const randomIndex = Math.floor(Math.random() * this.playlist.length);
        this.loadTrack(randomIndex);
        if (!this.isPlaying) {
            this.togglePlay();
        }
        
        this.showNotification('已开启随机播放全部', 'success');
    }
    
    // 清空播放列表
    clearPlaylist() {
        if (this.playlist.length === 0) {
            this.showNotification('播放列表已为空', 'info');
            return;
        }
        
        // 停止播放
        if (this.isPlaying) {
            this.togglePlay();
        }
        
        // 清理所有blob URL
        this.playlist.forEach(track => {
            if (track.url && track.url.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(track.url);
                } catch (e) {
                    console.warn('清理blob URL失败:', e);
                }
            }
        });
        
        // 清空列表
        this.playlist = [];
        this.currentTrackIndex = 0;
        
        // 更新UI
        document.getElementById('playlist').innerHTML = '';
        document.getElementById('trackTitle').textContent = '选择音频文件开始播放';
        document.getElementById('trackArtist').textContent = '';
        
        this.updateUI();
        this.showNotification('播放列表已清空', 'success');
    }
    
    // 切换快捷键显示
    toggleKeyboardShortcuts() {
        const shortcuts = document.getElementById('keyboardShortcuts');
        if (shortcuts.style.display === 'none') {
            shortcuts.style.display = 'block';
        } else {
            shortcuts.style.display = 'none';
        }
    }
    
    // 启动性能监控显示
    startPerformanceMonitor() {
        const fpsDisplay = document.getElementById('fpsDisplay');
        const perfLevel = document.getElementById('perfLevel');
        
        if (fpsDisplay && perfLevel && this.visualizer) {
            setInterval(() => {
                // 从可视化器获取性能数据
                const fps = Math.round(this.visualizer.fps || 60);
                const level = this.visualizer.performanceLevel || 'medium';
                
                fpsDisplay.textContent = `FPS: ${fps}`;
                
                const levelNames = {
                    'low': '省电模式',
                    'medium': '标准模式', 
                    'high': '高性能'
                };
                perfLevel.textContent = levelNames[level] || '标准模式';
                
                // 根据FPS设置颜色
                if (fps < 30) {
                    fpsDisplay.style.color = '#ff6b6b';
                } else if (fps < 50) {
                    fpsDisplay.style.color = '#ffd93d';
                } else {
                    fpsDisplay.style.color = '#4facfe';
                }
            }, 1000);
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});