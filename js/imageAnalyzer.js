// Image analysis with better contrast and edge detection

class ImageAnalyzer {
  constructor(image) {
    this.image = image;
    this.width = image.width;
    this.height = image.height;
    
    // Create canvas and get raw data
    this.canvas = document.createElement('canvas');
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.drawImage(image, 0, 0);
    this.rawData = this.ctx.getImageData(0, 0, image.width, image.height);
    
    // Pre-compute grayscale
    this.grayscale = new Float32Array(image.width * image.height);
    this.computeGrayscale();
    
    // Edge detection cache
    this._edgeMap = null;
    this._sobelX = null;
    this._sobelY = null;
  }
  
  computeGrayscale() {
    const data = this.rawData.data;
    for (let i = 0; i < this.grayscale.length; i++) {
      const idx = i * 4;
      // Luminance
      this.grayscale[i] = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255;
    }
  }
  
  // Get raw brightness at pixel coords
  getRawBrightness(px, py) {
    if (px < 0 || px >= this.width || py < 0 || py >= this.height) return 0;
    return this.grayscale[py * this.width + px];
  }
  
  // Get processed brightness at normalized coordinates (0-1)
  getBrightness(nx, ny, cfg = {}) {
    const px = Math.floor(nx * (this.width - 1));
    const py = Math.floor(ny * (this.height - 1));
    
    let brightness = this.getRawBrightness(px, py);
    
    // Apply gamma
    const gamma = cfg.gamma || 1.0;
    if (gamma !== 1.0) {
      brightness = Math.pow(brightness, 1 / gamma);
    }
    
    // Apply contrast (S-curve for better separation)
    const contrast = cfg.contrast || 1.0;
    if (contrast !== 1.0) {
      // S-curve contrast
      brightness = brightness - 0.5;
      brightness = brightness * contrast;
      brightness = brightness / (1 + Math.abs(brightness)); // Soft clamp
      brightness = brightness + 0.5;
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
  
  // Bilinear interpolated brightness
  getBrightnessSmooth(nx, ny, cfg = {}) {
    const x = nx * (this.width - 1);
    const y = ny * (this.height - 1);
    
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, this.width - 1);
    const y1 = Math.min(y0 + 1, this.height - 1);
    
    const fx = x - x0;
    const fy = y - y0;
    
    const b00 = this.getBrightness(x0 / (this.width - 1), y0 / (this.height - 1), cfg);
    const b10 = this.getBrightness(x1 / (this.width - 1), y0 / (this.height - 1), cfg);
    const b01 = this.getBrightness(x0 / (this.width - 1), y1 / (this.height - 1), cfg);
    const b11 = this.getBrightness(x1 / (this.width - 1), y1 / (this.height - 1), cfg);
    
    const b0 = b00 * (1 - fx) + b10 * fx;
    const b1 = b01 * (1 - fx) + b11 * fx;
    
    return b0 * (1 - fy) + b1 * fy;
  }
  
  // Compute Sobel edge detection
  computeSobel() {
    if (this._sobelX) return;
    
    const w = this.width;
    const h = this.height;
    this._sobelX = new Float32Array(w * h);
    this._sobelY = new Float32Array(w * h);
    this._edgeMap = new Float32Array(w * h);
    
    let maxEdge = 0;
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        
        // Sobel kernels
        const tl = this.grayscale[(y-1) * w + (x-1)];
        const t  = this.grayscale[(y-1) * w + x];
        const tr = this.grayscale[(y-1) * w + (x+1)];
        const l  = this.grayscale[y * w + (x-1)];
        const r  = this.grayscale[y * w + (x+1)];
        const bl = this.grayscale[(y+1) * w + (x-1)];
        const b  = this.grayscale[(y+1) * w + x];
        const br = this.grayscale[(y+1) * w + (x+1)];
        
        const gx = (tr + 2*r + br) - (tl + 2*l + bl);
        const gy = (bl + 2*b + br) - (tl + 2*t + tr);
        
        this._sobelX[idx] = gx;
        this._sobelY[idx] = gy;
        
        const edge = Math.sqrt(gx*gx + gy*gy);
        this._edgeMap[idx] = edge;
        maxEdge = Math.max(maxEdge, edge);
      }
    }
    
    // Normalize edge map
    if (maxEdge > 0) {
      for (let i = 0; i < this._edgeMap.length; i++) {
        this._edgeMap[i] /= maxEdge;
      }
    }
  }
  
  // Get edge strength at normalized coords
  getEdgeStrength(nx, ny) {
    this.computeSobel();
    
    const px = Math.floor(nx * (this.width - 1));
    const py = Math.floor(ny * (this.height - 1));
    
    if (px < 1 || px >= this.width - 1 || py < 1 || py >= this.height - 1) return 0;
    
    return this._edgeMap[py * this.width + px];
  }
  
  // Get gradient direction at normalized coords
  getGradient(nx, ny) {
    this.computeSobel();
    
    const px = Math.floor(nx * (this.width - 1));
    const py = Math.floor(ny * (this.height - 1));
    
    if (px < 1 || px >= this.width - 1 || py < 1 || py >= this.height - 1) {
      return { dx: 0, dy: 0, magnitude: 0 };
    }
    
    const idx = py * this.width + px;
    const dx = this._sobelX[idx];
    const dy = this._sobelY[idx];
    
    return {
      dx,
      dy,
      magnitude: Math.sqrt(dx*dx + dy*dy),
      angle: Math.atan2(dy, dx)
    };
  }
  
  // Get local contrast (variance in neighborhood)
  getLocalContrast(nx, ny, radius = 0.02) {
    const cx = Math.floor(nx * (this.width - 1));
    const cy = Math.floor(ny * (this.height - 1));
    const r = Math.max(1, Math.floor(radius * Math.min(this.width, this.height)));
    
    let sum = 0, sumSq = 0, count = 0;
    
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
          const v = this.grayscale[py * this.width + px];
          sum += v;
          sumSq += v * v;
          count++;
        }
      }
    }
    
    if (count < 2) return 0;
    
    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    
    return Math.sqrt(Math.max(0, variance));
  }
  
  // Get aspect ratio
  getAspectRatio() {
    return this.width / this.height;
  }
  
  // Create debug visualization
  createEdgeVisualization() {
    this.computeSobel();
    
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(this.width, this.height);
    
    for (let i = 0; i < this._edgeMap.length; i++) {
      const v = Math.floor(this._edgeMap[i] * 255);
      imgData.data[i * 4] = v;
      imgData.data[i * 4 + 1] = v;
      imgData.data[i * 4 + 2] = v;
      imgData.data[i * 4 + 3] = 255;
    }
    
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL();
  }
}