/** "Chest, back & legs" with the language's own "and" (QA R4 P2: ES "y", PT "e"). */
export function listText(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}
