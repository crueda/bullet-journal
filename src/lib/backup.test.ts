import { describe, expect, it } from 'vitest'
import type { AppSnapshot } from '../types'
import { DEFAULT_PREFERENCES } from '../types'
import { createBackup, createMarkdownReport, parseBackup } from './backup'

const snapshot: AppSnapshot = {
  entries: [
    {
      id: 'e1',
      kind: 'task',
      title: 'Preparar la reunión',
      notes: 'Traer el guion',
      status: 'open',
      scope: 'day',
      periodKey: '2026-09-23',
      priority: true,
      inspiration: false,
      tagIds: ['t1'],
      order: 0,
      migrationCount: 2,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-02T08:00:00.000Z',
    },
    {
      id: 'e2',
      kind: 'note',
      title: 'Idea para el blog',
      status: 'open',
      scope: 'collection',
      periodKey: 'col:c1',
      priority: false,
      inspiration: true,
      tagIds: [],
      order: 0,
      migrationCount: 0,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    },
    {
      id: 'borrada',
      kind: 'task',
      title: 'Ya no está',
      status: 'open',
      scope: 'day',
      periodKey: '2026-09-20',
      priority: false,
      inspiration: false,
      tagIds: [],
      order: 1,
      migrationCount: 0,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
      deletedAt: '2026-09-02T08:00:00.000Z',
    },
  ],
  tags: [{ id: 't1', name: 'Trabajo', color: '#2f6f8f', createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z' }],
  collections: [{ id: 'c1', name: 'Ideas', color: '#7a5bb0', order: 0, createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z' }],
  preferences: { ...DEFAULT_PREFERENCES, hasSeededDefaults: true },
}

describe('createBackup', () => {
  it('excluye lo borrado y conserva el resto', () => {
    const backup = createBackup(snapshot)
    expect(backup.entries.map((entry) => entry.id)).toEqual(['e1', 'e2'])
    expect(backup.format).toBe('bullet-journal-backup')
    expect(backup.version).toBe(1)
  })
})

describe('parseBackup', () => {
  it('acepta una copia recién creada', () => {
    const parsed = parseBackup(JSON.parse(JSON.stringify(createBackup(snapshot))))
    expect(parsed.entries).toHaveLength(2)
    expect(parsed.entries[0]).toMatchObject({ id: 'e1', priority: true, migrationCount: 2 })
    expect(parsed.tags).toHaveLength(1)
  })

  it('rechaza formatos ajenos', () => {
    expect(() => parseBackup({ format: 'otra-app', version: 1 })).toThrow(/compatible/)
  })

  it('rechaza entradas con periodo inválido', () => {
    const backup = createBackup(snapshot)
    const broken = { ...backup, entries: [{ ...backup.entries[0], periodKey: 'mañana' }] }
    expect(() => parseBackup(JSON.parse(JSON.stringify(broken)))).toThrow(/entradas no válidas/)
  })

  it('rechaza entradas de una colección inexistente', () => {
    const backup = createBackup(snapshot)
    const broken = { ...backup, collections: [] }
    expect(() => parseBackup(JSON.parse(JSON.stringify(broken)))).toThrow(/entradas no válidas/)
  })

  it('descarta etiquetas que ya no existen', () => {
    const backup = createBackup(snapshot)
    const orphan = { ...backup, tags: [] }
    expect(parseBackup(JSON.parse(JSON.stringify(orphan))).entries[0].tagIds).toEqual([])
  })
})

describe('createMarkdownReport', () => {
  it('escribe una sección por escala y las colecciones', () => {
    const report = createMarkdownReport(snapshot)
    expect(report).toContain('# Bitácora')
    expect(report).toContain('## Colecciones')
    expect(report).toContain('Idea para el blog')
  })
})
