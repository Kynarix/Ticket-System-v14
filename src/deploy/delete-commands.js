import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import readline from 'readline';
config();
const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const rest = new REST({ version: '10' }).setToken(TOKEN);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function listCommands() {
  try {
    console.log('Mevcut komutlar listeleniyor...');
    
    let commands = [];
    let source = '';
    
    if (GUILD_ID) {
      try {
        const guildCommands = await rest.get(
          Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
        );
        
        if (guildCommands.length > 0) {
          commands = guildCommands;
          source = `Sunucu (ID: ${GUILD_ID})`;
        } else {
          console.log(`Sunucuda (ID: ${GUILD_ID}) hiç komut bulunamadı.`);
        }
      } catch (error) {
        console.error('Sunucu komutları alınırken hata oluştu:', error.message);
      }
    }
    
    if (commands.length === 0) {
      const globalCommands = await rest.get(
        Routes.applicationCommands(CLIENT_ID)
      );
      
      if (globalCommands.length > 0) {
        commands = globalCommands;
        source = 'Global';
      } else {
        console.log('Hiç global komut bulunamadı.');
        return false;
      }
    }
    
    if (commands.length === 0) {
      console.log('Hiç komut bulunamadı.');
      return false;
    }
    console.log(`\n${source} komutlar:`);
    commands.forEach((cmd, index) => {
      console.log(`${index + 1}. ${cmd.name} (ID: ${cmd.id})`);
    });
    
    return { commands, source };
  } catch (error) {
    console.error('Komutlar listelenirken hata oluştu:', error);
    return false;
  }
}

async function deleteCommand(commandId, isGuild = false) {
  try {
    const route = isGuild
      ? Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, commandId)
      : Routes.applicationCommand(CLIENT_ID, commandId);
    
    await rest.delete(route);
    return true;
  } catch (error) {
    console.error(`Komut silinirken hata oluştu (ID: ${commandId}):`, error.message);
    return false;
  }
}

async function deleteAllCommands(isGuild = false) {
  try {
    const route = isGuild
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    
    await rest.put(route, { body: [] });
    return true;
  } catch (error) {
    console.error('Tüm komutlar silinirken hata oluştu:', error.message);
    return false;
  }
}

async function main() {
  console.log('Discord API Slash Komut Silme');
  console.log('-----------------------------------');
  const result = await listCommands();
  
  if (!result) {
    console.log('İşlem sonlandırılıyor...');
    rl.close();
    return;
  }
  
  const { commands, source } = result;
  const isGuildCommands = source.startsWith('Sunucu');
  const action = await askQuestion('\nİşlem seçin:\n1. Belirli bir komutu sil\n2. Tüm komutları sil\n3. İptal\nSeçiminiz (1/2/3): ');
  
  if (action === '1') {
    const commandIndex = parseInt(await askQuestion(`Silmek istediğiniz komutun numarasını girin (1-${commands.length}): `)) - 1;
    
    if (commandIndex >= 0 && commandIndex < commands.length) {
      const command = commands[commandIndex];
      
      const confirm = await askQuestion(`"${command.name}" komutunu silmek istediğinizden emin misiniz? (E/H): `);
      
      if (confirm.toLowerCase() === 'e') {
        console.log(`"${command.name}" komutu siliniyor...`);
        const success = await deleteCommand(command.id, isGuildCommands);
        
        if (success) {
          console.log(`✅ "${command.name}" komutu başarıyla silindi.`);
        }
      } else {
        console.log('Komut silme işlemi iptal edildi.');
      }
    } else {
      console.log('Geçersiz komut numarası.');
    }
  } else if (action === '2') {
    const confirm = await askQuestion(`⚠️ DİKKAT: Bu işlem ${source} tüm komutları silecek. Emin misiniz? (E/H): `);
    
    if (confirm.toLowerCase() === 'e') {
      //twixx
      console.log(`${source} komutlar siliniyor...`);
      const success = await deleteAllCommands(isGuildCommands);
      
      if (success) {
        console.log(`✅ ${source} tüm komutlar başarıyla silindi.`);
      }
    } else {
      console.log('Komut silme işlemi iptal edildi.');
    }
  } else {
    console.log('İşlem iptal edildi.');
  }
  
  rl.close();
}
main().catch(error => {
  console.error('Beklenmeyen bir hata oluştu:', error);
  rl.close();
}); 