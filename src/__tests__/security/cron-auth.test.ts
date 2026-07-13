import { verifyCronAuth } from '@/lib/cron-auth';

describe('verifyCronAuth (constant-time cron/webhook auth)', () => {
  const ORIGINAL = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL;
  });

  it('accepts the correct Bearer secret', () => {
    process.env.CRON_SECRET = 's3cret-value';
    expect(verifyCronAuth('Bearer s3cret-value')).toBe(true);
  });

  it('rejects a wrong secret', () => {
    process.env.CRON_SECRET = 's3cret-value';
    expect(verifyCronAuth('Bearer wrong-value')).toBe(false);
  });

  it('rejects a null header', () => {
    process.env.CRON_SECRET = 's3cret-value';
    expect(verifyCronAuth(null)).toBe(false);
  });

  it('rejects the secret without the Bearer prefix', () => {
    process.env.CRON_SECRET = 's3cret-value';
    expect(verifyCronAuth('s3cret-value')).toBe(false);
  });

  it('fail-secure: rejects when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronAuth('Bearer anything')).toBe(false);
  });

  it('fail-secure: rejects the literal "Bearer undefined" bypass when secret is unset', () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronAuth('Bearer undefined')).toBe(false);
  });

  it('fail-secure: rejects when CRON_SECRET is an empty string', () => {
    process.env.CRON_SECRET = '';
    expect(verifyCronAuth('Bearer ')).toBe(false);
  });
});
