// Image processing functions
const ImageProcessor = {
  getBrightness: function(imageData, x, y, width, height, config) {
    debugLog(`Getting brightness at (${x}, ${y})`);
    
    if (!imageData) {
      debugLog('No image data available', 'warn');
      return 0;
    }
    
    const imgX = Math.floor((x / width) * imageData.width);
    const imgY = Math.floor((y / height) * imageData.height);
    
    if (imgX < 0 || imgX >= imageData.width || imgY < 0 || imgY >= imageData.height) {
      return 0;
    }
    
    const idx = (imgY * imageData.width + imgX) * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    let adjusted = Math.pow(brightness, 1 / config.contrast);
    adjusted = adjusted * config.heightExaggeration;
    adjusted = Math.max(0, Math.min(1, adjusted));
    
    if (config.invertHeight) {
      adjusted = 1 - adjusted;
    }
    
    return adjusted;
  },
  
  getEdgeStrength: function(imageData, x, y, width, height, config) {
    if (!imageData) return 0;
    
    const size = 2;
    const center = this.getBrightness(imageData, x, y, width, height, config);
    const left = this.getBrightness(imageData, x - size, y, width, height, config);
    const right = this.getBrightness(imageData, x + size, y, width, height, config);
    const top = this.getBrightness(imageData, x, y - size, width, height, config);
    const bottom = this.getBrightness(imageData, x, y + size, width, height, config);
    
    const gx = Math.abs(right - left);
    const gy = Math.abs(bottom - top);
    
    return Math.sqrt(gx * gx + gy * gy);
  },
  
  preprocessImage: function(img, contrast) {
    debugLog(`Preprocessing image with contrast: ${contrast}`);
    
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    ctx.filter = `contrast(${contrast * 100}%)`;
    ctx.drawImage(img, 0, 0);
    
    const data = ctx.getImageData(0, 0, img.width, img.height);
    debugLog(`Image preprocessed: ${img.width}x${img.height} pixels`);
    
    return data;
  }
};

debugLog('ImageProcessor loaded');