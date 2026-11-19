export interface CursorPosition {
  line: number
  column: number
}

export interface ResumeEditorHandle {
  focus(): void
  insertAtCursor(text: string, cursorOffset?: number): void
  appendToEnd(text: string, cursorOffset?: number): void
  insertBeforeLine(line: number, text: string, cursorOffset?: number): void
  gotoLine(line: number, column?: number): void
}