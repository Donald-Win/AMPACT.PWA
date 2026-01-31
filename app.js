/**
 * AMPACT Selector - v5.9.0
 * Created and Maintained by Donald Win
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = []; // Array for sorted unique values
let selection1 = '';
let selection2 = '';
const APP_VERSION = "v5.9.0";

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
    return val.toString().trim();
}

async function initApp() {
    setupEventListeners();
    const versionEl = document.getElementById('version-tag');
    if (versionEl) versionEl.textContent = `${APP_VERSION} (ULTIMATE MATCH ENGINE)`;
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
        let rawOptions = new Set();
        let normalizedCheck = new Set();

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

                // Deduplicate options based on normalized string
                const normTap = normalize(rawTap);
                if (!normalizedCheck.has(normTap)) {
                    normalizedCheck.add(normTap);
                    rawOptions.add(rawTap);
                }

                for (let c = 1; c < headers.length; c++) {
                    const rawStirrup = headers[c];
                    if (!rawStirrup || rawStirrup.toLowerCase().includes('cable size')) continue;
                    
                    const normStirrup = normalize(rawStirrup);
                    if (!normalizedCheck.has(normStirrup)) {
                        normalizedCheck.add(normStirrup);
                        rawOptions.add(rawStirrup);
                    }

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

        conductorOptions = Array.from(rawOptions).sort();
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

    let foundMatch = false;

    // 1. Check Themed Data
    for (let key of pairs) {
        const entry = themedDatabase[key];
        if (entry) {
            let text = entry.value;
            let theme = entry.theme;

            // Handle "See Copper" redirect inside themed sheets
            if (text.toLowerCase().includes("copper")) {
                const copperVal = copperDatabase[key] || copperDatabase[pairs.find(k => k !== key)];
                if (copperVal) {
                    text = copperVal;
                    theme = 'copper';
                }
            }
            displayResult(text, theme, true);
            foundMatch = true;
            break;
        }
    }

    // 2. Check Copper Sheet directly if no themed match
    if (!foundMatch) {
        for (let key of pairs) {
            if (copperDatabase[key]) {
                displayResult(copperDatabase[key], 'copper', true);
                foundMatch = true;
                break;
            }
        }
    }

    if (!foundMatch) {
        displayResult('No Match', 'default', false);
    }
}

function updateDropdowns(f1, f2) {
    const sel1 = document.getElementById('tap-select');
    const sel2 = document.getElementById('stirrup-select');
    
    const current1 = sel1.value;
    const current2 = sel2.value;

    sel1.innerHTML = '<option value="">Select Conductor...</option>';
    sel2.innerHTML = '<option value="">Select Conductor...</option>';

    conductorOptions.forEach(name => {
        const lowName = name.toLowerCase();
        if (!f1 || lowName.includes(f1.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel1.appendChild(opt);
        }
        if (!f2 || lowName.includes(f2.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel2.appendChild(opt);
        }
    });

    // Re-assign values to maintain selection during typing
    sel1.value = current1;
    sel2.value = current2;
}

function displayResult(text, key, shouldFlash) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    
    // Clear previous flash and trigger new one
    box.classList.remove('flash-success');
    if (shouldFlash) {
        void box.offsetWidth; // Trigger reflow
        box.classList.add('flash-success');
    }

    box.className = `p-4 rounded-3xl border-4 text-center min-h-[180px] w-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    
    let displayStr = text;
    // Aggressive Copper Trimming
    if (key === 'copper' || text.toLowerCase().includes('copper')) {
        displayStr = text.replace(/copper|cu|see|sheet|chart|refer/gi, '').trim();
        if (!displayStr) displayStr = "SEE CHART";
    }

    output.innerHTML = '';
    const parts = displayStr.split(/\s+/).filter(p => p.trim() !== "");
    
    if (parts.length > 1 && !displayStr.toLowerCase().includes("ready")) {
        // Vertical stack with NO dividers
        const container = document.createElement('div');
        container.className = "flex flex-col gap-2 w-full items-center";
        
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
    const tapSearch = document.getElementById('tap-search');
    const stirSearch = document.getElementById('stirrup-search');
    const tapSelect = document.getElementById('tap-select');
    const stirSelect = document.getElementById('stirrup-select');

    tapSearch.addEventListener('input', () => updateDropdowns(tapSearch.value, stirSearch.value));
    stirSearch.addEventListener('input', () => updateDropdowns(tapSearch.value, stirSearch.value));

    tapSelect.addEventListener('change', (e) => {
        selection1 = e.target.value;
        calculate();
    });

    stirSelect.addEventListener('change', (e) => {
        selection2 = e.target.value;
        calculate();
    });

    document.getElementById('reset-button').addEventListener('click', () => {
        selection1 = ''; selection2 = '';
        tapSearch.value = '';
        stirSearch.value = '';
        updateDropdowns('', '');
        displayResult('Ready', 'default', false);
    });
}
