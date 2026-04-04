export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side instrumentation (Node.js runtime)
    console.log('[Instrumentation] SEAP Assistant server starting');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime instrumentation
    console.log('[Instrumentation] SEAP Assistant edge runtime starting');
  }
}
