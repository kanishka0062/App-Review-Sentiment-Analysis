const Papa = require("papaparse");
const fs = require("fs");

const reviewsRaw = fs.readFileSync("playstore_reviews.csv", "utf8");
const appsRaw = fs.readFileSync("playstore_apps.csv", "utf8");

const reviews = Papa.parse(reviewsRaw, { header: true, skipEmptyLines: true }).data;
const apps = Papa.parse(appsRaw, { header: true, skipEmptyLines: true }).data;

console.log("Raw reviews:", reviews.length, "Raw apps:", apps.length);

// Dedupe apps by name (keep first occurrence), build lookup: name -> {category, rating}
const appMeta = {};
for (const row of apps) {
  const name = row["App"];
  if (!name || appMeta[name]) continue;
  appMeta[name] = {
    category: row["Category"] || "UNKNOWN",
    rating: parseFloat(row["Rating"]),
  };
}

// Clean reviews: drop missing review/sentiment, map sentiment to code
const sentCode = { Positive: 0, Negative: 1, Neutral: 2 };
const cleanReviews = [];
for (const row of reviews) {
  const app = row["App"];
  const sentiment = row["Sentiment"];
  const polarity = parseFloat(row["Sentiment_Polarity"]);
  if (!app || !sentiment || !(sentiment in sentCode) || isNaN(polarity)) continue;
  const meta = appMeta[app];
  if (!meta) continue;
  cleanReviews.push({ app, category: meta.category, sentiment, polarity });
}

console.log("Clean joined reviews:", cleanReviews.length);

// Build category index
const categorySet = [...new Set(cleanReviews.map(r => r.category))].sort();
const catIndex = Object.fromEntries(categorySet.map((c, i) => [c, i]));

// Build full app name index (ALL apps appearing in clean reviews, not just 5+)
const allAppNames = [...new Set(cleanReviews.map(r => r.app))].sort();
const appIndex = Object.fromEntries(allAppNames.map((a, i) => [a, i]));

// Compact review records: [categoryIdx, sentimentCode, appIdx]
const reviewRecords = cleanReviews.map(r => [catIndex[r.category], sentCode[r.sentiment], appIndex[r.app]]);

// Per-app aggregates (avg polarity, review count, rating, category)
const appAgg = {};
for (const r of cleanReviews) {
  if (!appAgg[r.app]) {
    appAgg[r.app] = { category: r.category, rating: appMeta[r.app].rating, polaritySum: 0, count: 0 };
  }
  appAgg[r.app].polaritySum += r.polarity;
  appAgg[r.app].count += 1;
}

const appRecords = Object.entries(appAgg)
  .filter(([name, a]) => a.count >= 5 && !isNaN(a.rating))
  .map(([name, a]) => ({
    name,
    categoryIdx: catIndex[a.category],
    rating: Math.round(a.rating * 10) / 10,
    reviewCount: a.count,
    avgPolarity: Math.round((a.polaritySum / a.count) * 1000) / 1000,
  }));

console.log("Apps with 5+ reviews:", appRecords.length);
console.log("Categories:", categorySet.length);

// Sanity check: overall sentiment split
const totals = { 0: 0, 1: 0, 2: 0 };
reviewRecords.forEach(([c, s]) => totals[s]++);
console.log("Overall sentiment counts (Pos/Neg/Neutral):", totals);

const dataset = {
  categories: categorySet,
  appNames: allAppNames,
  reviews: reviewRecords,
  apps: appRecords,
};

fs.writeFileSync("dataset.json", JSON.stringify(dataset));
console.log("Written dataset.json, size (KB):", (fs.statSync("dataset.json").size / 1024).toFixed(1));
