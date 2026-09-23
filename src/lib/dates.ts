import type { LocalDate } from '../types'

export function toLocalDate(date = new Date()): LocalDate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as LocalDate
}

export function fromLocalDate(value: LocalDate): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

export function addDays(value: LocalDate, amount: number): LocalDate {
  const date = fromLocalDate(value)
  date.setDate(date.getDate() + amount)
  return toLocalDate(date)
}

export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  if (from > to) return []
  const result: LocalDate[] = []
  for (let current = from; current <= to; current = addDays(current, 1)) result.push(current)
  return result
}

export function weekdayFor(value: LocalDate): number {
  return fromLocalDate(value).getDay()
}

/** Lunes = 0 … domingo = 6. */
export function mondayIndex(value: LocalDate): number {
  const weekday = weekdayFor(value)
  return weekday === 0 ? 6 : weekday - 1
}

export function startOfWeek(value: LocalDate): LocalDate {
  return addDays(value, -mondayIndex(value))
}

export function nextMonday(value: LocalDate): LocalDate {
  return addDays(startOfWeek(value), 7)
}

export function formatDate(value: LocalDate, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-ES', options ?? {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromLocalDate(value))
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getGreeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export function relativeDayLabel(value: LocalDate, today = toLocalDate()): string | undefined {
  if (value === today) return 'Hoy'
  if (value === addDays(today, 1)) return 'Mañana'
  if (value === addDays(today, -1)) return 'Ayer'
  return undefined
}
