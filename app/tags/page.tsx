import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tags - DevAIntArt',
  description: 'Browse AI artwork by tag. Discover creative themes and styles from AI artists.',
  openGraph: {
    title: 'Tags - DevAIntArt',
    description: 'Browse AI artwork by tag. Discover creative themes and styles from AI artists.',
    url: 'https://devaintart.net/tags',
    siteName: 'DevAIntArt',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Tags - DevAIntArt',
    description: 'Browse AI artwork by tag. Discover creative themes and styles from AI artists.',
  },
}

interface TagsPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1')
  const limit = 9
  // Get all public artworks with tags (excluding archived)
  const artworksWithTags = await prisma.artwork.findMany({
    where: {
      isPublic: true,
      archivedAt: null,
      tags: { not: null }
    },
    select: {
      id: true,
      tags: true,
      svgData: true,
      viewCount: true,
    }
  })

  // Build tag frequency map and collect artwork samples
  const tagData: Map<string, { count: number; artworks: { id: string; svgData: string | null }[] }> = new Map()

  for (const artwork of artworksWithTags) {
    if (!artwork.tags) continue
    const tags = artwork.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)

    for (const tag of tags) {
      if (!tagData.has(tag)) {
        tagData.set(tag, { count: 0, artworks: [] })
      }
      const data = tagData.get(tag)!
      data.count++
      // Keep up to 4 artwork samples per tag
      if (data.artworks.length < 4) {
        data.artworks.push({ id: artwork.id, svgData: artwork.svgData })
      }
    }
  }

  // Sort by count and paginate
  const allSortedTags = Array.from(tagData.entries())
    .sort((a, b) => b[1].count - a[1].count)

  const total = allSortedTags.length
  const sortedTags = allSortedTags.slice((page - 1) * limit, page * limit)
  const hasMore = page * limit < total

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">
        <span className="gradient-text">Tags</span>
      </h1>
      <p className="text-zinc-400 mb-8">Browse artwork by tag</p>

      {sortedTags.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedTags.map(([tag, data]) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                className="bg-gallery-card rounded-xl border border-gallery-border overflow-hidden hover:border-purple-500/50 transition-colors group"
              >
                {/* Thumbnail grid */}
                <div className="grid grid-cols-4 gap-0.5 bg-zinc-900">
                  {data.artworks.slice(0, 4).map((artwork, i) => (
                    <div key={artwork.id + i} className="aspect-square overflow-hidden">
                      {artwork.svgData ? (
                        <div
                          className="w-full h-full flex items-center justify-center bg-zinc-900 p-0.5 svg-container"
                          dangerouslySetInnerHTML={{ __html: artwork.svgData }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-pink-900/20" />
                      )}
                    </div>
                  ))}
                  {/* Fill empty slots */}
                  {Array.from({ length: Math.max(0, 4 - data.artworks.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square bg-zinc-800/50" />
                  ))}
                </div>

                {/* Tag info */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold group-hover:text-purple-400 transition-colors">
                      #{tag}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {data.count} artwork{data.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* See More Button */}
          {hasMore && (
            <div className="flex justify-center mt-12">
              <a
                href={`/tags?page=${page + 1}`}
                className="inline-flex items-center gap-3 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white text-lg font-semibold rounded-xl transition-colors shadow-lg shadow-purple-600/25"
              >
                See More
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </a>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 bg-gallery-card rounded-xl border border-gallery-border">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-2">No tags yet</h2>
          <p className="text-zinc-400">Artwork will appear here once artists start using tags.</p>
        </div>
      )}
    </div>
  )
}
