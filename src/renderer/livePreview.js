import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

// Clickable checkbox replacing a GFM task marker "[ ]" / "[x]". Clicking toggles the
// source char between the brackets (pos+1), then decorations rebuild with the new state.
class CheckboxWidget extends WidgetType {
  constructor(checked, pos) { super(); this.checked = checked; this.pos = pos }
  eq(o) { return o.checked === this.checked && o.pos === this.pos }
  toDOM(view) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = this.checked
    box.className = 'cm-task-checkbox'
    box.onmousedown = (e) => {
      e.preventDefault() // keep editor focus; we drive the toggle via a doc change
      view.dispatch({ changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? ' ' : 'x' } })
    }
    return box
  }
  ignoreEvent() { return true }
}

// Node types whose marker children we hide; content gets a class.
const STYLE = {
  StrongEmphasis: 'cm-md-strong',
  Emphasis: 'cm-md-em',
  InlineCode: 'cm-md-code',
  Strikethrough: 'cm-md-strike'
}
const MARKS = new Set(['EmphasisMark', 'CodeMark', 'StrikethroughMark', 'HeaderMark', 'QuoteMark', 'LinkMark', 'URL'])
const hidden = Decoration.replace({})

function buildDeco(view) {
  const builder = new RangeSetBuilder()
  // Lines touched by any selection range stay "raw" (markers visible).
  const cursorLines = new Set()
  for (const r of view.state.selection.ranges) {
    let l = view.state.doc.lineAt(r.from).number
    const last = view.state.doc.lineAt(r.to).number
    for (; l <= last; l++) cursorLines.add(l)
  }
  const onCursorLine = (pos) => cursorLines.has(view.state.doc.lineAt(pos).number)

  // Collect (sorted) before emitting: line decos and mark decos can interleave.
  const items = []
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter(node) {
        const name = node.name
        if (name.startsWith('ATXHeading')) {
          const level = name.slice(-1)
          items.push({ from: node.from, to: node.from, line: { class: `cm-md-h${level}` } })
        } else if (STYLE[name]) {
          items.push({ from: node.from, to: node.to, mark: STYLE[name] })
        } else if (name === 'TaskMarker') {
          const checked = /[xX]/.test(view.state.doc.sliceString(node.from, node.to))
          items.push({ from: node.from, to: node.to, widget: new CheckboxWidget(checked, node.from) })
        } else if (name === 'HorizontalRule') {
          items.push({ from: node.from, to: node.from, line: { class: 'cm-md-hr' } })
        } else if (name === 'Blockquote') {
          let l = view.state.doc.lineAt(node.from).number
          const last = view.state.doc.lineAt(node.to).number
          for (; l <= last; l++) items.push({ from: view.state.doc.line(l).from, to: view.state.doc.line(l).from, line: { class: 'cm-md-quote' } })
        }
        if (MARKS.has(name) && !onCursorLine(node.from) && node.to > node.from) {
          items.push({ from: node.from, to: node.to, hide: true })
        }
      }
    })
  }
  // Emit line decos first per position, then marks, in document order.
  items.sort((a, b) => a.from - b.from || (a.line ? -1 : 1))
  for (const it of items) {
    if (it.line) builder.add(it.from, it.from, Decoration.line({ class: it.line.class }))
    else if (it.widget) builder.add(it.from, it.to, Decoration.replace({ widget: it.widget }))
    else if (it.hide) builder.add(it.from, it.to, hidden)
    else builder.add(it.from, it.to, Decoration.mark({ class: it.mark }))
  }
  return builder.finish()
}

const plugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildDeco(view) }
  update(u) {
    if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = buildDeco(u.view)
  }
}, { decorations: (v) => v.decorations })

export default [plugin]
