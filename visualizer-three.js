class ThreeVisualizer {
    constructor(canvas, audioContext) {
        try {
            this.canvas = canvas;
            this.audioContext = audioContext;
            this.analyser = null;
            this.clock = new THREE.Clock();
            this.animationFrameId = null;

            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(75, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
            this.camera.position.z = 100;

            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });

            // Beat detection variables
            this.beatCutOff = 0;
            this.beatTime = 0;
            this.beatHoldTime = 40; // frames
            this.beatDecayRate = 0.97;

            this.colorPalettes = {
                party: [new THREE.Color(0xff00ff), new THREE.Color(0x00ffff), new THREE.Color(0xffff00)],
                energetic: [new THREE.Color(0xff4444), new THREE.Color(0xffff88), new THREE.Color(0xffa500)],
                chill: [new THREE.Color(0x00ff7f), new THREE.Color(0x7fffd4), new THREE.Color(0x48d1cc)],
                mellow: [new THREE.Color(0xaa00aa), new THREE.Color(0xffc0cb), new THREE.Color(0xee82ee)],
                calm: [new THREE.Color(0x4444ff), new THREE.Color(0x88ffff), new THREE.Color(0x87ceeb)],
            };
            this.currentColor = new THREE.Color(0x8899ff);

            this.createBackgroundLayer();
            this.createMidgroundLayer();
            this.createForegroundLayer();
            this.createOceanicTheme();

            this.resizeCanvas();
            window.addEventListener('resize', this.resizeCanvas.bind(this), false);

            this.animate();
        } catch (error) {
            console.error("Error in ThreeVisualizer constructor:", error);
        }
    }

    createBackgroundLayer() {
        const geometry = new THREE.SphereGeometry(500, 64, 64);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0.0 },
                u_bass: { value: 0.0 },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float u_time;
                uniform float u_bass;
                varying vec2 vUv;
                // 2D Noise function
                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }
                void main() {
                    vec2 st = vUv * 5.0;
                    st.x += u_time * 0.01;
                    float rnd = random(st);
                    vec3 color = vec3(rnd * u_bass * 0.5);
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            side: THREE.BackSide,
        });

        this.backgroundSphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.backgroundSphere);
    }

    createMidgroundLayer() {
        const particleCount = 5000;
        const majorRadius = 50;
        const minorRadius = 20;
        this.particles = new THREE.BufferGeometry();
        this.particlePositions = new Float32Array(particleCount * 3);
        this.originalPositions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI * 2;

            const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
            const y = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
            const z = minorRadius * Math.sin(v);

            this.particlePositions[i3] = x;
            this.particlePositions[i3 + 1] = y;
            this.particlePositions[i3 + 2] = z;
            this.originalPositions[i3] = x;
            this.originalPositions[i3 + 1] = y;
            this.originalPositions[i3 + 2] = z;
        }

        this.particles.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x8899ff,
            size: 2.5,
            blending: THREE.NormalBlending,
            transparent: true,
            opacity: 1.0
        });

        this.particleSystem = new THREE.Points(this.particles, material);
        this.scene.add(this.particleSystem);
    }

    createForegroundLayer() {
        const sparkCount = 100;
        this.sparks = new THREE.BufferGeometry();
        const positions = new Float32Array(sparkCount * 3);
        const lifetimes = new Float32Array(sparkCount);

        this.sparks.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.sparks.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 3.0,
            blending: THREE.AdditiveBlending,
            transparent: true,
        });

        this.sparkSystem = new THREE.Points(this.sparks, material);
        this.scene.add(this.sparkSystem);
    }

    createOceanicTheme() {
        const geometry = new THREE.PlaneGeometry(500, 500, 100, 100);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0.0 },
                u_frequency: { value: 0.0 },
            },
            vertexShader: `
                uniform float u_time;
                uniform float u_frequency;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    float wave = sin(pos.x * 0.1 + u_time) * cos(pos.y * 0.1 + u_time) * 10.0;
                    pos.z = wave * u_frequency;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float u_time;
                varying vec2 vUv;
                void main() {
                    vec3 color = 0.5 + 0.5 * cos(u_time + vUv.xyx + vec3(0,2,4));
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            wireframe: false,
        });

        this.oceanicPlane = new THREE.Mesh(geometry, material);
        this.oceanicPlane.rotation.x = -Math.PI / 2;
        this.oceanicPlane.visible = false;
        this.scene.add(this.oceanicPlane);
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
    }

    connectAudio(audioElement) {
        if (this.analyser) return;
        const listener = new THREE.AudioListener();
        this.camera.add(listener);
        const audio = new THREE.Audio(listener);
        audio.setMediaElementSource(audioElement);
        this.analyser = new THREE.AudioAnalyser(audio, 2048);
    }

    start() {}
    stop() {}
    setMode(mode) {}

    getFrequencyBands(data) {
        const bass = data.slice(0, Math.floor(data.length * 0.1));
        const mids = data.slice(Math.floor(data.length * 0.1), Math.floor(data.length * 0.5));
        const treble = data.slice(Math.floor(data.length * 0.5));

        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

        return {
            bass: avg(bass),
            mids: avg(mids),
            treble: avg(treble),
        };
    }

    getEmotionFromAudio(bands) {
        const bass = bands.bass;
        const mids = bands.mids;
        const treble = bands.treble;

        if (bass > 140 && treble > 80) return 'party';
        if (bass > 100 && mids > 50) return 'energetic';
        if (treble > 90 && mids < 40) return 'chill';
        if (bass < 50 && mids < 30 && treble < 40) return 'calm';
        
        return 'mellow';
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

        if (this.analyser) {
            const data = this.analyser.getFrequencyData();
            const bands = this.getFrequencyBands(data);

            this.backgroundSphere.material.uniforms.u_time.value = this.clock.elapsedTime;
            this.backgroundSphere.material.uniforms.u_bass.value = bands.bass / 255;

            if (this.oceanicPlane && this.oceanicPlane.visible) {
                this.oceanicPlane.material.uniforms.u_time.value = this.clock.elapsedTime;
                this.oceanicPlane.material.uniforms.u_frequency.value = bands.mids / 255;
            }

            if (this.particleSystem.visible && !this.manualTheme) {
                const emotion = this.getEmotionFromAudio(bands);
                const targetPalette = this.colorPalettes[emotion];
                const targetColor = targetPalette[Math.floor(this.clock.elapsedTime / 5) % targetPalette.length];
                this.currentColor.lerp(targetColor, 0.01);
                this.particleSystem.material.color.set(this.currentColor);
            }

            const energy = bands.treble;
            if (energy > this.beatCutOff && energy > 10) {
                this.beatCutOff = energy * 1.1;
                this.beatTime = 0;
            } else {
                if (this.beatTime <= this.beatHoldTime) {
                    this.beatTime++;
                } else {
                    this.beatCutOff *= this.beatDecayRate;
                    this.beatCutOff = Math.max(this.beatCutOff, 10);
                }
            }

            const midPositions = this.particleSystem.geometry.attributes.position.array;
            for (let i = 0; i < midPositions.length / 3; i++) {
                const i3 = i * 3;
                const displacement = (bands.mids / 255) * 20;
                const direction = new THREE.Vector3(this.originalPositions[i3], this.originalPositions[i3+1], this.originalPositions[i3+2]).normalize();
                midPositions[i3] = this.originalPositions[i3] + direction.x * displacement;
                midPositions[i3+1] = this.originalPositions[i3+1] + direction.y * displacement;
                midPositions[i3+2] = this.originalPositions[i3+2] + direction.z * displacement;
            }
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
            this.particleSystem.rotation.y += 0.001;

            const sparkPositions = this.sparkSystem.geometry.attributes.position.array;
            const sparkLifetimes = this.sparkSystem.geometry.attributes.lifetime.array;

            if (this.beatTime < 10) {
                for (let i = 0; i < sparkLifetimes.length; i++) {
                    if (sparkLifetimes[i] <= 0) {
                        sparkLifetimes[i] = 60;
                        const i3 = i * 3;
                        const velocity = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
                        sparkPositions[i3] = velocity.x;
                        sparkPositions[i3+1] = velocity.y;
                        sparkPositions[i3+2] = velocity.z;
                        break;
                    }
                }
            }

            for (let i = 0; i < sparkLifetimes.length; i++) {
                if (sparkLifetimes[i] > 0) {
                    const i3 = i * 3;
                    sparkPositions[i3] += 0.5;
                    sparkLifetimes[i]--;
                }
            }
            this.sparkSystem.geometry.attributes.position.needsUpdate = true;
            this.sparkSystem.geometry.attributes.lifetime.needsUpdate = true;
        }

        const time = this.clock.elapsedTime;
        this.camera.position.x = Math.sin(time * 0.1) * 100;
        this.camera.position.z = Math.cos(time * 0.1) * 100;
        this.camera.position.y = Math.cos(time * 0.05) * 20;
        this.camera.lookAt(this.scene.position);

        this.renderer.render(this.scene, this.camera);
    }

    setColorTheme(theme) {
        this.manualTheme = true;
        this.particleSystem.visible = true;
        this.oceanicPlane.visible = false;

        let color;
        switch(theme) {
            case 'oceanic_flow':
                this.particleSystem.visible = false;
                this.oceanicPlane.visible = true;
                this.manualTheme = true;
                break;
            case 'fire':
                color = 0xff8866;
                break;
            case 'ocean':
                color = 0x66ccff;
                break;
            case 'forest':
                color = 0x77ff88;
                break;
            case 'aurora':
            default:
                this.manualTheme = false;
                color = this.currentColor.getHex();
        }

        if (color) {
            this.particleSystem.material.color.setHex(color);
        }
    }
    
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.scene.traverse(object => {
            if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (object.material.isMaterial) object.material.dispose();
                    else for (const material of object.material) material.dispose();
                }
            }
        });
        this.renderer.dispose();
    }
}

window.AudioVisualizer = ThreeVisualizer