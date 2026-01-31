/**
 * AMPACT Selector - v6.3.0
 * Created and Maintained by Donald Win
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = []; 
let selection1 = '';
let selection2 = '';
let deferredPrompt = null;
const APP_VERSION = "v6.3.0";

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
    if (typeof val === 'object') return "";
    return val.toString().trim();
}

async function initApp() {
    setupEventListeners();
    const vTag = document.getElementById('version-tag');
    if (vTag) vTag.textContent = `${APP_VERSION} (ULTIMATE)`;
    await loadExcelData();
    setupPWA();
}

async function loadExcelData() {
    try {
        const response = await fetch(`data.xlsx?t=${Date.now()}`);
        if (!response.ok) throw new Error("data.xlsx not found");
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        
        let rawOptionsMap = new Map();
        themedDatabase = {};
        copperDatabase = {};

        workbook.SheetNames.forEach(sheetName => {
            const lowName = sheetName.toLowerCase();
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            if (rows.length < 1) return;

            const headers = rows[0].map(h => cleanCell(h));
            const isCopperSheet = lowName.includes('copper');
            
            let theme = 'default';
            if (lowName.includes('yellow')) theme = 'yellow';
            else if (lowName.includes('blue')) theme = 'blue';
            else if (lowName.includes('white')) theme = 'white';
            else if (lowName.includes('red')) theme = 'red';
            else if (isCopperSheet) theme = 'copper';

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
                    if (val && val !== "") {
                        const key = `${nTap}|${nStirrup}`;
                        if (isCopperSheet) {
                            copperDatabase[key] = val;
                        } else {
                            themedDatabase[key] = { value: val, theme: theme };
                        }
                    }
                }
            }
        });

        conductorOptions = Array.from(rawOptionsMap.values()).sort();
        // Populate lists initially so they are ready to show
        updateList('tap', '');
        updateList('stirrup', '');
        
        displayResult('Ready', 'default', false);
    } catch (e) {
        console.error("Load Error:", e);
        displayResult('EXCEL ERROR', 'default', false);
    }
}

function calculate() {
    if (!selection1 || !selection2) {
        displayResult('Ready', 'default', false);
        return;
    }

    const n1 = normalize(selection1);
    const n2 = normalize(selection2);
    const d1 = getDiameter(selection1);
    const d2 = getDiameter(selection2);

    const pairs = d1 >= d2 ? [`${n1}|${n2}`, `${n2}|${n1}`] : [`${n2}|${n1}`, `${n1}|${n2}`];

    let val = "";
    let theme = "";

    for (let key of pairs) {
        const entry = themedDatabase[key];
        if (entry) {
            val = entry.value;
            theme = entry.theme;
            break;
        }
    }

    const isCopRef = val.toLowerCase().includes("copper") || val.toLowerCase().includes("refer");
    if (isCopRef || !val) {
        for (let key of pairs) {
            if (copperDatabase[key]) {
                val = copperDatabase[key];
                theme = 'copper';
                break;
            }
        }
    }

    if (val) {
        displayResult(val, theme, true);
    } else {
        displayResult('No Match', 'default', false);
    }
}

function updateList(type, filter) {
    const listEl = document.getElementById(`${type}-list`);
    const inputEl = document.getElementById(`${type}-search`);
    if (!listEl) return;

    listEl.innerHTML = '';
    const f = filter.toLowerCase();
    const matches = conductorOptions.filter(name => name.toLowerCase().includes(f));

    if (matches.length === 0) {
        // Option to show "No matches" or just hide
        const div = document.createElement('div');
        div.className = "p-3 text-gray-500 italic text-sm";
        div.textContent = "No matches found";
        listEl.appendChild(div);
    } else {
        matches.forEach(name => {
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-gray-800 font-bold text-sm transition-colors";
            div.textContent = name;
            div.onclick = () => {
                inputEl.value = name;
                if (type === 'tap') selection1 = name;
                else selection2 = name;
                listEl.classList.add('hidden'); 
                calculate();
            };
            listEl.appendChild(div);
        });
    }
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
        if (!displayStr) displayStr = "CHECK CHART";
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
    const tInput = document.getElementById('tap-search');
    const sInput = document.getElementById('stirrup-search');
    const tList = document.getElementById('tap-list');
    const sList = document.getElementById('stirrup-list');

    // Input handlers
    tInput.addEventListener('input', (e) => {
        updateList('tap', e.target.value);
        tList.classList.remove('hidden');
    });
    sInput.addEventListener('input', (e) => {
        updateList('stirrup', e.target.value);
        sList.classList.remove('hidden');
    });

    // Focus handlers - Show list immediately on click/focus
    tInput.addEventListener('focus', () => {
        updateList('tap', tInput.value); // Ensure list is current
        tList.classList.remove('hidden');
    });
    sInput.addEventListener('focus', () => {
        updateList('stirrup', sInput.value);
        sList.classList.remove('hidden');
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tap-container')) tList.classList.add('hidden');
        if (!e.target.closest('#stirrup-container')) sList.classList.add('hidden');
    });

    document.getElementById('reset-button').addEventListener('click', () => {
        selection1 = ''; selection2 = '';
        tInput.value = ''; sInput.value = '';
        tList.classList.add('hidden');
        sList.classList.add('hidden');
        displayResult('Ready', 'default', false);
    });
}

function setupPWA() {
    const installBtn = document.getElementById('install-btn');
    const iosInstr = document.getElementById('ios-install-instructions');
    
    // Check if iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isIos && !isStandalone) {
        if (iosInstr) iosInstr.classList.remove('hidden');
    }

    // Android/Desktop Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.style.display = 'block'; // Force visible
        }
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    installBtn.classList.add('hidden');
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            } else {
                alert("To install on this device, please use your browser's menu and select 'Add to Home Screen' or 'Install App'.");
            }
        });
    }
}
