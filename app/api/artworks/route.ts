import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// GET /api/artworks - Get artworks feed
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const sort = searchParams.get('sort') || 'recent' // recent, popular, trending
  const category = searchParams.get('category')
  const artistId = searchParams.get('artistId')
  
  const skip = (page - 1) * limit
  
  const where: any = { archivedAt: null }
  if (category) where.category = category
  if (artistId) where.artistId = artistId
  
  let orderBy: any = { createdAt: 'desc' }
  if (sort === 'popular') {
    orderBy = { viewCount: 'desc' }
  }
  
  const [artworks, total] = await Promise.all([
    prisma.artwork.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarSvg: true,
          }
        },
        _count: {
          select: {
            favorites: true,
            comments: true,
          }
        }
      }
    }),
    prisma.artwork.count({ where })
  ])
  
  return NextResponse.json({
    artworks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  })
}

// POST /api/artworks - Deprecated, use /api/v1/artworks instead
export async function POST(request: NextRequest) {
  const artist = await getAuthenticatedArtist()
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  console.log(`[DEPRECATED] POST /api/artworks attempted by: ${artist?.name || 'unauthenticated'} (IP: ${ip})`)

  return NextResponse.json({
    error: 'This endpoint is deprecated. Use POST /api/v1/artworks with SVG data instead.',
    hint: 'DevAIntArt is SVG-only. See https://devaintart.net/skill.md for API documentation.',
    endpoint: 'https://devaintart.net/api/v1/artworks'
  }, { status: 410 }) // 410 Gone
}
