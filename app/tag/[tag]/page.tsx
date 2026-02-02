import { prisma } from '@/lib/prisma'
import { ArtworkCard } from '@/app/components/ArtworkCard'
import Link from 'next/link'

interface TagPageProps {
  params: Promise<{ tag: string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { tag } = await params
  const search = await searchParams
  const decodedTag = decodeURIComponent(tag)
  const sort = search.sort || 'recent'
  const page = parseInt(search.page || '1')
  const limit = 20
  
  let orderBy: any = { createdAt: 'desc' }
  if (sort === 'popular') {
    orderBy = { viewCount: 'desc' }
  }
  
  // Search for artworks containing this tag
  const [artworks, total] = await Promise.all([
    prisma.artwork.findMany({
      where: {
        isPublic: true,
        tags: {
          contains: decodedTag
        }
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
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
    prisma.artwork.count({
      where: {
        isPublic: true,
        tags: {
          contains: decodedTag
        }
      }
    })
  ])
  
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-zinc-400 hover:text-white text-sm mb-2 inline-block">
          ← Back to Gallery
        </Link>
        <h1 className="text-3xl font-bold">
          <span className="text-zinc-400">#</span>
          <span className="gradient-text">{decodedTag}</span>
        </h1>
        <p className="text-zinc-400 mt-2">
          {total} artwork{total !== 1 ? 's' : ''} tagged with "{decodedTag}"
        </p>
      </div>
      
      {/* Sort Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gallery-border">
        <a 
          href={`/tag/${encodeURIComponent(decodedTag)}`}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            sort === 'recent' 
              ? 'border-purple-500 text-white' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Recent
        </a>
        <a 
          href={`/tag/${encodeURIComponent(decodedTag)}?sort=popular`}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            sort === 'popular' 
              ? 'border-purple-500 text-white' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Popular
        </a>
      </div>
      
      {/* Artwork Grid */}
      {artworks.length > 0 ? (
        <div className="artwork-grid">
          {artworks.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gallery-card flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-2">No artwork found</h2>
          <p className="text-zinc-400">No artwork has been tagged with "{decodedTag}" yet.</p>
        </div>
      )}
      
      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <a
              href={`/tag/${encodeURIComponent(decodedTag)}?page=${page - 1}${sort !== 'recent' ? `&sort=${sort}` : ''}`}
              className="px-4 py-2 bg-gallery-card border border-gallery-border rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-zinc-400">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          {page < Math.ceil(total / limit) && (
            <a
              href={`/tag/${encodeURIComponent(decodedTag)}?page=${page + 1}${sort !== 'recent' ? `&sort=${sort}` : ''}`}
              className="px-4 py-2 bg-gallery-card border border-gallery-border rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  )
}
