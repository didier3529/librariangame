import { Entity } from './Entity.js';

export class VolumeBlock extends Entity {
  constructor(game, x, y, color) {
    super(x, y, 16, 20);
    this.game = game;
    
    // Volume block properties
    this.color = color; // Matches shelf color
    this.isHeld = false;
    this.isShelved = false;
    this.holder = null; // Entity holding this volume block
    this.shelf = null; // Shelf this volume block belongs to
    
    // Unique ID for tracking
    this.id = `volumeBlock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Physics
    this.friction = 0.9;
    this.bounceDecay = 0.7;
    this.gravity = 0;
    
    // Visual
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.sparkleTimer = 0;
    
    // Collision box
    this.collisionBox = {
      offsetX: 2,
      offsetY: 2,
      width: 12,
      height: 16
    };
    
    // Glow effect when on floor
    this.glowIntensity = 0;
    this.glowDirection = 1;
  }
  
  update(deltaTime) {
    // Skip physics for held volume blocks, but not shelved volume blocks
    // (shelved volume blocks might have been removed but not yet picked up)
    if (this.isHeld) {
      return;
    }
    
    // Apply friction to velocity
    this.vx *= this.friction;
    this.vy *= this.friction;
    
    // Store old position
    const oldX = this.x;
    const oldY = this.y;
    
    // Update position
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    
    // Check collision with shelves if not shelved
    if (!this.isShelved) {
      const state = this.game.stateManager.currentState;
      if (state && state.shelves) {
        for (const shelf of state.shelves) {
          // Check if volume block overlaps with shelf
          if (!(this.x + this.width < shelf.x || 
                this.x > shelf.x + shelf.width ||
                this.y + this.height < shelf.y || 
                this.y > shelf.y + shelf.height)) {
            // Volume block collided with shelf, bounce it away
            this.x = oldX;
            this.y = oldY;
            
            // Reverse velocity and reduce it
            this.vx = -this.vx * 0.5;
            this.vy = -this.vy * 0.5;
            
            // Add some randomness to prevent getting stuck
            this.vx += (Math.random() - 0.5) * 20;
            this.vy += (Math.random() - 0.5) * 20;
            
            break; // Only handle first collision
          }
        }
      }
    }
    
    // Update rotation
    this.rotation += this.rotationSpeed * deltaTime;
    this.rotationSpeed *= 0.95; // Slow down rotation
    
    // Sparkle effect
    this.sparkleTimer += deltaTime;
    
    // Glow pulsing
    this.glowIntensity += this.glowDirection * deltaTime * 2;
    if (this.glowIntensity >= 1) {
      this.glowIntensity = 1;
      this.glowDirection = -1;
    } else if (this.glowIntensity <= 0.3) {
      this.glowIntensity = 0.3;
      this.glowDirection = 1;
    }
    
    // Stop moving if velocity is very small
    if (Math.abs(this.vx) < 5 && Math.abs(this.vy) < 5) {
      this.vx = 0;
      this.vy = 0;
    }
  }
  
  render(ctx, interpolation) {
    if (!this.visible) return;
    
    const sprite = this.game.assetLoader.getImage('volumeBlock');
    
    // Draw glow effect if on floor
    if (!this.isHeld && !this.isShelved) {
      ctx.save();
      ctx.globalAlpha = this.glowIntensity * 0.5;
      ctx.fillStyle = this.getColorHex();
      ctx.beginPath();
      ctx.arc(
        this.getCenterX(),
        this.getCenterY(),
        20,
        0,
        Math.PI * 2
      );
      ctx.filter = 'blur(8px)';
      ctx.fill();
      ctx.restore();
      
      // Sparkle effect
      if (Math.sin(this.sparkleTimer * 5) > 0.5) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        const sparkleX = this.x + Math.random() * this.width;
        const sparkleY = this.y + Math.random() * this.height;
        ctx.fillRect(sparkleX - 1, sparkleY - 1, 2, 2);
        ctx.restore();
      }
    }
    
    // Draw volume block sprite (or fallback)
    if (sprite) {
      this.game.renderer.drawSprite(
        sprite,
        this.x,
        this.y,
        this.width,
        this.height,
        { 
          rotation: this.rotation,
          alpha: this.isHeld ? 0.8 : 1
        }
      );
    } else {
      // Fallback rendering
      ctx.save();
      ctx.fillStyle = this.getColorHex();
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      ctx.restore();
    }
    
    // Draw color indicator
    ctx.save();
    ctx.fillStyle = this.getColorHex();
    ctx.fillRect(this.x + 4, this.y + 2, this.width - 8, 4);
    ctx.restore();
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
  
  pickup(holder) {
    this.isHeld = true;
    this.holder = holder;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
  }
  
  drop(x, y, throwVelocity = null) {
    this.isHeld = false;
    this.holder = null;
    this.x = x;
    this.y = y;
    
    if (throwVelocity) {
      this.vx = throwVelocity.x;
      this.vy = throwVelocity.y;
      this.rotationSpeed = (Math.random() - 0.5) * 10;
    }
  }
  
  shelve(shelf = null) {
    this.isShelved = true;
    this.isHeld = false;
    this.holder = null;
    this.shelf = shelf;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
  }
  
  unshelve() {
    this.isShelved = false;
    this.shelf = null;
  }
  
  getStateString() {
    if (this.isShelved) return 'shelved';
    if (this.isHeld) return `held by ${this.holder?.constructor.name || 'unknown'}`;
    return 'on floor';
  }
}