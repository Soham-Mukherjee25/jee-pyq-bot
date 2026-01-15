const TelegramBot = require('node-telegram-bot-api');

// Initialize bot using the token from Environment Variables
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token);

// CONFIGURATION
const GITHUB_USERNAME = process.env.GITHUB_USERNAME; 
const REPO_NAME = process.env.REPO_NAME;
const BRANCH = 'main'; 

// Bot Data Configuration
const YEARS = Array.from({length: 13}, (_, i) => 2013 + i); // Generates [2013, ..., 2025]
const MAX_QUESTIONS_PER_YEAR = 50; // Max number for Random generator

module.exports = async (req, res) => {
    try {
        if (req.body) {
            const update = req.body;
            
            // 1. Handle Message Commands (/start)
            if (update.message) {
                const chatId = update.message.chat.id;
                const text = update.message.text;

                if (text === '/start') {
                    // SHORT GREETING, NO EMOJIS
                    await bot.sendMessage(chatId, "Welcome. Select an exam:", {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "JEE Main", callback_data: "exam_main" },
                                    { text: "JEE Advanced", callback_data: "exam_adv" }
                                ]
                            ]
                        }
                    });
                }
            }

            // 2. Handle Button Clicks (Callback Queries)
            if (update.callback_query) {
                const chatId = update.callback_query.message.chat.id;
                const data = update.callback_query.data;
                const messageId = update.callback_query.message.message_id;

                // Acknowledge button click
                await bot.answerCallbackQuery(update.callback_query.id);

                // --- SCENARIO 1: EXAM SELECTED ---
                if (data === "exam_main" || data === "exam_adv") {
                    const examName = data === "exam_main" ? "JEE Main" : "JEE Advanced";
                    
                    let yearButtons = [];
                    let row = [];
                    YEARS.forEach((year, index) => {
                        row.push({ text: year.toString(), callback_data: `year_${data}_${year}` });
                        if ((index + 1) % 3 === 0) { 
                            yearButtons.push(row);
                            row = [];
                        }
                    });
                    if (row.length > 0) yearButtons.push(row);

                    // NO EMOJIS IN BUTTONS
                    yearButtons.push([{ text: `Random Question (${examName})`, callback_data: `rand_${data}` }]);
                    yearButtons.push([{ text: "Back to Menu", callback_data: "menu_home" }]);

                    await bot.editMessageText(`Selected: ${examName}.\nChoose Year or Random:`, {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: { inline_keyboard: yearButtons }
                    });
                }

                // --- SCENARIO 2: YEAR SELECTED ---
                else if (data.startsWith("year_")) {
                    const parts = data.split('_'); 
                    const examType = parts[1] + '_' + parts[2]; 
                    const year = parts[3];
                    const examDisplay = examType === "exam_main" ? "JEE Main" : "JEE Advanced";

                    await bot.editMessageText(`${examDisplay} - ${year}\n\nSend question number (e.g., 5) via text.\nOr click Random below.`, {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: `Random from ${year}`, callback_data: `randyr_${examType}_${year}` }],
                                [{ text: "Back", callback_data: examType }] 
                            ]
                        }
                    });
                }

                // --- SCENARIO 3: RANDOM REQUESTS ---
                else if (data.startsWith("rand_") || data.startsWith("randyr_")) {
                    let examType, year, qNum;
                    
                    if (data.startsWith("rand_")) {
                         examType = data.replace("rand_", "");
                         year = YEARS[Math.floor(Math.random() * YEARS.length)];
                    } else {
                        const parts = data.split('_');
                        examType = parts[1] + '_' + parts[2];
                        year = parts[3];
                    }

                    qNum = Math.floor(Math.random() * MAX_QUESTIONS_PER_YEAR) + 1;

                    await sendImage(chatId, examType, year, qNum);
                }

                // --- SCENARIO 4: BACK TO HOME ---
                else if (data === "menu_home") {
                    await bot.editMessageText("Welcome. Select an exam:", {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "JEE Main", callback_data: "exam_main" },
                                    { text: "JEE Advanced", callback_data: "exam_adv" }
                                ]
                            ]
                        }
                    });
                }
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error:', error);
        res.status(200).send('Error');
    }
};

// Helper function to construct URL and send image
async function sendImage(chatId, examType, year, qNum) {
    const folderName = examType === "exam_main" ? "jee_main" : "jee_adv";
    const imageUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/${BRANCH}/images/${folderName}/${year}/${qNum}.jpg`;
    
    const displayExamName = examType === "exam_main" ? "JEE Main" : "JEE Advanced";
    const caption = `${displayExamName} ${year}\nQuestion: ${qNum}`;
    
    try {
        await bot.sendPhoto(chatId, imageUrl, {
            caption: caption,
            reply_markup: {
                inline_keyboard: [
                     [{ text: "Another Random", callback_data: `rand_${examType}` }]
                ]
            }
        });
    } catch (e) {
        // STRICT ERROR MESSAGE (No Leaks)
        await bot.sendMessage(chatId, "Error: Question unavailable.");
    }
}
