import { useRef, useState } from 'react'
import { Download, FileText, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react'
import type { Tag, ThemePreference } from '../types'
import { activeTags } from '../lib/entries'
import { createBackup, createMarkdownReport, downloadText, parseBackup } from '../lib/backup'
import { nextColor, PALETTE } from '../lib/colors'
import { toLocalDate } from '../lib/dates'
import { useJournal } from '../state/JournalContext'
import { SyncBadge } from './SyncBadge'
import { Sheet } from './Sheet'

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

export function SettingsView() {
  const {
    entries,
    tags,
    collections,
    preferences,
    sync,
    updatePreferences,
    importBackup,
    retrySync,
    createTag,
    updateTag,
    deleteTag,
  } = useJournal()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string }>()
  const [tagEditor, setTagEditor] = useState<{ open: boolean; tag?: Tag }>({ open: false })

  const snapshot = { entries, tags, collections, preferences }

  const exportBackup = () => {
    downloadText(
      JSON.stringify(createBackup(snapshot), null, 2),
      `koyomi-${toLocalDate()}.json`,
      'application/json',
    )
    setMessage({ tone: 'ok', text: 'Copia descargada.' })
  }

  const exportMarkdown = () => {
    downloadText(createMarkdownReport(snapshot), `koyomi-${toLocalDate()}.md`, 'text/markdown')
    setMessage({ tone: 'ok', text: 'Resumen en Markdown descargado.' })
  }

  const handleImport = async (file: File) => {
    try {
      const backup = parseBackup(JSON.parse(await file.text()))
      await importBackup(backup)
      setMessage({ tone: 'ok', text: 'Copia restaurada.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo leer el archivo.' })
    }
  }

  return (
    <div className="stack">
      <h2>Ajustes</h2>

      <section className="settings-block">
        <h3>Apariencia</h3>
        <div className="segmented">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              className={preferences.theme === theme.value ? 'active' : ''}
              type="button"
              onClick={() => void updatePreferences({ ...preferences, theme: theme.value })}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <h3>Diario</h3>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={preferences.migrationReminders}
            onChange={(event) => void updatePreferences({ ...preferences, migrationReminders: event.target.checked })}
          />
          <span>
            <strong>Avisar de pendientes</strong>
            <small>Muestra el repaso de lo que quedó abierto en días y periodos anteriores.</small>
          </span>
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={preferences.showCompleted}
            onChange={(event) => void updatePreferences({ ...preferences, showCompleted: event.target.checked })}
          />
          <span>
            <strong>Mostrar entradas cerradas</strong>
            <small>Despliega por defecto lo ya hecho o descartado en cada periodo.</small>
          </span>
        </label>
      </section>

      <section className="settings-block">
        <div className="row spread">
          <h3>Etiquetas</h3>
          <button className="ghost-button" type="button" onClick={() => setTagEditor({ open: true })}>
            Nueva etiqueta
          </button>
        </div>
        <ul className="tag-list">
          {activeTags(tags).map((tag) => (
            <li key={tag.id}>
              <span className="chip" style={{ borderColor: tag.color, color: tag.color }}>{tag.name}</span>
              <button
                className="icon-button"
                type="button"
                aria-label={`Editar ${tag.name}`}
                onClick={() => setTagEditor({ open: true, tag })}
              >
                <Pencil size={15} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-block">
        <h3>Copia en la nube</h3>
        <div className="row spread">
          <SyncBadge status={sync.status} />
          <button className="ghost-button" type="button" onClick={() => void retrySync()}>
            <RefreshCw size={15} /> Reintentar
          </button>
        </div>
        {sync.detail && <p className="hint">{sync.detail}</p>}
        <p className="hint">
          Los cambios se guardan primero en este dispositivo y se sincronizan con una identidad anónima de
          Firebase cuando hay conexión.
        </p>
      </section>

      <section className="settings-block">
        <h3>Copia de seguridad</h3>
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={exportBackup}>
            <Download size={16} /> Exportar JSON
          </button>
          <button className="ghost-button" type="button" onClick={() => fileInput.current?.click()}>
            <Upload size={16} /> Importar
          </button>
          <button className="ghost-button" type="button" onClick={exportMarkdown}>
            <FileText size={16} /> Markdown
          </button>
        </div>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void handleImport(file)
          }}
        />
        <p className="hint">Importar sustituye el contenido actual por el de la copia.</p>
        {message && <p className={message.tone === 'ok' ? 'notice ok' : 'notice error'}>{message.text}</p>}
      </section>

      <section className="settings-block about">
        <h3>Sobre Koyomi</h3>
        <p className="hint">
          Bullet journal digital con cuatro escalas: día, mes, trimestre y año. Símbolos clásicos:
          <span className="legend"><b>•</b> tarea · <b>○</b> evento · <b>—</b> nota · <b>×</b> hecha · <b>›</b> migrada · <b>~</b> descartada</span>
        </p>
        <p className="hint">
          Al escribir deprisa: <code>*</code> prioritaria, <code>!</code> inspiración, <code>-</code> nota,
          <code>o</code> evento y <code>#etiqueta</code>.
        </p>
      </section>

      {tagEditor.open && (
        <TagEditor
          tag={tagEditor.tag}
          usedColors={activeTags(tags).map((tag) => tag.color)}
          onClose={() => setTagEditor({ open: false })}
          onSave={async (name, color) => {
            if (tagEditor.tag) await updateTag(tagEditor.tag.id, { name, color })
            else await createTag({ name, color })
          }}
          onDelete={tagEditor.tag ? () => deleteTag(tagEditor.tag!.id) : undefined}
        />
      )}
    </div>
  )
}

interface TagEditorProps {
  tag?: Tag
  usedColors: string[]
  onClose: () => void
  onSave: (name: string, color: string) => Promise<void>
  onDelete?: () => Promise<void>
}

function TagEditor({ tag, usedColors, onClose, onSave, onDelete }: TagEditorProps) {
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(tag?.color ?? nextColor(usedColors))
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <Sheet
      title={tag ? 'Editar etiqueta' : 'Nueva etiqueta'}
      onClose={onClose}
      footer={(
        <>
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button
            className="primary-button"
            type="button"
            disabled={!name.trim()}
            onClick={() => void onSave(name, color).then(onClose)}
          >
            Guardar
          </button>
        </>
      )}
    >
      <label className="field">
        <span className="field-label">Nombre</span>
        <input autoFocus value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="field">
        <span className="field-label">Color</span>
        <div className="color-row">
          {PALETTE.map((option) => (
            <button
              key={option}
              className={option === color ? 'color-dot active' : 'color-dot'}
              type="button"
              style={{ background: option }}
              aria-label={`Color ${option}`}
              onClick={() => setColor(option)}
            />
          ))}
        </div>
      </div>
      {tag && onDelete && (
        <div className="danger-row">
          {confirmDelete ? (
            <button className="danger-button" type="button" onClick={() => void onDelete().then(onClose)}>
              <Trash2 size={16} /> Confirmar borrado
            </button>
          ) : (
            <button className="ghost-button danger" type="button" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Eliminar etiqueta
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
