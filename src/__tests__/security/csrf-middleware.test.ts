import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('CSRF Middleware', () => {
  it('allows GET requests without origin check', () => {
    const request = new NextRequest('http://localhost:3000/api/organizations');
    const response = middleware(request);
    expect(response.status).not.toBe(403);
  });

  it('blocks POST requests without Origin or Referer', () => {
    const request = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
    });
    const response = middleware(request);
    expect(response.status).toBe(403);
  });

  it('blocks POST requests from unknown origin', () => {
    const request = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    });
    const response = middleware(request);
    expect(response.status).toBe(403);
  });

  it('allows POST requests from allowed origin', () => {
    const request = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    const response = middleware(request);
    expect(response.status).not.toBe(403);
  });

  it('allows POST requests from production origin', () => {
    const request = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { origin: 'https://seap.knowbest.ro' },
    });
    const response = middleware(request);
    expect(response.status).not.toBe(403);
  });

  it('blocks PUT requests from unknown origin', () => {
    const request = new NextRequest('http://localhost:3000/api/user/profile', {
      method: 'PUT',
      headers: { origin: 'https://attacker.site' },
    });
    const response = middleware(request);
    expect(response.status).toBe(403);
  });

  it('blocks POST with malformed referer', () => {
    const request = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { referer: 'not-a-url' },
    });
    const response = middleware(request);
    expect(response.status).toBe(403);
  });

  it('allows webhook routes without origin (external callers)', () => {
    const request = new NextRequest('http://localhost:3000/api/webhooks/n8n', {
      method: 'POST',
    });
    const response = middleware(request);
    expect(response.status).not.toBe(403);
  });

  it('allows scan route without origin (cron callers)', () => {
    const request = new NextRequest('http://localhost:3000/api/scan', {
      method: 'POST',
    });
    const response = middleware(request);
    expect(response.status).not.toBe(403);
  });

  it('allows deadline-check route without origin (cron callers)', () => {
    const request = new NextRequest('http://localhost:3000/api/notifications/deadline-check', {
      method: 'POST',
    });
    const response = middleware(request);
    expect(response.status).not.toBe(403);
  });
});
