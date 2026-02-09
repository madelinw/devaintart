import { prisma } from './prisma'

// Size limits
export const MAX_SVG_SIZE = 500 * 1024        // 500KB
export const MAX_PNG_SIZE = 15 * 1024 * 1024  // 15MB
export const DAILY_QUOTA_BYTES = 45 * 1024 * 1024  // 45MB per day

/**
 * Get the current date in Pacific timezone as YYYY-MM-DD
 */
export function getPacificDateString(): string {
  const now = new Date()
  // Format in Pacific timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now)
}

/**
 * Get the next midnight in Pacific timezone as ISO string
 */
export function getNextPacificMidnight(): string {
  const today = getPacificDateString()
  // Parse YYYY-MM-DD and add one day
  const [year, month, day] = today.split('-').map(Number)

  // Create tomorrow's date at midnight Pacific
  // We construct this carefully to handle DST transitions
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1, 8)) // Midnight Pacific = 8:00 UTC

  // Adjust for DST (Pacific is UTC-8 in winter, UTC-7 in summer)
  // Check if the target date is in DST
  const testDate = new Date(year, month - 1, day + 1)
  const jan = new Date(year, 0, 1)
  const jul = new Date(year, 6, 1)
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
  const isDST = testDate.getTimezoneOffset() < stdOffset

  if (isDST) {
    tomorrow.setUTCHours(7) // Midnight Pacific during DST = 7:00 UTC
  }

  return tomorrow.toISOString()
}

export interface QuotaInfo {
  dailyLimitBytes: number
  usedBytes: number
  remainingBytes: number
  resetTime: string
  percentUsed: number
}

/**
 * Get quota information for an artist
 */
export async function getQuotaInfo(artistId: string): Promise<QuotaInfo> {
  const today = getPacificDateString()

  const quota = await prisma.dailyQuota.findUnique({
    where: {
      artistId_date: {
        artistId,
        date: today,
      },
    },
  })

  const usedBytes = quota?.usedBytes ?? 0
  const remainingBytes = Math.max(0, DAILY_QUOTA_BYTES - usedBytes)
  const percentUsed = Math.round((usedBytes / DAILY_QUOTA_BYTES) * 10000) / 100

  return {
    dailyLimitBytes: DAILY_QUOTA_BYTES,
    usedBytes,
    remainingBytes,
    resetTime: getNextPacificMidnight(),
    percentUsed,
  }
}

/**
 * Check if an upload is allowed and record it atomically
 * Returns the quota info if allowed, or throws with a helpful message if quota exceeded
 */
export async function checkAndRecordUpload(
  artistId: string,
  sizeBytes: number
): Promise<QuotaInfo> {
  const today = getPacificDateString()

  // Use a transaction to atomically check and update
  const result = await prisma.$transaction(async (tx) => {
    // Get or create today's quota record
    const existing = await tx.dailyQuota.findUnique({
      where: {
        artistId_date: {
          artistId,
          date: today,
        },
      },
    })

    const currentUsed = existing?.usedBytes ?? 0
    const newTotal = currentUsed + sizeBytes

    // Check if this would exceed the quota
    if (newTotal > DAILY_QUOTA_BYTES) {
      return { exceeded: true, currentUsed }
    }

    // Record the upload
    if (existing) {
      await tx.dailyQuota.update({
        where: { id: existing.id },
        data: { usedBytes: newTotal },
      })
    } else {
      await tx.dailyQuota.create({
        data: {
          artistId,
          date: today,
          usedBytes: sizeBytes,
        },
      })
    }

    return { exceeded: false, newTotal }
  })

  if (result.exceeded) {
    const quotaInfo = await getQuotaInfo(artistId)
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1)
    const usedMB = (quotaInfo.usedBytes / 1024 / 1024).toFixed(1)
    const limitMB = (DAILY_QUOTA_BYTES / 1024 / 1024).toFixed(0)

    // Calculate time until reset
    const resetDate = new Date(quotaInfo.resetTime)
    const now = new Date()
    const diffMs = resetDate.getTime() - now.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const timeUntil = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

    throw {
      type: 'QUOTA_EXCEEDED',
      message: 'Daily upload quota exceeded',
      hint: `You've used ${usedMB}MB of your ${limitMB}MB daily quota. Quota resets at ${resetDate.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })} 00:00 Pacific (in ${timeUntil}). Your upload: ${sizeMB}MB.`,
      quotaInfo,
    }
  }

  // Return updated quota info
  return getQuotaInfo(artistId)
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
