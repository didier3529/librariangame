import { PlayingState } from './PlayingState.js';
import { State } from './State.js';

export class MenuState extends State {
  constructor(game) {
    super(game);
    this.menuItems = [
      { text: 'Start Game', action: () => this.startGame() },
      { text: 'Instructions', action: () => this.showInstructions() }
    ];
    this.selectedIndex = 0;
    this.showingInstructions = false;
    
    // Video background
    this.video = null;
    this.videoLoaded = false;
    
    // Background music
    this.bgMusic = null;
    this.musicLoaded = false;
    
    // Menu selection sound
    this.selectSound = null;
  }
  
  enter() {
    this.selectedIndex = 0;
    this.showingInstructions = false;
    
    // Create and setup video if not already created
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.src = '/663c315b-a8f1-405e-b642-1b893f35a314.mp4';
      this.video.loop = true;
      this.video.muted = true;
      this.video.autoplay = true;
      
      // Handle various video events for better reliability
      this.video.addEventListener('canplay', () => {
        this.videoLoaded = true;
        this.video.play().catch(e => console.log('Video play failed:', e));
      });
      
      // Also try playing on loadedmetadata
      this.video.addEventListener('loadedmetadata', () => {
        this.video.play().catch(e => console.log('Video play on metadata failed:', e));
      });
      
      // Handle errors
      this.video.addEventListener('error', (e) => {
        console.error('Video loading error:', e);
        this.videoLoaded = false;
      });
      
      // Force load the video
      this.video.load();
    } else {
      // Resume playing if returning to menu
      this.videoLoaded = true; // Assume it's loaded if we already created it
      this.video.play().catch(e => console.log('Video play failed:', e));
    }
    
    // Create and setup background music if not already created
    if (!this.bgMusic) {
      this.bgMusic = new Audio('/intro_music.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.5; // Set to 50% volume
      
      // Start playing when loaded
      this.bgMusic.addEventListener('loadeddata', () => {
        this.musicLoaded = true;
        this.bgMusic.play().catch(e => console.log('Music play failed:', e));
      });
      
      // Load the music
      this.bgMusic.load();
    } else {
      // Resume playing if returning to menu
      this.bgMusic.play().catch(e => console.log('Music play failed:', e));
    }
    
    // Create menu selection sound if not already created
    if (!this.selectSound) {
      this.selectSound = new Audio('/menu_select.mp3');
      this.selectSound.volume = 0.7; // Slightly louder than music
    }
  }
  
  exit() {
    // Pause video when leaving menu
    if (this.video) {
      this.video.pause();
    }
    
    // Pause music when leaving menu
    if (this.bgMusic) {
      this.bgMusic.pause();
    }
  }
  
  update(deltaTime) {
    const input = this.game.inputManager;
    
    
    if (this.showingInstructions) {
      if (input.isKeyPressed('Escape') || input.isKeyPressed('Enter')) {
        this.showingInstructions = false;
      }
      return;
    }
    
    // Menu navigation
    if (input.isKeyPressed('ArrowUp') || input.isKeyPressed('w')) {
      this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
      this.playSelectSound();
    }
    
    if (input.isKeyPressed('ArrowDown') || input.isKeyPressed('s')) {
      this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
      this.playSelectSound();
    }
    
    if (input.isKeyPressed('Enter') || input.isKeyPressed(' ')) {
      this.menuItems[this.selectedIndex].action();
    }
    
    // Mouse support
    const mousePos = input.getMousePosition();
    if (mousePos && !this.showingInstructions) {
      const { width, height } = this.game;
      const menuStartY = height * 0.7; // Menu starts at 70% down
      
      // Check each menu item
      for (let i = 0; i < this.menuItems.length; i++) {
        const y = menuStartY + i * 60;
        const itemTop = y - 25;
        const itemBottom = y + 25;
        const itemLeft = width / 2 - 200;
        const itemRight = width / 2 + 200;
        
        if (mousePos.x >= itemLeft && mousePos.x <= itemRight &&
            mousePos.y >= itemTop && mousePos.y <= itemBottom) {
          // Mouse is over this item
          if (this.selectedIndex !== i) {
            this.selectedIndex = i;
            this.playSelectSound();
          }
          
          // Check for click
          if (input.isMouseButtonPressed(0)) { // 0 = left mouse button
            this.menuItems[this.selectedIndex].action();
          }
          break;
        }
      }
    }
  }
  
  render(renderer, interpolation) {
    const ctx = renderer.ctx;
    const { width, height } = this.game;
    
    // Draw video background if loaded
    if (this.video && this.videoLoaded && !this.video.paused) {
      try {
        // Scale video to cover the entire canvas
        const videoAspect = this.video.videoWidth / this.video.videoHeight;
        const canvasAspect = width / height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (videoAspect > canvasAspect) {
          // Video is wider - fit height, crop width
          drawHeight = height;
          drawWidth = height * videoAspect;
          drawX = (width - drawWidth) / 2;
          drawY = 0;
        } else {
          // Video is taller - fit width, crop height
          drawWidth = width;
          drawHeight = width / videoAspect;
          drawX = 0;
          drawY = (height - drawHeight) / 2;
        }
        
        ctx.drawImage(this.video, drawX, drawY, drawWidth, drawHeight);
      } catch (e) {
        // Fallback to solid color if video fails
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#404040');
        gradient.addColorStop(0.5, '#2a2a2a');
        gradient.addColorStop(1, '#1a1a1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      // Fallback background color
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#404040');
      gradient.addColorStop(0.5, '#2a2a2a');
      gradient.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    
    
    if (this.showingInstructions) {
      this.renderInstructions(ctx);
      return;
    }
    
    ctx.save();
    
    // Menu items - positioned in bottom third
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const menuStartY = height * 0.7; // Start at 70% down the screen
    
    this.menuItems.forEach((item, index) => {
      const y = menuStartY + index * 60;
      
      if (index === this.selectedIndex) {
        // Highlight selected item with semi-transparent background
        ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        ctx.fillRect(width / 2 - 200, y - 25, 400, 50);
        
        // Selected text with glow effect
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(item.text, width / 2, y);
        ctx.shadowBlur = 0;
      } else {
        // Non-selected items with shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(item.text, width / 2 + 2, y + 2);
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(item.text, width / 2, y);
      }
    });
    
    ctx.restore();
  }
  
  renderInstructions(ctx) {
    const { width, height } = this.game;
    
    ctx.save();
    
    // Draw light brown background box with rounded corners
    const boxWidth = 700;
    const boxHeight = 580; // Increased height to fit all text
    const boxX = (width - boxWidth) / 2;
    const boxY = height * 0.08;
    const borderRadius = 20;
    
    // Helper function to draw rounded rectangle
    const drawRoundedRect = (x, y, width, height, radius) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };
    
    // Box shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    drawRoundedRect(boxX + 5, boxY + 5, boxWidth, boxHeight, borderRadius);
    ctx.fill();
    
    // Main box with gradient
    const boxGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
    boxGradient.addColorStop(0, 'rgba(60, 60, 60, 0.95)');
    boxGradient.addColorStop(0.5, 'rgba(40, 40, 40, 0.95)');
    boxGradient.addColorStop(1, 'rgba(20, 20, 20, 0.95)');
    ctx.fillStyle = boxGradient;
    drawRoundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
    ctx.fill();
    
    // Box border
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 3;
    drawRoundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
    ctx.stroke();
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOW TO PLAY', width / 2, boxY + 50);
    
    ctx.font = '20px Arial'; // Reduced from 24px
    const instructions = [
      'Survive 30 minutes of library chaos!',
      '',
      'CONTROLS:',
      'WASD/Arrow Keys - Move',
      'Shift - Sprint (uses stamina)',
      'P/Escape - Pause',
      '',
      'GAMEPLAY:',
      '• Pick up volume blocks automatically when near them',
      '• Return volume blocks to matching colored shelves',
      '• Kids will steal volume blocks - chase them away!',
      '• Keep Chaos below 100% or you lose',
      '• Level up to choose upgrades',
      '',
      'Press Enter or Escape to return'
    ];
    
    const lineHeight = 28; // Spacing between lines
    const startY = boxY + 100; // Start text below title
    
    instructions.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + index * lineHeight);
    });
    
    ctx.restore();
  }
  
  startGame() {
    // Create a fresh PlayingState instance to ensure clean state
    const freshPlayingState = new PlayingState(this.game);
    this.game.stateManager.registerState('playing', freshPlayingState);
    
    this.game.stateManager.changeState('playing');
  }
  
  showInstructions() {
    this.showingInstructions = true;
  }
  
  playSelectSound() {
    if (this.selectSound) {
      // Reset the sound to play from beginning
      this.selectSound.currentTime = 0;
      this.selectSound.play().catch(e => console.log('Select sound play failed:', e));
    }
  }
}