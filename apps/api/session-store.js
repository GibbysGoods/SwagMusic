import { db } from './db.js'

export class PostgresSessionStore {
  set(sessionId, session, callback) {
    const expires = session.cookie?.expires
      ? new Date(session.cookie.expires)
      : new Date(Date.now() + 24 * 60 * 60 * 1000)

    db.query(
      `INSERT INTO sessions (sid, sess, expire)
       VALUES ($1, $2, $3)
       ON CONFLICT (sid)
       DO UPDATE SET
         sess = EXCLUDED.sess,
         expire = EXCLUDED.expire`,
      [sessionId, JSON.stringify(session), expires],
    )
      .then(() => callback(null))
      .catch(callback)
  }

  get(sessionId, callback) {
    db.query(
      `SELECT sess
       FROM sessions
       WHERE sid = $1
         AND expire > NOW()`,
      [sessionId],
    )
      .then(({ rows }) => {
        callback(null, rows[0]?.sess ?? null)
      })
      .catch(callback)
  }

  destroy(sessionId, callback) {
    db.query(
      'DELETE FROM sessions WHERE sid = $1',
      [sessionId],
    )
      .then(() => callback(null))
      .catch(callback)
  }
}