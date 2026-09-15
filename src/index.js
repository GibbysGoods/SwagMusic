import 'dotenv/config';

import { createLavalinkManager } from './services/LavalinkService.js';
import { PlayerManager } from './player/PlayerManager.js';
import { PlayerPanel } from './services/PlayerPanel.js';

import {
    Client,
    GatewayIntentBits,
    Collection,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags
} from 'discord.js';

import fs from 'node:fs';
import path from 'node:path';

import {
    fileURLToPath,
    pathToFileURL
} from 'node:url';


/*
 * --------------------------------------------------
 * Discord client
 * --------------------------------------------------
 */

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);


const client =
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates
        ]
    });


/*
 * --------------------------------------------------
 * Application state
 * --------------------------------------------------
 */

client.lavalink = null;
client.playerManager = null;
client.playerPanel = null;

client.commands =
    new Collection();


/*
 * --------------------------------------------------
 * Load slash commands
 * --------------------------------------------------
 */

const commandsPath =
    path.join(
        __dirname,
        'commands'
    );

const commandFiles =
    fs
        .readdirSync(commandsPath)
        .filter(
            file =>
                file.endsWith('.js')
        );


for (const file of commandFiles) {

    const filePath =
        path.join(
            commandsPath,
            file
        );

    const command =
        await import(
            pathToFileURL(filePath).href
        );

    if (
        'data' in command &&
        'execute' in command
    ) {

        client.commands.set(
            command.data.name,
            command
        );

        console.log(
            `Loaded command: ${command.data.name}`
        );

    } else {

        console.warn(
            `Command ${file} is missing ` +
            `"data" or "execute".`
        );
    }
}


/*
 * --------------------------------------------------
 * Discord ready
 * --------------------------------------------------
 */

client.once(
    Events.ClientReady,
    async readyClient => {

        console.log(
            `Logged in as ${readyClient.user.tag}`
        );

        client.lavalink =
            createLavalinkManager(
                client
            );

        await client.lavalink.init({
            ...readyClient.user
        });

        client.playerManager =
            new PlayerManager(
                client
            );

        client.playerPanel =
            new PlayerPanel(
                client
            );
    }
);


/*
 * --------------------------------------------------
 * Interactions
 * --------------------------------------------------
 */

client.on(
    Events.InteractionCreate,
    async interaction => {

    	console.log('[INTERACTION]', {
    	    id: interaction.id,
    	    commandName: interaction.isChatInputCommand() ? interaction.commandName : undefined,
    	    commandId: interaction.isChatInputCommand() ? interaction.commandId : undefined,
    	    applicationId: interaction.applicationId,
    	    guildId: interaction.guildId
    	});

        /*
         * ==================================================
         * MODAL SUBMISSIONS
         * ==================================================
         */

        if (
            interaction.isModalSubmit()
        ) {

            if (
                interaction.customId ===
                'player_add_modal'
            ) {

                const query =
                    interaction.fields.getTextInputValue(
                        'player_add_query'
                    );

                const guildPlayer =
                    client.playerManager?.get(
                        interaction.guildId
                    );

                if (
                    !guildPlayer?.lavalinkPlayer
                ) {

                    await interaction.reply({
                        content:
                            '❌ I am not currently connected to a voice channel.',
                        flags: MessageFlags.Ephemeral
                    });

                    setTimeout(
                        async () => {
                            try {
                                await interaction.deleteReply();
                            } catch {
                                // Already gone.
                            }
                        },
                        10_000
                    );

                    return;
                }

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                try {

                    const result =
                        await guildPlayer
                            .lavalinkPlayer
                            .search(
                                { query },
                                interaction.user
                            );

                    if (
                        !result.tracks ||
                        result.tracks.length === 0
                    ) {

                        await interaction.editReply(
                            `❌ No results found for **${query}**.`
                        );

                        setTimeout(
                            async () => {
                                try {
                                    await interaction.deleteReply();
                                } catch {
                                    // Already gone.
                                }
                            },
                            10_000
                        );

                        return;
                    }

                    const track =
                        result.tracks[0];

                    const wasPlaying =
                        guildPlayer.currentTrack !== null;

                    await guildPlayer.addTrack(
                        track
                    );

                    if (
                        client.playerPanel
                    ) {

                        await client.playerPanel.update(
                            guildPlayer
                        );
                    }

                    if (wasPlaying) {

                        await interaction.editReply(
                            `🎵 Added **${track.info.title}** by **${track.info.author}** to the queue.`
                        );

                    } else {

                        await interaction.editReply(
                            `🎵 Playing **${track.info.title}** by **${track.info.author}**.`
                        );
                    }

                    setTimeout(
                        async () => {
                            try {
                                await interaction.deleteReply();
                            } catch {
                                // Already gone.
                            }
                        },
                        5_000
                    );

                } catch (error) {

                    console.error(
                        '[PANEL] Failed to add track:',
                        error
                    );

                    try {
                        await interaction.editReply(
                            '❌ Something went wrong while trying to add that track.'
                        );
                    } catch {
                        // Interaction may already be unavailable.
                    }

                    setTimeout(
                        async () => {
                            try {
                                await interaction.deleteReply();
                            } catch {
                                // Already gone.
                            }
                        },
                        10_000
                    );
                }

                return;
            }

            return;
        }


        /*
         * ==================================================
         * BUTTON INTERACTIONS
         * ==================================================
         */

        if (
            interaction.isButton()
        ) {

            /*
             * --------------------------------------------------
             * ADD MUSIC
             * --------------------------------------------------
             */

            if (
                interaction.customId ===
                'player_add'
            ) {

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            'player_add_modal'
                        )
                        .setTitle(
                            'Add music'
                        );

                const queryInput =
                    new TextInputBuilder()
                        .setCustomId(
                            'player_add_query'
                        )
                        .setLabel(
                            'Song name or URL'
                        )
                        .setPlaceholder(
                            'Search for a song or paste a URL...'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            500
                        );

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            queryInput
                        );

                modal.addComponents(
                    row
                );

                console.log('[ADD DEBUG] Before showModal:', {
                    id: interaction.id,
                    replied: interaction.replied,
                    deferred: interaction.deferred,
                    acknowledged: interaction.replied || interaction.deferred
                });
                
                await interaction.showModal(
                    modal
                );
                
                console.log('[ADD DEBUG] showModal succeeded');

                return;
            }


            /*
             * --------------------------------------------------
             * SKIP
             * --------------------------------------------------
             */

            if (
                interaction.customId ===
                'player_skip'
            ) {

                const guildPlayer =
                    client.playerManager?.get(
                        interaction.guildId
                    );

                if (
                    !guildPlayer?.lavalinkPlayer ||
                    !guildPlayer.currentTrack
                ) {

                    await interaction.reply({
                        content:
                            '❌ Nothing is currently playing.',
                        flags: MessageFlags.Ephemeral
                    });

                    setTimeout(
                        async () => {
                            try {
                                await interaction.deleteReply();
                            } catch {
                                // Already gone.
                            }
                        },
                        10_000
                    );

                    return;
                }

                const skippedTrack =
                    guildPlayer.currentTrack;

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                try {

                    /*
                     * Use the exact same skip method
                     * as the /skip command.
                     */

                    await guildPlayer.skip();

                    await interaction.editReply(
                        `⏭️ Skipped **${skippedTrack.info.title}**`
                    );

                    setTimeout(
                        async () => {
                            try {
                                await interaction.deleteReply();
                            } catch {
                                // Already gone.
                            }
                        },
                        5_000
                    );

                } catch (error) {

                    console.error(
                        '[PANEL] Skip failed:',
                        error
                    );

                    try {
                        await interaction.editReply(
                            '❌ Failed to skip the current track.'
                        );
                    } catch {
                        // Interaction may already be unavailable.
                    }

                    setTimeout(
                        async () => {
                            try {
                                await interaction.deleteReply();
                            } catch {
                                // Already gone.
                            }
                        },
                        10_000
                    );
                }

                return;
            }


            /*
             * --------------------------------------------------
             * STOP CONFIRMATION
             * --------------------------------------------------
             */

            if (
                interaction.customId.startsWith(
                    'stop_confirm:'
                ) ||
                interaction.customId.startsWith(
                    'stop_cancel:'
                )
            ) {

                const [
                    action,
                    userId
                ] =
                    interaction.customId.split(':');

                if (
                    interaction.user.id !==
                    userId
                ) {

                    await interaction.reply({
                        content:
                            '❌ Only the person who started this confirmation can use these buttons.',
                        flags: MessageFlags.Ephemeral
                    });

                    setTimeout(
                        async () => {
                            try {
                                await interaction.deleteReply();
                            } catch {
                                // Already gone.
                            }
                        },
                        10_000
                    );

                    return;
                }

                if (
                    action ===
                    'stop_cancel'
                ) {

                    await interaction.update({
                        content:
                            '❌ **Stop cancelled.** Playback and the queue were left unchanged.',
                        components: []
                    });

                    return;
                }

                const guildPlayer =
                    client.playerManager?.get(
                        interaction.guildId
                    );

                if (
                    !guildPlayer?.lavalinkPlayer
                ) {

                    await interaction.update({
                        content:
                            '❌ Nothing is currently playing.',
                        components: []
                    });

                    return;
                }

                await guildPlayer.stop();

                if (
                    client.playerPanel
                ) {

                    await client.playerPanel.update(
                        guildPlayer
                    );
                }

                await interaction.update({
                    content:
                        '⏹️ **Playback stopped and the queue was cleared.**',
                    components: []
                });

                return;
            }


            /*
             * --------------------------------------------------
             * Other player buttons aren't implemented yet.
             * --------------------------------------------------
             */

            return;
        }


        /*
         * ==================================================
         * SLASH COMMANDS
         * ==================================================
         */

        if (
            !interaction.isChatInputCommand()
        ) {
            return;
        }

        const command =
            client.commands.get(
                interaction.commandName
            );

        if (!command) {

            console.warn(
                `Command not found: ${interaction.commandName}`
            );

            return;
        }

        try {

            await command.execute(
                interaction,
                client
            );

        } catch (error) {

            console.error(
                `[COMMAND] ${interaction.commandName} failed:`,
                error
            );

            const message =
                'There was an error executing this command.';

            /*
             * The command may have already acknowledged the
             * interaction before an error occurred.
             *
             * Never allow the error handler itself to crash
             * the bot.
             */

            try {

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp({
                        content: message,
                        flags: MessageFlags.Ephemeral
                    });

                } else {

                    await interaction.reply({
                        content: message,
                        flags: MessageFlags.Ephemeral
                    });
                }

            } catch (responseError) {

                console.error(
                    '[COMMAND] Could not send error response:',
                    responseError
                );
            }
        }
    }
);


/*
 * --------------------------------------------------
 * Voice channel monitoring
 * --------------------------------------------------
 */

client.on(
    Events.VoiceStateUpdate,
    (oldState, newState) => {

        if (
            oldState.channelId ===
            newState.channelId
        ) {
            return;
        }

        const guildId =
            oldState.guild.id;

        const guildPlayer =
            client.playerManager?.get(
                guildId
            );

        if (
            !guildPlayer?.lavalinkPlayer
        ) {
            return;
        }

        const botVoiceChannel =
            oldState.guild.channels.cache.get(
                guildPlayer.voiceChannelId
            );

        if (!botVoiceChannel) {
            return;
        }

        if (
            oldState.channelId !==
                guildPlayer.voiceChannelId &&
            newState.channelId !==
                guildPlayer.voiceChannelId
        ) {
            return;
        }

        const humansInChannel =
            botVoiceChannel.members.filter(
                member =>
                    !member.user.bot
            );

        if (
            humansInChannel.size === 0
        ) {

            guildPlayer.startEmptyChannelTimer();

        } else {

            guildPlayer.cancelEmptyChannelTimer();
        }
    }
);


/*
 * --------------------------------------------------
 * Lavalink voice events
 * --------------------------------------------------
 */

client.on(
    'raw',
    packet => {

        if (
            !client.lavalink
        ) {
            return;
        }

        if (
            packet.t ===
                'VOICE_STATE_UPDATE' ||
            packet.t ===
                'VOICE_SERVER_UPDATE'
        ) {

            console.log(
                `[VOICE] ${packet.t}`
            );
        }

        client.lavalink.sendRawData(
            packet
        );
    }
);


/*
 * --------------------------------------------------
 * Login
 * --------------------------------------------------
 */

await client.login(
    process.env.DISCORD_TOKEN
);
