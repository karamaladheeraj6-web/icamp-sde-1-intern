import { existsSync, readFileSync, writeFileSync } from "fs";
import { parseXML } from './lib/parser.js';

const storeFile = "store.json";
const CONFIG_FILE = "feedwatch.config.json";

function storeToFile() {
  if (!existsSync(storeFile)) {
    return { feeds: [], seen: {} };
  }
  return JSON.parse(readFileSync(storeFile, "utf-8"));
}
function loadConfig() {
  let fileConfig = {
      "timeout": 8000,
      "retries": 3,
      "maxItems": 10,
      "logLevel": "info"
    };

  if (existsSync(CONFIG_FILE)) {
    fileConfig = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  }
  const envRetries = process.env.FEEDWATCH_RETRIES;
  const envtimeout = process.env.FEEDWATCH_TIMEOUT;
  const envmaxItems = process.env.FEEDWATCH_MAX_ITEMS;
  const envlogLevel = process.env.FEEDWATCH_LOG_LEVEL;
  return {
    ...fileConfig,
    retries: envRetries ? Number(envRetries) : fileConfig.retries,
    timeout: envtimeout ? Number(envtimeout) : fileConfig.timeout,
    maxItems: envmaxItems ? Number(envmaxItems) : fileConfig.maxItems,
    logLevel: envlogLevel ? Number(envlogLevel) : fileConfig.logLevel
  };
}

function saveToStore(storedFile) {
  writeFileSync(storeFile, JSON.stringify(storedFile, null, 2));
}

async function fetchFeed(url) {
  const res = await fetch(url);
  const text = await res.text();
  return text;
}

function defaultIsRetryable(err) {
  if (!err) return false;

  const msg = String(err.message || err);

  const network = /fetch|network|timeout|ECONN|ENOTFOUND|EAI_AGAIN/i.test(msg);

  const httpMatch = msg.match(/HTTP\s(\d{3})/i);
  if (httpMatch) {
    const code = Number(httpMatch[1]);
    if (code >= 500) return true;   // retry
    if (code >= 400 && code < 500) return false;
  }
  return network;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function withRetry(fn, maxRetries = 3, isRetryable = defaultIsRetryable) {
  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const retry = isRetryable(err);
      if (!retry || attempt === maxRetries) {
        throw err;
      }

      const base = 200 * Math.pow(2, attempt);

      const jitter = Math.floor(Math.random() * 100);

      const delay = base + jitter;

      console.warn(
        `Retrying (${attempt + 1}/${maxRetries}) after ${delay}ms:`,
        err.message || err
      );

      await sleep(delay);
      attempt++;
    }
  }

  throw lastError;
}

async function run(arg) {
  const storedFile = storeToFile();
  const config = loadConfig();
  const results = await Promise.all(
    storedFile.feeds.map(async (url) => {
      try {
        const xml = await withRetry(() => fetchFeed(url), config.retries);
        const items = parseXML(xml);
        return { url, items, status: "ok" };
      } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
        return { url, items: [e.message], status: "Failed" };
      }
    })
  );

  let newCount = 0;

  for (const { url, items } of results) {
    if (!storedFile.seen[url]) storedFile.seen[url] = [];

    const seenSet = new Set(storedFile.seen[url]);

    for (const item of items) {
      if (!seenSet.has(item.id) || arg == 'all') {
        console.log(`\n🆕 [${url}]`);
        console.log(item.title);
        console.log(item.link);
        if(arg != 'all') {
          storedFile.seen[url].push(item.id);
        }
        
        newCount++;
      }
    }
  }

  saveToStore(storedFile);

  if (arg == 'json') {
    // Strict JSON output (no logs)
    process.stdout.write(JSON.stringify(results, null, 2));
    return;
  }

  if (newCount === 0) {
    console.log("No new items.");
  }
}

function addFeed(url) {
  const storedFile = storeToFile();
  if (!storedFile.feeds.includes(url)) {
    storedFile.feeds.push(url);
    saveToStore(storedFile);
    console.log("Added:", url);
  } else {
    console.log("Already exists");
  }
}

function listFeeds() {
  const storedFile = storeToFile();
  console.log("Feeds:");
  storedFile.feeds.forEach((f) => console.log("-", f));
}

function askConfirmation(question) {
  return new Promise((resolve) => {
    process.stdout.write(question + " (y/n): ");
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      const answer = data.trim().toLowerCase();
      process.stdin.pause();
      resolve(answer === "y" || answer === "yes");
    });
  });
}

async function removeFeed(url) {
  const storedFile = storeToFile();
  if (storedFile.feeds.includes(url)) {
    const confirm = await askConfirmation(`Remove feed: ${url}?`);
    if (!confirm) {
      console.log("Cancelled");
      return;
    }
    storedFile.feeds = storedFile.feeds.filter((f) => f !== url);
    delete storedFile.seen[url];
    saveToStore(storedFile);
    console.log("Removed:", url);
  } else {
    console.log("Feed not found");
  }
}
function resolveFeed(input, feeds) {
  return feeds.find((f) => f === input || f.includes(input));
}
async function readFeed(input) {
  const storedFile = storeToFile();
  const config = loadConfig();
  const url = resolveFeed(input, storedFile.feeds);

  if (!url) {
    console.log("Feed not found");
    return;
  }

  try {
    const xml = await withRetry(() => fetchFeed(url), config.retries);
    const items = parseXML(xml);

    if (items.length === 0) {
      console.log("No items found.");
      return;
    }

    console.log(`
Feed: ${url}
`);

    items.slice(0, 10).forEach((item, i) => {
      console.log(`${i + 1}. ${item.title || "(no title)"}`);
      console.log(`   ${item.link}`);
      if (item.pubDate) console.log(`   ${item.pubDate}`);
      console.log("");
    });
  } catch (e) {
    console.error(`Error reading ${url}:`, e.message);
  }
}

const [,, cmd, arg] = process.argv;

switch (cmd) {
  case "add":
    addFeed(arg);
    break;
  case "remove":
    removeFeed(arg);
    break;
  case "read": 
    await readFeed(arg); 
    break;
  case "list":
    listFeeds();
    break;
  case "run":
    await run(arg);
    break;
  default:
    console.log(`\nfeedwatch commands:\n
  add <url>   Add a feed
  list        List feeds
  remove      remove feeds
  run         Check for new items
`);
}
