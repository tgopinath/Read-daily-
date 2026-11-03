// Read Daily — client app. All personal data (books, progress) stays in this browser's localStorage.

const STORE_KEY = "readdaily.v1";
const $ = (sel) => document.querySelector(sel);

// ---------- state ----------
const defaults = { region: null, books: [], activeBookId: null, sections: {}, streak: 0, lastStreakDate: null };
let state = load();

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    return { ...defaults };
  }
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — app still works for this session */
  }
}

const todayStr = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const yesterdayStr = () => todayStr(new Date(Date.now() - 864e5));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- region detection ----------
const TZ_COUNTRY = {
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
  "Europe/London": "GB",
  "Asia/Singapore": "SG",
  "Asia/Dubai": "AE",
  "Europe/Berlin": "DE",
};
function detectRegion() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  if (tz.startsWith("Australia/")) return "AU";
  const langRegion = (navigator.languages?.[0] || navigator.language || "").split("-")[1];
  if (langRegion) return langRegion.toUpperCase();
  if (tz.startsWith("America/")) return "US";
  return "WORLD";
}

// ---------- navigation ----------
function show(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  window.scrollTo(0, 0);
  if (view === "today") renderToday();
  if (view === "books") renderBooks();
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
$("#reader-back").addEventListener("click", () => show(readerReturn));
let readerReturn = "today";

// ---------- news ----------
async function initNews() {
  const regions = await api("/api/regions").catch(() => [{ code: "WORLD", name: "World" }]);
  if (!state.region) {
    const guess = detectRegion();
    state.region = regions.some((r) => r.code === guess) ? guess : "WORLD";
    save();
  }
  const sel = $("#region-select");
  sel.innerHTML = regions.map((r) => `<option value="${r.code}">${esc(r.name)}</option>`).join("");
  sel.value = state.region;
  sel.addEventListener("change", () => {
    state.region = sel.value;
    save();
    loadNews();
  });
  loadNews();
}

async function loadNews() {
  const list = $("#news-list");
  list.innerHTML = '<li><div class="skeleton"></div><div class="skeleton" style="width:60%"></div></li>'.repeat(4);
  $("#news-sources").textContent = "";
  try {
    const data = await api(`/api/news?country=${encodeURIComponent(state.region)}`);
    $("#news-sources").textContent = `From ${data.sources.join(", ")}`;
    if (!data.items.length) {
      list.innerHTML = '<li class="muted" style="padding:12px 0">No headlines available right now. Try again shortly.</li>';
      return;
    }
    list.innerHTML = data.items
      .map(
        (it) => `<li><a href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">
          <div class="headline">${esc(it.title)}</div>
          ${it.snippet ? `<div class="snippet">${esc(it.snippet)}</div>` : ""}
          <div class="meta">${esc(it.source)}${it.publishedAt ? " · " + timeAgo(it.publishedAt) : ""}</div>
        </a></li>`,
      )
      .join("");
  } catch (e) {
    list.innerHTML = `<li class="muted" style="padding:12px 0">${esc(e.message)}</li>`;
  }
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return "";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ---------- books ----------
const activeBook = () => state.books.find((b) => b.id === state.activeBookId) || state.books.find((b) => b.done < b.plan.sections.length) || state.books[0];
const readToday = (b) => b.lastReadDate === todayStr();
const finished = (b) => b.done >= b.plan.sections.length;

function coverHTML(b, cls = "cover") {
  return b.cover
    ? `<img class="${cls}" src="${esc(b.cover)}" alt="" loading="lazy" />`
    : `<div class="${cls} ph">${esc((b.title || "?")[0].toUpperCase())}</div>`;
}

function renderToday() {
  const el = $("#today-reading");
  const b = activeBook();
  if (!b) {
    el.innerHTML = `<div class="eyebrow">Today's reading</div>
      <h3>Add your first book</h3>
      <p class="muted">Pick a book you've always wanted to read. Each day you'll get one short, engaging summary section — about 5 minutes.</p>
      <div class="row"><button class="btn primary" id="go-add">Add a book</button></div>`;
    $("#go-add").onclick = () => {
      show("books");
      $("#book-title").focus();
    };
    return;
  }
  const total = b.plan.sections.length;
  const pct = Math.round((b.done / total) * 100);
  let body, actions;
  if (finished(b)) {
    body = `<p>You've finished all ${total} sections. 🎉</p>`;
    actions = `<button class="btn" id="go-books">Choose another book</button>`;
  } else if (readToday(b)) {
    const next = b.plan.sections[b.done];
    body = `<p class="muted">Done for today — nice work! Tomorrow: <strong>${esc(next.title)}</strong></p>`;
    actions = `<button class="btn" id="read-btn">Read ahead anyway</button>`;
  } else {
    const next = b.plan.sections[b.done];
    body = `<p><strong>Day ${b.done + 1}: ${esc(next.title)}</strong><br><span class="muted">${esc(next.teaser)}</span></p>`;
    actions = `<button class="btn primary" id="read-btn">Read today's section</button>`;
  }
  el.innerHTML = `<div class="eyebrow">Today's reading${state.streak > 1 ? ` · 🔥 ${state.streak}-day streak` : ""}</div>
    <div class="book-line">${coverHTML(b)}
      <div><h3>${esc(b.plan.title)}</h3><div class="muted small">${esc(b.plan.author)}</div></div>
    </div>
    <div class="progress" aria-label="${pct}% complete"><span style="width:${pct}%"></span></div>
    <div class="muted small">${b.done} of ${total} sections read</div>
    ${body}
    <div class="row">${actions}${state.books.length > 1 ? '<button class="btn link" id="switch-btn">Switch book</button>' : ""}</div>`;
  $("#read-btn")?.addEventListener("click", () => openSection(b, b.done, "today"));
  $("#go-books")?.addEventListener("click", () => show("books"));
  $("#switch-btn")?.addEventListener("click", () => show("books"));
}

function renderBooks() {
  const list = $("#book-list");
  if (!state.books.length) {
    list.innerHTML = '<li class="muted">No books yet. Add one above.</li>';
    return;
  }
  const active = activeBook();
  list.innerHTML = state.books
    .map((b) => {
      const total = b.plan.sections.length;
      return `<li data-id="${b.id}">${coverHTML(b)}
        <div class="info">
          <h3>${esc(b.plan.title)} ${b === active ? '<span class="badge">Reading now</span>' : ""}</h3>
          <div class="muted small">${esc(b.plan.author)} · ${b.done}/${total} sections${finished(b) ? " · finished" : ""}</div>
          <div class="progress"><span style="width:${Math.round((b.done / total) * 100)}%"></span></div>
          <div class="actions">
            <button class="btn link" data-act="open">Sections</button>
            ${b !== active ? '<button class="btn link" data-act="active">Read this daily</button>' : ""}
            <button class="btn link" data-act="remove" style="color:var(--warn)">Remove</button>
          </div>
        </div></li>`;
    })
    .join("");
}

$("#book-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const b = state.books.find((x) => x.id === btn.closest("li").dataset.id);
  if (btn.dataset.act === "open") openOverview(b);
  if (btn.dataset.act === "active") {
    state.activeBookId = b.id;
    save();
    renderBooks();
  }
  if (btn.dataset.act === "remove" && confirm(`Remove "${b.plan.title}" and its progress?`)) {
    state.books = state.books.filter((x) => x !== b);
    for (const k of Object.keys(state.sections)) if (k.startsWith(b.id + "#")) delete state.sections[k];
    if (state.activeBookId === b.id) state.activeBookId = null;
    save();
    renderBooks();
  }
});

// ---------- add book (with Open Library suggestions) ----------
const titleInput = $("#book-title");
const authorInput = $("#book-author");
const sugg = $("#suggestions");
let pickedCover = null;
let suggTimer;
let lastResults = [];

titleInput.addEventListener("input", () => {
  pickedCover = null;
  clearTimeout(suggTimer);
  const q = titleInput.value.trim();
  if (q.length < 3) return (sugg.hidden = true);
  suggTimer = setTimeout(async () => {
    lastResults = await api(`/api/books/search?q=${encodeURIComponent(q)}`).catch(() => []);
    if (!lastResults.length || titleInput.value.trim() !== q) return (sugg.hidden = true);
    sugg.innerHTML = lastResults
      .map((r, i) => `<li data-i="${i}">${coverHTML(r)}<div><div>${esc(r.title)}</div><div class="muted small">${esc(r.author)}${r.year ? ` · ${r.year}` : ""}</div></div></li>`)
      .join("");
    sugg.hidden = false;
  }, 300);
});
sugg.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-i]");
  if (!li) return;
  const r = lastResults[li.dataset.i];
  titleInput.value = r.title;
  authorInput.value = r.author;
  pickedCover = r.cover;
  sugg.hidden = true;
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".field")) sugg.hidden = true;
});

$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  const msg = $("#add-msg");
  const btn = $("#add-btn");
  if (!title) return;
  const dup = state.books.find((b) => b.title.toLowerCase() === title.toLowerCase());
  if (dup) {
    msg.className = "form-msg error";
    msg.textContent = "That book is already in your list.";
    return;
  }
  btn.disabled = true;
  msg.className = "form-msg";
  msg.textContent = "Preparing your daily reading plan… this can take a little while.";
  sugg.hidden = true;
  try {
    const plan = await api("/api/books/plan", { title, author });
    const book = {
      id: crypto.randomUUID?.() || String(Date.now()),
      title,
      author,
      cover: pickedCover,
      addedAt: todayStr(),
      plan,
      done: 0,
      lastReadDate: null,
    };
    state.books.push(book);
    if (!state.activeBookId || finished(activeBook())) state.activeBookId = book.id;
    save();
    msg.textContent = `Added "${plan.title}" — ${plan.sections.length} daily sections.`;
    titleInput.value = authorInput.value = "";
    pickedCover = null;
    renderBooks();
  } catch (err) {
    msg.className = "form-msg error";
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// ---------- reader ----------
function openOverview(b) {
  readerReturn = "books";
  const r = $("#reader");
  r.innerHTML = `<div class="book-line" style="display:flex;gap:14px;margin-top:8px">${coverHTML(b)}
      <div><h1>${esc(b.plan.title)}</h1><div class="muted">${esc(b.plan.author)}</div></div></div>
    <p>${esc(b.plan.overview)}</p>
    <ol class="toc">${b.plan.sections
      .map((s, i) => {
        const status = i < b.done ? "done" : i === b.done ? "" : "locked";
        const label = i < b.done ? "✓" : i + 1;
        const clickable = i <= b.done;
        return `<li class="${status}"><span class="n">${label}</span>
          ${clickable ? `<button data-i="${i}">${esc(s.title)}</button>` : `<span>${esc(s.title)}</span>`}</li>`;
      })
      .join("")}</ol>
    <p class="muted small">One new section unlocks each day you read.</p>`;
  r.querySelectorAll(".toc button").forEach((btn) => btn.addEventListener("click", () => openSection(b, Number(btn.dataset.i), "books")));
  show("reader");
}

async function openSection(b, index, from) {
  readerReturn = from;
  show("reader");
  const r = $("#reader");
  const s = b.plan.sections[index];
  r.innerHTML = `<div class="muted small">${esc(b.plan.title)} · Section ${index + 1} of ${b.plan.sections.length}</div>
    <h1>${esc(s.title)}</h1><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton" style="width:80%"></div>
    <p class="muted small">Writing your summary…</p>`;
  const key = `${b.id}#${index}`;
  let sec = state.sections[key];
  try {
    if (!sec) {
      sec = await api("/api/books/section", { title: b.title, author: b.author, index });
      state.sections[key] = sec;
      save();
    }
  } catch (err) {
    r.innerHTML = `<h1>${esc(s.title)}</h1><p class="form-msg error">${esc(err.message)}</p>
      <button class="btn" id="retry">Try again</button>`;
    $("#retry").onclick = () => openSection(b, index, from);
    return;
  }
  const isNext = index === b.done;
  const minutes = Math.max(1, Math.round(sec.summary.split(/\s+/).length / 220));
  r.innerHTML = `<div class="muted small">${esc(b.plan.title)} · Section ${index + 1} of ${b.plan.sections.length} · ${minutes} min read</div>
    <h1>${esc(sec.title || s.title)}</h1>
    <div class="body">${sec.summary.split(/\n\s*\n/).map((p) => `<p>${esc(p.trim())}</p>`).join("")}</div>
    <div class="takeaways"><h3>Key takeaways</h3><ul>${sec.keyTakeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
    <div class="reflect"><h3>Think about it today</h3><p>${esc(sec.reflection)}</p></div>
    <p class="muted small">AI-generated summary for personal reading. Support the author by reading the full book.</p>
    <div class="row">${isNext ? '<button class="btn primary" id="done-btn">Mark as read ✓</button>' : '<button class="btn" id="back2">Back</button>'}</div>`;
  $("#back2")?.addEventListener("click", () => show(from));
  $("#done-btn")?.addEventListener("click", () => {
    markRead(b);
    show("today");
  });
}

function markRead(b) {
  b.done = Math.min(b.done + 1, b.plan.sections.length);
  b.lastReadDate = todayStr();
  const t = todayStr();
  if (state.lastStreakDate !== t) {
    state.streak = state.lastStreakDate === yesterdayStr() ? state.streak + 1 : 1;
    state.lastStreakDate = t;
  }
  save();
}

// ---------- boot ----------
$("#today-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
renderToday();
initNews();
