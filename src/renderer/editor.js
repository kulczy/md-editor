import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from '@codemirror/language'
import livePreview from './livePreview.js'

export function createEditor({ parent, onChange }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        history(),
        keymap.of([
          ...markdownKeymap, // Enter continues/ends lists & quotes; Backspace removes empty markers
          indentWithTab, // Tab / Shift-Tab to indent list items
          ...defaultKeymap,
          ...historyKeymap
        ]),
        markdown({ base: markdownLanguage }), // GFM: task lists, tables, strikethrough, autolinks
        indentUnit.of('    '), // 4-space indent step (2x the default) for Tab / list nesting
        EditorState.tabSize.of(4),
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
