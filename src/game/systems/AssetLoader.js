export class AssetLoader {
  constructor() {
    this.assets = new Map();
    this.loadingProgress = 0;
    this.totalAssets = 0;
    this.loadedAssets = 0;
  }
  
  async loadAll(assetManifest) {
    const promises = [];
    this.totalAssets = 0;
    this.loadedAssets = 0;
    
    // Count total assets
    for (const category of Object.values(assetManifest)) {
      this.totalAssets += Object.keys(category).length;
    }
    
    // Load images
    if (assetManifest.images) {
      for (const [name, path] of Object.entries(assetManifest.images)) {
        promises.push(this.loadImage(name, path));
      }
    }
    
    // Load audio
    if (assetManifest.audio) {
      for (const [name, path] of Object.entries(assetManifest.audio)) {
        promises.push(this.loadAudio(name, path));
      }
    }
    
    // Load JSON data
    if (assetManifest.data) {
      for (const [name, path] of Object.entries(assetManifest.data)) {
        promises.push(this.loadJSON(name, path));
      }
    }
    
    await Promise.all(promises);
    console.log(`Loaded ${this.loadedAssets} assets successfully`);
  }
  
  async loadImage(name, path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.assets.set(name, img);
        this.loadedAssets++;
        this.updateProgress();
        resolve(img);
      };
      
      img.onerror = () => {
        console.error(`Failed to load image: ${path}`);
        // Still resolve to not break the loading process
        this.loadedAssets++;
        this.updateProgress();
        resolve(null);
      };
      
      img.src = path;
    });
  }
  
  async loadAudio(name, path) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      
      audio.addEventListener('canplaythrough', () => {
        this.assets.set(name, audio);
        this.loadedAssets++;
        this.updateProgress();
        resolve(audio);
      }, { once: true });
      
      audio.onerror = () => {
        console.error(`Failed to load audio: ${path}`);
        this.loadedAssets++;
        this.updateProgress();
        resolve(null);
      };
      
      audio.src = path;
      audio.load();
    });
  }
  
  async loadJSON(name, path) {
    try {
      const response = await fetch(path);
      const data = await response.json();
      this.assets.set(name, data);
      this.loadedAssets++;
      this.updateProgress();
      return data;
    } catch (error) {
      console.error(`Failed to load JSON: ${path}`, error);
      this.loadedAssets++;
      this.updateProgress();
      return null;
    }
  }
  
  updateProgress() {
    this.loadingProgress = this.totalAssets > 0 
      ? this.loadedAssets / this.totalAssets 
      : 0;
  }
  
  get(name) {
    return this.assets.get(name);
  }
  
  getImage(name) {
    const asset = this.get(name);
    if (asset instanceof HTMLImageElement) {
      return asset;
    }
    return null;
  }
  
  getAudio(name) {
    const asset = this.get(name);
    if (asset instanceof HTMLAudioElement) {
      return asset;
    }
    return null;
  }
  
  getData(name) {
    const asset = this.get(name);
    if (asset && !(asset instanceof HTMLElement)) {
      return asset;
    }
    return null;
  }
  
  // Create placeholder image for development
  createPlaceholderImage(width, height, color = '#888888', text = '') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    
    // Draw border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
    
    // Draw text if provided
    if (text) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.min(width, height) * 0.2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2);
    }
    
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
  }
  
  // Generate placeholder assets for development
  generatePlaceholderAssets() {
    // Player sprite
    this.assets.set('librarian', this.createPlaceholderImage(32, 48, '#4169E1', 'P'));
    
    // Kid sprite
    this.assets.set('kid', this.createPlaceholderImage(24, 36, '#FF6347', 'K'));
    
    // Volume block sprite
    this.assets.set('volumeBlock', this.createPlaceholderImage(16, 20, '#404040', 'V'));
    
    // Shelf sprite - MODERN DARK THEME
    this.assets.set('shelf', this.createPlaceholderImage(64, 96, '#1a1a1a', 'S'));
    
    // Floor tiles
    this.assets.set('tiles', this.createPlaceholderImage(32, 32, '#D2691E'));
    
    console.log('Generated placeholder assets');
  }
}