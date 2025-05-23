import { CONSTANTS, HELPERS, BIRD_SETTINGS, createMaterials, ENVIRONMENT_COLORS, EQUIPMENT_COLORS, createGeometries } from './config.js';
import { buildTerrain as importedBuildTerrain, terrainOffsetZ, fitGroundInView } from './terrain.js';
import { initUI, setupUI, UIState, getUIValues, elements } from './ui.js';

// Make THREE available to our ES module by accessing it from window
const THREE = window.THREE;

document.addEventListener('DOMContentLoaded', () => {
  // Use imported constants
  const { CLEARANCE, SAMPLES, DRAG_SENS, MINH, MAXH, SIZE, SEG, BASE_H, R } = CONSTANTS;
  const { SNAP } = HELPERS;  // Initialize UI elements early (without event handlers)
  initUI();

  // We already have elements imported at the top of the file via the import statement
  // Simply use the named export 'elements' from the ui.js module

  /* ------- three basics ------- */
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(40, 40, 40);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(10, 40, 20);
  scene.add(sun);
  /* ------- materials ------- */
  // Get geometries from config
  const { pole: poleGeo, crossArm: crossArmGeo } = createGeometries();
  
  // Get materials from config
  const materials = createMaterials();
  const mPole = materials.pole;
  const mCrossArm = materials.crossArm;
  const mPoleHL = materials.poleHighlight;
  const mGood = materials.goodSpan;
  const mBad = materials.badSpan;
  const mGhost = materials.ghost;
  const mTreeHL = materials.treeHighlight;
  const mGrid = materials.grid;
  const mBird = materials.bird;
    // Last pole indicator material (semitransparent with glow effect)
  const mLastPoleIndicator = new THREE.LineBasicMaterial({ 
    color: 0x3498db, 
    transparent: true, 
    opacity: 0.7,
    linewidth: 2
  });

  /* ------- data stores ------- */  
  const poles = []; // {x,z,h,base,obj}
  const trees = new THREE.Group();
  scene.add(trees);
  const treeData = []; // {x,z,yTop,ref}
  // terrainOffsetZ is imported from terrain.js
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();  
  
  const birds = [];
  let hoverPt = null, hoverPole = null, hoverTree = null;
  let ghost = new THREE.Mesh(poleGeo, mGhost);
  ghost.visible = false;
  scene.add(ghost);
    // Create terrain-conforming lines for the last pole indicator (double circle for better visibility)
  let lastPoleIndicator = new THREE.Line(new THREE.BufferGeometry(), mLastPoleIndicator);
  lastPoleIndicator.visible = false;
  scene.add(lastPoleIndicator);
  
  // Create a second, inner indicator circle
  const mLastPoleInnerIndicator = new THREE.LineBasicMaterial({ 
    color: 0x73c2fb, 
    transparent: true, 
    opacity: 0.9,
    linewidth: 1
  });
  let lastPoleInnerIndicator = new THREE.Line(new THREE.BufferGeometry(), mLastPoleInnerIndicator);
  lastPoleInnerIndicator.visible = false;
  scene.add(lastPoleInnerIndicator);
  
  let drag = null, startY = 0, startH = 0, clickStart = null;
  let dragStartPos = null, dragStartHeight = null, dragMode = null;

  const urlParams = new URLSearchParams(window.location.search);

  // Parse pole parameters from URL and normalize if needed
  const poleDistances = urlParams.get('poles-distances')?.split(',').map(Number).filter(v => !isNaN(v)) || [];
  const poleHeights = urlParams.get('poles-heights')?.split(',').map(Number).filter(v => !isNaN(v)) || [];
  const poleElevations = urlParams.get('poles-elevations')?.split(',').map(Number).filter(v => !isNaN(v)) || [];

  const customPoles = [];
  let useElevations = [];

  if (poleDistances.length && poleHeights.length) {
    while (poleHeights.length < poleDistances.length) poleHeights.push(10);
    useElevations = poleElevations;
    while (useElevations.length < poleDistances.length) useElevations.push(0);
    
    for (let i = 0; i < poleDistances.length; i++) {
      customPoles.push({
        x: 0, 
        z: poleDistances[i], 
        h: poleHeights[i], 
        elev: useElevations[i]
      });
    }
  }

  // Custom ground function for sloped surface through pole elevations
  let customGround = null;
  if (customPoles.length > 0) {
    customGround = (x, z) => {
      const localZ = z - terrainOffsetZ;
      if (localZ <= customPoles[0].z) return customPoles[0].elev;
      if (localZ >= customPoles[customPoles.length - 1].z) return customPoles[customPoles.length - 1].elev;
      for (let i = 1; i < customPoles.length; i++) {
        if (localZ <= customPoles[i].z) {
          const t = (localZ - customPoles[i - 1].z) / (customPoles[i].z - customPoles[i - 1].z);
          return customPoles[i - 1].elev * (1 - t) + customPoles[i].elev * t;
        }
      }
      return 0;
    };
  }
  // Define the base height calculation function
  function calculateTerrainHeight(x, z) {
    return elements.terrainSelect.value === 'flat' ? 0 : Math.sin(x*0.09)*5 + Math.cos(z*0.11)*3 + Math.sin((x+z)*0.04)*2;
  }

  // Height at specific location function
  function hAt(x, z) {
    if (customGround) {
      return customGround(x, z);
    }
    return calculateTerrainHeight(x, z);
  }

  function addGridLines(scene, terrain) {
    scene.children.filter(o => o.userData.grid).forEach(g => {
      scene.remove(g);
      if (g.geometry) g.geometry.dispose();
    });

    const gridGroup = new THREE.Group();
    gridGroup.userData.grid = true;
    gridGroup.userData.labels = [];

    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    
    // Get terrain dimensions and position
    let terrainWidth = 100;
    let terrainDepth = 100;
    let terrainPosition = { x: 0, z: 0 };
    
    if (terrain) {
      terrainWidth = terrain.geometry.parameters.width;
      terrainDepth = terrain.geometry.parameters.height;
      terrainPosition.z = terrain.position.z;
    }
    
    // Calculate grid bounds to match terrain
    const startX = -terrainWidth / 2;
    const endX = terrainWidth / 2;
    const startZ = -terrainDepth / 2 + terrainPosition.z;
    const endZ = terrainDepth / 2 + terrainPosition.z;

    // Create grid lines at 10-foot intervals (X direction)
    for (let i = Math.ceil(startX / 10) * 10; i <= Math.floor(endX / 10) * 10; i += 10) {
      const points = [];
      
      // Sample points along Z-axis to follow terrain
      for (let z = startZ; z <= endZ; z += 1) {
        const y = hAt(i, z) + 0.05; // Slight offset to avoid z-fighting
        points.push(new THREE.Vector3(i, y, z));
      }
      
      const geometryX = new THREE.BufferGeometry().setFromPoints(points);
      const lineX = new THREE.Line(geometryX, gridMaterial);
      gridGroup.add(lineX);

      if (i !== 0) {
        const labelX = document.createElement('div');
        labelX.className = 'grid-label';
        labelX.textContent = `${i}`;
        labelX.style.position = 'absolute';
        labelX.style.color = 'black';
        labelX.style.backgroundColor = 'rgba(255,255,255,0.5)';
        labelX.style.padding = '2px 4px';
        labelX.style.borderRadius = '2px';
        labelX.style.fontSize = '10px';
        labelX.style.userSelect = 'none';
        labelX.style.pointerEvents = 'none';
        document.body.appendChild(labelX);

        gridGroup.userData.labels.push({
          element: labelX,
          position: new THREE.Vector3(i, hAt(i, startZ) + 0.1, startZ),
          axis: 'x'
        });
      }
    }

    // Create grid lines at 10-foot intervals (Z direction)
    for (let i = Math.ceil(startZ / 10) * 10; i <= Math.floor(endZ / 10) * 10; i += 10) {
      const points = [];
      
      // Sample points along X-axis to follow terrain
      for (let x = startX; x <= endX; x += 1) {
        const y = hAt(x, i) + 0.05; // Slight offset to avoid z-fighting
        points.push(new THREE.Vector3(x, y, i));
      }
      
      const geometryZ = new THREE.BufferGeometry().setFromPoints(points);
      const lineZ = new THREE.Line(geometryZ, gridMaterial);
      gridGroup.add(lineZ);

      if (i !== 0) {
        const labelZ = document.createElement('div');
        labelZ.className = 'grid-label';
        labelZ.textContent = `${i}`;
        labelZ.style.position = 'absolute';
        labelZ.style.color = 'black';
        labelZ.style.backgroundColor = 'rgba(255,255,255,0.5)';
        labelZ.style.padding = '2px 4px';
        labelZ.style.borderRadius = '2px';
        labelZ.style.fontSize = '10px';
        labelZ.style.userSelect = 'none';
        labelZ.style.pointerEvents = 'none';
        document.body.appendChild(labelZ);

        gridGroup.userData.labels.push({
          element: labelZ,
          position: new THREE.Vector3(startX, hAt(startX, i) + 0.1, i),
          axis: 'z'
        });
      }
    }

    scene.add(gridGroup);
  }

  function toggleGridVisibility(visible) {
    scene.children.filter(o => o.userData.grid).forEach(g => {
      g.visible = visible;
      
      if (g.userData.labels) {
        g.userData.labels.forEach(label => {
          label.element.style.display = visible ? 'block' : 'none';
        });
      }
    });
  }

    // The buildTerrain function has been moved to terrain.js and is imported as importedBuildTerrain
  // fitGroundInView is imported from terrain.js

  function addDefaultTrees(scene, hAt) {
    const trunkG = new THREE.CylinderGeometry(0.15, 0.15, 1, 6);
    const folG = new THREE.ConeGeometry(0.75, 2, 8);
    const trunkM = new THREE.MeshStandardMaterial({color: 0x8b5a2b});
    const folM = new THREE.MeshStandardMaterial({color: 0x2e8b57});
    const cluster = 20, radius = 6;
    for(let cx = -SIZE/2; cx <= SIZE/2; cx += cluster) {
      for(let cz = -SIZE/2; cz <= SIZE/2; cz += cluster) { 
        if(Math.random() < 0.35) {
          const n = THREE.MathUtils.randInt(6, 15);
          for(let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2, r = Math.random() * radius;
            const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r, y = hAt(x, z);
            const s = THREE.MathUtils.randFloat(0.8, 1.6);
            const trunk = new THREE.Mesh(trunkG, trunkM);
            trunk.scale.y = s;
            trunk.position.set(x, y + s * 0.5, z);
            const fol = new THREE.Mesh(folG, folM);
            fol.scale.setScalar(s);
            fol.position.set(x, y + s * 1.5, z);
            const t = new THREE.Group();
            t.add(trunk);
            t.add(fol);
            t.userData.tree = true;
            trees.add(t);
            treeData.push({x, z, yTop: y + s * 1.5, ref: t});
          }
        }
      }
    }
  }

  function clearSceneElements() {
    scene.children.filter(o => o.userData.environmentElement).forEach(e => {
      scene.remove(e);
      if (e.geometry) e.geometry.dispose();
    });
  }
  function updateEnvironment() {
    clearSceneElements();
    
    if (elements.environmentSelect.value === 'coastal') {
      addCoastalElements();
    } else if (elements.environmentSelect.value === 'mountain') {
      addMountainElements();
    } else if (elements.environmentSelect.value === 'desert') {
      addDesertElements();
    } else if (elements.environmentSelect.value === 'city') {
      addCityElements();
    }
    
    updateTerrainColor();
  }  function updateTerrainColor() {
    if (!window.terrain) return;
    
    let terrainColor = ENVIRONMENT_COLORS.default;
      if (elements.environmentSelect.value in ENVIRONMENT_COLORS) {
      terrainColor = ENVIRONMENT_COLORS[elements.environmentSelect.value];
    }
    
    if (window.terrain) {
      window.terrain.material.color.setHex(terrainColor);
    }
  }

  function addCoastalElements() {
    const waterWidth = 80;
    const waterDepth = window.terrain ? window.terrain.geometry.parameters.height : 100;
    const terrainPos = window.terrain ? window.terrain.position.z : 0;
    const terrainWidth = window.terrain ? window.terrain.geometry.parameters.width : 100;
    
    // Create reflective water material
    const waterMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1e90ff, 
      transparent: true, 
      opacity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 1.5
    });
    
    // Main water body
    const waterGeometry = new THREE.PlaneGeometry(waterWidth, waterDepth, 32, 24);
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(-terrainWidth/2 - waterWidth/2, 0.1, terrainPos);
    water.userData.environmentElement = true;
    water.userData.isWater = true;
    scene.add(water);
  }

  /* ------- UI initialization ------- */
  // Set up UI with callbacks and dependencies
  setupUI(
    // Callbacks
    {
      updateGhost,
      clearSceneElements,
      resetScene,
      updateSceneElements,
      rebuild,
      updateEnvironment,
      toggleGridVisibility
    },
    // Dependencies
    {
      scene,
      trees,
      treeData,
      urlParams,
      customPoles, 
      SEG,
      hAt,
      addGridLines,
      addDefaultTrees,
      importedBuildTerrain
    }
  );
  
  // Reference UI elements directly from the elements variable we retrieved above
  const slider = elements.slider;
  const hLabel = elements.heightLabel;
  const terrainSel = elements.terrainSelect;
  const tensionSlider = elements.tensionSlider;
  const tensionLabel = elements.tensionLabel;
  const settingSel = elements.settingSelect;
  const environmentSel = elements.environmentSelect;
  const equipmentSel = elements.equipmentSelect;
  const clearBtn = elements.clearButton;
  const showGridCheck = elements.showGridCheck;

  // Use the imported buildTerrain function from terrain.js
  clearSceneElements();
  trees.clear();
  treeData.length = 0;
  const terrain = importedBuildTerrain(scene, urlParams, customPoles, elements.terrainSelect, elements.environmentSelect, SEG, hAt, addGridLines, addDefaultTrees, updateEnvironment);
  fitGroundInView(camera, controls, terrain);
  /* ------- terrain-conforming circle creation ------- */
  function createTerrainConformingCircle(centerX, centerZ, radius, segments, scaleFactor = 1.0) {
    const points = [];
    const scaledRadius = radius * scaleFactor;
    
    // Create a circle of points that follow the terrain contour
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * scaledRadius;
      const z = centerZ + Math.sin(angle) * scaledRadius;
      const y = hAt(x, z) + 0.05; // Slightly above terrain to avoid z-fighting
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    // Create a geometry from these points (closes the loop)
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }

  /* ------- span build & check ------- */
  function drawSpan(a, b) {
    const crossarmHeightA = a.base + a.h; 
    const crossarmHeightB = b.base + b.h;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
    const sag = Math.max(0.1, d * 0.05) / UIState.currentTension;
    
    const crossarmPositions = [-1.2, 0, 1.2];
    
    const dirX = b.x - a.x;
    const dirZ = b.z - a.z;
    const dirLength = Math.sqrt(dirX * dirX + dirZ * dirZ);
    const normalizedDirX = dirX / dirLength;
    const normalizedDirZ = dirZ / dirLength;
    
    const perpX = -normalizedDirZ;
    const perpZ = normalizedDirX;
    
    crossarmPositions.forEach(offset => {
      const startX = a.x + perpX * offset;
      const startZ = a.z + perpZ * offset;
      
      const endX = b.x + perpX * offset;
      const endZ = b.z + perpZ * offset;
      
      const pts = [];
      
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        const x = THREE.MathUtils.lerp(startX, endX, t);
        const z = THREE.MathUtils.lerp(startZ, endZ, t) + terrainOffsetZ;
        const y = THREE.MathUtils.lerp(crossarmHeightA, crossarmHeightB, t) - sag * Math.sin(Math.PI * t);
        pts.push(new THREE.Vector3(x, y, z));
      }
      
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mGood);
      line.userData = { span: true, a: a.obj, b: b.obj };
      scene.add(line);
    });
  }

  function rebuild() {
    const oldSpans = scene.children.filter(o => o.userData.span);
    scene.children.filter(o => o.userData.span).forEach(l => { l.geometry.dispose(); scene.remove(l); });

    const initialLoad = !window.spansInitialized;

    for (let i = 1; i < poles.length; i++) {
      drawSpan(poles[i-1], poles[i]);
    }

    if (initialLoad) {
      initBirds();
      window.spansInitialized = true;
    } else if (oldSpans.length === 0) {
      initBirds();
    }

    updateLastPoleIndicator();
  }

  function addPole(x, z, h) {
    if (poles.some(p => p.x === x && p.z === z)) return;

    const base = hAt(x, z + terrainOffsetZ);
    const mesh = new THREE.Mesh(poleGeo, mPole);
    mesh.scale.y = h / BASE_H;
    mesh.position.set(x, base + h / 2, z + terrainOffsetZ);
    mesh.userData.pole = true;

    const crossArm = new THREE.Mesh(crossArmGeo, mCrossArm);
    crossArm.position.y = 5;  
    mesh.add(crossArm);
    
    scene.add(mesh);
    poles.push({ x, z, h, base, obj: mesh });
    rebuild();
    updateCrossarmOrientations();
    updateLastPoleIndicator(); // Update the last pole indicator
  }

  function removePole(obj){ 
    const i = poles.findIndex(p => p.obj === obj); 
    if(i > -1){
      scene.remove(obj); 
      poles.splice(i, 1); 
      rebuild();
      updateCrossarmOrientations();
      updateLastPoleIndicator(); // Update the last pole indicator
    }
  }

  function updateCrossarmOrientations() {
    poles.forEach((pole, index) => {
      pole.obj.children.filter(child => child.geometry.type === 'BoxGeometry')
        .forEach(child => pole.obj.remove(child));

      const prev = index > 0 ? poles[index-1] : null;
      const next = index < poles.length-1 ? poles[index+1] : null;
      const dirs = [];
      let acuteCase = false;

      if (prev && next) {
        const v1 = new THREE.Vector3(prev.x - pole.x, 0, prev.z - pole.z).normalize();
        const v2 = new THREE.Vector3(next.x - pole.x, 0, next.z - pole.z).normalize();
        const topAngle = calculateTopAngle(prev, pole, next);
        if (topAngle >= 90) {
          dirs.push(v1, v2);
        } else {
          dirs.push(v1, v2);
          acuteCase = true;
        }
      } else if (prev) {
        dirs.push(new THREE.Vector3(prev.x - pole.x, 0, prev.z - pole.z).normalize());
      } else if (next) {
        dirs.push(new THREE.Vector3(next.x - pole.x, 0, next.z - pole.z).normalize());
      }

      dirs.forEach(dir => {
        const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        const angle = -Math.atan2(perp.z, perp.x);
        const arm = new THREE.Mesh(crossArmGeo, mCrossArm);
        if (acuteCase) arm.scale.x = 1;
        arm.position.y = 5;
        arm.rotation.y = angle;
        pole.obj.add(arm);
      });
    });
  }

  /* ------- picking helpers ------- */
  function pick(evt, list){
    mouse.set((evt.clientX / window.innerWidth) * 2 - 1, -(evt.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    return ray.intersectObjects(list, true)[0]?.object || null;
  }
  
  const poleMeshes = () => poles.map(p => p.obj);
  
  function setTreeHL(t, on){
    t.traverse(m => {
      if(m.isMesh)
        m.material = on ? mTreeHL : (m.geometry.type === 'CylinderGeometry' ? 
          new THREE.MeshStandardMaterial({color: 0x8b5a2b}) : 
          new THREE.MeshStandardMaterial({color: 0x2e8b57}));
    });
  }

  function updateGhost() {    ghost.visible = false;
    if (!hoverPt || hoverPole || hoverTree) return;
    if (poles.some(p => p.x === hoverPt.x && p.z === hoverPt.z)) return;

    const h = UIState.currentHeight;
    const base = hAt(hoverPt.x, hoverPt.z + terrainOffsetZ);

    ghost.scale.y = h / BASE_H;
    ghost.position.set(hoverPt.x, base + h / 2, hoverPt.z + terrainOffsetZ);
    ghost.visible = true;
  }

  window.addEventListener('contextmenu', e => {
    e.preventDefault();
    const tPick = pick(e, trees.children);
    if (tPick) {
      trees.remove(tPick);
      treeData.splice(treeData.findIndex(t => t.ref === tPick), 1);
      rebuild();
      return;
    }
    
    const pPick = pick(e, poleMeshes());
    if (pPick) {
      removePole(pPick);
    }
  });

  window.addEventListener('pointerdown', e => {
    if (e.shiftKey) return;

    const pPick = pick(e, poleMeshes());
    if (pPick) {
      drag = pPick;
      startY = e.clientY;
      let startX = e.clientX; // Needed to add declaration
      const pole = poles.find(p => p.obj === drag);
      dragStartPos = { x: pole.x, z: pole.z };
      dragStartHeight = pole.h;
      controls.enabled = false;
      
      birds.forEach(b => {
        if (b.obj && scene.children.includes(b.obj)) {
          scene.remove(b.obj);
        }
      });
      birds.length = 0;

      dragMode = e.altKey ? 'height' : 'position';
      return;
    }
    clickStart = [e.clientX, e.clientY];
  });
  window.addEventListener('pointermove', e => {
    if (drag) {
      mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      let hit = null;
      
      if (window.terrain) {
        const intersections = ray.intersectObject(window.terrain, true);
        hit = intersections && intersections.length > 0 ? intersections[0] : null;
      }
      
      if (hit) {
        const pole = poles.find(p => p.obj === drag);
        
        if (dragMode === 'position') {
          pole.x = SNAP(hit.point.x);
          pole.z = SNAP(hit.point.z - terrainOffsetZ);
          
          const base = hAt(pole.x, pole.z + terrainOffsetZ);
          pole.base = base;
          pole.obj.position.set(pole.x, base + pole.h / 2, pole.z + terrainOffsetZ);
        } else if (dragMode === 'height') {
          const deltaY = startY - e.clientY;
          const newHeight = Math.max(MINH, Math.min(MAXH, dragStartHeight + deltaY * DRAG_SENS));
          pole.h = SNAP(newHeight);
          pole.obj.scale.y = pole.h / BASE_H;
          pole.obj.position.y = pole.base + pole.h / 2;
        }
        
        rebuild();
        updateCrossarmOrientations();
      }
      return;
    }

    const pPick = pick(e, poleMeshes());
    if (pPick !== hoverPole) {
      if (hoverPole) hoverPole.material = mPole;
      hoverPole = pPick;
      if (hoverPole) hoverPole.material = mPoleHL;
    }

    const tPick = pick(e, trees.children);
    if (tPick !== hoverTree) {
      if (hoverTree) setTreeHL(hoverTree, false);
      hoverTree = tPick;
      if (hoverTree) setTreeHL(hoverTree, true);
    }    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    let hit = null;
    
    if (window.terrain) {
      const intersections = ray.intersectObject(window.terrain, true);
      hit = intersections && intersections.length > 0 ? intersections[0] : null;
    }

    if (hit) {
      hoverPt = {
        x: SNAP(hit.point.x),
        z: SNAP(hit.point.z - terrainOffsetZ),
      };
    } else {
      hoverPt = null;
    }

    updateGhost();
  });

  window.addEventListener('pointerup', e => {
    if (drag) {
      drag = null;
      controls.enabled = true;
      updateLastPoleIndicator(); // Update indicator after drag operation completes
      return;
    }
    if (!clickStart) return;
    const [dx, dy] = [Math.abs(e.clientX - clickStart[0]), Math.abs(e.clientY - clickStart[1])];
    clickStart = null;    
    if (dx < 5 && dy < 5 && hoverPt) {
      const h = UIState.currentHeight;
      const base = hAt(hoverPt.x, hoverPt.z + terrainOffsetZ);
      addPole(hoverPt.x, hoverPt.z, h);
      updateGhost();
    }
  });
  function resetScene() {
    poles.forEach(p => scene.remove(p.obj));
    poles.length = 0;
    scene.children.filter(o => o.userData.span).forEach(l => {
      l.geometry.dispose();
      scene.remove(l);
    });
    updateGhost();
    birds.length = 0;
    
    // Hide all indicators when resetting
    lastPoleIndicator.visible = false;
    lastPoleInnerIndicator.visible = false;
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ------- geometric calculations ------- */
  function calculateTopAngle(p1, p2, p3) {
    const angle1 = Math.atan2(p1.z - p2.z, p1.x - p2.x) * (180 / Math.PI);
    const angle2 = Math.atan2(p3.z - p2.z, p3.x - p2.x) * (180 / Math.PI);
    
    let diff = Math.abs(angle2 - angle1);
    if (diff > 180) diff = 360 - diff;
    
    return diff;
  }

  // Place custom poles on load
  if (customPoles.length > 0) {
    poles.length = 0;

    for (const pole of customPoles) {
      const mesh = new THREE.Mesh(poleGeo, mPole);
      const scaledHeight = pole.h;
      mesh.scale.y = scaledHeight / BASE_H;
      const zPos = pole.z;
      const xPos = 0; // Center poles in the strip
      const base = pole.elev;
      mesh.position.set(xPos, base + scaledHeight / 2, zPos + terrainOffsetZ);
      mesh.userData.pole = true;

      const crossArm = new THREE.Mesh(crossArmGeo, mCrossArm);
      crossArm.position.y = 5;
      mesh.add(crossArm);

      scene.add(mesh);
      poles.push({ x: xPos, z: zPos, h: scaledHeight, base, obj: mesh });
    }
    
    rebuild();
    updateCrossarmOrientations();
    updateLastPoleIndicator(); // Update the last pole indicator for custom poles
  }

  function createBird() {
    const group = new THREE.Group();
    
    // Bird body
    const bodyGeo = new THREE.ConeGeometry(0.15, 0.5, 4);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, mBird);
    group.add(body);
    
    // Head
    const headGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const head = new THREE.Mesh(headGeo, mBird);
    head.position.set(0.2, 0.08, 0);
    group.add(head);
    
    // Wings
    const wingGeo = new THREE.PlaneGeometry(0.3, 0.2);
    
    const leftWing = new THREE.Mesh(
      wingGeo,
      new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide })
    );
    leftWing.position.set(0, 0, 0.15);
    leftWing.rotation.y = Math.PI / 4;
    group.add(leftWing);
    
    const rightWing = new THREE.Mesh(
      wingGeo,
      new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide })
    );
    rightWing.position.set(0, 0, -0.15);
    rightWing.rotation.y = -Math.PI / 4;
    group.add(rightWing);
    
    // Bird properties
    const bird = {
      obj: group,
      perched: false,
      flying: false,
      targetPosition: null,
      span: null,
      spanPoint: null,
      spanOffset: null,
      wingDirection: 1,
      wingAngle: 0,
      lookDirection: new THREE.Vector3(1, 0, 0),
      
      update: function(delta) {
        if (this.flying) {
          this.updateFlying(delta);
        } else if (this.perched) {
          this.updatePerched(delta);
        } else {
          this.findPerch();
        }
      },
      
      updateFlying: function(delta) {
        if (!this.targetPosition) {
          this.findPerch();
          return;
        }        // Move toward target
        const moveSpeed = BIRD_SETTINGS.flySpeed * delta;
        const direction = new THREE.Vector3().subVectors(this.targetPosition, this.obj.position).normalize();
        this.obj.position.add(direction.multiplyScalar(moveSpeed));
        this.lookDirection.lerp(direction, 0.1);
        
        // Set bird orientation
        this.obj.lookAt(this.obj.position.clone().add(this.lookDirection));
        
        // Flap wings
        this.wingAngle += BIRD_SETTINGS.wingSpeed * this.wingDirection;
        if (Math.abs(this.wingAngle) >= 0.5) {
          this.wingDirection *= -1;
        }
        
        this.obj.children[2].rotation.z = this.wingAngle; // Left wing
        this.obj.children[3].rotation.z = -this.wingAngle; // Right wing
        
        // Check if we've reached the target
        if (this.obj.position.distanceTo(this.targetPosition) < 0.2) {
          if (this.span) {
            this.perched = true;
            this.flying = false;
            this.wingAngle = 0;
            this.obj.children[2].rotation.z = 0;
            this.obj.children[3].rotation.z = 0;
          } else {
            this.findPerch();
          }
        }
      },
      
      updatePerched: function() {
        // Occasionally look around or adjust position
        if (Math.random() < 0.005) {
          this.obj.rotation.y += (Math.random() - 0.5) * 0.2;
        }
        
        // If the span is removed, fly away
        if (!scene.children.includes(this.span)) {
          this.flyAway();
        }
      },
      
      findPerch: function() {
        const spans = scene.children.filter(o => o.userData.span);
        if (spans.length === 0) {
          this.flyAway();
          return;
        }
        
        // Pick a random span
        const span = spans[Math.floor(Math.random() * spans.length)];
        
        // Pick a random point along the span
        const positions = span.geometry.attributes.position;
        const pointIndex = Math.floor(Math.random() * (positions.count - 2) + 1);
          // Get the position on the span
        const point = new THREE.Vector3(
          positions.getX(pointIndex),
          positions.getY(pointIndex) + BIRD_SETTINGS.perchHeight,
          positions.getZ(pointIndex)
        );
        
        this.span = span;
        this.targetPosition = point;
        this.spanPoint = pointIndex;
        this.spanOffset = BIRD_SETTINGS.perchHeight;
        
        // If not already flying, start flying
        if (!this.flying) {
          this.flying = true;
          this.perched = false;
          
          // If bird isn't in the scene yet, position it randomly above
          if (!scene.children.includes(this.obj)) {
            const randomPos = new THREE.Vector3(
              point.x + (Math.random() - 0.5) * 20,
              point.y + 10 + Math.random() * 10,
              point.z + (Math.random() - 0.5) * 20
            );
            this.obj.position.copy(randomPos);
            scene.add(this.obj);
          }
          
          // Look toward the target
          this.lookDirection = new THREE.Vector3().subVectors(this.targetPosition, this.obj.position).normalize();
        }
      },
      
      flyAway: function() {
        this.span = null;
        this.perched = false;
        this.flying = true;
        
        // Fly up and slightly away
        const flyDirection = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          1,
          (Math.random() - 0.5) * 2
        ).normalize();
        
        this.targetPosition = new THREE.Vector3().addVectors(
          this.obj.position,
          flyDirection.multiplyScalar(15)
        );
        
        // After flying away, try to find a new perch
        setTimeout(() => {
          if (this.obj && scene.children.includes(this.obj)) {
            this.findPerch();
          }
        }, 2000 + Math.random() * 3000);
      }
    };
    
    return bird;
  }

  function initBirds() {
    birds.forEach(bird => {
      if (bird.obj && scene.children.includes(bird.obj)) {
        scene.remove(bird.obj);
      }
    });
    birds.length = 0;
      const spans = scene.children.filter(o => o.userData.span);
    if (spans.length === 0) return;
    
    for (let i = 0; i < BIRD_SETTINGS.count; i++) {
      if (Math.random() < BIRD_SETTINGS.spawnChance) {
        const bird = createBird();
        birds.push(bird);
        
        setTimeout(() => {
          bird.findPerch();
        }, i * 500);
      }
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Update grid labels position if they exist
    scene.children.filter(o => o.userData.grid && o.userData.labels).forEach(grid => {
      if (grid.userData.labels && grid.visible) {
        grid.userData.labels.forEach(label => {
          const screenPosition = label.position.clone();
          screenPosition.project(camera);
          
          const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
          
          if (screenPosition.z < 1) {
            label.element.style.display = 'block';
            label.element.style.transform = `translate(-50%, -50%)`;
            label.element.style.left = `${x}px`;
            label.element.style.top = `${y}px`;
          } else {
            label.element.style.display = 'none';
          }
        });
      } else if (grid.userData.labels) {
        grid.userData.labels.forEach(label => {
          label.element.style.display = 'none';
        });
      }
    });
    
    // Update last pole indicator
    if (lastPoleIndicator.visible) {
      updateLastPoleIndicator();
    }
    
    // Update birds
    const delta = 0.016; // Approximate frame time
    birds.forEach(bird => bird.update(delta));
    
    // Update coastal water waves if present
    const waterMesh = scene.children.find(o => o.userData.isWater);
    if (waterMesh && waterMesh.userData.waveInfo) {
      const waveInfo = waterMesh.userData.waveInfo;
      waveInfo.time += delta * 0.5;
      
      // Animate water vertices to create gentle waves
      const positions = waterMesh.geometry.attributes.position;
      const originalPos = waveInfo.originalPositions;
      
      for (let i = 0; i < positions.count; i++) {
        const orig = originalPos[i];
        
        // Get position relative to shoreline for wave intensity
        const distFromShore = orig.x + 40; // Assuming shoreline is at x = -40
        const waveMultiplier = Math.min(1, Math.max(0, distFromShore / 60)); 
        
        // Create gentle wave motion
        const wavePhase = waveInfo.time + orig.z * 0.05;
        const waveHeight = 0.2 * waveMultiplier * Math.sin(wavePhase);
        
        // Additional smaller ripples
        const ripplePhase1 = waveInfo.time * 1.2 + orig.x * 0.1;
        const ripplePhase2 = waveInfo.time * 0.8 - orig.z * 0.08;
        const rippleHeight = 0.05 * Math.sin(ripplePhase1) * Math.sin(ripplePhase2);
        
        positions.setY(i, orig.y + waveHeight + rippleHeight);
      }
      
      positions.needsUpdate = true;
      
      // Animate foam at shoreline
      const foam = scene.children.find(o => o.userData.isWaterFoam);
      if (foam) {
        // Make foam move slightly up and down with waves
        const foamHeight = 0.12 + 0.05 * Math.sin(waveInfo.time * 1.2);
        foam.position.y = foamHeight;
        
        // Vary foam opacity with wave motion
        const foamOpacity = 0.6 + 0.2 * Math.sin(waveInfo.time);
        foam.material.opacity = foamOpacity;
      }
    }
    
    renderer.render(scene, camera);
  }
  animate();

  function updateSceneElements() {
    const sceneElements = {
      buildings: []
    };

    sceneElements.buildings.forEach(b => scene.remove(b));
    sceneElements.buildings = [];
    
    updatePoleAppearance();
    addRandomBuildings();
    addRoads();
  }  function updatePoleAppearance() {
    let poleColor = EQUIPMENT_COLORS.distribution.pole;
    let crossArmColor = EQUIPMENT_COLORS.distribution.crossArm;
    
    if (elements.equipmentSelect.value in EQUIPMENT_COLORS) {
      poleColor = EQUIPMENT_COLORS[elements.equipmentSelect.value].pole;
      crossArmColor = EQUIPMENT_COLORS[elements.equipmentSelect.value].crossArm;
    }
    
    poles.forEach(pole => {
      pole.obj.material.color.setHex(poleColor);
      
      pole.obj.children.forEach(child => {
        if (child.geometry.type === 'BoxGeometry') {
          child.material.color.setHex(crossArmColor);
        }
      });
    });
    
    mPole.color.setHex(poleColor);
    mCrossArm.color.setHex(crossArmColor);
  }

  function addRandomBuildings() {
    if (!window.terrain) return;

    const terrainWidth = window.terrain.geometry.parameters.width;
    const terrainDepth = window.terrain.geometry.parameters.height;
    const terrainPos = window.terrain.position.z;    if (elements.settingSelect.value === 'residential') {
      const buildingSize = 3;
      const buildingHeight = 5;
      const rowSpacing = 10;
      const colSpacing = 10;
      const maxBuildings = 20;

      const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x8b0000 });

      let buildingCount = 0;
      for (let row = 0; row < terrainDepth / rowSpacing && buildingCount < maxBuildings; row++) {
        for (let col = 0; col < terrainWidth / colSpacing && buildingCount < maxBuildings; col++) {
          const x = -terrainWidth / 2 + col * colSpacing + buildingSize / 2;
          const z = -terrainDepth / 2 + row * rowSpacing + buildingSize / 2 + terrainPos;
          const y = hAt(x, z) + buildingHeight / 2;

          const buildingGeometry = new THREE.BoxGeometry(buildingSize, buildingHeight, buildingSize);
          const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
          building.position.set(x, y, z);
          building.userData.environmentElement = true;

          scene.add(building);
          buildingCount++;
        }
      }
    }
  }

  function addRoads() {
    if (!window.terrain) return;

    const terrainWidth = window.terrain.geometry.parameters.width;
    const terrainDepth = window.terrain.geometry.parameters.height;
    const terrainPos = window.terrain.position.z;

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

    for (let row = 0; row <= Math.ceil(20 / Math.floor(terrainWidth / 10)); row++) {
      const roadGeometry = new THREE.PlaneGeometry(terrainWidth, 2, 1, Math.floor(terrainWidth / 2));
      const road = new THREE.Mesh(roadGeometry, roadMaterial);

      const positions = road.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i) - terrainDepth / 2 + row * 10 + terrainPos;
        positions.setY(i, hAt(x, z));
      }

      road.rotation.x = -Math.PI / 2;
      road.geometry.attributes.position.needsUpdate = true;
      road.geometry.computeVertexNormals();
      road.userData.environmentElement = true;
      scene.add(road);
    }

    for (let col = 0; col <= Math.floor(terrainWidth / 10); col++) {
      const roadGeometry = new THREE.PlaneGeometry(2, terrainDepth, 1, Math.floor(terrainDepth / 2));
      const road = new THREE.Mesh(roadGeometry, roadMaterial);

      const positions = road.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) - terrainWidth / 2 + col * 10;
        const z = positions.getZ(i) + terrainPos;
        positions.setY(i, hAt(x, z));
      }

      road.rotation.x = -Math.PI / 2;
      road.geometry.attributes.position.needsUpdate = true;
      road.geometry.computeVertexNormals();
      road.userData.environmentElement = true;
      scene.add(road);
    }
  }  function updateLastPoleIndicator() {
    if (poles.length === 0) {
      lastPoleIndicator.visible = false;
      lastPoleInnerIndicator.visible = false;
      return;
    }
    
    // Get the last pole in the array
    const lastPole = poles[poles.length - 1];
    
    // Calculate pulse factors for scale and opacity
    const currentTime = Date.now() * 0.003;
    const outerPulse = Math.sin(currentTime);
    const innerPulse = Math.sin(currentTime + Math.PI); // Opposite phase
    
    // Scale factors (subtle 10% diameter change)
    const outerScaleFactor = 1 + 0.1 * Math.abs(outerPulse);
    const innerScaleFactor = 1 + 0.1 * Math.abs(innerPulse);
    
    // Create terrain-conforming geometry for the outer indicator with scale
    const indicatorGeometry = createTerrainConformingCircle(
      lastPole.x, 
      lastPole.z + terrainOffsetZ, 
      1.0, 
      32,
      outerScaleFactor
    );
    
    // Update the geometry of the indicators
    if (lastPoleIndicator.geometry) {
      lastPoleIndicator.geometry.dispose();
    }
    lastPoleIndicator.geometry = indicatorGeometry;
    

    // Also pulse the opacity for enhanced visibility
    const outerOpacity = 0.4 + 0.4 * Math.abs(outerPulse);
    
    lastPoleIndicator.material.opacity = outerOpacity;
    
    lastPoleIndicator.visible = true;
  }
});