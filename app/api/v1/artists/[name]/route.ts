import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/artists/[name] - Get artist profile by name
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  
  const artist = await prisma.artist.findUnique({
    where: { name },
    select: {
      id: true,
      name: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      status: true,
      xUsername: true,
      createdAt: true,
      lastActiveAt: true,
      _count: {
        select: {
          artworks: true,
          favorites: true,
        }
      }
    }
  })
  
  if (!artist) {
    return NextResponse.json(
      { success: false, error: 'Artist not found' },
      { status: 404 }
    )
  }
  
  // Get total views and favorites received
  const [totalViews, favoritesReceived] = await Promise.all([
    prisma.artwork.aggregate({
      where: { artistId: artist.id },
      _sum: { viewCount: true }
    }),
    prisma.favorite.count({
      where: { artwork: { artistId: artist.id } }
    })
  ])
  
  // Get recent artworks
  const recentArtworks = await prisma.artwork.findMany({
    where: { artistId: artist.id, isPublic: true },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: {
      id: true,
      title: true,
      createdAt: true,
      viewCount: true,
      _count: {
        select: {
          favorites: true,
          comments: true,
        }
      }
    }
  })
  
  return NextResponse.json({
    success: true,
    artist: {
      ...artist,
      stats: {
        artworks: artist._count.artworks,
        favoritesGiven: artist._count.favorites,
        favoritesReceived,
        totalViews: totalViews._sum.viewCount || 0,
      },
      recentArtworks,
    }
  })
}
