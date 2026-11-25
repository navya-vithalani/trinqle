import { generateInsights, type GenerateInsightsInput } from './generator'

self.onmessage = (event: MessageEvent<GenerateInsightsInput>) => {
  try {
    const result = generateInsights(event.data)
    self.postMessage({ ok: true, result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Worker analysis failed'
    self.postMessage({ ok: false, error: message })
  }
}
