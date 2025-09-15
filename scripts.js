// Light/Dark mode toggle
const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
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
    document.getElementById("btc-price").textContent = `$${btcPrice.toLocaleString()}`;

    // Fetch BTC balance  //keeping this temporarily but detail section could show  abreakdown of the share types nad the corresponding btc purchased by them
    const addr = "bc1qpc22mhahknxt5t6samalxsf4mq5wvarar7823g";
    const btcRes = await fetch(`https://mempool.space/api/address/${addr}`);
    const btcData = await btcRes.json();
    const sats = btcData.chain_stats.funded_txo_sum - btcData.chain_stats.spent_txo_sum;
    const btcHoldings = sats / 1e8;
    document.getElementById("btc-holdings").textContent = btcHoldings.toFixed(4) + " BTC";
    document.getElementById("btc-detail").textContent = JSON.stringify(btcData, null, 2);

    // BTC valuation
    const btcValuation = btcHoldings * btcPrice;
    document.getElementById("btc-valuation").textContent = `$${btcValuation.toLocaleString()}`;

    // Shares
    const shareRes = await fetch("shares.json");
    const shareData = await shareRes.json();
    const totalShares = shareData.totalShares;
    document.getElementById("total-shares").textContent = totalShares;

    // Share price (BTC basis)
    const sharePrice = btcHoldings / totalShares;
    document.getElementById("share-price").textContent = sharePrice.toFixed(8) + " BTC";

    const sharesValuation = sharePrice * totalShares;
    document.getElementById("shares-valuation").textContent = sharesValuation.toFixed(4) + " BTC";
    document.getElementById("shares-detail").textContent = JSON.stringify(shareData, null, 2);

    // Total valuation
    document.getElementById("total-valuation").textContent = (btcHoldings).toFixed(4) + " BTC";
  } catch (err) {
    console.error("Error loading metrics:", err);
  }
}

if (document.querySelector("main.metrics")) {
  // Load html2canvas dynamically
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  script.onload = loadMetrics;
  document.body.appendChild(script);
}