# Autonomous God Sandbox Simulator (AGSS)

Welcome to **Autonomous God Sandbox Simulator (AGSS)**, a beautiful, high-performance standalone desktop God sandbox game inspired by *Worldbox* and featuring graphical aesthetics reminiscent of *Civilization V/VI*. 

Become a deity and sculpt your own procedural islands. Harness natural disasters, command weather systems, and control the passage of time.

---

## 🌟 Key Features

* **Procedural World Generation**: Start from a vast empty deep ocean or trigger an island seed generator using value-noise maps.
* **Civ-style Graphics Pipeline**:
  - **Height-Based Directional Shadows**: Mountains, hills, and volcanoes cast realistic 3D shadows.
  - **Specular Normal-Mapped Water**: Simulated waves with active foam lines and solar/lunar specular glints.
  - **Soft Tile Blending**: Multi-layered edge feathering algorithm to remove harsh tile grids for an organic terrain aesthetic.
* **Atmospheric Systems**:
  - **Dynamic Weather Clouds**: Drifting clouds that cast moving shadows on the earth below.
  - **Volcanic Eruptions**: Volcanoes build pressure over time, erupting into huge clouds of ash, smoke, and flowing lava.
  - **Cellular Wildfires**: Fire catches on dry forests, burns trees to ash, and leaves carbon-rich soil that fertilizes future plant growth.
* **Day & Night Cycle**: 
  - Watch the sky change from orange sunsets to deep night.
  - Dynamic **glow maps** activate at night, causing lava flows, active volcanoes, and forest fires to cast ambient light.
* **Procedural Sound Engine**:
  - Beautiful background synthesizer chords that play a relaxing, cinematic ambient soundtrack.
  - Synthesized sound effects generated dynamically using the browser's Web Audio API—no heavy audio file assets needed!
* **God Archive**:
  - Save/Load up to 3 worlds inside local storage.
  - Export and import world maps as `.json` files to share your creations.

---

## 🎮 Game Controls

| Action | Control |
|---|---|
| **Paint / Use God Power** | Click and Drag **Left Mouse Button (LMB)** |
| **Pan Camera** | Drag **Right Mouse Button (RMB)** or **Middle Mouse Button (MMB)** |
| **Zoom Viewport** | Scroll **Mouse Wheel** (centers on cursor) |
| **Toggle Fullscreen** | Press **F11** |
| **Open Dev Tools** | Press **F12** |

---

## 🛠️ Setup & Running

This game is packaged as a standalone desktop application using **Electron**.

### Prerequisites
You will need [Node.js](https://nodejs.org/) (which includes `npm`) installed on your computer.

### Quick Start
1. Open terminal/Command Prompt in this directory:
   ```bash
   npm install
   ```
2. Launch the desktop game:
   ```bash
   npm start
   ```

---

## 📐 Project Architecture

* **`main.js`**: Electron main process. Configures frameless borderless styling and window control bindings.
* **`index.html`**: Defines the custom title bar, glassmorphism sidebar HUD, bottom dock, and canvas container.
* **`styles.css`**: Holds visual rules, custom Google Fonts (*Outfit* and *Cinzel*), neon selected state effects, and glassmorphic blurs.
* **`src/main.js`**: Bootstraps the application once the DOM is loaded.
* **`src/game.js`**: Core loop manager. Directs viewport pan/zoom transformations and routes input events.
* **`src/world.js`**: Simulation grid state (100x100 tiles) and cellular physics rules (lava flow, steam evaporation, wildfire spreading, volcano timers).
* **`src/renderer.js`**: Graphics pipeline. Draws the grid, water animations, height shadows, terrain details (snow caps, pine trees), clouds, and sunset/night tints.
* **`src/particles.js`**: Emitters for smoke, fire sparks, rain streaks, snow, and volcanic ash.
* **`src/audio.js`**: Synthesizes and schedules game audio procedurally using the Web Audio API.
* **`src/ui.js`**: Hooks up HTML buttons, tabs, brush sliders, and local storage save slots.

