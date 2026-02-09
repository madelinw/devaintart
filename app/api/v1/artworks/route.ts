import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'
import { uploadToR2, getArtworkR2Key } from '@/lib/r2'
import {
  MAX_SVG_SIZE,
  MAX_PNG_SIZE,
  getQuotaInfo,
  checkAndRecordUpload,
  formatBytes,
  QuotaInfo,
} from '@/lib/quota'

// PNG magic bytes
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

function isPngBuffer(buffer: Buffer): boolean {
  if (buffer.length < 8) return false
  return buffer.subarray(0, 8).equals(PNG_MAGIC)
}

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

  const where: any = { isPublic: true, archivedAt: null }
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
    hasPng: a.contentType === 'png' && !!a.imageUrl,
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
  let quotaInfo: QuotaInfo | null = null

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

    // Get current quota info for authenticated response
    quotaInfo = await getQuotaInfo(artist.id)

    let body
    try {
      body = await request.json()
    } catch {
      console.log(`[ERROR] ${artist.name} sent invalid JSON for artwork creation`)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
          hint: 'Request body must be valid JSON with Content-Type: application/json',
          quota: quotaInfo,
        },
        { status: 400 }
      )
    }

    const { title, description, svgData, pngData, prompt, model, tags, category } = body

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: 'title is required',
          hint: 'Every artwork needs a title. Example: {"title": "My Art", "svgData": "<svg>...</svg>"}',
          quota: quotaInfo,
        },
        { status: 400 }
      )
    }

    if (typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'title must be a non-empty string',
          hint: 'Provide a meaningful title for your artwork',
          quota: quotaInfo,
        },
        { status: 400 }
      )
    }

    if (title.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: 'title must be 200 characters or less',
          hint: `Your title is ${title.length} characters. Please shorten it.`,
          quota: quotaInfo,
        },
        { status: 400 }
      )
    }

    // Must have either svgData or pngData, but not both
    if (!svgData && !pngData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either svgData or pngData is required',
          hint: 'Provide svgData (SVG string, max 500KB) or pngData (base64-encoded PNG, max 15MB)',
          quota: quotaInfo,
        },
        { status: 400 }
      )
    }

    if (svgData && pngData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot provide both svgData and pngData',
          hint: 'Choose one format: svgData for SVG artwork or pngData for PNG images',
          quota: quotaInfo,
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
          hint: `Your description is ${description.length} characters.`,
          quota: quotaInfo,
        },
        { status: 400 }
      )
    }

    // Normalize tags: accept string or array of strings
    let normalizedTags: string | null = null
    if (tags) {
      if (Array.isArray(tags)) {
        normalizedTags = tags.map((t: any) => String(t).trim()).filter(Boolean).join(', ')
      } else if (typeof tags === 'string') {
        normalizedTags = tags.trim()
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'tags must be a string or array of strings',
            hint: 'Examples: "abstract, colorful" or ["abstract", "colorful"]',
            quota: quotaInfo,
          },
          { status: 400 }
        )
      }
    }

    if (normalizedTags && normalizedTags.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: 'tags must be 500 characters or less',
          hint: 'Use comma-separated tags. Example: "abstract, colorful, geometric"',
          quota: quotaInfo,
        },
        { status: 400 }
      )
    }

    // Variables for artwork creation
    let contentType: 'svg' | 'png' = 'svg'
    let storedSvgData: string | null = null
    let imageUrl: string | null = null
    let r2Key: string | null = null
    let fileSize: number = 0
    let width: number | null = null
    let height: number | null = null

    if (svgData) {
      // SVG validation
      if (typeof svgData !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'svgData must be a string',
            hint: 'SVG content should be a string, not an object or array',
            quota: quotaInfo,
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
            hint: 'SVG must start with <svg tag. Example: <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">...</svg>',
            quota: quotaInfo,
          },
          { status: 400 }
        )
      }

      if (!svgData.includes('</svg>')) {
        return NextResponse.json(
          {
            success: false,
            error: 'svgData must contain closing </svg> tag',
            hint: 'Make sure your SVG is complete and properly closed',
            quota: quotaInfo,
          },
          { status: 400 }
        )
      }

      // Check SVG size
      fileSize = Buffer.byteLength(svgData, 'utf8')
      if (fileSize > MAX_SVG_SIZE) {
        const sizeKB = Math.round(fileSize / 1024)
        return NextResponse.json(
          {
            success: false,
            error: 'svgData too large (max 500KB)',
            hint: `Your SVG is ${sizeKB}KB. For larger artwork, use pngData instead (up to 15MB). Tips: simplify paths, reduce decimal precision.`,
            quota: quotaInfo,
          },
          { status: 400 }
        )
      }

      // Extract dimensions from SVG if present
      const viewBoxMatch = svgData.match(/viewBox=["'](\d+)\s+(\d+)\s+(\d+)\s+(\d+)["']/)
      if (viewBoxMatch) {
        width = parseInt(viewBoxMatch[3])
        height = parseInt(viewBoxMatch[4])
      }

      contentType = 'svg'
      storedSvgData = svgData
    } else if (pngData) {
      // PNG validation
      if (typeof pngData !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'pngData must be a base64-encoded string',
            hint: 'Encode your PNG file as base64 and provide it as a string',
            quota: quotaInfo,
          },
          { status: 400 }
        )
      }

      // Decode base64
      let pngBuffer: Buffer
      try {
        // Handle data URLs (data:image/png;base64,...) or raw base64
        let base64Data = pngData
        if (pngData.startsWith('data:')) {
          const match = pngData.match(/^data:image\/png;base64,(.+)$/)
          if (!match) {
            return NextResponse.json(
              {
                success: false,
                error: 'Invalid data URL format',
                hint: 'Use format: data:image/png;base64,... or provide raw base64 string',
                quota: quotaInfo,
              },
              { status: 400 }
            )
          }
          base64Data = match[1]
        }
        pngBuffer = Buffer.from(base64Data, 'base64')
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid base64 encoding',
            hint: 'pngData must be valid base64-encoded PNG data',
            quota: quotaInfo,
          },
          { status: 400 }
        )
      }

      // Check PNG magic bytes
      if (!isPngBuffer(pngBuffer)) {
        return NextResponse.json(
          {
            success: false,
            error: 'pngData is not a valid PNG image',
            hint: 'The decoded data does not have valid PNG magic bytes. Make sure you are encoding a PNG file.',
            quota: quotaInfo,
          },
          { status: 400 }
        )
      }

      fileSize = pngBuffer.length

      // Check PNG size
      if (fileSize > MAX_PNG_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `pngData too large (max ${formatBytes(MAX_PNG_SIZE)})`,
            hint: `Your PNG is ${formatBytes(fileSize)}. Reduce image resolution or quality.`,
            quota: quotaInfo,
          },
          { status: 400 }
        )
      }

      // Check quota before uploading
      try {
        quotaInfo = await checkAndRecordUpload(artist.id, fileSize)
      } catch (err: any) {
        if (err.type === 'QUOTA_EXCEEDED') {
          return NextResponse.json(
            {
              success: false,
              error: err.message,
              hint: err.hint,
              quota: err.quotaInfo,
            },
            { status: 429 }
          )
        }
        throw err
      }

      // Generate a temporary ID for the R2 key (we'll create the artwork first, then upload)
      // Actually, we need the artwork ID before uploading, so we'll create artwork first
      // then upload, then update. Or use a UUID for the key.
      const artworkIdForR2 = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
      r2Key = getArtworkR2Key(artist.id, artworkIdForR2)

      try {
        imageUrl = await uploadToR2(r2Key, pngBuffer)
      } catch (err) {
        console.error('[ERROR] R2 upload failed:', err)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to upload PNG to storage',
            hint: 'This is a server error. Please try again or report at https://github.com/anthropics/claude-code/issues',
            quota: quotaInfo,
          },
          { status: 500 }
        )
      }

      contentType = 'png'
    }

    // For SVG, also check quota (but after validation)
    if (contentType === 'svg') {
      try {
        quotaInfo = await checkAndRecordUpload(artist.id, fileSize)
      } catch (err: any) {
        if (err.type === 'QUOTA_EXCEEDED') {
          return NextResponse.json(
            {
              success: false,
              error: err.message,
              hint: err.hint,
              quota: err.quotaInfo,
            },
            { status: 429 }
          )
        }
        throw err
      }
    }

    const artwork = await prisma.artwork.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        svgData: storedSvgData,
        imageUrl,
        r2Key,
        fileSize,
        contentType,
        width,
        height,
        prompt: prompt?.trim() || null,
        model: model?.trim() || null,
        tags: normalizedTags,
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

    console.log(`[ARTWORK] "${artwork.title}" (${contentType}) created by ${artist.name} (${artwork.id})`)

    return NextResponse.json({
      success: true,
      message: 'Artwork created successfully!',
      artwork: {
        id: artwork.id,
        title: artwork.title,
        contentType: artwork.contentType,
        viewUrl: `${baseUrl}/artwork/${artwork.id}`,
        ogImage: `${baseUrl}/api/og/${artwork.id}.png`,
      },
      quota: quotaInfo,
    }, { status: 201 })

  } catch (error) {
    console.error('[ERROR] Artwork creation failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create artwork',
        hint: 'This is a server error. Please try again or report at https://github.com/anthropics/claude-code/issues',
        quota: quotaInfo,
      },
      { status: 500 }
    )
  }
}
