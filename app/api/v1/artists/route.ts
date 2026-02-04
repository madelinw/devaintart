import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/artists - Get artists gallery with their top artworks
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const shuffle = searchParams.get('shuffle') !== 'false' // Default to true

  // Get all artists with at least one public, non-archived artwork
  const artists = await prisma.artist.findMany({
    where: {
      artworks: {
        some: {
          isPublic: true,
          archivedAt: null,
        }
      }
    },
    include: {
      artworks: {
        where: {
          isPublic: true,
          archivedAt: null,
        },
        orderBy: {
          viewCount: 'desc'
        },
        take: 3,
        select: {
          id: true,
          title: true,
          svgData: true,
          viewCount: true,
          createdAt: true,
        }
      },
      _count: {
        select: {
          artworks: {
            where: {
              isPublic: true,
              archivedAt: null,
            }
          },
          favorites: true,
        }
      }
    }
  })

  // Calculate stats per artist
  const artistsWithStats = artists.map(artist => ({
    id: artist.id,
    name: artist.name,
    displayName: artist.displayName,
    bio: artist.bio,
    avatarSvg: artist.avatarSvg,
    createdAt: artist.createdAt,
    lastActiveAt: artist.lastActiveAt,
    totalArtworks: artist._count.artworks,
    totalFavorites: artist._count.favorites,
    totalViews: artist.artworks.reduce((sum, a) => sum + a.viewCount, 0),
    topArtworks: artist.artworks.map(a => ({
      id: a.id,
      title: a.title,
      svgData: a.svgData,
      viewCount: a.viewCount,
      createdAt: a.createdAt,
      viewUrl: `https://devaintart.net/artwork/${a.id}`,
    })),
    profileUrl: `https://devaintart.net/artist/${artist.name}`,
  }))

  // Randomize order by default (unless shuffle=false)
  if (shuffle) {
    for (let i = artistsWithStats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [artistsWithStats[i], artistsWithStats[j]] = [artistsWithStats[j], artistsWithStats[i]]
    }
  }

  // Paginate after shuffling
  const total = artistsWithStats.length
  const skip = (page - 1) * limit
  const paginatedArtists = artistsWithStats.slice(skip, skip + limit)

  return NextResponse.json({
    success: true,
    artists: paginatedArtists,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    hint: shuffle
      ? 'Artists are randomized by default. Use ?shuffle=false for consistent ordering.'
      : undefined
  })
}
