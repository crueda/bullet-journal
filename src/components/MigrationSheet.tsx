import { useMemo, useState } from 'react'
import { Ban, CalendarArrowDown, MoveRight } from 'lucide-react'
import type { JournalEntry, LocalDate } from '../types'
import { bulletSymbol, overdueEntries, stalePeriodEntries } from '../lib/entries'
import { periodShortLabel } from '../lib/periods'
import { useJournal } from '../state/JournalContext'
import { Sheet } from './Sheet'
import { MoveSheet } from './MoveSheet'

interface MigrationSheetProps {
  today: LocalDate
  onClose: () => void
}

export function MigrationSheet({ today, onClose }: MigrationSheetProps) {
  const { entries, moveEntries, setEntryStatus } = useJournal()
  const pending = useMemo(
    () => [...overdueEntries(entries, today), ...stalePeriodEntries(entries, today)],
    [entries, today],
  )
  const [selected, setSelected] = useState<string[]>(() => pending.map((entry) => entry.id))
  const [moving, setMoving] = useState(false)

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const bringToToday = async () => {
    await moveEntries(selected, today)
    onClose()
  }

  const discard = async () => {
    await Promise.all(selected.map((id) => setEntryStatus(id, 'cancelled')))
    onClose()
  }

  const renderRow = (entry: JournalEntry) => (
    <li key={entry.id}>
      <label className="check-row">
        <input type="checkbox" checked={selected.includes(entry.id)} onChange={() => toggle(entry.id)} />
        <span className="entry-bullet static" aria-hidden="true">{bulletSymbol(entry)}</span>
        <span className="check-title">{entry.title}</span>
        <span className="meta-chip period">{periodShortLabel(entry.periodKey, today)}</span>
      </label>
    </li>
  )

  return (
    <>
      <Sheet
        title="Repaso de pendientes"
        subtitle={`${pending.length} ${pending.length === 1 ? 'entrada quedó atrás' : 'entradas quedaron atrás'}`}
        onClose={onClose}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={onClose}>Ahora no</button>
            <button className="primary-button" type="button" disabled={!selected.length} onClick={() => void bringToToday()}>
              <CalendarArrowDown size={16} /> Traer a hoy
            </button>
          </>
        )}
      >
        <p className="hint">
          En el bullet journal, revisar lo que no se hizo es parte del método: cada entrada se mueve
          a conciencia o se descarta.
        </p>
        <ul className="check-list">{pending.map(renderRow)}</ul>
        <div className="row spread">
          <button className="ghost-button" type="button" disabled={!selected.length} onClick={() => setMoving(true)}>
            <MoveRight size={16} /> Mover a otro periodo
          </button>
          <button className="ghost-button danger" type="button" disabled={!selected.length} onClick={() => void discard()}>
            <Ban size={16} /> Descartar
          </button>
        </div>
      </Sheet>

      {moving && (
        <MoveSheet
          ids={selected}
          from={today}
          title={`Mover ${selected.length} ${selected.length === 1 ? 'entrada' : 'entradas'}`}
          onClose={() => setMoving(false)}
          onMoved={onClose}
        />
      )}
    </>
  )
}
