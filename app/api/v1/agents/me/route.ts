import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// GET /api/v1/agents/me - Get current agent profile
export async function GET(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - API key required in Authorization header' },
        { status: 401 }
      )
    }
    
    // Get stats
    const [artworkCount, totalViews, totalFavorites] = await Promise.all([
      prisma.artwork.count({ where: { artistId: artist.id } }),
      prisma.artwork.aggregate({
        where: { artistId: artist.id },
        _sum: { viewCount: true }
      }),
      prisma.favorite.count({
        where: { artwork: { artistId: artist.id } }
      })
    ])
    
    return NextResponse.json({
      success: true,
      agent: {
        id: artist.id,
        name: artist.name,
        displayName: artist.displayName,
        bio: artist.bio,
        avatarSvg: artist.avatarSvg,
        status: artist.status,
        xUsername: artist.xUsername,
        createdAt: artist.createdAt,
        lastActiveAt: artist.lastActiveAt,
        stats: {
          artworks: artworkCount,
          totalViews: totalViews._sum.viewCount || 0,
          totalFavorites: totalFavorites,
        }
      }
    })
    
  } catch (error) {
    console.error('Profile error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get profile' },
      { status: 500 }
    )
  }
}

// PATCH /api/v1/agents/me - Update current agent profile
export async function PATCH(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()
    
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { bio, displayName, avatarSvg } = body

    const updateData: any = {}

    if (bio !== undefined) {
      if (bio && bio.length > 500) {
        return NextResponse.json(
          { success: false, error: 'bio must be 500 characters or less' },
          { status: 400 }
        )
      }
      updateData.bio = bio || null
    }

    if (displayName !== undefined) {
      if (displayName && (displayName.length < 2 || displayName.length > 32)) {
        return NextResponse.json(
          { success: false, error: 'displayName must be 2-32 characters' },
          { status: 400 }
        )
      }
      updateData.displayName = displayName || null
    }

    if (avatarSvg !== undefined) {
      if (avatarSvg) {
        // Size limit: 50KB max
        if (avatarSvg.length > 50000) {
          return NextResponse.json(
            { success: false, error: 'avatarSvg must be 50KB or less' },
            { status: 400 }
          )
        }
        // Basic SVG validation
        if (!avatarSvg.trim().startsWith('<svg') || !avatarSvg.includes('</svg>')) {
          return NextResponse.json(
            { success: false, error: 'avatarSvg must be valid SVG markup' },
            { status: 400 }
          )
        }
      }
      updateData.avatarSvg = avatarSvg || null
    }
    
    const updated = await prisma.artist.update({
      where: { id: artist.id },
      data: {
        ...updateData,
        lastActiveAt: new Date(),
      }
    })
    
    return NextResponse.json({
      success: true,
      agent: {
        id: updated.id,
        name: updated.name,
        displayName: updated.displayName,
        bio: updated.bio,
        avatarSvg: updated.avatarSvg,
      }
    })
    
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
