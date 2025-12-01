// UI Builder - Manual generation, no auto-update

class UI {
  constructor() {
    this.sidebar = document.getElementById('sidebar');
    this.toolbar = document.getElementById('toolbar');
    this.statusBar = document.getElementById('status-bar');
    this.lightInfo = document.getElementById('light-info');
    this.progress = document.getElementById('progress');
    
    this.onImageLoad = null;
    this.onGenerate = null;
    this.onExport = null;
    this.onPreviewUpdate = null;
  }
  
  build() {
    this.buildSidebar();
    this.buildToolbar();
    this.updateStatusBar({});
    this.updateLightInfo();
  }
  
  buildSidebar() {
    this.sidebar.innerHTML = `
      ${this.buildPanel('Image', 'image', this.buildImageSection())}
      ${this.buildPanel('Geometry', 'geometry', this.buildGeometrySection())}
      ${this.buildPanel('Relief', 'relief', this.buildReliefSection())}
      ${this.buildPanel('Lighting', 'lighting', this.buildLightingSection())}
      ${this.buildPanel('Output', 'output', this.buildOutputSection())}
      ${this.buildPanel('Tiling', 'tiling', this.buildTilingSection(), true)}
      ${this.buildPanel('Export', 'export', this.buildExportSection())}
    `;
    
    this.attachEventListeners();
  }
  
  buildPanel(title, id, content, collapsed = false) {
    return `
      <div class="panel" id="panel-${id}">
        <div class="panel-header" onclick="ui.togglePanel('${id}')">
          <span class="panel-title">${title}</span>
          <span class="panel-toggle ${collapsed ? 'collapsed' : ''}" id="toggle-${id}">▼</span>
        </div>
        <div class="panel-content ${collapsed ? 'collapsed' : ''}" id="content-${id}">
          ${content}
        </div>
      </div>
    `;
  }
  
  togglePanel(id) {
    const content = document.getElementById(`content-${id}`);
    const toggle = document.getElementById(`toggle-${id}`);
    if (content) content.classList.toggle('collapsed');
    if (toggle) toggle.classList.toggle('collapsed');
  }
  
  buildImageSection() {
    return `
      <div class="drop-zone" id="drop-zone">
        <div class="drop-zone-icon">📷</div>
        <div class="drop-zone-text">Drop image or click to upload</div>
        <input type="file" id="file-input" accept="image/*" style="display:none">
        <img id="preview-thumb" class="preview-thumb" style="display:none">
      </div>
      
      ${this.buildSlider('contrast', 'Contrast', 0.5, 4, 0.1, config.get('contrast'))}
      ${this.buildSlider('gamma', 'Gamma', 0.5, 3, 0.1, config.get('gamma'))}
      ${this.buildSlider('brightness', 'Brightness', -0.5, 0.5, 0.05, config.get('brightness'))}
      
      <label class="checkbox-row">
        <input type="checkbox" id="invertBrightness" ${config.get('invertBrightness') ? 'checked' : ''}>
        Invert brightness (dark = raised)
      </label>
    `;
  }
  
  buildGeometrySection() {
    return `
      ${this.buildSlider('cellDensity', 'Cell Density', 20, 100, 1, config.get('cellDensity'))}
      <div class="help-text">More cells = finer detail, slower generation</div>
      
      ${this.buildSlider('edgeSensitivity', 'Edge Detail', 0, 5, 0.1, config.get('edgeSensitivity'))}
      <div class="help-text">Add extra detail along edges</div>
      
      ${this.buildSlider('jitter', 'Randomness', 0, 1, 0.1, config.get('jitter'))}
      
      <label class="checkbox-row">
        <input type="checkbox" id="adaptiveSizing" ${config.get('adaptiveSizing') ? 'checked' : ''}>
        Adaptive cell sizing
      </label>
      <div class="help-text">Smaller cells in dark areas</div>
    `;
  }
  
  buildReliefSection() {
    return `
      <div class="form-group">
        <label class="form-label">Relief Method</label>
        <select id="reliefMethod">
          <option value="angled" ${config.get('reliefMethod') === 'angled' ? 'selected' : ''}>Angled Facets</option>
          <option value="hybrid" ${config.get('reliefMethod') === 'hybrid' ? 'selected' : ''}>Hybrid (Angled + Height)</option>
          <option value="heightmap" ${config.get('reliefMethod') === 'heightmap' ? 'selected' : ''}>Height Map Only</option>
        </select>
      </div>
      
      ${this.buildSlider('maxTiltAngle', 'Max Tilt Angle', 10, 60, 1, config.get('maxTiltAngle'), '°')}
      <div class="help-text">Larger angle = more dramatic shadows</div>
      
      ${this.buildSlider('facetSharpness', 'Facet Sharpness', 0.2, 1.5, 0.1, config.get('facetSharpness'))}
      <div class="help-text">Higher = more contrast between light/dark</div>
      
      ${this.buildSlider('heightVariation', 'Height Variation', 0, 1, 0.1, config.get('heightVariation'))}
      
      <div class="divider"></div>
      
      ${this.buildSlider('baseThickness', 'Base Thickness', 1, 10, 0.5, config.get('baseThickness'), 'mm')}
      ${this.buildSlider('maxReliefHeight', 'Max Relief Height', 3, 25, 0.5, config.get('maxReliefHeight'), 'mm')}
    `;
  }
  
  buildLightingSection() {
    return `
      ${this.buildSlider('lightAzimuth', 'Light Direction', 0, 360, 5, config.get('lightAzimuth'), '°')}
      <div class="help-text">0°=front, 90°=right, 180°=back, 270°=left</div>
      
      ${this.buildSlider('lightElevation', 'Light Height', 10, 90, 5, config.get('lightElevation'), '°')}
      <div class="help-text">Lower = longer shadows, more dramatic</div>
      
      <div class="form-group">
        <label class="form-label">Preview Color</label>
        <input type="color" id="previewColor" value="${config.get('previewColor')}">
      </div>
      
      <label class="checkbox-row">
        <input type="checkbox" id="showWireframe" ${config.get('showWireframe') ? 'checked' : ''}>
        Show wireframe
      </label>
      
      <label class="checkbox-row">
        <input type="checkbox" id="autoRotate" ${config.get('autoRotate') ? 'checked' : ''}>
        Auto-rotate preview
      </label>
    `;
  }
  
  buildOutputSection() {
    return `
      <div class="row">
        <div class="form-group">
          <label class="form-label">Width (mm)</label>
          <input type="number" id="outputWidthMM" value="${config.get('outputWidthMM')}" min="10" max="2000">
        </div>
        <div class="form-group">
          <label class="form-label">Height (mm)</label>
          <input type="number" id="outputHeightMM" value="${config.get('outputHeightMM')}" min="10" max="2000">
        </div>
      </div>
      
      <label class="checkbox-row">
        <input type="checkbox" id="maintainAspectRatio" ${config.get('maintainAspectRatio') ? 'checked' : ''}>
        Lock aspect ratio
      </label>
      
      <div class="divider"></div>
      
      <button class="btn btn-primary" id="btn-generate" style="font-size: 16px; padding: 14px;" disabled>
        🔄 Generate Geometry
      </button>
      <div class="help-text" style="text-align: center; margin-top: 8px;">
        Adjust settings above, then click to generate
      </div>
    `;
  }
  
  buildTilingSection() {
    return `
      <label class="checkbox-row">
        <input type="checkbox" id="enableTiling" ${config.get('enableTiling') ? 'checked' : ''}>
        Enable tiling for large prints
      </label>
      
      <div id="tiling-options" style="display: ${config.get('enableTiling') ? 'block' : 'none'}">
        <div class="divider"></div>
        
        <div class="row">
          <div class="form-group">
            <label class="form-label">Bed Width (mm)</label>
            <input type="number" id="printerBedWidth" value="${config.get('printerBedWidth')}" min="100" max="500">
          </div>
          <div class="form-group">
            <label class="form-label">Bed Height (mm)</label>
            <input type="number" id="printerBedHeight" value="${config.get('printerBedHeight')}" min="100" max="500">
          </div>
        </div>
        
        ${this.buildSlider('tileOverlap', 'Tile Overlap', 0, 10, 0.5, config.get('tileOverlap'), 'mm')}
        
        <label class="checkbox-row">
          <input type="checkbox" id="registrationPins" ${config.get('registrationPins') ? 'checked' : ''}>
          Add registration pins
        </label>
        
        <div class="form-group">
          <label class="form-label">Tile Grid</label>
          <div class="tile-grid" id="tile-grid"></div>
        </div>
      </div>
    `;
  }
  
  buildExportSection() {
    return `
      <div class="stats-box" id="stats-box">
        <div class="stats-row">
          <span class="stats-label">Triangles</span>
          <span class="stats-value" id="stat-triangles">-</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">Dimensions</span>
          <span class="stats-value" id="stat-dimensions">-</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">Generation Time</span>
          <span class="stats-value" id="stat-generation">-</span>
        </div>
      </div>
      
      <div class="btn-row">
        <button class="btn btn-success" id="btn-export-stl" disabled>
          Export STL
        </button>
        <button class="btn btn-secondary" id="btn-export-obj" disabled>
          OBJ
        </button>
      </div>
      
      <div class="btn-row">
        <button class="btn btn-secondary" id="btn-export-scad" disabled>
          OpenSCAD
        </button>
        <button class="btn btn-secondary" id="btn-export-config" disabled>
          Config
        </button>
      </div>
      
      <div id="tile-export-section" style="display: ${config.get('enableTiling') ? 'block' : 'none'}">
        <div class="divider"></div>
        <button class="btn btn-primary" id="btn-export-all-tiles" disabled>
          Export All Tiles
        </button>
      </div>
    `;
  }
  
  buildSlider(id, label, min, max, step, value, unit = '') {
    return `
      <div class="form-group">
        <label class="form-label">
          <span>${label}</span>
          <span class="form-value" id="value-${id}">${value}${unit}</span>
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
      </div>
    `;
  }
  
  buildToolbar() {
    this.toolbar.innerHTML = `
      <button class="toolbar-btn" id="btn-reset-view" title="Reset camera view">Reset View</button>
      <button class="toolbar-btn" id="btn-fit" title="Fit to screen">Fit</button>
      <button class="toolbar-btn" id="btn-front" title="View from front">Front</button>
      <button class="toolbar-btn" id="btn-top" title="View from top">Top</button>
    `;
  }
  
  // Helper to safely add event listener
  addListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener(event, handler);
    } else {
      console.warn(`Element not found: ${id}`);
    }
  }
  
  attachEventListeners() {
    // File input
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
          this.handleFile(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          this.handleFile(e.target.files[0]);
        }
      });
    }
    
    // Generate button
    this.addListener('btn-generate', 'click', () => {
      if (this.onGenerate) this.onGenerate();
    });
    
    // Sliders
    const sliders = ['contrast', 'brightness', 'gamma', 'cellDensity', 'edgeSensitivity', 'jitter', 
                     'maxTiltAngle', 'baseThickness', 'maxReliefHeight', 
                     'lightAzimuth', 'lightElevation', 'tileOverlap', 'facetSharpness', 'heightVariation'];
    
    sliders.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          const unit = id.includes('Angle') || id.includes('Azimuth') || id.includes('Elevation') ? '°' : 
                       id.includes('Thickness') || id.includes('Height') || id.includes('Overlap') ? 'mm' : '';
          const valueEl = document.getElementById(`value-${id}`);
          if (valueEl) valueEl.textContent = val + unit;
          config.set(id, val);
          
          // Only update preview for lighting changes
          if ((id === 'lightAzimuth' || id === 'lightElevation') && this.onPreviewUpdate) {
            this.onPreviewUpdate('lighting');
          }
        });
      }
    });
    
    // Checkboxes
    const checkboxes = ['invertBrightness', 'maintainAspectRatio', 'showWireframe', 'autoRotate', 
                        'enableTiling', 'registrationPins', 'adaptiveSizing'];
    checkboxes.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          config.set(id, e.target.checked);
          
          if (id === 'enableTiling') {
            const tilingOpts = document.getElementById('tiling-options');
            const tileExport = document.getElementById('tile-export-section');
            if (tilingOpts) tilingOpts.style.display = e.target.checked ? 'block' : 'none';
            if (tileExport) tileExport.style.display = e.target.checked ? 'block' : 'none';
            this.updateTileGrid();
          }
          
          if (id === 'showWireframe' && this.onPreviewUpdate) {
            this.onPreviewUpdate('wireframe', e.target.checked);
          }
          if (id === 'autoRotate' && this.onPreviewUpdate) {
            this.onPreviewUpdate('autoRotate', e.target.checked);
          }
        });
      }
    });
    
    // Select
    this.addListener('reliefMethod', 'change', (e) => {
      config.set('reliefMethod', e.target.value);
    });
    
    // Number inputs
    ['outputWidthMM', 'outputHeightMM', 'printerBedWidth', 'printerBedHeight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          config.set(id, parseFloat(e.target.value));
          this.updateTileGrid();
        });
      }
    });
    
    // Color
    this.addListener('previewColor', 'change', (e) => {
      config.set('previewColor', e.target.value);
      if (this.onPreviewUpdate) this.onPreviewUpdate('color', e.target.value);
    });
    
    // Export buttons
    this.addListener('btn-export-stl', 'click', () => {
      if (this.onExport) this.onExport('stl');
    });
    this.addListener('btn-export-obj', 'click', () => {
      if (this.onExport) this.onExport('obj');
    });
    this.addListener('btn-export-scad', 'click', () => {
      if (this.onExport) this.onExport('scad');
    });
    this.addListener('btn-export-config', 'click', () => {
      if (this.onExport) this.onExport('config');
    });
    this.addListener('btn-export-all-tiles', 'click', () => {
      if (this.onExport) this.onExport('tiles');
    });
    
    // Toolbar buttons
    this.addListener('btn-reset-view', 'click', () => {
      if (this.onPreviewUpdate) this.onPreviewUpdate('resetView');
    });
    this.addListener('btn-fit', 'click', () => {
      if (this.onPreviewUpdate) this.onPreviewUpdate('fit');
    });
    this.addListener('btn-front', 'click', () => {
      if (this.onPreviewUpdate) this.onPreviewUpdate('viewFront');
    });
    this.addListener('btn-top', 'click', () => {
      if (this.onPreviewUpdate) this.onPreviewUpdate('viewTop');
    });
  }
  
  handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Update preview
        const thumb = document.getElementById('preview-thumb');
        if (thumb) {
          thumb.src = e.target.result;
          thumb.style.display = 'block';
        }
        
        // Update dimensions if aspect ratio locked
        if (config.get('maintainAspectRatio')) {
          const aspect = img.width / img.height;
          const width = config.get('outputWidthMM');
          config.set('outputHeightMM', Math.round(width / aspect));
          const heightInput = document.getElementById('outputHeightMM');
          if (heightInput) heightInput.value = config.get('outputHeightMM');
        }
        
        // Enable generate button
        const genBtn = document.getElementById('btn-generate');
        if (genBtn) genBtn.disabled = false;
        
        if (this.onImageLoad) {
          this.onImageLoad(img);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  
  updateTileGrid() {
    const grid = document.getElementById('tile-grid');
    if (!grid) return;
    
    const tileInfo = config.getTileInfo();
    grid.style.gridTemplateColumns = `repeat(${tileInfo.cols}, 1fr)`;
    
    grid.innerHTML = tileInfo.tiles.map(tile => 
      `<div class="tile" data-col="${tile.col}" data-row="${tile.row}">${tile.row + 1}-${tile.col + 1}</div>`
    ).join('');
  }
  
  updateLightInfo() {
    if (this.lightInfo) {
      this.lightInfo.innerHTML = `
        <div>Light: ${config.get('lightAzimuth')}° az, ${config.get('lightElevation')}° el</div>
        <div>Drag to rotate • Scroll to zoom • Shift+drag to pan</div>
      `;
    }
  }
  
  updateStatusBar(stats) {
    if (this.statusBar) {
      this.statusBar.innerHTML = `
        <span>Triangles: ${stats.triangles?.toLocaleString() || '-'}</span>
        <span>Size: ${config.get('outputWidthMM')}×${config.get('outputHeightMM')}mm</span>
        <span>Gen: ${stats.generationTime ? stats.generationTime.toFixed(0) + 'ms' : '-'}</span>
      `;
    }
  }
  
  updateStats(stats) {
    const triEl = document.getElementById('stat-triangles');
    const dimEl = document.getElementById('stat-dimensions');
    const genEl = document.getElementById('stat-generation');
    
    if (triEl) triEl.textContent = stats.triangles?.toLocaleString() || '-';
    if (dimEl) dimEl.textContent = `${config.get('outputWidthMM')}×${config.get('outputHeightMM')}×${(config.get('baseThickness') + config.get('maxReliefHeight')).toFixed(1)}mm`;
    if (genEl) genEl.textContent = stats.generationTime ? stats.generationTime.toFixed(0) + 'ms' : '-';
    
    this.updateStatusBar(stats);
    this.updateLightInfo();
  }
  
  enableExport(enabled) {
    ['btn-export-stl', 'btn-export-obj', 'btn-export-scad', 'btn-export-config', 'btn-export-all-tiles'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  }
  
  showProgress(show, message = 'Generating geometry...') {
    if (this.progress) {
      this.progress.textContent = message;
      this.progress.classList.toggle('show', show);
    }
  }
  
  setGenerateEnabled(enabled) {
    const btn = document.getElementById('btn-generate');
    if (btn) btn.disabled = !enabled;
  }
}

// Global UI instance
let ui;