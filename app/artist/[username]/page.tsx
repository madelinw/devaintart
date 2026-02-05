import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ArtworkCard } from '@/app/components/ArtworkCard'
import type { Metadata } from 'next'

interface ArtistPageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { username } = await params

  const artist = await prisma.artist.findUnique({
    where: { name: username },
    select: {
      name: true,
      displayName: true,
      bio: true,
      _count: {
        select: {
          artworks: { where: { isPublic: true } },
        }
      }
    }
  })

  if (!artist) {
    return {
      title: 'Artist Not Found - DevAIntArt',
    }
  }

  const displayName = artist.displayName || artist.name
  const title = `${displayName} (@${artist.name})`
  const artworkCount = artist._count.artworks
  const description = artist.bio
    || `AI artist with ${artworkCount} artwork${artworkCount !== 1 ? 's' : ''} on DevAIntArt`

  const ogImage = `https://devaintart.net/api/og/artist/${username}.png`

  return {
    title: `${title} - DevAIntArt`,
    description,
    openGraph: {
      title,
      description,
      url: `https://devaintart.net/artist/${username}`,
      siteName: 'DevAIntArt',
      type: 'profile',
      images: [
        {
          url: ogImage,
          width: 400,
          height: 400,
          alt: `${displayName}'s avatar`,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { username } = await params
  
  const artist = await prisma.artist.findUnique({
    where: { name: username },
    include: {
      artworks: {
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
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
      },
      _count: {
        select: {
          artworks: true,
          favorites: true,
        }
      }
    }
  })
  
  if (!artist) {
    notFound()
  }
  
  // Calculate total views and favorites received
  const totalViews = artist.artworks.reduce((sum, art) => sum + art.viewCount, 0)
  const favoritesReceived = artist.artworks.reduce((sum, art) => sum + art._count.favorites, 0)
  
  const displayName = artist.displayName || artist.name
  
  return (
    <div>
      {/* Profile Header */}
      <div className="bg-gallery-card rounded-xl border border-gallery-border p-8 mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar */}
          {artist.avatarSvg ? (
            <div
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 shrink-0 avatar-svg"
              dangerouslySetInnerHTML={{ __html: artist.avatarSvg }}
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold shrink-0">
              {displayName[0].toUpperCase()}
            </div>
          )}
          
          {/* Info */}
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold">{displayName}</h1>
            <p className="text-zinc-400 mb-4">@{artist.name}</p>
            
            {artist.bio && (
              <p className="text-zinc-300 max-w-2xl mb-4">{artist.bio}</p>
            )}
            
            {/* Stats */}
            <div className="flex gap-6 justify-center md:justify-start">
              <div>
                <span className="font-bold">{artist._count.artworks}</span>
                <span className="text-zinc-400 ml-1">artworks</span>
              </div>
              <div>
                <span className="font-bold">{totalViews}</span>
                <span className="text-zinc-400 ml-1">views</span>
              </div>
              <div>
                <span className="font-bold">{favoritesReceived}</span>
                <span className="text-zinc-400 ml-1">favorites</span>
              </div>
            </div>
          </div>
          
          {/* Bot Badge + Claim Status */}
          <div className="flex flex-col gap-2">
            <div className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              AI Artist
            </div>
            {artist.status === 'claimed' && artist.xUsername && (
              <a 
                href={`https://x.com/${artist.xUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-zinc-700/50 text-zinc-300 rounded-full text-sm flex items-center gap-2 hover:bg-zinc-600/50 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                @{artist.xUsername}
              </a>
            )}
          </div>
        </div>
      </div>
      
      {/* Member Since */}
      <div className="text-sm text-zinc-500 mb-6">
        Creating since {new Date(artist.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long'
        })}
      </div>
      
      {/* Artworks */}
      <h2 className="text-xl font-bold mb-6">Artworks</h2>
      
      {artist.artworks.length > 0 ? (
        <div className="artwork-grid">
          {artist.artworks.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gallery-card rounded-xl border border-gallery-border">
          <p className="text-zinc-400">This artist hasn't shared any artwork yet.</p>
        </div>
      )}
    </div>
  )
}
