/**
 * Ducky's AMPACT Selector - v5.8.2
 * Created and Maintained by Donald Win
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = new Set();
let selection1 = '';
let selection2 = '';
const APP_VERSION = "v5.8.2";

const colorThemes = {
    'blue': { body: '#2563eb', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800' },
    'yellow': { body: '#facc15', bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-600' },
    'white': { body: '#ffffff', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300' },
    'red': { body: '#dc2626', bg: 'bg-red-600', text: 'text-white', border: 'border-red-800' },
    'copper': { body: '#b87333', bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#7d4e22]' },
    'default': { body: '#f3f4f6', bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-white' }
};

document.addEventListener('DOMContentLoaded', initApp);

/**
 * Normalizes strings for matching by removing spaces and non-alphanumeric chars
 */
function normalize(str) {
    if (!str) return "";
    return str.toString().toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^\w\d]/g, '') 
        .trim();
}

/**
 * Basic cleanup for display text
 */
function clean(str) {
    if (str === undefined || str === null) return "";
    return str.toString()
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extracts diameter for size-based sorting (larger = tap)
 */
function getDiameter(name) {
    if (!name) return 0;
    const match = name.match(/\(([\d.]+)\s*mm/);
    return match ? parseFloat(match[1]) : 0;
}

async function initApp() {
    setupEventListeners();
    const versionEl = document.getElementById('version-tag');
    if (versionEl) versionEl.textContent = `${APP_VERSION} (EXCEL COLOR ENGINE)`;
    
    try {
        await loadExcelData();
    } catch (err) {
        console.error("Initialization Failed:", err);
        displayResult('INIT ERROR', 'default', false);
    }
}

async function loadExcelData() {
    try {
        // Cache busting timestamp
        const response = await fetch(`data.xlsx?t=${Date.now()}`);
        if (!response.ok) throw new Error("File 'data.xlsx' not found on server.");
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        
        // Reset local data structures
        themedDatabase = {};
        copperDatabase = {};
        conductorOptions.clear();

        workbook.SheetNames.forEach(sheetName => {
            const lowName = sheetName.toLowerCase();
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (rows.length < 1) return;

            const headers = rows[0].map(h => clean(h));
            const isCopperSheet = lowName.includes('copper');
            
            let theme = null;
            if (lowName.includes('yellow')) theme = 'yellow';
            else if (lowName.includes('blue')) theme = 'blue';
            else if (lowName.includes('white')) theme = 'white';
            else if (lowName.includes('red')) theme = 'red';
            else if (isCopperSheet) theme = 'copper';

            if (theme) {
                for (let r = 1; r < rows.length; r++) {
                    const rowData = rows[r];
                    const rawTap = clean(rowData[0]);
                    if (!rawTap || rawTap.toLowerCase().includes('cable size')) continue;

                    conductorOptions.add(rawTap);

                    for (let c = 1; c < headers.length; c++) {
                        const rawStirrup = headers[c];
                        if (!rawStirrup || rawStirrup.toLowerCase().includes('cable size')) continue;
                        
                        conductorOptions.add(rawStirrup);
                        const val = clean(rowData[c]);

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
            }
        });

        if (conductorOptions.size === 0) throw new Error("No data found in sheets.");

        updateDropdowns('', '');
        displayResult('Ready', 'default', false);
    } catch (e) {
        console.error("Data Load Error:", e);
        displayResult('EXCEL ERROR', 'default', false);
        // Fallback options to prevent infinite loading state
        const selects = ['tap-select', 'stirrup-select'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<option value="">Error Loading Excel</option>';
        });
    }
}

function calculate() {
    if (!selection1 || !selection2) {
        displayResult('Ready', 'default', false);
        return;
    }

    const tNorm = normalize(selection1);
    const sNorm = normalize(selection2);
    const keysToTry = [`${tNorm}|${sNorm}`, `${sNorm}|${tNorm}`];

    let resultFound = false;

    for (let key of keysToTry) {
        const entry = themedDatabase[key];
        if (entry) {
            let text = entry.value;
            let theme = entry.theme;

            // Handle cross-sheet referencing
            if (text.toLowerCase().includes("copper")) {
                const copperVal = copperDatabase[key] || copperDatabase[keysToTry.find(k => k !== key)];
                if (copperVal) {
                    text = copperVal;
                    theme = 'copper';
                }
            }
            displayResult(text, theme, true);
            resultFound = true;
            break;
        }
    }

    if (!resultFound) {
        // Direct copper sheet search
        const copperVal = copperDatabase[keysToTry[0]] || copperDatabase[keysToTry[1]];
        if (copperVal) {
            displayResult(copperVal, 'copper', true);
        } else {
            displayResult('NO MATCH', 'default', false);
        }
    }
}

function updateDropdowns(filter1, filter2) {
    const sel1 = document.getElementById('tap-select');
    const sel2 = document.getElementById('stirrup-select');
    if (!sel1 || !sel2) return;

    const old1 = sel1.value;
    const old2 = sel2.value;

    const sortedList = Array.from(conductorOptions).sort();

    sel1.innerHTML = '<option value="">Select Conductor...</option>';
    sel2.innerHTML = '<option value="">Select Conductor...</option>';

    sortedList.forEach(name => {
        if (!filter1 || name.toLowerCase().includes(filter1.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel1.appendChild(opt);
        }
        if (!filter2 || name.toLowerCase().includes(filter2.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel2.appendChild(opt);
        }
    });

    // Restore selections if valid
    sel1.value = old1;
    sel2.value = old2;
}

function displayResult(text, key, shouldFlash) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    if (!output || !box || !body) return;

    const theme = colorThemes[key] || colorThemes.default;
    body.style.backgroundColor = theme.body;
    
    if (shouldFlash) {
        box.classList.add('flash-success');
        setTimeout(() => box.classList.remove('flash-success'), 600);
    }

    box.className = `p-4 rounded-3xl border-4 text-center min-h-[180px] w-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    
    let cleanText = text;
    // Strip "Copper" related words only if background is already copper color
    if (key === 'copper') {
        cleanText = text.replace(/copper|cu|see|sheet|chart|refer/gi, '').trim();
        if (!cleanText) cleanText = "CHECK CHART";
    }

    output.innerHTML = '';
    const parts = cleanText.split(/\s+/).filter(p => p.trim() !== "");
    
    if (parts.length > 1 && !cleanText.toLowerCase().includes("ready")) {
        parts.forEach((part) => {
            const item = document.createElement('div');
            let fontSize = 'text-3xl';
            if (parts.length > 2) fontSize = 'text-2xl';
            if (parts.length > 4) fontSize = 'text-xl';
            
            item.className = `font-black uppercase tracking-tight py-1 ${theme.text} ${fontSize}`;
            item.textContent = part.trim();
            output.appendChild(item);
        });
    } else {
        const item = document.createElement('div');
        item.textContent = cleanText;
        if (cleanText.length > 20) item.className = `font-black uppercase ${theme.text} text-sm`;
        else item.className = `font-black uppercase ${theme.text} text-3xl`;
        output.appendChild(item);
    }
}

function setupEventListeners() {
    const tapSearch = document.getElementById('tap-search');
    const stirSearch = document.getElementById('stirrup-search');
    const tapSel = document.getElementById('tap-select');
    const stirSel = document.getElementById('stirrup-select');
    const resetBtn = document.getElementById('reset-button');

    if (tapSearch) tapSearch.addEventListener('input', e => {
        updateDropdowns(e.target.value, stirSearch.value);
    });
    
    if (stirSearch) stirSearch.addEventListener('input', e => {
        updateDropdowns(tapSearch.value, e.target.value);
    });
    
    if (tapSel) tapSel.addEventListener('change', e => { 
        selection1 = e.target.value; 
        calculate(); 
    });
    
    if (stirSel) stirSel.addEventListener('change', e => { 
        selection2 = e.target.value; 
        calculate(); 
    });
    
    if (resetBtn) resetBtn.addEventListener('click', () => {
        selection1 = ''; selection2 = '';
        if (tapSearch) tapSearch.value = '';
        if (stirSearch) stirSearch.value = '';
        if (tapSel) tapSel.value = '';
        if (stirSel) stirSel.value = '';
        updateDropdowns('', '');
        displayResult('Ready', 'default', false);
    });
}
