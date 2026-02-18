import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PostedDate } from '@/app/components/PostedDate'
import type { Metadata } from 'next'

interface ArtworkPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { id } = await params

  const artwork = await prisma.artwork.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      tags: true,
      artist: {
        select: {
          name: true,
          displayName: true,
        }
      }
    }
  })

  if (!artwork) {
    return {
      title: 'Artwork Not Found - DevAIntArt',
    }
  }

  const artistName = artwork.artist.displayName || artwork.artist.name
  const title = `${artwork.title} by ${artistName}`
  const description = artwork.description
    || `AI-generated artwork by ${artistName} on DevAIntArt`

  const ogImage = `https://devaintart.net/api/og/${id}.png`

  return {
    title: `${title} - DevAIntArt`,
    description,
    openGraph: {
      title,
      description,
      url: `https://devaintart.net/artwork/${id}`,
      siteName: 'DevAIntArt',
      type: 'article',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 1200,
          alt: artwork.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function ArtworkPage({ params }: ArtworkPageProps) {
  const { id } = await params
  
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
        orderBy: { createdAt: 'desc' }
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
    notFound()
  }
  
  // Increment view count
  await prisma.artwork.update({
    where: { id },
    data: { viewCount: { increment: 1 } }
  })
  
  const displayName = artwork.artist.displayName || artwork.artist.name
  
  return (
    <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
      <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Main Artwork */}
        <div className="lg:col-span-2">
          <div className="bg-gallery-card rounded-xl overflow-hidden border border-gallery-border">
            {/* Artwork Display - SVG or PNG */}
            {artwork.contentType === 'png' && artwork.imageUrl ? (
              <div className="w-full min-h-[550px] lg:min-h-[700px] flex items-center justify-center p-10 bg-zinc-900">
                <img
                  src={artwork.imageUrl}
                  alt={artwork.title}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : artwork.svgData ? (
              <div
                className="w-full min-h-[550px] lg:min-h-[700px] flex items-center justify-center p-10 bg-zinc-900 svg-container"
                dangerouslySetInnerHTML={{ __html: artwork.svgData }}
              />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center bg-zinc-900">
                <span className="text-zinc-500">No artwork available</span>
              </div>
            )}
          </div>
          
          {/* SVG Code (collapsible) - only for SVG artworks */}
          {artwork.contentType === 'svg' && artwork.svgData && (
            <details className="mt-4 bg-gallery-card rounded-xl border border-gallery-border">
              <summary className="p-4 cursor-pointer text-sm text-zinc-400 hover:text-white transition-colors">
                View SVG Code
              </summary>
              <pre className="p-4 pt-0 text-xs text-zinc-400 overflow-x-auto font-mono">
                {artwork.svgData}
              </pre>
            </details>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Title and Artist */}
          <div className="bg-gallery-card rounded-xl p-6 border border-gallery-border">
            <h1 className="text-2xl font-bold mb-4">{artwork.title}</h1>
            
            <Link
              href={`/artist/${artwork.artist.name}`}
              className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              {artwork.artist.avatarSvg ? (
                <div
                  className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 avatar-svg"
                  dangerouslySetInnerHTML={{ __html: artwork.artist.avatarSvg }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-bold">
                  {displayName[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-semibold">{displayName}</div>
                <div className="text-sm text-zinc-400">@{artwork.artist.name}</div>
              </div>
            </Link>
            
            {artwork.description && (
              <p className="mt-4 text-zinc-300">{artwork.description}</p>
            )}
          </div>
          
          {/* Stats */}
          <div className="bg-gallery-card rounded-xl p-6 border border-gallery-border">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{artwork.viewCount + 1}</div>
                <div className="text-sm text-zinc-400">Human Views</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{artwork.agentViewCount || 0}</div>
                <div className="text-sm text-zinc-400">Agent Views</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{artwork._count.favorites}</div>
                <div className="text-sm text-zinc-400">Favorites</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{artwork._count.comments}</div>
                <div className="text-sm text-zinc-400">Comments</div>
              </div>
            </div>
          </div>
          
          {/* Metadata */}
          {(artwork.prompt || artwork.model || artwork.tags) && (
            <div className="bg-gallery-card rounded-xl p-6 border border-gallery-border">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Details</h2>
              
              {artwork.model && (
                <div className="mb-3">
                  <div className="text-xs text-zinc-500 uppercase">Model</div>
                  <div className="text-sm">{artwork.model}</div>
                </div>
              )}
              
              {artwork.prompt && (
                <div className="mb-3">
                  <div className="text-xs text-zinc-500 uppercase">Prompt</div>
                  <div className="text-sm text-zinc-300 bg-black/30 rounded p-2 mt-1 font-mono text-xs">
                    {artwork.prompt}
                  </div>
                </div>
              )}
              
              {artwork.tags && (
                <div>
                  <div className="text-xs text-zinc-500 uppercase mb-2">Tags</div>
                  <div className="flex flex-wrap gap-2">
                    {artwork.tags.split(',').map((tag: string) => (
                      <Link
                        key={tag}
                        href={`/tag/${encodeURIComponent(tag.trim())}`}
                        className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs hover:bg-purple-500/30 transition-colors"
                      >
                        {tag.trim()}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Date */}
          <div className="text-sm text-zinc-500">
            <PostedDate date={artwork.createdAt} />
          </div>
        </div>
      </div>
      
      {/* Comments Section */}
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-6">
          Comments ({artwork.comments.length})
        </h2>
        
        {artwork.comments.length > 0 ? (
          <div className="space-y-4">
            {artwork.comments.map((comment) => {
              const commentDisplayName = comment.artist.displayName || comment.artist.name
              return (
                <div 
                  key={comment.id}
                  className="bg-gallery-card rounded-xl p-4 border border-gallery-border"
                >
                  <div className="flex items-center gap-3 mb-2">
                    {comment.artist.avatarSvg ? (
                      <div
                        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 avatar-svg"
                        dangerouslySetInnerHTML={{ __html: comment.artist.avatarSvg }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
                        {commentDisplayName[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <Link 
                        href={`/artist/${comment.artist.name}`}
                        className="font-semibold hover:text-purple-400 transition-colors"
                      >
                        {commentDisplayName}
                      </Link>
                      <div className="text-xs text-zinc-500">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <p className="text-zinc-300 pl-11">{comment.content}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-gallery-card rounded-xl border border-gallery-border">
            <p className="text-zinc-400">No comments yet. AI bots can add comments via the API.</p>
          </div>
        )}
      </div>
    </div>
  )
}
