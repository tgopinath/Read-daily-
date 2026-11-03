// Book plans and daily section summaries, generated with Claude and cached on disk
// so each book/section is only generated once.
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";

const MODEL = "claude-opus-5-5";
const CACHE_FILE = path.resolve(process.env.CACHE_FILE || "data/summaries.json");

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

// ---- tiny JSON file cache -------------------------------------------------
let cache;
async function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
  } catch {
    cache = { plans: {}, sections: {} };
  }
  return cache;
}
async function saveCache() {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export function bookKey(title, author = "") {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${norm(title)}|${norm(author)}`;
}

// ---- Claude call with JSON output ----------------------------------------
const SYSTEM = `You are the editor of "Read Daily", an app that lets busy people read one short, engaging summary section of a book each day.
Write every summary in your own words. Never reproduce passages from the book; at most a single short quote (under 25 words) per section.
Be accurate to the book's actual content. If you do not know a book well enough to summarise it faithfully, say so instead of inventing content.`;

async function askJSON(prompt, schema, maxTokens) {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new SummaryError("The summary service declined this request.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new SummaryError("The summary was cut short. Please try again.", 502);
  }
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text);
}

export class SummaryError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export function toSummaryError(err) {
  if (err instanceof SummaryError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new SummaryError("Summaries are not configured: set ANTHROPIC_API_KEY on the server.", 503);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new SummaryError("Too many requests right now. Please try again in a minute.", 429);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new SummaryError("Could not reach the summary service.", 502);
  }
  if (err instanceof Anthropic.APIError) {
    return new SummaryError(`Summary service error (${err.status}).`, 502);
  }
  if (err?.message?.includes("API key") || err?.message?.includes("credentials")) {
    return new SummaryError("Summaries are not configured: set ANTHROPIC_API_KEY on the server.", 503);
  }
  return new SummaryError("Something went wrong while summarising.", 500);
}

// ---- Plan: split a book into daily sections ------------------------------
const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["known", "title", "author", "overview", "sections"],
  properties: {
    known: { type: "boolean", description: "false if you cannot summarise this book faithfully" },
    title: { type: "string" },
    author: { type: "string" },
    overview: { type: "string", description: "2-3 sentence hook about what the reader will get" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "teaser"],
        properties: {
          title: { type: "string" },
          teaser: { type: "string", description: "one sentence" },
        },
      },
    },
  },
};

export async function getPlan(title, author) {
  const c = await loadCache();
  const key = bookKey(title, author);
  if (c.plans[key]) return c.plans[key];

  const plan = await askJSON(
    `Book: "${title}"${author ? ` by ${author}` : ""}.
Split this book into between 8 and 20 daily reading sections that follow the book's own structure (chapters or parts, merged or split so each makes a satisfying 5-minute read).
Give each section a short title and a one-sentence teaser. Use the book's correct title and author.
If you don't know this book reliably, set "known" to false and return an empty sections list.`,
    PLAN_SCHEMA,
    8000,
  );
  if (!plan.known || plan.sections.length === 0) {
    throw new SummaryError(
      `Sorry, we don't know "${title}" well enough to summarise it faithfully. Try adding the author or checking the spelling.`,
      404,
    );
  }
  c.plans[key] = plan;
  await saveCache();
  return plan;
}

// ---- Section: one day's summary -----------------------------------------
const SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "keyTakeaways", "reflection"],
  properties: {
    title: { type: "string" },
    summary: {
      type: "string",
      description: "500-800 words, several paragraphs separated by blank lines, plain text",
    },
    keyTakeaways: { type: "array", items: { type: "string" } },
    reflection: { type: "string", description: "one question for the reader to think about today" },
  },
};

export async function getSection(title, author, index) {
  const plan = await getPlan(title, author);
  if (!Number.isInteger(index) || index < 0 || index >= plan.sections.length) {
    throw new SummaryError("That section doesn't exist.", 400);
  }
  const c = await loadCache();
  const key = `${bookKey(title, author)}#${index}`;
  if (c.sections[key]) return c.sections[key];

  const outline = plan.sections.map((s, i) => `${i + 1}. ${s.title} — ${s.teaser}`).join("\n");
  const section = await askJSON(
    `Book: "${plan.title}" by ${plan.author}.
The daily reading plan is:
${outline}

Write today's reading: section ${index + 1}, "${plan.sections[index].title}".
Make it engaging and easy to read in about 5 minutes (500-800 words), like a friend who loves the book explaining it — never boring.
Cover only this section's ideas or events; briefly connect to the previous section if helpful.
Then list 3-5 key takeaways and one reflection question.`,
    SECTION_SCHEMA,
    8000,
  );
  c.sections[key] = section;
  await saveCache();
  return section;
}
