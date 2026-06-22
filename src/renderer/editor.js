import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import livePreview from './livePreview.js'

export function createEditor({ parent, onChange }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        livePreview,
        syntaxHighlighting(defaultHighlightStyle),
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
