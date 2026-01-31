/**
 * Ducky's AMPACT Selector - Core Logic v2.0.5
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
        
        // Initial population of full lists
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

    // Reactive Narrowing: Rebuild list while typing
    tapSearch.addEventListener('input', (e) => {
        handleSearchAnimation(tapSelect);
        updateDropdown('tap', e.target.value);
    });

    stirrupSearch.addEventListener('input', (e) => {
        handleSearchAnimation(stirrupSelect);
        updateDropdown('stirrup', e.target.value);
    });

    // Handle Selections
    tapSelect.addEventListener('change', (e) => { 
        tapSelection = e.target.value; 
        calculate(); 
    });

    stirrupSelect.addEventListener('change', (e) => { 
        stirrupSelection = e.target.value; 
        calculate(); 
    });

    document.getElementById('reset-button').addEventListener('click', resetAll);
}

function handleSearchAnimation(element) {
    element.classList.add('filtering');
    setTimeout(() => element.classList.remove('filtering'), 400);
}

/**
 * Dynamically rebuilds the select options based on search query
 */
function updateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    if (!spreadsheetData.length) return;

    // First key in the JSON is always the Cable/Conductor Name
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const previousSelection = select.value;

    // Clear current options
    select.innerHTML = '<option value="">Select Conductor...</option>';
    
    // Filter the original dataset based on the input query
    const filteredResults = spreadsheetData.filter(row => {
        const val = row[conductorKey] || "";
        return val.toLowerCase().includes(query.toLowerCase());
    });

    // Populate with matches
    filteredResults.forEach(row => {
        const name = row[conductorKey];
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });

    // Attempt to restore previous selection if it's still in the filtered view
    if (previousSelection) {
        const exists = Array.from(select.options).some(o => o.value === previousSelection);
        if (exists) {
            select.value = previousSelection;
        } else {
            // Selection was filtered out, update global state
            if (type === 'tap') tapSelection = '';
            else stirrupSelection = '';
            calculate();
        }
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

    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    output.className = `text-2xl font-black uppercase tracking-wider ${theme.text}`;
    output.textContent = text;
}

function resetAll() {
    tapSelection = ''; 
    stirrupSelection = '';
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
