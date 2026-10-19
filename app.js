/**
 * AMPACT Selector - v13.6.4
 * Airtable kill-switch with master toggle - SYSTEM-CONTROL record for open/whitelist mode
 */
let dbData = []; 
let conductorOptions = []; 
let selection1 = '';
let selection2 = '';
let deferredPrompt = null;
const APP_VERSION = "v13.6.4";

// Map of conductorName -> material, built once when data loads (see loadData).
// Avoids doing an O(n) dbData.find() scan inside sort comparators.
let conductorMaterialMap = new Map();

// ============================================
// SMALL UTILITIES
// ============================================

// Escapes text that gets interpolated into innerHTML templates.
// dbData comes from a local CSV we control, but this keeps user-facing
// rendering safe if the CSV is ever edited/shared/updated by someone else.
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Simple debounce helper for search inputs.
function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Keeps Tab inside a dialog, calls onEscape on Esc, and returns a release function.
function trapFocus(container, onEscape) {
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const handler = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); onEscape(); return; }
        if (e.key !== 'Tab') return;
        const items = Array.from(container.querySelectorAll(sel))
            .filter(el => !el.disabled && el.getClientRects().length > 0);
        if (items.length === 0) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
}

// ============================================
// CHANGELOG SYSTEM
// ============================================

const CHANGELOG = {
    "v13.2.0": {
        title: "New Feature: Reverse Lookup! 🔍",
        date: "February 2026",
        features: [
            "Added Reverse Lookup mode - enter any AMPACT code (long or short) to see all compatible conductor pairs",
            "Mode toggle buttons let you switch between Find Connector and Reverse Lookup",
            "Reverse lookup respects your hidden conductor settings",
            "Results show color-coded by wedge type",
            "Single-line result display for better readability"
        ]
    },
    "v13.5.1": {
        title: "Under-the-Hood Fixes 🔧",
        date: "July 2026",
        features: [
            "Faster sorting - conductor material lookups no longer re-scan the whole database",
            "Search boxes now debounce while you type for smoother scrolling",
            "Reverse lookup compatible pairs are now sorted alphabetically",
            "Accessibility: pinch-to-zoom restored, screen reader support improved",
            "General stability and consistency fixes"
        ]
    },
    "v13.6.0": {
        title: "Built for the Field 📶",
        date: "October 2026",
        features: [
            "Styling and fonts are now bundled with the app, so it looks right even if you first open it with no signal",
            "Offline access now needs a re-check with the server every 14 days",
            "Long-press the app icon for a Reverse Lookup shortcut",
            "Better maskable home screen icon on Android"
        ]
    },
    "v13.6.1": {
        title: "Update Fixes 🔧",
        date: "October 2026",
        features: [
            "App updates now wait for you to tap Update Now instead of restarting on their own",
            "Version number and a What's New button added to Settings",
            "Fixed updates occasionally picking up out-of-date files"
        ]
    },
    "v13.6.2": {
        title: "What's New Fix 📝",
        date: "October 2026",
        features: [
            "Fixed a bug that stopped the What's New popup (and the automatic changelog after updates) from ever appearing",
            "Popups no longer depend on the stylesheet to display"
        ]
    },
    "v13.6.3": {
        title: "Small Fixes \uD83D\uDD27",
        date: "October 2026",
        features: [
            "\"No Match\" is now clearly visible on a dark background",
            "Editing a conductor box no longer leaves the old result on screen",
            "Switching between Find Connector and Reverse Lookup keeps what you entered"
        ]
    },
    "v13.6.4": {
        title: "Lookup & Accessibility \uD83D\uDD0D",
        date: "October 2026",
        features: [
            "Reverse Lookup also accepts the end of a part number (e.g. 602031-7)",
            "Reverse Lookup now says when compatible pairs are hidden in Settings",
            "Tapping a conductor box that already has a choice shows the full list",
            "Pop-ups and Settings keep keyboard focus inside and close with Esc",
            "Better screen reader support for the conductor lists",
            "Less background network use while the app is minimised",
            "Removed the swap button \u2014 conductor order never changes the result"
        ]
    }
};

// Inline layout for popups so they always overlay the screen, even if the
// compiled stylesheet is missing a class that only appears in JS strings.
const POPUP_OVERLAY_CSS = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(0,0,0,0.6);';
const POPUP_MODAL_CSS = 'background:#fff;border-radius:1.5rem;padding:1.5rem;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);';

function checkAndShowChangelog() {
    const lastSeenVersion = localStorage.getItem('ampact_last_seen_version');
    if (lastSeenVersion !== APP_VERSION && CHANGELOG[APP_VERSION]) {
        displayChangelog(APP_VERSION);
        localStorage.setItem('ampact_last_seen_version', APP_VERSION);
    }
}

// NOTE: named displayChangelog on purpose. A global function called showChangelog
// would be overwritten by the window.showChangelog helper below and recurse forever.
function displayChangelog(version) {
    const changelog = CHANGELOG[version];
    if (!changelog) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'changelog-overlay';
    overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn';
    overlay.style.cssText = POPUP_OVERLAY_CSS;
    overlay.style.animation = 'fadeIn 0.3s ease-out';
    
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl transform animate-slideUp';
    modal.style.cssText = POPUP_MODAL_CSS + 'max-width:28rem;';
    modal.style.animation = 'slideUp 0.4s ease-out';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'changelog-title');
    
    let featuresHTML = changelog.features.map(f => 
        `<li class="flex gap-2 items-start"><span class="text-blue-600 font-black">•</span><span>${escapeHtml(f)}</span></li>`
    ).join('');
    
    modal.innerHTML = `
        <div class="text-center mb-4">
            <div class="text-4xl mb-2">🎉</div>
            <h2 id="changelog-title" class="text-2xl font-black text-gray-900 mb-1">${escapeHtml(changelog.title)}</h2>
            <div class="text-xs text-gray-500 font-bold uppercase tracking-wider">${escapeHtml(changelog.date)} • ${escapeHtml(version)}</div>
        </div>
        <div class="bg-blue-50 rounded-2xl p-4 mb-4">
            <ul class="space-y-2 text-sm text-gray-700">
                ${featuresHTML}
            </ul>
        </div>
        <button id="changelog-close" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all hover:bg-blue-700">
            Got it!
        </button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    if (!document.getElementById('changelog-keyframes')) {
        const style = document.createElement('style');
        style.id = 'changelog-keyframes';
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }
    
    const previouslyFocused = document.activeElement;
    let release = () => {};
    const closeChangelog = () => {
        release();
        overlay.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => overlay.remove(), 300);
        if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
    release = trapFocus(modal, closeChangelog);
    const closeBtn = document.getElementById('changelog-close');
    closeBtn.addEventListener('click', closeChangelog);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeChangelog(); });
    closeBtn.focus();
}

window.showChangelog = () => displayChangelog(APP_VERSION);

let currentMode = 'find';


// ============================================
// PWA INSTALL
// ============================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    if (installBtn) installBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtn = document.getElementById('install-btn');
    if (installBtn) installBtn.classList.add('hidden');
});


// ============================================
// SERVICE WORKER UPDATE DETECTION
// ============================================

function setupUpdateDetection() {
    if (!('serviceWorker' in navigator)) return;
    
    let refreshing = false;
    
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
    
    navigator.serviceWorker.ready.then(registration => {
        registration.update();
        
        if (registration.waiting) {
            showUpdatePrompt(registration.waiting);
        }
        
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdatePrompt(newWorker);
                }
            });
        });
    });
}

function showUpdatePrompt(worker) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    overlay.style.cssText = POPUP_OVERLAY_CSS;
    
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl';
    modal.style.cssText = POPUP_MODAL_CSS + 'max-width:24rem;';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'update-title');
    
    modal.innerHTML = `
        <div class="text-center mb-4">
            <div class="text-4xl mb-2">🔄</div>
            <h2 id="update-title" class="text-xl font-black text-gray-900 mb-2">Update Available!</h2>
            <p class="text-sm text-gray-600">A new version of AMPACT Selector is ready to install.</p>
        </div>
        <div class="space-y-2">
            <button id="update-now" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all hover:bg-blue-700">
                Update Now
            </button>
            <button id="update-later" class="w-full bg-gray-200 text-gray-700 py-3 rounded-2xl font-bold uppercase tracking-wider text-xs active:scale-95 transition-all hover:bg-gray-300">
                Later
            </button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    document.getElementById('update-now').addEventListener('click', () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
    });
    
    const closeUpdate = () => { release(); overlay.remove(); };
    const release = trapFocus(modal, closeUpdate);
    document.getElementById('update-later').addEventListener('click', closeUpdate);
    document.getElementById('update-now').focus();
}

let selectedIndex = -1;
let currentListType = null;

let settings = {
    sortBy: 'name',
    showDiameters: true,
    hiddenConductors: []
};

const colorThemes = {
    'blue': { body: '#2563eb', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700', sub: 'bg-blue-800/60', header: 'text-blue-600' },
    'yellow': { body: '#facc15', bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-500', sub: 'bg-black/20', header: 'text-yellow-500' },
    'white': { body: '#ffffff', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-200', sub: 'bg-gray-200', header: 'text-gray-400' },
    'red': { body: '#dc2626', bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', sub: 'bg-red-800/60', header: 'text-red-600' },
    'copper': { body: '#b87333', bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#945d2a]', sub: 'bg-black/30', header: 'text-[#b87333]' },
    'none': { body: '#4b5563', bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-200', sub: 'hidden', header: 'text-gray-400' },
    'default': { body: '#f3f4f6', bg: 'bg-gray-50', text: 'text-gray-300', border: 'border-gray-100', sub: 'hidden', header: 'text-gray-400' }
};

// ============================================
// ACCESS CONTROL - Cloudflare Worker
// ============================================

const WORKER_URL = 'https://re-former-auth.donald-c-win-2a0.workers.dev';
const WORKER_APP_ID = 'ampact';
const CACHE_KEY = 'ampact_cached_access';
const CACHE_CHECK_KEY = 'ampact_last_check';
const POLL_MS = 45000;
// How long a cached "allowed" result is trusted while offline before the
// device must reconnect and re-verify with the Worker.
const OFFLINE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

let _pollTimer = null;

function startPolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(async () => {
        if (!navigator.onLine || document.visibilityState !== 'visible') return;
        try {
            const result = await checkWorker();
            if (!result.allowed) {
                clearInterval(_pollTimer);
                await showAccessDeniedScreen(getDeviceId(), {
                    title: 'Access Revoked',
                    body: 'Your access to AMPACT Selector has been revoked. Contact Donald Win if you believe this is an error.',
                    showAccessId: true,
                    contactEmail: 'donald.c.win@gmail.com'
                });
            }
        } catch (e) { /* network hiccup */ }
    }, POLL_MS);
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    try {
        const result = await checkWorker();
        if (!result.allowed) {
            if (_pollTimer) clearInterval(_pollTimer);
            await showAccessDeniedScreen(getDeviceId(), {
                title: 'Access Revoked',
                body: 'Your access to AMPACT Selector has been revoked. Contact Donald Win if you believe this is an error.',
                showAccessId: true,
                contactEmail: 'donald.c.win@gmail.com'
            });
        }
    } catch (e) { /* ignore */ }
});

window.addEventListener('online', async () => {
    try {
        const result = await checkWorker();
        if (result.allowed) {
            startPolling();
        } else {
            if (_pollTimer) clearInterval(_pollTimer);
            await showAccessDeniedScreen(getDeviceId(), {
                title: 'Access Revoked',
                body: 'Your access to AMPACT Selector has been revoked. Contact Donald Win if you believe this is an error.',
                showAccessId: true,
                contactEmail: 'donald.c.win@gmail.com'
            });
        }
    } catch (e) { /* ignore */ }
});

// Device ID — shared across all DCW apps via localStorage + cookie backup.
const DEVICE_ID_KEY = 'dcw-device-id';

function generateDeviceId() {
    // Fallback for HTTP (no crypto.randomUUID) and older browsers
    const uuid = (crypto.randomUUID
        ? crypto.randomUUID()
        : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))
    ).replace(/-/g, '').toUpperCase();
    return 'DCW-' + uuid.slice(0, 4) + '-' + uuid.slice(4, 8) + '-' + uuid.slice(8, 12);
}

function isValidDcwId(id) {
    return typeof id === 'string' && /^DCW-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(id);
}

function readIdFromCookie() {
    var match = document.cookie.match(/(?:^|;\s*)dcw-device-id=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function writeIdToCookie(id) {
    var expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
    var secureFlag = (location.protocol === 'https:') ? ';Secure' : '';
    document.cookie = 'dcw-device-id=' + encodeURIComponent(id) + ';expires=' + expires + ';path=/;SameSite=Strict' + secureFlag;
}

function getDeviceId() {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist();
    }

    var id = localStorage.getItem(DEVICE_ID_KEY);

    if (!isValidDcwId(id)) {
        var cookieId = readIdFromCookie();
        if (isValidDcwId(cookieId)) {
            console.log('[AMPACT auth] Restored device ID from cookie backup');
            id = cookieId;
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
    }

    if (!isValidDcwId(id)) {
        id = generateDeviceId();
        console.log('[AMPACT auth] Generated new device ID:', id);
    }

    localStorage.setItem(DEVICE_ID_KEY, id);
    writeIdToCookie(id);

    return id;
}

async function checkWorker() {
    const deviceId = getDeviceId();
    const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceId, app: WORKER_APP_ID }),
        cache: 'no-store'
    });
    if (!res.ok) throw new Error('Worker responded ' + res.status);
    const result = await res.json();
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(
            Object.assign({}, result, { cachedAt: Date.now() })
        ));
        localStorage.setItem(CACHE_CHECK_KEY, new Date().toISOString());
    } catch (e) { /* storage full */ }
    return result;
}

async function checkKillSwitch() {
    const deviceId = getDeviceId();

    if (navigator.onLine) {
        try {
            const result = await checkWorker();
            if (result.allowed) {
                startPolling();
                return true;
            } else {
                await showAccessDeniedScreen(deviceId, {
                    title: 'Access Change Required',
                    body: 'Due to recent changes, this app now requires explicit authorization. If you need continued access, please send your Access ID below to Donald Win.',
                    showAccessId: true,
                    contactEmail: 'donald.c.win@gmail.com'
                });
                return false;
            }
        } catch (err) {
            console.error('Worker check failed:', err.message);
        }
    }

    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const cached = JSON.parse(raw);
            const lastCheck = localStorage.getItem(CACHE_CHECK_KEY);
            console.warn('Using cached access from:', lastCheck);
            const checkedAt = Number(cached.cachedAt) || Date.parse(lastCheck) || 0;
            if (cached.allowed && (Date.now() - checkedAt) > OFFLINE_GRACE_MS) {
                await showAccessDeniedScreen(deviceId, {
                    title: 'Verification Required',
                    body: 'This app needs to go online briefly to re-verify your access. Connect to mobile data or Wi-Fi, then tap Check Access Again.',
                    showAccessId: true,
                    contactEmail: 'donald.c.win@gmail.com',
                    keepCache: true
                });
                return false;
            }
            if (cached.allowed) {
                return true;
            } else {
                await showAccessDeniedScreen(deviceId, {
                    title: 'Access Restricted',
                    body: 'This application requires authorization. You appear to be offline or your access has been revoked.',
                    showAccessId: true,
                    contactEmail: 'donald.c.win@gmail.com'
                });
                return false;
            }
        }
    } catch (e) { /* bad cache */ }

    console.warn('No cache and no network — failing open');
    return true;
}

async function showAccessDeniedScreen(deviceId, messageConfig = {}) {
    // keepCache: used when access just needs re-verifying (not revoked), so the
    // offline copy of the app survives and the retry button still works offline.
    if (!messageConfig.keepCache) {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    const title = messageConfig.title || 'Access Restricted';
    const body = messageConfig.body || 'This application is currently restricted. Please contact the administrator for access.';
    const showAccessId = messageConfig.showAccessId !== false;
    const contactEmail = messageConfig.contactEmail || '';
    
    document.body.innerHTML = `
        <style>
            .access-denied-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .access-card { background: white; border-radius: 24px; padding: 2.5rem; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); }
            .access-icon { font-size: 4rem; text-align: center; margin-bottom: 1.5rem; }
            .access-title { font-size: 1.75rem; font-weight: 900; text-align: center; color: #1f2937; margin-bottom: 1rem; }
            .access-body { font-size: 1rem; color: #4b5563; text-align: center; line-height: 1.6; margin-bottom: 2rem; }
            .access-id-section { background: #f3f4f6; border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem; }
            .access-id-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 0.5rem; }
            .access-id-value { font-size: 1.25rem; font-weight: 900; color: #1f2937; font-family: 'Courier New', monospace; letter-spacing: 0.05em; text-align: center; padding: 0.75rem; background: white; border-radius: 12px; border: 2px solid #e5e7eb; user-select: all; cursor: text; word-break: break-all; }
            .contact-section { text-align: center; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
            .contact-label { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem; }
            .contact-email { display: inline-block; color: #667eea; font-weight: 700; text-decoration: none; padding: 0.5rem 1rem; border-radius: 8px; }
            .retry-button { width: 100%; padding: 0.75rem; background: transparent; color: #6b7280; border: 2px solid #e5e7eb; border-radius: 12px; font-weight: 600; font-size: 0.875rem; cursor: pointer; margin-top: 1rem; }
        </style>
        <div class="access-denied-container">
            <div class="access-card">
                <div class="access-icon">🔐</div>
                <h1 class="access-title">${escapeHtml(title)}</h1>
                <p class="access-body">${escapeHtml(body)}</p>
                ${showAccessId ? `
                    <div class="access-id-section">
                        <div class="access-id-label">Your Access ID</div>
                        <div class="access-id-value">${escapeHtml(deviceId)}</div>
                    </div>
                ` : ''}
                ${contactEmail ? `
                    <div class="contact-section">
                        <div class="contact-label">Contact for access:</div>
                        <a href="mailto:${encodeURIComponent(contactEmail)}?subject=AMPACT Selector Access Request&body=Hello, I would like to request access to the AMPACT Selector app.%0D%0A%0D%0AMy Access ID is: ${encodeURIComponent(deviceId)}%0D%0A%0D%0AThank you." class="contact-email">${escapeHtml(contactEmail)}</a>
                    </div>
                ` : ''}
                <button class="retry-button" onclick="location.reload()">Check Access Again</button>
            </div>
        </div>
    `;
}

function getMyDeviceId() {
    const deviceId = getDeviceId();
    console.log('%cYOUR DEVICE ID: ' + deviceId, 'color: #667eea; font-size: 16px; font-weight: bold; font-family: monospace;');
    return deviceId;
}

function clearKillSwitchCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_CHECK_KEY);
    console.log('Cache cleared. Reload to re-check.');
}

window.getMyDeviceId = getMyDeviceId;
window.clearKillSwitchCache = clearKillSwitchCache;

// ============================================
// MAIN APP INITIALIZATION
// ============================================

window.onload = async () => {
    const isEnabled = await checkKillSwitch();
    if (!isEnabled) return;

    console.log(`AMPACT Selector ${APP_VERSION} initialized.`);
    
    loadSettings();
    showLoadingIndicator();
    await loadData();
    hideLoadingIndicator();
    
    setupEventListeners();
    setupModeToggle();
    // Manifest shortcut: index.html?mode=reverse opens straight into Reverse Lookup
    if (new URLSearchParams(location.search).get('mode') === 'reverse') {
        document.getElementById('mode-reverse').click();
    }
    setupSettingsPanel();
    setupPWA();
    setupUpdateDetection();
    
    checkAndShowChangelog();
};

// ============================================
// SETTINGS FUNCTIONS
// ============================================

function loadSettings() {
    try {
        const saved = localStorage.getItem('ampactSettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            settings = { ...settings, ...parsed };
            if (!Array.isArray(settings.hiddenConductors)) {
                settings.hiddenConductors = [];
            }
        }
    } catch (err) {
        console.warn('Failed to load settings:', err);
    }
    applySettings();
}

function saveSettings() {
    try {
        localStorage.setItem('ampactSettings', JSON.stringify(settings));
    } catch (err) {
        console.warn('Failed to save settings:', err);
    }
}

function applySettings() {
    sortConductorOptions();
    updateSettingsUI();
}

function sortConductorOptions() {
    if (conductorOptions.length === 0) return;
    
    switch (settings.sortBy) {
        case 'size':
            conductorOptions.sort((a, b) => b.dia - a.dia);
            break;
        case 'material':
            conductorOptions.sort((a, b) => {
                const aMaterial = getConductorMaterial(a.name);
                const bMaterial = getConductorMaterial(b.name);
                if (aMaterial === bMaterial) {
                    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                }
                return aMaterial.localeCompare(bMaterial);
            });
            break;
        case 'name':
        default:
            conductorOptions.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            break;
    }
}

// O(1) lookup backed by conductorMaterialMap (built once in loadData),
// instead of re-scanning the entire dbData array on every comparison.
function getConductorMaterial(conductorName) {
    return conductorMaterialMap.get(conductorName) || 'Unknown';
}

function updateSettingsUI() {
    document.querySelectorAll('input[name="sortBy"]').forEach(radio => {
        radio.checked = radio.value === settings.sortBy;
    });
    const showDiaCheckbox = document.getElementById('setting-show-diameters');
    if (showDiaCheckbox) showDiaCheckbox.checked = settings.showDiameters;
    updateConductorVisibilityList();
}

function updateConductorVisibilityList() {
    const container = document.getElementById('conductor-visibility-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    const searchInput = document.getElementById('conductor-visibility-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    const filteredConductors = conductorOptions.filter(opt => 
        searchTerm === '' || opt.name.toLowerCase().includes(searchTerm)
    );
    
    const countDisplay = document.getElementById('conductor-count');
    if (countDisplay) {
        const visibleCount = conductorOptions.filter(opt => !settings.hiddenConductors.includes(opt.name)).length;
        countDisplay.textContent = `${visibleCount} of ${conductorOptions.length} visible`;
    }
    
    const fragment = document.createDocumentFragment();
    filteredConductors.forEach(opt => {
        const isHidden = settings.hiddenConductors.includes(opt.name);
        const div = document.createElement('label');
        div.className = "flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors";
        div.innerHTML = `
            <div class="flex-1">
                <div class="font-bold text-gray-900 text-sm">${escapeHtml(opt.name)}</div>
                ${settings.showDiameters && opt.dia > 0 ? `<div class="text-xs text-gray-500">${escapeHtml(opt.dia)}mm</div>` : ''}
            </div>
            <input type="checkbox" data-conductor="${escapeHtml(opt.name)}" ${isHidden ? '' : 'checked'} class="conductor-visibility-toggle w-5 h-5 text-blue-600 rounded focus:ring-blue-500 focus:ring-2">
        `;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
    
    container.querySelectorAll('.conductor-visibility-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const conductorName = e.target.dataset.conductor;
            const isVisible = e.target.checked;
            if (isVisible) {
                settings.hiddenConductors = settings.hiddenConductors.filter(name => name !== conductorName);
            } else {
                if (!settings.hiddenConductors.includes(conductorName)) {
                    settings.hiddenConductors.push(conductorName);
                }
            }
            saveSettings();
            updateConductorVisibilityList();
        });
    });
}

function setupSettingsPanel() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsClose = document.getElementById('settings-close');
    const settingsOverlay = document.getElementById('settings-overlay');
    
    settingsPanel.setAttribute('role', 'dialog');
    settingsPanel.setAttribute('aria-modal', 'true');
    settingsPanel.setAttribute('aria-label', 'Settings');
    settingsPanel.inert = true; // off-screen panel must not be reachable by Tab or screen readers

    let releaseTrap = () => {};
    const closeSettings = () => {
        releaseTrap();
        releaseTrap = () => {};
        settingsPanel.classList.add('translate-x-full');
        settingsOverlay.classList.add('hidden');
        settingsPanel.inert = true;
        settingsBtn.focus();
    };

    settingsBtn.addEventListener('click', () => {
        settingsPanel.inert = false;
        settingsPanel.classList.remove('translate-x-full');
        settingsOverlay.classList.remove('hidden');
        updateSettingsUI();
        releaseTrap();
        releaseTrap = trapFocus(settingsPanel, closeSettings);
        settingsClose.focus({ preventScroll: true });
    });
    
    settingsClose.addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', closeSettings);

    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = APP_VERSION;
    const whatsNewBtn = document.getElementById('show-changelog-btn');
    if (whatsNewBtn) {
        whatsNewBtn.addEventListener('click', () => {
            closeSettings();
            displayChangelog(APP_VERSION);
        });
    }
    
    document.querySelectorAll('input[name="sortBy"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            settings.sortBy = e.target.value;
            saveSettings();
            applySettings();
        });
    });
    
    const showDiaCheckbox = document.getElementById('setting-show-diameters');
    showDiaCheckbox.addEventListener('change', (e) => {
        settings.showDiameters = e.target.checked;
        saveSettings();
        applySettings();
    });
    
    const visibilitySearch = document.getElementById('conductor-visibility-search');
    if (visibilitySearch) {
        visibilitySearch.addEventListener('input', debounce(() => updateConductorVisibilityList(), 120));
    }
    
    const showAllBtn = document.getElementById('show-all-conductors');
    const hideAllBtn = document.getElementById('hide-all-conductors');
    
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            settings.hiddenConductors = [];
            saveSettings();
            updateConductorVisibilityList();
        });
    }
    
    if (hideAllBtn) {
        hideAllBtn.addEventListener('click', () => {
            settings.hiddenConductors = conductorOptions.map(opt => opt.name);
            saveSettings();
            updateConductorVisibilityList();
        });
    }
}

// ============================================
// LOADING INDICATOR
// ============================================

function showLoadingIndicator() {
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.className = 'fixed inset-0 bg-white z-50 flex items-center justify-center';
    loader.innerHTML = `
        <div class="text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p class="font-bold text-gray-700">Loading Database...</p>
        </div>
    `;
    document.body.appendChild(loader);
}

function hideLoadingIndicator() {
    const loader = document.getElementById('loader');
    if (loader) loader.remove();
}

// ============================================
// DATA LOADING
// ============================================

async function loadData(retries = 3) {
    try {
        const response = await fetch('./data.csv');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const csvText = await response.text();
        if (!csvText || csvText.length < 100) throw new Error('Invalid or empty CSV data received');
        
        const parseCSV = (text) => {
            const rows = [];
            let row = [], field = '', inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') {
                    if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
                    else { inQuotes = !inQuotes; }
                } else if (char === ',' && !inQuotes) {
                    row.push(field.trim()); field = '';
                } else if ((char === '\n' || char === '\r') && !inQuotes) {
                    if (field !== '' || row.length > 0) { row.push(field.trim()); rows.push(row); field = ''; row = []; }
                    if (char === '\r' && text[i + 1] === '\n') i++;
                } else { field += char; }
            }
            if (field !== '' || row.length > 0) { row.push(field.trim()); rows.push(row); }
            return rows;
        };

        const allRows = parseCSV(csvText);
        if (allRows.length < 2) throw new Error('CSV file is empty or has no data rows');

        const headers = allRows[0];
        const conductorMap = new Map();
        const materialMap = new Map();

        dbData = allRows.slice(1).map(row => {
            const entry = {};
            headers.forEach((h, i) => entry[h] = row[i] || '');
            const processConductor = (name, diaStr, material) => {
                if (!name) return;
                const dia = parseFloat(diaStr) || 0;
                if (!conductorMap.has(name) || dia > conductorMap.get(name)) conductorMap.set(name, dia);
                // Record material the first time we see this conductor name.
                // (Data is consistent per-name in practice; last-write is fine as a fallback.)
                if (material && !materialMap.has(name)) materialMap.set(name, material);
            };
            processConductor(entry.Cable_A_Name, entry.Cable_A_Dia_mm, entry.Cable_A_Material);
            processConductor(entry.Cable_B_Name, entry.Cable_B_Dia_mm, entry.Cable_B_Material);
            return entry;
        });

        conductorMaterialMap = materialMap;

        conductorOptions = Array.from(conductorMap.entries())
            .map(([name, dia]) => ({ name, dia }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        
        if (dbData.length === 0 || conductorOptions.length === 0) throw new Error('No valid conductor data found in CSV');
        
        sortConductorOptions();
        console.log(`✓ Loaded ${dbData.length} rows, ${conductorOptions.length} conductors`);
        
    } catch (err) {
        console.error(`Data load failed (${retries} retries remaining):`, err);
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return loadData(retries - 1);
        }
        hideLoadingIndicator();
        document.body.innerHTML = `
            <div class="min-h-screen flex items-center justify-center p-4 bg-gray-100">
                <div class="bg-red-50 border-4 border-red-500 rounded-3xl p-8 max-w-md text-center">
                    <h1 class="text-2xl font-black text-red-600 mb-4">⚠️ Load Error</h1>
                    <p class="text-gray-700 mb-6">Unable to load conductor database. Please check your connection and try again.</p>
                    <button onclick="location.reload()" class="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 active:scale-95 transition-all">Retry</button>
                </div>
            </div>
        `;
        throw err;
    }
}

// ============================================
// CALCULATION & DISPLAY
// ============================================

// Shared by both normal and reverse-lookup result rendering: applies the
// wedge-colour theme to the page background, header, and output box chrome.
function applyTheme(themeKey) {
    const outputBox = document.getElementById('output-box');
    const headerSelector = document.getElementById('header-selector');
    const theme = colorThemes[themeKey] || colorThemes.default;

    document.body.style.backgroundColor = theme.body;
    headerSelector.className = `transition-colors duration-500 ${theme.header}`;
    outputBox.className = `p-4 rounded-[2.5rem] border-4 text-center min-h-[140px] w-full flex flex-col items-center justify-center transition-all duration-300 ${theme.bg} ${theme.border}`;

    return { outputBox, theme };
}

function calculate() {
    if (!selection1 || !selection2) { displayResults([], 'default'); return; }

    const matches = dbData.filter(row => 
        (row.Cable_A_Name === selection1 && row.Cable_B_Name === selection2) ||
        (row.Cable_A_Name === selection2 && row.Cable_B_Name === selection1)
    );

    if (matches.length > 0) {
        const themeKey = (matches[0].Chart_Source || 'default').toLowerCase();
        displayResults(matches, themeKey);
    } else {
        displayResults([], 'none');
    }
}

function displayResults(matches, themeKey) {
    const { outputBox, theme } = applyTheme(themeKey);
    
    if (themeKey === 'default') {
        outputBox.innerHTML = `<div class="font-black uppercase text-gray-300 text-3xl tracking-tighter">Ready</div>`;
        return;
    }
    if (matches.length === 0) {
        outputBox.innerHTML = `<div class="font-black uppercase text-white text-2xl tracking-tighter">No Match</div>`;
        return;
    }

    const uniqueMatches = [];
    const seenParts = new Set();
    matches.forEach(m => {
        if (!seenParts.has(m.Part_Number)) { uniqueMatches.push(m); seenParts.add(m.Part_Number); }
    });

    let html = `<div class="w-full space-y-5">`;
    uniqueMatches.forEach(match => {
        const shortCode = match.NZ_Alpha_Short_Code && match.NZ_Alpha_Short_Code.trim();
        html += `
            <div class="flex flex-row items-center justify-center gap-3 w-full px-2 whitespace-nowrap">
                <div class="font-black uppercase tracking-tighter ${theme.text}" style="font-size: clamp(1.1rem, 5.5vw, 1.875rem);">${escapeHtml(match.Part_Number)}</div>
                ${shortCode ? `<div class="px-4 py-2 rounded-2xl font-black uppercase tracking-tight ${theme.sub} ${theme.text} shadow-sm flex-shrink-0" style="font-size: clamp(1rem, 4.5vw, 1.5rem);">${escapeHtml(shortCode)}</div>` : ''}
            </div>
        `;
    });
    html += `</div>`;
    
    outputBox.innerHTML = html;
    outputBox.classList.add('flash-success');
    setTimeout(() => outputBox.classList.remove('flash-success'), 600);
}

// ============================================
// LIST RENDERING
// ============================================

function renderList(type, filterText) {
    const list = document.getElementById(`${type}-list`);
    const input = document.getElementById(`${type}-search`);
    const filter = filterText.toLowerCase().trim();
    list.innerHTML = '';
    selectedIndex = -1;
    currentListType = type;
    input.removeAttribute('aria-activedescendant');

    const filtered = conductorOptions.filter(opt => 
        opt.name.toLowerCase().includes(filter) && 
        !settings.hiddenConductors.includes(opt.name)
    );

    if (filtered.length > 0) {
        list.classList.remove('hidden');
        input.setAttribute('aria-expanded', 'true');
        const fragment = document.createDocumentFragment();
        filtered.forEach((opt, index) => {
            const div = document.createElement('div');
            div.className = "px-5 py-4 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0 font-bold text-gray-700 active:bg-blue-100 transition-colors list-item relative";
            div.setAttribute('data-index', index);
            div.setAttribute('data-name', opt.name);
            div.setAttribute('role', 'option');
            div.id = `${type}-opt-${index}`;
            div.setAttribute('aria-selected', 'false');
            const diameterDisplay = settings.showDiameters && opt.dia > 0 ? `${opt.dia}mm` : '';
            div.innerHTML = `
                <span class="pr-20">${escapeHtml(opt.name)}</span>
                ${diameterDisplay ? `<span class="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] opacity-30 font-normal">${escapeHtml(diameterDisplay)}</span>` : ''}
            `;
            div.onmousedown = (e) => { e.preventDefault(); selectOption(type, opt.name); };
            fragment.appendChild(div);
        });
        list.appendChild(fragment);
    } else {
        list.classList.add('hidden');
        input.setAttribute('aria-expanded', 'false');
    }
}

function selectOption(type, optionName) {
    const input = document.getElementById(`${type}-search`);
    const clear = document.getElementById(`${type}-clear`);
    const list = document.getElementById(`${type}-list`);
    
    input.value = optionName;
    clear.classList.remove('hidden');
    if (type === 'tap') selection1 = optionName;
    else selection2 = optionName;
    list.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    selectedIndex = -1;
    currentListType = null;
    input.blur();
    calculate();
}

function updateKeyboardSelection() {
    if (currentListType === null) return;
    const list = document.getElementById(`${currentListType}-list`);
    const input = document.getElementById(`${currentListType}-search`);
    const items = list.querySelectorAll('.list-item');
    if (selectedIndex >= 0 && items[selectedIndex]) input.setAttribute('aria-activedescendant', items[selectedIndex].id);
    else input.removeAttribute('aria-activedescendant');
    items.forEach((item, idx) => {
        if (idx === selectedIndex) {
            item.classList.add('bg-blue-100');
            item.setAttribute('aria-selected', 'true');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('bg-blue-100');
            item.setAttribute('aria-selected', 'false');
        }
    });
}

// ============================================
// REVERSE LOOKUP MODE
// ============================================

function setupModeToggle() {
    const findBtn = document.getElementById('mode-find');
    const reverseBtn = document.getElementById('mode-reverse');
    const normalMode = document.getElementById('normal-mode');
    const reverseMode = document.getElementById('reverse-mode');
    const reverseSearch = document.getElementById('reverse-search');
    const reverseClear = document.getElementById('reverse-clear');
    
    findBtn.addEventListener('click', () => {
        currentMode = 'find';
        findBtn.className = 'flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 bg-blue-600 text-white shadow-lg';
        reverseBtn.className = 'flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 bg-gray-200 text-gray-600';
        normalMode.classList.remove('hidden');
        reverseMode.classList.add('hidden');
        calculate();
    });
    
    reverseBtn.addEventListener('click', () => {
        currentMode = 'reverse';
        reverseBtn.className = 'flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 bg-blue-600 text-white shadow-lg';
        findBtn.className = 'flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 bg-gray-200 text-gray-600';
        reverseMode.classList.remove('hidden');
        normalMode.classList.add('hidden');
        const q = reverseSearch.value.trim().toUpperCase();
        if (q) performReverseLookup(q); else displayResults([], 'default');
        reverseSearch.focus();
    });
    
    const debouncedLookup = debounce((query) => performReverseLookup(query), 100);

    reverseSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        if (query.length === 0) { reverseClear.classList.add('hidden'); displayResults([], 'default'); return; }
        reverseClear.classList.remove('hidden');
        debouncedLookup(query);
    });
    
    reverseClear.addEventListener('click', () => {
        reverseSearch.value = '';
        reverseClear.classList.add('hidden');
        displayResults([], 'default');
        reverseSearch.focus();
    });
}

function performReverseLookup(query) {
    const exact = dbData.filter(row =>
        (row.Part_Number || '').toUpperCase() === query ||
        (row.NZ_Alpha_Short_Code || '').toUpperCase() === query
    );
    let matches = exact;
    // Also accept the tail of a part number ("602031-7" finds "1-602031-7"). Exact hits stay first.
    if (query.length >= 4) {
        const exactSet = new Set(exact);
        const tail = dbData.filter(row =>
            !exactSet.has(row) && (row.Part_Number || '').toUpperCase().endsWith('-' + query)
        );
        matches = exact.concat(tail);
    }
    if (matches.length === 0) { displayReverseLookupResults([], 'none'); return; }
    const themeKey = (matches[0].Chart_Source || 'default').toLowerCase();
    displayReverseLookupResults(matches, themeKey);
}

function displayReverseLookupResults(matches, themeKey) {
    const { outputBox, theme } = applyTheme(themeKey);

    if (themeKey === 'default') { outputBox.innerHTML = `<div class="font-black uppercase text-gray-300 text-3xl tracking-tighter">Ready</div>`; return; }
    if (matches.length === 0) { outputBox.innerHTML = `<div class="font-black uppercase text-white text-2xl tracking-tighter">No Match</div>`; return; }

    // Group by part number, in first-seen order (exact matches were added first).
    const groups = new Map();
    matches.forEach(m => {
        if (!groups.has(m.Part_Number)) groups.set(m.Part_Number, { shortCode: '', pairs: new Set(), hiddenPairs: new Set() });
        const g = groups.get(m.Part_Number);
        const code = (m.NZ_Alpha_Short_Code || '').trim();
        if (code && !g.shortCode) g.shortCode = code;
        const key = [m.Cable_A_Name, m.Cable_B_Name].sort().join(' + ');
        if (settings.hiddenConductors.includes(m.Cable_A_Name) || settings.hiddenConductors.includes(m.Cable_B_Name)) g.hiddenPairs.add(key);
        else g.pairs.add(key);
    });

    let html = `<div class="w-full space-y-3 max-h-[400px] overflow-y-auto custom-list">`;
    groups.forEach((g, partNumber) => {
        const sortedPairs = Array.from(g.pairs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        html += `
        <div class="pb-3 border-b-2 ${theme.border} mb-3">
            <div class="flex flex-row items-center justify-center gap-3 w-full">
                <div class="font-black uppercase tracking-tighter ${theme.text}" style="font-size: clamp(1.1rem, 5.5vw, 1.875rem);">${escapeHtml(partNumber)}</div>
                ${g.shortCode ? `<div class="px-4 py-2 rounded-2xl font-black uppercase tracking-tight ${theme.sub} ${theme.text} shadow-sm flex-shrink-0" style="font-size: clamp(1rem, 4.5vw, 1.5rem);">${escapeHtml(g.shortCode)}</div>` : ''}
            </div>
        </div>`;
        if (sortedPairs.length === 0) {
            html += `<div class="text-xs font-bold ${theme.text} opacity-70">All ${g.hiddenPairs.size} compatible pairs are hidden in Settings</div>`;
            return;
        }
        html += `<div class="text-xs font-black uppercase tracking-widest ${theme.text} mb-2 opacity-70">Compatible Pairs:</div>`;
        sortedPairs.forEach(pair => {
            const [condA, condB] = pair.split(' + ');
            html += `
            <div class="py-2 px-3 rounded-xl ${theme.sub} ${theme.text}">
                <div class="font-bold text-sm">${escapeHtml(condA)}</div>
                <div class="text-xs opacity-70">+</div>
                <div class="font-bold text-sm">${escapeHtml(condB)}</div>
            </div>`;
        });
        if (g.hiddenPairs.size > 0) {
            html += `<div class="text-xs font-bold ${theme.text} opacity-70">+ ${g.hiddenPairs.size} more hidden in Settings</div>`;
        }
    });
    html += `</div>`;

    outputBox.innerHTML = html;
    outputBox.classList.add('flash-success');
    setTimeout(() => outputBox.classList.remove('flash-success'), 600);
}

function setupEventListeners() {
    ['tap', 'stirrup'].forEach(type => {
        const input = document.getElementById(`${type}-search`);
        const clear = document.getElementById(`${type}-clear`);
        const list = document.getElementById(`${type}-list`);

        const debouncedRender = debounce((value) => renderList(type, value), 80);

        input.addEventListener('focus', () => {
            // With a conductor already chosen, show the full list and select the text so typing replaces it.
            const current = type === 'tap' ? selection1 : selection2;
            const hasChoice = current && input.value === current;
            renderList(type, hasChoice ? '' : input.value);
            if (hasChoice) input.select();
        });
        input.addEventListener('input', () => {
            clear.classList.toggle('hidden', input.value === '');
            // Typing over a chosen conductor invalidates it, so the result can't go stale.
            const current = type === 'tap' ? selection1 : selection2;
            if (current && input.value !== current) {
                if (type === 'tap') selection1 = ''; else selection2 = '';
                calculate();
            }
            debouncedRender(input.value);
        });
        input.addEventListener('keydown', (e) => {
            const items = list.querySelectorAll('.list-item');
            if (items.length === 0) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, items.length - 1); updateKeyboardSelection(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); updateKeyboardSelection(); }
            else if (e.key === 'Enter' && selectedIndex >= 0) { e.preventDefault(); selectOption(type, items[selectedIndex].getAttribute('data-name')); }
            else if (e.key === 'Escape') { list.classList.add('hidden'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); selectedIndex = -1; currentListType = null; }
        });
        input.addEventListener('blur', () => {
            setTimeout(() => { list.classList.add('hidden'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); selectedIndex = -1; currentListType = null; }, 250);
        });
        clear.addEventListener('click', () => {
            input.value = '';
            if (type === 'tap') selection1 = ''; else selection2 = '';
            clear.classList.add('hidden');
            calculate();
        });
    });

    document.getElementById('reset-button').addEventListener('click', () => {
        ['tap', 'stirrup'].forEach(type => {
            document.getElementById(`${type}-search`).value = '';
            document.getElementById(`${type}-clear`).classList.add('hidden');
        });
        selection1 = ''; selection2 = '';
        displayResults([], 'default');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tap-container')) { document.getElementById('tap-list').classList.add('hidden'); document.getElementById('tap-search').setAttribute('aria-expanded', 'false'); }
        if (!e.target.closest('#stirrup-container')) { document.getElementById('stirrup-list').classList.add('hidden'); document.getElementById('stirrup-search').setAttribute('aria-expanded', 'false'); }
        if (!e.target.closest('#tap-container') && !e.target.closest('#stirrup-container')) { selectedIndex = -1; currentListType = null; }
    });
}

// ============================================
// PWA SETUP
// ============================================

function setupPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✓ Service Worker registered:', reg.scope))
            .catch(err => console.error('✗ Service Worker registration failed:', err));
    }

    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        if (deferredPrompt) installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt = null;
                installBtn.classList.add('hidden');
            }
        });
    }
}
