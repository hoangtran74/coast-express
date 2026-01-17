/**
 * Configuration and State Management
 */
const CONFIG = {
    UPLOAD_ITERATIONS: 3,
    UPLOAD_SIZE_MB: 1,
    GAUGE_ARC: 270,
    CHART_MAX_COUNT: 200
};

let state = {
    req: null,
    start: 0,
    count: 0,
    selectedSize: 0,
    blinkInterval: null,
    isBlinking: false,
    cancel: false
};

// Cache DOM elements for performance
const dom = {
    btns: document.querySelectorAll('button'),
    progress: document.querySelector('progress'),
    result: document.querySelector('#result'),
    eta: document.querySelector('#eta'),
    handle: document.getElementById('handle'),
    dlChart: document.getElementById('dl-chart'),
    dlStats: document.getElementById('dl-stats'),
    ulStats: document.getElementById('ul-stats'),
    labels: {
        l2: document.getElementById("l2"),
        l3: document.getElementById("l3"),
        l4: document.getElementById("l4"),
        l5: document.getElementById("l5")
    }
};

// Event Delegation
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') testDownload(e);
});

/** 
 * High-performance rounding 
 */
const dec = (num, deci = 0) => num.toFixed(deci);

/**
 * Modern Latency Check using Fetch
 */
async function latencyCheck() {
    const start = performance.now();
    try {
        await fetch('/coast/images/icons/icon.png', { cache: 'no-store' });
        const latency = (performance.now() - start) / 1000;
        const box = document.getElementById("latency-box");
        document.getElementById("latency").innerHTML = `${dec(latency, 3)} s`;
        box.style.display = 'block';
    } catch (e) { console.error("Latency check failed", e); }
}

/**
 * Async Upload Speed Test
 * Replaces sync XHR and slow string concatenation
 */
async function checkUploadSpeed(iterations) {
    const url = `/coast?cache=${Math.random()}`;
    
    // Efficiently generate random data using Crypto API
    const data = new Uint8Array(CONFIG.UPLOAD_SIZE_MB * 1024 * 1024);
    crypto.getRandomValues(data);
    const blob = new Blob([data]);

    let totalSpeed = 0;

    for (let i = 0; i < iterations; i++) {
        if (state.cancel) break;
        
        const startTime = performance.now();
        try {
            await fetch(url, { method: 'POST', body: blob });
            const duration = (performance.now() - startTime) / 1000;
            const mbps = (CONFIG.UPLOAD_SIZE_MB * 8) / duration;
            
            totalSpeed += mbps;
            dom.ulStats.innerHTML += `${i + 1}: ${dec(mbps, 1)} Mbps\n`;
            document.getElementById('speed').textContent = `Current: ${dec(mbps, 1)} Mbps`;
        } catch (e) { console.error("Upload iter failed", e); }
    }

    document.getElementById("upload-box").style.display = 'block';
    document.getElementById('average').textContent = `${dec(totalSpeed / iterations, 1)} Mbps`;
}

/**
 * Download Test using XHR Progress
 */
function testDownload(ev) {
    const file = ev.target.dataset.file;
    if (!file) { state.cancel = true; return; }

    if (state.req) state.req.abort();
    
    // Reset state
    state = { ...state, start: performance.now(), count: 0, cancel: false, 
              selectedSize: parseInt(file) || 0, req: new XMLHttpRequest() };

    // Reset UI
    dom.dlChart.innerHTML = '';
    dom.dlStats.innerHTML = '';
    dom.ulStats.innerHTML = '';
    dom.progress.style.visibility = 'visible';
    dom.progress.value = 0;
    
    latencyCheck();

    state.req.onprogress = (event) => {
        if (!event.lengthComputable) return;

        const now = performance.now();
        const duration = (now - state.start) / 1000;
        const mbps = (event.loaded * 8) / (1024 * 1024) / duration;
        const percent = (event.loaded / event.total) * 100;
        const eta = (event.total - event.loaded) / (event.loaded / duration);

        state.count++;
        
        // Batch DOM updates
        requestAnimationFrame(() => {
            dom.progress.value = percent;
            dom.result.innerHTML = `⇓ ${dec(mbps, 1)} Mbps`;
            dom.eta.innerHTML = `${dec(eta, 1)} sec`;
            
            if (state.count < CONFIG.CHART_MAX_COUNT) handleDownloadChart(mbps);
            handleGaugeHandler(mbps);
        });
    };

    state.req.onload = () => {
        dom.progress.style.visibility = 'hidden';
        checkUploadSpeed(CONFIG.UPLOAD_ITERATIONS);
    };

    state.req.open('GET', `${file}?t=${state.start}`);
    state.req.send();
}

/**
 * Gauge & UI scaling
 */
function handleGaugeHandler(val) {
    let max = 1000;
    const labels = dom.labels;

    if (val < 25) { max = 25; labels.l2.textContent = "6"; labels.l3.textContent = "13"; labels.l5.textContent = "25Mb"; }
    else if (val < 100) { max = 100; labels.l2.textContent = "25"; labels.l3.textContent = "50"; labels.l5.textContent = "100Mb"; }
    else { max = 1000; labels.l2.textContent = "250"; labels.l3.textContent = "500"; labels.l5.textContent = "1Gb"; }

    dom.handle.style.transform = `rotate(${(CONFIG.GAUGE_ARC * val / max)}deg)`;
    
    // Blinking logic for over-scale
    if (val > 1000 && !state.isBlinking) {
        state.isBlinking = true;
        state.blinkInterval = setInterval(() => {
            labels.l5.style.visibility = (labels.l5.style.visibility === 'hidden' ? '' : 'hidden');
        }, 100);
    } else if (val <= 1000 && state.isBlinking) {
        clearInterval(state.blinkInterval);
        state.isBlinking = false;
        labels.l5.style.visibility = "visible";
    }
}

function handleDownloadChart(val) {
    const div = document.createElement('div');
    div.className = 'chart-bar'; // Move styles to CSS for better performance
    div.style.height = `${(Math.log(val + 1) * 5)}px`; 
    div.style.width = state.selectedSize > 500 ? "1px" : "3px";
    dom.dlChart.appendChild(div);
}
