import { ActivityType } from 'discord.js';

export default {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`Bot ${client.user.tag} is ready and online!`);
  }
}; 