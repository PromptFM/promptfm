// src/lib/telemetry/logger.ts
// Zero-cost structured logging and distributed tracing compatible with
// Google Cloud Logging (50GB/mo free tier) and Vercel Runtime Logs.

import crypto from 'crypto';

export type LogSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceparent: string;
}

export interface LoggerConfig {
  service: string;
  version?: string;
  gcpProjectId?: string;
  context?: Record<string, unknown>;
}

export interface HttpRequestLog {
  requestMethod?: string;
  requestUrl?: string;
  status?: number;
  userAgent?: string;
  latency?: string;
  remoteIp?: string;
}

export interface GcpLogEntry {
  severity: LogSeverity;
  message: string;
  timestamp: string;
  serviceContext: {
    service: string;
    version: string;
  };
  'logging.googleapis.com/trace'?: string;
  'logging.googleapis.com/spanId'?: string;
  httpRequest?: HttpRequestLog;
  stackTrace?: string;
  [key: string]: unknown;
}

// Generates a valid W3C distributed trace context with 32-hex traceId and 16-hex spanId.
const SENSITIVE_KEY_REGEX =
  /^(?:password|secret|token|authorization|cookie|apikey|api_key|access_token|refresh_token|private_key|client_secret|clientsecret|connectionstring|secretkey)$/i;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// IPv4: match strictly 4 octets separated by dots, each 0-255 (avoids SemVer matching like 0.1.0)
const IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

// IPv6: standard 8 groups of 4 hex, or compressed
const IPV6_REGEX = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{1,4}\b/g;

// Bearer tokens
const BEARER_REGEX = /Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi;

// Vendor API tokens
const GITHUB_TOKEN_REGEX = /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b|\bgithub_pat_[a-zA-Z0-9_]{50,}\b/g;
const GOOGLE_KEY_REGEX = /\bAIzaSy[a-zA-Z0-9_-]{25,}\b/g;
const OPENAI_KEY_REGEX = /\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b/g;
const SUPABASE_KEY_REGEX = /\bsbp_[a-zA-Z0-9]{30,}\b/g;
const VERCEL_TOKEN_REGEX = /\bvercel_[a-zA-Z0-9]{24,}\b/g;
const URL_QUERY_SECRET_REGEX = /([?&](?:token|key|secret|password|auth|apiKey|api_key|user)=)([^&#]*)/gi;

/**
 * Redacts sensitive tokens, credentials, emails, and IP addresses from string text.
 */
export function redactString(str: string): string {
  return str
    .replace(BEARER_REGEX, 'Bearer [REDACTED_TOKEN]')
    .replace(GITHUB_TOKEN_REGEX, '[REDACTED_GITHUB_TOKEN]')
    .replace(GOOGLE_KEY_REGEX, '[REDACTED_GOOGLE_KEY]')
    .replace(OPENAI_KEY_REGEX, '[REDACTED_API_KEY]')
    .replace(SUPABASE_KEY_REGEX, '[REDACTED_SUPABASE_KEY]')
    .replace(VERCEL_TOKEN_REGEX, '[REDACTED_VERCEL_TOKEN]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(IPV4_REGEX, '[REDACTED_IP]')
    .replace(IPV6_REGEX, '[REDACTED_IP]');
}

/**
 * Deeply sanitizes objects, arrays, and primitives to exclude PII, GDPR data,
 * credentials, passwords, and sensitive tokens. Prevents cyclic reference crashes.
 */
export function redactSensitiveData(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return '[CIRCULAR]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '[REDACTED_SECRET]';
    } else {
      result[key] = redactSensitiveData(val, seen);
    }
  }

  return result;
}

/**
 * Generates a valid W3C distributed trace context with 32-hex traceId and 16-hex spanId.
 */
export function createTraceContext(): TraceContext {
  const traceId = crypto.randomBytes(16).toString('hex');
  const spanId = crypto.randomBytes(8).toString('hex');
  const traceparent = `00-${traceId}-${spanId}-01`;
  return { traceId, spanId, traceparent };
}

/**
 * Extracts or initializes distributed trace context from HTTP request headers.
 * Supports W3C traceparent, GCP x-cloud-trace-context, and standard x-request-id / x-trace-id.
 */
export function extractTraceFromHeaders(
  headers: Record<string, string | string[] | undefined>
): TraceContext {
  const getHeader = (key: string): string | undefined => {
    const val = headers[key] || headers[key.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };

  const traceparent = getHeader('traceparent');
  if (traceparent) {
    const parts = traceparent.split('-');
    if (parts.length >= 4 && parts[1]?.length === 32 && parts[2]?.length === 16) {
      return {
        traceId: parts[1],
        spanId: parts[2],
        traceparent,
      };
    }
  }

  const cloudTrace = getHeader('x-cloud-trace-context');
  if (cloudTrace) {
    // Format: TRACE_ID[/SPAN_ID][;o=OPTIONS]
    const parts = cloudTrace.split(';');
    const traceAndSpan = parts[0] || '';
    const slashParts = traceAndSpan.split('/');
    const gcpTraceId = slashParts[0] || '';
    const gcpSpanId = slashParts[1] || '';

    if (gcpTraceId) {
      const cleanTraceId = gcpTraceId.padStart(32, '0').slice(-32);
      const cleanSpanId = gcpSpanId
        ? gcpSpanId.padStart(16, '0').slice(-16)
        : crypto.randomBytes(8).toString('hex');
      return {
        traceId: gcpTraceId,
        spanId: gcpSpanId || cleanSpanId,
        traceparent: `00-${cleanTraceId}-${cleanSpanId}-01`,
      };
    }
  }

  const reqId = getHeader('x-request-id') || getHeader('x-trace-id');
  if (reqId) {
    const spanId = crypto.randomBytes(8).toString('hex');
    const cleanTraceId = reqId.replace(/[^0-9a-f]/gi, '').padEnd(32, '0').slice(0, 32);
    return {
      traceId: reqId,
      spanId,
      traceparent: `00-${cleanTraceId}-${spanId}-01`,
    };
  }

  return createTraceContext();
}

/**
 * Formats a log payload adhering to Google Cloud Logging JSON payload specification.
 * Automatically parsed by Google Cloud Logging and Vercel runtime logs without third-party agents.
 */
export function formatGcpLogEntry(params: {
  severity: LogSeverity;
  message: string;
  service: string;
  version?: string;
  traceId?: string;
  spanId?: string;
  gcpProjectId?: string;
  httpRequest?: HttpRequestLog;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}): GcpLogEntry {
  const {
    severity,
    message,
    service,
    version = '0.1.0',
    traceId,
    spanId,
    gcpProjectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'promptfm',
    httpRequest,
    stackTrace,
    metadata = {},
  } = params;

  const sanitizedMessage = typeof message === 'string' ? redactString(message) : message;
  const sanitizedStackTrace = typeof stackTrace === 'string' ? redactString(stackTrace) : stackTrace;
  const sanitizedMeta = (redactSensitiveData(metadata) as Record<string, unknown>) || {};

  let sanitizedHttpRequest: HttpRequestLog | undefined = undefined;
  if (httpRequest) {
    sanitizedHttpRequest = {
      ...httpRequest,
      remoteIp: httpRequest.remoteIp ? '[REDACTED_IP]' : undefined,
      requestUrl: httpRequest.requestUrl
        ? redactString(httpRequest.requestUrl.replace(URL_QUERY_SECRET_REGEX, '$1[REDACTED]'))
        : undefined,
    };
  }

  const entry: GcpLogEntry = {
    severity,
    message: sanitizedMessage,
    timestamp: new Date().toISOString(),
    serviceContext: {
      service,
      version,
    },
    ...sanitizedMeta,
  };

  if (traceId) {
    entry['logging.googleapis.com/trace'] = `projects/${gcpProjectId}/traces/${traceId}`;
    entry.traceId = traceId;
  }

  if (spanId) {
    entry['logging.googleapis.com/spanId'] = spanId;
    entry.spanId = spanId;
  }

  if (sanitizedHttpRequest) {
    entry.httpRequest = sanitizedHttpRequest;
  }

  if (sanitizedStackTrace) {
    entry.stackTrace = sanitizedStackTrace;
  }

  return entry;
}

export class Logger {
  private service: string;
  private version: string;
  private gcpProjectId: string;
  private context: Record<string, unknown>;

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.version = config.version || '0.1.0';
    this.gcpProjectId =
      config.gcpProjectId ||
      process.env.GCP_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      'promptfm';
    this.context = config.context || {};
  }

  /**
   * Spawns a child logger with bound contextual metadata (e.g., traceId, userId, component).
   */
  child(extraContext: Record<string, unknown>): Logger {
    return new Logger({
      service: this.service,
      version: this.version,
      gcpProjectId: this.gcpProjectId,
      context: {
        ...this.context,
        ...extraContext,
      },
    });
  }

  private emit(
    severity: LogSeverity,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ) {
    const combinedMeta = {
      ...this.context,
      ...metadata,
    };

    const traceId = (combinedMeta.traceId as string) || undefined;
    const spanId = (combinedMeta.spanId as string) || undefined;

    let fullMessage = message;
    let stackTrace: string | undefined;

    if (error) {
      fullMessage = `${message}: ${error.message}`;
      stackTrace = error.stack;
    }

    const payload = formatGcpLogEntry({
      severity,
      message: fullMessage,
      service: this.service,
      version: this.version,
      traceId,
      spanId,
      gcpProjectId: this.gcpProjectId,
      stackTrace,
      metadata: combinedMeta,
    });

    console.log(JSON.stringify(payload));
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.emit('DEBUG', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.emit('INFO', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.emit('WARNING', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.emit('ERROR', message, metadata, error);
  }

  critical(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.emit('CRITICAL', message, metadata, error);
  }
}

// Default singleton instance for general application use
export const defaultLogger = new Logger({
  service: 'promptfm-app',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
});
