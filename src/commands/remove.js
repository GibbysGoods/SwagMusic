import { SlashCommandBuilder } from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option =>
            option
                .setName('position')
                .setDescription(
                    'Position of the song in the queue'
                )
                .setRequired(true)
                .setMinValue(1)
        );

export async function execute(
    interaction,
    client
) {
    /*
     * Get this server's player.
     */
    const guildPlayer =
        client.playerManager?.get(
            interaction.guildId
        );

    /*
     * There is no player or nothing is queued.
     */
    if (
        !guildPlayer ||
        guildPlayer.queue.size === 0
    ) {
        await interaction.reply(
            'There are no songs in the queue.'
        );

        return;
    }

    /*
     * Get the position supplied by the user.
     *
     * Discord gives us the actual number they entered.
     */
    const position =
        interaction.options.getInteger(
            'position'
        );

    /*
     * Convert the user's 1-based position
     * into JavaScript's 0-based array index.
     *
     * User:     1  2  3
     * Array:    0  1  2
     */
    const index =
        position - 1;

    /*
     * Make sure the requested position
     * actually exists.
     */
    if (
        index < 0 ||
        index >= guildPlayer.queue.size
    ) {
        await interaction.reply(
            `Invalid position. The queue currently has **${guildPlayer.queue.size}** song(s).`
        );

        return;
    }

    /*
     * Remove the track from the queue.
     */
    const removedTrack =
        guildPlayer.queue.remove(index);

    /*
     * Tell the user what was removed.
     */
    await interaction.reply(
        `🗑️ Removed **${removedTrack.info.title}** from the queue.`
    );
}
