'use strict';

(() => {
  // --- State (kept out of global scope) ---
  let req = null;
  let start = 0;
  let count = 1;
  let sum = 0;
  let decimals = 0;
  let blink = false;
  let selectedSize = 0;
  let blinkTimer = null;
  let prevLoaded = 0;
  let lastChunk = 0;
  let totalBytes = 0;
  let cancel = false;
  const PLOTTING_MAX = 200;

  // --- Cached DOM references (avoid repeated queries) ---
  const progressEl = document.querySelector('progress');
  const resultEl = document.getElementById('result');
  const etaEl = document.getElementById('eta');
  const btnxEl = document.getElementById('btnx');
  const handleEl = document.getElementById('handle');
  const dlBoxEl = document.getElementById('download-box');
  const dlStatsEl = document.getElementById('dl-stats');
  const ulStatsEl = document.getElementById('ul-stats');
  const dlChartEl = document.getElementById('dl-chart');
  const latencyBoxEl = document.getElementById('latency-box');
  const uploadBoxEl = document.getElementById('upload-box');
  const latencyEl = document.getElementById('latency');
  const averageEl = document.getElementById('average');
  const l2El = document.getElementById('l2');
  const l3El = document.getElementById('l3');
  const l4El = document.getElementById('l4');
  const l5El = document.getElementById('l5');

  const buttons = Array.from(document.querySelectorAll('button'));

  // --- Small safe helpers (OWASP: output encoding, robustness) ---
  function setText(el, value) {
    if (!el) return;
    el.textContent = String(value);
  }

  function setStaticHTML(el, value) {
    // Only use for static, non–user-controlled content
    if (!el) return;
    el.innerHTML = value;
  }

  function dec(num, deci) {
    let amount;
    let result;
    let missing;
    let i;

    if (deci) {
      amount = Math.pow(10, deci || 1);
      result = Math.round(num * amount) / amount;
    } else {
      result = Math.round(num);
    }

    result = String(result);
    if (!deci) return result;

    if (!result.includes('.')) {
      missing = deci;
      result += '.';
    } else {
      missing = deci - result.split('.')[1].length;
    }

    for (i = missing; i > 0; i--) {
      result += '0';
    }
    return result;
  }

  function clearBlink() {
    if (blinkTimer) {
      clearInterval(blinkTimer);
      blinkTimer = null;
    }
    blink = false;
    if (l5El) l5El.style.visibility = 'visible';
  }

  // --- Test completion (OWASP: error handling, no info leakage) ---
  function testDone() {
    if (!req || req.readyState !== 4) return;

    const diff = (Date.now() - start) / 1000;

    latencyCheck().catch(() => {
      // Intentionally swallow to avoid leaking network details
    });

    if (progressEl) {
      progressEl.style.visibility = 'hidden';
      progressEl.value = 0;
    }
    if (resultEl) resultEl.className = 'resultDone';
    setText(etaEl, `${dec(diff, 2)} sec`);
    if (btnxEl) btnxEl.style.display = 'none';
    if (handleEl) handleEl.style.visibility = 'hidden';
    if (dlBoxEl) dlBoxEl.className = 'dl-result-2';

    selectedSize = 0;
    prevLoaded = 0;
    totalBytes = 0;
    lastChunk = 0;

    if (blink) clearBlink();
  }

  // --- Progress handler (OWASP: safe logging, no user data in HTML) ---
  function testRunning(ev) {
    const now = Date.now();

    let percent = 0;
    let Bps = 0;
    let eta = 0;

    if (ev.lengthComputable && ev.total > 0) {
      lastChunk = ev.loaded - prevLoaded;
      Bps = ev.loaded / ((now - start) / 1000 || 1);
      totalBytes += lastChunk;

      percent = (ev.loaded / ev.total) * 100;
      eta = (ev.total - ev.loaded) / (Bps || 1);
      prevLoaded = ev.loaded;

      if (dlStatsEl) {
        dlStatsEl.textContent +=
          `${count}: Processing ${Math.round(lastChunk)} bytes\t` +
          ` at ${dec(Bps / 1024 / 1024, 2)} MBps\t` +
          ` Total Download: ${totalBytes} (${Math.floor(totalBytes / 1024 / 1024)}MB)\n`;
      }

      count++;
    }

    if (btnxEl) btnxEl.style.display = 'block';
    if (handleEl) handleEl.style.visibility = 'visible';
    if (dlBoxEl) dlBoxEl.className = 'dl-result-1';

    if (progressEl) {
      progressEl.value = percent;
      progressEl.style.visibility = 'visible';
    }

    const mbps = Number(dec(Bps / 1024 / 1024, 2));
    if (count < PLOTTING_MAX) {
      handleDownloadChart(mbps);
    }
    handleGaugeHandler(mbps);

    setStaticHTML(
      resultEl,
      '<span style="color:#999;">⇓</span>&nbsp;' + dec(Bps / 1024 / 1024, 2) + ' MBps'
    );
    setText(etaEl, `${dec(eta, decimals)} sec`);
  }

  function resolveSelectedSize(file) {
    switch (file) {
      case '5Mb.bin': return 5;
      case '10Mb.bin': return 10;
      case '25Mb.bin': return 25;
      case '100Mb.bin': return 100;
      case '1Gb.bin': return 1000;
      default: return 0;
    }
  }

  // --- Start test (OWASP: input validation, safe URL building) ---
  function testDownload(ev) {
    const target = ev.currentTarget;
    if (!(target instanceof HTMLButtonElement)) return;

    const file = target.dataset.file || '';

    if (req) {
      try {
        req.abort();
      } catch {
        // ignore abort errors
      }
    }

    req = new XMLHttpRequest();

    if (dlChartEl) dlChartEl.innerHTML = '';
    if (latencyBoxEl) latencyBoxEl.style.display = 'none';
    if (uploadBoxEl) uploadBoxEl.style.display = 'none';
    if (handleEl) handleEl.style.visibility = 'visible';
    if (dlBoxEl) dlBoxEl.className = 'dl-result-1';
    setText(resultEl, 'Speedtest');
    setText(etaEl, 'choose a size');
    handleGaugeHandler(0);
    prevLoaded = 0;
    if (dlStatsEl) dlStatsEl.textContent = '';
    if (ulStatsEl) ulStatsEl.textContent = '';

    if (!file) {
      cancel = true;
      return;
    }

    start = Date.now();
    count = 0;
    sum = 0;
    cancel = false;

    buttons.forEach(btn => {
      btn.className = '';
    });
    target.className = 'choice';

    if (progressEl) {
      progressEl.value = 0;
      progressEl.style.visibility = 'visible';
    }

    req.onprogress = testRunning;
    req.onreadystatechange = testDone;

    const url = `${file}?${encodeURIComponent(String(start))}`;
    req.open('GET', url, true);

    selectedSize = resolveSelectedSize(file);
    req.send(null);
  }

  // --- Chart (purely visual) ---
  const handleDownloadChart = val => {
    if (!dlChartEl || Number.isNaN(val) || val <= 0) return;

    const div = document.createElement('div');
    div.style.backgroundColor = '#00ff9a';
    div.style.borderTop = '1px solid blue';
    div.style.display = 'inline-block';

    switch (selectedSize) {
      case 25:
        if (val > 0) div.style.width = '1.00px';
        if (val > 100) div.style.width = '6.00px';
        if (val > 280) div.style.width = '7.35px';
        if (val > 500) div.style.width = '8.50px';
        if (val > 750) div.style.width = '9.00px';
        if (val > 1000) div.style.width = '10.0px';
        break;
      case 100:
        if (val > 0) div.style.width = '0.50px';
        if (val > 100) div.style.width = '3.00px';
        if (val > 280) div.style.width = '4.70px';
        if (val > 500) div.style.width = '6.50px';
        if (val > 750) div.style.width = '7.00px';
        if (val > 1000) div.style.width = '9.60px';
        break;
      case 1000:
        if (val > 0) div.style.width = '0.05px';
        if (val > 100) div.style.width = '0.30px';
        if (val > 280) div.style.width = '0.45px';
        if (val > 500) div.style.width = '0.50px';
        if (val > 750) div.style.width = '0.60px';
        if (val > 1000) div.style.width = '0.70px';
        break;
      default:
        break;
    }

    const adjustHeight = 3;
    const h = Math.log(val) * Math.log(val) + (val < 25 ? adjustHeight : 0);
    div.style.height = `${Math.max(0, h)}px`;
    dlChartEl.appendChild(div);
  };

  // --- Gauge (visual only) ---
  const handleGaugeHandler = val => {
    if (!handleEl) return;

    const arc = 270;
    let max = 1000;

    if (val > max) {
      if (!blink && l5El) {
        const blinkSpeed = 100;
        blinkTimer = setInterval(() => {
          if (!l5El) return;
          l5El.style.visibility =
            l5El.style.visibility === 'hidden' ? '' : 'hidden';
        }, blinkSpeed);
        blink = true;
      }
      val = max;
    } else {
      clearBlink();
    }

    if (val < 25) {
      max = 25;
      setText(l2El, '6');
      setText(l3El, '13');
      setText(l4El, '19');
      setText(l5El, '25MB');
    } else if (val < 50) {
      max = 50;
      setText(l2El, '12');
      setText(l3El, '25');
      setText(l4El, '37');
      setText(l5El, '50MB');
    } else if (val < 100) {
      max = 100;
      setText(l2El, '25');
      setText(l3El, '50');
      setText(l4El, '75');
      setText(l5El, '100MB');
    } else {
      max = 1000;
      setText(l2El, '250');
      setText(l3El, '500');
      setText(l4El, '750');
      setText(l5El, '1GB');
    }

    handleEl.style.transform = `rotate(${(arc * val) / max}deg)`;
  };

  // --- Latency check (OWASP: secure transport, limited error info) ---
  async function latencyCheck() {
    const startDate = new Date();
    const url = '/coast-express/images/icons/icon.png';

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (response.ok) {
        const endDate = new Date();
        const latency = (endDate.getTime() - startDate.getTime()) / 1000;
        setText(latencyEl, `${latency} s`);
        if (latencyBoxEl) latencyBoxEl.style.display = 'block';
      }
    } catch {
      // Do not expose network errors to UI
    }
  }

  // --- Upload test (OWASP: resource usage, error handling) ---
  function checkUploadSpeed(iterations) {
    let xhr;
    if (window.XMLHttpRequest) {
      xhr = new XMLHttpRequest();
    } else {
      // Legacy branch guarded
      try {
        // eslint-disable-next-line no-undef
        xhr = new ActiveXObject('Microsoft.XMLHTTP');
      } catch {
        return;
      }
    }

    let average = 0;
    let localCount = 0;
    const timer = window.setInterval(check, 100);
    check();

    function check() {
      if (!xhr) return;

      const cacheBuster = encodeURIComponent(
        String(Math.floor(Math.random() * 10000))
      );
      const url = `/hoanglam.tran/coast-express/?cache=${cacheBuster}`;
      const data = getRandomString(1);
      let startTime;
      let speed = 0;

      xhr.onload = function () {
        const diffMs = new Date() - startTime;
        const seconds = diffMs / 1000 || 1;
        speed = Math.round(1024 / seconds);
        average = average === 0 ? speed : Math.round((average + speed) / 2);

        setText(averageEl, `${Math.round(average / 1000)} MBps`);

        localCount++;
        if (ulStatsEl) {
          ulStatsEl.textContent += `${localCount}: ${Math.round(
            speed / 1000
          )} MBps\n`;
        }

        if (localCount === iterations && !cancel) {
          window.clearInterval(timer);
          if (uploadBoxEl) uploadBoxEl.style.display = 'block';
        }
      };

      xhr.onerror = function () {
        // Avoid leaking error details
      };

      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
      startTime = new Date();
      xhr.send(data);
    }

    function getRandomString(size) {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~!@#$%^&*()_+`-=[]\\{}|;':,./<>?";
      const iterations = size * 1024 * 1024;
      let result = '';
      for (let i = 0; i < iterations; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }
  }

  // --- Event wiring (OWASP: no inline JS, explicit listeners) ---
  buttons.forEach(btn => {
    btn.addEventListener('click', testDownload, { passive: true });
  });

  // Explicitly exported API (minimal global surface)
  window.checkUploadSpeed = checkUploadSpeed;
})();
