/** Remove Synthea's trailing numeric suffixes from names shown to staff. */
export function cleanNamePart(value?: string | null) {
  return (value ?? '').replace(/\d+$/u, '')
}

export function displayPatientName(first?: string | null, last?: string | null) {
  return [cleanNamePart(first), cleanNamePart(last)].filter(Boolean).join(' ').trim()
}

export function displayFullPatientName(value?: string | null) {
  return (value ?? '').split(/\s+/u).map(cleanNamePart).filter(Boolean).join(' ')
}
