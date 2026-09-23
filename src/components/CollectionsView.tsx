import { useState } from 'react'
import { Archive, ArchiveRestore, ChevronRight, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import type { Collection } from '../types'
import { activeCollections, countsFor } from '../lib/entries'
import { collectionKey } from '../lib/periods'
import { nextColor, PALETTE } from '../lib/colors'
import { useJournal } from '../state/JournalContext'
import { Sheet } from './Sheet'

interface CollectionsViewProps {
  onOpen: (collection: Collection) => void
}

export function CollectionsView({ onOpen }: CollectionsViewProps) {
  const {
    entries,
    collections,
    createCollection,
    updateCollection,
    archiveCollection,
    deleteCollection,
  } = useJournal()
  const [editor, setEditor] = useState<{ open: boolean; collection?: Collection }>({ open: false })

  const all = activeCollections(collections)
  const open = all.filter((collection) => !collection.archivedAt)
  const archived = all.filter((collection) => collection.archivedAt)

  const renderCollection = (collection: Collection) => {
    const counts = countsFor(entries, collectionKey(collection.id))
    return (
      <li key={collection.id} className="collection-row">
        <button className="collection-main" type="button" onClick={() => onOpen(collection)}>
          <span className="collection-dot" style={{ background: collection.color }} />
          <span className="collection-name">
            <strong>{collection.name}</strong>
            <small>{counts.total ? `${counts.open} pendientes · ${counts.total} entradas` : 'Vacía'}</small>
          </span>
          <ChevronRight size={17} />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label={`Editar ${collection.name}`}
          onClick={() => setEditor({ open: true, collection })}
        >
          <Pencil size={16} />
        </button>
      </li>
    )
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h2>Colecciones</h2>
        <button className="primary-button compact" type="button" onClick={() => setEditor({ open: true })}>
          <FolderPlus size={17} /> Nueva
        </button>
      </div>
      <p className="hint">
        Listas temáticas fuera del calendario: libros, ideas, la compra… Cualquier entrada se puede mover
        aquí y volver a un día cuando toque.
      </p>

      {open.length ? <ul className="collection-list">{open.map(renderCollection)}</ul> : (
        <p className="empty-state">Todavía no tienes colecciones.</p>
      )}

      {archived.length > 0 && (
        <details className="archived">
          <summary>{archived.length} archivadas</summary>
          <ul className="collection-list">{archived.map(renderCollection)}</ul>
        </details>
      )}

      {editor.open && (
        <CollectionEditor
          collection={editor.collection}
          usedColors={all.map((item) => item.color)}
          onClose={() => setEditor({ open: false })}
          onSave={async (name, color) => {
            if (editor.collection) await updateCollection(editor.collection.id, { name, color })
            else await createCollection({ name, color })
          }}
          onArchive={editor.collection
            ? (archivedNow) => archiveCollection(editor.collection!.id, archivedNow)
            : undefined}
          onDelete={editor.collection ? () => deleteCollection(editor.collection!.id) : undefined}
        />
      )}
    </div>
  )
}

interface CollectionEditorProps {
  collection?: Collection
  usedColors: string[]
  onClose: () => void
  onSave: (name: string, color: string) => Promise<void>
  onArchive?: (archived: boolean) => Promise<void>
  onDelete?: () => Promise<void>
}

function CollectionEditor({ collection, usedColors, onClose, onSave, onArchive, onDelete }: CollectionEditorProps) {
  const [name, setName] = useState(collection?.name ?? '')
  const [color, setColor] = useState(collection?.color ?? nextColor(usedColors))
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <Sheet
      title={collection ? 'Editar colección' : 'Nueva colección'}
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
        <input autoFocus value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
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

      {collection && (
        <div className="danger-row">
          {onArchive && (
            <button
              className="ghost-button"
              type="button"
              onClick={() => void onArchive(!collection.archivedAt).then(onClose)}
            >
              {collection.archivedAt ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              {collection.archivedAt ? 'Restaurar' : 'Archivar'}
            </button>
          )}
          {onDelete && (confirmDelete ? (
            <button className="danger-button" type="button" onClick={() => void onDelete().then(onClose)}>
              <Trash2 size={16} /> Borrar con sus entradas
            </button>
          ) : (
            <button className="ghost-button danger" type="button" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Eliminar
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
