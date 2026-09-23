import { describe, expect, it } from 'vitest'
import type { JournalEntry, LocalDate, PeriodKey } from '../types'
import {
  bulletSymbol,
  closedDayStreak,
  countsFor,
  dayCounts,
  entriesFor,
  mostMigrated,
  nextOrder,
  overdueEntries,
  searchEntries,
  stalePeriodEntries,
} from './entries'
import { scopeOf } from './periods'

const TODAY = '2026-09-23' as LocalDate

function entry(overrides: Partial<JournalEntry> & { id: string; periodKey: PeriodKey }): JournalEntry {
  return {
    kind: 'task',
    title: overrides.id,
    status: 'open',
    scope: scopeOf(overrides.periodKey),
    priority: false,
    inspiration: false,
    tagIds: [],
    order: 0,
    migrationCount: 0,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    ...overrides,
  }
}

describe('bulletSymbol', () => {
  it('usa el símbolo clásico de cada estado', () => {
    expect(bulletSymbol(entry({ id: 'a', periodKey: TODAY }))).toBe('•')
    expect(bulletSymbol(entry({ id: 'b', periodKey: TODAY, status: 'done' }))).toBe('×')
    expect(bulletSymbol(entry({ id: 'c', periodKey: TODAY, migrationCount: 2 }))).toBe('›')
    expect(bulletSymbol(entry({ id: 'd', periodKey: TODAY, kind: 'event' }))).toBe('○')
    expect(bulletSymbol(entry({ id: 'e', periodKey: TODAY, kind: 'note' }))).toBe('—')
  })
})

describe('entriesFor', () => {
  const entries = [
    entry({ id: 'b', periodKey: TODAY, order: 1 }),
    entry({ id: 'a', periodKey: TODAY, order: 0 }),
    entry({ id: 'otro', periodKey: '2026-09' }),
    entry({ id: 'borrada', periodKey: TODAY, order: 2, deletedAt: '2026-09-02T08:00:00.000Z' }),
  ]

  it('filtra por periodo, ordena y descarta lápidas', () => {
    expect(entriesFor(entries, TODAY).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('asigna la siguiente posición libre', () => {
    expect(nextOrder(entries, TODAY)).toBe(2)
    expect(nextOrder(entries, '2026-12')).toBe(0)
  })

  it('cuenta estados', () => {
    const counts = countsFor([
      entry({ id: '1', periodKey: TODAY, status: 'done' }),
      entry({ id: '2', periodKey: TODAY, status: 'cancelled' }),
      entry({ id: '3', periodKey: TODAY, migrationCount: 1 }),
    ], TODAY)
    expect(counts).toMatchObject({ total: 3, done: 1, cancelled: 1, open: 1, migrated: 1, percentage: 67 })
  })
})

describe('pendientes atrasadas', () => {
  const entries = [
    entry({ id: 'ayer', periodKey: '2026-09-22' }),
    entry({ id: 'anteayer-hecha', periodKey: '2026-09-21', status: 'done' }),
    entry({ id: 'nota-vieja', periodKey: '2026-09-20', kind: 'note' }),
    entry({ id: 'hoy', periodKey: TODAY }),
    entry({ id: 'mes-pasado', periodKey: '2026-08' }),
    entry({ id: 'mes-actual', periodKey: '2026-09' }),
  ]

  it('solo trae tareas abiertas de días anteriores', () => {
    expect(overdueEntries(entries, TODAY).map((item) => item.id)).toEqual(['ayer'])
  })

  it('detecta periodos largos ya cerrados', () => {
    expect(stalePeriodEntries(entries, TODAY).map((item) => item.id)).toEqual(['mes-pasado'])
  })
})

describe('dayCounts', () => {
  it('agrupa por día dentro del mes', () => {
    const counts = dayCounts([
      entry({ id: '1', periodKey: '2026-09-01' }),
      entry({ id: '2', periodKey: '2026-09-01', status: 'done' }),
      entry({ id: '3', periodKey: '2026-10-01' }),
    ], '2026-09')
    expect(counts.get('2026-09-01' as LocalDate)).toEqual({ open: 1, done: 1, total: 2 })
    expect(counts.has('2026-10-01' as LocalDate)).toBe(false)
  })
})

describe('searchEntries', () => {
  const entries = [
    entry({ id: '1', periodKey: TODAY, title: 'Llamar a la gestoría' }),
    entry({ id: '2', periodKey: '2026-09', title: 'Revisar informe', notes: 'Con la GESTORIA' }),
    entry({ id: '3', periodKey: '2026', title: 'Viaje', status: 'done' }),
  ]

  it('ignora mayúsculas y tildes y busca también en las notas', () => {
    expect(searchEntries(entries, { query: 'gestoria' }).map((item) => item.id).sort()).toEqual(['1', '2'])
  })

  it('filtra por estado', () => {
    expect(searchEntries(entries, { query: '', status: 'done' }).map((item) => item.id)).toEqual(['3'])
  })
})

describe('métricas', () => {
  it('cuenta días cerrados seguidos', () => {
    const entries = [
      entry({ id: '1', periodKey: '2026-09-22', status: 'done' }),
      entry({ id: '2', periodKey: '2026-09-21', status: 'cancelled' }),
      entry({ id: '3', periodKey: '2026-09-20' }),
    ]
    expect(closedDayStreak(entries, TODAY)).toBe(2)
  })

  it('destaca lo que más se ha aplazado', () => {
    const entries = [
      entry({ id: 'mucho', periodKey: TODAY, migrationCount: 5 }),
      entry({ id: 'poco', periodKey: TODAY, migrationCount: 1 }),
      entry({ id: 'cerrada', periodKey: TODAY, migrationCount: 9, status: 'done' }),
    ]
    expect(mostMigrated(entries).map((item) => item.id)).toEqual(['mucho', 'poco'])
  })
})
