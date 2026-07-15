// Pure CSV assembly. No dependencies, no DOM except the download helper.
//
// Column headers are supplied by the caller and stay English and machine
// stable (timestamp, sensor, value, unit, source, ...). This is intentional:
// exported files are a data interchange format meant to open the same way in
// any locale and to be parsed by other tools, so they are not translated.

export type CsvColumn<T> = {
  key: keyof T & string
  header: string
}

// Excel only detects UTF-8 when the file starts with a byte order mark, so a
// BOM (U+FEFF) is prepended to keep Cyrillic (and any non ASCII) intact on open.
const BOM = '﻿'

// A field is quoted only when it contains a comma, a quote or a line break.
// Inner quotes are doubled, per RFC 4180.
function escapeField(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function toCsv<T extends Record<string, unknown>>(
  columns: CsvColumn<T>[],
  rows: T[],
): string {
  const header = columns.map((column) => escapeField(column.header)).join(',')
  const lines = rows.map((row) =>
    columns.map((column) => escapeField(row[column.key])).join(','),
  )
  // CRLF line endings, again for maximum spreadsheet compatibility.
  return BOM + [header, ...lines].join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
