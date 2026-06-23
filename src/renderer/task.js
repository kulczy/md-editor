// Rotate one line through the task states (same shortcut, cycling):
//   plain text → "- [ ]" (unchecked) → "- [x]" (checked) → plain text
// An existing bullet ("- foo") becomes "- [ ] foo"; checking off strips back to plain.
export function cycleTaskLine(text) {
  const cb = text.match(/^(\s*)([-*+])\s+\[([ xX])\]\s?(.*)$/)
  if (cb) {
    const [, indent, bullet, mark, rest] = cb
    return mark === ' ' ? `${indent}${bullet} [x] ${rest}` : `${indent}${rest}`
  }
  const bullet = text.match(/^(\s*)([-*+])\s+(.*)$/)
  if (bullet) {
    const [, indent, mark, rest] = bullet
    return `${indent}${mark} [ ] ${rest}`
  }
  const [, indent, rest] = text.match(/^(\s*)(.*)$/)
  return `${indent}- [ ] ${rest}`
}
