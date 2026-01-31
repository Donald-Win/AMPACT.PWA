/**
 * Ducky's AMPACT Selector - Core Logic v2.0.2
 */

let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt;

// Color Mapping Configuration
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
    const output = document.getElementById('output');
    if (await checkClientKillSwitch()) return;

    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        if (!response.ok) throw new Error("Data unreachable");
        
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error("Invalid Data");

        spreadsheetData = data;
        displayMessage('Select conductors to find AMPACT', 'default');
    } catch (error) {
        displayMessage(`⚠️ ${error.message}`, 'default');
        showRetryButton();
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
    const tapInput = document.getElementById('tap-search');
    const stirInput = document.getElementById('stirrup-search');
    
    // Search/Filter logic for Tap
    tapInput.addEventListener('input', (e) => filterDropdown('tap', e.target.value));
    tapInput.addEventListener('focus', () => filterDropdown('tap', tapInput.value));
    
    // Search/Filter logic for Stirrup
    stirInput.addEventListener('input', (e) => filterDropdown('stirrup', e.target.value));
    stirInput.addEventListener('focus', () => filterDropdown('stirrup', stirInput.value));

    // Close dropdowns on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.matches('#tap-search') && !e.target.matches('#stirrup-search')) {
            hideAllDropdowns();
        }
    });

    document.getElementById('reset-button').addEventListener('click', resetSelection);
}

function filterDropdown(type, query) {
    hideAllDropdowns();
    const dropdown = document.getElementById(`${type}-dropdown`);
    const headers = Object.keys(spreadsheetData[0]);
    const conductorKey = headers[0];
    
    const filtered = spreadsheetData.filter(row => 
        row[conductorKey].toLowerCase().includes(query.toLowerCase())
    );

    dropdown.innerHTML = '';
    filtered.forEach(row => {
        const name = row[conductorKey];
        const item = document.createElement('div');
        item.textContent = name;
        item.onclick = () => selectConductor(type, name);
        dropdown.appendChild(item);
    });

    if (filtered.length > 0) dropdown.classList.add('show');
}

function selectConductor(type, value) {
    document.getElementById(`${type}-search`).value = value;
    if (type === 'tap') tapSelection = value;
    else stirrupSelection = value;
    
    hideAllDropdowns();
    findResult();
}

function hideAllDropdowns() {
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
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
        // Extract color from string (e.g., "600455-0 Blue" -> "blue")
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

    // Remove all possible theme classes
    Object.values(colorMap).forEach(s => {
        box.classList.remove(s.bg, s.border);
        output.classList.remove(s.text);
    });

    // Apply new theme
    box.classList.add(styles.bg, styles.border);
    output.classList.add(styles.text);
    output.textContent = text;
}

function resetSelection() {
    tapSelection = '';
    stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
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

function showRetryButton() {
    const container = document.getElementById('output-box');
    if (!document.getElementById('retry-btn')) {
        const btn = document.createElement('button');
        btn.id = 'retry-btn';
        btn.textContent = "Retry";
        btn.className = "mt-2 bg-gray-200 px-3 py-1 rounded text-xs font-bold";
        btn.onclick = () => location.reload();
        container.appendChild(btn);
    }
}
