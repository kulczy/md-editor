import { fuzzyFilter } from './fuzzy.js'
import { runSteps, text } from './commands.js'

let cfg = null
let el = null
let stepRunner = null // installed while a command's step-flow owns the input

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
      <div class="palette-search">
        <svg class="palette-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input class="palette-input" type="text" placeholder="${mode === 'commands' ? '> command' : 'Search files…'}" />
      </div>
      <ul class="palette-list"></ul>
    </div>`
  document.body.appendChild(el)
  const input = el.querySelector('.palette-input')
  const list = el.querySelector('.palette-list')
  if (mode === 'commands') input.value = '> '
  let active = 0
  let rows = []

  // Build the UI adapter the step-machine uses to drive the palette input.
  function makeUiAdapter() {
    let _submitCb = null
    let _cancelCb = null
    const adapter = {
      setPrompt(str) { input.placeholder = str },
      setValue(v) { input.value = v },
      getValue() { return input.value },
      onSubmit(cb) { _submitCb = cb },
      onCancel(cb) { _cancelCb = cb }
    }
    // stepRunner.onKey is called by the keydown handler; return true to consume the event.
    const runner = {
      onKey(e) {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (_submitCb) _submitCb()
          return true
        }
        if (e.key === 'Escape') {
          if (_cancelCb) _cancelCb()
          return true
        }
        return false
      }
    }
    return { adapter, runner }
  }

  // Launch the step-flow for a command (called when a command row is selected).
  function runCommand(command) {
    if (!command.steps || command.steps.length === 0) {
      // No steps — run immediately and close.
      Promise.resolve(command.run([])).then(() => closePalette()).catch(() => closePalette())
      return
    }

    // For rename: inject the current-file prefill into the first text step at render time.
    let steps = command.steps
    if (command.id === 'rename' && cfg.ctx) {
      steps = [text({ prompt: 'New name', prefill: cfg.ctx.currentFile() || '' }), ...steps.slice(1)]
    }

    // Clear the list so the palette shows only the step prompt.
    list.innerHTML = ''
    input.value = ''
    input.placeholder = ''

    const { adapter, runner } = makeUiAdapter()
    stepRunner = runner

    runSteps(steps, adapter).then((values) => {
      stepRunner = null // release the input regardless of outcome
      if (values !== null) {
        Promise.resolve(command.run(values)).finally(() => closePalette())
      } else {
        closePalette()
      }
    })
  }

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

  // cfg.renderCommands: returns rows for command mode, each row's run() fires the step flow.
  cfg.renderCommands = (query) => {
    if (!cfg.commands) return []
    return fuzzyFilter(query, cfg.commands, (c) => c.label).map((command) => ({
      label: command.label,
      run: () => runCommand(command)
    }))
  }

  input.addEventListener('input', render)
  input.addEventListener('keydown', (e) => {
    if (stepRunner && stepRunner.onKey(e)) return // command-step flow owns keys
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, rows.length - 1); paint(); e.preventDefault() }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); paint(); e.preventDefault() }
    else if (e.key === 'Enter') { rows[active]?.run() }
    else if (e.key === 'Escape') { closePalette(); e.stopPropagation() } // layered-Esc: main.js hides the window only when nothing's open
  })
  el.addEventListener('mousedown', (e) => { if (e.target === el) closePalette() })
  render()
  input.focus()
}
