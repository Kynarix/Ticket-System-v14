import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/helper.js';
import { getGuildSetup, saveGuildSetup, resetGuildSetup } from '../../utils/database.js';
import config from '../../config/config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Sunucu için bot kurulumunu yapar')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const guildId = interaction.guild.id;
      let setupInfo;
      let setupExists = false;
      
      try {
        setupInfo = getGuildSetup(guildId);
        setupExists = !!(setupInfo && setupInfo.setup_complete);
      } catch (dbError) {
        console.error('Veritabanı okuma hatası:', dbError);
        return await interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Veritabanı Hatası',
              description: 'Setup bilgileri okunurken bir hata oluştu. Lütfen tekrar deneyin.',
              type: 'error'
            })
          ]
        });
      }
    
      const setupButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('setup_create')
            .setLabel('Create')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔧')
            .setDisabled(!!setupExists),
          new ButtonBuilder()
            .setCustomId('setup_reset')
            .setLabel('Reset')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')
            .setDisabled(!setupExists),
          new ButtonBuilder()
            .setCustomId('setup_status')
            .setLabel('Status')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('ℹ️')
        );
      
      const setupStatusMessage = setupExists
        ? `✅ Bu sunucuda ticket sistemi kurulmuş.\n\nKategori: <#${setupInfo.category_id}>\nKanal: <#${setupInfo.channel_id}>\nKurulum Tarihi: <t:${Math.floor(new Date(setupInfo.created_at).getTime() / 1000)}:F>`
        : '⚠️ Bu sunucuda henüz ticket sistemi kurulmamış.';
      
      await interaction.editReply({
        embeds: [
          createEmbed({
            title: '🎟️ CentralCheat Ticket Setup',
            description: `Ticket sistemi kurulum menüsüne hoş geldiniz. Aşağıdaki butonları kullanarak işlemleri gerçekleştirebilirsiniz.\n\n**Mevcut Durum:**\n${setupStatusMessage}\n\n**Komutlar:**\n\n**🔧 Create (Oluştur)**: Ticket sistemi için gerekli kategori ve kanalları oluşturur.\n\n**🔄 Reset (Sıfırla)**: Mevcut ticket sistemi ayarlarını sıfırlar. Dikkat: Kanalları Discord'dan silmez, sadece veritabanındaki ayarları sıfırlar.\n\n**ℹ️ Status (Durum)**: Mevcut ticket sistemi durumunu gösterir.`,
            type: 'info'
          })
        ],
        components: [setupButtons]
      });
      
      const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('setup_');
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 120000 });
      
      collector.on('collect', async i => {
        try {
          const setupCommand = i.customId.split('_')[1];
          

          try {
            await i.deferUpdate();
          } catch (deferError) {
            console.error('Etkileşim güncelleme hatası:', deferError);
          }
          
          let currentSetupInfo;
          let currentSetupExists = false;
          
          try {
            currentSetupInfo = getGuildSetup(guildId);
            currentSetupExists = !!(currentSetupInfo && currentSetupInfo.setup_complete);
          } catch (checkError) {
            console.error('Durum kontrolü hatası:', checkError);
          }
      
          const currentButtons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('setup_create')
                .setLabel('Create')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔧')
                .setDisabled(!!currentSetupExists),
              new ButtonBuilder()
                .setCustomId('setup_reset')
                .setLabel('Reset')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔄')
                .setDisabled(!currentSetupExists),
              new ButtonBuilder()
                .setCustomId('setup_status')
                .setLabel('Status')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('ℹ️')
            );
          
          if (setupCommand === 'create') {
            try {
              if (currentSetupExists) {
                return await i.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Setup Zaten Tamamlandı',
                      description: 'Bu sunucu için setup zaten yapılmış. Önce sıfırlamanız gerekiyor.',
                      type: 'warning'
                    })
                  ],
                  components: [currentButtons]
                }).catch(error => console.error('Yanıt hatası:', error));
              }
              
              try {
                const categoryName = 'CentralCheat Destek';
                const channelName = 'ticket-merkezi';
                
                const category = await interaction.guild.channels.create({
                  name: categoryName,
                  type: ChannelType.GuildCategory,
                  reason: 'Bot setup'
                }).catch(error => {
                  throw new Error(`Kategori oluşturma hatası: ${error.message}`);
                });
                
                const channel = await interaction.guild.channels.create({
                  name: channelName,
                  type: ChannelType.GuildText,
                  parent: category.id,
                  reason: 'Bot setup'
                }).catch(error => {
                  throw new Error(`Kanal oluşturma hatası: ${error.message}`);
                });
                
                const selectMenu = new ActionRowBuilder()
                  .addComponents(
                    new StringSelectMenuBuilder()
                      .setCustomId('create_ticket_menu')
                      .setPlaceholder('Select a ticket category / Bilet kategorisi seçin')
                      .addOptions([
                        {
                          label: 'Buy / Satın Al',
                          description: 'Purchase a license key / Lisans anahtarı satın alın',
                          value: 'buy_ticket',
                          emoji: '💰'
                        },
                        {
                          label: 'Technical Support / Teknik Destek',
                          description: 'Get help with your license / Lisansınızla ilgili yardım alın',
                          value: 'tech_support',
                          emoji: '🛠️'
                        },
                        {
                          label: 'HWID Reset / HWID Sıfırlama',
                          description: 'Reset your hardware ID / Donanım ID\'nizi sıfırlayın',
                          value: 'hwid_reset',
                          emoji: '🔄'
                        },
                        {
                          label: 'Pre-Sale Support / Satış Öncesi Destek',
                          description: 'Get information before purchase / Satın almadan önce bilgi alın',
                          value: 'presale_support',
                          emoji: '💸'
                        }
                      ])
                  );
                
                await channel.send({
                  embeds: [
                    createEmbed({
                      title: '🎟️ CentralCheat Ticket System',
                      description: `## Welcome to CentralStore Support\n\n**EN**: Welcome to CentralStore ticket system.\n**TR**: CentralStore bilet sistemine hoş geldiniz.\n\n📌 **Please select the appropriate option below / Lütfen aşağıdan uygun seçeneği belirleyin:**\n\n💰 **Buy / Satın Al** - Purchase a license key / Lisans anahtarı satın alın.\n\n🛠️ **Technical Support / Teknik Destek** - Get help with your license / Lisansınızla ilgili yardım alın.\n\n🔄 **HWID Reset / HWID Sıfırlama** - Reset your hardware ID / Donanım ID'nizi sıfırlayın.\n\n💸 **Pre-Sale Support / Satış Öncesi Destek** - Get information before purchase / Satın almadan önce bilgi alın.\n\n📝 **Ticket Rules / Bilet Kuralları:**\n• EN: Please do not create unnecessary support tickets. If you do not respond to the opened support ticket, it will be closed.\n• TR: Gereksiz yere lütfen destek talebi oluşturmayın! Açılan destek talebine cevap vermezseniz, kapatılır.`,
                      type: 'info'
                    })
                  ],
                  components: [selectMenu]
                }).catch(error => {
                  throw new Error(`Kanal mesajı gönderme hatası: ${error.message}`);
                });
                
                try {
                  saveGuildSetup(guildId, category.id, channel.id);
                } catch (dbError) {
                  console.error('Veritabanına kayıt hatası:', dbError);
                  throw new Error(`Veritabanı kayıt hatası: ${dbError.message}`);
                }
                
                let newSetupInfo;
                try {
                  newSetupInfo = getGuildSetup(guildId);
                  if (!newSetupInfo) {
                    throw new Error('Setup bilgisi veritabanından okunamadı');
                  }
                } catch (getError) {
                  console.error('Yeni setup bilgisi alma hatası:', getError);
                  throw new Error(`Setup bilgisi alma hatası: ${getError.message}`);
                }
                
                const staffRoleInfo = config.roles.staffRole 
                  ? `\n\n**Staff Rolü:** <@&${config.roles.staffRole}> (ID: ${config.roles.staffRole})`
                  : "\n\n**Staff Rolü:** Ayarlanmamış. `.env` dosyasına `STAFF_ROLE_ID=` değerini ekleyin.";
                
                const updatedStatusMessage = `✅ Bu sunucuda ticket sistemi kurulmuş.\n\nKategori: <#${newSetupInfo.category_id}>\nKanal: <#${newSetupInfo.channel_id}>\nKurulum Tarihi: <t:${Math.floor(new Date(newSetupInfo.created_at).getTime() / 1000)}:F>${staffRoleInfo}`;
              
                const updatedButtons = new ActionRowBuilder()
                  .addComponents(
                    new ButtonBuilder()
                      .setCustomId('setup_create')
                      .setLabel('Create')
                      .setStyle(ButtonStyle.Success)
                      .setEmoji('🔧')
                      .setDisabled(true),
                    new ButtonBuilder()
                      .setCustomId('setup_reset')
                      .setLabel('Reset')
                      .setStyle(ButtonStyle.Danger)
                      .setEmoji('🔄')
                      .setDisabled(false),
                    new ButtonBuilder()
                      .setCustomId('setup_status')
                      .setLabel('Status')
                      .setStyle(ButtonStyle.Primary)
                      .setEmoji('ℹ️')
                  );
                
                return await i.editReply({
                  embeds: [
                    createEmbed({
                      title: '🎟️ CentralCheat Ticket Setup',
                      description: `Ticket sistemi kurulum menüsüne hoş geldiniz. Aşağıdaki butonları kullanarak işlemleri gerçekleştirebilirsiniz.\n\n**Mevcut Durum:**\n${updatedStatusMessage}\n\n**Komutlar:**\n\n**🔧 Create (Oluştur)**: Ticket sistemi için gerekli kategori ve kanalları oluşturur.\n\n**🔄 Reset (Sıfırla)**: Mevcut ticket sistemi ayarlarını sıfırlar. Dikkat: Kanalları Discord'dan silmez, sadece veritabanındaki ayarları sıfırlar.\n\n**ℹ️ Status (Durum)**: Mevcut ticket sistemi durumunu gösterir.`,
                      type: 'success'
                    })
                  ],
                  components: [updatedButtons]
                }).catch(error => console.error('Yanıt güncelleme hatası:', error));
              } catch (setupError) {
                console.error('Setup işlem hatası:', setupError);
                
                return await i.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Setup Hatası',
                      description: `Setup işlemi sırasında bir hata oluştu: ${setupError.message}\n\nLütfen bot yetkilerini kontrol edin ve tekrar deneyin.`,
                      type: 'error'
                    })
                  ],
                  components: [currentButtons]
                }).catch(replyError => console.error('Hata yanıt hatası:', replyError));
              }
            } catch (createError) {
              console.error('Create işlem hatası:', createError);
              
              return await i.editReply({
                embeds: [
                  createEmbed({
                    title: 'Create Hatası',
                    description: `Create işlemi sırasında bir hata oluştu: ${createError.message}\n\nLütfen bot yetkilerini kontrol edin ve tekrar deneyin.`,
                    type: 'error'
                  })
                ],
                components: [currentButtons]
              }).catch(replyError => console.error('Hata yanıtı gönderirken hata:', replyError));
            }
          } 
          else if (setupCommand === 'reset') {
            try {
              if (!currentSetupExists) {
                return await i.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Setup Bulunamadı',
                      description: 'Bu sunucu için henüz ticket sistemi kurulmamış.',
                      type: 'warning'
                    })
                  ],
                  components: [currentButtons]
                }).catch(error => console.error('Yanıt hatası:', error));
              }
              
              resetGuildSetup(guildId);
              
              const postResetInfo = getGuildSetup(guildId);
              const postResetExists = !!(postResetInfo && postResetInfo.setup_complete);
              
              if (postResetExists) {
                console.error('Reset işlemi başarısız: Veritabanı hala setup kaydı içeriyor');
                throw new Error('Reset işlemi tamamlanamadı');
              }
              
              const updatedButtons = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('setup_create')
                    .setLabel('Create')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔧')
                    .setDisabled(false),
                  new ButtonBuilder()
                    .setCustomId('setup_reset')
                    .setLabel('Reset')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔄')
                    .setDisabled(true),
                  new ButtonBuilder()
                    .setCustomId('setup_status')
                    .setLabel('Status')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('ℹ️')
                );
              
              return await i.editReply({
                embeds: [
                  createEmbed({
                    title: '🎟️ CentralCheat Ticket Setup',
                    description: 'Ticket sistemi başarıyla sıfırlandı!\n\n**Mevcut Durum:**\n⚠️ Bu sunucuda henüz ticket sistemi kurulmamış.\n\n**Komutlar:**\n\n**🔧 Create (Oluştur)**: Ticket sistemi için gerekli kategori ve kanalları oluşturur.\n\n**🔄 Reset (Sıfırla)**: Mevcut ticket sistemi ayarlarını sıfırlar. Dikkat: Kanalları Discord\'dan silmez, sadece veritabanındaki ayarları sıfırlar.\n\n**ℹ️ Status (Durum)**: Mevcut ticket sistemi durumunu gösterir.',
                    type: 'success'
                  })
                ],
                components: [updatedButtons]
              }).catch(error => console.error('Yanıt hatası:', error));
            } catch (resetError) {
              console.error('Reset hatası:', resetError);
              return await i.editReply({
                embeds: [
                  createEmbed({
                    title: 'Reset Hatası',
                    description: `Setup reset işlemi sırasında bir hata oluştu: ${resetError.message}`,
                    type: 'error'
                  })
                ],
                components: [currentButtons]
              }).catch(error => console.error('Yanıt hatası:', error));
            }
          }
          else if (setupCommand === 'status') {
            try {
              if (!currentSetupExists) {
                return await i.editReply({
                  embeds: [
                    createEmbed({
                      title: 'Setup Durumu',
                      description: 'Bu sunucu için henüz ticket sistemi kurulmamış.',
                      type: 'info'
                    })
                  ],
                  components: [currentButtons]
                }).catch(error => console.error('Yanıt hatası:', error));
              }

              return await i.editReply({
                embeds: [
                  createEmbed({
                    title: 'Setup Durumu',
                    description: `Bu sunucu için ticket sistemi kurulumu tamamlanmış.\n\n**Detaylar:**\n\nKategori: <#${currentSetupInfo.category_id}>\nKanal: <#${currentSetupInfo.channel_id}>\nKurulum Tarihi: <t:${Math.floor(new Date(currentSetupInfo.created_at).getTime() / 1000)}:F>${config.roles.staffRole ? `\n\n**Staff Rolü:** <@&${config.roles.staffRole}> (ID: ${config.roles.staffRole})` : "\n\n**Staff Rolü:** Ayarlanmamış. `.env` dosyasına `STAFF_ROLE_ID=` değerini ekleyin."}`,
                    type: 'info'
                  })
                ],
                components: [currentButtons]
              }).catch(error => console.error('Yanıt hatası:', error));
            } catch (statusError) {
              console.error('Status hatası:', statusError);
              return await i.editReply({
                embeds: [
                  createEmbed({
                    title: 'Status Hatası',
                    description: `Setup durumu alınırken bir hata oluştu: ${statusError.message}`,
                    type: 'error'
                  })
                ],
                components: [currentButtons]
              }).catch(error => console.error('Yanıt hatası:', error));
            }
          }
        } catch (collectError) {
          console.error('Collector işlem hatası:', collectError);
          try {
            await i.editReply({
              embeds: [
                createEmbed({
                  title: 'İşlem Hatası',
                  description: 'Komut işlenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
                  type: 'error'
                })
              ],
              components: []
            });
          } catch (replyError) {
            console.error('Hata yanıtı gönderirken hata:', replyError);
          }
        }
      });

      collector.on('end', async collected => {
        try {
          if (collected.size === 0) {
            await interaction.editReply({
              embeds: [
                createEmbed({
                  title: '🎟️ CentralCheat Ticket Setup',
                  description: 'Etkileşim süresi doldu. Tekrar kullanmak için `/setup` komutunu yeniden çalıştırın.',
                  type: 'warning'
                })
              ],
              components: []
            }).catch(error => console.error('Zaman aşımı yanıt hatası:', error));
          }
        } catch (endError) {
          console.error('Collector end hatası:', endError);
        }
      });
    } catch (executeError) {
      console.error('Setup komut çalıştırma hatası:', executeError);
      
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Komut Çalıştırma Hatası',
                description: 'Setup komutu çalıştırılırken bir hata oluştu. Lütfen tekrar deneyin.',
                type: 'error'
              })
            ],
            ephemeral: true
          });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Komut Çalıştırma Hatası',
                description: 'Setup komutu çalıştırılırken bir hata oluştu. Lütfen tekrar deneyin.',
                type: 'error'
              })
            ]
          });
        }
      } catch (replyError) {
        console.error('Komut hatası yanıtı gönderme hatası:', replyError);
      }
    }
  }
}; 