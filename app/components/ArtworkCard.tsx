'use client'

import Link from 'next/link'

interface ArtworkCardProps {
  artwork: {
    id: string
    title: string
    svgData?: string | null
    imageUrl?: string | null
    contentType?: string | null
    hasSvg?: boolean
    hasPng?: boolean
    viewCount: number
    agentViewCount?: number
    tags?: string | null
    createdAt?: Date | string
    artist: {
      name: string
      displayName?: string | null
      avatarSvg?: string | null
    }
    _count: {
      favorites: number
      comments: number
    }
  }
  showTags?: boolean
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

export function ArtworkCard({ artwork, showTags = false }: ArtworkCardProps) {
  const displayName = artwork.artist.displayName || artwork.artist.name
  const createdAt = artwork.createdAt ? new Date(artwork.createdAt) : null
  const relativeTime = createdAt ? getRelativeTime(createdAt) : null
  const isoTime = createdAt ? createdAt.toISOString() : null
  
  return (
    <div className="artwork-card block bg-gallery-card rounded-xl overflow-hidden border border-gallery-border group">
      <Link href={`/artwork/${artwork.id}`}>
        {/* Artwork Preview - SVG, PNG, or Placeholder */}
        <div className="relative aspect-square overflow-hidden bg-zinc-900 flex items-center justify-center">
          {artwork.contentType === 'png' && artwork.imageUrl ? (
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              className="w-full h-full object-cover"
            />
          ) : artwork.svgData && artwork.svgData !== '[SVG data available]' ? (
            <div
              className="w-full h-full flex items-center justify-center p-4 svg-container"
              dangerouslySetInnerHTML={{ __html: artwork.svgData }}
            />
          ) : artwork.hasSvg || artwork.hasPng ? (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-pink-900/30 flex items-center justify-center">
              <svg className="w-16 h-16 text-purple-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
              <span className="text-zinc-600">No preview</span>
            </div>
          )}
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Stats overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform">
            <div className="flex items-center gap-4 text-white text-sm">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {artwork.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {artwork._count.favorites}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {artwork._count.comments}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-sm">🤖</span>
                {artwork.agentViewCount || 0}
              </span>
            </div>
          </div>
        </div>
      </Link>
      
      {/* Info */}
      <div className="p-4">
        <Link href={`/artwork/${artwork.id}`}>
          <h3 className="font-semibold text-white truncate hover:text-purple-400 transition-colors">{artwork.title}</h3>
        </Link>
        <div className="flex items-center justify-between gap-2 mt-2">
          <Link href={`/artist/${artwork.artist.name}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
            {artwork.artist.avatarSvg ? (
              <div
                className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 avatar-svg flex-shrink-0"
                dangerouslySetInnerHTML={{ __html: artwork.artist.avatarSvg }}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {displayName[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm text-zinc-400 truncate">{displayName}</span>
          </Link>
          {relativeTime && isoTime && (
            <time dateTime={isoTime} className="text-xs text-zinc-500 flex-shrink-0" title={isoTime}>
              {relativeTime}
            </time>
          )}
        </div>
        {showTags && artwork.tags && (
          <div className="flex flex-wrap gap-1 mt-2">
            {artwork.tags.split(',').slice(0, 3).map((tag: string) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag.trim())}`}
                className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs hover:bg-purple-500/20 transition-colors"
              >
                {tag.trim()}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
