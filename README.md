# AMPACT Selector (PWA) ⚡

A high-performance, mobile-first Progressive Web App (PWA) designed for utility field workers to instantly identify AMPACT wedge connector part numbers based on conductor sizes.

## ✨ Key Features

- **Excel-Driven Engine**: Powered by a single `data.xlsx` file. No more managing multiple CSVs.
- **Reactive Search**: Conductor options narrow as you type for rapid, one-handed selection.
- **Immersive Color UI**: The interface dynamically changes color (Blue, Red, Yellow, White, Copper) to match the required wedge color code.
- **Intelligent Logic**: Automatically handles diameter-based orientation and falls back to Copper charts when specialized taps are required.
- **Offline Capable**: Fully functional without cellular data or Wi-Fi once installed on a device. 📶
- **Clean Results**: Displays only the final part number, optimized for high-glare field environments.

## 🚀 Installation

### Android (Chrome)
1. Open the app URL.
2. Tap the **"Install App"** button at the bottom of the screen.
3. If the button isn't visible, tap the **three dots** (top right) and select **"Install app"**.

### iOS (Safari)
1. Open the app in **Safari**.
2. Tap the **Share** button (box with upward arrow).
3. Select **"Add to Home Screen"**.

## 🛠 Technical Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript.
- **Parser**: [SheetJS (XLSX)](https://github.com/SheetJS/sheetjs) for real-time Excel processing.
- **PWA**: Service Workers for aggressive caching and offline persistence.
- **Hosting**: Optimized for GitHub Pages.

## 📂 Project Structure

- `index.html`: Main UI, viewport settings, and library CDNs.
- `app.js`: The "Engine" — handles Excel parsing, search logic, and PWA bridges.
- `sw.js`: Service Worker managing offline asset caching.
- `manifest.json`: PWA configuration (icons, theme colors, and installation criteria).
- `data.xlsx`: **The Database.** Contains all cross-reference charts across multiple sheets.

## 🔧 Maintenance & Updates

### Updating the Data
1. Open `data.xlsx` in Excel.
2. Add or modify part numbers in the respective color sheets (Blue, Yellow, Red, White, Copper).
3. Save the file and replace the version in the root directory.
4. **Important**: After updating data, increment the `CACHE_NAME` version in `sw.js` (e.g., from `v6.4.0` to `v6.4.1`) to force user devices to download the new data.

### Troubleshooting PWA Installation
If the "Install" button does not appear:
- Ensure you are using **HTTPS**.
- Check that all files listed in the `ASSETS` array in `sw.js` actually exist in the repo.
- Verify that the `manifest.json` has the `"purpose": "maskable"` icons defined.

---
*Maintained by Donald Win*
