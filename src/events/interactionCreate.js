import { createEmbed } from '../utils/helper.js';
import config from '../config/config.js';
import { ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder } from 'discord.js';
import { addPrivateChannel, getUserPrivateChannel, closePrivateChannel, generateChannelLog } from '../utils/database.js';
import fs from 'fs';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(client, interaction) {
    try {
      if (interaction.isCommand()) {
        const command = client.slashCommands.get(interaction.commandName);
        if (!command) return;
        
        try {
          await command.execute(interaction);
        } catch (error) {
          console.error(`Slash komut hatası: ${error.message}`);
          
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              embeds: [
                createEmbed({
                  title: 'Hata',
                  description: 'Komut çalıştırılırken bir hata oluştu!',
                  type: 'error'
                })
              ],
              ephemeral: true
            }).catch(e => console.error(`Hata yanıtı gönderilemedi: ${e.message}`));
          }
        }
        return;
      }

      if (interaction.isUserSelectMenu()) {
        try {
          if (interaction.customId.startsWith('add_user_menu_')) {
            await interaction.deferReply();
            
            const channelId = interaction.customId.replace('add_user_menu_', '');
            const selectedUsers = interaction.values;
            
            if (selectedUsers.length === 0) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Hiçbir kullanıcı seçilmedi.',
                    type: 'error'
                  })
                ]
              });
            }
            
            try {
              const channel = interaction.channel;
              
              if (channel.id !== channelId) {
                return interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Hata',
                      description: 'Bu işlem sadece ilgili kanalda yapılabilir.',
                      type: 'error'
                    })
                  ]
                });
              }
              
              for (const userId of selectedUsers) {
                await channel.permissionOverwrites.create(userId, {
                  ViewChannel: true,
                  SendMessages: true,
                  ReadMessageHistory: true
                });
              }
              
              const userMentions = selectedUsers.map(id => `<@${id}>`).join(', ');
              
              return channel.send({
                embeds: [
                  createEmbed({
                    title: 'Kullanıcılar Eklendi',
                    description: `${interaction.user.username} tarafından ${userMentions} kanala eklendi.`,
                    type: 'info'
                  })
                ]
              }).then(() => {
                interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'İşlem Başarılı',
                      description: `Seçili kullanıcılar kanala eklendi.`,
                      type: 'success'
                    })
                  ]
                });
              });
            } catch (error) {
              console.error('Kullanıcı ekleme hatası:', error);
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Kullanıcılar eklenirken bir hata oluştu.',
                    type: 'error'
                  })
                ]
              });
            }
          }
          
          if (interaction.customId.startsWith('remove_user_menu_')) {
            await interaction.deferReply();
            
            const channelId = interaction.customId.replace('remove_user_menu_', '');
            const selectedUsers = interaction.values;
            
            if (selectedUsers.length === 0) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Hiçbir kullanıcı seçilmedi.',
                    type: 'error'
                  })
                ]
              });
            }
            
            try {
              const channel = interaction.channel;
              
              if (channel.id !== channelId) {
                return interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Hata',
                      description: 'Bu işlem sadece ilgili kanalda yapılabilir.',
                      type: 'error'
                    })
                  ]
                });
              }
              
              const userMentions = selectedUsers.map(id => `<@${id}>`).join(', ');
              
              
              for (const userId of selectedUsers) {
                const overwrites = channel.permissionOverwrites.cache;
                const isOwner = userId === channel.name.replace('destek-', '');
                
                if (userId !== client.user.id) {
                  await channel.permissionOverwrites.delete(userId);
                }
              }
              
              return channel.send({
                embeds: [
                  createEmbed({
                    title: 'Kullanıcılar Çıkarıldı',
                    description: `${interaction.user.username} tarafından ${userMentions} kanaldan çıkarıldı.`,
                    type: 'warning'
                  })
                ]
              }).then(() => {
                interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'İşlem Başarılı',
                      description: `Seçili kullanıcılar kanaldan çıkarıldı.`,
                      type: 'success'
                    })
                  ]
                });
              });
            } catch (error) {
              console.error('Kullanıcı çıkarma hatası:', error);
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Kullanıcılar çıkarılırken bir hata oluştu.',
                    type: 'error'
                  })
                ]
              });
            }
          }
          
          if (interaction.customId.startsWith('transfer_ticket_menu_')) {
            await interaction.deferReply();
            
            const channelId = interaction.customId.replace('transfer_ticket_menu_', '');
            const selectedUsers = interaction.values;
            
            if (selectedUsers.length === 0) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Hiçbir kullanıcı seçilmedi.',
                    type: 'error'
                  })
                ]
              });
            }
            
            try {
              const channel = interaction.channel;
              
              if (channel.id !== channelId) {
                return interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Hata',
                      description: 'Bu işlem sadece ilgili kanalda yapılabilir.',
                      type: 'error'
                    })
                  ]
                });
              }
              
              const targetUserId = selectedUsers[0];
              const targetUser = await interaction.guild.members.fetch(targetUserId);
              
              if (!targetUser) {
                return interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Hata',
                      description: 'Kullanıcı bulunamadı.',
                      type: 'error'
                    })
                  ]
                });
              }
              
              return channel.send({
                embeds: [
                  createEmbed({
                    title: 'Talep Devredildi',
                    description: `Bu talep ${interaction.user.username} tarafından <@${targetUserId}> kullanıcısına devredildi.`,
                    type: 'info'
                  })
                ]
              }).then(() => {
                interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'İşlem Başarılı',
                      description: `Talep <@${targetUserId}> kullanıcısına devredildi.`,
                      type: 'success'
                    })
                  ]
                });
              });
            } catch (error) {
              console.error('Talep devretme hatası:', error);
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Talep devredilirken bir hata oluştu.',
                    type: 'error'
                  })
                ]
              });
            }
          }
        } catch (error) {
          console.error(`User select menu interaction error: ${error.message}`);
          
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              embeds: [
                createEmbed({
                  title: 'Hata',
                  description: 'İşlem sırasında bir hata oluştu!',
                  type: 'error'
                })
              ],
              ephemeral: true
            }).catch(e => console.error(`Hata yanıtı gönderilemedi: ${e.message}`));
          }
        }
        return;
      }
      
      if (interaction.isStringSelectMenu()) {
        try {
          if (interaction.customId === 'create_ticket_menu') {
            await interaction.deferReply({ ephemeral: true });
            
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const guild = interaction.guild;
            const guildId = guild.id;
            const selectedCategory = interaction.values[0];
            
            let categoryInfo = {
              name: 'Destek',
              emoji: '🎫',
              prefix: 'destek'
            };
            
            switch(selectedCategory) {
              case 'hile_destek':
                categoryInfo = {
                  name: 'Hile Destek',
                  emoji: '🛡️',
                  prefix: 'hile'
                };
                break;
              case 'teknik_destek':
                categoryInfo = {
                  name: 'Teknik Destek',
                  emoji: '🔧',
                  prefix: 'teknik'
                };
                break;
              case 'urun_destek':
                categoryInfo = {
                  name: 'Ürün Destek',
                  emoji: '🛒',
                  prefix: 'urun'
                };
                break;
            }
            
            const existingTicket = getUserPrivateChannel(guildId, userId);
            
            if (existingTicket) {
              const ticketChannel = guild.channels.cache.get(existingTicket.channel_id);
              if (ticketChannel) {
                return interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Zaten Açık Bir Kanalınız Var',
                      description: `Halihazırda açık bir destek kanalınız bulunuyor: <#${ticketChannel.id}>. Lütfen önce onu kullanın veya kapatın.`,
                      type: 'warning'
                    })
                  ]
                });
              } else {
                closePrivateChannel(existingTicket.channel_id);
              }
            }
            
            try {
              const permissionOverwrites = [
                {
                  id: guild.id,
                  deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                  id: userId,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]
                },
                {
                  id: client.user.id,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.ManageChannels
                  ]
                }
              ];
              
              const adminRole = guild.roles.cache.find(role => role.permissions.has(PermissionsBitField.Flags.Administrator));
              if (adminRole) {
                permissionOverwrites.push({
                  id: adminRole.id,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]
                });
              }
            
              const staffRoleId = config.roles.staffRole;
              if (staffRoleId) {
                permissionOverwrites.push({
                  id: staffRoleId,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]
                });
              }
              
              const channel = await guild.channels.create({
                name: `${categoryInfo.prefix}-${userName.toLowerCase().replace(/\s+/g, '-')}`,
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: permissionOverwrites,
                reason: `${userName} için ${categoryInfo.name} kanalı`
              });
              
              addPrivateChannel(channel.id, guildId, userId);
              
              const buttonsRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`close_ticket_${channel.id}`)
                    .setLabel('Kanalı Kapat')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                  new ButtonBuilder()
                    .setCustomId(`add_user_${channel.id}`)
                    .setLabel('Kullanıcı Ekle')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('👥'),
                  new ButtonBuilder()
                    .setCustomId(`remove_user_${channel.id}`)
                    .setLabel('Kullanıcı Çıkar')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚫')
                );
              
              const buttonsRow2 = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`claim_ticket_${channel.id}`)
                    .setLabel('Talebi Üstlen')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✋'),
                  new ButtonBuilder()
                    .setCustomId(`transfer_ticket_${channel.id}`)
                    .setLabel('Talebi Devret')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
                );
              
              await channel.send({
                content: `<@${userId}> Hoş geldiniz!`,
                embeds: [
                  createEmbed({
                    title: `${categoryInfo.emoji} ${categoryInfo.name} Kanalı`,
                    description: `Bu kanal sadece sizin ve yöneticilerin görebileceği özel bir **${categoryInfo.name}** kanalıdır. Sorunlarınızı veya isteklerinizi burada paylaşabilirsiniz.`,
                    type: 'success'
                  })
                ],
                components: [buttonsRow, buttonsRow2]
              });
              
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: `${categoryInfo.name} Kanalı Oluşturuldu`,
                    description: `**${categoryInfo.name}** kanalınız başarıyla oluşturuldu: <#${channel.id}>`,
                    type: 'success'
                  })
                ]
              });
            } catch (error) {
              console.error('Özel kanal oluşturma hatası:', error);
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Özel kanal oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin veya bir yönetici ile iletişime geçin.',
                    type: 'error'
                  })
                ]
              });
            }
          }
          
        } catch (error) {
          console.error(`String select menu interaction error: ${error.message}`);
          
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              embeds: [
                createEmbed({
                  title: 'Hata',
                  description: 'İşlem sırasında bir hata oluştu!',
                  type: 'error'
                })
              ],
              ephemeral: true
            }).catch(e => console.error(`Hata yanıtı gönderilemedi: ${e.message}`));
          }
        }
        return;
      }
      
      if (interaction.isModalSubmit()) {
      }
      
      if (interaction.isButton()) {
        try {
          if (interaction.customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });
            
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const guild = interaction.guild;
            const guildId = guild.id;
            
            const existingTicket = getUserPrivateChannel(guildId, userId);
            
            if (existingTicket) {
              const ticketChannel = guild.channels.cache.get(existingTicket.channel_id);
              if (ticketChannel) {
                return interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Zaten Açık Bir Kanalınız Var',
                      description: `Halihazırda açık bir destek kanalınız bulunuyor: <#${ticketChannel.id}>. Lütfen önce onu kullanın veya kapatın.`,
                      type: 'warning'
                    })
                  ]
                });
              } else {
                closePrivateChannel(existingTicket.channel_id);
              }
            }
            
            try {
              const permissionOverwrites = [
                {
                  id: guild.id,
                  deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                  id: userId,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]
                },
                {
                  id: client.user.id,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.ManageChannels
                  ]
                }
              ];
              
              const adminRole = guild.roles.cache.find(role => role.permissions.has(PermissionsBitField.Flags.Administrator));
              if (adminRole) {
                permissionOverwrites.push({
                  id: adminRole.id,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]
                });
              }
            
              const staffRoleId = config.roles.staffRole;
              if (staffRoleId) {
                permissionOverwrites.push({
                  id: staffRoleId,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]
                });
              }
              
              const channel = await guild.channels.create({
                name: `destek-${userName.toLowerCase().replace(/\s+/g, '-')}`,
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: permissionOverwrites,
                reason: `${userName} için özel destek kanalı`
              });
              
              addPrivateChannel(channel.id, guildId, userId);
              
              const buttonsRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`close_ticket_${channel.id}`)
                    .setLabel('Kanalı Kapat')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                  new ButtonBuilder()
                    .setCustomId(`add_user_${channel.id}`)
                    .setLabel('Kullanıcı Ekle')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('👥'),
                  new ButtonBuilder()
                    .setCustomId(`remove_user_${channel.id}`)
                    .setLabel('Kullanıcı Çıkar')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚫')
                );
              
              const buttonsRow2 = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`claim_ticket_${channel.id}`)
                    .setLabel('Talebi Üstlen')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✋'),
                  new ButtonBuilder()
                    .setCustomId(`transfer_ticket_${channel.id}`)
                    .setLabel('Talebi Devret')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
                );
              
              await channel.send({
                content: `<@${userId}> Hoş geldiniz!`,
                embeds: [
                  createEmbed({
                    title: 'Özel Destek Kanalı',
                    description: `Bu kanal sadece sizin ve yöneticilerin görebileceği özel bir kanaldır. Sorunlarınızı veya isteklerinizi burada paylaşabilirsiniz.`,
                    type: 'success'
                  })
                ],
                components: [buttonsRow, buttonsRow2]
              });
              
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Özel Kanal Oluşturuldu',
                    description: `Özel destek kanalınız başarıyla oluşturuldu: <#${channel.id}>`,
                    type: 'success'
                  })
                ]
              });
            } catch (error) {
              console.error('Özel kanal oluşturma hatası:', error);
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Özel kanal oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin veya bir yönetici ile iletişime geçin.',
                    type: 'error'
                  })
                ]
              });
            }
          }
          
          const isStaffMember = (userId) => {
            const staffRoleId = config.roles.staffRole;
            if (!staffRoleId) return false;
            
            const member = interaction.guild.members.cache.get(userId);
            if (!member) return false;
            
            return member.roles.cache.has(staffRoleId);
          };
          
          if (interaction.customId.startsWith('close_ticket_') || 
              interaction.customId.startsWith('add_user_') || 
              interaction.customId.startsWith('remove_user_') || 
              interaction.customId.startsWith('claim_ticket_') || 
              interaction.customId.startsWith('transfer_ticket_')) {
            
            const channelId = interaction.customId.split('_').pop();
            
            if (interaction.customId.startsWith('close_ticket_')) {
              if (!isStaffMember(interaction.user.id) && interaction.user.id !== getUserIdFromChannel(interaction.channel)) {
                return interaction.reply({
                  embeds: [
                    createEmbed({
                      title: 'Yetersiz Yetki',
                      description: 'Bu kanalı sadece staff rolüne sahip kişiler veya kanalı açan kişi kapatabilir.',
                      type: 'error'
                    })
                  ],
                  ephemeral: true
                });
              }
            } 
            else if (!isStaffMember(interaction.user.id)) {
              return interaction.reply({
                embeds: [
                  createEmbed({
                    title: 'Yetersiz Yetki',
                    description: 'Bu işlemi sadece staff rolüne sahip kişiler yapabilir.',
                    type: 'error'
                  })
                ],
                ephemeral: true
              });
            }
          }
          const getUserIdFromChannel = (channel) => {
            if (!channel || !channel.name) return null;
            
            if (channel.name.startsWith('destek-')) {
              const overwrites = channel.permissionOverwrites.cache;
              const userIds = overwrites
                .filter(overwrite => 
                  overwrite.type === 1 &&
                  overwrite.id !== client.user.id &&
                  overwrite.allow.has(PermissionsBitField.Flags.ViewChannel)
                )
                .map(overwrite => overwrite.id);
              
              if (userIds.length > 0) {
                return userIds[0];
              }
            }
            
            return null;
          };
      
          if (interaction.customId.startsWith('close_ticket_')) {
            await interaction.deferReply();
            
            const channelId = interaction.customId.replace('close_ticket_', '');
            
            if (interaction.channel.id !== channelId) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Bu işlem sadece ilgili kanalda yapılabilir.',
                    type: 'error'
                  })
                ]
              });
            }
            
            try {
              const channel = interaction.channel;
              const channelNameParts = channel.name.split('-');
              let ticketCategory = 'Genel';
              let userId = '';
              
              if (channelNameParts.length >= 2) {
                if (channelNameParts[0] === 'destek') ticketCategory = 'Genel Destek';
                else if (channelNameParts[0] === 'hile') ticketCategory = 'Hile Destek';
                else if (channelNameParts[0] === 'teknik') ticketCategory = 'Teknik Destek';
                else if (channelNameParts[0] === 'urun') ticketCategory = 'Ürün Destek';
              }
              
              let ticketOwner = null;
              try {
                const overwrites = channel.permissionOverwrites.cache;
                const userIds = overwrites
                  .filter(overwrite => 
                    overwrite.type === 1 &&
                    overwrite.id !== client.user.id &&
                    overwrite.allow.has(PermissionsBitField.Flags.ViewChannel)
                  )
                  .map(overwrite => overwrite.id);
                
                if (userIds.length > 0) {
                  try {
                    ticketOwner = await interaction.guild.members.fetch(userIds[0]);
                  } catch (err) {
                    console.error('Kullanıcı bilgileri alınamadı:', err);
                  }
                }
              } catch (err) {
                console.error('Kanal izinleri işlenirken hata:', err);
              }
              
              const logFilePath = await generateChannelLog(channelId);
              
              closePrivateChannel(channelId);
              
              const config = await import('../config/config.js').then(m => m.default);
              const logChannelId = config.channels.logChannel;
              
              if (logChannelId) {
                try {
                  const logChannel = await interaction.guild.channels.fetch(logChannelId);
                  
                  if (logChannel) {
                    const attachment = logFilePath ? { 
                      attachment: logFilePath,
                      name: `destek_log_${channelId}.zip`
                    } : null;

                    const logEmbed = createEmbed({
                      title: '🔒 Destek Talebi Kapatıldı',
                      description: `Kanal ID: **${channelId}**\nKanal Adı: **${channel.name}**\nKategori: **${ticketCategory}**\nKapatan: <@${interaction.user.id}> (${interaction.user.tag})`,
                      type: 'error',
                      fields: [
                        {
                          name: 'Talep Sahibi Bilgileri',
                          value: ticketOwner ? 
                            `Kullanıcı: <@${ticketOwner.id}> (${ticketOwner.user.tag})\nID: **${ticketOwner.id}**\nSunucu Adı: **${ticketOwner.displayName}**` : 
                            'Kullanıcı bilgisi bulunamadı.'
                        },
                        {
                          name: 'Kapanış Zamanı',
                          value: `<t:${Math.floor(Date.now() / 1000)}:F>`
                        },
                        {
                          name: 'Log Dosyası',
                          value: attachment ? '✅ Aşağıya eklendi. İndirip görüntüleyebilirsiniz.' : '❌ Oluşturulamadı.'
                        }
                      ]
                    });
                    
                    await logChannel.send({
                      embeds: [logEmbed],
                      files: attachment ? [attachment] : []
                    });
                    
                    console.log(`Log mesajı başarıyla gönderildi: ${channelId}`);
                  }
                } catch (logError) {
                  console.error(`Log kanalı mesajı gönderilirken hata: ${logError.message}`);
                }
              }
              
              await interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Kanal Kapatılıyor',
                    description: 'Kanal 5 saniye içinde kapatılacak. Tüm mesajlar HTML formatında loglandı.',
                    type: 'info'
                  })
                ]
              });
              
              setTimeout(async () => {
                try {
                  await interaction.channel.delete('Destek kanalı kapatıldı');
                } catch (e) {
                  console.error('Kanal silinirken hata oluştu:', e);
                }
              }, 5000);
            } catch (error) {
              console.error('Kanal kapatma hatası:', error);
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Kanal kapatılırken bir hata oluştu.',
                    type: 'error'
                  })
                ]
              });
            }
          }
      
          if (interaction.customId.startsWith('add_user_')) {
            await interaction.deferReply();
            
            const channelId = interaction.customId.replace('add_user_', '');
            
            if (interaction.channel.id !== channelId) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Bu işlem sadece ilgili kanalda yapılabilir.',
                    type: 'error'
                  })
                ]
              });
            }
            
            const row = new ActionRowBuilder()
              .addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId(`add_user_menu_${channelId}`)
                  .setPlaceholder('Eklemek istediğiniz kullanıcıları seçin')
                  .setMinValues(1)
                  .setMaxValues(10)
              );
            
            await interaction.editReply({
              embeds: [
                createEmbed({
                  title: 'Kullanıcı Ekle',
                  description: 'Kanala eklemek istediğiniz kullanıcıları seçin. Seçilen kullanıcılar kanala görüntüleme ve mesaj yazma yetkisiyle eklenecektir.',
                  type: 'info'
                })
              ],
              components: [row]
            });
          }
          
          if (interaction.customId.startsWith('remove_user_')) {
            await interaction.deferReply();
            
            const channelId = interaction.customId.replace('remove_user_', '');
            
            if (interaction.channel.id !== channelId) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Bu işlem sadece ilgili kanalda yapılabilir.',
                    type: 'error'
                  })
                ]
              });
            }
            
            const overwrites = interaction.channel.permissionOverwrites.cache;
            const userIds = overwrites
              .filter(overwrite => 
                overwrite.type === 1 &&
                overwrite.id !== client.user.id &&
                overwrite.id !== interaction.guild.ownerId
              )
              .map(overwrite => overwrite.id);
            
            if (userIds.length === 0) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Uyarı',
                    description: 'Kanalda çıkarılabilecek herhangi bir kullanıcı bulunamadı.',
                    type: 'warning'
                  })
                ]
              });
            }
            
            const row = new ActionRowBuilder()
              .addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId(`remove_user_menu_${channelId}`)
                  .setPlaceholder('Çıkarmak istediğiniz kullanıcıları seçin')
                  .setMinValues(1)
                  .setMaxValues(Math.min(userIds.length, 10))
              );
            
            await interaction.editReply({
              embeds: [
                createEmbed({
                  title: 'Kullanıcı Çıkar',
                  description: 'Kanaldan çıkarmak istediğiniz kullanıcıları seçin. Seçilen kullanıcılar artık bu kanalı görüntüleyemeyecek ve mesaj yazamayacaktır.',
                  type: 'info'
                })
              ],
              components: [row]
            });
          }
          
          if (interaction.customId.startsWith('claim_ticket_')) {
            await interaction.deferReply();
            
            const channelId = interaction.customId.replace('claim_ticket_', '');
            
            if (interaction.channel.id !== channelId) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Bu işlem sadece ilgili kanalda yapılabilir.',
                    type: 'error'
                  })
                ]
              });
            }
            
            try {
              return interaction.channel.send({
                embeds: [
                  createEmbed({
                    title: 'Talep Üstlenildi',
                    description: `Bu destek talebi <@${interaction.user.id}> tarafından üstlenildi. Sorularınız ve talepleriniz için lütfen bekleyin.`,
                    type: 'info'
                  })
                ]
              }).then(() => {
                interaction.editReply({
                  embeds: [
                    createEmbed({
                      title: 'İşlem Başarılı',
                      description: 'Bu talebi başarıyla üstlendiniz.',
                      type: 'success'
                    })
                  ]
                });
              });
            } catch (error) {
              console.error('Talep üstlenme hatası:', error);
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Talep üstlenilirken bir hata oluştu.',
                    type: 'error'
                  })
                ]
              });
            }
          }
          
          if (interaction.customId.startsWith('transfer_ticket_')) {
            await interaction.deferReply();
            
            const channelId = interaction.customId.replace('transfer_ticket_', '');
            
            if (interaction.channel.id !== channelId) {
              return interaction.editReply({
                embeds: [
                  createEmbed({
                    title: 'Hata',
                    description: 'Bu işlem sadece ilgili kanalda yapılabilir.',
                    type: 'error'
                  })
                ]
              });
            }
            
            const row = new ActionRowBuilder()
              .addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId(`transfer_ticket_menu_${channelId}`)
                  .setPlaceholder('Talebi devretmek istediğiniz kullanıcıyı seçin')
                  .setMinValues(1)
                  .setMaxValues(1)
              );
            
            await interaction.editReply({
              embeds: [
                createEmbed({
                  title: 'Talebi Devret',
                  description: 'Talebi devretmek istediğiniz kullanıcıyı seçin:',
                  type: 'info'
                })
              ],
              components: [row]
            });
          }
        } catch (error) {
          console.error(`Button interaction error: ${error.message}`);
          
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              embeds: [
                createEmbed({
                  title: 'Hata',
                  description: 'İşlem sırasında bir hata oluştu!',
                  type: 'error'
                })
              ],
              ephemeral: true
            }).catch(e => console.error(`Hata yanıtı gönderilemedi: ${e.message}`));
          }
        }
        return;
      }
    } catch (error) {
      console.error(`Error executing interaction: ${error}`);
      
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Hata',
                description: 'Komut çalıştırılırken bir hata oluştu!',
                type: 'error'
              })
            ],
            ephemeral: true
          });
        } catch (e) {
          console.error('Failed to respond to interaction:', e);
        }
      }
    }
  }
}; 