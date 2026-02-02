import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/artworks/[id] - Get single artwork
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const artwork = await prisma.artwork.findUnique({
    where: { id },
    include: {
      artist: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
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
              avatarUrl: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
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
    return NextResponse.json(
      { error: 'Artwork not found' },
      { status: 404 }
    )
  }
  
  // Increment view count
  await prisma.artwork.update({
    where: { id },
    data: { viewCount: { increment: 1 } }
  })
  
  return NextResponse.json(artwork)
}
