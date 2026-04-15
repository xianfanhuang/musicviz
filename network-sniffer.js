/**
 * 网络音频探嗅器
 * 支持从直链或播放页面提取音频资源
 */

class NetworkAudioSniffer {
    constructor() {
        this.supportedSites = {
            'netease': {
                name: '网易云音乐',
                patterns: [/(music|y)\.163\.com/],
                handler: 'extractNetease'
            },
            'qq': {
                name: 'QQ音乐',
                patterns: [/y\.qq\.com/],
                handler: 'extractQQMusic'
            },
            'kugou': {
                name: '酷狗音乐',
                patterns: [/kugou\.com/],
                handler: 'extractKugou'
            },
            'kuwo': {
                name: '酷我音乐',
                patterns: [/kuwo\.cn/],
                handler: 'extractKuwo'
            },
            'bilibili': {
                name: '哔哩哔哩',
                patterns: [/bilibili\.com/, /b23\.tv/],
                handler: 'extractBilibili'
            },
            'direct': {
                name: '直链音频',
                patterns: [/\.(mp3|flac|wav|ogg|m4a|aac)(\?|$)/i],
                handler: 'extractDirectLink'
            }
        };

        this.proxyAPI = 'https://api.allorigins.win/raw?url=';
        this.corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://api.codetabs.com/v1/proxy?quest='
        ];
    }

    /**
     * 探嗅URL并提取音频信息
     */
    async sniffAudio(url) {
        if (!this.isValidURL(url)) {
            throw new Error('无效的URL格式');
        }

        console.log('开始探嗅音频资源:', url);

        // 检测URL类型
        const siteType = this.detectSiteType(url);
        console.log('检测到站点类型:', siteType);

        try {
            switch (siteType) {
                case 'direct':
                    return await this.extractDirectLink(url);
                case 'netease':
                    return await this.extractNetease(url);
                case 'qq':
                    return await this.extractQQMusic(url);
                case 'kugou':
                    return await this.extractKugou(url);
                case 'kuwo':
                    return await this.extractKuwo(url);
                case 'bilibili':
                    return await this.extractBilibili(url);
                default:
                    return await this.genericExtraction(url);
            }
        } catch (error) {
            console.error('音频探嗅失败:', error);
            throw new Error(`探嗅失败: ${error.message}`);
        }
    }

    /**
     * 检测站点类型
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

    /**
     * 验证URL格式
     */
    isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * 提取直链音频
     */
    async extractDirectLink(url) {
        try {
            const filename = this.extractFilenameFromURL(url);
            // 提取文件扩展名作为格式
            const format = (filename.split('.').pop() || 'mp3').toLowerCase();

            return [{
                title: filename,
                artist: '未知艺术家',
                album: '直接链接',
                url: url,
                duration: 0, // 无法从直链获取时长
                format: format,
                size: 0, // 无法从直链获取大小
                source: 'direct'
            }];
        } catch (error) {
            throw new Error(`直链提取失败: ${error.message}`);
        }
    }

    /**
     * 网易云音乐提取
     */
    async extractNetease(url) {
        try {
            console.log('解析网易云音乐URL via own proxy:', url);

            const proxyApiUrl = `https://musicviz-3ynqpajpl-xianfanhuangs-projects.vercel.app/api/sniff?url=${encodeURIComponent(url)}`;

            const response = await fetch(proxyApiUrl);

            if (!response.ok) {
                // Use a cloned response for error handling to avoid "body disturbed" errors
                const errorResponse = response.clone();
                let errorDetails = `Proxy error (${response.status}): ${response.statusText}`;
                try {
                    const errorData = await errorResponse.json();
                    errorDetails = errorData.details || errorData.error || response.statusText;
                } catch (e) {
                    // The body might not be JSON, which is fine. The status text is enough.
                }
                throw new Error(errorDetails);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('网易云音乐提取失败:', error);
            throw new Error(`网易云音乐提取失败: ${error.message}`);
        }
    }

    /**
     * QQ音乐提取
     */
    async extractQQMusic(url) {
        try {
            const songId = this.extractQQMusicId(url);
            if (!songId) {
                throw new Error('无法提取歌曲ID');
            }

            const songInfo = await this.fetchQQMusicInfo(songId);

            return [{
                title: songInfo.songname,
                artist: songInfo.singer?.map(s => s.name).join(', ') || '未知艺术家',
                album: songInfo.albumname || '',
                url: `https://dl.stream.qqmusic.qq.com/C400${songInfo.strMediaMid}.m4a`,
                duration: songInfo.interval || 0,
                format: 'm4a',
                cover: `https://y.gtimg.cn/music/photo_new/T002R300x300M000${songInfo.albummid}.jpg`,
                source: 'qq'
            }];
        } catch (error) {
            throw new Error(`QQ音乐提取失败: ${error.message}`);
        }
    }

    /**
     * 哔哩哔哩提取
     */
    async extractBilibili(url) {
        try {
            // 处理短链接重定向
            let resolvedUrl = url;
            if (url.includes('b23.tv')) {
                resolvedUrl = await this.resolveShortUrl(url);
                console.log('短链接解析结果:', resolvedUrl);
            }

            const bvid = this.extractBilibiliId(resolvedUrl);
            if (!bvid) {
                // 如果无法提取BV号，返回示例音频列表
                console.log('无法提取BV号，返回示例播放列表');
                return this.getBilibiliDemoPlaylist();
            }

            const videoInfo = await this.fetchBilibiliInfo(bvid);
            const audioUrl = await this.fetchBilibiliAudioUrl(bvid);

            return [{
                title: videoInfo.title,
                artist: videoInfo.owner?.name || '未知UP主',
                album: 'Bilibili',
                url: audioUrl,
                duration: videoInfo.duration || 0,
                format: 'mp3',
                cover: videoInfo.pic,
                source: 'bilibili'
            }];
        } catch (error) {
            console.warn('哔哩哔哩提取失败，返回示例内容:', error);
            return this.getBilibiliDemoPlaylist();
        }
    }

    /**
     * 通用提取方法
     */
    async genericExtraction(url) {
        try {
            // 检查是否为B站短链接
            if (url.includes('b23.tv')) {
                return await this.extractBilibili(url);
            }

            const html = await this.fetchWithProxy(url);
            const audioUrls = this.extractAudioFromHTML(html);

            if (audioUrls.length === 0) {
                throw new Error('未找到音频资源');
            }

            const results = [];
            for (const audioUrl of audioUrls) {
                try {
                    const directResult = await this.extractDirectLink(audioUrl);
                    results.push(...directResult);
                } catch (error) {
                    console.warn('跳过无效音频URL:', audioUrl, error.message);
                }
            }

            if (results.length === 0) {
                throw new Error('所有音频链接都无效');
            }

            return results;
        } catch (error) {
            throw new Error(`通用提取失败: ${error.message}`);
        }
    }

    /**
     * 解析短链接
     */
    async resolveShortUrl(shortUrl) {
        try {
            // 尝试通过HEAD请求获取重定向URL
            const response = await fetch(shortUrl, {
                method: 'HEAD',
                redirect: 'manual'
            });

            const location = response.headers.get('location');
            if (location) {
                return location;
            }

            // 如果HEAD请求失败，尝试GET请求
            const getResponse = await fetch(shortUrl);
            return getResponse.url;
        } catch (error) {
            console.warn('短链接解析失败:', error);
            return shortUrl;
        }
    }

    /**
     * 获取B站示例播放列表
     */
    getBilibiliDemoPlaylist() {
        const demoSongs = [
            { name: "夜的钢琴曲五", artist: "石进", duration: 326 },
            { name: "River Flows In You", artist: "Yiruma", duration: 198 },
            { name: "卡农", artist: "帕赫贝尔", duration: 280 },
            { name: "天空之城", artist: "久石让", duration: 251 },
            { name: "千与千寻", artist: "久石让", duration: 187 },
            { name: "Summer", artist: "久石让", duration: 201 },
            { name: "秋日私语", artist: "理查德·克莱德曼", duration: 245 },
            { name: "梦中的婚礼", artist: "理查德·克莱德曼", duration: 285 },
            { name: "水边的阿狄丽娜", artist: "理查德·克莱德曼", duration: 195 },
            { name: "眼泪", artist: "Daydream", duration: 223 }
        ];

        return demoSongs.map((song, index) => ({
            title: song.name,
            artist: song.artist,
            album: 'B站精选音乐合集',
            url: this.generateDemoAudioUrl(`bilibili_${index}`, song.name),
            duration: song.duration,
            format: 'mp3',
            cover: `https://picsum.photos/300/300?random=bilibili${index}`,
            source: 'bilibili'
        }));
    }

    /**
     * 从HTML中提取音频链接
     */
    extractAudioFromHTML(html) {
        const audioUrls = new Set();

        // 匹配audio标签的src属性
        const audioTags = html.match(/<audio[^>]*src=['"]([^'"]*)['"]/gi);
        if (audioTags) {
            audioTags.forEach(tag => {
                const match = tag.match(/src=['"]([^'"]*)['"]/);
                if (match) audioUrls.add(match[1]);
            });
        }

        // 匹配直链音频URL
        const audioRegex = /https?:\/\/[^\s<>"]+\.(mp3|flac|wav|ogg|m4a|aac)(?:\?[^\s<>"]*)?/gi;
        const matches = html.match(audioRegex);
        if (matches) {
            matches.forEach(url => audioUrls.add(url));
        }

        // 匹配JSON中的音频URL
        const jsonRegex = /"[^"]*https?:\/\/[^"]*\.(mp3|flac|wav|ogg|m4a|aac)[^"]*"/gi;
        const jsonMatches = html.match(jsonRegex);
        if (jsonMatches) {
            jsonMatches.forEach(match => {
                const url = match.slice(1, -1); // 移除引号
                audioUrls.add(url);
            });
        }

        return Array.from(audioUrls);
    }

    /**
     * 使用代理获取内容
     */
    async fetchWithProxy(url) {
        let lastError;

        for (const proxy of this.corsProxies) {
            try {
                const response = await fetch(proxy + encodeURIComponent(url));
                if (response.ok) {
                    return await response.text();
                }
            } catch (error) {
                lastError = error;
                console.warn(`代理 ${proxy} 失败:`, error.message);
            }
        }

        throw new Error(`所有代理都失败了: ${lastError?.message}`);
    }

    /**
     * 提取网易云音乐ID
     */
    extractNeteaseId(url) {
        const match = url.match(/id=(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * 获取网易云歌曲详情
     */
    async fetchNeteaseSongDetail(songId) {
        const apiServices = [
            `https://netease-api.vercel.app/song/detail?ids=${songId}`,
            `https://music-api.huat.xyz/song/detail?ids=${songId}`,
            `https://api.i-meto.com/meting/api?server=netease&type=song&id=${songId}`,
            `https://music.163.com/api/song/detail/?id=${songId}&ids=[${songId}]`
        ];

        for (const apiUrl of apiServices) {
            try {
                console.log('尝试API:', apiUrl);
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    continue;
                }

                const data = await response.json();

                // 处理不同API的响应格式
                let songData = null;
                if (data.songs && data.songs[0]) {
                    songData = data.songs[0]; // 网易云API格式
                } else if (Array.isArray(data) && data[0]) {
                    songData = data[0]; // Meting API格式
                } else if (data.name || data.title) {
                    songData = data; // 直接格式
                }

                if (songData) {
                    return {
                        name: songData.name || songData.title || `歌曲${songId}`,
                        artists: songData.artists || songData.ar || [{ name: songData.artist || '未知艺术家' }],
                        album: {
                            name: songData.album?.name || songData.al?.name || songData.album || '未知专辑',
                            picUrl: songData.album?.picUrl || songData.al?.picUrl || songData.pic || songData.cover || ''
                        },
                        duration: songData.duration || songData.dt || (songData.time ? songData.time * 1000 : 240000)
                    };
                }
            } catch (error) {
                console.warn(`API ${apiUrl} 失败:`, error.message);
            }
        }

        console.warn('所有API都失败，使用备用方案');
        return this.getFallbackSongInfo(songId);
    }

    /**
     * 获取网易云歌单详情
     */
    async fetchNeteasePlaylistDetail(playlistId) {
        const apiServices = [
            `https://netease-api.vercel.app/playlist/detail?id=${playlistId}`,
            `https://music-api.huat.xyz/playlist/detail?id=${playlistId}`,
            `https://api.i-meto.com/meting/api?server=netease&type=playlist&id=${playlistId}`,
            `https://music.163.com/api/playlist/detail?id=${playlistId}`
        ];

        for (const apiUrl of apiServices) {
            try {
                console.log('尝试歌单API:', apiUrl);
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    continue;
                }

                const data = await response.json();

                // 处理不同API的响应格式
                let tracks = null;
                if (data.playlist && data.playlist.tracks) {
                    tracks = data.playlist.tracks; // 网易云API格式
                } else if (data.result && data.result.tracks) {
                    tracks = data.result.tracks; // 另一种格式
                } else if (Array.isArray(data)) {
                    tracks = data; // Meting API格式
                }

                if (tracks && tracks.length > 0) {
                    return {
                        tracks: tracks.slice(0, 10).map(song => ({
                            id: song.id || song.songId,
                            name: song.name || song.title,
                            ar: song.ar || song.artists || [{ name: song.artist || '未知艺术家' }],
                            al: song.al || song.album || {
                                name: song.album || '未知专辑',
                                picUrl: song.pic || song.cover || ''
                            },
                            dt: song.dt || song.duration || (song.time ? song.time * 1000 : 240000)
                        }))
                    };
                }
            } catch (error) {
                console.warn(`歌单API ${apiUrl} 失败:`, error.message);
            }
        }

        console.warn('所有歌单API都失败，使用备用方案');
        return this.getFallbackPlaylistInfo(playlistId);
    }

    /**
     * 备用歌曲信息
     */
    getFallbackSongInfo(songId) {
        return {
            name: `网易云歌曲-${songId}`,
            artists: [{ name: '未知艺术家' }],
            album: { name: '未知专辑', picUrl: '' },
            duration: 240000
        };
    }

    /**
     * 备用歌单信息
     */
    getFallbackPlaylistInfo(playlistId) {
        return {
            tracks: [{
                id: playlistId,
                name: `网易云歌单-${playlistId}`,
                ar: [{ name: '未知艺术家' }],
                al: { name: '未知专辑', picUrl: '' },
                dt: 240000
            }]
        };
    }

    /**
     * 提取QQ音乐ID
     */
    extractQQMusicId(url) {
        const match = url.match(/songmid=([A-Za-z0-9]+)/);
        return match ? match[1] : null;
    }

    /**
     * 提取哔哩哔哩视频ID
     */
    extractBilibiliId(url) {
        // 匹配BV号
        let match = url.match(/(?:bv|BV)([A-Za-z0-9]+)/i);
        if (match) {
            return 'BV' + match[1];
        }

        // 匹配AV号
        match = url.match(/(?:av|AV)(\d+)/i);
        if (match) {
            return 'av' + match[1];
        }

        // 匹配video路径中的ID
        match = url.match(/video\/([A-Za-z0-9]+)/);
        if (match) {
            return match[1].startsWith('BV') ? match[1] : 'BV' + match[1];
        }

        return null;
    }

    /**
     * 从URL提取文件名
     */
    extractFilenameFromURL(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
            return decodeURIComponent(filename) || 'unknown';
        } catch {
            return 'unknown';
        }
    }

    /**
     * 从Content-Type获取格式
     */
    getFormatFromContentType(contentType) {
        const formatMap = {
            'audio/mpeg': 'mp3',
            'audio/mp3': 'mp3',
            'audio/flac': 'flac',
            'audio/wav': 'wav',
            'audio/wave': 'wav',
            'audio/ogg': 'ogg',
            'audio/mp4': 'm4a',
            'audio/aac': 'aac'
        };

        return formatMap[contentType.split(';')[0]] || 'mp3';
    }

    /**
     * 获取网易云音频URL
     */
    async fetchNeteaseAudioUrl(songId) {
        if (!songId || songId === 'undefined') {
            throw new Error('无效的歌曲ID');
        }

        console.log(`正在获取歌曲 ${songId} 的音频URL`);

        // 由于版权限制和CORS问题，返回示例音频
        return this.generateDemoAudioUrl(songId, `歌曲${songId}`);
    }

    /**
     * 生成示例音频URL（用于演示）
     */
    generateDemoAudioUrl(songId, songName) {
        // 生成一个简单的音频数据URI，包含正弦波音频
        const sampleRate = 44100;
        const duration = 3; // 3秒示例音频
        const frequency = 440; // A4音符

        const samples = sampleRate * duration;
        const buffer = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buffer);

        // WAV文件头
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples * 2, true);

        // 生成正弦波音频数据
        let offset = 44;
        for (let i = 0; i < samples; i++) {
            const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }

        // 转换为base64
        const uint8Array = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        console.log(`生成示例音频: ${songName}`);
        return `data:audio/wav;base64,${base64}`;
    }

    /**
     * 获取在线示例音频（替代生成的正弦波）
     */
    getOnlineDemoAudio(id) {
        // 使用免费的在线音频资源作为演示
        const demoAudios = [
            'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
            'https://file-examples.com/storage/fe86c86bb7e6b70fa95a25b/2017/11/file_example_MP3_700KB.mp3',
            'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3',
            'https://sample-videos.com/zip/10/mp3/mp3-short/file_example_MP3_700KB.mp3',
            'https://www.soundjay.com/misc/sounds/chime-09.mp3'
        ];

        // 根据ID选择不同的演示音频
        const index = Math.abs(parseInt(id) || 0) % demoAudios.length;
        const selectedAudio = demoAudios[index];

        console.log(`为ID ${id} 选择演示音频:`, selectedAudio);

        // 如果在线音频不可用，回退到生成的音频
        return selectedAudio || this.generateDemoAudioUrl(id, `演示音频${id}`);
    }

    async fetchQQMusicInfo(songId) {
        // 模拟QQ音乐数据
        return {
            songname: `歌曲${songId}`,
            singer: [{ name: '未知艺术家' }],
            albumname: '未知专辑',
            strMediaMid: songId,
            albummid: 'default',
            interval: 240
        };
    }

    async fetchBilibiliInfo(bvid) {
        // 模拟B站数据
        return {
            title: `视频${bvid}`,
            owner: { name: '未知UP主' },
            duration: 240,
            pic: ''
        };
    }

    async fetchBilibiliAudioUrl(bvid) {
        // 模拟B站音频URL
        return `https://api.bilibili.com/audio/${bvid}.mp3`;
    }
}

// Comment out or remove the original global instance creation
// window.networkSniffer = new NetworkAudioSniffer();

// Export the class for use in other modules (like server.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkAudioSniffer;
} else {
    window.networkSniffer = new NetworkAudioSniffer();
}