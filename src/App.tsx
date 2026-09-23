import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  CalendarSearch,
  LayoutGrid,
  Sun,
} from 'lucide-react'
import type { Collection, PeriodKey, PeriodScope } from './types'
import { THEME_STORAGE_KEY } from './lib/compatibility'
import { collectionKey, currentKey, scopeOf } from './lib/periods'
import { toLocalDate } from './lib/dates'
import { useJournal } from './state/JournalContext'
import { PeriodView } from './components/PeriodView'
import { MoreView } from './components/MoreView'
import { PwaStatus } from './components/PwaStatus'
import { SyncBadge } from './components/SyncBadge'

type CalendarScope = Exclude<PeriodScope, 'collection'>
type Tab = CalendarScope | 'more'

const NAVIGATION: Array<{ id: Tab; label: string; icon: typeof Sun }> = [
  { id: 'day', label: 'Día', icon: Sun },
  { id: 'month', label: 'Mes', icon: CalendarDays },
  { id: 'quarter', label: 'Trimestre', icon: CalendarRange },
  { id: 'year', label: 'Año', icon: CalendarSearch },
  { id: 'more', label: 'Más', icon: LayoutGrid },
]

const SCOPE_TITLES: Record<CalendarScope, string> = {
  day: 'Día',
  month: 'Mes',
  quarter: 'Trimestre',
  year: 'Año',
}

export default function App() {
  const { ready, preferences, sync } = useJournal()
  const today = toLocalDate()
  const [tab, setTab] = useState<Tab>('day')
  const [collection, setCollection] = useState<Collection>()
  const [keys, setKeys] = useState<Record<CalendarScope, PeriodKey>>(() => ({
    day: currentKey('day', today),
    month: currentKey('month', today),
    quarter: currentKey('quarter', today),
    year: currentKey('year', today),
  }))

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      localStorage.setItem(THEME_STORAGE_KEY, preferences.theme)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preferences.theme])

  const navigate = (scope: CalendarScope) => (periodKey: PeriodKey) => {
    setKeys((current) => ({ ...current, [scope]: periodKey }))
  }

  const jumpTo = (periodKey: PeriodKey) => {
    const scope = scopeOf(periodKey)
    if (scope === 'collection') return
    setKeys((current) => ({ ...current, [scope]: periodKey }))
    setCollection(undefined)
    setTab(scope)
  }

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="brand-mark"><span>•</span></div>
        <h1>Koyomi</h1>
        <p>Abriendo tu cuaderno…</p>
        <i />
      </main>
    )
  }

  return (
    <div className="app-shell">
      <main className="main-content">
        {collection ? (
          <>
            <button className="back-button" type="button" onClick={() => setCollection(undefined)}>
              <ArrowLeft size={17} /> Colecciones
            </button>
            <PeriodView
              periodKey={collectionKey(collection.id)}
              title="Colección"
              label={collection.name}
              onNavigate={() => undefined}
              onJumpTo={jumpTo}
            />
          </>
        ) : tab === 'more' ? (
          <MoreView
            onOpenCollection={(item) => {
              setCollection(item)
              setTab('more')
            }}
            onJumpTo={jumpTo}
          />
        ) : (
          <PeriodView
            periodKey={keys[tab]}
            title={SCOPE_TITLES[tab]}
            onNavigate={navigate(tab)}
            onJumpTo={jumpTo}
          />
        )}
      </main>

      <nav className="bottom-navigation" aria-label="Navegación principal">
        {NAVIGATION.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={tab === id && !collection ? 'active' : ''}
            type="button"
            onClick={() => {
              setCollection(undefined)
              setTab(id)
            }}
            aria-current={tab === id && !collection ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={tab === id ? 2.6 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="floating-sync"><SyncBadge status={sync.status} compact /></div>
      <PwaStatus />
    </div>
  )
}
