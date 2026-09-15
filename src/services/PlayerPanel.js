import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

export class PlayerPanel {
    constructor(client) {
        this.client = client;
        this.messages = new Map();
        this.updating = new Map();
    }

    async update(guildPlayer) {
        if (!guildPlayer) return;

        const guildId =
            guildPlayer.guildId;

        /*
         * Prevent multiple panel updates for the
         * same guild from running simultaneously.
         */

        const previousUpdate =
            this.updating.get(guildId) ??
            Promise.resolve();

        const currentUpdate =
            previousUpdate
                .catch(() => {})
                .then(() =>
                    this.performUpdate(guildPlayer)
                );

        this.updating.set(
            guildId,
            currentUpdate
        );

        try {
            await currentUpdate;
        } finally {
            if (
                this.updating.get(guildId) ===
                currentUpdate
            ) {
                this.updating.delete(
                    guildId
                );
            }
        }
    }

    async performUpdate(guildPlayer) {
        const guild =
            this.client.guilds.cache.get(
                guildPlayer.guildId
            );

        if (!guild) return;

        const channel =
            guild.channels.cache.get(
                guildPlayer.voiceChannelId
            );

        if (!channel) {
            console.warn(
                `[PANEL] Voice channel not found for ${guildPlayer.guildId}`
            );

            return;
        }

        if (!channel.isSendable()) {
            console.warn(
                `[PANEL] Voice channel "${channel.name}" is not sendable.`
            );

            return;
        }

        const state =
            guildPlayer.getState();

        const embed =
            this.createEmbed(
                state,
                channel
            );

        const components =
            this.createButtons(
                state
            );

        let message =
            this.messages.get(
                guildPlayer.guildId
            );


        /*
         * --------------------------------------------------
         * Existing panel
         * --------------------------------------------------
         */

        if (message) {
            try {
                await message.edit({
                    embeds: [embed],
                    components
                });

                return;
            } catch (error) {
                console.warn(
                    `[PANEL] Existing panel could not be updated. ` +
                    `Creating a new one.`
                );

                this.messages.delete(
                    guildPlayer.guildId
                );
            }
        }


        /*
         * --------------------------------------------------
         * No panel exists
         * --------------------------------------------------
         */

        try {
            message =
                await channel.send({
                    embeds: [embed],
                    components
                });

            this.messages.set(
                guildPlayer.guildId,
                message
            );

            console.log(
                `[PANEL] Created player panel in ` +
                `"${channel.name}" for ${guildPlayer.guildId}`
            );

        } catch (error) {
            console.error(
                `[PANEL] Failed to create panel in ` +
                `"${channel.name}":`,
                error
            );
        }
    }


    /*
     * --------------------------------------------------
     * Clean up old music player panels
     * --------------------------------------------------
     *
     * This searches the voice channel's embedded
     * text chat and deletes messages belonging to
     * our music player.
     *
     * It does NOT delete normal chat messages or
     * unrelated bot messages.
     * --------------------------------------------------
     */

    async cleanupChannel(channel) {
        if (!channel) return;

        if (!channel.isSendable()) {
            console.warn(
                `[PANEL] Channel "${channel.name}" is not sendable.`
            );

            return;
        }

        console.log(
            `[PANEL] Cleaning up old player panels in "${channel.name}"`
        );

        let deletedCount = 0;
        let lastMessageId = null;

        try {

            /*
             * Discord returns messages in batches.
             * Keep fetching until there are no more
             * messages to inspect.
             */

            while (true) {

                const options = {
                    limit: 100
                };

                if (lastMessageId) {
                    options.before =
                        lastMessageId;
                }

                const messages =
                    await channel.messages.fetch(
                        options
                    );

                if (messages.size === 0) {
                    break;
                }


                /*
                 * Look for messages created by this bot
                 * that contain our Music Player panel.
                 */

                const playerMessages =
                    messages.filter(
                        message => {

                            if (
                                message.author.id !==
                                this.client.user.id
                            ) {
                                return false;
                            }

                            if (
                                message.embeds.length === 0
                            ) {
                                return false;
                            }

                            return message.embeds.some(
                                embed =>
                                    embed.author?.name ===
                                    'M U S I C   P L A Y E R'
                            );
                        }
                    );


                /*
                 * Delete each player panel.
                 */

                for (
                    const message
                    of playerMessages.values()
                ) {

                    try {

                        await message.delete();

                        deletedCount++;

                    } catch (error) {

                        console.warn(
                            `[PANEL] Could not delete old player panel ${message.id}.`,
                            error
                        );
                    }
                }


                /*
                 * Move backwards through channel history.
                 */

                lastMessageId =
                    messages.last().id;

                if (
                    messages.size < 100
                ) {
                    break;
                }
            }


            /*
             * Forget any panel reference we had
             * stored for this guild.
             */

            for (
                const [
                    guildId,
                    message
                ]
                of this.messages.entries()
            ) {

                if (
                    message.channelId ===
                    channel.id
                ) {

                    this.messages.delete(
                        guildId
                    );
                }
            }

            console.log(
                `[PANEL] Removed ${deletedCount} old player panel(s) from "${channel.name}".`
            );

        } catch (error) {

            console.error(
                `[PANEL] Failed while cleaning up "${channel.name}":`,
                error
            );
        }
    }


    createEmbed(state, voiceChannel) {

        if (!state.currentTrack) {

            return new EmbedBuilder()
                .setColor(0x15171c)
                .setAuthor({
                    name: 'M U S I C   P L A Y E R'
                })
                .setDescription(
                    `🔊 **${voiceChannel.name}**\n\n` +
                    'Nothing is currently playing.\n\n' +
                    '**Hit + Add To Start Listening**'
                )
                .setFooter({
                    text: 'Music Player'
                });
        }


        const track =
            state.currentTrack;

        const title =
            track.info?.title ??
            'Unknown track';

        const author =
            track.info?.author ??
            'Unknown artist';

        const duration =
            track.info?.length ??
            0;

        const artwork =
            track.info?.artworkUrl ??
            null;

        const position =
            state.position ??
            0;

        const status =
            state.paused
                ? '⏸️  Paused'
                : '🟢  Playing';


        return new EmbedBuilder()
            .setColor(0x15171c)
            .setAuthor({
                name: 'M U S I C   P L A Y E R'
            })
            .setDescription(
                `🔊 **${voiceChannel.name}**\n\n` +
                `**${title}**\n` +
                `*${author}*\n\n` +
                `${status}\n\n` +
                `${this.createProgressBar(position, duration)}\n` +
                `\`${this.formatDuration(position)}\`` +
                `　　　　　　　　　` +
                `\`${this.formatDuration(duration)}\``
            )
            .setImage(artwork)
            .addFields(
                {
                    name: 'QUEUE',
                    value:
                        `**${state.queueSize}** ` +
                        `${state.queueSize === 1 ? 'track' : 'tracks'}`,
                    inline: true
                },
                {
                    name: 'VOLUME',
                    value:
                        `**${state.volume}%**`,
                    inline: true
                },
                {
                    name: 'REPEAT',
                    value:
                        `**${this.formatRepeat(state.repeatMode)}**`,
                    inline: true
                }
            )
            .setFooter({
                text: 'Music Player'
            });
    }


    createButtons(state) {

        const previousButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_previous'
                )
                .setEmoji('⏮️')
                .setStyle(
                    ButtonStyle.Secondary
                );

        const pauseButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_pause'
                )
                .setEmoji(
                    state.paused
                        ? '▶️'
                        : '⏸️'
                )
                .setStyle(
                    ButtonStyle.Primary
                );

        const skipButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_skip'
                )
                .setEmoji('⏭️')
                .setStyle(
                    ButtonStyle.Secondary
                );

        const shuffleButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_shuffle'
                )
                .setEmoji('🔀')
                .setStyle(
                    ButtonStyle.Secondary
                );

        const repeatButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_repeat'
                )
                .setEmoji('🔁')
                .setStyle(
                    state.repeatMode !== 'off'
                        ? ButtonStyle.Primary
                        : ButtonStyle.Secondary
                );

        const addButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_add'
                )
                .setEmoji('➕')
                .setLabel('Add')
                .setStyle(
                    ButtonStyle.Success
                );

        const queueButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_queue'
                )
                .setEmoji('📋')
                .setLabel('Queue')
                .setStyle(
                    ButtonStyle.Secondary
                );

        const volumeButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_volume'
                )
                .setEmoji('🔊')
                .setLabel('Volume')
                .setStyle(
                    ButtonStyle.Secondary
                );

        const stopButton =
            new ButtonBuilder()
                .setCustomId(
                    'player_stop'
                )
                .setEmoji('⏹️')
                .setLabel('Stop')
                .setStyle(
                    ButtonStyle.Danger
                );


        const playbackRow =
            new ActionRowBuilder()
                .addComponents(
                    previousButton,
                    pauseButton,
                    skipButton,
                    shuffleButton,
                    repeatButton
                );

        const utilityRow =
            new ActionRowBuilder()
                .addComponents(
                    addButton,
                    queueButton,
                    volumeButton,
                    stopButton
                );


        return [
            playbackRow,
            utilityRow
        ];
    }


    createProgressBar(
        position,
        duration
    ) {

        if (
            !duration ||
            duration <= 0
        ) {
            return '━━━━━━━━━━━━━━━━━━━━';
        }

        const progress =
            Math.min(
                Math.max(
                    position / duration,
                    0
                ),
                1
            );

        const segments = 20;

        const filled =
            Math.round(
                progress * segments
            );

        return (
            '━'.repeat(filled) +
            '●' +
            '━'.repeat(
                Math.max(
                    segments -
                    filled -
                    1,
                    0
                )
            )
        );
    }


    formatDuration(
        milliseconds
    ) {

        const totalSeconds =
            Math.floor(
                milliseconds / 1000
            );

        const hours =
            Math.floor(
                totalSeconds / 3600
            );

        const minutes =
            Math.floor(
                (totalSeconds % 3600) / 60
            );

        const seconds =
            totalSeconds % 60;


        if (hours > 0) {

            return (
                `${hours}:` +
                `${String(minutes).padStart(2, '0')}:` +
                `${String(seconds).padStart(2, '0')}`
            );
        }


        return (
            `${minutes}:` +
            `${String(seconds).padStart(2, '0')}`
        );
    }


    formatRepeat(mode) {

        switch (mode) {

            case 'track':
                return '🔂 Track';

            case 'queue':
                return '🔁 Queue';

            default:
                return 'Off';
        }
    }
}
