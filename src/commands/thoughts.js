import {
    SlashCommandBuilder
} from 'discord.js';

export const data =
    new SlashCommandBuilder()
        .setName('thoughts')
        .setDescription(
            'penny for ur thots'
        );

export async function execute(interaction) {

    await interaction.reply(
        `dont talk to me, who are you`
    );

}