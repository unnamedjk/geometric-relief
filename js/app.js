// Main application controller - Manual generation

class App {
  constructor() {
    this.viewer = null;
    this.analyzer = null;
    this.geometry = null;
    this.meshData = null;
    this.isGenerating = false;
  }
  
  init() {
    console.log('Initializing Angled Facet Relief Generator v2...');
    
    // Initialize UI
    ui = new UI();
    ui.build();
    
    // Initialize Three.js viewer
    const viewerContainer = document.getElementById('viewer');
    this.viewer = new ThreeViewer(viewerContainer);
    
    // Set up callbacks
    ui.onImageLoad = (img) => this.handleImageLoad(img);
    ui.onGenerate = () => this.generate();  // Manual generate
    ui.onExport = (format) => this.handleExport(format);
    ui.onPreviewUpdate = (type, value) => this.handlePreviewUpdate(type, value);
    
    // Initial tile grid update
    ui.updateTileGrid();
    
    console.log('Initialization complete');
  }
  
  handleImageLoad(img) {
    console.log(`Image loaded: ${img.width}x${img.height}`);
    
    // Create analyzer
    this.analyzer = new ImageAnalyzer(img);
    
    // Clear any previous geometry
    this.geometry = null;
    this.meshData = null;
    ui.enableExport(false);
    
    // Ready to generate
    ui.setGenerateEnabled(true);
    
    console.log('Image analyzed. Click Generate to create geometry.');
  }
  
  generate() {
    if (!this.analyzer || this.isGenerating) {
      console.warn('Cannot generate: no image or already generating');
      return;
    }
    
    this.isGenerating = true;
    ui.showProgress(true, 'Generating geometry...');
    ui.setGenerateEnabled(false);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const cfg = config.getAll();
        const startTime = performance.now();
        
        console.log('Starting generation with config:', cfg);
        
        // Generate 2D triangulation
        ui.showProgress(true, 'Creating point distribution...');
        this.geometry = GeometryGenerator.generate(this.analyzer, cfg);
        
        // Build 3D mesh
        ui.showProgress(true, 'Building 3D mesh...');
        this.meshData = MeshBuilder.build(this.geometry, cfg);
        
        const totalTime = performance.now() - startTime;
        
        // Update viewer
        ui.showProgress(true, 'Updating preview...');
        this.viewer.updateMesh(this.meshData, cfg);
        
        // Update stats
        ui.updateStats({
          triangles: this.meshData?.triangleCount || 0,
          generationTime: totalTime
        });
        
        ui.enableExport(true);
        
        console.log(`Generation complete in ${totalTime.toFixed(0)}ms`);
        
      } catch (error) {
        console.error('Generation failed:', error);
        alert('Failed to generate geometry: ' + error.message);
      } finally {
        this.isGenerating = false;
        ui.showProgress(false);
        ui.setGenerateEnabled(true);
      }
    }, 50);
  }
  
  handlePreviewUpdate(type, value) {
    if (!this.viewer) return;
    
    switch (type) {
      case 'lighting':
        this.viewer.updateLightPosition(config.get('lightAzimuth'), config.get('lightElevation'));
        ui.updateLightInfo();
        break;
      case 'wireframe':
        this.viewer.setWireframe(value);
        break;
      case 'autoRotate':
        this.viewer.setAutoRotate(value);
        break;
      case 'color':
        this.viewer.setPreviewColor(value);
        break;
      case 'resetView':
        this.viewer.resetView();
        break;
      case 'fit':
        this.viewer.fitToObject();
        break;
      case 'viewFront':
        this.viewer.setView('front');
        break;
      case 'viewTop':
        this.viewer.setView('top');
        break;
    }
  }
  
  handleExport(format) {
    if (!this.meshData) {
      alert('No geometry to export. Please generate first.');
      return;
    }
    
    const cfg = config.getAll();
    
    try {
      switch (format) {
        case 'stl':
          Exporters.exportSTLBinary(this.meshData, 'relief.stl');
          break;
        case 'obj':
          Exporters.exportOBJ(this.meshData, 'relief.obj');
          break;
        case 'scad':
          Exporters.exportSCAD(this.meshData, cfg, 'relief.scad');
          break;
        case 'config':
          Exporters.exportConfig(cfg, 'relief_config.json');
          break;
        case 'tiles':
          if (this.geometry) {
            Exporters.exportAllTiles(this.geometry, cfg, 'stl');
          }
          break;
        default:
          console.warn('Unknown export format:', format);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});