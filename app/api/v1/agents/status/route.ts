import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedArtist } from '@/lib/auth'

// GET /api/v1/agents/status - Check claim status
export async function GET(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json({
      status: artist.status,
      claimed: artist.status === 'claimed',
      xUsername: artist.xUsername,
    })
    
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
