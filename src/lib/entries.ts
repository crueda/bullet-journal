import type {
  Collection,
  EntryKind,
  EntryStatus,
  JournalEntry,
  LocalDate,
  PeriodKey,
  Tag,
} from '../types'
import { addDays, toLocalDate } from './dates'
import { containsKey, isPastPeriod, monthGrid } from './periods'

export const KIND_LABELS: Record<EntryKind, string> = {
  task: 'Tarea',
  event: 'Evento',
  note: 'Nota',
}

export const STATUS_LABELS: Record<EntryStatus, string> = {
  open: 'Pendiente',
  done: 'Completada',
  cancelled: 'Descartada',
}

/**
 * Símbolo clásico del bullet journal.
 * `•` tarea · `x` hecha · `>` migrada · `○` evento · `—` nota.
 */
export function bulletSymbol(entry: JournalEntry): string {
  if (entry.status === 'done') return '×'
  if (entry.status === 'cancelled') return '~'
  if (entry.kind === 'event') return '○'
  if (entry.kind === 'note') return '—'
  return entry.migrationCount > 0 ? '›' : '•'
}

export function isOpen(entry: JournalEntry): boolean {
  return entry.status === 'open'
}

export function isClosed(entry: JournalEntry): boolean {
  return entry.status !== 'open'
}

export function liveEntries(entries: JournalEntry[]): JournalEntry[] {
  return entries.filter((entry) => !entry.deletedAt)
}

export function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((left, right) =>
    left.order - right.order || left.createdAt.localeCompare(right.createdAt))
}

export function entriesFor(entries: JournalEntry[], periodKey: PeriodKey): JournalEntry[] {
  return sortEntries(liveEntries(entries).filter((entry) => entry.periodKey === periodKey))
}

export function nextOrder(entries: JournalEntry[], periodKey: PeriodKey): number {
  return Math.max(-1, ...liveEntries(entries)
    .filter((entry) => entry.periodKey === periodKey)
    .map((entry) => entry.order)) + 1
}

export interface PeriodCounts {
  total: number
  open: number
  done: number
  cancelled: number
  migrated: number
  tasks: number
  percentage: number
}

export function countEntries(entries: JournalEntry[]): PeriodCounts {
  const tasks = entries.filter((entry) => entry.kind === 'task')
  const done = entries.filter((entry) => entry.status === 'done').length
  const cancelled = entries.filter((entry) => entry.status === 'cancelled').length
  const open = entries.length - done - cancelled
  const migrated = entries.filter((entry) => entry.migrationCount > 0).length
  const decided = done + cancelled
  return {
    total: entries.length,
    open,
    done,
    cancelled,
    migrated,
    tasks: tasks.length,
    percentage: entries.length ? Math.round((decided / entries.length) * 100) : 0,
  }
}

export function countsFor(entries: JournalEntry[], periodKey: PeriodKey): PeriodCounts {
  return countEntries(entriesFor(entries, periodKey))
}

/** Tareas abiertas que quedaron atrás en días ya pasados. */
export function overdueEntries(entries: JournalEntry[], today: LocalDate = toLocalDate()): JournalEntry[] {
  return sortEntries(liveEntries(entries).filter((entry) =>
    entry.status === 'open'
    && entry.scope === 'day'
    && entry.periodKey < today
    && entry.kind !== 'note'))
}

/** Periodos de calendario cerrados con tareas abiertas (mes/trimestre/año pasados). */
export function stalePeriodEntries(entries: JournalEntry[], today: LocalDate = toLocalDate()): JournalEntry[] {
  return sortEntries(liveEntries(entries).filter((entry) =>
    entry.status === 'open'
    && entry.scope !== 'day'
    && entry.scope !== 'collection'
    && isPastPeriod(entry.periodKey, today)))
}

export interface DayCount {
  open: number
  done: number
  total: number
}

/** Recuento por día para el calendario del mes. */
export function dayCounts(entries: JournalEntry[], monthKey: PeriodKey): Map<LocalDate, DayCount> {
  const result = new Map<LocalDate, DayCount>()
  for (const day of monthGrid(monthKey)) {
    if (!day) continue
    const counts = countEntries(entriesFor(entries, day))
    if (counts.total) result.set(day, { open: counts.open, done: counts.done, total: counts.total })
  }
  return result
}

export function activeTags(tags: Tag[]): Tag[] {
  return tags
    .filter((tag) => !tag.deletedAt)
    .sort((left, right) => left.name.localeCompare(right.name, 'es'))
}

export function activeCollections(collections: Collection[]): Collection[] {
  return collections
    .filter((collection) => !collection.deletedAt)
    .sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt))
}

export function tagMap(tags: Tag[]): Map<string, Tag> {
  return new Map(activeTags(tags).map((tag) => [tag.id, tag]))
}

export interface SearchFilters {
  query: string
  status?: EntryStatus | 'all'
  kind?: EntryKind | 'all'
  tagId?: string
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function searchEntries(entries: JournalEntry[], filters: SearchFilters): JournalEntry[] {
  const needle = normalize(filters.query.trim())
  const matches = liveEntries(entries).filter((entry) => {
    if (filters.status && filters.status !== 'all' && entry.status !== filters.status) return false
    if (filters.kind && filters.kind !== 'all' && entry.kind !== filters.kind) return false
    if (filters.tagId && !entry.tagIds.includes(filters.tagId)) return false
    if (!needle) return true
    return normalize(entry.title).includes(needle) || normalize(entry.notes ?? '').includes(needle)
  })
  return matches.sort((left, right) =>
    right.periodKey.localeCompare(left.periodKey) || right.updatedAt.localeCompare(left.updatedAt))
}

/** Días consecutivos, hacia atrás desde hoy, en los que no quedó nada abierto. */
export function closedDayStreak(entries: JournalEntry[], today: LocalDate = toLocalDate()): number {
  let streak = 0
  for (let day = today; streak < 400; day = addDays(day, -1)) {
    const dayEntries = entriesFor(entries, day).filter((entry) => entry.kind !== 'note')
    if (!dayEntries.length) {
      if (day === today) continue
      break
    }
    if (dayEntries.some(isOpen)) break
    streak += 1
  }
  return streak
}

export interface TagUsage {
  tag: Tag
  total: number
  done: number
}

export function tagUsage(entries: JournalEntry[], tags: Tag[], within?: PeriodKey): TagUsage[] {
  const pool = liveEntries(entries).filter((entry) => !within || containsKey(within, entry.periodKey))
  return activeTags(tags)
    .map((tag) => {
      const tagged = pool.filter((entry) => entry.tagIds.includes(tag.id))
      return { tag, total: tagged.length, done: tagged.filter((entry) => entry.status === 'done').length }
    })
    .filter((usage) => usage.total > 0)
    .sort((left, right) => right.total - left.total)
}

/** Entradas que más veces se han movido: suelen señalar algo que conviene replantear. */
export function mostMigrated(entries: JournalEntry[], limit = 5): JournalEntry[] {
  return liveEntries(entries)
    .filter((entry) => entry.migrationCount > 0 && entry.status === 'open')
    .sort((left, right) => right.migrationCount - left.migrationCount)
    .slice(0, limit)
}
