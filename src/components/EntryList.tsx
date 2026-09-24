import type { CSSProperties, ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CornerDownRight, GripVertical, NotebookPen, Sparkles, Star } from 'lucide-react'
import type { JournalEntry, Tag } from '../types'
import { bulletSymbol, KIND_LABELS, STATUS_LABELS } from '../lib/entries'
import { periodShortLabel } from '../lib/periods'

interface EntryRowProps {
  entry: JournalEntry
  tags: Map<string, Tag>
  onToggle: (id: string) => void
  onOpen: (entry: JournalEntry) => void
  onMove: (entry: JournalEntry) => void
  showPeriod?: boolean
  dragHandle?: ReactNode
}

export function EntryRow({ entry, tags, onToggle, onOpen, onMove, showPeriod, dragHandle }: EntryRowProps) {
  const entryTags = entry.tagIds.map((id) => tags.get(id)).filter((tag): tag is Tag => Boolean(tag))

  return (
    <div className={`entry-row status-${entry.status} kind-${entry.kind}`}>
      {dragHandle}
      {entry.kind === 'task' ? (
        <input
          className="entry-checkbox"
          type="checkbox"
          checked={entry.status === 'done'}
          onChange={() => onToggle(entry.id)}
          aria-label={entry.status === 'done' ? 'Marcar como pendiente' : 'Marcar como completada'}
          title={entry.status === 'done' ? 'Hecha; pulsar para reabrir' : 'Marcar como hecha'}
        />
      ) : (
        <button
          className="entry-bullet"
          type="button"
          onClick={() => onToggle(entry.id)}
          aria-label={entry.status === 'done' ? 'Marcar como pendiente' : 'Marcar como completada'}
          title={STATUS_LABELS[entry.status]}
        >
          <span aria-hidden="true">{bulletSymbol(entry)}</span>
        </button>
      )}
      <button className="entry-main" type="button" onClick={() => onOpen(entry)}>
        <span className="entry-title">
          {entry.priority && <Star className="mark priority" size={14} aria-label="Prioritaria" />}
          {entry.inspiration && <Sparkles className="mark inspiration" size={14} aria-label="Inspiración" />}
          <span>{entry.title}</span>
        </span>
        <span className="entry-meta">
          {showPeriod && <span className="meta-chip period">{periodShortLabel(entry.periodKey)}</span>}
          {entry.kind !== 'task' && <span className="meta-chip">{KIND_LABELS[entry.kind]}</span>}
          {entryTags.map((tag) => (
            <span key={tag.id} className="meta-chip tag" style={{ '--tag-color': tag.color } as CSSProperties}>
              {tag.name}
            </span>
          ))}
          {entry.migrationCount > 0 && (
            <span className="meta-chip migrated" title={`Movida ${entry.migrationCount} ${entry.migrationCount === 1 ? 'vez' : 'veces'}`}>
              <CornerDownRight size={12} aria-hidden="true" />
              {entry.migrationCount}
            </span>
          )}
          {entry.notes && <NotebookPen className="meta-icon" size={12} aria-label="Con notas" />}
        </span>
      </button>
      <button
        className="icon-button entry-move"
        type="button"
        onClick={() => onMove(entry)}
        aria-label={`Mover “${entry.title}” a otro periodo`}
        title="Mover a otro periodo"
      >
        <CornerDownRight size={17} />
      </button>
    </div>
  )
}

function SortableEntry(props: Omit<EntryRowProps, 'dragHandle'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.entry.id })

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? 'entry-item dragging' : 'entry-item'}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <EntryRow
        {...props}
        dragHandle={(
          <button
            className="drag-handle"
            type="button"
            aria-label={`Reordenar “${props.entry.title}”`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>
        )}
      />
    </li>
  )
}

interface EntryListProps {
  entries: JournalEntry[]
  tags: Map<string, Tag>
  sortable?: boolean
  showPeriod?: boolean
  onToggle: (id: string) => void
  onOpen: (entry: JournalEntry) => void
  onMove: (entry: JournalEntry) => void
  onReorder?: (orderedIds: string[]) => void
}

export function EntryList({
  entries,
  tags,
  sortable = false,
  showPeriod = false,
  onToggle,
  onOpen,
  onMove,
  onReorder,
}: EntryListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) return
    const ids = entries.map((entry) => entry.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(to, 0, next.splice(from, 1)[0])
    onReorder(next)
  }

  if (!sortable || !onReorder) {
    return (
      <ul className="entry-list">
        {entries.map((entry) => (
          <li key={entry.id} className="entry-item">
            <EntryRow
              entry={entry}
              tags={tags}
              onToggle={onToggle}
              onOpen={onOpen}
              onMove={onMove}
              showPeriod={showPeriod}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
        <ul className="entry-list">
          {entries.map((entry) => (
            <SortableEntry
              key={entry.id}
              entry={entry}
              tags={tags}
              onToggle={onToggle}
              onOpen={onOpen}
              onMove={onMove}
              showPeriod={showPeriod}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
