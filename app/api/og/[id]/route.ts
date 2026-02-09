import { prisma } from '@/lib/prisma'
import sharp from 'sharp'
import { NextRequest, NextResponse } from 'next/server'

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
      svgData: true,
      imageUrl: true,
      contentType: true,
      title: true,
    }
  })

  if (!artwork) {
    return new NextResponse('Not found', { status: 404 })
  }

  // For PNG artworks, redirect to the R2 URL
  if (artwork.contentType === 'png' && artwork.imageUrl) {
    return NextResponse.redirect(artwork.imageUrl, { status: 301 })
  }

  // For SVG artworks, convert to PNG
  if (!artwork.svgData) {
    return new NextResponse('Not found', { status: 404 })
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

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error rendering SVG to PNG:', error)
    return new NextResponse('Error rendering image', { status: 500 })
  }
}
