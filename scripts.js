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

    // BTC valuation
    const btcValuation = btcHoldings * btcPrice;
    const btcValuationElement = document.getElementById("btc-valuation");
    if (btcValuationElement) {
      btcValuationElement.textContent = `$${btcValuation.toLocaleString()}`;
    }

    // Shares
    const shareRes = await fetch("shares.json");
    const shareData = await shareRes.json();
    const totalShares = shareData.totalShares;
    const totalSharesElement = document.getElementById("total-shares");
    if (totalSharesElement) {
      totalSharesElement.textContent = totalShares;
    }

    // Share price (BTC basis)
    const sharePrice = btcHoldings / totalShares;
    const sharePriceElement = document.getElementById("share-price");
    if (sharePriceElement) {
      sharePriceElement.textContent = sharePrice.toFixed(8) + " BTC";
    }

    const sharesValuation = sharePrice * totalShares;
    const sharesValuationElement = document.getElementById("shares-valuation");
    if (sharesValuationElement) {
      sharesValuationElement.textContent = sharesValuation.toFixed(4) + " BTC";
    }
    const sharesDetailElement = document.getElementById("shares-detail");
    if (sharesDetailElement) {
      sharesDetailElement.textContent = JSON.stringify(shareData, null, 2);
    }

    // Total valuation
    const totalValuationElement = document.getElementById("total-valuation");
    if (totalValuationElement) {
      totalValuationElement.textContent = (btcHoldings).toFixed(4) + " BTC";
    }
  } catch (err) {
    console.error("Error loading metrics:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector("main.metrics")) {
    // Load html2canvas dynamically
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.onload = loadMetrics;
    document.body.appendChild(script);
  } else if (document.querySelector("main.home")) {
    loadMetrics();
  }
});
