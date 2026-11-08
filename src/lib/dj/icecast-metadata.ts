// src/lib/dj/icecast-metadata.ts
// UTF-8 metadata parser and mojibake recovery engine for Icecast streaming status endpoints (Issue #133)

export interface IcecastStatus {
  title: string;
  artist?: string;
  serverName?: string;
  serverDescription?: string;
  listeners?: number;
  bitrate?: number;
  genre?: string;
}

export interface StreamerUtf8Validation {
  compliant: boolean;
  issues: string[];
}

// Windows-1252 / CP-1252 code point to byte mapping lookup table (0x80 - 0x9F)
const CP1252_TABLE: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

/**
 * Attempts to decode a substring of CP1252/Latin-1 characters back into valid UTF-8.
 * Returns the original span if decoding fails or produces Unicode replacement characters.
 */
function decodeSpan(span: string): string {
  try {
    const bytes: number[] = [];
    for (let i = 0; i < span.length; i++) {
      const code = span.charCodeAt(i);
      const cpByte = CP1252_TABLE[code];
      if (cpByte !== undefined) {
        bytes.push(cpByte);
      } else if (code <= 0xff) {
        bytes.push(code);
      } else {
        return span;
      }
    }
    const candidate = Buffer.from(bytes).toString('utf-8');
    if (!candidate.includes('\uFFFD')) {
      return candidate;
    }
  } catch {
    // Return original on error
  }
  return span;
}

/**
 * Repairs broken UTF-8 mojibake (double-encoded UTF-8 strings that were incorrectly decoded
 * as Windows-1252 or ISO-8859-1 by Icecast or upstream source clients).
 * If the input is already valid UTF-8, it is returned untouched.
 */
export function repairMojibake(text: string): string {
  if (typeof text !== 'string' || !/[\u00C2-\u00F4]/.test(text)) {
    return text;
  }

  return text.replace(
    /([\u00C2-\u00F4][\u0080-\u00FF\u0100-\u02DC\u2010-\u2122]{1,3})/g,
    (m) => decodeSpan(m)
  );
}

/**
 * Parses Icecast raw title strings in "Artist - Title" format.
 * Automatically cleans up whitespace and repairs any UTF-8 mojibake.
 */
export function parseIcecastTitle(rawTitle: string): { title: string; artist?: string } {
  const cleaned = repairMojibake(rawTitle || '');
  if (!cleaned.includes(' - ')) {
    return { title: cleaned.trim() };
  }

  const parts = cleaned.split(' - ');
  const artist = (parts[0] ?? '').trim();
  const title = parts.slice(1).join(' - ').trim();
  return { title, artist };
}

/**
 * Parses and sanitizes raw JSON output from Icecast /status-json.xsl.
 * Repairs mojibake across title, artist, server_name, and server_description.
 */
export function parseIcecastStatus(data: any): IcecastStatus | null {
  const source = data?.icestats?.source;
  if (!source) {
    return null;
  }

  const mount = Array.isArray(source) ? source[0] : source;
  if (!mount || typeof mount !== 'object') {
    return null;
  }

  const rawTitle = typeof mount.title === 'string' ? mount.title : '';
  const { title, artist } = parseIcecastTitle(rawTitle);

  const serverName =
    typeof mount.server_name === 'string' ? repairMojibake(mount.server_name).trim() : undefined;
  const serverDescription =
    typeof mount.server_description === 'string'
      ? repairMojibake(mount.server_description).trim()
      : undefined;

  const listeners = typeof mount.listeners === 'number' ? mount.listeners : undefined;
  const bitrate = typeof mount.bitrate === 'number' ? mount.bitrate : undefined;
  const genre = typeof mount.genre === 'string' ? repairMojibake(mount.genre).trim() : undefined;

  return {
    title,
    artist,
    serverName,
    serverDescription,
    listeners,
    bitrate,
    genre,
  };
}

/**
 * Fetches status-json.xsl from the specified Icecast endpoint URL,
 * parses stream telemetry, and repairs any character encoding discrepancies.
 */
export async function fetchIcecastMetadata(
  endpointUrl = 'https://stream.promptfm.live/status-json.xsl',
  timeoutMs = 1500
): Promise<IcecastStatus | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(endpointUrl, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return parseIcecastStatus(json);
  } catch {
    return null;
  }
}

/**
 * Inspects streamer configs (icecast.xml, radio.liq, docker-compose.yml)
 * to verify mandatory UTF-8 charset declarations and container entrypoints.
 */
export function validateStreamerUtf8Config(input: {
  icecastXml?: string;
  radioLiq?: string;
  composeYml?: string;
}): StreamerUtf8Validation {
  const issues: string[] = [];

  if (input.icecastXml) {
    if (!input.icecastXml.includes('<charset>UTF-8</charset>')) {
      issues.push('icecast_missing_utf8_charset');
    }
  }

  if (input.radioLiq) {
    if (!/encoding\s*=\s*"UTF-8"/i.test(input.radioLiq)) {
      issues.push('liquidsoap_missing_utf8_encoding');
    }
  }

  if (input.composeYml) {
    if (!/entrypoint:\s*\["icecast",\s*"-c",\s*"\/etc\/icecast\.xml"\]/i.test(input.composeYml)) {
      issues.push('compose_missing_icecast_entrypoint');
    }
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}
