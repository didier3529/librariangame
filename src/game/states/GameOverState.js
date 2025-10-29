import { State } from './State.js';

export class GameOverState extends State {
  constructor(game) {
    super(game);
    this.won = false;
    this.reason = '';
    this.stats = {};
    this.menuItems = [
      { text: 'Play Again', action: () => this.playAgain() },
      { text: 'Main Menu', action: () => this.mainMenu() }
    ];
    this.selectedIndex = 0;
    this.selectSound = null;
    
    // Video background
    this.video = null;
    this.videoLoaded = false;
  }
  
  enter(data) {
    this.won = data.won || false;
    this.reason = data.reason || '';
    this.selectedIndex = 0;
    
    // Initialize select sound if not already created
    if (!this.selectSound) {
      this.selectSound = new Audio('/menu_select.mp3');
      this.selectSound.volume = 0.7;
    }
    
    // Play "uh oh" sound if player lost
    if (!this.won) {
      const uhOhSound = new Audio('/uh_oh.mp3');
      uhOhSound.volume = 0.6;
      uhOhSound.play().catch(e => console.log('Uh oh sound play failed:', e));
    }
    
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
      // Resume playing if returning to game over screen
      this.videoLoaded = true; // Assume it's loaded if we already created it
      this.video.play().catch(e => console.log('Video play failed:', e));
    }
    
    // Collect game stats
    const gameData = this.game.gameData;
    this.stats = {
      timeElapsed: Math.floor(gameData.elapsedTime),
      level: gameData.playerLevel,
      chaosLevel: Math.floor(gameData.chaosLevel),
      volumeBlocksCollected: gameData.volumeBlocksCollected || 0,
      volumeBlocksShelved: gameData.volumeBlocksShelved || 0,
      kidsRepelled: gameData.kidsRepelled || 0,
    };
  }
  
  exit() {
    // Pause video when leaving game over screen
    if (this.video) {
      this.video.pause();
    }
  }
  
  update(deltaTime) {
    const input = this.game.inputManager;
    
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
    if (mousePos) {
      const { width, height } = this.game;
      const boxWidth = 700;
      const boxHeight = 600;
      const boxX = (width - boxWidth) / 2;
      const boxY = (height - boxHeight) / 2;
      
      // Check each menu item
      for (let i = 0; i < this.menuItems.length; i++) {
        const y = boxY + 480 + i * 50;
        const itemTop = y - 20;
        const itemBottom = y + 20;
        const itemLeft = boxX + 150;
        const itemRight = boxX + boxWidth - 150;
        
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
        ctx.fillStyle = this.won ? '#4169E1' : '#8B0000';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      // Fallback background color
      ctx.fillStyle = this.won ? '#4169E1' : '#8B0000';
      ctx.fillRect(0, 0, width, height);
    }
    
    // Result box with rounded corners
    const boxWidth = 700;
    const boxHeight = 600;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;
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
    
    // Draw box background with transparency
    drawRoundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
    ctx.fillStyle = 'rgba(245, 230, 211, 0.9)'; // Semi-transparent
    ctx.fill();
    
    ctx.strokeStyle = '#3d2914';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Title
    ctx.fillStyle = this.won ? '#228B22' : '#8B0000';
    ctx.font = 'bold 64px Arial';
    ctx.fillText(this.won ? 'VICTORY!' : 'GAME OVER', width / 2, boxY + 80);
    
    // Subtitle
    ctx.fillStyle = '#3d2914';
    ctx.font = '24px Arial';
    if (this.won) {
      ctx.fillText('You survived 30 minutes of library chaos!', width / 2, boxY + 130);
    } else {
      let message = 'The library descended into chaos...';
      if (this.reason === 'chaos') {
        message = 'The chaos overwhelmed the library!';
      }
      ctx.fillText(message, width / 2, boxY + 130);
    }
    
    // Stats
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    const statX = boxX + 100;
    let statY = boxY + 200;
    
    const minutes = Math.floor(this.stats.timeElapsed / 60);
    const seconds = this.stats.timeElapsed % 60;
    
    const statLines = [
      `Time Survived: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      `Final Level: ${this.stats.level}`,
      `Peak Chaos: ${this.stats.chaosLevel}%`,
      `Volume Blocks Collected: ${this.stats.volumeBlocksCollected}`,
      `Volume Blocks Shelved: ${this.stats.volumeBlocksShelved}`,
      `Kids Repelled: ${this.stats.kidsRepelled}`
    ];
    
    statLines.forEach(line => {
      ctx.fillText(line, statX, statY);
      statY += 30;
    });
    
    // Menu items
    ctx.textAlign = 'center';
    ctx.font = '32px Arial';
    this.menuItems.forEach((item, index) => {
      const y = boxY + 480 + index * 50;
      
      if (index === this.selectedIndex) {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(boxX + 150, y - 20, boxWidth - 300, 40);
        ctx.fillStyle = '#f5e6d3';
      } else {
        ctx.fillStyle = '#3d2914';
      }
      
      ctx.fillText(item.text, width / 2, y);
    });
    
    ctx.restore();
  }
  
  playAgain() {
    this.game.stateManager.changeState('playing');
  }
  
  mainMenu() {
    this.game.stateManager.changeState('menu');
  }
  
  playSelectSound() {
    if (this.selectSound) {
      this.selectSound.currentTime = 0;
      this.selectSound.play().catch(e => console.log('Select sound play failed:', e));
    }
  }
}