/**
 * After `npm run build`, ensure the SPA bundle has no Redis/Upstash secrets.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dist = join(root, 'dist')

if (!existsSync(dist)) {
  console.error('dist/ missing — run npm run build first')
  process.exit(1)
}

const patterns = [
  /VITE_UPSTASH/i,
  /UPSTASH_REDIS_REST_TOKEN/i,
  /upstash\.io/i,
  /gQAAAA[A-Za-z0-9_-]{20,}/, // common Upstash token prefix shape
]

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, files)
    else if (/\.(js|css|html|map)$/i.test(name)) files.push(p)
  }
  return files
}

const hits = []
for (const file of walk(dist)) {
  const text = readFileSync(file, 'utf8')
  for (const re of patterns) {
    if (re.test(text)) hits.push({ file, re: String(re) })
  }
}

if (hits.length) {
  console.error('FAIL: secret-like patterns found in dist/')
  for (const h of hits) console.error(`  ${h.re} in ${h.file}`)
  process.exit(1)
}

console.log('OK: no Upstash/token patterns in dist/')
process.exit(0)
