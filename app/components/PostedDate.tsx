'use client'

import { useEffect, useState } from 'react'

interface PostedDateProps {
  date: Date | string
}

export function PostedDate({ date }: PostedDateProps) {
  const [formatted, setFormatted] = useState<string | null>(null)

  useEffect(() => {
    // Format in browser timezone
    const d = new Date(date)
    setFormatted(d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }))
  }, [date])

  // Server-side / initial render: show Pacific time
  if (!formatted) {
    const d = new Date(date)
    const pacific = d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: 'America/Los_Angeles'
    })
    return <span>Posted {pacific}</span>
  }

  return <span>Posted {formatted}</span>
}
