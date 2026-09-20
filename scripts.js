/* scripts.js — Urban Environmental Ltd website
   Full version with multi-currency support, Google Sheets, theme toggle, tabs, etc.
   Order: constants → currency helpers → utility functions → init functions → data loaders → DOMContentLoaded
*/

// ────────────────────────────────────────────────
//  CONFIG & CONSTANTS
// ────────────────────────────────────────────────

const apiKey = "AIzaSyDig1pzwMpM923E4tDyKN_KMcBqfz9lfH8";
const sheetId = "1xIoXT6tGCO55drQC8BCBVfd4xCiG301CtLK62y8vA58";
const sheetRange = "Metrics!A2:B150";
const sheetFetchTimeoutMs = 8000;

// ────────────────────────────────────────────────
//  CURRENCY SUPPORT
// ────────────────────────────────────────────────

let currentCurrency = 'USD';
let exchangeRates = { USD: 1 };
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
  'mstrcomp-share-price',
  // Add any other IDs that display dollar amounts here
];

// ────────────────────────────────────────────────
//  AUTO-DETECT PREFERRED CURRENCY FROM TIMEZONE
// ────────────────────────────────────────────────

function detectLikelyCurrency() {
  // Default fallback
  let currency = 'USD';

  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log("Detected timezone:", tz);

      // Very common mappings (expand as needed)
      const tzToCurrency = {
        'Europe/London': 'GBP',
        'Europe/Paris': 'EUR',
        'Europe/Berlin': 'EUR',
        'Europe/Rome': 'EUR',
        'Asia/Tokyo': 'JPY',
        'Asia/Shanghai': 'CNY',
        'Asia/Hong_Kong': 'HKD',
        'Australia/Sydney': 'AUD',
        'Australia/Melbourne': 'AUD',
        'Pacific/Auckland': 'NZD',
        'America/New_York': 'USD',
        'America/Los_Angeles': 'USD',
        'America/Toronto': 'CAD',
        'Europe/Zurich': 'CHF',
        'Asia/Singapore': 'SGD',
        'Asia/Seoul': 'KRW',
        'Europe/Stockholm': 'SEK',
        'Europe/Oslo': 'NOK',
        'Asia/Jakarta': 'IDR', // example – add more if relevant
      };

      if (tzToCurrency[tz]) {
        currency = tzToCurrency[tz];
      } else if (tz.startsWith('Europe/')) {
        currency = 'EUR'; // most of Western/Central Europe
      } else if (tz.startsWith('America/')) {
        currency = 'USD'; // most common in Americas
      }
    } catch (e) {
      console.warn("Timezone detection failed", e);
    }
  }

  // Optional fallback: browser language
  if (currency === 'USD' && navigator.language) {
    const lang = navigator.language.toUpperCase();
    if (lang.includes('EN-AU') || lang.includes('EN-NZ')) currency = 'AUD'; // rough
    if (lang.includes('FR')) currency = 'EUR';
    if (lang.includes('DE')) currency = 'EUR';
    if (lang.includes('JA')) currency = 'JPY';
  }

  console.log("Auto-detected preferred currency:", currency);
  return currency;
}



async function fetchExchangeRates() {
  try {
    console.log("Fetching exchange rates...");
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('Rates fetch failed');
    const data = await res.json();
    if (data.result === 'success' && data.rates) {
      exchangeRates = { USD: 1, ...data.rates };
      console.log(`Loaded ${Object.keys(exchangeRates).length} currencies`);
    }
  } catch (err) {
    console.warn("Exchange rates failed → staying in USD only", err);
  }
}

function formatMoney(amount, code) {
  if (typeof amount !== 'number' || !isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: code === 'JPY' ? 0 : 2,
      maximumFractionDigits: code === 'JPY' ? 0 : 2
    }).format(amount);
  } catch (e) {
    const symbol = getCurrencySymbol(code);
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function getCurrencySymbol(code) {
  const symbols = {
    USD: '$', NZD: 'NZ$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', AUD: 'A$', CAD: 'C$',
    CHF: 'CHF ', INR: '₹', SGD: 'S$', HKD: 'HK$', SEK: 'SEK ', KRW: '₩', NOK: 'NOK ',
    MXN: 'MXN ', TWD: 'NT$', ZAR: 'R ', RUB: '₽', BRL: 'R$', DKK: 'DKK ', PLN: 'zł', TRY: '₺'
  };
  return symbols[code] || code + ' ';
}

function convertAndUpdate(currency = 'USD') {
  currentCurrency = currency;
  const rate = exchangeRates[currency] || 1;
  console.log(`Converting to ${currency} (rate ${rate.toFixed(4)})`);

  let count = 0;
  currencyDependentIds.forEach(id => {
    const usdVal = originalValues[id];
    if (usdVal !== undefined && usdVal !== null) {
      const converted = usdVal * rate;
      updateElementsById(id, formatMoney(converted, currency));
      count++;
    }
  });
  console.log(`Applied conversion to ${count} fields`);
}

// ────────────────────────────────────────────────
//  UTILITY FUNCTIONS
// ────────────────────────────────────────────────

function updateElementsById(id, value) {
  if (!id) return;
  document.querySelectorAll(`[id="${id}"]`).forEach(el => {
    if (el.tagName === "PRE") {
      el.textContent = value;
    } else {
      el.textContent = value;
    }
  });
}

// ────────────────────────────────────────────────
//  DATA FETCHERS
// ────────────────────────────────────────────────

async function fetchSheetMetrics() {
  if (!apiKey || !sheetId) {
    console.warn("Missing Google Sheets config");
    return;
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetRange)}?key=${apiKey}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn("Sheets fetch failed", res.status);
      return;
    }

    const { values } = await res.json();
    if (!values) return;

    originalValues = {}; // reset

    values.forEach(([keyRaw, valRaw]) => {
      if (!keyRaw) return;
      const key = keyRaw.trim();

      // Display raw value from sheet first
      updateElementsById(key, valRaw || "—");

      // Parse number (tolerant to $, commas, spaces, etc.)
      let numStr = (valRaw || "").toString()
        .replace(/[^\d.-]/g, '')
        .replace(/^[-.]+/, '')
        .replace(/[.]+/g, '.')
        .replace(/,$/, '');

      const num = parseFloat(numStr);

      if (!isNaN(num) && isFinite(num) && currencyDependentIds.includes(key)) {
        originalValues[key] = num;
        console.log(`Stored convertible value → ${key}: ${num} (raw: ${valRaw})`);
      }
    });

    console.log("Convertible values stored:", Object.keys(originalValues));
  } catch (err) {
    console.error("fetchSheetMetrics error:", err);
  }
}

async function fetchDataJson() {
  try {
    const res = await fetch("Data.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    // Add handling if you use Data.json for anything
  } catch (err) {
    console.error("fetchDataJson error:", err);
  }
}

// ────────────────────────────────────────────────
//  INIT FUNCTIONS
// ────────────────────────────────────────────────

function initThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
    toggle.textContent = "☀️";
  }

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    toggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  });
}


function initQuoteForm() {
  // Quote form posts to FormSubmit so file attachments can be emailed.
}


// Set after the UE Subscribers Google Form / Apps Script is connected.
const SUBSCRIBE_ENDPOINT = "https://script.google.com/macros/s/AKfycbyH-U4JG8323q3U35yvThAsV5Ghf-_vV4t0tNtb9f9EZmprtgJ2zG8duq8GjJZh7TqzlQ/exec";

function initSubscribeForm() {
  document.querySelectorAll(".subscribe-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const status = form.querySelector(".subscribe-status");
      const data = new FormData(form);
      if (!SUBSCRIBE_ENDPOINT) {
        if (status) {
          status.hidden = false;
          status.textContent = "Subscribe is being connected to the company sheet.";
        }
        return;
      }
      fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: data
      });
      if (status) {
        status.hidden = false;
        status.textContent = "You're on the list.";
      }
      form.reset();
    });
  });
}

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

function initScreenshot() {
  const btn = document.getElementById("screenshot-btn");
  if (!btn || typeof html2canvas !== "function") return;

  btn.addEventListener("click", async () => {
    const canvas = await html2canvas(document.querySelector("main"));
    const link = document.createElement("a");
    link.download = "metrics.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}

// ────────────────────────────────────────────────
//  MAIN DATA LOADER
// ────────────────────────────────────────────────

async function loadAllData() {
  console.log("Starting data load...");

  await Promise.allSettled([
    fetchDataJson(),
    fetchSheetMetrics(),
    fetchExchangeRates()
  ]);

  console.log("Data load complete");

  // Apply saved / default currency
  const saved = localStorage.getItem('selectedCurrency') || 'USD';
  const select = document.getElementById('currencySelect');
  if (select) {
    select.value = saved;
  }
  convertAndUpdate(saved);
}

// ────────────────────────────────────────────────
//  START WHEN PAGE IS READY
// ────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initTabs();
  initQuoteForm();
  initSubscribeForm();
  initScreenshot();

  const currencySelect = document.getElementById('currencySelect');
  if (currencySelect) {
    // First try saved preference (user manually changed it before)
    let initialCurrency = localStorage.getItem('selectedCurrency');

    // If no saved choice → use auto-detection
    if (!initialCurrency) {
      initialCurrency = detectLikelyCurrency();
      localStorage.setItem('selectedCurrency', initialCurrency); // remember it
    }

    currencySelect.value = initialCurrency;
    convertAndUpdate(initialCurrency);

    // Still allow manual change
    currencySelect.addEventListener('change', e => {
      const newCurrency = e.target.value;
      localStorage.setItem('selectedCurrency', newCurrency);
      convertAndUpdate(newCurrency);
    });
  }

  // Home (bitcoin/share cards) and Metrics both need sheet + FX data.
  // Skip the fetch on About / Engineering / Treasury.
  if (currencySelect || document.querySelector("main.metrics") || document.getElementById("btc-pershare")) {
    loadAllData();
  }
});