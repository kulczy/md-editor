import { createEditor } from './editor.js'

const app = document.getElementById('app')
app.textContent = ''

export let currentFolder = null
export let currentFile = null
let saveTimer = null

const editor = createEditor({ parent: app, onChange: scheduleSave })
export { editor }

function scheduleSave(text) {
  if (!currentFolder || !currentFile) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => save(text), 500) // ponytail: 500ms debounce; tune if it feels laggy
}

export async function save(text = editor.getDoc()) {
  if (!currentFolder || !currentFile) return
  clearTimeout(saveTimer)
  await window.api.fs.write(currentFolder, currentFile, text)
}

export async function openFile(rel) {
  await save() // flush any pending edits to the file we're leaving
  const text = await window.api.fs.read(currentFolder, rel)
  editor.setDoc(text)
  currentFile = rel
  await window.api.state.set({ lastFile: rel })
}

export async function setFolder(folder) {
  currentFolder = folder
  await window.api.state.set({ lastFolder: folder })
}

// Restore last session.
;(async () => {
  const s = await window.api.state.get()
  if (s.lastFolder) {
    currentFolder = s.lastFolder
    if (s.lastFile) {
      try { await openFile(s.lastFile) } catch { currentFile = null }
    }
  }
})()

window.addEventListener('beforeunload', () => { save() })
