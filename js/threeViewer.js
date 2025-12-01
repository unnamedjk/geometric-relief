// Three.js viewer with realistic lighting and view controls

class ThreeViewer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mesh = null;
    this.directionalLight = null;
    this.animationId = null;
    this.autoRotate = false;
    
    // Camera control state
    this.controls = {
      rotationX: 0.5,
      rotationY: 0.4,
      distance: 400,
      target: new THREE.Vector3(0, 0, 0),
      isDragging: false,
      isPanning: false,
      lastMouseX: 0,
      lastMouseY: 0
    };
    
    this.init();
  }
  
  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    this.updateCameraPosition();
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.container.appendChild(this.renderer.domElement);
    
    this.setupLighting();
    this.setupGrid();
    this.setupControls();
    
    window.addEventListener('resize', () => this.onResize());
    
    this.animate();
  }
  
  setupLighting() {
    // Ambient (low)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.ambientLight);
    
    // Main directional light
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.directionalLight.position.set(100, 150, 100);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 1000;
    this.directionalLight.shadow.camera.left = -300;
    this.directionalLight.shadow.camera.right = 300;
    this.directionalLight.shadow.camera.top = 300;
    this.directionalLight.shadow.camera.bottom = -300;
    this.directionalLight.shadow.bias = -0.0005;
    this.scene.add(this.directionalLight);
    
    // Fill light (opposite side, dimmer)
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
    this.fillLight.position.set(-100, 50, -100);
    this.scene.add(this.fillLight);
  }
  
  setupGrid() {
    // Ground plane for shadows
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -1;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
    
    // Grid
    this.gridHelper = new THREE.GridHelper(500, 25, 0x444444, 0x2a2a2a);
    this.gridHelper.position.y = -0.5;
    this.scene.add(this.gridHelper);
  }
  
  setupControls() {
    const canvas = this.renderer.domElement;
    
    canvas.addEventListener('mousedown', (e) => {
      if (e.shiftKey) {
        this.controls.isPanning = true;
      } else {
        this.controls.isDragging = true;
      }
      this.controls.lastMouseX = e.clientX;
      this.controls.lastMouseY = e.clientY;
    });
    
    canvas.addEventListener('mousemove', (e) => {
      const dx = e.clientX - this.controls.lastMouseX;
      const dy = e.clientY - this.controls.lastMouseY;
      
      if (this.controls.isPanning) {
        const panSpeed = this.controls.distance * 0.002;
        // Pan in camera-relative directions
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        this.camera.getWorldDirection(right);
        right.cross(up).normalize();
        
        this.controls.target.add(right.multiplyScalar(-dx * panSpeed));
        this.controls.target.y += dy * panSpeed;
        
      } else if (this.controls.isDragging) {
        this.controls.rotationY += dx * 0.005;
        this.controls.rotationX += dy * 0.005;
        this.controls.rotationX = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.controls.rotationX));
      }
      
      this.controls.lastMouseX = e.clientX;
      this.controls.lastMouseY = e.clientY;
      
      if (this.controls.isDragging || this.controls.isPanning) {
        this.updateCameraPosition();
      }
    });
    
    canvas.addEventListener('mouseup', () => {
      this.controls.isDragging = false;
      this.controls.isPanning = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
      this.controls.isDragging = false;
      this.controls.isPanning = false;
    });
    
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.controls.distance *= 1 + e.deltaY * 0.001;
      this.controls.distance = Math.max(20, Math.min(2000, this.controls.distance));
      this.updateCameraPosition();
    }, { passive: false });
    
    // Touch support
    let lastTouchDist = 0;
    
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.controls.isDragging = true;
        this.controls.lastMouseX = e.touches[0].clientX;
        this.controls.lastMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      if (e.touches.length === 1 && this.controls.isDragging) {
        const dx = e.touches[0].clientX - this.controls.lastMouseX;
        const dy = e.touches[0].clientY - this.controls.lastMouseY;
        
        this.controls.rotationY += dx * 0.005;
        this.controls.rotationX += dy * 0.005;
        this.controls.rotationX = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.controls.rotationX));
        
        this.controls.lastMouseX = e.touches[0].clientX;
        this.controls.lastMouseY = e.touches[0].clientY;
        this.updateCameraPosition();
        
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.controls.distance *= lastTouchDist / dist;
        this.controls.distance = Math.max(20, Math.min(2000, this.controls.distance));
        lastTouchDist = dist;
        this.updateCameraPosition();
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', () => {
      this.controls.isDragging = false;
    });
  }
  
  updateCameraPosition() {
    const { rotationX, rotationY, distance, target } = this.controls;
    
    this.camera.position.x = target.x + distance * Math.sin(rotationY) * Math.cos(rotationX);
    this.camera.position.z = target.z + distance * Math.cos(rotationY) * Math.cos(rotationX);
    this.camera.position.y = target.y + distance * Math.sin(rotationX);
    
    this.camera.lookAt(target);
  }
  
  updateLightPosition(azimuth, elevation) {
    const az = azimuth * Math.PI / 180;
    const el = elevation * Math.PI / 180;
    
    const dist = 300;
    this.directionalLight.position.set(
      dist * Math.cos(el) * Math.sin(az),
      dist * Math.sin(el),
      dist * Math.cos(el) * Math.cos(az)
    );
  }
  
  updateMesh(meshData, cfg) {
    // Remove old mesh
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    
    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geometry.computeVertexNormals();
    
    // Material - flat shading to show facets
    const color = new THREE.Color(cfg.previewColor || '#c0c0c0');
    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.05,
      roughness: 0.75,
      flatShading: true,
      side: THREE.DoubleSide
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Center geometry
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.mesh.position.set(-center.x, -box.min.z, -center.y);
    
    this.scene.add(this.mesh);
    
    this.fitToObject();
    this.updateLightPosition(cfg.lightAzimuth, cfg.lightElevation);
    
    return true;
  }
  
  fitToObject() {
    if (!this.mesh) return;
    
    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    this.controls.distance = maxDim * 1.8;
    this.controls.target.set(0, size.z / 2, 0);
    
    this.updateCameraPosition();
  }
  
  resetView() {
    this.controls.rotationX = 0.5;
    this.controls.rotationY = 0.4;
    this.controls.target.set(0, 0, 0);
    this.fitToObject();
  }
  
  setView(view) {
    switch (view) {
      case 'front':
        this.controls.rotationX = 0.3;
        this.controls.rotationY = 0;
        break;
      case 'top':
        this.controls.rotationX = Math.PI / 2 - 0.01;
        this.controls.rotationY = 0;
        break;
    }
    this.updateCameraPosition();
  }
  
  setWireframe(enabled) {
    if (this.mesh && this.mesh.material) {
      this.mesh.material.wireframe = enabled;
    }
  }
  
  setAutoRotate(enabled) {
    this.autoRotate = enabled;
  }
  
  setPreviewColor(color) {
    if (this.mesh && this.mesh.material) {
      this.mesh.material.color.set(color);
    }
  }
  
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    if (this.autoRotate) {
      this.controls.rotationY += 0.003;
      this.updateCameraPosition();
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    if (width && height) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }
  
  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    
    this.renderer.dispose();
  }
}