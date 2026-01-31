/**
 * Ducky's AMPACT Selector - v4.5.0
 * Robust Multi-tab Excel Engine with Style Detection
 */
let spreadsheetData = [];
let tapSelection = '';
let stirrupSelection = '';
let conductorHeaderName = "";
let deferredPrompt = null;

const colorMap = {
    'FFFF00': 'yellow', 'FFFFFF00': 'yellow',
    'FFFF0000': 'red', 'FF0000FF': 'blue',
    'FF00B0F0': 'blue', 'FF0070C0': 'blue',
    'FFED7D31': 'copper', 'FFC00000': 'red',
    'FFFFFFFF': 'white', 'theme-4': 'blue',
    'theme-5': 'red', 'theme-6': 'yellow', 'theme-8': 'copper'
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
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellStyles: true });
        
        // Find the Cross-Reference sheet
        const sheetName = workbook.SheetNames.find(n => n.includes('Main') || n.includes('x-ref')) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
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
                if (cell?.s?.fill?.fgColor) {
                    const fg = cell.s.fill.fgColor;
                    rowData._styles[head] = fg.rgb || (fg.theme !== undefined ? `theme-${fg.theme}` : null);
                }
            }
            if (hasContent) rows.push(rowData);
        }
        spreadsheetData = rows;
        updateDropdowns();
    } catch (e) {
        console.error(e);
        displayResult('Load Error', 'default');
    }
}

function updateDropdowns() {
    updateTapOptions('');
    updateStirrupOptions('');
}

function updateTapOptions(filter) {
    const select = document.getElementById('tap-select');
    const val = select.value;
    select.innerHTML = '<option value="">Select Tap Conductor...</option>';
    spreadsheetData.forEach(row => {
        const name = row[conductorHeaderName];
        if (name && name.toLowerCase().includes(filter.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        }
    });
    if (Array.from(select.options).some(o => o.value === val)) select.value = val;
}

function updateStirrupOptions(filter) {
    const select = document.getElementById('stirrup-select');
    const val = select.value;
    select.innerHTML = '<option value="">Select Stirrup Conductor...</option>';
    if (spreadsheetData.length > 0) {
        const heads = Object.keys(spreadsheetData[0]).filter(k => k !== '_styles' && k !== conductorHeaderName);
        heads.forEach(h => {
            if (h.toLowerCase().includes(filter.toLowerCase())) {
                const opt = document.createElement('option');
                opt.value = h;
                opt.textContent = h;
                select.appendChild(opt);
            }
        });
    }
    if (Array.from(select.options).some(o => o.value === val)) select.value = val;
}

function calculate() {
    if (!tapSelection || !stirrupSelection) {
        displayResult('Ready', 'default');
        return;
    }
    const row = spreadsheetData.find(r => r[conductorHeaderName] === tapSelection);
    if (!row) return displayResult('No Match', 'default');

    const result = row[stirrupSelection];
    const style = row._styles[stirrupSelection];

    if (result) {
        let theme = 'default';
        if (style && colorMap[style]) theme = colorMap[style];
        else {
            const low = result.toLowerCase();
            if (low.includes('blue')) theme = 'blue';
            else if (low.includes('yellow')) theme = 'yellow';
            else if (low.includes('red')) theme = 'red';
            else if (low.includes('white')) theme = 'white';
            else if (low.includes('copper')) theme = 'copper';
        }
        const text = result.replace(/\b(blue|yellow|white|red|copper)\b/gi, '').trim();
        displayResult(text || result, theme);
    } else {
        displayResult('No Match', 'default');
    }
}

function displayResult(text, key) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    body.style.backgroundColor = theme.body;
    box.className = `p-8 rounded-2xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${theme.bg} ${theme.border}`;
    output.className = `font-black uppercase text-center ${theme.text} ${text.length > 12 ? 'text-xl' : 'text-3xl'}`;
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
        updateDropdowns();
        displayResult('Ready', 'default');
    });
}
