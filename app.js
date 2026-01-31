/**
 * AMPACT Selector - v6.0.0
 * Created and Maintained by Donald Win
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = []; 
let selection1 = '';
let selection2 = '';
const APP_VERSION = "v6.0.0";

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

function cleanCell(val) {
    if (val === undefined || val === null) return "";
    // Handle objects if Excel parser returns them
    if (typeof val === 'object') return "";
    return val.toString().trim();
}

async function initApp() {
    setupEventListeners();
    const versionEl = document.getElementById('version-tag');
    if (versionEl) versionEl.textContent = `${APP_VERSION} (COPPER-CROSS ENGINE)`;
    await loadExcelData();
}

async function loadExcelData() {
    try {
        const response = await fetch(`data.xlsx?t=${Date.now()}`);
        if (!response.ok) throw new Error("data.xlsx not found");
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        
        themedDatabase = {};
        copperDatabase = {};
        let rawOptionsMap = new Map(); // Store display name by its normalized key to prevent duplicates

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

                // Deduplicate for dropdowns
                const normTap = normalize(rawTap);
                if (!rawOptionsMap.has(normTap)) rawOptionsMap.set(normTap, rawTap);

                for (let c = 1; c < headers.length; c++) {
                    const rawStirrup = headers[c];
                    if (!rawStirrup || rawStirrup.toLowerCase().includes('cable size')) continue;
                    
                    const normStirrup = normalize(rawStirrup);
                    if (!rawOptionsMap.has(normStirrup)) rawOptionsMap.set(normStirrup, rawStirrup);

                    const val = cleanCell(rowData[c]);
                    if (val && val !== "") {
                        const key = `${normTap}|${normStirrup}`;
                        if (isCopperSheet) {
                            copperDatabase[key] = val;
                        } else {
                            themedDatabase[key] = { value: val, theme: theme };
                        }
                    }
                }
            }
        });

        conductorOptions = Array.from(rawOptionsMap.values()).sort();
        updateDropdowns('', '');
        displayResult('Ready', 'default', false);
    } catch (e) {
        console.error("Load Error:", e);
        displayResult('EXCEL ERROR', 'default', false);
    }
}

function calculate() {
    if (!selection1 || !selection2) {
        displayResult('Ready', 'default', false);
        return;
    }

    const n1 = normalize(selection1);
    const n2 = normalize(selection2);
    const pairs = [`${n1}|${n2}`, `${n2}|${n1}`];

    let finalValue = "";
    let finalTheme = "";

    // 1. Check Themed Database first
    for (let key of pairs) {
        const entry = themedDatabase[key];
        if (entry) {
            finalValue = entry.value;
            finalTheme = entry.theme;
            break;
        }
    }

    // 2. Logic Overhaul: If result says "Copper" OR no themed match, force Copper lookup
    const isCopperRef = finalValue.toLowerCase().includes("copper") || finalValue.toLowerCase().includes("refer");
    
    if (isCopperRef || !finalValue) {
        for (let key of pairs) {
            if (copperDatabase[key]) {
                finalValue = copperDatabase[key];
                finalTheme = 'copper';
                break;
            }
        }
    }

    if (finalValue) {
        displayResult(finalValue, finalTheme, true);
    } else {
        displayResult('No Match', 'default', false);
    }
}

function updateDropdowns(f1, f2) {
    const sel1 = document.getElementById('tap-select');
    const sel2 = document.getElementById('stirrup-select');
    
    const val1 = sel1.value;
    const val2 = sel2.value;

    sel1.innerHTML = '<option value="">Select Conductor...</option>';
    sel2.innerHTML = '<option value="">Select Conductor...</option>';

    conductorOptions.forEach(name => {
        const low = name.toLowerCase();
        if (!f1 || low.includes(f1.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel1.appendChild(opt);
        }
        if (!f2 || low.includes(f2.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel2.appendChild(opt);
        }
    });

    sel1.value = val1;
    sel2.value = val2;
}

function displayResult(text, key, shouldFlash) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    
    box.classList.remove('flash-success');
    if (shouldFlash) {
        void box.offsetWidth; 
        box.classList.add('flash-success');
    }

    box.className = `p-4 rounded-3xl border-4 text-center min-h-[180px] w-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    
    let displayStr = text;
    // Aggressive Copper text removal for clean UI
    if (key === 'copper') {
        displayStr = text.replace(/copper|cu|see|sheet|chart|refer/gi, '').trim();
        if (!displayStr) displayStr = "CHECK CHART";
    }

    output.innerHTML = '';
    const parts = displayStr.split(/\s+/).filter(p => p.trim() !== "");
    
    if (parts.length > 1 && !displayStr.toLowerCase().includes("ready")) {
        const container = document.createElement('div');
        container.className = "flex flex-col gap-1 w-full items-center";
        parts.forEach(p => {
            const div = document.createElement('div');
            div.className = `font-black uppercase tracking-tight ${theme.text} ${parts.length > 3 ? 'text-xl' : 'text-3xl'}`;
            div.textContent = p;
            container.appendChild(div);
        });
        output.appendChild(container);
    } else {
        const div = document.createElement('div');
        div.className = `font-black uppercase ${theme.text} ${displayStr.length > 15 ? 'text-xl' : 'text-4xl'}`;
        div.textContent = displayStr;
        output.appendChild(div);
    }
}

function setupEventListeners() {
    const ts = document.getElementById('tap-search');
    const ss = document.getElementById('stirrup-search');
    const tsel = document.getElementById('tap-select');
    const ssel = document.getElementById('stirrup-select');

    ts.addEventListener('input', () => updateDropdowns(ts.value, ss.value));
    ss.addEventListener('input', () => updateDropdowns(ts.value, ss.value));

    tsel.addEventListener('change', (e) => { selection1 = e.target.value; calculate(); });
    ssel.addEventListener('change', (e) => { selection2 = e.target.value; calculate(); });

    document.getElementById('reset-button').addEventListener('click', () => {
        selection1 = ''; selection2 = '';
        ts.value = ''; ss.value = '';
        tsel.value = ''; ssel.value = '';
        updateDropdowns('', '');
        displayResult('Ready', 'default', false);
    });
}
