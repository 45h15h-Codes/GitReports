import { startNarrativeWorker } from './workers/narrativeWorker'
import { startReportWorker    } from './workers/reportWorker'

async function main() {
  const narrativeWorker = startNarrativeWorker()
  const reportWorker    = startReportWorker()

  console.log('[worker] Narrative worker started')
  console.log('[worker] Report worker started')

  async function shutdown(signal: string) {
    console.log(`[worker] ${signal} received — shutting down gracefully`)
    await Promise.all([
      narrativeWorker.close(),
      reportWorker.close(),
    ])
    console.log('[worker] All workers closed')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('[worker] Fatal startup error', err)
  process.exit(1)
})
