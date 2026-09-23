const RECOVERY_MESSAGES: Readonly<Record<string, string>> = {
  'auth/admin-restricted-operation': 'Firebase no permite crear cuentas. Activa “Creación de cuentas” en Authentication → Configuración → Acciones de usuario y pulsa Reintentar.',
  'auth/operation-not-allowed': 'El acceso anónimo está desactivado. Activa “Anónimo” en Authentication → Método de acceso y pulsa Reintentar.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado. Añade crueda.github.io en Authentication → Configuración → Dominios autorizados.',
  'firestore/permission-denied': 'Firestore ha rechazado el acceso. Publica las reglas del repositorio en Firestore Database → Reglas.',
  'permission-denied': 'Firestore ha rechazado el acceso. Publica las reglas del repositorio en Firestore Database → Reglas.',
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code
  if (!(error instanceof Error)) return undefined
  return error.message.match(/(?:auth|firestore)\/[a-z-]+/)?.[0]
}

export function cloudErrorDetail(error: unknown): string {
  const code = errorCode(error)
  if (code && RECOVERY_MESSAGES[code]) return RECOVERY_MESSAGES[code]
  return error instanceof Error ? error.message : 'No se pudo conectar con Firebase. Tus cambios siguen guardados en este dispositivo.'
}
