// Point generation with better adaptive distribution

class PointGenerator {
  static generate(analyzer, cfg) {
    const points = [];
    const { cellDensity, edgeSensitivity, jitter, adaptiveSizing, minCellScale, maxCellScale } = cfg;
    
    // Pre-compute edge map
    analyzer.computeSobel();
    
    const baseStep = 1 / cellDensity;
    const minDist = baseStep * 0.35;
    
    // Spatial hash grid for collision detection
    const gridSize = minDist;
    const grid = new Map();
    
    const getGridKey = (x, y) => `${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`;
    
    const canPlace = (x, y, minD) => {
      const gx = Math.floor(x / gridSize);
      const gy = Math.floor(y / gridSize);
      
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const cell = grid.get(`${gx + dx},${gy + dy}`);
          if (cell) {
            for (const p of cell) {
              const dist = Math.hypot(x - p.x, y - p.y);
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
      return true;
    };
    
    // 1. Add boundary points (corners and edges)
    const boundaryStep = baseStep * 0.4;
    
    // Corners first
    addPoint(0, 0, analyzer.getBrightness(0, 0, cfg), false, true);
    addPoint(1, 0, analyzer.getBrightness(1, 0, cfg), false, true);
    addPoint(0, 1, analyzer.getBrightness(0, 1, cfg), false, true);
    addPoint(1, 1, analyzer.getBrightness(1, 1, cfg), false, true);
    
    // Edges
    for (let t = boundaryStep; t < 1; t += boundaryStep) {
      addPoint(t, 0, analyzer.getBrightness(t, 0, cfg), false, true);
      addPoint(t, 1, analyzer.getBrightness(t, 1, cfg), false, true);
      addPoint(0, t, analyzer.getBrightness(0, t, cfg), false, true);
      addPoint(1, t, analyzer.getBrightness(1, t, cfg), false, true);
    }
    
    // 2. Generate interior points
    // Use a priority queue approach: place important points first
    const candidates = [];
    
    // Sample the image to find point candidates
    const sampleStep = baseStep * 0.5;
    for (let y = sampleStep; y < 1 - sampleStep * 0.5; y += sampleStep) {
      for (let x = sampleStep; x < 1 - sampleStep * 0.5; x += sampleStep) {
        const edge = analyzer.getEdgeStrength(x, y);
        const brightness = analyzer.getBrightness(x, y, cfg);
        const contrast = analyzer.getLocalContrast(x, y);
        
        // Priority: edges first, then high contrast areas
        const priority = edge * edgeSensitivity + contrast * 0.5;
        
        candidates.push({ x, y, brightness, edge, priority });
      }
    }
    
    // Sort by priority (high priority first)
    candidates.sort((a, b) => b.priority - a.priority);
    
    // Place points from priority queue
    for (const cand of candidates) {
      // Calculate local cell size based on brightness (if adaptive)
      let localMinDist = minDist;
      if (adaptiveSizing) {
        // Darker areas = smaller cells, brighter = larger
        const sizeScale = minCellScale + (maxCellScale - minCellScale) * cand.brightness;
        localMinDist = minDist * sizeScale;
      }
      
      // Add jitter
      const jx = (Math.random() - 0.5) * baseStep * jitter;
      const jy = (Math.random() - 0.5) * baseStep * jitter;
      
      const px = Math.max(0.02, Math.min(0.98, cand.x + jx));
      const py = Math.max(0.02, Math.min(0.98, cand.y + jy));
      
      if (canPlace(px, py, localMinDist)) {
        addPoint(px, py, analyzer.getBrightness(px, py, cfg), cand.edge > 0.3);
      }
      
      // For high-edge areas, try to add extra points
      if (cand.edge > 0.4 && edgeSensitivity > 0.5) {
        const extraDist = localMinDist * 0.7;
        for (let i = 0; i < 2; i++) {
          const ex = px + (Math.random() - 0.5) * baseStep;
          const ey = py + (Math.random() - 0.5) * baseStep;
          
          if (ex > 0.02 && ex < 0.98 && ey > 0.02 && ey < 0.98) {
            if (canPlace(ex, ey, extraDist)) {
              addPoint(ex, ey, analyzer.getBrightness(ex, ey, cfg), true);
            }
          }
        }
      }
    }
    
    console.log(`Generated ${points.length} points (${points.filter(p => p.isEdge).length} edge points)`);
    return points;
  }
}


// Main geometry generator
class GeometryGenerator {
  static generate(analyzer, cfg) {
    console.log('=== Starting geometry generation ===');
    const startTime = performance.now();
    
    // Generate adaptive point distribution
    const points = PointGenerator.generate(analyzer, cfg);
    console.log(`Point generation: ${(performance.now() - startTime).toFixed(0)}ms`);
    
    // Triangulate using Delaunay
    const triStart = performance.now();
    const triangles = Delaunay.triangulate(points);
    console.log(`Triangulation: ${(performance.now() - triStart).toFixed(0)}ms, ${triangles.length} triangles`);
    
    // Calculate per-triangle brightness (use center sampling for accuracy)
    for (const tri of triangles) {
      const [v0, v1, v2] = tri.vertices;
      
      // Triangle center
      tri.center = {
        x: (v0.x + v1.x + v2.x) / 3,
        y: (v0.y + v1.y + v2.y) / 3
      };
      
      // Sample brightness at center for more accurate representation
      const centerBrightness = analyzer.getBrightness(tri.center.x, tri.center.y, cfg);
      const vertexBrightness = (v0.brightness + v1.brightness + v2.brightness) / 3;
      
      // Blend center and vertex brightness
      tri.brightness = centerBrightness * 0.6 + vertexBrightness * 0.4;
      
      // Check boundary
      tri.isBoundary = v0.isBoundary || v1.isBoundary || v2.isBoundary;
    }
    
    const totalTime = performance.now() - startTime;
    console.log(`=== Generation complete: ${totalTime.toFixed(0)}ms ===`);
    
    return {
      points,
      triangles,
      stats: {
        pointCount: points.length,
        triangleCount: triangles.length,
        generationTime: totalTime
      }
    };
  }
}