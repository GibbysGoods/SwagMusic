import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import session from '@fastify/session'
import Fastify from 'fastify'
import { db } from './db.js'
import authRoutes from './routes/auth.js'
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getPlaylistsByUser,
  getTracksByPlaylist,
  moveTrackInPlaylist,
  removeTrackFromPlaylist,
  renamePlaylist
} from './services/PlaylistService.js'
import { PostgresSessionStore } from './session-store.js'


const app = Fastify({
  logger: true,
})

function requireUser(request, reply) {
  if (!request.session.userId) {
    reply.code(401).send({ error: 'Authentication required' })
    return null
  }

  return request.session.userId
}

await db.query('SELECT 1')
console.log('[DB] PostgreSQL connection successful')

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
]

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Origin not allowed'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})

await app.register(cookie)

await app.register(session, {
  secret: process.env.SESSION_SECRET,
  store: new PostgresSessionStore(),
  cookie: {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
  saveUninitialized: false,
  rolling: true,
})

await app.register(authRoutes)

const BOT_API_URL = 'http://127.0.0.1:3001'

app.get('/api/health', async () => {
  return {
    status: 'ok',
  }
})

app.post('/api/playlists', async (request, reply) => {
  const userId = requireUser(request, reply)

  if (!userId) return

  const { name } = request.body ?? {}

  if (!name?.trim()) {
    return reply.code(400).send({
      error: 'name is required',
    })
  }

  try {
    const playlist = await createPlaylist(
      userId,
      name.trim()
    )

    return reply.code(201).send({
      playlist,
    })
  } catch (error) {
    request.log.error(
      error,
      '[API] Failed to create playlist'
    )

    return reply.code(500).send({
      error: 'Failed to create playlist',
    })
  }
})

app.get('/api/users/:userId/playlists', async (request, reply) => {
  const authenticatedUserId = requireUser(request, reply)

  if (!authenticatedUserId) return

  const { userId } = request.params

  if (String(userId) !== String(authenticatedUserId)) {
    return reply.code(403).send({
      error: 'You cannot access another user\'s playlists',
    })
  }

  try {
    const playlists = await getPlaylistsByUser(authenticatedUserId)

    return reply.send({
      playlists,
    })
  } catch (error) {
    request.log.error(
      error,
      '[API] Failed to get playlists'
    )

    return reply.code(500).send({
      error: 'Failed to get playlists',
    })
  }
})

app.get('/api/playlists/:playlistId', async (request, reply) => {
  const userId = requireUser(request, reply)

  if (!userId) return

  const { playlistId } = request.params

  if (!playlistId) {
    return reply.code(400).send({
      error: 'playlistId is required',
    })
  }

  try {
    const playlist = await getPlaylistById(
      playlistId,
      userId
    )

    if (!playlist) {
      return reply.code(404).send({
        error: 'Playlist not found',
      })
    }

    return reply.send({
      playlist,
    })
  } catch (error) {
    request.log.error(
      error,
      '[API] Failed to get playlist'
    )

    return reply.code(500).send({
      error: 'Failed to get playlist',
    })
  }
})

app.patch('/api/playlists/:playlistId', async (request, reply) => {
  const userId = requireUser(request, reply)

  if (!userId) return

  const { playlistId } = request.params
  const { name } = request.body ?? {}

  if (!playlistId || !name?.trim()) {
    return reply.code(400).send({
      error: 'playlistId and name are required',
    })
  }

  try {
    const playlist = await renamePlaylist(
      playlistId,
      userId,
      name.trim()
    )

    if (!playlist) {
      return reply.code(404).send({
        error: 'Playlist not found',
      })
    }

    return reply.send({
      playlist,
    })
  } catch (error) {
    request.log.error(
      error,
      '[API] Failed to rename playlist'
    )

    return reply.code(500).send({
      error: 'Failed to rename playlist',
    })
  }
})

app.delete('/api/playlists/:playlistId', async (request, reply) => {
  const userId = requireUser(request, reply)

  if (!userId) return

  const { playlistId } = request.params

  if (!playlistId) {
    return reply.code(400).send({
      error: 'playlistId is required',
    })
  }

  try {
    const playlist = await deletePlaylist(
      playlistId,
      userId
    )

    if (!playlist) {
      return reply.code(404).send({
        error: 'Playlist not found',
      })
    }

    return reply.send({
      playlist,
    })
  } catch (error) {
    request.log.error(
      error,
      '[API] Failed to delete playlist'
    )

    return reply.code(500).send({
      error: 'Failed to delete playlist',
    })
  }
})

app.get('/api/playlists/:playlistId/tracks', async (request, reply) => {
  const userId = requireUser(request, reply)

  if (!userId) return

  const { playlistId } = request.params

  if (!playlistId) {
    return reply.code(400).send({
      error: 'playlistId is required',
    })
  }

  try {
    const playlist = await getPlaylistById(
      playlistId,
      userId
    )

    if (!playlist) {
      return reply.code(404).send({
        error: 'Playlist not found',
      })
    }

    const tracks = await getTracksByPlaylist(playlistId, userId)

    return reply.send({
      tracks,
    })
  } catch (error) {
    request.log.error(
      error,
      '[API] Failed to get playlist tracks'
    )

    return reply.code(500).send({
      error: 'Failed to get playlist tracks',
    })
  }
})

app.post('/api/playlists/:playlistId/tracks', async (request, reply) => {
  const userId = requireUser(request, reply)

  if (!userId) return

  const { playlistId } = request.params

  const {
    title,
    artist,
    album,
    artworkUrl,
    uri,
    duration,
  } = request.body ?? {}

  if (!playlistId) {
    return reply.code(400).send({
      error: 'playlistId is required',
    })
  }

  if (!title || !uri || duration === undefined) {
    return reply.code(400).send({
      error: 'title, uri, and duration are required',
    })
  }

  try {
    const playlist = await getPlaylistById(
      playlistId,
      userId
    )

    if (!playlist) {
      return reply.code(404).send({
        error: 'Playlist not found',
      })
    }

    const track = await addTrackToPlaylist(
      playlistId,
      userId,
      title,
      artist,
      album ?? null,
      artworkUrl ?? null,
      uri,
      duration,
    )

    return reply.code(201).send({
      track,
    })
  } catch (error) {
    request.log.error(
      error,
      '[API] Failed to add track to playlist'
    )

    return reply.code(500).send({
      error: 'Failed to add track to playlist',
    })
  }
})

app.delete(
  '/api/playlists/:playlistId/tracks/:trackId',
  async (request, reply) => {
    const userId = requireUser(request, reply)

    if (!userId) return

    const { playlistId, trackId } = request.params

    if (!playlistId || !trackId) {
      return reply.code(400).send({
        error: 'playlistId and trackId are required',
      })
    }

    try {
      const playlist = await getPlaylistById(
        playlistId,
        userId
      )

      if (!playlist) {
        return reply.code(404).send({
          error: 'Playlist not found',
        })
      }

      const track = await removeTrackFromPlaylist(
        playlistId,
        trackId
      )

      if (!track) {
        return reply.code(404).send({
          error: 'Track not found in this playlist',
        })
      }

      return reply.send({
        track,
      })
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to remove track from playlist'
      )

      return reply.code(500).send({
        error: 'Failed to remove track from playlist',
      })
    }
  }
)

app.patch(
  '/api/playlists/:playlistId/tracks/:trackId',
  async (request, reply) => {
    const userId = requireUser(request, reply)

    if (!userId) return

    const { playlistId, trackId } = request.params
    const { position } = request.body ?? {}

    if (!playlistId || !trackId) {
      return reply.code(400).send({
        error: 'playlistId and trackId are required',
      })
    }

    if (!Number.isInteger(position) || position <= 0) {
      return reply.code(400).send({
        error: 'position must be a positive integer',
      })
    }

    try {
      const playlist = await getPlaylistById(
        playlistId,
        userId
      )

      if (!playlist) {
        return reply.code(404).send({
          error: 'Playlist not found',
        })
      }

      const track = await moveTrackInPlaylist(
        playlistId,
        trackId,
        position,
      )

      if (!track) {
        return reply.code(404).send({
          error: 'Track not found in this playlist',
        })
      }

      return reply.send({
        track,
      })
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to move track in playlist'
      )

      return reply.code(500).send({
        error: 'Failed to move track in playlist',
      })
    }
  }
)

/* SEARCH API
*/

app.get('/api/search', async (request, reply) => {
  const query = request.query.q?.trim() || ''
  const guildId = request.query.guildId?.trim() || ''

  if (!query) {
    return reply.code(400).send({
      error: 'Query is required',
    })
  }

  if (!guildId) {
    return reply.code(400).send({
      error: 'Guild ID is required',
    })
  }

  try {
    const response = await fetch(
      `${BOT_API_URL}/search?q=${encodeURIComponent(query)}&guildId=${encodeURIComponent(guildId)}`
    )

    const data = await response.json()

    return reply
      .code(response.status)
      .send(data)
  } catch (error) {
    request.log.error(
      error,
      '[API] Failed to connect to bot search API'
    )

    return reply.code(502).send({
      error: 'Music service unavailable',
    })
  }
})

app.get(
  '/api/player/:guildId/queue',
  async (request, reply) => {
    const { guildId } = request.params

    try {
      const response = await fetch(
        `${BOT_API_URL}/player/${guildId}/queue`
      )

      const data = await response.json()

      return reply
        .code(response.status)
        .send(data)
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to connect to bot API'
      )

      return reply.code(502).send({
        error: 'Music service unavailable',
      })
    }
  }
)

app.delete(
  '/api/player/:guildId/queue',
  async (request, reply) => {
    const { guildId } = request.params
    const { index } = request.body ?? {}

    if (!Number.isInteger(index) || index < 0) {
      return reply.code(400).send({
        error: 'index must be a non-negative integer',
      })
    }

    try {
      const response = await fetch(
        `${BOT_API_URL}/player/${guildId}/queue`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            index,
          }),
        }
      )

      const data = await response.json()

      return reply
        .code(response.status)
        .send(data)
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to connect to bot API'
      )

      return reply.code(502).send({
        error: 'Music service unavailable',
      })
    }
  }
)

app.patch(
  '/api/player/:guildId/queue',
  async (request, reply) => {
    const { guildId } = request.params
    const { fromIndex, toIndex } = request.body ?? {}

    if (
      !Number.isInteger(fromIndex) ||
      !Number.isInteger(toIndex) ||
      fromIndex < 0 ||
      toIndex < 0
    ) {
      return reply.code(400).send({
        error: 'fromIndex and toIndex must be non-negative integers',
      })
    }

    try {
      const response = await fetch(
        `${BOT_API_URL}/player/${guildId}/queue`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromIndex,
            toIndex,
          }),
        }
      )

      const data = await response.json()

      return reply
        .code(response.status)
        .send(data)
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to connect to bot API'
      )

      return reply.code(502).send({
        error: 'Music service unavailable',
      })
    }
  }
)

app.post(
  '/api/player/:guildId/queue',
  async (request, reply) => {
    const { guildId } = request.params
    const { query } = request.body ?? {}

    if (!query?.trim()) {
      return reply.code(400).send({
        error: 'Query is required',
      })
    }

    try {
      const response = await fetch(
        `${BOT_API_URL}/player/${guildId}/queue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query.trim(),
          }),
        }
      )

      const data = await response.json()

      return reply
        .code(response.status)
        .send(data)
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to connect to bot API'
      )

      return reply.code(502).send({
        error: 'Music service unavailable',
      })
    }
  }
)

app.post(
  '/api/player/:guildId/stop',
  async (request, reply) => {
    const { guildId } = request.params

    try {
      const response = await fetch(
        `${BOT_API_URL}/player/${guildId}/stop`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      return reply
        .code(response.status)
        .send(data)
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to connect to bot API'
      )

      return reply.code(502).send({
        error: 'Music service unavailable',
      })
    }
  }
)

app.post(
  '/api/player/:guildId/pause',
  async (request, reply) => {
    const { guildId } = request.params

    try {
      const response = await fetch(
        `${BOT_API_URL}/player/${guildId}/pause`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      return reply
        .code(response.status)
        .send(data)
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to connect to bot API'
      )

      return reply.code(502).send({
        error: 'Music service unavailable',
      })
    }
  }
)

app.post(
  '/api/player/:guildId/skip',
  async (request, reply) => {
    const { guildId } = request.params

    try {
      const response = await fetch(
        `${BOT_API_URL}/player/${guildId}/skip`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      return reply
        .code(response.status)
        .send(data)
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to connect to bot API'
      )

      return reply.code(502).send({
        error: 'Music service unavailable',
      })
    }
  }
)

app.post(
  '/api/player/:guildId/back',
  async (request, reply) => {
    const { guildId } = request.params

    try {
      const response = await fetch(
        `${BOT_API_URL}/player/${guildId}/back`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      return reply
        .code(response.status)
        .send(data)
    } catch (error) {
      request.log.error(
        error,
        '[API] Failed to connect to bot API'
      )

      return reply.code(502).send({
        error: 'Music service unavailable',
      })
    }
  }
)

app.listen({
  port: 3000,
  host: '127.0.0.1',
})