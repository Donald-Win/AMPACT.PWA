/**
 * Ducky's AMPACT Selector - Core Logic v2.0.12
 * Fixed: Color words removal & Emerald Green button logic
 */
let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt = null;

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
    setupEventListeners();
    await loadData();
    
    if (window.matchMedia('(display-mode: standalone)').matches) {
        const installBtn = document.getElementById('install-button');
        if (installBtn) installBtn.style.display = 'none';
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js').catch(() => {});
        });
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-button');
    if (installBtn) {
        installBtn.style.display = 'block';
    }
});

function setupEventListeners() {
    const tapSearch = document.getElementById('tap-search');
    const stirrupSearch = document.getElementById('stirrup-search');
    const tapSelect = document.getElementById('tap-select');
    const stirrupSelect = document.getElementById('stirrup-select');
    const installBtn = document.getElementById('install-button');

    tapSearch.addEventListener('input', (e) => updateDropdown('tap', e.target.value));
    stirrupSearch.addEventListener('input', (e) => updateDropdown('stirrup', e.target.value));
    tapSelect.addEventListener('change', (e) => { tapSelection = e.target.value; calculate(); });
    stirrupSelect.addEventListener('change', (e) => { stirrupSelection = e.target.value; calculate(); });
    document.getElementById('reset-button').addEventListener('click', resetAll);

    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
            // Fallback for browsers that don't support the automated prompt (like Firefox or some Android skins)
            alert("To install: Tap the 3-dot menu in your browser and select 'Install app' or 'Add to Home Screen'.");
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') installBtn.style.display = 'none';
    });
}

async function loadData() {
    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        spreadsheetData = await response.json();
        updateDropdown('tap', '');
        updateDropdown('stirrup', '');
        displayResult('Ready', 'default');
    } catch (e) {
        displayResult('Error Loading Data', 'default');
    }
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
        
        // 1. Determine Theme based on color word
        let key = 'default';
        if (lowerVal.includes('blue')) key = 'blue';
        else if (lowerVal.includes('yellow')) key = 'yellow';
        else if (lowerVal.includes('white')) key = 'white';
        else if (lowerVal.includes('red')) key = 'red';
        else if (lowerVal.includes('copper')) key = 'copper';
        
        // 2. STRICTOR COLOR REMOVAL: Remove color words from the displayed text
        const cleanVal = valStr.replace(/\b(blue|yellow|white|red|copper)\b/gi, '').trim();
        
        displayResult(cleanVal, key);
    } else {
        displayResult('No Match', 'default');
    }
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const versionDisp = document.getElementById('version-display');
    const githubLink = document.getElementById('github-link');
    const theme = colorThemes[key];
    
    body.style.backgroundColor = theme.body;
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    output.className = `text-3xl font-black uppercase tracking-widest ${theme.text}`;
    output.textContent = text;
    
    if (versionDisp) versionDisp.style.color = theme.footer === 'text-white' ? '#fff' : '';
    if (githubLink) githubLink.style.color = theme.footer === 'text-white' ? '#fff' : '';
}

function resetAll() {
    tapSelection = ''; stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
    updateDropdown('tap', '');
    updateDropdown('stirrup', '');
    displayResult('Ready', 'default');
}
