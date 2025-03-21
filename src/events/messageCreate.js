import config from '../config/config.js';
import { createEmbed } from '../utils/helper.js';
import { logMessage } from '../utils/database.js';
import fetch from 'node-fetch';
globalThis.fetch = fetch;

export default {
  name: 'messageCreate',
  once: false,
  async execute(client, message) {
    try {
      if (message.author.bot && message.author.id !== client.user.id) return;
      if (message.channel.type === 0) {
        const guildId = message.guild.id;
        const channelId = message.channel.id;
        const parentId = message.channel.parentId;
        if (message.channel.name.startsWith('destek-')) {
          try {
            const guild = message.guild;
            const attachments = [];
            if (message.attachments && message.attachments.size > 0) {
              message.attachments.forEach(attachment => {
                attachments.push({
                  id: attachment.id,
                  name: attachment.name,
                  url: attachment.url,
                  contentType: attachment.contentType,
                  size: attachment.size
                });
              });
            }
            
            const messageData = {
              messageId: message.id,
              channelId: channelId,
              guildId: guildId,
              userId: message.author.id,
              username: message.author.username,
              avatarUrl: message.author.displayAvatarURL({ dynamic: true }),
              content: message.content,
              hasAttachments: attachments.length > 0,
              attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
              embeds: message.embeds && message.embeds.length > 0 
                ? message.embeds.map(embed => {
                    const cleanEmbed = {
                      title: embed.title,
                      description: embed.description,
                      url: embed.url,
                      timestamp: embed.timestamp,
                      color: embed.color,
                      fields: embed.fields,
                      author: embed.author ? {
                        name: embed.author.name,
                        url: embed.author.url,
                        icon_url: embed.author.iconURL
                      } : null,
                      thumbnail: embed.thumbnail ? {
                        url: embed.thumbnail.url
                      } : null,
                      image: embed.image ? {
                        url: embed.image.url
                      } : null,
                      footer: embed.footer ? {
                        text: embed.footer.text,
                        icon_url: embed.footer.iconURL
                      } : null
                    };
                    return Object.fromEntries(
                      Object.entries(cleanEmbed).filter(([_, v]) => v != null)
                    );
                  })
                : [],
              timestamp: message.createdAt
            };
            logMessage(messageData).catch(err => {
              console.error(`Mesaj loglanırken hata oluştu: ${err.message}`);
            });
          } catch (error) {
            console.error(`Destek kanalı mesajı loglanırken hata: ${error.message}`);
          }
        }
      }
      if (message.author.bot) return;
      if (!message.content.startsWith(config.prefix)) return;
      const args = message.content.slice(config.prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = client.prefixCommands.get(commandName);
      if (!command) return;
      if (command.guildOnly && !message.guild) {
        return message.reply({
          embeds: [
            createEmbed({
              title: 'Hata',
              description: 'Bu komut sadece sunucularda kullanılabilir!',
              type: 'error'
            })
          ]
        });
      }

      if (command.args && !args.length) {
        let reply = 'Bu komut için argümanlar gereklidir!';
        
        if (command.usage) {
          reply += `\nDoğru kullanım: \`${config.prefix}${command.name} ${command.usage}\``;
        }
        
        return message.reply({
          embeds: [
            createEmbed({
              title: 'Hata',
              description: reply,
              type: 'error'
            })
          ]
        });
      }
      
      if (command.permissions && message.guild) {
        const authorPerms = message.channel.permissionsFor(message.author);
        if (!authorPerms || !authorPerms.has(command.permissions)) {
          return message.reply({
            embeds: [
              createEmbed({
                title: 'Yetersiz Yetki',
                description: 'Bu komutu kullanmak için gerekli yetkiye sahip değilsiniz!',
                type: 'error'
              })
            ]
          });
        }
      }
      
      await command.execute(message, args);
    } catch (error) {
      console.error(`Error executing command: ${error}`);
      message.reply({
        embeds: [
          createEmbed({
            title: 'Hata',
            description: 'Komut çalıştırılırken bir hata oluştu!',
            type: 'error'
          })
        ]
      });
    }
  }
}; 