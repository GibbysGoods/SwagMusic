import { LavalinkManager } from 'lavalink-client';

export function createLavalinkManager(client) {

    const lavalink =
        new LavalinkManager({
            nodes: [
                {
                    id:
                        process.env.LAVALINK_NAME ??
                        'Main Node',

                    host:
                        process.env.LAVALINK_HOST ??
                        'localhost',

                    port:
                        Number(
                            process.env.LAVALINK_PORT ??
                            2333
                        ),

                    authorization:
                        process.env.LAVALINK_PASSWORD ??
                        'change-this-password',

                    secure: false
                }
            ],

            /*
             * Discord voice packets need to be
             * forwarded to the Lavalink node.
             */
            sendToShard: (
                guildId,
                payload
            ) => {

                const guild =
                    client.guilds.cache.get(
                        guildId
                    );

                if (guild) {
                    guild.shard.send(
                        payload
                    );
                }
            },

            autoSkip: false,

            client: {
                id: client.user.id,
                username: client.user.username
            }
        });

    /*
     * -----------------------------------------
     * Lavalink node events
     * -----------------------------------------
     */

    lavalink.nodeManager

        .on(
            'connect',
            node => {

                console.log(
                    `Lavalink node connected: ${node.id}`
                );
            }
        )

        .on(
            'disconnect',
            (
                node,
                reason
            ) => {

                console.warn(
                    `Lavalink node disconnected: ${node.id}`,
                    reason
                );
            }
        )

        .on(
            'error',
            (
                node,
                error
            ) => {

                console.error(
                    `Lavalink node error: ${node.id}`,
                    error
                );
            }
        );

    /*
     * -----------------------------------------
     * Track started
     * -----------------------------------------
     */

    lavalink.on(
        'trackStart',
        async (
            player,
            track,
            payload
        ) => {

            console.log(
                `[EVENT] trackStart: ` +
                `${track?.info?.title ?? 'unknown'}`
            );

            const guildPlayer =
                client.playerManager?.get(
                    player.guildId
                );

            if (!guildPlayer) {

                console.log(
                    `[EVENT] No GuildPlayer found for ` +
                    `${player.guildId}`
                );

                return;
            }

            /*
             * Lavalink has confirmed that the track
             * actually started playing.
             *
             * Update the panel here so it reflects
             * the track that is actually playing.
             */
            if (client.playerPanel) {

                try {

                    await client.playerPanel.update(
                        guildPlayer
                    );

                } catch (error) {

                    console.error(
                        `[PANEL] Failed to update panel on trackStart:`,
                        error
                    );
                }
            }
        }
    );

    /*
     * -----------------------------------------
     * Queue ended / track finished
     * -----------------------------------------
     *
     * In our current Lavalink setup, the event
     * emitted when playback reaches the end of
     * a track is queueEnd.
     *
     * Our GuildPlayer maintains its own queue,
     * so we use playNext() here to advance it.
     * -----------------------------------------
     */

    lavalink.on(
        'queueEnd',
        async (
            player,
            track,
            payload
        ) => {

            console.log(
                `[EVENT] queueEnd:`,
                {
                    guildId:
                        player.guildId,

                    track:
                        track?.info?.title ??
                        null,

                    reason:
                        payload?.reason ??
                        null
                }
            );

            const guildPlayer =
                client.playerManager?.get(
                    player.guildId
                );

            if (!guildPlayer) {

                console.log(
                    `[EVENT] No GuildPlayer found for ` +
                    `${player.guildId}`
                );

                return;
            }

            /*
             * A manually stopped track should not
             * automatically start another track.
             */
            if (
                guildPlayer.endAction ===
                'stop'
            ) {

                console.log(
                    `[EVENT] Playback was stopped manually.`
                );

                guildPlayer.endAction =
                    'continue';

                if (client.playerPanel) {

                    try {

                        await client.playerPanel.update(
                            guildPlayer
                        );

                    } catch (error) {

                        console.error(
                            `[PANEL] Failed to update panel after stop:`,
                            error
                        );
                    }
                }

                return;
            }

            /*
             * Advance our own queue.
             *
             * playNext() handles:
             * - history
             * - the next queued track
             * - an empty queue
             * - panel updates
             */
            try {

                await guildPlayer.playNext();

            } catch (error) {

                console.error(
                    `[EVENT] playNext() failed:`,
                    error
                );
            }
        }
    );

    return lavalink;
}
