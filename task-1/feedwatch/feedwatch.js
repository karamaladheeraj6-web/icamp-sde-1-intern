import { existsSync, readFileSync, writeFileSync } from "fs";

const storeFile = "store.json";

function storeToFile() {
  if (!existsSync(storeFile)) {
    return { feeds: [], seen: {} };
  }
  return JSON.parse(readFileSync(storeFile, "utf-8"));
}

function saveToStore(storedFile) {
  writeFileSync(storeFile, JSON.stringify(storedFile, null, 2));
}

async function fetchFeed(url) {
  const res = await fetch(url);
  const text = await res.text();
  return text;
}

function parseItems(xml) {
  const items = [];

  // RSS
  const rssItems = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const item of rssItems) {
    const title = item.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const guid = item.match(/<guid.*?>(.*?)<\/guid>/)?.[1] || link;
    items.push({ id: guid, title, link });
  }

  // Atom
  const atomItems = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const item of atomItems) {
    const title = item.match(/<title.*?>(.*?)<\/title>/)?.[1] || "";
    const link = item.match(/<link[^>]*href=\"(.*?)\"/)?.[1] || "";
    const id = item.match(/<id>(.*?)<\/id>/)?.[1] || link;
    items.push({ id, title, link });
  }

  return items;
}

async function run() {
  const storedFile = storeToFile();

  const results = await Promise.all(
    storedFile.feeds.map(async (url) => {
      try {
        const xml = await fetchFeed(url);
        const items = parseItems(xml);
        return { url, items };
      } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
        return { url, items: [] };
      }
    })
  );

  let newCount = 0;

  for (const { url, items } of results) {
    if (!storedFile.seen[url]) storedFile.seen[url] = [];

    const seenSet = new Set(storedFile.seen[url]);

    for (const item of items) {
      if (!seenSet.has(item.id)) {
        console.log(`\n🆕 [${url}]`);
        console.log(item.title);
        console.log(item.link);

        storedFile.seen[url].push(item.id);
        newCount++;
      }
    }
  }

  saveToStore(storedFile);

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

const [,, cmd, arg] = process.argv;

switch (cmd) {
  case "add":
    addFeed(arg);
    break;
  case "remove":
    removeFeed(arg);
    break;
  case "list":
    listFeeds();
    break;
  case "run":
    await run();
    break;
  default:
    console.log(`\nfeedwatch commands:\n
  add <url>   Add a feed
  list        List feeds
  remove      remove feeds
  run         Check for new items
`);
}
