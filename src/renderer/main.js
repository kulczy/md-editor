import { createEditor } from './editor.js'
import { initPalette, openPalette, isPaletteOpen } from './palette.js'
import { makeCommands } from './commands.js'
import { openSettings, isSettingsOpen } from './settings.js'
import { THEME_NAMES } from './themes.js'

const app = document.getElementById('app')
app.textContent = ''

export let currentFolder = null
export let currentFile = null
let saveTimer = null
let dirty = false

let recentFiles = []
export async function pushRecent(rel) {
  recentFiles = [rel, ...recentFiles.filter((r) => r !== rel)].slice(0, 50)
  await window.api.state.set({ recentFiles })
}

export let fileIndex = []
export async function refreshIndex() {
  fileIndex = currentFolder ? await window.api.fs.list(currentFolder) : []
  // Drop deleted/renamed (and stale cross-folder) entries from recents — the palette shows
  // them on an empty query, so a ghost here is openable and ENOENTs on read.
  const exists = new Set(fileIndex)
  const kept = recentFiles.filter((r) => exists.has(r))
  if (kept.length !== recentFiles.length) { recentFiles = kept; await window.api.state.set({ recentFiles }) }
}

const pin = document.createElement('div')
pin.className = 'pin-indicator'
pin.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v6l-2 4v2h10v-2l-2 -4v-6"/><path d="M12 16v5"/><path d="M8 4h8"/></svg>'
document.body.appendChild(pin)
async function syncPin() { pin.style.display = (await window.api.getFloat()) ? 'block' : 'none' }
pin.title = 'Unpin (disable always-on-top)'
pin.onclick = async () => { await window.api.toggleFloat(); syncPin() } // pin only shows when floating → click turns it off
syncPin()

// Appearance — apply live to CSS, persist via store. isDark() reflects nativeTheme.themeSource
// (set in main from the theme setting), so it's correct for system/light/dark.
let lightTheme = 'Light'
let darkTheme = 'Dark'
const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches
const setVar = (k, v) => document.documentElement.style.setProperty(k, v)
function applyTranslucency(t) { setVar('--translucency', t) } // 0 = opaque theme bg, 1 = full glass
function applyPad(px) { setVar('--editor-pad', px + 'px') }
const FONTS = { sans: '-apple-system, system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
function applyFont(fam) { setVar('--editor-font-family', FONTS[fam] || FONTS.sans) }
function applyFontSize(px) { setVar('--editor-font-size', px + 'px') }
function applyLineHeight(lh) { setVar('--editor-line-height', lh) }
function syncTheme() { document.documentElement.dataset.theme = isDark() ? darkTheme : lightTheme } // active CSS theme
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
    onDarkTheme: (name) => { darkTheme = name; syncTheme(); window.api.state.set({ darkTheme: name }) },
    spellcheck: s.spellcheck,
    onSpellcheck: (on) => { editor.setSpellcheck(on); window.api.state.set({ spellcheck: on }) }
  })
}

const ctx = {
  currentFolder: () => currentFolder,
  currentFile: () => currentFile,
  recents: () => recentFiles,
  fs: window.api.fs,
  openFile,
  save,
  detachFile,
  closeCurrentFile,
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

// App-level shortcuts live in the native menu (main process); it forwards them here.
window.api.onMenu((action) => {
  if (action === 'palette-files') openPalette({ mode: 'files' })
  else if (action === 'palette-commands') openPalette({ mode: 'commands' })
  else if (action === 'settings') openSettingsPanel()
  else if (action === 'find') editor.openFind()
  else if (action === 'toggle-float') ctx.toggleFloat()
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Palette/settings own Esc while open (they stopPropagation); the find panel closes on its own.
    // If none are open, nothing is consuming Esc → hide the window.
    if (!isPaletteOpen() && !isSettingsOpen() && !document.querySelector('.cm-search')) { e.preventDefault(); save(); window.api.hideWindow() }
  }
}, true) // capture: but palette's handler calls stopPropagation when it consumes Esc

// Draggable title strip (frameless window has no native title). Centered note name.
const titlebar = document.createElement('div')
titlebar.className = 'titlebar'
const titleName = document.createElement('span')
titleName.className = 'titlebar-name' // no-drag + clickable; the rest of the strip still drags the window
titleName.onclick = () => { if (currentFile) openPalette({ mode: 'commands', commandId: 'rename' }) } // click title → rename
titlebar.appendChild(titleName)
app.appendChild(titlebar)
function setTitle(rel) { titleName.textContent = rel ? rel.split('/').pop().replace(/\.md$/, '') : '' }

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

// Stop tracking the current file: cancel any pending save so nothing writes to it later.
// Leaves the editor buffer alone (rename reloads it; openFile overwrites it).
export function detachFile() {
  currentFile = null
  clearTimeout(saveTimer); dirty = false
}

// detachFile + clear the visible editor/title. Used on delete and folder switch.
export function closeCurrentFile() {
  detachFile()
  editor.setDoc(''); setTitle('')
  renderEmptyIfNeeded()
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
  await save() // flush edits to the folder we're leaving, while currentFolder still points there
  closeCurrentFile() // detach + blank editor so the next openFile can't write the old name into the new folder
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
    if (ev.type === 'unlink') closeCurrentFile()
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
  lightTheme = THEME_NAMES.light.includes(s.lightTheme) ? s.lightTheme : THEME_NAMES.light[0]
  darkTheme = THEME_NAMES.dark.includes(s.darkTheme) ? s.darkTheme : THEME_NAMES.dark[0]
  applyTranslucency(s.translucency)
  applyPad(s.editorPad)
  applyFont(s.fontFamily)
  applyFontSize(s.fontSize)
  applyLineHeight(s.lineHeight)
  editor.setSpellcheck(s.spellcheck)
  syncTheme() // set data-theme for the resolved (system/light/dark) mode
  if (s.lastFolder) {
    currentFolder = s.lastFolder
    recentFiles = s.recentFiles || []
    await refreshIndex()
    await window.api.watch(currentFolder)
    // Reopen last file only if it still exists; otherwise fall back to the first note (never a blank ghost).
    const target = fileIndex.includes(s.lastFile) ? s.lastFile : fileIndex[0]
    if (target) await openFile(target)
  }
  renderEmptyIfNeeded()
  window.api.ready() // appearance applied + file loaded → safe to show the window
})()

// On quit, main holds the app open until we flush the buffer (beforeunload can't await async IPC).
window.api.onQuitFlush(async () => { await save(); window.api.quitFlushed() })