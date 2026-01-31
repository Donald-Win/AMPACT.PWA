/**
 * Ducky's AMPACT Selector - v5.4.0
 * Order-Independent Engine (Size-Based Logic)
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

function clean(str) {
    if (str === undefined || str === null) return "";
    return str.toString()
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extracts diameter from strings like "BUTTERFLY (23.20mm)"
 */
function getDiameter(name) {
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
                    const tap = clean(rowData[0]);
                    if (!tap) continue;

                    conductorOptions.add(tap);

                    for (let c = 1; c < headers.length; c++) {
                        const stirrup = headers[c];
                        if (!stirrup || stirrup.toLowerCase().includes('cable size')) continue;
                        
                        conductorOptions.add(stirrup);
                        const val = clean(rowData[c]);

                        if (val && val !== "") {
                            const key = `${tap}|${stirrup}`;
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

    // Logic: Larger diameter is the Tap (row), smaller is the Stirrup (column)
    const dia1 = getDiameter(selection1);
    const dia2 = getDiameter(selection2);

    let tap, stirrup;
    if (dia1 >= dia2) {
        tap = selection1;
        stirrup = selection2;
    } else {
        tap = selection2;
        stirrup = selection1;
    }

    const key = `${tap}|${stirrup}`;
    const entry = themedDatabase[key];

    if (entry) {
        let text = entry.value;
        let theme = entry.theme;

        if (text.toLowerCase().includes("refer copper")) {
            const copperVal = copperDatabase[key];
            if (copperVal) {
                text = copperVal;
                theme = 'copper';
            } else {
                text = "See Copper Chart";
                theme = 'copper';
            }
        }
        displayResult(text, theme);
    } else {
        const copperOnly = copperDatabase[key];
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
        else span.className = `font-black uppercase ${theme.text} text-3xl`;
        output.appendChild(span);
    }
}

function setupEventListeners() {
    // Note: The HTML IDs remain 'tap' and 'stirrup' for compatibility but labels are changed
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
        
        // Reset selections manually
        document.getElementById('tap-select').value = '';
        document.getElementById('stirrup-select').value = '';
        
        updateDropdowns('', '');
        displayResult('Ready', 'default');
    });
}
