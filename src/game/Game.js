import { GameLoop } from './GameLoop.js';
import { StateManager } from './states/StateManager.js';
import { AssetLoader } from './systems/AssetLoader.js';
import { Camera } from './systems/Camera.js';
import { InputManager } from './systems/InputManager.js';
import { Renderer } from './systems/Renderer.js';

export class Game {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    console.log('Canvas element:', this.canvas);
    
    if (!this.canvas) {
      throw new Error(`Canvas element with id '${canvasId}' not found`);
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size
    this.width = 1600;
    this.height = 900;
    this.setupCanvas();
    
    // Core systems
    this.gameLoop = new GameLoop(
      this.update.bind(this),
      this.render.bind(this)
    );
    
    this.stateManager = new StateManager(this);
    this.inputManager = new InputManager(this.canvas);
    this.assetLoader = new AssetLoader();
    this.camera = new Camera(this.width, this.height);
    this.renderer = new Renderer(this.ctx, this.camera);
    
    // Debug info
    this.debug = {
      showFPS: false, // Disabled FPS counter
      showCollisionBoxes: false,
      showGrid: false
    };
    
    // Game-specific data
    this.gameData = {
      chaosLevel: 0,
      maxChaos: 100,
      playerLevel: 1,
      xp: 0,
      xpToNext: 100,
      elapsedTime: 0,
      targetTime: 30 * 60, // 30 minutes in seconds
      isPaused: false,
      // Stats tracking
      volumeBlocksCollected: 0,
      volumeBlocksShelved: 0,
      kidsRepelled: 0
    };
  }
  
  setupCanvas() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // Handle window resize
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }
  
  handleResize() {
    const container = this.canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const scale = Math.min(
      containerWidth / this.width,
      containerHeight / this.height
    );
    
    this.canvas.style.width = `${this.width * scale}px`;
    this.canvas.style.height = `${this.height * scale}px`;
  }
  
  async init() {
    // Load assets
    await this.loadAssets();
    
    // Initialize states
    await this.stateManager.init();
    
    // Hide loading screen and add playing class
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.classList.add('hidden');
    }
    
    // Add playing class to game container
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.classList.add('playing');
    }
    
    // Start with menu state
    this.stateManager.changeState('menu');
    
    // Start game loop
    this.gameLoop.start();
  }
  
  async loadAssets() {
    // Generate placeholder assets for development
    this.assetLoader.generatePlaceholderAssets();
    
    // Load real assets with cache busting
    const cacheBuster = `?v=${Date.now()}`;
    const assets = {
      images: {
        woodFloor: `/sprites/wood_floor_tiles.jpg${cacheBuster}`,
        librarianStand: `/sprites/librarian_stand.png${cacheBuster}`,
        librarianWalk1: `/sprites/librarian_walk1.png${cacheBuster}`,
        librarianWalk2: `/sprites/librarian_walk2.png${cacheBuster}`,
        // Kid sprites
        kid1Stand: `/sprites/kid1_stand.png${cacheBuster}`,
        kid1Walk: `/sprites/kid1_walk.png${cacheBuster}`,
        kid2Stand: `/sprites/kid2_stand.png${cacheBuster}`,
        kid2Walk: `/sprites/kid2_walk.png${cacheBuster}`,
        kid3Stand: `/sprites/kid3_stand.png${cacheBuster}`,
        kid3Walk: `/sprites/kid3_walk.png${cacheBuster}`
      }
    };
    await this.assetLoader.loadAll(assets);
  }
  
  update(deltaTime) {
    // Update current state BEFORE clearing input events
    this.stateManager.update(deltaTime);
    
    // Update camera
    this.camera.update(deltaTime);
    
    // Update input AFTER game logic has processed events
    this.inputManager.update();
  }
  
  render(interpolation) {
    // Clear canvas
    this.renderer.clear();
    
    // Render current state
    this.stateManager.render(this.renderer, interpolation);
    
    // Render debug info
    if (this.debug.showFPS) {
      this.renderDebugInfo();
    }
  }
  
  renderDebugInfo() {
    const fps = this.gameLoop.getFPS();
    
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.fillRect(this.width - 80, 5, 70, 25);
    
    this.ctx.fillStyle = '#000';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`FPS: ${fps}`, this.width - 10, 22);
    
    this.ctx.restore();
  }
}