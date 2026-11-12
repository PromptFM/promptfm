#!/usr/bin/env node

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const FALLBACK_MARKER_PATTERN = /PromptFM Ambient AI Anthem|PromptFM Standby|demo-fallback|fallback\.mp3/i;
const execFileAsync = promisify(execFile);

function asNonEmptyString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function containsFallbackMarker(value) {
  return FALLBACK_MARKER_PATTERN.test(value);
}

function extractIcecastSource(data) {
  const source = data && data.icestats ? data.icestats.source : undefined;
  const list = Array.isArray(source) ? source : [source];
  const candidates = list.filter((item) => item && typeof item === 'object');

  if (candidates.length === 0) {
    return null;
  }

  return (
    candidates.find((item) => {
      const listenUrl = asNonEmptyString(item.listenurl);
      const mount = asNonEmptyString(item.mount);
      return listenUrl.endsWith('/stream.mp3') || mount === '/stream.mp3';
    }) || candidates[0] || null
  );
}

function collectSourceFields(source) {
  return [
    asNonEmptyString(source.title),
    asNonEmptyString(source.artist),
    asNonEmptyString(source.server_name),
    asNonEmptyString(source.server_description),
    asNonEmptyString(source.listenurl),
    asNonEmptyString(source.mount),
  ].filter(Boolean);
}

async function fetchText(url, fetchImpl, timeoutMs) {
  const res = await fetchImpl(url, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  return (await res.text()).trim();
}

async function fetchJsonWithOptionalResolve(url, fetchImpl, timeoutMs, resolveHost, execFileImpl = execFileAsync) {
  if (resolveHost) {
    const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    const { stdout } = await execFileImpl('curl', [
      '--fail',
      '--silent',
      '--show-error',
      '--max-time',
      String(timeoutSeconds),
      '--resolve',
      resolveHost,
      url,
    ]);
    return JSON.parse(stdout);
  }

  const res = await fetchImpl(url, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  return res.json();
}

async function runVerifyStreamOnAir(args = process.argv.slice(2), options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const execFileImpl = options.execFileImpl || execFileAsync;

  const nextTrackUrl = env.PROMPTFM_NEXT_TRACK_URL && env.PROMPTFM_NEXT_TRACK_URL.trim()
    ? env.PROMPTFM_NEXT_TRACK_URL.trim()
    : 'https://promptfm.live/api/radio/next?format=annotate';
  const streamStatusUrl = env.PROMPTFM_STREAM_STATUS_URL && env.PROMPTFM_STREAM_STATUS_URL.trim()
    ? env.PROMPTFM_STREAM_STATUS_URL.trim()
    : 'https://stream.promptfm.live/status-json.xsl';
  const streamStatusResolve = env.PROMPTFM_STREAM_STATUS_CURL_RESOLVE && env.PROMPTFM_STREAM_STATUS_CURL_RESOLVE.trim()
    ? env.PROMPTFM_STREAM_STATUS_CURL_RESOLVE.trim()
    : '';
  const pollCount = Math.max(1, Number.parseInt(env.PROMPTFM_STREAM_VERIFY_POLLS || '3', 10) || 3);
  const sleepMs = Math.max(0, (Number.parseFloat(env.PROMPTFM_STREAM_VERIFY_SLEEP_SECONDS || '5') || 5) * 1000);
  const timeoutMs = Math.max(1000, Number.parseInt(env.PROMPTFM_STREAM_VERIFY_TIMEOUT_MS || '20000', 10) || 20000);

  void args;

  try {
    console.log(`Checking next track endpoint: ${nextTrackUrl}`);
    const nextTrack = await fetchText(nextTrackUrl, fetchImpl, timeoutMs);
    if (!nextTrack) {
      console.error('Next track endpoint returned an empty response.');
      return 1;
    }

    if (containsFallbackMarker(nextTrack)) {
      console.error(`Next track endpoint is still serving fallback audio: ${nextTrack}`);
      return 1;
    }

    let lastError = 'Stream metadata never left fallback mode.';
    for (let attempt = 1; attempt <= pollCount; attempt += 1) {
      console.log(`Checking stream metadata (${attempt}/${pollCount}): ${streamStatusUrl}`);
      try {
        const data = await fetchJsonWithOptionalResolve(
          streamStatusUrl,
          fetchImpl,
          timeoutMs,
          streamStatusResolve || undefined,
          execFileImpl
        );
        const source = extractIcecastSource(data);

        if (!source) {
          lastError = 'status-json.xsl did not expose an active /stream.mp3 source.';
        } else {
          const combined = collectSourceFields(source).join('\n');
          if (!containsFallbackMarker(combined)) {
            console.log('Stream metadata is on-air and not on fallback.');
            return 0;
          }
          lastError = `Fallback markers still present in stream metadata: ${combined}`;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      if (attempt < pollCount) {
        await sleep(sleepMs);
      }
    }

    console.error(lastError);
    return 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

module.exports = {
  FALLBACK_MARKER_PATTERN,
  containsFallbackMarker,
  extractIcecastSource,
  fetchJsonWithOptionalResolve,
  runVerifyStreamOnAir,
};

if (process.argv[1] && process.argv[1].includes('verify-stream-on-air')) {
  runVerifyStreamOnAir().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
