import fs from 'node:fs'

type MemoryEvents = {
  low: number
  high: number
  max: number
  oom: number
  oom_kill: number
  oom_group_kill: number
}

declare global {
  // eslint-disable-next-line no-var
  var __devaintartDiagBooted: boolean | undefined
}

function readFile(path: string): string | null {
  try {
    return fs.readFileSync(path, 'utf8').trim()
  } catch {
    return null
  }
}

function parseMemoryEvents(raw: string | null): MemoryEvents | null {
  if (!raw) return null

  const output: MemoryEvents = {
    low: 0,
    high: 0,
    max: 0,
    oom: 0,
    oom_kill: 0,
    oom_group_kill: 0,
  }

  for (const line of raw.split('\n')) {
    const [key, value] = line.split(/\s+/, 2)
    if (!key || !value) continue
    if (key in output) {
      ;(output as any)[key] = Number(value)
    }
  }

  return output
}

function logDiag(event: string, details: Record<string, unknown> = {}) {
  console.log(
    `[DIAG] ${JSON.stringify({
      event,
      ts: new Date().toISOString(),
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      ...details,
    })}`
  )
}

function getMemorySnapshot() {
  const m = process.memoryUsage()
  return {
    rss: m.rss,
    heapTotal: m.heapTotal,
    heapUsed: m.heapUsed,
    external: m.external,
    arrayBuffers: m.arrayBuffers,
  }
}

export function startRuntimeDiagnostics() {
  if (globalThis.__devaintartDiagBooted) return
  globalThis.__devaintartDiagBooted = true

  logDiag('boot', {
    node: process.version,
    env: process.env.NODE_ENV,
    railwayDeploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null,
    railwayReplicaId: process.env.RAILWAY_REPLICA_ID || null,
    railwayRegion: process.env.RAILWAY_REPLICA_REGION || null,
    memoryLimitBytes: readFile('/sys/fs/cgroup/memory.max'),
    cpuMax: readFile('/sys/fs/cgroup/cpu.max'),
    memory: getMemorySnapshot(),
  })

  process.on('SIGTERM', () => {
    logDiag('signal', {
      signal: 'SIGTERM',
      memory: getMemorySnapshot(),
      memoryCurrentBytes: readFile('/sys/fs/cgroup/memory.current'),
      memoryEvents: parseMemoryEvents(readFile('/sys/fs/cgroup/memory.events')),
    })
  })

  process.on('SIGINT', () => {
    logDiag('signal', {
      signal: 'SIGINT',
      memory: getMemorySnapshot(),
      memoryCurrentBytes: readFile('/sys/fs/cgroup/memory.current'),
      memoryEvents: parseMemoryEvents(readFile('/sys/fs/cgroup/memory.events')),
    })
  })

  process.on('beforeExit', (code) => {
    logDiag('beforeExit', {
      code,
      memory: getMemorySnapshot(),
      memoryEvents: parseMemoryEvents(readFile('/sys/fs/cgroup/memory.events')),
    })
  })

  process.on('exit', (code) => {
    logDiag('exit', { code })
  })

  process.on('warning', (warning) => {
    logDiag('warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack || null,
    })
  })

  // Does not change uncaught exception process semantics.
  process.on('uncaughtExceptionMonitor', (error, origin) => {
    logDiag('uncaughtExceptionMonitor', {
      origin,
      name: error.name,
      message: error.message,
      stack: error.stack || null,
      memory: getMemorySnapshot(),
      memoryEvents: parseMemoryEvents(readFile('/sys/fs/cgroup/memory.events')),
    })
  })

  process.on('unhandledRejection', (reason) => {
    const error =
      reason instanceof Error
        ? { name: reason.name, message: reason.message, stack: reason.stack || null }
        : { value: String(reason) }

    logDiag('unhandledRejection', {
      reason: error,
      memory: getMemorySnapshot(),
      memoryEvents: parseMemoryEvents(readFile('/sys/fs/cgroup/memory.events')),
    })
  })

  const intervalMs = Number(process.env.DIAG_INTERVAL_MS || '60000')
  const timer = setInterval(() => {
    logDiag('heartbeat', {
      memory: getMemorySnapshot(),
      memoryCurrentBytes: readFile('/sys/fs/cgroup/memory.current'),
      memoryPeakBytes: readFile('/sys/fs/cgroup/memory.peak'),
      memoryEvents: parseMemoryEvents(readFile('/sys/fs/cgroup/memory.events')),
      memoryPressure: readFile('/sys/fs/cgroup/memory.pressure'),
      cpuPressure: readFile('/sys/fs/cgroup/cpu.pressure'),
    })
  }, intervalMs)
  timer.unref()
}
