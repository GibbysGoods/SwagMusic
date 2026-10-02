import http from 'node:http'

const PORT = Number(process.env.BOT_API_PORT ?? 3001)

const HOST = process.env.BOT_API_HOST ?? '127.0.0.1'

export function startInternalApi(client) {
    const server = http.createServer(async (request, response) => {
        response.setHeader('Content-Type', 'application/json')

        if (
            request.method === 'GET' &&
            request.url === '/health'
        ) {
            response.writeHead(200)

            response.end(
                JSON.stringify({
                    status: 'ok',
                    service: 'discord-bot',
                })
            )

            return
        }

        /*
         * --------------------------------------------------
         * Search
         * --------------------------------------------------
         */

        if (
            request.method === 'GET' &&
            request.url.startsWith('/search')
        ) {
            const url = new URL(
                request.url,
                `http://${HOST}:${PORT}`
            )

            const query = url.searchParams.get('q')?.trim()

            if (!query) {
                response.writeHead(400)

                response.end(
                    JSON.stringify({
                        error: 'Query is required',
                    })
                )

                return
            }

            const guildId =
                url.searchParams.get('guildId')

            if (!guildId) {
                response.writeHead(400)

                response.end(
                    JSON.stringify({
                        error: 'Guild ID is required',
                    })
                )

                return
            }

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            if (!guildPlayer.lavalinkPlayer) {
                response.writeHead(409)

                response.end(
                    JSON.stringify({
                        error: 'Player is not connected',
                    })
                )

                return
            }

            try {
                const result =
                    await guildPlayer.lavalinkPlayer.search(
                        { query },
                        client.user
                    )

                const results = (result.tracks ?? [])
                    .slice(0, 10)
                    .map((track) => ({
                        title:
                            track.info?.title ??
                            'Unknown',

                        artist:
                            track.info?.author ??
                            'Unknown',

                        album:
                            track.info?.albumName ??
                            'Unknown',

                        artwork:
                            track.info?.artworkUrl ??
                            null,

                        uri:
                            track.info?.uri ??
                            null,

                        duration:
                            track.info?.duration ??
                            0,
                    }))

                response.writeHead(200)

                response.end(
                    JSON.stringify({
                        query,
                        results,
                    })
                )
            } catch (error) {
                console.error(
                    '[INTERNAL API] Failed to search:',
                    error
                )

                response.writeHead(500)

                response.end(
                    JSON.stringify({
                        error: 'Failed to search',
                    })
                )
            }

            return
        }

        if (
            request.method === 'PATCH' &&
            request.url.startsWith('/player/') &&
            request.url.endsWith('/queue')
        ) {
            const guildId = request.url.slice(
                '/player/'.length,
                -'/queue'.length
            )

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            let body = ''

            request.on('data', (chunk) => {
                body += chunk
            })

            request.on('end', async () => {
                try {
                    const data = JSON.parse(body)

                    const { fromIndex, toIndex } = data

                    if (
                        !Number.isInteger(fromIndex) ||
                        !Number.isInteger(toIndex) ||
                        fromIndex < 0 ||
                        toIndex < 0
                    ) {
                        response.writeHead(400)

                        response.end(
                            JSON.stringify({
                                error:
                                    'fromIndex and toIndex must be non-negative integers',
                            })
                        )

                        return
                    }

                    const track = guildPlayer.move(
                        fromIndex,
                        toIndex
                    )

                    if (!track) {
                        response.writeHead(400)

                        response.end(
                            JSON.stringify({
                                error: 'Invalid queue positions',
                            })
                        )

                        return
                    }

                    if (client.playerPanel) {
                        await client.playerPanel.update(
                            guildPlayer
                        )
                    }

                    response.writeHead(200)

                    response.end(
                        JSON.stringify({
                            success: true,
                            track: {
                                title:
                                    track.info?.title ??
                                    'Unknown',
                                artist:
                                    track.info?.author ??
                                    'Unknown',
                                uri:
                                    track.info?.uri ??
                                    null,
                            },
                            queueSize:
                                guildPlayer.queue.size,
                        })
                    )
                } catch (error) {
                    console.error(
                        '[INTERNAL API] Failed to move track in queue:',
                        error
                    )

                    response.writeHead(500)

                    response.end(
                        JSON.stringify({
                            error: 'Failed to move track in queue',
                        })
                    )
                }
            })

            return
        }
        
        if (
            request.method === 'GET' &&
            request.url.startsWith('/player/') &&
            request.url.endsWith('/queue')
        ) {
            const guildId = request.url.slice(
                '/player/'.length,
                -'/queue'.length
            )

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            const queue = guildPlayer.queue.all.map((track) => ({
                title: track.info?.title ?? 'Unknown',
                artist: track.info?.author ?? 'Unknown',
                album: track.info?.albumName ?? 'Unknown',
                artwork: track.info?.artworkUrl ?? null,
                uri: track.info?.uri ?? null,
            }))

            const currentTrack = guildPlayer.currentTrack
                ? {
                      title:
                          guildPlayer.currentTrack.info?.title ??
                          'Unknown',

                      artist:
                          guildPlayer.currentTrack.info?.author ??
                          'Unknown',

                      album:
                          guildPlayer.currentTrack.info?.albumName ??
                          'Unknown',

                      artwork:
                          guildPlayer.currentTrack.info
                              ?.artworkUrl ?? null,

                      uri:
                          guildPlayer.currentTrack.info?.uri ??
                          null,

                      duration:
                          guildPlayer.currentTrack.info?.duration ??
                          0,
                  }
                : null

            const position =
                guildPlayer.lavalinkPlayer?.position ?? 0

            const paused =
                guildPlayer.lavalinkPlayer?.paused ??
                guildPlayer.paused

            response.writeHead(200)

            response.end(
                JSON.stringify({
                    currentTrack,
                    position,
                    duration: currentTrack?.duration ?? 0,
                    paused,
                    queue,
                    queueSize: queue.length,
                })
            )

            return
        }

        if (
            request.method === 'DELETE' &&
            request.url.startsWith('/player/') &&
            request.url.endsWith('/queue')
        ) {
            const guildId = request.url.slice(
                '/player/'.length,
                -'/queue'.length
            )

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)
                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )
                return
            }

            let body = ''

            request.on('data', (chunk) => {
                body += chunk
            })

            request.on('end', async () => {
                try {
                    const data = JSON.parse(body)
                    const { index } = data

                    if (
                        !Number.isInteger(index) ||
                        index < 0
                    ) {
                        response.writeHead(400)
                        response.end(
                            JSON.stringify({
                                error:
                                    'index must be a non-negative integer',
                            })
                        )
                        return
                    }

                    const track = guildPlayer.queue.remove(index)

                    if (!track) {
                        response.writeHead(400)
                        response.end(
                            JSON.stringify({
                                error: 'Invalid queue index',
                            })
                        )
                        return
                    }

                    if (client.playerPanel) {
                        await client.playerPanel.update(
                            guildPlayer
                        )
                    }

                    response.writeHead(200)
                    response.end(
                        JSON.stringify({
                            success: true,
                            track: {
                                title:
                                    track.info?.title ??
                                    'Unknown',
                                artist:
                                    track.info?.author ??
                                    'Unknown',
                                uri:
                                    track.info?.uri ??
                                    null,
                            },
                            queueSize:
                                guildPlayer.queue.size,
                        })
                    )
                } catch (error) {
                    console.error(
                        '[INTERNAL API] Failed to remove track from queue:',
                        error
                    )

                    response.writeHead(500)
                    response.end(
                        JSON.stringify({
                            error:
                                'Failed to remove track from queue',
                        })
                    )
                }
            })

            return
        }

        if (
            request.method === 'GET' &&
            request.url.startsWith('/player/')
        ) {
            const guildId = request.url.slice('/player/'.length)

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            response.writeHead(200)

            response.end(
                JSON.stringify({
                    state: guildPlayer.getState(),
                })
            )

            return
        }

        if (
            request.method === 'POST' &&
            request.url.startsWith('/player/') &&
            request.url.endsWith('/queue')
        ) {
            const guildId = request.url.slice(
                '/player/'.length,
                -'/queue'.length
            )

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            let body = ''

            request.on('data', (chunk) => {
                body += chunk
            })

            request.on('end', async () => {
                try {
                    const data = JSON.parse(body)

                    const query = data.query?.trim()

                    if (!query) {
                        response.writeHead(400)

                        response.end(
                            JSON.stringify({
                                error: 'Query is required',
                            })
                        )

                        return
                    }

                    if (!guildPlayer.lavalinkPlayer) {
                        response.writeHead(409)

                        response.end(
                            JSON.stringify({
                                error: 'Player is not connected',
                            })
                        )

                        return
                    }

                    const result =
                        await guildPlayer.lavalinkPlayer.search(
                            { query },
                            client.user
                        )

                    if (
                        !result.tracks ||
                        result.tracks.length === 0
                    ) {
                        response.writeHead(404)

                        response.end(
                            JSON.stringify({
                                error: 'No results found',
                            })
                        )

                        return
                    }

                    const track = result.tracks[0]

                    await guildPlayer.addTrack(track)

                    if (client.playerPanel) {
                        await client.playerPanel.update(
                            guildPlayer
                        )
                    }

                    response.writeHead(200)

                    response.end(
                        JSON.stringify({
                            success: true,

                            track: {
                                title: track.info.title,
                                artist: track.info.author,
                                uri: track.info.uri ?? null,
                            },

                            queueSize:
                                guildPlayer.queue.size,
                        })
                    )
                } catch (error) {
                    console.error(
                        '[INTERNAL API] Failed to add track:',
                        error
                    )

                    response.writeHead(500)

                    response.end(
                        JSON.stringify({
                            error: 'Failed to add track',
                        })
                    )
                }
            })

            return
        }

        
        if (
            request.method === 'POST' &&
            request.url.startsWith('/player/') &&
            request.url.endsWith('/stop')
        ) {
            const guildId = request.url.slice(
                '/player/'.length,
                -'/stop'.length
            )

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            try {
                await guildPlayer.stop()

                if (client.playerPanel) {
                    await client.playerPanel.update(
                        guildPlayer
                    )
                }

                response.writeHead(200)

                response.end(
                    JSON.stringify({
                        success: true,
                    })
                )
            } catch (error) {
                console.error(
                    '[INTERNAL API] Failed to stop player:',
                    error
                )

                response.writeHead(500)

                response.end(
                    JSON.stringify({
                        error: 'Failed to stop player',
                    })
                )
            }

            return
        }
                    
        if (
            request.method === 'POST' &&
            request.url.startsWith('/player/') &&
            request.url.endsWith('/pause')
        ) {
            const guildId = request.url.slice(
                '/player/'.length,
                -'/pause'.length
            )

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            try {
                const success = await guildPlayer.pause()

                response.writeHead(200)

                response.end(
                    JSON.stringify({
                        success,
                        paused: guildPlayer.paused,
                    })
                )
            } catch (error) {
                console.error(
                    '[INTERNAL API] Failed to pause/resume player:',
                    error
                )

                response.writeHead(500)

                response.end(
                    JSON.stringify({
                        error: 'Failed to pause/resume player',
                    })
                )
            }

            return
        }

        if (
            request.method === 'POST' &&
            request.url.startsWith('/player/') &&
            request.url.endsWith('/skip')
        ) {
            const guildId = request.url.slice(
                '/player/'.length,
                -'/skip'.length
            )

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            try {
                const success = await guildPlayer.skip()

                response.writeHead(200)

                response.end(
                    JSON.stringify({
                        success,

                        currentTrack: guildPlayer.currentTrack
                            ? {
                                  title:
                                      guildPlayer.currentTrack.info
                                          ?.title ?? 'Unknown',

                                  artist:
                                      guildPlayer.currentTrack.info
                                          ?.author ?? 'Unknown',

                                  album:
                                      guildPlayer.currentTrack.info
                                          ?.albumName ?? 'Unknown',

                                  artwork:
                                      guildPlayer.currentTrack.info
                                          ?.artworkUrl ?? null,

                                  uri:
                                      guildPlayer.currentTrack.info
                                          ?.uri ?? null,

                                  duration:
                                      guildPlayer.currentTrack.info
                                          ?.duration ?? 0,
                              }
                            : null,

                        queueSize:
                            guildPlayer.queue.size,
                    })
                )
            } catch (error) {
                console.error(
                    '[INTERNAL API] Failed to skip track:',
                    error
                )

                response.writeHead(500)

                response.end(
                    JSON.stringify({
                        error: 'Failed to skip track',
                    })
                )
            }

            return
        }

        if (
            request.method === 'POST' &&
            request.url.startsWith('/player/') &&
            request.url.endsWith('/back')
        ) {
            const guildId = request.url.slice(
                '/player/'.length,
                -'/back'.length
            )

            const guildPlayer =
                client.playerManager?.get(guildId)

            if (!guildPlayer) {
                response.writeHead(404)

                response.end(
                    JSON.stringify({
                        error: 'Player not found',
                    })
                )

                return
            }

            try {
                const success = await guildPlayer.back()

                response.writeHead(200)

                response.end(
                    JSON.stringify({
                        success,

                        currentTrack: guildPlayer.currentTrack
                            ? {
                                  title:
                                      guildPlayer.currentTrack.info
                                          ?.title ?? 'Unknown',

                                  artist:
                                      guildPlayer.currentTrack.info
                                          ?.author ?? 'Unknown',

                                  album:
                                      guildPlayer.currentTrack.info
                                          ?.albumName ?? 'Unknown',

                                  artwork:
                                      guildPlayer.currentTrack.info
                                          ?.artworkUrl ?? null,

                                  uri:
                                      guildPlayer.currentTrack.info
                                          ?.uri ?? null,

                                  duration:
                                      guildPlayer.currentTrack.info
                                          ?.duration ?? 0,
                              }
                            : null,

                        queueSize:
                            guildPlayer.queue.size,
                    })
                )
            } catch (error) {
                console.error(
                    '[INTERNAL API] Failed to go back:',
                    error
                )

                response.writeHead(500)

                response.end(
                    JSON.stringify({
                        error: 'Failed to go back',
                    })
                )
            }

            return
        }

        response.writeHead(404)

        response.end(
            JSON.stringify({
                error: 'Not Found',
            })
        )
    })

    server.listen(PORT, HOST, () => {
        console.log(
            `[INTERNAL API] Listening on http://${HOST}:${PORT}`
        )
    })

    return server
}