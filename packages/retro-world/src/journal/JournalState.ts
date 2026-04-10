const STORAGE_KEY = 'journal_discovered'

export class JournalState {
  private discovered: Set<string> = new Set()

  constructor() {
    this.load()
  }

  discover(key: string): boolean {
    if (this.discovered.has(key)) return false
    this.discovered.add(key)
    this.save()
    return true
  }

  isDiscovered(key: string): boolean {
    return this.discovered.has(key)
  }

  getDiscoveredCount(): number {
    return this.discovered.size
  }

  getDiscoveredKeys(): Set<string> {
    return this.discovered
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.discovered]))
    } catch { /* ignore */ }
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        for (const k of arr) this.discovered.add(k)
      }
    } catch { /* ignore */ }
  }
}
