import { collection, doc, getDocs, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import type { SyncEntity, SyncRecord, SyncStatus } from '../types'
import { cloudErrorDetail } from '../lib/cloud-errors'
import { CLOUD_COLLECTIONS } from '../lib/compatibility'
import { getPendingOperations, getRecord, mergeRemoteRecords, removePendingOperation } from './local-db'
import { ensureAnonymousUser, firestore } from './firebase'

interface CloudSyncCallbacks {
  onRecords: () => Promise<void>
  onStatus: (status: SyncStatus, detail?: string) => void
}

const ENTITIES: SyncEntity[] = ['entry', 'tag', 'collection']

export class CloudSync {
  private userId?: string
  private listeners: Unsubscribe[] = []
  private connecting?: Promise<void>
  private stopped = false
  private retryTimer?: number

  constructor(private callbacks: CloudSyncCallbacks) {}

  start() {
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    if (!navigator.onLine) this.callbacks.onStatus('offline')
    else void this.connect()
  }

  stop() {
    this.stopped = true
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    this.listeners.forEach((unsubscribe) => unsubscribe())
    if (this.retryTimer) window.clearTimeout(this.retryTimer)
  }

  async notifyLocalChange() {
    if (!navigator.onLine) return this.callbacks.onStatus('offline')
    if (!this.userId) await this.connect()
    else await this.flush()
  }

  async retry() {
    if (!navigator.onLine) return this.callbacks.onStatus('offline')
    await this.connect(true)
  }

  private handleOnline = () => void this.connect(true)
  private handleOffline = () => this.callbacks.onStatus('offline')

  private connect(force = false): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (this.connecting && !force) return this.connecting
    if (this.userId && !force) return this.flush()
    this.callbacks.onStatus('connecting')
    this.connecting = (async () => {
      try {
        this.userId = (await ensureAnonymousUser()).uid
        if (this.stopped) return
        await this.pull()
        await this.flush()
        if (!this.listeners.length) this.subscribe()
      } catch (error) {
        this.callbacks.onStatus(navigator.onLine ? 'error' : 'offline', cloudErrorDetail(error))
        this.scheduleRetry()
      } finally {
        this.connecting = undefined
      }
    })()
    return this.connecting
  }

  private async pull() {
    if (!this.userId) return
    for (const entity of ENTITIES) {
      const snapshot = await getDocs(collection(firestore, 'users', this.userId, CLOUD_COLLECTIONS[entity]))
      const records = snapshot.docs.map((item) => item.data() as SyncRecord)
      if (await mergeRemoteRecords(entity, records)) await this.callbacks.onRecords()
    }
  }

  private async flush() {
    if (!this.userId || this.stopped) return
    const operations = await getPendingOperations()
    if (!operations.length) return this.callbacks.onStatus('synced')
    this.callbacks.onStatus('syncing')
    try {
      for (const operation of operations) {
        const record = await getRecord(operation.entity, operation.recordId)
        if (record) {
          await setDoc(
            doc(firestore, 'users', this.userId, CLOUD_COLLECTIONS[operation.entity], operation.recordId),
            record,
          )
        }
        await removePendingOperation(operation.id)
      }
      this.callbacks.onStatus('synced')
    } catch (error) {
      this.callbacks.onStatus(navigator.onLine ? 'error' : 'offline', cloudErrorDetail(error))
      this.scheduleRetry()
    }
  }

  private subscribe() {
    if (!this.userId) return
    for (const entity of ENTITIES) {
      this.listeners.push(onSnapshot(
        collection(firestore, 'users', this.userId, CLOUD_COLLECTIONS[entity]),
        async (snapshot) => {
          const records = snapshot.docs.map((item) => item.data() as SyncRecord)
          if (await mergeRemoteRecords(entity, records)) await this.callbacks.onRecords()
        },
        (error) => {
          this.callbacks.onStatus('error', cloudErrorDetail(error))
          this.scheduleRetry()
        },
      ))
    }
  }

  private scheduleRetry() {
    if (this.retryTimer || this.stopped) return
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = undefined
      if (navigator.onLine) void this.connect(true)
    }, 15_000)
  }
}
