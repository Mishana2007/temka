const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const ExcelJS = require('exceljs');

// Создаем и подключаемся к базе данных SQLite
const db = new sqlite3.Database('./bot_data.db');

// Создаем таблицы, если их нет
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    chat_id INTEGER,
    link TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    document_type TEXT,
    description TEXT,
    quality TEXT,
    category TEXT,
    weapon_info TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY,
    chat_id INTEGER
  )`);
});

// Ваш токен для бота
const token = '7657624262:AAFnfJHvoqH4yv7rw5GR1XpcRm5s6jCr8WI';
const bot = new TelegramBot(token, { polling: true });

// Список администраторов
const admins = [1301142907, 1234567890]; // Добавьте сюда chat_id администраторов

// Обработчик команды "/start"
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Добавляем пользователя в базу данных с дополнительной информацией
  const username = msg.from.username || "Не указан";
  const firstName = msg.from.first_name || "Не указано";
  const lastName = msg.from.last_name || "Не указано";
  const link = `https://t.me/${username}`;

  db.run(`INSERT OR IGNORE INTO users (chat_id, username, first_name, last_name, link) VALUES (?, ?, ?, ?, ?)`, 
    [chatId, username, firstName, lastName, link]);

  // Приветственное сообщение с кнопками
  const welcomeMessage = `
    Привет! 👋
    
    Я — бот для продажи документов и оружия. Мы предлагаем вам:
    
    1️⃣ **Документы**: Паспорт, водительские права, различные другие документы.
    2️⃣ **Оружие**: Предоставление информации и продажа оружия.

    Чем я могу помочь? Выберите действие ниже:
  `;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Перейти в каталог', callback_data: 'catalog' }],
        [{ text: 'Продать', callback_data: 'sell' }],
        [{ text: 'Поддержка', callback_data: 'support' }],
        [{ text: 'Скачать Excel с данными', callback_data: 'download_excel' }] // Кнопка для скачивания Excel
      ]
    }
  };

  bot.sendMessage(chatId, welcomeMessage, options);
});

// Обработчик инлайн кнопок
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'catalog') {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Паспорт', callback_data: 'passport' }],
          [{ text: 'Права', callback_data: 'rights' }],
          [{ text: 'Другой документ', callback_data: 'other' }],
          [{ text: 'Оружие', callback_data: 'weapon' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Выберите категорию документа или товара:', options);
  }

  if (data === 'sell') {
    bot.sendMessage(chatId, 'Функция "Продать" еще в разработке. Мы работаем над улучшениями, пожалуйста, ожидайте!');
  }

  if (data === 'support') {
    const supportLink = 'https://t.me/lil_mamym'; // Замените на вашу ссылку
    bot.sendMessage(chatId, `Если у вас возникли вопросы, напишите в поддержку: ${supportLink}`);
  }

  if (data === 'download_excel') {
    // Генерация и отправка Excel-файла
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users Data');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Last Name', key: 'last_name', width: 20 },
      { header: 'Link', key: 'link', width: 30 }
    ];

    // Получаем данные пользователей из базы данных
    db.all("SELECT * FROM users", (err, rows) => {
      if (err) {
        bot.sendMessage(chatId, 'Ошибка при получении данных.');
        return;
      }

      // Заполняем Excel файл данными
      rows.forEach(row => {
        worksheet.addRow({
          id: row.id,
          username: row.username,
          first_name: row.first_name,
          last_name: row.last_name,
          link: row.link
        });
      });

      // Сохраняем Excel в файл
      workbook.xlsx.writeFile('users_data.xlsx')
        .then(() => {
          // Отправляем файл пользователю
          bot.sendDocument(chatId, 'users_data.xlsx');
        })
        .catch(error => {
          bot.sendMessage(chatId, 'Ошибка при создании Excel файла.');
        });
    });
  }

  // Обработка кнопок для документов
  if (['passport', 'rights', 'other', 'weapon'].includes(data)) {
    let documentType, message;
    switch (data) {
      case 'passport':
        documentType = 'Паспорт';
        message = `Вы выбрали Паспорт. Пожалуйста, уточните:
        Страну, для которой вам нужен паспорт.
        Ваш желаемый бюджет.
        Качество копии (например, фото, скан, оригинал).
        Опишите эти моменты, чтобы мы могли помочь вам в выборе.`;
        break;
      case 'rights':
        documentType = 'Права';
        message = `Вы выбрали Водительские права. Пожалуйста, уточните:
        Категорию прав (например, A, B, C и т.д.).
        Ваш желаемый бюджет.
        Качество копии (например, фото, скан, оригинал).
        Опишите эти моменты, чтобы мы могли подобрать лучший вариант для вас.`;
        break;
      case 'other':
        documentType = 'Другой документ';
        message = `Вы выбрали Другой документ. Пожалуйста, уточните:
        Какой именно документ вам требуется (например, свидетельство о рождении, диплом и т.д.).
        Ваш желаемый бюджет.
        Качество копии (например, фото, скан, оригинал).
        Подробно опишите, что именно вам нужно, чтобы мы могли предложить вам подходящий вариант.`;
        break;
      case 'weapon':
        documentType = 'Оружие';
        message = `Вы выбрали Оружие. Пожалуйста, уточните:
        Полную марку оружия (например, АК-47, Glock 17).
        Комплектацию (например, 2 магазина, патроны).
        Ваш желаемый бюджет.
        Состояние и качество оружия (например, новое, б/у, с документами).
        Опишите эти моменты, чтобы мы могли предложить вам наилучший вариант.`;
        break;
    }

    bot.sendMessage(chatId, message);

    // Ожидаем ответа пользователя
    bot.once('message', (msg) => {
      const userId = msg.chat.id;
      const text = msg.text;

      db.run(`INSERT INTO documents (user_id, document_type, description) VALUES (?, ?, ?)`, 
        [userId, documentType, text]);

      bot.sendMessage(userId, `Спасибо за информацию! 📋
      С вами свяжется наш менеджер в личные сообщения для дальнейшего обсуждения вашего запроса. Пожалуйста, убедитесь, что у вас открыты личные сообщения. Если у вас закрыты личные сообщения, напишите в поддержку, и мы обязательно свяжемся с вами! 😊`);
        
      // Оповещаем администраторов
admins.forEach(adminId => {
    const userLink = `https://t.me/${msg.from.username}`; // Ссылка на аккаунт пользователя
    bot.sendMessage(adminId, `Новый запрос от пользователя [${msg.from.username}](${userLink}) по правам: ${text}`);
  });
    });
  }
});
