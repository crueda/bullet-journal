import { CloudCheck, CloudOff, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import type { SyncStatus } from '../types'

const LABELS: Record<SyncStatus, string> = {
  'local-only': 'Solo local',
  connecting: 'Conectando',
  syncing: 'Guardando',
  synced: 'Al día',
  offline: 'Sin conexión',
  error: 'Pendiente',
}

export function SyncBadge({ status, compact = false }: { status: SyncStatus; compact?: boolean }) {
  const Icon = status === 'synced'
    ? CloudCheck
    : status === 'offline' || status === 'local-only'
      ? CloudOff
      : status === 'error'
        ? TriangleAlert
        : status === 'syncing'
          ? RefreshCw
          : LoaderCircle

  return (
    <span className={`sync-badge sync-${status}`} title={`Estado de la copia: ${LABELS[status]}`}>
      <Icon size={15} aria-hidden="true" />
      {!compact && <span>{LABELS[status]}</span>}
    </span>
  )
}
