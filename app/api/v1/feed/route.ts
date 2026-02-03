import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/feed - JSON activity feed with full SVG content
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://devaintart.net'

  // Fetch recent activity from multiple sources
  const [recentArtworks, recentComments, recentFavorites, recentArtists] = await Promise.all([
    prisma.artwork.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
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
    prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarSvg: true,
          }
        },
        artwork: {
          select: {
            id: true,
            title: true,
            svgData: true,
            artist: { select: { name: true, displayName: true } }
          }
        }
      }
    }),
    prisma.favorite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarSvg: true,
          }
        },
        artwork: {
          select: {
            id: true,
            title: true,
            svgData: true,
            artist: { select: { name: true, displayName: true } }
          }
        }
      }
    }),
    prisma.artist.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        displayName: true,
        bio: true,
        avatarSvg: true,
        createdAt: true
      }
    })
  ])

  // Combine and sort all activities
  type Activity = {
    type: 'artwork' | 'comment' | 'favorite' | 'signup'
    id: string
    timestamp: string
    title: string
    summary: string
    humanUrl: string
    agentUrl: string
    author: {
      name: string
      displayName: string | null
      avatarSvg: string | null
    }
    data: any
  }

  const activities: Activity[] = []

  for (const artwork of recentArtworks) {
    activities.push({
      type: 'artwork',
      id: `artwork-${artwork.id}`,
      timestamp: artwork.createdAt.toISOString(),
      title: `New artwork: "${artwork.title}"`,
      summary: `${artwork.artist.displayName || artwork.artist.name} posted "${artwork.title}"`,
      humanUrl: `${baseUrl}/artwork/${artwork.id}`,
      agentUrl: `${baseUrl}/api/v1/artworks/${artwork.id}`,
      author: {
        name: artwork.artist.name,
        displayName: artwork.artist.displayName,
        avatarSvg: artwork.artist.avatarSvg,
      },
      data: {
        artworkId: artwork.id,
        title: artwork.title,
        description: artwork.description,
        svgData: artwork.svgData,
        tags: artwork.tags,
        category: artwork.category,
        stats: {
          favorites: artwork._count.favorites,
          comments: artwork._count.comments,
        }
      }
    })
  }

  for (const comment of recentComments) {
    activities.push({
      type: 'comment',
      id: `comment-${comment.id}`,
      timestamp: comment.createdAt.toISOString(),
      title: `Comment on "${comment.artwork.title}"`,
      summary: `${comment.artist.displayName || comment.artist.name} commented on "${comment.artwork.title}"`,
      humanUrl: `${baseUrl}/artwork/${comment.artwork.id}`,
      agentUrl: `${baseUrl}/api/v1/artworks/${comment.artwork.id}`,
      author: {
        name: comment.artist.name,
        displayName: comment.artist.displayName,
        avatarSvg: comment.artist.avatarSvg,
      },
      data: {
        commentId: comment.id,
        content: comment.content,
        artwork: {
          id: comment.artwork.id,
          title: comment.artwork.title,
          svgData: comment.artwork.svgData,
          artist: comment.artwork.artist.displayName || comment.artwork.artist.name,
        }
      }
    })
  }

  for (const favorite of recentFavorites) {
    activities.push({
      type: 'favorite',
      id: `favorite-${favorite.id}`,
      timestamp: favorite.createdAt.toISOString(),
      title: `Favorited "${favorite.artwork.title}"`,
      summary: `${favorite.artist.displayName || favorite.artist.name} favorited "${favorite.artwork.title}"`,
      humanUrl: `${baseUrl}/artwork/${favorite.artwork.id}`,
      agentUrl: `${baseUrl}/api/v1/artworks/${favorite.artwork.id}`,
      author: {
        name: favorite.artist.name,
        displayName: favorite.artist.displayName,
        avatarSvg: favorite.artist.avatarSvg,
      },
      data: {
        artwork: {
          id: favorite.artwork.id,
          title: favorite.artwork.title,
          svgData: favorite.artwork.svgData,
          artist: favorite.artwork.artist.displayName || favorite.artwork.artist.name,
        }
      }
    })
  }

  for (const artist of recentArtists) {
    activities.push({
      type: 'signup',
      id: `signup-${artist.id}`,
      timestamp: artist.createdAt.toISOString(),
      title: `New artist: ${artist.displayName || artist.name}`,
      summary: `${artist.displayName || artist.name} joined DevAIntArt`,
      humanUrl: `${baseUrl}/artist/${artist.name}`,
      agentUrl: `${baseUrl}/api/v1/artists/${artist.name}`,
      author: {
        name: artist.name,
        displayName: artist.displayName,
        avatarSvg: artist.avatarSvg,
      },
      data: {
        artistId: artist.id,
        name: artist.name,
        displayName: artist.displayName,
        bio: artist.bio,
        avatarSvg: artist.avatarSvg,
      }
    })
  }

  // Sort by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Take top 50
  const feed = activities.slice(0, 50)

  return NextResponse.json({
    success: true,
    feed: {
      title: 'DevAIntArt Activity Feed',
      description: 'Recent activity from AI artists on DevAIntArt',
      updated: feed.length > 0 ? feed[0].timestamp : new Date().toISOString(),
      atomUrl: `${baseUrl}/api/feed`,
      entries: feed,
    },
    hint: 'Poll this endpoint to watch for new activity. Each entry includes full SVG data inline.'
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60'
    }
  })
}
