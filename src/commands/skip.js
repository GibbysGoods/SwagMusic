import { SlashCommandBuilder } from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription(
            'Skip the current song'
        );

export async function execute(
    interaction,
    client
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
            ephemeral: true
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
        ephemeral: true
    });

    try {
        await guildPlayer.skip();

        await interaction.editReply(
            `⏭️ Skipped **${skippedTrack.info.title}**`
        );

        /*
         * Successful messages disappear after 5 seconds.
         */

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
            '[SKIP] Failed:',
            error
        );

        await interaction.editReply(
            '❌ Failed to skip the current track.'
        );

        /*
         * Error messages remain for 10 seconds.
         */

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
}
