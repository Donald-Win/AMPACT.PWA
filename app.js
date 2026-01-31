/**
 * Ducky's AMPACT Selector - v5.6.0
 * Order-Independent + Fuzzy Copper Lookup
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = new Set();
let selection1 = '';
let selection2 = '';

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
 * Standardizes conductor names for lookups (removes extra spaces/formatting)
 */
function normalize(str) {
    if (!str) return "";
    return str.toString().toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\d().]/g, '') // Strips symbols to prevent matching errors
        .trim();
}

function clean(str) {
    if (str === undefined || str === null) return "";
    return str.toString()
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getDiameter(name) {
    if (!name) return 0;
    const match = name.match(/\(([\d.]+)\s*mm/);
    return match ? parseFloat(match[1]) : 0;
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
                            // We use normalized keys for internal logic, raw keys for display
                            const key = `${normalize(rawTap)}|${normalize(rawStirrup)}`;
                            if (isCopperSheet) {
                                copperDatabase[key] = val;
                            } else {
                                themedDatabase[key] = { value: val, theme: theme, rawKey: `${rawTap}|${rawStirrup}` };
                            }
                        }
                    }
                }
            }
        });

        updateDropdowns('', '');
        displayResult('Ready', 'default');
    } catch (e) {
        console.error("Data Load Error:", e);
        displayResult('Load Error', 'default');
    }
}

function calculate() {
    if (!selection1 || !selection2) {
        displayResult('Ready', 'default');
        return;
    }

    const dia1 = getDiameter(selection1);
    const dia2 = getDiameter(selection2);

    // Swap logic: Internal lookup uses normalized strings
    let tNorm, sNorm;
    if (dia1 >= dia2) {
        tNorm = normalize(selection1);
        sNorm = normalize(selection2);
    } else {
        tNorm = normalize(selection2);
        sNorm = normalize(selection1);
    }

    const key = `${tNorm}|${sNorm}`;
    const entry = themedDatabase[key];

    if (entry) {
        let text = entry.value;
        let theme = entry.theme;

        // Perform Copper Lookup if indicated
        if (text.toLowerCase().includes("refer copper") || text.toLowerCase().includes("check copper")) {
            const copperVal = copperDatabase[key];
            if (copperVal) {
                text = copperVal;
                theme = 'copper';
            } else {
                // If it points to copper but we can't find the exact match, 
                // search for the reverse order in copper just in case
                const reverseKey = `${sNorm}|${tNorm}`;
                const revCopperVal = copperDatabase[reverseKey];
                if (revCopperVal) {
                    text = revCopperVal;
                    theme = 'copper';
                } else {
                    text = "Refer Copper Sheet";
                    theme = 'copper';
                }
            }
        }
        displayResult(text, theme);
    } else {
        // Fallback for items that exist ONLY in the copper sheet
        const copperOnly = copperDatabase[key] || copperDatabase[`${sNorm}|${tNorm}`];
        if (copperOnly) {
            displayResult(copperOnly, 'copper');
        } else {
            displayResult('No Match', 'default');
        }
    }
}

function updateDropdowns(filter1, filter2) {
    const sel1 = document.getElementById('tap-select');
    const sel2 = document.getElementById('stirrup-select');
    const old1 = sel1.value;
    const old2 = sel2.value;

    const sortedList = [...conductorOptions].sort();

    sel1.innerHTML = '<option value="">Select Conductor 1...</option>';
    sel2.innerHTML = '<option value="">Select Conductor 2...</option>';

    sortedList.forEach(name => {
        if (name.toLowerCase().includes(filter1.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel1.appendChild(opt);
        }
        if (name.toLowerCase().includes(filter2.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = name;
            sel2.appendChild(opt);
        }
    });

    sel1.value = old1;
    sel2.value = old2;
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[160px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    
    output.innerHTML = '';
    const parts = text.split(/\s{2,}/).filter(p => p.trim() !== "");
    
    if (parts.length > 1) {
        parts.forEach((part, index) => {
            const span = document.createElement('div');
            span.className = `font-black uppercase tracking-tight py-1 ${theme.text} ${parts.length > 3 ? 'text-sm' : 'text-xl'}`;
            span.textContent = part.trim();
            output.appendChild(span);
            if (index < parts.length - 1) {
                const hr = document.createElement('div');
                hr.className = `w-12 h-0.5 my-1 opacity-30 ${key === 'white' ? 'bg-gray-400' : 'bg-white'}`;
                output.appendChild(hr);
            }
        });
    } else {
        const span = document.createElement('div');
        span.textContent = text;
        if (text.length > 25) span.className = `font-black uppercase ${theme.text} text-xs`;
        else if (text.length > 18) span.className = `font-black uppercase ${theme.text} text-base`;
        else if (text.length > 12) span.className = `font-black uppercase ${theme.text} text-xl`;
        else span.className = `font-black uppercase ${theme.text} text-3xl`;
        output.appendChild(span);
    }
}

function setupEventListeners() {
    document.getElementById('tap-search').addEventListener('input', e => updateDropdowns(e.target.value, document.getElementById('stirrup-search').value));
    document.getElementById('stirrup-search').addEventListener('input', e => updateDropdowns(document.getElementById('tap-search').value, e.target.value));
    
    document.getElementById('tap-select').addEventListener('change', e => { 
        selection1 = e.target.value; 
        calculate(); 
    });
    document.getElementById('stirrup-select').addEventListener('change', e => { 
        selection2 = e.target.value; 
        calculate(); 
    });
    
    document.getElementById('reset-button').addEventListener('click', () => {
        selection1 = ''; selection2 = '';
        document.getElementById('tap-search').value = '';
        document.getElementById('stirrup-search').value = '';
        document.getElementById('tap-select').value = '';
        document.getElementById('stirrup-select').value = '';
        updateDropdowns('', '');
        displayResult('Ready', 'default');
    });
}
