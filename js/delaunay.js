// Bowyer-Watson Delaunay Triangulation
// Produces high-quality triangulation for relief generation

class Delaunay {
  static triangulate(points) {
    if (points.length < 3) return [];
    
    // Find bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    
    // Add margin
    const dx = (maxX - minX) || 1;
    const dy = (maxY - minY) || 1;
    const margin = Math.max(dx, dy) * 10;
    
    // Create super triangle that contains all points
    const superTri = [
      { x: minX - margin, y: minY - margin, isSuper: true },
      { x: maxX + margin * 2, y: minY - margin, isSuper: true },
      { x: (minX + maxX) / 2, y: maxY + margin * 2, isSuper: true }
    ];
    
    // Initialize with super triangle
    let triangles = [{ 
      vertices: superTri,
      circle: this.circumcircle(superTri)
    }];
    
    // Add each point
    for (const point of points) {
      triangles = this.addPoint(triangles, point);
    }
    
    // Remove triangles connected to super triangle
    triangles = triangles.filter(tri => 
      !tri.vertices.some(v => v.isSuper)
    );
    
    return triangles;
  }
  
  static addPoint(triangles, point) {
    const badTriangles = [];
    const polygon = [];
    
    // Find all triangles whose circumcircle contains the point
    for (const tri of triangles) {
      if (this.pointInCircumcircle(point, tri.circle)) {
        badTriangles.push(tri);
      }
    }
    
    // Find the boundary polygon of the bad triangles
    for (const tri of badTriangles) {
      for (let i = 0; i < 3; i++) {
        const edge = [tri.vertices[i], tri.vertices[(i + 1) % 3]];
        
        // Check if this edge is shared with another bad triangle
        let isShared = false;
        for (const other of badTriangles) {
          if (other === tri) continue;
          
          for (let j = 0; j < 3; j++) {
            const otherEdge = [other.vertices[j], other.vertices[(j + 1) % 3]];
            if (this.edgesEqual(edge, otherEdge)) {
              isShared = true;
              break;
            }
          }
          if (isShared) break;
        }
        
        if (!isShared) {
          polygon.push(edge);
        }
      }
    }
    
    // Remove bad triangles
    const newTriangles = triangles.filter(t => !badTriangles.includes(t));
    
    // Create new triangles from polygon edges to the new point
    for (const edge of polygon) {
      const newVerts = [edge[0], edge[1], point];
      newTriangles.push({
        vertices: newVerts,
        circle: this.circumcircle(newVerts)
      });
    }
    
    return newTriangles;
  }
  
  static circumcircle(vertices) {
    const [a, b, c] = vertices;
    
    const ax = a.x, ay = a.y;
    const bx = b.x, by = b.y;
    const cx = c.x, cy = c.y;
    
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    
    if (Math.abs(d) < 1e-10) {
      // Degenerate triangle
      return { x: ax, y: ay, r: Infinity };
    }
    
    const ux = ((ax*ax + ay*ay) * (by - cy) + (bx*bx + by*by) * (cy - ay) + (cx*cx + cy*cy) * (ay - by)) / d;
    const uy = ((ax*ax + ay*ay) * (cx - bx) + (bx*bx + by*by) * (ax - cx) + (cx*cx + cy*cy) * (bx - ax)) / d;
    
    const r = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);
    
    return { x: ux, y: uy, r };
  }
  
  static pointInCircumcircle(point, circle) {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    return Math.sqrt(dx * dx + dy * dy) < circle.r;
  }
  
  static edgesEqual(e1, e2) {
    return (e1[0] === e2[0] && e1[1] === e2[1]) ||
           (e1[0] === e2[1] && e1[1] === e2[0]);
  }
  
  // Convert triangulation result to indexed format for Three.js
  static toIndexedGeometry(triangles) {
    const vertexMap = new Map();
    const vertices = [];
    const indices = [];
    const triangleData = []; // Store per-triangle data
    
    let vertexIndex = 0;
    
    for (const tri of triangles) {
      const triIndices = [];
      
      for (const v of tri.vertices) {
        const key = `${v.x.toFixed(6)},${v.y.toFixed(6)}`;
        
        if (!vertexMap.has(key)) {
          vertexMap.set(key, vertexIndex);
          vertices.push(v);
          vertexIndex++;
        }
        
        triIndices.push(vertexMap.get(key));
      }
      
      indices.push(...triIndices);
      triangleData.push({
        indices: triIndices,
        center: {
          x: (tri.vertices[0].x + tri.vertices[1].x + tri.vertices[2].x) / 3,
          y: (tri.vertices[0].y + tri.vertices[1].y + tri.vertices[2].y) / 3
        },
        brightness: (tri.vertices[0].brightness + tri.vertices[1].brightness + tri.vertices[2].brightness) / 3
      });
    }
    
    return { vertices, indices, triangleData };
  }
}