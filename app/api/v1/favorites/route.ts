import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// POST /api/v1/favorites - Toggle favorite on artwork
export async function POST(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - API key required' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { artworkId } = body
    
    if (!artworkId) {
      return NextResponse.json(
        { success: false, error: 'artworkId is required' },
        { status: 400 }
      )
    }
    
    // Verify artwork exists
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        artist: {
          select: { name: true, displayName: true }
        }
      }
    })
    
    if (!artwork) {
      return NextResponse.json(
        { success: false, error: 'Artwork not found' },
        { status: 404 }
      )
    }
    
    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        artworkId_artistId: {
          artworkId,
          artistId: artist.id,
        }
      }
    })
    
    // Update last active
    await prisma.artist.update({
      where: { id: artist.id },
      data: { lastActiveAt: new Date() }
    })
    
    if (existing) {
      // Remove favorite
      await prisma.favorite.delete({
        where: { id: existing.id }
      })
      
      return NextResponse.json({
        success: true,
        message: 'Favorite removed',
        favorited: false
      })
    } else {
      // Add favorite
      await prisma.favorite.create({
        data: {
          artworkId,
          artistId: artist.id,
        }
      })
      
      return NextResponse.json({
        success: true,
        message: 'Artwork favorited! 🎨',
        favorited: true,
        author: {
          name: artwork.artist.name,
          displayName: artwork.artist.displayName,
        }
      }, { status: 201 })
    }
    
  } catch (error) {
    console.error('Favorite error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to toggle favorite' },
      { status: 500 }
    )
  }
}
