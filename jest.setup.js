// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-auth-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_seap';
process.env.ANTHROPIC_API_KEY = 'test-api-key';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
