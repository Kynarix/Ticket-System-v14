import { config } from 'dotenv';
import { GatewayIntentBits, Partials } from 'discord.js';
config();
export default {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  prefix: process.env.PREFIX || '!',
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember
  ],
  colors: {
    error: 0xf54242,
    success: 0x42f569,
    warning: 0xf5a742,
    info: 0x4287f5
  },

  channels: {
    logChannel: process.env.LOG_CHANNEL_ID
  },
  
  roles: {
    staffRole: process.env.STAFF_ROLE_ID
  }
}; 