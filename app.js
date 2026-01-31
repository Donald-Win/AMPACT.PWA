/**
 * AMPACT Selector - v6.1.0
 * Created and Maintained by Donald Win
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = []; 
let selection1 = '';
let selection2 = '';
const APP_VERSION = "v6.1.0";

const colorThemes = {
    'blue': { body: '#2563eb', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800' },
    'yellow': { body: '#facc15', bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-600' },
    'white': { body: '#ffffff', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300' },
    'red': { body: '#dc2626', bg: 'bg-red-600', text: 'text-white', border: 'border-red-800' },
    'copper': { body: '#b87333', bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#7d4e22]' },
    'default': { body: '#f3f4f6', bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-white' }
};

document.addEventListener('DOMContentLoaded', initApp);

function normalize(str) {
    if (!str) return "";
    return str.toString().toLowerCase().replace(/\s+/g, '').replace(/[^\w\d]/g, '').trim();
}

function getDiameter(name) {
    if (!name) return 0;
    const match = name.match(/\(([\d.]+)\s*mm/);
    return match ? parseFloat(match[1]) : 0;
}

function cleanCell(val) {
    if (val === undefined || val === null) return "";
    return val.toString().trim();
}

async function initApp() {
    setupEventListeners();
    const vTag = document.getElementById('version-tag');
    if (vTag) vTag.textContent = `${APP_VERSION} (STABLE)`;
    await loadExcelData();
    setupPWA();
}

async function loadExcelData() {
    try {
        const response = await fetch(`data.xlsx?t=${Date.now()}`);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        
        let rawOptionsMap = new Map();
        workbook.SheetNames.forEach(sheetName => {
            const lowName = sheetName.toLowerCase();
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            const headers = rows[0]?.map(h => cleanCell(h)) || [];
            
            let theme = 'default';
            if (lowName.includes('yellow')) theme = 'yellow';
            else if (lowName.includes('blue')) theme = 'blue';
            else if (lowName.includes('white')) theme = 'white';
            else if (lowName.includes('red')) theme = 'red';
            else if (lowName.includes('copper')) theme = 'copper';

            for (let r = 1; r < rows.length; r++) {
                const rowData = rows[r];
                const rawTap = cleanCell(rowData[0]);
                if (!rawTap || rawTap.toLowerCase().includes('cable size')) continue;
                const nTap = normalize(rawTap);
                if (!rawOptionsMap.has(nTap)) rawOptionsMap.set(nTap, rawTap);

                for (let c = 1; c < headers.length; c++) {
                    const rawStirrup = headers[c];
                    if (!rawStirrup || rawStirrup.toLowerCase().includes('cable size')) continue;
                    const nStirrup = normalize(rawStirrup);
                    if (!rawOptionsMap.has(nStirrup)) rawOptionsMap.set(nStirrup, rawStirrup);

                    const val = cleanCell(rowData[c]);
                    if (val) {
                        const key = `${nTap}|${nStirrup}`;
                        if (lowName.includes('copper')) copperDatabase[key] = val;
                        else themedDatabase[key] = { value: val, theme: theme };
                    }
                }
            }
        });

        conductorOptions = Array.from(rawOptionsMap.values()).sort();
        updateDropdowns();
    } catch (e) {
        console.error(e);
    }
}

function calculate() {
    if (!selection1 || !selection2) {
        displayResult('Ready', 'default', false);
        return;
    }

    const n1 = normalize(selection1), n2 = normalize(selection2);
    const d1 = getDiameter(selection1), d2 = getDiameter(selection2);
    const pairs = d1 >= d2 ? [`${n1}|${n2}`, `${n2}|${n1}`] : [`${n2}|${n1}`, `${n1}|${n2}`];

    let val = "", theme = "";
    for (let key of pairs) {
        if (themedDatabase[key]) {
            val = themedDatabase[key].value;
            theme = themedDatabase[key].theme;
            break;
        }
    }

    if (val.toLowerCase().includes("copper") || val.toLowerCase().includes("refer") || !val) {
        for (let key of pairs) {
            if (copperDatabase[key]) {
                val = copperDatabase[key];
                theme = 'copper';
                break;
            }
        }
    }

    if (val) displayResult(val, theme, true);
    else displayResult('No Match', 'default', false);
}

function updateDropdowns() {
    const f1 = document.getElementById('tap-search').value.toLowerCase();
    const f2 = document.getElementById('stirrup-search').value.toLowerCase();
    const s1 = document.getElementById('tap-select'), s2 = document.getElementById('stirrup-select');
    
    // Save current values so filtering doesn't reset selection
    const v1 = s1.value, v2 = s2.value;

    s1.innerHTML = '<option value="">Select Conductor...</option>';
    s2.innerHTML = '<option value="">Select Conductor...</option>';

    conductorOptions.forEach(name => {
        const n = name.toLowerCase();
        if (n.includes(f1)) s1.add(new Option(name, name));
        if (n.includes(f2)) s2.add(new Option(name, name));
    });

    s1.value = v1; s2.value = v2;
}

function displayResult(text, key, shouldFlash) {
    const output = document.getElementById('output');
    const box = document.getElementById('output-box');
    const body = document.getElementById('body-bg');
    const theme = colorThemes[key] || colorThemes.default;
    
    body.style.backgroundColor = theme.body;
    box.classList.remove('flash-success');
    if (shouldFlash) {
        void box.offsetWidth; 
        box.classList.add('flash-success');
    }

    box.className = `p-4 rounded-3xl border-4 text-center min-h-[180px] w-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 ${theme.bg} ${theme.border}`;
    
    let displayStr = text;
    if (key === 'copper') {
        displayStr = text.replace(/copper|cu|see|sheet|chart|refer/gi, '').trim();
    }

    output.innerHTML = '';
    const parts = displayStr.split(/\s+/).filter(p => p.trim() !== "");
    if (parts.length > 1 && !displayStr.toLowerCase().includes("ready")) {
        const cont = document.createElement('div');
        cont.className = "flex flex-col gap-1 w-full items-center";
        parts.forEach(p => {
            const d = document.createElement('div');
            d.className = `font-black uppercase tracking-tight ${theme.text} ${parts.length > 3 ? 'text-xl' : 'text-3xl'}`;
            d.textContent = p;
            cont.appendChild(d);
        });
        output.appendChild(cont);
    } else {
        const d = document.createElement('div');
        d.className = `font-black uppercase ${theme.text} ${displayStr.length > 15 ? 'text-xl' : 'text-4xl'}`;
        d.textContent = displayStr;
        output.appendChild(d);
    }
}

function setupEventListeners() {
    document.getElementById('tap-search').addEventListener('input', updateDropdowns);
    document.getElementById('stirrup-search').addEventListener('input', updateDropdowns);
    document.getElementById('tap-select').addEventListener('change', (e) => { selection1 = e.target.value; calculate(); });
    document.getElementById('stirrup-select').addEventListener('change', (e) => { selection2 = e.target.value; calculate(); });
    document.getElementById('reset-button').addEventListener('click', () => {
        selection1 = ''; selection2 = '';
        document.getElementById('tap-search').value = '';
        document.getElementById('stirrup-search').value = '';
        updateDropdowns();
        displayResult('Ready', 'default', false);
    });
}

function setupPWA() {
    let deferredPrompt;
    const installBtn = document.getElementById('install-btn');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.classList.remove('hidden');
    });
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') installBtn.classList.add('hidden');
            deferredPrompt = null;
        }
    });
}
