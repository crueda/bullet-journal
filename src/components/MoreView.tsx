import { useState } from 'react'
import type { Collection, PeriodKey } from '../types'
import { CollectionsView } from './CollectionsView'
import { SearchView } from './SearchView'
import { StatsView } from './StatsView'
import { SettingsView } from './SettingsView'

type Section = 'collections' | 'search' | 'stats' | 'settings'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'collections', label: 'Colecciones' },
  { id: 'search', label: 'Buscar' },
  { id: 'stats', label: 'Datos' },
  { id: 'settings', label: 'Ajustes' },
]

interface MoreViewProps {
  onOpenCollection: (collection: Collection) => void
  onJumpTo: (periodKey: PeriodKey) => void
}

export function MoreView({ onOpenCollection, onJumpTo }: MoreViewProps) {
  const [section, setSection] = useState<Section>('collections')

  return (
    <div className="more-view">
      <div className="segmented small sticky">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            className={section === item.id ? 'active' : ''}
            type="button"
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'collections' && <CollectionsView onOpen={onOpenCollection} />}
      {section === 'search' && <SearchView onJumpTo={onJumpTo} />}
      {section === 'stats' && <StatsView onJumpTo={onJumpTo} />}
      {section === 'settings' && <SettingsView />}
    </div>
  )
}
