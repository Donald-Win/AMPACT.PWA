/**
 * AMPACT Selector - v13.2.0
 * Airtable kill-switch with master toggle - SYSTEM-CONTROL record for open/whitelist mode
 */
let dbData = []; 
let conductorOptions = []; 
let selection1 = '';
let selection2 = '';
let deferredPrompt = null;
const APP_VERSION = "v13.2.0";

// ============================================
// CHANGELOG SYSTEM
// ============================================

const CHANGELOG = {
    "v13.2.0": {
        title: "Updated for my mate Jono.",
        date: "February 2026",
        features: [
            "Added Reverse Lookup mode - enter any AMPACT code (long or short) to see all compatible conductor pairs",
            "Mode toggle buttons let you switch between Find Connector and Reverse Lookup",
            "Reverse lookup respects your hidden conductor settings"
        ]
    }
};

function checkAndShowChangelog() {
    const lastSeenVersion = localStorage.getItem('ampact_last_seen_version');
    
    // If user hasn't seen this version's changelog, show it
    if (lastSeenVersion !== APP_VERSION && CHANGELOG[APP_VERSION]) {
        showChangelog(APP_VERSION);
        localStorage.setItem('ampact_last_seen_version', APP_VERSION);
    }
}

function showChangelog(version) {
    const changelog = CHANGELOG[version];
    if (!changelog) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'changelog-overlay';
    overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn';
    overlay.style.animation = 'fadeIn 0.3s ease-out';
    
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl transform animate-slideUp';
    modal.style.animation = 'slideUp 0.4s ease-out';
    
    let featuresHTML = changelog.features.map(f => 
        `<li class="flex gap-2 items-start"><span class="text-blue-600 font-black">•</span><span>${f}</span></li>`
    ).join('');
    
    modal.innerHTML = `
        <div class="text-center mb-4">
            <div class="text-4xl mb-2">🎉</div>
            <h2 class="text-2xl font-black text-gray-900 mb-1">${changelog.title}</h2>
            <div class="text-xs text-gray-500 font-bold uppercase tracking-wider">${changelog.date} • ${version}</div>
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
    
    // Add animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Close handlers
    document.getElementById('changelog-close').addEventListener('click', () => {
        overlay.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => overlay.remove(), 300);
        }
    });
}

// Expose for manual triggering
window.showChangelog = () => showChangelog(APP_VERSION);

let currentMode = 'find'; // 'find' or 'reverse'


// ============================================
// PWA INSTALL - Must be registered immediately
// beforeinstallprompt fires early, before onload
// ============================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Button may not exist yet - check on DOM ready too
    const installBtn = document.getElementById('install-btn');
    if (installBtn) installBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtn = document.getElementById('install-btn');
    if (installBtn) installBtn.classList.add('hidden');
});

// Keyboard navigation state
let selectedIndex = -1;
let currentListType = null;

// Settings
let settings = {
    sortBy: 'name', // 'name', 'size', 'material'
    showDiameters: true,
    hiddenConductors: [] // Array of conductor names that are hidden
};

const colorThemes = {
    'blue': { body: '#2563eb', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700', sub: 'bg-blue-800/60', header: 'text-blue-600' },
    'yellow': { body: '#facc15', bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-500', sub: 'bg-black/20', header: 'text-yellow-500' },
    'white': { body: '#ffffff', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-200', sub: 'bg-gray-200', header: 'text-gray-400' },
    'red': { body: '#dc2626', bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', sub: 'bg-red-800/60', header: 'text-red-600' },
    'copper': { body: '#b87333', bg: 'bg-[#b87333]', text: 'text-white', border: 'border-[#945d2a]', sub: 'bg-black/30', header: 'text-[#b87333]' },
    'default': { body: '#f3f4f6', bg: 'bg-gray-50', text: 'text-gray-300', border: 'border-gray-100', sub: 'hidden', header: 'text-gray-400' }
};

// ============================================
// AIRTABLE KILL-SWITCH SYSTEM
// ============================================

// Airtable Configuration
const AIRTABLE_API_KEY = 'pathyQ35ljIIfc6P1.6c6cc5145624397a62eb91865a593a644e36e9bc219e12dd2a5ca2190588a95b';
const AIRTABLE_BASE_ID = 'appYJl5tHceGi8tlA';
const AIRTABLE_TABLE_NAME = 'Users';
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

/**
 * Generate stable device fingerprint
 */
function generateDeviceFingerprint() {
    const components = {
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        canvas: (() => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f60';
                ctx.fillRect(125, 1, 62, 20);
                ctx.fillStyle = '#069';
                ctx.fillText('AMPACT', 2, 15);
                return canvas.toDataURL().slice(-50);
            } catch (e) {
                return 'canvas_unavailable';
            }
        })()
    };
    
    const componentString = JSON.stringify(components);
    let hash = 0;
    for (let i = 0; i < componentString.length; i++) {
        const char = componentString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(12, '0');
    return `AMP-${hexHash.substring(0, 4)}-${hexHash.substring(4, 8)}-${hexHash.substring(8, 12)}`;
}

function getDeviceId() {
    let deviceId = localStorage.getItem('ampact_device_id');
    if (!deviceId) {
        deviceId = generateDeviceFingerprint();
        localStorage.setItem('ampact_device_id', deviceId);
    }
    return deviceId;
}

function isValidDeviceId(id) {
    if (typeof id !== 'string') return false;
    const pattern = /^AMP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(id);
}

/**
 * Check if device ID is in allowed list (exact match)
 */
function isDeviceAllowed(deviceId, allowedList) {
    if (!Array.isArray(allowedList)) return false;
    if (!isValidDeviceId(deviceId)) return false;
    
    const cleanedList = allowedList
        .filter(id => typeof id === 'string' && id.trim().length > 0)
        .map(id => id.trim().toUpperCase());
    
    const deviceIdUpper = deviceId.toUpperCase();
    const isAllowed = cleanedList.some(allowedId => allowedId === deviceIdUpper);
    
    if (isAllowed) {
        console.log('✓ Access granted:', deviceId);
    } else {
        console.log('✗ Access denied:', deviceId);
    }
    
    return isAllowed;
}

async function checkKillSwitch() {
    try {
        const deviceId = getDeviceId();
        
        // Validate device ID
        if (!isValidDeviceId(deviceId)) {
            console.error('Invalid device ID, regenerating...');
            localStorage.removeItem('ampact_device_id');
            location.reload();
            return false;
        }
        
        // Fetch from Airtable
        console.log('Fetching from Airtable...');
        console.log('Base:', AIRTABLE_BASE_ID);
        console.log('Table:', AIRTABLE_TABLE_NAME);
        
        const response = await fetch(AIRTABLE_URL, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('✓ Fresh data from Airtable loaded');
        console.log('Total records:', data.records?.length || 0);
        
        if (!data.records || !Array.isArray(data.records)) {
            console.error('No records found in Airtable');
            return true; // Fail open
        }
        
        // Check for master control record (SYSTEM-CONTROL)
        const masterControl = data.records.find(record => 
            record.fields['Access ID'] === 'SYSTEM-CONTROL'
        );
        
        if (masterControl) {
            const masterStatus = (masterControl.fields['Status'] || '').toLowerCase();
            console.log('Master control found:', masterStatus);
            
            if (masterStatus === 'active') {
                console.log('🌍 OPEN MODE - Allowing all users (master switch is Active)');
                // Cache for offline use
                localStorage.setItem('ampact_cached_access', JSON.stringify({
                    records: data.records,
                    timestamp: new Date().toISOString(),
                    openMode: true
                }));
                localStorage.setItem('ampact_last_check', new Date().toISOString());
                return true; // Allow everyone
            } else {
                console.log('🔒 WHITELIST MODE - Checking individual users (master switch is Revoked)');
            }
        } else {
            console.log('No master control found - defaulting to whitelist mode');
        }
        
        // Whitelist mode: Extract active users (excluding SYSTEM-CONTROL)
        const activeUsers = data.records
            .filter(record => {
                const status = record.fields['Status'];
                const accessId = record.fields['Access ID'];
                // Exclude SYSTEM-CONTROL from user list
                return accessId !== 'SYSTEM-CONTROL' && 
                       status && 
                       status.toLowerCase() === 'active';
            })
            .map(record => record.fields['Access ID'])
            .filter(id => id && typeof id === 'string');
        
        console.log('Active users:', activeUsers.length);
        console.log('Active IDs:', activeUsers);
        
        // Check if current device is allowed
        if (isDeviceAllowed(deviceId, activeUsers)) {
            // Cache for offline use
            localStorage.setItem('ampact_cached_access', JSON.stringify({
                records: data.records,
                timestamp: new Date().toISOString(),
                openMode: false
            }));
            localStorage.setItem('ampact_last_check', new Date().toISOString());
            return true;
        } else {
            // Access denied
            await showAccessDeniedScreen(deviceId, {
                title: 'Access Change Required',
                body: 'Due to recent changes, this app now requires explicit authorization. If you need continued access, please send your Access ID below to Donald Win.',
                showAccessId: true,
                contactEmail: 'donald.c.win@gmail.com'
            });
            return false;
        }
        
    } catch (err) {
        console.error('Kill-switch check failed:', err);
        console.error('Error details:', err.message);
        
        // Try cached version (offline mode)
        try {
            const cached = localStorage.getItem('ampact_cached_access');
            if (cached) {
                const cachedData = JSON.parse(cached);
                const deviceId = getDeviceId();
                const lastCheck = localStorage.getItem('ampact_last_check');
                
                console.warn('⚠️ Using CACHED access control from:', lastCheck);
                console.log('Cached records:', cachedData.records?.length || 0);
                
                // Check if cached state was open mode
                if (cachedData.openMode === true) {
                    console.log('🌍 OPEN MODE from cache - Allowing all users');
                    return true;
                }
                
                if (cachedData.records && Array.isArray(cachedData.records)) {
                    const activeUsers = cachedData.records
                        .filter(record => {
                            const status = record.fields['Status'];
                            const accessId = record.fields['Access ID'];
                            return accessId !== 'SYSTEM-CONTROL' && 
                                   status && 
                                   status.toLowerCase() === 'active';
                        })
                        .map(record => record.fields['Access ID'])
                        .filter(id => id && typeof id === 'string');
                    
                    if (isDeviceAllowed(deviceId, activeUsers)) {
                        console.log('✓ Access granted from cache (offline mode)');
                        return true;
                    } else {
                        console.log('✗ Access denied from cache');
                        await showAccessDeniedScreen(deviceId, {
                            title: 'Access Restricted',
                            body: 'This application requires authorization. You appear to be offline or your access has been revoked.',
                            showAccessId: true,
                            contactEmail: 'donald.c.win@gmail.com'
                        });
                        return false;
                    }
                }
            }
        } catch (cacheErr) {
            console.error('Cache check failed:', cacheErr);
        }
        
        // Fail open for safety
        console.warn('⚠️ Failing open - allowing access due to error and no cache');
        return true;
    }
}

async function showAccessDeniedScreen(deviceId, messageConfig = {}) {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
    }
    
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    
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
            .access-id-value:hover { border-color: #667eea; background: #fafafa; }
            .access-id-value:active { border-color: #667eea; background: #e0e7ff; }
            .contact-section { text-align: center; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
            .contact-label { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem; }
            .contact-email { display: inline-block; color: #667eea; font-weight: 700; text-decoration: none; padding: 0.5rem 1rem; border-radius: 8px; transition: all 0.2s; }
            .contact-email:hover { background: #f3f4f6; }
            .retry-button { width: 100%; padding: 0.75rem; background: transparent; color: #6b7280; border: 2px solid #e5e7eb; border-radius: 12px; font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: all 0.2s; margin-top: 1rem; }
            .retry-button:hover { border-color: #9ca3af; color: #4b5563; }
        </style>
        
        <div class="access-denied-container">
            <div class="access-card">
                <div class="access-icon">🔐</div>
                <h1 class="access-title">${title}</h1>
                <p class="access-body">${body}</p>
                
                ${showAccessId ? `
                    <div class="access-id-section">
                        <div class="access-id-label">Your Access ID</div>
                        <div class="access-id-value" id="access-id-display">${deviceId}</div>
                    </div>
                ` : ''}
                
                ${contactEmail ? `
                    <div class="contact-section">
                        <div class="contact-label">Contact for access:</div>
                        <a href="mailto:${contactEmail}?subject=AMPACT Selector Access Request&body=Hello, I would like to request access to the AMPACT Selector app.%0D%0A%0D%0AMy Access ID is: ${deviceId}%0D%0A%0D%0AThank you." class="contact-email">${contactEmail}</a>
                    </div>
                ` : ''}
                
                <button class="retry-button" onclick="location.reload()">Check Access Again</button>
            </div>
        </div>
        
        <script>
            // No JavaScript needed - native text selection works
        </script>
    `;
}

function getMyDeviceId() {
    const deviceId = getDeviceId();
    console.log('%c════════════════════════════════════════', 'color: #667eea; font-weight: bold;');
    console.log('%cYOUR DEVICE ID', 'color: #667eea; font-size: 16px; font-weight: bold;');
    console.log('%c════════════════════════════════════════', 'color: #667eea; font-weight: bold;');
    console.log('%c' + deviceId, 'color: #1f2937; font-size: 18px; font-weight: bold; font-family: monospace; background: #f3f4f6; padding: 8px; border-radius: 4px;');
    console.log('%c════════════════════════════════════════', 'color: #667eea; font-weight: bold;');
    console.log('%cCopy the COMPLETE ID above (all 17 characters)', 'color: #dc2626; font-weight: bold;');
    return deviceId;
}

function clearKillSwitchCache() {
    console.log('%c════════════════════════════════════════', 'color: #f59e0b; font-weight: bold;');
    console.log('%cCLEARING KILL-SWITCH CACHE', 'color: #f59e0b; font-size: 16px; font-weight: bold;');
    console.log('%c════════════════════════════════════════', 'color: #f59e0b; font-weight: bold;');
    
    localStorage.removeItem('ampact_cached_access');
    localStorage.removeItem('ampact_last_check');
    
    console.log('✓ Cache cleared!');
    console.log('Reload the page to fetch fresh data from Gist');
    console.log('');
    console.log('Run this if you updated your Gist and changes are not taking effect.');
}

async function validateKillSwitch() {
    try {
        const response = await fetch(AIRTABLE_URL, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        console.log('%c════════════════════════════════════════', 'color: #10b981; font-weight: bold;');
        console.log('%cAIRTABLE KILL-SWITCH VALIDATION', 'color: #10b981; font-size: 16px; font-weight: bold;');
        console.log('%c════════════════════════════════════════', 'color: #10b981; font-weight: bold;');
        
        console.log('Airtable Base:', AIRTABLE_BASE_ID);
        console.log('Table:', AIRTABLE_TABLE_NAME);
        console.log('Total records:', data.records?.length || 0);
        console.log('');
        
        // Check master switch
        const masterControl = data.records?.find(record => 
            record.fields['Access ID'] === 'SYSTEM-CONTROL'
        );
        
        if (masterControl) {
            const masterStatus = (masterControl.fields['Status'] || '').toLowerCase();
            console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #f59e0b; font-weight: bold;');
            console.log('%cMASTER SWITCH STATUS', 'color: #f59e0b; font-size: 14px; font-weight: bold;');
            console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #f59e0b; font-weight: bold;');
            if (masterStatus === 'active') {
                console.log('%c🌍 OPEN MODE - All users allowed', 'color: #10b981; font-size: 14px; font-weight: bold;');
                console.log('The master switch is set to Active');
                console.log('Anyone can access the app regardless of whitelist');
            } else {
                console.log('%c🔒 WHITELIST MODE - Only approved users', 'color: #dc2626; font-size: 14px; font-weight: bold;');
                console.log('The master switch is set to Revoked');
                console.log('Only users in the Active list can access');
            }
            console.log('');
        } else {
            console.log('%c⚠️ No master switch found', 'color: #f59e0b; font-weight: bold;');
            console.log('Add a record with Access ID = "SYSTEM-CONTROL" to enable master switch');
            console.log('');
        }
        
        if (data.records && Array.isArray(data.records)) {
            console.log('Active users:');
            let activeCount = 0;
            data.records.forEach((record, index) => {
                const accessId = record.fields['Access ID'];
                const name = record.fields['Name'] || 'Unknown';
                const status = record.fields['Status'] || 'Unknown';
                const device = record.fields['Device'] || '';
                const notes = record.fields['Notes'] || '';
                
                if (accessId === 'SYSTEM-CONTROL') return; // Skip master control in user list
                
                if (status.toLowerCase() === 'active') {
                    activeCount++;
                    const isValid = isValidDeviceId(accessId);
                    console.log(`  ${activeCount}. ${accessId} - ${name} ${isValid ? '✓' : '✗ INVALID FORMAT'}`);
                    if (device) console.log(`     Device: ${device}`);
                    if (notes) console.log(`     Notes: ${notes}`);
                }
            });
            
            console.log('');
            console.log('Revoked users:');
            data.records.forEach(record => {
                const accessId = record.fields['Access ID'];
                const status = record.fields['Status'] || '';
                if (accessId === 'SYSTEM-CONTROL') return; // Skip master control
                if (status.toLowerCase() === 'revoked') {
                    const name = record.fields['Name'] || 'Unknown';
                    console.log(`  ✗ ${accessId} - ${name}`);
                }
            });
        }
        
        console.log('');
        const myId = getDeviceId();
        
        // Check if in open mode
        if (masterControl && (masterControl.fields['Status'] || '').toLowerCase() === 'active') {
            console.log('Your Device ID:', myId);
            console.log('You are allowed:', '✅ YES (Open mode - everyone allowed)');
        } else {
            const activeUsers = data.records
                .filter(record => {
                    const status = record.fields['Status'];
                    const accessId = record.fields['Access ID'];
                    return accessId !== 'SYSTEM-CONTROL' && 
                           status && 
                           status.toLowerCase() === 'active';
                })
                .map(record => record.fields['Access ID'])
                .filter(id => id && typeof id === 'string');
            
            const amIAllowed = isDeviceAllowed(myId, activeUsers);
            console.log('Your Device ID:', myId);
            console.log('You are allowed:', amIAllowed ? '✅ YES' : '❌ NO');
        }
        
        console.log('');
        console.log('To grant yourself access:');
        console.log('1. Open Airtable (app or web)');
        console.log('2. Open "AMPACT Access Control" base');
        console.log('3. Add a record:');
        console.log(`   Access ID: ${myId}`);
        console.log('   Name: Your Name');
        console.log('   Status: Active');
        
    } catch (err) {
        console.error('Validation failed:', err);
        console.log('');
        console.log('Possible issues:');
        console.log('- Airtable API key might be wrong');
        console.log('- Base ID might be wrong');
        console.log('- Table name might be wrong (should be "Users")');
        console.log('- No internet connection');
    }
}

window.getMyDeviceId = getMyDeviceId;
window.validateKillSwitch = validateKillSwitch;
window.clearKillSwitchCache = clearKillSwitchCache;

// ============================================
// MAIN APP INITIALIZATION
// ============================================

window.onload = async () => {
    // Check kill-switch before initializing
    const isEnabled = await checkKillSwitch();
    if (!isEnabled) return;

    console.log(`AMPACT Selector ${APP_VERSION} initialized.`);
    
    // Load settings
    loadSettings();
    
    // Show loading indicator
    showLoadingIndicator();
    
    await loadData();
    
    // Hide loading indicator
    hideLoadingIndicator();
    
    setupEventListeners();
    setupModeToggle();
    setupSettingsPanel();
    setupPWA();
    
    // Check if we should show changelog for this version
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

function getConductorMaterial(conductorName) {
    const entry = dbData.find(row => 
        row.Cable_A_Name === conductorName || row.Cable_B_Name === conductorName
    );
    
    if (entry) {
        if (entry.Cable_A_Name === conductorName) {
            return entry.Cable_A_Material || 'Unknown';
        } else {
            return entry.Cable_B_Material || 'Unknown';
        }
    }
    return 'Unknown';
}

function updateSettingsUI() {
    document.querySelectorAll('input[name="sortBy"]').forEach(radio => {
        radio.checked = radio.value === settings.sortBy;
    });
    
    const showDiaCheckbox = document.getElementById('setting-show-diameters');
    if (showDiaCheckbox) {
        showDiaCheckbox.checked = settings.showDiameters;
    }
    
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
        const totalCount = conductorOptions.length;
        countDisplay.textContent = `${visibleCount} of ${totalCount} visible`;
    }
    
    filteredConductors.forEach(opt => {
        const isHidden = settings.hiddenConductors.includes(opt.name);
        
        const div = document.createElement('label');
        div.className = "flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors";
        
        div.innerHTML = `
            <div class="flex-1">
                <div class="font-bold text-gray-900 text-sm">${opt.name}</div>
                ${settings.showDiameters && opt.dia > 0 ? `<div class="text-xs text-gray-500">${opt.dia}mm</div>` : ''}
            </div>
            <input type="checkbox" 
                data-conductor="${opt.name}" 
                ${isHidden ? '' : 'checked'} 
                class="conductor-visibility-toggle w-5 h-5 text-blue-600 rounded focus:ring-blue-500 focus:ring-2">
        `;
        
        container.appendChild(div);
    });
    
    document.querySelectorAll('.conductor-visibility-toggle').forEach(checkbox => {
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
    
    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.remove('translate-x-full');
        settingsOverlay.classList.remove('hidden');
        updateSettingsUI();
    });
    
    const closeSettings = () => {
        settingsPanel.classList.add('translate-x-full');
        settingsOverlay.classList.add('hidden');
    };
    
    settingsClose.addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', closeSettings);
    
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
        visibilitySearch.addEventListener('input', () => {
            updateConductorVisibilityList();
        });
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
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        
        if (!csvText || csvText.length < 100) {
            throw new Error('Invalid or empty CSV data received');
        }
        
        const parseCSV = (text) => {
            const rows = [];
            let row = [];
            let field = '';
            let inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') {
                    if (inQuotes && text[i + 1] === '"') { field += '"'; i++; } 
                    else { inQuotes = !inQuotes; }
                } else if (char === ',' && !inQuotes) {
                    row.push(field.trim());
                    field = '';
                } else if ((char === '\n' || char === '\r') && !inQuotes) {
                    if (field !== '' || row.length > 0) {
                        row.push(field.trim());
                        rows.push(row);
                        field = ''; row = [];
                    }
                    if (char === '\r' && text[i + 1] === '\n') i++;
                } else { field += char; }
            }
            if (field !== '' || row.length > 0) { row.push(field.trim()); rows.push(row); }
            return rows;
        };

        const allRows = parseCSV(csvText);
        if (allRows.length < 2) {
            throw new Error('CSV file is empty or has no data rows');
        }

        const headers = allRows[0];
        const conductorMap = new Map();

        dbData = allRows.slice(1).map(row => {
            const entry = {};
            headers.forEach((h, i) => entry[h] = row[i] || '');
            
            const processConductor = (name, diaStr) => {
                if (!name) return;
                const dia = parseFloat(diaStr) || 0;
                if (!conductorMap.has(name) || dia > conductorMap.get(name)) {
                    conductorMap.set(name, dia);
                }
            };
            processConductor(entry.Cable_A_Name, entry.Cable_A_Dia_mm);
            processConductor(entry.Cable_B_Name, entry.Cable_B_Dia_mm);
            return entry;
        });

        conductorOptions = Array.from(conductorMap.entries())
            .map(([name, dia]) => ({ name, dia }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        
        if (dbData.length === 0 || conductorOptions.length === 0) {
            throw new Error('No valid conductor data found in CSV');
        }
        
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
                    <button onclick="location.reload()" class="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 active:scale-95 transition-all">
                        Retry
                    </button>
                </div>
            </div>
        `;
        throw err;
    }
}

// ============================================
// CALCULATION & DISPLAY
// ============================================

function calculate() {
    if (!selection1 || !selection2) {
        displayResults([], 'default');
        return;
    }

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
    const outputBox = document.getElementById('output-box');
    const headerSelector = document.getElementById('header-selector');
    const theme = colorThemes[themeKey] || colorThemes.default;

    document.body.style.backgroundColor = theme.body;
    headerSelector.className = `transition-colors duration-500 ${theme.header}`;
    
    outputBox.className = `p-4 rounded-[2.5rem] border-4 text-center min-h-[140px] w-full flex flex-col items-center justify-center transition-all duration-300 ${theme.bg} ${theme.border}`;
    
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
        if (!seenParts.has(m.Part_Number)) {
            uniqueMatches.push(m);
            seenParts.add(m.Part_Number);
        }
    });

    let html = `<div class="w-full space-y-5">`;
    uniqueMatches.forEach(match => {
        const shortCode = match.NZ_Alpha_Short_Code && match.NZ_Alpha_Short_Code.trim();
        html += `
            <div class="flex flex-row items-center justify-center gap-3 w-full px-2 whitespace-nowrap">
                <div class="font-black uppercase tracking-tighter ${theme.text}" style="font-size: clamp(1.1rem, 5.5vw, 1.875rem);">${match.Part_Number}</div>
                ${shortCode ? `<div class="px-4 py-2 rounded-2xl font-black uppercase tracking-tight ${theme.sub} ${theme.text} shadow-sm flex-shrink-0" style="font-size: clamp(1rem, 4.5vw, 1.5rem);">${shortCode}</div>` : ''}
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

    const filtered = conductorOptions.filter(opt => 
        opt.name.toLowerCase().includes(filter) && 
        !settings.hiddenConductors.includes(opt.name)
    );

    if (filtered.length > 0) {
        list.classList.remove('hidden');
        input.setAttribute('aria-expanded', 'true');
        
        filtered.forEach((opt, index) => {
            const div = document.createElement('div');
            div.className = "px-5 py-4 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0 font-bold text-gray-700 active:bg-blue-100 transition-colors list-item relative";
            div.setAttribute('data-index', index);
            
            const diameterDisplay = settings.showDiameters && opt.dia > 0 ? `${opt.dia}mm` : '';
            
            div.innerHTML = `
                <span class="pr-20">${opt.name}</span>
                ${diameterDisplay ? `<span class="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] opacity-30 font-normal">${diameterDisplay}</span>` : ''}
            `;
            
            div.onmousedown = (e) => {
                e.preventDefault();
                selectOption(type, opt.name);
            };
            list.appendChild(div);
        });
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
    
    if (type === 'tap') {
        selection1 = optionName;
    } else {
        selection2 = optionName;
    }
    
    list.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
    selectedIndex = -1;
    currentListType = null;
    
    input.blur();
    
    calculate();
}

function updateKeyboardSelection() {
    if (currentListType === null) return;
    
    const list = document.getElementById(`${currentListType}-list`);
    const items = list.querySelectorAll('.list-item');
    
    items.forEach((item, idx) => {
        if (idx === selectedIndex) {
            item.classList.add('bg-blue-100');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('bg-blue-100');
        }
    });
}

// ============================================
// EVENT LISTENERS
// ============================================


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
        displayResults([], 'default');
    });
    
    reverseBtn.addEventListener('click', () => {
        currentMode = 'reverse';
        reverseBtn.className = 'flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 bg-blue-600 text-white shadow-lg';
        findBtn.className = 'flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 bg-gray-200 text-gray-600';
        reverseMode.classList.remove('hidden');
        normalMode.classList.add('hidden');
        displayResults([], 'default');
        reverseSearch.focus();
    });
    
    reverseSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        
        if (query.length === 0) {
            reverseClear.classList.add('hidden');
            displayResults([], 'default');
            return;
        }
        
        reverseClear.classList.remove('hidden');
        performReverseLookup(query);
    });
    
    reverseClear.addEventListener('click', () => {
        reverseSearch.value = '';
        reverseClear.classList.add('hidden');
        displayResults([], 'default');
        reverseSearch.focus();
    });
}

function performReverseLookup(query) {
    const matches = dbData.filter(row => {
        const partNumber = (row.Part_Number || '').toUpperCase();
        const shortCode = (row.NZ_Alpha_Short_Code || '').toUpperCase();
        return partNumber === query || shortCode === query;
    });
    
    if (matches.length === 0) {
        displayReverseLookupResults([], 'none');
        return;
    }
    
    const themeKey = (matches[0].Chart_Source || 'default').toLowerCase();
    displayReverseLookupResults(matches, themeKey);
}

function displayReverseLookupResults(matches, themeKey) {
    const outputBox = document.getElementById('output-box');
    const headerSelector = document.getElementById('header-selector');
    const theme = colorThemes[themeKey] || colorThemes.default;

    document.body.style.backgroundColor = theme.body;
    headerSelector.className = `transition-colors duration-500 ${theme.header}`;
    
    outputBox.className = `p-4 rounded-[2.5rem] border-4 text-center min-h-[140px] w-full flex flex-col items-center justify-center transition-all duration-300 ${theme.bg} ${theme.border}`;
    
    if (themeKey === 'default') {
        outputBox.innerHTML = `<div class="font-black uppercase text-gray-300 text-3xl tracking-tighter">Ready</div>`;
        return;
    }

    if (matches.length === 0) {
        outputBox.innerHTML = `<div class="font-black uppercase text-white text-2xl tracking-tighter">No Match</div>`;
        return;
    }
    
    const pairs = new Set();
    matches.forEach(m => {
        // Skip if either conductor is hidden
        if (settings.hiddenConductors.includes(m.Cable_A_Name) || 
            settings.hiddenConductors.includes(m.Cable_B_Name)) {
            return;
        }
        const pair = [m.Cable_A_Name, m.Cable_B_Name].sort().join(' + ');
        pairs.add(pair);
    });
    
    let html = `<div class="w-full space-y-3 max-h-[400px] overflow-y-auto custom-list">`;
    
    const firstMatch = matches[0];
    const shortCode = firstMatch.NZ_Alpha_Short_Code && firstMatch.NZ_Alpha_Short_Code.trim();
    html += `
        <div class="pb-3 border-b-2 ${theme.border} mb-3">
            <div class="flex flex-row items-center justify-center gap-3 w-full">
                <div class="font-black uppercase tracking-tighter ${theme.text}" style="font-size: clamp(1.1rem, 5.5vw, 1.875rem);">${firstMatch.Part_Number}</div>
                ${shortCode ? `<div class="px-4 py-2 rounded-2xl font-black uppercase tracking-tight ${theme.sub} ${theme.text} shadow-sm flex-shrink-0" style="font-size: clamp(1rem, 4.5vw, 1.5rem);">${shortCode}</div>` : ''}
            </div>
        </div>
    `;
    
    html += `<div class="text-xs font-black uppercase tracking-widest ${theme.text} mb-2 opacity-70">Compatible Pairs:</div>`;
    
    Array.from(pairs).forEach(pair => {
        const [condA, condB] = pair.split(' + ');
        html += `
            <div class="py-2 px-3 rounded-xl ${theme.sub} ${theme.text}">
                <div class="font-bold text-sm">${condA}</div>
                <div class="text-xs opacity-70">+</div>
                <div class="font-bold text-sm">${condB}</div>
            </div>
        `;
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

        input.addEventListener('focus', () => {
            renderList(type, input.value);
        });
        
        input.addEventListener('input', () => {
            clear.classList.toggle('hidden', input.value === '');
            renderList(type, input.value);
        });
        
        input.addEventListener('keydown', (e) => {
            const list = document.getElementById(`${type}-list`);
            const items = list.querySelectorAll('.list-item');
            
            if (items.length === 0) return;
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateKeyboardSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateKeyboardSelection();
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                const selectedItem = items[selectedIndex];
                const optionName = selectedItem.querySelector('span').textContent;
                selectOption(type, optionName);
            } else if (e.key === 'Escape') {
                list.classList.add('hidden');
                input.setAttribute('aria-expanded', 'false');
                selectedIndex = -1;
                currentListType = null;
            }
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => {
                list.classList.add('hidden');
                input.setAttribute('aria-expanded', 'false');
                selectedIndex = -1;
                currentListType = null;
            }, 250);
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
            const input = document.getElementById(`${type}-search`);
            input.value = '';
            document.getElementById(`${type}-clear`).classList.add('hidden');
        });
        selection1 = ''; selection2 = '';
        displayResults([], 'default');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tap-container')) {
            document.getElementById('tap-list').classList.add('hidden');
            document.getElementById('tap-search').setAttribute('aria-expanded', 'false');
        }
        if (!e.target.closest('#stirrup-container')) {
            document.getElementById('stirrup-list').classList.add('hidden');
            document.getElementById('stirrup-search').setAttribute('aria-expanded', 'false');
        }
        if (!e.target.closest('#tap-container') && !e.target.closest('#stirrup-container')) {
            selectedIndex = -1;
            currentListType = null;
        }
    });
}

// ============================================
// PWA SETUP
// ============================================

function setupPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('✓ Service Worker registered:', reg.scope);
            })
            .catch(err => {
                console.error('✗ Service Worker registration failed:', err);
            });
    }

    // Wire up install button (beforeinstallprompt already caught at top of file)
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        // If prompt was already captured before DOM was ready, show button now
        if (deferredPrompt) {
            installBtn.classList.remove('hidden');
        }

        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt = null;
                installBtn.classList.add('hidden');
            }
        });
    }
}
