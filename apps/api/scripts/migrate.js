
import dotenv from 'dotenv'
import pg from 'pg'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config({
  path: fileURLToPath(
    new URL('../../../.env', import.meta.url)
  ),
})

const { Client } = pg

const migrationsDirectory = fileURLToPath(
  new URL('../migrations/', import.meta.url)
)

const client = new Client({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'musicbot',
  user: process.env.DB_USER || 'musicbot',
  password: process.env.DB_PASSWORD,
})

async function migrate() {
  await client.connect()

  console.log('[MIGRATIONS] Connected to PostgreSQL')

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const files = (await fs.readdir(migrationsDirectory))
    .filter(file => file.endsWith('.sql'))
    .sort()

  for (const filename of files) {
    const existing = await client.query(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [filename]
    )

    if (existing.rowCount > 0) {
      console.log(`[MIGRATIONS] Already applied: ${filename}`)
      continue
    }

    const sql = await fs.readFile(
      path.join(migrationsDirectory, filename),
      'utf8'
    )

    console.log(`[MIGRATIONS] Applying: ${filename}`)

    await client.query('BEGIN')

    try {
      await client.query(sql)

      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [filename]
      )

      await client.query('COMMIT')

      console.log(`[MIGRATIONS] Applied: ${filename}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }

  console.log('[MIGRATIONS] All migrations complete')
}

try {
  await migrate()
} catch (error) {
  console.error('[MIGRATIONS] Failed:', error)
  process.exitCode = 1
} finally {
  await client.end()
}
