/**
 * Ducky's AMPACT Selector - Core Logic v2.0.6
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
        if (!response.ok) throw new Error("Network response was not ok");
        
        spreadsheetData = await response.json();
        
        // Initial population of full lists
        updateDropdown('tap', '');
        updateDropdown('stirrup', '');
        
        displayResult('Awaiting Selection', 'default');
    } catch (e) {
        console.error("Data load failed:", e);
        displayResult('Data Error', 'default');
    }
}

async function checkKillSwitch() {
    try {
        const res = await fetch(`kill-switch.json?t=${Date.now()}`, { cache: 'no-store' });
        const cfg = await res.json();
        if (cfg.disablePWA) {
            const overlay = document.getElementById('kill-switch-overlay');
            if (overlay) overlay.classList.remove('hidden');
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

    // REFACTORED: Immediate reactive narrowing
    tapSearch.addEventListener('input', (e) => {
        const query = e.target.value;
        updateDropdown('tap', query);
        handleSearchAnimation(tapSelect);
    });

    stirrupSearch.addEventListener('input', (e) => {
        const query = e.target.value;
        updateDropdown('stirrup', query);
        handleSearchAnimation(stirrupSelect);
    });

    // Handle Selection Changes
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
 * Dynamically rebuilds the select options based on search query.
 * Updated to be more resilient and provide feedback for empty results.
 */
function updateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    if (!spreadsheetData || !spreadsheetData.length) return;

    // The first property of the first object is assumed to be the Conductor Name
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const previousSelection = select.value;

    // Reset list
    select.innerHTML = '';
    
    // Filter logic
    const filteredResults = spreadsheetData.filter(row => {
        const val = String(row[conductorKey] || "");
        return val.toLowerCase().includes(query.toLowerCase());
    });

    if (filteredResults.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "No matches found";
        select.appendChild(opt);
    } else {
        // Add default prompt
        const promptOpt = document.createElement('option');
        promptOpt.value = "";
        promptOpt.textContent = query ? `Matches for "${query}"...` : "Select Conductor...";
        select.appendChild(promptOpt);

        filteredResults.forEach(row => {
            const name = row[conductorKey];
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
    }

    // Smart persistence: If the previously selected value is still in the new list, keep it selected
    if (previousSelection) {
        const exists = Array.from(select.options).some(o => o.value === previousSelection);
        if (exists) {
            select.value = previousSelection;
        } else {
            // If it disappeared from the filtered list, we must clear the global selection
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
    
    // The result is stored in the column named after the stirrup selection
    const val = row ? row[stirrupSelection] : null;

    if (val && String(val).trim() !== "") {
        const lowerVal = String(val).toLowerCase();
        let key = 'default';
        
        if (lowerVal.includes('blue')) key = 'blue';
        else if (lowerVal.includes('yellow')) key = 'yellow';
        else if (lowerVal.includes('white')) key = 'white';
        else if (lowerVal.includes('red')) key = 'red';
        else if (lowerVal.includes('copper')) key = 'copper';
        
        displayResult(val, key);
    } else {
        displayResult('No Match', 'default');
    }
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const theme = colorThemes[key];

    // Apply Tailwind classes dynamically
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    output.className = `text-2xl font-black uppercase tracking-wider ${theme.text}`;
    output.textContent = text;
}

function resetAll() {
    tapSelection = ''; 
    stirrupSelection = '';
    const tapSearch = document.getElementById('tap-search');
    const stirSearch = document.getElementById('stirrup-search');
    
    if (tapSearch) tapSearch.value = '';
    if (stirSearch) stirSearch.value = '';
    
    updateDropdown('tap', '');
    updateDropdown('stirrup', '');
    displayResult('Awaiting Selection', 'default');
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
