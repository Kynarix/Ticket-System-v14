import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

async function deployCommands() {
  try {
    console.log('Slash komutları yüklenmeye başlanıyor...');
    
    const commands = [];
    const commandsPath = join(__dirname, 'commands/slash');
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      try {
        const moduleURL = `file:///${join(commandsPath, file).replace(/\\/g, '/')}`;
        const { default: command } = await import(moduleURL);
        
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          console.log(`✓ ${command.data.name} komutu yüklendi`);
        } else {
          console.log(`⚠️ ${file} dosyasında 'data' veya 'execute' özelliği eksik`);
        }
      } catch (error) {
        console.error(`❌ ${file} dosyası yüklenirken hata oluştu:`, error.message);
      }
    }
    
    if (commands.length === 0) {
      console.log('⚠️ Yüklenecek komut bulunamadı. İşlem iptal ediliyor.');
      return;
    }
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    console.log('Discord API\'ye komutlar gönderiliyor...');

    if (GUILD_ID) {
      console.log(`Komutlar sadece '${GUILD_ID}' ID'li sunucuya kaydediliyor...`);
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`✅ ${commands.length} slash komut başarıyla '${GUILD_ID}' ID'li sunucuya yüklendi`);
      
      console.log('Global komutlar temizleniyor...');
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: [] }
      );
      console.log('✅ Global komutlar başarıyla temizlendi');
    } else {
      console.log('Komutlar global olarak kaydediliyor...');
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ ${commands.length} slash komut başarıyla global olarak yüklendi (Tüm sunucularda görünür hale gelmesi 1 saate kadar sürebilir)`);
    }
    
  } catch (error) {
    console.error('Slash komutları yüklenirken hata oluştu:');
    console.error(error);
  }
}

deployCommands(); 