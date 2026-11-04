// src/lib/social/x-client.ts
// Programmatic X (formerly Twitter) Admin Broadcasting & Community Dispatch Service
// Dispatches updates to @promptfm_live via Twitter API v2 with OAuth 1.0a / Bearer authentication.

import { createHmac, randomBytes } from 'crypto';

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  text: string;
  simulated?: boolean;
  error?: string;
}

export interface OAuth1Params {
  method: string;
  url: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  nonce?: string;
  timestamp?: number;
}

/**
 * RFC 3986 percent-encoding for OAuth 1.0a signature calculation.
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Generates an HMAC-SHA1 OAuth 1.0a Authorization header for Twitter API v2.
 */
export function generateOAuth1Header(params: OAuth1Params): string {
  const nonce = params.nonce || randomBytes(16).toString('hex');
  const timestamp = params.timestamp !== undefined ? params.timestamp : Math.floor(Date.now() / 1000);

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp),
    oauth_token: params.accessToken,
    oauth_version: '1.0',
  };

  // Sort parameters alphabetically by encoded key
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k]!)}`)
    .join('&');

  const signatureBase = `${params.method.toUpperCase()}&${percentEncode(params.url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(params.apiSecret)}&${percentEncode(params.accessTokenSecret)}`;

  const signature = createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  oauthParams['oauth_signature'] = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${k}="${percentEncode(oauthParams[k]!)}"`);

  return `OAuth ${headerParts.join(', ')}`;
}

/**
 * Checks whether credentials for X (Twitter) API posting are configured.
 */
export function isXConfigured(): boolean {
  const hasBearer = Boolean(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN);
  const hasOAuth1 = Boolean(
    (process.env.X_API_KEY || process.env.TWITTER_API_KEY) &&
    (process.env.X_API_SECRET || process.env.TWITTER_API_SECRET) &&
    (process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN) &&
    (process.env.X_ACCESS_TOKEN_SECRET || process.env.TWITTER_ACCESS_TOKEN_SECRET)
  );
  return hasBearer || hasOAuth1;
}

/**
 * Dispatches a tweet to the official PromptFM X (Twitter) handle.
 * When credentials are not yet configured in .env.local, provides a clean dev simulation.
 */
export async function postTweetToX(
  text: string,
  options?: { url?: string }
): Promise<TweetResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Tweet text cannot be empty');
  }

  const fullText = options?.url ? `${trimmed}\n\n${options.url}` : trimmed;
  if (fullText.length > 280) {
    throw new Error(`Tweet text exceeds 280 characters (${fullText.length} characters)`);
  }

  // Check if live X credentials are provided
  if (!isXConfigured()) {
    const mockId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[X:DevFallback] Posted tweet to X (@promptfm_live): "${fullText}" (Mock ID: ${mockId})`);
    return {
      success: true,
      tweetId: mockId,
      text: fullText,
      simulated: true,
    };
  }

  const endpoint = 'https://api.twitter.com/2/tweets';
  let authHeader = '';

  const bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  if (bearerToken) {
    authHeader = `Bearer ${bearerToken}`;
  } else {
    const apiKey = process.env.X_API_KEY || process.env.TWITTER_API_KEY || '';
    const apiSecret = process.env.X_API_SECRET || process.env.TWITTER_API_SECRET || '';
    const accessToken = process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN || '';
    const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

    authHeader = generateOAuth1Header({
      method: 'POST',
      url: endpoint,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
    });
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ text: fullText }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = json?.detail || json?.title || `HTTP ${res.status} from X API`;
      return {
        success: false,
        text: fullText,
        error: errorMsg,
      };
    }

    const tweetId = json?.data?.id || `tweet_${Date.now()}`;
    return {
      success: true,
      tweetId,
      text: fullText,
      simulated: false,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      text: fullText,
      error: errorMsg,
    };
  }
}

