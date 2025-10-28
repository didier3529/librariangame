import { Entity } from './Entity.js';

export class Kid extends Entity {
  constructor(game, x, y, aggressionLevel = 1) {
    super(x, y, 48, 60); // Made bigger for better visibility
    this.game = game;
    this.aggressionLevel = aggressionLevel; // 1 = easy, 2 = normal, 3 = aggressive
    
    // Safety check: ensure we don't spawn inside shelves
    this.ensureSafeSpawnPosition();
    
    // Randomly select sprite type (1, 2, or 3)
    this.spriteType = Math.floor(Math.random() * 3) + 1;
    
    // Movement properties - scale with aggression
    this.speed = aggressionLevel === 1 ? 70 : aggressionLevel === 2 ? 80 : 90;
    this.fleeSpeed = aggressionLevel === 1 ? 100 : aggressionLevel === 2 ? 110 : 120;
    this.direction = Math.random() * Math.PI * 2; // Random initial direction
    this.directionChangeTimer = 0;
    this.directionChangeInterval = 2; // Change direction every 2 seconds
    
    // Behavior states
    this.state = 'wandering'; // wandering, fleeing, stealing
    this.target = null; // Target shelf or escape point
    
    // Volume block carrying - scale with aggression
    this.carriedVolumeBlock = null;
    this.volumeBlockStealCooldown = 0;
    this.volumeBlockStealCooldownTime = aggressionLevel === 1 ? 2.0 : aggressionLevel === 2 ? 1.5 : 1.0;
    this.dropVolumeBlockTimer = 0; // Timer for when to drop carried volume block
    this.grabDelay = 0; // Delay before grabbing volume block from shelf
    this.grabDelayTime = aggressionLevel === 1 ? 1.0 : aggressionLevel === 2 ? 0.5 : 0.2;
    this.dropVolumeBlockMinTime = aggressionLevel === 1 ? 4 : aggressionLevel === 2 ? 3 : 2;
    this.dropVolumeBlockMaxTime = aggressionLevel === 1 ? 6 : aggressionLevel === 2 ? 4 : 3;
    
    // Detection ranges
    this.shelfDetectionRange = 160; // 5 tiles - increased for better shelf seeking
    this.playerDetectionRange = 120; // 3.75 tiles
    
    // Animation
    this.animationFrame = 0;
    this.animationTimer = 0;
    this.facing = 'left'; // Kids face left by default
    
    // Stuck detection
    this.stuckTimer = 0;
    this.isMoving = false;
    
    // Sound effects
    this.hasPlayedLaughSound = false; // Prevent multiple laugh sounds per flee
  }
  
  ensureSafeSpawnPosition() {
    const state = this.game.stateManager.currentState;
    if (!state || !state.shelves) return;
    
    // Check if we're colliding with any shelf
    for (const shelf of state.shelves) {
      if (this.checkCollision(this.x, this.y, shelf)) {
        console.log(`[SPAWN SAFETY] Kid spawned inside shelf, moving to safe position`);
        // Move to a safe position away from shelves
        this.x = 30; // Move to left edge
        this.y = 30; // Move to top edge
        break;
      }
    }
  }
  
  update(deltaTime) {
    // Update cooldowns
    if (this.volumeBlockStealCooldown > 0) {
      this.volumeBlockStealCooldown -= deltaTime;
    }
    
    // State machine
    switch (this.state) {
      case 'wandering':
        this.updateWandering(deltaTime);
        break;
      case 'fleeing':
        this.updateFleeing(deltaTime);
        break;
      case 'stealing':
        this.updateStealing(deltaTime);
        break;
    }
    
    // Update animation
    this.isMoving = this.vx !== 0 || this.vy !== 0;
    if (this.isMoving) {
      this.animationTimer += deltaTime;
      if (this.animationTimer >= 0.2) {
        this.animationFrame = (this.animationFrame + 1) % 2; // Alternate between 2 frames
        this.animationTimer = 0;
      }
    } else {
      this.animationFrame = 0;
      this.animationTimer = 0;
    }
    
    // Update facing direction (only left/right for kids)
    if (Math.abs(this.vx) > 0.1) {
      this.facing = this.vx > 0 ? 'right' : 'left';
    }
    
    // Check if stuck (not moving for too long)
    if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1) {
      this.stuckTimer += deltaTime;
      if (this.stuckTimer > 1.0) { // Reduced to 1 second for faster detection
        console.log(`[KID DEBUG] Kid appears stuck at position:`, {x: this.x, y: this.y, vx: this.vx, vy: this.vy, direction: this.direction});
        this.direction = Math.random() * Math.PI * 2; // Random direction
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0; // Reset if moving
    }
    
    // Update volume block drop timer if carrying
    if (this.carriedVolumeBlock) {
      this.dropVolumeBlockTimer += deltaTime;
      // Drop volume block after time based on aggression level
      if (this.dropVolumeBlockTimer > this.dropVolumeBlockMinTime + Math.random() * (this.dropVolumeBlockMaxTime - this.dropVolumeBlockMinTime)) {
        this.dropVolumeBlock();
        this.dropVolumeBlockTimer = 0;
        this.state = 'wandering'; // Go find more volume blocks to mess with
      }
    }
    
    // Keep within world bounds
    const state = this.game.stateManager.currentState;
    if (state && state.worldWidth && state.worldHeight) {
      this.x = Math.max(0, Math.min(state.worldWidth - this.width, this.x));
      this.y = Math.max(0, Math.min(state.worldHeight - this.height, this.y));
    }
  }
  
  updateWandering(deltaTime) {
    const state = this.game.stateManager.currentState;
    if (!state) return;
    
    const player = state.player;
    const shelves = state.shelves || [];
    
    // Check for player proximity
    if (player) {
      const distToPlayer = this.getDistanceTo(player);
      if (distToPlayer < this.playerDetectionRange) {
        // Track kid being repelled
        if (this.state !== 'fleeing') {
          this.game.gameData.kidsRepelled++;
        }
        this.state = 'fleeing';
        this.playLaughingSound();
        return;
      }
    }
    
    // Look for shelves with volume blocks to steal (only check nearby shelves)
    if (!this.carriedVolumeBlock && this.volumeBlockStealCooldown <= 0) {
      for (const shelf of shelves) {
        // Quick bounds check before expensive distance calculation
        if (Math.abs(shelf.x - this.x) > this.shelfDetectionRange || 
            Math.abs(shelf.y - this.y) > this.shelfDetectionRange) {
          continue;
        }
        
        const distToShelf = this.getDistanceTo(shelf);
        if (distToShelf < this.shelfDetectionRange && shelf.volumeBlocks.some(v => v !== null)) {
          this.target = shelf;
          this.state = 'stealing';
          return;
        }
      }
    }
    
    // If not carrying a volume block and cooldown is up, actively seek nearest shelf
    if (!this.carriedVolumeBlock && this.volumeBlockStealCooldown <= 0 && shelves.length > 0) {
      // Find nearest shelf with volume blocks
      let nearestShelf = null;
      let nearestDist = Infinity;
      
      for (const shelf of shelves) {
        if (shelf.volumeBlocks.some(v => v !== null)) {
          const dist = this.getDistanceTo(shelf);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestShelf = shelf;
          }
        }
      }
      
      if (nearestShelf) {
        // Move towards nearest shelf
        const dx = nearestShelf.getCenterX() - this.getCenterX();
        const dy = nearestShelf.getCenterY() - this.getCenterY();
        this.direction = Math.atan2(dy, dx);
      } else {
        // No shelves with volume blocks, move toward center
        this.directionChangeTimer -= deltaTime;
        if (this.directionChangeTimer <= 0) {
          const centerX = state.worldWidth / 2;
          const centerY = state.worldHeight / 2;
          const dx = centerX - this.getCenterX();
          const dy = centerY - this.getCenterY();
          this.direction = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
          this.directionChangeTimer = 1.0; // Check more frequently
        }
      }
    } else {
      // Carrying volume block - move around to spread chaos
      this.directionChangeTimer -= deltaTime;
      if (this.directionChangeTimer <= 0) {
        // Move away from where we picked up the volume block
        if (this.target) {
          const dx = this.getCenterX() - this.target.getCenterX();
          const dy = this.getCenterY() - this.target.getCenterY();
          this.direction = Math.atan2(dy, dx) + (Math.random() - 0.5) * Math.PI / 2;
        } else {
          this.direction = Math.random() * Math.PI * 2;
        }
        this.directionChangeTimer = 1.5;
      }
    }
    
    // Move in current direction
    this.vx = Math.cos(this.direction) * this.speed;
    this.vy = Math.sin(this.direction) * this.speed;
    
    // When hitting edges, turn toward center where shelves are
    if (state.worldWidth && state.worldHeight) {
      const margin = 20; // Increased margin for larger character
      if (this.x <= margin || this.x >= state.worldWidth - this.width - margin ||
          this.y <= margin || this.y >= state.worldHeight - this.height - margin) {
        // Turn toward center
        const centerX = state.worldWidth / 2;
        const centerY = state.worldHeight / 2;
        const dx = centerX - this.getCenterX();
        const dy = centerY - this.getCenterY();
        this.direction = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
      }
    }
    
    // Apply movement with collision detection
    this.applyMovement(deltaTime);
  }
  
  updateFleeing(deltaTime) {
    const state = this.game.stateManager.currentState;
    if (!state) return;
    
    const player = state.player;
    
    // If no player or player is far, just run in a random direction briefly
    if (!player) {
      // Run away from where we were for a bit
      this.vx = Math.cos(this.direction) * this.fleeSpeed;
      this.vy = Math.sin(this.direction) * this.fleeSpeed;
      this.applyMovement(deltaTime);
      
      // Stop fleeing after 1 second
      if (!this.fleeTimer) this.fleeTimer = 1;
      this.fleeTimer -= deltaTime;
      if (this.fleeTimer <= 0) {
        this.fleeTimer = null;
        this.state = 'wandering';
        this.hasPlayedLaughSound = false; // Reset for next flee
      }
      return;
    }
    
    const distToPlayer = this.getDistanceTo(player);
    
    // Stop fleeing if far enough away
    if (distToPlayer > this.playerDetectionRange * 1.5) {
      this.state = 'wandering';
      this.hasPlayedLaughSound = false; // Reset for next flee
      return;
    }
    
    // Run away from player
    const dx = this.getCenterX() - player.getCenterX();
    const dy = this.getCenterY() - player.getCenterY();
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0) {
      this.vx = (dx / dist) * this.fleeSpeed;
      this.vy = (dy / dist) * this.fleeSpeed;
    }
    
    // Apply movement with collision detection
    this.applyMovement(deltaTime);
    
    // Drop volume block if carrying one (scared)
    if (this.carriedVolumeBlock && Math.random() < 2.0 * deltaTime) { // 200% chance per second (almost immediately)
      this.dropVolumeBlock();
    }
  }
  
  updateStealing(deltaTime) {
    if (!this.target || this.carriedVolumeBlock) {
      this.state = 'wandering';
      return;
    }
    
    const state = this.game.stateManager.currentState;
    const player = state ? state.player : null;
    
    // Check for player proximity
    if (player) {
      const distToPlayer = this.getDistanceTo(player);
      if (distToPlayer < this.playerDetectionRange) {
        // Track kid being repelled
        if (this.state !== 'fleeing') {
          this.game.gameData.kidsRepelled++;
        }
        this.state = 'fleeing';
        this.playLaughingSound();
        return;
      }
    }
    
    // Move towards target shelf
    const dx = this.target.getCenterX() - this.getCenterX();
    const dy = this.target.getCenterY() - this.getCenterY();
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Use rectangle-based proximity check instead of center distance
    if (!this.isNearShelf(this.target, 5)) { // 5 pixels - must be touching
      // Move towards shelf
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
      // Apply movement with collision detection
      this.applyMovement(deltaTime);
    } else {
      // Near shelf (any side), wait a moment then steal a volume block
      if (this.grabDelay <= 0) {
        this.grabDelay = this.grabDelayTime; // Grab delay based on aggression
      }
      
      this.grabDelay -= deltaTime;
      
      if (this.grabDelay <= 0) {
        const volumeBlock = this.target.removeRandomVolumeBlock();
        if (volumeBlock) {
        // Volume block has already been removed from shelf and unshelved
        // 50/50 chance: knock to floor or carry away
        if (Math.random() < 0.5) {
          // Just knock it to the floor - drop it close to the shelf
          // Volume block is already unshelved by removeRandomVolumeBlock
          const shelf = this.target;
          
          // Drop volume blocks around the shelf they came from
          const dropRadius = 150; // Increased radius around shelf for volume block placement
          const randomAngle = Math.random() * Math.PI * 2;
          const randomDistance = Math.random() * dropRadius;
          
          volumeBlock.x = shelf.getCenterX() + Math.cos(randomAngle) * randomDistance - volumeBlock.width / 2;
          volumeBlock.y = shelf.getCenterY() + Math.sin(randomAngle) * randomDistance - volumeBlock.height / 2;
          volumeBlock.vx = (Math.random() - 0.5) * 60; // Small random velocity
          volumeBlock.vy = (Math.random() - 0.5) * 60;
          volumeBlock.visible = true; // Ensure volume block is visible
        } else {
          // Pick it up and carry it
          this.carriedVolumeBlock = volumeBlock;
          volumeBlock.isHeld = true;
          volumeBlock.holder = this;
          volumeBlock.visible = true; // Ensure volume block is visible
        }
          this.volumeBlockStealCooldown = this.volumeBlockStealCooldownTime;
          // Flee after stealing to create chaos elsewhere
          this.state = 'fleeing';
        } else {
          // No volume blocks to steal, go back to wandering
          this.state = 'wandering';
          this.volumeBlockStealCooldown = 1; // Short cooldown before trying again
        }
        this.target = null;
        this.grabDelay = 0; // Reset grab delay
      }
    }
  }
  
  render(ctx, interpolation) {
    // Get appropriate sprite based on sprite type and animation state
    let sprite;
    const spritePrefix = `kid${this.spriteType}`;
    
    if (this.isMoving) {
      // Use walking sprite when moving
      sprite = this.animationFrame === 0 
        ? this.game.assetLoader.getImage(`${spritePrefix}Stand`)
        : this.game.assetLoader.getImage(`${spritePrefix}Walk`);
    } else {
      // Use standing sprite when stationary
      sprite = this.game.assetLoader.getImage(`${spritePrefix}Stand`);
    }
    
    // Fallback to placeholder
    if (!sprite) {
      sprite = this.game.assetLoader.getImage('kid');
    }
    
    if (sprite) {
      // Calculate proper dimensions to maintain aspect ratio
      const targetHeight = this.height; // Keep height consistent
      const aspectRatio = sprite.width / sprite.height;
      const targetWidth = targetHeight * aspectRatio;
      
      // Center the sprite horizontally within the entity bounds
      const xOffset = (this.width - targetWidth) / 2;
      
      // Draw sprite with direction flipping and proper aspect ratio
      this.game.renderer.drawSprite(
        sprite,
        this.x + xOffset,
        this.y,
        targetWidth,
        targetHeight,
        {
          flipX: this.facing === 'right' // Flip when facing right
        }
      );
    } else {
      // Fallback rendering with aggression-based colors
      ctx.save();
      
      // Different colors based on aggression level
      if (this.aggressionLevel === 1) {
        ctx.fillStyle = '#ffa5a5'; // Light pink for easy kids
      } else if (this.aggressionLevel === 2) {
        ctx.fillStyle = '#ff6b6b'; // Normal red for normal kids
      } else {
        ctx.fillStyle = '#cc0000'; // Dark red for aggressive kids
      }
      
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Draw simple face
      ctx.fillStyle = '#000';
      ctx.fillRect(this.x + 6, this.y + 8, 4, 4); // Left eye
      ctx.fillRect(this.x + 14, this.y + 8, 4, 4); // Right eye
      
      // Mischievous smile (bigger for more aggressive)
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const smileRadius = 3 + this.aggressionLevel;
      ctx.arc(this.getCenterX(), this.y + 20, smileRadius, 0, Math.PI);
      ctx.stroke();
      
      // Add aggression indicators
      if (this.aggressionLevel >= 2) {
        // Angry eyebrows for normal/aggressive kids
        ctx.beginPath();
        ctx.moveTo(this.x + 4, this.y + 6);
        ctx.lineTo(this.x + 10, this.y + 8);
        ctx.moveTo(this.x + 20, this.y + 6);
        ctx.lineTo(this.x + 14, this.y + 8);
        ctx.stroke();
      }
      
      if (this.aggressionLevel === 3) {
        // Speed lines for aggressive kids
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x - 5, this.y + 10);
        ctx.lineTo(this.x - 2, this.y + 10);
        ctx.moveTo(this.x - 5, this.y + 16);
        ctx.lineTo(this.x - 2, this.y + 16);
        ctx.moveTo(this.x - 5, this.y + 22);
        ctx.lineTo(this.x - 2, this.y + 22);
        ctx.stroke();
      }
      
      ctx.restore();
    }
    
    // Draw carried volume block above head
    if (this.carriedVolumeBlock) {
      // Center volume block above the kid's actual sprite (accounting for aspect ratio)
      this.carriedVolumeBlock.x = this.getCenterX() - this.carriedVolumeBlock.width / 2;
      this.carriedVolumeBlock.y = this.y - this.carriedVolumeBlock.height - 4;
      this.carriedVolumeBlock.render(ctx, interpolation);
    }
  }
  
  dropVolumeBlock() {
    if (this.carriedVolumeBlock) {
      const volumeBlock = this.carriedVolumeBlock;
      volumeBlock.isHeld = false;
      volumeBlock.holder = null;
      volumeBlock.isShelved = false; // CRITICAL: Ensure volume block is marked as not shelved
      volumeBlock.visible = true; // Ensure volume block remains visible
      
      // Drop volume blocks close to where they were picked up (near the shelf)
      const state = this.game.stateManager.currentState;
      
      // If we have a target shelf (where we picked up the volume block), drop near it
      let dropX, dropY;
      if (this.target) {
        const shelf = this.target;
        // Drop volume blocks around the shelf they came from
        const dropRadius = 180; // Increased radius around shelf for volume block placement
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDistance = Math.random() * dropRadius;
        
        dropX = shelf.getCenterX() + Math.cos(randomAngle) * randomDistance - volumeBlock.width / 2;
        dropY = shelf.getCenterY() + Math.sin(randomAngle) * randomDistance - volumeBlock.height / 2;
      } else {
        // Fallback: drop near current position
        const dropRadius = 60;
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDistance = Math.random() * dropRadius;
        
        dropX = this.getCenterX() + Math.cos(randomAngle) * randomDistance - volumeBlock.width / 2;
        dropY = this.getCenterY() + Math.sin(randomAngle) * randomDistance - volumeBlock.height / 2;
      }
      
      // Ensure volume block is dropped within playable bounds
      if (state && state.worldWidth && state.worldHeight) {
        // Keep volume block at least 20 pixels from edges
        const margin = 20;
        dropX = Math.max(margin, Math.min(state.worldWidth - volumeBlock.width - margin, dropX));
        dropY = Math.max(margin, Math.min(state.worldHeight - volumeBlock.height - margin, dropY));
      }
      
      volumeBlock.x = dropX;
      volumeBlock.y = dropY;
      
      // Give volume block a small random velocity
      volumeBlock.vx = (Math.random() - 0.5) * 40;
      volumeBlock.vy = (Math.random() - 0.5) * 40;
      
      this.carriedVolumeBlock = null;
    }
  }
  
  getDistanceTo(entity) {
    const dx = this.getCenterX() - entity.getCenterX();
    const dy = this.getCenterY() - entity.getCenterY();
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  applyMovement(deltaTime) {
    const state = this.game.stateManager.currentState;
    if (!state || !state.shelves) {
      // No collision detection available, just move
      this.x += this.vx * deltaTime;
      this.y += this.vy * deltaTime;
      return;
    }
    
    // Calculate new position
    const newX = this.x + this.vx * deltaTime;
    const newY = this.y + this.vy * deltaTime;
    
    // Check collisions with shelves (only nearby ones)
    let canMoveX = true;
    let canMoveY = true;
    const checkRadius = 150; // Only check shelves within this radius - increased for larger character
    
    for (const shelf of state.shelves) {
      // Quick bounds check
      if (Math.abs(shelf.x - this.x) > checkRadius || 
          Math.abs(shelf.y - this.y) > checkRadius) {
        continue;
      }
      
      // Check X movement
      if (canMoveX && this.checkCollision(newX, this.y, shelf)) {
        canMoveX = false;
      }
      // Check Y movement
      if (canMoveY && this.checkCollision(this.x, newY, shelf)) {
        canMoveY = false;
      }
      
      // Early exit if both movements are blocked
      if (!canMoveX && !canMoveY) {
        break;
      }
    }
    
    // Apply movement if no collision
    if (canMoveX) {
      this.x = newX;
    } else {
      // Bounce off in opposite direction with less aggressive response
      console.log(`[MOVEMENT DEBUG] X movement blocked at position:`, {x: this.x, y: this.y, newX, vx: this.vx});
      this.vx = -this.vx * 0.3;
      if (this.state === 'wandering') {
        this.direction = Math.PI - this.direction + (Math.random() - 0.5) * 0.5;
      }
    }
    
    if (canMoveY) {
      this.y = newY;
    } else {
      // Bounce off in opposite direction with less aggressive response
      console.log(`[MOVEMENT DEBUG] Y movement blocked at position:`, {x: this.x, y: this.y, newY, vy: this.vy});
      this.vy = -this.vy * 0.3;
      if (this.state === 'wandering') {
        this.direction = -this.direction + (Math.random() - 0.5) * 0.5;
      }
    }
    
    // If both X and Y movement are blocked, try to get unstuck
    if (!canMoveX && !canMoveY && this.state === 'wandering') {
      this.direction = Math.random() * Math.PI * 2;
      this.vx = Math.cos(this.direction) * this.speed * 0.5;
      this.vy = Math.sin(this.direction) * this.speed * 0.5;
    }
  }
  
  isNearShelf(shelf, distance) {
    // Check if kid is within distance of any edge of the shelf
    const kidLeft = this.x;
    const kidRight = this.x + this.width;
    const kidTop = this.y;
    const kidBottom = this.y + this.height;
    
    const shelfLeft = shelf.x;
    const shelfRight = shelf.x + shelf.width;
    const shelfTop = shelf.y;
    const shelfBottom = shelf.y + shelf.height;
    
    // Expand shelf bounds by distance
    const expandedLeft = shelfLeft - distance;
    const expandedRight = shelfRight + distance;
    const expandedTop = shelfTop - distance;
    const expandedBottom = shelfBottom + distance;
    
    // Check if kid overlaps with expanded bounds
    return !(kidLeft >= expandedRight || 
             kidRight <= expandedLeft || 
             kidTop >= expandedBottom || 
             kidBottom <= expandedTop);
  }
  
  checkCollision(x, y, entity) {
    // Check if entity has a collision box
    if (!entity.collisionBox) {
      return false;
    }
    
    // Calculate kid's bounds at new position
    const kidLeft = x;
    const kidRight = x + this.width;
    const kidTop = y;
    const kidBottom = y + this.height;
    
    // Calculate entity's collision bounds
    const entityLeft = entity.x + entity.collisionBox.offsetX;
    const entityRight = entityLeft + entity.collisionBox.width;
    const entityTop = entity.y + entity.collisionBox.offsetY;
    const entityBottom = entityTop + entity.collisionBox.height;
    
    // Check for overlap
    return !(kidLeft >= entityRight || 
             kidRight <= entityLeft || 
             kidTop >= entityBottom || 
             kidBottom <= entityTop);
  }
  
  getUnstuck() {
    const state = this.game.stateManager.currentState;
    if (!state) return;
    
    // If near edges, move towards center
    if (state.worldWidth && state.worldHeight) {
      const centerX = state.worldWidth / 2;
      const centerY = state.worldHeight / 2;
      
      // Calculate direction towards center
      const dx = centerX - this.x;
      const dy = centerY - this.y;
      this.direction = Math.atan2(dy, dx);
      
      // Add some randomness
      this.direction += (Math.random() - 0.5) * Math.PI / 4;
      
      // Force movement
      this.vx = Math.cos(this.direction) * this.speed;
      this.vy = Math.sin(this.direction) * this.speed;
      
      // Try to teleport slightly if really stuck
      if (this.x < 50 || this.x > state.worldWidth - 50 - this.width ||
          this.y < 50 || this.y > state.worldHeight - 50 - this.height) {
        this.x = Math.max(100, Math.min(state.worldWidth - 100 - this.width, this.x));
        this.y = Math.max(100, Math.min(state.worldHeight - 100 - this.height, this.y));
      }
    }
    
    // Reset state to wandering
    this.state = 'wandering';
    this.target = null;
  }
  
  playLaughingSound() {
    // Only play if we haven't already played it for this flee session
    if (!this.hasPlayedLaughSound) {
      // Select laugh sound based on sprite type
      const laughFile = `/kid_laughing_${this.spriteType}.mp3`;
      const laughSound = new Audio(laughFile);
      laughSound.volume = 0.5;
      laughSound.play().catch(e => console.log('Kid laugh sound play failed:', e));
      this.hasPlayedLaughSound = true;
    }
  }
}