// Main React application component
const { useState, useRef, useEffect } = React;
// Add this right after the useRef declarations in app.js
useEffect(() => {
  debugLog('Checking if Three.js container is ready...');
  
  if (!threeContainerRef.current) {
    debugLog('Container not ready yet', 'warn');
    return;
  }
  
  if (viewerInitialized.current) {
    debugLog('Viewer already initialized', 'info');
    return;
  }
  
  debugLog('Initializing Three.js viewer (useEffect)...');
  const success = ThreeViewer.initialize(threeContainerRef.current, config);
  
  if (success) {
    viewerInitialized.current = true;
  }
  
  return () => {
    ThreeViewer.dispose();
    viewerInitialized.current = false;
  };
}, [threeContainerRef.current]);

const GeometricImageTo3D = () => {
  debugLog('=== GeometricImageTo3D component initializing ===');
  
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [config, setConfig] = useState({
    width: 200,
    height: 200,
    maxHeight: 10,
    baseThickness: 3,
    shapeType: 'voronoi',
    minShapeSize: 5,
    maxShapeSize: 20,
    preprocessContrast: 1.0,
    heightExaggeration: 1.5,
    contrast: 1.5,
    invertHeight: false,
    maintainAspectRatio: true,
    printerBedWidth: 220,
    printerBedHeight: 220,
    lightSource: 'ceiling',
    tiltAngle: 15,
    previewColor: '#cccccc',
  });
  const [stats, setStats] = useState({ polygons: 0, dimensions: '', warning: '', tiles: 1 });
  const [showSettings, setShowSettings] = useState(true);
  const [geometry, setGeometry] = useState(null);
  
  const threeContainerRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const viewerInitialized = useRef(false);

  const handleImageUpload = (e) => {
    debugLog('=== Image upload started ===');
    
    const file = e.target.files[0];
    if (!file) {
      debugLog('No file selected', 'warn');
      return;
    }
    
    debugLog(`File selected: ${file.name} (${file.size} bytes, ${file.type})`);
    
    const reader = new FileReader();
    
    reader.onerror = (error) => {
      debugLog(`FileReader error: ${error}`, 'error');
    };
    
    reader.onload = (event) => {
      debugLog('FileReader loaded, creating image...');
      
      const img = new Image();
      
      img.onerror = (error) => {
        debugLog(`Image load error: ${error}`, 'error');
      };
      
      img.onload = () => {
        debugLog(`Image loaded: ${img.width}x${img.height}px`);
        setImage(img);
        
        try {
          const data = ImageProcessor.preprocessImage(img, config.preprocessContrast);
          setImageData(data);
          debugLog('Image data set successfully');
          
          const aspectRatio = img.width / img.height;
          if (config.maintainAspectRatio) {
            setConfig(prev => ({
              ...prev,
              width: 200,
              height: Math.round(200 / aspectRatio)
            }));
            debugLog(`Dimensions set to 200 x ${Math.round(200 / aspectRatio)}mm`);
          }
          
        } catch (error) {
          debugLog(`Error processing image: ${error.message}`, 'error');
        }
      };
      
      img.src = event.target.result;
    };
    
    reader.readAsDataURL(file);
  };

  const handleDimensionChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    debugLog(`Dimension change: ${field} = ${numValue}`);
    
    if (config.maintainAspectRatio && image) {
      const aspectRatio = image.width / image.height;
      if (field === 'width') {
        setConfig(prev => ({
          ...prev,
          width: numValue,
          height: Math.round(numValue / aspectRatio)
        }));
      } else if (field === 'height') {
        setConfig(prev => ({
          ...prev,
          height: numValue,
          width: Math.round(numValue * aspectRatio)
        }));
      }
    } else {
      setConfig(prev => ({ ...prev, [field]: numValue }));
    }
  };

  // Initialize Three.js viewer
  useEffect(() => {
    if (!threeContainerRef.current || viewerInitialized.current) return;
    
    debugLog('Initializing Three.js viewer (useEffect)...');
    const success = ThreeViewer.initialize(threeContainerRef.current, config);
    
    if (success) {
      viewerInitialized.current = true;
    }
    
    return () => {
      ThreeViewer.dispose();
      viewerInitialized.current = false;
    };
  }, []);

  // Generate geometry when image or config changes
  useEffect(() => {
    if (!imageData) {
      debugLog('No image data, skipping geometry generation', 'info');
      return;
    }
    
    debugLog('=== Triggering geometry generation (useEffect) ===');
    
    try {
      const geom = GeometryGenerator.generate3DGeometry(imageData, config);
      
      if (geom) {
        setGeometry(geom);
        
        setStats({
          polygons: geom.indices.length / 3,
          dimensions: `${config.width}mm × ${config.height}mm × ${config.maxHeight + config.baseThickness}mm`,
          warning: '',
          tiles: 1
        });
        
        if (viewerInitialized.current) {
          ThreeViewer.updateMesh(geom, config);
        }
      } else {
        debugLog('Geometry generation returned null', 'error');
      }
      
    } catch (error) {
      debugLog(`Error in geometry generation: ${error.message}`, 'error');
      debugLog(`Stack: ${error.stack}`, 'error');
    }
    
  }, [imageData, config]);

  // Draw preview canvas
  const drawPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !image) {
      debugLog('Cannot draw preview: canvas or image missing', 'warn');
      return;
    }
    
    debugLog('Drawing preview canvas...');
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);
    
    ctx.filter = `contrast(${config.preprocessContrast * 100}%)`;
    
    const scale = Math.min(w / image.width, h / image.height);
    const imgW = image.width * scale;
    const imgH = image.height * scale;
    const x = (w - imgW) / 2;
    const y = (h - imgH) / 2;
    
    ctx.drawImage(image, x, y, imgW, imgH);
    debugLog('Preview canvas drawn');
  };

  useEffect(() => {
    if (image) {
      drawPreview();
    }
  }, [image, config.preprocessContrast]);

  const handleExportSTL = () => {
    debugLog('STL export button clicked');
    Exporters.exportSTL(geometry, 'geometric_image.stl');
  };

  const handleExportSCAD = () => {
    debugLog('SCAD export button clicked');
    Exporters.exportSCAD(geometry, config, 'geometric_image.scad');
  };

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold">3D Geometric Relief Generator</h1>
        <p className="text-gray-400 text-sm">Adaptive Voronoi & Triangle Relief Sculptures</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`bg-gray-800 border-r border-gray-700 overflow-y-auto transition-all ${showSettings ? 'w-80' : 'w-0'}`}>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Upload Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => {
                  debugLog('Upload button clicked');
                  fileInputRef.current?.click();
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <Upload size={18} />
                Choose Image
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Shape Type</label>
              <select
                value={config.shapeType}
                onChange={(e) => {
                  debugLog(`Shape type changed to: ${e.target.value}`);
                  setConfig(prev => ({ ...prev, shapeType: e.target.value }));
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="voronoi">Voronoi Cells</option>
                <option value="triangles">Triangles (Delaunay)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Min Shape Size: {config.minShapeSize}mm
              </label>
              <input
                type="range"
                min="2"
                max="20"
                value={config.minShapeSize}
                onChange={(e) => setConfig(prev => ({ ...prev, minShapeSize: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">For dark lines & edges</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Max Shape Size: {config.maxShapeSize}mm
              </label>
              <input
                type="range"
                min="10"
                max="50"
                value={config.maxShapeSize}
                onChange={(e) => setConfig(prev => ({ ...prev, maxShapeSize: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">For bright flat areas</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Pre-process Contrast: {config.preprocessContrast.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={config.preprocessContrast}
                onChange={(e) => setConfig(prev => ({ ...prev, preprocessContrast: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Enhance edges before processing</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Light Source</label>
              <select
                value={config.lightSource}
                onChange={(e) => setConfig(prev => ({ ...prev, lightSource: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="ceiling">Ceiling Light</option>
                <option value="left">Left Wall Light</option>
                <option value="right">Right Wall Light</option>
                <option value="front">Front Light</option>
                <option value="back">Back Light</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Surface Tilt: {config.tiltAngle}°
              </label>
              <input
                type="range"
                min="0"
                max="45"
                step="5"
                value={config.tiltAngle}
                onChange={(e) => setConfig(prev => ({ ...prev, tiltAngle: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Tilt surfaces toward light</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Preview Color</label>
              <input
                type="color"
                value={config.previewColor}
                onChange={(e) => setConfig(prev => ({ ...prev, previewColor: e.target.value }))}
                className="w-full h-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={config.maintainAspectRatio}
                  onChange={(e) => setConfig(prev => ({ ...prev, maintainAspectRatio: e.target.checked }))}
                />
                <span className="text-sm font-medium">Lock Aspect Ratio</span>
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Width (mm)</label>
                  <input
                    type="number"
                    value={config.width}
                    onChange={(e) => handleDimensionChange('width', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Height (mm)</label>
                  <input
                    type="number"
                    value={config.height}
                    onChange={(e) => handleDimensionChange('height', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Max Relief Height: {config.maxHeight}mm
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={config.maxHeight}
                onChange={(e) => setConfig(prev => ({ ...prev, maxHeight: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Height Exaggeration: {config.heightExaggeration.toFixed(1)}x
              </label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={config.heightExaggeration}
                onChange={(e) => setConfig(prev => ({ ...prev, heightExaggeration: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Contrast: {config.contrast.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={config.contrast}
                onChange={(e) => setConfig(prev => ({ ...prev, contrast: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div className="bg-gray-700 p-3 rounded space-y-1">
              <div className="text-xs text-gray-300">
                <div>Polygons: ~{stats.polygons.toLocaleString()}</div>
                <div>Dimensions: {stats.dimensions}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportSTL}
                disabled={!geometry}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <Download size={18} />
                STL
              </button>
              <button
                onClick={handleExportSCAD}
                disabled={!geometry}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <Download size={18} />
                SCAD
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="absolute top-20 left-2 z-10 bg-gray-700 hover:bg-gray-600 p-2 rounded"
          >
            <Settings size={20} />
          </button>

          <div className="flex-1 grid grid-cols-2 gap-4 p-4">
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-700 px-4 py-2 text-sm font-medium border-b border-gray-600">
                Original Image (Pre-processed)
              </div>
              <div className="p-4 flex items-center justify-center h-full">
                {!image ? (
                  <div className="text-gray-500 text-center">
                    <Upload size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Upload an image to get started</p>
                  </div>
                ) : (
                  <canvas
                    ref={previewCanvasRef}
                    width={600}
                    height={600}
                    className="max-w-full max-h-full"
                  />
                )}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-700 px-4 py-2 text-sm font-medium border-b border-gray-600">
                3D Preview
              </div>
              <div className="p-4 flex items-center justify-center h-full">
                {!image ? (
                  <div className="text-gray-500 text-center">
                    <Info size={48} className="mx-auto mb-2 opacity-50" />
                    <p>3D preview will appear here</p>
                  </div>
                ) : (
                  <div ref={threeContainerRef} className="w-full h-full flex items-center justify-center" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

debugLog('App.js loaded - GeometricImageTo3D component defined');