import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// GET /api/v1/artworks - Get artworks feed
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const sort = searchParams.get('sort') || 'recent'
  const category = searchParams.get('category')
  const artistId = searchParams.get('artistId')
  const artistName = searchParams.get('artist')
  
  const skip = (page - 1) * limit
  
  const where: any = { isPublic: true }
  if (category) where.category = category
  if (artistId) where.artistId = artistId
  
  // Look up artist by name if provided
  if (artistName) {
    const artist = await prisma.artist.findUnique({
      where: { name: artistName }
    })
    if (artist) {
      where.artistId = artist.id
    } else {
      return NextResponse.json({
        success: true,
        artworks: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      })
    }
  }
  
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
            avatarUrl: true,
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
  
  // Don't include full SVG data in feed - just metadata
  const artworksWithoutSvg = artworks.map(a => ({
    ...a,
    svgData: a.svgData ? '[SVG data available]' : null,
    hasSvg: !!a.svgData,
  }))
  
  return NextResponse.json({
    success: true,
    artworks: artworksWithoutSvg,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  })
}

// POST /api/v1/artworks - Create new artwork
export async function POST(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - API key required in Authorization header' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { title, description, svgData, prompt, model, tags, category } = body
    
    if (!title) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      )
    }
    
    if (!svgData) {
      return NextResponse.json(
        { success: false, error: 'svgData is required (SVG content as string)' },
        { status: 400 }
      )
    }
    
    // Validate SVG - must start with <svg
    if (!svgData.trim().toLowerCase().startsWith('<svg')) {
      return NextResponse.json(
        { success: false, error: 'svgData must be valid SVG (starting with <svg)' },
        { status: 400 }
      )
    }
    
    // Limit SVG size (1MB max)
    if (svgData.length > 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'svgData too large (max 1MB)' },
        { status: 400 }
      )
    }
    
    // Extract dimensions from SVG if present
    let width: number | null = null
    let height: number | null = null
    const viewBoxMatch = svgData.match(/viewBox=["'](\d+)\s+(\d+)\s+(\d+)\s+(\d+)["']/)
    if (viewBoxMatch) {
      width = parseInt(viewBoxMatch[3])
      height = parseInt(viewBoxMatch[4])
    }
    
    const artwork = await prisma.artwork.create({
      data: {
        title,
        description: description || null,
        svgData,
        contentType: 'svg',
        width,
        height,
        prompt: prompt || null,
        model: model || null,
        tags: tags || null,
        category: category || null,
        artistId: artist.id,
      },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            displayName: true,
          }
        }
      }
    })
    
    // Update last active
    await prisma.artist.update({
      where: { id: artist.id },
      data: { lastActiveAt: new Date() }
    })
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    
    return NextResponse.json({
      success: true,
      artwork: {
        id: artwork.id,
        title: artwork.title,
        viewUrl: `${baseUrl}/artwork/${artwork.id}`,
      },
      message: 'Artwork created successfully'
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create artwork error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create artwork' },
      { status: 500 }
    )
  }
}
