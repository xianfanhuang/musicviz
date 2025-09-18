const heroCV = document.getElementById('heroCanvas');
const heroCtx = heroCV.getContext('2d');
let heroT = 0;
(function startHero() {
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
let lockURL = '';
function updateLockScreenCover() {
  // 依赖可视化器实例，需在 MusicPlayer 初始化后生效
  if (!window.player?.visualizer || !document.hidden) return;
  window.player.visualizer.canvas.toBlob(blob => {
    if (lockURL) URL.revokeObjectURL(lockURL);
    lockURL = URL.createObjectURL(blob);
    if ('mediaSession' in navigator) {
      // 初始化媒体会话元数据（避免首次调用时 undefined）
      if (!navigator.mediaSession.metadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '正在播放',
          artist: 'Sonoria 播放器',
          artwork: [{ src: lockURL, sizes: '512x512', type: 'image/png' }]
        });
      } else {
        navigator.mediaSession.metadata.artwork = [{ src: lockURL, sizes: '512x512', type: 'image/png' }];
      }
    }
  }, 'image/png', 0.8);
}
setInterval(updateLockScreenCover, 250);
function revealControls() {
  const controlBar = document.getElementById('controlBar');
  if (controlBar) {
    controlBar.classList.add('show');
    document.body.style.paddingBottom = '64px';
  }
}
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
const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', e => {
    if (window.player) {
      window.player.processFiles([...e.target.files]);
      if (window.player.playlist.length) revealControls();
    }
  });
}
class MusicPlayer {
  constructor() {
    this.audioElement = document.getElementById('audioPlayer');
    this.playlist = [];
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.isShuffleOn = false;
    this.repeatMode = 0; // 0: 无循环, 1: 单曲循环, 2: 列表循环
    this.volume = 0.8;
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
      this.showNotification('浏览器不支持音频可视化功能', 'error');
    }
  }

  setupEventListeners() {
    // 文件上传区域事件
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', () => fileInput.click());
      uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
      uploadArea.addEventListener('drop', this.handleDrop.bind(this));
    }
    if (fileInput) fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    // 播放控制按钮事件
    const btnMap = {
      playBtn: 'togglePlay',
      prevBtn: 'previousTrack',
      nextBtn: 'nextTrack',
      shuffleBtn: 'toggleShuffle',
      repeatBtn: 'toggleRepeat',
      fullscreenBtn: 'toggleFullscreen',
      shuffleAllBtn: 'shuffleAll',
      clearPlaylistBtn: 'clearPlaylist',
      muteBtn: 'toggleMute'
    };
    Object.entries(btnMap).forEach(([id, method]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', this[method].bind(this));
    });

    // 进度条事件
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.addEventListener('click', this.seekTo.bind(this));

    // 音量滑块事件
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', this.setVolume.bind(this));
      volumeSlider.value = this.volume * 100; // 初始化音量滑块值
    }

    // 可视化控制事件
    const visualizerMode = document.getElementById('visualizerMode');
    const colorTheme = document.getElementById('colorTheme');
    if (visualizerMode) visualizerMode.addEventListener('change', this.changeVisualizerMode.bind(this));
    if (colorTheme) colorTheme.addEventListener('change', this.changeColorTheme.bind(this));

    // URL探嗅事件
    const sniffBtn = document.getElementById('sniffBtn');
    const urlInput = document.getElementById('urlInput');
    if (sniffBtn) sniffBtn.addEventListener('click', this.sniffURL.bind(this));
    if (urlInput) {
      urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sniffURL();
      });
    }

    // 音频元素原生事件
    ['loadedmetadata', 'timeupdate', 'ended', 'play', 'pause'].forEach(evt => {
      this.audioElement.addEventListener(evt, this[`on${evt.charAt(0).toUpperCase() + evt.slice(1)}`].bind(this));
    });

    // 键盘快捷键事件
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  setupVisualizer() {
    const canvas = document.getElementById('visualizerCanvas');
    if (!canvas || !this.audioContext) return;
    this.visualizer = new AudioVisualizer(canvas, this.audioContext);
    this.visualizer.connectAudio(this.audioElement);
    this.startPerformanceMonitor();
  }

  // 拖拽相关方法
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

  // 文件处理方法
  async processFiles(files) {
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || (window.audioDecoder && window.audioDecoder.detectFormat(file))
    );
    if (audioFiles.length === 0) {
      this.showNotification('请选择有效的音频文件', 'error');
      return;
    }

    const uploadArea = document.getElementById('uploadArea');
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

    // 自动加载第一首（若未播放）
    if (this.playlist.length > 0 && !this.isPlaying) {
      this.loadTrack(0);
    }
    this.showNotification(`成功处理 ${this.playlist.length} 个音频文件`, 'success');
  }

  // URL探嗅方法
  async sniffURL() {
    const urlInput = document.getElementById('urlInput');
    const sniffBtn = document.getElementById('sniffBtn');
    if (!urlInput || !sniffBtn) return;

    const url = urlInput.value.trim();
    if (!url) {
      this.showNotification('请输入URL', 'error');
      return;
    }

    // 禁用控件防止重复提交
    sniffBtn.disabled = true;
    sniffBtn.textContent = '🔄 解析中...';
    urlInput.disabled = true;

    try {
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
            cover: audioInfo.cover
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
        this.showNotification('未找到有效的音频资源', 'warning');
      }
      urlInput.value = '';
    } catch (error) {
      console.error('URL探嗅失败:', error);
      this.showNotification(`解析失败: ${error.message}`, 'error');
    } finally {
      // 恢复控件状态
      sniffBtn.disabled = false;
      sniffBtn.textContent = '🔍 解析';
      urlInput.disabled = false;
    }
  }

  // 播放列表UI添加方法
  addToPlaylistUI(track) {
    const playlist = document.getElementById('playlist');
    if (!playlist) return;

    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.dataset.trackId = track.id;

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

  // 加载轨道方法
  async loadTrack(index) {
    if (index < 0 || index >= this.playlist.length) return;
    this.currentTrackIndex = index;
    const track = this.playlist[index];

    // 恢复音频上下文
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      if (!track.url || track.url.includes('undefined')) {
        throw new Error('音频URL无效');
      }

      // 清理之前的音频资源
      this.cleanupAudioElement();

      // 设置音频源并加载
      this.audioElement.src = track.url;
      const loadHandler = () => {
        this.showNotification(`已加载: ${track.metadata.title}`, 'success');
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

  // 更新轨道信息UI
  updateTrackInfo(metadata) {
    const trackTitle = document.getElementById('trackTitle');
    const trackArtist = document.getElementById('trackArtist');
    if (trackTitle) trackTitle.textContent = metadata.title || '选择音频文件开始播放';
    if (trackArtist) trackArtist.textContent = metadata.artist || '';
  }

  // 更新播放列表UI选中状态
  updatePlaylistUI() {
    const items = document.querySelectorAll('.playlist-item');
    items.forEach((item, index) => {
      item.classList.toggle('active', index === this.currentTrackIndex);
    });
  }

  // 播放/暂停切换
  async togglePlay() {
    if (!this.audioElement.src) {
      if (this.playlist.length > 0) {
        await this.loadTrack(0);
      } else {
        this.showNotification('播放列表为空，请先添加音频', 'warning');
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
        this.showNotification('播放失败，请检查音频资源', 'error');
      }
    }
  }

  // 上一曲
  previousTrack() {
    if (this.playlist.length === 0) return;
    let newIndex;
    if (this.isShuffleOn) {
      newIndex = Math.floor(Math.random() * this.playlist.length);
    } else {
      newIndex = this.currentTrackIndex - 1;
      newIndex = newIndex < 0 ? this.playlist.length - 1 : newIndex;
    }
    this.loadTrack(newIndex);
    if (this.isPlaying) this.audioElement.play();
  }

  // 下一曲
  nextTrack() {
    if (this.playlist.length === 0) return;
    let newIndex;
    if (this.isShuffleOn) {
      newIndex = Math.floor(Math.random() * this.playlist.length);
    } else {
      newIndex = this.currentTrackIndex + 1;
      newIndex = newIndex >= this.playlist.length ? 0 : newIndex;
    }
    this.loadTrack(newIndex);
    if (this.isPlaying) this.audioElement.play();
  }

  // 随机播放切换
  toggleShuffle() {
    this.isShuffleOn = !this.isShuffleOn;
    const btn = document.getElementById('shuffleBtn');
    if (btn) {
      btn.style.background = this.isShuffleOn ? 
        'linear-gradient(135deg, #667eea, #764ba2)' : 
        'rgba(255, 255, 255, 0.2)';
    }
  }

  // 循环模式切换
  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    const btn = document.getElementById('repeatBtn');
    if (!btn) return;

    const modes = ['🔁', '🔂', '🔁'];
    const colors = [
      'rgba(255, 255, 255, 0.2)',
      'linear-gradient(135deg, #667eea, #764ba2)',
      'linear-gradient(135deg, #ff6b6b, #ee5a24)'
    ];
    btn.textContent = modes[this.repeatMode];
    btn.style.background = colors[this.repeatMode];
  }

  // 进度条拖动定位
  seekTo(e) {
    if (!this.audioElement.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const seekTime = percentage * this.audioElement.duration;
    this.audioElement.currentTime = seekTime;
  }

  // 设置音量
  setVolume(e) {
    this.volume = e.target.value / 100;
    this.audioElement.volume = this.volume;
    this.updateVolumeIcon();
  }

  // 静音切换
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

  // 更新音量图标
  updateVolumeIcon() {
    const muteBtn = document.getElementById('muteBtn');
    if (!muteBtn) return;

    const volume = this.audioElement.volume;
    if (volume === 0) {
      muteBtn.textContent = '🔇';
    } else if (volume < 0.5) {
      muteBtn.textContent = '🔉';
    } else {
      muteBtn.textContent = '🔊';
    }
  }

  // 切换可视化模式
  changeVisualizerMode(e) {
    if (this.visualizer) {
      this.visualizer.setMode(e.target.value);
    }
  }

  // 切换颜色主题
  changeColorTheme(e) {
    if (this.visualizer) {
      this.visualizer.setColorTheme(e.target.value);
    }
  }

  // 音频元数据加载完成回调
  onLoadedMetadata() {
    this.updateUI();
  }

  // 音频播放时间更新回调
  onTimeUpdate() {
    this.updateProgress();
  }

  // 音频播放结束回调
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
      if (this.visualizer) this.visualizer.stop();
    }
  }

  // 音频播放开始回调
  onPlay() {
    this.isPlaying = true;
    this.updatePlayButton();
    if (this.visualizer) this.visualizer.start();
    revealControls(); // 播放时显示控制栏
  }

  // 音频暂停回调
  onPause() {
    this.isPlaying = false;
    this.updatePlayButton();
    if (this.visualizer) this.visualizer.stop();
  }

  // 更新整体UI
  updateUI() {
    this.updateProgress();
    this.updatePlayButton();
    this.updateVolumeIcon();
  }

  // 更新进度条
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

  // 更新播放按钮图标
  updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }
  }

  // 时间格式化（秒转分:秒）
  formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // 生成唯一ID
  generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
  }

  // 显示通知
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

  // 清理音频元素资源
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

  // 调整音量（快捷键用）
  adjustVolume(delta) {
    const volumeSlider = document.getElementById('volumeSlider');
    if (!volumeSlider) return;
    const newVolume = Math.max(0, Math.min(100, parseInt(volumeSlider.value) + (delta * 100)));
    volumeSlider.value = newVolume;
    this.setVolume({ target: { value: newVolume } });
  }

  // 全屏模式切换
  toggleFullscreen() {
    const visualizerSection = document.querySelector('.visualizer-section');
    if (!visualizerSection) return;

    if (visualizerSection.classList.contains('fullscreen')) {
      visualizerSection.classList.remove('fullscreen');
      if (document.exitFullscreen) document.exitFullscreen();
    } else {
      visualizerSection.classList.add('fullscreen');
      if (visualizerSection.requestFullscreen) visualizerSection.requestFullscreen();
    }
  }

  // 随机播放全部
  shuffleAll() {
    if (this.playlist.length === 0) {
      this.showNotification('播放列表为空', 'warning');
      return;
    }

    this.isShuffleOn = true;
    this.updateUI(); // 更新随机按钮状态

    const randomIndex = Math.floor(Math.random() * this.playlist.length);
    this.loadTrack(randomIndex);
    if (!this.isPlaying) this.togglePlay();

    this.showNotification('已开启随机播放全部', 'success');
  }

  // 清空播放列表
  clearPlaylist() {
    if (this.playlist.length === 0) {
      this.showNotification('播放列表已为空', 'info');
      return;
    }

    // 停止播放
    if (this.isPlaying) this.togglePlay();

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

    // 清空数据和UI
    this.playlist = [];
    this.currentTrackIndex = 0;
    const playlist = document.getElementById('playlist');
    if (playlist) playlist.innerHTML = '';
    this.updateTrackInfo({ title: '选择音频文件开始播放', artist: '' });
    this.updateUI();

    this.showNotification('播放列表已清空', 'success');
  }

  // 切换快捷键显示
  toggleKeyboardShortcuts() {
    const shortcuts = document.getElementById('keyboardShortcuts');
    if (shortcuts) {
      shortcuts.style.display = shortcuts.style.display === 'none' ? 'block' : 'none';
    }
  }

  // 启动性能监控
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

  // 键盘快捷键处理
  handleKeyboardShortcuts(e) {
    // 输入框中不触发快捷键
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
}
document.addEventListener('DOMContentLoaded', () => {
  window.player = new MusicPlayer(); // 全局挂载播放器实例
  bindStageClick(); // 绑定首屏点击事件
});

// 首屏点击事件绑定
function bindStageClick() {
  const stage = document.getElementById('stage');
  if (!stage) return;

  stage.addEventListener('click', () => {
    // 恢复音频上下文（用户交互触发）
    if (window.player?.audioContext?.state === 'suspended') {
      window.player.audioContext.resume();
    }

    // 有播放列表则显示控制栏，无则打开文件选择
    if (window.player?.playlist.length) {
      revealControls();
    } else {
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.click();
    }
  }, { once: false });
}
