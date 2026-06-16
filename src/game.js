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

