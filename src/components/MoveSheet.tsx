import { useState } from 'react'
import { CalendarDays, FolderOpen } from 'lucide-react'
import type { LocalDate, PeriodKey } from '../types'
import { activeCollections } from '../lib/entries'
import { collectionKey, isPeriodKey, moveTargets, periodLabel, SCOPE_LABELS } from '../lib/periods'
import { toLocalDate } from '../lib/dates'
import { useJournal } from '../state/JournalContext'
import { Sheet } from './Sheet'

interface MoveSheetProps {
  ids: string[]
  from: PeriodKey
  title?: string
  onClose: () => void
  onMoved?: (periodKey: PeriodKey) => void
}

export function MoveSheet({ ids, from, title, onClose, onMoved }: MoveSheetProps) {
  const { collections, moveEntries } = useJournal()
  const today = toLocalDate()
  const [customDate, setCustomDate] = useState<string>('')
  const targets = moveTargets(from, today)
  const openCollections = activeCollections(collections).filter((collection) => !collection.archivedAt)

  const move = async (periodKey: PeriodKey) => {
    if (!isPeriodKey(periodKey)) return
    await moveEntries(ids, periodKey)
    onMoved?.(periodKey)
    onClose()
  }

  return (
    <Sheet
      title={title ?? (ids.length > 1 ? `Mover ${ids.length} entradas` : 'Mover entrada')}
      subtitle={`Ahora en ${periodLabel(from, today)}`}
      onClose={onClose}
    >
      <div className="move-grid">
        {targets.map((target) => (
          <button key={target.key} className="move-target" type="button" onClick={() => void move(target.key)}>
            <span className="move-scope">{SCOPE_LABELS[target.scope]}</span>
            <strong>{target.label}</strong>
            {target.hint && <span className="move-hint">{target.hint}</span>}
          </button>
        ))}
      </div>

      <label className="field custom-date">
        <span className="field-label"><CalendarDays size={15} /> Otro día</span>
        <div className="row">
          <input
            type="date"
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
          />
          <button
            className="primary-button"
            type="button"
            disabled={!customDate}
            onClick={() => void move(customDate as LocalDate)}
          >
            Mover
          </button>
        </div>
      </label>

      {openCollections.length > 0 && (
        <section className="move-collections">
          <h3 className="field-label"><FolderOpen size={15} /> A una colección</h3>
          <div className="chip-row">
            {openCollections.map((collection) => (
              <button
                key={collection.id}
                className="chip"
                type="button"
                style={{ borderColor: collection.color, color: collection.color }}
                onClick={() => void move(collectionKey(collection.id))}
              >
                {collection.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  )
}
