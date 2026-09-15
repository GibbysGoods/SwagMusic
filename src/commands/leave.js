import { SlashCommandBuilder } from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Stop playback and leave the voice channel');

export async function execute(interaction, client) {
    const guildPlayer =
        client.playerManager?.get(interaction.guildId);

    if (!guildPlayer) {
        await interaction.reply(
            'I am not currently in a voice channel.'
        );
        return;
    }

    await interaction.deferReply();

    await guildPlayer.destroy();

    client.playerManager.delete(interaction.guildId);

    await interaction.editReply(
        '👋 Stopped playback and left the voice channel.'
    );
}
