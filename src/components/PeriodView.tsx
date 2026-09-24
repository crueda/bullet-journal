import { useMemo, useState } from 'react'
import { AlarmClock, CalendarDays, ChevronLeft, ChevronRight, ListChecks, Undo2 } from 'lucide-react'
import type { JournalEntry, LocalDate, PeriodKey } from '../types'
import {
  countEntries,
  entriesFor,
  dayCounts,
  isClosed,
  isOpen,
  overdueEntries,
  stalePeriodEntries,
  tagMap,
} from '../lib/entries'
import {
  containsDay,
  currentKey,
  firstDayOf,
  isCurrentPeriod,
  monthGrid,
  parentKey,
  periodLabel,
  periodShortLabel,
  periodSubtitle,
  scopeOf,
  shiftPeriod,
} from '../lib/periods'
import { addDays, startOfWeek, toLocalDate } from '../lib/dates'
import { useJournal } from '../state/JournalContext'
import { EntryList } from './EntryList'
import { QuickAdd } from './QuickAdd'
import { EntryEditor } from './EntryEditor'
import { MoveSheet } from './MoveSheet'
import { MigrationSheet } from './MigrationSheet'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
type MonthView = 'tasks' | 'calendar'

interface PeriodViewProps {
  periodKey: PeriodKey
  /** Nombre de la escala: «Día», «Mes»… o el de la colección. */
  title: string
  /** Título grande; por defecto, la etiqueta del periodo. */
  label?: string
  onNavigate: (periodKey: PeriodKey) => void
  onJumpTo: (periodKey: PeriodKey) => void
}

export function PeriodView({ periodKey, title, label, onNavigate, onJumpTo }: PeriodViewProps) {
  const { entries, tags, preferences, toggleEntryDone, reorderEntries, undoMove } = useJournal()
  const today = toLocalDate()
  const scope = scopeOf(periodKey)

  const [editing, setEditing] = useState<{ open: boolean; entry?: JournalEntry }>({ open: false })
  const [moving, setMoving] = useState<JournalEntry>()
  const [reviewing, setReviewing] = useState(false)
  const [showClosed, setShowClosed] = useState(preferences.showCompleted)
  const [monthView, setMonthView] = useState<MonthView>('tasks')

  const visible = useMemo(() => entriesFor(entries, periodKey), [entries, periodKey])
  const open = visible.filter(isOpen)
  const closed = visible.filter(isClosed)
  const counts = countEntries(visible)
  const tagIndex = useMemo(() => tagMap(tags), [tags])
  const lastMoved = visible.find((entry) => entry.movedFrom)

  const pendingReview = useMemo(
    () => (scope === 'day' && periodKey === today
      ? [...overdueEntries(entries, today), ...stalePeriodEntries(entries, today)]
      : []),
    [entries, periodKey, scope, today],
  )

  const parent = parentKey(periodKey)
  const parentCounts = parent ? countEntries(entriesFor(entries, parent)) : undefined
  const calendar = scope === 'month' ? dayCounts(entries, periodKey) : undefined
  const weekStrip = scope === 'day'
    ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(periodKey as LocalDate), index))
    : []

  return (
    <>
      <header className="period-header">
        <div className="period-title">
          <span className="period-scope">{title}</span>
          <div className="period-nav">
            {scope !== 'collection' && (
              <button
                className="icon-button"
                type="button"
                aria-label="Periodo anterior"
                onClick={() => onNavigate(shiftPeriod(periodKey, -1))}
              >
                <ChevronLeft size={19} />
              </button>
            )}
            <div className="period-name">
              <h1>{label ?? periodLabel(periodKey, today)}</h1>
              {periodSubtitle(periodKey) && <p>{periodSubtitle(periodKey)}</p>}
            </div>
            {scope !== 'collection' && (
              <button
                className="icon-button"
                type="button"
                aria-label="Periodo siguiente"
                onClick={() => onNavigate(shiftPeriod(periodKey, 1))}
              >
                <ChevronRight size={19} />
              </button>
            )}
          </div>
        </div>

        {scope !== 'collection' && !isCurrentPeriod(periodKey, today) && (
          <button className="today-button" type="button" onClick={() => onNavigate(currentKey(scope, today))}>
            Volver al {title.toLowerCase()} actual
          </button>
        )}

        {scope === 'day' && (
          <div className="week-strip" role="group" aria-label="Días de la semana">
            {weekStrip.map((day, index) => {
              const dayTotals = countEntries(entriesFor(entries, day))
              return (
                <button
                  key={day}
                  className={`week-day ${day === periodKey ? 'active' : ''} ${day === today ? 'today' : ''}`}
                  type="button"
                  onClick={() => onNavigate(day)}
                  aria-current={day === periodKey ? 'date' : undefined}
                >
                  <span className="week-letter">{WEEKDAYS[index]}</span>
                  <span className="week-number">{Number(day.slice(8))}</span>
                  <span className={`week-dot ${dayTotals.open ? 'has-open' : dayTotals.total ? 'done' : ''}`} />
                </button>
              )
            })}
          </div>
        )}

        {counts.total > 0 && (
          <div className="period-progress">
            <div className="progress-track">
              <span style={{ width: `${counts.percentage}%` }} />
            </div>
            <span className="progress-label">
              {counts.done} hechas · {counts.open} pendientes
              {counts.cancelled > 0 && ` · ${counts.cancelled} descartadas`}
            </span>
          </div>
        )}
      </header>

      <div className="period-body">
        {pendingReview.length > 0 && preferences.migrationReminders && (
          <button className="review-banner" type="button" onClick={() => setReviewing(true)}>
            <AlarmClock size={18} />
            <span>
              <strong>{pendingReview.length} {pendingReview.length === 1 ? 'entrada' : 'entradas'} sin cerrar</strong>
              <small>De días y periodos anteriores. Revísalas y decide.</small>
            </span>
          </button>
        )}

        {scope === 'month' && (
          <div className="segmented month-view-toggle" role="tablist" aria-label="Vista del mes">
            <button
              id="month-tasks-tab"
              className={monthView === 'tasks' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={monthView === 'tasks'}
              aria-controls="month-tasks-panel"
              onClick={() => setMonthView('tasks')}
            >
              <ListChecks size={16} />
              Tareas
            </button>
            <button
              id="month-calendar-tab"
              className={monthView === 'calendar' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={monthView === 'calendar'}
              aria-controls="month-calendar-panel"
              onClick={() => setMonthView('calendar')}
            >
              <CalendarDays size={16} />
              Calendario
            </button>
          </div>
        )}

        {calendar && monthView === 'calendar' && (
          <div
            id="month-calendar-panel"
            className="month-calendar"
            role="tabpanel"
            aria-labelledby="month-calendar-tab"
          >
            {WEEKDAYS.map((letter) => <span key={letter} className="calendar-head">{letter}</span>)}
            {monthGrid(periodKey).map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="calendar-cell empty" />
              const dayTotals = calendar.get(day)
              return (
                <button
                  key={day}
                  className={`calendar-cell ${day === today ? 'today' : ''} ${dayTotals?.open ? 'has-open' : dayTotals ? 'done' : ''}`}
                  type="button"
                  onClick={() => onJumpTo(day)}
                  title={dayTotals ? `${dayTotals.open} pendientes · ${dayTotals.done} hechas` : 'Sin entradas'}
                >
                  {Number(day.slice(8))}
                  {dayTotals && <span className="calendar-dot" />}
                </button>
              )
            })}
          </div>
        )}

        {(scope !== 'month' || monthView === 'tasks') && (
          <div
            id={scope === 'month' ? 'month-tasks-panel' : undefined}
            className="period-entry-panel"
            role={scope === 'month' ? 'tabpanel' : undefined}
            aria-labelledby={scope === 'month' ? 'month-tasks-tab' : undefined}
          >
            <QuickAdd
              periodKey={periodKey}
              placeholder={`Añadir a ${periodShortLabel(periodKey, today).toLowerCase()}…`}
              onOpenEditor={() => setEditing({ open: true })}
            />

            {open.length > 0 ? (
              <EntryList
                entries={open}
                tags={tagIndex}
                sortable
                onToggle={(id) => void toggleEntryDone(id)}
                onOpen={(entry) => setEditing({ open: true, entry })}
                onMove={setMoving}
                onReorder={(ids) => void reorderEntries(periodKey, [...ids, ...closed.map((entry) => entry.id)])}
              />
            ) : (
              <p className="empty-state">
                {counts.total
                  ? 'Todo cerrado por aquí. Buen trabajo.'
                  : 'Sin entradas todavía. Escribe arriba para empezar.'}
              </p>
            )}

            {closed.length > 0 && (
              <section className="closed-section">
                <button className="section-toggle" type="button" onClick={() => setShowClosed(!showClosed)}>
                  {showClosed ? 'Ocultar' : 'Ver'} {closed.length} {closed.length === 1 ? 'cerrada' : 'cerradas'}
                </button>
                {showClosed && (
                  <EntryList
                    entries={closed}
                    tags={tagIndex}
                    onToggle={(id) => void toggleEntryDone(id)}
                    onOpen={(entry) => setEditing({ open: true, entry })}
                    onMove={setMoving}
                  />
                )}
              </section>
            )}

            {lastMoved && (
              <button className="undo-button" type="button" onClick={() => void undoMove(lastMoved.id)}>
                <Undo2 size={15} />
                Deshacer el movimiento de «{lastMoved.title}»
              </button>
            )}
          </div>
        )}

        {parent && parentCounts && parentCounts.total > 0 && (
          <button className="rollup" type="button" onClick={() => onJumpTo(parent)}>
            <span>{periodLabel(parent, today)}</span>
            <small>{parentCounts.open} pendientes · {parentCounts.total} en total</small>
          </button>
        )}

        {scope !== 'day' && scope !== 'collection' && (
          containsDay(periodKey, today) ? (
            <p className="hint subtle">
              Estás en el periodo actual. Lo que anotes aquí son planes que todavía no has bajado a un día concreto.
            </p>
          ) : (
            <p className="hint subtle">
              Periodo que empieza el {firstDayOf(periodKey).split('-').reverse().join('/')}.
            </p>
          )
        )}
      </div>

      {editing.open && (
        <EntryEditor
          entry={editing.entry}
          periodKey={periodKey}
          onClose={() => setEditing({ open: false })}
        />
      )}
      {moving && (
        <MoveSheet
          ids={[moving.id]}
          from={moving.periodKey}
          onClose={() => setMoving(undefined)}
        />
      )}
      {reviewing && <MigrationSheet today={today} onClose={() => setReviewing(false)} />}
    </>
  )
}
