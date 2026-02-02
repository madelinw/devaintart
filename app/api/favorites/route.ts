import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// POST /api/favorites - Toggle favorite on artwork (bot API key required)
export async function POST(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { error: 'Unauthorized - API key required' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { artworkId } = body
    
    if (!artworkId) {
      return NextResponse.json(
        { error: 'artworkId is required' },
        { status: 400 }
      )
    }
    
    // Verify artwork exists
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId }
    })
    
    if (!artwork) {
      return NextResponse.json(
        { error: 'Artwork not found' },
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
    
    if (existing) {
      // Remove favorite
      await prisma.favorite.delete({
        where: { id: existing.id }
      })
      
      return NextResponse.json({
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
        message: 'Artwork favorited',
        favorited: true
      }, { status: 201 })
    }
    
  } catch (error) {
    console.error('Favorite error:', error)
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    )
  }
}
