export type LocalDate = `${number}-${number}-${number}`

/**
 * Ámbito de un registro. El bullet journal clásico usa tres escalas
 * (daily log, monthly log, future log); aquí se amplía con trimestre
 * y con colecciones temáticas.
 */
export type PeriodScope = 'day' | 'month' | 'quarter' | 'year' | 'collection'

/**
 * Clave de periodo, única por ámbito:
 * - día:        `2026-09-23`
 * - mes:        `2026-09`
 * - trimestre:  `2026-Q3`
 * - año:        `2026`
 * - colección:  `col:<id>`
 */
export type PeriodKey = string

/** Símbolos del bullet journal: tarea (•), evento (○), nota (—). */
export type EntryKind = 'task' | 'event' | 'note'

/** Estado de una entrada. Las migraciones se cuentan aparte (migrationCount). */
export type EntryStatus = 'open' | 'done' | 'cancelled'

export interface JournalEntry {
  id: string
  kind: EntryKind
  title: string
  notes?: string
  status: EntryStatus
  scope: PeriodScope
  periodKey: PeriodKey
  /** Estrella: destacada o urgente. */
  priority: boolean
  /** Admiración: idea o inspiración que no quieres perder. */
  inspiration: boolean
  tagIds: string[]
  order: number
  /** Cuántas veces se ha movido de periodo. Alimenta el símbolo `>`. */
  migrationCount: number
  /** Periodo anterior, para poder deshacer el último movimiento. */
  movedFrom?: PeriodKey
  completedAt?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Collection {
  id: string
  name: string
  color: string
  order: number
  createdAt: string
  updatedAt: string
  archivedAt?: string
  deletedAt?: string
}

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Preferences {
  theme: ThemePreference
  hasSeededDefaults: boolean
  /** Avisar de tareas pendientes de días anteriores al abrir el diario. */
  migrationReminders: boolean
  /** Mostrar las entradas cerradas dentro de cada lista. */
  showCompleted: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  hasSeededDefaults: false,
  migrationReminders: true,
  showCompleted: true,
}

export type SyncEntity = 'entry' | 'tag' | 'collection'

export interface PendingOperation {
  id: string
  entity: SyncEntity
  recordId: string
  queuedAt: string
}

export type SyncStatus =
  | 'local-only'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'

export interface AppSnapshot {
  entries: JournalEntry[]
  tags: Tag[]
  collections: Collection[]
  preferences: Preferences
}

export interface BackupData {
  format: 'bullet-journal-backup'
  version: 1
  exportedAt: string
  entries: JournalEntry[]
  tags: Tag[]
  collections: Collection[]
  preferences: Preferences
}

export interface EntryDraft {
  kind: EntryKind
  title: string
  notes?: string
  priority: boolean
  inspiration: boolean
  tagIds: string[]
  scope: PeriodScope
  periodKey: PeriodKey
}

export interface TagDraft {
  name: string
  color: string
}

export interface CollectionDraft {
  name: string
  color: string
}

export type SyncRecord = JournalEntry | Tag | Collection
