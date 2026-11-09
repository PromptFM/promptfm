#!/usr/bin/env node
// deploy/streamer/controller.js
// PromptFM RTMP Live Stream Controller Sidecar
// Lightweight HTTP server for starting, stopping, and monitoring FFmpeg RTMP broadcasts to YouTube and TikTok.

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3001', 10);
const CONTROLLER_SECRET = process.env.STREAM_CONTROLLER_SECRET || '';
const ICECAST_STREAM_URL = process.env.ICECAST_STREAM_URL || 'http://icecast:8000/stream.mp3';
const OVERLAY_IMAGE = process.env.OVERLAY_IMAGE || '/app/overlay.jpg';

// Active stream sessions
const sessions = {
  youtube: { platform: 'youtube', status: 'stopped' },
  tiktok: { platform: 'tiktok', status: 'stopped' },
};

// Spawned child process references
const processes = {
  youtube: null,
  tiktok: null,
};

function isAuthorized(req) {
  if (!CONTROLLER_SECRET) return true; // Default allow in local testing if no secret configured
  const secretHeader = req.headers['x-controller-secret'];
  const authHeader = req.headers['authorization'];
  return (
    secretHeader === CONTROLLER_SECRET ||
    authHeader === `Bearer ${CONTROLLER_SECRET}`
  );
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function spawnFfmpeg(platform, targetRtmpUrl) {
  // If overlay doesn't exist, generate a static placeholder image using lavfi
  const hasOverlay = fs.existsSync(OVERLAY_IMAGE);

  const videoInputArgs = hasOverlay
    ? ['-loop', '1', '-framerate', '2', '-i', OVERLAY_IMAGE]
    : ['-f', 'lavfi', '-i', 'color=c=#09090b:s=1280x720:r=30'];

  const isPortrait = platform === 'tiktok';

  const filterArgs = isPortrait
    ? ['-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2']
    : [];

  const bitrate = isPortrait ? '1200k' : '1500k';
  const bufsize = isPortrait ? '2400k' : '3000k';

  const args = [
    '-re',
    ...videoInputArgs,
    '-reconnect', '1',
    '-reconnect_at_eof', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', ICECAST_STREAM_URL,
    ...filterArgs,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-b:v', bitrate,
    '-maxrate', bitrate,
    '-bufsize', bufsize,
    '-g', '60',
    '-keyint_min', '60',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    targetRtmpUrl,
  ];

  console.log(`[RTMP] Spawning FFmpeg for ${platform}: ffmpeg ${args.join(' ')}`);
  const child = spawn('ffmpeg', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    // Only log errors or periodic status lines
    if (text.includes('Error') || text.includes('failed') || text.includes('fps=')) {
      process.stdout.write(`[ffmpeg:${platform}] ${text.slice(0, 160)}\n`);
    }
  });

  child.on('error', (err) => {
    console.error(`[ffmpeg:${platform}] Process error:`, err);
    sessions[platform] = {
      platform,
      status: 'error',
      error: err.message,
      stoppedAt: new Date().toISOString(),
    };
    processes[platform] = null;
  });

  child.on('exit', (code, signal) => {
    console.log(`[ffmpeg:${platform}] Process exited with code ${code}, signal ${signal}`);
    sessions[platform] = {
      platform,
      status: 'stopped',
      stoppedAt: new Date().toISOString(),
    };
    processes[platform] = null;
  });

  return child;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-controller-secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: 'Unauthorized: missing or invalid x-controller-secret' });
  }

  // 1. GET /stream/status
  if (req.method === 'GET' && pathname === '/stream/status') {
    return sendJson(res, 200, {
      sessions,
      controllerVersion: '1.0.0',
      icecastUrl: ICECAST_STREAM_URL,
    });
  }

  // 2. POST /stream/start
  if (req.method === 'POST' && pathname === '/stream/start') {
    try {
      const body = await parseJsonBody(req);
      const platform = (body.platform || '').toLowerCase();
      const streamKey = (body.streamKey || '').trim();
      let rtmpUrl = (body.rtmpUrl || '').trim();

      if (platform !== 'youtube' && platform !== 'tiktok') {
        return sendJson(res, 400, { error: 'Platform must be "youtube" or "tiktok"' });
      }

      if (!streamKey) {
        return sendJson(res, 400, { error: 'streamKey is required' });
      }

      // Default ingest URLs
      if (!rtmpUrl) {
        rtmpUrl = platform === 'youtube'
          ? 'rtmp://a.rtmp.youtube.com/live2'
          : 'rtmp://push-rtmp-f.tiktok.com/app';
      }

      // Kill previous instance if still running
      if (processes[platform]) {
        try {
          processes[platform].kill('SIGTERM');
        } catch (_) {}
      }

      const targetUrl = rtmpUrl.endsWith('/') ? `${rtmpUrl}${streamKey}` : `${rtmpUrl}/${streamKey}`;
      const child = spawnFfmpeg(platform, targetUrl);
      processes[platform] = child;

      sessions[platform] = {
        platform,
        status: 'live',
        startedAt: new Date().toISOString(),
        pid: child.pid,
      };

      return sendJson(res, 200, {
        success: true,
        message: `${platform.toUpperCase()} stream started`,
        session: sessions[platform],
      });
    } catch (err) {
      console.error('Error starting stream:', err);
      return sendJson(res, 500, { error: err.message || 'Internal error starting stream' });
    }
  }

  // 3. POST /stream/stop
  if (req.method === 'POST' && pathname === '/stream/stop') {
    try {
      const body = await parseJsonBody(req);
      const platform = (body.platform || '').toLowerCase();

      if (platform !== 'youtube' && platform !== 'tiktok') {
        return sendJson(res, 400, { error: 'Platform must be "youtube" or "tiktok"' });
      }

      if (processes[platform]) {
        try {
          processes[platform].kill('SIGTERM');
        } catch (_) {}
        processes[platform] = null;
      }

      sessions[platform] = {
        platform,
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
      };

      return sendJson(res, 200, {
        success: true,
        message: `${platform.toUpperCase()} stream stopped`,
        session: sessions[platform],
      });
    } catch (err) {
      console.error('Error stopping stream:', err);
      return sendJson(res, 500, { error: err.message || 'Internal error stopping stream' });
    }
  }

  // 4. Default 404
  return sendJson(res, 404, { error: 'Endpoint not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(` PromptFM RTMP Stream Controller listening on port ${PORT}`);
  console.log(`   Icecast Source: ${ICECAST_STREAM_URL}`);
  console.log(`   Auth:           ${CONTROLLER_SECRET ? 'Protected' : 'Open (Local Dev)'}`);
});
