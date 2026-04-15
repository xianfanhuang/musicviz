class MusicPlayer {
    constructor() {
        this.audioElement = document.getElementById('audioPlayer');
        this.playlist = [];
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.volume = 0.8;

        this.audioContext = null;
        this.visualizer = null;

        // New UI Elements
        this.albumArt = document.getElementById('albumArt');
        this.playlistContainer = document.querySelector('.playlist-container');
        this.uploadModal = document.querySelector('.upload-modal');
        this.volumeIconPaths = {
            up: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
            down: "M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z",
            mute: "M7 9v6h4l5 5V4L11 9H7z"
        };

        this.initializeAudioContext();
        this.setupEventListeners();
        this.setupVisualizer();
        this.updateUI();
        this.loadState();
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            document.body.addEventListener('click', () => {
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            }, { once: true });
        } catch (error) {
            console.warn('Could not create AudioContext:', error);
        }
    }

    setupEventListeners() {
        // Player Controls
        document.getElementById('playBtn').addEventListener('click', this.togglePlay.bind(this));
        document.getElementById('prevBtn').addEventListener('click', this.previousTrack.bind(this));
        document.getElementById('nextBtn').addEventListener('click', this.nextTrack.bind(this));
        document.getElementById('progressBar').addEventListener('click', this.seekTo.bind(this));

        // Secondary Controls
        document.getElementById('addMusicBtn').addEventListener('click', this.toggleUploadModal.bind(this));
        document.getElementById('togglePlaylistBtn').addEventListener('click', this.togglePlaylist.bind(this));
        document.getElementById('muteBtn').addEventListener('click', this.toggleMute.bind(this));
        document.getElementById('volumeSlider').addEventListener('input', this.setVolume.bind(this));

        // Playlist
        document.getElementById('closePlaylistBtn').addEventListener('click', this.togglePlaylist.bind(this));
        document.getElementById('playlist').addEventListener('click', this.handlePlaylistClick.bind(this));

        // Upload Modal
        document.getElementById('closeUploadBtn').addEventListener('click', this.toggleUploadModal.bind(this));
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', (e) => e.currentTarget.classList.remove('dragover'));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        document.getElementById('sniffBtn').addEventListener('click', this.sniffURL.bind(this));
        document.getElementById('urlInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sniffURL(); });

        // Audio Element Events
        this.audioElement.addEventListener('loadedmetadata', this.onLoadedMetadata.bind(this));
        this.audioElement.addEventListener('timeupdate', this.onTimeUpdate.bind(this));
        this.audioElement.addEventListener('ended', this.onTrackEnded.bind(this));
        this.audioElement.addEventListener('play', this.onPlay.bind(this));
        this.audioElement.addEventListener('pause', this.onPause.bind(this));

        window.addEventListener('beforeunload', this.destroy.bind(this));
    }
    
    destroy() {
        if (this.visualizer) {
            this.visualizer.destroy();
        }
    }

    setupVisualizer() {
        const canvas = document.getElementById('visualizerCanvas');
        if (window.AudioVisualizer) {
            this.visualizer = new window.AudioVisualizer(canvas, this.audioContext);
            if (this.audioContext && this.audioElement) {
                this.visualizer.connectAudio(this.audioElement);
            }
        } else {
            console.error("AudioVisualizer is not available.");
        }
    }

    togglePlaylist() {
        this.playlistContainer.classList.toggle('visible');
    }

    toggleUploadModal() {
        this.uploadModal.classList.toggle('visible');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        this.processFiles(Array.from(e.dataTransfer.files));
    }

    handleFileSelect(e) {
        this.processFiles(Array.from(e.target.files));
    }

    async processFiles(files) {
        const audioFiles = files.filter(file =>
            file.type.startsWith('audio/') ||
            (window.audioDecoder && window.audioDecoder.detectFormat(file))
        );

        if (audioFiles.length === 0) {
            this.showNotification('Please select valid audio files.', 'error');
            return;
        }

        this.toggleUploadModal();

        for (const file of audioFiles) {
            try {
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
                
                if (!track.metadata.cover) {
                    track.metadata.cover = 'https://via.placeholder.com/200/111/fff?text=Soundscape';
                }

                this.playlist.push(track);
                this.addToPlaylistUI(track, this.playlist.length - 1);

            } catch (error) {
                console.error('File processing failed:', error);
                this.showNotification(`Failed to process ${file.name}: ${error.message}`, 'error');
            }
        }

        if (this.playlist.length > 0 && !this.isPlaying) {
            this.loadTrack(0);
        }
        this.saveState();
        this.showNotification(`Added ${audioFiles.length} tracks.`, 'success');
    }

    async sniffURL() {
        const urlInput = document.getElementById('urlInput');
        const url = urlInput.value.trim();
        if (!url) return;
        this.showNotification('Sniffing URL...', 'info');
        // This part would need the server to be working correctly.
        // For now, we'll keep it as a placeholder.
        this.showNotification('URL sniffing not yet fully implemented.', 'warning');
        urlInput.value = '';
        this.toggleUploadModal();
    }

    addToPlaylistUI(track, index) {
        const playlistEl = document.getElementById('playlist');
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.dataset.trackId = track.id;
        item.innerHTML = `
            <div class="track-details">
                <div class="track-name">${track.metadata.title}</div>
                <div class="track-artist">${track.metadata.artist}</div>
            </div>
            <button class="remove-track-btn" data-track-id="${track.id}">&times;</button>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-track-btn')) return;
            const trackIndex = this.playlist.findIndex(t => t.id === track.id);
            this.loadTrack(trackIndex);
        });
        playlistEl.appendChild(item);
    }

    async loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        this.currentTrackIndex = index;
        const track = this.playlist[index];
        this.audioElement.src = track.url;
        this.updateTrackInfo(track.metadata);
        this.updatePlaylistUI();
        this.saveState();
        if (this.isPlaying) {
            this.audioElement.play();
        }
    }

    updateTrackInfo(metadata) {
        document.getElementById('trackTitle').textContent = metadata.title || 'Unknown Title';
        document.getElementById('trackArtist').textContent = metadata.artist || 'Unknown Artist';
        this.albumArt.src = metadata.cover || 'https://via.placeholder.com/200/111/fff?text=Soundscape';
    }

    updatePlaylistUI() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, i) => {
            if (i === this.currentTrackIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    rerenderPlaylistUI() {
        const playlistContainer = document.getElementById('playlist');
        playlistContainer.innerHTML = '';
        this.playlist.forEach((track, index) => this.addToPlaylistUI(track, index));
        this.updatePlaylistUI();
    }
    
    handlePlaylistClick(e) {
        if (e.target.classList.contains('remove-track-btn')) {
            e.stopPropagation();
            const trackId = e.target.dataset.trackId;
            this.removeTrack(trackId);
        }
    }

    removeTrack(trackId) {
        const index = this.playlist.findIndex(t => t.id === trackId);
        if (index > -1) {
            this.playlist.splice(index, 1);
            this.rerenderPlaylistUI();
            if (index === this.currentTrackIndex) {
                if (this.playlist.length === 0) {
                    this.clearPlaylist();
                } else {
                    this.currentTrackIndex = Math.max(0, index - 1);
                    this.loadTrack(this.currentTrackIndex);
                }
            }
            this.saveState();
        }
    }

    clearPlaylist() {
        this.playlist = [];
        this.audioElement.src = '';
        this.isPlaying = false;
        this.updateUI();
        this.rerenderPlaylistUI();
        this.updateTrackInfo({ title: 'Select a song', artist: '' });
        this.saveState();
    }

    saveState() {
        const state = {
            playlist: this.playlist.filter(t => !t.url.startsWith('blob:')),
            currentTrackIndex: this.currentTrackIndex,
            volume: this.audioElement.volume
        };
        localStorage.setItem('musicPlayerState', JSON.stringify(state));
    }

    loadState() {
        const savedState = localStorage.getItem('musicPlayerState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.playlist = state.playlist || [];
                this.audioElement.volume = state.volume || 0.8;
                
                if (document.getElementById('volumeSlider')) {
                    document.getElementById('volumeSlider').value = (state.volume || 0.8) * 100;
                }
                
                this.updateVolumeIcon();

                if (this.playlist.length > 0) {
                    this.currentTrackIndex = state.currentTrackIndex || 0;
                    this.rerenderPlaylistUI();
                    const track = this.playlist[this.currentTrackIndex];
                    if(track) {
                        this.updateTrackInfo(track.metadata);
                        this.audioElement.src = track.url;
                    }
                }
            } catch(e) {
                console.error("Failed to parse saved state:", e);
                localStorage.removeItem('musicPlayerState');
            }
        }
    }

    async togglePlay() {
        if (!this.audioElement.src && this.playlist.length > 0) {
            await this.loadTrack(0);
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        if (this.isPlaying) {
            this.audioElement.pause();
        } else {
            this.audioElement.play();
        }
    }

    previousTrack() {
        if (this.playlist.length === 0) return;
        const newIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
        this.loadTrack(newIndex);
    }

    nextTrack() {
        if (this.playlist.length === 0) return;
        const newIndex = (this.currentTrackIndex + 1) % this.playlist.length;
        this.loadTrack(newIndex);
    }

    seekTo(e) {
        if (!this.audioElement.duration) return;
        const progressBar = document.getElementById('progressBar');
        const rect = progressBar.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        this.audioElement.currentTime = percentage * this.audioElement.duration;
    }

    setVolume(e) {
        this.volume = e.target.value / 100;
        this.audioElement.volume = this.volume;
        this.updateVolumeIcon();
        this.saveState();
    }

    toggleMute() {
        if (this.audioElement.volume > 0) {
            this.lastVolume = this.audioElement.volume;
            this.audioElement.volume = 0;
        } else {
            this.audioElement.volume = this.lastVolume || this.volume;
        }
        document.getElementById('volumeSlider').value = this.audioElement.volume * 100;
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        const volumeIcon = document.querySelector('#muteBtn .volume-icon path');
        if (!volumeIcon) return;

        const volume = this.audioElement.volume;
        if (volume === 0) {
            volumeIcon.setAttribute('d', this.volumeIconPaths.mute);
        } else if (volume < 0.5) {
            volumeIcon.setAttribute('d', this.volumeIconPaths.down);
        } else {
            volumeIcon.setAttribute('d', this.volumeIconPaths.up);
        }
    }

    onLoadedMetadata() { this.updateUI(); }
    onTimeUpdate() { this.updateProgress(); }
    onTrackEnded() { this.nextTrack(); }

    onPlay() {
        this.isPlaying = true;
        this.updatePlayButton();
        this.albumArt.classList.add('playing');
        if (this.visualizer) this.visualizer.start();
    }

    onPause() {
        this.isPlaying = false;
        this.updatePlayButton();
        this.albumArt.classList.remove('playing');
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
        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('currentTime').textContent = this.formatTime(this.audioElement.currentTime);
        document.getElementById('totalTime').textContent = this.formatTime(this.audioElement.duration);
    }

    updatePlayButton() {
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    generateId() { return '_' + Math.random().toString(36).substr(2, 9); }

    showNotification(message, type = 'info') {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        
        container.appendChild(notif);

        setTimeout(() => { notif.style.opacity = '1'; }, 10);
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});