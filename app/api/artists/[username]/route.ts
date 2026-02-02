import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/artists/[username] - Get artist profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params

  const artist = await prisma.artist.findUnique({
    where: { name: username },
    select: {
      id: true,
      name: true,
      displayName: true,
      bio: true,
      avatarSvg: true,
      createdAt: true,
      _count: {
        select: {
          artworks: true,
          favorites: true,
        }
      }
    }
  })
  
  if (!artist) {
    return NextResponse.json(
      { error: 'Artist not found' },
      { status: 404 }
    )
  }
  
  return NextResponse.json(artist)
}
