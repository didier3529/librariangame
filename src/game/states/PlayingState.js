import { Kid } from '../entities/Kid.js';
import { Player } from '../entities/Player.js';
import { Shelf } from '../entities/Shelf.js';
import { VolumeBlock } from '../entities/VolumeBlock.js';
import { State } from './State.js';

export class PlayingState extends State {
  constructor(game) {
    super(game);
    this.instanceId = Math.random().toString(36).substring(7); // Unique ID for debugging
    console.log(`[RESTART DEBUG] Creating new PlayingState instance: ${this.instanceId}`);
    this.player = null;
    this.kids = [];
    this.volumeBlocks = [];
    this.shelves = [];
    this.particles = [];
    
    // World bounds - adapted for 1920x1080 canvas
    // Shelves: 10 cols, last shelf at x = 200 + 9*180 = 1820, shelf width = 64
    // So rightmost edge = 1820 + 64 = 1884
    // Shelves: 5 rows, last shelf at y = 200 + 4*180 = 920, shelf height = 96
    // So bottommost edge = 920 + 96 = 1016
    // Add buffer: 100 pixels on each side
    this.worldWidth = 1920; // Full width for new canvas
    this.worldHeight = 1080; // Full height for new canvas
    
    // Kid spawning
    this.kidSpawnTimer = 0;
    this.kidSpawnInterval = 15; // Constant 15 seconds between spawns
    this.maxKids = 3; // Starting max, will increase with waves
    this.lastMaxKids = 3; // Track previous max to detect increases
    
    // Wave notification
    this.maxKidsIncreaseNotification = {
      active: false,
      increase: 0,
      timer: 0,
      duration: 3 // Show for 3 seconds
    }
    
    // Performance optimizations
    this.floorPattern = null; // Cache floor pattern
    this.patternCanvas = null; // Canvas for pattern
    
    // Background music
    this.bgMusic = null;
    this.musicLoaded = false;
    
    // Sound effects
    this.pickupSounds = []; // Array of audio elements for overlapping sounds
    this.shelfSound = null;
    
    this.spawnPoints = [
      { x: 500, y: 400 }, // Middle-left area - away from shelves but in center region
      { x: 1500, y: 400 }, // Middle-right area - away from shelves but in center region
      { x: 500, y: 800 }, // Middle-left bottom area - away from shelves but in center region
      { x: 1500, y: 800 }, // Middle-right bottom area - away from shelves but in center region
      { x: 1000, y: 300 }, // Top center area - away from shelves but in center region
      { x: 1000, y: 900 }, // Bottom center area - away from shelves but in center region
      { x: 300, y: 600 }, // Far left area
      { x: 1700, y: 600 } // Far right area
    ];
  }
  
  enter() {
    console.log(`[RESTART DEBUG] PlayingState.enter() called for instance: ${this.instanceId}`);
    console.log(`[RESTART DEBUG] kids.length before clearing: ${this.kids.length}`);
    
    // Clear any existing entities first to prevent accumulation
    this.kids = [];
    this.volumeBlocks = [];
    this.particles = [];
    this.shelves = [];
    
    // Reset game data
    this.game.gameData = {
      chaosLevel: 0,
      maxChaos: 100,
      playerLevel: 1,
      xp: 0,
      xpToNext: 100,
      elapsedTime: 0,
      targetTime: 30 * 60,
      isPaused: false,
      // Stats tracking
      volumeBlocksCollected: 0,
      volumeBlocksShelved: 0,
      kidsRepelled: 0
    };
    
    // Ensure kid spawning is reset to initial values
    this.maxKids = 3;
    this.lastMaxKids = 3;
    this.kidSpawnTimer = 0;
    this.kidSpawnInterval = 15;
    
    // Reset wave notification
    this.maxKidsIncreaseNotification = {
      active: false,
      increase: 0,
      timer: 0,
      duration: 3
    };
    
    console.log(`[KID SPAWNING] World dimensions: ${this.worldWidth}x${this.worldHeight}`);
    console.log(`[KID SPAWNING] Spawn points:`, this.spawnPoints);
    
    // Initialize game world
    this.initializeLevel();
    
    // Start background music
    if (!this.bgMusic) {
      this.bgMusic = new Audio('/game_song.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.1; // 10% volume for background music
      
      this.bgMusic.addEventListener('loadeddata', () => {
        this.musicLoaded = true;
        this.bgMusic.play().catch(e => console.log('Game music play failed:', e));
      });
      
      this.bgMusic.load();
    } else {
      // Resume if returning to game
      this.bgMusic.play().catch(e => console.log('Game music play failed:', e));
    }
    
    // Initialize sound effects
    if (this.pickupSounds.length === 0) {
      // Create 5 audio instances for overlapping pickup sounds
      for (let i = 0; i < 5; i++) {
        const audio = new Audio('/pickup_volume_block.mp3');
        audio.volume = 0.7; // Increased from 0.5 for better audibility
        this.pickupSounds.push(audio);
      }
    }
    
    if (!this.shelfSound) {
      this.shelfSound = new Audio('/volume_block_on_shelf.mp3');
      this.shelfSound.volume = 0.6;
    }
  }
  
  exit() {
    // Clean up
    this.kids = [];
    this.volumeBlocks = [];
    this.particles = [];
    this.shelves = [];
    
    // Reset kid spawning variables to initial state
    this.maxKids = 3;
    this.lastMaxKids = 3;
    this.kidSpawnTimer = 0;
    this.kidSpawnInterval = 15;
    
    // Reset wave notification
    this.maxKidsIncreaseNotification = {
      active: false,
      increase: 0,
      timer: 0,
      duration: 3
    };
    
    // Pause music when leaving game
    if (this.bgMusic) {
      this.bgMusic.pause();
    }
    
    // Stop player sounds
    if (this.player) {
      this.player.cleanup();
    }
    
    // Clear sound arrays to ensure re-initialization
    this.pickupSounds = [];
    this.shelfSound = null;
  }
  
  initializeLevel() {
    // Generate volume vault layout first
    this.generateVolumeVaultLayout();
    
    // Create player in a safe spot between shelves
    // Shelves now start at x:200, y:200 with 180x180 spacing
    // Place player in the aisle to the left of first shelf
    this.player = new Player(
      this.game,
      100,  // Left edge buffer area
      500   // Middle height of volume vault
    );
    
    // Set camera bounds to world
    this.game.camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
    
    // Center camera on player
    this.game.camera.follow(this.player);
    
    // Spawn initial kids
    const initialKids = 2; // Start with 2 kids
    console.log(`[RESTART DEBUG] Before spawning: kids.length = ${this.kids.length}`);
    for (let i = 0; i < initialKids; i++) {
      const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      console.log(`[SPAWN DEBUG] Spawning kid ${i+1} at position:`, spawnPoint);
      const kid = new Kid(this.game, spawnPoint.x, spawnPoint.y, 1); // Easy kid
      console.log(`[SPAWN DEBUG] Kid ${i+1} created with position:`, {x: kid.x, y: kid.y, width: kid.width, height: kid.height});
      this.kids.push(kid);
    }
    console.log(`[RESTART DEBUG] After spawning: kids.length = ${this.kids.length}`);
    console.log(`[RESTART DEBUG] maxKids = ${this.maxKids}`);
    
    // Initialize kid spawning for additional kids
    this.kidSpawnTimer = 15; // First additional kid spawns after 15 seconds
  }
  
  update(deltaTime) {
    const input = this.game.inputManager;
    const gameData = this.game.gameData;
    
    // Recovery mechanism: Press 'r' to refocus canvas if input seems stuck
    if (input.isKeyPressed('r') || input.isKeyPressed('R')) {
      console.log('Manual focus recovery triggered');
      input.ensureFocus();
    }
    
    // Handle pause
    if (input.isKeyPressed('p') || input.isKeyPressed('Escape')) {
      // Pause music when pausing game
      if (this.bgMusic) {
        this.bgMusic.pause();
      }
      this.game.stateManager.pushState('paused');
      return;
    }
    
    // Don't update if paused
    if (gameData.isPaused) return;
    
    // Update game timer
    gameData.elapsedTime += deltaTime;
    
    // Check win condition
    if (gameData.elapsedTime >= gameData.targetTime) {
      this.game.stateManager.changeState('gameover', { won: true });
      return;
    }
    
    // Update chaos (placeholder - will be based on volume blocks on floor)
    this.updateChaos(deltaTime);
    
    // Check lose conditions
    if (gameData.chaosLevel >= gameData.maxChaos) {
      this.game.stateManager.changeState('gameover', { won: false, reason: 'chaos' });
      return;
    }
    
    // Update player
    if (this.player) {
      this.player.update(deltaTime);
    }
    
    // Update shelves
    for (const shelf of this.shelves) {
      shelf.update(deltaTime);
    }
    
    // Update volume blocks
    for (const volumeBlock of this.volumeBlocks) {
      volumeBlock.update(deltaTime);
    }
    
    // Update kids
    const kidsBeforeUpdate = this.kids.length;
    for (const kid of this.kids) {
      kid.update(deltaTime);
    }
    
    // Check if any kids disappeared during update
    if (this.kids.length !== kidsBeforeUpdate) {
      console.log(`[KID SPAWNING] WARNING: Kids count changed during update! Before: ${kidsBeforeUpdate}, After: ${this.kids.length}`);
    }
    
    // Update kid spawning
    this.updateKidSpawning(deltaTime);
    
    // Check volume block pickup
    this.checkVolumeBlockPickup();
    
    // Check volume block snatching from kids
    this.checkVolumeBlockSnatching();
    
    // Check volume block shelving
    this.checkVolumeBlockShelving();
    
    // Update particles
    this.updateParticles(deltaTime);
    
    // Validate volume block states (debug)
    if (Math.random() < 0.01) { // Check 1% of frames to avoid spam
      this.validateVolumeBlockStates();
    }
    
  }
  
  updateChaos(deltaTime) {
    const gameData = this.game.gameData;
    
    // Count volume blocks causing chaos (on floor or held by kids)
    const volumeBlocksOnFloor = this.volumeBlocks.filter(volumeBlock => !volumeBlock.isHeld && !volumeBlock.isShelved).length;
    const volumeBlocksHeldByKids = this.volumeBlocks.filter(volumeBlock => {
      return volumeBlock.isHeld && volumeBlock.holder && volumeBlock.holder.constructor.name === 'Kid';
    }).length;
    const totalChaosVolumeBlocks = volumeBlocksOnFloor + volumeBlocksHeldByKids;
    
    // Sliding chaos rate based on game progression
    let chaosRate = 0;
    if (totalChaosVolumeBlocks > 0) {
      // Calculate game time in minutes
      const minutes = gameData.elapsedTime / 60;
      
      // Determine chaos rate per volume block based on time
      let chaosPerVolumeBlock;
      if (minutes < 3) {
        chaosPerVolumeBlock = 0.05; // 0-3 minutes: 0.05% per volume block per second
      } else if (minutes < 5) {
        chaosPerVolumeBlock = 0.03; // 3-5 minutes: 0.03% per volume block per second
      } else {
        chaosPerVolumeBlock = 0.01; // 5+ minutes: 0.01% per volume block per second
      }
      
      chaosRate = totalChaosVolumeBlocks * chaosPerVolumeBlock;
      
      // Apply chaos dampening from upgrades
      const chaosDampening = this.player?.stats?.chaosDampening || 0;
      const chaosMultiplier = 1 - (chaosDampening / 100);
      gameData.chaosLevel += chaosRate * deltaTime * chaosMultiplier;
    }
    
    // Passive chaos decay when low (helps recovery)
    if (gameData.chaosLevel > 0) {
      if (totalChaosVolumeBlocks === 0) {
        // Slow decay when no volume blocks are out
        gameData.chaosLevel -= 0.1 * deltaTime;
      }
      // Removed passive decay when under 50% - player must actively manage chaos
    }
    
    // Clamp chaos level
    gameData.chaosLevel = Math.max(0, Math.min(gameData.maxChaos, gameData.chaosLevel));
  }
  
  render(renderer, interpolation) {
    const ctx = renderer.ctx;
    const { width, height } = this.game;
    const gameData = this.game.gameData;
    
    // Clear with volume vault floor color
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(0, 0, width, height);
    
    // Render floor tiles
    this.renderFloor(ctx);
    
    // Get viewport bounds for culling
    const viewportX = this.game.camera.getViewportX();
    const viewportY = this.game.camera.getViewportY();
    const viewportWidth = this.game.camera.viewportWidth / this.game.camera.zoom;
    const viewportHeight = this.game.camera.viewportHeight / this.game.camera.zoom;
    const padding = 100; // Render entities slightly outside viewport
    
    // Render shelves (only visible ones)
    for (const shelf of this.shelves) {
      if (this.isInViewport(shelf, viewportX - padding, viewportY - padding, 
                           viewportWidth + padding * 2, viewportHeight + padding * 2)) {
        renderer.addToLayer('entities', shelf);
      }
    }
    
    // Render volume blocks (only visible ones that are not held or shelved)
    for (const volumeBlock of this.volumeBlocks) {
      if (!volumeBlock.isHeld && !volumeBlock.isShelved && 
          this.isInViewport(volumeBlock, viewportX - padding, viewportY - padding, 
                           viewportWidth + padding * 2, viewportHeight + padding * 2)) {
        renderer.addToLayer('entities', volumeBlock);
      }
    }
    
    // Render kids (only visible ones)
    for (const kid of this.kids) {
      if (this.isInViewport(kid, viewportX - padding, viewportY - padding, 
                           viewportWidth + padding * 2, viewportHeight + padding * 2)) {
        renderer.addToLayer('entities', kid);
      }
    }
    
    // TODO: Render particles
    
    // Render player
    if (this.player) {
      renderer.addToLayer('entities', this.player);
    }
    
    // Render all layers
    renderer.render(interpolation);
    
    // Render UI
    this.renderUI(ctx);
    
    // Chaos vignette effect
    if (gameData.chaosLevel > 80) {
      const intensity = (gameData.chaosLevel - 80) / 20;
      this.renderChaosVignette(ctx, intensity);
    }
  }
  
  renderUI(ctx) {
    const gameData = this.game.gameData;
    const { width, height } = this.game;
    
    ctx.save();
    
    // Top Center - Chaos meter
    const meterWidth = 300;
    const meterHeight = 30;
    const meterX = width / 2 - meterWidth / 2;
    const meterY = 20;
    
    // Chaos meter background
    ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
    ctx.fillRect(meterX - 2, meterY - 2, meterWidth + 4, meterHeight + 4);
    
    // Chaos meter fill
    const chaosPercent = gameData.chaosLevel / gameData.maxChaos;
    const chaosColor = chaosPercent > 0.8 ? '#ff6b6b' : 
                      chaosPercent > 0.6 ? '#ffa726' : 
                      chaosPercent > 0.4 ? '#ffeb3b' : '#4caf50';
    
    ctx.fillStyle = chaosColor;
    ctx.fillRect(meterX, meterY, meterWidth * chaosPercent, meterHeight);
    
    // Chaos meter text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`CHAOS: ${Math.floor(gameData.chaosLevel)}%`, width / 2, meterY + meterHeight / 2);
    
    // Wave increase notification below chaos meter
    if (this.maxKidsIncreaseNotification.active) {
      const notificationY = meterY + meterHeight + 15;
      const fadeProgress = this.maxKidsIncreaseNotification.timer / this.maxKidsIncreaseNotification.duration;
      let alpha;
      
      // Fade in for first 0.5 seconds, stay solid, then fade out in last 0.5 seconds
      if (fadeProgress < 0.5 / 3) {
        alpha = fadeProgress * 6; // Fade in
      } else if (fadeProgress > 2.5 / 3) {
        alpha = (1 - fadeProgress) * 6; // Fade out
      } else {
        alpha = 1; // Solid
      }
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#ffeb3b'; // Modern yellow color for visibility
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      
      const notificationText = `Maximum kids allowed grew by ${this.maxKidsIncreaseNotification.increase}`;
      
      // Draw text outline for better visibility
      ctx.strokeText(notificationText, width / 2, notificationY);
      ctx.fillText(notificationText, width / 2, notificationY);
      ctx.restore();
    }
    
    // Top Right - Timer and Kid Counter
    const timeRemaining = Math.max(0, gameData.targetTime - gameData.elapsedTime);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    
    // Timer background
    ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.fillRect(width - 120, 15, 110, 40);
    
    ctx.font = '24px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, width - 65, 40);
    
    // Kid counter below timer
    ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.fillRect(width - 120, 60, 110, 35);
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Bonks: ${this.kids.length}/${this.maxKids}`, width - 65, 82);
    
    // Left Side Panel - Player Stats
    const panelX = 10;
    const panelY = 10;
    const panelWidth = 250;
    const panelHeight = 150; // Reduced since HP is removed
    
    // Panel background
    ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Level and XP
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Level ${gameData.playerLevel}`, panelX + 10, panelY + 30);
    
    // XP bar
    const xpBarX = panelX + 10;
    const xpBarY = panelY + 40;
    const xpBarWidth = panelWidth - 20;
    const xpBarHeight = 15;
    
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(xpBarX, xpBarY, xpBarWidth, xpBarHeight);
    
    const xpPercent = gameData.xp / gameData.xpToNext;
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(xpBarX, xpBarY, xpBarWidth * xpPercent, xpBarHeight);
    
    // XP text
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${gameData.xp} / ${gameData.xpToNext} XP`, xpBarX + xpBarWidth / 2, xpBarY + xpBarHeight / 2 + 1);
    
    if (this.player) {
      // Stamina bar
      ctx.textAlign = 'left';
      ctx.font = '16px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText('Stamina', panelX + 10, panelY + 80);
      
      const staminaBarX = panelX + 75;
      const staminaBarY = panelY + 65;
      const staminaBarWidth = panelWidth - 85;
      const staminaBarHeight = 20;
      
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(staminaBarX, staminaBarY, staminaBarWidth, staminaBarHeight);
      
      const staminaPercent = this.player.stats.stamina / this.player.stats.maxStamina;
      ctx.fillStyle = '#2196f3';
      ctx.fillRect(staminaBarX, staminaBarY, staminaBarWidth * staminaPercent, staminaBarHeight);
      
      // Stamina text
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(this.player.stats.stamina)} / ${this.player.stats.maxStamina}`, staminaBarX + staminaBarWidth / 2, staminaBarY + staminaBarHeight / 2 + 1);
      
      // Volume blocks carried indicator
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Sol: ${this.player.carriedVolumeBlocks.length} / ${this.player.stats.carrySlots}`, panelX + 10, panelY + 105);
      
      // Speed indicator (if sprinting)
      if (this.player.isSprinting && this.player.stats.stamina > 0) {
        ctx.fillStyle = '#ffeb3b';
        ctx.fillText('SPRINTING', panelX + 10, panelY + 130);
      }
    }
    
    ctx.restore();
  }
  
  renderChaosVignette(ctx, intensity) {
    const { width, height } = this.game;
    
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.4,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(139, 0, 0, ${intensity * 0.5})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  renderFloor(ctx) {
    const woodFloorImage = this.game.assetLoader.getImage('woodFloor');
    
    if (!woodFloorImage || !woodFloorImage.complete) {
      // Fallback to solid color if image hasn't loaded
      const viewportX = this.game.camera.getViewportX();
      const viewportY = this.game.camera.getViewportY();
      const viewportWidth = this.game.camera.viewportWidth / this.game.camera.zoom;
      const viewportHeight = this.game.camera.viewportHeight / this.game.camera.zoom;
      
      this.game.renderer.addToLayer('background', (ctx) => {
        ctx.fillStyle = '#d4a574';
        ctx.fillRect(viewportX, viewportY, viewportWidth, viewportHeight);
      });
      return;
    }
    
    // Create pattern once and cache it
    if (!this.floorPattern) {
      // Create a scaled pattern canvas
      const scale = 0.5;
      this.patternCanvas = document.createElement('canvas');
      this.patternCanvas.width = woodFloorImage.width * scale;
      this.patternCanvas.height = woodFloorImage.height * scale;
      const patternCtx = this.patternCanvas.getContext('2d');
      patternCtx.drawImage(woodFloorImage, 0, 0, this.patternCanvas.width, this.patternCanvas.height);
      this.floorPattern = this.game.renderer.ctx.createPattern(this.patternCanvas, 'repeat');
    }
    
    // Add wood floor image rendering to background layer
    this.game.renderer.addToLayer('background', (ctx) => {
      if (this.floorPattern) {
        ctx.save();
        ctx.fillStyle = this.floorPattern;
        // Fill the entire world area, not just viewport
        ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
        ctx.restore();
      }
    });
  }
  
  updateKidSpawning(deltaTime) {
    // Calculate current game time in minutes
    const minutes = this.game.gameData.elapsedTime / 60;
    
    // Determine max kids based on wave progression
    let newMaxKids;
    if (minutes < 1) {
      newMaxKids = 3; // First minute: max 3
    } else if (minutes < 3) {
      newMaxKids = 5; // 1-3 minutes: max 5
    } else if (minutes < 5) {
      newMaxKids = 7; // 3-5 minutes: max 7
    } else if (minutes < 10) {
      newMaxKids = 10; // 5-10 minutes: max 10
    } else {
      // After 10 minutes: increase by 2 every minute
      const additionalMinutes = Math.floor(minutes - 10);
      newMaxKids = 10 + (additionalMinutes * 2);
    }
    
    // Check if max kids increased
    if (newMaxKids > this.maxKids) {
      const increase = newMaxKids - this.maxKids;
      this.maxKids = newMaxKids;
      
      // Trigger notification
      this.maxKidsIncreaseNotification = {
        active: true,
        increase: increase,
        timer: 0,
        duration: 3
      };
      
      console.log(`[WAVE SYSTEM] Max kids increased to ${this.maxKids} (+${increase})`);
    }
    
    // Update notification timer
    if (this.maxKidsIncreaseNotification.active) {
      this.maxKidsIncreaseNotification.timer += deltaTime;
      if (this.maxKidsIncreaseNotification.timer >= this.maxKidsIncreaseNotification.duration) {
        this.maxKidsIncreaseNotification.active = false;
      }
    }
    
    // Don't spawn more kids if we're at the limit
    if (this.kids.length >= this.maxKids) {
      return;
    }
    
    // Update spawn timer
    this.kidSpawnTimer -= deltaTime;
    
    if (this.kidSpawnTimer <= 0) {
      // Determine aggression level based on time
      let aggressionLevel = 1; // Easy by default
      let spawnInterval = 15; // Always 15 seconds
      
      if (minutes >= 15) {
        // After 15 minutes: more aggressive kids
        aggressionLevel = 3;
      } else if (minutes >= 10) {
        // 10-15 minutes: aggressive kids
        aggressionLevel = 3;
      } else if (minutes >= 5) {
        // 5-10 minutes: normal kids
        aggressionLevel = 2;
      }
      
      // Spawn a new kid
      const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      const kid = new Kid(this.game, spawnPoint.x, spawnPoint.y, aggressionLevel);
      this.kids.push(kid);
      
      // Reset timer for next spawn
      this.kidSpawnTimer = spawnInterval;
      this.kidSpawnInterval = spawnInterval;
      
      console.log(`[KID SPAWNING] Spawned kid #${this.kids.length}/${this.maxKids} (aggression: ${aggressionLevel}) - Next spawn in ${spawnInterval}s`);
    }
  }
  
  generateVolumeVaultLayout() {
    // Define shelf colors
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    
    // Create a grid of shelves - adapted for 1920x1080
    const shelfSpacingX = 180; // Increased spacing for larger canvas
    const shelfSpacingY = 180; // Increased spacing for larger canvas
    const startX = 200; // Start further from left edge for better balance
    const startY = 200; // Start further from top edge for better balance
    const rows = 5; // More rows for larger canvas
    const cols = 10; // More columns for larger canvas
    
    // Create color distribution array to ensure equal distribution
    // 50 shelves / 6 colors = 8.33, so we need 8 of each color + 2 extra
    const colorDistribution = [];
    for (let i = 0; i < 8; i++) {
      colorDistribution.push(...colors);
    }
    // Add 2 more to reach 50 total (we'll use red and blue for balance)
    colorDistribution.push('red', 'blue');
    
    // Shuffle the color distribution for variety
    for (let i = colorDistribution.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colorDistribution[i], colorDistribution[j]] = [colorDistribution[j], colorDistribution[i]];
    }
    
    let shelfIndex = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * shelfSpacingX;
        const y = startY + row * shelfSpacingY;
        
        // Pick a color from our balanced distribution
        const color = colorDistribution[shelfIndex];
        
        // Create shelf
        const shelf = new Shelf(this.game, x, y, color);
        this.shelves.push(shelf);
        
        // Fill shelf to capacity (6 volume blocks)
        for (let i = 0; i < shelf.capacity; i++) {
          const volumeBlock = new VolumeBlock(this.game, 0, 0, color);
          shelf.addVolumeBlock(volumeBlock);
          this.volumeBlocks.push(volumeBlock);
        }
        
        shelfIndex++;
      }
    }
    
    // Log color distribution for debugging
    const colorCounts = {};
    this.shelves.forEach(shelf => {
      colorCounts[shelf.color] = (colorCounts[shelf.color] || 0) + 1;
    });
    console.log('[LIBRARY LAYOUT] Shelf color distribution:', colorCounts);
    console.log('[LIBRARY LAYOUT] Total volume blocks per color:', Object.entries(colorCounts).map(([color, count]) => `${color}: ${count * 6}`));
  }
  
  isPlayerNearShelf(shelf, distance) {
    if (!this.player) return false;
    
    // Check if player is within distance of any edge of the shelf
    const playerLeft = this.player.x;
    const playerRight = this.player.x + this.player.width;
    const playerTop = this.player.y;
    const playerBottom = this.player.y + this.player.height;
    
    const shelfLeft = shelf.x;
    const shelfRight = shelf.x + shelf.width;
    const shelfTop = shelf.y;
    const shelfBottom = shelf.y + shelf.height;
    
    // Expand shelf bounds by distance
    const expandedLeft = shelfLeft - distance;
    const expandedRight = shelfRight + distance;
    const expandedTop = shelfTop - distance;
    const expandedBottom = shelfBottom + distance;
    
    // Check if player overlaps with expanded bounds
    return !(playerLeft >= expandedRight || 
             playerRight <= expandedLeft || 
             playerTop >= expandedBottom || 
             playerBottom <= expandedTop);
  }
  
  checkVolumeBlockPickup() {
    if (!this.player) return;
    
    const pickupRadiusPixels = this.player.stats.pickupRadius * 32;
    const playerCenterX = this.player.getCenterX();
    const playerCenterY = this.player.getCenterY();
    
    for (const volumeBlock of this.volumeBlocks) {
      // Skip if volume block is already held or shelved
      if (volumeBlock.isHeld || volumeBlock.isShelved) continue;
      
      // Check distance
      const distance = Math.sqrt(
        Math.pow(volumeBlock.getCenterX() - playerCenterX, 2) +
        Math.pow(volumeBlock.getCenterY() - playerCenterY, 2)
      );
      
      if (distance <= pickupRadiusPixels) {
        // Try to pick up the volume block
        if (this.player.pickupVolumeBlock(volumeBlock)) {
          volumeBlock.pickup(this.player);
          
          // Track volume block collection
          this.game.gameData.volumeBlocksCollected++;
          
          // Reduce chaos when picking up (balanced with new rates)
          this.game.gameData.chaosLevel -= 0.5; // Much smaller reduction
          this.game.gameData.chaosLevel = Math.max(0, this.game.gameData.chaosLevel);
          
          // Award XP
          this.awardXP(5);
          
          // Play pickup sound
          this.playPickupSound();
        }
      }
    }
  }
  
  checkVolumeBlockShelving() {
    if (!this.player || this.player.carriedVolumeBlocks.length === 0) return;
    
    const returnDistance = this.player.stats.returnRadius * 32;
    
    for (const shelf of this.shelves) {
      // Check if player is near any edge of the shelf
      if (this.isPlayerNearShelf(shelf, returnDistance) && shelf.hasEmptySlots()) {
        // Try to shelve matching volume blocks
        const volumeBlock = this.player.shelveVolumeBlock(shelf);
        if (volumeBlock && shelf.addVolumeBlock(volumeBlock)) {
          // Track volume block shelving
          this.game.gameData.volumeBlocksShelved++;
          
          // Reduce chaos when shelving (bigger reward for completing the task)
          this.game.gameData.chaosLevel -= 1.0; // Reduced to match new chaos rates
          this.game.gameData.chaosLevel = Math.max(0, this.game.gameData.chaosLevel);
          
          // Award XP
          this.awardXP(10);
          
          // Play shelf sound
          this.playShelfSound();
        }
      }
    }
  }
  
  awardXP(amount) {
    const gameData = this.game.gameData;
    
    // Apply XP multiplier and early game boost
    let xpMultiplier = this.player?.getXPMultiplier() || 1;
    
    // Early game XP boost for first 2 minutes
    if (gameData.elapsedTime < 120) { // 2 minutes
      xpMultiplier *= 1.5;
    }
    
    const multipliedAmount = Math.floor(amount * xpMultiplier);
    gameData.xp += multipliedAmount;
    
    // Create floating XP text
    if (this.player) {
      this.particles.push({
        type: 'xp',
        x: this.player.getCenterX(),
        y: this.player.y - 10,
        text: `+${multipliedAmount} XP`,
        vy: -50,
        lifetime: 1.5,
        age: 0
      });
    }
    
    // Check for level up
    while (gameData.xp >= gameData.xpToNext) {
      gameData.xp -= gameData.xpToNext;
      gameData.playerLevel++;
      
      // Refill stamina as a level up bonus
      if (this.player) {
        this.player.stats.stamina = this.player.stats.maxStamina;
      }
      
      // Calculate next level XP requirement
      gameData.xpToNext = Math.floor(100 * Math.pow(1.45, gameData.playerLevel - 1));
      
      // Show upgrade selection
      this.game.stateManager.pushState('upgradeSelection');
    }
  }
  
  updateParticles(deltaTime) {
    // Update and remove expired particles
    this.particles = this.particles.filter(particle => {
      particle.age += deltaTime;
      
      if (particle.type === 'xp') {
        particle.y += particle.vy * deltaTime;
        particle.vy += 100 * deltaTime; // Gravity
      }
      
      return particle.age < particle.lifetime;
    });
  }
  
  renderParticles(renderer) {
    renderer.addToLayer('ui', (ctx) => {
      ctx.save();
      
      for (const particle of this.particles) {
        if (particle.type === 'xp') {
          const alpha = 1 - (particle.age / particle.lifetime);
          ctx.globalAlpha = alpha;
          ctx.font = 'bold 18px Arial';
          ctx.fillStyle = '#ffeb3b';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.textAlign = 'center';
          ctx.strokeText(particle.text, particle.x, particle.y);
          ctx.fillText(particle.text, particle.x, particle.y);
        }
      }
      
      ctx.restore();
    });
  }
  
  validateVolumeBlockStates() {
    const volumeBlockStates = {
      shelved: 0,
      held: 0,
      floor: 0,
      invalid: 0
    };
    
    for (const volumeBlock of this.volumeBlocks) {
      if (volumeBlock.isShelved && volumeBlock.isHeld) {
        console.error(`Volume block ${volumeBlock.id} is both shelved and held!`);
        volumeBlockStates.invalid++;
      } else if (volumeBlock.isShelved) {
        volumeBlockStates.shelved++;
        // Verify volume block is actually in a shelf
        let foundInShelf = false;
        for (const shelf of this.shelves) {
          if (shelf.volumeBlocks.includes(volumeBlock)) {
            foundInShelf = true;
            break;
          }
        }
        if (!foundInShelf) {
          console.error(`Volume block ${volumeBlock.id} marked as shelved but not in any shelf!`);
        }
      } else if (volumeBlock.isHeld) {
        volumeBlockStates.held++;
        if (!volumeBlock.holder) {
          console.error(`Volume block ${volumeBlock.id} marked as held but has no holder!`);
        }
      } else {
        volumeBlockStates.floor++;
      }
    }
    
    // Log summary only if there are issues
    if (volumeBlockStates.invalid > 0) {
      console.log('Volume block states:', volumeBlockStates, 'Total:', this.volumeBlocks.length);
    }
  }
  
  checkVolumeBlockSnatching() {
    if (!this.player || this.player.carriedVolumeBlocks.length >= this.player.stats.carrySlots) return;
    
    // Use player's repel radius for snatching volume blocks from kids
    const snatchRadius = this.player.repelRadius;
    const playerCenterX = this.player.getCenterX();
    const playerCenterY = this.player.getCenterY();
    
    for (const kid of this.kids) {
      // Check if kid is carrying a volume block
      if (!kid.carriedVolumeBlock) continue;
      
      // Check distance to kid
      const distance = Math.sqrt(
        Math.pow(kid.getCenterX() - playerCenterX, 2) +
        Math.pow(kid.getCenterY() - playerCenterY, 2)
      );
      
      if (distance <= snatchRadius) {
        // Snatch the volume block from the kid
        const volumeBlock = kid.carriedVolumeBlock;
        
        // Remove volume block from kid
        kid.carriedVolumeBlock = null;
        kid.dropVolumeBlockTimer = 0;
        
        // Give volume block to player
        if (this.player.pickupVolumeBlock(volumeBlock)) {
          volumeBlock.pickup(this.player);
          
          // Track volume block collection
          this.game.gameData.volumeBlocksCollected++;
          
          // Kid flees after being robbed
          kid.state = 'fleeing';
          
          // Reduce chaos when snatching (reward for catching kids)
          this.game.gameData.chaosLevel -= 0.75; // Balanced reduction
          this.game.gameData.chaosLevel = Math.max(0, this.game.gameData.chaosLevel);
          
          // Award XP for snatching
          this.awardXP(7); // Slightly more XP than ground pickup
          
          // Play pickup sound
          this.playPickupSound();
        }
      }
    }
  }
  
  isInViewport(entity, viewX, viewY, viewWidth, viewHeight) {
    return !(entity.x + entity.width < viewX || 
             entity.x > viewX + viewWidth ||
             entity.y + entity.height < viewY || 
             entity.y > viewY + viewHeight);
  }
  
  playPickupSound() {
    // Find an available audio instance that's not currently playing
    for (const audio of this.pickupSounds) {
      if (audio.paused || audio.ended) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Pickup sound play failed:', e));
        return;
      }
    }
    
    // If all are playing, use the first one anyway (will restart it)
    if (this.pickupSounds.length > 0) {
      this.pickupSounds[0].currentTime = 0;
      this.pickupSounds[0].play().catch(e => console.log('Pickup sound play failed:', e));
    }
  }
  
  playShelfSound() {
    if (this.shelfSound) {
      this.shelfSound.currentTime = 0;
      this.shelfSound.play().catch(e => console.log('Shelf sound play failed:', e));
    }
  }
}