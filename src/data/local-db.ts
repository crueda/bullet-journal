import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  AppSnapshot,
  BackupData,
  Collection,
  JournalEntry,
  PendingOperation,
  Preferences,
  SyncEntity,
  SyncRecord,
  Tag,
} from '../types'
import { DEFAULT_PREFERENCES } from '../types'
import { DATABASE_NAME, DATABASE_VERSION } from '../lib/compatibility'
import { missingDefaultCollections, missingDefaultTags } from '../lib/default-data'

interface JournalDatabase extends DBSchema {
  entries: {
    key: string
    value: JournalEntry
    indexes: { 'by-period': string; 'by-scope': string }
  }
  tags: { key: string; value: Tag }
  collections: { key: string; value: Collection }
  preferences: { key: 'current'; value: Preferences }
  queue: { key: string; value: PendingOperation; indexes: { 'by-queued-at': string } }
}

type StoreName = 'entries' | 'tags' | 'collections'

const STORES: Record<SyncEntity, StoreName> = {
  entry: 'entries',
  tag: 'tags',
  collection: 'collections',
}

let databasePromise: Promise<IDBPDatabase<JournalDatabase>> | undefined

function database() {
  databasePromise ??= openDB<JournalDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('entries')) {
        const entries = db.createObjectStore('entries', { keyPath: 'id' })
        entries.createIndex('by-period', 'periodKey')
        entries.createIndex('by-scope', 'scope')
      }
      if (!db.objectStoreNames.contains('tags')) db.createObjectStore('tags', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences')
      if (!db.objectStoreNames.contains('queue')) {
        const queue = db.createObjectStore('queue', { keyPath: 'id' })
        queue.createIndex('by-queued-at', 'queuedAt')
      }
    },
  })
  return databasePromise
}

function pending(entity: SyncEntity, recordId: string): PendingOperation {
  return { id: `${entity}:${recordId}`, entity, recordId, queuedAt: new Date().toISOString() }
}

async function seedIfNeeded(db: IDBPDatabase<JournalDatabase>): Promise<void> {
  const stored = await db.get('preferences', 'current')
  const preferences = { ...DEFAULT_PREFERENCES, ...stored }
  if (preferences.hasSeededDefaults) return

  const now = new Date().toISOString()
  const [existingTags, existingCollections] = await Promise.all([db.getAll('tags'), db.getAll('collections')])
  const tags = missingDefaultTags(existingTags, false, now)
  const collections = missingDefaultCollections(existingCollections, false, now)

  const transaction = db.transaction(['tags', 'collections', 'preferences', 'queue'], 'readwrite')
  for (const tag of tags) {
    await transaction.objectStore('tags').put(tag)
    await transaction.objectStore('queue').put(pending('tag', tag.id))
  }
  for (const collection of collections) {
    await transaction.objectStore('collections').put(collection)
    await transaction.objectStore('queue').put(pending('collection', collection.id))
  }
  await transaction.objectStore('preferences').put({ ...preferences, hasSeededDefaults: true }, 'current')
  await transaction.done
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  const db = await database()
  await seedIfNeeded(db)
  const [entries, tags, collections, preferences] = await Promise.all([
    db.getAll('entries'),
    db.getAll('tags'),
    db.getAll('collections'),
    db.get('preferences', 'current'),
  ])
  return {
    entries,
    tags,
    collections,
    preferences: { ...DEFAULT_PREFERENCES, hasSeededDefaults: true, ...preferences },
  }
}

export async function saveRecords(entity: SyncEntity, records: SyncRecord[], queue = true): Promise<void> {
  if (!records.length) return
  const db = await database()
  const store = STORES[entity]
  const transaction = db.transaction([store, 'queue'], 'readwrite')
  for (const record of records) {
    // El esquema tipado por store obliga a un cast aquí: el entity ya fija el tipo real.
    await transaction.objectStore(store).put(record as never)
    if (queue) await transaction.objectStore('queue').put(pending(entity, record.id))
  }
  await transaction.done
}

export async function saveEntries(entries: JournalEntry[], queue = true): Promise<void> {
  await saveRecords('entry', entries, queue)
}

export async function saveEntry(entry: JournalEntry, queue = true): Promise<void> {
  await saveRecords('entry', [entry], queue)
}

export async function saveTag(tag: Tag, queue = true): Promise<void> {
  await saveRecords('tag', [tag], queue)
}

export async function saveCollection(collection: Collection, queue = true): Promise<void> {
  await saveRecords('collection', [collection], queue)
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await (await database()).put('preferences', preferences, 'current')
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  return (await database()).getAllFromIndex('queue', 'by-queued-at')
}

export async function removePendingOperation(id: string): Promise<void> {
  await (await database()).delete('queue', id)
}

export async function getRecord(entity: SyncEntity, id: string): Promise<SyncRecord | undefined> {
  return (await database()).get(STORES[entity], id)
}

/** Aplica los registros remotos que sean más recientes que la copia local. */
export async function mergeRemoteRecords(entity: SyncEntity, records: SyncRecord[]): Promise<boolean> {
  const db = await database()
  const transaction = db.transaction(STORES[entity], 'readwrite')
  let changed = false
  for (const record of records) {
    const local = await transaction.store.get(record.id)
    if (!local || record.updatedAt > local.updatedAt) {
      await transaction.store.put(record as never)
      changed = true
    }
  }
  await transaction.done
  return changed
}

/**
 * Sustituye el contenido local por el de una copia de seguridad y deja
 * lápidas (`deletedAt`) de lo que había antes para que la nube se alinee.
 */
export async function replaceWithBackup(backup: BackupData): Promise<void> {
  const db = await database()
  const current = await loadSnapshot()
  const now = new Date().toISOString()
  const transaction = db.transaction(['entries', 'tags', 'collections', 'preferences', 'queue'], 'readwrite')
  const stores = {
    entry: transaction.objectStore('entries'),
    tag: transaction.objectStore('tags'),
    collection: transaction.objectStore('collections'),
  }
  const queueStore = transaction.objectStore('queue')
  await Promise.all([stores.entry.clear(), stores.tag.clear(), stores.collection.clear(), queueStore.clear()])

  const imported: Array<[SyncEntity, SyncRecord[]]> = [
    ['entry', backup.entries],
    ['tag', backup.tags],
    ['collection', backup.collections],
  ]
  const existing: Array<[SyncEntity, SyncRecord[]]> = [
    ['entry', current.entries],
    ['tag', current.tags],
    ['collection', current.collections],
  ]

  for (const [entity, records] of imported) {
    for (const record of records) {
      const value = { ...record, updatedAt: now, deletedAt: undefined }
      await stores[entity].put(value as never)
      await queueStore.put(pending(entity, value.id))
    }
  }

  for (const [entity, records] of existing) {
    const importedIds = new Set((imported.find(([key]) => key === entity)?.[1] ?? []).map((record) => record.id))
    for (const record of records.filter((item) => !importedIds.has(item.id))) {
      const tombstone = { ...record, updatedAt: now, deletedAt: now }
      await stores[entity].put(tombstone as never)
      await queueStore.put(pending(entity, tombstone.id))
    }
  }

  await transaction.objectStore('preferences').put({ ...backup.preferences, hasSeededDefaults: true }, 'current')
  await transaction.done
}
