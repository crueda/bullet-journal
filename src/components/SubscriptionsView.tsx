import { useState } from 'react'
import { CirclePlus, Pencil, Trash2 } from 'lucide-react'
import type { BillingCycle, LocalDate, Subscription, SubscriptionDraft } from '../types'
import {
  CURRENCIES,
  CYCLE_LABELS,
  CYCLE_SUFFIX,
  CYCLES,
  duePayments,
  formatMoney,
  formatTotals,
  isActive,
  liveSubscriptions,
  monthlyCost,
  nextDueDate,
  totalsByCurrency,
  type DuePayment,
} from '../lib/subscriptions'
import { addDays, capitalize, formatDate, relativeDayLabel, toLocalDate } from '../lib/dates'
import { nextColor, PALETTE } from '../lib/colors'
import { useJournal } from '../state/JournalContext'
import { Sheet } from './Sheet'

const UPCOMING_DAYS = 30

function dueLabel(date: LocalDate, today: LocalDate): string {
  return relativeDayLabel(date, today) ?? capitalize(formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' }))
}

interface PaymentListProps {
  payments: DuePayment[]
  today: LocalDate
  /** Oculta la fecha cuando todos los cobros son del mismo día. */
  hideDate?: boolean
  onOpen: (subscription: Subscription) => void
}

/** Lista de cobros con fecha, para la vista de pagos y el calendario. */
export function PaymentList({ payments, today, hideDate, onOpen }: PaymentListProps) {
  return (
    <ul className="payment-list">
      {payments.map(({ date, subscription }) => (
        <li key={`${subscription.id}-${date}`}>
          <button
            className={`payment-row ${date < today ? 'past' : ''}`}
            type="button"
            onClick={() => onOpen(subscription)}
          >
            <span className="collection-dot" style={{ background: subscription.color }} />
            <span className="payment-name">
              <strong>{subscription.name}</strong>
              {!hideDate && <small>{dueLabel(date, today)}</small>}
            </span>
            <span className="payment-amount">{formatMoney(subscription.amount, subscription.currency)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function SubscriptionsView() {
  const { subscriptions } = useJournal()
  const today = toLocalDate()
  const [editor, setEditor] = useState<{ open: boolean; subscription?: Subscription }>({ open: false })

  const all = liveSubscriptions(subscriptions)
  const active = all.filter((subscription) => isActive(subscription, today))
  const ended = all.filter((subscription) => !isActive(subscription, today))
  const upcoming = duePayments(subscriptions, today, addDays(today, UPCOMING_DAYS - 1))
  const monthly = totalsByCurrency(active.map((subscription) => ({
    amount: monthlyCost(subscription),
    currency: subscription.currency,
  })))
  const yearly = monthly.map(([currency, amount]): [string, number] => [currency, amount * 12])

  const open = (subscription?: Subscription) => setEditor({ open: true, subscription })

  const renderSubscription = (subscription: Subscription) => {
    const next = nextDueDate(subscription, today)
    return (
      <li key={subscription.id} className="collection-row">
        <button className="collection-main" type="button" onClick={() => open(subscription)}>
          <span className="collection-dot" style={{ background: subscription.color }} />
          <span className="collection-name">
            <strong>{subscription.name}</strong>
            <small>
              {formatMoney(subscription.amount, subscription.currency)} / {CYCLE_SUFFIX[subscription.cycle]}
              {' · '}
              {next ? `próximo: ${dueLabel(next, today).toLowerCase()}` : 'finalizado'}
            </small>
          </span>
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label={`Editar ${subscription.name}`}
          onClick={() => open(subscription)}
        >
          <Pencil size={16} />
        </button>
      </li>
    )
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h2>Pagos recurrentes</h2>
        <button className="primary-button compact" type="button" onClick={() => open()}>
          <CirclePlus size={17} /> Nuevo
        </button>
      </div>
      <p className="hint">
        Suscripciones, cuotas y seguros. Sus vencimientos aparecen en el calendario del mes y en cada día.
      </p>

      {active.length > 0 && (
        <div className="payment-summary">
          <div>
            <small>Al mes (estimado)</small>
            <strong>{formatTotals(monthly)}</strong>
          </div>
          <div>
            <small>Al año</small>
            <strong>{formatTotals(yearly)}</strong>
          </div>
          <div>
            <small>Activos</small>
            <strong>{active.length}</strong>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="stack tight">
          <h3 className="field-label">Próximos {UPCOMING_DAYS} días</h3>
          <PaymentList payments={upcoming} today={today} onOpen={open} />
        </section>
      )}

      <section className="stack tight">
        <h3 className="field-label">Todos</h3>
        {active.length ? <ul className="collection-list">{active.map(renderSubscription)}</ul> : (
          <p className="empty-state">Todavía no tienes pagos recurrentes.</p>
        )}
      </section>

      {ended.length > 0 && (
        <details className="archived">
          <summary>{ended.length} {ended.length === 1 ? 'finalizado' : 'finalizados'}</summary>
          <ul className="collection-list">{ended.map(renderSubscription)}</ul>
        </details>
      )}

      {editor.open && (
        <SubscriptionEditor subscription={editor.subscription} onClose={() => setEditor({ open: false })} />
      )}
    </div>
  )
}

interface SubscriptionEditorProps {
  subscription?: Subscription
  /** Fecha de primer cobro propuesta al crear uno nuevo. */
  defaultDate?: LocalDate
  onClose: () => void
}

export function SubscriptionEditor({ subscription, defaultDate, onClose }: SubscriptionEditorProps) {
  const { subscriptions, createSubscription, updateSubscription, deleteSubscription } = useJournal()
  const today = toLocalDate()
  const [name, setName] = useState(subscription?.name ?? '')
  const [amount, setAmount] = useState(subscription ? String(subscription.amount).replace('.', ',') : '')
  const [currency, setCurrency] = useState(subscription?.currency ?? 'EUR')
  const [cycle, setCycle] = useState<BillingCycle>(subscription?.cycle ?? 'monthly')
  const [startDate, setStartDate] = useState<string>(subscription?.startDate ?? defaultDate ?? today)
  const [endDate, setEndDate] = useState<string>(subscription?.endDate ?? '')
  const [color, setColor] = useState(
    subscription?.color ?? nextColor(liveSubscriptions(subscriptions).map((item) => item.color)),
  )
  const [notes, setNotes] = useState(subscription?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const parsedAmount = Number(amount.replace(',', '.'))
  const validAmount = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount >= 0
  const validEnd = !endDate || endDate >= startDate
  const valid = Boolean(name.trim()) && validAmount && Boolean(startDate) && validEnd

  const save = async () => {
    const draft: SubscriptionDraft = {
      name,
      amount: parsedAmount,
      currency,
      cycle,
      startDate: startDate as LocalDate,
      endDate: endDate ? endDate as LocalDate : undefined,
      color,
      notes,
    }
    if (subscription) await updateSubscription(subscription.id, draft)
    else await createSubscription(draft)
    onClose()
  }

  return (
    <Sheet
      title={subscription ? 'Editar pago' : 'Nuevo pago recurrente'}
      onClose={onClose}
      footer={(
        <>
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="button" disabled={!valid} onClick={() => void save()}>
            Guardar
          </button>
        </>
      )}
    >
      <label className="field">
        <span className="field-label">Nombre</span>
        <input
          autoFocus
          value={name}
          maxLength={80}
          placeholder="Netflix, gimnasio, seguro del coche…"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div className="field-pair">
        <label className="field">
          <span className="field-label">Importe</span>
          <input
            value={amount}
            inputMode="decimal"
            placeholder="0,00"
            aria-invalid={amount.trim() !== '' && !validAmount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Moneda</span>
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
      </div>

      <div className="field">
        <span className="field-label">Periodicidad</span>
        <div className="chip-row">
          {CYCLES.map((option) => (
            <button
              key={option}
              className={option === cycle ? 'chip active' : 'chip'}
              type="button"
              aria-pressed={option === cycle}
              onClick={() => setCycle(option)}
            >
              {CYCLE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="field-pair">
        <label className="field">
          <span className="field-label">Primer cobro</span>
          <input type="date" value={startDate} required onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Fin (opcional)</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            aria-invalid={!validEnd}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      </div>
      {!validEnd && <p className="notice error">La fecha de fin no puede ser anterior al primer cobro.</p>}

      <div className="field">
        <span className="field-label">Color</span>
        <div className="color-row">
          {PALETTE.map((option) => (
            <button
              key={option}
              className={option === color ? 'color-dot active' : 'color-dot'}
              type="button"
              style={{ background: option }}
              aria-label={`Color ${option}`}
              onClick={() => setColor(option)}
            />
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field-label">Notas</span>
        <textarea
          value={notes}
          rows={2}
          maxLength={4_000}
          placeholder="Cuenta de cargo, cómo darse de baja…"
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      {subscription && (
        <div className="danger-row">
          {!subscription.endDate && (
            <button
              className="ghost-button"
              type="button"
              onClick={() => void updateSubscription(subscription.id, {
                ...subscription,
                endDate: today < subscription.startDate ? subscription.startDate : today,
              }).then(onClose)}
            >
              Dar de baja hoy
            </button>
          )}
          {confirmDelete ? (
            <button
              className="danger-button"
              type="button"
              onClick={() => void deleteSubscription(subscription.id).then(onClose)}
            >
              <Trash2 size={16} /> Borrar definitivamente
            </button>
          ) : (
            <button className="ghost-button danger" type="button" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Eliminar
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
