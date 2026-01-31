/**
 * Ducky's AMPACT Selector - Core Logic v2.0.8
 */

let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt;

// Professional Color Themes mapped to Tailwind/Hex for Body and Result Box
const colorThemes = {
    'blue': { body: '#2563eb', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800' },
    'yellow': { body: '#facc15', bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-600' },
    'white': { body: '#ffffff', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300' },
    'red': { body: '#dc2626', bg: 'bg-red-600', text: 'text-white', border: 'border-red-800' },
    'copper': { body: '#b87333', bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#7d4e22]' },
    'default': { body: '#f3f4f6', bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-white' }
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
        displayResult('Ready', 'default');
    } catch (e) {
        displayResult('Error', 'default');
    }
}

async function checkKillSwitch() {
    try {
        const res = await fetch(`kill-switch.json?t=${Date.now()}`, { cache: 'no-store' });
        const cfg = await res.json();
        if (cfg.disablePWA) {
            document.getElementById('kill-switch-overlay')?.classList.remove('hidden');
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

    tapSearch.addEventListener('input', (e) => {
        updateDropdown('tap', e.target.value);
        handleSearchAnimation(tapSelect);
    });

    stirrupSearch.addEventListener('input', (e) => {
        updateDropdown('stirrup', e.target.value);
        handleSearchAnimation(stirrupSelect);
    });

    tapSelect.addEventListener('change', (e) => { tapSelection = e.target.value; calculate(); });
    stirrupSelect.addEventListener('change', (e) => { stirrupSelection = e.target.value; calculate(); });

    document.getElementById('reset-button').addEventListener('click', resetAll);
}

function handleSearchAnimation(element) {
    element.classList.add('filtering');
    setTimeout(() => element.classList.remove('filtering'), 400);
}

function updateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    if (!spreadsheetData.length) return;

    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const previousSelection = select.value;

    select.innerHTML = '';
    
    const filteredResults = spreadsheetData.filter(row => 
        String(row[conductorKey] || "").toLowerCase().includes(query.toLowerCase())
    );

    if (filteredResults.length === 0) {
        select.innerHTML = '<option value="">No matches found</option>';
    } else {
        if (!query) {
            const promptOpt = document.createElement('option');
            promptOpt.value = "";
            promptOpt.textContent = "Select Conductor...";
            select.appendChild(promptOpt);
        }
        filteredResults.forEach(row => {
            const name = row[conductorKey];
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
    }

    if (previousSelection && Array.from(select.options).some(o => o.value === previousSelection)) {
        select.value = previousSelection;
    } else {
        if (type === 'tap') tapSelection = '';
        else stirrupSelection = '';
        calculate();
    }
}

function calculate() {
    if (!tapSelection || !stirrupSelection) {
        displayResult('Ready', 'default');
        return;
    }

    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const row = spreadsheetData.find(r => r[conductorKey] === tapSelection);
    const rawVal = row ? row[stirrupSelection] : null;

    if (rawVal && String(rawVal).trim() !== "") {
        const valStr = String(rawVal);
        const lowerVal = valStr.toLowerCase();
        let key = 'default';
        
        // Determine Color Key
        if (lowerVal.includes('blue')) key = 'blue';
        else if (lowerVal.includes('yellow')) key = 'yellow';
        else if (lowerVal.includes('white')) key = 'white';
        else if (lowerVal.includes('red')) key = 'red';
        else if (lowerVal.includes('copper')) key = 'copper';
        
        // STRIP COLOR NAMES FROM DISPLAY: Remove Blue, Yellow, etc. from the string
        const cleanVal = valStr.replace(/\b(Blue|Yellow|White|Red|Copper)\b/gi, '').trim();
        
        displayResult(cleanVal, key);
    } else {
        displayResult('No Match', 'default');
    }
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key];

    // Change Main Body Background
    body.style.backgroundColor = theme.body;

    // Style Result Box
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    output.className = `text-3xl font-black uppercase tracking-widest ${theme.text}`;
    output.textContent = text;
}

function resetAll() {
    tapSelection = ''; stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
    updateDropdown('tap', '');
    updateDropdown('stirrup', '');
    displayResult('Ready', 'default');
}

function handlePWAInstallUI() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('install-button');
        if (btn) btn.style.display = 'block';
    });
    if (isIos) {
        const iosInstr = document.getElementById('ios-install-instructions');
        if (iosInstr) iosInstr.style.display = 'block';
    }
}
