import Parser from "rss-parser";
import { REGIONS } from "./feeds.js";

const parser = new Parser({ timeout: 8000, headers: { "User-Agent": "ReadDaily/1.0" } });
const TTL_MS = 15 * 60 * 1000;
const cache = new Map(); // country -> { at, data }

export function resolveRegion(country) {
  const code = String(country || "").toUpperCase();
  return REGIONS[code] ? code : "WORLD";
}

async function fetchFeed({ source, url }) {
  const feed = await parser.parseURL(url);
  return feed.items.slice(0, 15).map((item) => ({
    title: (item.title || "").trim(),
    link: item.link,
    source,
    publishedAt: item.isoDate || item.pubDate || null,
    snippet: (item.contentSnippet || "").replace(/\s+/g, " ").trim().slice(0, 220),
  }));
}

export async function getHeadlines(country, { fetcher = fetchFeed } = {}) {
  const code = resolveRegion(country);
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const region = REGIONS[code];
  const results = await Promise.allSettled(region.feeds.map(fetcher));
  const seen = new Set();
  const items = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((it) => {
      if (!it.title || !it.link) return false;
      const k = it.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, 40);

  const data = {
    region: code,
    regionName: region.name,
    sources: region.feeds.map((f) => f.source),
    failedSources: region.feeds.filter((_, i) => results[i].status === "rejected").map((f) => f.source),
    items,
    fetchedAt: new Date().toISOString(),
  };
  if (items.length) cache.set(code, { at: Date.now(), data });
  return data;
}

export function listRegions() {
  return Object.entries(REGIONS).map(([code, r]) => ({ code, name: r.name }));
}
