import { createEditor } from './editor.js'
import { initPalette, openPalette, isPaletteOpen, closePalette } from './palette.js'
import { makeCommands } from './commands.js'
import { openSettings, isSettingsOpen } from './settings.js'

const app = document.getElementById('app')
app.textContent = ''

export let currentFolder = null
export let currentFile = null
let saveTimer = null
let dirty = false

export let fileIndex = []
export async function refreshIndex() {
  fileIndex = currentFolder ? await window.api.fs.list(currentFolder) : []
}

let recentFiles = []
export async function pushRecent(rel) {
  recentFiles = [rel, ...recentFiles.filter((r) => r !== rel)].slice(0, 50)
  await window.api.state.set({ recentFiles })
}

const pin = document.createElement('div')
pin.className = 'pin-indicator'
pin.textContent = '📌'
document.body.appendChild(pin)
async function syncPin() { pin.style.display = (await window.api.getFloat()) ? 'block' : 'none' }
syncPin()

window.addEventListener('keydown', async (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
    e.preventDefault(); await window.api.toggleFloat(); syncPin()
  }
})

// Appearance settings — apply live to CSS, persist via store.
function applyTranslucency(t) { // t: 0..1 (1 = fully glassy). Tint the body over the native vibrancy.
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  document.body.style.backgroundColor = `rgba(${dark ? '28,28,30' : '245,245,247'}, ${1 - t})`
}
function applyPad(px) { document.documentElement.style.setProperty('--editor-pad', px + 'px') }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
  applyTranslucency((await window.api.state.get()).translucency)
})
async function openSettingsPanel() {
  const s = await window.api.state.get()
  openSettings({
    folder: currentFolder,
    translucency: s.translucency,
    editorPad: s.editorPad,
    hotkey: s.hotkey,
    onPickFolder: async () => { const f = await window.api.pickFolder(); if (f) { await setFolder(f); await refreshIndex(); renderEmptyIfNeeded() } return f },
    onTranslucency: (t) => { applyTranslucency(t); window.api.state.set({ translucency: t }) },
    onPad: (px) => { applyPad(px); window.api.state.set({ editorPad: px }) },
    onSetHotkey: (accel) => window.api.setHotkey(accel)
  })
}
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); openSettingsPanel() }
})

const ctx = {
  currentFolder: () => currentFolder,
  currentFile: () => currentFile,
  fs: window.api.fs,
  openFile,
  refreshIndex,
  pickFolder: window.api.pickFolder,
  setFolder,
  toggleFloat: async () => { await window.api.toggleFloat(); syncPin() },
  openSettings: openSettingsPanel
}

initPalette({
  getFiles: () => fileIndex,
  getRecent: () => recentFiles,
  onOpenFile: (rel) => openFile(rel),
  commands: makeCommands(ctx),
  ctx
})

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    openPalette({ mode: e.shiftKey ? 'commands' : 'files' }) // Cmd+Shift+P → command mode (>)
  }
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Palette owns Esc while open (it stops propagation). If we get here, nothing is open → hide.
    if (!isPaletteOpen() && !isSettingsOpen()) { e.preventDefault(); save(); window.api.hideWindow() }
  }
}, true) // capture: but palette's handler calls stopPropagation when it consumes Esc

// Draggable title strip (frameless window has no native title). Centered note name.
const titlebar = document.createElement('div')
titlebar.className = 'titlebar'
app.appendChild(titlebar)
function setTitle(rel) { titlebar.textContent = rel ? rel.split('/').pop().replace(/\.md$/, '') : '' }

const editor = createEditor({ parent: app, onChange: scheduleSave })
export { editor }

function scheduleSave(text) {
  if (!currentFolder || !currentFile) return
  dirty = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => save(text), 500) // ponytail: 500ms debounce; tune if it feels laggy
}

export async function save(text = editor.getDoc()) {
  if (!currentFolder || !currentFile) return
  clearTimeout(saveTimer)
  await window.api.fs.write(currentFolder, currentFile, text)
  dirty = false
}

export async function openFile(rel) {
  await save() // flush any pending edits to the file we're leaving
  const text = await window.api.fs.read(currentFolder, rel)
  editor.setDoc(text)
  clearTimeout(saveTimer); dirty = false // buffer matches disk; cancel the save setDoc just armed
  currentFile = rel
  setTitle(rel)
  await window.api.state.set({ lastFile: rel })
  await pushRecent(rel)
}

export async function setFolder(folder) {
  currentFolder = folder
  await window.api.state.set({ lastFolder: folder })
  await window.api.watch(currentFolder)
}

function renderEmptyIfNeeded() {
  let e = document.getElementById('empty')
  if (!currentFolder) {
    if (!e) {
      e = document.createElement('div'); e.id = 'empty'
      e.innerHTML = `<button id="open-folder-btn">Open folder…</button>`
      document.body.appendChild(e)
      e.querySelector('#open-folder-btn').onclick = async () => {
        const f = await window.api.pickFolder()
        if (f) { await setFolder(f); await refreshIndex(); e.remove() }
      }
    }
  } else if (e) e.remove()
}
renderEmptyIfNeeded()

window.api.onFsEvent(async (ev) => {
  await refreshIndex()
  if (ev.rel === currentFile) {
    if (ev.type === 'unlink') { editor.setDoc(''); currentFile = null; setTitle(''); clearTimeout(saveTimer); dirty = false; renderEmptyIfNeeded() }
    else if (ev.type === 'change' && !dirty) {
      const text = await window.api.fs.read(currentFolder, ev.rel)
      if (text !== editor.getDoc()) {
        editor.setDoc(text)
        clearTimeout(saveTimer); dirty = false // reload matches disk; cancel the save setDoc just armed
      }
    }
  }
})

// Restore last session.
;(async () => {
  const s = await window.api.state.get()
  applyTranslucency(s.translucency)
  applyPad(s.editorPad)
  if (s.lastFolder) {
    currentFolder = s.lastFolder
    recentFiles = s.recentFiles || []
    await refreshIndex()
    await window.api.watch(currentFolder)
    if (s.lastFile) {
      try { await openFile(s.lastFile) } catch { currentFile = null }
    }
  }
  renderEmptyIfNeeded()
})()

window.addEventListener('beforeunload', () => { save() })
