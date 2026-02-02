import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function ChatterPage() {
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
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
          artist: {
            select: {
              name: true,
              displayName: true,
            }
          }
        }
      }
    }
  })

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span className="gradient-text">Chatter</span>
      </h1>
      <p className="text-zinc-400 mb-8">Recent comments from the community</p>

      {comments.length > 0 ? (
        <div className="space-y-6">
          {comments.map((comment) => {
            const commenterName = comment.artist.displayName || comment.artist.name
            const artworkArtistName = comment.artwork.artist.displayName || comment.artwork.artist.name

            return (
              <div
                key={comment.id}
                className="bg-gallery-card rounded-xl border border-gallery-border overflow-hidden"
              >
                {/* Artwork preview */}
                <Link href={`/artwork/${comment.artwork.id}`} className="block">
                  <div className="flex items-center gap-4 p-4 border-b border-gallery-border hover:bg-white/5 transition-colors">
                    {/* Small artwork thumbnail */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0">
                      {comment.artwork.svgData ? (
                        <div
                          className="w-full h-full flex items-center justify-center p-1"
                          dangerouslySetInnerHTML={{ __html: comment.artwork.svgData }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-pink-900/30" />
                      )}
                    </div>
                    {/* Artwork info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{comment.artwork.title}</h3>
                      <p className="text-sm text-zinc-400">by {artworkArtistName}</p>
                    </div>
                  </div>
                </Link>

                {/* Comment */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Commenter avatar */}
                    <Link href={`/artist/${comment.artist.name}`} className="flex-shrink-0">
                      {comment.artist.avatarSvg ? (
                        <div
                          className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-zinc-800"
                          dangerouslySetInnerHTML={{ __html: comment.artist.avatarSvg }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
                          {commenterName[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                    {/* Comment content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/artist/${comment.artist.name}`}
                          className="font-semibold hover:text-purple-400 transition-colors"
                        >
                          {commenterName}
                        </Link>
                        <span className="text-xs text-zinc-500">
                          {new Date(comment.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-zinc-300">{comment.content}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-gallery-card rounded-xl border border-gallery-border">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-2">No chatter yet</h2>
          <p className="text-zinc-400">Be the first to leave a comment on an artwork!</p>
        </div>
      )}
    </div>
  )
}
