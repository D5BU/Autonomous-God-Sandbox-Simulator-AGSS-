import { World } from './world.js';
import { Renderer } from './renderer.js';
import { ParticleSystem } from './particles.js';
import { AudioEngine } from './audio.js';
import { UIManager } from './ui.js';

export class Game {
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

    // Prevent context menu on canvas (we use right click to pan)
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse Listeners
    this.canvas.addEventListener('mousedown', (e) => {
      this.audio.init(); // initialize Web Audio on user click

      this.isMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      // Panning triggers: middle mouse click (1) or right click (2)
      if (e.button === 1 || e.button === 2) {
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

      if (this.isPanning) {
        // Drag pan viewport
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.renderer.panX += dx;
        this.renderer.panY += dy;
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
      this.canvas.style.cursor = 'default';
    });

    // Zoom Listener
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      // Calculate mouse position relative to canvas center before zoom change
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - this.canvas.width / 2;
      const my = e.clientY - rect.top - this.canvas.height / 2;

      // Zoom factor calculation
      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const oldZoom = this.renderer.zoom;
      
      this.renderer.zoom = Math.min(5.0, Math.max(0.3, this.renderer.zoom * zoomFactor));

      // Zoom centering correction: adjust pan so the mouse stays in the same place
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

