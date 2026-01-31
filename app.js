/**
 * AMPACT Selector - v6.2.0 (Restored Logic)
 * Surgical PWA addition only.
 */

let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = []; 
let selection1 = '';
let selection2 = '';
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
    return val === undefined || val === null ? "" : val.toString().trim();
}

async function initApp() {
    setupEventListeners();
    await loadExcelData();
    setupPWA();
}

async function loadExcelData() {
    try {
        const response = await fetch('data.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let rawOptionsMap = new Map();

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
    } catch (e) {
        console.error("Excel Load Error", e);
    }
}

function calculate() {
    if (!selection1 || !selection2) {
        displayResult('Ready', 'default');
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

    if (val) displayResult(val, theme);
    else displayResult('No Match', 'default');
}

function updateList(type, filter) {
    const listEl = document.getElementById(`${type}-list`);
    const inputEl = document.getElementById(`${type}-search`);
    if (!listEl) return;

    listEl.innerHTML = '';
    const matches = conductorOptions.filter(name => name.toLowerCase().includes(filter.toLowerCase()));

    matches.forEach(name => {
        const div = document.createElement('div');
        div.className = "p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50 text-gray-800 font-bold text-sm";
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

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const theme = colorThemes[key] || colorThemes.default;
    
    box.className = `rounded-[2rem] p-8 border-2 flex items-center justify-center min-h-[160px] transition-all duration-300 ${theme.bg} ${theme.border}`;
    output.className = `font-black text-4xl uppercase tracking-tighter text-center ${theme.text}`;
    output.textContent = text;
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
            }
        });
    }
}
