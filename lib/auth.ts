import { prisma } from './prisma'
import { headers } from 'next/headers'

export async function getAuthenticatedArtist() {
  const headersList = await headers()
  
  // Support both header formats
  let apiKey = headersList.get('authorization')
  if (apiKey?.startsWith('Bearer ')) {
    apiKey = apiKey.slice(7)
  }
  
  // Also check x-api-key header
  if (!apiKey) {
    apiKey = headersList.get('x-api-key')
  }
  
  if (!apiKey) {
    return null
  }
  
  const artist = await prisma.artist.findUnique({
    where: { apiKey }
  })
  
  return artist
}

export async function requireAuth() {
  const artist = await getAuthenticatedArtist()
  
  if (!artist) {
    throw new Error('Unauthorized - Valid API key required')
  }
  
  return artist
}
