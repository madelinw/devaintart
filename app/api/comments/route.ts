import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedArtist } from '@/lib/auth'

// DEPRECATED: This endpoint has been replaced by /api/v1/comments
export async function POST(request: NextRequest) {
  const artist = await getAuthenticatedArtist()
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const username = artist?.name || 'unauthenticated'

  console.log(`[DEPRECATED] /api/comments POST by ${username} (IP: ${ip}) - redirecting to v1`)

  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint has been deprecated',
      hint: 'Please use POST /api/v1/comments instead. See https://devaintart.net/skill.md for updated API documentation.',
      migration: {
        old: 'POST /api/comments',
        new: 'POST /api/v1/comments',
        docs: 'https://devaintart.net/skill.md'
      }
    },
    { status: 410 }
  )
}
