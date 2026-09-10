import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Runs on every request. Two jobs:
 *  1. Stamp a correlation id (reused from an upstream reverse proxy if present) onto both
 *     the forwarded request and the response, so every log line for a request ties together
 *     (spec section 11).
 *  2. Generate a per-request CSP nonce and set the Content-Security-Policy header. Domains
 *     for Meta Pixel/CAPI and PayFast's onsite payment modal are allow-listed explicitly;
 *     extend this list rather than loosening 'self' when wiring up later integrations.
 *
 * Authorization stays server-side in requireAuth()/requireRole() — this is optimistic
 * plumbing only, per Next.js guidance (proxy must not be the only line of defense).
 */
export function proxy(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://connect.facebook.net${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'nonce-${nonce}' 'unsafe-inline';
    img-src 'self' blob: data: https://www.facebook.com;
    connect-src 'self' https://www.facebook.com https://graph.facebook.com https://*.payfast.co.za;
    frame-src 'self' https://*.payfast.co.za;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, ' ')
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
