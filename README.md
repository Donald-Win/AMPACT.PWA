Ducky's AMPACT Selector (PWA) ⚡
​A high-performance, mobile-first Progressive Web App (PWA) designed for utility field workers to quickly identify AMPACT wedge connector part numbers based on conductor sizes.
​✨ Key Features
​Reactive Dropdown Logic: As you type (e.g., "namu"), the list of possible conductors instantly narrows down, allowing for rapid selection even with large datasets.
​Immersive Color UI: The entire application background changes color (Blue, Red, Yellow, White, Copper) to match the identified AMPACT wedge color for instant visual confirmation in the field.
​Offline Capable: Built as a Progressive Web App (PWA). Once visited, it works offline in remote areas without cellular data.
​Smart Result Filtering: Automatically strips internal database color labels to display clean, professional part numbers.
​Mobile Optimized: Large touch targets and high-contrast text for outdoor visibility.
​🚀 Installation
​For iOS (iPhone/iPad)
​Open the app in Safari.
​Tap the Share button.
​Select "Add to Home Screen".
​For Android
​Open the app in Chrome.
​Tap the three dots in the top right.
​Select "Install app".
​🛠 Technical Stack
​Frontend: HTML5, Tailwind CSS, Vanilla JavaScript.
​Data: JSON-based database for lightning-fast lookups.
​PWA: Service Workers for caching and offline persistence.
​📂 Project Structure
​index.html: UI structure and viewport settings.
​app.js: Core logic, search filtering, and theme engine.
​data.json: Conductor and wedge part number database.
​service-worker.js: Handles offline caching.
​manifest.json: PWA definitions and icons.
​🔧 Maintenance
​To update the conductor database:
​Edit data.json with new values.
​Increment the CACHE_NAME in service-worker.js (e.g., v2.0.10 to v2.0.11).
​Update the version string in the footer of index.html.
​Created by Donald-Win
