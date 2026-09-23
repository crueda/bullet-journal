import { useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import type { PeriodKey, Tag } from '../types'
import { parseQuickEntry } from '../lib/quick-parse'
import { nextColor } from '../lib/colors'
import { activeTags } from '../lib/entries'
import { scopeOf } from '../lib/periods'
import { useJournal } from '../state/JournalContext'

interface QuickAddProps {
  periodKey: PeriodKey
  placeholder?: string
  onOpenEditor: () => void
}

export function QuickAdd({ periodKey, placeholder, onOpenEditor }: QuickAddProps) {
  const { tags, createEntry, createTag } = useJournal()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const raw = value.trim()
    if (!raw || busy) return
    setBusy(true)
    try {
      const parsed = parseQuickEntry(raw, tags)
      if (!parsed.title) return
      const existing = activeTags(tags)
      const created: Tag[] = []
      for (const name of parsed.newTagNames) {
        const tag = await createTag({ name, color: nextColor([...existing, ...created].map((item) => item.color)) })
        created.push(tag)
      }
      await createEntry({
        kind: parsed.kind,
        title: parsed.title,
        priority: parsed.priority,
        inspiration: parsed.inspiration,
        tagIds: [...parsed.tagIds, ...created.map((tag) => tag.id)],
        scope: scopeOf(periodKey),
        periodKey,
      })
      setValue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="quick-add"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <input
        value={value}
        maxLength={200}
        placeholder={placeholder ?? 'Añadir entrada…'}
        aria-label="Añadir entrada"
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        className="icon-button"
        type="button"
        aria-label="Abrir el formulario completo"
        title="Más opciones"
        onClick={onOpenEditor}
      >
        <Settings2 size={17} />
      </button>
      <button className="primary-button compact" type="submit" disabled={!value.trim() || busy} aria-label="Añadir">
        <Plus size={18} />
      </button>
    </form>
  )
}
