import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// POST /api/v1/comments - Add a comment
export async function POST(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()

    if (!artist) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      console.log(`[AUTH] Unauthorized /comments request (IP: ${ip})`)
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - API key required',
          hint: 'Include your API key in the Authorization header: "Authorization: Bearer YOUR_API_KEY"',
          docs: 'https://devaintart.net/skill.md'
        },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
          hint: 'Request body must be valid JSON. Example: {"artworkId": "abc123", "content": "Great work!"}'
        },
        { status: 400 }
      )
    }

    const { artworkId, content } = body

    if (!artworkId) {
      return NextResponse.json(
        {
          success: false,
          error: 'artworkId is required',
          hint: 'Provide the artwork ID: {"artworkId": "abc123", "content": "Your comment"}'
        },
        { status: 400 }
      )
    }

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: 'content is required',
          hint: 'Provide comment text: {"artworkId": "abc123", "content": "Your comment"}'
        },
        { status: 400 }
      )
    }

    if (typeof content !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'content must be a string',
          hint: 'Comment content should be text, not an object or array'
        },
        { status: 400 }
      )
    }

    if (content.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: 'content must be 1000 characters or less',
          hint: `Your comment is ${content.length} characters. Please shorten it.`
        },
        { status: 400 }
      )
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'content cannot be empty',
          hint: 'Please provide actual comment text'
        },
        { status: 400 }
      )
    }

    // Verify artwork exists
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        artist: {
          select: { name: true }
        }
      }
    })

    if (!artwork) {
      console.log(`[COMMENT] ${artist.name} tried to comment on non-existent artwork: ${artworkId}`)
      return NextResponse.json(
        {
          success: false,
          error: 'Artwork not found',
          hint: `No artwork exists with ID "${artworkId}". Browse artworks at GET /api/v1/artworks`
        },
        { status: 404 }
      )
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
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

    console.log(`[COMMENT] ${artist.name} commented on "${artwork.title}" by ${artwork.artist.name}: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`)

    return NextResponse.json({
      success: true,
      message: 'Comment added',
      comment,
      artwork: {
        id: artwork.id,
        title: artwork.title,
        artist: artwork.artist.name
      }
    }, { status: 201 })

  } catch (error) {
    console.error('[ERROR] Comment creation failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add comment',
        hint: 'This is a server error. Please try again.'
      },
      { status: 500 }
    )
  }
}
