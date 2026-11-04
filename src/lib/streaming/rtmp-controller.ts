// src/lib/streaming/rtmp-controller.ts
// RTMP Stream Controller Client
// Communicates with the GCP VM sidecar controller service to start/stop
// FFmpeg RTMP streams targeting YouTube Live and TikTok Live.

export type StreamPlatform = 'youtube' | 'tiktok';

export interface StreamConfig {
  platform: StreamPlatform;
  streamKey: string;
  /** For TikTok, the RTMP ingest server URL (session-based). YouTube uses the fixed default. */
  rtmpUrl?: string;
}

export interface StreamSession {
  platform: StreamPlatform;
  status: 'live' | 'stopped' | 'error' | 'connecting';
  startedAt?: string;
  stoppedAt?: string;
  error?: string;
  pid?: number;
}

export interface StreamControllerStatus {
  sessions: Record<StreamPlatform, StreamSession>;
  controllerVersion: string;
  icecastUrl: string;
}

export interface StreamControllerResponse {
  success: boolean;
  message?: string;
  session?: StreamSession;
  error?: string;
}

/** Default YouTube RTMP ingest URL */
export const YOUTUBE_RTMP_URL = 'rtmp://a.rtmp.youtube.com/live2';
/** Default TikTok RTMP ingest URL (may change per session — always override with dashboard URL) */
export const TIKTOK_RTMP_URL_DEFAULT = 'rtmp://push-rtmp-f.tiktok.com/app';

/**
 * Returns the base URL for the GCP VM stream controller service.
 * This is the internal endpoint exposed by the Node.js controller sidecar
 * running on the GCP Always-Free streamer VM, accessible via the shared
 * controller secret for lightweight auth.
 */
export function getControllerBaseUrl(): string {
  return process.env.STREAM_CONTROLLER_URL || 'http://localhost:3001';
}

/**
 * Returns the shared secret used to authenticate requests to the stream controller.
 * Both sides must share STREAM_CONTROLLER_SECRET.
 */
export function getControllerSecret(): string {
  return process.env.STREAM_CONTROLLER_SECRET || '';
}

function controllerHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-controller-secret': getControllerSecret(),
  };
}

/**
 * Fetches the current status of all RTMP stream sessions from the controller.
 */
export async function getStreamStatus(): Promise<StreamControllerStatus> {
  if (process.env.DEV_FALLBACK_SIMULATION === 'true') {
    return {
      sessions: {
        youtube: { platform: 'youtube', status: 'stopped' },
        tiktok: { platform: 'tiktok', status: 'stopped' },
      },
      controllerVersion: '1.0.0',
      icecastUrl: 'http://localhost:8000/stream.mp3',
    };
  }

  try {
    const res = await fetch(`${getControllerBaseUrl()}/stream/status`, {
      method: 'GET',
      headers: controllerHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Stream controller returned HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      sessions: data.sessions || {
        youtube: { platform: 'youtube', status: 'stopped' },
        tiktok: { platform: 'tiktok', status: 'stopped' },
      },
      controllerVersion: data.controllerVersion || '1.0.0',
      icecastUrl: data.icecastUrl || 'http://icecast:8000/stream.mp3',
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Stream controller returned HTTP')) {
      throw err;
    }
    if (process.env.NODE_ENV !== 'production') {
      return {
        sessions: {
          youtube: { platform: 'youtube', status: 'stopped' },
          tiktok: { platform: 'tiktok', status: 'stopped' },
        },
        controllerVersion: '1.0.0',
        icecastUrl: 'http://localhost:8000/stream.mp3',
      };
    }
    throw err;
  }
}

/**
 * Starts an RTMP stream for a given platform.
 * The controller spawns a detached FFmpeg process and returns the session details.
 */
export async function startStream(config: StreamConfig): Promise<StreamControllerResponse> {
  const rtmpUrl = config.rtmpUrl || (config.platform === 'youtube' ? YOUTUBE_RTMP_URL : TIKTOK_RTMP_URL_DEFAULT);

  if (process.env.DEV_FALLBACK_SIMULATION === 'true') {
    return {
      success: true,
      message: `${config.platform} stream started (simulated)`,
      session: {
        platform: config.platform,
        status: 'live',
        startedAt: new Date().toISOString(),
      },
    };
  }

  try {
    const res = await fetch(`${getControllerBaseUrl()}/stream/start`, {
      method: 'POST',
      headers: controllerHeaders(),
      body: JSON.stringify({
        platform: config.platform,
        streamKey: config.streamKey,
        rtmpUrl,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const json = (await res.json()) as StreamControllerResponse;
    if (!res.ok) {
      return { success: false, error: json.error || `HTTP ${res.status}` };
    }
    return {
      ...json,
      session: json.session || {
        platform: config.platform,
        status: 'live',
        startedAt: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        message: `${config.platform} stream started (dev fallback)`,
        session: {
          platform: config.platform,
          status: 'live',
          startedAt: new Date().toISOString(),
        },
      };
    }
    throw err;
  }
}

/**
 * Stops an active RTMP stream for a given platform.
 */
export async function stopStream(platform: StreamPlatform): Promise<StreamControllerResponse> {
  if (process.env.DEV_FALLBACK_SIMULATION === 'true') {
    return {
      success: true,
      message: `${platform} stream stopped (simulated)`,
      session: {
        platform,
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
      },
    };
  }

  try {
    const res = await fetch(`${getControllerBaseUrl()}/stream/stop`, {
      method: 'POST',
      headers: controllerHeaders(),
      body: JSON.stringify({ platform }),
      signal: AbortSignal.timeout(10000),
    });

    const json = (await res.json()) as StreamControllerResponse;
    if (!res.ok) {
      return { success: false, error: json.error || `HTTP ${res.status}` };
    }
    return {
      ...json,
      session: json.session || {
        platform,
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        message: `${platform} stream stopped (dev fallback)`,
        session: {
          platform,
          status: 'stopped',
          stoppedAt: new Date().toISOString(),
        },
      };
    }
    throw err;
  }
}

/**
 * Returns whether the given RTMP URL + key form a valid endpoint string.
 * Does not make a network request — purely structural validation.
 */
export function validateStreamConfig(config: StreamConfig): { valid: boolean; error?: string } {
  if (!config.streamKey || config.streamKey.trim().length < 4) {
    return { valid: false, error: 'Stream key is required and must be at least 4 characters.' };
  }

  if (config.platform === 'tiktok') {
    const url = config.rtmpUrl || TIKTOK_RTMP_URL_DEFAULT;
    if (!url.startsWith('rtmp://')) {
      return { valid: false, error: 'TikTok RTMP URL must start with rtmp://' };
    }
  }

  return { valid: true };
}

