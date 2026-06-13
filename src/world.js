export class World {
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

