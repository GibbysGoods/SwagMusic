import {
    SlashCommandBuilder
} from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription(
            'Check whether the bot is online'
        );

export async function execute(interaction) {

    await interaction.reply(
        `🏓 Pong! ${interaction.client.ws.ping}ms`
    );

}

