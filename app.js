/**
 * Ducky's AMPACT Selector - Core Logic v2.0.10
 */
let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt;

const colorThemes = {
    'blue': { body: '#2563eb', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800', footer: 'text-white' },
    'yellow': { body: '#facc15', bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-600', footer: 'text-gray-800' },
    'white': { body: '#ffffff', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300', footer: 'text-gray-400' },
    'red': { body: '#dc2626', bg: 'bg-red-600', text: 'text-white', border: 'border-red-800', footer: 'text-white' },
    'copper': { body: '#b87333', bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#7d4e22]', footer: 'text-white' },
    'default': { body: '#f3f4f6', bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-white', footer: 'text-gray-400' }
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

function setupEventListeners() {
    const tapSearch = document.getElementById('tap-search');
    const stirrupSearch = document.getElementById('stirrup-search');
    const tapSelect = document.getElementById('tap-select');
    const stirrupSelect = document.getElementById('stirrup-select');
    const installBtn = document.getElementById('install-button');

    tapSearch.addEventListener('input', (e) => {
        updateDropdown('tap', e.target.value);
    });

    stirrupSearch.addEventListener('input', (e) => {
        updateDropdown('stirrup', e.target.value);
    });

    tapSelect.addEventListener('change', (e) => { tapSelection = e.target.value; calculate(); });
    stirrupSelect.addEventListener('change', (e) => { stirrupSelection = e.target.value; calculate(); });

    document.getElementById('reset-button').addEventListener('click', resetAll);

    // Install logic
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            installBtn.style.display = 'none';
        }
    });
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

    if (previousSelection && Array.from(select.options).some(o => o.value === previousSelection)) {
        select.value = previousSelection;
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
        if (lowerVal.includes('blue')) key = 'blue';
        else if (lowerVal.includes('yellow')) key = 'yellow';
        else if (lowerVal.includes('white')) key = 'white';
        else if (lowerVal.includes('red')) key = 'red';
        else if (lowerVal.includes('copper')) key = 'copper';
        
        // Return original casing for the display text
        displayResult(valStr, key);
    } else {
        displayResult('No Match', 'default');
    }
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key];
    
    body.style.backgroundColor = theme.body;
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
    const installBtn = document.getElementById('install-button');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI notify the user they can install the PWA
        if (installBtn) installBtn.style.display = 'block';
    });

    window.addEventListener('appinstalled', (event) => {
        console.log('App was installed');
        deferredPrompt = null;
        if (installBtn) installBtn.style.display = 'none';
    });

    if (isIos) {
        const iosInstr = document.getElementById('ios-install-instructions');
        if (iosInstr) iosInstr.classList.remove('hidden');
    }
}
