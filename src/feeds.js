// Curated RSS feeds from established, editorially accountable publishers.
// Headlines link back to the publisher's own site; we never copy article bodies.
// Add or remove sources here — each region falls back to WORLD when it has no list.

export const WORLD = [
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
  { source: "DW", url: "https://rss.dw.com/rdf/rss-en-all" },
];

export const REGIONS = {
  IN: {
    name: "India",
    feeds: [
      { source: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
      { source: "The Indian Express", url: "https://indianexpress.com/feed/" },
      { source: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories" },
      { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml" },
    ],
  },
  US: {
    name: "United States",
    feeds: [
      { source: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
      { source: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
      { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },
      { source: "The Guardian", url: "https://www.theguardian.com/us-news/rss" },
    ],
  },
  GB: {
    name: "United Kingdom",
    feeds: [
      { source: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
      { source: "The Guardian", url: "https://www.theguardian.com/uk-news/rss" },
      { source: "Sky News", url: "https://feeds.skynews.com/feeds/rss/home.xml" },
    ],
  },
  CA: {
    name: "Canada",
    feeds: [
      { source: "CBC News", url: "https://www.cbc.ca/webfeed/rss/rss-topstories" },
      { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },
    ],
  },
  AU: {
    name: "Australia",
    feeds: [
      { source: "ABC News", url: "https://www.abc.net.au/news/feed/51120/rss.xml" },
      { source: "The Guardian", url: "https://www.theguardian.com/australia-news/rss" },
      { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/australia/rss.xml" },
    ],
  },
  SG: {
    name: "Singapore",
    feeds: [
      { source: "CNA", url: "https://www.channelnewsasia.com/rssfeeds/8395986" },
      { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml" },
    ],
  },
  AE: {
    name: "United Arab Emirates",
    feeds: [
      { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml" },
    ],
  },
  DE: {
    name: "Germany",
    feeds: [
      { source: "DW", url: "https://rss.dw.com/rdf/rss-en-all" },
      { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml" },
    ],
  },
  WORLD: { name: "World", feeds: WORLD },
};
