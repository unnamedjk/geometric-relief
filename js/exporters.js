// Export functions for STL, OBJ, and OpenSCAD

class Exporters {
  // Export binary STL (smaller file size)
  static exportSTLBinary(meshData, filename = 'relief.stl') {
    const { vertices, indices } = meshData;
    const triangleCount = indices.length / 3;
    
    // Binary STL: 80 byte header + 4 byte count + 50 bytes per triangle
    const bufferSize = 84 + triangleCount * 50;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    
    // Header (80 bytes)
    const header = 'Binary STL - Angled Facet Relief Generator';
    for (let i = 0; i < 80; i++) {
      view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
    }
    
    // Triangle count
    view.setUint32(80, triangleCount, true);
    
    let offset = 84;
    
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      
      const v0 = { x: vertices[i0], y: vertices[i0 + 1], z: vertices[i0 + 2] };
      const v1 = { x: vertices[i1], y: vertices[i1 + 1], z: vertices[i1 + 2] };
      const v2 = { x: vertices[i2], y: vertices[i2 + 1], z: vertices[i2 + 2] };
      
      // Calculate normal
      const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z;
      const bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      
      // Normal
      view.setFloat32(offset, nx / len, true); offset += 4;
      view.setFloat32(offset, ny / len, true); offset += 4;
      view.setFloat32(offset, nz / len, true); offset += 4;
      
      // Vertices
      view.setFloat32(offset, v0.x, true); offset += 4;
      view.setFloat32(offset, v0.y, true); offset += 4;
      view.setFloat32(offset, v0.z, true); offset += 4;
      
      view.setFloat32(offset, v1.x, true); offset += 4;
      view.setFloat32(offset, v1.y, true); offset += 4;
      view.setFloat32(offset, v1.z, true); offset += 4;
      
      view.setFloat32(offset, v2.x, true); offset += 4;
      view.setFloat32(offset, v2.y, true); offset += 4;
      view.setFloat32(offset, v2.z, true); offset += 4;
      
      // Attribute byte count
      view.setUint16(offset, 0, true); offset += 2;
    }
    
    this.downloadBlob(new Blob([buffer], { type: 'application/octet-stream' }), filename);
    return true;
  }
  
  // Export ASCII STL (more compatible)
  static exportSTLAscii(meshData, filename = 'relief.stl') {
    const { vertices, indices } = meshData;
    
    let stl = 'solid relief\n';
    
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      
      const v0 = { x: vertices[i0], y: vertices[i0 + 1], z: vertices[i0 + 2] };
      const v1 = { x: vertices[i1], y: vertices[i1 + 1], z: vertices[i1 + 2] };
      const v2 = { x: vertices[i2], y: vertices[i2 + 1], z: vertices[i2 + 2] };
      
      // Calculate normal
      const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z;
      const bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      
      stl += `  facet normal ${(nx/len).toFixed(6)} ${(ny/len).toFixed(6)} ${(nz/len).toFixed(6)}\n`;
      stl += `    outer loop\n`;
      stl += `      vertex ${v0.x.toFixed(4)} ${v0.y.toFixed(4)} ${v0.z.toFixed(4)}\n`;
      stl += `      vertex ${v1.x.toFixed(4)} ${v1.y.toFixed(4)} ${v1.z.toFixed(4)}\n`;
      stl += `      vertex ${v2.x.toFixed(4)} ${v2.y.toFixed(4)} ${v2.z.toFixed(4)}\n`;
      stl += `    endloop\n`;
      stl += `  endfacet\n`;
    }
    
    stl += 'endsolid relief\n';
    
    this.downloadBlob(new Blob([stl], { type: 'text/plain' }), filename);
    return true;
  }
  
  // Export OBJ format
  static exportOBJ(meshData, filename = 'relief.obj') {
    const { vertices, indices } = meshData;
    
    let obj = '# Angled Facet Relief\n';
    obj += `# Vertices: ${vertices.length / 3}\n`;
    obj += `# Faces: ${indices.length / 3}\n\n`;
    
    // Vertices
    for (let i = 0; i < vertices.length; i += 3) {
      obj += `v ${vertices[i].toFixed(4)} ${vertices[i+1].toFixed(4)} ${vertices[i+2].toFixed(4)}\n`;
    }
    
    obj += '\n';
    
    // Faces (OBJ uses 1-based indices)
    for (let i = 0; i < indices.length; i += 3) {
      obj += `f ${indices[i]+1} ${indices[i+1]+1} ${indices[i+2]+1}\n`;
    }
    
    this.downloadBlob(new Blob([obj], { type: 'text/plain' }), filename);
    return true;
  }
  
  // Export OpenSCAD with parameters
  static exportSCAD(meshData, cfg, filename = 'relief.scad') {
    const { vertices, indices } = meshData;
    
    let scad = `// Angled Facet Relief - OpenSCAD Export
// Generated: ${new Date().toISOString()}
//
// === PARAMETERS ===
// Dimensions: ${cfg.outputWidthMM}mm x ${cfg.outputHeightMM}mm
// Base thickness: ${cfg.baseThickness}mm
// Max relief height: ${cfg.maxReliefHeight}mm
// Max tilt angle: ${cfg.maxTiltAngle}°
// Light azimuth: ${cfg.lightAzimuth}°
// Light elevation: ${cfg.lightElevation}°
// Cell density: ${cfg.cellDensity}
// Contrast: ${cfg.contrast}
// Method: ${cfg.reliefMethod}

// Scaling factor (adjust for final size)
scale_factor = 1.0;

module relief() {
  scale([scale_factor, scale_factor, scale_factor])
  polyhedron(
    points = [\n`;
    
    // Vertices
    for (let i = 0; i < vertices.length; i += 3) {
      scad += `      [${vertices[i].toFixed(3)}, ${vertices[i+1].toFixed(3)}, ${vertices[i+2].toFixed(3)}]`;
      if (i < vertices.length - 3) scad += ',';
      scad += '\n';
    }
    
    scad += `    ],
    faces = [\n`;
    
    // Faces
    for (let i = 0; i < indices.length; i += 3) {
      scad += `      [${indices[i]}, ${indices[i+1]}, ${indices[i+2]}]`;
      if (i < indices.length - 3) scad += ',';
      scad += '\n';
    }
    
    scad += `    ],
    convexity = 10
  );
}

// Render
relief();

// Statistics:
// - Vertices: ${vertices.length / 3}
// - Faces: ${indices.length / 3}
`;
    
    this.downloadBlob(new Blob([scad], { type: 'text/plain' }), filename);
    return true;
  }
  
  // Export 3MF format (better for modern slicers)
  static export3MF(meshData, cfg, filename = 'relief.3mf') {
    // 3MF is a zip archive containing XML files
    // This is a simplified implementation
    
    const { vertices, indices } = meshData;
    
    // Build the model XML
    let modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>\n`;
    
    for (let i = 0; i < vertices.length; i += 3) {
      modelXml += `          <vertex x="${vertices[i].toFixed(4)}" y="${vertices[i+1].toFixed(4)}" z="${vertices[i+2].toFixed(4)}" />\n`;
    }
    
    modelXml += `        </vertices>
        <triangles>\n`;
    
    for (let i = 0; i < indices.length; i += 3) {
      modelXml += `          <triangle v1="${indices[i]}" v2="${indices[i+1]}" v3="${indices[i+2]}" />\n`;
    }
    
    modelXml += `        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`;
    
    // For full 3MF, we'd need to create a ZIP archive
    // For simplicity, just export the XML (user can zip manually or use STL)
    console.log('Note: Full 3MF export requires ZIP library. Exporting XML only.');
    this.downloadBlob(new Blob([modelXml], { type: 'application/xml' }), filename.replace('.3mf', '_model.xml'));
    
    return true;
  }
  
  // Export all tiles as separate files
  static exportAllTiles(geometry, cfg, format = 'stl') {
    const tileInfo = config.getTileInfo();
    
    if (tileInfo.tiles.length === 1) {
      // No tiling, export single file
      const meshData = MeshBuilder.build(geometry, cfg);
      this.exportSTLBinary(meshData, 'relief.stl');
      return;
    }
    
    // Export each tile
    for (const tile of tileInfo.tiles) {
      const tileMesh = MeshBuilder.buildTile(geometry, cfg, tile.col, tile.row);
      const filename = `relief_tile_${tile.row}_${tile.col}.stl`;
      this.exportSTLBinary(tileMesh, filename);
    }
    
    console.log(`Exported ${tileInfo.tiles.length} tiles`);
  }
  
  // Helper to download blob
  static downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Export config as JSON
  static exportConfig(cfg, filename = 'relief_config.json') {
    const json = JSON.stringify(cfg, null, 2);
    this.downloadBlob(new Blob([json], { type: 'application/json' }), filename);
  }
}