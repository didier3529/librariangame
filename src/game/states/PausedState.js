import { PlayingState } from './PlayingState.js';
import { State } from './State.js';

export class PausedState extends State {
  constructor(game) {
    super(game);
    this.menuItems = [
      { text: 'Resume', action: () => this.resume() },
      { text: 'Restart', action: () => this.restart() },
      { text: 'Main Menu', action: () => this.mainMenu() }
    ];
    this.selectedIndex = 0;
    this.selectSound = null;
  }
  
  enter() {
    this.selectedIndex = 0;
    this.game.gameData.isPaused = true;
    
    // Initialize select sound if not already created
    if (!this.selectSound) {
      this.selectSound = new Audio('/menu_select.mp3');
      this.selectSound.volume = 0.7;
    }
  }
  
  exit() {
    this.game.gameData.isPaused = false;
  }
  
  update(deltaTime) {
    const input = this.game.inputManager;
    
    // Quick resume with same key
    if (input.isKeyPressed('p') || input.isKeyPressed('Escape')) {
      this.resume();
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
    if (mousePos) {
      const { width, height } = this.game;
      const boxWidth = 400;
      const boxHeight = 300;
      const boxX = (width - boxWidth) / 2;
      const boxY = (height - boxHeight) / 2;
      
      // Check each menu item
      for (let i = 0; i < this.menuItems.length; i++) {
        const y = boxY + 140 + i * 50;
        const itemTop = y - 20;
        const itemBottom = y + 20;
        const itemLeft = boxX + 50;
        const itemRight = boxX + boxWidth - 50;
        
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
    
    // Grey theme overlay
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(40, 40, 40, 0.9)');
    gradient.addColorStop(0.5, 'rgba(30, 30, 30, 0.95)');
    gradient.addColorStop(1, 'rgba(20, 20, 20, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Pause menu box with grey theme
    const boxWidth = 400;
    const boxHeight = 300;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;
    
    // Main box - same grey as shelves
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    // Purple border with subtle glow
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // Inner highlight
    ctx.strokeStyle = '#A78BFA';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4);
    
    // Title with purple glow
    ctx.save();
    ctx.fillStyle = '#8B5CF6';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add glow effect to title
    ctx.shadowColor = '#8B5CF6';
    ctx.shadowBlur = 10;
    ctx.fillText('PAUSED', width / 2, boxY + 60);
    
    // Menu items with purple styling
    ctx.font = '32px Arial';
    ctx.shadowBlur = 0; // Reset shadow for menu items
    this.menuItems.forEach((item, index) => {
      const y = boxY + 140 + index * 50;
      
      if (index === this.selectedIndex) {
        // Selected item - purple background with glow
        ctx.fillStyle = '#8B5CF6';
        ctx.fillRect(boxX + 50, y - 20, boxWidth - 100, 40);
        
        // Add glow to selected background
        ctx.shadowColor = '#8B5CF6';
        ctx.shadowBlur = 5;
        ctx.fillRect(boxX + 50, y - 20, boxWidth - 100, 40);
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = '#ffffff';
      }
      
      ctx.fillText(item.text, width / 2, y);
    });
    
    ctx.restore();
  }
  
  resume() {
    // Resume game music
    const playingState = this.game.stateManager.getState('playing');
    if (playingState && playingState.bgMusic) {
      playingState.bgMusic.play().catch(e => console.log('Game music resume failed:', e));
    }
    
    this.game.stateManager.popState();
  }
  
  restart() {
    // Clear the state stack to ensure clean restart
    this.game.stateManager.stateStack = [];
    
    // Also clear the current state to ensure we're starting fresh
    this.game.stateManager.currentState = null;
    
    // Force a fresh PlayingState instance to ensure clean state
    const freshPlayingState = new PlayingState(this.game);
    this.game.stateManager.registerState('playing', freshPlayingState);
    
    // Change to the fresh playing state
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