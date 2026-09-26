import type { AiCitation } from '@/schema'

/**
 * A piece of an assistant message: plain text, or a reference to one of its citations.
 *
 * Two kinds of reference are recognised in the answer's text:
 * - a numbered marker, `[1]`, pointing at the first citation — shown as a small badge;
 * - a mention of a citation's label, e.g. "INV-2026-0524" — the words themselves become
 *   the link, so the sentence still reads normally.
 */
export interface MessagePart {
  text: string
  citation?: AiCitation
  kind?: 'marker' | 'mention'
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Splits an answer into text and citation references, in order. */
export function messageParts(content: string, citations: AiCitation[] = []): MessagePart[] {
  if (!content) return []
  if (!citations.length) return [{ text: content }]

  // Longest labels first so "INV-2026-0524-A" wins over "INV-2026-0524".
  const labels = citations
    .filter((c) => c.label && c.label.trim().length >= 3)
    .sort((a, b) => b.label.length - a.label.length)
  const patterns = ['\\[\\d{1,2}\\]', ...labels.map((c) => `${escapeRegExp(c.label.trim())}`)]
  const pattern = new RegExp(`(${patterns.join('|')})`, 'g')

  const parts: MessagePart[] = []
  let lastIndex = 0
  for (const match of content.matchAll(pattern)) {
    const value = match[0]
    const index = match.index ?? 0
    const marker = value.match(/^\[(\d{1,2})\]$/)
    const citation = marker
      ? citations[Number(marker[1]) - 1]
      : labels.find((c) => c.label.trim() === value)
    // A marker with no matching citation is left as ordinary text.
    if (!citation) continue

    if (index > lastIndex) parts.push({ text: content.slice(lastIndex, index) })
    parts.push({
      text: marker ? marker[1]! : value,
      citation,
      kind: marker ? 'marker' : 'mention',
    })
    lastIndex = index + value.length
  }
  if (lastIndex < content.length) parts.push({ text: content.slice(lastIndex) })
  return parts
}

/** The citations actually referenced in the text, then any that were not, for the source list. */
export function orderedCitations(content: string, citations: AiCitation[] = []): AiCitation[] {
  const referenced = messageParts(content, citations)
    .map((part) => part.citation)
    .filter((citation): citation is AiCitation => !!citation)
  const seen = new Set<string>()
  return [...referenced, ...citations].filter((citation) => {
    const key = `${citation.type}:${citation.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
