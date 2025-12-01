// Image analysis for brightness, edges, and feature detection

class ImageAnalyzer {
  constructor(image) {
    this.image = image;
    this.canvas = document.createElement('canvas');
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.drawImage(image, 0, 0);
    this.imageData = this.ctx.getImageData(0, 0, image.width, image.height);
    this.width = image.width;
    this.height = image.height;
    
    // Cache for edge strength map
    this._edgeMap = null;
  }
  
  // Get brightness at normalized coordinates (0-1)
  getBrightness(nx, ny, cfg = {}) {
    const px = Math.floor(nx * (this.width - 1));
    const py = Math.floor(ny * (this.height - 1));
    
    if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
      return 0;
    }
    
    const i = (py * this.width + px) * 4;
    const r = this.imageData.data[i];
    const g = this.imageData.data[i + 1];
    const b = this.imageData.data[i + 2];
    
    // Luminance formula
    let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Apply contrast adjustment
    const contrast = cfg.contrast || 1;
    if (contrast !== 1) {
      brightness = Math.pow(brightness, 1 / contrast);
    }
    
    // Apply brightness shift
    const brightnessShift = cfg.brightness || 0;
    brightness = brightness + brightnessShift;
    
    // Clamp
    brightness = Math.max(0, Math.min(1, brightness));
    
    // Invert if needed
    if (cfg.invertBrightness) {
      brightness = 1 - brightness;
    }
    
    return brightness;
  }
  
  // Get bilinear interpolated brightness
  getBrightnessSmooth(nx, ny, cfg = {}) {
    const x = nx * (this.width - 1);
    const y = ny * (this.height - 1);
    
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, this.width - 1);
    const y1 = Math.min(y0 + 1, this.height - 1);
    
    const fx = x - x0;
    const fy = y - y0;
    
    const b00 = this.getBrightnessAt(x0, y0, cfg);
    const b10 = this.getBrightnessAt(x1, y0, cfg);
    const b01 = this.getBrightnessAt(x0, y1, cfg);
    const b11 = this.getBrightnessAt(x1, y1, cfg);
    
    const b0 = b00 * (1 - fx) + b10 * fx;
    const b1 = b01 * (1 - fx) + b11 * fx;
    
    return b0 * (1 - fy) + b1 * fy;
  }
  
  // Internal: get brightness at pixel coordinates
  getBrightnessAt(px, py, cfg = {}) {
    if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
      return 0;
    }
    
    const i = (py * this.width + px) * 4;
    const r = this.imageData.data[i];
    const g = this.imageData.data[i + 1];
    const b = this.imageData.data[i + 2];
    
    let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    const contrast = cfg.contrast || 1;
    if (contrast !== 1) {
      brightness = Math.pow(brightness, 1 / contrast);
    }
    
    const brightnessShift = cfg.brightness || 0;
    brightness = Math.max(0, Math.min(1, brightness + brightnessShift));
    
    if (cfg.invertBrightness) {
      brightness = 1 - brightness;
    }
    
    return brightness;
  }
  
  // Calculate edge strength using Sobel operator
  getEdgeStrength(nx, ny) {
    const delta = 1 / Math.max(this.width, this.height);
    
    // Sobel kernels
    const left = this.getBrightness(nx - delta, ny);
    const right = this.getBrightness(nx + delta, ny);
    const top = this.getBrightness(nx, ny - delta);
    const bottom = this.getBrightness(nx, ny + delta);
    
    const topLeft = this.getBrightness(nx - delta, ny - delta);
    const topRight = this.getBrightness(nx + delta, ny - delta);
    const bottomLeft = this.getBrightness(nx - delta, ny + delta);
    const bottomRight = this.getBrightness(nx + delta, ny + delta);
    
    // Sobel gradients
    const gx = (topRight + 2 * right + bottomRight) - (topLeft + 2 * left + bottomLeft);
    const gy = (bottomLeft + 2 * bottom + bottomRight) - (topLeft + 2 * top + topRight);
    
    return Math.sqrt(gx * gx + gy * gy);
  }
  
  // Get gradient direction at a point
  getGradient(nx, ny) {
    const delta = 1 / Math.max(this.width, this.height);
    
    const left = this.getBrightness(nx - delta, ny);
    const right = this.getBrightness(nx + delta, ny);
    const top = this.getBrightness(nx, ny - delta);
    const bottom = this.getBrightness(nx, ny + delta);
    
    return {
      dx: (right - left) / (2 * delta),
      dy: (bottom - top) / (2 * delta)
    };
  }
  
  // Build edge map for entire image (cached)
  buildEdgeMap(resolution = 100) {
    if (this._edgeMap && this._edgeMap.resolution === resolution) {
      return this._edgeMap;
    }
    
    const map = new Float32Array(resolution * resolution);
    let maxEdge = 0;
    
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const nx = x / (resolution - 1);
        const ny = y / (resolution - 1);
        const edge = this.getEdgeStrength(nx, ny);
        map[y * resolution + x] = edge;
        maxEdge = Math.max(maxEdge, edge);
      }
    }
    
    // Normalize
    if (maxEdge > 0) {
      for (let i = 0; i < map.length; i++) {
        map[i] /= maxEdge;
      }
    }
    
    this._edgeMap = { data: map, resolution, maxEdge };
    return this._edgeMap;
  }
  
  // Sample edge strength from cached map
  getEdgeStrengthFast(nx, ny) {
    if (!this._edgeMap) {
      this.buildEdgeMap();
    }
    
    const res = this._edgeMap.resolution;
    const x = Math.floor(nx * (res - 1));
    const y = Math.floor(ny * (res - 1));
    
    if (x < 0 || x >= res || y < 0 || y >= res) return 0;
    
    return this._edgeMap.data[y * res + x];
  }
  
  // Get aspect ratio
  getAspectRatio() {
    return this.width / this.height;
  }
  
  // Create thumbnail for preview
  createThumbnail(maxSize = 200) {
    const scale = Math.min(maxSize / this.width, maxSize / this.height);
    const w = Math.floor(this.width * scale);
    const h = Math.floor(this.height * scale);
    
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.image, 0, 0, w, h);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }
}