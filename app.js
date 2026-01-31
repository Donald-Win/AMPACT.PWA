/**
 * Ducky's AMPACT Selector - v4.2.0
 * Feature: Enhanced Excel Parsing for Multiple Tabs & Theme Colors
 */
let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt = null;

// Mapping Excel Colors (Hex or Theme-based index) to App Themes
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
    // Excel Theme indices often used for standard colors
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

async function loadExcelData() {
    try {
        const response = await fetch(`data.xlsx?t=${Date.now()}`);
        if (!response.ok) throw new Error("data.xlsx not found");
        
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellStyles: true });
        
        // Target the specific "Main" sheet if it exists, otherwise use the first one
        const mainSheetName = workbook.SheetNames.find(n => n.includes('Main') || n.includes('x-ref')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[mainSheetName];
        
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const rows = [];
        const headers = [];

        // 1. Clean Headers
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
            // Remove \n and extra spaces from headers
            const headerText = cell ? cell.v.toString().replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() : `Col${C}`;
            headers.push(headerText);
        }

        // 2. Extract Data and Styles
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const rowData = { _styles: {} };
            let hasData = false;
            
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = worksheet[cellAddress];
                const header = headers[C];
                
                let val = cell ? cell.v : "";
                if (typeof val === 'string') {
                    val = val.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
                }
                
                rowData[header] = val;
                if (val !== "") hasData = true;
                
                // Style Extraction
                if (cell && cell.s && cell.s.fill) {
                    if (cell.s.fill.fgColor) {
                        // Priority 1: Hex RGB
                        if (cell.s.fill.fgColor.rgb) {
                            rowData._styles[header] = cell.s.fill.fgColor.rgb;
                        } 
                        // Priority 2: Theme Index
                        else if (cell.s.fill.fgColor.theme !== undefined) {
                            rowData._styles[header] = `theme-${cell.s.fill.fgColor.theme}`;
                        }
                    }
                }
            }
            if (hasData) rows.push(rowData);
        }

        spreadsheetData = rows;
        updateDropdown('tap', '');
        updateDropdown('stirrup', '');
        displayResult('Ready', 'default');
    } catch (e) {
        console.error("Excel Parsing Error:", e);
        displayResult('Excel Error', 'default');
    }
}

function calculate() {
    if (!tapSelection || !stirrupSelection) {
        displayResult('Ready', 'default');
        return;
    }

    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const row = spreadsheetData.find(r => String(r[conductorKey]).trim() === tapSelection.trim());

    if (!row) {
        displayResult('No Match', 'default');
        return;
    }

    const value = row[stirrupSelection];
    const styleKey = row._styles[stirrupSelection];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
        let themeKey = 'default';

        // 1. Check colorMap for Hex or Theme index
        if (styleKey && colorMap[styleKey]) {
            themeKey = colorMap[styleKey];
        } 
        // 2. Fallback: Word detection (for copper/blue/etc written in cell)
        else {
            const lowVal = String(value).toLowerCase();
            if (lowVal.includes('blue')) themeKey = 'blue';
            else if (lowVal.includes('yellow')) themeKey = 'yellow';
            else if (lowVal.includes('red')) themeKey = 'red';
            else if (lowVal.includes('white')) themeKey = 'white';
            else if (lowVal.includes('copper')) themeKey = 'copper';
        }

        const cleanVal = String(value).replace(/\b(blue|yellow|white|red|copper)\b/gi, '').trim();
        displayResult(cleanVal, themeKey);
    } else {
        displayResult('No Match', 'default');
    }
}

function updateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    if (!spreadsheetData.length) return;
    
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const prev = select.value;
    select.innerHTML = '';
    
    // Create a list of all column headers for the "Stirrup" (Small Side) dropdown
    if (type === 'stirrup') {
        const headers = Object.keys(spreadsheetData[0]).filter(k => k !== '_styles' && k !== conductorKey);
        const promptOpt = document.createElement('option');
        promptOpt.value = "";
        promptOpt.textContent = "Select Conductor...";
        select.appendChild(promptOpt);

        headers.filter(h => h.toLowerCase().includes(query.toLowerCase())).forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            select.appendChild(opt);
        });
    } else {
        // Handle "Tap" (Large Side) dropdown from the first column values
        const filtered = spreadsheetData.filter(row => 
            String(row[conductorKey] || "").toLowerCase().includes(query.toLowerCase())
        );
        const promptOpt = document.createElement('option');
        promptOpt.value = "";
        promptOpt.textContent = "Select Conductor...";
        select.appendChild(promptOpt);

        filtered.forEach(row => {
            const val = String(row[conductorKey]).trim();
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
    }

    if (prev && Array.from(select.options).some(o => o.value === prev)) select.value = prev;
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const githubLink = document.getElementById('github-link');
    const versionDisp = document.getElementById('version-display');
    const theme = colorThemes[key] || colorThemes['default'];
    
    body.style.backgroundColor = theme.body;
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    
    if (text.length > 15) output.className = `text-lg font-black uppercase text-center ${theme.text}`;
    else if (text.length > 10) output.className = `text-2xl font-black uppercase text-center ${theme.text}`;
    else output.className = `text-3xl font-black uppercase tracking-widest text-center ${theme.text}`;
    
    output.textContent = text;

    const isDark = (key === 'blue' || key === 'red' || key === 'copper');
    if (githubLink) githubLink.style.color = isDark ? '#fff' : '';
    if (versionDisp) versionDisp.style.color = isDark ? '#fff' : '';
}

function setupEventListeners() {
    document.getElementById('tap-search').addEventListener('input', (e) => updateDropdown('tap', e.target.value));
    document.getElementById('stirrup-search').addEventListener('input', (e) => updateDropdown('stirrup', e.target.value));
    document.getElementById('tap-select').addEventListener('change', (e) => { tapSelection = e.target.value; calculate(); });
    document.getElementById('stirrup-select').addEventListener('change', (e) => { stirrupSelection = e.target.value; calculate(); });
    document.getElementById('reset-button').addEventListener('click', resetAll);
}

function resetAll() {
    tapSelection = ''; stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
    updateDropdown('tap', '');
    updateDropdown('stirrup', '');
    displayResult('Ready', 'default');
}
