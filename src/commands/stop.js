import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear the queue');

export async function execute(interaction, client) {
    const guildPlayer =
        client.playerManager?.get(interaction.guildId);

    if (!guildPlayer?.lavalinkPlayer) {
        await interaction.reply({
            content: 'Nothing is currently playing.',
            ephemeral: true
        });
        return;
    }

    const confirmButton =
        new ButtonBuilder()
            .setCustomId(`stop_confirm:${interaction.user.id}`)
            .setLabel('Confirm')
            .setEmoji('🛑')
            .setStyle(ButtonStyle.Danger);

    const cancelButton =
        new ButtonBuilder()
            .setCustomId(`stop_cancel:${interaction.user.id}`)
            .setLabel('Cancel')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary);

    const row =
        new ActionRowBuilder()
            .addComponents(
                confirmButton,
                cancelButton
            );

    await interaction.reply({
        content:
            '⚠️ **Stop playback?**\n\n' +
            'This will stop the current audio and clear the entire queue.',
        components: [row]
    });
}
