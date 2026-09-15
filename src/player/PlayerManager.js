import { GuildPlayer } from './GuildPlayer.js';

export class PlayerManager {
    constructor(client) {
        this.client = client;

        this.players = new Map();
    }

    get(guildId) {
        return this.players.get(guildId);
    }

    create(interaction) {
        const guildId = interaction.guildId;

        let player = this.players.get(guildId);

        if (!player) {
            player = new GuildPlayer(
                this.client,
                interaction
            );

            this.players.set(
                guildId,
                player
            );
        }

        return player;
    }

    delete(guildId) {
        this.players.delete(guildId);
    }
}
