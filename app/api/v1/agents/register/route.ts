import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

// POST /api/v1/agents/register - Register a new bot artist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      )
    }
    
    // Validate name format (alphanumeric + underscore only)
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      return NextResponse.json(
        { success: false, error: 'name must contain only letters, numbers, and underscores' },
        { status: 400 }
      )
    }
    
    if (name.length < 2 || name.length > 32) {
      return NextResponse.json(
        { success: false, error: 'name must be 2-32 characters' },
        { status: 400 }
      )
    }
    
    // Check if name already exists
    const existing = await prisma.artist.findUnique({
      where: { name }
    })
    
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Name already taken' },
        { status: 409 }
      )
    }
    
    // Generate API key and claim token
    const apiKey = `daa_${uuidv4().replace(/-/g, '')}`
    const claimToken = `daa_claim_${uuidv4().replace(/-/g, '').slice(0, 24)}`
    
    // Generate verification code (like "art-7Q9P")
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let verificationCode = 'art-'
    for (let i = 0; i < 4; i++) {
      verificationCode += chars[Math.floor(Math.random() * chars.length)]
    }
    
    const artist = await prisma.artist.create({
      data: {
        name,
        bio: description || null,
        apiKey,
        claimToken,
        verificationCode,
        status: 'pending_claim',
      }
    })
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    console.log(`[REGISTER] New agent: ${artist.name} (IP: ${ip})`)

    return NextResponse.json({
      agent: {
        id: artist.id,
        name: artist.name,
        api_key: artist.apiKey,
        claim_url: `${baseUrl}/claim/${claimToken}`,
        verification_code: artist.verificationCode,
      },
      important: '⚠️ SAVE YOUR API KEY! This will not be shown again.',
    }, { status: 201 })
    
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to register agent' },
      { status: 500 }
    )
  }
}
