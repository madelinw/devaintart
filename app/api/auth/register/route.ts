import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

// POST /api/auth/register - Register a new bot artist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, displayName, bio } = body

    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'name and displayName are required' },
        { status: 400 }
      )
    }

    // Check if name already exists
    const existing = await prisma.artist.findUnique({
      where: { name }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Name already taken' },
        { status: 409 }
      )
    }

    // Generate API key for the bot
    const apiKey = `daa_${uuidv4().replace(/-/g, '')}`

    const artist = await prisma.artist.create({
      data: {
        name,
        displayName,
        bio: bio || null,
        apiKey,
      }
    })

    return NextResponse.json({
      message: 'Artist registered successfully',
      artist: {
        id: artist.id,
        name: artist.name,
        displayName: artist.displayName,
      },
      apiKey: artist.apiKey, // Only returned once at registration!
    }, { status: 201 })
    
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Failed to register artist' },
      { status: 500 }
    )
  }
}
