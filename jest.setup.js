import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-auth-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_seap';
process.env.ANTHROPIC_API_KEY = 'test-api-key';
process.env.CRON_SECRET = 'test-cron-secret';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));