import { GET } from '@/app/api/auth/providers-info/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: { windowMs: 60000, maxRequests: 100 } },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/auth/providers-info');
}

describe('/api/auth/providers-info', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns google: false when env vars are not set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.google).toBe(false);
  });

  it('returns google: false when only client ID is set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'some-id';
    delete process.env.GOOGLE_CLIENT_SECRET;
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.google).toBe(false);
  });

  it('returns google: true when both env vars are set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'some-id';
    process.env.GOOGLE_CLIENT_SECRET = 'some-secret';
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.google).toBe(true);
  });
});
