import { EmbedBuilder } from 'discord.js';
import config from '../config/config.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createEmbed({ title, description, type = 'info', fields = [] }) {
  const color = config.colors[type] || config.colors.info;
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTimestamp();
  
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  
  if (fields.length > 0) {
    embed.addFields(fields);
  }
  
  return embed;
}

export async function loadCommands(commandPath) {
  try {
    const commands = [];
    const fullPath = join(__dirname, '..', commandPath);
    
    const commandFiles = readdirSync(fullPath)
      .filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      try {
        const moduleURL = `file:///${join(fullPath, file).replace(/\\/g, '/')}`;
        const { default: command } = await import(moduleURL);
        commands.push(command);
      } catch (importError) {
        console.error(`Error importing ${file}: ${importError.message}`);
      }
    }
    
    return commands;
  } catch (error) {
    console.error(`Error loading commands: ${error.message}`);
    return [];
  }
}

export async function loadEvents(client) {
  try {
    const eventsPath = join(__dirname, '..', 'events');
    const eventFiles = readdirSync(eventsPath)
      .filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {//twixx
      try {
        const moduleURL = `file:///${join(eventsPath, file).replace(/\\/g, '/')}`;
        const { default: event } = await import(moduleURL);
        const eventName = file.split('.')[0];
        
        if (event.once) {
          client.once(eventName, (...args) => event.execute(client, ...args));
        } else {
          client.on(eventName, (...args) => event.execute(client, ...args));
        }
      } catch (importError) {
        console.error(`Error importing event ${file}: ${importError.message}`);
      }
    }
  } catch (error) {
    console.error(`Error loading events: ${error.message}`);
  }
} 