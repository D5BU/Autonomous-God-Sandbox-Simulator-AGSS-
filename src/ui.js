const { ipcRenderer } = require('electron');

export class UIManager {
  constructor(world, renderer, particleSystem, audioEngine) {
    this.world = world;
    this.renderer = renderer;
    this.particles = particleSystem;
    this.audio = audioEngine;

    // Brush Tool Config
    this.activeTool = 'deep_ocean';
    this.brushSize = 3;
    this.brushShape = 'circle';
    this.simSpeed = 1; // 0 (paused), 1, 2, 5

    this.initWindowControls();
    this.initTabs();
    this.initBrushes();
    this.initSliders();
    this.initSimulationControls();
    this.initSaveSlots();
    this.initActionButtons();
    this.initHoverTelemetry();
  }

  initWindowControls() {
    document.getElementById('btn-minimize').addEventListener('click', () => {
      ipcRenderer.send('window-minimize');
    });

    document.getElementById('btn-maximize').addEventListener('click', () => {
      ipcRenderer.send('window-maximize');
    });

    document.getElementById('btn-close').addEventListener('click', () => {
      ipcRenderer.send('window-close');
    });
  }

  initTabs() {
    const tabBtns = document.querySelectorAll('.dock-tab-btn');
    const panels = document.querySelectorAll('.dock-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle active button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show matching panel
        const targetTab = btn.getAttribute('data-tab');
        panels.forEach(p => {
          if (p.id === `panel-${targetTab}`) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });
      });
    });
  }

  initBrushes() {
    const toolBtns = document.querySelectorAll('.tool-btn');
    
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Set tool
        this.activeTool = btn.getAttribute('data-tool');
        
        // Play click sound
        this.audio.playSfx('place');

        // Update info panel
        const title = btn.getAttribute('title');
        document.getElementById('info-hover').innerHTML = `<strong>Selected Power:</strong><br>${title}`;
      });
    });

    // Brush Shape Buttons
    const shapeCircle = document.getElementById('brush-shape-circle');
    const shapeSquare = document.getElementById('brush-shape-square');

    shapeCircle.addEventListener('click', () => {
      shapeCircle.classList.add('active');
      shapeSquare.classList.remove('active');
      this.brushShape = 'circle';
      this.audio.playSfx('place');
    });

    shapeSquare.addEventListener('click', () => {
      shapeSquare.classList.add('active');
      shapeCircle.classList.remove('active');
      this.brushShape = 'square';
      this.audio.playSfx('place');
    });
  }

  initSliders() {
    const brushSizeSlider = document.getElementById('brush-size');
    const brushSizeVal = document.getElementById('brush-size-val');

    brushSizeSlider.addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      brushSizeVal.innerText = this.brushSize;
    });
  }

  initSimulationControls() {
    const speedPause = document.getElementById('btn-speed-pause');
    const speed1x = document.getElementById('btn-speed-1x');
    const speed2x = document.getElementById('btn-speed-2x');
    const speed5x = document.getElementById('btn-speed-5x');

    const clearActive = () => {
      [speedPause, speed1x, speed2x, speed5x].forEach(b => b.classList.remove('active'));
    };

    speedPause.addEventListener('click', () => {
      clearActive();
      speedPause.classList.add('active');
      this.simSpeed = 0;
      this.audio.playSfx('place');
    });

    speed1x.addEventListener('click', () => {
      clearActive();
      speed1x.classList.add('active');
      this.simSpeed = 1;
      this.audio.playSfx('place');
    });

    speed2x.addEventListener('click', () => {
      clearActive();
      speed2x.classList.add('active');
      this.simSpeed = 2;
      this.audio.playSfx('place');
    });

    speed5x.addEventListener('click', () => {
      clearActive();
      speed5x.classList.add('active');
      this.simSpeed = 5;
      this.audio.playSfx('place');
    });

    // Day/Night Toggle
    const btnTimeCycle = document.getElementById('btn-time-cycle');
    btnTimeCycle.addEventListener('click', () => {
      this.renderer.enableDayNight = !this.renderer.enableDayNight;
      btnTimeCycle.innerText = this.renderer.enableDayNight ? '🌙 Cycle: ON' : '☀️ Sun: Locked';
      btnTimeCycle.classList.toggle('active');
      this.audio.playSfx('place');
    });

    // Audio Toggle
    const btnAudioToggle = document.getElementById('btn-audio-toggle');
    btnAudioToggle.addEventListener('click', () => {
      const state = this.audio.toggle();
      btnAudioToggle.innerText = state ? '🔊 Music: ON' : '🔇 Muted';
      btnAudioToggle.style.opacity = state ? '1.0' : '0.5';
    });
  }

  initSaveSlots() {
    const slotBtns = document.querySelectorAll('.save-slot-btn');

    // Update slot labels on startup
    slotBtns.forEach(btn => {
      const slot = btn.getAttribute('data-slot');
      const savedData = localStorage.getItem(`agss_save_slot_${slot}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          btn.innerText = `Slot ${slot} - Yr ${parsed.year}, Mth ${parsed.month}`;
          btn.style.color = '#fff';
        } catch (e) {
          btn.innerText = `Slot ${slot} - Corrupted`;
        }
      }
    });

    slotBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = btn.getAttribute('data-slot');
        const savedData = localStorage.getItem(`agss_save_slot_${slot}`);

        // If slot is empty, click will SAVE.
        // If slot contains data, click will LOAD.
        // If shift-key is held, it will force SAVE and overwrite.
        const shouldSave = !savedData || window.event.shiftKey;

        if (shouldSave) {
          const serialized = this.world.serialize();
          localStorage.setItem(`agss_save_slot_${slot}`, serialized);
          btn.innerText = `Slot ${slot} - Yr ${this.world.year}, Mth ${this.world.month}`;
          btn.style.color = '#fff';
          this.audio.playSfx('place');
          alert(`World saved successfully into Slot ${slot}!`);
        } else {
          // Load data
          const success = this.world.deserialize(savedData);
          if (success) {
            this.audio.playSfx('eruption'); // dramatic load sound
            alert(`Loaded Slot ${slot} successfully!`);
          } else {
            alert(`Error loading Slot ${slot}!`);
          }
        }
      });
    });
  }

  initActionButtons() {
    // Regenerate noise map
    document.getElementById('btn-regenerate').addEventListener('click', () => {
      if (confirm("Procedurally generate a new random sandbox seed? This will clear current changes.")) {
        this.world.generateWorld();
        this.audio.playSfx('eruption');
      }
    });

    // Clear world
    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm("Reset everything back to ocean?")) {
        this.world.resetToOcean();
        this.audio.playSfx('steam');
      }
    });

    // Export JSON file
    document.getElementById('btn-export').addEventListener('click', () => {
      const dataStr = this.world.serialize();
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `agss_world_year_${this.world.year}_month_${this.world.month}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      this.audio.playSfx('place');
    });

    // Import JSON file
    document.getElementById('btn-import').addEventListener('click', () => {
      const inputElement = document.createElement('input');
      inputElement.setAttribute('type', 'file');
      inputElement.setAttribute('accept', '.json');
      
      inputElement.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const success = this.world.deserialize(evt.target.result);
          if (success) {
            this.audio.playSfx('eruption');
            alert("World configuration imported successfully!");
          } else {
            alert("Failed to parse import file.");
          }
        };
        reader.readAsText(file);
      });

      inputElement.click();
    });
  }

  initHoverTelemetry() {
    const infoPanel = document.getElementById('info-hover');
    
    // Register custom event so game main loop can push tile details under mouse
    window.addEventListener('tile-hover', (e) => {
      const tile = e.detail.tile;
      if (!tile) {
        infoPanel.innerHTML = "Hover over terrain for details.";
        return;
      }

      // Readable details
      const typesMap = {
        deep_ocean: 'Deep Ocean 🌊',
        shallow_sea: 'Shallow Coastal Sea 💧',
        sand: 'Sandy Beach ⏳',
        grass: 'Fertile Grassland 🌱',
        forest: 'Wooded Forest 🌲',
        mountain: 'Rocky Mountain ⛰',
        volcano: 'Active Volcano 🌋',
        lava: 'Molten Lava ☄️',
        ice: 'Frozen Ice ❄️',
        fire: 'Wildfire Inferno 🔥'
      };

      const typeName = typesMap[tile.type] || tile.type;
      const tempC = Math.round(tile.temperature * 100);
      const moistPct = Math.round(tile.moisture * 100);
      const elev = Math.round(tile.elevation * 100);

      let extra = '';
      if (tile.type === 'volcano') {
        extra = `<br>Erupts in: ${Math.round(tile.volcanoEruptTick)}s`;
      } else if (tile.type === 'fire') {
        extra = `<br>Burns for: ${Math.round(tile.fireDuration)}s`;
      } else if (tile.ashLevel > 0) {
        extra = `<br>Ash Fertilizer: ${Math.round(tile.ashLevel * 100)}%`;
      }

      infoPanel.innerHTML = `
        <strong>Tile Info (${tile.x}, ${tile.y})</strong><br>
        Terrain: ${typeName}<br>
        Elevation: ${elev}m<br>
        Temp: ${tempC}°C<br>
        Moisture: ${moistPct}%
        ${extra}
      `;
    });
  }

  updateHUD(world, renderer) {
    // Update live stats text
    document.getElementById('stat-time').querySelector('.val').innerText = `Year ${world.year}, Month ${world.month} (${renderer.getTimeString()})`;
    document.getElementById('stat-ratio').querySelector('.val').innerText = `Land ${world.landRatio}% / Water ${100 - world.landRatio}%`;
    document.getElementById('stat-volcanoes').querySelector('.val').innerText = `${world.activeVolcanoes} Active`;
    document.getElementById('stat-fire').querySelector('.val').innerText = `${world.activeFires} Blazes`;
  }
}

