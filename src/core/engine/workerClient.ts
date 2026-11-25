import { generateInsights, type GenerateInsightsInput } from './generator'
import type { EngineRunOutput } from './types'

/**
 * Runs generateInsights inside a Web Worker when available, keeping the UI responsive.
 * Falls back cleanly to direct execution in Node tests or workerless environments.
 */
export async function runInsightsAsync(
  input: GenerateInsightsInput
): Promise<EngineRunOutput> {
  if (typeof Worker === 'undefined') {
    return generateInsights(input)
  }

  return new Promise<EngineRunOutput>((resolve) => {
    let worker: Worker | null = null
    try {
      worker = new Worker(new URL('./insights.worker.ts', import.meta.url), {
        type: 'module',
      })
      worker.onmessage = (
        event: MessageEvent<{ ok: boolean; result?: EngineRunOutput; error?: string }>
      ) => {
        worker?.terminate()
        if (event.data?.ok && event.data.result) {
          resolve(event.data.result)
        } else {
          resolve(generateInsights(input))
        }
      }
      worker.onerror = () => {
        worker?.terminate()
        resolve(generateInsights(input))
      }
      worker.postMessage(input)
    } catch {
      worker?.terminate()
      resolve(generateInsights(input))
    }
  })
}
