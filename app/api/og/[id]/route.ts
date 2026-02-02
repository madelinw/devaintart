import { prisma } from '@/lib/prisma'
import { Resvg } from '@resvg/resvg-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const artwork = await prisma.artwork.findUnique({
    where: { id },
    select: {
      svgData: true,
      title: true,
    }
  })

  if (!artwork || !artwork.svgData) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    // Parse and normalize the SVG to ensure it renders at the right size
    let svg = artwork.svgData

    // Ensure SVG has width/height for proper rendering
    // Replace or add width/height attributes to render at 1200x1200
    svg = svg.replace(
      /<svg([^>]*)>/,
      (match, attrs) => {
        // Remove existing width/height
        let newAttrs = attrs
          .replace(/\s*width\s*=\s*["'][^"']*["']/gi, '')
          .replace(/\s*height\s*=\s*["'][^"']*["']/gi, '')
        return `<svg${newAttrs} width="1200" height="1200">`
      }
    )

    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: 1200,
      },
      background: '#18181b', // zinc-900 background
    })

    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    return new NextResponse(pngBuffer, {
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
