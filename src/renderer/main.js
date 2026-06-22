import { createEditor, THEME_NAMES } from './editor.js'
import { initPalette, openPalette, isPaletteOpen } from './palette.js'
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
pin.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v6l-2 4v2h10v-2l-2 -4v-6"/><path d="M12 16v5"/><path d="M8 4h8"/></svg>'
document.body.appendChild(pin)
async function syncPin() { pin.style.display = (await window.api.getFloat()) ? 'block' : 'none' }
pin.title = 'Unpin (disable always-on-top)'
pin.onclick = async () => { await window.api.toggleFloat(); syncPin() } // pin only shows when floating → click turns it off
syncPin()

window.addEventListener('keydown', async (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
    e.preventDefault(); await window.api.toggleFloat(); syncPin()
  }
})

// Appearance — apply live to CSS, persist via store. isDark() reflects nativeTheme.themeSource
// (set in main from the theme setting), so it's correct for system/light/dark.
let translucency = 0.85
let lightTheme = 'Default'
let darkTheme = 'Default'
const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches
function applyTranslucency(t) { // t: 0..1 (1 = fully glassy). Tint the body over the native vibrancy.
  translucency = t
  document.body.style.backgroundColor = `rgba(${isDark() ? '28,28,30' : '245,245,247'}, ${1 - t})`
}
function applyPad(px) { document.documentElement.style.setProperty('--editor-pad', px + 'px') }
const FONTS = { sans: '-apple-system, system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
function applyFont(fam) { document.documentElement.style.setProperty('--editor-font-family', FONTS[fam] || FONTS.sans) }
function applyFontSize(px) { document.documentElement.style.setProperty('--editor-font-size', px + 'px') }
function applyLineHeight(lh) { document.documentElement.style.setProperty('--editor-line-height', lh) }
function syncTheme() { // pick the active palette for the resolved mode, then re-tint
  const dark = isDark()
  editor.setHighlight(dark ? 'dark' : 'light', dark ? darkTheme : lightTheme)
  applyTranslucency(translucency)
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme) // fires on themeSource/OS change
async function openSettingsPanel() {
  const s = await window.api.state.get()
  openSettings({
    folder: currentFolder,
    theme: s.theme,
    themeNames: THEME_NAMES,
    lightTheme: s.lightTheme,
    darkTheme: s.darkTheme,
    translucency: s.translucency,
    editorPad: s.editorPad,
    hotkey: s.hotkey,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    fontFamily: s.fontFamily,
    onPickFolder: async () => { const f = await window.api.pickFolder(); if (f) { await setFolder(f); await refreshIndex(); renderEmptyIfNeeded() } return f },
    onTranslucency: (t) => { applyTranslucency(t); window.api.state.set({ translucency: t }) },
    onPad: (px) => { applyPad(px); window.api.state.set({ editorPad: px }) },
    onSetHotkey: (accel) => window.api.setHotkey(accel),
    onFontSize: (px) => { applyFontSize(px); window.api.state.set({ fontSize: px }) },
    onLineHeight: (lh) => { applyLineHeight(lh); window.api.state.set({ lineHeight: lh }) },
    onFontFamily: (fam) => { applyFont(fam); window.api.state.set({ fontFamily: fam }) },
    onTheme: (mode) => window.api.setTheme(mode), // main flips nativeTheme → matchMedia 'change' → syncTheme()
    onLightTheme: (name) => { lightTheme = name; syncTheme(); window.api.state.set({ lightTheme: name }) },
    onDarkTheme: (name) => { darkTheme = name; syncTheme(); window.api.state.set({ darkTheme: name }) }
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
  let text
  try { text = await window.api.fs.read(currentFolder, rel) }
  catch { await refreshIndex(); return } // file vanished between indexing and open — ignore
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
// Note: don't call renderEmptyIfNeeded() here — currentFolder isn't restored yet, which
// would flash the empty state on launch. The restore block below calls it once state loads.

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
  translucency = s.translucency
  lightTheme = s.lightTheme
  darkTheme = s.darkTheme
  applyPad(s.editorPad)
  applyFont(s.fontFamily)
  applyFontSize(s.fontSize)
  applyLineHeight(s.lineHeight)
  syncTheme() // editor highlight + translucency tint for the resolved (system/light/dark) mode
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
  window.api.ready() // appearance applied + file loaded → safe to show the window
})()

window.addEventListener('beforeunload', () => { save() })