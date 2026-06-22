import { fuzzyFilter } from './fuzzy.js'

let cfg = null
let el = null
let stepRunner = null // set by Task 8 for command steps

export function initPalette(config) { cfg = config }
export function isPaletteOpen() { return !!el }

export function closePalette() {
  if (el) { el.remove(); el = null; stepRunner = null }
}

export function openPalette({ mode = 'files' } = {}) {
  closePalette()
  el = document.createElement('div')
  el.className = 'palette-backdrop'
  el.innerHTML = `
    <div class="palette">
      <input class="palette-input" type="text" placeholder="${mode === 'commands' ? '> command' : 'Search files…'}" />
      <ul class="palette-list"></ul>
    </div>`
  document.body.appendChild(el)
  const input = el.querySelector('.palette-input')
  const list = el.querySelector('.palette-list')
  if (mode === 'commands') input.value = '> '
  let active = 0
  let rows = []

  function render() {
    const q = input.value
    if (q.startsWith('>')) {
      // Hand off to command mode (Task 8 sets cfg.renderCommands).
      rows = cfg.renderCommands ? cfg.renderCommands(q.slice(1).trim()) : []
    } else {
      const files = q === '' ? cfg.getRecent() : fuzzyFilter(q, cfg.getFiles())
      rows = files.slice(0, 50).map((rel) => ({ label: rel, run: () => { closePalette(); cfg.onOpenFile(rel) } }))
    }
    active = 0
    paint()
  }
  function paint() {
    list.innerHTML = ''
    rows.forEach((r, i) => {
      const li = document.createElement('li')
      li.className = i === active ? 'active' : ''
      li.textContent = r.label
      li.onclick = () => r.run()
      list.appendChild(li)
    })
  }
  input.addEventListener('input', render)
  input.addEventListener('keydown', (e) => {
    if (stepRunner && stepRunner.onKey(e)) return // command-step flow owns keys
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, rows.length - 1); paint(); e.preventDefault() }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); paint(); e.preventDefault() }
    else if (e.key === 'Enter') { rows[active]?.run() }
    else if (e.key === 'Escape') { closePalette(); e.stopPropagation() } // layered-Esc: Task 9 handles window-hide when palette closed
  })
  el.addEventListener('mousedown', (e) => { if (e.target === el) closePalette() })
  render()
  input.focus()
}

// Exposed so Task 8's command steps can drive the palette's input/list.
export function _internal() { return { setStepRunner: (r) => { stepRunner = r }, getEl: () => el } }
