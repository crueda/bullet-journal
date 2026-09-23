// Identificadores estables: no deben cambiar aunque cambie la marca visible.
export const DATABASE_NAME = 'bullet-journal'
export const DATABASE_VERSION = 1
export const THEME_STORAGE_KEY = 'bujo-theme'
export const BACKUP_FORMAT = 'bullet-journal-backup'
export const BACKUP_VERSION = 1

/**
 * La app comparte proyecto de Firebase con Agatsu, así que sus colecciones
 * llevan prefijo propio dentro de `users/{uid}`.
 */
export const CLOUD_COLLECTIONS = {
  entry: 'bujoEntries',
  tag: 'bujoTags',
  collection: 'bujoCollections',
} as const
