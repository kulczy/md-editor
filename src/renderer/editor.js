import { EditorView, keymap } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import livePreview from './livePreview.js'

// Highlight-only palettes (no backgrounds) so the translucent vibrancy window stays glassy.
// Emphasis/strong/code/strikethrough visuals come from livePreview's CSS classes, not here;
// a palette tints heading / link / code-text / markers / strikethrough.
const PALETTES = {
  light: {
    Default: { heading: '#1a1a1a', link: '#0a66c2', code: '#a4264b', marker: '#a0a4a8', strike: '#a0a4a8' },
    GitHub: { heading: '#1f2328', link: '#0969da', code: '#cf222e', marker: '#8c959f', strike: '#6e7781' },
    Solarized: { heading: '#586e75', link: '#268bd2', code: '#2aa198', marker: '#93a1a1', strike: '#93a1a1' }
  },
  dark: {
    Default: { heading: '#e6e6e6', link: '#6cb6ff', code: '#f0b0c0', marker: '#6e7681', strike: '#6e7681' },
    'One Dark': { heading: '#e5c07b', link: '#61afef', code: '#98c379', marker: '#5c6370', strike: '#5c6370' },
    Dracula: { heading: '#bd93f9', link: '#8be9fd', code: '#50fa7b', marker: '#6272a4', strike: '#6272a4' },
    Solarized: { heading: '#93a1a1', link: '#268bd2', code: '#2aa198', marker: '#586e75', strike: '#586e75' }
  }
}
const buildHL = (p) => syntaxHighlighting(HighlightStyle.define([
  { tag: t.heading, color: p.heading },
  { tag: t.link, color: p.link, textDecoration: 'underline' },
  { tag: t.url, color: p.link },
  { tag: t.monospace, color: p.code },
  { tag: [t.processingInstruction, t.meta], color: p.marker },
  { tag: t.strikethrough, color: p.strike }
]))
const HL = { light: {}, dark: {} }
for (const mode of ['light', 'dark']) for (const name in PALETTES[mode]) HL[mode][name] = buildHL(PALETTES[mode][name])
const pick = (mode, name) => HL[mode][name] || HL[mode].Default

export const THEME_NAMES = { light: Object.keys(PALETTES.light), dark: Object.keys(PALETTES.dark) }

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
        themeCompartment.of(pick('light', 'Default')), // swapped by setHighlight(); corrected on launch before the window shows
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
    setHighlight: (mode, name) => view.dispatch({ effects: themeCompartment.reconfigure(pick(mode, name)) })
  }
}
