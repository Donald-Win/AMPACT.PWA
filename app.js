/**
 * Ducky's AMPACT Selector - v5.8.0
 * Vertical Stacking + Clean Copper Display
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
 * Normalizes strings for matching by removing non-alphanumeric chars
 */
function normalize(str) {
    if (!str) return "";
    return str.toString().toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^\w\d]/g, '') 
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

    let tNorm = normalize(selection1);
    let sNorm = normalize(selection2);

    let keysToTry = [
        `${tNorm}|${sNorm}`,
        `${sNorm}|${tNorm}`
    ];

    let resultFound = false;

    for (let key of keysToTry) {
        const entry = themedDatabase[key];
        if (entry) {
            let text = entry.value;
            let theme = entry.theme;

            if (text.toLowerCase().includes("copper")) {
                const copperVal = copperDatabase[key] || copperDatabase[keysToTry.find(k => k !== key)];
                if (copperVal) {
                    text = copperVal;
                    theme = 'copper';
                }
            }
            displayResult(text, theme);
            resultFound = true;
            break;
        }
    }

    if (!resultFound) {
        const copperVal = copperDatabase[keysToTry[0]] || copperDatabase[keysToTry[1]];
        if (copperVal) {
            displayResult(copperVal, 'copper');
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
    box.className = `p-4 rounded-3xl border-4 text-center min-h-[180px] w-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    
    // Clean text if it's a copper result: remove "Copper", "Cu", "See", "Sheet", "Chart"
    let cleanText = text;
    if (key === 'copper') {
        cleanText = text.replace(/copper|cu|see|sheet|chart|refer/gi, '').trim();
        // Fallback in case cleaning makes it empty (e.g. if the result was just "See Copper Chart")
        if (!cleanText) cleanText = "SEE CHART";
    }

    output.innerHTML = '';
    
    const parts = cleanText.split(/\s+/).filter(p => p.trim() !== "");
    
    if (parts.length > 1 && !cleanText.toLowerCase().includes("ready")) {
        parts.forEach((part, index) => {
            const item = document.createElement('div');
            let fontSize = 'text-3xl';
            if (parts.length > 2) fontSize = 'text-2xl';
            if (parts.length > 4) fontSize = 'text-xl';
            
            item.className = `font-black uppercase tracking-tight py-1 ${theme.text} ${fontSize}`;
            item.textContent = part.trim();
            output.appendChild(item);
            
            if (index < parts.length - 1) {
                const divider = document.createElement('div');
                divider.className = `w-8 h-0.5 my-1 opacity-20 ${key === 'white' ? 'bg-black' : 'bg-white'}`;
                output.appendChild(divider);
            }
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
        displayResult('Ready', 'default');
    });
}
