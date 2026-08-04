/**
 * Verifies phases 0–2 of Redis → API migration.
 * Exit 0 = OK, 1 = fail.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const errors = []
const ok = []

function fail(msg) {
  errors.push(msg)
}
function pass(msg) {
  ok.push(msg)
}

// 0.3 gitignore secrets
const gi = readFileSync(join(root, '.gitignore'), 'utf8')
for (const pattern of ['.env', '.env.local', 'backend/.env', 'backend/node_modules', 'backend/dist']) {
  if (!gi.includes(pattern)) fail(`.gitignore missing: ${pattern}`)
  else pass(`.gitignore has ${pattern}`)
}

// 2.2 no frontend redis client / VITE_UPSTASH
if (existsSync(join(root, 'src/lib/redis.js'))) fail('src/lib/redis.js still exists')
else pass('src/lib/redis.js removed')

const banned = [/VITE_UPSTASH/, /upstash\.io/, /UPSTASH_REDIS_REST_TOKEN/]
function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, files)
    else if (/\.(js|ts|vue|json|md|example|env)$/i.test(name) || name.startsWith('.env')) files.push(p)
  }
  return files
}

const frontFiles = walk(join(root, 'src'))
frontFiles.push(join(root, '.env.example'))
if (existsSync(join(root, 'vite.config.js'))) frontFiles.push(join(root, 'vite.config.js'))

for (const file of frontFiles) {
  if (!existsSync(file)) continue
  const text = readFileSync(file, 'utf8')
  for (const re of banned) {
    if (re.test(text) && !file.includes('MIGRATION') && !file.includes('SECURITY')) {
      fail(`Banned pattern ${re} in ${relative(root, file)}`)
    }
  }
}
pass('No VITE_UPSTASH / upstash token patterns under src/')

// 2.1 api client
if (!existsSync(join(root, 'src/lib/api.js'))) fail('missing src/lib/api.js')
else pass('src/lib/api.js present')

// 1.x backend
const backendRequired = [
  'backend/package.json',
  'backend/tsconfig.json',
  'backend/.env.example',
  'backend/src/index.ts',
  'backend/src/config.ts',
  'backend/src/redis.ts',
  'backend/src/routes/receipts.ts',
  'backend/src/validate.ts',
  'backend/src/types.ts',
]
for (const f of backendRequired) {
  if (!existsSync(join(root, f))) fail(`missing ${f}`)
  else pass(f)
}

const bex = readFileSync(join(root, 'backend/.env.example'), 'utf8')
if (!bex.includes('UPSTASH_REDIS_REST_URL') || !bex.includes('UPSTASH_REDIS_REST_TOKEN')) {
  fail('backend/.env.example missing Upstash vars')
} else pass('backend/.env.example has Upstash vars')

const fex = readFileSync(join(root, '.env.example'), 'utf8')
if (/VITE_UPSTASH/.test(fex)) fail('.env.example still has VITE_UPSTASH')
if (!fex.includes('VITE_API_URL')) fail('.env.example missing VITE_API_URL')
else pass('.env.example is API-only')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
for (const s of ['dev:api', 'build:api', 'start:api', 'postinstall']) {
  if (!pkg.scripts?.[s]) fail(`root package.json missing script ${s}`)
  else pass(`script ${s}`)
}

const vite = readFileSync(join(root, 'vite.config.js'), 'utf8')
if (!vite.includes('/api') || !vite.includes('3001')) fail('vite proxy /api → 3001 missing')
else pass('vite proxy configured')

// 0.2 reminder (non-fatal)
if (existsSync(join(root, '.env.local'))) {
  const local = readFileSync(join(root, '.env.local'), 'utf8')
  if (/VITE_UPSTASH|UPSTASH_REDIS/.test(local)) {
    fail('.env.local still contains Upstash secrets — remove them and rotate token in Upstash console')
  } else pass('.env.local has no Upstash secrets')
}

console.log('\n=== Migration check (phases 0–2) ===\n')
for (const m of ok) console.log('  OK  ', m)
if (errors.length) {
  console.log('')
  for (const m of errors) console.log('  FAIL', m)
  console.log(`\n${errors.length} failure(s)\n`)
  console.log('Ops 0.2: if an old VITE_UPSTASH token was ever deployed, rotate it at https://console.upstash.com\n')
  process.exit(1)
}
console.log('\nAll automated checks passed.')
console.log('Ops 0.2 (manual): rotate Upstash token if it was ever in a browser build.\n')
process.exit(0)
