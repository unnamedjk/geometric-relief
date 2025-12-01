// Point generation and distribution for relief geometry

class PointGenerator {
  // Generate adaptively distributed points based on image features
  static generate(analyzer, cfg) {
    const points = [];
    const { cellDensity, edgeSensitivity, jitter } = cfg;
    
    // Build edge map for adaptive density
    analyzer.buildEdgeMap(Math.max(100, cellDensity * 2));
    
    const baseStep = 1 / cellDensity;
    const minDist = baseStep * 0.4; // Minimum distance between points
    
    // Grid for spatial hashing (fast neighbor lookup)
    const grid = new Map();
    const gridSize = minDist;
    
    const getGridKey = (x, y) => {
      const gx = Math.floor(x / gridSize);
      const gy = Math.floor(y / gridSize);
      return `${gx},${gy}`;
    };
    
    const canPlace = (x, y, minD) => {
      const gx = Math.floor(x / gridSize);
      const gy = Math.floor(y / gridSize);
      
      // Check neighboring cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${gx + dx},${gy + dy}`;
          const cell = grid.get(key);
          if (cell) {
            for (const p of cell) {
              const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
              if (dist < minD) return false;
            }
          }
        }
      }
      return true;
    };
    
    const addPoint = (x, y, brightness, isEdge = false, isBoundary = false) => {
      const key = getGridKey(x, y);
      if (!grid.has(key)) grid.set(key, []);
      
      const point = { x, y, brightness, isEdge, isBoundary };
      grid.get(key).push(point);
      points.push(point);
    };
    
    // First pass: Add boundary points for clean edges
    const boundaryStep = baseStep * 0.5;
    for (let t = 0; t <= 1; t += boundaryStep) {
      // Top edge
      addPoint(t, 0, analyzer.getBrightness(t, 0, cfg), false, true);
      // Bottom edge  
      addPoint(t, 1, analyzer.getBrightness(t, 1, cfg), false, true);
      // Left edge
      if (t > 0 && t < 1) {
        addPoint(0, t, analyzer.getBrightness(0, t, cfg), false, true);
        addPoint(1, t, analyzer.getBrightness(1, t, cfg), false, true);
      }
    }
    
    // Corners
    addPoint(0, 0, analyzer.getBrightness(0, 0, cfg), false, true);
    addPoint(1, 0, analyzer.getBrightness(1, 0, cfg), false, true);
    addPoint(0, 1, analyzer.getBrightness(0, 1, cfg), false, true);
    addPoint(1, 1, analyzer.getBrightness(1, 1, cfg), false, true);
    
    // Second pass: Edge-aware point distribution
    // More points in high-detail areas
    for (let y = baseStep; y < 1; y += baseStep) {
      for (let x = baseStep; x < 1; x += baseStep) {
        const edge = analyzer.getEdgeStrengthFast(x, y);
        const brightness = analyzer.getBrightness(x, y, cfg);
        
        // Adaptive density based on edge strength
        const localDensity = 1 + edge * edgeSensitivity * 2;
        const localStep = baseStep / localDensity;
        
        // Add jitter
        const jx = (Math.random() - 0.5) * localStep * jitter;
        const jy = (Math.random() - 0.5) * localStep * jitter;
        
        const px = Math.max(0.01, Math.min(0.99, x + jx));
        const py = Math.max(0.01, Math.min(0.99, y + jy));
        
        // Check minimum distance
        const adaptiveMinDist = minDist / localDensity;
        if (canPlace(px, py, adaptiveMinDist)) {
          addPoint(px, py, analyzer.getBrightness(px, py, cfg), edge > 0.3);
        }
        
        // Add extra points in high-edge areas
        if (edge > 0.4 && localDensity > 1.5) {
          const extraCount = Math.floor(localDensity - 1);
          for (let e = 0; e < extraCount; e++) {
            const ex = px + (Math.random() - 0.5) * localStep;
            const ey = py + (Math.random() - 0.5) * localStep;
            
            if (ex > 0.01 && ex < 0.99 && ey > 0.01 && ey < 0.99) {
              if (canPlace(ex, ey, adaptiveMinDist * 0.8)) {
                addPoint(ex, ey, analyzer.getBrightness(ex, ey, cfg), true);
              }
            }
          }
        }
      }
    }
    
    console.log(`Generated ${points.length} points`);
    return points;
  }
  
  // Generate uniform grid points (simpler, faster)
  static generateUniform(analyzer, cfg) {
    const points = [];
    const { cellDensity, jitter } = cfg;
    const step = 1 / cellDensity;
    
    for (let y = 0; y <= 1; y += step) {
      for (let x = 0; x <= 1; x += step) {
        const isBoundary = x === 0 || x >= 1 - step/2 || y === 0 || y >= 1 - step/2;
        
        let px = x, py = y;
        if (!isBoundary && jitter > 0) {
          px += (Math.random() - 0.5) * step * jitter;
          py += (Math.random() - 0.5) * step * jitter;
          px = Math.max(0, Math.min(1, px));
          py = Math.max(0, Math.min(1, py));
        }
        
        points.push({
          x: px,
          y: py,
          brightness: analyzer.getBrightness(px, py, cfg),
          isBoundary
        });
      }
    }
    
    return points;
  }
}


// Main geometry generator
class GeometryGenerator {
  static generate(analyzer, cfg) {
    console.log('Starting geometry generation...');
    const startTime = performance.now();
    
    // Generate points
    const points = PointGenerator.generate(analyzer, cfg);
    console.log(`Point generation: ${(performance.now() - startTime).toFixed(0)}ms`);
    
    // Triangulate
    const triStart = performance.now();
    const triangles = Delaunay.triangulate(points);
    console.log(`Triangulation: ${(performance.now() - triStart).toFixed(0)}ms, ${triangles.length} triangles`);
    
    // Calculate per-triangle data
    for (const tri of triangles) {
      const [v0, v1, v2] = tri.vertices;
      tri.center = {
        x: (v0.x + v1.x + v2.x) / 3,
        y: (v0.y + v1.y + v2.y) / 3
      };
      tri.brightness = (v0.brightness + v1.brightness + v2.brightness) / 3;
      
      // Check if any vertex is a boundary point
      tri.isBoundary = v0.isBoundary || v1.isBoundary || v2.isBoundary;
    }
    
    console.log(`Total generation time: ${(performance.now() - startTime).toFixed(0)}ms`);
    
    return {
      points,
      triangles,
      stats: {
        pointCount: points.length,
        triangleCount: triangles.length,
        generationTime: performance.now() - startTime
      }
    };
  }
}