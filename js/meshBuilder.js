// Convert 2D triangulation to 3D printable mesh with angled facets

class MeshBuilder {
  // Build 3D mesh from triangulation
  static build(geometry, cfg) {
    const { triangles } = geometry;
    const { 
      outputWidthMM, outputHeightMM, 
      baseThickness, maxReliefHeight, maxTiltAngle,
      reliefMethod
    } = cfg;
    
    // Get light direction for angle calculations
    const lightDir = config.getLightDirection();
    const maxTiltRad = maxTiltAngle * Math.PI / 180;
    
    const vertices = [];
    const indices = [];
    const normals = [];
    
    let vertexIndex = 0;
    
    for (const tri of triangles) {
      const [v0, v1, v2] = tri.vertices;
      const brightness = tri.brightness;
      
      // Convert normalized coords to mm, centered at origin
      const toMM = (v) => ({
        x: (v.x - 0.5) * outputWidthMM,
        y: (v.y - 0.5) * outputHeightMM
      });
      
      const p0 = toMM(v0);
      const p1 = toMM(v1);
      const p2 = toMM(v2);
      
      if (reliefMethod === 'angled') {
        // ANGLED FACET METHOD
        // Surface tilt based on brightness: bright faces light, dark faces away
        this.addAngledFacet(
          vertices, indices, normals, vertexIndex,
          p0, p1, p2, brightness,
          baseThickness, maxReliefHeight, maxTiltRad, lightDir
        );
      } else {
        // HEIGHTMAP METHOD
        // Simple height variation based on brightness
        this.addHeightmapFacet(
          vertices, indices, normals, vertexIndex,
          p0, p1, p2, 
          v0.brightness, v1.brightness, v2.brightness,
          baseThickness, maxReliefHeight
        );
      }
      
      vertexIndex += 8; // 4 bottom + 4 top vertices per facet (including center)
    }
    
    // Add bottom face (flat base)
    this.addBaseFace(vertices, indices, normals, vertexIndex, cfg);
    
    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      normals: new Float32Array(normals),
      triangleCount: indices.length / 3
    };
  }
  
  // Add an angled facet (the key to this approach)
  static addAngledFacet(verts, inds, norms, baseIdx, p0, p1, p2, brightness, baseZ, maxHeight, maxTilt, lightDir) {
    // Calculate facet center
    const cx = (p0.x + p1.x + p2.x) / 3;
    const cy = (p0.y + p1.y + p2.y) / 3;
    
    // Base height with slight variation based on brightness (for depth)
    const baseHeight = baseZ + brightness * maxHeight * 0.2;
    
    // Calculate tilt amount: 
    // brightness 1.0 -> tilt fully toward light (catches light)
    // brightness 0.5 -> no tilt (neutral)
    // brightness 0.0 -> tilt away from light (in shadow)
    const tiltFactor = (brightness - 0.5) * 2; // Range: -1 to 1
    const tiltAmount = tiltFactor * maxTilt;
    
    // Tilt axis is perpendicular to light direction in XY plane
    const tiltAxisX = -lightDir.y;
    const tiltAxisY = lightDir.x;
    const axisLen = Math.sqrt(tiltAxisX * tiltAxisX + tiltAxisY * tiltAxisY) || 1;
    const axisNormX = tiltAxisX / axisLen;
    const axisNormY = tiltAxisY / axisLen;
    
    // Calculate tilted surface normal
    const sinTilt = Math.sin(tiltAmount);
    const cosTilt = Math.cos(tiltAmount);
    
    // Normal starts as (0, 0, 1) and rotates around tilt axis
    const nx = sinTilt * axisNormX;
    const ny = sinTilt * axisNormY;
    const nz = cosTilt;
    
    // Calculate height at each vertex based on tilt
    // Height = baseHeight + dot(vertex_offset_from_center, tilt_gradient)
    const tiltGradientX = sinTilt * lightDir.x * maxHeight * 0.5;
    const tiltGradientY = sinTilt * lightDir.y * maxHeight * 0.5;
    
    const calcZ = (px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      return baseHeight + dx * tiltGradientX / 50 + dy * tiltGradientY / 50;
    };
    
    // Bottom vertices (at z = 0)
    const b0 = verts.length / 3;
    verts.push(p0.x, p0.y, 0);
    verts.push(p1.x, p1.y, 0);
    verts.push(p2.x, p2.y, 0);
    
    // Top vertices (tilted surface)
    const z0 = calcZ(p0.x, p0.y);
    const z1 = calcZ(p1.x, p1.y);
    const z2 = calcZ(p2.x, p2.y);
    
    verts.push(p0.x, p0.y, z0);
    verts.push(p1.x, p1.y, z1);
    verts.push(p2.x, p2.y, z2);
    
    // Normals
    // Bottom face normal (pointing down)
    norms.push(0, 0, -1, 0, 0, -1, 0, 0, -1);
    // Top face normal (tilted)
    norms.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    
    // Top face
    inds.push(b0 + 3, b0 + 4, b0 + 5);
    
    // Bottom face (reverse winding)
    inds.push(b0 + 0, b0 + 2, b0 + 1);
    
    // Side faces
    // Side 0-1
    const s0 = verts.length / 3;
    verts.push(p0.x, p0.y, 0, p1.x, p1.y, 0, p1.x, p1.y, z1, p0.x, p0.y, z0);
    const sn0 = this.calcSideNormal(p0, p1);
    norms.push(sn0.x, sn0.y, 0, sn0.x, sn0.y, 0, sn0.x, sn0.y, 0, sn0.x, sn0.y, 0);
    inds.push(s0, s0 + 1, s0 + 2, s0, s0 + 2, s0 + 3);
    
    // Side 1-2
    const s1 = verts.length / 3;
    verts.push(p1.x, p1.y, 0, p2.x, p2.y, 0, p2.x, p2.y, z2, p1.x, p1.y, z1);
    const sn1 = this.calcSideNormal(p1, p2);
    norms.push(sn1.x, sn1.y, 0, sn1.x, sn1.y, 0, sn1.x, sn1.y, 0, sn1.x, sn1.y, 0);
    inds.push(s1, s1 + 1, s1 + 2, s1, s1 + 2, s1 + 3);
    
    // Side 2-0
    const s2 = verts.length / 3;
    verts.push(p2.x, p2.y, 0, p0.x, p0.y, 0, p0.x, p0.y, z0, p2.x, p2.y, z2);
    const sn2 = this.calcSideNormal(p2, p0);
    norms.push(sn2.x, sn2.y, 0, sn2.x, sn2.y, 0, sn2.x, sn2.y, 0, sn2.x, sn2.y, 0);
    inds.push(s2, s2 + 1, s2 + 2, s2, s2 + 2, s2 + 3);
  }
  
  // Heightmap method - simpler but less effective
  static addHeightmapFacet(verts, inds, norms, baseIdx, p0, p1, p2, b0, b1, b2, baseZ, maxHeight) {
    const z0 = baseZ + b0 * maxHeight;
    const z1 = baseZ + b1 * maxHeight;
    const z2 = baseZ + b2 * maxHeight;
    
    // Bottom vertices
    const bi = verts.length / 3;
    verts.push(p0.x, p0.y, 0);
    verts.push(p1.x, p1.y, 0);
    verts.push(p2.x, p2.y, 0);
    
    // Top vertices
    verts.push(p0.x, p0.y, z0);
    verts.push(p1.x, p1.y, z1);
    verts.push(p2.x, p2.y, z2);
    
    // Calculate top face normal
    const tn = this.calcFaceNormal(
      { x: p0.x, y: p0.y, z: z0 },
      { x: p1.x, y: p1.y, z: z1 },
      { x: p2.x, y: p2.y, z: z2 }
    );
    
    // Normals
    norms.push(0, 0, -1, 0, 0, -1, 0, 0, -1);
    norms.push(tn.x, tn.y, tn.z, tn.x, tn.y, tn.z, tn.x, tn.y, tn.z);
    
    // Faces
    inds.push(bi + 3, bi + 4, bi + 5); // Top
    inds.push(bi + 0, bi + 2, bi + 1); // Bottom
    
    // Sides
    const addSide = (pa, pb, za, zb) => {
      const si = verts.length / 3;
      verts.push(pa.x, pa.y, 0, pb.x, pb.y, 0, pb.x, pb.y, zb, pa.x, pa.y, za);
      const sn = this.calcSideNormal(pa, pb);
      norms.push(sn.x, sn.y, 0, sn.x, sn.y, 0, sn.x, sn.y, 0, sn.x, sn.y, 0);
      inds.push(si, si + 1, si + 2, si, si + 2, si + 3);
    };
    
    addSide(p0, p1, z0, z1);
    addSide(p1, p2, z1, z2);
    addSide(p2, p0, z2, z0);
  }
  
  // Calculate outward-facing side normal
  static calcSideNormal(p0, p1) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular in XY plane, pointing outward
    return { x: dy / len, y: -dx / len };
  }
  
  // Calculate face normal from 3 points
  static calcFaceNormal(p0, p1, p2) {
    const ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z;
    const bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z;
    
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return { x: nx / len, y: ny / len, z: nz / len };
  }
  
  // Add flat base (for 3D printing)
  static addBaseFace(verts, inds, norms, baseIdx, cfg) {
    // The bottom faces are already added per-triangle
    // This could add a solid base plate if needed
  }
  
  // Build mesh for a specific tile
  static buildTile(geometry, cfg, tileCol, tileRow) {
    const tileInfo = config.getTileInfo();
    const { usableWidth, usableHeight, cols, rows } = tileInfo;
    
    // Calculate tile bounds in normalized coords
    const tileWidthNorm = 1 / cols;
    const tileHeightNorm = 1 / rows;
    
    const minX = tileCol * tileWidthNorm;
    const maxX = (tileCol + 1) * tileWidthNorm;
    const minY = tileRow * tileHeightNorm;
    const maxY = (tileRow + 1) * tileHeightNorm;
    
    // Filter triangles that intersect this tile
    const tileTriangles = geometry.triangles.filter(tri => {
      const [v0, v1, v2] = tri.vertices;
      // Check if any vertex is in tile bounds (simplified)
      const inBounds = (v) => v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY;
      return inBounds(v0) || inBounds(v1) || inBounds(v2) ||
             tri.center.x >= minX && tri.center.x <= maxX && 
             tri.center.y >= minY && tri.center.y <= maxY;
    });
    
    // Create tile-specific config with adjusted dimensions
    const tileCfg = {
      ...cfg,
      outputWidthMM: usableWidth + cfg.tileOverlap,
      outputHeightMM: usableHeight + cfg.tileOverlap
    };
    
    // Adjust vertex positions for tile offset
    const offsetTriangles = tileTriangles.map(tri => ({
      ...tri,
      vertices: tri.vertices.map(v => ({
        ...v,
        x: (v.x - minX) / tileWidthNorm,
        y: (v.y - minY) / tileHeightNorm
      }))
    }));
    
    return this.build({ triangles: offsetTriangles }, tileCfg);
  }
}