require("dotenv").config();
const path = require('path');
const { Telegraf, Markup } = require("telegraf");
const express = require('express');
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 4040;
const { BOT_TOKEN, SERVER_URL } = process.env;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const URI = `/webhook/${BOT_TOKEN}`;
const WEBHOOK_URL = `${SERVER_URL}${URI}`;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.json());

const init = async () => {
    try {
        const res = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
        console.log(res.data);
    } catch (error) {
        console.error('Error setting webhook:', error);
    }
};

app.listen(port, async () => {
    console.log('App is running on port', port);
    await init();
});

const bot = new Telegraf(BOT_TOKEN);

const web_link = "https://megadogs1990.netlify.app";
const community_link = "https://t.me/codesrushdev";

bot.start(async (ctx) => {
    const startPayload = ctx.startPayload;
    const urlSent = `${web_link}?ref=${startPayload}`;
    const user = ctx.message.from;
    const userName = user.username ? `@${user.username}` : user.first_name;

    try {
        // Send the image with a caption
        await ctx.replyWithPhoto(
            { source: 'public/like.jpg' }, // or provide a URL if it's hosted online
            {
                caption: `*Hey, ${userName}\n👋 Welcome to MEGADOGS Adventures !*\n\n✨ **Play MEGADOGS**: Tap the dog bone and watch your balance fetch amazing rewards!\n🐕 **Mine for MEGA**: Collect MEGADOGS Tokens with every action.\n🔗 **Connect**: [MegaDog Telegram](https://t.me/coderushdevs)`,
                parse_mode: 'Markdown', // Ensure markdown is used in the caption
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✨Start now!✨", web_app: { url: urlSent } }],
                        [{ text: "👥Join Community👥", url: community_link }]
                    ],
                },
            }
        );
    } catch (error) {
        if (error.response && error.response.data && error.response.data.description === 'Forbidden: bot was blocked by the user') {
            console.log(`Failed to send message to ${userName} (${user.id}): bot was blocked by the user.`);
        } else {
            console.error(`Failed to send message to ${userName} (${user.id}):`, error);
        }
    }
});

app.post(URI, (req, res) => {
    bot.handleUpdate(req.body);
    res.status(200).send('Received Telegram webhook');
});

app.get("/", (req, res) => {
    res.send("Hello, I am working fine.");
});

app.get('/webhook', (req, res) => {
    res.send('Hey, Bot is awake!');
});