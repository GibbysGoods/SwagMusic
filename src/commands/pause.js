import { SlashCommandBuilder } from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume the current song');

export async function execute(interaction, client) {
    const guildPlayer = client.playerManager?.get(interaction.guildId);

    if (!guildPlayer?.lavalinkPlayer) {
        await interaction.reply('Nothing is currently playing.');
        return;
    }

    const player = guildPlayer.lavalinkPlayer;

    if (!guildPlayer.currentTrack) {
        await interaction.reply('Nothing is currently playing.');
        return;
    }

    if (guildPlayer.paused) {
        await player.resume();
        guildPlayer.paused = false;

        await interaction.reply(
            `▶️ Resumed **${guildPlayer.currentTrack.info.title}**`
        );

        return;
    }

    await player.pause();
    guildPlayer.paused = true;

    await interaction.reply(
        `⏸️ Paused **${guildPlayer.currentTrack.info.title}**`
    );
}
