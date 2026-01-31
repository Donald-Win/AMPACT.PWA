/**
 * AMPACT Selector - v6.3.1
 * Created and Maintained by Donald Win
 */
let themedDatabase = {}; 
let copperDatabase = {}; 
let conductorOptions = []; 
let selection1 = '';
let selection2 = '';
let deferredPrompt = null;
const APP_VERSION = "v6.3.1";

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
    if (vTag) vTag.textContent = `${APP_VERSION}`;
    await loadExcelData();
    setupPWA();
}

async function loadExcelData() {
    try {
        const response = await fetch(`data.xlsx?t=${Date.now()}`);
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
                    if (val) {
                        const key = `${nTap}|${nStirrup}`;
                        if (isCopperSheet) copperDatabase[key] = val;
                        else themedDatabase[key] = { value: val, theme: theme };
                    }
                }
            }
        });

        conductorOptions = Array.from(rawOptionsMap.values()).sort();
        updateList('tap', '');
        updateList('stirrup', '');
        displayResult('Ready', 'default', false);
    } catch (e) {
        displayResult('EXCEL ERROR', 'default', false);
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

function updateList(type, filter) {
    const listEl = document.getElementById(`${type}-list`);
    const inputEl = document.getElementById(`${type}-search`);
    const clearBtn = document.getElementById(`${type}-clear`);
    
    if (clearBtn) clearBtn.classList.toggle('hidden', !filter);
    if (!listEl) return;

    listEl.innerHTML = '';
    const f = filter.toLowerCase();
    const matches = conductorOptions.filter(name => name.toLowerCase().includes(f));

    if (matches.length === 0) {
        const div = document.createElement('div');
        div.className = "p-3 text-gray-500 italic text-sm";
        div.textContent = "No matches found";
        listEl.appendChild(div);
    } else {
        matches.forEach(name => {
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-gray-800 font-bold text-sm";
            div.textContent = name;
            div.onclick = () => {
                inputEl.value = name;
                if (type === 'tap') selection1 = name;
                else selection2 = name;
                listEl.classList.add('hidden'); 
                updateList(type, name); // Refresh clear button
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
    if (key === 'copper') displayStr = text.replace(/copper|cu|see|sheet|chart|refer/gi, '').trim();
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
        d.textContent = displayStr || "CHECK CHART";
        output.appendChild(d);
    }
}

function setupEventListeners() {
    ['tap', 'stirrup'].forEach(type => {
        const input = document.getElementById(`${type}-search`);
        const list = document.getElementById(`${type}-list`);
        const clear = document.getElementById(`${type}-clear`);

        input.addEventListener('input', (e) => {
            updateList(type, e.target.value);
            list.classList.remove('hidden');
        });
        input.addEventListener('focus', () => {
            updateList(type, input.value);
            list.classList.remove('hidden');
        });
        clear.addEventListener('click', () => {
            input.value = '';
            if (type === 'tap') selection1 = ''; else selection2 = '';
            updateList(type, '');
            input.focus();
            calculate();
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tap-container')) document.getElementById('tap-list').classList.add('hidden');
        if (!e.target.closest('#stirrup-container')) document.getElementById('stirrup-list').classList.add('hidden');
    });

    document.getElementById('reset-button').addEventListener('click', () => {
        ['tap', 'stirrup'].forEach(type => {
            document.getElementById(`${type}-search`).value = '';
            document.getElementById(`${type}-clear`).classList.add('hidden');
        });
        selection1 = ''; selection2 = '';
        displayResult('Ready', 'default', false);
    });
}

function setupPWA() {
    const installBtn = document.getElementById('install-btn');
    const iosInstr = document.getElementById('ios-install-instructions');
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos && !window.matchMedia('(display-mode: standalone)').matches) {
        if (iosInstr) iosInstr.classList.remove('hidden');
    }
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.classList.remove('hidden');
    });
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') installBtn.classList.add('hidden');
                deferredPrompt = null;
            } else {
                alert("Use your browser menu to 'Add to Home Screen'.");
            }
        });
    }
}
```eof

```html:AMPACT Selector UI:index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#2563eb">
    <title>AMPACT Selector</title>
    <link rel="manifest" href="manifest.json">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }
        .flash-success { animation: flash-green 0.6s ease-out; }
        @keyframes flash-green {
            0% { background-color: #22c55e; border-color: #166534; transform: scale(1); }
            50% { transform: scale(1.08); }
            100% { transform: scale(1); }
        }
        .custom-list::-webkit-scrollbar { width: 6px; }
        .custom-list::-webkit-scrollbar-thumb { background: #888; border-radius: 3px; }
    </style>
</head>
<body id="body-bg" class="min-h-screen flex flex-col items-center p-4 transition-colors duration-500">

    <div class="w-full max-w-md mt-4">
        <div class="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-gray-100">
            <header class="text-center mb-8">
                <h1 class="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-1 whitespace-nowrap">AMPACT Selector</h1>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Created and Maintained by Donald Win</p>
            </header>

            <div class="space-y-6">
                <div id="tap-container" class="relative">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Conductor 1</label>
                    <div class="relative">
                        <input type="text" id="tap-search" placeholder="Search..." autocomplete="off"
                            class="w-full pl-4 pr-10 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none text-sm font-medium focus:border-blue-500 focus:bg-white transition-all cursor-pointer">
                        <button id="tap-clear" class="hidden absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                    </div>
                    <div id="tap-list" class="hidden absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto custom-list"></div>
                </div>

                <div id="stirrup-container" class="relative">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Conductor 2</label>
                    <div class="relative">
                        <input type="text" id="stirrup-search" placeholder="Search..." autocomplete="off"
                            class="w-full pl-4 pr-10 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none text-sm font-medium focus:border-blue-500 focus:bg-white transition-all cursor-pointer">
                        <button id="stirrup-clear" class="hidden absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                    </div>
                    <div id="stirrup-list" class="hidden absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto custom-list"></div>
                </div>

                <div id="output-box" class="bg-gray-50 border-gray-200 border-4">
                    <div id="output">
                        <div class="text-gray-300 font-black text-4xl uppercase tracking-tighter">READY</div>
                    </div>
                </div>

                <button id="reset-button" class="w-full py-2 text-gray-400 font-black uppercase tracking-widest text-[10px] hover:text-gray-600">Clear All</button>
            </div>
        </div>
    </div>

    <div class="w-full max-w-md mt-6 space-y-3">
        <button id="install-btn" class="hidden w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-transform">
            Install App
        </button>
        
        <div id="ios-install-instructions" class="hidden bg-white/90 backdrop-blur rounded-2xl p-4 text-center border border-gray-200 shadow-lg">
             <p class="text-gray-600 text-xs font-bold uppercase tracking-wide">Install on iOS</p>
             <p class="text-gray-500 text-sm mt-1">Tap <span class="font-bold text-blue-500">Share</span> then <span class="font-bold text-gray-700">Add to Home Screen</span></p>
        </div>

        <footer class="bg-black/80 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 shadow-lg">
            <a href="https://github.com/donald-win/AMPACT.PWA" target="_blank" class="text-white hover:text-blue-400 text-[10px] font-bold uppercase tracking-widest transition-colors block mb-1">GitHub: AMPACT.PWA</a>
            <div id="version-tag" class="text-white/40 text-[10px] font-black uppercase tracking-widest">v6.3.1</div>
        </footer>
    </div>

    <script src="app.js"></script>
</body>
</html>
```eof

Would you like me to adjust the size or position of the clear buttons?
