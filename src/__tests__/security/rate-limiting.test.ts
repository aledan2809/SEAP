import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

describe('Rate Limiting', () => {
  describe('checkRateLimit', () => {
    it('allows requests within the limit', () => {
      const result = checkRateLimit('10.0.0.1', { max: 5, windowSeconds: 60, namespace: 'test-allow' });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('blocks requests exceeding the limit', () => {
      const namespace = 'test-block';
      const config = { max: 3, windowSeconds: 60, namespace };

      checkRateLimit('10.0.0.2', config);
      checkRateLimit('10.0.0.2', config);
      checkRateLimit('10.0.0.2', config);

      const result = checkRateLimit('10.0.0.2', config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('isolates rate limits per IP', () => {
      const config = { max: 1, windowSeconds: 60, namespace: 'test-isolate' };

      checkRateLimit('10.0.0.3', config);
      const blocked = checkRateLimit('10.0.0.3', config);
      expect(blocked.allowed).toBe(false);

      const otherIp = checkRateLimit('10.0.0.4', config);
      expect(otherIp.allowed).toBe(true);
    });

    it('isolates rate limits per namespace', () => {
      checkRateLimit('10.0.0.5', { max: 1, windowSeconds: 60, namespace: 'ns-a' });
      const blockedA = checkRateLimit('10.0.0.5', { max: 1, windowSeconds: 60, namespace: 'ns-a' });
      expect(blockedA.allowed).toBe(false);

      const allowedB = checkRateLimit('10.0.0.5', { max: 1, windowSeconds: 60, namespace: 'ns-b' });
      expect(allowedB.allowed).toBe(true);
    });
  });

  describe('getClientIp', () => {
    it('prefers x-real-ip header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-real-ip': '1.2.3.4',
          'x-forwarded-for': '5.6.7.8',
        },
      });
      expect(getClientIp(request)).toBe('1.2.3.4');
    });

    it('uses cf-connecting-ip when x-real-ip is absent', () => {
      const request = new Request('http://localhost', {
        headers: { 'cf-connecting-ip': '9.8.7.6' },
      });
      expect(getClientIp(request)).toBe('9.8.7.6');
    });

    it('handles x-forwarded-for with multiple IPs (takes rightmost trusted IP)', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' },
      });
      // Rightmost = IP added by trusted proxy
      expect(getClientIp(request)).toBe('10.0.0.3');
    });

    it('returns unknown when no IP headers present', () => {
      const request = new Request('http://localhost');
      expect(getClientIp(request)).toBe('unknown');
    });
  });
});
