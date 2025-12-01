// Convert 2D triangulation to 3D printable mesh with MUCH more dramatic angled facets

class MeshBuilder {
  // Build 3D mesh from triangulation
  static build(geometry, cfg) {
    const { triangles } = geometry;
    const { 
      outputWidthMM, outputHeightMM, 
      baseThickness, maxReliefHeight, maxTiltAngle,
      reliefMethod, heightVariation, facetSharpness
    } = cfg;
    
    // Get light direction for angle calculations
    const lightDir = config.getLightDirection();
    const maxTiltRad = maxTiltAngle * Math.PI / 180;
    
    const vertices = [];
    const indices = [];
    
    console.log(`Building mesh: ${triangles.length} triangles, method=${reliefMethod}, tilt=${maxTiltAngle}°`);
    
    for (const tri of triangles) {
      const [v0, v1, v2] = tri.vertices;
      
      // Use triangle center brightness for uniform facet angle
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
        this.addAngledFacet(
          vertices, indices,
          p0, p1, p2, brightness,
          baseThickness, maxReliefHeight, maxTiltRad, 
          lightDir, heightVariation, facetSharpness
        );
      } else if (reliefMethod === 'hybrid') {
        this.addHybridFacet(
          vertices, indices,
          p0, p1, p2, brightness,
          v0.brightness, v1.brightness, v2.brightness,
          baseThickness, maxReliefHeight, maxTiltRad, 
          lightDir, heightVariation
        );
      } else {
        this.addHeightmapFacet(
          vertices, indices,
          p0, p1, p2, 
          v0.brightness, v1.brightness, v2.brightness,
          baseThickness, maxReliefHeight
        );
      }
    }
    
    console.log(`Mesh complete: ${vertices.length / 3} vertices, ${indices.length / 3} triangles`);
    
    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      triangleCount: indices.length / 3
    };
  }
  
  // DRAMATICALLY improved angled facet
  static addAngledFacet(verts, inds, p0, p1, p2, brightness, baseZ, maxHeight, maxTilt, lightDir, heightVar, sharpness) {
    // Calculate facet center
    const cx = (p0.x + p1.x + p2.x) / 3;
    const cy = (p0.y + p1.y + p2.y) / 3;
    
    // === KEY CHANGE: Much more aggressive tilt mapping ===
    // Map brightness to tilt: 
    //   brightness 1.0 (white) -> tilt TOWARD light (positive tilt)
    //   brightness 0.5 (mid)   -> no tilt
    //   brightness 0.0 (black) -> tilt AWAY from light (negative tilt)
    
    // Apply power curve to exaggerate mid-tones
    const adjustedBrightness = Math.pow(brightness, 0.7); // Boost midtones
    
    // Tilt factor: -1 to +1
    const tiltFactor = (adjustedBrightness - 0.5) * 2;
    
    // Apply sharpness - higher sharpness = more extreme angles
    const sharpTilt = Math.sign(tiltFactor) * Math.pow(Math.abs(tiltFactor), 1 / (sharpness + 0.5));
    
    const tiltAmount = sharpTilt * maxTilt;
    
    // Base height varies with brightness for additional depth cue
    const heightOffset = brightness * maxHeight * heightVar;
    const baseHeight = baseZ + heightOffset;
    
    // Tilt axis perpendicular to light direction (in XY plane)
    const tiltAxisX = -lightDir.y;
    const tiltAxisY = lightDir.x;
    const axisLen = Math.sqrt(tiltAxisX * tiltAxisX + tiltAxisY * tiltAxisY) || 1;
    
    // Calculate height at each vertex based on distance from center along tilt direction
    // This creates a tilted plane
    const tiltDirX = lightDir.x;
    const tiltDirY = lightDir.y;
    
    const calcZ = (px, py) => {
      // Distance from center along light direction
      const dx = px - cx;
      const dy = py - cy;
      
      // Project onto light direction
      const distAlongLight = dx * tiltDirX + dy * tiltDirY;
      
      // Height offset based on tilt
      const tiltOffset = distAlongLight * Math.tan(tiltAmount);
      
      return baseHeight + tiltOffset;
    };
    
    const z0 = calcZ(p0.x, p0.y);
    const z1 = calcZ(p1.x, p1.y);
    const z2 = calcZ(p2.x, p2.y);
    
    // Ensure minimum thickness
    const minZ = Math.min(z0, z1, z2);
    const zOffset = minZ < baseZ * 0.5 ? baseZ * 0.5 - minZ : 0;
    
    // Add vertices
    const bi = verts.length / 3;
    
    // Bottom vertices (z = 0)
    verts.push(p0.x, p0.y, 0);
    verts.push(p1.x, p1.y, 0);
    verts.push(p2.x, p2.y, 0);
    
    // Top vertices (tilted)
    verts.push(p0.x, p0.y, z0 + zOffset);
    verts.push(p1.x, p1.y, z1 + zOffset);
    verts.push(p2.x, p2.y, z2 + zOffset);
    
    // Top face
    inds.push(bi + 3, bi + 4, bi + 5);
    
    // Bottom face (reversed winding)
    inds.push(bi + 0, bi + 2, bi + 1);
    
    // Side faces
    this.addSideFace(verts, inds, p0, p1, 0, 0, z0 + zOffset, z1 + zOffset);
    this.addSideFace(verts, inds, p1, p2, 0, 0, z1 + zOffset, z2 + zOffset);
    this.addSideFace(verts, inds, p2, p0, 0, 0, z2 + zOffset, z0 + zOffset);
  }
  
  // Hybrid: combines tilt with per-vertex height variation
  static addHybridFacet(verts, inds, p0, p1, p2, avgBrightness, b0, b1, b2, baseZ, maxHeight, maxTilt, lightDir, heightVar) {
    const cx = (p0.x + p1.x + p2.x) / 3;
    const cy = (p0.y + p1.y + p2.y) / 3;
    
    // Tilt based on average brightness
    const tiltFactor = (avgBrightness - 0.5) * 2;
    const tiltAmount = tiltFactor * maxTilt;
    
    const tiltDirX = lightDir.x;
    const tiltDirY = lightDir.y;
    
    const calcZ = (px, py, localBrightness) => {
      const dx = px - cx;
      const dy = py - cy;
      const distAlongLight = dx * tiltDirX + dy * tiltDirY;
      const tiltOffset = distAlongLight * Math.tan(tiltAmount);
      
      // Add per-vertex height variation
      const heightOffset = localBrightness * maxHeight * heightVar;
      
      return baseZ + heightOffset + tiltOffset;
    };
    
    const z0 = calcZ(p0.x, p0.y, b0);
    const z1 = calcZ(p1.x, p1.y, b1);
    const z2 = calcZ(p2.x, p2.y, b2);
    
    const minZ = Math.min(z0, z1, z2);
    const zOffset = minZ < baseZ * 0.3 ? baseZ * 0.3 - minZ : 0;
    
    const bi = verts.length / 3;
    
    verts.push(p0.x, p0.y, 0);
    verts.push(p1.x, p1.y, 0);
    verts.push(p2.x, p2.y, 0);
    verts.push(p0.x, p0.y, z0 + zOffset);
    verts.push(p1.x, p1.y, z1 + zOffset);
    verts.push(p2.x, p2.y, z2 + zOffset);
    
    inds.push(bi + 3, bi + 4, bi + 5);
    inds.push(bi + 0, bi + 2, bi + 1);
    
    this.addSideFace(verts, inds, p0, p1, 0, 0, z0 + zOffset, z1 + zOffset);
    this.addSideFace(verts, inds, p1, p2, 0, 0, z1 + zOffset, z2 + zOffset);
    this.addSideFace(verts, inds, p2, p0, 0, 0, z2 + zOffset, z0 + zOffset);
  }
  
  // Pure heightmap
  static addHeightmapFacet(verts, inds, p0, p1, p2, b0, b1, b2, baseZ, maxHeight) {
    const z0 = baseZ + b0 * maxHeight;
    const z1 = baseZ + b1 * maxHeight;
    const z2 = baseZ + b2 * maxHeight;
    
    const bi = verts.length / 3;
    
    verts.push(p0.x, p0.y, 0);
    verts.push(p1.x, p1.y, 0);
    verts.push(p2.x, p2.y, 0);
    verts.push(p0.x, p0.y, z0);
    verts.push(p1.x, p1.y, z1);
    verts.push(p2.x, p2.y, z2);
    
    inds.push(bi + 3, bi + 4, bi + 5);
    inds.push(bi + 0, bi + 2, bi + 1);
    
    this.addSideFace(verts, inds, p0, p1, 0, 0, z0, z1);
    this.addSideFace(verts, inds, p1, p2, 0, 0, z1, z2);
    this.addSideFace(verts, inds, p2, p0, 0, 0, z2, z0);
  }
  
  // Add a side face (quad as 2 triangles)
  static addSideFace(verts, inds, pa, pb, za0, zb0, za1, zb1) {
    const bi = verts.length / 3;
    
    // Four corners of the side quad
    verts.push(pa.x, pa.y, za0);  // bottom-left
    verts.push(pb.x, pb.y, zb0);  // bottom-right
    verts.push(pb.x, pb.y, zb1);  // top-right
    verts.push(pa.x, pa.y, za1);  // top-left
    
    // Two triangles (ensure outward-facing normals)
    inds.push(bi, bi + 1, bi + 2);
    inds.push(bi, bi + 2, bi + 3);
  }
  
  // Build mesh for a specific tile
  static buildTile(geometry, cfg, tileCol, tileRow) {
    const tileInfo = config.getTileInfo();
    const { usableWidth, usableHeight, cols, rows } = tileInfo;
    
    const tileWidthNorm = 1 / cols;
    const tileHeightNorm = 1 / rows;
    
    const minX = tileCol * tileWidthNorm;
    const maxX = (tileCol + 1) * tileWidthNorm;
    const minY = tileRow * tileHeightNorm;
    const maxY = (tileRow + 1) * tileHeightNorm;
    
    // Filter and transform triangles for this tile
    const tileTriangles = [];
    
    for (const tri of geometry.triangles) {
      const [v0, v1, v2] = tri.vertices;
      
      // Check if triangle intersects tile
      const inTile = (v) => v.x >= minX - 0.01 && v.x <= maxX + 0.01 && 
                           v.y >= minY - 0.01 && v.y <= maxY + 0.01;
      
      if (inTile(v0) || inTile(v1) || inTile(v2) || 
          (tri.center.x >= minX && tri.center.x <= maxX && 
           tri.center.y >= minY && tri.center.y <= maxY)) {
        
        // Remap vertices to tile coords
        tileTriangles.push({
          ...tri,
          vertices: tri.vertices.map(v => ({
            ...v,
            x: (v.x - minX) / tileWidthNorm,
            y: (v.y - minY) / tileHeightNorm
          })),
          center: {
            x: (tri.center.x - minX) / tileWidthNorm,
            y: (tri.center.y - minY) / tileHeightNorm
          }
        });
      }
    }
    
    const tileCfg = {
      ...cfg,
      outputWidthMM: usableWidth + cfg.tileOverlap,
      outputHeightMM: usableHeight + cfg.tileOverlap
    };
    
    return this.build({ triangles: tileTriangles }, tileCfg);
  }
}