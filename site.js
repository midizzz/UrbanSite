async function loadMetrics() {
  const res = await fetch('data.json', { cache: 'no-store' });
  const data = await res.json();
  const metrics = data.metrics || data;
  const exchangeRates = data.exchange || { USD: 1 };

  const currency = document.getElementById('currencySelect').value;
  const rate = exchangeRates[currency] || 1;

  const tableBody = document.querySelector('#metricsTable tbody');
  tableBody.innerHTML = '';

  const localeMap = {
    USD: 'en-US', EUR: 'de-DE', JPY: 'ja-JP', GBP: 'en-GB', AUD: 'en-AU',
    CAD: 'en-CA', CHF: 'de-CH', CNY: 'zh-CN', HKD: 'zh-HK', NZD: 'en-NZ',
    SEK: 'sv-SE', KRW: 'ko-KR', SGD: 'en-SG', NOK: 'nb-NO', MXN: 'es-MX',
    INR: 'en-IN', RUB: 'ru-RU', ZAR: 'en-ZA', TRY: 'tr-TR', BRL: 'pt-BR',
    DKK: 'da-DK'
  };
  const locale = localeMap[currency] || 'en-US';

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2
  });

  for (const [key, value] of Object.entries(metrics)) {
    const displayValue =
      typeof value === 'number'
        ? formatter.format(value * rate)
        : value;
    const row = document.createElement('tr');
    row.innerHTML = `<td>${key}</td><td>${displayValue}</td>`;
    tableBody.appendChild(row);
  }
}

function detectCurrency() {
  const savedCurrency = localStorage.getItem('preferredCurrency');
  if (savedCurrency) return savedCurrency;

  const region = (Intl.DateTimeFormat().resolvedOptions().locale || '').split('-')[1];
  const regionCurrencyMap = {
    US: 'USD', AU: 'AUD', NZ: 'NZD', GB: 'GBP', CA: 'CAD', EU: 'EUR',
    JP: 'JPY', CN: 'CNY', HK: 'HKD', SE: 'SEK', KR: 'KRW', SG: 'SGD',
    NO: 'NOK', MX: 'MXN', IN: 'INR', RU: 'RUB', ZA: 'ZAR', TR: 'TRY',
    BR: 'BRL', DK: 'DKK'
  };
  const detected = regionCurrencyMap[region] || 'USD';
  localStorage.setItem('preferredCurrency', detected);
  return detected;
}

const select = document.getElementById('currencySelect');
select.value = detectCurrency();
select.addEventListener('change', e => {
  localStorage.setItem('preferredCurrency', e.target.value);
  loadMetrics();
});

loadMetrics();