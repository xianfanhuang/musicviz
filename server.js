const express = require('express');
const fetch = require('cross-fetch');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cache = require('memory-cache');
const app = express();
const PORT = process.env.PORT || 3000;

// 缓存配置
const CACHE_TTL = 3600000; // 1小时缓存

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 限流保护API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每IP 100请求
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 音频URL解析API
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: '请提供URL参数' });
  }
  
  try {
    // 检查缓存
    const cachedResult = cache.get(url);
    if (cachedResult) {
      console.log(`从缓存获取: ${url}`);
      return res.json(cachedResult);
    }
    
    // 解析不同平台的URL
    let audioUrl;
    
    if (url.includes('netease.com') || url.includes('163.com')) {
      audioUrl = await parseNeteaseMusic(url);
    } else if (url.includes('qq.com') || url.includes('tencent.com')) {
      audioUrl = await parseQQMusic(url);
    } else if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      audioUrl = await parseBilibili(url);
    } else if (url.match(/\.(mp3|wav|flac|aac)$/i)) {
      // 直接音频链接
      audioUrl = url;
    } else {
      // 尝试通用解析
      audioUrl = await parseGenericAudio(url);
    }
    
    if (!audioUrl) {
      return res.status(404).json({ error: '无法解析音频资源' });
    }
    
    // 缓存结果
    cache.put(url, { audioUrl }, CACHE_TTL);
    
    res.json({ audioUrl });
  } catch (error) {
    console.error('代理请求错误:', error);
    res.status(500).json({ error: '服务器错误，无法处理请求' });
  }
});

// 平台解析函数
async function parseNeteaseMusic(url) {
  // 网易云音乐解析逻辑
  try {
    // 实际项目中需要实现具体的解析逻辑
    // 这里仅作示例
    const idMatch = url.match(/id=(\d+)/);
    if (idMatch && idMatch[1]) {
      // 模拟解析结果
      return `https://example-proxy.com/netease/${idMatch[1]}`;
    }
    return null;
  } catch (error) {
    console.error('网易云解析错误:', error);
    return null;
  }
}

async function parseQQMusic(url) {
  // QQ音乐解析逻辑
  try {
    const idMatch = url.match(/song\/(\d+)/);
    if (idMatch && idMatch[1]) {
      // 模拟解析结果
      return `https://example-proxy.com/qqmusic/${idMatch[1]}`;
    }
    return null;
  } catch (error) {
    console.error('QQ音乐解析错误:', error);
    return null;
  }
}

async function parseBilibili(url) {
  // B站解析逻辑
  try {
    const idMatch = url.match(/av(\d+)|bv([A-Za-z0-9]+)/);
    if (idMatch && (idMatch[1] || idMatch[2])) {
      // 模拟解析结果
      return `https://example-proxy.com/bilibili/${idMatch[1] || idMatch[2]}`;
    }
    return null;
  } catch (error) {
    console.error('B站解析错误:', error);
    return null;
  }
}

async function parseGenericAudio(url) {
  // 通用音频解析逻辑
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow'
    });
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('audio/')) {
      return url;
    }
    
    // 如果不是直接音频链接，尝试解析页面中的音频标签
    const pageResponse = await fetch(url);
    const html = await pageResponse.text();
    
    // 简单匹配音频标签
    const audioMatch = html.match(/<audio[^>]+src=["']([^"']+)["']/i);
    if (audioMatch && audioMatch[1]) {
      // 处理相对URL
      const baseUrl = new URL(url).origin;
      return new URL(audioMatch[1], baseUrl).href;
    }
    
    return null;
  } catch (error) {
    console.error('通用解析错误:', error);
    return null;
  }
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('未捕获错误:', err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`缓存有效期: ${CACHE_TTL / 1000}秒`);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});
    