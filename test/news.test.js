import { test } from "node:test";
import assert from "node:assert/strict";
import { getHeadlines, resolveRegion } from "../src/news.js";
import { bookKey } from "../src/summaries.js";

test("unknown regions fall back to WORLD", () => {
  assert.equal(resolveRegion("in"), "IN");
  assert.equal(resolveRegion("ZZ"), "WORLD");
  assert.equal(resolveRegion(undefined), "WORLD");
});

test("headlines are merged, de-duplicated, sorted newest first, and failed sources reported", async () => {
  const fetcher = async ({ source }) => {
    if (source === "NDTV") throw new Error("down");
    return [
      { title: `${source} older`, link: "https://x/1", source, publishedAt: "2026-11-01T00:00:00Z" },
      { title: "Shared story", link: "https://x/2", source, publishedAt: "2026-11-02T00:00:00Z" },
    ];
  };
  const data = await getHeadlines("IN", { fetcher });
  assert.equal(data.region, "IN");
  assert.deepEqual(data.failedSources, ["NDTV"]);
  assert.equal(data.items.filter((i) => i.title === "Shared story").length, 1);
  assert.equal(data.items[0].title, "Shared story");
});

test("bookKey normalises title and author", () => {
  assert.equal(bookKey("Atomic Habits!", "James  Clear"), bookKey("atomic habits", "james clear"));
});
