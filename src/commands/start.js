import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start or reset the music player in your voice channel');

export async function execute(interaction, client) {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
        await interaction.reply({
            content: '❌ You need to be in a voice channel first.',
            flags: MessageFlags.Ephemeral
        });

        setTimeout(() => {
            interaction.deleteReply().catch(() => {});
        }, 5000);

        return;
    }

    if (!client.lavalink?.useable) {
        await interaction.reply({
            content: '❌ Lavalink is not currently available.',
            flags: MessageFlags.Ephemeral
        });

        setTimeout(() => {
            interaction.deleteReply().catch(() => {});
        }, 10000);

        return;
    }

    // Respond immediately instead of deferring.
    await interaction.reply({
        content: `🎵 Starting the music player in **${voiceChannel.name}**...`,
        flags: MessageFlags.Ephemeral
    });

    try {
        let guildPlayer = client.playerManager?.get(interaction.guildId);

        if (!guildPlayer) {
            guildPlayer = client.playerManager.create(interaction);
            console.log(`[PLAYER] Created player for ${interaction.guildId}`);
        }

        if (guildPlayer.voiceChannelId !== voiceChannel.id) {
            if (guildPlayer.lavalinkPlayer) {
                await guildPlayer.destroy();
            }

            guildPlayer.voiceChannelId = voiceChannel.id;
            guildPlayer.textChannelId = interaction.channelId;
        }

        if (client.playerPanel) {
            await client.playerPanel.cleanupChannel(voiceChannel);
        }

        if (!guildPlayer.lavalinkPlayer) {
            await guildPlayer.connect();
            console.log(`[PLAYER] Connected player for ${interaction.guildId}`);
        }

        if (client.playerPanel) {
            await client.playerPanel.update(guildPlayer);
        }

        await interaction.editReply({
            content: `🎵 Music player started in **${voiceChannel.name}**.`
        });

        setTimeout(() => {
            interaction.deleteReply().catch(() => {});
        }, 5000);

    } catch (error) {
        console.error('[START] Failed to initialize player:', error);

        try {
            await interaction.editReply({
                content: '❌ Failed to start the music player.'
            });

            setTimeout(() => {
                interaction.deleteReply().catch(() => {});
            }, 10000);
        } catch (replyError) {
            console.error('[START] Could not update error response:', replyError);
        }
    }
}
