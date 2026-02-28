export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startRuntimeDiagnostics } = await import('./lib/runtime-diagnostics-node')
  startRuntimeDiagnostics()
}
