/**
 * Ducky's AMPACT Selector - v4.8.0
 * Single-Source Engine: Main AMPACT x-ref chart ONLY
 */
let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let conductorHeaderName = "";

const colorMap = {
    // Hex mappings (including Excel's FF prefix for Alpha)
    'FFFF00': 'yellow', 'FFFFFF00': 'yellow',
    'FF0000FF': 'blue', '0000FF': 'blue', 'FF00B0F0': 'blue', '00B0F0': 'blue',
    'FFED7D31': 'copper', 'ED7D31': 'copper', 'B87333': 'copper', 'FFB87333': 'copper',
    'FFFF0000': 'red', 'FF0000': 'red', 'C00000': 'red', 'FFC00000': 'red',
    'FFFFFFFF': 'white', 'FFFFFF': 'white',
    // Excel Standard Theme Indices (Common defaults)
    'theme-4': 'blue',   // Accent 1
    'theme-5': 'red',    // Accent 2
    'theme-6': 'yellow', // Accent 3
    'theme-8': 'copper'  // Accent 5
};

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
        .replace(/\r?\n|\r/g, ' ') // Remove newlines
        .replace(/\s+/g, ' ')      // Remove double spaces
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
        
        // IMPORTANT: cellStyles must be true to read background colors
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
            type: 'array', 
            cellStyles: true 
        });
        
        // Target ONLY the Main chart
        const mainSheetName = workbook.SheetNames.find(n => 
            n.toLowerCase().includes('main') || n.toLowerCase().includes('x-ref')
        ) || workbook.SheetNames[0];
        
        const sheet = workbook.Sheets[mainSheetName];
        const range = XLSX.utils.decode_range(sheet['!ref']);
        
        const headers = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
            headers.push(clean(cell ? cell.v : `Col${C}`));
        }
        conductorHeaderName = headers[0];

        const rows = [];
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const rowData = { _styles: {} };
            let hasContent = false;
            
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = sheet[addr];
                const head = headers[C];
                const val = clean(cell ? cell.v : "");
                
                rowData[head] = val;
                if (val) hasContent = true;

                // Color extraction from cell style
                if (cell && cell.s && cell.s.fill && cell.s.fill.fgColor) {
                    const fg = cell.s.fill.fgColor;
                    if (fg.rgb) {
                        rowData._styles[head] = fg.rgb.toUpperCase();
                    } else if (fg.theme !== undefined) {
                        rowData._styles[head] = `theme-${fg.theme}`;
                    }
                }
            }
            if (hasContent) rows.push(rowData);
        }
        
        spreadsheetData = rows;
        updateTapOptions('');
        updateStirrupOptions('');
        displayResult('Ready', 'default');
    } catch (e) {
        console.error("Excel Error:", e);
        displayResult('Load Error', 'default');
    }
}

function calculate() {
    if (!tapSelection || !stirrupSelection) {
        displayResult('Ready', 'default');
        return;
    }

    const row = spreadsheetData.find(r => r[conductorHeaderName] === tapSelection);
    if (!row) return;

    const result = row[stirrupSelection];
    const styleId = row._styles[stirrupSelection];

    if (result && !result.toLowerCase().includes("refer copper")) {
        let theme = 'default';

        // 1. Match specific Hex or Theme Index
        if (styleId && colorMap[styleId]) {
            theme = colorMap[styleId];
        } 
        // 2. Handle 8-digit Hex (removing Alpha)
        else if (styleId && styleId.length === 8) {
            const hex6 = styleId.substring(2);
            if (colorMap[hex6]) theme = colorMap[hex6];
        }

        displayResult(result, theme);
    } else if (result && result.toLowerCase().includes("refer copper")) {
        displayResult("Check Copper Chart", 'copper');
    } else {
        displayResult('No Match', 'default');
    }
}

function updateTapOptions(filter) {
    const select = document.getElementById('tap-select');
    const prev = select.value;
    select.innerHTML = '<option value="">Select Tap Conductor...</option>';
    spreadsheetData.forEach(row => {
        const name = row[conductorHeaderName];
        if (name && name.toLowerCase().includes(filter.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            select.appendChild(opt);
        }
    });
    if (prev) select.value = prev;
}

function updateStirrupOptions(filter) {
    const select = document.getElementById('stirrup-select');
    const prev = select.value;
    select.innerHTML = '<option value="">Select Stirrup Conductor...</option>';
    if (spreadsheetData.length > 0) {
        const heads = Object.keys(spreadsheetData[0]).filter(k => k !== '_styles' && k !== conductorHeaderName);
        heads.forEach(h => {
            if (h.toLowerCase().includes(filter.toLowerCase())) {
                const opt = document.createElement('option');
                opt.value = h; opt.textContent = h;
                select.appendChild(opt);
            }
        });
    }
    if (prev) select.value = prev;
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    output.className = `font-black uppercase text-center ${theme.text} ${text.length > 15 ? 'text-lg' : 'text-3xl'}`;
    output.textContent = text;
}

function setupEventListeners() {
    document.getElementById('tap-search').addEventListener('input', e => updateTapOptions(e.target.value));
    document.getElementById('stirrup-search').addEventListener('input', e => updateStirrupOptions(e.target.value));
    document.getElementById('tap-select').addEventListener('change', e => { tapSelection = e.target.value; calculate(); });
    document.getElementById('stirrup-select').addEventListener('change', e => { stirrupSelection = e.target.value; calculate(); });
    document.getElementById('reset-button').addEventListener('click', () => {
        tapSelection = ''; stirrupSelection = '';
        document.getElementById('tap-search').value = '';
        document.getElementById('stirrup-search').value = '';
        updateTapOptions(''); updateStirrupOptions('');
        displayResult('Ready', 'default');
    });
}
