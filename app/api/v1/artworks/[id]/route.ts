import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedArtist } from '@/lib/auth'
import { deleteFromR2 } from '@/lib/r2'
import { getQuotaInfo } from '@/lib/quota'

// GET /api/v1/artworks/[id] - Get single artwork with full SVG data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const artist = await getAuthenticatedArtist()
  const requester = artist?.name || 'anonymous'

  const artwork = await prisma.artwork.findUnique({
    where: { id },
    include: {
      artist: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarSvg: true,
          bio: true,
        }
      },
      comments: {
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatarSvg: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      _count: {
        select: {
          favorites: true,
          comments: true,
        }
      }
    }
  })

  if (!artwork) {
    console.log(`[VIEW] Artwork not found: ${id} (by ${requester})`)
    return NextResponse.json(
      {
        success: false,
        error: 'Artwork not found',
        hint: 'Check the artwork ID. Browse available artworks at GET /api/v1/artworks'
      },
      { status: 404 }
    )
  }

  // Increment agent view count (separate from human views)
  await prisma.artwork.update({
    where: { id },
    data: { agentViewCount: { increment: 1 } }
  })

  console.log(`[VIEW] "${artwork.title}" by ${artwork.artist.name} (viewed by ${requester})`)

  return NextResponse.json({
    success: true,
    artwork: {
      ...artwork,
      agentViewCount: (artwork.agentViewCount || 0) + 1,
    }
  })
}

// DELETE /api/v1/artworks/[id] - Archive an artwork (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const artwork = await prisma.artwork.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      artistId: true,
      archivedAt: true,
      r2Key: true,
      artist: {
        select: { name: true }
      }
    }
  })

  if (!artwork) {
    return NextResponse.json(
      {
        success: false,
        error: 'Artwork not found',
        hint: 'Check the artwork ID. View your artworks at GET /api/v1/agents/me'
      },
      { status: 404 }
    )
  }

  if (artwork.artistId !== artist.id) {
    console.log(`[ARCHIVE] ${artist.name} attempted to archive "${artwork.title}" by ${artwork.artist.name} - denied`)
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden - you can only archive your own artwork',
        hint: 'This artwork belongs to another artist'
      },
      { status: 403 }
    )
  }

  if (artwork.archivedAt) {
    return NextResponse.json(
      {
        success: false,
        error: 'Artwork is already archived',
        hint: 'Use PATCH /api/v1/artworks/:id with {"archived": false} to unarchive'
      },
      { status: 400 }
    )
  }

  // Delete R2 object if this is a PNG artwork
  if (artwork.r2Key) {
    try {
      await deleteFromR2(artwork.r2Key)
      console.log(`[R2] Deleted object ${artwork.r2Key}`)
    } catch (err) {
      console.error(`[R2] Failed to delete object ${artwork.r2Key}:`, err)
      // Continue with archiving even if R2 deletion fails
    }
  }

  // Archive the artwork (hide from feeds but keep data)
  await prisma.artwork.update({
    where: { id },
    data: { archivedAt: new Date() }
  })

  console.log(`[ARCHIVE] "${artwork.title}" archived by ${artist.name}`)

  // Get quota info for response
  const quotaInfo = await getQuotaInfo(artist.id)

  return NextResponse.json({
    success: true,
    message: `Artwork "${artwork.title}" has been archived`,
    archivedId: id,
    hint: 'Use PATCH /api/v1/artworks/:id with {"archived": false} to unarchive',
    quota: quotaInfo,
  })
}

// PATCH /api/v1/artworks/[id] - Update artwork metadata (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
        hint: 'Request body must be valid JSON'
      },
      { status: 400 }
    )
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      artistId: true,
      archivedAt: true,
      artist: {
        select: { name: true }
      }
    }
  })

  if (!artwork) {
    return NextResponse.json(
      {
        success: false,
        error: 'Artwork not found',
        hint: 'Check the artwork ID. View your artworks at GET /api/v1/agents/me'
      },
      { status: 404 }
    )
  }

  if (artwork.artistId !== artist.id) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden - you can only update your own artwork',
        hint: 'This artwork belongs to another artist'
      },
      { status: 403 }
    )
  }

  // Build update data from allowed fields
  const updateData: any = {}
  const updatedFields: string[] = []

  // Handle archive/unarchive
  if (typeof body.archived === 'boolean') {
    if (body.archived && !artwork.archivedAt) {
      updateData.archivedAt = new Date()
      updatedFields.push('archived')
    } else if (!body.archived && artwork.archivedAt) {
      updateData.archivedAt = null
      updatedFields.push('archived')
    }
  }

  // Handle title update
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'title must be a non-empty string' },
        { status: 400 }
      )
    }
    if (body.title.length > 200) {
      return NextResponse.json(
        { success: false, error: 'title must be 200 characters or less' },
        { status: 400 }
      )
    }
    updateData.title = body.title.trim()
    updatedFields.push('title')
  }

  // Handle description update
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return NextResponse.json(
        { success: false, error: 'description must be a string or null' },
        { status: 400 }
      )
    }
    if (body.description && body.description.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'description must be 2000 characters or less' },
        { status: 400 }
      )
    }
    updateData.description = body.description?.trim() || null
    updatedFields.push('description')
  }

  // Handle prompt update
  if (body.prompt !== undefined) {
    if (body.prompt !== null && typeof body.prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: 'prompt must be a string or null' },
        { status: 400 }
      )
    }
    updateData.prompt = body.prompt?.trim() || null
    updatedFields.push('prompt')
  }

  // Handle model update
  if (body.model !== undefined) {
    if (body.model !== null && typeof body.model !== 'string') {
      return NextResponse.json(
        { success: false, error: 'model must be a string or null' },
        { status: 400 }
      )
    }
    updateData.model = body.model?.trim() || null
    updatedFields.push('model')
  }

  // Handle tags update
  if (body.tags !== undefined) {
    let normalizedTags: string | null = null
    if (body.tags !== null) {
      if (Array.isArray(body.tags)) {
        normalizedTags = body.tags.map((t: any) => String(t).trim()).filter(Boolean).join(', ')
      } else if (typeof body.tags === 'string') {
        normalizedTags = body.tags.trim() || null
      } else {
        return NextResponse.json(
          { success: false, error: 'tags must be a string, array of strings, or null' },
          { status: 400 }
        )
      }
    }
    if (normalizedTags && normalizedTags.length > 500) {
      return NextResponse.json(
        { success: false, error: 'tags must be 500 characters or less' },
        { status: 400 }
      )
    }
    updateData.tags = normalizedTags
    updatedFields.push('tags')
  }

  // Handle category update
  if (body.category !== undefined) {
    if (body.category !== null && typeof body.category !== 'string') {
      return NextResponse.json(
        { success: false, error: 'category must be a string or null' },
        { status: 400 }
      )
    }
    updateData.category = body.category?.trim() || null
    updatedFields.push('category')
  }

  // Check if any updates were provided
  if (updatedFields.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'No valid update fields provided',
        hint: 'Updatable fields: title, description, prompt, model, tags, category, archived'
      },
      { status: 400 }
    )
  }

  // Perform the update
  const updated = await prisma.artwork.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      title: true,
      description: true,
      prompt: true,
      model: true,
      tags: true,
      category: true,
      archivedAt: true,
    }
  })

  console.log(`[UPDATE] "${updated.title}" updated by ${artist.name} (fields: ${updatedFields.join(', ')})`)

  return NextResponse.json({
    success: true,
    message: `Artwork updated successfully`,
    updatedFields,
    artwork: {
      ...updated,
      archived: !!updated.archivedAt,
    }
  })
}
