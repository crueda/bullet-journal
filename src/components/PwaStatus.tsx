import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, WifiOff, X } from 'lucide-react'

export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="pwa-toast" role="status">
      {needRefresh ? <Download size={19} /> : <WifiOff size={19} />}
      <div>
        <strong>{needRefresh ? 'Hay una versión nueva' : 'Lista para usar sin conexión'}</strong>
        <span>{needRefresh ? 'Actualiza cuando te venga bien.' : 'Tu bitácora estará disponible offline.'}</span>
      </div>
      {needRefresh && <button type="button" onClick={() => void updateServiceWorker(true)}>Actualizar</button>}
      <button className="toast-close" type="button" aria-label="Cerrar aviso" onClick={() => {
        setOfflineReady(false)
        setNeedRefresh(false)
      }}><X size={17} /></button>
    </div>
  )
}
