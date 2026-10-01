
import { db } from '../db.js'

export async function createUser(discordId, username) {
  const result = await db.query(
    `
      INSERT INTO users (discord_id, username)
      VALUES ($1, $2)
      ON CONFLICT (discord_id)
      DO UPDATE SET
        username = EXCLUDED.username
      RETURNING *
    `,
    [discordId, username]
  )

  return result.rows[0]
}

export async function getUserByDiscordId(discordId) {
  const result = await db.query(
    `
      SELECT *
      FROM users
      WHERE discord_id = $1
    `,
    [discordId]
  )

  return result.rows[0] ?? null
}
