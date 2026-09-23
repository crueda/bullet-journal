import { useMemo } from 'react'
import { Flame, MoveRight } from 'lucide-react'
import type { PeriodKey, PeriodScope } from '../types'
import { closedDayStreak, countsFor, mostMigrated, tagUsage } from '../lib/entries'
import { currentKey, periodLabel, SCOPE_LABELS } from '../lib/periods'
import { toLocalDate } from '../lib/dates'
import { useJournal } from '../state/JournalContext'

const SCOPES: PeriodScope[] = ['day', 'month', 'quarter', 'year']

export function StatsView({ onJumpTo }: { onJumpTo: (periodKey: PeriodKey) => void }) {
  const { entries, tags } = useJournal()
  const today = toLocalDate()

  const cards = useMemo(
    () => SCOPES.map((scope) => {
      const key = currentKey(scope, today)
      return { scope, key, counts: countsFor(entries, key) }
    }),
    [entries, today],
  )
  const streak = useMemo(() => closedDayStreak(entries, today), [entries, today])
  const usage = useMemo(() => tagUsage(entries, tags, currentKey('year', today)), [entries, tags, today])
  const stuck = useMemo(() => mostMigrated(entries), [entries])
  const maxUsage = usage[0]?.total ?? 1

  return (
    <div className="stack">
      <h2>Estadísticas</h2>

      <div className="streak-card">
        <Flame size={22} />
        <div>
          <strong>{streak} {streak === 1 ? 'día' : 'días'} seguidos</strong>
          <small>sin dejar nada abierto al terminar la jornada</small>
        </div>
      </div>

      <div className="stat-grid">
        {cards.map((card) => (
          <button key={card.scope} className="stat-card" type="button" onClick={() => onJumpTo(card.key)}>
            <span className="stat-scope">{SCOPE_LABELS[card.scope]}</span>
            <strong>{periodLabel(card.key, today)}</strong>
            <span className="stat-numbers">
              <span className="done">{card.counts.done} hechas</span>
              <span className="open">{card.counts.open} pendientes</span>
            </span>
            <span className="progress-track small">
              <span style={{ width: `${card.counts.percentage}%` }} />
            </span>
          </button>
        ))}
      </div>

      {usage.length > 0 && (
        <section>
          <h3>Etiquetas de este año</h3>
          <ul className="usage-list">
            {usage.map(({ tag, total, done }) => (
              <li key={tag.id}>
                <span className="usage-name" style={{ color: tag.color }}>{tag.name}</span>
                <span className="usage-bar">
                  <span style={{ width: `${Math.round((total / maxUsage) * 100)}%`, background: tag.color }} />
                </span>
                <span className="usage-count">{done}/{total}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stuck.length > 0 && (
        <section>
          <h3>Lo que más has aplazado</h3>
          <p className="hint">Si algo se mueve una y otra vez, quizá toque dividirlo, delegarlo o soltarlo.</p>
          <ul className="stuck-list">
            {stuck.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onJumpTo(entry.periodKey)}>
                  <span>{entry.title}</span>
                  <small><MoveRight size={13} /> {entry.migrationCount}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
