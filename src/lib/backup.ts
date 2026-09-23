import type {
  AppSnapshot,
  BackupData,
  Collection,
  EntryKind,
  EntryStatus,
  JournalEntry,
  Preferences,
  Tag,
} from '../types'
import { BACKUP_FORMAT, BACKUP_VERSION } from './compatibility'
import { bulletSymbol, entriesFor, KIND_LABELS, liveEntries, STATUS_LABELS } from './entries'
import { currentKey, isPeriodKey, periodLabel, scopeOf } from './periods'

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const ID_PATTERN = /^[A-Za-z0-9_-]+$/
const KINDS: EntryKind[] = ['task', 'event', 'note']
const STATUSES: EntryStatus[] = ['open', 'done', 'cancelled']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isIntegerWithin(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

function isName(value: unknown, maxLength = 80): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.length <= maxLength
}

function parseTag(value: unknown): Tag | undefined {
  if (!isObject(value)) return
  if (
    typeof value.id !== 'string' || !ID_PATTERN.test(value.id)
    || !isName(value.name, 40)
    || typeof value.color !== 'string' || !COLOR_PATTERN.test(value.color)
    || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)
  ) return
  return {
    id: value.id,
    name: value.name.trim(),
    color: value.color,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function parseCollection(value: unknown): Collection | undefined {
  if (!isObject(value)) return
  if (
    typeof value.id !== 'string' || !ID_PATTERN.test(value.id)
    || !isName(value.name, 60)
    || typeof value.color !== 'string' || !COLOR_PATTERN.test(value.color)
    || !isIntegerWithin(value.order, 0, 10_000)
    || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)
    || (value.archivedAt !== undefined && !isTimestamp(value.archivedAt))
  ) return
  return {
    id: value.id,
    name: value.name.trim(),
    color: value.color,
    order: value.order,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(value.archivedAt ? { archivedAt: value.archivedAt } : {}),
  }
}

function parseEntry(value: unknown, tagIds: Set<string>, collectionIds: Set<string>): JournalEntry | undefined {
  if (!isObject(value)) return
  if (
    typeof value.id !== 'string' || !ID_PATTERN.test(value.id)
    || !isName(value.title, 200)
    || !KINDS.includes(value.kind as EntryKind)
    || !STATUSES.includes(value.status as EntryStatus)
    || !isPeriodKey(value.periodKey)
    || !isIntegerWithin(value.order, 0, 100_000)
    || !isIntegerWithin(value.migrationCount, 0, 10_000)
    || typeof value.priority !== 'boolean'
    || typeof value.inspiration !== 'boolean'
    || !Array.isArray(value.tagIds)
    || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)
    || (value.notes !== undefined && typeof value.notes !== 'string')
    || (value.completedAt !== undefined && !isTimestamp(value.completedAt))
  ) return

  const scope = scopeOf(value.periodKey)
  if (value.scope !== scope) return
  if (scope === 'collection') {
    const id = value.periodKey.slice('col:'.length)
    if (!collectionIds.has(id)) return
  }

  return {
    id: value.id,
    kind: value.kind as EntryKind,
    title: value.title.trim(),
    ...(value.notes ? { notes: String(value.notes).slice(0, 4_000) } : {}),
    status: value.status as EntryStatus,
    scope,
    periodKey: value.periodKey,
    priority: value.priority,
    inspiration: value.inspiration,
    tagIds: value.tagIds.filter((id): id is string => typeof id === 'string' && tagIds.has(id)),
    order: value.order,
    migrationCount: value.migrationCount,
    ...(isPeriodKey(value.movedFrom) ? { movedFrom: value.movedFrom } : {}),
    ...(value.completedAt ? { completedAt: value.completedAt } : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function parsePreferences(value: unknown): Preferences | undefined {
  if (!isObject(value) || !['system', 'light', 'dark'].includes(String(value.theme))) return
  return {
    theme: value.theme as Preferences['theme'],
    hasSeededDefaults: value.hasSeededDefaults !== false,
    migrationReminders: value.migrationReminders !== false,
    showCompleted: value.showCompleted !== false,
  }
}

export function createBackup(snapshot: AppSnapshot): BackupData {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: liveEntries(snapshot.entries),
    tags: snapshot.tags.filter((tag) => !tag.deletedAt),
    collections: snapshot.collections.filter((collection) => !collection.deletedAt),
    preferences: snapshot.preferences,
  }
}

export function parseBackup(value: unknown): BackupData {
  if (!isObject(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error('No es una copia de Bitácora compatible.')
  }
  if (
    !isTimestamp(value.exportedAt)
    || !Array.isArray(value.entries)
    || !Array.isArray(value.tags)
    || !Array.isArray(value.collections)
  ) {
    throw new Error('La copia está incompleta o dañada.')
  }

  const parsedTags = value.tags.map(parseTag)
  if (parsedTags.some((tag) => !tag)) throw new Error('La copia contiene etiquetas no válidas.')
  const tags = parsedTags as Tag[]

  const parsedCollections = value.collections.map(parseCollection)
  if (parsedCollections.some((collection) => !collection)) throw new Error('La copia contiene colecciones no válidas.')
  const collections = parsedCollections as Collection[]

  const tagIds = new Set(tags.map((tag) => tag.id))
  const collectionIds = new Set(collections.map((collection) => collection.id))
  if (tagIds.size !== tags.length) throw new Error('La copia contiene etiquetas duplicadas.')
  if (collectionIds.size !== collections.length) throw new Error('La copia contiene colecciones duplicadas.')

  const parsedEntries = value.entries.map((entry) => parseEntry(entry, tagIds, collectionIds))
  if (parsedEntries.some((entry) => !entry)) throw new Error('La copia contiene entradas no válidas.')
  const entries = parsedEntries as JournalEntry[]
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new Error('La copia contiene entradas duplicadas.')
  }

  const preferences = parsePreferences(value.preferences)
  if (!preferences) throw new Error('La copia contiene preferencias no válidas.')

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: value.exportedAt,
    entries,
    tags,
    collections,
    preferences,
  }
}

export function createMarkdownReport(snapshot: AppSnapshot): string {
  const keys = [
    currentKey('day'),
    currentKey('month'),
    currentKey('quarter'),
    currentKey('year'),
  ]
  const lines = ['# Bitácora', '', `Exportado el ${new Date().toLocaleDateString('es-ES')}.`, '']

  for (const key of keys) {
    const entries = entriesFor(snapshot.entries, key)
    lines.push(`## ${periodLabel(key)}`, '')
    if (!entries.length) {
      lines.push('_Sin entradas._', '')
      continue
    }
    for (const entry of entries) {
      const marks = [entry.priority ? '*' : '', entry.inspiration ? '!' : ''].join('')
      const extra = entry.migrationCount ? ` _(migrada ×${entry.migrationCount})_` : ''
      lines.push(`- \`${bulletSymbol(entry)}\` ${marks}${entry.title}${extra}`)
      if (entry.notes) lines.push(`  > ${entry.notes.replace(/\n/g, ' ')}`)
    }
    lines.push('')
  }

  const collections = snapshot.collections.filter((collection) => !collection.deletedAt)
  if (collections.length) {
    lines.push('## Colecciones', '')
    for (const collection of collections) {
      const entries = entriesFor(snapshot.entries, `col:${collection.id}`)
      lines.push(`### ${collection.name}`, '')
      if (!entries.length) lines.push('_Sin entradas._', '')
      else {
        for (const entry of entries) {
          lines.push(`- \`${bulletSymbol(entry)}\` ${entry.title} — ${STATUS_LABELS[entry.status]} (${KIND_LABELS[entry.kind]})`)
        }
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

export function downloadText(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
