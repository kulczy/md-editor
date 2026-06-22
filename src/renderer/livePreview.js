import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

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
  const doc = view.state.doc
  // Lines touched by any selection range stay "raw" (markers visible).
  const cursorLines = new Set()
  for (const r of view.state.selection.ranges) {
    let l = doc.lineAt(r.from).number
    const last = doc.lineAt(r.to).number
    for (; l <= last; l++) cursorLines.add(l)
  }
  const onCursorLine = (pos) => cursorLines.has(doc.lineAt(pos).number)
  const lineDeco = (cls) => Decoration.line({ class: cls })

  // Collect unsorted; Decoration.set(_, true) sorts by (from, startSide) for us.
  const ranges = []
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter(node) {
        const name = node.name
        if (name.startsWith('ATXHeading')) {
          ranges.push(lineDeco(`cm-md-h${name.slice(-1)}`).range(doc.lineAt(node.from).from))
        } else if (STYLE[name]) {
          ranges.push(Decoration.mark({ class: STYLE[name] }).range(node.from, node.to))
        } else if (name === 'TaskMarker') {
          const checked = /[xX]/.test(doc.sliceString(node.from, node.to))
          ranges.push(Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(node.from, node.to))
        } else if (name === 'HorizontalRule') {
          ranges.push(lineDeco('cm-md-hr').range(doc.lineAt(node.from).from))
        } else if (name === 'Blockquote') {
          let l = doc.lineAt(node.from).number
          const last = doc.lineAt(node.to).number
          for (; l <= last; l++) ranges.push(lineDeco('cm-md-quote').range(doc.line(l).from))
        }
        if (MARKS.has(name) && !onCursorLine(node.from) && node.to > node.from) {
          ranges.push(hidden.range(node.from, node.to))
        }
      }
    })
  }
  return Decoration.set(ranges, true)
}

const plugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildDeco(view) }
  update(u) {
    if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = buildDeco(u.view)
  }
}, { decorations: (v) => v.decorations })

export default [plugin]
