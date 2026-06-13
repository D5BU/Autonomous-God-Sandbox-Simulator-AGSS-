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
// 1. WORLD PHYSICS ENGINE
// ==========================================
class World {
  constructor(width = 100, height = 100) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.year = 1;
    this.month = 1;
    this.monthTicks = 0;
    this.ticksPerMonth = 150;

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
      temperature: 0.5,
      moisture: 0.5,
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

  paintTerrain(centerX, centerY, tool, radius, shape, particleSystem, audioEngine) {
    const rInt = Math.ceil(radius);
    for (let dy = -rInt; dy <= rInt; dy++) {
      for (let dx = -rInt; dx <= rInt; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const tile = this.getTile(x, y);
        if (!tile) continue;

        if (shape === 'circle' && dx * dx + dy * dy > radius * radius) {
          continue;
        }

        switch (tool) {
          case 'deep_ocean':
          case 'shallow_sea':
          case 'sand':
          case 'grass':
          case 'forest':
          case 'mountain':
          case 'volcano':
            this.setTileType(x, y, tool);
            if (Math.random() < 0.05 && audioEngine) audioEngine.playSfx('place');
            break;

          case 'lava':
            if (tile.type !== 'deep_ocean' && tile.type !== 'shallow_sea') {
              this.setTileType(x, y, 'lava');
              if (particleSystem) particleSystem.emit('lava_spark', tile.x, tile.y, 3);
            } else {
              this.setTileType(x, y, 'mountain');
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
              tile.type = 'ice';
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
                this.setTileType(x, y, 'sand');
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

  eruptVolcano(volcanoTile, particleSystem, audioEngine) {
    if (audioEngine) audioEngine.playSfx('eruption');
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

    if (particleSystem) {
      for (let i = 0; i < 25; i++) {
        particleSystem.emit('lava_spark', volcanoTile.x + (Math.random() - 0.5) * 1.5, volcanoTile.y + (Math.random() - 0.5) * 1.5, 1);
        particleSystem.emit('smoke', volcanoTile.x + (Math.random() - 0.5) * 2, volcanoTile.y + (Math.random() - 0.5) * 2, 1);
      }
    }
  }

  update(particleSystem, audioEngine) {
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
    let fireCount = 0;
    let volcanoCount = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.grid[y][x];
        const nextTile = nextGrid[y][x];

        if (tile.type === 'volcano') {
          volcanoCount++;
          nextTile.volcanoEruptTick--;
          if (nextTile.volcanoEruptTick <= 0) {
            this.eruptVolcano(tile, particleSystem, audioEngine);
            nextTile.volcanoEruptTick = 400 + Math.random() * 600;
          } else if (nextTile.volcanoEruptTick < 50 && Math.random() < 0.15) {
            if (particleSystem) particleSystem.emit('smoke', tile.x, tile.y, 1);
          }
        }

        if (tile.type === 'lava') {
          if (Math.random() < 0.05 && particleSystem) {
            particleSystem.emit('lava_spark', tile.x + Math.random() - 0.5, tile.y + Math.random() - 0.5, 1);
          }

          const neighbors = this.getNeighbors(x, y);
          neighbors.forEach(n => {
            const nextN = nextGrid[n.y][n.x];
            if (n.elevation < tile.elevation && Math.random() < 0.08) {
              if (n.type === 'deep_ocean' || n.type === 'shallow_sea') {
                nextGrid[n.y][n.x] = this.createTile(n.x, n.y, 'mountain');
                nextGrid[n.y][n.x].elevation = 0.75;
                if (particleSystem) particleSystem.emit('steam', n.x, n.y, 3);
                if (audioEngine && Math.random() < 0.02) audioEngine.playSfx('steam');
              } else if (n.type !== 'lava' && n.type !== 'volcano' && n.type !== 'mountain') {
                nextGrid[n.y][n.x] = this.createTile(n.x, n.y, 'lava');
                nextGrid[n.y][n.x].elevation = n.elevation + 0.02;
                if (particleSystem) particleSystem.emit('smoke', n.x, n.y, 1);
              }
            }
          });

          nextTile.temperature = 1.0;
          if (Math.random() < 0.005) {
            nextGrid[y][x] = this.createTile(x, y, 'mountain');
            nextGrid[y][x].elevation = Math.max(0.65, tile.elevation - 0.05);
          }
        }

        if (tile.type === 'fire') {
          fireCount++;
          nextTile.fireDuration--;

          if (Math.random() < 0.1 && particleSystem) {
            particleSystem.emit('fire', tile.x + Math.random() - 0.5, tile.y + Math.random() - 0.5, 1);
          }
          if (Math.random() < 0.08 && particleSystem) {
            particleSystem.emit('smoke', tile.x + Math.random() - 0.5, tile.y - Math.random() * 0.5, 1);
          }

          if (audioEngine && Math.random() < 0.01) {
            audioEngine.playSfx('fire_crackle');
          }

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

          if (nextTile.fireDuration <= 0) {
            nextGrid[y][x] = this.createTile(x, y, 'grass');
            nextGrid[y][x].ashLevel = 1.0;
            nextGrid[y][x].plantGrowTick = 200;
          }
        }

        if (tile.type === 'grass') {
          nextTile.plantGrowTick--;
          if (nextTile.plantGrowTick <= 0) {
            if (tile.ashLevel > 0) {
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

        if (tile.type === 'ice') {
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
    const dirs = [{dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}];
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

  serialize() {
    return JSON.stringify({
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
    });
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

  generateWorld() {
    this.resetToOcean();
    const seedX1 = Math.random() * 1000;
    const seedY1 = Math.random() * 1000;
    const seedX2 = Math.random() * 500;
    const seedY2 = Math.random() * 500;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const nx = x / this.width - 0.5;
        const ny = y / this.height - 0.5;
        const distToCenter = Math.sqrt(nx*nx + ny*ny) * 2.0;

        const val1 = Math.sin(x * 0.08 + seedX1) * Math.cos(y * 0.08 + seedY1);
        const val2 = Math.sin(x * 0.2 + seedX2) * Math.sin(y * 0.25 + seedY2) * 0.5;
        
        let nValue = (val1 + val2 + 0.5) / 1.5;
        nValue = nValue * (1.0 - distToCenter * 0.85);

        if (nValue > 0.58) {
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
          this.setTileType(x, y, 'grass');
        } else if (nValue > 0.44) {
          this.setTileType(x, y, 'sand');
        } else if (nValue > 0.25) {
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
// 2. PARTICLE SIMULATION ENGINE
// ==========================================
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 2000;
  }

  emit(type, gridX, gridY, count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
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
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        gravity: 0,
        drift: 0
      };

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
          const r = 230 + Math.floor(Math.random() * 25);
          const g = 80 + Math.floor(Math.random() * 120);
          const b = 20 + Math.floor(Math.random() * 30);
          p.color = `rgba(${r}, ${g}, ${b}, `;
          p.decay = 0.02 + Math.random() * 0.03;
          break;

        case 'lava_spark':
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.05 + Math.random() * 0.12;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - 0.05;
          p.size = 0.15 + Math.random() * 0.15;
          p.color = `rgba(255, ${120 + Math.floor(Math.random() * 135)}, 0, `;
          p.gravity = 0.006;
          p.decay = 0.015 + Math.random() * 0.015;
          break;

        case 'rain':
          p.x = gridX + (Math.random() - 0.5) * 1.5;
          p.vx = -0.15 - Math.random() * 0.05;
          p.vy = 0.25 + Math.random() * 0.15;
          p.size = 0.05 + Math.random() * 0.05;
          p.color = 'rgba(120, 190, 255, ';
          p.decay = 0.03 + Math.random() * 0.04;
          break;

        case 'snow':
          p.x = gridX + (Math.random() - 0.5) * 1.5;
          p.vx = -0.02 - Math.random() * 0.03;
          p.vy = 0.04 + Math.random() * 0.04;
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
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;

      if (p.type === 'smoke' || p.type === 'steam') {
        p.size += 0.005;
      }
      p.life -= p.decay;
      p.alpha = Math.max(0, p.life);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  updateWeather(world, activeWeather, density = 3) {
    if (!activeWeather || activeWeather === 'none') return;
    for (let d = 0; d < density; d++) {
      const rx = Math.random() * world.width;
      const ry = Math.random() * world.height * 0.7;
      if (activeWeather === 'rain') {
        this.emit('rain', rx, ry, 1);
      } else if (activeWeather === 'snow') {
        this.emit('snow', rx, ry, 1);
      }
    }
  }

  render(ctx, tileSize) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.fillStyle = p.color + p.alpha + ')';
      const px = p.x * tileSize;
      const py = p.y * tileSize;
      const sizePx = p.size * tileSize;

      ctx.beginPath();
      if (p.type === 'rain') {
        ctx.strokeStyle = p.color + (p.alpha * 0.6) + ')';
        ctx.lineWidth = 1.5;
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.vx * tileSize * 0.8, py + p.vy * tileSize * 0.8);
        ctx.stroke();
      } else if (p.type === 'lava_spark') {
        ctx.fillRect(px - sizePx / 2, py - sizePx / 2, sizePx, sizePx);
      } else {
        ctx.arc(px, py, sizePx, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ==========================================
// 3. SYNTHETIC AUDIO ENGINE
// ==========================================
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicPlaying = false;
    this.ambientOscs = [];
    this.ambientGain = null;
    this.musicTimeout = null;
    this.lastSfxTime = {};
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.0;
      this.ambientGain.connect(this.masterGain);

      this.startAmbientMusic();
    } catch (e) {
      console.warn("Web Audio block/not supported:", e);
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
        this.fadeGain(this.ambientGain, 0.15, 1.5);
      } else {
        this.fadeGain(this.ambientGain, 0.0, 1.0);
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
    this.init();
    if (!this.ctx) return;

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

  startAmbientMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    if (this.enabled) {
      this.fadeGain(this.ambientGain, 0.15, 2.0);
    }

    const chords = [
      [130.81, 164.81, 196.00, 246.94],
      [110.00, 130.81, 164.81, 196.00],
      [87.31, 110.00, 130.81, 164.81],
      [98.00, 123.47, 146.83, 174.61]
    ];
    let chordIndex = 0;

    const playNextChord = () => {
      if (!this.enabled || !this.musicPlaying) {
        this.musicTimeout = setTimeout(playNextChord, 8000);
        return;
      }

      const activeChord = chords[chordIndex];
      chordIndex = (chordIndex + 1) % chords.length;
      const now = this.ctx.currentTime;

      activeChord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04 + (Math.random() * 0.02), now + 2.0 + Math.random() * 1.0);
        gain.gain.setValueAtTime(gain.gain.value, now + 5.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 8.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);

        osc.start(now);
        osc.stop(now + 9.0);
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
// 4. GRAPHICS RENDER ENGINE
// ==========================================
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;

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

    this.timeOfDay = 8.0;
    this.cycleSpeed = 0.01;
    this.enableDayNight = true;

    this.clouds = [];
    this.initClouds();
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
    this.canvas.width = width;
    this.canvas.height = height;
  }

  screenToGrid(screenX, screenY, tileSize) {
    const gridX = (screenX - this.canvas.width / 2 - this.panX) / (tileSize * this.zoom) + 50;
    const gridY = (screenY - this.canvas.height / 2 - this.panY) / (tileSize * this.zoom) + 50;
    return { x: Math.floor(gridX), y: Math.floor(gridY) };
  }

  getTileSize() {
    return 16;
  }

  render(world, particleSystem) {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    
    ctx.fillStyle = '#07070a';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(cw / 2 + this.panX, ch / 2 + this.panY);
    ctx.scale(this.zoom, this.zoom);

    const tileSize = this.getTileSize();
    const halfWidth = (world.width * tileSize) / 2;
    const halfHeight = (world.height * tileSize) / 2;
    ctx.translate(-halfWidth, -halfHeight);

    ctx.fillStyle = this.colors.deep_ocean;
    ctx.fillRect(0, 0, world.width * tileSize, world.height * tileSize);

    this.renderTiles(world, tileSize);
    this.renderHeightShadows(world, tileSize);
    this.renderFeatures(world, tileSize);
    
    particleSystem.render(ctx, tileSize);
    ctx.restore();

    ctx.save();
    ctx.translate(cw / 2 + this.panX, ch / 2 + this.panY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-halfWidth, -halfHeight);
    this.renderClouds(tileSize);
    ctx.restore();

    this.renderDayNightOverlay(world, cw, ch);
  }

  renderTiles(world, tileSize) {
    const ctx = this.ctx;
    const time = Date.now() / 1000;

    for (let y = 0; y < world.height; y++) {
      const drawY = y * tileSize;
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        const drawX = x * tileSize;

        ctx.fillStyle = this.colors[tile.type] || this.colors.deep_ocean;
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        if (tile.type === 'deep_ocean' || tile.type === 'shallow_sea') {
          ctx.strokeStyle = tile.type === 'deep_ocean' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const waveOffset = Math.sin(x * 0.5 + time * 1.5) * 2;
          ctx.moveTo(drawX, drawY + tileSize / 2 + waveOffset);
          ctx.lineTo(drawX + tileSize, drawY + tileSize / 2 + waveOffset);
          ctx.stroke();
        }

        if (tile.type === 'shallow_sea') {
          const neighbors = world.getNeighbors(x, y);
          const hasSand = neighbors.some(n => n.type === 'sand' || n.type === 'grass');
          if (hasSand) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(time * 3 + x) * 0.05})`;
            ctx.fillRect(drawX, drawY, tileSize, tileSize);
          }
        }

        if (tile.type !== 'deep_ocean' && tile.type !== 'shallow_sea') {
          const neighbors = [
            { t: world.getTile(x, y - 1), side: 'top' },
            { t: world.getTile(x, y + 1), side: 'bottom' },
            { t: world.getTile(x - 1, y), side: 'left' },
            { t: world.getTile(x + 1, y), side: 'right' }
          ];

          neighbors.forEach(n => {
            if (n.t && this.getTerrainPrecedence(tile.type) > this.getTerrainPrecedence(n.t.type)) {
              ctx.fillStyle = this.colors[n.t.type];
              ctx.globalAlpha = 0.35;
              ctx.beginPath();
              if (n.side === 'top') {
                ctx.fillRect(drawX, drawY, tileSize, 3);
              } else if (n.side === 'bottom') {
                ctx.fillRect(drawX, drawY + tileSize - 3, tileSize, 3);
              } else if (n.side === 'left') {
                ctx.fillRect(drawX, drawY, 3, tileSize);
              } else if (n.side === 'right') {
                ctx.fillRect(drawX + tileSize - 3, drawY, 3, tileSize);
              }
              ctx.globalAlpha = 1.0;
            }
          });
        }
      }
    }
  }

  getTerrainPrecedence(type) {
    const order = {
      deep_ocean: 0,
      shallow_sea: 1,
      sand: 2,
      ice: 3,
      ash: 4,
      grass: 5,
      forest: 6,
      mountain: 7,
      volcano: 8,
      lava: 9,
      fire: 10
    };
    return order[type] !== undefined ? order[type] : 0;
  }

  renderHeightShadows(world, tileSize) {
    const ctx = this.ctx;
    const shadowOffsetX = 4;
    const shadowOffsetY = 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        if (tile.type === 'mountain' || tile.type === 'volcano') {
          const drawX = x * tileSize;
          const drawY = y * tileSize;

          ctx.beginPath();
          ctx.moveTo(drawX + tileSize, drawY + tileSize);
          ctx.lineTo(drawX + tileSize + shadowOffsetX, drawY + tileSize + shadowOffsetY);
          ctx.lineTo(drawX + shadowOffsetX, drawY + tileSize + shadowOffsetY);
          ctx.lineTo(drawX, drawY + tileSize);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  renderFeatures(world, tileSize) {
    const ctx = this.ctx;
    const time = Date.now() / 1000;

    for (let y = 0; y < world.height; y++) {
      const drawY = y * tileSize;
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        const drawX = x * tileSize;

        if (tile.type === 'forest') {
          ctx.fillStyle = '#113317';
          this.drawTree(ctx, drawX + tileSize * 0.3, drawY + tileSize * 0.8, tileSize * 0.35);
          this.drawTree(ctx, drawX + tileSize * 0.7, drawY + tileSize * 0.9, tileSize * 0.4);
          ctx.fillStyle = '#2b753a';
          this.drawTree(ctx, drawX + tileSize * 0.5, drawY + tileSize * 0.7, tileSize * 0.45);
        }

        if (tile.type === 'mountain') {
          ctx.fillStyle = '#484d56';
          ctx.beginPath();
          ctx.moveTo(drawX + tileSize * 0.5, drawY + tileSize * 0.15);
          ctx.lineTo(drawX + tileSize * 0.9, drawY + tileSize * 0.9);
          ctx.lineTo(drawX + tileSize * 0.1, drawY + tileSize * 0.9);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(drawX + tileSize * 0.5, drawY + tileSize * 0.15);
          ctx.lineTo(drawX + tileSize * 0.65, drawY + tileSize * 0.45);
          ctx.lineTo(drawX + tileSize * 0.35, drawY + tileSize * 0.45);
          ctx.closePath();
          ctx.fill();
        }

        if (tile.type === 'volcano') {
          ctx.fillStyle = '#222228';
          ctx.beginPath();
          ctx.moveTo(drawX + tileSize * 0.3, drawY + tileSize * 0.2);
          ctx.lineTo(drawX + tileSize * 0.7, drawY + tileSize * 0.2);
          ctx.lineTo(drawX + tileSize * 0.95, drawY + tileSize * 0.95);
          ctx.lineTo(drawX + tileSize * 0.05, drawY + tileSize * 0.95);
          ctx.closePath();
          ctx.fill();

          const pulse = 0.5 + Math.sin(time * 5) * 0.5;
          ctx.fillStyle = `rgb(${220 + pulse * 35}, ${40 + pulse * 20}, 20)`;
          ctx.beginPath();
          ctx.arc(drawX + tileSize * 0.5, drawY + tileSize * 0.22, tileSize * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }

        if (tile.type === 'fire') {
          const pulse = 0.8 + Math.sin(time * 12 + x) * 0.2;
          ctx.fillStyle = `rgba(240, 90, 10, ${pulse * 0.85})`;
          ctx.fillRect(drawX, drawY, tileSize, tileSize);
        }

        if (tile.ashLevel > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(drawX + tileSize*0.1, drawY + tileSize*0.8, tileSize*0.8, tileSize*0.15);
        }
      }
    }
  }

  drawTree(ctx, cx, cy, height) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - height);
    ctx.lineTo(cx + height * 0.5, cy);
    ctx.lineTo(cx - height * 0.5, cy);
    ctx.closePath();
    ctx.fill();
  }

  renderClouds(tileSize) {
    const ctx = this.ctx;
    this.clouds.forEach(c => {
      c.x += c.vx;
      c.y += c.vy;
      if (c.x > 110) c.x = -15;
      if (c.y > 110) c.y = -15;
      if (c.y < -15) c.y = 110;

      const px = c.x * tileSize;
      const py = c.y * tileSize;
      const sizePx = c.size * tileSize;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
      ctx.beginPath();
      ctx.arc(px + 15, py + 20, sizePx, 0, Math.PI * 2);
      ctx.arc(px + 15 + sizePx * 0.5, py + 20, sizePx * 0.7, 0, Math.PI * 2);
      ctx.arc(px + 15 - sizePx * 0.5, py + 20, sizePx * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(245, 245, 255, ${c.opacity})`;
      ctx.beginPath();
      ctx.arc(px, py, sizePx, 0, Math.PI * 2);
      ctx.arc(px + sizePx * 0.5, py - sizePx * 0.1, sizePx * 0.7, 0, Math.PI * 2);
      ctx.arc(px - sizePx * 0.5, py - sizePx * 0.1, sizePx * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  renderDayNightOverlay(world, cw, ch) {
    if (this.enableDayNight) {
      this.timeOfDay = (this.timeOfDay + this.cycleSpeed) % 24;
    } else {
      this.timeOfDay = 12.0;
    }

    const ctx = this.ctx;
    let tintColor = 'rgba(0,0,0,0)';
    let glowStrength = 0;

    if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
      const ratio = (this.timeOfDay - 18) / 2;
      tintColor = `rgba(220, 100, 40, ${ratio * 0.25})`;
      glowStrength = ratio * 0.5;
    } else if (this.timeOfDay >= 20 || this.timeOfDay < 4) {
      let ratio = 1.0;
      if (this.timeOfDay < 4) {
        ratio = 1.0 - (this.timeOfDay / 4);
      } else if (this.timeOfDay < 22) {
        ratio = (this.timeOfDay - 20) / 2;
      }
      tintColor = `rgba(10, 10, 32, ${0.55 + ratio * 0.2})`;
      glowStrength = 0.8 + ratio * 0.2;
    } else if (this.timeOfDay >= 4 && this.timeOfDay < 6) {
      const ratio = (this.timeOfDay - 4) / 2;
      tintColor = `rgba(230, 80, 110, ${(1.0 - ratio) * 0.25})`;
      glowStrength = (1.0 - ratio) * 0.7;
    }

    if (glowStrength > 0.05) {
      const tileSize = this.getTileSize();
      const halfWidth = (world.width * tileSize) / 2;
      const halfHeight = (world.height * tileSize) / 2;

      ctx.save();
      ctx.translate(cw / 2 + this.panX, ch / 2 + this.panY);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-halfWidth, -halfHeight);
      ctx.globalCompositeOperation = 'screen';

      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          const tile = world.grid[y][x];
          if (tile.type === 'lava' || tile.type === 'fire' || tile.type === 'volcano') {
            const drawX = x * tileSize + tileSize/2;
            const drawY = y * tileSize + tileSize/2;
            const glowRadius = tile.type === 'volcano' ? tileSize * 3 : tileSize * 1.5;
            const grad = ctx.createRadialGradient(drawX, drawY, 2, drawX, drawY, glowRadius);
            
            if (tile.type === 'lava' || tile.type === 'volcano') {
              grad.addColorStop(0, `rgba(240, 50, 10, ${glowStrength * 0.55})`);
              grad.addColorStop(1, 'rgba(240, 50, 10, 0)');
            } else {
              grad.addColorStop(0, `rgba(240, 150, 20, ${glowStrength * 0.45})`);
              grad.addColorStop(1, 'rgba(240, 150, 20, 0)');
            }

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(drawX, drawY, glowRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    if (tintColor !== 'rgba(0,0,0,0)') {
      // Determine offsets depending on environment (browser hides Electron title bar)
      const offsetTop = ipcRenderer ? 32 : 0;
      ctx.fillStyle = tintColor;
      ctx.fillRect(0, offsetTop, cw, ch - offsetTop);
    }
  }

  getTimeString() {
    const hoursInt = Math.floor(this.timeOfDay);
    const minutes = Math.floor((this.timeOfDay % 1) * 60).toString().padStart(2, '0');
    const ampm = hoursInt >= 12 ? 'PM' : 'AM';
    const displayHour = (hoursInt % 12 || 12).toString().padStart(2, '0');
    return `${displayHour}:${minutes} ${ampm}`;
  }
}

// ==========================================
// 5. USER INTERFACE CONTROLLER
// ==========================================
class UIManager {
  constructor(world, renderer, particleSystem, audioEngine) {
    this.world = world;
    this.renderer = renderer;
    this.particles = particleSystem;
    this.audio = audioEngine;

    this.activeTool = 'deep_ocean';
    this.brushSize = 3;
    this.brushShape = 'circle';
    this.simSpeed = 1;

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
    const btnMin = document.getElementById('btn-minimize');
    const btnMax = document.getElementById('btn-maximize');
    const btnClose = document.getElementById('btn-close');
    const titleBar = document.getElementById('title-bar');

    if (ipcRenderer) {
      btnMin.addEventListener('click', () => ipcRenderer.send('window-minimize'));
      btnMax.addEventListener('click', () => ipcRenderer.send('window-maximize'));
      btnClose.addEventListener('click', () => ipcRenderer.send('window-close'));
    } else {
      if (titleBar) titleBar.style.display = 'none';
      const canvas = document.getElementById('game-canvas');
      if (canvas) {
        canvas.style.top = '0';
        canvas.style.height = '100vh';
      }
    }
  }

  initTabs() {
    const tabBtns = document.querySelectorAll('.dock-tab-btn');
    const panels = document.querySelectorAll('.dock-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

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
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.activeTool = btn.getAttribute('data-tool');
        this.audio.playSfx('place');

        const title = btn.getAttribute('title');
        document.getElementById('info-hover').innerHTML = `<strong>Selected Power:</strong><br>${title}`;
      });
    });

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

    const btnTimeCycle = document.getElementById('btn-time-cycle');
    btnTimeCycle.addEventListener('click', () => {
      this.renderer.enableDayNight = !this.renderer.enableDayNight;
      btnTimeCycle.innerText = this.renderer.enableDayNight ? '🌙 Cycle: ON' : '☀️ Sun: Locked';
      btnTimeCycle.classList.toggle('active');
      this.audio.playSfx('place');
    });

    const btnAudioToggle = document.getElementById('btn-audio-toggle');
    btnAudioToggle.addEventListener('click', () => {
      const state = this.audio.toggle();
      btnAudioToggle.innerText = state ? '🔊 Music: ON' : '🔇 Muted';
      btnAudioToggle.style.opacity = state ? '1.0' : '0.5';
    });
  }

  initSaveSlots() {
    const slotBtns = document.querySelectorAll('.save-slot-btn');

    slotBtns.forEach(btn => {
      const slot = btn.getAttribute('data-slot');
      const savedData = localStorage.getItem(`agss_save_slot_${slot}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          btn.innerText = `Slot ${slot} - Yr ${parsed.year}, Mth ${parsed.month}`;
          btn.style.color = '#fff';
        } catch (e) {
          btn.innerText = `Slot ${slot} - Empty`;
        }
      }
    });

    slotBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slot = btn.getAttribute('data-slot');
        const savedData = localStorage.getItem(`agss_save_slot_${slot}`);
        const shouldSave = !savedData || e.shiftKey;

        if (shouldSave) {
          const serialized = this.world.serialize();
          localStorage.setItem(`agss_save_slot_${slot}`, serialized);
          btn.innerText = `Slot ${slot} - Yr ${this.world.year}, Mth ${this.world.month}`;
          btn.style.color = '#fff';
          this.audio.playSfx('place');
          alert(`World saved successfully into Slot ${slot}!`);
        } else {
          const success = this.world.deserialize(savedData);
          if (success) {
            this.audio.playSfx('eruption');
            alert(`Loaded Slot ${slot} successfully!`);
          } else {
            alert(`Error loading Slot ${slot}!`);
          }
        }
      });
    });
  }

  initActionButtons() {
    document.getElementById('btn-regenerate').addEventListener('click', () => {
      if (confirm("Procedurally generate a new random sandbox seed? This will clear current changes.")) {
        this.world.generateWorld();
        this.audio.playSfx('eruption');
      }
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm("Reset everything back to ocean?")) {
        this.world.resetToOcean();
        this.audio.playSfx('steam');
      }
    });

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
    window.addEventListener('tile-hover', (e) => {
      const tile = e.detail.tile;
      if (!tile) {
        infoPanel.innerHTML = "Hover over terrain for details.";
        return;
      }

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
    document.getElementById('stat-time').querySelector('.val').innerText = `Year ${world.year}, Month ${world.month} (${renderer.getTimeString()})`;
    document.getElementById('stat-ratio').querySelector('.val').innerText = `Land ${world.landRatio}% / Water ${100 - world.landRatio}%`;
    document.getElementById('stat-volcanoes').querySelector('.val').innerText = `${world.activeVolcanoes} Active`;
    document.getElementById('stat-fire').querySelector('.val').innerText = `${world.activeFires} Blazes`;
  }
}

// ==========================================
// 6. MAIN GAME CONTROLLER
// ==========================================
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.world = new World(100, 100);
    this.renderer = new Renderer(this.canvas);
    this.particles = new ParticleSystem();
    this.audio = new AudioEngine();
    this.ui = new UIManager(this.world, this.renderer, this.particles, this.audio);

    this.isMouseDown = false;
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.mouseX = 0;
    this.mouseY = 0;

    this.lastTickTime = 0;
    this.tickRate = 120;

    this.initEvents();
    this.handleResize();
    this.world.generateWorld();
  }

  start() {
    const loop = (timestamp) => {
      this.update(timestamp);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  initEvents() {
    window.addEventListener('resize', () => this.handleResize());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => {
      this.audio.init();
      this.isMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      if (e.button === 1 || e.button === 2) {
        this.isPanning = true;
        this.canvas.style.cursor = 'grabbing';
      } else if (e.button === 0) {
        this.paintAtMouse(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      const rect = this.canvas.getBoundingClientRect();
      const canvasX = this.mouseX - rect.left;
      const canvasY = this.mouseY - rect.top;

      const gridCoords = this.renderer.screenToGrid(canvasX, canvasY, this.renderer.getTileSize());
      const tile = this.world.getTile(gridCoords.x, gridCoords.y);
      
      const hoverEvent = new CustomEvent('tile-hover', { detail: { tile } });
      window.dispatchEvent(hoverEvent);

      if (this.isPanning) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.renderer.panX += dx;
        this.renderer.panY += dy;
      } else if (this.isMouseDown && e.buttons === 1) {
        this.paintAtMouse(e.clientX, e.clientY);
      }

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      this.isPanning = false;
      this.canvas.style.cursor = 'default';
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - this.canvas.width / 2;
      const my = e.clientY - rect.top - this.canvas.height / 2;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const oldZoom = this.renderer.zoom;
      
      this.renderer.zoom = Math.min(5.0, Math.max(0.3, this.renderer.zoom * zoomFactor));

      const actualZoomFactor = this.renderer.zoom / oldZoom;
      this.renderer.panX = mx - (mx - this.renderer.panX) * actualZoomFactor;
      this.renderer.panY = my - (my - this.renderer.panY) * actualZoomFactor;
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
    this.particles.update();
    const activeWeather = (this.ui.activeTool === 'rain' || this.ui.activeTool === 'snow') ? this.ui.activeTool : 'none';
    
    if (activeWeather !== 'none' && this.isMouseDown) {
      this.particles.updateWeather(this.world, activeWeather, 4);
    } else {
      this.particles.updateWeather(this.world, 'none');
    }

    if (this.ui.simSpeed > 0) {
      const currentRate = this.tickRate / this.ui.simSpeed;
      if (timestamp - this.lastTickTime >= currentRate) {
        this.world.update(this.particles, this.audio);
        this.lastTickTime = timestamp;
      }
    }
    this.ui.updateHUD(this.world, this.renderer);
  }

  render() {
    this.renderer.render(this.world, this.particles);
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.start();
});
