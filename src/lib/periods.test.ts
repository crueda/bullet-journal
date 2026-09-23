import { describe, expect, it } from 'vitest'
import type { LocalDate } from '../types'
import {
  collectionIdOf,
  collectionKey,
  containsDay,
  containsKey,
  firstDayOf,
  isPastPeriod,
  isPeriodKey,
  keyForScope,
  lastDayOf,
  monthGrid,
  moveTargets,
  periodLabel,
  periodSubtitle,
  quarterKey,
  scopeOf,
  shiftPeriod,
} from './periods'

const TODAY = '2026-09-23' as LocalDate

describe('scopeOf', () => {
  it('reconoce cada formato de clave', () => {
    expect(scopeOf('2026-09-23')).toBe('day')
    expect(scopeOf('2026-09')).toBe('month')
    expect(scopeOf('2026-Q3')).toBe('quarter')
    expect(scopeOf('2026')).toBe('year')
    expect(scopeOf('col:abc')).toBe('collection')
  })

  it('rechaza claves inventadas', () => {
    expect(() => scopeOf('septiembre')).toThrow()
    expect(isPeriodKey('2026-Q5')).toBe(false)
    expect(isPeriodKey('col:')).toBe(false)
  })
})

describe('shiftPeriod', () => {
  it('avanza y retrocede en cada escala', () => {
    expect(shiftPeriod('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01')
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12')
    expect(shiftPeriod('2026-Q4', 1)).toBe('2027-Q1')
    expect(shiftPeriod('2026-Q1', -1)).toBe('2025-Q4')
    expect(shiftPeriod('2026', 1)).toBe('2027')
  })
})

describe('límites del periodo', () => {
  it('calcula el primer y el último día', () => {
    expect(firstDayOf('2026-Q3')).toBe('2026-07-01')
    expect(lastDayOf('2026-Q3')).toBe('2026-09-30')
    expect(lastDayOf('2026-02')).toBe('2026-02-28')
    expect(lastDayOf('2024-02')).toBe('2024-02-29')
    expect(lastDayOf('2026')).toBe('2026-12-31')
  })

  it('sabe qué contiene cada periodo', () => {
    expect(containsDay('2026-Q3', TODAY)).toBe(true)
    expect(containsDay('2026-Q2', TODAY)).toBe(false)
    expect(containsKey('2026', '2026-Q3')).toBe(true)
    expect(containsKey('2026-Q3', '2026-09-23')).toBe(true)
    expect(containsKey('2026-09-23', '2026')).toBe(false)
    expect(containsKey('2026', 'col:x')).toBe(false)
  })

  it('detecta periodos ya cerrados', () => {
    expect(isPastPeriod('2026-08', TODAY)).toBe(true)
    expect(isPastPeriod('2026-09', TODAY)).toBe(false)
    expect(isPastPeriod('col:x', TODAY)).toBe(false)
  })
})

describe('keyForScope', () => {
  it('sube y baja de escala manteniendo el momento', () => {
    expect(keyForScope('2026-09-23', 'month', TODAY)).toBe('2026-09')
    expect(keyForScope('2026-09-23', 'quarter', TODAY)).toBe('2026-Q3')
    expect(keyForScope('2026-Q3', 'day', TODAY)).toBe('2026-09-23')
    expect(keyForScope('2026-Q1', 'day', TODAY)).toBe('2026-01-01')
  })
})

describe('moveTargets', () => {
  it('propone destinos útiles y nunca el periodo de origen', () => {
    const targets = moveTargets(TODAY, TODAY)
    expect(targets.map((target) => target.key)).not.toContain(TODAY)
    expect(targets.map((target) => target.key)).toContain('2026-09-24')
    expect(targets.map((target) => target.key)).toContain('2026-09')
    expect(targets.map((target) => target.key)).toContain('2026-Q4')
    expect(new Set(targets.map((target) => target.key)).size).toBe(targets.length)
  })

  it('desde una colección usa el día de hoy como referencia', () => {
    const targets = moveTargets(collectionKey('ideas'), TODAY)
    expect(targets[0]).toMatchObject({ key: TODAY, label: 'Hoy' })
  })
})

describe('etiquetas legibles', () => {
  it('describe los periodos en español', () => {
    expect(periodLabel(TODAY, TODAY)).toContain('Hoy')
    expect(periodLabel('2026-09', TODAY)).toBe('Septiembre 2026')
    expect(periodLabel('2026-Q3', TODAY)).toBe('T3 2026')
    expect(periodSubtitle('2026-Q3')).toBe('jul – sep')
  })
})

describe('colecciones', () => {
  it('convierte ida y vuelta el identificador', () => {
    expect(collectionIdOf(collectionKey('abc'))).toBe('abc')
    expect(collectionIdOf('2026-09')).toBeUndefined()
  })
})

describe('monthGrid', () => {
  it('coloca los días de lunes a domingo', () => {
    const grid = monthGrid('2026-09')
    expect(grid).toHaveLength(42)
    // El 1 de septiembre de 2026 es martes: la primera celda queda vacía.
    expect(grid[0]).toBeUndefined()
    expect(grid[1]).toBe('2026-09-01')
    expect(grid.filter(Boolean)).toHaveLength(30)
  })
})

describe('quarterKey', () => {
  it('agrupa los meses de tres en tres', () => {
    expect(quarterKey('2026-01-15' as LocalDate)).toBe('2026-Q1')
    expect(quarterKey('2026-04-01' as LocalDate)).toBe('2026-Q2')
    expect(quarterKey('2026-12-31' as LocalDate)).toBe('2026-Q4')
  })
})
