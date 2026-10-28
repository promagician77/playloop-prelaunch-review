import { NextResponse, type NextRequest } from 'next/server';
// Redirect signed-out users away from private pages
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.getAll().some(c => c.name.startsWith('sb-'));
  if (!hasSession) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/profile/:path*', '/saved/:path*', '/saved'] };
