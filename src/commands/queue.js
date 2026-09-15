import {
    SlashCommandBuilder,
    EmbedBuilder
} from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue');

export async function execute(interaction, client) {
    const guildPlayer =
        client.playerManager?.get(interaction.guildId);

    if (!guildPlayer) {
        await interaction.reply(
            'The queue is empty.'
        );
        return;
    }

    const currentTrack =
        guildPlayer.currentTrack;

    const queuedTracks =
        guildPlayer.queue.all;

    if (!currentTrack && queuedTracks.length === 0) {
        await interaction.reply(
            'The queue is empty.'
        );
        return;
    }

    const embed =
        new EmbedBuilder()
            .setTitle('🎵 Music Queue');

    /*
     * Current track
     */
    if (currentTrack) {
        embed.addFields({
            name: '▶️ Now Playing',
            value:
                `**${currentTrack.info.title}**\n` +
                `${currentTrack.info.author}`
        });
    }

    /*
     * Upcoming tracks
     */
    if (queuedTracks.length > 0) {
        const queueText =
            queuedTracks
                .slice(0, 10)
                .map(
                    (track, index) =>
                        `**${index + 1}.** ` +
                        `${track.info.title} — ` +
                        `${track.info.author}`
                )
                .join('\n');

        embed.addFields({
            name: '📋 Up Next',
            value: queueText
        });

        if (queuedTracks.length > 10) {
            embed.setFooter({
                text:
                    `+ ${queuedTracks.length - 10} more tracks`
            });
        }
    } else {
        embed.addFields({
            name: '📋 Up Next',
            value: 'Nothing else is queued.'
        });
    }

    await interaction.reply({
        embeds: [embed]
    });
}
