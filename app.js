/**
 * AMPACT Selector - v5.8.5
 * Created and Maintained by Donald Win
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = new Set();
let selection1 = '';
let selection2 = '';
const APP_VERSION = "v5.8.5";

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

function forceString(val) {
    if (val === undefined || val === null) return "";
    if (typeof val === 'object') return ""; 
    return val.toString().trim();
}

function getDiameter(name) {
    if (!name) return 0;
    const match = name.match(/\(([\d.]+)\s*mm/);
    return match ? parseFloat(match[1]) : 0;
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
        conductorOptions.clear();

        workbook.SheetNames.forEach(sheetName => {
            const lowName = sheetName.toLowerCase();
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            if (rows.length < 1) return;

            const headers = rows[0].map(h => forceString(h));
            const isCopperSheet = lowName.includes('copper');
            
            let theme = 'default';
            if (lowName.includes('yellow')) theme = 'yellow';
            else if (lowName.includes('blue')) theme = 'blue';
            else if (lowName.includes('white')) theme = 'white';
            else if (lowName.includes('red')) theme = 'red';
            else if (isCopperSheet) theme = 'copper';

            for (let r = 1; r < rows.length; r++) {
                const rowData = rows[r];
                const rawTap = forceString(rowData[0]);
                if (!rawTap || rawTap.toLowerCase().includes('cable size')) continue;

                conductorOptions.add(rawTap);

                for (let c = 1; c < headers.length; c++) {
                    const rawStirrup = headers[c];
                    if (!rawStirrup || rawStirrup.toLowerCase().includes('cable size')) continue;
                    
                    conductorOptions.add(rawStirrup);
                    const val = forceString(rowData[c]);

                    if (val && val !== "") {
                        const key = `${normalize(rawTap)}|${normalize(rawStirrup)}`;
                        if (isCopperSheet) {
                            copperDatabase[key] = val;
                        } else {
                            themedDatabase[key] = { value: val, theme: theme };
                        }
                    }
                }
            }
        });

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

    const d1 = getDiameter(selection1);
    const d2 = getDiameter(selection2);
    const n1 = normalize(selection1);
    const n2 = normalize(selection2);

    // Try multiple search strategies to ensure a match
    let searchKeys = [];
    if (d1 >= d2) {
        searchKeys.push(`${n1}|${n2}`, `${n2}|${n1}`);
    } else {
        searchKeys.push(`${n2}|${n1}`, `${n1}|${n2}`);
    }

    let foundMatch = false;

    for (let key of searchKeys) {
        const entry = themedDatabase[key];
        if (entry) {
            let text = entry.value;
            let theme = entry.theme;

            if (text.toLowerCase().includes("copper")) {
                const copperVal = copperDatabase[key] || copperDatabase[searchKeys.find(k => k !== key)];
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

    if (!foundMatch) {
        for (let key of searchKeys) {
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
    const old1 = sel1.value;
    const old2 = sel2.value;

    const list = Array.from(conductorOptions).sort();

    sel1.innerHTML = '<option value="">Select Conductor...</option>';
    sel2.innerHTML = '<option value="">Select Conductor...</option>';

    list.forEach(name => {
        if (!f1 || name.toLowerCase().includes(f1.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel1.appendChild(opt);
        }
        if (!f2 || name.toLowerCase().includes(f2.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel2.appendChild(opt);
        }
    });

    sel1.value = old1;
    sel2.value = old2;
}

function displayResult(text, key, shouldFlash) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    
    if (shouldFlash) {
        box.classList.add('flash-success');
        setTimeout(() => box.classList.remove('flash-success'), 600);
    }

    box.className = `p-4 rounded-3xl border-4 text-center min-h-[180px] w-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border} space-y-2`;
    
    let displayStr = text;
    if (key === 'copper') {
        displayStr = text.replace(/copper|cu|see|sheet|chart|refer/gi, '').trim();
        if (!displayStr) displayStr = "SEE CHART";
    }

    output.innerHTML = '';
    const parts = displayStr.split(/\s+/).filter(p => p.trim() !== "");
    
    if (parts.length > 1 && !displayStr.toLowerCase().includes("ready")) {
        parts.forEach(p => {
            const div = document.createElement('div');
            div.className = `font-black uppercase tracking-tight ${theme.text} ${parts.length > 3 ? 'text-xl' : 'text-3xl'}`;
            div.textContent = p;
            output.appendChild(div);
        });
    } else {
        const div = document.createElement('div');
        div.className = `font-black uppercase ${theme.text} ${displayStr.length > 15 ? 'text-xl' : 'text-4xl'}`;
        div.textContent = displayStr;
        output.appendChild(div);
    }
}

function setupEventListeners() {
    document.getElementById('tap-search').addEventListener('input', e => updateDropdowns(e.target.value, document.getElementById('stirrup-search').value));
    document.getElementById('stirrup-search').addEventListener('input', e => updateDropdowns(document.getElementById('tap-search').value, e.target.value));
    document.getElementById('tap-select').addEventListener('change', e => { selection1 = e.target.value; calculate(); });
    document.getElementById('stirrup-select').addEventListener('change', e => { selection2 = e.target.value; calculate(); });
    document.getElementById('reset-button').addEventListener('click', () => {
        selection1 = ''; selection2 = '';
        document.getElementById('tap-search').value = '';
        document.getElementById('stirrup-search').value = '';
        document.getElementById('tap-select').value = '';
        document.getElementById('stirrup-select').value = '';
        updateDropdowns('', '');
        displayResult('Ready', 'default', false);
    });
}
