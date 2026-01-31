/**
 * Ducky's AMPACT Selector - v4.7.0
 * Multi-Tab Cross-Reference Engine (Color by Tab Source)
 */
let spreadsheetData = [];
let tabSourceMap = {}; // Maps "Tap|Stirrup" to a specific color theme
let tapSelection = '';
let stirrupSelection = '';
let conductorHeaderName = "";

const colorThemes = {
    'blue': { body: '#2563eb', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800' },
    'yellow': { body: '#facc15', bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-600' },
    'white': { body: '#ffffff', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300' },
    'red': { body: '#dc2626', bg: 'bg-red-600', text: 'text-white', border: 'border-red-800' },
    'copper': { body: '#b87333', bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#7d4e22]' },
    'default': { body: '#f3f4f6', bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-white' }
};

document.addEventListener('DOMContentLoaded', initApp);

function clean(str) {
    if (str === undefined || str === null) return "";
    return str.toString().replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
}

async function initApp() {
    setupEventListeners();
    await loadExcelData();
}

async function loadExcelData() {
    try {
        const response = await fetch(`data.xlsx?t=${Date.now()}`);
        if (!response.ok) throw new Error("data.xlsx not found");
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        
        // 1. Build the Tab Source Map (Scanning themed tabs)
        workbook.SheetNames.forEach(sheetName => {
            const lowName = sheetName.toLowerCase();
            let theme = '';
            if (lowName.includes('yellow')) theme = 'yellow';
            else if (lowName.includes('blue')) theme = 'blue';
            else if (lowName.includes('red')) theme = 'red';
            else if (lowName.includes('white')) theme = 'white';
            else if (lowName.includes('copper')) theme = 'copper';

            if (theme) {
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                const headers = json[0] ? json[0].map(h => clean(h)) : [];
                
                for (let r = 1; r < json.length; r++) {
                    const row = json[r];
                    const tap = clean(row[0]);
                    if (!tap) continue;
                    
                    for (let c = 1; c < headers.length; c++) {
                        const stirrup = headers[c];
                        const val = clean(row[c]);
                        if (val && val !== "Refer Copper Chart") {
                            // Map this specific Tap/Stirrup combo to the tab's color
                            tabSourceMap[`${tap}|${stirrup}`] = theme;
                        }
                    }
                }
            }
        });

        // 2. Load the Master List (Main AMPACT x-ref chart) for the UI
        const mainSheetName = workbook.SheetNames.find(n => n.includes('Main') || n.includes('x-ref')) || workbook.SheetNames[0];
        const mainSheet = workbook.Sheets[mainSheetName];
        const mainData = XLSX.utils.sheet_to_json(mainSheet, { header: 1 });
        
        const headers = mainData[0].map(h => clean(h));
        conductorHeaderName = headers[0];

        spreadsheetData = [];
        for (let r = 1; r < mainData.length; r++) {
            const row = mainData[r];
            const rowObj = {};
            headers.forEach((h, i) => { rowObj[h] = clean(row[i]); });
            if (rowObj[conductorHeaderName]) spreadsheetData.push(rowObj);
        }

        updateTapOptions('');
        updateStirrupOptions('');
        displayResult('Ready', 'default');
    } catch (e) {
        console.error("Excel Load Error:", e);
        displayResult('Load Error', 'default');
    }
}

function calculate() {
    if (!tapSelection || !stirrupSelection) {
        displayResult('Ready', 'default');
        return;
    }

    const row = spreadsheetData.find(r => r[conductorHeaderName] === tapSelection);
    const result = row ? row[stirrupSelection] : null;

    if (result && result !== "Refer Copper Chart") {
        // Look up the theme based on which tab contains this specific combo
        const theme = tabSourceMap[`${tapSelection}|${stirrupSelection}`] || 'default';
        displayResult(result, theme);
    } else if (result === "Refer Copper Chart") {
        displayResult("Check Copper Chart", 'copper');
    } else {
        displayResult('No Match', 'default');
    }
}

function updateTapOptions(filter) {
    const select = document.getElementById('tap-select');
    const prev = select.value;
    select.innerHTML = '<option value="">Select Tap Conductor...</option>';
    spreadsheetData.forEach(row => {
        const name = row[conductorHeaderName];
        if (name && name.toLowerCase().includes(filter.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            select.appendChild(opt);
        }
    });
    if (prev) select.value = prev;
}

function updateStirrupOptions(filter) {
    const select = document.getElementById('stirrup-select');
    const prev = select.value;
    select.innerHTML = '<option value="">Select Stirrup Conductor...</option>';
    if (spreadsheetData.length > 0) {
        const heads = Object.keys(spreadsheetData[0]).filter(k => k !== conductorHeaderName);
        heads.forEach(h => {
            if (h.toLowerCase().includes(filter.toLowerCase())) {
                const opt = document.createElement('option');
                opt.value = h; opt.textContent = h;
                select.appendChild(opt);
            }
        });
    }
    if (prev) select.value = prev;
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    output.className = `font-black uppercase text-center ${theme.text} ${text.length > 15 ? 'text-lg' : 'text-3xl'}`;
    output.textContent = text;
}

function setupEventListeners() {
    document.getElementById('tap-search').addEventListener('input', e => updateTapOptions(e.target.value));
    document.getElementById('stirrup-search').addEventListener('input', e => updateStirrupOptions(e.target.value));
    document.getElementById('tap-select').addEventListener('change', e => { tapSelection = e.target.value; calculate(); });
    document.getElementById('stirrup-select').addEventListener('change', e => { stirrupSelection = e.target.value; calculate(); });
    document.getElementById('reset-button').addEventListener('click', () => {
        tapSelection = ''; stirrupSelection = '';
        document.getElementById('tap-search').value = '';
        document.getElementById('stirrup-search').value = '';
        updateTapOptions(''); updateStirrupOptions('');
        displayResult('Ready', 'default');
    });
}
