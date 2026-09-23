import type { EntryKind, Tag } from '../types'

export interface QuickEntry {
  title: string
  kind: EntryKind
  priority: boolean
  inspiration: boolean
  tagIds: string[]
  /** Etiquetas escritas con `#` que todavía no existen. */
  newTagNames: string[]
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * Atajos al escribir deprisa:
 * `*` prioritaria · `!` inspiración · `-` nota · `o` evento · `#etiqueta` etiqueta.
 */
export function parseQuickEntry(input: string, tags: Tag[]): QuickEntry {
  let text = input.trim()
  let kind: EntryKind = 'task'
  let priority = false
  let inspiration = false

  let changed = true
  while (changed && text) {
    changed = false
    if (text.startsWith('*')) { priority = true; text = text.slice(1).trim(); changed = true }
    else if (text.startsWith('!')) { inspiration = true; text = text.slice(1).trim(); changed = true }
    else if (text.startsWith('- ') || text.startsWith('— ')) { kind = 'note'; text = text.slice(2).trim(); changed = true }
    else if (/^o\s/i.test(text) || text.startsWith('○')) {
      kind = 'event'
      text = text.replace(/^(o\s|○\s?)/i, '').trim()
      changed = true
    }
  }

  const known = new Map(tags.filter((tag) => !tag.deletedAt).map((tag) => [normalize(tag.name), tag]))
  const tagIds: string[] = []
  const newTagNames: string[] = []

  const title = text
    .replace(/(^|\s)#([\p{L}\p{N}_-]{1,40})/gu, (_match, space: string, name: string) => {
      const tag = known.get(normalize(name))
      if (tag) {
        if (!tagIds.includes(tag.id)) tagIds.push(tag.id)
      } else if (!newTagNames.some((item) => normalize(item) === normalize(name))) {
        newTagNames.push(name)
      }
      return space ? ' ' : ''
    })
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { title, kind, priority, inspiration, tagIds, newTagNames }
}
