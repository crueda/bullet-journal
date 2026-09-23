import { useMemo, useState } from 'react'
import { Ban, Check, Circle, Copy, MoveRight, Plus, Trash2 } from 'lucide-react'
import type { EntryKind, EntryStatus, JournalEntry, PeriodKey } from '../types'
import { activeTags, KIND_LABELS } from '../lib/entries'
import { nextColor } from '../lib/colors'
import { periodLabel, scopeOf } from '../lib/periods'
import { useJournal } from '../state/JournalContext'
import { Sheet } from './Sheet'
import { MoveSheet } from './MoveSheet'

const KIND_OPTIONS: Array<{ kind: EntryKind; symbol: string; hint: string }> = [
  { kind: 'task', symbol: '•', hint: 'Algo que hacer' },
  { kind: 'event', symbol: '○', hint: 'Algo que ocurre' },
  { kind: 'note', symbol: '—', hint: 'Algo que recordar' },
]

const STATUS_OPTIONS: Array<{ status: EntryStatus; label: string; icon: typeof Check }> = [
  { status: 'open', label: 'Pendiente', icon: Circle },
  { status: 'done', label: 'Hecha', icon: Check },
  { status: 'cancelled', label: 'Descartada', icon: Ban },
]

interface EntryEditorProps {
  entry?: JournalEntry
  periodKey: PeriodKey
  onClose: () => void
}

export function EntryEditor({ entry, periodKey, onClose }: EntryEditorProps) {
  const {
    tags,
    createEntry,
    updateEntry,
    setEntryStatus,
    duplicateEntry,
    deleteEntry,
    createTag,
  } = useJournal()

  const [title, setTitle] = useState(entry?.title ?? '')
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? 'task')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [priority, setPriority] = useState(entry?.priority ?? false)
  const [inspiration, setInspiration] = useState(entry?.inspiration ?? false)
  const [tagIds, setTagIds] = useState<string[]>(entry?.tagIds ?? [])
  const [newTag, setNewTag] = useState('')
  const [moving, setMoving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const available = useMemo(() => activeTags(tags), [tags])
  const target = entry?.periodKey ?? periodKey

  const toggleTag = (id: string) => {
    setTagIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const addTag = async () => {
    const name = newTag.trim()
    if (!name) return
    const existing = available.find((tag) => tag.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!tagIds.includes(existing.id)) toggleTag(existing.id)
    } else {
      const created = await createTag({ name, color: nextColor(available.map((tag) => tag.color)) })
      setTagIds((current) => [...current, created.id])
    }
    setNewTag('')
  }

  const submit = async () => {
    if (!title.trim()) return
    if (entry) {
      await updateEntry(entry.id, { title, kind, notes, priority, inspiration, tagIds })
    } else {
      await createEntry({ title, kind, notes, priority, inspiration, tagIds, scope: scopeOf(target), periodKey: target })
    }
    onClose()
  }

  return (
    <>
      <Sheet
        title={entry ? 'Editar entrada' : 'Nueva entrada'}
        subtitle={periodLabel(target)}
        onClose={onClose}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-button" type="button" disabled={!title.trim()} onClick={() => void submit()}>
              {entry ? 'Guardar' : 'Añadir'}
            </button>
          </>
        )}
      >
        <label className="field">
          <span className="field-label">Título</span>
          <input
            autoFocus
            value={title}
            maxLength={200}
            placeholder="¿Qué quieres anotar?"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
            }}
          />
        </label>

        <div className="field">
          <span className="field-label">Tipo</span>
          <div className="segmented">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.kind}
                className={kind === option.kind ? 'active' : ''}
                type="button"
                onClick={() => setKind(option.kind)}
                title={option.hint}
              >
                <span className="segment-symbol" aria-hidden="true">{option.symbol}</span>
                {KIND_LABELS[option.kind]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Marcas</span>
          <div className="chip-row">
            <button className={priority ? 'chip active' : 'chip'} type="button" onClick={() => setPriority(!priority)}>
              ★ Prioritaria
            </button>
            <button
              className={inspiration ? 'chip active' : 'chip'}
              type="button"
              onClick={() => setInspiration(!inspiration)}
            >
              ! Inspiración
            </button>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Etiquetas</span>
          <div className="chip-row">
            {available.map((tag) => (
              <button
                key={tag.id}
                className={tagIds.includes(tag.id) ? 'chip active' : 'chip'}
                type="button"
                style={{ borderColor: tag.color, color: tagIds.includes(tag.id) ? undefined : tag.color }}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>
          <div className="row new-tag">
            <input
              value={newTag}
              maxLength={40}
              placeholder="Nueva etiqueta"
              onChange={(event) => setNewTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void addTag()
                }
              }}
            />
            <button className="icon-button" type="button" aria-label="Crear etiqueta" onClick={() => void addTag()}>
              <Plus size={17} />
            </button>
          </div>
        </div>

        <label className="field">
          <span className="field-label">Notas</span>
          <textarea
            rows={3}
            value={notes}
            maxLength={4_000}
            placeholder="Detalles, enlaces, contexto…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        {entry && (
          <>
            <div className="field">
              <span className="field-label">Estado</span>
              <div className="segmented">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.status}
                    className={entry.status === option.status ? 'active' : ''}
                    type="button"
                    onClick={() => void setEntryStatus(entry.id, option.status)}
                  >
                    <option.icon size={15} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Periodo</span>
              <button className="list-button" type="button" onClick={() => setMoving(true)}>
                <MoveRight size={17} />
                <span>{periodLabel(entry.periodKey)}</span>
                <small>Mover</small>
              </button>
            </div>

            <div className="danger-row">
              <button className="ghost-button" type="button" onClick={() => void duplicateEntry(entry.id).then(onClose)}>
                <Copy size={16} /> Duplicar
              </button>
              {confirmDelete ? (
                <button className="danger-button" type="button" onClick={() => void deleteEntry(entry.id).then(onClose)}>
                  <Trash2 size={16} /> Confirmar borrado
                </button>
              ) : (
                <button className="ghost-button danger" type="button" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={16} /> Eliminar
                </button>
              )}
            </div>
          </>
        )}

        {!entry && (
          <p className="hint">
            Se añadirá en <strong>{periodLabel(target)}</strong>. Después podrás moverla a cualquier otro periodo.
          </p>
        )}
      </Sheet>

      {entry && moving && (
        <MoveSheet
          ids={[entry.id]}
          from={entry.periodKey}
          onClose={() => setMoving(false)}
          onMoved={() => onClose()}
        />
      )}
    </>
  )
}
