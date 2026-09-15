import { SlashCommandBuilder } from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or add it to the queue')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Song name, URL, or search query')
                .setRequired(true)
        );

export async function execute(interaction, client) {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
        await interaction.reply({
            content: '❌ You need to be in a voice channel first.',
            ephemeral: true
        });
        return;
    }

    const query = interaction.options.getString('query');

    await interaction.deferReply();

    if (!client.lavalink?.useable) {
        await interaction.editReply(
            '❌ Lavalink is not currently available.'
        );
        return;
    }

    const guildPlayer = client.playerManager.create(interaction);

    if (!guildPlayer.lavalinkPlayer) {
        await guildPlayer.connect();
    }

    const player = guildPlayer.lavalinkPlayer;

    const result = await player.search(
        { query },
        interaction.user
    );

    if (!result.tracks || result.tracks.length === 0) {
        await interaction.editReply(
            `❌ No results found for **${query}**.`
        );
        return;
    }

    const track = result.tracks[0];

    await guildPlayer.addTrack(track);

    if (client.playerPanel) {
        await client.playerPanel.update(guildPlayer);
    }

    await interaction.editReply(
        `🎵 Added **${track.info.title}** by **${track.info.author}**`
    );
}
