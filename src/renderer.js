export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    
    // Palette Colors
    this.colors = {
      deep_ocean: '#0b1d3a',
      shallow_sea: '#1a5f7a',
      sand: '#dfba73',
      grass: '#387c44',
      forest: '#1e5128',
      mountain: '#5c636e',
      volcano: '#32323a',
      lava: '#e03e1b',
      ice: '#c8e3e9',
      fire: '#f86f1b',
      ash: '#48444c'
    };

    // Day/Night progression variables
    this.timeOfDay = 8.0; // 0 to 24 hours
    this.cycleSpeed = 0.01; // hours per tick
    this.enableDayNight = true;

    // Clouds array
    this.clouds = [];
    this.initClouds();

    // 3D Scene initialization
    this.scene = new THREE.Scene();
    
    // Camera settings for 3D Orbit Camera
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
    this.cameraDistance = 110;
    this.cameraTheta = Math.PI / 4; // Yaw angle
    this.cameraPhi = Math.PI / 3.5; // Pitch angle (tilted down)
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.updateCameraPosition();

    // WebGL Renderer Setup
    this.renderer3D = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer3D.shadowMap.enabled = true;
    this.renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer3D.setClearColor(0x07070a, 1);

    // Setup Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.left = -60;
    this.dirLight.shadow.camera.right = 60;
    this.dirLight.shadow.camera.top = 60;
    this.dirLight.shadow.camera.bottom = -60;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 400;
    this.dirLight.shadow.bias = -0.0008;
    this.scene.add(this.dirLight);

    // Setup sharing geometries & materials
    this.boxGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    
    this.tileMaterial = new THREE.MeshStandardMaterial({ 
      roughness: 0.8, 
      metalness: 0.1 
    });
    
    this.glowMaterial = new THREE.MeshStandardMaterial({ 
      roughness: 0.4, 
      metalness: 0.1, 
      emissive: new THREE.Color(0xff3300), 
      emissiveIntensity: 1.5 
    });

    // 10,000 grid tiles Instanced Meshes (for terrain)
    this.terrainMesh = new THREE.InstancedMesh(this.boxGeom, this.tileMaterial, 10000);
    this.terrainMesh.castShadow = true;
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);

    this.glowTerrainMesh = new THREE.InstancedMesh(this.boxGeom, this.glowMaterial, 10000);
    this.glowTerrainMesh.castShadow = true;
    this.glowTerrainMesh.receiveShadow = true;
    this.scene.add(this.glowTerrainMesh);

    // Setup Feature meshes (Trees, Mountains, Volcanoes)
    const leavesGeom = new THREE.ConeGeometry(0.25, 0.7, 5);
    this.treeMesh = new THREE.InstancedMesh(leavesGeom, new THREE.MeshStandardMaterial({ color: 0x1e5128, roughness: 0.9 }), 10000);
    this.treeMesh.castShadow = true;
    this.treeMesh.receiveShadow = true;
    this.scene.add(this.treeMesh);

    const mountainGeom = new THREE.ConeGeometry(0.6, 1.6, 5);
    this.mountainMesh = new THREE.InstancedMesh(mountainGeom, new THREE.MeshStandardMaterial({ color: 0x5c636e, roughness: 0.85 }), 2000);
    this.mountainMesh.castShadow = true;
    this.mountainMesh.receiveShadow = true;
    this.scene.add(this.mountainMesh);

    const snowGeom = new THREE.ConeGeometry(0.3, 0.8, 5);
    this.snowMesh = new THREE.InstancedMesh(snowGeom, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), 2000);
    this.snowMesh.castShadow = true;
    this.snowMesh.receiveShadow = true;
    this.scene.add(this.snowMesh);

    const volcanoGeom = new THREE.CylinderGeometry(0.2, 0.7, 1.2, 6);
    this.volcanoMesh = new THREE.InstancedMesh(volcanoGeom, new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.9 }), 500);
    this.volcanoMesh.castShadow = true;
    this.volcanoMesh.receiveShadow = true;
    this.scene.add(this.volcanoMesh);

    const craterGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 6);
    this.craterMesh = new THREE.InstancedMesh(craterGeom, new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff1100, emissiveIntensity: 2.0 }), 500);
    this.scene.add(this.craterMesh);

    // Setup Water Plane
    const waterGeom = new THREE.PlaneGeometry(102, 102, 32, 32);
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f3b5f,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.1
    });
    this.waterMesh = new THREE.Mesh(waterGeom, this.waterMaterial);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = 1.6; // Water height is constant
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);

    // Setup Cloud Meshes
    this.cloudGroup = new THREE.Group();
    this.scene.add(this.cloudGroup);
    this.cloudMeshes = [];
    
    // Create 3D Cloud geometries (clusters of spheres)
    const cloudGeo = new THREE.SphereGeometry(1, 8, 8);
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.45 });
    
    for (let i = 0; i < 15; i++) {
      const singleCloud = new THREE.Group();
      
      const part1 = new THREE.Mesh(cloudGeo, cloudMat);
      part1.scale.set(2, 1.2, 1.5);
      part1.castShadow = true;
      singleCloud.add(part1);

      const part2 = new THREE.Mesh(cloudGeo, cloudMat);
      part2.position.set(1.2, 0.1, 0);
      part2.scale.set(1.3, 0.9, 1.1);
      part2.castShadow = true;
      singleCloud.add(part2);

      const part3 = new THREE.Mesh(cloudGeo, cloudMat);
      part3.position.set(-1.2, 0.1, 0);
      part3.scale.set(1.3, 0.9, 1.1);
      part3.castShadow = true;
      singleCloud.add(part3);

      singleCloud.castShadow = true;
      this.cloudGroup.add(singleCloud);
      this.cloudMeshes.push(singleCloud);
    }

    // Particle Points Mesh Setup
    const maxParticles = 2000;
    this.particleGeom = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(maxParticles * 3);
    this.particleColors = new Float32Array(maxParticles * 3);
    this.particleGeom.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeom.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
    
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    this.particlePoints = new THREE.Points(this.particleGeom, this.particleMaterial);
    this.scene.add(this.particlePoints);

    // Rain lines mesh setup
    this.rainGeom = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(maxParticles * 2 * 3); // 2 vertices per line, 3 coords per vertex
    this.rainGeom.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    
    this.rainMaterial = new THREE.LineBasicMaterial({
      color: 0x78beff,
      transparent: true,
      opacity: 0.6
    });
    this.rainSegments = new THREE.LineSegments(this.rainGeom, this.rainMaterial);
    this.scene.add(this.rainSegments);

    // Raycaster for Mouse Coordinate mapping
    this.raycaster = new THREE.Raycaster();
  }

  initClouds() {
    this.clouds = [];
    for (let i = 0; i < 15; i++) {
      this.clouds.push({
        x: Math.random() * 120 - 10,
        y: Math.random() * 120 - 10,
        size: 3 + Math.random() * 6,
        vx: 0.01 + Math.random() * 0.02,
        vy: (Math.random() - 0.5) * 0.005,
        opacity: 0.2 + Math.random() * 0.2
      });
    }
  }

  resize(width, height) {
    this.renderer3D.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // Translates screen coordinates to 3D grid index
  screenToGrid(screenX, screenY, tileSize) {
    const mouse = new THREE.Vector2();
    mouse.x = (screenX / this.canvas.width) * 2 - 1;
    mouse.y = -(screenY / this.canvas.height) * 2 + 1;

    this.raycaster.setFromCamera(mouse, this.camera);

    // Raycast against ground plane at height Y=1.5
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.8);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, target)) {
      const gridX = Math.floor(target.x + 50);
      const gridY = Math.floor(target.z + 50);
      return { x: gridX, y: gridY };
    }
    return { x: -1, y: -1 };
  }

  getTileSize() {
    return 16;
  }

  updateCameraPosition() {
    const x = this.cameraTarget.x + this.cameraDistance * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
    const y = this.cameraTarget.y + this.cameraDistance * Math.cos(this.cameraPhi);
    const z = this.cameraTarget.z + this.cameraDistance * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  // Helper mapping for heights based on elevation
  getTileHeight(tile) {
    // scale elevation to reasonable columns
    return 0.2 + tile.elevation * 12.0;
  }

  render(world, particleSystem) {
    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();
    const time = Date.now() / 1000;

    // 1. Process Day / Night Light Transitions
    this.updateDayNightCycle();

    // 2. Animate Water Plane (undulating vertices)
    this.animateWater(time);

    // 3. Render Terrain Grid Tiles
    // Deep Ocean is at height, Grasslands are medium, Mountains are tall
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        const idx = y * world.width + x;
        const height = this.getTileHeight(tile);

        // Determine if it is glowing (lava, fire)
        const isGlowing = tile.type === 'lava' || tile.type === 'fire';

        // Translate and scale block based on tile properties
        tempMatrix.makeScale(0.98, height, 0.98); // slight border gap for game-board grid look
        tempMatrix.setPosition(x - 50, height / 2, y - 50);

        if (isGlowing) {
          this.glowTerrainMesh.setMatrixAt(idx, tempMatrix);
          
          let colStr = this.colors[tile.type];
          if (tile.type === 'fire') {
            const p = 0.8 + Math.sin(time * 12 + x) * 0.2;
            tempColor.setRGB(p, p * 0.4, 0.05); // pulsing fire
          } else {
            tempColor.set(colStr);
          }
          this.glowTerrainMesh.setColorAt(idx, tempColor);
          
          // Clear standard mesh instance
          tempMatrix.makeScale(0, 0, 0);
          tempMatrix.setPosition(0, -999, 0);
          this.terrainMesh.setMatrixAt(idx, tempMatrix);
        } else {
          this.terrainMesh.setMatrixAt(idx, tempMatrix);
          
          // Apply custom blending colors
          tempColor.set(this.colors[tile.type] || this.colors.deep_ocean);
          
          // Ash overlay tint
          if (tile.ashLevel > 0) {
            tempColor.lerp(new THREE.Color(0x48444c), tile.ashLevel * 0.65);
          }
          // Ice/Freezing overlay tint
          if (tile.type === 'ice') {
            tempColor.addScalar(0.05);
          }

          this.terrainMesh.setColorAt(idx, tempColor);

          // Clear glow mesh instance
          tempMatrix.makeScale(0, 0, 0);
          tempMatrix.setPosition(0, -999, 0);
          this.glowTerrainMesh.setMatrixAt(idx, tempMatrix);
        }
      }
    }
    this.terrainMesh.instanceMatrix.needsUpdate = true;
    if (this.terrainMesh.instanceColor) this.terrainMesh.instanceColor.needsUpdate = true;
    this.glowTerrainMesh.instanceMatrix.needsUpdate = true;
    if (this.glowTerrainMesh.instanceColor) this.glowTerrainMesh.instanceColor.needsUpdate = true;

    // 4. Render 3D Terrain Features (Trees, Mountains, Volcanoes)
    this.renderFeatures(world, time);

    // 5. Render Floating Clouds (Volumetric)
    this.renderClouds();

    // 6. Render Particles in 3D (Points & LineSegments)
    this.renderParticles(particleSystem, world);

    // 7. Fire WebGL Renderer
    this.renderer3D.render(this.scene, this.camera);
  }

  animateWater(time) {
    const pos = this.waterMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const ux = pos.getX(i);
      const uy = pos.getY(i);
      // calculate sine displacement waves
      const wave = Math.sin(ux * 0.15 + time * 1.5) * 0.08 + Math.cos(uy * 0.15 + time * 1.2) * 0.08;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
    this.waterMesh.geometry.computeVertexNormals();
  }

  renderFeatures(world, time) {
    let treeCount = 0;
    let mountainCount = 0;
    let volcanoCount = 0;

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        const height = this.getTileHeight(tile);
        const tx = x - 50;
        const tz = y - 50;

        // Draw forest pine trees
        if (tile.type === 'forest') {
          // Tree foliage 1
          tempMatrix.makeScale(1, 1, 1);
          tempMatrix.setPosition(tx, height + 0.35, tz);
          this.treeMesh.setMatrixAt(treeCount++, tempMatrix);
        }

        // Draw mountain peaks and snow-caps
        if (tile.type === 'mountain') {
          // Grey cone base
          tempMatrix.makeScale(1.2, 1.2, 1.2);
          tempMatrix.setPosition(tx, height + 0.8, tz);
          this.mountainMesh.setMatrixAt(mountainCount, tempMatrix);

          // White snow-cap on tip
          tempMatrix.makeScale(0.6, 0.6, 0.6);
          tempMatrix.setPosition(tx, height + 1.28, tz);
          this.snowMesh.setMatrixAt(mountainCount, tempMatrix);
          
          mountainCount++;
        }

        // Draw volcanoes & active lava craters
        if (tile.type === 'volcano') {
          // Volcano cone
          tempMatrix.makeScale(1.1, 1.0, 1.1);
          tempMatrix.setPosition(tx, height + 0.6, tz);
          this.volcanoMesh.setMatrixAt(volcanoCount, tempMatrix);

          // Glowing lava crater
          tempMatrix.makeScale(1.0, 1.0, 1.0);
          tempMatrix.setPosition(tx, height + 1.22, tz);
          this.craterMesh.setMatrixAt(volcanoCount, tempMatrix);
          
          volcanoCount++;
        }
      }
    }

    // Update instances count & updates
    this.treeMesh.count = treeCount;
    this.treeMesh.instanceMatrix.needsUpdate = true;

    this.mountainMesh.count = mountainCount;
    this.mountainMesh.instanceMatrix.needsUpdate = true;

    this.snowMesh.count = mountainCount;
    this.snowMesh.instanceMatrix.needsUpdate = true;

    this.volcanoMesh.count = volcanoCount;
    this.volcanoMesh.instanceMatrix.needsUpdate = true;

    this.craterMesh.count = volcanoCount;
    this.craterMesh.instanceMatrix.needsUpdate = true;
  }

  renderClouds() {
    this.clouds.forEach((c, i) => {
      c.x += c.vx;
      c.y += c.vy;

      if (c.x > 110) c.x = -15;
      if (c.y > 110) c.y = -15;
      if (c.y < -15) c.y = 110;

      const mesh = this.cloudMeshes[i];
      if (mesh) {
        mesh.position.set(c.x - 50, 18, c.y - 50);
        mesh.rotation.y = timeOfDayAngle(this.timeOfDay) * 0.05 + i;
      }
    });

    function timeOfDayAngle(time) {
      return (time / 24) * Math.PI * 2;
    }
  }

  renderParticles(particleSystem, world) {
    const posAttr = this.particleGeom.attributes.position;
    const colAttr = this.particleGeom.attributes.color;
    const positions = posAttr.array;
    const colors = colAttr.array;

    const rainPosAttr = this.rainGeom.attributes.position;
    const rainPositions = rainPosAttr.array;

    let ptCount = 0;
    let rainCount = 0;

    for (let i = 0; i < particleSystem.particles.length; i++) {
      const p = particleSystem.particles[i];
      
      // Inject spawn coords helper inside renderer
      if (p.spawnX === undefined) p.spawnX = p.x;
      if (p.spawnY === undefined) p.spawnY = p.y;

      const px = p.x - 50;
      const pz = p.spawnY - 50;

      // Find local tile height
      const tx = Math.max(0, Math.min(world.width - 1, Math.floor(p.x)));
      const ty = Math.max(0, Math.min(world.height - 1, Math.floor(p.spawnY)));
      const tHeight = this.getTileHeight(world.grid[ty][tx]);

      // Handle particle representation in 3D
      if (p.type === 'rain') {
        const fallHeight = 25 - (p.y - p.spawnY) * 16.0;
        
        // Skip if hit ground
        if (fallHeight > tHeight) {
          const idx = rainCount * 6;
          // Rain streak starts at:
          rainPositions[idx] = px;
          rainPositions[idx + 1] = fallHeight;
          rainPositions[idx + 2] = pz;
          // Ends at:
          rainPositions[idx + 3] = px + p.vx;
          rainPositions[idx + 4] = fallHeight - 1.5;
          rainPositions[idx + 5] = pz + p.vx * 0.5;
          rainCount++;
        }
      } else if (p.type === 'snow') {
        const fallHeight = 22 - (p.y - p.spawnY) * 8.0;
        if (fallHeight > tHeight && ptCount < 2000) {
          const idx = ptCount * 3;
          positions[idx] = px;
          positions[idx + 1] = fallHeight;
          positions[idx + 2] = pz;

          // Pure white
          colors[idx] = 1.0;
          colors[idx + 1] = 1.0;
          colors[idx + 2] = 1.0;
          ptCount++;
        }
      } else {
        // Rises upwards (smoke, steam, fire, lava sparks)
        let riseHeight = tHeight + (p.spawnY - p.y) * 10.0;
        
        // Fire sparks rise slower
        if (p.type === 'fire') {
          riseHeight = tHeight + (p.spawnY - p.y) * 5.0;
        } else if (p.type === 'lava_spark') {
          riseHeight = tHeight + (p.spawnY - p.y) * 11.0;
        }

        if (riseHeight < 40 && ptCount < 2000) {
          const idx = ptCount * 3;
          positions[idx] = px;
          positions[idx + 1] = riseHeight;
          positions[idx + 2] = pz;

          // Extract particle color values from CSS rgb/rgba string
          let col = new THREE.Color(0xffffff);
          if (p.color.startsWith('rgba(')) {
            const parts = p.color.replace('rgba(', '').split(',');
            const r = parseFloat(parts[0]) / 255;
            const g = parseFloat(parts[1]) / 255;
            const b = parseFloat(parts[2]) / 255;
            col.setRGB(r, g, b);
          } else if (p.color.startsWith('rgba(230, 230, 240')) {
            col.setRGB(0.9, 0.9, 0.95);
          }

          colors[idx] = col.r;
          colors[idx + 1] = col.g;
          colors[idx + 2] = col.b;
          ptCount++;
        }
      }
    }

    // Update buffer values
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.particleGeom.setDrawRange(0, ptCount);

    rainPosAttr.needsUpdate = true;
    this.rainGeom.setDrawRange(0, rainCount * 2);
  }

  updateDayNightCycle() {
    if (this.enableDayNight) {
      this.timeOfDay = (this.timeOfDay + this.cycleSpeed) % 24;
    } else {
      this.timeOfDay = 12.0; // Locked at noon
    }

    // Set Sun Angle and Position
    const sunAngle = (this.timeOfDay / 24) * Math.PI * 2 - Math.PI / 2;
    const lx = Math.cos(sunAngle) * 120;
    const ly = Math.sin(sunAngle) * 120;
    const lz = 25; // Constant offset back

    // Modify directional and ambient lights based on time transitions
    const skyColor = new THREE.Color(0x07070a);

    if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
      // Sunset transition
      const ratio = (this.timeOfDay - 18) / 2;
      this.ambientLight.color.setHex(0xe05530);
      this.ambientLight.intensity = 0.4 - ratio * 0.25;

      this.dirLight.color.setHex(0xffaa44);
      this.dirLight.intensity = 0.7 - ratio * 0.45;
      
      skyColor.setRGB(0.08 - ratio * 0.06, 0.05 - ratio * 0.04, 0.06 - ratio * 0.04);
    } else if (this.timeOfDay >= 20 || this.timeOfDay < 4) {
      // Night
      let ratio = 1.0;
      if (this.timeOfDay < 4) {
        ratio = 1.0 - (this.timeOfDay / 4);
      } else if (this.timeOfDay < 22) {
        ratio = (this.timeOfDay - 20) / 2;
      }
      this.ambientLight.color.setHex(0x101030);
      this.ambientLight.intensity = 0.15;

      this.dirLight.color.setHex(0x4f6fcf);
      this.dirLight.intensity = 0.25;

      skyColor.setRGB(0.02, 0.02, 0.04);
    } else if (this.timeOfDay >= 4 && this.timeOfDay < 6) {
      // Sunrise transition
      const ratio = (this.timeOfDay - 4) / 2;
      this.ambientLight.color.setHex(0xd04070);
      this.ambientLight.intensity = 0.15 + ratio * 0.25;

      this.dirLight.color.setHex(0xffaacc);
      this.dirLight.intensity = 0.25 + ratio * 0.45;

      skyColor.setRGB(0.02 + ratio * 0.06, 0.02 + ratio * 0.03, 0.04 + ratio * 0.02);
    } else {
      // Day (Noon)
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.45;

      this.dirLight.color.setHex(0xffffff);
      this.dirLight.intensity = 1.0;

      skyColor.setHex(0x07070a);
    }

    // Set Sun Position (always high Y for active shadow casting, but adjust dimness)
    this.dirLight.position.set(lx, Math.abs(ly) + 15, lz);
    this.renderer3D.setClearColor(skyColor, 1);
  }

  // Get current hour string format (e.g. 08:30 AM)
  getTimeString() {
    const hoursInt = Math.floor(this.timeOfDay);
    const minutes = Math.floor((this.timeOfDay % 1) * 60).toString().padStart(2, '0');
    const ampm = hoursInt >= 12 ? 'PM' : 'AM';
    const displayHour = (hoursInt % 12 || 12).toString().padStart(2, '0');
    return `${displayHour}:${minutes} ${ampm}`;
  }
}
