/**
 * Ducky's AMPACT Selector - v5.2.0
 * Multi-Sheet Fallback Engine (Themed -> Copper Redirection)
 */
let themedDatabase = {}; // Maps "Tap|Stirrup" -> { value: "PartNo", theme: "color" }
let copperDatabase = {}; // Separate map for the Copper Taps sheet
let tapOptions = new Set();
let stirrupOptions = new Set();
let tapSelection = '';
let stirrupSelection = '';

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
        tapOptions.clear();
        stirrupOptions.clear();

        workbook.SheetNames.forEach(sheetName => {
            const lowName = sheetName.toLowerCase();
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (rows.length < 1) return;

            const headers = rows[0].map(h => clean(h));
            const isCopperSheet = lowName.includes('copper');
            
            // Determine theme from sheet name
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

                    tapOptions.add(tap);

                    for (let c = 1; c < headers.length; c++) {
                        const stirrup = headers[c];
                        if (!stirrup) continue;
                        
                        stirrupOptions.add(stirrup);
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
    if (!tapSelection || !stirrupSelection) {
        displayResult('Ready', 'default');
        return;
    }

    const key = `${tapSelection}|${stirrupSelection}`;
    const entry = themedDatabase[key];

    if (entry) {
        let text = entry.value;
        let theme = entry.theme;

        // LOGIC: If themed sheet says "Refer Copper", pull from Copper database
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
        // Direct Copper lookup fallback (for pairs only in copper sheet)
        const copperOnly = copperDatabase[key];
        if (copperOnly) {
            displayResult(copperOnly, 'copper');
        } else {
            displayResult('No Match', 'default');
        }
    }
}

function updateDropdowns(tapFilter, stirrupFilter) {
    const tapSelect = document.getElementById('tap-select');
    const stirrupSelect = document.getElementById('stirrup-select');
    const oldTap = tapSelect.value;
    const oldStirrup = stirrupSelect.value;

    tapSelect.innerHTML = '<option value="">Select Tap Conductor...</option>';
    [...tapOptions].sort().forEach(tap => {
        if (tap.toLowerCase().includes(tapFilter.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = tap;
            tapSelect.appendChild(opt);
        }
    });

    stirrupSelect.innerHTML = '<option value="">Select Stirrup Conductor...</option>';
    [...stirrupOptions].sort().forEach(stirrup => {
        if (stirrup.toLowerCase().includes(stirrupFilter.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = stirrup;
            stirrupSelect.appendChild(opt);
        }
    });

    tapSelect.value = oldTap;
    stirrupSelect.value = oldStirrup;
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    
    if (text.length > 25) output.className = `font-black uppercase text-center ${theme.text} text-xs`;
    else if (text.length > 18) output.className = `font-black uppercase text-center ${theme.text} text-base`;
    else if (text.length > 10) output.className = `font-black uppercase text-center ${theme.text} text-2xl`;
    else output.className = `font-black uppercase text-center ${theme.text} text-3xl`;
    
    output.textContent = text;
}

function setupEventListeners() {
    document.getElementById('tap-search').addEventListener('input', e => updateDropdowns(e.target.value, document.getElementById('stirrup-search').value));
    document.getElementById('stirrup-search').addEventListener('input', e => updateDropdowns(document.getElementById('tap-search').value, e.target.value));
    document.getElementById('tap-select').addEventListener('change', e => { tapSelection = e.target.value; calculate(); });
    document.getElementById('stirrup-select').addEventListener('change', e => { stirrupSelection = e.target.value; calculate(); });
    document.getElementById('reset-button').addEventListener('click', () => {
        tapSelection = ''; stirrupSelection = '';
        document.getElementById('tap-search').value = '';
        document.getElementById('stirrup-search').value = '';
        updateDropdowns('', '');
        displayResult('Ready', 'default');
    });
}
