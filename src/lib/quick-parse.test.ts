import { describe, expect, it } from 'vitest'
import type { Tag } from '../types'
import { parseQuickEntry } from './quick-parse'

const tags: Tag[] = [
  { id: 't1', name: 'Trabajo', color: '#2f6f8f', createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z' },
]

describe('parseQuickEntry', () => {
  it('deja el texto intacto cuando no hay atajos', () => {
    expect(parseQuickEntry('Comprar pan', tags)).toMatchObject({
      title: 'Comprar pan',
      kind: 'task',
      priority: false,
      inspiration: false,
    })
  })

  it('entiende las marcas iniciales', () => {
    expect(parseQuickEntry('*! Llamar al banco', tags)).toMatchObject({
      title: 'Llamar al banco',
      priority: true,
      inspiration: true,
    })
    expect(parseQuickEntry('- Idea suelta', tags).kind).toBe('note')
    expect(parseQuickEntry('o Cita con Ana', tags)).toMatchObject({ kind: 'event', title: 'Cita con Ana' })
  })

  it('asocia etiquetas existentes y propone las nuevas', () => {
    const parsed = parseQuickEntry('Revisar informe #trabajo #clientes', tags)
    expect(parsed.title).toBe('Revisar informe')
    expect(parsed.tagIds).toEqual(['t1'])
    expect(parsed.newTagNames).toEqual(['clientes'])
  })

  it('no confunde una almohadilla dentro de una palabra', () => {
    expect(parseQuickEntry('Leer C#', tags)).toMatchObject({ title: 'Leer C#', tagIds: [], newTagNames: [] })
  })
})
