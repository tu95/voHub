import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../src/pages/Devices.tsx', import.meta.url),
  'utf8',
)

test('AT 端口 field is read-only', () => {
  const idx = source.indexOf('label="AT 端口"')
  assert.ok(idx >= 0, 'AT 端口 label not found')
  const after = source.slice(idx, idx + 150)
  assert.doesNotMatch(after, /onChange=/)
  assert.match(after, /disabled/)
  assert.match(after, /readOnly/)
})
