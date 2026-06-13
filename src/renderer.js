export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Viewport transform
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;

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

  // Translate screen coordinates to grid coordinates
  screenToGrid(screenX, screenY, tileSize) {
    const gridX = (screenX - this.canvas.width / 2 - this.panX) / (tileSize * this.zoom) + 50;
    const gridY = (screenY - this.canvas.height / 2 - this.panY) / (tileSize * this.zoom) + 50;
    return { x: Math.floor(gridX), y: Math.floor(gridY) };
  }

  // Get active tile size based on zoom
  getTileSize() {
    // base tile size for 100x100 grid is roughly 16px to fit nicely
    return 16;
  }

  render(world, particleSystem) {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    
    // 1. Clear background
    ctx.fillStyle = '#07070a';
    ctx.fillRect(0, 0, cw, ch);

    // 2. Setup Viewport Matrix
    ctx.save();
    ctx.translate(cw / 2 + this.panX, ch / 2 + this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Center grid (offset by half of width/height in pixels)
    const tileSize = this.getTileSize();
    const halfWidth = (world.width * tileSize) / 2;
    const halfHeight = (world.height * tileSize) / 2;
    ctx.translate(-halfWidth, -halfHeight);

    // 3. Render base ocean floor first for empty tiles
    ctx.fillStyle = this.colors.deep_ocean;
    ctx.fillRect(0, 0, world.width * tileSize, world.height * tileSize);

    // 4. Render Grid Tiles & Blended Borders
    this.renderTiles(world, tileSize);

    // 5. Render Height Shadows (3D depth casting for mountains, hills, volcanoes)
    this.renderHeightShadows(world, tileSize);

    // 6. Render Terrain Feature Details (Trees, Snow Caps, Volcano Craters)
    this.renderFeatures(world, tileSize);

    // 7. Render Particles (Rain, Snow, Smoke, Lava Bubbles)
    particleSystem.render(ctx, tileSize);

    // 8. Render Glowing Night Overlay & Lava Glows
    ctx.restore(); // Restore to draw global weather overlay/day cycle overlay or clouds

    // Draw Clouds and Cloud Shadows in grid scale but on top
    ctx.save();
    ctx.translate(cw / 2 + this.panX, ch / 2 + this.panY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-halfWidth, -halfHeight);
    this.renderClouds(tileSize);
    ctx.restore();

    // 9. Day/Night Tinting Overlay
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

        // Draw Base Tile Color
        ctx.fillStyle = this.colors[tile.type] || this.colors.deep_ocean;
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        // Water Wave Animation
        if (tile.type === 'deep_ocean' || tile.type === 'shallow_sea') {
          ctx.strokeStyle = tile.type === 'deep_ocean' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          // Wave offsets
          const waveOffset = Math.sin(x * 0.5 + time * 1.5) * 2;
          ctx.moveTo(drawX, drawY + tileSize / 2 + waveOffset);
          ctx.lineTo(drawX + tileSize, drawY + tileSize / 2 + waveOffset);
          ctx.stroke();
        }

        // Coastal Foam Borders
        if (tile.type === 'shallow_sea') {
          const neighbors = world.getNeighbors(x, y);
          const hasSand = neighbors.some(n => n.type === 'sand' || n.type === 'grass');
          if (hasSand) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(time * 3 + x) * 0.05})`;
            ctx.fillRect(drawX, drawY, tileSize, tileSize);
          }
        }

        // Smooth Terrain Feathered Blending
        // Check neighbors and draw feathered border overlays to remove hard grid lines
        if (tile.type !== 'deep_ocean' && tile.type !== 'shallow_sea') {
          const neighbors = [
            { t: world.getTile(x, y - 1), side: 'top' },
            { t: world.getTile(x, y + 1), side: 'bottom' },
            { t: world.getTile(x - 1, y), side: 'left' },
            { t: world.getTile(x + 1, y), side: 'right' }
          ];

          neighbors.forEach(n => {
            if (n.t && this.getTerrainPrecedence(tile.type) > this.getTerrainPrecedence(n.t.type)) {
              // Blend edge of this tile towards neighbor
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

  // Determines which tile overlays which (sand overlays water, grass overlays sand, mountain overlays grass)
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

  // Draw 3D shadow cast polygons for elevated elements (hills, mountains, volcanoes)
  renderHeightShadows(world, tileSize) {
    const ctx = this.ctx;
    
    // Sun position calculations: shadows stretch to bottom-right during day, change angle during cycle
    const shadowOffsetX = 4;
    const shadowOffsetY = 5;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        
        if (tile.type === 'mountain' || tile.type === 'volcano') {
          const drawX = x * tileSize;
          const drawY = y * tileSize;

          // Shadow cast polygon
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

  // Draw beautiful features like actual tiny trees, snow caps, lava glowing cracks, craters
  renderFeatures(world, tileSize) {
    const ctx = this.ctx;
    const time = Date.now() / 1000;

    for (let y = 0; y < world.height; y++) {
      const drawY = y * tileSize;
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        const drawX = x * tileSize;

        // 1. Draw Forest Pine Trees
        if (tile.type === 'forest') {
          ctx.fillStyle = '#113317'; // darker shadow tree color
          // Draw three small triangles
          this.drawTree(ctx, drawX + tileSize * 0.3, drawY + tileSize * 0.8, tileSize * 0.35);
          this.drawTree(ctx, drawX + tileSize * 0.7, drawY + tileSize * 0.9, tileSize * 0.4);
          
          ctx.fillStyle = '#2b753a'; // highlight green
          this.drawTree(ctx, drawX + tileSize * 0.5, drawY + tileSize * 0.7, tileSize * 0.45);
        }

        // 2. Draw Mountain Peaks and White Snow Caps
        if (tile.type === 'mountain') {
          // Draw solid rock pyramid
          ctx.fillStyle = '#484d56';
          ctx.beginPath();
          ctx.moveTo(drawX + tileSize * 0.5, drawY + tileSize * 0.15);
          ctx.lineTo(drawX + tileSize * 0.9, drawY + tileSize * 0.9);
          ctx.lineTo(drawX + tileSize * 0.1, drawY + tileSize * 0.9);
          ctx.closePath();
          ctx.fill();

          // White snow cap on the tip
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(drawX + tileSize * 0.5, drawY + tileSize * 0.15);
          ctx.lineTo(drawX + tileSize * 0.65, drawY + tileSize * 0.45);
          ctx.lineTo(drawX + tileSize * 0.35, drawY + tileSize * 0.45);
          ctx.closePath();
          ctx.fill();
        }

        // 3. Draw Volcano Cones & Active Craters
        if (tile.type === 'volcano') {
          // Dark ash volcanic cone
          ctx.fillStyle = '#222228';
          ctx.beginPath();
          ctx.moveTo(drawX + tileSize * 0.3, drawY + tileSize * 0.2);
          ctx.lineTo(drawX + tileSize * 0.7, drawY + tileSize * 0.2);
          ctx.lineTo(drawX + tileSize * 0.95, drawY + tileSize * 0.95);
          ctx.lineTo(drawX + tileSize * 0.05, drawY + tileSize * 0.95);
          ctx.closePath();
          ctx.fill();

          // Glowing lava crater
          const pulse = 0.5 + Math.sin(time * 5) * 0.5;
          ctx.fillStyle = `rgb(${220 + pulse * 35}, ${40 + pulse * 20}, 20)`;
          ctx.beginPath();
          ctx.arc(drawX + tileSize * 0.5, drawY + tileSize * 0.22, tileSize * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }

        // 4. Fire particles/glow on tile
        if (tile.type === 'fire') {
          const pulse = 0.8 + Math.sin(time * 12 + x) * 0.2;
          ctx.fillStyle = `rgba(240, 90, 10, ${pulse * 0.85})`;
          ctx.fillRect(drawX, drawY, tileSize, tileSize);
        }

        // 5. Ash Details
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
    const time = Date.now() / 1000;

    // Update cloud position
    this.clouds.forEach(c => {
      c.x += c.vx;
      c.y += c.vy;
      
      // Wrap around
      if (c.x > 110) c.x = -15;
      if (c.y > 110) c.y = -15;
      if (c.y < -15) c.y = 110;

      const px = c.x * tileSize;
      const py = c.y * tileSize;
      const sizePx = c.size * tileSize;

      // 1. Draw Cloud Shadows onto terrain (displaced slightly)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
      ctx.beginPath();
      ctx.arc(px + 15, py + 20, sizePx, 0, Math.PI * 2);
      ctx.arc(px + 15 + sizePx * 0.5, py + 20, sizePx * 0.7, 0, Math.PI * 2);
      ctx.arc(px + 15 - sizePx * 0.5, py + 20, sizePx * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw Clouds
      ctx.fillStyle = `rgba(245, 245, 255, ${c.opacity})`;
      ctx.beginPath();
      ctx.arc(px, py, sizePx, 0, Math.PI * 2);
      ctx.arc(px + sizePx * 0.5, py - sizePx * 0.1, sizePx * 0.7, 0, Math.PI * 2);
      ctx.arc(px - sizePx * 0.5, py - sizePx * 0.1, sizePx * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  renderDayNightOverlay(world, cw, ch) {
    // 1. Progress time of day
    if (this.enableDayNight) {
      this.timeOfDay = (this.timeOfDay + this.cycleSpeed) % 24;
    } else {
      this.timeOfDay = 12.0; // lock at noon
    }

    const ctx = this.ctx;
    
    // Determine tint color based on time
    let tintColor = 'rgba(0,0,0,0)';
    let glowStrength = 0; // intensity of night lights

    if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
      // Sunset (golden hour)
      const ratio = (this.timeOfDay - 18) / 2;
      tintColor = `rgba(220, 100, 40, ${ratio * 0.25})`; // warm orange
      glowStrength = ratio * 0.5;
    } else if (this.timeOfDay >= 20 || this.timeOfDay < 4) {
      // Night (deep dark blue)
      let ratio = 1.0;
      if (this.timeOfDay < 4) {
        ratio = 1.0 - (this.timeOfDay / 4); // morning transition
      } else if (this.timeOfDay < 22) {
        ratio = (this.timeOfDay - 20) / 2; // evening transition
      }
      tintColor = `rgba(10, 10, 32, ${0.55 + ratio * 0.2})`;
      glowStrength = 0.8 + ratio * 0.2;
    } else if (this.timeOfDay >= 4 && this.timeOfDay < 6) {
      // Sunrise (dawn pink)
      const ratio = (this.timeOfDay - 4) / 2;
      tintColor = `rgba(230, 80, 110, ${(1.0 - ratio) * 0.25})`;
      glowStrength = (1.0 - ratio) * 0.7;
    }

    // 2. Draw glowing light sources on canvas (lava, fire, volcanoes) at night
    if (glowStrength > 0.05) {
      const tileSize = this.getTileSize();
      const halfWidth = (world.width * tileSize) / 2;
      const halfHeight = (world.height * tileSize) / 2;

      ctx.save();
      // align back to grid space
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

            // Draw radial glow
            const glowRadius = tile.type === 'volcano' ? tileSize * 3 : tileSize * 1.5;
            const grad = ctx.createRadialGradient(drawX, drawY, 2, drawX, drawY, glowRadius);
            
            if (tile.type === 'lava' || tile.type === 'volcano') {
              grad.addColorStop(0, `rgba(240, 50, 10, ${glowStrength * 0.55})`);
              grad.addColorStop(1, 'rgba(240, 50, 10, 0)');
            } else { // fire
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

    // 3. Draw full-screen ambient color tint
    if (tintColor !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = tintColor;
      ctx.fillRect(0, 32, cw, ch - 32); // skip Electron title bar
    }
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

