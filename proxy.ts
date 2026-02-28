import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function shouldSkip(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/favicon.ico') return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml') return true
  if (pathname.startsWith('/public/')) return true
  // Skip static-like files.
  return /\.[a-zA-Z0-9]{2,6}$/.test(pathname)
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (shouldSkip(pathname)) return NextResponse.next()

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID()
  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent') || 'unknown'

  console.log(
    `[REQ] ${JSON.stringify({
      ts: new Date().toISOString(),
      id: requestId,
      method: req.method,
      path: pathname,
      query: search || '',
      ip,
      ua: ua.slice(0, 200),
    })}`
  )

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-request-id', requestId)

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  })
  res.headers.set('x-request-id', requestId)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
