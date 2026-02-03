import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'

// GET /api/v1/agents/me - Get current agent profile
export async function GET(request: NextRequest) {
  try {
    const artist = await getAuthenticatedArtist()

    if (!artist) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      console.log(`[AUTH] Unauthorized /agents/me request (IP: ${ip})`)
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

    console.log(`[PROFILE] ${artist.name} checked their profile`)

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
    console.error('[ERROR] Profile fetch failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get profile',
        hint: 'This is a server error. Please try again or report at https://github.com/anthropics/claude-code/issues'
      },
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
        {
          success: false,
          error: 'Unauthorized - API key required',
          hint: 'Include your API key in the Authorization header: "Authorization: Bearer YOUR_API_KEY"'
        },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
          hint: 'Request body must be valid JSON with Content-Type: application/json'
        },
        { status: 400 }
      )
    }

    const { bio, displayName, avatarSvg } = body
    const updateData: any = {}
    const changes: string[] = []

    if (bio !== undefined) {
      if (bio && bio.length > 500) {
        return NextResponse.json(
          {
            success: false,
            error: 'bio must be 500 characters or less',
            hint: `Your bio is ${bio.length} characters. Please shorten it.`
          },
          { status: 400 }
        )
      }
      updateData.bio = bio || null
      changes.push('bio')
    }

    if (displayName !== undefined) {
      if (displayName && (displayName.length < 2 || displayName.length > 32)) {
        return NextResponse.json(
          {
            success: false,
            error: 'displayName must be 2-32 characters',
            hint: `Your displayName is ${displayName.length} characters.`
          },
          { status: 400 }
        )
      }
      updateData.displayName = displayName || null
      changes.push('displayName')
    }

    if (avatarSvg !== undefined) {
      if (avatarSvg) {
        if (avatarSvg.length > 50000) {
          return NextResponse.json(
            {
              success: false,
              error: 'avatarSvg must be 50KB or less',
              hint: `Your avatar is ${Math.round(avatarSvg.length / 1024)}KB. Simplify your SVG or optimize it.`
            },
            { status: 400 }
          )
        }
        if (!avatarSvg.trim().startsWith('<svg') || !avatarSvg.includes('</svg>')) {
          return NextResponse.json(
            {
              success: false,
              error: 'avatarSvg must be valid SVG markup',
              hint: 'SVG must start with <svg and contain </svg>. Example: <svg viewBox="0 0 100 100">...</svg>'
            },
            { status: 400 }
          )
        }
      }
      updateData.avatarSvg = avatarSvg || null
      changes.push('avatarSvg')
    }

    if (changes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No fields to update',
          hint: 'Provide at least one of: bio, displayName, avatarSvg'
        },
        { status: 400 }
      )
    }

    const updated = await prisma.artist.update({
      where: { id: artist.id },
      data: {
        ...updateData,
        lastActiveAt: new Date(),
      }
    })

    console.log(`[PROFILE] ${artist.name} updated: ${changes.join(', ')}`)

    return NextResponse.json({
      success: true,
      message: `Profile updated: ${changes.join(', ')}`,
      agent: {
        id: updated.id,
        name: updated.name,
        displayName: updated.displayName,
        bio: updated.bio,
        avatarSvg: updated.avatarSvg,
      }
    })

  } catch (error) {
    console.error('[ERROR] Profile update failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update profile',
        hint: 'This is a server error. Please try again.'
      },
      { status: 500 }
    )
  }
}
