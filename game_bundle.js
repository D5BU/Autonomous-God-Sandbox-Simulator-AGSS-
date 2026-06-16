// Detect environment
const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
let ipcRenderer = null;
if (isElectron) {
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (e) {
    console.warn("Running in Electron style but require('electron') failed:", e);
  }
}

// ==========================================
// MODULE: src/world.js
// ==========================================
class World {
  constructor(width = 100, height = 100) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.year = 1;
    this.month = 1;
    this.monthTicks = 0;
    this.ticksPerMonth = 150; // frames per month

    // Stats
    this.landRatio = 0;
    this.activeVolcanoes = 0;
    this.activeFires = 0;

    this.resetToOcean();
  }

  resetToOcean() {
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push(this.createTile(x, y, 'deep_ocean'));
      }
      this.grid.push(row);
    }
    this.updateStats();
  }

  createTile(x, y, type) {
    const tile = {
      x, y,
      type,
      elevation: 0.1,
      temperature: 0.5, // 0 to 1
      moisture: 0.5,    // 0 to 1
      lavaLevel: 0,
      fireDuration: 0,
      plantGrowTick: Math.random() * 100,
      volcanoEruptTick: 0,
      ashLevel: 0
    };
    this.applyDefaultsForType(tile, type);
    return tile;
  }

  applyDefaultsForType(tile, type) {
    tile.type = type;
    switch (type) {
      case 'deep_ocean':
        tile.elevation = 0.1;
        tile.temperature = 0.45;
        tile.moisture = 1.0;
        tile.lavaLevel = 0;
        tile.fireDuration = 0;
        break;
      case 'shallow_sea':
        tile.elevation = 0.3;
        tile.temperature = 0.5;
        tile.moisture = 1.0;
        tile.lavaLevel = 0;
        tile.fireDuration = 0;
        break;
      case 'sand':
        tile.elevation = 0.45;
        tile.temperature = 0.55;
        tile.moisture = 0.6;
        tile.lavaLevel = 0;
        tile.fireDuration = 0;
        break;
      case 'grass':
        tile.elevation = 0.55;
        tile.temperature = 0.5;
        tile.moisture = 0.5;
        tile.lavaLevel = 0;
        tile.fireDuration = 0;
        break;
      case 'forest':
        tile.elevation = 0.6;
        tile.temperature = 0.45;
        tile.moisture = 0.55;
        tile.lavaLevel = 0;
        tile.fireDuration = 0;
        break;
      case 'mountain':
        tile.elevation = 0.85;
        tile.temperature = 0.3;
        tile.moisture = 0.3;
        tile.lavaLevel = 0;
        tile.fireDuration = 0;
        break;
      case 'volcano':
        tile.elevation = 0.95;
        tile.temperature = 0.8;
        tile.moisture = 0.1;
        tile.lavaLevel = 0;
        tile.fireDuration = 0;
        // set eruption interval (300 to 800 ticks)
        tile.volcanoEruptTick = 300 + Math.random() * 500;
        break;
      case 'lava':
        tile.elevation = 0.7;
        tile.temperature = 1.0;
        tile.moisture = 0.0;
        tile.lavaLevel = 1.0;
        tile.fireDuration = 0;
        break;
      case 'ice':
        tile.elevation = 0.48;
        tile.temperature = 0.0;
        tile.moisture = 0.8;
        tile.lavaLevel = 0;
        tile.fireDuration = 0;
        break;
      case 'fire':
        tile.elevation = 0.55;
        tile.temperature = 0.9;
        tile.moisture = 0.1;
        tile.lavaLevel = 0;
        tile.fireDuration = 60 + Math.random() * 60;
        break;
    }
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.grid[y][x];
  }

  setTileType(x, y, type) {
    const tile = this.getTile(x, y);
    if (!tile) return;
    this.applyDefaultsForType(tile, type);
  }

  // Draw terrain with a brush
  paintTerrain(centerX, centerY, tool, radius, shape, particleSystem, audioEngine) {
    const rInt = Math.ceil(radius);
    for (let dy = -rInt; dy <= rInt; dy++) {
      for (let dx = -rInt; dx <= rInt; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const tile = this.getTile(x, y);
        if (!tile) continue;

        // Check brush shape
        if (shape === 'circle' && dx * dx + dy * dy > radius * radius) {
          continue;
        }

        // Apply tool action
        switch (tool) {
          case 'deep_ocean':
          case 'shallow_sea':
          case 'sand':
          case 'grass':
          case 'forest':
          case 'mountain':
          case 'volcano':
            this.setTileType(x, y, tool);
            // Spawn place sound occasionally
            if (Math.random() < 0.05 && audioEngine) audioEngine.playSfx('place');
            break;

          case 'lava':
            if (tile.type !== 'deep_ocean' && tile.type !== 'shallow_sea') {
              this.setTileType(x, y, 'lava');
              if (particleSystem) particleSystem.emit('lava_spark', tile.x, tile.y, 3);
            } else {
              // steam effect
              this.setTileType(x, y, 'mountain'); // cool to mountain
              if (particleSystem) particleSystem.emit('steam', tile.x, tile.y, 4);
              if (audioEngine) audioEngine.playSfx('steam');
            }
            break;

          case 'fire':
            if (tile.type === 'grass' || tile.type === 'forest') {
              this.setTileType(x, y, 'fire');
              tile.fireDuration = 60 + Math.random() * 60;
              if (particleSystem) particleSystem.emit('fire', tile.x, tile.y, 3);
              if (audioEngine && Math.random() < 0.1) audioEngine.playSfx('fire_crackle');
            }
            break;

          case 'rain':
            tile.moisture = Math.min(1.0, tile.moisture + 0.3);
            tile.temperature = Math.max(0.2, tile.temperature - 0.2);
            if (tile.type === 'fire') {
              this.setTileType(x, y, 'grass');
              tile.ashLevel = 0.5;
              if (particleSystem) particleSystem.emit('steam', tile.x, tile.y, 2);
              if (audioEngine) audioEngine.playSfx('steam');
            } else if (tile.type === 'lava') {
              this.setTileType(x, y, 'mountain');
              tile.elevation = 0.8;
              if (particleSystem) particleSystem.emit('steam', tile.x, tile.y, 4);
              if (audioEngine) audioEngine.playSfx('steam');
            } else if (tile.type === 'sand' && Math.random() < 0.1) {
              this.setTileType(x, y, 'grass');
            }
            if (particleSystem && Math.random() < 0.3) {
              particleSystem.emit('rain', tile.x + Math.random() - 0.5, tile.y + Math.random() - 0.5, 1);
            }
            break;

          case 'snow':
            tile.temperature = Math.max(0.0, tile.temperature - 0.35);
            if (tile.type === 'deep_ocean' || tile.type === 'shallow_sea') {
              this.setTileType(x, y, 'ice');
            } else if (tile.type === 'grass' || tile.type === 'sand') {
              tile.type = 'ice'; // frozen over
            } else if (tile.type === 'lava') {
              this.setTileType(x, y, 'mountain');
              if (particleSystem) particleSystem.emit('steam', tile.x, tile.y, 3);
            }
            if (particleSystem && Math.random() < 0.3) {
              particleSystem.emit('snow', tile.x + Math.random() - 0.5, tile.y + Math.random() - 0.5, 1);
            }
            break;

          case 'sun':
            tile.temperature = Math.min(1.0, tile.temperature + 0.25);
            tile.moisture = Math.max(0.0, tile.moisture - 0.15);
            if (tile.type === 'ice') {
              this.setTileType(x, y, 'shallow_sea');
            }
            break;

          case 'meteor':
            // Destructive impact crater
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= radius) {
              const impactPower = 1.0 - (dist / radius);
              if (impactPower > 0.5) {
                this.setTileType(x, y, 'deep_ocean');
                tile.elevation = 0.05;
              } else {
                this.setTileType(x, y, 'lava');
              }
              if (particleSystem) {
                particleSystem.emit('fire', tile.x, tile.y, 5);
                particleSystem.emit('smoke', tile.x, tile.y, 3);
              }
            }
            break;

          case 'lightning':
            if (Math.random() < 0.25) {
              if (tile.type === 'grass' || tile.type === 'forest') {
                this.setTileType(x, y, 'fire');
                tile.fireDuration = 100;
              } else if (tile.type === 'mountain') {
                this.setTileType(x, y, 'sand'); // shattered to sand
              }
              if (particleSystem) {
                particleSystem.emit('fire', tile.x, tile.y, 8);
                particleSystem.emit('smoke', tile.x, tile.y, 5);
              }
            }
            break;
        }
      }
    }
  }

  // Erupt a volcano tile
  eruptVolcano(volcanoTile, particleSystem, audioEngine) {
    if (audioEngine) audioEngine.playSfx('eruption');
    
    // Spawn lava flow and fire
    const directions = [
      {dx: 0, dy: 0},
      {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1},
      {dx: 1, dy: 1}, {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}
    ];

    directions.forEach(dir => {
      const tx = volcanoTile.x + dir.dx;
      const ty = volcanoTile.y + dir.dy;
      const t = this.getTile(tx, ty);
      if (t) {
        if (t.type === 'deep_ocean' || t.type === 'shallow_sea') {
          // turn water to volcanic mountain rock
          this.setTileType(tx, ty, 'mountain');
          t.elevation = 0.75;
          if (particleSystem) particleSystem.emit('steam', tx, ty, 8);
        } else if (t.type !== 'volcano') {
          this.setTileType(tx, ty, 'lava');
          t.lavaLevel = 1.0;
          if (particleSystem) {
            particleSystem.emit('lava_spark', tx, ty, 4);
            particleSystem.emit('smoke', tx, ty, 3);
          }
        }
      }
    });

    // Spawn high-density ash/embers particles in the air
    if (particleSystem) {
      for (let i = 0; i < 25; i++) {
        particleSystem.emit('lava_spark', volcanoTile.x + (Math.random() - 0.5) * 1.5, volcanoTile.y + (Math.random() - 0.5) * 1.5, 1);
        particleSystem.emit('smoke', volcanoTile.x + (Math.random() - 0.5) * 2, volcanoTile.y + (Math.random() - 0.5) * 2, 1);
      }
    }
  }

  // Main simulation tick
  update(particleSystem, audioEngine) {
    // Progress time
    this.monthTicks++;
    if (this.monthTicks >= this.ticksPerMonth) {
      this.monthTicks = 0;
      this.month++;
      if (this.month > 12) {
        this.month = 1;
        this.year++;
      }
    }

    const nextGrid = this.grid.map(row => row.map(tile => ({ ...tile })));

    // Keep track of active systems
    let fireCount = 0;
    let volcanoCount = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.grid[y][x];
        const nextTile = nextGrid[y][x];

        // 1. Volcano Eruption cycle
        if (tile.type === 'volcano') {
          volcanoCount++;
          nextTile.volcanoEruptTick--;
          if (nextTile.volcanoEruptTick <= 0) {
            this.eruptVolcano(tile, particleSystem, audioEngine);
            nextTile.volcanoEruptTick = 400 + Math.random() * 600; // reset
          } else if (nextTile.volcanoEruptTick < 50 && Math.random() < 0.15) {
            // smoke before erupting
            if (particleSystem) particleSystem.emit('smoke', tile.x, tile.y, 1);
          }
        }

        // 2. Lava cooling and flow
        if (tile.type === 'lava') {
          // Glow and bubble particles
          if (Math.random() < 0.05 && particleSystem) {
            particleSystem.emit('lava_spark', tile.x + Math.random() - 0.5, tile.y + Math.random() - 0.5, 1);
          }

          // Flow downhill
          const neighbors = this.getNeighbors(x, y);
          neighbors.forEach(n => {
            const nextN = nextGrid[n.y][n.x];
            // Flow to lower tile
            if (n.elevation < tile.elevation && Math.random() < 0.08) {
              if (n.type === 'deep_ocean' || n.type === 'shallow_sea') {
                // cooled by sea water
                nextGrid[n.y][n.x] = this.createTile(n.x, n.y, 'mountain');
                nextGrid[n.y][n.x].elevation = 0.75;
                if (particleSystem) particleSystem.emit('steam', n.x, n.y, 3);
                if (audioEngine && Math.random() < 0.02) audioEngine.playSfx('steam');
              } else if (n.type !== 'lava' && n.type !== 'volcano' && n.type !== 'mountain') {
                nextGrid[n.y][n.x] = this.createTile(n.x, n.y, 'lava');
                nextGrid[n.y][n.x].elevation = n.elevation + 0.02; // build up height
                if (particleSystem) particleSystem.emit('smoke', n.x, n.y, 1);
              }
            }
          });

          // Slowly cool down lava back to mountain/stone if not near volcano
          nextTile.temperature = 1.0;
          if (Math.random() < 0.005) {
            // Cool down
            nextGrid[y][x] = this.createTile(x, y, 'mountain');
            nextGrid[y][x].elevation = Math.max(0.65, tile.elevation - 0.05);
          }
        }

        // 3. Fire Spread & ash
        if (tile.type === 'fire') {
          fireCount++;
          nextTile.fireDuration--;

          // Fire sparks
          if (Math.random() < 0.1 && particleSystem) {
            particleSystem.emit('fire', tile.x + Math.random() - 0.5, tile.y + Math.random() - 0.5, 1);
          }
          if (Math.random() < 0.08 && particleSystem) {
            particleSystem.emit('smoke', tile.x + Math.random() - 0.5, tile.y - Math.random() * 0.5, 1);
          }

          if (audioEngine && Math.random() < 0.01) {
            audioEngine.playSfx('fire_crackle');
          }

          // Spread to flammable adjacent tiles
          const neighbors = this.getNeighbors(x, y);
          neighbors.forEach(n => {
            if (n.type === 'grass' && Math.random() < 0.04) {
              nextGrid[n.y][n.x] = this.createTile(n.x, n.y, 'fire');
              nextGrid[n.y][n.x].fireDuration = 60 + Math.random() * 60;
            } else if (n.type === 'forest' && Math.random() < 0.09) {
              nextGrid[n.y][n.x] = this.createTile(n.x, n.y, 'fire');
              nextGrid[n.y][n.x].fireDuration = 100 + Math.random() * 100;
            }
          });

          // Burn out
          if (nextTile.fireDuration <= 0) {
            // Turn into soil with high ash
            nextGrid[y][x] = this.createTile(x, y, 'grass');
            nextGrid[y][x].ashLevel = 1.0;
            nextGrid[y][x].plantGrowTick = 200; // takes time to regrow
          }
        }

        // 4. Plant/Forest Growth
        if (tile.type === 'grass') {
          nextTile.plantGrowTick--;
          if (nextTile.plantGrowTick <= 0) {
            // Regrow grass or grow forest
            if (tile.ashLevel > 0) {
              // Ash acts as fertilizer!
              nextTile.ashLevel = Math.max(0, tile.ashLevel - 0.2);
              if (Math.random() < 0.4) {
                nextGrid[y][x] = this.createTile(x, y, 'forest');
              }
            } else if (tile.moisture > 0.4 && tile.temperature > 0.3 && tile.temperature < 0.8) {
              if (Math.random() < 0.15) {
                nextGrid[y][x] = this.createTile(x, y, 'forest');
              }
            }
            nextTile.plantGrowTick = 200 + Math.random() * 300;
          }
        }

        // 5. Water/Ice properties
        if (tile.type === 'ice') {
          // slowly melt if warm
          if (tile.temperature > 0.55 && Math.random() < 0.02) {
            nextGrid[y][x] = this.createTile(x, y, 'shallow_sea');
          }
        }
      }
    }

    this.grid = nextGrid;
    this.activeFires = fireCount;
    this.activeVolcanoes = volcanoCount;
    this.updateStats();
  }

  getNeighbors(x, y) {
    const list = [];
    const dirs = [
      {dx: 1, dy: 0}, {dx: -1, dy: 0},
      {dx: 0, dy: 1}, {dx: 0, dy: -1}
    ];
    dirs.forEach(d => {
      const tile = this.getTile(x + d.dx, y + d.dy);
      if (tile) list.push(tile);
    });
    return list;
  }

  updateStats() {
    let landCount = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.grid[y][x].type;
        if (t !== 'deep_ocean' && t !== 'shallow_sea') {
          landCount++;
        }
      }
    }
    this.landRatio = Math.round((landCount / (this.width * this.height)) * 100);
  }

  // Serialization
  serialize() {
    const data = {
      width: this.width,
      height: this.height,
      year: this.year,
      month: this.month,
      grid: this.grid.map(row => row.map(tile => ({
        type: tile.type,
        elevation: tile.elevation,
        temperature: tile.temperature,
        moisture: tile.moisture,
        lavaLevel: tile.lavaLevel,
        ashLevel: tile.ashLevel,
        volcanoEruptTick: tile.volcanoEruptTick
      })))
    };
    return JSON.stringify(data);
  }

  deserialize(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.width = data.width;
      this.height = data.height;
      this.year = data.year;
      this.month = data.month;
      
      this.grid = [];
      for (let y = 0; y < this.height; y++) {
        const row = [];
        for (let x = 0; x < this.width; x++) {
          const sTile = data.grid[y][x];
          const tile = this.createTile(x, y, sTile.type);
          tile.elevation = sTile.elevation;
          tile.temperature = sTile.temperature;
          tile.moisture = sTile.moisture;
          tile.lavaLevel = sTile.lavaLevel;
          tile.ashLevel = sTile.ashLevel || 0;
          tile.volcanoEruptTick = sTile.volcanoEruptTick || 0;
          row.push(tile);
        }
        this.grid.push(row);
      }
      this.updateStats();
      return true;
    } catch (e) {
      console.error("Failed to load map:", e);
      return false;
    }
  }

  // Noise generator for world seed
  generateWorld() {
    this.resetToOcean();
    
    // Simple layered value noise (sine sum noise) for procedural islands
    const seedX1 = Math.random() * 1000;
    const seedY1 = Math.random() * 1000;
    const seedX2 = Math.random() * 500;
    const seedY2 = Math.random() * 500;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const nx = x / this.width - 0.5;
        const ny = y / this.height - 0.5;
        
        // Circular mask to make island structure in center
        const distToCenter = Math.sqrt(nx*nx + ny*ny) * 2.0;

        // Wave noise
        const val1 = Math.sin(x * 0.08 + seedX1) * Math.cos(y * 0.08 + seedY1);
        const val2 = Math.sin(x * 0.2 + seedX2) * Math.sin(y * 0.25 + seedY2) * 0.5;
        
        let nValue = (val1 + val2 + 0.5) / 1.5; // normalized 0 to 1
        nValue = nValue * (1.0 - distToCenter * 0.85); // mask edges

        if (nValue > 0.58) {
          // Mountain peaks or Volcanoes
          if (nValue > 0.72) {
            if (Math.random() < 0.08) {
              this.setTileType(x, y, 'volcano');
            } else {
              this.setTileType(x, y, 'mountain');
            }
          } else if (Math.random() < 0.15) {
            this.setTileType(x, y, 'forest');
          } else {
            this.setTileType(x, y, 'grass');
          }
        } else if (nValue > 0.50) {
          // Grasslands
          this.setTileType(x, y, 'grass');
        } else if (nValue > 0.44) {
          // Beaches
          this.setTileType(x, y, 'sand');
        } else if (nValue > 0.25) {
          // Coastlines
          this.setTileType(x, y, 'shallow_sea');
        } else {
          this.setTileType(x, y, 'deep_ocean');
        }
      }
    }
    this.updateStats();
  }
}



// ==========================================
// MODULE: src/particles.js
// ==========================================
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 3000;
  }

  emit(type, gridX, gridY, count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift(); // remove oldest to prevent memory blow up
      }

      const p = {
        type,
        x: gridX,
        y: gridY,
        vx: 0,
        vy: 0,
        size: 1,
        color: '#fff',
        alpha: 1.0,
        life: 1.0, // 0 to 1
        decay: 0.02 + Math.random() * 0.03,
        gravity: 0,
        drift: 0
      };

      // Configuration based on type
      switch (type) {
        case 'smoke':
          p.vx = (Math.random() - 0.5) * 0.03;
          p.vy = -0.02 - Math.random() * 0.03;
          p.size = 0.3 + Math.random() * 0.4;
          p.color = `rgba(${80 + Math.random() * 40}, ${80 + Math.random() * 40}, ${80 + Math.random() * 40}, `;
          p.decay = 0.01 + Math.random() * 0.01;
          break;

        case 'steam':
          p.vx = (Math.random() - 0.5) * 0.04;
          p.vy = -0.04 - Math.random() * 0.04;
          p.size = 0.2 + Math.random() * 0.3;
          p.color = 'rgba(230, 230, 240, ';
          p.decay = 0.02 + Math.random() * 0.02;
          break;

        case 'fire':
          p.vx = (Math.random() - 0.5) * 0.05;
          p.vy = -0.03 - Math.random() * 0.05;
          p.size = 0.2 + Math.random() * 0.3;
          // random red/orange/yellow
          const r = 230 + Math.floor(Math.random() * 25);
          const g = 80 + Math.floor(Math.random() * 120);
          const b = 20 + Math.floor(Math.random() * 30);
          p.color = `rgba(${r}, ${g}, ${b}, `;
          p.decay = 0.02 + Math.random() * 0.03;
          break;

        case 'lava_spark':
          // explosive arc spark
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.05 + Math.random() * 0.12;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - 0.05; // upward bias
          p.size = 0.15 + Math.random() * 0.15;
          p.color = `rgba(255, ${120 + Math.floor(Math.random() * 135)}, 0, `;
          p.gravity = 0.006; // pulled down by gravity
          p.decay = 0.015 + Math.random() * 0.015;
          break;

        case 'rain':
          p.x = gridX + (Math.random() - 0.5) * 1.5; // wider area
          p.vx = -0.15 - Math.random() * 0.05; // wind blow to left
          p.vy = 0.25 + Math.random() * 0.15;  // fast falling down
          p.size = 0.05 + Math.random() * 0.05;
          p.color = 'rgba(120, 190, 255, ';
          p.decay = 0.03 + Math.random() * 0.04;
          break;

        case 'snow':
          p.x = gridX + (Math.random() - 0.5) * 1.5;
          p.vx = -0.02 - Math.random() * 0.03; // slow wind drift
          p.vy = 0.04 + Math.random() * 0.04;  // gentle fall
          p.size = 0.08 + Math.random() * 0.12;
          p.color = 'rgba(255, 255, 255, ';
          p.decay = 0.01 + Math.random() * 0.02;
          break;
      }

      this.particles.push(p);
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Apply forces
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;

      // Type-specific update modifications
      if (p.type === 'smoke' || p.type === 'steam') {
        p.size += 0.005; // expand in size
      }

      p.life -= p.decay;
      p.alpha = Math.max(0, p.life);

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // Weather triggers to spawn rain/snow
  updateWeather(world, activeWeather, density = 3) {
    if (!activeWeather || activeWeather === 'none') return;
    
    // Pick random spots on screen to drop rain/snow
    for (let d = 0; d < density; d++) {
      const rx = Math.random() * world.width;
      const ry = Math.random() * world.height * 0.7; // emit mostly from top half to fall down
      
      if (activeWeather === 'rain') {
        this.emit('rain', rx, ry, 1);
      } else if (activeWeather === 'snow') {
        this.emit('snow', rx, ry, 1);
      }
    }
  }

  render(ctx, tileSize) {
    // Save state, ready for grid space drawing
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.fillStyle = p.color + p.alpha + ')';

      const px = p.x * tileSize;
      const py = p.y * tileSize;
      const sizePx = p.size * tileSize;

      ctx.beginPath();
      if (p.type === 'rain') {
        // Draw falling drops as slanted streaks
        ctx.strokeStyle = p.color + (p.alpha * 0.6) + ')';
        ctx.lineWidth = 1.5;
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.vx * tileSize * 0.8, py + p.vy * tileSize * 0.8);
        ctx.stroke();
      } else if (p.type === 'lava_spark') {
        // Draw sparks as small glowing rectangles
        ctx.fillRect(px - sizePx / 2, py - sizePx / 2, sizePx, sizePx);
      } else {
        // Draw round particles for smoke, steam, snow
        ctx.arc(px, py, sizePx, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}



// ==========================================
// MODULE: src/audio.js
// ==========================================
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicPlaying = false;
    this.ambientOscs = [];
    this.ambientGain = null;
    this.musicTimeout = null;

    // Simple procedural sound effects queue rate limiters
    this.lastSfxTime = {};
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      // Ambient gain
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.0; // Starts muted, fades in
      this.ambientGain.connect(this.masterGain);

      // Start infinite ambient soundtrack loop
      this.startAmbientMusic();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked:", e);
    }
  }

  toggle(forceState) {
    if (forceState !== undefined) {
      this.enabled = forceState;
    } else {
      this.enabled = !this.enabled;
    }

    if (this.ctx) {
      if (this.enabled) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        this.fadeGain(this.ambientGain, 0.15, 1.5); // Fade ambient back in
      } else {
        this.fadeGain(this.ambientGain, 0.0, 1.0);  // Mute ambient
      }
    }
    return this.enabled;
  }

  fadeGain(gainNode, targetValue, duration) {
    if (!gainNode || !this.ctx) return;
    gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(targetValue, this.ctx.currentTime + duration);
  }

  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  playSfx(type) {
    if (!this.enabled) return;
    this.init(); // Auto init on user interaction
    if (!this.ctx) return;

    // Rate limit same sound effects
    const now = this.ctx.currentTime;
    if (this.lastSfxTime[type] && now - this.lastSfxTime[type] < 0.1) {
      return;
    }
    this.lastSfxTime[type] = now;

    switch (type) {
      case 'place':
        this.synthesizePlaceSound();
        break;
      case 'steam':
        this.synthesizeSteamSound();
        break;
      case 'eruption':
        this.synthesizeEruptionSound();
        break;
      case 'fire_crackle':
        this.synthesizeFireCrackle();
        break;
    }
  }

  synthesizePlaceSound() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  synthesizeSteamSound() {
    // Sizzling noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4500, this.ctx.currentTime);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.35);
  }

  synthesizeFireCrackle() {
    // Sharp clicky pops for fire crackle
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100 + Math.random() * 500, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime + 0.015);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.02);
  }

  synthesizeEruptionSound() {
    // Deep low rumble explosion
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 1.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.0);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // Deep sub sweep oscillator
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, this.ctx.currentTime);
    subOsc.frequency.linearRampToValueAtTime(20, this.ctx.currentTime + 1.2);
    
    subGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    noise.start();
    noise.stop(this.ctx.currentTime + 2.0);

    subOsc.start();
    subOsc.stop(this.ctx.currentTime + 1.5);
  }

  // Infinite procedural peaceful ambient soundtrack
  startAmbientMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    
    if (this.enabled) {
      this.fadeGain(this.ambientGain, 0.15, 2.0);
    }

    // Modal scales for beautiful celestial space music
    // We will alternate between C Major (C - E - G - B), A Minor (A - C - E - G), F Major (F - A - C - E), and G Major (G - B - D - F)
    const chords = [
      [130.81, 164.81, 196.00, 246.94], // Cmaj7 (C3, E3, G3, B3)
      [110.00, 130.81, 164.81, 196.00], // Amin7 (A2, C3, E3, G3)
      [87.31, 110.00, 130.81, 164.81],  // Fmaj7 (F2, A2, C3, E3)
      [98.00, 123.47, 146.83, 174.61]   // Gdom7 (G2, B2, D3, F3)
    ];

    let chordIndex = 0;

    const playNextChord = () => {
      if (!this.enabled || !this.musicPlaying) {
        this.musicTimeout = setTimeout(playNextChord, 8000);
        return;
      }

      const activeChord = chords[chordIndex];
      chordIndex = (chordIndex + 1) % chords.length;

      const oscs = [];
      const now = this.ctx.currentTime;

      // Play each note of the chord with a slow attack / release and gentle detune
      activeChord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        
        // Soft detuning for rich chorusing
        osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);

        // Slow Attack / Fade out
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04 + (Math.random() * 0.02), now + 2.0 + Math.random() * 1.0);
        gain.gain.setValueAtTime(gain.gain.value, now + 5.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 8.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);

        osc.start(now);
        osc.stop(now + 9.0);

        oscs.push(osc);
      });

      this.musicTimeout = setTimeout(playNextChord, 8000);
    };

    playNextChord();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimeout) clearTimeout(this.musicTimeout);
  }
}



// ==========================================
// MODULE: src/renderer.js
// ==========================================
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    
    // Palette Colors
    this.colors = {
      deep_ocean: '#0b1d3a',
      shallow_sea: '#1a5f7a',
      sand: '#dfba73',
      grass: '#387c44',
      forest: '#1e5128',
      mountain: '#5c636e',
      volcano: '#32323a',
      lava: '#e03e1b',
      ice: '#c8e3e9',
      fire: '#f86f1b',
      ash: '#48444c'
    };

    // Day/Night progression variables
    this.timeOfDay = 8.0; // 0 to 24 hours
    this.cycleSpeed = 0.01; // hours per tick
    this.enableDayNight = true;

    // Clouds array
    this.clouds = [];
    this.initClouds();

    // 3D Scene initialization
    this.scene = new THREE.Scene();
    
    // Camera settings for 3D Orbit Camera
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
    this.cameraDistance = 110;
    this.cameraTheta = Math.PI / 4; // Yaw angle
    this.cameraPhi = Math.PI / 3.5; // Pitch angle (tilted down)
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.updateCameraPosition();

    // WebGL Renderer Setup
    this.renderer3D = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer3D.shadowMap.enabled = true;
    this.renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer3D.setClearColor(0x07070a, 1);

    // Setup Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.left = -60;
    this.dirLight.shadow.camera.right = 60;
    this.dirLight.shadow.camera.top = 60;
    this.dirLight.shadow.camera.bottom = -60;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 400;
    this.dirLight.shadow.bias = -0.0008;
    this.scene.add(this.dirLight);

    // Setup sharing geometries & materials
    this.boxGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    
    this.tileMaterial = new THREE.MeshStandardMaterial({ 
      roughness: 0.8, 
      metalness: 0.1 
    });
    
    this.glowMaterial = new THREE.MeshStandardMaterial({ 
      roughness: 0.4, 
      metalness: 0.1, 
      emissive: new THREE.Color(0xff3300), 
      emissiveIntensity: 1.5 
    });

    // 10,000 grid tiles Instanced Meshes (for terrain)
    this.terrainMesh = new THREE.InstancedMesh(this.boxGeom, this.tileMaterial, 10000);
    this.terrainMesh.castShadow = true;
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);

    this.glowTerrainMesh = new THREE.InstancedMesh(this.boxGeom, this.glowMaterial, 10000);
    this.glowTerrainMesh.castShadow = true;
    this.glowTerrainMesh.receiveShadow = true;
    this.scene.add(this.glowTerrainMesh);

    // Setup Feature meshes (Trees, Mountains, Volcanoes)
    const leavesGeom = new THREE.ConeGeometry(0.25, 0.7, 5);
    this.treeMesh = new THREE.InstancedMesh(leavesGeom, new THREE.MeshStandardMaterial({ color: 0x1e5128, roughness: 0.9 }), 10000);
    this.treeMesh.castShadow = true;
    this.treeMesh.receiveShadow = true;
    this.scene.add(this.treeMesh);

    const mountainGeom = new THREE.ConeGeometry(0.6, 1.6, 5);
    this.mountainMesh = new THREE.InstancedMesh(mountainGeom, new THREE.MeshStandardMaterial({ color: 0x5c636e, roughness: 0.85 }), 2000);
    this.mountainMesh.castShadow = true;
    this.mountainMesh.receiveShadow = true;
    this.scene.add(this.mountainMesh);

    const snowGeom = new THREE.ConeGeometry(0.3, 0.8, 5);
    this.snowMesh = new THREE.InstancedMesh(snowGeom, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), 2000);
    this.snowMesh.castShadow = true;
    this.snowMesh.receiveShadow = true;
    this.scene.add(this.snowMesh);

    const volcanoGeom = new THREE.CylinderGeometry(0.2, 0.7, 1.2, 6);
    this.volcanoMesh = new THREE.InstancedMesh(volcanoGeom, new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.9 }), 500);
    this.volcanoMesh.castShadow = true;
    this.volcanoMesh.receiveShadow = true;
    this.scene.add(this.volcanoMesh);

    const craterGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 6);
    this.craterMesh = new THREE.InstancedMesh(craterGeom, new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff1100, emissiveIntensity: 2.0 }), 500);
    this.scene.add(this.craterMesh);

    // Setup Water Plane
    const waterGeom = new THREE.PlaneGeometry(102, 102, 32, 32);
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f3b5f,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.1
    });
    this.waterMesh = new THREE.Mesh(waterGeom, this.waterMaterial);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = 1.6; // Water height is constant
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);

    // Setup Cloud Meshes
    this.cloudGroup = new THREE.Group();
    this.scene.add(this.cloudGroup);
    this.cloudMeshes = [];
    
    // Create 3D Cloud geometries (clusters of spheres)
    const cloudGeo = new THREE.SphereGeometry(1, 8, 8);
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.45 });
    
    for (let i = 0; i < 15; i++) {
      const singleCloud = new THREE.Group();
      
      const part1 = new THREE.Mesh(cloudGeo, cloudMat);
      part1.scale.set(2, 1.2, 1.5);
      part1.castShadow = true;
      singleCloud.add(part1);

      const part2 = new THREE.Mesh(cloudGeo, cloudMat);
      part2.position.set(1.2, 0.1, 0);
      part2.scale.set(1.3, 0.9, 1.1);
      part2.castShadow = true;
      singleCloud.add(part2);

      const part3 = new THREE.Mesh(cloudGeo, cloudMat);
      part3.position.set(-1.2, 0.1, 0);
      part3.scale.set(1.3, 0.9, 1.1);
      part3.castShadow = true;
      singleCloud.add(part3);

      singleCloud.castShadow = true;
      this.cloudGroup.add(singleCloud);
      this.cloudMeshes.push(singleCloud);
    }

    // Particle Points Mesh Setup
    const maxParticles = 2000;
    this.particleGeom = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(maxParticles * 3);
    this.particleColors = new Float32Array(maxParticles * 3);
    this.particleGeom.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeom.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
    
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    this.particlePoints = new THREE.Points(this.particleGeom, this.particleMaterial);
    this.scene.add(this.particlePoints);

    // Rain lines mesh setup
    this.rainGeom = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(maxParticles * 2 * 3); // 2 vertices per line, 3 coords per vertex
    this.rainGeom.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    
    this.rainMaterial = new THREE.LineBasicMaterial({
      color: 0x78beff,
      transparent: true,
      opacity: 0.6
    });
    this.rainSegments = new THREE.LineSegments(this.rainGeom, this.rainMaterial);
    this.scene.add(this.rainSegments);

    // Raycaster for Mouse Coordinate mapping
    this.raycaster = new THREE.Raycaster();
  }

  initClouds() {
    this.clouds = [];
    for (let i = 0; i < 15; i++) {
      this.clouds.push({
        x: Math.random() * 120 - 10,
        y: Math.random() * 120 - 10,
        size: 3 + Math.random() * 6,
        vx: 0.01 + Math.random() * 0.02,
        vy: (Math.random() - 0.5) * 0.005,
        opacity: 0.2 + Math.random() * 0.2
      });
    }
  }

  resize(width, height) {
    this.renderer3D.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // Translates screen coordinates to 3D grid index
  screenToGrid(screenX, screenY, tileSize) {
    const mouse = new THREE.Vector2();
    mouse.x = (screenX / this.canvas.width) * 2 - 1;
    mouse.y = -(screenY / this.canvas.height) * 2 + 1;

    this.raycaster.setFromCamera(mouse, this.camera);

    // Raycast against ground plane at height Y=1.5
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.8);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, target)) {
      const gridX = Math.floor(target.x + 50);
      const gridY = Math.floor(target.z + 50);
      return { x: gridX, y: gridY };
    }
    return { x: -1, y: -1 };
  }

  getTileSize() {
    return 16;
  }

  updateCameraPosition() {
    const x = this.cameraTarget.x + this.cameraDistance * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
    const y = this.cameraTarget.y + this.cameraDistance * Math.cos(this.cameraPhi);
    const z = this.cameraTarget.z + this.cameraDistance * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  // Helper mapping for heights based on elevation
  getTileHeight(tile) {
    // scale elevation to reasonable columns
    return 0.2 + tile.elevation * 12.0;
  }

  render(world, particleSystem) {
    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();
    const time = Date.now() / 1000;

    // 1. Process Day / Night Light Transitions
    this.updateDayNightCycle();

    // 2. Animate Water Plane (undulating vertices)
    this.animateWater(time);

    // 3. Render Terrain Grid Tiles
    // Deep Ocean is at height, Grasslands are medium, Mountains are tall
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        const idx = y * world.width + x;
        const height = this.getTileHeight(tile);

        // Determine if it is glowing (lava, fire)
        const isGlowing = tile.type === 'lava' || tile.type === 'fire';

        // Translate and scale block based on tile properties
        tempMatrix.makeScale(0.98, height, 0.98); // slight border gap for game-board grid look
        tempMatrix.setPosition(x - 50, height / 2, y - 50);

        if (isGlowing) {
          this.glowTerrainMesh.setMatrixAt(idx, tempMatrix);
          
          let colStr = this.colors[tile.type];
          if (tile.type === 'fire') {
            const p = 0.8 + Math.sin(time * 12 + x) * 0.2;
            tempColor.setRGB(p, p * 0.4, 0.05); // pulsing fire
          } else {
            tempColor.set(colStr);
          }
          this.glowTerrainMesh.setColorAt(idx, tempColor);
          
          // Clear standard mesh instance
          tempMatrix.makeScale(0, 0, 0);
          tempMatrix.setPosition(0, -999, 0);
          this.terrainMesh.setMatrixAt(idx, tempMatrix);
        } else {
          this.terrainMesh.setMatrixAt(idx, tempMatrix);
          
          // Apply custom blending colors
          tempColor.set(this.colors[tile.type] || this.colors.deep_ocean);
          
          // Ash overlay tint
          if (tile.ashLevel > 0) {
            tempColor.lerp(new THREE.Color(0x48444c), tile.ashLevel * 0.65);
          }
          // Ice/Freezing overlay tint
          if (tile.type === 'ice') {
            tempColor.addScalar(0.05);
          }

          this.terrainMesh.setColorAt(idx, tempColor);

          // Clear glow mesh instance
          tempMatrix.makeScale(0, 0, 0);
          tempMatrix.setPosition(0, -999, 0);
          this.glowTerrainMesh.setMatrixAt(idx, tempMatrix);
        }
      }
    }
    this.terrainMesh.instanceMatrix.needsUpdate = true;
    if (this.terrainMesh.instanceColor) this.terrainMesh.instanceColor.needsUpdate = true;
    this.glowTerrainMesh.instanceMatrix.needsUpdate = true;
    if (this.glowTerrainMesh.instanceColor) this.glowTerrainMesh.instanceColor.needsUpdate = true;

    // 4. Render 3D Terrain Features (Trees, Mountains, Volcanoes)
    this.renderFeatures(world, time);

    // 5. Render Floating Clouds (Volumetric)
    this.renderClouds();

    // 6. Render Particles in 3D (Points & LineSegments)
    this.renderParticles(particleSystem, world);

    // 7. Fire WebGL Renderer
    this.renderer3D.render(this.scene, this.camera);
  }

  animateWater(time) {
    const pos = this.waterMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const ux = pos.getX(i);
      const uy = pos.getY(i);
      // calculate sine displacement waves
      const wave = Math.sin(ux * 0.15 + time * 1.5) * 0.08 + Math.cos(uy * 0.15 + time * 1.2) * 0.08;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
    this.waterMesh.geometry.computeVertexNormals();
  }

  renderFeatures(world, time) {
    let treeCount = 0;
    let mountainCount = 0;
    let volcanoCount = 0;

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        const height = this.getTileHeight(tile);
        const tx = x - 50;
        const tz = y - 50;

        // Draw forest pine trees
        if (tile.type === 'forest') {
          // Tree foliage 1
          tempMatrix.makeScale(1, 1, 1);
          tempMatrix.setPosition(tx, height + 0.35, tz);
          this.treeMesh.setMatrixAt(treeCount++, tempMatrix);
        }

        // Draw mountain peaks and snow-caps
        if (tile.type === 'mountain') {
          // Grey cone base
          tempMatrix.makeScale(1.2, 1.2, 1.2);
          tempMatrix.setPosition(tx, height + 0.8, tz);
          this.mountainMesh.setMatrixAt(mountainCount, tempMatrix);

          // White snow-cap on tip
          tempMatrix.makeScale(0.6, 0.6, 0.6);
          tempMatrix.setPosition(tx, height + 1.28, tz);
          this.snowMesh.setMatrixAt(mountainCount, tempMatrix);
          
          mountainCount++;
        }

        // Draw volcanoes & active lava craters
        if (tile.type === 'volcano') {
          // Volcano cone
          tempMatrix.makeScale(1.1, 1.0, 1.1);
          tempMatrix.setPosition(tx, height + 0.6, tz);
          this.volcanoMesh.setMatrixAt(volcanoCount, tempMatrix);

          // Glowing lava crater
          tempMatrix.makeScale(1.0, 1.0, 1.0);
          tempMatrix.setPosition(tx, height + 1.22, tz);
          this.craterMesh.setMatrixAt(volcanoCount, tempMatrix);
          
          volcanoCount++;
        }
      }
    }

    // Update instances count & updates
    this.treeMesh.count = treeCount;
    this.treeMesh.instanceMatrix.needsUpdate = true;

    this.mountainMesh.count = mountainCount;
    this.mountainMesh.instanceMatrix.needsUpdate = true;

    this.snowMesh.count = mountainCount;
    this.snowMesh.instanceMatrix.needsUpdate = true;

    this.volcanoMesh.count = volcanoCount;
    this.volcanoMesh.instanceMatrix.needsUpdate = true;

    this.craterMesh.count = volcanoCount;
    this.craterMesh.instanceMatrix.needsUpdate = true;
  }

  renderClouds() {
    this.clouds.forEach((c, i) => {
      c.x += c.vx;
      c.y += c.vy;

      if (c.x > 110) c.x = -15;
      if (c.y > 110) c.y = -15;
      if (c.y < -15) c.y = 110;

      const mesh = this.cloudMeshes[i];
      if (mesh) {
        mesh.position.set(c.x - 50, 18, c.y - 50);
        mesh.rotation.y = timeOfDayAngle(this.timeOfDay) * 0.05 + i;
      }
    });

    function timeOfDayAngle(time) {
      return (time / 24) * Math.PI * 2;
    }
  }

  renderParticles(particleSystem, world) {
    const posAttr = this.particleGeom.attributes.position;
    const colAttr = this.particleGeom.attributes.color;
    const positions = posAttr.array;
    const colors = colAttr.array;

    const rainPosAttr = this.rainGeom.attributes.position;
    const rainPositions = rainPosAttr.array;

    let ptCount = 0;
    let rainCount = 0;

    for (let i = 0; i < particleSystem.particles.length; i++) {
      const p = particleSystem.particles[i];
      
      // Inject spawn coords helper inside renderer
      if (p.spawnX === undefined) p.spawnX = p.x;
      if (p.spawnY === undefined) p.spawnY = p.y;

      const px = p.x - 50;
      const pz = p.spawnY - 50;

      // Find local tile height
      const tx = Math.max(0, Math.min(world.width - 1, Math.floor(p.x)));
      const ty = Math.max(0, Math.min(world.height - 1, Math.floor(p.spawnY)));
      const tHeight = this.getTileHeight(world.grid[ty][tx]);

      // Handle particle representation in 3D
      if (p.type === 'rain') {
        const fallHeight = 25 - (p.y - p.spawnY) * 16.0;
        
        // Skip if hit ground
        if (fallHeight > tHeight) {
          const idx = rainCount * 6;
          // Rain streak starts at:
          rainPositions[idx] = px;
          rainPositions[idx + 1] = fallHeight;
          rainPositions[idx + 2] = pz;
          // Ends at:
          rainPositions[idx + 3] = px + p.vx;
          rainPositions[idx + 4] = fallHeight - 1.5;
          rainPositions[idx + 5] = pz + p.vx * 0.5;
          rainCount++;
        }
      } else if (p.type === 'snow') {
        const fallHeight = 22 - (p.y - p.spawnY) * 8.0;
        if (fallHeight > tHeight && ptCount < 2000) {
          const idx = ptCount * 3;
          positions[idx] = px;
          positions[idx + 1] = fallHeight;
          positions[idx + 2] = pz;

          // Pure white
          colors[idx] = 1.0;
          colors[idx + 1] = 1.0;
          colors[idx + 2] = 1.0;
          ptCount++;
        }
      } else {
        // Rises upwards (smoke, steam, fire, lava sparks)
        let riseHeight = tHeight + (p.spawnY - p.y) * 10.0;
        
        // Fire sparks rise slower
        if (p.type === 'fire') {
          riseHeight = tHeight + (p.spawnY - p.y) * 5.0;
        } else if (p.type === 'lava_spark') {
          riseHeight = tHeight + (p.spawnY - p.y) * 11.0;
        }

        if (riseHeight < 40 && ptCount < 2000) {
          const idx = ptCount * 3;
          positions[idx] = px;
          positions[idx + 1] = riseHeight;
          positions[idx + 2] = pz;

          // Extract particle color values from CSS rgb/rgba string
          let col = new THREE.Color(0xffffff);
          if (p.color.startsWith('rgba(')) {
            const parts = p.color.replace('rgba(', '').split(',');
            const r = parseFloat(parts[0]) / 255;
            const g = parseFloat(parts[1]) / 255;
            const b = parseFloat(parts[2]) / 255;
            col.setRGB(r, g, b);
          } else if (p.color.startsWith('rgba(230, 230, 240')) {
            col.setRGB(0.9, 0.9, 0.95);
          }

          colors[idx] = col.r;
          colors[idx + 1] = col.g;
          colors[idx + 2] = col.b;
          ptCount++;
        }
      }
    }

    // Update buffer values
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.particleGeom.setDrawRange(0, ptCount);

    rainPosAttr.needsUpdate = true;
    this.rainGeom.setDrawRange(0, rainCount * 2);
  }

  updateDayNightCycle() {
    if (this.enableDayNight) {
      this.timeOfDay = (this.timeOfDay + this.cycleSpeed) % 24;
    } else {
      this.timeOfDay = 12.0; // Locked at noon
    }

    // Set Sun Angle and Position
    const sunAngle = (this.timeOfDay / 24) * Math.PI * 2 - Math.PI / 2;
    const lx = Math.cos(sunAngle) * 120;
    const ly = Math.sin(sunAngle) * 120;
    const lz = 25; // Constant offset back

    // Modify directional and ambient lights based on time transitions
    const skyColor = new THREE.Color(0x07070a);

    if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
      // Sunset transition
      const ratio = (this.timeOfDay - 18) / 2;
      this.ambientLight.color.setHex(0xe05530);
      this.ambientLight.intensity = 0.4 - ratio * 0.25;

      this.dirLight.color.setHex(0xffaa44);
      this.dirLight.intensity = 0.7 - ratio * 0.45;
      
      skyColor.setRGB(0.08 - ratio * 0.06, 0.05 - ratio * 0.04, 0.06 - ratio * 0.04);
    } else if (this.timeOfDay >= 20 || this.timeOfDay < 4) {
      // Night
      let ratio = 1.0;
      if (this.timeOfDay < 4) {
        ratio = 1.0 - (this.timeOfDay / 4);
      } else if (this.timeOfDay < 22) {
        ratio = (this.timeOfDay - 20) / 2;
      }
      this.ambientLight.color.setHex(0x101030);
      this.ambientLight.intensity = 0.15;

      this.dirLight.color.setHex(0x4f6fcf);
      this.dirLight.intensity = 0.25;

      skyColor.setRGB(0.02, 0.02, 0.04);
    } else if (this.timeOfDay >= 4 && this.timeOfDay < 6) {
      // Sunrise transition
      const ratio = (this.timeOfDay - 4) / 2;
      this.ambientLight.color.setHex(0xd04070);
      this.ambientLight.intensity = 0.15 + ratio * 0.25;

      this.dirLight.color.setHex(0xffaacc);
      this.dirLight.intensity = 0.25 + ratio * 0.45;

      skyColor.setRGB(0.02 + ratio * 0.06, 0.02 + ratio * 0.03, 0.04 + ratio * 0.02);
    } else {
      // Day (Noon)
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.45;

      this.dirLight.color.setHex(0xffffff);
      this.dirLight.intensity = 1.0;

      skyColor.setHex(0x07070a);
    }

    // Set Sun Position (always high Y for active shadow casting, but adjust dimness)
    this.dirLight.position.set(lx, Math.abs(ly) + 15, lz);
    this.renderer3D.setClearColor(skyColor, 1);
  }

  // Get current hour string format (e.g. 08:30 AM)
  getTimeString() {
    const hoursInt = Math.floor(this.timeOfDay);
    const minutes = Math.floor((this.timeOfDay % 1) * 60).toString().padStart(2, '0');
    const ampm = hoursInt >= 12 ? 'PM' : 'AM';
    const displayHour = (hoursInt % 12 || 12).toString().padStart(2, '0');
    return `${displayHour}:${minutes} ${ampm}`;
  }
}


// ==========================================
// MODULE: src/game.js
// ==========================================

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.world = new World(100, 100);
    this.renderer = new Renderer(this.canvas);
    this.particles = new ParticleSystem();
    this.audio = new AudioEngine();
    this.ui = new UIManager(this.world, this.renderer, this.particles, this.audio);

    // Interaction states
    this.isMouseDown = false;
    this.isPanning = false;
    this.isRotating = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.mouseX = 0;
    this.mouseY = 0;

    // Simulation tick scheduler
    this.lastTickTime = 0;
    this.tickRate = 120; // ms per tick at speed 1x

    this.initEvents();
    this.handleResize();
    this.world.generateWorld(); // start with a nice procedural seed island
  }

  start() {
    // Loop
    const loop = (timestamp) => {
      this.update(timestamp);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  initEvents() {
    window.addEventListener('resize', () => this.handleResize());

    // Prevent context menu on canvas (we use right click to pan/rotate)
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse Listeners
    this.canvas.addEventListener('mousedown', (e) => {
      this.audio.init(); // initialize Web Audio on user click

      this.isMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      // Panning / Rotation triggers:
      if (e.button === 1 || (e.button === 2 && e.shiftKey)) {
        this.isRotating = true;
        this.canvas.style.cursor = 'crosshair';
      } else if (e.button === 2) {
        this.isPanning = true;
        this.canvas.style.cursor = 'grabbing';
      } else if (e.button === 0) {
        // Left click draws terrain
        this.paintAtMouse(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      const rect = this.canvas.getBoundingClientRect();
      const canvasX = this.mouseX - rect.left;
      const canvasY = this.mouseY - rect.top;

      // Perform hover check for UI Info telemetry
      const gridCoords = this.renderer.screenToGrid(canvasX, canvasY, this.renderer.getTileSize());
      const tile = this.world.getTile(gridCoords.x, gridCoords.y);
      
      const hoverEvent = new CustomEvent('tile-hover', { detail: { tile } });
      window.dispatchEvent(hoverEvent);

      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;

      if (this.isPanning) {
        // Drag pan camera target on the flat XZ ground
        const scale = this.renderer.cameraDistance * 0.0012;
        const fX = Math.sin(this.renderer.cameraTheta);
        const fZ = Math.cos(this.renderer.cameraTheta);
        const rX = -Math.cos(this.renderer.cameraTheta);
        const rZ = Math.sin(this.renderer.cameraTheta);

        this.renderer.cameraTarget.x -= (dx * rX + dy * fX) * scale;
        this.renderer.cameraTarget.z -= (dx * rZ + dy * fZ) * scale;
        this.renderer.updateCameraPosition();
      } else if (this.isRotating) {
        // Drag rotate (Yaw / Pitch)
        this.renderer.cameraTheta -= dx * 0.007;
        this.renderer.cameraPhi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, this.renderer.cameraPhi + dy * 0.007));
        this.renderer.updateCameraPosition();
      } else if (this.isMouseDown && e.buttons === 1) {
        // Drag paint terrain
        this.paintAtMouse(e.clientX, e.clientY);
      }

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', (e) => {
      this.isMouseDown = false;
      this.isPanning = false;
      this.isRotating = false;
      this.canvas.style.cursor = 'default';
    });

    // Zoom Listener
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      // Zoom camera distance along its view vector
      const delta = e.deltaY;
      this.renderer.cameraDistance = Math.max(15, Math.min(200, this.renderer.cameraDistance + delta * 0.05));
      this.renderer.updateCameraPosition();
    }, { passive: false });
  }

  paintAtMouse(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    const gridCoords = this.renderer.screenToGrid(canvasX, canvasY, this.renderer.getTileSize());
    
    this.world.paintTerrain(
      gridCoords.x,
      gridCoords.y,
      this.ui.activeTool,
      this.ui.brushSize,
      this.ui.brushShape,
      this.particles,
      this.audio
    );
  }

  handleResize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  update(timestamp) {
    // 1. Particle physics update
    this.particles.update();

    // 2. Weather clouds emitting particles
    const activeWeather = (this.ui.activeTool === 'rain' || this.ui.activeTool === 'snow') ? this.ui.activeTool : 'none';
    
    // Spawn general weather rain or snow particles
    if (activeWeather !== 'none' && this.isMouseDown) {
      // Spawn weather under the brush
      const rect = this.canvas.getBoundingClientRect();
      const cx = this.mouseX - rect.left;
      const cy = this.mouseY - rect.top;
      const coords = this.renderer.screenToGrid(cx, cy, this.renderer.getTileSize());
      this.particles.updateWeather(this.world, activeWeather, 4);
    } else {
      // Soft ambient rain/snow if cloud active
      this.particles.updateWeather(this.world, 'none');
    }

    // 3. Simulation update based on speed
    if (this.ui.simSpeed > 0) {
      const currentRate = this.tickRate / this.ui.simSpeed;
      if (timestamp - this.lastTickTime >= currentRate) {
        this.world.update(this.particles, this.audio);
        this.lastTickTime = timestamp;
      }
    }

    // 4. Update HUD overlay text details
    this.ui.updateHUD(this.world, this.renderer);
  }

  render() {
    this.renderer.render(this.world, this.particles);
  }
}



// ==========================================
// MODULE: src/ui.js
// ==========================================
const { ipcRenderer } = require('electron');

class UIManager {
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



// ==========================================
// MODULE: src/main.js
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.start();
});



