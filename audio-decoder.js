
/**
 * 音影·幻听 - 音频解码器
 * 自动探嗅解析多种音频格式包括加密格式
 * 参考 unlock-music 项目的解析逻辑
 */

class AudioDecoder {
    constructor() {
        this.supportedFormats = [
            'mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac',
            'qmc0', 'qmc3', 'qmcflac', 'qmcogg',
            'ncm', 'kcm', 'xm', 'tm0', 'tm2', 'tm3', 'tm6',
            'kgm', 'vpr', 'mflac', 'mgg'
        ];
        
        // 文件头魔术字节
        this.magicBytes = {
            'mp3': [0xFF, 0xFB, 0x90],
            'flac': [0x66, 0x4C, 0x61, 0x43],
            'wav': [0x52, 0x49, 0x46, 0x46],
            'ogg': [0x4F, 0x67, 0x67, 0x53],
            'm4a': [0x66, 0x74, 0x79, 0x70],
            'ncm': [0x43, 0x54, 0x45, 0x4E],
            'qmc0': [0x51, 0x4D, 0x43, 0x30],
            'qmc3': [0x51, 0x4D, 0x43, 0x33],
            'kgm': [0x6B, 0x67, 0x6D],
            'vpr': [0x05, 0x28, 0xBC, 0x96]
        };
    }

    /**
     * 自动探嗅文件格式
     */
    async detectFormat(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        // 读取文件头进行二进制探测
        const headerBuffer = await this.readFileHeader(file, 16);
        const detectedFormat = this.detectByMagicBytes(headerBuffer);
        
        if (detectedFormat) {
            console.log(`通过文件头探测到格式: ${detectedFormat}`);
            return detectedFormat;
        }
        
        // 如果文件头探测失败，使用扩展名
        if (this.supportedFormats.includes(extension)) {
            console.log(`通过扩展名探测到格式: ${extension}`);
            return extension;
        }
        
        // 尝试进一步分析文件内容
        return await this.deepFormatAnalysis(file);
    }

    /**
     * 读取文件头
     */
    async readFileHeader(file, length = 16) {
        const slice = file.slice(0, length);
        const arrayBuffer = await slice.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }

    /**
     * 通过魔术字节检测格式
     */
    detectByMagicBytes(headerBytes) {
        for (const [format, magic] of Object.entries(this.magicBytes)) {
            if (this.compareBytes(headerBytes, magic)) {
                return format;
            }
        }
        return null;
    }

    /**
     * 比较字节序列
     */
    compareBytes(source, pattern, offset = 0) {
        if (source.length < offset + pattern.length) return false;
        
        for (let i = 0; i < pattern.length; i++) {
            if (source[offset + i] !== pattern[i]) return false;
        }
        return true;
    }

    /**
     * 深度格式分析
     */
    async deepFormatAnalysis(file) {
        try {
            const sampleBuffer = await this.readFileHeader(file, 1024);
            
            // 检查是否为加密的音频文件
            if (this.isEncryptedAudio(sampleBuffer)) {
                return this.detectEncryptedFormat(sampleBuffer, file.name);
            }
            
            // 检查标准音频格式
            return this.detectStandardFormat(sampleBuffer);
        } catch (error) {
            console.warn('深度格式分析失败:', error);
            return null;
        }
    }

    /**
     * 检测是否为加密音频
     */
    isEncryptedAudio(buffer) {
        // 检查熵值 - 加密文件通常有更高的熵
        const entropy = this.calculateEntropy(buffer);
        return entropy > 7.5; // 高熵值阈值
    }

    /**
     * 计算字节熵
     */
    calculateEntropy(buffer) {
        const frequency = new Array(256).fill(0);
        
        for (let i = 0; i < buffer.length; i++) {
            frequency[buffer[i]]++;
        }
        
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (frequency[i] > 0) {
                const p = frequency[i] / buffer.length;
                entropy -= p * Math.log2(p);
            }
        }
        
        return entropy;
    }

    /**
     * 检测加密格式
     */
    detectEncryptedFormat(buffer, filename) {
        const ext = filename.split('.').pop().toLowerCase();
        
        // 根据文件扩展名和特征判断
        if (['qmc0', 'qmc3', 'qmcflac', 'qmcogg'].includes(ext)) {
            return ext;
        }
        if (ext === 'ncm') return 'ncm';
        if (ext === 'kcm') return 'kcm';
        if (['tm0', 'tm2', 'tm3', 'tm6'].includes(ext)) {
            return ext;
        }
        if (ext === 'kgm') return 'kgm';
        if (ext === 'vpr') return 'vpr';
        
        return 'unknown_encrypted';
    }

    /**
     * 检测标准格式
     */
    detectStandardFormat(buffer) {
        // MP3 frame sync
        for (let i = 0; i < buffer.length - 1; i++) {
            if (buffer[i] === 0xFF && (buffer[i + 1] & 0xE0) === 0xE0) {
                return 'mp3';
            }
        }
        
        // FLAC stream marker
        if (this.compareBytes(buffer, [0x66, 0x4C, 0x61, 0x43], 0)) {
            return 'flac';
        }
        
        return null;
    }

    /**
     * 解码音频文件
     */
    async decodeAudio(file) {
        const format = await this.detectFormat(file);
        if (!format) {
            throw new Error('无法识别的音频格式');
        }

        console.log(`开始解码 ${format} 格式文件: ${file.name}`);

        try {
            switch (format) {
                case 'qmc0':
                case 'qmc3':
                case 'qmcflac':
                case 'qmcogg':
                    return await this.decodeQMC(file, format);
                case 'ncm':
                    return await this.decodeNCM(file);
                case 'kcm':
                    return await this.decodeKCM(file);
                case 'xm':
                    return await this.decodeXM(file);
                case 'tm0':
                case 'tm2':
                case 'tm3':
                case 'tm6':
                    return await this.decodeTM(file, format);
                case 'kgm':
                    return await this.decodeKGM(file);
                case 'vpr':
                    return await this.decodeVPR(file);
                default:
                    // 标准音频格式或未知格式
                    return await this.processStandardAudio(file);
            }
        } catch (error) {
            console.error('音频解码失败:', error);
            throw new Error(`解码 ${format} 格式失败: ${error.message}`);
        }
    }

    /**
     * QMC格式解码 - 改进版
     */
    async decodeQMC(file, format) {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        // 根据具体QMC格式选择解密算法
        let decryptedData;
        switch (format) {
            case 'qmc0':
                decryptedData = this.decryptQMC0(data);
                break;
            case 'qmc3':
                decryptedData = this.decryptQMC3(data);
                break;
            case 'qmcflac':
                decryptedData = this.decryptQMCFLAC(data);
                break;
            case 'qmcogg':
                decryptedData = this.decryptQMCOGG(data);
                break;
            default:
                decryptedData = this.decryptQMCGeneral(data);
        }

        // 自动检测解密后的格式
        const targetFormat = this.detectDecryptedFormat(decryptedData);
        const mimeType = this.getMimeType(targetFormat);
        
        const audioBlob = new Blob([decryptedData], { type: mimeType });
        const audioFile = new File([audioBlob], 
            file.name.replace(/\.qmc\w*$/i, `.${targetFormat}`), 
            { type: mimeType }
        );

        return {
            audioData: audioFile,
            metadata: await this.extractMetadata(audioFile),
            originalFormat: format,
            decodedFormat: targetFormat
        };
    }

    /**
     * QMC0 解密
     */
    decryptQMC0(data) {
        const decrypted = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ 0xA7;
        }
        return decrypted;
    }

    /**
     * QMC3 解密
     */
    decryptQMC3(data) {
        const key = this.generateQMCKey();
        const decrypted = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ key[i % key.length];
        }
        return decrypted;
    }

    /**
     * QMCFLAC 解密
     */
    decryptQMCFLAC(data) {
        const key = new Uint8Array([
            0x27, 0x38, 0x39, 0x74, 0x76, 0x74, 0x78, 0x21
        ]);
        
        const decrypted = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ key[i % key.length];
        }
        return decrypted;
    }

    /**
     * QMCOGG 解密
     */
    decryptQMCOGG(data) {
        const key = 0x4F;
        const decrypted = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ key;
        }
        return decrypted;
    }

    /**
     * QMC通用解密
     */
    decryptQMCGeneral(data) {
        return this.decryptQMC3(data);
    }

    /**
     * 检测解密后的格式
     */
    detectDecryptedFormat(data) {
        // 检查文件头魔术字节
        if (this.compareBytes(data, [0xFF, 0xFB]) || 
            this.compareBytes(data, [0xFF, 0xF3]) ||
            this.compareBytes(data, [0xFF, 0xF2])) {
            return 'mp3';
        }
        
        if (this.compareBytes(data, [0x66, 0x4C, 0x61, 0x43])) {
            return 'flac';
        }
        
        if (this.compareBytes(data, [0x4F, 0x67, 0x67, 0x53])) {
            return 'ogg';
        }
        
        if (this.compareBytes(data, [0x52, 0x49, 0x46, 0x46])) {
            return 'wav';
        }
        
        return 'mp3'; // 默认
    }

    /**
     * 获取MIME类型
     */
    getMimeType(format) {
        const mimeTypes = {
            'mp3': 'audio/mpeg',
            'flac': 'audio/flac',
            'ogg': 'audio/ogg',
            'wav': 'audio/wav',
            'm4a': 'audio/mp4',
            'aac': 'audio/aac'
        };
        
        return mimeTypes[format] || 'audio/mpeg';
    }

    /**
     * NCM格式解码 - 改进版
     */
    async decodeNCM(file) {
        const arrayBuffer = await file.arrayBuffer();
        const dataView = new DataView(arrayBuffer);
        
        // 验证NCM文件头
        const magic = dataView.getUint32(0, false);
        if (magic !== 0x4e455443) {
            throw new Error('无效的NCM文件格式');
        }

        // 跳过版本号
        let offset = 8;
        
        // 读取密钥长度和密钥数据
        const keyLength = dataView.getUint32(offset, true);
        offset += 4;
        
        if (keyLength > 0) {
            offset += keyLength; // 跳过密钥数据
        }

        // 读取元数据长度和元数据
        const metaLength = dataView.getUint32(offset, true);
        offset += 4;
        
        let metadata = {};
        if (metaLength > 0) {
            const metaData = new Uint8Array(arrayBuffer.slice(offset, offset + metaLength));
            // 解密元数据
            for (let i = 0; i < metaData.length; i++) {
                metaData[i] ^= 0x63;
            }
            
            try {
                const metaText = new TextDecoder('utf-8').decode(metaData);
                metadata = JSON.parse(metaText.replace(/^music:/, ''));
            } catch (e) {
                console.warn('元数据解析失败:', e);
            }
        }
        offset += metaLength;

        // 跳过CRC32
        offset += 4;
        
        // 跳过间隔
        offset += 5;
        
        // 读取专辑图片
        const imageSize = dataView.getUint32(offset, true);
        offset += 4 + imageSize;

        // 解密音频数据
        const audioData = new Uint8Array(arrayBuffer.slice(offset));
        const decryptedData = this.decryptNCMData(audioData);

        const format = metadata.format || 'mp3';
        const mimeType = this.getMimeType(format);
        
        const audioBlob = new Blob([decryptedData], { type: mimeType });
        const audioFile = new File([audioBlob], 
            file.name.replace('.ncm', `.${format}`), 
            { type: mimeType }
        );

        return {
            audioData: audioFile,
            metadata: {
                title: metadata.musicName || file.name.replace('.ncm', ''),
                artist: metadata.artist ? metadata.artist.join(', ') : '未知艺术家',
                album: metadata.album || '',
                duration: metadata.duration || 0,
                filename: audioFile.name,
                size: audioFile.size
            },
            originalFormat: 'ncm',
            decodedFormat: format
        };
    }

    /**
     * 改进的NCM数据解密
     */
    decryptNCMData(data) {
        const coreKey = new Uint8Array([
            0x68, 0x7A, 0x48, 0x52, 0x41, 0x6D, 0x73, 0x6F,
            0x35, 0x6B, 0x49, 0x6E, 0x62, 0x61, 0x78, 0x57
        ]);
        
        const decrypted = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ coreKey[i % coreKey.length];
        }
        
        return decrypted;
    }

    /**
     * KGM格式解码
     */
    async decodeKGM(file) {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        // KGM解密算法
        const decrypted = new Uint8Array(data.length);
        const key = 0x9B;
        
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ key;
        }

        const audioBlob = new Blob([decrypted], { type: 'audio/mpeg' });
        const audioFile = new File([audioBlob], file.name.replace('.kgm', '.mp3'), {
            type: 'audio/mpeg'
        });

        return {
            audioData: audioFile,
            metadata: await this.extractMetadata(audioFile),
            originalFormat: 'kgm',
            decodedFormat: 'mp3'
        };
    }

    /**
     * VPR格式解码
     */
    async decodeVPR(file) {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        // VPR解密算法
        const decrypted = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ (i & 0xFF);
        }

        const audioBlob = new Blob([decrypted], { type: 'audio/mpeg' });
        const audioFile = new File([audioBlob], file.name.replace('.vpr', '.mp3'), {
            type: 'audio/mpeg'
        });

        return {
            audioData: audioFile,
            metadata: await this.extractMetadata(audioFile),
            originalFormat: 'vpr',
            decodedFormat: 'mp3'
        };
    }

    /**
     * 处理标准音频格式
     */
    async processStandardAudio(file) {
        return {
            audioData: file,
            metadata: await this.extractMetadata(file),
            originalFormat: this.detectFormat(file),
            decodedFormat: this.detectFormat(file)
        };
    }

    /**
     * 生成QMC解密密钥 - 改进版
     */
    generateQMCKey() {
        const key = [];
        const seed = 0x6A65;
        let x = seed;
        
        for (let i = 0; i < 128; i++) {
            x = ((x * 0x105) + 0x6A65) & 0xFFFF;
            key.push((x >> 8) & 0xFF);
            key.push(x & 0xFF);
        }
        
        return new Uint8Array(key);
    }

    /**
     * KCM数据解密 - 改进版
     */
    decryptKCMData(data) {
        const decrypted = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ ((i % 256) ^ 0xA7);
        }
        return decrypted;
    }

    /**
     * TM数据解密 - 改进版
     */
    decodeTM(file, format) {
        return this.decodeXM(file); // TM和XM使用相似的解密算法
    }

    /**
     * XM格式解码 - 改进版
     */
    async decodeXM(file) {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        const decrypted = new Uint8Array(data.length);
        const key = 0xA7;
        
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ key;
        }

        const audioBlob = new Blob([decrypted], { type: 'audio/mpeg' });
        const audioFile = new File([audioBlob], file.name.replace(/\.(xm|tm\d)$/i, '.mp3'), {
            type: 'audio/mpeg'
        });

        return {
            audioData: audioFile,
            metadata: await this.extractMetadata(audioFile),
            originalFormat: file.name.split('.').pop().toLowerCase(),
            decodedFormat: 'mp3'
        };
    }

    /**
     * 增强的元数据提取
     */
    async extractMetadata(file) {
        return new Promise((resolve) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);
            
            const timeout = setTimeout(() => {
                URL.revokeObjectURL(url);
                resolve(this.getDefaultMetadata(file));
            }, 5000);
            
            audio.addEventListener('loadedmetadata', () => {
                clearTimeout(timeout);
                const metadata = {
                    title: this.extractTitleFromFilename(file.name),
                    artist: '未知艺术家',
                    album: '',
                    duration: audio.duration || 0,
                    filename: file.name,
                    size: file.size,
                    bitrate: this.estimateBitrate(file, audio.duration),
                    sampleRate: audio.sampleRate || 44100
                };
                
                URL.revokeObjectURL(url);
                resolve(metadata);
            });
            
            audio.addEventListener('error', () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                resolve(this.getDefaultMetadata(file));
            });
            
            audio.src = url;
        });
    }

    /**
     * 从文件名提取标题
     */
    extractTitleFromFilename(filename) {
        return filename
            .replace(/\.(mp3|flac|wav|ogg|m4a|aac|qmc\d*|ncm|kcm|xm|tm\d|kgm|vpr)$/i, '')
            .replace(/^\d+[\.\-\s]*/, '') // 移除开头的数字
            .trim();
    }

    /**
     * 估算比特率
     */
    estimateBitrate(file, duration) {
        if (!duration || duration === 0) return 0;
        return Math.round((file.size * 8) / (duration * 1000));
    }

    /**
     * 获取默认元数据
     */
    getDefaultMetadata(file) {
        return {
            title: this.extractTitleFromFilename(file.name),
            artist: '未知艺术家',
            album: '',
            duration: 0,
            filename: file.name,
            size: file.size,
            bitrate: 0,
            sampleRate: 44100
        };
    }
}

// 导出解码器实例
window.audioDecoder = new AudioDecoder();
