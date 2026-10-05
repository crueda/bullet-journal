import type { BillingCycle, LocalDate, Subscription } from '../types'
import { addDays, fromLocalDate, toLocalDate } from './dates'

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

/** Sufijo corto para mostrar junto al importe: «12 € / mes». */
export const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  weekly: 'semana',
  monthly: 'mes',
  quarterly: 'trimestre',
  yearly: 'año',
}

export const CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly']
export const CURRENCIES = ['EUR', 'USD', 'GBP'] as const

const MONTHS_PER_CYCLE: Record<Exclude<BillingCycle, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

/** Cuánto pesa cada ciclo en un mes, para estimar el gasto mensual. */
const MONTHLY_FACTOR: Record<BillingCycle, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0, 12).getDate()
}

/**
 * Suma meses respetando el día de anclaje: un cobro el 31 cae el 30 en
 * abril y el 28/29 en febrero, pero vuelve al 31 en mayo.
 */
export function addMonthsClamped(anchor: LocalDate, months: number): LocalDate {
  const [year, month, day] = anchor.split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1, 12)
  const clamped = Math.min(day, daysInMonth(target.getFullYear(), target.getMonth()))
  target.setDate(clamped)
  return toLocalDate(target)
}

function monthsBetween(from: LocalDate, to: LocalDate): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

function dueDateAt(subscription: Subscription, index: number): LocalDate {
  if (subscription.cycle === 'weekly') return addDays(subscription.startDate, index * 7)
  return addMonthsClamped(subscription.startDate, index * MONTHS_PER_CYCLE[subscription.cycle])
}

/** Primer índice de cobro que podría caer en `from` o después, sin recorrer todo el historial. */
function firstIndexNear(subscription: Subscription, from: LocalDate): number {
  if (from <= subscription.startDate) return 0
  if (subscription.cycle === 'weekly') {
    const days = Math.round((fromLocalDate(from).getTime() - fromLocalDate(subscription.startDate).getTime()) / 86_400_000)
    return Math.max(0, Math.floor(days / 7) - 1)
  }
  return Math.max(0, Math.floor(monthsBetween(subscription.startDate, from) / MONTHS_PER_CYCLE[subscription.cycle]) - 1)
}

/** Fechas de cobro entre `from` y `to`, ambas incluidas. */
export function dueDatesBetween(subscription: Subscription, from: LocalDate, to: LocalDate): LocalDate[] {
  const last = subscription.endDate && subscription.endDate < to ? subscription.endDate : to
  const result: LocalDate[] = []
  for (let index = firstIndexNear(subscription, from); ; index++) {
    const date = dueDateAt(subscription, index)
    if (date > last) break
    if (date >= from) result.push(date)
  }
  return result
}

export function nextDueDate(subscription: Subscription, today: LocalDate): LocalDate | undefined {
  for (let index = firstIndexNear(subscription, today); ; index++) {
    const date = dueDateAt(subscription, index)
    if (subscription.endDate && date > subscription.endDate) return undefined
    if (date >= today) return date
  }
}

export function liveSubscriptions(subscriptions: Subscription[]): Subscription[] {
  return subscriptions
    .filter((subscription) => !subscription.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Sigue cobrándose: no tiene fecha de fin o aún queda algún cobro por delante. */
export function isActive(subscription: Subscription, today: LocalDate): boolean {
  return !subscription.deletedAt && nextDueDate(subscription, today) !== undefined
}

export function monthlyCost(subscription: Subscription): number {
  return subscription.amount * MONTHLY_FACTOR[subscription.cycle]
}

export interface DuePayment {
  date: LocalDate
  subscription: Subscription
}

/** Cobros de todas las suscripciones en un rango, ordenados por fecha. */
export function duePayments(subscriptions: Subscription[], from: LocalDate, to: LocalDate): DuePayment[] {
  return liveSubscriptions(subscriptions)
    .flatMap((subscription) => dueDatesBetween(subscription, from, to).map((date) => ({ date, subscription })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.subscription.name.localeCompare(b.subscription.name, 'es'))
}

export function paymentsByDay(subscriptions: Subscription[], from: LocalDate, to: LocalDate): Map<LocalDate, Subscription[]> {
  const result = new Map<LocalDate, Subscription[]>()
  for (const { date, subscription } of duePayments(subscriptions, from, to)) {
    result.set(date, [...(result.get(date) ?? []), subscription])
  }
  return result
}

/** Suma importes agrupando por moneda, para no mezclar euros con dólares. */
export function totalsByCurrency(items: Array<{ amount: number; currency: string }>): Array<[string, number]> {
  const totals = new Map<string, number>()
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount)
  return [...totals.entries()]
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
}

export function formatTotals(totals: Array<[string, number]>): string {
  return totals.length ? totals.map(([currency, amount]) => formatMoney(amount, currency)).join(' + ') : formatMoney(0, 'EUR')
}
