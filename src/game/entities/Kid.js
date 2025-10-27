import { Entity } from './Entity.js';

export class Kid extends Entity {
  constructor(game, x, y, aggressionLevel = 1) {
    super(x, y, 48, 60); // Made bigger for better visibility
    this.game = game;
    this.aggressionLevel = aggressionLevel; // 1 = easy, 2 = normal, 3 = aggressive
    
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
    
    // Book carrying - scale with aggression
    this.carriedBook = null;
    this.bookStealCooldown = 0;
    this.bookStealCooldownTime = aggressionLevel === 1 ? 4.0 : aggressionLevel === 2 ? 2.5 : 1.5;
    this.dropBookTimer = 0; // Timer for when to drop carried book
    this.grabDelay = 0; // Delay before grabbing book from shelf
    this.grabDelayTime = aggressionLevel === 1 ? 1.0 : aggressionLevel === 2 ? 0.5 : 0.2;
    this.dropBookMinTime = aggressionLevel === 1 ? 8 : aggressionLevel === 2 ? 5 : 3;
    this.dropBookMaxTime = aggressionLevel === 1 ? 10 : aggressionLevel === 2 ? 8 : 5;
    
    // Detection ranges
    this.shelfDetectionRange = 160; // 5 tiles - increased for better shelf seeking
    this.playerDetectionRange = 120; // 3.75 tiles
    
    // Animation
    this.animationFrame = 0;
    this.animationTimer = 0;
    this.facing = 'left'; // Kids face left by default
    this.isMoving = false;
    
    // Sound effects
    this.hasPlayedLaughSound = false; // Prevent multiple laugh sounds per flee
  }
  
  update(deltaTime) {
    // Update cooldowns
    if (this.bookStealCooldown > 0) {
      this.bookStealCooldown -= deltaTime;
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
    
    // Update book drop timer if carrying
    if (this.carriedBook) {
      this.dropBookTimer += deltaTime;
      // Drop book after time based on aggression level
      if (this.dropBookTimer > this.dropBookMinTime + Math.random() * (this.dropBookMaxTime - this.dropBookMinTime)) {
        this.dropBook();
        this.dropBookTimer = 0;
        this.state = 'wandering'; // Go find more books to mess with
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
    
    // Look for shelves with books to steal (only check nearby shelves)
    if (!this.carriedBook && this.bookStealCooldown <= 0) {
      for (const shelf of shelves) {
        // Quick bounds check before expensive distance calculation
        if (Math.abs(shelf.x - this.x) > this.shelfDetectionRange || 
            Math.abs(shelf.y - this.y) > this.shelfDetectionRange) {
          continue;
        }
        
        const distToShelf = this.getDistanceTo(shelf);
        if (distToShelf < this.shelfDetectionRange && shelf.books.some(b => b !== null)) {
          this.target = shelf;
          this.state = 'stealing';
          return;
        }
      }
    }
    
    // If not carrying a book and cooldown is up, actively seek nearest shelf
    if (!this.carriedBook && this.bookStealCooldown <= 0 && shelves.length > 0) {
      // Find nearest shelf with books
      let nearestShelf = null;
      let nearestDist = Infinity;
      
      for (const shelf of shelves) {
        if (shelf.books.some(b => b !== null)) {
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
        // No shelves with books, move toward center
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
      // Carrying book - move around to spread chaos
      this.directionChangeTimer -= deltaTime;
      if (this.directionChangeTimer <= 0) {
        // Move away from where we picked up the book
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
    
    // Drop book if carrying one (scared)
    if (this.carriedBook && Math.random() < 2.0 * deltaTime) { // 200% chance per second (almost immediately)
      this.dropBook();
    }
  }
  
  updateStealing(deltaTime) {
    if (!this.target || this.carriedBook) {
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
      // Near shelf (any side), wait a moment then steal a book
      if (this.grabDelay <= 0) {
        this.grabDelay = this.grabDelayTime; // Grab delay based on aggression
      }
      
      this.grabDelay -= deltaTime;
      
      if (this.grabDelay <= 0) {
        const book = this.target.removeRandomBook();
        if (book) {
        // Book has already been removed from shelf and unshelved
        // 50/50 chance: knock to floor or carry away
        if (Math.random() < 0.5) {
          // Just knock it to the floor
          // Book is already unshelved by removeRandomBook
          // Drop book outside of shelf bounds to prevent it landing inside
          const dropDirection = Math.random() < 0.5 ? -1 : 1; // Left or right
          book.x = dropDirection < 0 ? 
            this.target.x - book.width - 10 : // Drop to left of shelf
            this.target.x + this.target.width + 10; // Drop to right of shelf
          book.y = this.target.y + this.target.height / 2; // Middle height
          book.vx = dropDirection * (50 + Math.random() * 50); // Push away from shelf
          book.vy = Math.random() * 50 + 50;
          book.visible = true; // Ensure book is visible
        } else {
          // Pick it up and carry it
          this.carriedBook = book;
          book.isHeld = true;
          book.holder = this;
          book.visible = true; // Ensure book is visible
        }
          this.bookStealCooldown = this.bookStealCooldownTime;
          // Flee after stealing to create chaos elsewhere
          this.state = 'fleeing';
        } else {
          // No books to steal, go back to wandering
          this.state = 'wandering';
          this.bookStealCooldown = 1; // Short cooldown before trying again
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
    
    // Draw carried book above head
    if (this.carriedBook) {
      // Center book above the kid's actual sprite (accounting for aspect ratio)
      this.carriedBook.x = this.getCenterX() - this.carriedBook.width / 2;
      this.carriedBook.y = this.y - this.carriedBook.height - 4;
      this.carriedBook.render(ctx, interpolation);
    }
  }
  
  dropBook() {
    if (this.carriedBook) {
      const book = this.carriedBook;
      book.isHeld = false;
      book.holder = null;
      book.isShelved = false; // CRITICAL: Ensure book is marked as not shelved
      book.visible = true; // Ensure book remains visible
      
      // Check if we're near any shelf and adjust drop position
      const state = this.game.stateManager.currentState;
      let dropX = this.x + (this.width - book.width) / 2;
      let dropY = this.y + this.height;
      
      if (state && state.shelves) {
        // Check against ALL shelves, not just the first collision
        const safetyMargin = 30; // Increased margin for safety
        
        for (const shelf of state.shelves) {
          // Check if the book's bounding box would overlap with shelf (with margin)
          const bookLeft = dropX;
          const bookRight = dropX + book.width;
          const bookTop = dropY;
          const bookBottom = dropY + book.height;
          
          const shelfLeft = shelf.x - safetyMargin;
          const shelfRight = shelf.x + shelf.width + safetyMargin;
          const shelfTop = shelf.y - safetyMargin;
          const shelfBottom = shelf.y + shelf.height + safetyMargin;
          
          // Check for overlap
          if (!(bookLeft > shelfRight || bookRight < shelfLeft || 
                bookTop > shelfBottom || bookBottom < shelfTop)) {
            // Book would overlap with shelf, find safe position
            
            // Calculate distances to each side of the shelf
            const leftDist = Math.abs(this.getCenterX() - shelf.x);
            const rightDist = Math.abs(this.getCenterX() - (shelf.x + shelf.width));
            const topDist = Math.abs(this.getCenterY() - shelf.y);
            const bottomDist = Math.abs(this.getCenterY() - (shelf.y + shelf.height));
            
            // Find the closest edge and drop book there
            const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
            
            if (minDist === leftDist) {
              dropX = shelf.x - book.width - safetyMargin;
            } else if (minDist === rightDist) {
              dropX = shelf.x + shelf.width + safetyMargin;
            } else if (minDist === topDist) {
              dropY = shelf.y - book.height - safetyMargin;
            } else {
              dropY = shelf.y + shelf.height + safetyMargin;
            }
          }
        }
      }
      
      // Ensure book is dropped within playable bounds
      if (state && state.worldWidth && state.worldHeight) {
        // Keep book at least 50 pixels from edges
        const margin = 50;
        dropX = Math.max(margin, Math.min(state.worldWidth - book.width - margin, dropX));
        dropY = Math.max(margin, Math.min(state.worldHeight - book.height - margin, dropY));
      }
      
      book.x = dropX;
      book.y = dropY;
      
      // Give book a little random velocity, but away from shelves
      // Start with small random velocity
      book.vx = (Math.random() - 0.5) * 50; // Reduced from 100
      book.vy = Math.random() * 25 + 25; // Reduced from 50+50
      
      // If we adjusted position due to a shelf, add velocity away from it
      if (state && state.shelves) {
        for (const shelf of state.shelves) {
          const distToShelf = Math.sqrt(
            Math.pow(dropX + book.width/2 - (shelf.x + shelf.width/2), 2) +
            Math.pow(dropY + book.height/2 - (shelf.y + shelf.height/2), 2)
          );
          
          if (distToShelf < 100) { // If close to a shelf
            // Add velocity away from shelf center
            const awayX = (dropX + book.width/2) - (shelf.x + shelf.width/2);
            const awayY = (dropY + book.height/2) - (shelf.y + shelf.height/2);
            const awayDist = Math.sqrt(awayX * awayX + awayY * awayY);
            
            if (awayDist > 0) {
              book.vx += (awayX / awayDist) * 30;
              book.vy += (awayY / awayDist) * 30;
            }
          }
        }
      }
      
      this.carriedBook = null;
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
      this.vx = -this.vx * 0.3;
      if (this.state === 'wandering') {
        this.direction = Math.PI - this.direction + (Math.random() - 0.5) * 0.5;
      }
    }
    
    if (canMoveY) {
      this.y = newY;
    } else {
      // Bounce off in opposite direction with less aggressive response
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