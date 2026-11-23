import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { App } from '../ui/App'
import { HomeScreen } from '../ui/screens/HomeScreen'
import { DashboardScreen } from '../ui/screens/DashboardScreen'
import { InsightsScreen } from '../ui/screens/InsightsScreen'
import { ArchiveScreen } from '../ui/screens/ArchiveScreen'
import { ProfileScreen } from '../ui/screens/ProfileScreen'

describe('Full App Rendering Smoke Test', () => {
  it('renders App without throwing', () => {
    expect(() => renderToString(<App />)).not.toThrow()
  })

  it('renders HomeScreen without throwing', () => {
    expect(() => renderToString(<HomeScreen />)).not.toThrow()
  })

  it('renders all screens without throwing', () => {
    expect(() => renderToString(<DashboardScreen />)).not.toThrow()
    expect(() => renderToString(<InsightsScreen />)).not.toThrow()
    expect(() => renderToString(<ArchiveScreen />)).not.toThrow()
    expect(() => renderToString(<ProfileScreen />)).not.toThrow()
  })
})
