/** Paleta de acento para etiquetas y colecciones. */
export const PALETTE = [
  '#2f6f8f',
  '#3f8f6a',
  '#7a5bb0',
  '#c2503f',
  '#c98a2b',
  '#4a6fb5',
  '#a0527f',
  '#5f7a4a',
] as const

export function nextColor(used: string[]): string {
  const free = PALETTE.find((color) => !used.includes(color))
  return free ?? PALETTE[used.length % PALETTE.length]
}
