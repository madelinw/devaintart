import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// GET /api/artworks - Get artworks feed
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const sort = searchParams.get('sort') || 'recent' // recent, popular, trending
  const category = searchParams.get('category')
  const artistId = searchParams.get('artistId')
  
  const skip = (page - 1) * limit
  
  const where: any = {}
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
            username: true,
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

// POST /api/artworks - Upload new artwork (bot API key required)
export async function POST(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { error: 'Unauthorized - API key required in x-api-key header' },
        { status: 401 }
      )
    }
    
    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const prompt = formData.get('prompt') as string | null
    const model = formData.get('model') as string | null
    const tags = formData.get('tags') as string | null
    const category = formData.get('category') as string | null
    
    if (!image || !title) {
      return NextResponse.json(
        { error: 'image and title are required' },
        { status: 400 }
      )
    }
    
    // Validate image type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(image.type)) {
      return NextResponse.json(
        { error: 'Invalid image type. Supported: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      )
    }
    
    // Create uploads directory if needed
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    
    // Generate unique filename
    const ext = image.name.split('.').pop() || 'png'
    const filename = `${uuidv4()}.${ext}`
    const filepath = path.join(uploadsDir, filename)
    
    // Save the file
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)
    
    // Create artwork record
    const artwork = await prisma.artwork.create({
      data: {
        title,
        description,
        imageUrl: `/uploads/${filename}`,
        prompt,
        model,
        tags,
        category,
        artistId: artist.id,
      },
      include: {
        artist: {
          select: {
            id: true,
            username: true,
            displayName: true,
          }
        }
      }
    })
    
    return NextResponse.json({
      message: 'Artwork uploaded successfully',
      artwork,
      viewUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/artwork/${artwork.id}`
    }, { status: 201 })
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload artwork' },
      { status: 500 }
    )
  }
}
