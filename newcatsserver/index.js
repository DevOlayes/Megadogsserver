require("dotenv").config();
const { Telegraf } = require("telegraf");
const express = require('express');
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require('path'); // Added to serve static files

const app = express();
const port = process.env.PORT || 4040;
const { BOT_TOKEN, SERVER_URL } = process.env;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const URI = `/webhook/${BOT_TOKEN}`;
const WEBHOOK_URL = `${SERVER_URL}${URI}`;

// Step 1: Serve static files from the 'public' folder
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

const web_link = "https://newcatsclonev1460.netlify.app";
const community_link = "https://t.me/coderushdevs";

// Step 2: Modify bot start to send image with buttons
bot.start(async (ctx) => {
    const startPayload = ctx.startPayload;
    const urlSent = `${web_link}?ref=${startPayload}`;
    const user = ctx.message.from;
    const userName = user.username ? `@${user.username}` : user.first_name;

    try {
        // Step 3: Send the image (make sure the image is placed in the 'public' folder)
        await ctx.replyWithPhoto({ source: 'public/Like.jpg' }, {
            caption: `*How cool is your Telegram profile?*\nCheck your ratings and receive rewards 🔧`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    // Styled buttons with a visual enhancement (transparent effect with space and emojis)
                    [
                        { text: "✨  Let's go  ✨", web_app: { url: urlSent } },  // Simulating a light, glowy button
                    ],
                    [
                        { text: "👥 Join our Community 👥", url: community_link }
                    ]
                ],
            }
        });
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