// api/sniff.js
const https = require('https');

// The underlying NetEase API we are proxying
const NETEASE_API_HOST = 'netease-cloud-music-api-nine-delta.vercel.app';

// Helper function to make an HTTPS request and get JSON response
function fetchJson(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: NETEASE_API_HOST,
            path: path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    // Handle cases where the response is not valid JSON
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse JSON response: ${e.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function getSongData(songId) {
    // 1. Get song details
    const songDetailData = await fetchJson(`/song/detail?ids=${songId}`);
    if (!songDetailData.songs || songDetailData.songs.length === 0) {
        throw new Error('Song not found');
    }
    const songInfo = songDetailData.songs[0];

    // 2. Get song URL
    const songUrlData = await fetchJson(`/song/url?id=${songId}`);
    if (!songUrlData.data || songUrlData.data.length === 0 || !songUrlData.data[0].url) {
        throw new Error('Could not retrieve song URL');
    }
    const audioUrl = songUrlData.data[0].url;

    return {
        title: songInfo.name,
        artist: songInfo.ar.map(a => a.name).join('/'),
        album: songInfo.al.name,
        url: audioUrl,
        duration: songInfo.dt / 1000,
        cover: songInfo.al.picUrl,
        source: 'netease',
        songId: songId
    };
}

async function getPlaylistData(playlistId) {
    // 1. Get playlist details
    const playlistData = await fetchJson(`/playlist/detail?id=${playlistId}`);
    if (!playlistData.playlist || !playlistData.playlist.tracks) {
        throw new Error('Playlist not found');
    }
    const tracks = playlistData.playlist.tracks;
    const trackIds = tracks.map(t => t.id).join(',');

    // 2. Get all song URLs in one go
    const songUrlsData = await fetchJson(`/song/url?id=${trackIds}`);
    const urlMap = new Map(songUrlsData.data.map(s => [s.id, s.url]));

    return tracks.map(songInfo => {
        const audioUrl = urlMap.get(songInfo.id);
        if (!audioUrl) return null; // Skip tracks we couldn't get a URL for

        return {
            title: songInfo.name,
            artist: songInfo.ar.map(a => a.name).join('/'),
            album: songInfo.al.name,
            url: audioUrl,
            duration: songInfo.dt / 1000,
            cover: songInfo.al.picUrl,
            source: 'netease',
            songId: songInfo.id.toString()
        };
    }).filter(Boolean); // Remove nulls
}


module.exports = async (req, res, sniffer) => {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS pre-flight requests for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // On Vercel, query parameters are in req.query
    const musicUrl = req.query.url;

    if (!musicUrl) {
        res.status(400).json({ error: 'url query parameter is required' });
        return;
    }

    try {
        const playlistMatch = musicUrl.match(/playlist.*?id=(\d+)/);
        const songMatch = musicUrl.match(/song.*?id=(\d+)/);
        let data;

        if (playlistMatch) {
            const playlistId = playlistMatch[1];
            data = await getPlaylistData(playlistId);
        } else if (songMatch) {
            const songId = songMatch[1];
            data = [await getSongData(songId)]; // Return as an array to be consistent
        } else {
            res.status(400).json({ error: 'Invalid NetEase Music URL format' });
            return;
        }

        res.status(200).json(data);

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch music data', details: error.message });
    }
};
