import cors from 'cors'
import express from 'express'
import { config, isRedisConfigured } from './config.js'
import { requireApiKey } from './middleware/auth.js'
import { rateLimit } from './middleware/rateLimit.js'
import { securityHeaders } from './middleware/securityHeaders.js'
import { receiptsRouter } from './routes/receipts.js'
import { resolveTenant } from './tenant.js'

const app = express()

app.disable('x-powered-by')
app.use(securityHeaders)
app.use(
  cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-Id'],
  }),
)
app.use(express.json({ limit: '256kb' }))
app.use(rateLimit)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    redis: isRedisConfigured,
    authRequired: !!config.apiKey,
    defaultTenant: config.defaultTenant,
    service: 'tickeware-api',
  })
})

app.use('/api/receipts', requireApiKey, resolveTenant, receiptsRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('[unhandled]', err)
    res.status(500).json({ error: 'Internal server error' })
  },
)

app.listen(config.port, () => {
  console.log(`Tickeware API listening on http://localhost:${config.port}`)
  console.log(`Redis configured: ${isRedisConfigured ? 'yes' : 'no (set UPSTASH_* in backend/.env)'}`)
  console.log(`Default tenant: ${config.defaultTenant}`)
  if (config.apiKey) console.log('API key auth: enabled')
})
