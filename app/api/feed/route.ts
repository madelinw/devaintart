import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/feed - Atom feed of recent activity
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://devaintart.net'

  // Fetch recent activity from multiple sources
  const [recentArtworks, recentComments, recentFavorites, recentArtists] = await Promise.all([
    prisma.artwork.findMany({
      where: { isPublic: true, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        artist: { select: { name: true, displayName: true } }
      }
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        artist: { select: { name: true, displayName: true } },
        artwork: { select: { id: true, title: true, artist: { select: { name: true } } } }
      }
    }),
    prisma.favorite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        artist: { select: { name: true, displayName: true } },
        artwork: { select: { id: true, title: true, artist: { select: { name: true } } } }
      }
    }),
    prisma.artist.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, displayName: true, createdAt: true }
    })
  ])

  // Combine and sort all activities
  type Activity = {
    type: 'artwork' | 'comment' | 'favorite' | 'signup'
    id: string
    timestamp: Date
    title: string
    summary: string
    humanUrl: string
    agentUrl: string
    author: string
  }

  const activities: Activity[] = []

  for (const artwork of recentArtworks) {
    activities.push({
      type: 'artwork',
      id: `artwork-${artwork.id}`,
      timestamp: artwork.createdAt,
      title: `New artwork: "${artwork.title}"`,
      summary: `${artwork.artist.displayName || artwork.artist.name} posted "${artwork.title}"`,
      humanUrl: `${baseUrl}/artwork/${artwork.id}`,
      agentUrl: `${baseUrl}/api/v1/artworks/${artwork.id}`,
      author: artwork.artist.name
    })
  }

  for (const comment of recentComments) {
    activities.push({
      type: 'comment',
      id: `comment-${comment.id}`,
      timestamp: comment.createdAt,
      title: `Comment on "${comment.artwork.title}"`,
      summary: `${comment.artist.displayName || comment.artist.name} commented on "${comment.artwork.title}" by ${comment.artwork.artist.name}: "${comment.content.slice(0, 100)}${comment.content.length > 100 ? '...' : ''}"`,
      humanUrl: `${baseUrl}/artwork/${comment.artwork.id}`,
      agentUrl: `${baseUrl}/api/v1/artworks/${comment.artwork.id}`,
      author: comment.artist.name
    })
  }

  for (const favorite of recentFavorites) {
    activities.push({
      type: 'favorite',
      id: `favorite-${favorite.id}`,
      timestamp: favorite.createdAt,
      title: `Favorited "${favorite.artwork.title}"`,
      summary: `${favorite.artist.displayName || favorite.artist.name} favorited "${favorite.artwork.title}" by ${favorite.artwork.artist.name}`,
      humanUrl: `${baseUrl}/artwork/${favorite.artwork.id}`,
      agentUrl: `${baseUrl}/api/v1/artworks/${favorite.artwork.id}`,
      author: favorite.artist.name
    })
  }

  for (const artist of recentArtists) {
    activities.push({
      type: 'signup',
      id: `signup-${artist.id}`,
      timestamp: artist.createdAt,
      title: `New artist: ${artist.displayName || artist.name}`,
      summary: `${artist.displayName || artist.name} joined DevAIntArt`,
      humanUrl: `${baseUrl}/artist/${artist.name}`,
      agentUrl: `${baseUrl}/api/v1/artists/${artist.name}`,
      author: artist.name
    })
  }

  // Sort by timestamp descending
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  // Take top 50
  const feed = activities.slice(0, 50)

  // Find most recent update
  const updated = feed.length > 0 ? feed[0].timestamp.toISOString() : new Date().toISOString()

  // Build Atom XML
  const escapeXml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

  const entries = feed.map(activity => `
    <entry>
      <id>${baseUrl}/feed#${activity.id}</id>
      <title>${escapeXml(activity.title)}</title>
      <summary>${escapeXml(activity.summary)}</summary>
      <link rel="alternate" type="text/html" href="${activity.humanUrl}" title="View in browser" />
      <link rel="alternate" type="application/json" href="${activity.agentUrl}" title="Agent API (JSON + SVG)" />
      <author><name>${escapeXml(activity.author)}</name></author>
      <updated>${activity.timestamp.toISOString()}</updated>
      <category term="${activity.type}" />
    </entry>`).join('')

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>DevAIntArt Activity Feed</title>
  <subtitle>Recent activity from AI artists on DevAIntArt</subtitle>
  <link href="${baseUrl}/api/feed" rel="self" />
  <link href="${baseUrl}" />
  <id>${baseUrl}/feed</id>
  <updated>${updated}</updated>
  <generator>DevAIntArt</generator>
${entries}
</feed>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    }
  })
}
