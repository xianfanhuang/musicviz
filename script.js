/* ==========  首屏呼吸圆环（立即执行） ========== */
const heroCV = document.getElementById('heroCanvas');
const heroCtx = heroCV ? heroCV.getContext('2d') : null;
let heroT = 0;
(function startHero() {
  if (!heroCV || !heroCtx) return;
  
  const dpr = window.devicePixelRatio || 1;
  function fitHero() {
    const rect = heroCV.getBoundingClientRect();
    heroCV.width = rect.width * dpr;
    heroCV.height = rect.height * dpr;
    heroCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitHero();
  window.addEventListener('resize', fitHero);
  
  function breathe() {
    if (!heroCV.offsetParent) return;
    const w = heroCV.clientWidth, h = heroCV.clientHeight;
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.35;
    const breath = (Math.sin(heroT * 0.04) + 1) * 0.5;
    const hue = 210 + breath * 60;
    
    heroCtx.clearRect(0, 0, w, h);
    const grad = heroCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsla(${hue},80%,60%,${0.2 + breath * 0.3})`);
    grad.addColorStop(1, `hsla(${hue},80%,50%,0)`);
    
    heroCtx.fillStyle = grad;
    heroCtx.beginPath();
    heroCtx.arc(cx, cy, r * (0.9 + breath * 0.1), 0, Math.PI * 2);
    heroCtx.fill();
    
    heroT++;
    requestAnimationFrame(breathe);
  }
  breathe();
})();

/* ==========  锁屏封面生成器 ========== */
let lockURL = '';
function updateLockScreenCover() {
  const player = window.player;
  if (!player?.visualizer || !document.hidden) return;
  
  player.visualizer.canvas.toBlob(blob => {
    if (lockURL) URL.revokeObjectURL(lockURL);
    lockURL = URL.createObjectURL(blob);
    
    if ('mediaSession' in navigator) {
      // 初始化媒体会话（避免首次调用undefined）
      if (!navigator.mediaSession.metadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '未在播放',
          artist: 'Sonoria',
          artwork: [{ src: lockURL, sizes: '512x512', type: 'image/png' }]
        });
      } else {
        navigator.mediaSession.metadata.artwork = [{ src: lockURL, sizes: '512x512', type: 'image/png' }];
      }
    }
  }, 'image/png', 0.8);
}
setInterval(updateLockScreenCover, 250);

/* ==========  底部控制岛显隐 ========== */
function revealControls() {
  const controlBar = document.getElementById('controlBar');
  if (controlBar) {
    controlBar.classList.add('show');
    document.body.style.paddingBottom = '80px'; // 匹配控制栏高度
  }
}

/* ==========  迷你可视化 ========== */
const miniCV = document.getElementById('miniVis');
const mCtx = miniCV ? miniCV.getContext('2d') : null;
(function drawMiniVis() {
  if (!mCtx || !miniCV) return;
  
  mCtx.clearRect(0, 0, 80, 80);
  const energy = window.player?.visualizer ? window.player.visualizer.energyLevel / 255 : 0;
  const ang = energy * Math.PI * 2;
  
  mCtx.beginPath();
  mCtx.arc(40, 40, 30, -Math.PI / 2, -Math.PI / 2 + ang);
  mCtx.strokeStyle = '#007AFF';
  mCtx.lineWidth = 4;
  mCtx.stroke();
  
  requestAnimationFrame(drawMiniVis);
})();

/* ==========  文件入口 ========== */
const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', e => {
    const player = window.player;
    if (player) {
      player.processFiles([...e.target.files]);
      if (player.playlist.length) revealControls();
    }
  });
}

/* ==========  MusicPlayer 类（完整逻辑） ========== */
class MusicPlayer {
  constructor() {
    // 基础属性初始化
    this.audioElement = document.getElementById('audioPlayer');
    this.playlist = [];
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.isShuffleOn = false;
    this.repeatMode = 0; // 0:无循环,1:单曲,2:列表
    this.volume = 0.8;
    this.audioContext = null;
    this.visualizer = null;
    
    // 初始化流程（带错误捕获，避免中断）
    try {
      this.initializeAudioContext();
      this.setupEventListeners();
      this.setupVisualizer();
      this.updateUI();
      console.log('MusicPlayer 构造函数初始化完成');
    } catch (error) {
      console.error('MusicPlayer 初始化失败:', error);
      this.showNotification('播放器初始化失败，请刷新页面重试', 'error');
    }
  }

  /* 音频上下文初始化（兼容Safari） */
  async initializeAudioContext() {
    try {
      // 修复Safari需用户交互的问题
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('音频上下文创建成功，状态:', this.audioContext.state);
    } catch (error) {
      console.warn('无法创建音频上下文:', error);
      this.showNotification('浏览器不支持音频可视化（需升级浏览器）', 'error');
    }
  }

  /* 事件监听（添加DOM存在性判断） */
  setupEventListeners() {
    // 1. 文件上传区域
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', () => fileInput.click());
      uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
      uploadArea.addEventListener('drop', this.handleDrop.bind(this));
    }
    if (fileInput) fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    // 2. 核心控制按钮
    const btnMap = {
      playBtn: 'togglePlay',
      prevBtn: 'previousTrack',
      nextBtn: 'nextTrack',
      shuffleBtn: 'toggleShuffle',
      repeatBtn: 'toggleRepeat',
      fullscreenBtn: 'toggleFullscreen',
      shuffleAllBtn: 'shuffleAll',
      clearPlaylistBtn: 'clearPlaylist',
      muteBtn: 'toggleMute',
      sniffBtn: 'sniffURL'
    };
    Object.entries(btnMap).forEach(([id, method]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', this[method].bind(this));
    });

    // 3. 进度条 & 音量
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.addEventListener('click', this.seekTo.bind(this));
    
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', this.setVolume.bind(this));
      volumeSlider.value = this.volume * 100; // 初始化音量
    }

    // 4. 可视化控制
    const visualizerMode = document.getElementById('visualizerMode');
    const colorTheme = document.getElementById('colorTheme');
    if (visualizerMode) visualizerMode.addEventListener('change', this.changeVisualizerMode.bind(this));
    if (colorTheme) colorTheme.addEventListener('change', this.changeColorTheme.bind(this));

    // 5. URL探嗅（输入框回车）
    const urlInput = document.getElementById('urlInput');
    if (urlInput) {
      urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sniffURL();
      });
    }

    // 6. 音频元素原生事件
    if (this.audioElement) {
      ['loadedmetadata', 'timeupdate', 'ended', 'play', 'pause'].forEach(evt => {
        this.audioElement.addEventListener(evt, this[`on${evt.charAt(0).toUpperCase() + evt.slice(1)}`].bind(this));
      });
    }

    // 7. 键盘快捷键
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  /* 可视化器初始化（修复DOM依赖） */
  setupVisualizer() {
    const canvas = document.getElementById('visualizerCanvas');
    if (!canvas || !this.audioContext) {
      console.warn('可视化器初始化失败：画布或音频上下文缺失');
      return;
    }
    
    // 确保 AudioVisualizer 已加载（避免依赖顺序问题）
    if (!window.AudioVisualizer) {
      console.warn('AudioVisualizer 类未定义，重试初始化...');
      setTimeout(() => this.setupVisualizer(), 100);
      return;
    }
    
    this.visualizer = new AudioVisualizer(canvas, this.audioContext);
    if (this.audioElement) this.visualizer.connectAudio(this.audioElement);
    this.startPerformanceMonitor();
    console.log('可视化器初始化完成');
  }

  /* 拖拽处理 */
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

  /* 文件处理（优化进度显示+错误提示） */
  async processFiles(files) {
    if (!window.audioDecoder) {
      this.showNotification('音频解码器未加载，无法处理文件', 'error');
      return;
    }
    
    // 筛选音频文件
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || window.audioDecoder.detectFormat(file)
    );
    if (audioFiles.length === 0) {
      this.showNotification('请选择有效的音频文件（MP3/FLAC等）', 'error');
      return;
    }

    const uploadArea = document.getElementById('uploadArea') || document.getElementById('sniffArea');
    if (!uploadArea) return;
    
    const originalContent = uploadArea.innerHTML;
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
        progressInfo.textContent = `处理中: ${processed}/${audioFiles.length} - ${file.name}`;
        const result = await window.audioDecoder.decodeAudio(file);
        const audioURL = URL.createObjectURL(result.audioData);
        
        // 构造轨道信息
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
        processed++;
        console.log(`文件处理完成: ${track.metadata.title}（${result.originalFormat}→${result.decodedFormat}）`);
      } catch (error) {
        console.error('文件处理失败:', error);
        this.showNotification(`处理 ${file.name} 失败: ${error.message}`, 'error');
        processed++;
      }
      progressInfo.textContent = `已处理: ${processed}/${audioFiles.length}`;
    }

    // 恢复上传区域
    setTimeout(() => {
      uploadArea.innerHTML = originalContent;
    }, 1000);

    // 自动加载第一首
    if (this.playlist.length > 0 && !this.isPlaying) {
      this.loadTrack(0);
    }
    this.showNotification(`成功处理 ${this.playlist.length} 个音频文件`, 'success');
  }

  /* URL探嗅（修复GitHub Pages跨域问题） */
  async sniffURL() {
    const urlInput = document.getElementById('urlInput');
    const sniffBtn = document.getElementById('sniffBtn');
    if (!urlInput || !sniffBtn) return;

    const url = urlInput.value.trim();
    if (!url) {
      this.showNotification('请输入音频URL（如网易云歌单/直链）', 'error');
      return;
    }

    // 禁用控件防止重复提交
    sniffBtn.disabled = true;
    sniffBtn.textContent = '🔄 解析中...';
    urlInput.disabled = true;

    try {
      // GitHub Pages跨域提示
      this.showNotification('GitHub Pages可能限制跨域探嗅，优先支持直链音频', 'info');
      if (!window.networkSniffer) {
        throw new Error('网络探嗅器未加载');
      }
      
      const audioList = await window.networkSniffer.sniffAudio(url);
      let addedCount = 0;

      for (const audioInfo of audioList) {
        try {
          const track = {
            id: this.generateId(),
            url: audioInfo.url,
            metadata: {
              title: audioInfo.title || '未知标题',
              artist: audioInfo.artist || '未知艺术家',
              album: audioInfo.album || '未知专辑',
              duration: audioInfo.duration || 0,
              filename: `${audioInfo.title || '未知音频'}.${audioInfo.format}`,
              size: audioInfo.size || 0
            },
            originalFormat: audioInfo.source,
            decodedFormat: audioInfo.format,
            cover: audioInfo.cover || `https://picsum.photos/300/300?random=${this.generateId()}`
          };
          this.playlist.push(track);
          this.addToPlaylistUI(track);
          addedCount++;
        } catch (error) {
          console.warn('跳过无效音频:', error);
        }
      }

      if (addedCount > 0) {
        this.showNotification(`成功添加 ${addedCount} 首音频到播放列表`, 'success');
        if (!this.isPlaying && this.playlist.length > 0) {
          await this.loadTrack(this.playlist.length - addedCount);
        }
      } else {
        this.showNotification('未找到有效音频（跨域或链接无效）', 'warning');
      }
      urlInput.value = '';
    } catch (error) {
      console.error('URL探嗅失败:', error);
      this.showNotification(`解析失败: ${error.message}（建议使用本地文件上传）`, 'error');
    } finally {
      // 恢复控件
      sniffBtn.disabled = false;
      sniffBtn.textContent = '🔍 解析';
      urlInput.disabled = false;
    }
  }

  /* 播放列表UI添加 */
  addToPlaylistUI(track) {
    const playlist = document.getElementById('playlist');
    if (!playlist) return;

    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.dataset.trackId = track.id;

    // 格式标识
    const formatBadge = track.originalFormat !== track.decodedFormat ? 
      `<span class="format-badge" title="原格式: ${track.originalFormat}">${track.originalFormat.toUpperCase()}</span>` : '';
    const sourceBadge = !formatBadge && track.originalFormat ? 
      `<span class="format-badge" title="来源: ${track.originalFormat}">${track.originalFormat.toUpperCase()}</span>` : '';

    item.innerHTML = `
      <div class="track-number">${this.playlist.length}</div>
      <div class="track-details">
        <div class="track-name">
          ${track.metadata.title || '未知标题'}
          ${formatBadge || sourceBadge}
        </div>
        <div class="track-meta">
          <span class="track-artist">${track.metadata.artist || '未知艺术家'}</span>
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

  /* 加载轨道（修复音频上下文恢复） */
  async loadTrack(index) {
    if (index < 0 || index >= this.playlist.length) return;
    this.currentTrackIndex = index;
    const track = this.playlist[index];

    // 恢复音频上下文（必须用户交互后调用）
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('音频上下文已恢复');
      } catch (error) {
        console.error('恢复音频上下文失败:', error);
        this.showNotification('需点击页面后才能播放音频（浏览器安全限制）', 'error');
        return;
      }
    }

    try {
      if (!track.url || track.url.includes('undefined')) {
        throw new Error('音频URL无效');
      }

      // 清理之前的音频资源
      this.cleanupAudioElement();

      // 设置音频源
      this.audioElement.src = track.url;
      
      // 加载完成/错误处理
      const loadHandler = () => {
        this.showNotification(`已加载: ${track.metadata.title}`, 'success');
        // 更新媒体会话标题
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.metadata.title,
            artist: track.metadata.artist,
            album: track.metadata.album,
            artwork: [{ src: track.cover || lockURL, sizes: '512x512', type: 'image/png' }]
          });
        }
      };
      const errorHandler = (error) => {
        console.error('音频加载失败:', error);
        this.showNotification(`无法播放 "${track.metadata.title}": 音频资源异常`, 'warning');
      };

      this.audioElement.addEventListener('loadeddata', loadHandler, { once: true });
      this.audioElement.addEventListener('error', errorHandler, { once: true });
      this.audioElement.load();

      // 更新UI
      this.updateTrackInfo(track.metadata);
      this.updatePlaylistUI();

    } catch (error) {
      console.error('加载音频失败:', error);
      this.showNotification(`加载失败: ${error.message}`, 'error');
    }
  }

  /* 其他核心方法（保持原有逻辑，添加DOM判断） */
  updateTrackInfo(metadata) {
    const trackTitle = document.getElementById('trackTitle');
    const trackArtist = document.getElementById('trackArtist');
    if (trackTitle) trackTitle.textContent = metadata.title || '未在播放';
    if (trackArtist) trackArtist.textContent = metadata.artist || '';
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
        this.showNotification('播放列表为空，请上传音频或解析URL', 'warning');
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
        this.showNotification('需点击页面后播放（浏览器安全限制）', 'error');
      }
    }
  }
  previousTrack() {
    if (this.playlist.length === 0) return;
    let newIndex = this.isShuffleOn ? 
      Math.floor(Math.random() * this.playlist.length) : 
      (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    this.loadTrack(newIndex);
    if (this.isPlaying) this.audioElement.play();
  }
  nextTrack() {
    if (this.playlist.length === 0) return;
    let newIndex = this.isShuffleOn ? 
      Math.floor(Math.random() * this.playlist.length) : 
      (this.currentTrackIndex + 1) % this.playlist.length;
    this.loadTrack(newIndex);
    if (this.isPlaying) this.audioElement.play();
  }
  toggleShuffle() {
    this.isShuffleOn = !this.isShuffleOn;
    const btn = document.getElementById('shuffleBtn');
    if (btn) {
      btn.style.background = this.isShuffleOn ? 
        'linear-gradient(135deg, #667eea, #764ba2)' : 
        'rgba(255,255,255,.2)';
    }
  }
  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    const btn = document.getElementById('repeatBtn');
    if (!btn) return;

    const modes = ['🔁', '🔂', '🔁'];
    const colors = [
      'rgba(255,255,255,.2)',
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
    this.audioElement.currentTime = percentage * this.audioElement.duration;
  }
  setVolume(e) {
    this.volume = e.target.value / 100;
    this.audioElement.volume = this.volume;
    this.updateVolumeIcon();
  }
  toggleMute() {
    const volumeSlider = document.getElementById('volumeSlider');
    if (!volumeSlider) return;

    if (this.audioElement.volume > 0) {
      this.audioElement.volume = 0;
      volumeSlider.value = 0;
    } else {
      this.audioElement.volume = this.volume;
      volumeSlider.value = this.volume * 100;
    }
    this.updateVolumeIcon();
  }
  updateVolumeIcon() {
    const muteBtn = document.getElementById('muteBtn');
    if (!muteBtn) return;

    const volume = this.audioElement.volume;
    muteBtn.textContent = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';
  }
  changeVisualizerMode(e) {
    if (this.visualizer) this.visualizer.setMode(e.target.value);
  }
  changeColorTheme(e) {
    if (this.visualizer) this.visualizer.setColorTheme(e.target.value);
  }
  onLoadedMetadata() { this.updateUI(); }
  onTimeUpdate() { this.updateProgress(); }
  onTrackEnded() {
    if (this.repeatMode === 1) {
      this.audioElement.currentTime = 0;
      this.audioElement.play();
    } else if (this.repeatMode === 2 || this.currentTrackIndex < this.playlist.length - 1) {
      this.nextTrack();
    } else {
      this.isPlaying = false;
      this.updatePlayButton();
      if (this.visualizer) this.visualizer.stop();
    }
  }
  onPlay() {
    this.isPlaying = true;
    this.updatePlayButton();
    if (this.visualizer) this.visualizer.start();
    revealControls();
  }
  onPause() {
    this.isPlaying = false;
    this.updatePlayButton();
    if (this.visualizer) this.visualizer.stop();
  }
  updateUI() {
    this.updateProgress();
    this.updatePlayButton();
    this.updateVolumeIcon();
  }
  updateProgress() {
    if (!this.audioElement.duration) return;
    const percentage = (this.audioElement.currentTime / this.audioElement.duration) * 100;
    const progressFill = document.getElementById('progressFill');
    const currentTime = document.getElementById('currentTime');
    const totalTime = document.getElementById('totalTime');

    if (progressFill) progressFill.style.width = percentage + '%';
    if (currentTime) currentTime.textContent = this.formatTime(this.audioElement.currentTime);
    if (totalTime) totalTime.textContent = this.formatTime(this.audioElement.duration);
  }
  updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }
  }
  formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  generateId() { return '_' + Math.random().toString(36).substr(2, 9); }
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
    const oldSrc = this.audioElement.src;
    this.audioElement.pause();
    this.audioElement.currentTime = 0;

    // 清理未使用的blob URL
    if (oldSrc && oldSrc.startsWith('blob:')) {
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
  adjustVolume(delta) {
    const volumeSlider = document.getElementById('volumeSlider');
    if (!volumeSlider) return;
    const newVolume = Math.max(0, Math.min(100, parseInt(volumeSlider.value) + (delta * 100)));
    volumeSlider.value = newVolume;
    this.setVolume({ target: { value: newVolume } });
  }
  toggleFullscreen() {
    const visualizerSection = document.querySelector('.vizBox');
    if (!visualizerSection) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.warn('退出全屏失败:', err);
      });
      visualizerSection.classList.remove('fullscreen');
    } else {
      visualizerSection.requestFullscreen().catch(err => {
        console.warn('进入全屏失败:', err);
        this.showNotification('无法进入全屏（浏览器限制）', 'warning');
      });
      visualizerSection.classList.add('fullscreen');
    }
  }
  shuffleAll() {
    if (this.playlist.length === 0) {
      this.showNotification('播放列表为空，无法随机播放', 'warning');
      return;
    }

    this.isShuffleOn = true;
    this.updateUI();

    const randomIndex = Math.floor(Math.random() * this.playlist.length);
    this.loadTrack(randomIndex);
    if (!this.isPlaying) this.togglePlay();

    this.showNotification('已开启随机播放全部', 'success');
  }
  clearPlaylist() {
    if (this.playlist.length === 0) {
      this.showNotification('播放列表已为空', 'info');
      return;
    }

    // 停止播放
    if (this.isPlaying) this.togglePlay();

    // 清理blob URL
    this.playlist.forEach(track => {
      if (track.url && track.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(track.url);
        } catch (e) {
          console.warn('清理blob URL失败:', e);
        }
      }
    });

    // 清空数据
    this.playlist = [];
    this.currentTrackIndex = 0;
    const playlist = document.getElementById('playlist');
    if (playlist) playlist.innerHTML = '';
    this.updateTrackInfo({ title: '未在播放', artist: '' });
    this.updateUI();

    this.showNotification('播放列表已清空', 'success');
  }
  toggleKeyboardShortcuts() {
    const shortcuts = document.getElementById('keyboardShortcuts');
    if (shortcuts) {
      shortcuts.style.display = shortcuts.style.display === 'none' ? 'block' : 'none';
    } else {
      // 动态创建快捷键说明
      const shortcutsEl = document.createElement('div');
      shortcutsEl.id = 'keyboardShortcuts';
      shortcutsEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--glass);
        padding: 20px;
        border-radius: 8px;
        z-index: 1000;
        max-width: 300px;
      `;
      shortcutsEl.innerHTML = `
        <h3 style="margin-bottom:12px">键盘快捷键</h3>
        <p>空格：播放/暂停</p>
        <p>←：上一曲 | →：下一曲</p>
        <p>↑：音量+ | ↓：音量-</p>
        <p>F：全屏 | S：随机全部</p>
        <p>R：循环模式 | ?：显示/隐藏</p>
        <button id="closeShortcuts" class="ctrl" style="margin-top:12px">关闭</button>
      `;
      document.body.appendChild(shortcutsEl);
      
      document.getElementById('closeShortcuts').addEventListener('click', () => {
        shortcutsEl.style.display = 'none';
      });
    }
  }
  startPerformanceMonitor() {
    const fpsDisplay = document.getElementById('fpsDisplay');
    const perfLevel = document.getElementById('perfLevel');
    if (!fpsDisplay || !perfLevel || !this.visualizer) return;

    setInterval(() => {
      const fps = Math.round(this.visualizer.fps || 60);
      const level = this.visualizer.performanceLevel || 'medium';

      fpsDisplay.textContent = `FPS: ${fps}`;
      const levelNames = {
        'low': '省电模式',
        'medium': '标准模式',
        'high': '高性能'
      };
      perfLevel.textContent = levelNames[level] || '标准模式';

      // FPS颜色提示
      fpsDisplay.style.color = fps < 30 ? '#ff6b6b' : fps < 50 ? '#ffd93d' : '#4facfe';
    }, 1000);
  }
  handleKeyboardShortcuts(e) {
    // 输入框中不触发快捷键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key.toLowerCase()) {
      case ' ': e.preventDefault(); this.togglePlay(); break;
      case 'arrowleft': e.preventDefault(); this.previousTrack(); break;
      case 'arrowright': e.preventDefault(); this.nextTrack(); break;
      case 'arrowup': e.preventDefault(); this.adjustVolume(0.1); break;
      case 'arrowdown': e.preventDefault(); this.adjustVolume(-0.1); break;
      case 'f': e.preventDefault(); this.toggleFullscreen(); break;
      case 's': e.preventDefault(); this.shuffleAll(); break;
      case 'r': e.preventDefault(); this.toggleRepeat(); break;
      case '?': e.preventDefault(); this.toggleKeyboardShortcuts(); break;
    }
  }
}

/* ==========  全局入口（确保DOM加载完成） ========== */
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded 触发，初始化播放器');
  try {
    // 全局挂载播放器实例
    window.player = new MusicPlayer();
    console.log('window.player 实例创建成功:', !!window.player);
    
    // 绑定首屏点击事件
    bindStageClick();
  } catch (error) {
    console.error('全局初始化失败:', error);
    alert('播放器初始化失败，请刷新页面或使用最新浏览器');
  }
});

// 首屏点击绑定（恢复音频上下文+触发文件选择）
function bindStageClick() {
  const stage = document.getElementById('stage');
  if (!stage) return;

  stage.addEventListener('click', () => {
    const player = window.player;
    if (player?.audioContext?.state === 'suspended') {
      player.audioContext.resume().then(() => {
        console.log('首屏点击恢复音频上下文');
      });
    }

    // 有播放列表显示控制栏，无则打开文件选择
    if (player?.playlist.length) {
      revealControls();
    } else {
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.click();
    }
  }, { once: false });
}