// Improved Geometry generation functions
const GeometryGenerator = {
  generatePoints: function(imageData, config) {
    debugLog('Generating adaptive point distribution...');
    
    const points = [];
    const { width, height, minShapeSize, maxShapeSize } = config;
    
    // Generate adaptive points based on image features
    const sampleStep = Math.min(minShapeSize / 2, 3); // Fine sampling for edge detection
    
    debugLog('Detecting edges and features...');
    
    // First pass: create edge strength map
    const edgeMap = [];
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const edge = ImageProcessor.getEdgeStrength(imageData, x, y, width, height, config);
        const brightness = ImageProcessor.getBrightness(imageData, x, y, width, height, config);
        edgeMap.push({ x, y, edge, brightness });
      }
    }
    
    // Sort by edge strength to prioritize high-detail areas
    edgeMap.sort((a, b) => b.edge - a.edge);
    
    // Second pass: place points with Poisson disk sampling for better distribution
    const cellSize = minShapeSize / Math.sqrt(2);
    const grid = {};
    
    const addPoint = (x, y, brightness, isEdge = false) => {
      const gridX = Math.floor(x / cellSize);
      const gridY = Math.floor(y / cellSize);
      const key = `${gridX},${gridY}`;
      
      // Check neighboring cells for minimum distance
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const checkKey = `${gridX + dx},${gridY + dy}`;
          if (grid[checkKey]) {
            const neighbor = grid[checkKey];
            const dist = Math.sqrt((x - neighbor.x) ** 2 + (y - neighbor.y) ** 2);
            const minDist = isEdge ? minShapeSize * 0.7 : minShapeSize;
            if (dist < minDist) return false;
          }
        }
      }
      
      const point = { x, y, brightness, isEdge };
      points.push(point);
      grid[key] = point;
      return true;
    };
    
    // Add edge points first (higher priority)
    let edgePointCount = 0;
    edgeMap.forEach(sample => {
      if (sample.edge > 0.15 && edgePointCount < edgeMap.length * 0.3) {
        if (addPoint(sample.x, sample.y, sample.brightness, true)) {
          edgePointCount++;
        }
      }
    });
    
    debugLog(`Added ${edgePointCount} edge points`);
    
    // Fill in with regular sampling for smooth areas
    const regularStep = (minShapeSize + maxShapeSize) / 2;
    for (let y = regularStep/2; y < height; y += regularStep) {
      for (let x = regularStep/2; x < width; x += regularStep) {
        const brightness = ImageProcessor.getBrightness(imageData, x, y, width, height, config);
        const localSize = minShapeSize + (maxShapeSize - minShapeSize) * brightness;
        const jitter = localSize * 0.25;
        
        const px = x + (Math.random() - 0.5) * jitter;
        const py = y + (Math.random() - 0.5) * jitter;
        
        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          addPoint(px, py, brightness, false);
        }
      }
    }
    
    debugLog(`Generated ${points.length} total adaptive points`);
    return points;
  },
  
  generateVoronoi: function(points, config) {
    debugLog('Generating Voronoi cells using Fortune\'s algorithm approximation...');
    
    const { width, height } = config;
    const polygons = [];
    
    // For each point, create a Voronoi cell by finding nearest neighbors
    points.forEach((point, idx) => {
      if (idx % 50 === 0) {
        debugLog(`Voronoi progress: ${idx}/${points.length}`);
      }
      
      // Find k nearest neighbors
      const neighbors = this.findNearestNeighbors(point, points, 8);
      
      // Create polygon vertices based on perpendicular bisectors
      const vertices = [];
      
      neighbors.forEach(neighbor => {
        // Midpoint between point and neighbor
        const mx = (point.x + neighbor.x) / 2;
        const my = (point.y + neighbor.y) / 2;
        
        // Perpendicular direction
        const dx = neighbor.y - point.y;
        const dy = point.x - neighbor.x;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Create vertices perpendicular to the connection
        const dist = len * 0.5;
        vertices.push({
          x: mx + (dx / len) * dist,
          y: my + (dy / len) * dist
        });
      });
      
      // Sort vertices by angle to create proper polygon
      const center = point;
      vertices.sort((a, b) => {
        const angleA = Math.atan2(a.y - center.y, a.x - center.x);
        const angleB = Math.atan2(b.y - center.y, b.x - center.x);
        return angleA - angleB;
      });
      
      // Clip to bounds
      const clipped = this.clipPolygonToBounds(vertices, 0, 0, width, height);
      
      if (clipped.length >= 3) {
        polygons.push({
          vertices: clipped,
          center: point,
          brightness: point.brightness || 0
        });
      }
    });
    
    debugLog(`Created ${polygons.length} Voronoi cells`);
    return polygons;
  },
  
  generateTriangles: function(points, config) {
    debugLog('Generating Delaunay triangulation with improved algorithm...');
    
    const triangles = [];
    const { width, height } = config;
    
    // Add boundary points for better triangulation
    const boundaryPoints = [
      { x: 0, y: 0, brightness: 0, boundary: true },
      { x: width, y: 0, brightness: 0, boundary: true },
      { x: width, y: height, brightness: 0, boundary: true },
      { x: 0, y: height, brightness: 0, boundary: true },
      { x: width/2, y: 0, brightness: 0, boundary: true },
      { x: width, y: height/2, brightness: 0, boundary: true },
      { x: width/2, y: height, brightness: 0, boundary: true },
      { x: 0, y: height/2, brightness: 0, boundary: true }
    ];
    
    const allPoints = [...points, ...boundaryPoints];
    
    // Simple incremental Delaunay
    const tris = this.simpleDelaunay(allPoints);
    
    // Filter and process triangles
    tris.forEach(tri => {
      // Skip if any vertex is way outside bounds (super triangle remnant)
      const inBounds = tri.every(v => 
        v.x >= -10 && v.x <= width + 10 && 
        v.y >= -10 && v.y <= height + 10
      );
      
      if (inBounds) {
        const avgBrightness = tri.reduce((sum, v) => sum + (v.brightness || 0), 0) / 3;
        triangles.push({
          vertices: tri,
          brightness: avgBrightness
        });
      }
    });
    
    debugLog(`Created ${triangles.length} triangles`);
    return triangles;
  },
  
  simpleDelaunay: function(points) {
    const triangles = [];
    
    if (points.length < 3) return triangles;
    
    // Sort points by x coordinate
    points.sort((a, b) => a.x - b.x || a.y - b.y);
    
    // Create initial triangle from first 3 points
    if (points.length >= 3) {
      triangles.push([points[0], points[1], points[2]]);
    }
    
    // Add remaining points
    for (let i = 3; i < points.length && i < 500; i++) { // Limit for performance
      const p = points[i];
      const newTriangles = [];
      const edges = [];
      
      // Find triangles whose circumcircle contains the point
      for (let t = triangles.length - 1; t >= 0; t--) {
        const tri = triangles[t];
        if (this.inCircumcircle(p, tri)) {
          // Remove triangle and add its edges
          edges.push([tri[0], tri[1]]);
          edges.push([tri[1], tri[2]]);
          edges.push([tri[2], tri[0]]);
          triangles.splice(t, 1);
        }
      }
      
      // Remove duplicate edges
      const uniqueEdges = [];
      for (let j = 0; j < edges.length; j++) {
        let isUnique = true;
        for (let k = 0; k < edges.length; k++) {
          if (j !== k && this.edgesEqual(edges[j], edges[k])) {
            isUnique = false;
            break;
          }
        }
        if (isUnique) uniqueEdges.push(edges[j]);
      }
      
      // Create new triangles
      uniqueEdges.forEach(edge => {
        triangles.push([edge[0], edge[1], p]);
      });
    }
    
    return triangles;
  },
  
  inCircumcircle: function(p, tri) {
    const [a, b, c] = tri;
    
    const ax = a.x - p.x;
    const ay = a.y - p.y;
    const bx = b.x - p.x;
    const by = b.y - p.y;
    const cx = c.x - p.x;
    const cy = c.y - p.y;
    
    const det = (ax * ax + ay * ay) * (bx * cy - cx * by) -
                (bx * bx + by * by) * (ax * cy - cx * ay) +
                (cx * cx + cy * cy) * (ax * by - bx * ay);
    
    return det > 0;
  },
  
  edgesEqual: function(e1, e2) {
    return (e1[0] === e2[0] && e1[1] === e2[1]) ||
           (e1[0] === e2[1] && e1[1] === e2[0]);
  },
  
  findNearestNeighbors: function(point, points, k) {
    const distances = points
      .filter(p => p !== point)
      .map(p => ({
        point: p,
        dist: Math.sqrt((p.x - point.x) ** 2 + (p.y - point.y) ** 2)
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k)
      .map(d => d.point);
    
    return distances;
  },
  
  clipPolygonToBounds: function(vertices, minX, minY, maxX, maxY) {
    let clipped = vertices;
    
    // Sutherland-Hodgman algorithm for each edge
    const edges = [
      { x1: minX, y1: minY, x2: maxX, y2: minY }, // top
      { x1: maxX, y1: minY, x2: maxX, y2: maxY }, // right
      { x1: maxX, y1: maxY, x2: minX, y2: maxY }, // bottom
      { x1: minX, y1: maxY, x2: minX, y2: minY }  // left
    ];
    
    edges.forEach(edge => {
      const newVertices = [];
      for (let i = 0; i < clipped.length; i++) {
        const v1 = clipped[i];
        const v2 = clipped[(i + 1) % clipped.length];
        
        const side1 = (v1.x - edge.x1) * (edge.y2 - edge.y1) - 
                      (v1.y - edge.y1) * (edge.x2 - edge.x1);
        const side2 = (v2.x - edge.x1) * (edge.y2 - edge.y1) - 
                      (v2.y - edge.y1) * (edge.x2 - edge.x1);
        
        if (side1 >= 0 && side2 >= 0) {
          newVertices.push(v2);
        } else if (side1 >= 0 && side2 < 0) {
          const intersection = this.lineIntersection(v1, v2, 
            { x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 });
          if (intersection) newVertices.push(intersection);
        } else if (side1 < 0 && side2 >= 0) {
          const intersection = this.lineIntersection(v1, v2,
            { x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 });
          if (intersection) newVertices.push(intersection);
          newVertices.push(v2);
        }
      }
      clipped = newVertices;
    });
    
    return clipped;
  },
  
  lineIntersection: function(p1, p2, p3, p4) {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 0.0001) return null;
    
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };
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
      
      debugLog(`Generated ${points.length} points, creating shapes...`);
      
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
      let processedShapes = 0;
      
      const lightDir = this.getLightDirection(config.lightSource);
      const maxTilt = (config.tiltAngle * Math.PI) / 180;
      
      shapes.forEach((shape, shapeIdx) => {
        if (shapeIdx % 100 === 0) {
          debugLog(`Mesh generation progress: ${shapeIdx}/${shapes.length}`);
        }
        
        const brightness = shape.brightness || 0;
        const height = brightness * config.maxHeight * config.heightExaggeration + config.baseThickness;
        const tiltAmount = brightness * maxTilt;
        
        const verts = shape.vertices;
        if (!verts || verts.length < 3) return; // Skip invalid shapes
        
        const centerX = verts.reduce((sum, v) => sum + v.x, 0) / verts.length;
        const centerY = verts.reduce((sum, v) => sum + v.y, 0) / verts.length;
        
        // Bottom vertices
        verts.forEach(v => {
          vertices.push(v.x - config.width/2, v.y - config.height/2, 0);
        });
        
        // Top vertices with tilt effect
        verts.forEach(v => {
          const dx = (v.x - centerX) / config.width;
          const dy = (v.y - centerY) / config.height;
          
          // Calculate tilt based on light direction
          const tiltX = lightDir.x * tiltAmount * dx * 10;
          const tiltY = lightDir.y * tiltAmount * dy * 10;
          const localHeight = height + Math.abs(lightDir.z) * tiltAmount * 2;
          
          vertices.push(
            v.x - config.width/2, 
            v.y - config.height/2, 
            localHeight + tiltX + tiltY
          );
        });
        
        const n = verts.length;
        
        // Top face - fan triangulation from center
        for (let i = 0; i < n - 1; i++) {
          indices.push(vertexOffset + n, vertexOffset + n + i, vertexOffset + n + i + 1);
        }
        indices.push(vertexOffset + n, vertexOffset + n + n - 1, vertexOffset + n); // Close the fan
        
        // Bottom face
        for (let i = 0; i < n - 1; i++) {
          indices.push(vertexOffset, vertexOffset + i + 1, vertexOffset + i);
        }
        indices.push(vertexOffset, vertexOffset, vertexOffset + n - 1); // Close the fan
        
        // Side faces
        for (let i = 0; i < n; i++) {
          const next = (i + 1) % n;
          indices.push(vertexOffset + i, vertexOffset + next, vertexOffset + n + next);
          indices.push(vertexOffset + i, vertexOffset + n + next, vertexOffset + n + i);
        }
        
        vertexOffset += n * 2;
        processedShapes++;
      });
      
      debugLog(`Generated mesh: ${vertices.length / 3} vertices, ${indices.length / 3} triangles from ${processedShapes} shapes`);
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