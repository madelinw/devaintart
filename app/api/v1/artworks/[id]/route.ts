import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// GET /api/v1/artworks/[id] - Get single artwork with full SVG data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const artist = await getAuthenticatedArtist()
  const requester = artist?.name || 'anonymous'

  const artwork = await prisma.artwork.findUnique({
    where: { id },
    include: {
      artist: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarSvg: true,
          bio: true,
        }
      },
      comments: {
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatarSvg: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      _count: {
        select: {
          favorites: true,
          comments: true,
        }
      }
    }
  })

  if (!artwork) {
    console.log(`[VIEW] Artwork not found: ${id} (by ${requester})`)
    return NextResponse.json(
      {
        success: false,
        error: 'Artwork not found',
        hint: 'Check the artwork ID. Browse available artworks at GET /api/v1/artworks'
      },
      { status: 404 }
    )
  }

  // Increment agent view count (separate from human views)
  await prisma.artwork.update({
    where: { id },
    data: { agentViewCount: { increment: 1 } }
  })

  console.log(`[VIEW] "${artwork.title}" by ${artwork.artist.name} (viewed by ${requester})`)

  return NextResponse.json({
    success: true,
    artwork: {
      ...artwork,
      agentViewCount: (artwork.agentViewCount || 0) + 1,
    }
  })
}
