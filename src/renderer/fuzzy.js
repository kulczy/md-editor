export function fuzzyScore(query, target) {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (q === '') return 0
  let score = 0, ti = 0, prevMatch = -2
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    for (; ti < t.length; ti++) {
      if (t[ti] === ch) { found = ti; ti++; break }
    }
    if (found === -1) return -1
    score += 1
    if (found === prevMatch + 1) score += 5            // consecutive bonus
    if (found === 0 || '/-_ .'.includes(t[found - 1])) score += 3 // segment-start bonus
    prevMatch = found
  }
  return score
}

export function fuzzyFilter(query, items, key = (x) => x) {
  return items
    .map((item) => ({ item, s: fuzzyScore(query, key(item)) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.item)
}
