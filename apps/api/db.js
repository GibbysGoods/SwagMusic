import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
})

const { Pool } = pg

export const db = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'musicbot',
  user: process.env.DB_USER || 'musicbot',
  password: process.env.DB_PASSWORD,
})