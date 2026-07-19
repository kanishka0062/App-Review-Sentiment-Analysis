// ---------- State ----------
const SENT_NAMES = ["Positive", "Negative", "Neutral"];
const SENT_COLORS = { Positive: "#2F9E5B", Negative: "#E2483D", Neutral: "#9CA0AE" };

let selectedCats = new Set(DATA.categories.map((_, i) => i)); // all selected by default

// ---------- Header ----------
document.getElementById("header-sub").textContent =
  `${DATA.reviews.length.toLocaleString()} reviews analyzed across ${DATA.appNames.length.toLocaleString()} apps in ${DATA.categories.length} categories`;

// ---------- Category filter panel ----------
const catList = document.getElementById("catList");
DATA.categories.forEach((cat, idx) => {
  const row = document.createElement("label");
  row.className = "cat-item";
  row.innerHTML = `<input type="checkbox" checked data-idx="${idx}"> ${cat.replaceAll("_", " ")}`;
  catList.appendChild(row);
});

const filterBtn = document.getElementById("filterBtn");
const filterPanel = document.getElementById("filterPanel");
filterBtn.addEventListener("click", () => filterPanel.classList.toggle("open"));
document.addEventListener("click", (e) => {
  if (!filterPanel.contains(e.target) && e.target !== filterBtn && !filterBtn.contains(e.target)) {
    filterPanel.classList.remove("open");
  }
});

catList.addEventListener("change", (e) => {
  const idx = parseInt(e.target.dataset.idx);
  if (e.target.checked) selectedCats.add(idx);
  else selectedCats.delete(idx);
  updateFilterLabel();
  renderAll();
});

document.getElementById("selectAll").addEventListener("click", () => {
  selectedCats = new Set(DATA.categories.map((_, i) => i));
  catList.querySelectorAll("input").forEach(cb => cb.checked = true);
  updateFilterLabel();
  renderAll();
});
document.getElementById("clearAll").addEventListener("click", () => {
  selectedCats = new Set();
  catList.querySelectorAll("input").forEach(cb => cb.checked = false);
  updateFilterLabel();
  renderAll();
});

function updateFilterLabel() {
  const label = document.getElementById("filterLabel");
  if (selectedCats.size === DATA.categories.length) label.textContent = "All Categories";
  else if (selectedCats.size === 0) label.textContent = "None selected";
  else label.textContent = `${selectedCats.size} categories`;
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    // Resize plots when a hidden tab becomes visible (panels stay mounted, never unmounted)
    window.dispatchEvent(new Event("resize"));
  });
});

// ---------- Table sort state ----------
let sortState = { key: "reviewCount", dir: -1 };
document.querySelectorAll("#app-table th").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.dataset.key;
    sortState.dir = (sortState.key === key) ? -sortState.dir : 1;
    sortState.key = key;
    renderTable();
  });
});

// ---------- Core computation ----------
function getFilteredReviews() {
  return DATA.reviews.filter(r => selectedCats.has(r[0]));
}
function getFilteredApps() {
  return DATA.apps.filter(a => selectedCats.has(a.categoryIdx));
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function corrLabel(r) {
  const abs = Math.abs(r);
  const strength = abs >= 0.7 ? "strong" : abs >= 0.4 ? "moderate" : abs >= 0.2 ? "weak" : "very weak / negligible";
  const dir = r >= 0 ? "positive" : "negative";
  return `${strength} ${dir} correlation`;
}

// ---------- Render ----------
function renderAll() {
  const reviews = getFilteredReviews();
  const apps = getFilteredApps();

  // KPIs
  const uniqueApps = new Set(reviews.map(r => r[2])).size;
  document.getElementById("kpi-total-reviews").textContent = reviews.length.toLocaleString();
  document.getElementById("kpi-apps").textContent = uniqueApps.toLocaleString();
  const posCount = reviews.filter(r => r[1] === 0).length;
  document.getElementById("kpi-positive").textContent = reviews.length ? ((posCount / reviews.length) * 100).toFixed(1) + "%" : "–";

  renderDonut(reviews);
  renderCategoryCharts(reviews);
  renderRatingTab(apps);
  renderTable();
}

function renderDonut(reviews) {
  const counts = [0, 0, 0];
  reviews.forEach(r => counts[r[1]]++);
  Plotly.react("chart-donut", [{
    type: "pie", hole: 0.55,
    labels: SENT_NAMES, values: counts,
    marker: { colors: [SENT_COLORS.Positive, SENT_COLORS.Negative, SENT_COLORS.Neutral] },
    textinfo: "label+percent",
    hovertemplate: "%{label}: %{value} reviews (%{percent})<extra></extra>",
  }], {
    margin: { t: 10, b: 10, l: 10, r: 10 },
    showlegend: false,
    font: { family: "Inter, sans-serif", size: 13 },
  }, { responsive: true, displayModeBar: false });
}

function renderCategoryCharts(reviews) {
  const byCat = {};
  reviews.forEach(([catIdx, sent]) => {
    if (!byCat[catIdx]) byCat[catIdx] = [0, 0, 0];
    byCat[catIdx][sent]++;
  });
  let rows = Object.entries(byCat).map(([idx, counts]) => {
    const total = counts[0] + counts[1] + counts[2];
    return {
      cat: DATA.categories[idx].replaceAll("_", " "),
      negPct: total ? (counts[1] / total) * 100 : 0,
      total,
    };
  }).filter(r => r.total >= 10); // avoid tiny-sample noise in the ranking chart

  rows.sort((a, b) => b.negPct - a.negPct);

  const n = rows.length;
  const colors = rows.map((_, i) => {
    if (i < 3) return "#E2483D";
    if (i >= n - 3) return "#2F9E5B";
    return "#C9C2DE";
  });

  Plotly.react("chart-cat-negative", [{
    type: "bar", orientation: "h",
    y: rows.map(r => r.cat).reverse(),
    x: rows.map(r => r.negPct).reverse(),
    marker: { color: colors.reverse() },
    hovertemplate: "%{y}: %{x:.1f}% negative<extra></extra>",
  }], {
    margin: { t: 10, b: 30, l: 170, r: 20 },
    xaxis: { title: "% Negative Reviews", ticksuffix: "%" },
    font: { family: "Inter, sans-serif", size: 11.5 },
  }, { responsive: true, displayModeBar: false });

  const volRows = [...rows].sort((a, b) => b.total - a.total).slice(0, 15);
  Plotly.react("chart-cat-volume", [{
    type: "bar",
    x: volRows.map(r => r.cat),
    y: volRows.map(r => r.total),
    marker: { color: "#5B3FA0" },
    hovertemplate: "%{x}: %{y} reviews<extra></extra>",
  }], {
    margin: { t: 10, b: 110, l: 50, r: 20 },
    yaxis: { title: "Review Count" },
    font: { family: "Inter, sans-serif", size: 11.5 },
  }, { responsive: true, displayModeBar: false });
}

function renderRatingTab(apps) {
  const xs = apps.map(a => a.avgPolarity);
  const ys = apps.map(a => a.rating);
  const r = pearson(xs, ys);
  document.getElementById("corr-r").textContent = "r = " + r.toFixed(2);
  document.getElementById("corr-label").textContent =
    `A ${corrLabel(r)} between average review sentiment polarity and an app's overall star rating, across ${apps.length} apps with 5+ reviews.`;

  Plotly.react("chart-scatter", [{
    type: "scatter", mode: "markers",
    x: xs, y: ys,
    text: apps.map(a => a.name),
    marker: {
      size: apps.map(a => Math.max(6, Math.min(30, Math.sqrt(a.reviewCount) * 3))),
      color: "#5B3FA0", opacity: 0.55,
      line: { color: "#3D2A70", width: 1 },
    },
    hovertemplate: "%{text}<br>Avg polarity: %{x:.2f}<br>Rating: %{y}<extra></extra>",
  }], {
    margin: { t: 10, b: 45, l: 50, r: 20 },
    xaxis: { title: "Average Sentiment Polarity" },
    yaxis: { title: "App Rating" },
    font: { family: "Inter, sans-serif", size: 12 },
  }, { responsive: true, displayModeBar: false });
}

function renderTable() {
  const apps = getFilteredApps().map(a => ({ ...a, categoryName: DATA.categories[a.categoryIdx] }));
  apps.sort((a, b) => {
    const v = a[sortState.key] > b[sortState.key] ? 1 : a[sortState.key] < b[sortState.key] ? -1 : 0;
    return v * sortState.dir;
  });
  const tbody = document.getElementById("app-table-body");
  tbody.innerHTML = apps.slice(0, 50).map(a => `
    <tr>
      <td>${a.name}</td>
      <td>${a.categoryName.replaceAll("_", " ")}</td>
      <td>${a.rating}</td>
      <td>${a.avgPolarity.toFixed(2)}</td>
      <td>${a.reviewCount}</td>
    </tr>
  `).join("");
}

// ---------- Init ----------
updateFilterLabel();
renderAll();
