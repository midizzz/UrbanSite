/* scripts.js — updated with multi-currency support */

const apiKey = "AIzaSyDig1pzwMpM923E4tDyKN_KMcBqfz9lfH8";
const sheetId = "1xIoXT6tGCO55drQC8BCBVfd4xCiG301CtLK62y8vA58";
const sheetRange = "Metrics!A2:B150";
const sheetFetchTimeoutMs = 8000;

// ---------- CURRENCY SUPPORT ----------
let currentCurrency = 'USD';
let exchangeRates = {};
let originalValues = {};

const currencyDependentIds = [
  'bitcoin-price',
  'share-price',
  'outstanding-marketcap',
  'btc-value',
  'non-btc-value',
  'nav',
  'enterprise-value',
  'btc-value-pershare',
  'cash',
  'debt',
  'mstrcomp-share-price'
  // Add any extra USD IDs from your sheet here if needed
];

async function fetchExchangeRates() {
  try {
    const res = await fetch('https://api.exchangerate.host/latest?base=USD');
    if (!res.ok) throw new Error();
    const data = await res.json();
    exchangeRates = data.rates || {};
    exchangeRates.USD = 1;
  } catch (e) {
    console.error('Exchange rates failed – staying in USD');
    exchangeRates = { USD: 1 };
  }
}

function formatMoney(amount, currencyCode) {
  if (typeof amount !== 'number' || isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  } catch (err) {
    return `${currencyCode} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

function convertAndUpdate(currency) {
  currentCurrency = currency || 'USD';
  const rate = exchangeRates[currentCurrency] !== undefined ? exchangeRates[currentCurrency] : 1;

  currencyDependentIds.forEach(id => {
    const usdVal = originalValues[id];
    if (usdVal !== undefined) {
      const converted = usdVal * rate;
      updateElementsById(id, formatMoney(converted, currentCurrency));
    }
  });
}

// ---------- THEME TOGGLE ----------
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
    themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  });
}

// ---------- TABS ----------
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}

// ---------- SCREENSHOT ----------
function initScreenshot() {
  const btn = document.getElementById("screenshot-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (typeof html2canvas !== "function") {
      alert("html2canvas not loaded");
      return;
    }
    const canvas = await html2canvas(document.querySelector("main"));
    const link = document.createElement("a");
    link.download = "metrics.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}

// ---------- UPDATE ELEMENTS ----------
function updateElementsById(id, value) {
  if (!id) return;
  document.querySelectorAll(`[id="${id}"]`).forEach(el => {
    if (el.tagName === "PRE") el.textContent = value;
    else el.textContent = value;
  });
}

// ---------- FETCH GOOGLE SHEETS (now also saves original USD values) ----------
async function fetchSheetMetrics() {
  if (!apiKey || !sheetId) return;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetRange)}?key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sheetFetchTimeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.values) return;

    data.values.forEach(row => {
      const id = (row[0] || "").toString().trim();
      let value = (row[1] !== undefined) ? row[1].toString() : "";
      if (id) {
        updateElementsById(id, value);

        // Store clean numeric USD value for conversion
        const cleaned = value.replace(/[^0-9.-]+/g, '');
        const num = parseFloat(cleaned);
        if (!isNaN(num) && currencyDependentIds.includes(id)) {
          originalValues[id] = num;
        }
      }
    });
  } catch (err) {
    if (err.name !== "AbortError") console.error("fetchSheetMetrics error:", err);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- OTHER FETCHES (unchanged) ----------
async function fetchDataJson() {
  try {
    const res = await fetch("Data.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    // add any extra Data.json handling here if you use it
  } catch (err) {
    console.error("fetchDataJson error:", err);
  }
}

// ---------- MAIN LOADER ----------
async function loadAllData() {
  await Promise.allSettled([
    fetchDataJson(),
    fetchSheetMetrics(),
    fetchExchangeRates()
  ]);
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initTabs();
  initScreenshot();

  loadAllData().then(() => {
    // Apply saved currency (or default USD)
    const saved = localStorage.getItem('selectedCurrency') || 'USD';
    convertAndUpdate(saved);

    // Hook up the dropdown (only exists on metrics.html)
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
      currencySelect.value = saved;
      currencySelect.addEventListener('change', e => {
        const newCur = e.target.value;
        localStorage.setItem('selectedCurrency', newCur);
        convertAndUpdate(newCur);
      });
    }
  });
});