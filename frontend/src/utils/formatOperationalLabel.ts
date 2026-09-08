/** Turn API enum values into labels suitable for staff-facing screens. */
export function formatOperationalLabel(value?: string | null) {
  if (!value) return ''
  const words = value
    .trim()
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\bfollow up\b/gu, 'follow-up')
    .split(/\s+/u)
  return words
    .map((word, index) => index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ')
}
