/**
 * Developer tools visibility gate (1E):
 * Shown during Vite dev mode (`import.meta.env.DEV`) or when explicitly enabled
 * via `localStorage.setItem('trinqle_dev_mode', '1')`.
 */
export function isDevToolsEnabled(): boolean {
  try {
    const env = (import.meta as unknown as { env?: { DEV?: boolean } })?.env
    if (env?.DEV) return true
  } catch {
    // Ignore env errors outside Vite
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage?.getItem('trinqle_dev_mode') === '1') {
      return true
    }
  } catch {
    // Ignore storage access errors
  }
  return false
}
