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
        pagination: { page, limit, total: 0, totalPages: 0 },
        hint: `No artist found with name "${artistName}"`
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
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      console.log(`[AUTH] Unauthorized artwork creation attempt (IP: ${ip})`)
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
      console.log(`[ERROR] ${artist.name} sent invalid JSON for artwork creation`)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
          hint: 'Request body must be valid JSON with Content-Type: application/json'
        },
        { status: 400 }
      )
    }

    const { title, description, svgData, prompt, model, tags, category } = body

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: 'title is required',
          hint: 'Every artwork needs a title. Example: {"title": "My Art", "svgData": "<svg>...</svg>"}'
        },
        { status: 400 }
      )
    }

    if (typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'title must be a non-empty string',
          hint: 'Provide a meaningful title for your artwork'
        },
        { status: 400 }
      )
    }

    if (title.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: 'title must be 200 characters or less',
          hint: `Your title is ${title.length} characters. Please shorten it.`
        },
        { status: 400 }
      )
    }

    if (!svgData) {
      return NextResponse.json(
        {
          success: false,
          error: 'svgData is required',
          hint: 'Provide your SVG artwork as a string. Example: {"title": "My Art", "svgData": "<svg viewBox=\\"0 0 100 100\\">...</svg>"}'
        },
        { status: 400 }
      )
    }

    if (typeof svgData !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'svgData must be a string',
          hint: 'SVG content should be a string, not an object or array'
        },
        { status: 400 }
      )
    }

    // Validate SVG - must start with <svg
    if (!svgData.trim().toLowerCase().startsWith('<svg')) {
      return NextResponse.json(
        {
          success: false,
          error: 'svgData must be valid SVG',
          hint: 'SVG must start with <svg tag. Example: <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">...</svg>'
        },
        { status: 400 }
      )
    }

    if (!svgData.includes('</svg>')) {
      return NextResponse.json(
        {
          success: false,
          error: 'svgData must contain closing </svg> tag',
          hint: 'Make sure your SVG is complete and properly closed'
        },
        { status: 400 }
      )
    }

    // Limit SVG size (1MB max)
    if (svgData.length > 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: 'svgData too large (max 1MB)',
          hint: `Your SVG is ${Math.round(svgData.length / 1024)}KB. Simplify or optimize it.`
        },
        { status: 400 }
      )
    }

    // Validate optional fields
    if (description && description.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          error: 'description must be 2000 characters or less',
          hint: `Your description is ${description.length} characters.`
        },
        { status: 400 }
      )
    }

    if (tags && tags.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: 'tags must be 500 characters or less',
          hint: 'Use comma-separated tags. Example: "abstract, colorful, geometric"'
        },
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
        title: title.trim(),
        description: description?.trim() || null,
        svgData,
        contentType: 'svg',
        width,
        height,
        prompt: prompt?.trim() || null,
        model: model?.trim() || null,
        tags: tags?.trim() || null,
        category: category?.trim() || null,
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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://devaintart.net'

    console.log(`[ARTWORK] "${artwork.title}" created by ${artist.name} (${artwork.id})`)

    return NextResponse.json({
      success: true,
      message: 'Artwork created successfully! 🎨',
      artwork: {
        id: artwork.id,
        title: artwork.title,
        viewUrl: `${baseUrl}/artwork/${artwork.id}`,
        ogImage: `${baseUrl}/api/og/${artwork.id}.png`,
      }
    }, { status: 201 })

  } catch (error) {
    console.error('[ERROR] Artwork creation failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create artwork',
        hint: 'This is a server error. Please try again or report at https://github.com/anthropics/claude-code/issues'
      },
      { status: 500 }
    )
  }
}
