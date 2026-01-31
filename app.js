/**
 * Ducky's AMPACT Selector - v4.3.0
 * Robust Excel Parsing for Main X-Ref Chart with Multi-line Headers
 */
let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt = null;

// Expanded mapping for Excel colors
const colorMap = {
    'FFFF00': 'yellow',
    'FFFFFF00': 'yellow',
    'FFFF0000': 'red',
    'FF0000FF': 'blue',
    'FF00B0F0': 'blue',
    'FF0070C0': 'blue',
    'FFED7D31': 'copper',
    'FFC00000': 'red',
    'FFFFFFFF': 'white',
    'theme-4': 'blue',
    'theme-5': 'red',
    'theme-6': 'yellow',
    'theme-8': 'copper'
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

async function initApp() {
    setupEventListeners();
    await loadExcelData();
}

/**
 * Normalizes strings by removing newlines, extra spaces, and invisible characters
 */
function cleanString(str) {
    if (!str) return "";
    return str.toString()
        .replace(/\r?\n|\r/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ')      // Collapse multiple spaces
        .trim();                   // Trim edges
}

async function loadExcelData() {
    try {
        const response = await fetch(`data.xlsx?t=${Date.now()}`);
        if (!response.ok) throw new Error("data.xlsx not found");
        
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellStyles: true });
        
        // Priority: Use the main cross-reference chart tab
        const mainSheetName = workbook.SheetNames.find(n => 
            n.toLowerCase().includes('main') || n.toLowerCase().includes('x-ref')
        ) || workbook.SheetNames[0];
        
        const worksheet = workbook.Sheets[mainSheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const rows = [];
        const headers = [];

        // 1. Process Headers (Row 0)
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
            headers.push(cleanString(cell ? cell.v : `Col${C}`));
        }

        // 2. Process Data Rows
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const rowData = { _styles: {} };
            let hasData = false;
            
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = worksheet[cellAddress];
                const header = headers[C];
                
                const val = cell ? cleanString(cell.v) : "";
                rowData[header] = val;
                
                if (val !== "") hasData = true;
                
                // Color Extraction
                if (cell && cell.s && cell.s.fill && cell.s.fill.fgColor) {
                    const fg = cell.s.fill.fgColor;
                    rowData._styles[header] = fg.rgb || (fg.theme !== undefined ? `theme-${fg.theme}` : null);
                }
            }
            if (hasData) rows.push(rowData);
        }

        spreadsheetData = rows;
        updateDropdown('tap', '');
        updateDropdown('stirrup', '');
        displayResult('Ready', 'default');
    } catch (e) {
        console.error("Excel Load Error:", e);
        displayResult('Excel Error', 'default');
    }
}

function updateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    if (!spreadsheetData.length) return;
    
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const prevValue = select.value;
    select.innerHTML = '';
    
    const promptOpt = document.createElement('option');
    promptOpt.value = "";
    promptOpt.textContent = "Select Conductor...";
    select.appendChild(promptOpt);

    const searchLower = query.toLowerCase();

    if (type === 'stirrup') {
        // Headers (except the first one) are the Stirrup options
        const headers = Object.keys(spreadsheetData[0]).filter(k => k !== '_styles' && k !== conductorKey);
        headers.forEach(h => {
            if (h.toLowerCase().includes(searchLower)) {
                const opt = document.createElement('option');
                opt.value = h;
                opt.textContent = h;
                select.appendChild(opt);
            }
        });
    } else {
        // Rows in the first column are the Tap options
        spreadsheetData.forEach(row => {
            const val = row[conductorKey];
            if (val && val.toLowerCase().includes(searchLower)) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                select.appendChild(opt);
            }
        });
    }

    // Try to restore previous selection if it still exists in filtered list
    if (prevValue && Array.from(select.options).some(o => o.value === prevValue)) {
        select.value = prevValue;
    }
}

function calculate() {
    if (!tapSelection || !stirrupSelection) {
        displayResult('Ready', 'default');
        return;
    }

    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const row = spreadsheetData.find(r => r[conductorKey] === tapSelection);

    if (!row) {
        displayResult('No Match', 'default');
        return;
    }

    const value = row[stirrupSelection];
    const styleKey = row._styles[stirrupSelection];

    if (value && value.toString().trim() !== "") {
        let themeKey = 'default';

        if (styleKey && colorMap[styleKey]) {
            themeKey = colorMap[styleKey];
        } else {
            // Text fallback
            const lowVal = value.toLowerCase();
            if (lowVal.includes('blue')) themeKey = 'blue';
            else if (lowVal.includes('yellow')) themeKey = 'yellow';
            else if (lowVal.includes('red')) themeKey = 'red';
            else if (lowVal.includes('white')) themeKey = 'white';
            else if (lowVal.includes('copper')) themeKey = 'copper';
        }

        const cleanVal = value.replace(/\b(blue|yellow|white|red|copper)\b/gi, '').trim();
        displayResult(cleanVal, themeKey);
    } else {
        displayResult('No Match', 'default');
    }
}

function setupEventListeners() {
    document.getElementById('tap-search').addEventListener('input', (e) => updateDropdown('tap', e.target.value));
    document.getElementById('stirrup-search').addEventListener('input', (e) => updateDropdown('stirrup', e.target.value));
    document.getElementById('tap-select').addEventListener('change', (e) => { tapSelection = e.target.value; calculate(); });
    document.getElementById('stirrup-select').addEventListener('change', (e) => { stirrupSelection = e.target.value; calculate(); });
    document.getElementById('reset-button').addEventListener('click', resetAll);
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes['default'];
    
    body.style.backgroundColor = theme.body;
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    
    if (text.length > 20) output.className = `text-base font-black uppercase text-center ${theme.text}`;
    else if (text.length > 12) output.className = `text-xl font-black uppercase text-center ${theme.text}`;
    else output.className = `text-3xl font-black uppercase tracking-widest text-center ${theme.text}`;
    
    output.textContent = text;
}

function resetAll() {
    tapSelection = ''; stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
    updateDropdown('tap', '');
    updateDropdown('stirrup', '');
    displayResult('Ready', 'default');
}
