/**
 * Ducky's AMPACT Selector - Core Logic v2.0.3
 */

let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt;

// Color Mapping Configuration for Output Box
const colorMap = {
    'blue': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' },
    'yellow': { bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-500' },
    'white': { bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300' },
    'red': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' },
    'copper': { bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#8b5a2b]' },
    'default': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
};

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
                .then(reg => console.log('SW: Registered'))
                .catch(err => console.error('SW: Failed', err));
        });
    }
}

async function loadData() {
    if (await checkClientKillSwitch()) return;

    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        if (!response.ok) throw new Error("Data unreachable");
        
        const data = await response.json();
        spreadsheetData = data;
        
        populateDropdown('tap', '');
        populateDropdown('stirrup', '');
        displayMessage('Select conductors to find AMPACT', 'default');
    } catch (error) {
        displayMessage(`⚠️ ${error.message}`, 'default');
    }
}

async function checkClientKillSwitch() {
    try {
        const response = await fetch(`kill-switch.json?t=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
            const config = await response.json();
            if (config.disablePWA) {
                document.getElementById('kill-switch-overlay').classList.remove('hidden');
                return true;
            }
        }
    } catch (e) {}
    return false;
}

function setupEventListeners() {
    const tapSearch = document.getElementById('tap-search');
    const stirrupSearch = document.getElementById('stirrup-search');
    const tapSelect = document.getElementById('tap-select');
    const stirrupSelect = document.getElementById('stirrup-select');

    // Filtering logic
    tapSearch.addEventListener('input', (e) => populateDropdown('tap', e.target.value));
    stirrupSearch.addEventListener('input', (e) => populateDropdown('stirrup', e.target.value));

    // Selection logic
    tapSelect.addEventListener('change', (e) => {
        tapSelection = e.target.value;
        findResult();
    });
    stirrupSelect.addEventListener('change', (e) => {
        stirrupSelection = e.target.value;
        findResult();
    });

    document.getElementById('reset-button').addEventListener('click', resetSelection);
}

function populateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    
    // Remember current selection if it still exists in the filtered list
    const currentVal = select.value;

    select.innerHTML = '<option value="">Select Conductor...</option>';
    
    const filtered = spreadsheetData.filter(row => 
        row[conductorKey].toLowerCase().includes(query.toLowerCase())
    );

    filtered.forEach(row => {
        const name = row[conductorKey];
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });

    // Restore selection if applicable
    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

function findResult() {
    if (!tapSelection || !stirrupSelection) {
        displayMessage('Select both sides to see result', 'default');
        return;
    }

    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const row = spreadsheetData.find(r => r[conductorKey] === tapSelection);
    const result = row ? row[stirrupSelection] : null;

    if (result && result.trim() !== "") {
        const lowerResult = result.toLowerCase();
        let colorKey = 'default';
        
        if (lowerResult.includes('blue')) colorKey = 'blue';
        else if (lowerResult.includes('yellow')) colorKey = 'yellow';
        else if (lowerResult.includes('white')) colorKey = 'white';
        else if (lowerResult.includes('red')) colorKey = 'red';
        else if (lowerResult.includes('copper')) colorKey = 'copper';

        displayMessage(result, colorKey);
    } else {
        displayMessage('❌ No AMPACT match found', 'default');
    }
}

function displayMessage(text, colorKey) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const styles = colorMap[colorKey] || colorMap.default;

    // Reset styles
    Object.values(colorMap).forEach(s => {
        box.classList.remove(s.bg, s.border, 'text-white', 'text-gray-900', 'text-gray-700');
        output.classList.remove(s.text);
    });

    // Apply new styles
    box.classList.add(styles.bg, styles.border);
    output.classList.add(styles.text);
    output.textContent = text;
}

function resetSelection() {
    tapSelection = '';
    stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
    populateDropdown('tap', '');
    populateDropdown('stirrup', '');
    displayMessage('Select conductors to find AMPACT', 'default');
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
