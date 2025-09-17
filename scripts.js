// Light/Dark mode toggle with persistence
const themeToggle = document.getElementById("theme-toggle");

if (themeToggle) {
  // Check saved theme on load
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
      themeToggle.textContent = "☀️";
      localStorage.setItem("theme", "dark");
    } else {
      themeToggle.textContent = "🌙";
      localStorage.setItem("theme", "light");
    }
  });
}

// Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
tabButtons.forEach(btn =>
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tabs = document.querySelectorAll(".tab-content");
    tabs.forEach(tab => tab.classList.remove("active"));

    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.add("active");
  })
);

// Screenshot
const screenshotBtn = document.getElementById("screenshot-btn");
if (screenshotBtn) {
  screenshotBtn.addEventListener("click", async () => {
    const element = document.querySelector("main");
    const canvas = await html2canvas(element);
    const link = document.createElement("a");
    link.download = "metrics.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}

// Load Metrics
async function loadMetrics() {
  try {
    // Fetch BTC price
    const priceRes = await fetch("https://mempool.space/api/v1/prices");
    const priceData = await priceRes.json();
    const btcPrice = priceData.USD;
    const btcPriceElement = document.getElementById("btc-price");
    if (btcPriceElement) {
      btcPriceElement.textContent = `$${btcPrice.toLocaleString()}`;
    }

    // Fetch BTC balance
    const addr = "bc1qpc22mhahknxt5t6samalxsf4mq5wvarar7823g";
    const btcRes = await fetch(`https://mempool.space/api/address/${addr}`);
    const btcData = await btcRes.json();
    const sats = btcData.chain_stats.funded_txo_sum - btcData.chain_stats.spent_txo_sum;
    const btcHoldings = sats / 1e8;
    const btcHoldingsElement = document.getElementById("btc-holdings");
    if (btcHoldingsElement) {
      btcHoldingsElement.textContent = btcHoldings.toFixed(4) + " BTC";
    }
    const btcDetailElement = document.getElementById("btc-detail");
    if (btcDetailElement) {
      btcDetailElement.textContent = JSON.stringify(btcData, null, 2);
    }

    // Shares
    const shareRes = await fetch("shares.json");
    const shareData = await shareRes.json();
    const totalShares = shareData.totalShares;
    const totalSharesElement = document.getElementById("total-shares");
    if (totalSharesElement) {
      totalSharesElement.textContent = totalShares;
    }

// === CONFIG ===
const apiKey = "YOUR_API_KEY_HERE";   // <-- paste your Google API key
const sheetId = "YOUR_SHEET_ID_HERE"; // <-- paste from your sheet URL
const range = "A2:B100"; // Adjust if you need more rows (col A = metric ID, col B = value)

// === FETCH DATA FROM GOOGLE SHEETS ===
async function loadMetrics() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.values) {
      console.error("No data returned from Google Sheets:", data);
      return;
    }

    // Each row = [id, value]
    data.values.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      } else {
        console.warn(`No element found with id="${id}" in HTML`);
      }
    });

  } catch (err) {
    console.error("Error loading metrics:", err);
  }
}

// Run after DOM loads
document.addEventListener("DOMContentLoaded", loadMetrics);
