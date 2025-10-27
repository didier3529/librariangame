import { Entity } from './Entity.js';

export class Shelf extends Entity {
  constructor(game, x, y, color, capacity = 6) {
    super(x, y, 64, 96);
    this.game = game;
    
    // Shelf properties
    this.color = color;
    this.capacity = capacity;
    this.books = new Array(capacity).fill(null); // Fixed-size array for books
    
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
      // Check if player has matching books
      const state = this.game.stateManager.currentState;
      const playerHasMatchingBook = state && state.player && 
        state.player.carriedBooks.some(book => book.color === this.color);
      
      // Glow more intensely if player has matching books
      const glowSpeed = playerHasMatchingBook ? 4 : 2;
      const maxGlow = playerHasMatchingBook ? 1 : 0.7;
      const minGlow = playerHasMatchingBook ? 0.5 : 0.3;
      
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
      // Fallback rendering - Computer/tech colors
      ctx.fillStyle = '#f0f0f0'; // Light gray/white base
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Shelf boards - darker gray for contrast
      ctx.fillStyle = '#d0d0d0';
      ctx.fillRect(this.x, this.y + 20, this.width, 4);
      ctx.fillRect(this.x, this.y + 44, this.width, 4);
      ctx.fillRect(this.x, this.y + 68, this.width, 4);
      
      // Add some tech-style highlights
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x, this.y, this.width, 2); // Top highlight
      ctx.fillRect(this.x, this.y + 2, 2, this.height - 2); // Left highlight
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
          if (slotIndex < this.capacity && !this.books[slotIndex]) {
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
    
    // Draw books on shelf
    this.renderBooks(ctx);
    
    // Draw capacity indicator
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${this.books.filter(b => b !== null).length}/${this.capacity}`,
      this.getCenterX(),
      this.y + this.height + 10
    );
    ctx.restore();
  }
  
  renderBooks(ctx) {
    const slotsPerRow = 3;
    const slotWidth = this.width / slotsPerRow;
    
    this.books.forEach((book, index) => {
      if (!book) return;
      
      // Validate book state
      if (!book.isShelved || book.shelf !== this) {
        // Clean up invalid book reference silently
        this.books[index] = null;
        return;
      }
      
      const row = Math.floor(index / slotsPerRow);
      const col = index % slotsPerRow;
      
      // Position book on shelf
      book.x = this.x + col * slotWidth + (slotWidth - book.width) / 2;
      book.y = this.y + 24 + row * 24;
      book.render(ctx, 1);
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
    // Count actual books (not null entries)
    const bookCount = this.books.filter(book => book !== null).length;
    return bookCount < this.capacity;
  }
  
  addBook(book) {
    if (!this.hasEmptySlots() || book.color !== this.color) {
      return false;
    }
    
    // Find first empty slot
    let slotIndex = 0;
    while (slotIndex < this.capacity && this.books[slotIndex]) {
      slotIndex++;
    }
    
    if (slotIndex < this.capacity) {
      this.books[slotIndex] = book;
      book.shelve(this);
      return true;
    }
    
    return false;
  }
  
  removeBook(index) {
    if (index >= 0 && index < this.books.length && this.books[index]) {
      const book = this.books[index];
      this.books[index] = null;
      book.unshelve();
      return book;
    }
    return null;
  }
  
  removeRandomBook() {
    // Get indices of all books on shelf
    const bookIndices = [];
    for (let i = 0; i < this.books.length; i++) {
      if (this.books[i]) {
        bookIndices.push(i);
      }
    }
    
    if (bookIndices.length === 0) {
      return null;
    }
    
    // Remove random book
    const randomIndex = bookIndices[Math.floor(Math.random() * bookIndices.length)];
    return this.removeBook(randomIndex);
  }
  
  getEmptySlotCount() {
    return this.capacity - this.books.filter(book => book !== null).length;
  }
}