Ducky's AMPACT Selector (PWA) ⚡
​A high-performance, mobile-first Progressive Web App (PWA) designed for utility field workers to quickly identify AMPACT wedge connector part numbers based on conductor sizes.
​✨ Key Features
​Reactive Dropdown Logic: As you type (e.g., "namu"), the list of possible conductors instantly narrows down, allowing for rapid selection even with large datasets.
​Immersive Color UI: The entire application background changes color (Blue, Red, Yellow, White, Copper) to match the identified AMPACT wedge color for instant visual confirmation in the field.
​Offline Capable: Built as a Progressive Web App (PWA). Once visited, it works offline in remote areas without cellular data.
​Smart Result Filtering: Automatically strips internal database color labels to display clean, professional part numbers.
​Mobile Optimized: Large touch targets, gesture-friendly selects, and high-contrast text for outdoor visibility.
​🚀 Installation
​For iOS (iPhone/iPad)
​Open the app in Safari.
​Tap the Share button (box with upward arrow).
​Scroll down and select "Add to Home Screen".
​For Android
​Open the app in Chrome.
​Tap the three dots in the top right corner.
​Select "Install app".
​🛠 Technical Stack
​Frontend: HTML5, Tailwind CSS, Vanilla JavaScript (ES6+).
​Data: JSON-based database for lightning-fast lookups without server-side overhead.
​PWA: Service Workers for caching and offline persistence.
​Logic: Custom reactive filtering algorithm for real-time list rebuilding.
​📂 Project Structure
​index.html: The main entry point and UI structure.
​app.js: Core application logic, search filtering, and immersive theme engine.
​data.json: The database containing conductor sizes and wedge part numbers.
​service-worker.js: Handles offline caching and performance.
​manifest.json: Defines PWA behavior and app icons.
​🔧 Maintenance
​To update the conductor database:
​Edit data.json with the new conductor values and part numbers.
​Increment the CACHE_NAME in service-worker.js (e.g., from v2.0.10 to v2.0.11) to force users' devices to download the new data.
​Update the vX.X.X version tag in index.html.
​📜 License
​This project is licensed under the MIT License - see the LICENSE file for details.
​Created by Donald-Win
