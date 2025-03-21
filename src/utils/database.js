import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import archiver from 'archiver';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'data', 'bot.db');
const dataDir = join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const logsDir = join(__dirname, '..', 'data', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const archivesDir = join(__dirname, '..', 'data', 'archives');
if (!fs.existsSync(archivesDir)) {
  fs.mkdirSync(archivesDir, { recursive: true });
}
const mediaDir = join(__dirname, '..', 'data', 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY,
    setup_complete INTEGER DEFAULT 0,
    category_id TEXT,
    channel_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS private_channels (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT,
    user_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed INTEGER DEFAULT 0,
    closed_at TIMESTAMP,
    log_file TEXT,
    FOREIGN KEY (guild_id) REFERENCES guilds(guild_id)
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS channel_messages (
    message_id TEXT PRIMARY KEY,
    channel_id TEXT,
    user_id TEXT,
    username TEXT,
    avatar_url TEXT,
    content TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    has_attachments INTEGER DEFAULT 0,
    attachments_json TEXT,
    has_embeds INTEGER DEFAULT 0,
    embeds_json TEXT,
    FOREIGN KEY (channel_id) REFERENCES private_channels(channel_id)
  )
`);
try {
  const tableInfo = db.prepare("PRAGMA table_info(channel_messages)").all();
  const columnNames = tableInfo.map(col => col.name);
  if (!columnNames.includes('has_embeds')) {
    db.exec(`ALTER TABLE channel_messages ADD COLUMN has_embeds INTEGER DEFAULT 0`);
    console.log('has_embeds sütunu channel_messages tablosuna eklendi');
  }
  if (!columnNames.includes('embeds_json')) {
    db.exec(`ALTER TABLE channel_messages ADD COLUMN embeds_json TEXT`);
    console.log('embeds_json sütunu channel_messages tablosuna eklendi');
  }
} catch (error) {
  console.error('Tablo sütunları kontrol edilirken hata oluştu:', error.message);
}

export function getGuildSetup(guildId) {
  const stmt = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');
  return stmt.get(guildId);
}

export function saveGuildSetup(guildId, categoryId, channelId) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO guilds (guild_id, setup_complete, category_id, channel_id)
    VALUES (?, 1, ?, ?)
  `);
  
  return stmt.run(guildId, categoryId, channelId);
}

export function resetGuildSetup(guildId) {
  const stmt = db.prepare(`
    UPDATE guilds
    SET setup_complete = 0, category_id = NULL, channel_id = NULL
    WHERE guild_id = ?
  `);
  
  return stmt.run(guildId);
}

export function addPrivateChannel(channelId, guildId, userId) {
  const logFileName = `log_${guildId}_${channelId}_${Date.now()}.html`;
  
  const stmt = db.prepare(`
    INSERT INTO private_channels (channel_id, guild_id, user_id, log_file)
    VALUES (?, ?, ?, ?)
  `);
  
  return stmt.run(channelId, guildId, userId, logFileName);
}

export function getUserPrivateChannel(guildId, userId) {
  const stmt = db.prepare(`
    SELECT * FROM private_channels 
    WHERE guild_id = ? AND user_id = ? AND closed = 0
  `);
  
  return stmt.get(guildId, userId);
}

export function closePrivateChannel(channelId) {
  const stmt = db.prepare(`
    UPDATE private_channels
    SET closed = 1, closed_at = CURRENT_TIMESTAMP
    WHERE channel_id = ?
  `);
  
  return stmt.run(channelId);
}

async function downloadMedia(url, fileName) {
  try {
    const fileExtension = url.split('.').pop().split('?')[0].toLowerCase();
    
    const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    const filePath = join(mediaDir, `${safeFileName}.${fileExtension}`);
    
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Dosya indirilemedi: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
    
    return filePath;
  } catch (error) {
    console.error(`Medya indirme hatası: ${error.message}`);
    return null;
  }
}

function getFileTypeByExtension(extension) {
  const ext = extension.toLowerCase();
  
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico', 'heic', 'heif', 'avif'];
  
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'ogv'];
  
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'mid', 'midi'];
  
  const documentExts = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'json', 'xml', 
    'zip', 'rar', '7z', 'gz', 'tar', 'exe', 'apk', 'dmg', 'iso', 'html', 'htm'
  ];
  
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (documentExts.includes(ext)) return 'document';
  
  return 'file';
}

export async function logMessage(messageData) {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        messageId,
        channelId,
        userId,
        username,
        avatarUrl,
        content,
        hasAttachments,
      } = messageData;
      
      const existingMessage = db.prepare('SELECT message_id FROM channel_messages WHERE message_id = ?').get(messageId);
      if (existingMessage) {
        console.log(`Mesaj zaten kaydedilmiş, atlıyorum: ${messageId}`);
        return resolve(null);
      }
      
      const channel = db.prepare('SELECT * FROM private_channels WHERE channel_id = ?').get(channelId);
      
      if (!channel) {
        const guildId = messageData.guildId;
        if (!guildId) {
          console.error(`Kanal (${channelId}) için guild_id bulunamadı, mesaj loglanamıyor.`);
          return resolve(null);
        }
        
        const guild = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
        if (!guild) {
          db.prepare('INSERT OR IGNORE INTO guilds (guild_id, setup_complete) VALUES (?, 0)').run(guildId);
        }

        const logFileName = `log_${guildId}_${channelId}_${Date.now()}.html`;
        db.prepare(`
          INSERT OR IGNORE INTO private_channels (channel_id, guild_id, user_id, log_file)
          VALUES (?, ?, ?, ?)
        `).run(channelId, guildId, userId, logFileName);
      }
      
      let hasEmbedsColumn = true;
      let embedsJsonColumn = true;
      
      try {
        const tableInfo = db.prepare("PRAGMA table_info(channel_messages)").all();
        const columnNames = tableInfo.map(col => col.name);
        
        hasEmbedsColumn = columnNames.includes('has_embeds');
        embedsJsonColumn = columnNames.includes('embeds_json');
      } catch (err) {
        console.warn('Tablo sütunları kontrol edilirken uyarı:', err.message);
      }
      
      const hasEmbeds = messageData.embeds && messageData.embeds.length > 0;
      const embedsJson = hasEmbeds ? JSON.stringify(messageData.embeds) : null;
      
      let attachmentsJsonString = messageData.attachmentsJson;
      
      if (hasAttachments && attachmentsJsonString) {
        try {
          const attachments = JSON.parse(attachmentsJsonString);
          const downloadPromises = [];
          for (const attachment of attachments) {
            const fileName = `${messageId}_${attachment.id || Date.now()}`;
            const downloadPromise = downloadMedia(attachment.url, fileName).then(localPath => {
              if (localPath) {
                attachment.localPath = localPath.replace(/\\/g, '/');
                attachment.originalUrl = attachment.url;
                const ext = localPath.split('.').pop().toLowerCase();
                attachment.type = getFileTypeByExtension(ext);
                console.log(`Medya dosyası indirildi: ${attachment.name || localPath.split('/').pop() || 'isimsiz dosya'}`);
              }
              return attachment;
            });
            
            downloadPromises.push(downloadPromise);
          }
          const updatedAttachments = await Promise.all(downloadPromises);
          attachmentsJsonString = JSON.stringify(updatedAttachments);
        } catch (err) {
          console.error(`Ek dosyaları işlenirken hata: ${err.message}`);
        }
      }

      let sql;
      let params;
      
      if (hasEmbedsColumn && embedsJsonColumn) {
        sql = `
          INSERT INTO channel_messages 
          (message_id, channel_id, user_id, username, avatar_url, content, has_attachments, attachments_json, has_embeds, embeds_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        params = [
          messageId, 
          channelId, 
          userId, 
          username, 
          avatarUrl, 
          content, 
          hasAttachments ? 1 : 0, 
          attachmentsJsonString,
          hasEmbeds ? 1 : 0,
          embedsJson
        ];
      } else {
        sql = `
          INSERT INTO channel_messages 
          (message_id, channel_id, user_id, username, avatar_url, content, has_attachments, attachments_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        params = [
          messageId, 
          channelId, 
          userId, 
          username, 
          avatarUrl, 
          content, 
          hasAttachments ? 1 : 0, 
          attachmentsJsonString
        ];
      }
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      resolve(result);
    } catch (error) {
      console.error(`Error logging message: ${error.message}`);
      reject(error);
    }
  });
}

export function getChannelMessages(channelId) {
  const stmt = db.prepare(`
    SELECT * FROM channel_messages
    WHERE channel_id = ?
    ORDER BY timestamp ASC
  `);
  
  return stmt.all(channelId);
}

export async function generateChannelLog(channelId) {
  return new Promise((resolve, reject) => {
    try {
      const messages = getChannelMessages(channelId);
      
      if (!messages || messages.length === 0) {
        console.log(`${channelId} kanalı için mesaj bulunamadı.`);
        return resolve(null);
      }

      if (!fs.existsSync(archivesDir)) {
        fs.mkdirSync(archivesDir, { recursive: true });
      }
      
      const uniqueDirName = `kynarix_log_${channelId}_${Date.now()}`;
      const logDir = join(archivesDir, uniqueDirName);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const mediaLogDir = join(logDir, 'media');
      if (!fs.existsSync(mediaLogDir)) {
        fs.mkdirSync(mediaLogDir, { recursive: true });
      }
      
      const mediaFilePaths = new Set();
      messages.forEach(message => {
        if (message.attachments_json) {
          try {
            const attachments = JSON.parse(message.attachments_json);
            attachments.forEach(attachment => {
              if (attachment.localPath && fs.existsSync(attachment.localPath)) {
                mediaFilePaths.add(attachment.localPath);
              }
            });
          } catch (e) {
            console.error(`Attachment JSON çözümlenirken hata: ${e.message}`);
          }
        }
      });

      let html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discord Kanal Logu - #${channelId}</title>
  <style>
    :root {
      --bg-color: #2c2f33;
      --text-color: #ffffff;
      --accent-color: #5865f2;
      --bot-bg: #3b4da8;
      --user-bg: #424549;
      --embed-bg: #36393f;
      --border-radius: 15px;
      --timestamp-color: #72767d;
      --hover-bg: #32353b;
      --attachment-bg: #2f3136;
      --link-color: #00aff4;
      --container-width: 95%;
      --max-width: 1200px;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background-color: var(--bg-color);
      color: var(--text-color);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      padding: 20px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    
    .container {
      width: var(--container-width);
      max-width: var(--max-width);
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding: 20px;
      background-color: var(--embed-bg);
      border-radius: var(--border-radius);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .channel-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      background-color: var(--embed-bg);
      padding: 15px;
      border-radius: var(--border-radius);
      flex-wrap: wrap;
    }
    
    .channel-id {
      font-weight: bold;
      color: var(--accent-color);
    }
    
    .messages-container {
      margin-top: 20px;
    }
    
    .date-divider {
      text-align: center;
      position: relative;
      margin: 30px 0;
    }
    
    .date-divider::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 1px;
      background-color: rgba(255, 255, 255, 0.1);
      top: 50%;
      left: 0;
    }
    
    .date-divider span {
      background-color: var(--bg-color);
      padding: 0 15px;
      position: relative;
      color: var(--timestamp-color);
      font-weight: bold;
    }
    
    .message-group {
      display: flex;
      margin-bottom: 16px;
      flex-direction: row;
    }
    
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      margin-right: 12px;
      flex-shrink: 0;
      background-color: var(--accent-color);
      overflow: hidden;
    }
    
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .avatar-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background-color: var(--accent-color);
      color: white;
      font-weight: bold;
      font-size: 16px;
    }
    
    .message-content {
      flex: 1;
      max-width: 80%;
    }
    
    .author-name {
      font-weight: bold;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
    }
    
    .bot-tag {
      background-color: var(--accent-color);
      color: white;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 0.7em;
      margin-left: 6px;
    }
    
    .message-bubble {
      background-color: var(--bot-bg);
      border-radius: var(--border-radius);
      padding: 10px 15px;
      margin-top: 5px;
      position: relative;
      word-wrap: break-word;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      max-width: 100%;
    }
    
    .message-group.is-user .message-bubble {
      background-color: var(--user-bg);
    }
    
    .timestamp {
      font-size: 0.7em;
      color: var(--timestamp-color);
      margin-top: 4px;
    }
    
    .content {
      white-space: pre-wrap;
      background-color: transparent;
      border-radius: var(--border-radius);
      margin-bottom: 8px;
      padding: 0;
    }
    
    .attachments {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      margin-top: 8px;
    }
    
    .attachment {
      overflow: hidden;
      border-radius: 8px;
      background-color: var(--attachment-bg);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.2s;
    }
    
    .attachment:hover {
      transform: scale(1.02);
    }
    
    .attachment-image {
      width: 100%;
      max-height: 400px;
      object-fit: contain;
      display: block;
      cursor: pointer;
    }
    
    .attachment-video {
      width: 100%;
      max-height: 400px;
      object-fit: contain;
      display: block;
      background-color: black;
    }
    
    .attachment-audio {
      width: 100%;
      padding: 10px;
      background-color: var(--attachment-bg);
      border-radius: 8px;
    }
    
    .attachment-file {
      display: flex;
      flex-direction: column;
      padding: 10px;
      font-size: 0.9rem;
    }
    
    .attachment-filename {
      font-weight: bold;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      margin-bottom: 5px;
    }
    
    .attachment-filesize {
      font-size: 0.8em;
      color: var(--timestamp-color);
    }
    
    .attachment-link {
      color: var(--link-color);
      text-decoration: none;
      margin-top: 5px;
      display: inline-block;
    }
    
    .attachment-link:hover {
      text-decoration: underline;
    }
    
    .embeds {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .embed {
      border-radius: 4px;
      border-left: 4px solid var(--accent-color);
      background-color: var(--embed-bg);
      padding: 12px;
      max-width: 520px;
    }
    
    .embed-title {
      font-weight: bold;
      margin-bottom: 8px;
      color: var(--accent-color);
    }
    
    .embed-description {
      font-size: 0.9rem;
      margin-bottom: 8px;
    }
    
    .embed-fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    
    .embed-field {
      margin-bottom: 8px;
    }
    
    .embed-field-name {
      font-weight: bold;
      font-size: 0.9rem;
      margin-bottom: 2px;
    }
    
    .embed-field-value {
      font-size: 0.85rem;
    }
    
    .embed-thumbnail {
      float: right;
      max-width: 80px;
      max-height: 80px;
      margin-left: 16px;
      border-radius: 3px;
    }
    
    .embed-image {
      margin-top: 8px;
      max-width: 100%;
      max-height: 300px;
      border-radius: 3px;
    }
    
    .embed-footer {
      margin-top: 8px;
      font-size: 0.8rem;
      color: var(--timestamp-color);
      display: flex;
      align-items: center;
    }
    
    .embed-footer-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      margin-right: 8px;
    }
    
    .footer {
      margin-top: 40px;
      text-align: center;
      padding: 20px;
      font-size: 0.8rem;
      color: var(--timestamp-color);
    }
    
    a {
      color: var(--link-color);
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    @media (max-width: 768px) {
      .message-content {
        max-width: 95%;
      }
      
      .channel-info {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .container {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Discord Kanal Logu</h1>
    </div>
    
    <div class="channel-info">
      <div>
        <div>Kanal ID: <span class="channel-id">${channelId}</span></div>
        <div>Toplam Mesaj: ${messages.length}</div>
      </div>
      <div>
        <div>Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
      </div>
    </div>
    
    <div class="messages-container">`;
    let currentDate = null;
    
    messages.forEach((message, index) => {
      const timestamp = new Date(message.timestamp);
      const dateStr = timestamp.toLocaleDateString('tr-TR');
      
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        html += `
      <div class="date-divider">
        <span>${dateStr}</span>
      </div>`;
      }
      
      const isBot = message.user_id === '1344440448030216212'; // Botun ID'sini girin burayı kodu incelerken belki fark edersiniz cheatglobal <3 Twixx

      const userClass = '';
      const firstLetter = message.username ? message.username.charAt(0).toUpperCase() : '?';
      
      html += `
      <div class="message-group ${userClass}">
        <div class="avatar">
          ${message.avatar_url 
            ? `<img src="${message.avatar_url}" alt="${message.username}" />` 
            : `<div class="avatar-placeholder">${firstLetter}</div>`}
        </div>
        <div class="message-content">
          <div class="author-name">
            ${message.username || 'Bilinmeyen Kullanıcı'}
            ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
          </div>
          <div class="message-bubble">`;
        
      if (message.content && message.content.trim() !== '') {
        html += `
            <div class="content">${message.content.replace(/\n/g, '<br>')}</div>`;
      }
      
      if (message.attachments_json) {
        try {
          const attachments = JSON.parse(message.attachments_json);
          if (attachments.length > 0) {
            html += `
            <div class="attachments">`;
            
            attachments.forEach(attachment => {
              const extension = attachment.name ? attachment.name.split('.').pop().toLowerCase() : '';
              const fileType = getFileTypeByExtension(extension);
              let mediaPath = '';
              
              if (attachment.localPath) {
                const fileName = attachment.localPath.split('/').pop();
                mediaPath = `media/${fileName}`;
              }
              
              if (fileType === 'image' && mediaPath) {
                html += `
              <div class="attachment">
                <img class="attachment-image" src="${mediaPath}" alt="${attachment.name || 'Resim'}" />
              </div>`;
              } 
              else if (fileType === 'video' && mediaPath) {
                html += `
              <div class="attachment">
                <video class="attachment-video" controls>
                  <source src="${mediaPath}" type="${attachment.contentType || 'video/mp4'}">
                  Video oynatılamıyor: ${attachment.name || 'Video'}
                </video>
              </div>`;
              } 
              else if (fileType === 'audio' && mediaPath) {
                html += `
              <div class="attachment">
                <audio class="attachment-audio" controls>
                  <source src="${mediaPath}" type="${attachment.contentType || 'audio/mpeg'}">
                  Ses oynatılamıyor: ${attachment.name || 'Ses'}
                </audio>
              </div>`;
              } 
              else if (mediaPath) {
                const fileSize = attachment.size 
                  ? (attachment.size < 1024 * 1024 
                    ? `${Math.round(attachment.size / 1024)} KB` 
                    : `${Math.round(attachment.size / (1024 * 1024) * 10) / 10} MB`)
                  : 'Bilinmeyen boyut';
                  
                html += `
              <div class="attachment">
                <div class="attachment-file">
                  <div class="attachment-filename">${attachment.name || 'Dosya'}</div>
                  <div class="attachment-filesize">${fileSize}</div>
                  <a href="${mediaPath}" class="attachment-link" target="_blank" download>İndir</a>
                </div>
              </div>`;
              }
            });
            
            html += `
            </div>`;
          }
        } catch (e) {
          console.error(`Attachments JSON çözümlenirken hata: ${e.message}`);
        }
      }

      if (message.has_embeds || (message.embeds && message.embeds.length > 0)) {
        try {
          let embeds = [];
          
          if (typeof message.embeds === 'string') {
            embeds = JSON.parse(message.embeds);
          } else if (Array.isArray(message.embeds)) {
            embeds = message.embeds;
          } else if (message.embeds_json) {
            if (typeof message.embeds_json === 'string') {
              embeds = JSON.parse(message.embeds_json);
            } else if (Array.isArray(message.embeds_json)) {
              embeds = message.embeds_json;
            }
          }
          
          if (embeds && embeds.length > 0) {
            html += `
            <div class="embeds">`;
            
            embeds.forEach(embed => {
              let embedHtml = `
              <div class="embed" style="border-left: 4px solid ${embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : 'var(--accent-color)'}};">`;
              
              if (embed.title) {
                embedHtml += `
                <div class="embed-title">${embed.title}</div>`;
              }
              
              if (embed.description) {
                embedHtml += `
                <div class="embed-description">${embed.description.replace(/\n/g, '<br>')}</div>`;
              }
              if (embed.fields && embed.fields.length > 0) {
                embedHtml += `
                <div class="embed-fields">`;
                
                embed.fields.forEach(field => {
                  embedHtml += `
                  <div class="embed-field">
                    <div class="embed-field-name">${field.name}</div>
                    <div class="embed-field-value">${field.value.replace(/\n/g, '<br>')}</div>
                  </div>`;
                });
                
                embedHtml += `
                </div>`;
              }
              
              if (embed.image && embed.image.url) {
                embedHtml += `
                <img class="embed-image" src="${embed.image.url}" alt="Embed Image" />`;
              }
              
              if (embed.thumbnail && embed.thumbnail.url) {
                embedHtml += `
                <img class="embed-thumbnail" src="${embed.thumbnail.url}" alt="Embed Thumbnail" />`;
              }
              
              if (embed.footer) {
                embedHtml += `
                <div class="embed-footer">`;
                
                if (embed.footer.icon_url) {
                  embedHtml += `
                  <img class="embed-footer-icon" src="${embed.footer.icon_url}" alt="Footer Icon" />`;
                }
                
                if (embed.footer.text) {
                  embedHtml += embed.footer.text;
                }
                
                embedHtml += `
                </div>`;
              }
              
              embedHtml += `
              </div>`;
              
              html += embedHtml;
            });
            
            html += `
            </div>`;
          }
        } catch (e) {
          console.error(`Embed JSON çözümlenirken hata: ${e.message}`);
          html += `
            <div class="content error">Embed içeriği yüklenemedi: ${e.message}</div>`;
        }
      }
      
      html += `
          </div>
          <div class="timestamp">${timestamp.toLocaleTimeString('tr-TR')}</div>
        </div>
      </div>`;
    });
    html += `
    </div>
    
    <div class="footer">
      <p>Bu log Metin2 JUve Discord botu tarafından ${new Date().toLocaleString('tr-TR')} tarihinde oluşturulmuştur.</p>
    </div>
  </div>
</body>
</html>`;

    const htmlFilePath = join(logDir, 'index.html');
    fs.writeFileSync(htmlFilePath, html, 'utf-8');
    console.log(`${channelId} kanalı için HTML log dosyası oluşturuldu: ${htmlFilePath}`);
    
    console.log(`${mediaFilePaths.size} medya dosyası kopyalanıyor...`);
    let copiedCount = 0;
    
    mediaFilePaths.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          const fileName = filePath.split('/').pop();
          const targetPath = join(mediaLogDir, fileName);
          fs.copyFileSync(filePath, targetPath);
          copiedCount++;
        }
      } catch (e) {
        console.error(`Medya dosyası kopyalanırken hata: ${e.message}`);
      }
    });
    
    console.log(`${copiedCount} medya dosyası başarıyla kopyalandı.`);
    
    const zipFileName = `channel_log_${channelId}_${Date.now()}.zip`;
    const zipFilePath = join(archivesDir, zipFileName);
    console.log(`ZIP dosyası oluşturuluyor: ${zipFilePath}`);
    
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    
    archive.on('error', (err) => {
      console.error(`ZIP arşiv hatası: ${err.message}`);
      reject(err);
    });

    output.on('error', err => {
      console.error(`ZIP dosyası oluşturulurken hata: ${err.message}`);
      reject(err);
    });
    
    output.on('close', () => {
      console.log(`ZIP dosyası oluşturuldu: ${zipFilePath} (${archive.pointer()} bytes)`);
      
      if (fs.existsSync(zipFilePath)) {
        const stats = fs.statSync(zipFilePath);
        console.log(`Oluşturulan dosya boyutu: ${stats.size} bytes`);
        
        try {
          fs.rmSync(logDir, { recursive: true, force: true });
          console.log(`Geçici dizin temizlendi: ${logDir}`);
        } catch (e) {
          console.error(`Geçici dizin temizlenirken hata: ${e.message}`);
        }
        
        try {
          mediaFilePaths.forEach(filePath => {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Medya dosyası silindi: ${filePath}`);
            }
          });
          console.log(`${mediaFilePaths.size} medya dosyası başarıyla temizlendi.`);
        } catch (cleanupError) {
          console.error(`Medya dosyaları temizlenirken hata: ${cleanupError.message}`);
        }
        
        try {
          db.prepare('UPDATE private_channels SET log_file = ? WHERE channel_id = ?').run(zipFileName, channelId);
          console.log(`Kanal log_file alanı güncellendi: ${channelId} -> ${zipFileName}`);
        } catch (e) {
          console.error(`Kanal log_file alanı güncellenirken hata: ${e.message}`);
        }
        
        resolve(zipFilePath);
      } else {
        console.error(`ZIP dosyası oluşturuldu ama dosya bulunamıyor: ${zipFilePath}`);
        resolve(null);
      }
    });
    
    archive.pipe(output);
    
    archive.directory(logDir, 'kynarix_log');
    
    archive.finalize();
  } catch (error) {
    console.error(`Kanal log oluşturma hatası: ${error.message}`, error);
    resolve(null);
  }
});
}

export function getClosedChannels(guildId) {
  const stmt = db.prepare(`
    SELECT p.*, u.username as user_name
    FROM private_channels p
    LEFT JOIN (
      SELECT user_id, username
      FROM channel_messages
      WHERE user_id = (
        SELECT user_id FROM private_channels WHERE channel_id = channel_messages.channel_id
      )
      GROUP BY user_id
    ) u ON p.user_id = u.user_id
    WHERE p.guild_id = ? AND p.closed = 1
    ORDER BY p.closed_at DESC
  `);
  
  return stmt.all(guildId);
}

export function closeDatabase() {
  db.close();
}

process.on('exit', () => {
  try {
    db.close();
  } catch (err) {
  }
});

export async function getChannelLogPath(channelId) {
  try {
    const channel = db.prepare('SELECT * FROM private_channels WHERE channel_id = ?').get(channelId);
    if (!channel) {
      console.error(`Kanal bulunamadı: ${channelId}`);
      return null;
    }
    
    console.log(`Kanal bilgisi bulundu: ${channelId}, log file: ${channel.log_file}`);

    const logFileName = channel.log_file;
    
    if (logFileName.endsWith('.zip')) {
      const zipPath = join(archivesDir, logFileName);
      console.log(`ZIP path kontrolü: ${zipPath}`);
      
      if (fs.existsSync(zipPath)) {
        console.log(`ZIP dosyası mevcut: ${zipPath}`);
        return zipPath;
      } else {
        console.log(`ZIP dosyası bulunamadı: ${zipPath}`);
      }
    }
    
    const htmlPath = join(logsDir, logFileName);
    console.log(`HTML path kontrolü: ${htmlPath}`);
    
    if (fs.existsSync(htmlPath)) {
      console.log(`${channelId} kanalının HTML logu ZIP formatına dönüştürülüyor...`);
      
      const newZipPath = await generateChannelLog(channelId);
      console.log(`Yeni ZIP dosyası oluşturuldu: ${newZipPath}`);
      return newZipPath;
    } else {
      console.log(`HTML dosyası bulunamadı: ${htmlPath}`);
    }
    
    console.log(`${channelId} kanalı için yeni ZIP log oluşturuluyor...`);
    const generatedPath = await generateChannelLog(channelId);
    console.log(`Yeni oluşturulan ZIP dosyası: ${generatedPath}`);
    return generatedPath;
  } catch (error) {
    console.error(`Log dosyası kontrol edilirken hata: ${error.message}`, error);
    return null;
  }
}

export default {
  getGuildSetup,
  saveGuildSetup,
  resetGuildSetup,
  addPrivateChannel,
  getUserPrivateChannel,
  closePrivateChannel,
  logMessage,
  getChannelMessages,
  generateChannelLog,
  getClosedChannels,
  closeDatabase,
  getChannelLogPath
}; 