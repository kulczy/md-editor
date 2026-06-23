import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import livePreview from './livePreview.js'
import { cycleTaskLine } from './task.js'

// Cmd/Ctrl-L: rotate the selected line(s) through plain → todo → checked → plain.
function cycleTask(view) {
  const { state } = view
  const changes = []
  const done = new Set()
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number
    const b = state.doc.lineAt(r.to).number
    for (let n = a; n <= b; n++) {
      if (done.has(n)) continue
      done.add(n)
      const line = state.doc.line(n)
      const next = cycleTaskLine(line.text)
      if (next !== line.text) changes.push({ from: line.from, to: line.to, insert: next })
    }
  }
  if (!changes.length) return false
  view.dispatch({ changes })
  return true
}

// No syntax-highlight engine: all token styling is CSS (livePreview emits cm-md-* classes
// that read theme variables — see themes.css / styles.css).
export function createEditor({ parent, onChange }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        history(),
        keymap.of([
          { key: 'Mod-l', run: cycleTask }, // add/rotate a todo on the current line(s)
          ...markdownKeymap, // Enter continues/ends lists & quotes; Backspace removes empty markers
          indentWithTab, // Tab / Shift-Tab to indent list items
          ...defaultKeymap,
          ...historyKeymap
        ]),
        markdown({ base: markdownLanguage }), // GFM: task lists, tables, strikethrough, autolinks
        indentUnit.of('    '), // 4-space indent step (2x the default) for Tab / list nesting
        EditorState.tabSize.of(4),
        livePreview,
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange(view.state.doc.toString()) })
      ]
    })
  })
  return {
    view,
    setDoc(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    },
    getDoc: () => view.state.doc.toString()
  }
}
