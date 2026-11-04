import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  createTraceContext,
  extractTraceFromHeaders,
  formatGcpLogEntry,
  type LogSeverity,
} from '@/lib/telemetry/logger';

describe('Structured Zero-Cost Telemetry & Distributed Tracing', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('createTraceContext', () => {
    it('generates a valid 32-hex traceId and 16-hex spanId', () => {
      const trace = createTraceContext();
      expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(trace.traceparent).toMatch(new RegExp(`^00-${trace.traceId}-${trace.spanId}-01$`));
    });
  });

  describe('extractTraceFromHeaders', () => {
    it('parses W3C traceparent header correctly', () => {
      const w3cHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const trace = extractTraceFromHeaders({ traceparent: w3cHeader });

      expect(trace.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(trace.spanId).toBe('00f067aa0ba902b7');
      expect(trace.traceparent).toBe(w3cHeader);
    });

    it('extracts x-request-id when traceparent is absent', () => {
      const reqId = 'custom-request-uuid-1234';
      const trace = extractTraceFromHeaders({ 'x-request-id': reqId });

      expect(trace.traceId).toBe(reqId);
      expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('extracts Google Cloud trace from x-cloud-trace-context header', () => {
      const gcpHeader = '105445aa7843bc8bf206b120001000/1;o=1';
      const trace = extractTraceFromHeaders({ 'x-cloud-trace-context': gcpHeader });

      expect(trace.traceId).toBe('105445aa7843bc8bf206b120001000');
      expect(trace.spanId).toBe('1');
    });

    it('creates new trace context when no headers are provided', () => {
      const trace = extractTraceFromHeaders({});
      expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('formatGcpLogEntry', () => {
    it('formats entry adhering to Google Cloud Logging JSON payload specification', () => {
      const entry = formatGcpLogEntry({
        severity: 'INFO',
        message: 'Radio track started',
        service: 'promptfm-streamer',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        gcpProjectId: 'promptfm-prod',
        metadata: { trackId: '123', channel: 'chillout' },
      });

      expect(entry.severity).toBe('INFO');
      expect(entry.message).toBe('Radio track started');
      expect(entry['logging.googleapis.com/trace']).toBe(
        'projects/promptfm-prod/traces/4bf92f3577b34da6a3ce929d0e0e4736'
      );
      expect(entry['logging.googleapis.com/spanId']).toBe('00f067aa0ba902b7');
      expect(entry.serviceContext.service).toBe('promptfm-streamer');
      expect(entry.trackId).toBe('123');
      expect(entry.channel).toBe('chillout');
      expect(entry.timestamp).toBeTruthy();
    });
  });

  describe('Logger instance', () => {
    it('emits structured JSON to stdout for INFO severity', () => {
      const logger = new Logger({ service: 'promptfm-web' });
      logger.info('User initiated stream playback', { userId: 'usr_789' });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const rawLog = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(rawLog);

      expect(parsed.severity).toBe('INFO');
      expect(parsed.message).toBe('User initiated stream playback');
      expect(parsed.serviceContext.service).toBe('promptfm-web');
      expect(parsed.userId).toBe('usr_789');
    });

    it('emits ERROR severity with stack trace when error object is provided', () => {
      const logger = new Logger({ service: 'promptfm-web' });
      const testErr = new Error('Database connection timeout');
      logger.error('Failed to query playlist', testErr, { queryTimeMs: 5000 });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(parsed.severity).toBe('ERROR');
      expect(parsed.message).toBe('Failed to query playlist: Database connection timeout');
      expect(parsed.stackTrace).toContain('Error: Database connection timeout');
      expect(parsed.queryTimeMs).toBe(5000);
    });

    it('creates child logger inheriting trace and context bindings', () => {
      const parentLogger = new Logger({ service: 'promptfm-web' });
      const child = parentLogger.child({
        traceId: 'test-trace-id',
        component: 'AudioStreamer',
      });

      child.warn('High stream buffering latency', { bufferMs: 1200 });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(parsed.severity).toBe('WARNING');
      expect(parsed.component).toBe('AudioStreamer');
      expect(parsed.traceId).toBe('test-trace-id');
      expect(parsed.bufferMs).toBe(1200);
    });
  });
});

