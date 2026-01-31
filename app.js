/**
 * Ducky's AMPACT Selector - Core Logic
 */

let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    registerServiceWorker();
    handlePWAInstallUI();
    setupEventListeners();
    await loadData();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(reg => console.log('SW: Registered', reg.scope))
                .catch(err => console.error('SW: Failed', err));
        });
    }
}

function handlePWAInstallUI() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!isIos && !isStandalone) {
            const btn = document.getElementById('install-button');
            if (btn) btn.style.display = 'block';
        }
    });

    if (isIos && !isStandalone) {
        const iosBox = document.getElementById('ios-install-instructions');
        if (iosBox) iosBox.style.display = 'block';
    }

    window.addEventListener('appinstalled', () => {
        document.getElementById('install-button').style.display = 'none';
        document.getElementById('ios-install-instructions').style.display = 'none';
    });
}

async function loadData() {
    const outputElement = document.getElementById('output');
    
    // Check Kill Switch First
    const isDisabled = await checkClientKillSwitch();
    if (isDisabled) return;

    try {
        // Fetch Data with cache busting to prevent stale loads
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`data.json?t=${Date.now()}`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Data file unreachable (Status ${response.status})`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Conductor data is empty or invalid format.");
        }

        spreadsheetData = data;
        updateDropdowns();
        displayMessage('Select conductors to find AMPACT', 'text-gray-700');

    } catch (error) {
        console.error('Data Load Error:', error);
        let msg = "⚠️ Error loading data.";
        if (error.name === 'AbortError') msg = "⚠️ Loading timed out. Check connection.";
        else if (error.message) msg = `⚠️ ${error.message}`;
        
        displayMessage(msg, 'text-red-700');
        showRetryButton();
    }
}

async function checkClientKillSwitch() {
    try {
        // Cache bust the kill switch
        const response = await fetch(`kill-switch.json?t=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
            const config = await response.json();
            if (config.disablePWA === true) {
                document.getElementById('kill-switch-overlay').classList.remove('hidden');
                return true;
            }
        }
    } catch (e) {
        console.warn('Kill switch check failed, continuing...');
    }
    return false;
}

function setupEventListeners() {
    const tapSelect = document.getElementById('tap-select');
    const stirrupSelect = document.getElementById('stirrup-select');
    const resetBtn = document.getElementById('reset-button');
    const installBtn = document.getElementById('install-button');

    if (tapSelect) tapSelect.addEventListener('change', (e) => {
        tapSelection = e.target.value;
        findResult();
    });

    if (stirrupSelect) stirrupSelect.addEventListener('change', (e) => {
        stirrupSelection = e.target.value;
        findResult();
    });

    if (resetBtn) resetBtn.addEventListener('click', resetSelection);

    if (installBtn) installBtn.addEventListener('click', () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                deferredPrompt = null;
            });
        }
    });
}

function updateDropdowns() {
    const tapSelect = document.getElementById('tap-select');
    const stirrupSelect = document.getElementById('stirrup-select');
    if (!tapSelect || !stirrupSelect || !spreadsheetData.length) return;

    const headers = Object.keys(spreadsheetData[0]);
    const conductorKey = headers[0];

    tapSelect.innerHTML = '<option value="">Select Conductor...</option>';
    stirrupSelect.innerHTML = '<option value="">Select Conductor...</option>';

    spreadsheetData.forEach(row => {
        const conductorName = row[conductorKey];
        if (conductorName && conductorName.trim() !== "") {
            const opt1 = document.createElement('option');
            opt1.value = conductorName;
            opt1.textContent = conductorName;
            tapSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = conductorName;
            opt2.textContent = conductorName;
            stirrupSelect.appendChild(opt2);
        }
    });
}

function findResult() {
    if (!tapSelection || !stirrupSelection) {
        displayMessage('Select both sides to see result', 'text-gray-500');
        return;
    }

    // Use the first key as the conductor identifier
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const row = spreadsheetData.find(r => r[conductorKey] === tapSelection);
    const result = row ? row[stirrupSelection] : null;

    if (result && result.trim() !== "") {
        displayMessage(result, 'text-blue-700');
    } else {
        displayMessage('❌ No AMPACT match found', 'text-red-600');
    }
}

function displayMessage(text, colorClass) {
    const output = document.getElementById('output');
    if (output) {
        output.className = `text-xl font-bold leading-tight ${colorClass}`;
        output.textContent = text;
    }
}

function resetSelection() {
    tapSelection = '';
    stirrupSelection = '';
    const tS = document.getElementById('tap-select');
    const sS = document.getElementById('stirrup-select');
    if (tS) tS.value = '';
    if (sS) sS.value = '';
    displayMessage('Select conductors to find AMPACT', 'text-gray-700');
}

function showRetryButton() {
    const container = document.getElementById('output-container');
    if (container && !document.getElementById('retry-btn')) {
        const btn = document.createElement('button');
        btn.id = 'retry-btn';
        btn.textContent = "Retry Connection";
        btn.className = "mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium";
        btn.onclick = () => location.reload();
        container.appendChild(btn);
    }
}
