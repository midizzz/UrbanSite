/* scripts.js — merged & fixed
   - Put your Google API key and Sheet ID below.
   - If your sheet tab has a name (e.g. "Metrics"), use "Metrics!A2:B150" for sheetRange.
*/

// ---------- CONFIG ----------
const apiKey = "AIzaSyDig1pzwMpM923E4tDyKN_KMcBqfz9lfH8";       // <-- paste your API key
const sheetId = "1xIoXT6tGCO55drQC8BCBVfd4xCiG301CtLK62y8vA58";           // <-- paste your sheet ID
const sheetRange = "Metrics!A2:B150";           // <-- or "Sheet1!A2:B150" (include tab name)
const sheetFetchTimeoutMs = 8000;               // timeout for sheet fetch (ms)

const mempoolPriceUrl = "https://mempool.space/api/v1/prices";
const mempoolAddrPrefix = "https://mempool.space/api/address/";


// ---------- THEME TOGGLE DARK MODE----------
function initThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return;

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

// ---------- TABS ----------
function initTabs() {
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
}

// ---------- SCREENSHOT (optional html2canvas) ----------
function initScreenshot() {
  const screenshotBtn = document.getElementById("screenshot-btn");
  if (!screenshotBtn) return;

  screenshotBtn.addEventListener("click", async () => {
    if (typeof html2canvas !== "function") {
      alert("html2canvas not loaded. Include html2canvas library to use screenshot.");
      return;
    }
    const element = document.querySelector("main");
    const canvas = await html2canvas(element);
    const link = document.createElement("a");
    link.download = "metrics.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}

// ---------- UTILITY: update elements by id (handles duplicates) ----------
function updateElementsById(id, value) {
  if (!id) return;
  // Use attribute selector to be resilient to special characters:
  const elems = document.querySelectorAll(`[id="${id}"]`);
  if (!elems || elems.length === 0) {
    // silent — but useful when debugging
    console.warn(`No element found with id="${id}"`);
    return;
  }
  elems.forEach(el => {
    // put multiline values into <pre> properly
    if (el.tagName === "PRE") el.textContent = value;
    else el.textContent = value;
  });
}

// ---------- FETCH BTC PRICE + HOLDINGS ----------
async function fetchBtcPriceAndHoldings() {
  try {
    // BTC price (mempool.space)
    const priceRes = await fetch(mempoolPriceUrl, { cache: "no-store" });
    if (!priceRes.ok) throw new Error(`Price fetch failed: ${priceRes.status}`);
    const priceData = await priceRes.json();
    // try multiple possible shapes
    const btcPrice = priceData?.USD ?? priceData?.usd ?? priceData?.USD?.toString?.();
    if (btcPrice != null) {
      const el = document.getElementById("bitcoin-price");
      if (el) {
        const number = Number(btcPrice);
        el.textContent = Number.isFinite(number) ? `$${number.toLocaleString()}` : btcPrice;
      }
    }
//Proof of reserve TBC using this code
    // BTC holdings (address)
  //  const addr = "bc1qpc22mhahknxt5t6samalxsf4mq5wvarar7823g"; // your address
  //  const addrRes = await fetch(`${mempoolAddrPrefix}${addr}`);
  //  if (!addrRes.ok) throw new Error(`Address fetch failed: ${addrRes.status}`);
  //  const addrData = await addrRes.json();

  //  const funded = addrData.chain_stats?.funded_txo_sum ?? 0;
  //  const spent = addrData.chain_stats?.spent_txo_sum ?? 0;
  //  const sats = funded - spent;
  //  const btcHoldings = sats / 1e8;
  //  updateElementsById("btc-holdings", btcHoldings.toFixed(8) + " BTC");
  //  updateElementsById("btc-detail", JSON.stringify(addrData, null, 2));

  } catch (err) {
    console.error("fetchBtcPriceAndHoldings error:", err);
  }
}

// ---------- FETCH DATA JSON (was shares.json I think it is not working, oct 2025 all info is coming from sheets API but this should cache the data to reduce API calls) ----------
async function fetchDataJson() {
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) {
      console.warn("data.json not found or returned non-OK status:", res.status);
      return;
    }
    const data = await res.json();
    const totalData = data?.totalData ?? data?.total_Data ?? null;
    if (totalData != null) updateElementsById("total-data", totalData);
    // you can update more metrics data related fields here if Data.json contains them
    updateElementsById("share-price", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("fetchDataJson error:", err);
  }
}

// ---------- FETCH GOOGLE SHEETS METRICS ----------
async function fetchSheetMetrics() {
  if (!apiKey || !sheetId) {
    console.warn("Google Sheets config missing (apiKey or sheetId). Skipping sheet fetch.");
    return;
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetRange)}?key=${apiKey}`;

  // simple timeout wrapper
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sheetFetchTimeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("Google Sheets responded non-OK:", res.status, text);
      return;
    }
    const data = await res.json();
    if (!data.values || data.values.length === 0) {
      console.warn("Google Sheets returned no values.");
      return;
    }

    // Each row should be [metricId, value]
    data.values.forEach(row => {
      const id = (row[0] || "").toString().trim();
      const value = (row[1] !== undefined) ? row[1].toString() : "";
      if (id) updateElementsById(id, value);
    });

  } catch (err) {
    if (err.name === "AbortError") {
      console.error("Google Sheets fetch timed out.");
    } else {
      console.error("fetchSheetMetrics error:", err);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- MAIN LOADER ----------
async function loadAllData() {
  // run the independent fetches in parallel but don't let one failure stop others
  await Promise.allSettled([
    fetchBtcPriceAndHoldings(),
    fetchDataJson(),
    fetchSheetMetrics()
  ]);
}

// ---------- INIT ON DOM READY ----------
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initTabs();
  initScreenshot();
  // run initial load
  loadAllData();

  // optionally refresh periodically
  // setInterval(loadAllData, 60_000); // uncomment to refresh every 60s
});