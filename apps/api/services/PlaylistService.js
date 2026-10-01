import { db } from '../db.js'

export async function createPlaylist(userId, name) {
  const result = await db.query(
    `
      INSERT INTO playlists (user_id, name)
      VALUES ($1, $2)
      RETURNING *
    `,
    [userId, name]
  )

  return result.rows[0]
}

export async function getPlaylistsByUser(userId) {
  const result = await db.query(
    `
      SELECT *
      FROM playlists
      WHERE user_id = $1
      ORDER BY created_at ASC
    `,
    [userId]
  )

  return result.rows
}

export async function getPlaylistById(playlistId, userId) {
  const result = await db.query(
    `
      SELECT *
      FROM playlists
      WHERE id = $1
        AND user_id = $2
    `,
    [playlistId, userId]
  )

  return result.rows[0] ?? null
}

export async function renamePlaylist(playlistId, userId, name) {
  const result = await db.query(
    `
      UPDATE playlists
      SET name = $1
      WHERE id = $2
        AND user_id = $3
      RETURNING *
    `,
    [name, playlistId, userId]
  )

  return result.rows[0] ?? null
}

export async function deletePlaylist(playlistId, userId) {
  const result = await db.query(
    `
      DELETE FROM playlists
      WHERE id = $1
        AND user_id = $2
      RETURNING *
    `,
    [playlistId, userId]
  )

  return result.rows[0] ?? null
}


export async function addTrackToPlaylist(
  playlistId,
  userId,
  title,
  artist,
  album,
  artworkUrl,
  uri,
  duration
) {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const playlistResult = await client.query(
      `
        SELECT id
        FROM playlists
        WHERE id = $1
          AND user_id = $2
        FOR UPDATE
      `,
      [playlistId, userId]
    )

    if (playlistResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }

    const positionResult = await client.query(
      `
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM playlist_tracks
        WHERE playlist_id = $1
      `,
      [playlistId]
    )

    const position = positionResult.rows[0].next_position

    const result = await client.query(
      `
        INSERT INTO playlist_tracks (
          playlist_id,
          title,
          artist,
          album,
          artwork_url,
          uri,
          duration,
          position
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        playlistId,
        title,
        artist,
        album,
        artworkUrl,
        uri,
        duration,
        position
      ]
    )

    await client.query('COMMIT')

    return result.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}



export async function getTracksByPlaylist(playlistId, userId) {
  const result = await db.query(
    `
      SELECT pt.*
      FROM playlist_tracks pt
      INNER JOIN playlists p
        ON p.id = pt.playlist_id
      WHERE pt.playlist_id = $1
        AND p.user_id = $2
      ORDER BY pt.position ASC
    `,
    [playlistId, userId]
  )

  return result.rows
}


export async function removeTrackFromPlaylist(
  playlistId,
  trackId
) {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const trackResult = await client.query(
      `
        DELETE FROM playlist_tracks
        WHERE id = $1
          AND playlist_id = $2
        RETURNING *
      `,
      [trackId, playlistId]
    )

    const track = trackResult.rows[0]

    if (!track) {
      await client.query('ROLLBACK')
      return null
    }

    await client.query(
      `
        UPDATE playlist_tracks
        SET position = position - 1
        WHERE playlist_id = $1
          AND position > $2
      `,
      [playlistId, track.position]
    )

    await client.query('COMMIT')

    return track
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function moveTrackInPlaylist(
  playlistId,
  trackId,
  newPosition
) {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const currentResult = await client.query(
      `
        SELECT position
        FROM playlist_tracks
        WHERE id = $1
          AND playlist_id = $2
      `,
      [trackId, playlistId]
    )

    const currentTrack = currentResult.rows[0]

    if (!currentTrack) {
      await client.query('ROLLBACK')
      return null
    }

    const currentPosition = currentTrack.position

    const countResult = await client.query(
      `
        SELECT COUNT(*) AS track_count
        FROM playlist_tracks
        WHERE playlist_id = $1
      `,
      [playlistId]
    )

    const trackCount = Number(countResult.rows[0].track_count)

    if (newPosition < 1 || newPosition > trackCount) {
      await client.query('ROLLBACK')
      return null
    }

    if (currentPosition === newPosition) {
      await client.query('COMMIT')

      const result = await client.query(
        `
          SELECT *
          FROM playlist_tracks
          WHERE id = $1
            AND playlist_id = $2
        `,
        [trackId, playlistId]
      )

      return result.rows[0] ?? null
    }

    if (newPosition < currentPosition) {
      await client.query(
        `
          UPDATE playlist_tracks
          SET position = position + 1
          WHERE playlist_id = $1
            AND position >= $2
            AND position < $3
            AND id <> $4
        `,
        [
          playlistId,
          newPosition,
          currentPosition,
          trackId
        ]
      )
    } else {
      await client.query(
        `
          UPDATE playlist_tracks
          SET position = position - 1
          WHERE playlist_id = $1
            AND position > $2
            AND position <= $3
            AND id <> $4
        `,
        [
          playlistId,
          currentPosition,
          newPosition,
          trackId
        ]
      )
    }

    const result = await client.query(
      `
        UPDATE playlist_tracks
        SET position = $1
        WHERE id = $2
          AND playlist_id = $3
        RETURNING *
      `,
      [
        newPosition,
        trackId,
        playlistId
      ]
    )

    await client.query('COMMIT')

    return result.rows[0] ?? null
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}