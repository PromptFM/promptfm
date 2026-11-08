import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  redactSensitiveData,
  Logger,
  formatGcpLogEntry,
} from '@/lib/telemetry/logger';

describe('Sensitive Data, PII & GDPR Redaction in Telemetry Logger', () => {
  describe('redactSensitiveData on strings', () => {
    it('redacts email addresses to [REDACTED_EMAIL]', () => {
      const input = 'User alex.trifan@promptfm.live requested password reset for listener@domain.co.uk';
      const output = redactSensitiveData(input);
      expect(output).toBe('User [REDACTED_EMAIL] requested password reset for [REDACTED_EMAIL]');
    });

    it('redacts IPv4 addresses to [REDACTED_IP]', () => {
      const input = 'Incoming stream connection from 192.168.1.42 and 10.0.0.1';
      const output = redactSensitiveData(input);
      expect(output).toBe('Incoming stream connection from [REDACTED_IP] and [REDACTED_IP]');
    });

    it('does not redact SemVer version numbers like 0.1.0 or 14.2.1', () => {
      const input = 'Deploying promptfm@0.2.0 with node@20.10.0 and lib@1.2.3';
      const output = redactSensitiveData(input);
      expect(output).toBe('Deploying promptfm@0.2.0 with node@20.10.0 and lib@1.2.3');
    });

    it('redacts IPv6 addresses to [REDACTED_IP]', () => {
      const input = 'Client 2001:0db8:85a3:0000:0000:8a2e:0370:7334 streamed audio';
      const output = redactSensitiveData(input);
      expect(output).toBe('Client [REDACTED_IP] streamed audio');
    });

    it('redacts Bearer authorization tokens', () => {
      const input = 'Headers: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_jwt_signature';
      const output = redactSensitiveData(input);
      expect(output).toBe('Headers: Bearer [REDACTED_TOKEN]');
    });

    it('redacts GitHub personal access tokens', () => {
      const mockGhp = ['ghp_', 'fakeTestingToken12345678901234567890'].join('');
      const input = `Cloning with token ${mockGhp}`;
      const output = redactSensitiveData(input);
      expect(output).toBe('Cloning with token [REDACTED_GITHUB_TOKEN]');
    });

    it('redacts Google Cloud and Gemini API keys', () => {
      const mockGoogle = ['AIzaSy', 'FakeGoogleKeyForTesting1234567890'].join('');
      const input = `AI Studio key: ${mockGoogle} applied`;
      const output = redactSensitiveData(input);
      expect(output).toBe('AI Studio key: [REDACTED_GOOGLE_KEY] applied');
    });

    it('redacts OpenAI / Supabase secret key prefixes', () => {
      const mockOpenAi = ['sk-', 'proj-', 'fakeTesting1234567890abcdefghijklmn'].join('');
      const mockSupabase = ['sbp_', 'fakeTestingToken1234567890abcdef1234567890'].join('');
      const input = `${mockOpenAi} and ${mockSupabase}`;
      const output = redactSensitiveData(input);
      expect(output).toContain('[REDACTED_API_KEY]');
      expect(output).toContain('[REDACTED_SUPABASE_KEY]');
    });
  });

  describe('redactSensitiveData on structured objects', () => {
    it('recursively redacts sensitive key names in objects', () => {
      const mockGhp = ['ghp_', 'fakeToken1234567890123456789012345678'].join('');
      const mockGoogle = ['AIzaSy', 'fakeGoogleKeyTesting12345678901234'].join('');
      const payload = {
        userId: 'usr_456',
        password: 'SuperSecretPassword123!',
        token: mockGhp,
        apiKey: mockGoogle,
        authorization: 'Bearer token_value_abc',
        clientSecret: 'shhh_private',
        nested: {
          secretKey: 'deep_secret',
          email: 'admin@promptfm.live',
          safeField: 'chillout_channel',
        },
      };

      const result = redactSensitiveData(payload) as Record<string, any>;

      expect(result.userId).toBe('usr_456');
      expect(result.password).toBe('[REDACTED_SECRET]');
      expect(result.token).toBe('[REDACTED_SECRET]');
      expect(result.apiKey).toBe('[REDACTED_SECRET]');
      expect(result.authorization).toBe('[REDACTED_SECRET]');
      expect(result.clientSecret).toBe('[REDACTED_SECRET]');
      expect(result.nested.secretKey).toBe('[REDACTED_SECRET]');
      expect(result.nested.email).toBe('[REDACTED_EMAIL]');
      expect(result.nested.safeField).toBe('chillout_channel');
    });

    it('redacts sensitive values in arrays', () => {
      const list = [
        'user@domain.com',
        '10.20.30.40',
        { token: 'secret', name: 'PromptFM Admin' },
      ];

      const result = redactSensitiveData(list) as any[];

      expect(result[0]).toBe('[REDACTED_EMAIL]');
      expect(result[1]).toBe('[REDACTED_IP]');
      expect(result[2].token).toBe('[REDACTED_SECRET]');
      expect(result[2].name).toBe('PromptFM Admin');
    });

    it('handles circular object references gracefully without infinite loops', () => {
      const circular: any = { name: 'circular_test' };
      circular.self = circular;

      expect(() => {
        const sanitized = redactSensitiveData(circular);
        expect(sanitized).toBeDefined();
      }).not.toThrow();
    });

    it('preserves primitive types (numbers, booleans, null, undefined)', () => {
      expect(redactSensitiveData(42)).toBe(42);
      expect(redactSensitiveData(true)).toBe(true);
      expect(redactSensitiveData(null)).toBe(null);
      expect(redactSensitiveData(undefined)).toBe(undefined);
    });
  });

  describe('Logger integration with PII redaction', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('sanitizes log message and metadata before emitting to stdout', () => {
      const logger = new Logger({ service: 'promptfm-api' });

      logger.info('User admin@promptfm.live logged in from 198.51.100.22', {
        email: 'listener@example.com',
        apiKey: ['AIzaSy', 'fakeGoogleTesting1234567890'].join(''),
        channel: 'cyberpunk',
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(parsed.message).toBe('User [REDACTED_EMAIL] logged in from [REDACTED_IP]');
      expect(parsed.email).toBe('[REDACTED_EMAIL]');
      expect(parsed.apiKey).toBe('[REDACTED_SECRET]');
      expect(parsed.channel).toBe('cyberpunk');
    });

    it('sanitizes error stack trace and error message in error severity', () => {
      const logger = new Logger({ service: 'promptfm-api' });
      const sensitiveErr = new Error('Database connect failed for postgres://admin:superSecret123@192.168.1.50:5432/promptfm');

      logger.error('Database connection error', sensitiveErr, {
        connectionString: 'postgres://admin:superSecret123@192.168.1.50:5432/promptfm',
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(parsed.severity).toBe('ERROR');
      expect(parsed.message).not.toContain('192.168.1.50');
      expect(parsed.message).toContain('[REDACTED_IP]');
      expect(parsed.stackTrace).not.toContain('192.168.1.50');
      expect(parsed.connectionString).toBe('[REDACTED_SECRET]');
    });

    it('sanitizes httpRequest remoteIp and query params in formatGcpLogEntry', () => {
      const entry = formatGcpLogEntry({
        severity: 'INFO',
        message: 'HTTP Request handled for listener@promptfm.live',
        service: 'promptfm-edge',
        httpRequest: {
          requestMethod: 'GET',
          requestUrl: 'https://promptfm.live/api/radio/now?token=secret123&user=john@test.com',
          remoteIp: '203.0.113.195',
          status: 200,
        },
      });

      expect(entry.message).toBe('HTTP Request handled for [REDACTED_EMAIL]');
      expect(entry.httpRequest?.remoteIp).toBe('[REDACTED_IP]');
      expect(entry.httpRequest?.requestUrl).not.toContain('secret123');
      expect(entry.httpRequest?.requestUrl).not.toContain('john@test.com');
    });
  });
});
