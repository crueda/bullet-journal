import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppSnapshot,
  BackupData,
  Collection,
  CollectionDraft,
  EntryDraft,
  EntryStatus,
  JournalEntry,
  PeriodKey,
  Preferences,
  SyncStatus,
  Tag,
  TagDraft,
} from '../types'
import { DEFAULT_PREFERENCES } from '../types'
import { nextOrder } from '../lib/entries'
import { collectionKey, scopeOf } from '../lib/periods'
import {
  loadSnapshot,
  replaceWithBackup,
  saveCollection,
  saveEntries,
  saveEntry,
  savePreferences,
  saveTag,
} from '../data/local-db'
import type { CloudSync as CloudSyncInstance } from '../data/cloud-sync'

interface SyncState {
  status: SyncStatus
  detail?: string
}

interface JournalContextValue extends AppSnapshot {
  ready: boolean
  sync: SyncState
  createEntry: (draft: EntryDraft) => Promise<JournalEntry>
  updateEntry: (id: string, patch: Partial<EntryDraft>) => Promise<void>
  setEntryStatus: (id: string, status: EntryStatus) => Promise<void>
  toggleEntryDone: (id: string) => Promise<void>
  toggleEntryPriority: (id: string) => Promise<void>
  moveEntries: (ids: string[], periodKey: PeriodKey) => Promise<void>
  undoMove: (id: string) => Promise<void>
  duplicateEntry: (id: string) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  reorderEntries: (periodKey: PeriodKey, orderedIds: string[]) => Promise<void>
  createTag: (draft: TagDraft) => Promise<Tag>
  updateTag: (id: string, draft: TagDraft) => Promise<void>
  deleteTag: (id: string) => Promise<void>
  createCollection: (draft: CollectionDraft) => Promise<Collection>
  updateCollection: (id: string, draft: CollectionDraft) => Promise<void>
  archiveCollection: (id: string, archived: boolean) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  updatePreferences: (preferences: Preferences) => Promise<void>
  importBackup: (backup: BackupData) => Promise<void>
  retrySync: () => Promise<void>
}

const JournalContext = createContext<JournalContextValue | undefined>(undefined)

function upsert<T extends { id: string }>(items: T[], value: T): T[] {
  return items.some((item) => item.id === value.id)
    ? items.map((item) => (item.id === value.id ? value : item))
    : [...items, value]
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot>({
    entries: [],
    tags: [],
    collections: [],
    preferences: DEFAULT_PREFERENCES,
  })
  const snapshotRef = useRef(snapshot)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState<SyncState>({ status: 'local-only' })
  const cloudRef = useRef<CloudSyncInstance | undefined>(undefined)

  const updateSnapshot = useCallback((updater: (current: AppSnapshot) => AppSnapshot) => {
    setSnapshot((current) => {
      const next = updater(current)
      snapshotRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    let active = true
    void loadSnapshot().then(async (initial) => {
      if (!active) return
      snapshotRef.current = initial
      setSnapshot(initial)
      setReady(true)

      const { CloudSync } = await import('../data/cloud-sync')
      if (!active) return
      const cloud = new CloudSync({
        onRecords: async () => {
          const latest = await loadSnapshot()
          if (active) updateSnapshot(() => latest)
        },
        onStatus: (status, detail) => {
          if (active) setSync({ status, detail })
        },
      })
      cloudRef.current = cloud
      cloud.start()
    })

    return () => {
      active = false
      cloudRef.current?.stop()
    }
  }, [updateSnapshot])

  const notifyCloud = useCallback(() => {
    void cloudRef.current?.notifyLocalChange()
  }, [])

  const putEntries = useCallback(async (entries: JournalEntry[]) => {
    if (!entries.length) return
    await saveEntries(entries)
    updateSnapshot((state) => ({ ...state, entries: entries.reduce(upsert, state.entries) }))
    notifyCloud()
  }, [notifyCloud, updateSnapshot])

  const patchEntry = useCallback(async (id: string, patch: Partial<JournalEntry>) => {
    const current = snapshotRef.current.entries.find((entry) => entry.id === id)
    if (!current) return
    await putEntries([{ ...current, ...patch, updatedAt: new Date().toISOString() }])
  }, [putEntries])

  const createEntry = useCallback(async (draft: EntryDraft) => {
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      kind: draft.kind,
      title: draft.title.trim(),
      ...(draft.notes?.trim() ? { notes: draft.notes.trim() } : {}),
      status: 'open',
      scope: draft.scope,
      periodKey: draft.periodKey,
      priority: draft.priority,
      inspiration: draft.inspiration,
      tagIds: [...draft.tagIds],
      order: nextOrder(snapshotRef.current.entries, draft.periodKey),
      migrationCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    await saveEntry(entry)
    updateSnapshot((state) => ({ ...state, entries: upsert(state.entries, entry) }))
    notifyCloud()
    return entry
  }, [notifyCloud, updateSnapshot])

  const updateEntry = useCallback(async (id: string, patch: Partial<EntryDraft>) => {
    const current = snapshotRef.current.entries.find((entry) => entry.id === id)
    if (!current) return
    const target = patch.periodKey
    const moved = target !== undefined && target !== current.periodKey
    await patchEntry(id, {
      ...patch,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      notes: patch.notes === undefined ? current.notes : patch.notes.trim() || undefined,
      ...(moved && target
        ? {
            scope: scopeOf(target),
            order: nextOrder(snapshotRef.current.entries, target),
            migrationCount: current.migrationCount + 1,
            movedFrom: current.periodKey,
          }
        : {}),
    })
  }, [patchEntry])

  const setEntryStatus = useCallback(async (id: string, status: EntryStatus) => {
    await patchEntry(id, {
      status,
      completedAt: status === 'done' ? new Date().toISOString() : undefined,
    })
  }, [patchEntry])

  const toggleEntryDone = useCallback(async (id: string) => {
    const current = snapshotRef.current.entries.find((entry) => entry.id === id)
    if (!current) return
    await setEntryStatus(id, current.status === 'done' ? 'open' : 'done')
  }, [setEntryStatus])

  const toggleEntryPriority = useCallback(async (id: string) => {
    const current = snapshotRef.current.entries.find((entry) => entry.id === id)
    if (!current) return
    await patchEntry(id, { priority: !current.priority })
  }, [patchEntry])

  /** Migración: mueve las entradas al nuevo periodo y deja rastro para poder deshacerlo. */
  const moveEntries = useCallback(async (ids: string[], periodKey: PeriodKey) => {
    const now = new Date().toISOString()
    const scope = scopeOf(periodKey)
    let order = nextOrder(snapshotRef.current.entries, periodKey)
    const moved = ids
      .map((id) => snapshotRef.current.entries.find((entry) => entry.id === id))
      .filter((entry): entry is JournalEntry => entry !== undefined && entry.periodKey !== periodKey)
      .map((entry) => ({
        ...entry,
        scope,
        periodKey,
        order: order++,
        migrationCount: entry.migrationCount + 1,
        movedFrom: entry.periodKey,
        updatedAt: now,
      }))
    await putEntries(moved)
  }, [putEntries])

  const undoMove = useCallback(async (id: string) => {
    const current = snapshotRef.current.entries.find((entry) => entry.id === id)
    if (!current?.movedFrom) return
    await patchEntry(id, {
      periodKey: current.movedFrom,
      scope: scopeOf(current.movedFrom),
      order: nextOrder(snapshotRef.current.entries, current.movedFrom),
      migrationCount: Math.max(0, current.migrationCount - 1),
      movedFrom: undefined,
    })
  }, [patchEntry])

  const duplicateEntry = useCallback(async (id: string) => {
    const current = snapshotRef.current.entries.find((entry) => entry.id === id)
    if (!current) return
    await createEntry({
      kind: current.kind,
      title: current.title,
      notes: current.notes,
      priority: current.priority,
      inspiration: current.inspiration,
      tagIds: current.tagIds,
      scope: current.scope,
      periodKey: current.periodKey,
    })
  }, [createEntry])

  const deleteEntry = useCallback(async (id: string) => {
    const now = new Date().toISOString()
    await patchEntry(id, { deletedAt: now })
  }, [patchEntry])

  const reorderEntries = useCallback(async (periodKey: PeriodKey, orderedIds: string[]) => {
    const now = new Date().toISOString()
    const positions = new Map(orderedIds.map((id, index) => [id, index]))
    const changed = snapshotRef.current.entries
      .filter((entry) => entry.periodKey === periodKey && positions.has(entry.id) && entry.order !== positions.get(entry.id))
      .map((entry) => ({ ...entry, order: positions.get(entry.id)!, updatedAt: now }))
    await putEntries(changed)
  }, [putEntries])

  const createTag = useCallback(async (draft: TagDraft) => {
    const now = new Date().toISOString()
    const tag: Tag = { id: crypto.randomUUID(), name: draft.name.trim(), color: draft.color, createdAt: now, updatedAt: now }
    await saveTag(tag)
    updateSnapshot((state) => ({ ...state, tags: upsert(state.tags, tag) }))
    notifyCloud()
    return tag
  }, [notifyCloud, updateSnapshot])

  const patchTag = useCallback(async (id: string, patch: Partial<Tag>) => {
    const current = snapshotRef.current.tags.find((tag) => tag.id === id)
    if (!current) return
    const tag = { ...current, ...patch, updatedAt: new Date().toISOString() }
    await saveTag(tag)
    updateSnapshot((state) => ({ ...state, tags: upsert(state.tags, tag) }))
    notifyCloud()
  }, [notifyCloud, updateSnapshot])

  const updateTag = useCallback(
    (id: string, draft: TagDraft) => patchTag(id, { name: draft.name.trim(), color: draft.color }),
    [patchTag],
  )

  const deleteTag = useCallback(async (id: string) => {
    const now = new Date().toISOString()
    const affected = snapshotRef.current.entries
      .filter((entry) => entry.tagIds.includes(id) && !entry.deletedAt)
      .map((entry) => ({ ...entry, tagIds: entry.tagIds.filter((tagId) => tagId !== id), updatedAt: now }))
    await putEntries(affected)
    await patchTag(id, { deletedAt: now })
  }, [patchTag, putEntries])

  const createCollection = useCallback(async (draft: CollectionDraft) => {
    const now = new Date().toISOString()
    const order = Math.max(-1, ...snapshotRef.current.collections.map((item) => item.order)) + 1
    const collection: Collection = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      color: draft.color,
      order,
      createdAt: now,
      updatedAt: now,
    }
    await saveCollection(collection)
    updateSnapshot((state) => ({ ...state, collections: upsert(state.collections, collection) }))
    notifyCloud()
    return collection
  }, [notifyCloud, updateSnapshot])

  const patchCollection = useCallback(async (id: string, patch: Partial<Collection>) => {
    const current = snapshotRef.current.collections.find((item) => item.id === id)
    if (!current) return
    const collection = { ...current, ...patch, updatedAt: new Date().toISOString() }
    await saveCollection(collection)
    updateSnapshot((state) => ({ ...state, collections: upsert(state.collections, collection) }))
    notifyCloud()
  }, [notifyCloud, updateSnapshot])

  const updateCollection = useCallback(
    (id: string, draft: CollectionDraft) => patchCollection(id, { name: draft.name.trim(), color: draft.color }),
    [patchCollection],
  )

  const archiveCollection = useCallback(
    (id: string, archived: boolean) => patchCollection(id, { archivedAt: archived ? new Date().toISOString() : undefined }),
    [patchCollection],
  )

  const deleteCollection = useCallback(async (id: string) => {
    const now = new Date().toISOString()
    const key = collectionKey(id)
    const affected = snapshotRef.current.entries
      .filter((entry) => entry.periodKey === key && !entry.deletedAt)
      .map((entry) => ({ ...entry, deletedAt: now, updatedAt: now }))
    await putEntries(affected)
    await patchCollection(id, { deletedAt: now })
  }, [patchCollection, putEntries])

  const updatePreferences = useCallback(async (preferences: Preferences) => {
    await savePreferences(preferences)
    updateSnapshot((state) => ({ ...state, preferences }))
  }, [updateSnapshot])

  const importBackup = useCallback(async (backup: BackupData) => {
    await replaceWithBackup(backup)
    const latest = await loadSnapshot()
    updateSnapshot(() => latest)
    notifyCloud()
  }, [notifyCloud, updateSnapshot])

  const value = useMemo<JournalContextValue>(() => ({
    ...snapshot,
    ready,
    sync,
    createEntry,
    updateEntry,
    setEntryStatus,
    toggleEntryDone,
    toggleEntryPriority,
    moveEntries,
    undoMove,
    duplicateEntry,
    deleteEntry,
    reorderEntries,
    createTag,
    updateTag,
    deleteTag,
    createCollection,
    updateCollection,
    archiveCollection,
    deleteCollection,
    updatePreferences,
    importBackup,
    retrySync: async () => cloudRef.current?.retry(),
  }), [
    snapshot,
    ready,
    sync,
    createEntry,
    updateEntry,
    setEntryStatus,
    toggleEntryDone,
    toggleEntryPriority,
    moveEntries,
    undoMove,
    duplicateEntry,
    deleteEntry,
    reorderEntries,
    createTag,
    updateTag,
    deleteTag,
    createCollection,
    updateCollection,
    archiveCollection,
    deleteCollection,
    updatePreferences,
    importBackup,
  ])

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}

// El contexto y el hook comparten módulo para encapsular el ciclo de vida de la persistencia.
// eslint-disable-next-line react-refresh/only-export-components
export function useJournal() {
  const value = useContext(JournalContext)
  if (!value) throw new Error('useJournal debe usarse dentro de JournalProvider')
  return value
}
