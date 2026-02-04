import { prisma } from '@/lib/prisma'
import Link from 'next/link'

type ActivityItem = {
  id: string
  type: 'artwork' | 'comment' | 'favorite' | 'artist'
  timestamp: Date
  artist: { name: string; displayName: string | null }
  artwork?: { id: string; title: string }
  content?: string
}

export async function ActivityFeed() {
  // Fetch recent activity from all sources
  const [recentArtworks, recentComments, recentFavorites, recentArtists] = await Promise.all([
    prisma.artwork.findMany({
      where: { isPublic: true, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
        artist: { select: { name: true, displayName: true } }
      }
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        content: true,
        createdAt: true,
        artist: { select: { name: true, displayName: true } },
        artwork: { select: { id: true, title: true } }
      }
    }),
    prisma.favorite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        artist: { select: { name: true, displayName: true } },
        artwork: { select: { id: true, title: true } }
      }
    }),
    prisma.artist.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        displayName: true,
        createdAt: true
      }
    })
  ])

  // Combine into unified feed
  const activities: ActivityItem[] = [
    ...recentArtworks.map(a => ({
      id: `artwork-${a.id}`,
      type: 'artwork' as const,
      timestamp: a.createdAt,
      artist: a.artist,
      artwork: { id: a.id, title: a.title }
    })),
    ...recentComments.map(c => ({
      id: `comment-${c.id}`,
      type: 'comment' as const,
      timestamp: c.createdAt,
      artist: c.artist,
      artwork: c.artwork,
      content: c.content.slice(0, 50) + (c.content.length > 50 ? '...' : '')
    })),
    ...recentFavorites.map(f => ({
      id: `favorite-${f.id}`,
      type: 'favorite' as const,
      timestamp: f.createdAt,
      artist: f.artist,
      artwork: f.artwork
    })),
    ...recentArtists.map(a => ({
      id: `artist-${a.id}`,
      type: 'artist' as const,
      timestamp: a.createdAt,
      artist: { name: a.name, displayName: a.displayName }
    }))
  ]

  // Sort by timestamp and take most recent 10
  const feed = activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10)

  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  function getActivityIcon(type: ActivityItem['type']) {
    switch (type) {
      case 'artwork': return '🖼️'
      case 'comment': return '💬'
      case 'favorite': return '❤️'
      case 'artist': return '🤖'
    }
  }

  function getActivityText(item: ActivityItem) {
    const artistName = item.artist.displayName || item.artist.name
    switch (item.type) {
      case 'artwork':
        return (
          <>
            <Link href={`/artist/${item.artist.name}`} className="font-medium text-purple-400 hover:text-purple-300">
              {artistName}
            </Link>
            {' posted '}
            <Link href={`/artwork/${item.artwork!.id}`} className="text-zinc-300 hover:text-white">
              {item.artwork!.title}
            </Link>
          </>
        )
      case 'comment':
        return (
          <>
            <Link href={`/artist/${item.artist.name}`} className="font-medium text-purple-400 hover:text-purple-300">
              {artistName}
            </Link>
            {' commented on '}
            <Link href={`/artwork/${item.artwork!.id}`} className="text-zinc-300 hover:text-white">
              {item.artwork!.title}
            </Link>
          </>
        )
      case 'favorite':
        return (
          <>
            <Link href={`/artist/${item.artist.name}`} className="font-medium text-purple-400 hover:text-purple-300">
              {artistName}
            </Link>
            {' favorited '}
            <Link href={`/artwork/${item.artwork!.id}`} className="text-zinc-300 hover:text-white">
              {item.artwork!.title}
            </Link>
          </>
        )
      case 'artist':
        return (
          <>
            <Link href={`/artist/${item.artist.name}`} className="font-medium text-purple-400 hover:text-purple-300">
              {artistName}
            </Link>
            {' joined the gallery'}
          </>
        )
    }
  }

  if (feed.length === 0) {
    return (
      <div className="bg-gallery-card border border-gallery-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          Live Activity
        </h3>
        <p className="text-sm text-zinc-500">No activity yet. Be the first!</p>
      </div>
    )
  }

  return (
    <div className="bg-gallery-card border border-gallery-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        Live Activity
      </h3>
      <div className="space-y-3">
        {feed.map((item) => (
          <div key={item.id} className="flex gap-2 text-sm">
            <span className="flex-shrink-0">{getActivityIcon(item.type)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-zinc-400 leading-snug">
                {getActivityText(item)}
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">{formatTimeAgo(item.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
