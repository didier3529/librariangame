import { Game } from './game/Game.js';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing game...');
  
  // Create game instance
  const game = new Game('game-canvas');
  
  // Make game instance globally available for debugging
  window.game = game;
  
  try {
    // Initialize and start the game
    await game.init();
    console.log('THE VOLUME HEIST initialized successfully!');
    console.log('Current state:', game.stateManager.currentState?.name);
  } catch (error) {
    console.error('Failed to initialize game:', error);
    
    // Show error to user
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.textContent = 'Failed to load game. Please refresh the page.';
      loadingEl.style.color = '#ff0000';
    }
  }
  
  // Handle visibility changes (pause when tab is hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.stateManager.currentState?.name === 'playing') {
      game.gameData.isPaused = true;
    }
  });
});