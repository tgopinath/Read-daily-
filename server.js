import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHeadlines, listRegions } from "./src/news.js";
import { getPlan, getSection, toSummaryError } from "./src/summaries.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(here, "public")));

const clean = (s, max = 200) => String(s ?? "").trim().slice(0, max);

app.get("/api/regions", (_req, res) => res.json(listRegions()));

app.get("/api/news", async (req, res) => {
  try {
    res.json(await getHeadlines(req.query.country));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Could not load headlines right now." });
  }
});

// Book search via Open Library (free, no key) for title/author/cover autocomplete.
app.get("/api/books/search", async (req, res) => {
  const q = clean(req.query.q, 120);
  if (q.length < 2) return res.json([]);
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,cover_i,first_publish_year`;
    const r = await fetch(url, { headers: { "User-Agent": "ReadDaily/1.0" }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    res.json(
      (data.docs || []).map((d) => ({
        title: d.title,
        author: d.author_name?.[0] || "",
        year: d.first_publish_year || null,
        cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      })),
    );
  } catch {
    res.json([]); // search is optional — the user can still type a title manually
  }
});

app.post("/api/books/plan", async (req, res) => {
  const title = clean(req.body?.title);
  const author = clean(req.body?.author);
  if (!title) return res.status(400).json({ error: "Please enter a book title." });
  try {
    res.json(await getPlan(title, author));
  } catch (err) {
    const e = toSummaryError(err);
    if (e.status >= 500) console.error(err);
    res.status(e.status).json({ error: e.message });
  }
});

app.post("/api/books/section", async (req, res) => {
  const title = clean(req.body?.title);
  const author = clean(req.body?.author);
  const index = Number(req.body?.index);
  if (!title) return res.status(400).json({ error: "Missing book title." });
  try {
    res.json(await getSection(title, author, index));
  } catch (err) {
    const e = toSummaryError(err);
    if (e.status >= 500) console.error(err);
    res.status(e.status).json({ error: e.message });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Read Daily running at http://localhost:${port}`));
