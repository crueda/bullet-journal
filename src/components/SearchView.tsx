import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { EntryKind, EntryStatus, JournalEntry, PeriodKey } from '../types'
import { activeTags, KIND_LABELS, searchEntries, STATUS_LABELS, tagMap } from '../lib/entries'
import { useJournal } from '../state/JournalContext'
import { EntryList } from './EntryList'
import { EntryEditor } from './EntryEditor'
import { MoveSheet } from './MoveSheet'

const STATUS_FILTERS: Array<{ value: EntryStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: STATUS_LABELS.open },
  { value: 'done', label: STATUS_LABELS.done },
  { value: 'cancelled', label: STATUS_LABELS.cancelled },
]

const KIND_FILTERS: Array<{ value: EntryKind | 'all'; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'task', label: KIND_LABELS.task },
  { value: 'event', label: KIND_LABELS.event },
  { value: 'note', label: KIND_LABELS.note },
]

export function SearchView({ onJumpTo }: { onJumpTo: (periodKey: PeriodKey) => void }) {
  const { entries, tags, toggleEntryDone } = useJournal()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<EntryStatus | 'all'>('all')
  const [kind, setKind] = useState<EntryKind | 'all'>('all')
  const [tagId, setTagId] = useState<string>()
  const [editing, setEditing] = useState<JournalEntry>()
  const [moving, setMoving] = useState<JournalEntry>()

  const tagIndex = useMemo(() => tagMap(tags), [tags])
  const results = useMemo(
    () => searchEntries(entries, { query, status, kind, tagId }),
    [entries, query, status, kind, tagId],
  )

  return (
    <div className="stack">
      <h2>Buscar</h2>
      <label className="search-field">
        <Search size={17} />
        <input
          value={query}
          placeholder="Buscar en títulos y notas…"
          aria-label="Buscar"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="segmented small">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            className={status === filter.value ? 'active' : ''}
            type="button"
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="segmented small">
        {KIND_FILTERS.map((filter) => (
          <button
            key={filter.value}
            className={kind === filter.value ? 'active' : ''}
            type="button"
            onClick={() => setKind(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="chip-row">
        {activeTags(tags).map((tag) => (
          <button
            key={tag.id}
            className={tagId === tag.id ? 'chip active' : 'chip'}
            type="button"
            style={{ borderColor: tag.color, color: tagId === tag.id ? undefined : tag.color }}
            onClick={() => setTagId(tagId === tag.id ? undefined : tag.id)}
          >
            {tag.name}
          </button>
        ))}
      </div>

      <p className="result-count">{results.length} {results.length === 1 ? 'resultado' : 'resultados'}</p>

      {results.length ? (
        <EntryList
          entries={results}
          tags={tagIndex}
          showPeriod
          onToggle={(id) => void toggleEntryDone(id)}
          onOpen={setEditing}
          onMove={setMoving}
        />
      ) : (
        <p className="empty-state">Nada por aquí. Prueba con otras palabras.</p>
      )}

      {results.length > 0 && (
        <button className="ghost-button" type="button" onClick={() => onJumpTo(results[0].periodKey)}>
          Ir al periodo del primer resultado
        </button>
      )}

      {editing && (
        <EntryEditor entry={editing} periodKey={editing.periodKey} onClose={() => setEditing(undefined)} />
      )}
      {moving && (
        <MoveSheet ids={[moving.id]} from={moving.periodKey} onClose={() => setMoving(undefined)} />
      )}
    </div>
  )
}
