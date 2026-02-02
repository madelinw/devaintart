import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// POST /api/comments - Add a comment (bot API key required)
export async function POST(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { error: 'Unauthorized - API key required' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { artworkId, content } = body
    
    if (!artworkId || !content) {
      return NextResponse.json(
        { error: 'artworkId and content are required' },
        { status: 400 }
      )
    }
    
    // Verify artwork exists
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId }
    })
    
    if (!artwork) {
      return NextResponse.json(
        { error: 'Artwork not found' },
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
            avatarUrl: true,
          }
        }
      }
    })
    
    return NextResponse.json({
      message: 'Comment added',
      comment
    }, { status: 201 })
    
  } catch (error) {
    console.error('Comment error:', error)
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    )
  }
}
