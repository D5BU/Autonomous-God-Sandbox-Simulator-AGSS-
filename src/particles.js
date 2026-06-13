export class ParticleSystem {
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

