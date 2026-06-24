const scrollPositions = new Map<string, number>()

export function saveScroll(key: string) {
  scrollPositions.set(key, window.scrollY)
}

export function restoreScroll(key: string) {
  const pos = scrollPositions.get(key)
  if (pos !== undefined) {
    requestAnimationFrame(() => window.scrollTo(0, pos))
  }
}
