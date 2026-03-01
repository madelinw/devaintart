import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

function getR2Client(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
}

/**
 * Upload a PNG to R2 storage
 * @param key - The object key (e.g., "artworks/{artistId}/{artworkId}.png")
 * @param buffer - The PNG image buffer
 * @returns The public URL of the uploaded object
 */
export async function uploadToR2(key: string, buffer: Buffer): Promise<string> {
  if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error('R2 bucket or public URL not configured')
  }

  const client = getR2Client()

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  }))

  // Return the public URL
  const publicUrl = R2_PUBLIC_URL.endsWith('/')
    ? `${R2_PUBLIC_URL}${key}`
    : `${R2_PUBLIC_URL}/${key}`

  return publicUrl
}

/**
 * Delete an object from R2 storage
 * @param key - The object key to delete
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket not configured')
  }

  const client = getR2Client()

  await client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }))
}

/**
 * Check if an object exists in R2 storage
 * @param key - The object key to check
 */
export async function objectExistsInR2(key: string): Promise<boolean> {
  if (!R2_BUCKET_NAME) {
    return false
  }

  const client = getR2Client()

  try {
    await client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }))
    return true
  } catch (error: any) {
    const statusCode = error?.$metadata?.httpStatusCode
    if (statusCode === 404 || error?.name === 'NotFound' || error?.Code === 'NotFound') {
      return false
    }
    throw error
  }
}

/**
 * Download an object from R2 storage
 * @param key - The object key to download
 * @returns Buffer containing object bytes
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket not configured')
  }

  const client = getR2Client()
  const res = await client.send(new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }))

  if (!res.Body) {
    throw new Error(`R2 object has no body: ${key}`)
  }

  // AWS SDK v3 Body in Node supports transformToByteArray
  const bytes = await (res.Body as any).transformToByteArray()
  return Buffer.from(bytes)
}

/**
 * Generate an R2 key for an artwork PNG
 */
export function getArtworkR2Key(artistId: string, artworkId: string): string {
  return `artworks/${artistId}/${artworkId}.png`
}

/**
 * Generate an R2 key for a cached OG PNG
 */
export function getOgR2Key(artworkId: string, updatedAtEpochMs: number): string {
  return `og/${artworkId}-${updatedAtEpochMs}.png`
}
