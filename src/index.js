import { Client, Collection, ActivityType } from 'discord.js';
import config from './config/config.js';
import { loadCommands, loadEvents } from './utils/helper.js';

const client = new Client({ 
  intents: config.intents,
  partials: config.partials 
});

client.slashCommands = new Collection();
client.prefixCommands = new Collection();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  try {
    client.user.setPresence({
      activities: [{ 
        name: 'CentralCheats', 
        type: ActivityType.Playing
      }],
      status: 'dnd' // 'online', 'idle', 'dnd', 'invisible'
    });

    console.log('Slash komutları yükleniyor...');
    const slashCommands = await loadCommands('commands/slash');
    
    if (slashCommands.length > 0) {
      for (const command of slashCommands) {
        client.slashCommands.set(command.data.name, command);
      }
      console.log(`✅ ${slashCommands.length} slash komut client'a yüklendi`);
    } else {
      console.log('⚠️ Hiç slash komut yüklenemedi.');
    }
    
    console.log('Prefix komutları yükleniyor...');
    const prefixCommands = await loadCommands('commands/prefix');
    
    if (prefixCommands.length > 0) {
      for (const command of prefixCommands) {
        client.prefixCommands.set(command.name, command);
        if (command.aliases) {
          for (const alias of command.aliases) {
            client.prefixCommands.set(alias, command);
          }
        }
      }
      console.log(`✅ ${prefixCommands.length} prefix komut başarıyla yüklendi`);
    } else {
      console.log('⚠️ Hiç prefix komut yüklenemedi.');
    }

    console.log('Eventler yükleniyor...');
    await loadEvents(client);
    console.log('✅ Eventler başarıyla yüklendi');
    
    console.log('🚀 Bot kullanıma hazır!');
  } catch (error) {
    console.error('Başlatma sırasında hata oluştu:');
    console.error(error);
  }//twixx
});

process.on('unhandledRejection', error => {
  console.error('Beklenmeyen Hata:', error);
});

console.log('Discord API\'ye bağlanılıyor...');
client.login(config.token)
  .then(() => console.log('Login başarılı!'))
  .catch(error => {
    console.error('Login sırasında hata oluştu:');
    console.error(error);
    process.exit(1);
  }); 