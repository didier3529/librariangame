import { Entity } from './Entity.js';

export class Shelf extends Entity {
  constructor(game, x, y, color, capacity = 6) {
    super(x, y, 64, 96);
    this.game = game;
    
    // Shelf properties
    this.color = color;
    this.capacity = capacity;
    this.volumeBlocks = new Array(capacity).fill(null); // Fixed-size array for volume blocks
    
    // Visual properties
    this.emptySlotGlow = 0;
    this.emptySlotGlowDirection = 1;
    
    // Collision box (solid obstacle) - covers entire shelf
    this.collisionBox = {
      offsetX: 0,
      offsetY: 0,
      width: 64,
      height: 96
    };
  }
  
  update(deltaTime) {
    // Update empty slot glow
    if (this.hasEmptySlots()) {
      // Check if player has matching volume blocks
      const state = this.game.stateManager.currentState;
      const playerHasMatchingVolumeBlock = state && state.player && 
        state.player.carriedVolumeBlocks.some(volumeBlock => volumeBlock.color === this.color);
      
      // Glow more intensely if player has matching volume blocks
      const glowSpeed = playerHasMatchingVolumeBlock ? 4 : 2;
      const maxGlow = playerHasMatchingVolumeBlock ? 1 : 0.7;
      const minGlow = playerHasMatchingVolumeBlock ? 0.5 : 0.3;
      
      this.emptySlotGlow += this.emptySlotGlowDirection * deltaTime * glowSpeed;
      if (this.emptySlotGlow >= maxGlow) {
        this.emptySlotGlow = maxGlow;
        this.emptySlotGlowDirection = -1;
      } else if (this.emptySlotGlow <= minGlow) {
        this.emptySlotGlow = minGlow;
        this.emptySlotGlowDirection = 1;
      }
    } else {
      this.emptySlotGlow = 0;
    }
  }
  
  render(ctx, interpolation) {
    const sprite = this.game.assetLoader.getImage('shelf');
    
    // Draw shelf sprite
    if (sprite) {
      this.game.renderer.drawSprite(
        sprite,
        this.x,
        this.y,
        this.width,
        this.height
      );
    } else {
      // Fallback rendering - MODERN DARK THEME
      // Main shelf body - dark charcoal
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Shelf boards - slightly lighter charcoal
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(this.x, this.y + 20, this.width, 4);
      ctx.fillRect(this.x, this.y + 44, this.width, 4);
      ctx.fillRect(this.x, this.y + 68, this.width, 4);
      
      // Modern highlights - subtle gray gradients
      ctx.fillStyle = '#404040';
      ctx.fillRect(this.x, this.y, this.width, 2); // Top highlight
      ctx.fillRect(this.x, this.y + 2, 2, this.height - 2); // Left highlight
      
      // Add subtle inner shadow effect
      ctx.fillStyle = '#0f0f0f';
      ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
    }
    
    // Draw color indicator
    ctx.save();
    ctx.fillStyle = this.getColorHex();
    ctx.fillRect(this.x, this.y - 8, this.width, 6);
    
    // Draw empty slot indicators
    if (this.hasEmptySlots()) {
      const slotsPerRow = 3;
      const rows = 2;
      const slotWidth = this.width / slotsPerRow;
      const slotHeight = 20;
      
      ctx.globalAlpha = this.emptySlotGlow * 0.5;
      ctx.strokeStyle = this.getColorHex();
      ctx.lineWidth = 2;
      
      let slotIndex = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < slotsPerRow; col++) {
          if (slotIndex < this.capacity && !this.volumeBlocks[slotIndex]) {
            const slotX = this.x + col * slotWidth + 4;
            const slotY = this.y + 24 + row * 24;
            
            ctx.strokeRect(slotX, slotY, slotWidth - 8, slotHeight);
            
            // Draw "+" in empty slot
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this.getColorHex();
            ctx.fillText('+', slotX + (slotWidth - 8) / 2, slotY + slotHeight / 2);
          }
          slotIndex++;
        }
      }
    }
    
    ctx.restore();
    
    // Draw volume blocks on shelf
    this.renderVolumeBlocks(ctx);
    
    // Draw capacity indicator
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${this.volumeBlocks.filter(v => v !== null).length}/${this.capacity}`,
      this.getCenterX(),
      this.y + this.height + 10
    );
    ctx.restore();
  }
  
  renderVolumeBlocks(ctx) {
    const slotsPerRow = 3;
    const slotWidth = this.width / slotsPerRow;
    
    this.volumeBlocks.forEach((volumeBlock, index) => {
      if (!volumeBlock) return;
      
      // Validate volume block state
      if (!volumeBlock.isShelved || volumeBlock.shelf !== this) {
        // Clean up invalid volume block reference silently
        this.volumeBlocks[index] = null;
        return;
      }
      
      const row = Math.floor(index / slotsPerRow);
      const col = index % slotsPerRow;
      
      // Position volume block on shelf
      volumeBlock.x = this.x + col * slotWidth + (slotWidth - volumeBlock.width) / 2;
      volumeBlock.y = this.y + 24 + row * 24;
      volumeBlock.render(ctx, 1);
    });
  }
  
  getColorHex() {
    const colors = {
      red: '#ff6b6b',      // Coral red
      blue: '#4ecdc4',     // Teal blue
      green: '#45b7d1',    // Sky blue
      yellow: '#f9ca24',   // Golden yellow
      purple: '#6c5ce7',   // Purple
      orange: '#fd79a8'    // Pink
    };
    return colors[this.color] || '#a0a0a0';
  }
  
  hasEmptySlots() {
    // Count actual volume blocks (not null entries)
    const volumeBlockCount = this.volumeBlocks.filter(volumeBlock => volumeBlock !== null).length;
    return volumeBlockCount < this.capacity;
  }
  
  addVolumeBlock(volumeBlock) {
    if (!this.hasEmptySlots() || volumeBlock.color !== this.color) {
      return false;
    }
    
    // Find first empty slot
    let slotIndex = 0;
    while (slotIndex < this.capacity && this.volumeBlocks[slotIndex]) {
      slotIndex++;
    }
    
    if (slotIndex < this.capacity) {
      this.volumeBlocks[slotIndex] = volumeBlock;
      volumeBlock.shelve(this);
      return true;
    }
    
    return false;
  }
  
  removeVolumeBlock(index) {
    if (index >= 0 && index < this.volumeBlocks.length && this.volumeBlocks[index]) {
      const volumeBlock = this.volumeBlocks[index];
      this.volumeBlocks[index] = null;
      volumeBlock.unshelve();
      return volumeBlock;
    }
    return null;
  }
  
  removeRandomVolumeBlock() {
    // Get indices of all volume blocks on shelf
    const volumeBlockIndices = [];
    for (let i = 0; i < this.volumeBlocks.length; i++) {
      if (this.volumeBlocks[i]) {
        volumeBlockIndices.push(i);
      }
    }
    
    if (volumeBlockIndices.length === 0) {
      return null;
    }
    
    // Remove random volume block
    const randomIndex = volumeBlockIndices[Math.floor(Math.random() * volumeBlockIndices.length)];
    return this.removeVolumeBlock(randomIndex);
  }
  
  getEmptySlotCount() {
    return this.capacity - this.volumeBlocks.filter(volumeBlock => volumeBlock !== null).length;
  }
}