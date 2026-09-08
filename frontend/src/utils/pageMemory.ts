/**
 * In-memory page snapshots make back-navigation instant without writing
 * patient information to browser storage. They are cleared on sign-out.
 */
const snapshots = new Map<string, unknown>()

export function readPageMemory<T>(key: string): T | undefined {
  return snapshots.get(key) as T | undefined
}

export function writePageMemory<T>(key: string, value: T) {
  snapshots.set(key, value)
}

export function clearPageMemory() {
  snapshots.clear()
}
