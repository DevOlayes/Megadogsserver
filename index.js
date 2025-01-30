require("dotenv").config();
const path = require('path');
const { Telegraf, Markup } = require("telegraf");
const express = require('express');
const bodyParser = require("body-parser");
const axios = require("axios");
const rateLimit = require('express-rate-limit');

// Add health monitoring
const http = require('http');
let isHealthy = true;

// Environment variables with defaults
const port = process.env.PORT || 4040;
const BOT_TOKEN = process.env.BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const RETRY_TIMEOUT = process.env.RETRY_TIMEOUT || 5000;
const MAX_RETRIES = process.env.MAX_RETRIES || 5;

// Constants
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const URI = `/webhook/${BOT_TOKEN}`;
const WEBHOOK_URL = `${SERVER_URL}${URI}`;
const web_link = "https://megadogs1990.netlify.app";
const community_link = "https://t.me/codesrushdev";

// Enhanced rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true, // Don't count failed requests
  handler: (req, res) => {
    isHealthy = false; // Mark service as unhealthy if rate limit is hit
    res.status(429).send('Too many requests, please try again later.');
  }
});

const app = express();
const server = http.createServer(app);

// Middleware
app.use(limiter);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  isHealthy = false;
  res.status(500).send('Internal Server Error');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(isHealthy ? 200 : 503).json({ status: isHealthy ? 'healthy' : 'unhealthy' });
});

// Webhook initialization with retry mechanism
const initWebhook = async (retries = 0) => {
  try {
    const res = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
    console.log('Webhook set successfully:', res.data);
    isHealthy = true;
  } catch (error) {
    console.error(`Webhook initialization failed (attempt ${retries + 1}/${MAX_RETRIES}):`, error.message);
    isHealthy = false;
    
    if (retries < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_TIMEOUT}ms...`);
      setTimeout(() => initWebhook(retries + 1), RETRY_TIMEOUT);
    } else {
      console.error('Max retries reached. Please check your configuration.');
    }
  }
};

// Initialize bot with error handling
const bot = new Telegraf(BOT_TOKEN);

// Enhanced start command with retry mechanism
bot.start(async (ctx) => {
  const startPayload = ctx.startPayload;
  const urlSent = `${web_link}?ref=${startPayload}`;
  const user = ctx.message.from;
  const userName = user.username ? `@${user.username}` : user.first_name;
  
  const sendMessage = async (retries = 0) => {
    try {
      await ctx.replyWithPhoto(
        { source: 'public/like.jpg' },
        {
          caption: `*Hey, ${userName}\n👋 Welcome to The MEGADOGS Adventures!*\n\n✨ **Play MEGADOGS**: Tap the dog bone and watch your balance fetch amazing rewards!\n🐕 **Mine for MEGA**: Collect MEGADOGS Tokens with every action.\n🔗 **Connect**: [MegaDog Telegram](https://t.me/coderushdevs)`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "✨Start now!✨", web_app: { url: urlSent } }],
              [{ text: "👥Join Community👥", url: community_link }]
            ],
          },
        }
      );
    } catch (error) {
      if (error.response?.data?.description === 'Forbidden: bot was blocked by the user') {
        console.log(`User ${userName} (${user.id}) has blocked the bot`);
      } else {
        console.error(`Error sending message to ${userName} (${user.id}):`, error.message);
        if (retries < MAX_RETRIES) {
          console.log(`Retrying message send in ${RETRY_TIMEOUT}ms...`);
          setTimeout(() => sendMessage(retries + 1), RETRY_TIMEOUT);
        }
      }
    }
  };
  
  await sendMessage();
});

// Webhook handler with timeout
app.post(URI, (req, res) => {
  const timeout = setTimeout(() => {
    res.status(504).send('Webhook processing timeout');
  }, 10000);
  
  try {
    bot.handleUpdate(req.body);
    res.status(200).send('Received Telegram webhook');
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).send('Webhook processing error');
  } finally {
    clearTimeout(timeout);
  }
});

// Basic routes
app.get("/", (req, res) => {
  res.send("Hello, I am working fine.");
});

app.get('/webhook', (req, res) => {
  res.send('Hey, Bot is awake!!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server with connection handling
server.listen(port, async () => {
  console.log('App is running on port', port);
  await initWebhook();
});

// Keep-alive mechanism
setInterval(() => {
  axios.get(`${SERVER_URL}/health`)
    .then(response => {
      isHealthy = response.status === 200;
    })
    .catch(() => {
      isHealthy = false;
    });
}, 60000); // Check health every minute
