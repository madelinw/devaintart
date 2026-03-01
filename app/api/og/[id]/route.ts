import { prisma } from '@/lib/prisma'
import sharp from 'sharp'
import { NextRequest, NextResponse } from 'next/server'
import { downloadFromR2, getOgR2Key, objectExistsInR2, uploadToR2 } from '@/lib/r2'

function logOg(event: string, details: Record<string, unknown>) {
  console.log(
    `[OG] ${JSON.stringify({
      event,
      ts: new Date().toISOString(),
      ...details,
    })}`
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let { id } = await params

  // Strip .png extension if present (allows /api/og/abc123.png URLs)
  if (id.endsWith('.png')) {
    id = id.slice(0, -4)
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id },
    select: {
      id: true,
      svgData: true,
      imageUrl: true,
      contentType: true,
      title: true,
      updatedAt: true,
    }
  })

  if (!artwork) {
    return new NextResponse('Not found', { status: 404 })
  }

  // For PNG artworks, redirect to the R2 URL
  if (artwork.contentType === 'png' && artwork.imageUrl) {
    try {
      const resp = await fetch(artwork.imageUrl)
      if (!resp.ok) {
        return new NextResponse('Not found', { status: 404 })
      }
      const buffer = Buffer.from(await resp.arrayBuffer())
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return new NextResponse('Not found', { status: 404 })
    }
  }

  // For SVG artworks, convert to PNG
  if (!artwork.svgData) {
    return new NextResponse('Not found', { status: 404 })
  }

  const cacheKey = getOgR2Key(artwork.id, artwork.updatedAt.getTime())

  try {
    const exists = await objectExistsInR2(cacheKey)
    if (exists) {
      try {
        const cachedBuffer = await downloadFromR2(cacheKey)
        logOg('cache_hit', { artworkId: artwork.id, cacheKey, bytes: cachedBuffer.length })
        return new NextResponse(new Uint8Array(cachedBuffer), {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      } catch (error) {
        console.error('OG cache read failed, falling back to render:', error)
        logOg('cache_read_error', { artworkId: artwork.id, cacheKey })
      }
    } else {
      logOg('cache_miss', { artworkId: artwork.id, cacheKey })
    }
  } catch (error) {
    console.error('OG cache lookup failed, falling back to render:', error)
    logOg('cache_lookup_error', { artworkId: artwork.id, cacheKey })
  }

  try {
    // Normalize the SVG to render at 1200x1200
    let svg = artwork.svgData

    // Ensure SVG has proper dimensions for OG image
    svg = svg.replace(
      /<svg([^>]*)>/,
      (match, attrs) => {
        // Remove existing width/height but keep viewBox
        let newAttrs = attrs
          .replace(/\s*width\s*=\s*["'][^"']*["']/gi, '')
          .replace(/\s*height\s*=\s*["'][^"']*["']/gi, '')
        return `<svg${newAttrs} width="1200" height="1200">`
      }
    )

    // Convert SVG to PNG using sharp
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(1200, 1200, {
        fit: 'contain',
        background: { r: 24, g: 24, b: 27, alpha: 1 } // zinc-900
      })
      .png()
      .toBuffer()

    try {
      await uploadToR2(cacheKey, pngBuffer)
      logOg('rendered_cached', {
        artworkId: artwork.id,
        cacheKey,
        bytes: pngBuffer.length,
      })
      return new NextResponse(new Uint8Array(pngBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (error) {
      // Fall back to direct response if cache upload fails.
      console.error('OG cache upload failed, returning direct image:', error)
      logOg('cache_upload_error', { artworkId: artwork.id, cacheKey })
      return new NextResponse(new Uint8Array(pngBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
  } catch (error) {
    console.error('Error rendering SVG to PNG:', error)
    logOg('render_error', { artworkId: artwork.id, cacheKey })
    return new NextResponse('Error rendering image', { status: 500 })
  }
}
