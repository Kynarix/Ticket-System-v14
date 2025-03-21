import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { createEmbed } from '../../utils/helper.js';
import { getClosedChannels, getChannelLogPath } from '../../utils/database.js';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Destek kanalı loglarını görüntüler')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Kapatılmış destek kanallarının listesini gösterir')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Belirli bir destek kanalının loglarını görüntüler')
        .addStringOption(option =>
          option
            .setName('channel_id')
            .setDescription('Log görüntülenecek kanalın ID\'si')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('debug')
        .setDescription('Arşiv klasörünün içeriğini gösterir (sadece yöneticiler)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    
    if (subcommand === 'list') {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const closedChannels = getClosedChannels(guildId);
        
        if (!closedChannels || closedChannels.length === 0) {
          return interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Loglar',
                description: 'Henüz kapatılmış bir destek kanalı bulunmuyor.',
                type: 'info'
              })
            ]
          });
        }
        
        const channelList = closedChannels.map((channel, index) => {
          const userName = channel.user_name || 'Bilinmeyen Kullanıcı';
          const closedDate = channel.closed_at ? new Date(channel.closed_at).toLocaleString('tr-TR') : 'Bilinmiyor';
          
          return `**${index + 1}.** ID: \`${channel.channel_id}\`\n    Kullanıcı: ${userName}\n    Kapanış: ${closedDate}\n`;
        }).join('\n');
        
        return interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Kapatılmış Destek Kanalları',
              description: `Toplam ${closedChannels.length} destek kanalı bulundu.\n\n${channelList}\n\nLog görüntülemek için \`/logs view channel_id:<kanal_id>\` komutunu kullanın.`,
              type: 'info'
            })
          ]
        });
      } catch (error) {
        console.error('Log listeleme hatası:', error);
        return interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Hata',
              description: 'Loglar listelenirken bir hata oluştu.',
              type: 'error'
            })
          ]
        });
      }
    }
    //cheatglobal.com/twixx
    if (subcommand === 'view') {
      await interaction.deferReply();
      
      try {
        const channelId = interaction.options.getString('channel_id');
        
        const logFilePath = await getChannelLogPath(channelId);
        
        if (!logFilePath) {
          return interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Hata',
                description: `\`${channelId}\` ID'sine sahip bir destek kanalı bulunamadı. Bu kanal veritabanında kayıtlı olmayabilir.`,
                type: 'error'
              })
            ]
          });
        }
        
        if (!fs.existsSync(logFilePath)) {
          console.error(`Log dosyası bulunamadı: ${logFilePath}`);
          return interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Hata',
                description: `Log dosyası bulunamadı. Dosya yolu: ${logFilePath}`,
                type: 'error'
              })
            ]
          });
        }
        
        const stats = fs.statSync(logFilePath);
        console.log(`Log dosyası bulundu: ${logFilePath} (${stats.size} bytes)`);
        
        const attachment = new AttachmentBuilder(logFilePath, {
          name: `destek_log_${channelId}.zip`,
          description: 'Destek kanalı log dosyası ve ilgili medyalar'
        });
        
        return interaction.editReply({
          files: [attachment]
        });
      } catch (error) {
        console.error('Log görüntüleme hatası:', error);
        return interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Hata',
              description: `Log görüntülenirken bir hata oluştu: ${error.message}`,
              type: 'error'
            })
          ]
        });
      }
    }
    if (subcommand === 'debug') {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const archivesDir = join(__dirname, '..', '..', 'data', 'archives');
        
        if (!fs.existsSync(archivesDir)) {
          return interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Debug',
                description: `Arşiv klasörü bulunamadı: ${archivesDir}`,
                type: 'error'
              })
            ]
          });
        }
        
        const files = fs.readdirSync(archivesDir);
        
        if (files.length === 0) {
          return interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Debug',
                description: `Arşiv klasörü boş: ${archivesDir}`,
                type: 'info'
              })
            ]
          });
        }

        const fileDetails = files.map(file => {
          try {
            const filePath = join(archivesDir, file);
            const stats = fs.statSync(filePath);
            const sizeInKB = Math.round(stats.size / 1024);
            const modifiedDate = stats.mtime.toLocaleString('tr-TR');
            return `**${file}**\n    Boyut: ${sizeInKB} KB\n    Son Düzenleme: ${modifiedDate}`;
          } catch (err) {
            return `**${file}** (stats bilgisi alınamadı)`;
          }
        }).join('\n\n');
        
        return interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Arşiv Klasörü Dosyaları',
              description: `Arşiv klasörü yolu: ${archivesDir}\nToplam ${files.length} dosya bulundu.\n\n${fileDetails}`,
              type: 'info'
            })
          ]
        });
      } catch (error) {
        console.error('Debug hatası:', error);
        return interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Hata',
              description: `Debug bilgisi alınırken bir hata oluştu: ${error.message}`,
              type: 'error'
            })
          ]
        });
      }
    }
  }
}; 