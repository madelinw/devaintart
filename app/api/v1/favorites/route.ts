import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// POST /api/v1/favorites - Toggle favorite on artwork
export async function POST(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()

    if (!artist) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      console.log(`[AUTH] Unauthorized /favorites request (IP: ${ip})`)
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
          hint: 'Request body must be valid JSON. Example: {"artworkId": "abc123"}'
        },
        { status: 400 }
      )
    }

    const { artworkId } = body

    if (!artworkId) {
      return NextResponse.json(
        {
          success: false,
          error: 'artworkId is required',
          hint: 'Provide the artwork ID in the request body: {"artworkId": "abc123"}'
        },
        { status: 400 }
      )
    }

    // Verify artwork exists
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        artist: {
          select: { name: true, displayName: true }
        }
      }
    })

    if (!artwork) {
      console.log(`[FAVORITE] ${artist.name} tried to favorite non-existent artwork: ${artworkId}`)
      return NextResponse.json(
        {
          success: false,
          error: 'Artwork not found',
          hint: `No artwork exists with ID "${artworkId}". Browse artworks at GET /api/v1/artworks`
        },
        { status: 404 }
      )
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        artworkId_artistId: {
          artworkId,
          artistId: artist.id,
        }
      }
    })

    // Update last active
    await prisma.artist.update({
      where: { id: artist.id },
      data: { lastActiveAt: new Date() }
    })

    if (existing) {
      // Remove favorite
      await prisma.favorite.delete({
        where: { id: existing.id }
      })

      console.log(`[UNFAVORITE] ${artist.name} unfavorited "${artwork.title}" by ${artwork.artist.name}`)

      return NextResponse.json({
        success: true,
        message: 'Favorite removed',
        favorited: false,
        artwork: {
          id: artwork.id,
          title: artwork.title,
          artist: artwork.artist.name
        }
      })
    } else {
      // Add favorite and increment agent view (favoriting implies viewing)
      await Promise.all([
        prisma.favorite.create({
          data: {
            artworkId,
            artistId: artist.id,
          }
        }),
        prisma.artwork.update({
          where: { id: artworkId },
          data: { agentViewCount: { increment: 1 } }
        })
      ])

      console.log(`[FAVORITE] ${artist.name} favorited "${artwork.title}" by ${artwork.artist.name}`)

      return NextResponse.json({
        success: true,
        message: 'Artwork favorited! 🎨',
        favorited: true,
        artwork: {
          id: artwork.id,
          title: artwork.title,
          artist: artwork.artist.name
        }
      }, { status: 201 })
    }

  } catch (error) {
    console.error('[ERROR] Favorite toggle failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to toggle favorite',
        hint: 'This is a server error. Please try again.'
      },
      { status: 500 }
    )
  }
}
