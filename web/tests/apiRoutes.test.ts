import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const servicesDir = path.resolve(here, '../src/services')
const manifestPath = path.resolve(here, '../../internal/api/testdata/reference_routes.tsv')

function normalizeClientPath(raw) {
  let value = raw
  value = value.replaceAll('${sequenceNumber}', ':sequence')
  value = value.replaceAll('${iccid}', ':iccid')
  value = value.replace('${encodeURIComponent(countryCode)}', ':country_code')
  value = value.replaceAll('${id}', ':resource_id')

  if (value === '/sms/messages/') value = '/sms/messages/:id'

  if (value.startsWith('/devices/:resource_id')) {
    value = value.replace(':resource_id', ':device_id')
  } else if (value.startsWith('/proxy-instances/:resource_id')) {
    value = value.replace(':resource_id', ':instance_id')
  } else if (value.startsWith('/upstream-proxies/:resource_id')) {
    value = value.replace(':resource_id', ':proxy_id')
  } else if (value.startsWith('/sms/messages/:resource_id')) {
    value = value.replace(':resource_id', ':id')
  } else if (value.startsWith('/cards/:resource_id')) {
    value = value.replace(':resource_id', ':iccid')
  }
  return `/api${value}`
}

test('every React API service call has a registered backend route', async () => {
  const manifest = await readFile(manifestPath, 'utf8')
  const registered = new Set(
    manifest
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const [method, route] = line.split('\t')
        return `${method} ${route}`
      }),
  )

  const missing = []
  for (const name of await readdir(servicesDir)) {
    if (!name.endsWith('.ts')) continue
    const source = await readFile(path.join(servicesDir, name), 'utf8')
    const pattern = /api\.(get|post|put|patch|delete)(?:<[^;]*?>)?\(\s*([`"])(.*?)\2/gs
    for (const match of source.matchAll(pattern)) {
      const method = match[1].toUpperCase()
      const route = normalizeClientPath(match[3])
      if (!registered.has(`${method} ${route}`)) {
        missing.push(`${name}: ${method} ${route}`)
      }
    }
  }

  assert.deepEqual(missing, [])
})
