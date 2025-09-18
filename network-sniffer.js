/**
 * 网络音频探嗅器（适配GitHub Pages跨域）
 */
class NetworkAudioSniffer {
    constructor() {
        this.supportedSites = {
            'netease': { name: '网易云音乐', patterns: [/music\.163\.com/], handler: 'extractNetease' },
            'qq': { name: 'QQ音乐', patterns: [/y\.qq\.com/], handler: 'extractQQMusic' },
            'bilibili': { name: '哔哩哔哩', patterns: [/bilibili\.com/, /b23\.tv/], handler: 'extractBilibili' },
            'direct': { name: '直链音频', patterns: [/\.(mp3|flac|wav|ogg|m4a|aac)(\?|$)/i], handler: 'extractDirectLink' }
        };
        // 优化代理列表（选择GitHub Pages兼容的代理）
        this.corsProxies = [
            { url: 'https://corsproxy.io/?', mode: 'query', jsonResponse: false },
            { url: 'https://api.allorigins.win/raw?url=', mode: 'query', jsonResponse: false }
        ];
    }

    /**
     * 探嗅URL（添加跨域提示）
     */
    async sniffAudio(url) {
        if (!this.isValidURL(url)) {
            throw new Error('无效的URL格式');
        }
        console.log('开始探嗅音频资源:', url);

        // GitHub Pages跨域提示
        console.warn('GitHub Pages存在跨域限制，探嗅功能可能受限，优先支持直链音频');
        
        const siteType = this.detectSiteType(url);
        try {
            switch (siteType) {
                case 'direct':
                    return await this.extractDirectLink(url);
                case 'netease':
                    this.showCrossDomainTip('网易云音乐');
                    return await this.extractNetease(url);
                case 'qq':
                    this.showCrossDomainTip('QQ音乐');
                    return await this.extractQQMusic(url);
                case 'bilibili':
                    this.showCrossDomainTip('哔哩哔哩');
                    return await this.extractBilibili(url);
                default:
                    this.showCrossDomainTip('通用链接');
                    return await this.genericExtraction(url);
            }
        } catch (error) {
            console.error('音频探嗅失败:', error);
            throw new Error(`探嗅失败: ${error.message}（建议使用本地文件上传）`);
        }
    }

    /**
     * 跨域提示
     */
    showCrossDomainTip(site) {
        if (window.player) {
            window.player.showNotification(`GitHub Pages限制${site}探嗅，可能无法获取音频`, 'warning');
        }
    }

    /**
     * 修复代理请求（兼容GitHub Pages）
     */
    async fetchWithProxy(url) {
        let lastError;
        for (const proxy of this.corsProxies) {
            try {
                const proxyUrl = proxy.url + encodeURIComponent(url);
                const response = await fetch(proxyUrl, { timeout: 10000 }); // 增加超时
                
                if (response.ok) {
                    return await response.text();
                }
            } catch (error) {
                lastError = error;
                console.warn(`代理 ${proxy.url} 失败:`, error.message);
            }
        }
        throw new Error(`所有代理都失败了: ${lastError?.message}（跨域限制）`);
    }

    /**
     * 其他方法保持原有逻辑，简化演示数据（避免依赖外部API）
     */
    detectSiteType(url) {
        for (const [type, config] of Object.entries(this.supportedSites)) {
            for (const pattern of config.patterns) {
                if (pattern.test(url)) {
                    return type;
                }
            }
        }
        return 'generic';
    }
    isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    async extractDirectLink(url) {
        try {
            // 直链音频优先使用HEAD请求（减少流量）
            const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type') || '';
            const contentLength = response.headers.get('content-length') || 0;
            
            if (!contentType.startsWith('audio/')) {
                throw new Error('URL不是有效的音频文件');
            }
            
            const filename = this.extractFilenameFromURL(url);
            const format = this.getFormatFromContentType(contentType);
            return [{
                title: filename,
                artist: '未知艺术家',
                album: '',
                url: url,
                duration: 0,
                format: format,
                size: parseInt(contentLength) || 0,
                source: 'direct'
            }];
        } catch (error) {
            throw new Error(`直链提取失败: ${error.message}`);
        }
    }
    extractFilenameFromURL(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
            return decodeURIComponent(filename) || '未知音频';
        } catch {
            return '未知音频';
        }
    }
    getFormatFromContentType(contentType) {
        const formatMap = {
            'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/flac': 'flac',
            'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/aac': 'aac'
        };
        return formatMap[contentType.split(';')[0]] || 'mp3';
    }
    // 简化其他平台提取（返回演示数据，避免跨域）
    async extractNetease(url) {
        const songMatch = url.match(/song.*?id=(\d+)/);
        const songId = songMatch ? songMatch[1] : '186016'; // 默认晴天ID
        return [{
            title: songId === '186016' ? '晴天' : `网易云歌曲${songId}`,
            artist: songId === '186016' ? '周杰伦' : '未知艺术家',
            album: songId === '186016' ? '叶惠美' : '未知专辑',
            url: this.getOnlineDemoAudio(songId),
            duration: 269,
            format: 'mp3',
            cover: `https://picsum.photos/300/300?random=${songId}`,
            source: 'netease'
        }];
    }
    async extractQQMusic(url) {
        const songId = this.extractQQMusicId(url) || '0039MnYb0qxYhV';
        return [{
            title: songId === '0039MnYb0qxYhV' ? '孤勇者' : `QQ音乐歌曲${songId}`,
            artist: songId === '0039MnYb0qxYhV' ? '陈奕迅' : '未知艺术家',
            album: '未知专辑',
            url: this.getOnlineDemoAudio(songId),
            duration: 240,
            format: 'm4a',
            cover: `https://picsum.photos/300/300?random=${songId}`,
            source: 'qq'
        }];
    }
    async extractBilibili(url) {
        const bvid = this.extractBilibiliId(url) || 'BV1xx411c7m9';
        return [{
            title: `B站音频${bvid}`,
            artist: '未知UP主',
            album: 'Bilibili',
            url: this.getOnlineDemoAudio(bvid),
            duration: 240,
            format: 'mp3',
            cover: `https://picsum.photos/300/300?random=${bvid}`,
            source: 'bilibili'
        }];
    }
    async genericExtraction(url) {
        try {
            const html = await this.fetchWithProxy(url);
            const audioUrls = this.extractAudioFromHTML(html);
            if (audioUrls.length === 0) {
                throw new Error('未找到音频资源');
            }
            return audioUrls.map(url => ({
                title: this.extractFilenameFromURL(url),
                artist: '未知艺术家',
                album: '',
                url: url,
                duration: 0,
                format: this.getFormatFromContentType(`audio/${url.split('.').pop()}`),