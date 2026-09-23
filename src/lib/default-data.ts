import type { Collection, Tag } from '../types'

const DEFAULT_TAGS: Array<Pick<Tag, 'id' | 'name' | 'color'>> = [
  { id: 'tag-trabajo', name: 'Trabajo', color: '#2f6f8f' },
  { id: 'tag-personal', name: 'Personal', color: '#7a5bb0' },
  { id: 'tag-casa', name: 'Casa', color: '#3f8f6a' },
  { id: 'tag-salud', name: 'Salud', color: '#c2503f' },
  { id: 'tag-ideas', name: 'Ideas', color: '#c98a2b' },
]

const DEFAULT_COLLECTIONS: Array<Pick<Collection, 'id' | 'name' | 'color'>> = [
  { id: 'col-algun-dia', name: 'Algún día / quizá', color: '#7a5bb0' },
  { id: 'col-lecturas', name: 'Libros y pelis', color: '#2f6f8f' },
]

/** Etiquetas iniciales que todavía no existen en la base local. */
export function missingDefaultTags(existing: Tag[], hasSeeded: boolean, now: string): Tag[] {
  if (hasSeeded) return []
  const known = new Set(existing.map((tag) => tag.id))
  return DEFAULT_TAGS
    .filter((tag) => !known.has(tag.id))
    .map((tag) => ({ ...tag, createdAt: now, updatedAt: now }))
}

/** Colecciones iniciales que todavía no existen en la base local. */
export function missingDefaultCollections(existing: Collection[], hasSeeded: boolean, now: string): Collection[] {
  if (hasSeeded) return []
  const known = new Set(existing.map((collection) => collection.id))
  return DEFAULT_COLLECTIONS
    .filter((collection) => !known.has(collection.id))
    .map((collection, index) => ({ ...collection, order: index, createdAt: now, updatedAt: now }))
}
