<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import type { CursorPosition, ResumeEditorHandle } from './editorTypes'

const props = defineProps<{ value: string }>()
const emit = defineEmits<{
  (event: 'update', value: string): void
  (event: 'cursor', position: CursorPosition): void
}>()

const host = ref<HTMLDivElement>()
let view: EditorView | null = null

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    color: '#1e293b',
    backgroundColor: '#fbfcfe',
  },
  '.cm-scroller': {
    fontFamily: 'Consolas, "Courier New", monospace',
    lineHeight: '1.7',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: '#2563eb',
  },
  '.cm-gutters': {
    border: 'none',
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
  },
  '.cm-activeLine': {
    backgroundColor: '#eef4ff',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#e6eefc',
  },
  '&.cm-focused': {
    outline: 'none',
  },
})

function emitCursor(state: EditorState): void {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  emit('cursor', { line: line.number, column: head - line.from + 1 })
}

function build(): void {
  view?.destroy()
  view = null
  if (!host.value) return
  view = new EditorView({
    state: EditorState.create({
      doc: props.value,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit('update', update.state.doc.toString())
          if (update.docChanged || update.selectionSet) emitCursor(update.state)
        }),
        editorTheme,
      ],
    }),
    parent: host.value,
  })
  emitCursor(view.state)
}

function applyExternal(next: string): void {
  if (!view) return
  const current = view.state.doc.toString()
  if (current === next) return

  let start = 0
  const shortest = Math.min(current.length, next.length)
  while (start < shortest && current[start] === next[start]) start++

  let endCurrent = current.length
  let endNext = next.length
  while (
    endCurrent > start &&
    endNext > start &&
    current[endCurrent - 1] === next[endNext - 1]
  ) {
    endCurrent--
    endNext--
  }

  view.dispatch({ changes: { from: start, to: endCurrent, insert: next.slice(start, endNext) } })
}

function insertAtCursor(text: string, cursorOffset = text.length): void {
  if (!view) return
  const position = view.state.selection.main.head
  view.dispatch({
    changes: { from: position, insert: text },
    selection: { anchor: position + cursorOffset },
    scrollIntoView: true,
  })
  view.focus()
}

function appendToEnd(text: string, cursorOffset = text.length): void {
  if (!view) return
  const position = view.state.doc.length
  view.dispatch({
    changes: { from: position, insert: text },
    selection: { anchor: position + cursorOffset },
    scrollIntoView: true,
  })
  view.focus()
}

function insertBeforeLine(line: number, text: string, cursorOffset = text.length): void {
  if (!view) return
  const target = Math.max(1, Math.min(view.state.doc.lines, line))
  const position = view.state.doc.line(target).from
  view.dispatch({
    changes: { from: position, insert: text },
    selection: { anchor: position + cursorOffset },
    scrollIntoView: true,
  })
  view.focus()
}

function gotoLine(line: number, column = 1): void {
  if (!view) return
  const target = Math.max(1, Math.min(view.state.doc.lines, line))
  const lineInfo = view.state.doc.line(target)
  const position = Math.min(lineInfo.to, lineInfo.from + Math.max(0, column - 1))
  view.dispatch({ selection: { anchor: position }, scrollIntoView: true })
  view.focus()
}

function focus(): void {
  view?.focus()
}

defineExpose<ResumeEditorHandle>({
  focus,
  insertAtCursor,
  appendToEnd,
  insertBeforeLine,
  gotoLine,
})

watch(
  () => props.value,
  (next) => applyExternal(next),
)

onMounted(build)

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="host" class="cm-host"></div>
</template>

<style scoped>
.cm-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>