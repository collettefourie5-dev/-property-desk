import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Nonce-based CSP (`strict-dynamic` + a fresh nonce per request) is the tightest option, but
// it requires *every* route serving a script to be dynamically rendered — Next.js can't stamp
// a per-request nonce onto a statically prerendered page's <script> tags. Since large parts of
// this site (marketing pages, /admin/login) are static by design for performance, that combo
// silently breaks hydration app-wide (verified: it did, in the browser, nothing loaded). This
// host-allowlist CSP works with mixed static/dynamic rendering; extend the allowlists below
// rather than adding 'unsafe-inline'/'unsafe-eval' to script-src or loosening default-src.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://www.facebook.com",
  "connect-src 'self' https://www.facebook.com https://graph.facebook.com https://*.payfast.co.za",
  "frame-src 'self' https://*.payfast.co.za",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * Runs on every request. Two jobs:
 *  1. Stamp a correlation id (reused from an upstream reverse proxy if present) onto both
 *     the forwarded request and the response, so every log line for a request ties together
 *     (spec section 11), and set the Content-Security-Policy header (see CSP comment above).
 *  2. Optimistically redirect unauthenticated requests to /admin/** to the login page — a
 *     cookie-presence check only (no DB hit), so requireAuth()/requireRole() in the actual
 *     page/action remain the real, server-verified authorization boundary.
 */
export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith('/admin') &&
    request.nextUrl.pathname !== '/admin/login' &&
    !getSessionCookie(request)
  ) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('Content-Security-Policy', CSP);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  response.headers.set('Content-Security-Policy', CSP);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
