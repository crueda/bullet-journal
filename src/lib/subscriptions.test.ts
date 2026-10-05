import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import {
  addMonthsClamped,
  dueDatesBetween,
  duePayments,
  isActive,
  monthlyCost,
  nextDueDate,
  paymentsByDay,
  totalsByCurrency,
} from './subscriptions'

function subscription(patch: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    name: 'Netflix',
    amount: 12,
    currency: 'EUR',
    cycle: 'monthly',
    startDate: '2026-01-31',
    color: '#c2503f',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

describe('addMonthsClamped', () => {
  it('ajusta al último día de meses cortos sin perder el día de anclaje', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30')
    expect(addMonthsClamped('2026-01-31', 4)).toBe('2026-05-31')
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('cruza de año', () => {
    expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15')
  })
})

describe('dueDatesBetween', () => {
  it('devuelve los cobros mensuales del rango', () => {
    expect(dueDatesBetween(subscription({}), '2026-02-01', '2026-05-31'))
      .toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })

  it('no cobra antes de la fecha de inicio', () => {
    expect(dueDatesBetween(subscription({ startDate: '2026-03-10' }), '2026-01-01', '2026-03-31'))
      .toEqual(['2026-03-10'])
  })

  it('respeta la fecha de fin', () => {
    expect(dueDatesBetween(subscription({ startDate: '2026-01-10', endDate: '2026-03-10' }), '2026-01-01', '2026-12-31'))
      .toEqual(['2026-01-10', '2026-02-10', '2026-03-10'])
  })

  it('calcula cobros anuales y trimestrales', () => {
    expect(dueDatesBetween(subscription({ cycle: 'yearly', startDate: '2024-02-29' }), '2025-01-01', '2028-12-31'))
      .toEqual(['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'])
    expect(dueDatesBetween(subscription({ cycle: 'quarterly', startDate: '2026-01-05' }), '2026-01-01', '2026-12-31'))
      .toEqual(['2026-01-05', '2026-04-05', '2026-07-05', '2026-10-05'])
  })

  it('calcula cobros semanales lejos del inicio', () => {
    expect(dueDatesBetween(subscription({ cycle: 'weekly', startDate: '2020-01-06' }), '2026-10-01', '2026-10-14'))
      .toEqual(['2026-10-05', '2026-10-12'])
  })
})

describe('nextDueDate', () => {
  it('incluye el propio día', () => {
    expect(nextDueDate(subscription({ startDate: '2026-01-05' }), '2026-10-05')).toBe('2026-10-05')
    expect(nextDueDate(subscription({ startDate: '2026-01-05' }), '2026-10-06')).toBe('2026-11-05')
  })

  it('no hay próximo cobro si ya terminó', () => {
    const ended = subscription({ startDate: '2026-01-05', endDate: '2026-06-30' })
    expect(nextDueDate(ended, '2026-07-01')).toBeUndefined()
    expect(isActive(ended, '2026-07-01')).toBe(false)
    expect(isActive(ended, '2026-06-01')).toBe(true)
  })
})

describe('agregados', () => {
  it('estima el coste mensual según la periodicidad', () => {
    expect(monthlyCost(subscription({ amount: 120, cycle: 'yearly' }))).toBe(10)
    expect(monthlyCost(subscription({ amount: 30, cycle: 'quarterly' }))).toBe(10)
  })

  it('agrupa los cobros por día e ignora los borrados', () => {
    const items = [
      subscription({ id: 'a', name: 'Spotify', startDate: '2026-01-10' }),
      subscription({ id: 'b', name: 'Gimnasio', startDate: '2026-02-10' }),
      subscription({ id: 'c', name: 'Borrada', startDate: '2026-01-10', deletedAt: '2026-02-01T00:00:00.000Z' }),
    ]
    const byDay = paymentsByDay(items, '2026-10-01', '2026-10-31')
    expect([...byDay.keys()]).toEqual(['2026-10-10'])
    expect(byDay.get('2026-10-10')?.map((item) => item.name)).toEqual(['Gimnasio', 'Spotify'])
    expect(duePayments(items, '2026-10-01', '2026-10-31')).toHaveLength(2)
  })

  it('suma sin mezclar monedas', () => {
    expect(totalsByCurrency([
      { amount: 10, currency: 'EUR' },
      { amount: 5, currency: 'USD' },
      { amount: 2.5, currency: 'EUR' },
    ])).toEqual([['EUR', 12.5], ['USD', 5]])
  })
})
