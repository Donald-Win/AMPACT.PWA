/**
 * Ducky's AMPACT Selector - Core Logic v2.0.11
 * Fixed PWA Install Logic
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
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        document.getElementById('install-button').style.display = 'none';
    }
}

// 1. IMPROVED SERVICE WORKER REGISTRATION
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(reg => console.log('SW Registered'))
                .catch(err => console.log('SW Failed', err));
        });
    }
}

// 2. CAPTURING THE INSTALL PROMPT
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Show the install button
    const installBtn = document.getElementById('install-button');
    if (installBtn) {
        installBtn.style.display = 'block';
        console.log('Install prompt is ready');
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

    // 3. UPDATED INSTALL CLICK HANDLER
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
            // Fallback for when the browser doesn't support the prompt or it hasn't fired yet
            alert("To install: Tap the browser menu (3 dots) and select 'Install app' or 'Add to Home Screen'.");
            return;
        }
        // Show the prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install: ${outcome}`);
        // We've used the prompt, and can't use it again
        deferredPrompt = null;
        installBtn.style.display = 'none';
    });
}

// Data loading and UI functions remain the same as previous version...
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
