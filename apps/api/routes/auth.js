
import crypto from 'node:crypto'

import { createUser } from '../services/UserService.js'

const DISCORD_API = 'https://discord.com/api/v10'

function generateState() {
  return crypto.randomBytes(32).toString('hex')
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false
  }

  const first = Buffer.from(a)
  const second = Buffer.from(b)

  return (
    first.length === second.length &&
    crypto.timingSafeEqual(first, second)
  )
}

export default async function authRoutes(app) {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = process.env.DISCORD_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Discord OAuth environment variables are missing')
  }

  app.get('/auth/discord', async (request, reply) => {
    const state = generateState()

    request.session.oauthState = state

    await request.session.save()

    const authorizationUrl = new URL(
      'https://discord.com/oauth2/authorize'
    )

    authorizationUrl.searchParams.set('client_id', clientId)
    authorizationUrl.searchParams.set('redirect_uri', redirectUri)
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('scope', 'identify')
    authorizationUrl.searchParams.set('state', state)

    return reply.redirect(authorizationUrl.toString())
  })

  app.get('/auth/discord/callback', async (request, reply) => {
    const { code, state, error } = request.query ?? {}

    if (error) {
      return reply.code(400).send({
        error: 'Discord authorization was cancelled or denied',
      })
    }

    if (!code || !state || !request.session.oauthState) {
      return reply.code(400).send({
        error: 'Missing OAuth callback parameters',
      })
    }

    if (!safeEqual(state, request.session.oauthState)) {
      return reply.code(400).send({
        error: 'Invalid OAuth state',
      })
    }

    delete request.session.oauthState

    try {
      const tokenResponse = await fetch(
        `${DISCORD_API}/oauth2/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
          }),
        }
      )

      if (!tokenResponse.ok) {
        request.log.error(
          { status: tokenResponse.status },
          '[Auth] Discord token exchange failed'
        )

        return reply.code(502).send({
          error: 'Failed to authenticate with Discord',
        })
      }

      const tokenData = await tokenResponse.json()

      const userResponse = await fetch(
        `${DISCORD_API}/users/@me`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        }
      )

      if (!userResponse.ok) {
        return reply.code(502).send({
          error: 'Failed to retrieve Discord profile',
        })
      }

      const discordUser = await userResponse.json()

      const user = await createUser(
        discordUser.id,
        discordUser.global_name || discordUser.username
      )

      await request.session.regenerate()

      request.session.userId = user.id
      request.session.discordId = user.discord_id
      request.session.username = user.username

      await request.session.save()

      return reply.redirect(process.env.FRONTEND_URL || 'http://localhost:5173')

    } catch (err) {
      request.log.error(err, '[Auth] Discord login failed')

      return reply.code(500).send({
        error: 'Authentication failed',
      })
    }
  })

  app.get('/api/auth/me', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({
        authenticated: false,
        user: null,
      })
    }

    return reply.send({
      authenticated: true,
      user: {
        id: request.session.userId,
        discordId: request.session.discordId,
        username: request.session.username,
      },
    })
  })

  app.post('/api/auth/logout', async (request, reply) => {
    try {
      await request.session.destroy()

      return reply.send({
        success: true,
      })
    } catch (err) {
      request.log.error(err, '[Auth] Logout failed')

      return reply.code(500).send({
        error: 'Failed to log out',
      })
    }
  })
}
