// Three.js viewer for 3D preview
const ThreeViewer = {
  scene: null,
  camera: null,
  renderer: null,
  mesh: null,
  controls: null,
  container: null,
  animationId: null,
  
  initialize: function(container, config) {
    debugLog('=== Initializing Three.js viewer ===');
    
    if (!container) {
      debugLog('ERROR: No container provided for Three.js', 'error');
      return false;
    }
    
    this.container = container;
    
    try {
      // Get container dimensions
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 600;
      
      debugLog(`Container dimensions: ${width}x${height}`);
      
      // Create scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x1a1a1a);
      
      // Create camera
      this.camera = new THREE.PerspectiveCamera(
        45,
        width / height,
        0.1,
        2000
      );
      this.camera.position.set(150, 150, 300);
      this.camera.lookAt(0, 0, 0);
      
      // Create renderer
      this.renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Clear container and append renderer
      container.innerHTML = '';
      container.appendChild(this.renderer.domElement);
      
      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(100, 200, 100);
      directionalLight.castShadow = true;
      directionalLight.shadow.camera.left = -200;
      directionalLight.shadow.camera.right = 200;
      directionalLight.shadow.camera.top = 200;
      directionalLight.shadow.camera.bottom = -200;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      this.scene.add(directionalLight);
      
      // Add grid helper
      const gridHelper = new THREE.GridHelper(400, 20, 0x444444, 0x222222);
      this.scene.add(gridHelper);
      
      // Simple orbit controls (manual implementation since OrbitControls not available on CDN)
      this.setupControls();
      
      // Start animation
      this.animate();
      
      // Handle resize
      window.addEventListener('resize', () => this.handleResize());
      
      debugLog('Three.js viewer initialized successfully');
      return true;
      
    } catch (error) {
      debugLog(`ERROR initializing Three.js: ${error.message}`, 'error');
      debugLog(`Stack: ${error.stack}`, 'error');
      return false;
    }
  },
  
  setupControls: function() {
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let rotationX = 0;
    let rotationY = 0;
    let distance = 300;
    
    const canvas = this.renderer.domElement;
    
    canvas.addEventListener('mousedown', (e) => {
      mouseDown = true;
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    
    canvas.addEventListener('mousemove', (e) => {
      if (!mouseDown) return;
      
      const deltaX = e.clientX - mouseX;
      const deltaY = e.clientY - mouseY;
      
      rotationY += deltaX * 0.01;
      rotationX += deltaY * 0.01;
      
      // Clamp vertical rotation
      rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX));
      
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      this.updateCamera(rotationX, rotationY, distance);
    });
    
    canvas.addEventListener('mouseup', () => {
      mouseDown = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
      mouseDown = false;
    });
    
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      distance += e.deltaY * 0.5;
      distance = Math.max(50, Math.min(1000, distance));
      this.updateCamera(rotationX, rotationY, distance);
    });
    
    // Touch controls for mobile
    let touchStart = null;
    
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });
    
    canvas.addEventListener('touchmove', (e) => {
      if (!touchStart || e.touches.length !== 1) return;
      e.preventDefault();
      
      const deltaX = e.touches[0].clientX - touchStart.x;
      const deltaY = e.touches[0].clientY - touchStart.y;
      
      rotationY += deltaX * 0.01;
      rotationX += deltaY * 0.01;
      rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX));
      
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      
      this.updateCamera(rotationX, rotationY, distance);
    });
    
    canvas.addEventListener('touchend', () => {
      touchStart = null;
    });
  },
  
  updateCamera: function(rotX, rotY, dist) {
    this.camera.position.x = dist * Math.sin(rotY) * Math.cos(rotX);
    this.camera.position.y = dist * Math.sin(rotX);
    this.camera.position.z = dist * Math.cos(rotY) * Math.cos(rotX);
    this.camera.lookAt(0, 0, 0);
  },
  
  updateMesh: function(geometry, config) {
    debugLog('=== Updating Three.js mesh ===');
    
    if (!this.scene) {
      debugLog('ERROR: Scene not initialized', 'error');
      return false;
    }
    
    if (!geometry || !geometry.vertices || !geometry.indices) {
      debugLog('ERROR: Invalid geometry data', 'error');
      return false;
    }
    
    try {
      // Remove old mesh
      if (this.mesh) {
        this.scene.remove(this.mesh);
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
        this.mesh = null;
      }
      
      debugLog(`Creating geometry with ${geometry.vertices.length / 3} vertices`);
      
      // Create BufferGeometry
      const bufferGeometry = new THREE.BufferGeometry();
      
      // Set vertices
      bufferGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(geometry.vertices, 3)
      );
      
      // Set indices
      bufferGeometry.setIndex(
        new THREE.BufferAttribute(geometry.indices, 1)
      );
      
      // Compute normals for lighting
      bufferGeometry.computeVertexNormals();
      
      // Center geometry
      bufferGeometry.center();
      
      // Create material
      const material = new THREE.MeshPhongMaterial({
        color: config.previewColor || 0xcccccc,
        side: THREE.DoubleSide,
        flatShading: false,
        shininess: 30,
        specular: 0x111111
      });
      
      // Create mesh
      this.mesh = new THREE.Mesh(bufferGeometry, material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      
      // Add to scene
      this.scene.add(this.mesh);
      
      // Adjust camera to fit
      this.fitCameraToObject();
      
      debugLog('Mesh updated successfully');
      return true;
      
    } catch (error) {
      debugLog(`ERROR updating mesh: ${error.message}`, 'error');
      return false;
    }
  },
  
  fitCameraToObject: function() {
    if (!this.mesh) return;
    
    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    cameraZ *= 1.5; // Zoom out a bit
    
    this.camera.position.set(cameraZ, cameraZ * 0.5, cameraZ);
    this.camera.lookAt(center);
  },
  
  animate: function() {
    if (!this.renderer || !this.scene || !this.camera) return;
    
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // Slow rotation if mesh exists
    if (this.mesh) {
      this.mesh.rotation.y += 0.002;
    }
    
    this.renderer.render(this.scene, this.camera);
  },
  
  handleResize: function() {
    if (!this.container || !this.camera || !this.renderer) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  },
  
  dispose: function() {
    debugLog('Disposing Three.js viewer');
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
      this.mesh = null;
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    
    this.scene = null;
    this.camera = null;
    this.container = null;
    
    window.removeEventListener('resize', this.handleResize);
  }
};

debugLog('ThreeViewer loaded');