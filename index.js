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
const port = process.env.PORT || 10000;
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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  handler: (req, res) => {
    isHealthy = false;
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

const app = express();
const server = http.createServer(app);

// Middleware
app.use(limiter);
app.use(express.json());
app.use(bodyParser.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  isHealthy = false;
  res.status(500).json({ error: 'Internal Server Error' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(isHealthy ? 200 : 503).json({ 
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString()
  });
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

// Store sent messages to prevent duplicates
const sentMessages = new Map();

// Enhanced start command with referral support
bot.start(async (ctx) => {
  const startPayload = ctx.startPayload;
  let urlSent = web_link;
  
  // Add referral parameter if present in start payload
  if (startPayload && startPayload.startsWith('ref_')) {
    urlSent = `${web_link}?ref=${startPayload}`;
  }
  
  const user = ctx.message.from;
  const userName = user.username ? `@${user.username}` : user.first_name;
  
  try {
    await ctx.reply(
      `*Hey, ${userName}! 🐕*\n\n` +
      `*Welcome to MEGADOGS Adventures!*\n\n` +
      `✨ *Play MEGADOGS*: Tap the dog bone and watch your balance fetch amazing rewards!\n` +
      `💰 *Mine for MEGA*: Collect MEGADOGS Tokens with every action.\n` +
      `👥 *Invite Friends*: Earn bonuses when friends join using your referral link!\n\n` +
      `*Get started now and join the adventure!* 🚀`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎮 Start Playing Now!", web_app: { url: urlSent } }],
            [{ text: "👥 Join Community", url: community_link }],
            [{ text: "📱 Share Referral", switch_inline_query: "Join MEGADOGS and earn with me! 🐕" }]
          ],
        },
      }
    );
    
    console.log(`✅ Start message sent to ${userName} (${user.id}) with${startPayload ? '' : 'out'} referral`);
  } catch (error) {
    if (error.response?.data?.description === 'Forbidden: bot was blocked by the user') {
      console.log(`User ${userName} (${user.id}) has blocked the bot`);
    } else {
      console.error(`Error sending message to ${userName} (${user.id}):`, error.message);
    }
  }
});

// ========== SYNCED ENDPOINTS FOR FRONTEND USERCONTEXT.JS ==========

// Send welcome message to new user (called from frontend UserContext.js)
app.post('/api/sendWelcomeMessage', async (req, res) => {
  try {
    const { userId, username, firstName, referrerId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if message was already sent (prevent duplicates)
    const messageKey = `welcome_${userId}`;
    const lastSent = sentMessages.get(messageKey);
    if (lastSent && (Date.now() - lastSent) < 24 * 60 * 60 * 1000) {
      return res.status(200).json({ 
        success: true, 
        message: 'Welcome message already sent recently',
        alreadySent: true 
      });
    }

    const welcomeMessage = `👋 Welcome ${firstName || username} to MEGADOGS! 🐕\n\n` +
      `${referrerId ? '🎉 Your referral has been recorded! ' : '🌟 '}` +
      `Get ready for an amazing adventure!\n\n` +
      `🚀 *Quick Start Guide:*\n` +
      `• Tap the dog bone to start mining\n` +
      `• Complete tasks for extra rewards\n` +
      `• Invite friends for referral bonuses\n` +
      `• Check in daily for special gifts\n\n` +
      `Let's start earning! 💰`;

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: userId,
      text: welcomeMessage,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Open MEGADOGS", web_app: { url: web_link } }],
          [{ text: "👥 Join Community", url: community_link }]
        ]
      }
    });

    // Mark as sent with timestamp
    sentMessages.set(messageKey, Date.now());
    
    console.log(`✅ Welcome message sent to user ${userId}${referrerId ? ` (referred by ${referrerId})` : ''}`);
    res.status(200).json({ 
      success: true, 
      message: 'Welcome message sent successfully',
      hasReferrer: !!referrerId 
    });
    
  } catch (error) {
    console.error('Error sending welcome message:', error.response?.data || error.message);
    
    // Don't treat "blocked bot" as an error
    if (error.response?.data?.description?.includes('bot was blocked')) {
      console.log(`User ${req.body.userId} has blocked the bot`);
      return res.status(200).json({ 
        success: true, 
        message: 'User blocked bot',
        botBlocked: true 
      });
    }
    
    // For other errors, still return success to frontend
    res.status(200).json({ 
      success: true, 
      message: 'Welcome message queued',
      error: error.response?.data?.description || error.message 
    });
  }
});

// Send referral notification to referrer (called from frontend UserContext.js)
app.post('/api/sendReferralNotification', async (req, res) => {
  try {
    const { referrerId, newUser } = req.body;
    
    if (!referrerId || !newUser) {
      return res.status(400).json({ error: 'Referrer ID and new user data are required' });
    }

    // Check if notification was already sent
    const notificationKey = `referral_${referrerId}_${newUser.id}`;
    if (sentMessages.has(notificationKey)) {
      return res.status(200).json({ 
        success: true, 
        message: 'Referral notification already sent',
        alreadySent: true 
      });
    }

    const referralMessage = `🎉 *NEW REFERRAL ALERT!*\n\n` +
      `Your friend *@${newUser.username}* just joined MEGADOGS using your referral link!\n\n` +
      `✨ *What happens next:*\n` +
      `• You earn 20% of their mining rewards\n` +
      `• Bonus points when they complete tasks\n` +
      `• Special rewards at referral milestones\n\n` +
      `Keep sharing your link to earn more! 💰\n\n` +
      `*Thank you for growing our pack!* 🐕`;

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: referrerId,
      text: referralMessage,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Get Referral Link", callback_data: 'get_referral_link' }],
          [{ text: "🎮 Open App", web_app: { url: web_link } }]
        ]
      }
    });

    // Mark as sent
    sentMessages.set(notificationKey, Date.now());
    
    console.log(`✅ Referral notification sent to ${referrerId} for new user ${newUser.id}`);
    res.status(200).json({ 
      success: true, 
      message: 'Referral notification sent successfully',
      referrerId: referrerId,
      newUserId: newUser.id 
    });
    
  } catch (error) {
    console.error('Error sending referral notification:', error.response?.data || error.message);
    
    if (error.response?.data?.description?.includes('bot was blocked')) {
      console.log(`Referrer ${referrerId} has blocked the bot`);
      return res.status(200).json({ 
        success: true, 
        message: 'Referrer blocked bot',
        botBlocked: true 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Referral notification queued',
      error: error.response?.data?.description || error.message 
    });
  }
});

// Handle referral link request
bot.action('get_referral_link', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const referralLink = `https://t.me/${ctx.botInfo.username}?start=ref_${userId}`;
    
    await ctx.reply(
      `🔗 *Your Personal Referral Link:*\n\n` +
      `\`${referralLink}\`\n\n` +
      `*Share this link with friends to earn:*\n` +
      `• 20% of their mining rewards 💰\n` +
      `• Bonus points for each friend 🎁\n` +
      `• Special milestone rewards 🏆\n\n` +
      `*Tap the link to copy it!*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Share Link", switch_inline_query: `Join MEGADOGS with my referral link: ${referralLink}` }],
            [{ text: "🎮 Open App", web_app: { url: web_link } }]
          ]
        }
      }
    );
    
    await ctx.answerCbQuery('Referral link generated!');
  } catch (error) {
    console.error('Error generating referral link:', error);
    await ctx.answerCbQuery('Error generating link. Please try again.');
  }
});

// Direct bot message endpoint (for frontend UserContext.js sendBotMessage function)
app.post('/api/sendBotMessage', async (req, res) => {
  try {
    const { telegramId, message } = req.body;
    
    if (!telegramId || !message) {
      return res.status(400).json({ error: 'Telegram ID and message are required' });
    }

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: telegramId,
      text: message,
      parse_mode: 'HTML'
    });

    console.log(`✅ Direct message sent to ${telegramId}`);
    res.status(200).json({ success: true, message: 'Message sent successfully' });
    
  } catch (error) {
    console.error('Error sending bot message:', error.response?.data || error.message);
    
    if (error.response?.data?.description?.includes('bot was blocked')) {
      console.log(`User ${telegramId} has blocked the bot`);
      return res.status(200).json({ success: true, message: 'User blocked bot' });
    }
    
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.response?.data || error.message 
    });
  }
});

// Clear sent messages cache (for testing/reset)
app.delete('/api/clearMessageCache', (req, res) => {
  const previousSize = sentMessages.size;
  sentMessages.clear();
  console.log(`🧹 Cleared message cache (${previousSize} entries removed)`);
  res.status(200).json({ 
    success: true, 
    message: `Message cache cleared (${previousSize} entries removed)` 
  });
});

// Get message cache stats (for monitoring)
app.get('/api/messageCacheStats', (req, res) => {
  const stats = {
    totalEntries: sentMessages.size,
    entries: Array.from(sentMessages.entries()).slice(0, 10)
  };
  
  res.status(200).json({
    success: true,
    ...stats
  });
});

// Webhook handler
app.post(URI, (req, res) => {
  try {
    bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).send('Webhook processing error');
  }
});

// Basic routes
app.get("/", (req, res) => {
  res.json({ 
    message: "MEGADOGS Telegram Bot API", 
    status: "running",
    version: "1.0.0",
    endpoints: {
      webhook: URI,
      welcomeMessage: "/api/sendWelcomeMessage",
      referralNotification: "/api/sendReferralNotification",
      botMessage: "/api/sendBotMessage"
    }
  });
});

app.get('/webhook', (req, res) => {
  res.json({ status: 'Bot is awake and running!' });
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
  console.log('🚀 MEGADOGS Bot Server running on port', port);
  console.log('📋 Available endpoints:');
  console.log('  POST /api/sendWelcomeMessage     - Send welcome to new users');
  console.log('  POST /api/sendReferralNotification - Notify referrers about new referrals');
  console.log('  POST /api/sendBotMessage         - Send custom messages');
  console.log('  GET  /api/messageCacheStats      - View cache stats');
  console.log('  DELETE /api/clearMessageCache    - Clear message cache');
  console.log('  GET  /health                     - Health check');
  console.log('');
  console.log('🔗 Webhook URL:', WEBHOOK_URL);
  
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
}, 60000);

// Clear old cache entries periodically (older than 7 days)
setInterval(() => {
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  let clearedCount = 0;
  
  for (const [key, timestamp] of sentMessages.entries()) {
    if (timestamp < sevenDaysAgo) {
      sentMessages.delete(key);
      clearedCount++;
    }
  }
  
  if (clearedCount > 0) {
    console.log(`🧹 Cleared ${clearedCount} old cache entries`);
  }
}, 60 * 60 * 1000);
