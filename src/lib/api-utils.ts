import { NextRequest, NextResponse } from 'next/server';

/**
 * Wraps an API route handler with standardized error handling.
 * Catches unhandled exceptions and returns a consistent JSON error response.
 */
export function withErrorHandler(
  handler: (req: NextRequest, ctx?: unknown) => Promise<NextResponse | Response>
) {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse | Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      console.error(`[API Error] ${req.method} ${req.nextUrl.pathname}:`, error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
