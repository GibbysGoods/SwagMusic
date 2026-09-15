import 'dotenv/config';

import {
    REST,
    Routes
} from 'discord.js';

import fs from 'node:fs';
import path from 'node:path';
import {
    fileURLToPath
} from 'node:url';

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const commandsPath =
    path.join(
        __dirname,
        'commands'
    );

const commandFiles =
    fs.readdirSync(commandsPath)
        .filter(
            file =>
                file.endsWith('.js')
        );

const commands = [];

for (const file of commandFiles) {

    const command =
        await import(
            `./commands/${file}`
        );

    if (!command.data) {
        continue;
    }

    commands.push(
        command.data.toJSON()
    );
}

const rest =
    new REST({
        version: '10'
    }).setToken(
        process.env.DISCORD_TOKEN
    );

console.log(
    `Deploying ${commands.length} commands...`
);

await rest.put(
    Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
    ),
    {
        body: commands
    }
);

console.log(
    'Commands deployed successfully.'
);
