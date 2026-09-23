import type { LocalDate, PeriodKey, PeriodScope } from '../types'
import { addDays, capitalize, fromLocalDate, nextMonday, relativeDayLabel, toLocalDate } from './dates'

export const COLLECTION_PREFIX = 'col:'

export const PERIOD_SCOPES: PeriodScope[] = ['day', 'month', 'quarter', 'year']

export const SCOPE_LABELS: Record<PeriodScope, string> = {
  day: 'Día',
  month: 'Mes',
  quarter: 'Trimestre',
  year: 'Año',
  collection: 'Colección',
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/
const QUARTER_PATTERN = /^\d{4}-Q[1-4]$/
const YEAR_PATTERN = /^\d{4}$/

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function scopeOf(key: PeriodKey): PeriodScope {
  if (key.startsWith(COLLECTION_PREFIX)) return 'collection'
  if (DAY_PATTERN.test(key)) return 'day'
  if (QUARTER_PATTERN.test(key)) return 'quarter'
  if (MONTH_PATTERN.test(key)) return 'month'
  if (YEAR_PATTERN.test(key)) return 'year'
  throw new Error(`Clave de periodo no válida: ${key}`)
}

export function isPeriodKey(value: unknown): value is PeriodKey {
  if (typeof value !== 'string' || !value) return false
  if (value.startsWith(COLLECTION_PREFIX)) return value.length > COLLECTION_PREFIX.length
  return DAY_PATTERN.test(value) || MONTH_PATTERN.test(value) || QUARTER_PATTERN.test(value) || YEAR_PATTERN.test(value)
}

export function collectionKey(collectionId: string): PeriodKey {
  return `${COLLECTION_PREFIX}${collectionId}`
}

export function collectionIdOf(key: PeriodKey): string | undefined {
  return key.startsWith(COLLECTION_PREFIX) ? key.slice(COLLECTION_PREFIX.length) : undefined
}

export function quarterOfMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1
}

export function dayKey(date: Date | LocalDate = new Date()): PeriodKey {
  return typeof date === 'string' ? date : toLocalDate(date)
}

export function monthKey(date: Date | LocalDate = new Date()): PeriodKey {
  const value = dayKey(date)
  return value.slice(0, 7)
}

export function quarterKey(date: Date | LocalDate = new Date()): PeriodKey {
  const value = dayKey(date)
  const [year, month] = value.split('-').map(Number)
  return `${year}-Q${quarterOfMonth(month)}`
}

export function yearKey(date: Date | LocalDate = new Date()): PeriodKey {
  return dayKey(date).slice(0, 4)
}

export function currentKey(scope: PeriodScope, today: LocalDate = toLocalDate()): PeriodKey {
  switch (scope) {
    case 'day': return dayKey(today)
    case 'month': return monthKey(today)
    case 'quarter': return quarterKey(today)
    case 'year': return yearKey(today)
    default: throw new Error('Las colecciones no tienen periodo actual.')
  }
}

/** Primer día del periodo, útil para convertir entre escalas. */
export function firstDayOf(key: PeriodKey): LocalDate {
  const scope = scopeOf(key)
  switch (scope) {
    case 'day': return key as LocalDate
    case 'month': return `${key}-01` as LocalDate
    case 'quarter': {
      const [year, quarter] = key.split('-Q').map(Number)
      return `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01` as LocalDate
    }
    case 'year': return `${key}-01-01` as LocalDate
    default: throw new Error('Una colección no tiene fechas.')
  }
}

export function lastDayOf(key: PeriodKey): LocalDate {
  const scope = scopeOf(key)
  if (scope === 'day') return key as LocalDate
  const first = fromLocalDate(firstDayOf(key))
  const months = scope === 'month' ? 1 : scope === 'quarter' ? 3 : 12
  const end = new Date(first.getFullYear(), first.getMonth() + months, 0, 12)
  return toLocalDate(end)
}

/** Convierte una clave a la escala indicada conservando el momento del calendario. */
export function keyForScope(key: PeriodKey, scope: PeriodScope, today: LocalDate = toLocalDate()): PeriodKey {
  if (scope === 'collection') throw new Error('Usa collectionKey() para las colecciones.')
  if (scopeOf(key) === 'collection') return currentKey(scope, today)
  const reference = containsDay(key, today) ? today : firstDayOf(key)
  switch (scope) {
    case 'day': return dayKey(reference)
    case 'month': return monthKey(reference)
    case 'quarter': return quarterKey(reference)
    case 'year': return yearKey(reference)
  }
}

/** Periodo inmediatamente superior: día → mes → trimestre → año. */
export function parentKey(key: PeriodKey): PeriodKey | undefined {
  switch (scopeOf(key)) {
    case 'day': return monthKey(key as LocalDate)
    case 'month': return quarterKey(firstDayOf(key))
    case 'quarter': return yearKey(firstDayOf(key))
    default: return undefined
  }
}

export function shiftPeriod(key: PeriodKey, delta: number): PeriodKey {
  const scope = scopeOf(key)
  switch (scope) {
    case 'day': return addDays(key as LocalDate, delta)
    case 'month': {
      const [year, month] = key.split('-').map(Number)
      const shifted = new Date(year, month - 1 + delta, 1, 12)
      return monthKey(toLocalDate(shifted))
    }
    case 'quarter': {
      const [year, quarter] = key.split('-Q').map(Number)
      const total = year * 4 + (quarter - 1) + delta
      return `${Math.floor(total / 4)}-Q${(total % 4) + 1}`
    }
    case 'year': return String(Number(key) + delta)
    default: return key
  }
}

export function containsDay(key: PeriodKey, day: LocalDate): boolean {
  const scope = scopeOf(key)
  if (scope === 'collection') return false
  return day >= firstDayOf(key) && day <= lastDayOf(key)
}

/** ¿`childKey` cae dentro de `key`? Sirve para los recuentos agregados. */
export function containsKey(key: PeriodKey, childKey: PeriodKey): boolean {
  if (key === childKey) return true
  const scope = scopeOf(key)
  const childScope = scopeOf(childKey)
  if (scope === 'collection' || childScope === 'collection') return false
  const order: PeriodScope[] = ['day', 'month', 'quarter', 'year']
  if (order.indexOf(childScope) >= order.indexOf(scope)) return false
  return containsDay(key, firstDayOf(childKey))
}

export function isCurrentPeriod(key: PeriodKey, today: LocalDate = toLocalDate()): boolean {
  const scope = scopeOf(key)
  if (scope === 'collection') return true
  return key === currentKey(scope, today)
}

export function isPastPeriod(key: PeriodKey, today: LocalDate = toLocalDate()): boolean {
  if (scopeOf(key) === 'collection') return false
  return lastDayOf(key) < today
}

export function periodLabel(key: PeriodKey, today: LocalDate = toLocalDate()): string {
  const scope = scopeOf(key)
  switch (scope) {
    case 'day': {
      const relative = relativeDayLabel(key as LocalDate, today)
      const date = fromLocalDate(key as LocalDate)
      const sameYear = date.getFullYear() === fromLocalDate(today).getFullYear()
      const formatted = capitalize(new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        ...(sameYear ? {} : { year: 'numeric' }),
      }).format(date))
      return relative ? `${relative} · ${formatted}` : formatted
    }
    case 'month': {
      const [year, month] = key.split('-').map(Number)
      return `${capitalize(MONTH_NAMES[month - 1])} ${year}`
    }
    case 'quarter': {
      const [year, quarter] = key.split('-Q').map(Number)
      return `T${quarter} ${year}`
    }
    case 'year': return key
    default: return 'Colección'
  }
}

export function periodSubtitle(key: PeriodKey): string | undefined {
  const scope = scopeOf(key)
  if (scope === 'quarter') {
    const [, quarter] = key.split('-Q').map(Number)
    const first = (quarter - 1) * 3
    return `${MONTH_SHORT[first]} – ${MONTH_SHORT[first + 2]}`
  }
  if (scope === 'year') {
    return 'Objetivos y planes del año'
  }
  if (scope === 'month') {
    const [year, month] = key.split('-').map(Number)
    return `T${quarterOfMonth(month)} · ${year}`
  }
  return undefined
}

export function periodShortLabel(key: PeriodKey, today: LocalDate = toLocalDate()): string {
  const scope = scopeOf(key)
  switch (scope) {
    case 'day': {
      const relative = relativeDayLabel(key as LocalDate, today)
      if (relative) return relative
      const [, month, day] = key.split('-').map(Number)
      return `${day} ${MONTH_SHORT[month - 1]}`
    }
    case 'month': {
      const [year, month] = key.split('-').map(Number)
      return `${capitalize(MONTH_SHORT[month - 1])} ${year}`
    }
    case 'quarter': return key.replace('-Q', ' · T')
    case 'year': return key
    default: return 'Colección'
  }
}

export interface MoveTarget {
  key: PeriodKey
  scope: PeriodScope
  label: string
  hint?: string
}

/**
 * Destinos rápidos al migrar una entrada desde `from`.
 * Se toman como referencia el propio día (si `from` es un día) o el día de hoy
 * cuando ya estamos dentro del periodo; así «mañana» siempre significa algo útil.
 */
export function moveTargets(from: PeriodKey, today: LocalDate = toLocalDate()): MoveTarget[] {
  const scope = scopeOf(from)
  const base: LocalDate = scope === 'day'
    ? (from as LocalDate)
    : scope === 'collection' || containsDay(from, today)
      ? today
      : firstDayOf(from)

  const tomorrow = addDays(base, 1)
  const monday = nextMonday(base)
  const thisMonth = monthKey(base)
  const thisQuarter = quarterKey(base)
  const thisYear = yearKey(base)

  const candidates: MoveTarget[] = [
    { key: today, scope: 'day', label: 'Hoy', hint: periodShortLabel(today, today) },
    { key: tomorrow, scope: 'day', label: 'Mañana', hint: periodShortLabel(tomorrow, today) },
    { key: monday, scope: 'day', label: 'Próximo lunes', hint: periodShortLabel(monday, today) },
    { key: thisMonth, scope: 'month', label: 'Este mes', hint: periodLabel(thisMonth, today) },
    {
      key: shiftPeriod(thisMonth, 1),
      scope: 'month',
      label: 'Mes que viene',
      hint: periodLabel(shiftPeriod(thisMonth, 1), today),
    },
    { key: thisQuarter, scope: 'quarter', label: 'Este trimestre', hint: periodLabel(thisQuarter, today) },
    {
      key: shiftPeriod(thisQuarter, 1),
      scope: 'quarter',
      label: 'Trimestre siguiente',
      hint: periodLabel(shiftPeriod(thisQuarter, 1), today),
    },
    { key: thisYear, scope: 'year', label: 'Este año', hint: thisYear },
    { key: shiftPeriod(thisYear, 1), scope: 'year', label: 'Año que viene', hint: shiftPeriod(thisYear, 1) },
  ]

  const seen = new Set<PeriodKey>([from])
  return candidates.filter((target) => !seen.has(target.key) && seen.add(target.key))
}

/** Celdas de un mes en cuadrícula de lunes a domingo. */
export function monthGrid(key: PeriodKey): Array<LocalDate | undefined> {
  const first = firstDayOf(key)
  const last = lastDayOf(key)
  const firstDate = fromLocalDate(first)
  const weekday = firstDate.getDay()
  const leading = weekday === 0 ? 6 : weekday - 1
  const total = Number(last.slice(8))
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - leading + 1
    if (day < 1 || day > total) return undefined
    return addDays(first, day - 1)
  })
}
