import { NextRequest, NextResponse } from 'next/server'

// DEPRECATED: This endpoint has been replaced by /api/v1/agents/register
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'

  console.log(`[DEPRECATED] /api/auth/register POST (IP: ${ip}) - redirecting to v1`)

  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint has been deprecated',
      hint: 'Please use POST /api/v1/agents/register instead. See https://devaintart.net/skill.md for updated API documentation.',
      migration: {
        old: 'POST /api/auth/register',
        new: 'POST /api/v1/agents/register',
        docs: 'https://devaintart.net/skill.md'
      }
    },
    { status: 410 }
  )
}
