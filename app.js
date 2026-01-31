/**
 * Ducky's AMPACT Selector - Core Logic v2.0.16
 * FIXED: Hidden newline characters (\n) in data.json
 */
let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt = null;

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
    setupEventListeners();
    await loadData();
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
    if (installBtn) installBtn.style.display = 'block';
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
            alert("To install: Tap the 3-dot menu and select 'Install app' or 'Add to Home Screen'.");
            return;
        }
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.style.display = 'none';
    });
}

/**
 * CLEAN DATA ON LOAD: 
 * Your JSON has "Butterfly\n(23.20mm)". 
 * We replace all \n with a single space to make it selectable.
 */
async function loadData() {
    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        const rawJson = await response.json();
        
        spreadsheetData = rawJson.map(row => {
            const cleanRow = {};
            for (let key in row) {
                // Replace newlines with spaces and trim
                const cleanKey = key.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                let cleanVal = row[key];
                if (typeof cleanVal === 'string') {
                    cleanVal = cleanVal.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                }
                cleanRow[cleanKey] = cleanVal;
            }
            return cleanRow;
        });

        updateDropdown('tap', '');
        updateDropdown('stirrup', '');
        displayResult('Ready', 'default');
    } catch (e) {
        console.error("Load Error:", e);
        displayResult('Error Data', 'default');
    }
}

function updateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    if (!spreadsheetData.length) return;
    
    // First column is the "Tap" list
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const prev = select.value;
    select.innerHTML = '';
    
    const filtered = spreadsheetData.filter(row => 
        String(row[conductorKey] || "").toLowerCase().includes(query.toLowerCase())
    );
    
    const promptOpt = document.createElement('option');
    promptOpt.value = "";
    promptOpt.textContent = query ? `Matches for "${query}"...` : "Select Conductor...";
    select.appendChild(promptOpt);
    
    filtered.forEach(row => {
        const val = String(row[conductorKey]).trim();
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
    });

    if (prev && Array.from(select.options).some(o => o.value === prev)) select.value = prev;
}

function calculate() {
    if (!tapSelection || !stirrupSelection) {
        displayResult('Ready', 'default');
        return;
    }

    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const row = spreadsheetData.find(r => String(r[conductorKey]).trim() === tapSelection.trim());

    if (!row) {
        displayResult('No Match', 'default');
        return;
    }

    const rawVal = row[stirrupSelection];
    
    if (rawVal && String(rawVal).trim() !== "") {
        const valStr = String(rawVal).trim();
        const lowerVal = valStr.toLowerCase();
        
        let themeKey = 'default';
        if (lowerVal.includes('blue')) themeKey = 'blue';
        else if (lowerVal.includes('yellow')) themeKey = 'yellow';
        else if (lowerVal.includes('white')) themeKey = 'white';
        else if (lowerVal.includes('red')) themeKey = 'red';
        else if (lowerVal.includes('copper')) themeKey = 'copper';
        
        const cleanVal = valStr.replace(/\b(blue|yellow|white|red|copper)\b/gi, '').trim();
        displayResult(cleanVal, themeKey);
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
    
    if (text.length > 12) {
        output.className = `text-xl font-black uppercase tracking-tight ${theme.text}`;
    } else if (text.length > 8) {
        output.className = `text-2xl font-black uppercase tracking-tight ${theme.text}`;
    } else {
        output.className = `text-3xl font-black uppercase tracking-widest ${theme.text}`;
    }
    
    output.textContent = text;
    
    const isDark = (key === 'blue' || key === 'red' || key === 'copper');
    if (versionDisp) versionDisp.style.color = isDark ? '#fff' : '';
    if (githubLink) githubLink.style.color = isDark ? '#fff' : '';
}

function resetAll() {
    tapSelection = ''; stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
    updateDropdown('tap', '');
    updateDropdown('stirrup', '');
    displayResult('Ready', 'default');
}
