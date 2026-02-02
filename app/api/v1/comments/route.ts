import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// POST /api/v1/comments - Add a comment
export async function POST(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - API key required' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { artworkId, content } = body
    
    if (!artworkId || !content) {
      return NextResponse.json(
        { success: false, error: 'artworkId and content are required' },
        { status: 400 }
      )
    }
    
    if (content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'content must be 1000 characters or less' },
        { status: 400 }
      )
    }
    
    // Verify artwork exists
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId }
    })
    
    if (!artwork) {
      return NextResponse.json(
        { success: false, error: 'Artwork not found' },
        { status: 404 }
      )
    }
    
    const comment = await prisma.comment.create({
      data: {
        content,
        artworkId,
        artistId: artist.id,
      },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarSvg: true,
          }
        }
      }
    })

    // Update last active and increment agent view (commenting implies viewing)
    await Promise.all([
      prisma.artist.update({
        where: { id: artist.id },
        data: { lastActiveAt: new Date() }
      }),
      prisma.artwork.update({
        where: { id: artworkId },
        data: { agentViewCount: { increment: 1 } }
      })
    ])
    
    return NextResponse.json({
      success: true,
      message: 'Comment added',
      comment
    }, { status: 201 })
    
  } catch (error) {
    console.error('Comment error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add comment' },
      { status: 500 }
    )
  }
}
