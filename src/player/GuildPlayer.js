import { Queue } from './Queue.js';

export class GuildPlayer {
    constructor(client, interaction) {
        this.client = client;
        this.guildId = interaction.guildId;
        this.voiceChannelId = interaction.member.voice.channelId;
        this.textChannelId = interaction.channelId;

        this.lavalinkPlayer = null;

        this.queue = new Queue();

        this.currentTrack = null;

        this.volume = 100;
        this.repeatMode = 'off';
        this.paused = false;
        this.destroyed = false;

        this.emptyChannelTimer = null;

        this.endAction = 'continue';

        this.history = [];
        this.maxHistorySize = 25;

        this.goingBack = false;
    }

    getState() {
        return {
            guildId: this.guildId,
            voiceChannelId: this.voiceChannelId,
            textChannelId: this.textChannelId,
            currentTrack: this.currentTrack,
            queueSize: this.queue.size,
            volume: this.volume,
            repeatMode: this.repeatMode,
            paused: this.paused,
            connected: this.lavalinkPlayer !== null,
            destroyed: this.destroyed,
            historySize: this.history.length
        };
    }

    async connect() {
        if (this.lavalinkPlayer) {
            return;
        }

        this.lavalinkPlayer =
            this.client.lavalink.createPlayer({
                guildId: this.guildId,
                voiceChannelId: this.voiceChannelId,
                textChannelId: this.textChannelId,
                selfDeaf: true,
                selfMute: false,
                volume: this.volume
            });

        await this.lavalinkPlayer.connect();
    }

    async addTrack(track) {
        this.queue.add(track);

        console.log(
            `[QUEUE] ${this.guildId}: added "${track.info.title}"`
        );

        if (!this.currentTrack) {
            await this.playNext();
        }
    }

    async playNext() {
        const nextTrack =
            this.queue.next;

        if (!nextTrack) {
            console.log(
                `[QUEUE] ${this.guildId}: queue is empty`
            );

            this.currentTrack = null;
            this.paused = false;

            if (this.client.playerPanel) {
                await this.client.playerPanel.update(this);
            }

            return;
        }

        if (
            this.currentTrack &&
            !this.goingBack
        ) {
            this.addToHistory(
                this.currentTrack
            );
        }

        console.log(
            `[QUEUE] ${this.guildId}: starting "${nextTrack.info.title}"`
        );

        try {
            this.currentTrack =
                nextTrack;

            this.paused = false;

            await this.lavalinkPlayer.play({
                clientTrack: nextTrack
            });

            this.goingBack = false;

        } catch (error) {
            console.error(
                `[QUEUE] ${this.guildId}: failed to play "${nextTrack.info.title}"`,
                error
            );

            this.queue.prepend(
                nextTrack
            );

            this.currentTrack = null;

            throw error;
        }
    }

    /*
     * --------------------------------------------------
     * Skip
     * --------------------------------------------------
     *
     * We maintain our own queue rather than Lavalink's
     * internal queue, so we stop the current track and
     * immediately advance our GuildPlayer queue.
     * --------------------------------------------------
     */

    async skip() {
        if (
            !this.lavalinkPlayer ||
            !this.currentTrack
        ) {
            return false;
        }

        const skippedTrack =
            this.currentTrack;

        console.log(
            `[QUEUE] ${this.guildId}: skipping "${skippedTrack.info.title}"`
        );

        /*
         * Tell the trackEnd handler not to automatically
         * advance the queue. We will do it ourselves.
         */

        this.endAction = 'stop';

        try {

            /*
             * Stop the current Lavalink playback.
             */

            await this.lavalinkPlayer.stopPlaying();

            /*
             * Manually advance our own queue.
             */

            await this.playNext();

            this.endAction = 'continue';

            return true;

        } catch (error) {

            this.endAction = 'continue';

            console.error(
                `[QUEUE] ${this.guildId}: skip failed`,
                error
            );

            throw error;
        }
    }

    addToHistory(track) {
        if (!track) {
            return;
        }

        this.history.push(track);

        if (
            this.history.length >
            this.maxHistorySize
        ) {
            this.history.shift();
        }

        console.log(
            `[HISTORY] ${this.guildId}: added "${track.info?.title ?? 'Unknown'}"`
        );
    }

    async back() {
        if (!this.currentTrack) {
            return false;
        }

        const position =
            this.lavalinkPlayer?.position ?? 0;

        /*
         * If we're more than 5 seconds into the
         * current song, restart it.
         */

        if (position > 5000) {
            await this.lavalinkPlayer.seek(0);

            this.paused = false;

            return true;
        }

        const previousTrack =
            this.history.pop();

        if (!previousTrack) {
            await this.lavalinkPlayer.seek(0);

            this.paused = false;

            return true;
        }

        this.queue.prepend(
            this.currentTrack
        );

        this.goingBack = true;
        this.endAction = 'stop';

        try {
            await this.lavalinkPlayer.stopPlaying();

            this.currentTrack =
                previousTrack;

            this.paused = false;

            await this.lavalinkPlayer.play({
                clientTrack: previousTrack
            });

            this.endAction = 'continue';
            this.goingBack = false;

            return true;

        } catch (error) {
            this.history.push(
                previousTrack
            );

            this.endAction = 'continue';
            this.goingBack = false;

            throw error;
        }
    }

    startEmptyChannelTimer() {
        if (this.emptyChannelTimer) {
            return;
        }

        console.log(
            `[VOICE] ${this.guildId}: channel is empty. Leaving in 30 seconds.`
        );

        this.emptyChannelTimer =
            setTimeout(
                async () => {
                    this.emptyChannelTimer = null;

                    console.log(
                        `[VOICE] ${this.guildId}: empty channel timeout reached.`
                    );

                    await this.destroy();

                    this.client.playerManager.delete(
                        this.guildId
                    );
                },
                30_000
            );
    }

    cancelEmptyChannelTimer() {
        if (!this.emptyChannelTimer) {
            return;
        }

        clearTimeout(
            this.emptyChannelTimer
        );

        this.emptyChannelTimer = null;

        console.log(
            `[VOICE] ${this.guildId}: someone returned to the channel.`
        );
    }

    async stop() {
        this.endAction = 'stop';

        this.currentTrack = null;

        this.queue.clear();

        this.history = [];

        this.paused = false;

        if (this.lavalinkPlayer) {
            await this.lavalinkPlayer.stopPlaying();
        }
    }

    async destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;

        this.cancelEmptyChannelTimer();

        this.queue.clear();

        this.history = [];

        this.currentTrack = null;

        this.paused = false;

        if (this.lavalinkPlayer) {
            await this.lavalinkPlayer.destroy();

            this.lavalinkPlayer = null;
        }
    }
}
