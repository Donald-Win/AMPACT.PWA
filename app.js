/**
 * AMPACT Selector - v6.3.9
 * Fix: Restored stable relative pathing for Excel loading
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = []; 
let selection1 = '';
let selection2 = '';
let deferredPrompt = null;
const APP_VERSION = "v6.3.9";

const colorThemes = {
    'blue': { body: '#2563eb', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800' },
    'yellow': { body: '#facc15', bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-600' },
    'white': { body: '#ffffff', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300' },
    'red': { body: '#dc2626', bg: 'bg-red-600', text: 'text-white', border: 'border-red-800' },
    'copper': { body: '#b87333', bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#7d4e22]' },
    'default': { body: '#f3f4f6', bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-white' }
};

document.addEventListener('DOMContentLoaded', initApp);

function normalize(str) {
    if (!str) return "";
    return str.toString().toLowerCase().replace(/\s+/g, '').replace(/[^\w\d]/g, '').trim();
}

function getDiameter(name) {
    if (!name) return 0;
    const match = name.match(/\(([\d.]+)\s*mm/);
    return match ? parseFloat(match[1]) : 0;
}

function cleanCell(val) {
    if (val === undefined || val === null) return "";
    return val.toString().trim();
}

async function initApp() {
    setupEventListeners();
    const vTag = document.getElementById('version-tag');
    if (vTag) vTag.textContent = APP_VERSION;
    await loadExcelData();
    setupPWA();
}

async function loadExcelData() {
    try {
        // Use relative path to ensure GitHub Pages finds it in the same folder
        const response = await fetch('data.xlsx');
        if (!response.ok) throw new Error("Excel file not found");
        
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let rawOptionsMap = new Map();
        themedDatabase = {};
        copperDatabase = {};

        workbook.SheetNames.forEach(sheetName => {
            const lowName = sheetName.toLowerCase();
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            if (rows.length < 1) return;

            const headers = rows[0].map(h => cleanCell(h));
            const isCopperSheet = lowName.includes('copper');
            
            let theme = 'default';
            if (lowName.includes('yellow')) theme = 'yellow';
            else if (lowName.includes('blue')) theme = 'blue';
            else if (lowName.includes('white')) theme = 'white';
            else if (lowName.includes('red')) theme = 'red';
            else if (isCopperSheet) theme = 'copper';

            for (let r = 1; r < rows.length; r++) {
                const rowData = rows[r];
                const rawTap = cleanCell(rowData[0]);
                if (!rawTap || rawTap.toLowerCase().includes('cable size')) continue;
                const nTap = normalize(rawTap);
                if (!rawOptionsMap.has(nTap)) rawOptionsMap.set(nTap, rawTap);

                for (let c = 1; c < headers.length; c++) {
                    const rawStirrup = headers[c];
                    if (!rawStirrup || rawStirrup.toLowerCase().includes('cable size')) continue;
                    const nStirrup = normalize(rawStirrup);
                    if (!rawOptionsMap.has(nStirrup)) rawOptionsMap.set(nStirrup, rawStirrup);

                    const val = cleanCell(rowData[c]);
                    if (val && val !== "") {
                        const key = `${nTap}|${nStirrup}`;
                        if (isCopperSheet) copperDatabase[key] = val;
                        else themedDatabase[key] = { value: val, theme: theme };
                    }
                }
            }
        });

        conductorOptions = Array.from(rawOptionsMap.values()).sort();
        updateList('tap', '');
        updateList('stirrup', '');
        console.log("Data loaded successfully");
    } catch (e) {
        console.error("Data Load Error:", e);
        const output = document.getElementById('output');
        output.innerHTML = '<div class="text-red-500 text-sm">Error loading data.xlsx. Please check file location.</div>';
    }
}

function calculate() {
    if (!selection1 || !selection2) {
        displayResult('Ready', 'default', false);
        return;
    }
    const n1 = normalize(selection1), n2 = normalize(selection2);
    const d1 = getDiameter(selection1), d2 = getDiameter(selection2);
    const pairs = d1 >= d2 ? [`${n1}|${n2}`, `${n2}|${n1}`] : [`${n2}|${n1}`, `${n1}|${n2}`];

    let val = "", theme = "";
    for (let key of pairs) {
        if (themedDatabase[key]) {
            val = themedDatabase[key].value;
            theme = themedDatabase[key].theme;
            break;
        }
    }
    
    if (val && (val.toLowerCase().includes("copper") || val.toLowerCase().includes("refer")) || !val) {
        for (let key of pairs) {
            if (copperDatabase[key]) {
                val = copperDatabase[key];
                theme = 'copper';
                break;
            }
        }
    }

    if (val) displayResult(val, theme, true);
    else displayResult('No Match', 'default', false);
}

function updateList(type, filter) {
    const listEl = document.getElementById(`${type}-list`);
    const inputEl = document.getElementById(`${type}-search`);
    if (!listEl) return;

    listEl.innerHTML = '';
    const f = filter.toLowerCase();
    const matches = conductorOptions.filter(name => name.toLowerCase().includes(f));

    if (matches.length === 0) {
        const div = document.createElement('div');
        div.className = "p-3 text-gray-500 italic text-sm";
        div.textContent = "No matches found";
        listEl.appendChild(div);
    } else {
        matches.forEach(name => {
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-gray-800 font-bold text-sm";
            div.textContent = name;
            div.onclick = () => {
                inputEl.value = name;
                if (type === 'tap') selection1 = name; else selection2 = name;
                listEl.classList.add('hidden'); 
                calculate();
            };
            listEl.appendChild(div);
        });
    }
}

function displayResult(text, key, shouldFlash) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    box.className = `p-4 rounded-3xl border-4 text-center min-h-[180px] w-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 ${theme.bg} ${theme.border}`;
    
    output.innerHTML = `<div class="font-black uppercase ${theme.text} text-3xl">${text}</div>`;
}

function setupEventListeners() {
    ['tap', 'stirrup'].forEach(type => {
        const input = document.getElementById(`${type}-search`);
        const list = document.getElementById(`${type}-list`);
        input.addEventListener('input', (e) => {
            updateList(type, e.target.value);
            list.classList.remove('hidden');
        });
        input.addEventListener('focus', () => {
            updateList(type, input.value);
            list.classList.remove('hidden');
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tap-container')) document.getElementById('tap-list').classList.add('hidden');
        if (!e.target.closest('#stirrup-container')) document.getElementById('stirrup-list').classList.add('hidden');
    });

    document.getElementById('reset-button').addEventListener('click', () => {
        location.reload();
    });
}

function setupPWA() {
    const installBtn = document.getElementById('install-btn');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.classList.remove('hidden');
    });
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt = null;
            } else {
                alert("To install: Tap the three dots (⋮) in Chrome and select 'Install App'.");
            }
        });
    }
}
