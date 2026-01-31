# Ducky's AMPACT Selector (PWA) ⚡

A high-performance, mobile-first Progressive Web App (PWA) designed for utility field workers to quickly identify AMPACT wedge connector part numbers based on conductor sizes.

## ✨ Key Features

- **Reactive Dropdown Logic**: Search results narrow as you type for rapid selection.
- **Immersive Color UI**: The entire background changes color to match the wedge color (Blue, Red, Yellow, White, Copper).
- **Offline Capable**: Works without cellular data once installed on your device. 📶
- **Clean Results**: Displays only the part number, hiding internal database color names.
- **Mobile Optimized**: Designed for one-handed field use with high-contrast text. 📱

## 🚀 Installation

### For iOS (iPhone/iPad)
1. Open the app in **Safari**.
2. Tap the **Share** button.
3. Select **"Add to Home Screen"**.

### For Android
1. Open the app in **Chrome**.
2. Tap the **three dots** in the top right.
3. Select **"Install app"**.

## 🛠 Technical Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript.
- **Data**: JSON-based local database.
- **PWA**: Service Workers for caching and offline persistence.

## 📂 Project Structure

- `index.html`: Main UI and viewport settings.
- `app.js`: Search logic and theme engine.
- `data.json`: Conductor database.
- `service-worker.js`: Offline caching logic.
- `manifest.json`: PWA configuration.

## 🔧 Maintenance

1. Edit `data.json` to update conductor values.
2. Increment the `CACHE_NAME` in `service-worker.js` to push updates.
3. Update the version number in `index.html`.

---
*Created by [Donald-Win](https://github.com/Donald-Win/AMPACT.PWA)*
