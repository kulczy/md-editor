import { EditorView, keymap } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import livePreview from './livePreview.js'

// Token colors only (no background) so the translucent vibrancy window stays glassy.
// Emphasis/strong/code/strikethrough visuals come from livePreview's CSS classes, not here.
const highlightStyle = (dark) => HighlightStyle.define([
  { tag: t.link, color: dark ? '#6cb6ff' : '#0a66c2', textDecoration: 'underline' },
  { tag: t.url, color: dark ? '#6cb6ff' : '#0a66c2' },
  { tag: t.monospace, color: dark ? '#f0b0c0' : '#a4264b' },
  { tag: [t.processingInstruction, t.meta], color: dark ? '#6e7681' : '#a0a4a8' }, // visible markers on the cursor line
  { tag: t.strikethrough, color: dark ? '#6e7681' : '#a0a4a8' }
])
const lightHL = syntaxHighlighting(highlightStyle(false))
const darkHL = syntaxHighlighting(highlightStyle(true))

export function createEditor({ parent, onChange }) {
  const themeCompartment = new Compartment()
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
        themeCompartment.of(lightHL), // swapped by setDark(); corrected on launch before the window shows
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
    getDoc: () => view.state.doc.toString(),
    setDark: (dark) => view.dispatch({ effects: themeCompartment.reconfigure(dark ? darkHL : lightHL) })
  }
}
