import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';

// Load environment variables
dotenv.config();

// Environment variables check
const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
const POST_GROUP = process.env.POST_GROUP;
const RED_GROUPS = process.env.RED_GROUPS?.split(',') ?? [];
const YELLOW_GROUPS = process.env.YELLOW_GROUPS?.split(',') ?? [];
const GREEN_GROUPS = process.env.GREEN_GROUPS?.split(',') ?? [];
const ALL_GROUPS = [...RED_GROUPS, ...YELLOW_GROUPS, ...GREEN_GROUPS];

if (!TELEGRAM_API_KEY || !POST_GROUP || ALL_GROUPS.length === 0) {
  console.log('Error: Missing required environment variables.');
  process.exit(1);
}

// Initialize Telegram Bot
const bot = new Telegraf(TELEGRAM_API_KEY);

// Database setup
const DB_FILE = 'watchlist.db';

const initDb = (): void => {
  const db = new sqlite3.Database(DB_FILE);
  db.run(`
    CREATE TABLE IF NOT EXISTS watchlist (
      ca TEXT PRIMARY KEY,
      initial_price REAL,
      current_price REAL,
      highest_multiplier REAL DEFAULT 1.0,
      group_name TEXT,
      tracked_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.close();
};

// SQLite Database functions
const addToWatchlist = (ca: string, initialPrice: number, groupName: string): void => {
  const db = new sqlite3.Database(DB_FILE);
  db.run(`
    INSERT OR IGNORE INTO watchlist (ca, initial_price, current_price, highest_multiplier, group_name)
    VALUES (?, ?, ?, ?, ?)
  `, [ca, initialPrice, initialPrice, 1.0, groupName], (err) => {
    if (err) {
      console.error('Error adding to watchlist:', err.message);
    }
  });
  db.close();
};

const updateWatchlist = (ca: string, currentPrice: number, highestMultiplier?: number): void => {
  const db = new sqlite3.Database(DB_FILE);
  if (highestMultiplier) {
    db.run(`
      UPDATE watchlist SET current_price = ?, highest_multiplier = ? WHERE ca = ?
    `, [currentPrice, highestMultiplier, ca]);
  } else {
    db.run(`
      UPDATE watchlist SET current_price = ? WHERE ca = ?
    `, [currentPrice, ca]);
  }
  db.close();
};

// Fetch token price from DexScreener
const fetchPrice = async (ca: string): Promise<number | null> => {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${ca}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const priceUsd = data.pairs?.[0]?.priceUsd;
    return priceUsd ? parseFloat(priceUsd) : null;
  } catch (err) {
    console.error(`Error fetching price for ${ca}:`, err);
    return null;
  }
};

// Handle new messages from Telegram groups
bot.on('text', async (ctx) => {
  const message = ctx.message.text?.trim();
  const groupName = ctx.chat?.title ?? 'Unknown';

  if (!message) return;
  console.log(`Received message from group ${groupName}: ${message}`);

  const match = message.match(/\b([A-Za-z0-9]{32,})\b/);
  if (!match) {
    console.log('No valid contract address found.');
    return;
  }

  const ca = match[1];
  if (ca.startsWith('0x')) {
    console.log(`Excluded CA starting with '0x': ${ca}`);
    return;
  }

  // Fetch initial price
  const initialPrice = await fetchPrice(ca);
  if (initialPrice === null) {
    console.log(`Could not fetch initial price for CA ${ca}. Ignoring.`);
    return;
  }

  // Add to watchlist and track
  addToWatchlist(ca, initialPrice, groupName);

  // Send group-specific message
  let template = 'Placeholder template'; // Customize based on group
  if (RED_GROUPS.includes(groupName)) {
    template = 'Red group template';
  } else if (YELLOW_GROUPS.includes(groupName)) {
    template = 'Yellow group template';
  } else if (GREEN_GROUPS.includes(groupName)) {
    template = 'Green group template';
  }

  await ctx.telegram.sendMessage(POST_GROUP, `Tracking started for CA: ${ca}. ${template}`);

  // Start monitoring performance
  setTimeout(() => monitorCaPerformance(ca, initialPrice), 3000);
});

// Monitor the price performance of a token
const monitorCaPerformance = async (ca: string, initialPrice: number): Promise<void> => {
  try {
    while (true) {
      const currentPrice = await fetchPrice(ca);
      if (currentPrice === null) {
        await new Promise(res => setTimeout(res, 3000));
        continue;
      }

      const multiplier = currentPrice / initialPrice;
      updateWatchlist(ca, currentPrice, multiplier);

      if (multiplier >= 1.5) { // Threshold example
        await bot.telegram.sendMessage(POST_GROUP, `New update for ${ca}: ${multiplier.toFixed(2)}x`);
      }

      await new Promise(res => setTimeout(res, 300000)); // Wait 5 minutes before next check
    }
  } catch (err) {
    console.error(`Error monitoring CA ${ca}:`, err);
  }
};

// Start the Telegram bot
bot.launch();
console.log('Bot started.');

initDb(); // Initialize the database
