// Default configuration with all adjustable parameters
const DEFAULT_CONFIG = {
  // === IMAGE SETTINGS ===
  contrast: 2.0,           // 0.5 - 4.0: Higher = more dramatic light/dark separation
  brightness: 0,           // -1 to 1: Shift overall brightness
  invertBrightness: false, // Swap light/dark
  gamma: 1.5,              // 0.5 - 3.0: Gamma curve adjustment
  
  // === GEOMETRY SETTINGS ===
  cellDensity: 50,         // 10-100: Number of cells across width
  edgeSensitivity: 2.0,    // 0-5: How much edges increase local detail
  jitter: 0.4,             // 0-1: Randomness in point placement
  adaptiveSizing: true,    // Vary cell size based on brightness
  minCellScale: 0.3,       // Minimum cell size multiplier (for dark areas)
  maxCellScale: 2.0,       // Maximum cell size multiplier (for bright areas)
  
  // === RELIEF SETTINGS ===
  reliefMethod: 'angled',  // 'angled', 'heightmap', or 'hybrid'
  maxTiltAngle: 35,        // 5-60 degrees: Max surface tilt (INCREASED)
  baseThickness: 3,        // mm: Solid base thickness
  maxReliefHeight: 12,     // mm: Additional height for depth effect (INCREASED)
  heightVariation: 0.4,    // 0-1: How much height varies with brightness
  facetSharpness: 0.8,     // 0-1: How sharp the facet edges are
  
  // === LIGHTING (for angle calculation) ===
  lightAzimuth: 45,        // 0-360: Horizontal angle (0=front, 90=right)
  lightElevation: 50,      // 0-90: Vertical angle (lower = more dramatic)
  
  // === OUTPUT DIMENSIONS ===
  outputWidthMM: 200,      // Total width in mm
  outputHeightMM: 200,     // Total height in mm
  maintainAspectRatio: true,
  
  // === TILING ===
  enableTiling: false,
  printerBedWidth: 220,    // mm
  printerBedHeight: 220,   // mm
  tileOverlap: 2,          // mm: Overlap for alignment
  registrationPins: true,  // Add alignment features
  
  // === PREVIEW ===
  previewColor: '#c0c0c0',
  showWireframe: false,
  realisticLighting: true,
  autoRotate: false,
  
  // === ADVANCED ===
  smoothNormals: false,    // Keep false for sharper facets
  borderWidth: 2,          // mm: flat border around edge
};

// Configuration manager
class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.listeners = [];
  }
  
  get(key) {
    return this.config[key];
  }
  
  set(key, value) {
    const oldValue = this.config[key];
    this.config[key] = value;
    
    if (oldValue !== value) {
      this.notify(key, value, oldValue);
    }
  }
  
  setMultiple(updates) {
    const changes = [];
    for (const [key, value] of Object.entries(updates)) {
      if (this.config[key] !== value) {
        changes.push({ key, newValue: value, oldValue: this.config[key] });
        this.config[key] = value;
      }
    }
    
    if (changes.length > 0) {
      this.notifyBatch(changes);
    }
  }
  
  getAll() {
    return { ...this.config };
  }
  
  reset() {
    this.config = { ...DEFAULT_CONFIG };
    this.notifyBatch(Object.keys(DEFAULT_CONFIG).map(key => ({
      key, newValue: DEFAULT_CONFIG[key], oldValue: undefined
    })));
  }
  
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
  
  notify(key, newValue, oldValue) {
    this.listeners.forEach(cb => cb([{ key, newValue, oldValue }]));
  }
  
  notifyBatch(changes) {
    this.listeners.forEach(cb => cb(changes));
  }
  
  // Export config as JSON
  exportConfig() {
    return JSON.stringify(this.config, null, 2);
  }
  
  // Import config from JSON
  importConfig(json) {
    try {
      const imported = JSON.parse(json);
      this.setMultiple(imported);
      return true;
    } catch (e) {
      console.error('Failed to import config:', e);
      return false;
    }
  }
  
  // Calculate derived values
  getTileInfo() {
    const cfg = this.config;
    if (!cfg.enableTiling) {
      return { cols: 1, rows: 1, tiles: [{ col: 0, row: 0 }] };
    }
    
    const usableWidth = cfg.printerBedWidth - cfg.tileOverlap;
    const usableHeight = cfg.printerBedHeight - cfg.tileOverlap;
    
    const cols = Math.ceil(cfg.outputWidthMM / usableWidth);
    const rows = Math.ceil(cfg.outputHeightMM / usableHeight);
    
    const tiles = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        tiles.push({ col, row, index: row * cols + col });
      }
    }
    
    return { cols, rows, tiles, usableWidth, usableHeight };
  }
  
  getLightDirection() {
    const az = this.config.lightAzimuth * Math.PI / 180;
    const el = this.config.lightElevation * Math.PI / 180;
    
    return {
      x: Math.cos(el) * Math.sin(az),
      y: Math.cos(el) * Math.cos(az),
      z: Math.sin(el)
    };
  }
}

// Global config instance
const config = new ConfigManager();