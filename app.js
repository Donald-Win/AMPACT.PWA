/**
 * Ducky's AMPACT Selector - Core Logic v2.0.4
 */

let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt;

// Professional Color Themes
const colorThemes = {
    'blue': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800' },
    'yellow': { bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-600' },
    'white': { bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-400' },
    'red': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-800' },
    'copper': { bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#7d4e22]' },
    'default': { bg: 'bg-gray-200', text: 'text-gray-500', border: 'border-gray-300' }
};

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    registerServiceWorker();
    handlePWAInstallUI();
    setupEventListeners();
    await loadData();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch(console.error);
    }
}

async function loadData() {
    if (await checkKillSwitch()) return;
    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        spreadsheetData = await response.json();
        updateDropdown('tap', '');
        updateDropdown('stirrup', '');
        displayResult('Awaiting Selection', 'default');
    } catch (e) {
        displayResult('Data Error', 'default');
    }
}

async function checkKillSwitch() {
    try {
        const res = await fetch(`kill-switch.json?t=${Date.now()}`, { cache: 'no-store' });
        const cfg = await res.json();
        if (cfg.disablePWA) {
            document.getElementById('kill-switch-overlay').classList.remove('hidden');
            return true;
        }
    } catch (e) {}
    return false;
}

function setupEventListeners() {
    const tapSearch = document.getElementById('tap-search');
    const stirrupSearch = document.getElementById('stirrup-search');
    const tapSelect = document.getElementById('tap-select');
    const stirrupSelect = document.getElementById('stirrup-select');

    // Live Filtering with Visual Feedback
    tapSearch.addEventListener('input', (e) => {
        handleSearchAnimation(tapSelect);
        updateDropdown('tap', e.target.value);
    });

    stirrupSearch.addEventListener('input', (e) => {
        handleSearchAnimation(stirrupSelect);
        updateDropdown('stirrup', e.target.value);
    });

    tapSelect.addEventListener('change', (e) => { tapSelection = e.target.value; calculate(); });
    stirrupSelect.addEventListener('change', (e) => { stirrupSelection = e.target.value; calculate(); });

    document.getElementById('reset-button').addEventListener('click', resetAll);
}

function handleSearchAnimation(element) {
    element.classList.add('filtering');
    setTimeout(() => element.classList.remove('filtering'), 500);
}

function updateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const currentVal = select.value;

    select.innerHTML = '<option value="">Select Conductor...</option>';
    
    const filtered = spreadsheetData.filter(row => 
        row[conductorKey].toLowerCase().includes(query.toLowerCase())
    );

    filtered.forEach(row => {
        const opt = document.createElement('option');
        opt.value = row[conductorKey];
        opt.textContent = row[conductorKey];
        select.appendChild(opt);
    });

    // Keep selection if it's still in the filtered list
    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

function calculate() {
    if (!tapSelection || !stirrupSelection) {
        displayResult('Awaiting Selection', 'default');
        return;
    }

    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const row = spreadsheetData.find(r => r[conductorKey] === tapSelection);
    const val = row ? row[stirrupSelection] : null;

    if (val && val.trim() !== "") {
        const color = val.toLowerCase();
        let key = 'default';
        if (color.includes('blue')) key = 'blue';
        else if (color.includes('yellow')) key = 'yellow';
        else if (color.includes('white')) key = 'white';
        else if (color.includes('red')) key = 'red';
        else if (color.includes('copper')) key = 'copper';
        displayResult(val, key);
    } else {
        displayResult('No Match', 'default');
    }
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const theme = colorThemes[key];

    // Reset Box Classes (Clean Tailwind reset)
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    output.className = `text-2xl font-black uppercase tracking-wider ${theme.text}`;
    output.textContent = text;
}

function resetAll() {
    tapSelection = ''; stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
    updateDropdown('tap', '');
    updateDropdown('stirrup', '');
    displayResult('Awaiting Selection', 'default');
}

function handlePWAInstallUI() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('install-button').style.display = 'block';
    });
    if (isIos) document.getElementById('ios-install-instructions').style.display = 'block';
}
