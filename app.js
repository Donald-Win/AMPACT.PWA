/**
 * Ducky's AMPACT Selector - v4.1.0
 * Feature: Automatic Theme Detection from Excel Cell Colors
 */
let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let deferredPrompt = null;

// Mapping Excel Hex Colors to App Themes
const colorMap = {
    'FFFF00': 'yellow',  // Yellow
    'FFFFFF00': 'yellow',
    'FFFF0000': 'red',   // Red
    'FF0000FF': 'blue',  // Blue
    'FF00B0F0': 'blue',  // Cyan/Light Blue
    'FF0070C0': 'blue',  // Darker Blue
    'FFED7D31': 'copper',// Orange/Copper
    'FFC00000': 'red',   // Dark Red
    'FFFFFFFF': 'white', // White
    'FF000000': 'default'
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
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const rows = [];
        const headers = [];

        // Identify Headers (Row 0)
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
            const headerText = cell ? cell.v.toString().replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() : `Col${C}`;
            headers.push(headerText);
        }

        // Process Data Rows
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
                
                // Extract Background Color
                if (cell && cell.s && cell.s.fill && cell.s.fill.fgColor) {
                    rowData._styles[header] = cell.s.fill.fgColor.rgb || cell.s.fill.fgColor.theme;
                }
            }
            if (hasData) rows.push(rowData);
        }

        spreadsheetData = rows;
        updateDropdown('tap', '');
        updateDropdown('stirrup', '');
        displayResult('Ready', 'default');
    } catch (e) {
        console.error(e);
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
    const hexColor = row._styles[stirrupSelection];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
        let themeKey = 'default';

        // 1. Theme by Excel Hex
        if (hexColor && colorMap[hexColor]) {
            themeKey = colorMap[hexColor];
        } 
        // 2. Fallback: Word detection
        else {
            const lowVal = String(value).toLowerCase();
            if (lowVal.includes('blue')) themeKey = 'blue';
            else if (lowVal.includes('yellow')) themeKey = 'yellow';
            else if (lowVal.includes('red')) themeKey = 'red';
            else if (lowVal.includes('white')) themeKey = 'white';
            else if (lowVal.includes('copper')) themeKey = 'copper';
        }

        // Clean text output
        const cleanVal = String(value).replace(/\b(blue|yellow|white|red|copper)\b/gi, '').trim();
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
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('install-button').style.display = 'block';
    });

    document.getElementById('install-button').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            document.getElementById('install-button').style.display = 'none';
        }
    });
}

function updateDropdown(type, query) {
    const select = document.getElementById(`${type}-select`);
    if (!spreadsheetData.length) return;
    
    const conductorKey = Object.keys(spreadsheetData[0])[0];
    const prev = select.value;
    select.innerHTML = '';
    
    const filtered = spreadsheetData.filter(row => 
        String(row[conductorKey] || "").toLowerCase().includes(query.toLowerCase())
    );
    
    const promptOpt = document.createElement('option');
    promptOpt.value = "";
    promptOpt.textContent = query ? `Matches for "${query}"...` : "Select Conductor...";
    select.appendChild(promptOpt);
    
    filtered.forEach(row => {
        const val = String(row[conductorKey]).trim();
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
    });

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

function resetAll() {
    tapSelection = ''; stirrupSelection = '';
    document.getElementById('tap-search').value = '';
    document.getElementById('stirrup-search').value = '';
    updateDropdown('tap', '');
    updateDropdown('stirrup', '');
    displayResult('Ready', 'default');
}
