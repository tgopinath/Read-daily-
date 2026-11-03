# Read Daily

Stay informed and keep reading, a few minutes a day.

- **Daily headlines for your region.** Read Daily guesses your region from your device's time zone and language, and you can change it. Headlines come only from a curated list of established publishers (BBC, The Hindu, NPR, The Guardian, CBC, ABC and others), and every headline links to the publisher's own article.
- **Your favourite books, one section a day.** Add a book by title (with Open Library suggestions). Read Daily splits it into 8–20 daily sections and gives you one engaging summary of about five minutes each day, with key takeaways and a question to think about. A new section unlocks each day you read, and the app tracks your streak.

## Run it

Requires Node.js 20+ and an [Anthropic API key](https://console.anthropic.com/) for the book summaries.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start            # http://localhost:3000
```

Headlines work without the key. Without it, adding a book shows a "not configured" message.

## How it works

| Piece | File |
|---|---|
| Trusted news sources per region | `src/feeds.js` (edit this list to add regions or publishers) |
| Fetching, merging and caching headlines (15 min) | `src/news.js` |
| Book plans and daily summaries via Claude, cached in `data/summaries.json` | `src/summaries.js` |
| API routes and static hosting | `server.js` |
| Mobile-first web app (installable as a PWA) | `public/` |

Each book plan and section is generated once and then cached on the server, so other readers of the same book get it instantly at no extra cost. Your library, progress and streak are stored in your browser's `localStorage`. No account is needed.

### API

- `GET /api/regions`: supported regions
- `GET /api/news?country=IN`: headlines for a region (falls back to World)
- `GET /api/books/search?q=...`: title suggestions from Open Library
- `POST /api/books/plan` `{title, author}`: the daily section plan
- `POST /api/books/section` `{title, author, index}`: one day's summary

## Tests

```bash
npm test
```

## Notes

Summaries are AI-generated and written in the app's own words. They don't reproduce the book's text. They are a companion to the book and don't replace it. If the model doesn't know a book well enough to summarise it accurately, it says so and doesn't make one up.
