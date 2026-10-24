import test from 'node:test'
import assert from 'node:assert/strict'
import { csvSafeCell, downloadCsv, toCsv } from '../src/lib/exportCsv.js'

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'amount', label: 'Amount', format: (value) => Number(value).toFixed(2) },
]

test('quotes commas, quotes and newlines; doubles internal quotes', () => {
  const csv = toCsv([{ id: 1, name: 'Say "hi", friend\nnext', amount: 5 }], columns, { bom: false })
  assert.equal(csv, 'ID,Name,Amount\r\n1,"Say ""hi"", friend\nnext",5.00\r\n')
})

test('adds a BOM by default and handles null/undefined', () => {
  const csv = toCsv([{ id: null, name: undefined, amount: 0 }], columns)
  assert.ok(csv.startsWith('﻿'))
  assert.ok(csv.includes('\r\n,,0.00\r\n'))
})

test('defuses formula injection', () => {
  assert.equal(csvSafeCell('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(csvSafeCell('+1'), "'+1")
  assert.equal(csvSafeCell('-1'), "'-1")
  assert.equal(csvSafeCell('@cmd'), "'@cmd")
  assert.equal(csvSafeCell('plain'), 'plain')
  assert.equal(csvSafeCell({ a: 1 }), '{"a":1}')
})

test('function keys and custom delimiter', () => {
  const csv = toCsv([{ user: { name: 'A' } }], [{ key: (row) => row.user.name, label: 'User' }], { bom: false, delimiter: ';', eol: '\n' })
  assert.equal(csv, 'User\nA\n')
})

test('downloadCsv is a no-op without a window', () => {
  assert.equal(downloadCsv('x.csv', 'a,b'), false)
})
