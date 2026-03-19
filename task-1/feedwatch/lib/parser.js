export function parseXML(xml) {
  const items = [];

  const rss = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const item of rss) {
    const title = item.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const guid = item.match(/<guid.*?>(.*?)<\/guid>/)?.[1] || link;
    items.push({ id: guid, title, link });
  }

  const atom = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const item of atom) {
    const title = item.match(/<title.*?>(.*?)<\/title>/)?.[1] || "";
    const link = item.match(/href=\"(.*?)\"/)?.[1] || "";
    const id = item.match(/<id>(.*?)<\/id>/)?.[1] || link;
    items.push({ id, title, link });
  }

  return items;
}