// Geometry generation functions
const GeometryGenerator = {
  generatePoints: function(imageData, config) {
    debugLog('Generating adaptive point distribution...');
    
    const points = [];
    const { width, height, minShapeSize, maxShapeSize } = config;
    
    // Use a regular grid with size based on min/max average
    const avgSize = (minShapeSize + maxShapeSize) / 2;
    const step = avgSize * 0.7; // Tighter grid for better coverage
    
    debugLog(`Using step size: ${step.toFixed(2)}mm`);
    
    let pointCount = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const brightness = ImageProcessor.getBrightness(imageData, x, y, width, height, config);
        points.push({ x, y, brightness });
        pointCount++;
      }
    }
    
    debugLog(`Generated ${pointCount} points in regular grid`);
    return points;
  },
  
  generateVoronoi: function(points, config) {
    debugLog('Generating Voronoi cells...');
    
    const { width, height } = config;
    const polygons = [];
    
    // Create simple octagons around each point
    points.forEach((point, idx) => {
      if (idx % 100 === 0) {
        debugLog(`Voronoi progress: ${idx}/${points.length}`);
      }
      
      const brightness = point.brightness || 0;
      const size = config.minShapeSize + (config.maxShapeSize - config.minShapeSize) * brightness;
      const verts = [];
      
      // Create octagon
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        verts.push({
          x: point.x + Math.cos(angle) * size * 0.5,
          y: point.y + Math.sin(angle) * size * 0.5
        });
      }
      
      polygons.push({
        vertices: verts,
        center: point,
        brightness: brightness
      });
    });
    
    debugLog(`Created ${polygons.length} Voronoi polygons`);
    return polygons;
  },
  
  generateTriangles: function(points, config) {
    debugLog('Generating Delaunay triangulation...');
    
    const triangles = [];
    
    // Create super triangle
    const maxDim = Math.max(config.width, config.height) * 2;
    const superTriangle = [
      { x: -maxDim, y: -maxDim, brightness: 0 },
      { x: maxDim * 2, y: -maxDim, brightness: 0 },
      { x: maxDim / 2, y: maxDim * 2, brightness: 0 }
    ];
    
    triangles.push({ vertices: superTriangle, valid: true });
    
    debugLog(`Processing ${points.length} points for triangulation...`);
    
    // Bowyer-Watson algorithm
    points.forEach((point, pointIdx) => {
      if (pointIdx % 100 === 0) {
        debugLog(`Triangulation progress: ${pointIdx}/${points.length}`, 'info');
      }
      
      const badTriangles = [];
      
      triangles.forEach((tri, idx) => {
        if (!tri.valid) return;
        
        const [a, b, c] = tri.vertices;
        const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        if (Math.abs(d) < 0.001) return;
        
        const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
        const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
        const r = Math.sqrt((a.x - ux) ** 2 + (a.y - uy) ** 2);
        
        const dist = Math.sqrt((point.x - ux) ** 2 + (point.y - uy) ** 2);
        
        if (dist < r) {
          badTriangles.push(idx);
        }
      });
      
      const polygon = [];
      badTriangles.forEach(idx => {
        const tri = triangles[idx];
        for (let i = 0; i < 3; i++) {
          const edge = [tri.vertices[i], tri.vertices[(i + 1) % 3]];
          let shared = false;
          
          badTriangles.forEach(otherIdx => {
            if (idx === otherIdx) return;
            const other = triangles[otherIdx];
            for (let j = 0; j < 3; j++) {
              const otherEdge = [other.vertices[j], other.vertices[(j + 1) % 3]];
              if ((edge[0] === otherEdge[0] && edge[1] === otherEdge[1]) ||
                  (edge[0] === otherEdge[1] && edge[1] === otherEdge[0])) {
                shared = true;
              }
            }
          });
          
          if (!shared) polygon.push(edge);
        }
      });
      
      badTriangles.forEach(idx => {
        triangles[idx].valid = false;
      });
      
      polygon.forEach(edge => {
        triangles.push({
          vertices: [edge[0], edge[1], point],
          valid: true
        });
      });
    });
    
    const finalTriangles = triangles.filter(tri => {
      if (!tri.valid) return false;
      return !tri.vertices.some(v => 
        superTriangle.some(sv => v.x === sv.x && v.y === sv.y)
      );
    }).map(tri => {
      const avgBrightness = tri.vertices.reduce((sum, v) => sum + (v.brightness || 0), 0) / 3;
      return {
        vertices: tri.vertices,
        brightness: avgBrightness
      };
    });
    
    debugLog(`Created ${finalTriangles.length} triangles`);
    return finalTriangles;
  },
  
  getLightDirection: function(lightSource) {
    const directions = {
      'ceiling': { x: 0, y: 0, z: 1 },
      'left': { x: -1, y: 0, z: 0.3 },
      'right': { x: 1, y: 0, z: 0.3 },
      'front': { x: 0, y: -1, z: 0.3 },
      'back': { x: 0, y: 1, z: 0.3 }
    };
    
    return directions[lightSource] || directions.ceiling;
  },
  
  generate3DGeometry: function(imageData, config) {
    debugLog('=== Starting 3D geometry generation ===');
    
    if (!imageData) {
      debugLog('ERROR: No image data provided', 'error');
      return null;
    }
    
    try {
      const points = this.generatePoints(imageData, config);
      
      if (points.length === 0) {
        debugLog('ERROR: No points generated', 'error');
        return null;
      }
      
      const shapes = config.shapeType === 'voronoi' 
        ? this.generateVoronoi(points, config) 
        : this.generateTriangles(points, config);
      
      if (!shapes || shapes.length === 0) {
        debugLog('ERROR: No shapes generated', 'error');
        return null;
      }
      
      debugLog(`Converting ${shapes.length} shapes to 3D mesh...`);
      
      const vertices = [];
      const indices = [];
      let vertexOffset = 0;
      
      const lightDir = this.getLightDirection(config.lightSource);
      const maxTilt = (config.tiltAngle * Math.PI) / 180;
      
      debugLog(`Light direction: (${lightDir.x}, ${lightDir.y}, ${lightDir.z})`);
      debugLog(`Max tilt angle: ${config.tiltAngle}°`);
      
      shapes.forEach((shape, shapeIdx) => {
        const brightness = shape.brightness || 0;
        const height = brightness * config.maxHeight + config.baseThickness;
        const tiltAmount = brightness * maxTilt;
        
        const verts = shape.vertices;
        const centerX = verts.reduce((sum, v) => sum + v.x, 0) / verts.length;
        const centerY = verts.reduce((sum, v) => sum + v.y, 0) / verts.length;
        
        // Bottom vertices
        verts.forEach(v => {
          vertices.push(v.x, v.y, 0);
        });
        
        // Top vertices with tilt
        verts.forEach(v => {
          const dx = v.x - centerX;
          const dy = v.y - centerY;
          const tiltX = lightDir.x * tiltAmount * dx * 0.1;
          const tiltY = lightDir.y * tiltAmount * dy * 0.1;
          const tiltZ = Math.abs(lightDir.z) * tiltAmount;
          
          vertices.push(v.x, v.y, height + tiltZ + tiltX + tiltY);
        });
        
        const n = verts.length;
        
        // Top face
        for (let i = 1; i < n - 1; i++) {
          indices.push(vertexOffset + n, vertexOffset + n + i, vertexOffset + n + i + 1);
        }
        
        // Bottom face
        for (let i = 1; i < n - 1; i++) {
          indices.push(vertexOffset, vertexOffset + i + 1, vertexOffset + i);
        }
        
        // Side faces
        for (let i = 0; i < n; i++) {
          const next = (i + 1) % n;
          indices.push(vertexOffset + i, vertexOffset + next, vertexOffset + n + next);
          indices.push(vertexOffset + i, vertexOffset + n + next, vertexOffset + n + i);
        }
        
        vertexOffset += n * 2;
      });
      
      debugLog(`Generated mesh: ${vertices.length / 3} vertices, ${indices.length / 3} triangles`);
      debugLog('=== 3D geometry generation complete ===');
      
      return { 
        vertices: new Float32Array(vertices), 
        indices: new Uint32Array(indices), 
        shapes 
      };
      
    } catch (error) {
      debugLog(`ERROR in geometry generation: ${error.message}`, 'error');
      debugLog(`Stack: ${error.stack}`, 'error');
      return null;
    }
  }
};

debugLog('GeometryGenerator loaded');