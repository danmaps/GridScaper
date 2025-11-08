import { CONSTANTS, HELPERS, BIRD_SETTINGS, EQUIPMENT_COLORS, createMaterials, createGeometries } from './config.js';
import { buildTerrain as importedBuildTerrain, terrainOffsetZ, fitGroundInView } from './terrain.js';
import { initUI, setupUI, UIState, getUIValues, elements } from './ui.js';
import { getConductorCurve } from '../utils/catenary.js';
import { showGISImportDialog } from './gisImportDialog.js';
import { showElevationProfileDialog } from './elevationProfileDialog.js';

// Make THREE available to our ES module by accessing it from window
const THREE = window.THREE;

document.addEventListener('DOMContentLoaded', () => {
  // Update all DOM label styles for dark mode
  function updateSceneLabelStylesForDarkMode(isDark) {
    // Update conductor color (goodSpan) for dark mode
    if (window.materials && window.materials.goodSpan) {
      window.materials.goodSpan.color = new THREE.Color(isDark ? 0xffffff : 0x000000);
    }
    // Update terrain surface color for dark mode
    if (window.terrain && window.terrain.material) {
      window.terrain.material.color = new THREE.Color(isDark ? 0x0a1a3a : 0x5ca55c);
      window.terrain.material.needsUpdate = true;
    }
    // Grid labels
    document.querySelectorAll('.grid-label').forEach(label => {
      label.style.backgroundColor = isDark ? 'rgba(10,16,20,0.85)' : 'rgba(255,255,255,0.5)';
      label.style.color = isDark ? '#00ffe7' : 'black';
      label.style.border = isDark ? '1px solid #00ffe7' : 'none';
    });
    // Clearance labels
    document.querySelectorAll('.clearance-label').forEach(label => {
      label.style.backgroundColor = isDark ? 'rgba(10,16,20,0.95)' : 'rgba(255,255,255,0.9)';
      // Use the border color already set (red/green)
      label.style.color = isDark ? '#00ffe7' : (label.style.borderColor === 'rgb(255, 0, 0)' ? '#ff0000' : '#00ff00');
    });
    // Pole height labels
    document.querySelectorAll('div[style*="position: absolute"]').forEach(label => {
      if (label.textContent && label.textContent.match(/ft|height/i) && label.style.backgroundColor.includes('rgba(0,0,0')) {
        label.style.backgroundColor = isDark ? 'rgba(10,16,20,0.85)' : 'rgba(0,0,0,0.7)';
        label.style.color = isDark ? '#00ffe7' : 'white';
      }
    });
    // Sag labels
    document.querySelectorAll('div[style*="position: absolute"]').forEach(label => {
      if (label.textContent && label.textContent.match(/sag/i)) {
        label.style.backgroundColor = isDark ? 'rgba(10,16,20,0.85)' : 'rgba(0,0,0,0.7)';
        label.style.color = isDark ? '#ff6b6b' : '#ff6b6b';
        label.style.border = isDark ? '1px solid #ff6b6b' : '1px solid #ff6b6b';
      }
    });
  }
  window.updateSceneLabelStylesForDarkMode = updateSceneLabelStylesForDarkMode;
  const isDarkModeActive = () => document.body.classList.contains('dark-mode');
  
  // History management for undo/redo
  const history = {
    states: [],
    currentIndex: -1,
    maxSize: 50,
    
    captureState() {
      // Create a deep copy of current poles state
      const state = poles.map(p => ({
        x: p.x,
        z: p.z,
        h: p.h,
        base: p.base
      }));
      
      // Remove any future states if we're not at the end
      if (this.currentIndex < this.states.length - 1) {
        this.states = this.states.slice(0, this.currentIndex + 1);
      }
      
      // Add new state
      this.states.push(state);
      
      // Limit history size
      if (this.states.length > this.maxSize) {
        this.states.shift();
      } else {
        this.currentIndex++;
      }
      
      updateUndoRedoButtons();
    },
    
    canUndo() {
      return this.currentIndex > 0;
    },
    
    canRedo() {
      return this.currentIndex < this.states.length - 1;
    },
    
    undo() {
      if (!this.canUndo()) return;
      
      this.currentIndex--;
      this.restoreState(this.states[this.currentIndex]);
      updateUndoRedoButtons();
    },
    
    redo() {
      if (!this.canRedo()) return;
      
      this.currentIndex++;
      this.restoreState(this.states[this.currentIndex]);
      updateUndoRedoButtons();
    },
    
    restoreState(state) {
      // Clear current poles without capturing state
      poles.forEach(p => scene.remove(p.obj));
      poles.length = 0;
      
      // Restore poles from state
      state.forEach(poleData => {
        const mesh = new THREE.Mesh(poleGeo, mPole);
        mesh.scale.y = poleData.h / BASE_H;
        mesh.position.set(poleData.x, poleData.base + poleData.h / 2, poleData.z + terrainOffsetZ);
        mesh.userData.pole = true;

        const crossArm = new THREE.Mesh(crossArmGeo, mCrossArm);
        crossArm.position.y = 5;
        mesh.add(crossArm);

        scene.add(mesh);
        poles.push({ 
          x: poleData.x, 
          z: poleData.z, 
          h: poleData.h, 
          base: poleData.base, 
          obj: mesh 
        });
      });
      
      rebuild();
      updateCrossarmOrientations();
      updateLastPoleIndicator();
    },
    
    clear() {
      this.states = [];
      this.currentIndex = -1;
      updateUndoRedoButtons();
    }
  };
  
  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoButton');
    const redoBtn = document.getElementById('redoButton');
    
    if (undoBtn) {
      undoBtn.disabled = !history.canUndo();
      undoBtn.style.opacity = history.canUndo() ? '1' : '0.5';
    }
    
    if (redoBtn) {
      redoBtn.disabled = !history.canRedo();
      redoBtn.style.opacity = history.canRedo() ? '1' : '0.5';
    }
  }
  
  // Use imported constants
  const { CLEARANCE, SAMPLES, DRAG_SENS, MINH, MAXH, SIZE, SEG, BASE_H, R } = CONSTANTS;
  const { SNAP } = HELPERS;  
  
  // Challenge mode state
  const challengeState = {
    active: false,
    substationBuilding: null,
    customerBuilding: null,
    substationMesh: null,
    customerMesh: null,
    isPowered: false
  };

  // Phase 1: Introduce explicit spans array (sequential adjacency only for now)
  // Each span entry will store references to pole objects (not meshes directly) for later graph-based operations.
  // Primary poles collection (was implicit previously, now explicitly declared before spans usage)
  const poles = [];
  const spans = []; // Manual conductor connections: { a: pole1, b: pole2, type: 'pole' }

  function updateSequentialSpans() {
    // No longer auto-generates spans
    // Spans are now manually created by user with conductor tool
    // Keep existing manually-created spans
  }
  
  function addSpan(poleA, poleB) {
    // Check if span already exists
    const exists = spans.some(s => 
      (s.a === poleA && s.b === poleB) || (s.a === poleB && s.b === poleA)
    );
    
    if (!exists) {
      spans.push({ a: poleA, b: poleB, type: 'pole' });
      rebuild();
      history.captureState();
    }
  }
  
  function removeSpan(poleA, poleB) {
    const index = spans.findIndex(s => 
      (s.a === poleA && s.b === poleB) || (s.a === poleB && s.b === poleA)
    );
    
    if (index !== -1) {
      spans.splice(index, 1);
      rebuild();
      history.captureState();
    }
  }
  
  function hasSpan(poleA, poleB) {
    return spans.some(s => 
      (s.a === poleA && s.b === poleB) || (s.a === poleB && s.b === poleA)
    );
  }
  
  // Initialize UI elements early (without event handlers)
  initUI();

  // We already have elements imported at the top of the file via the import statement
  // Simply use the named export 'elements' from the ui.js module

  /* ------- three basics ------- */
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  window.scene = scene;
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
  // Materials reference (previously mPole referenced before created)
  const materials = createMaterials();
  window.materials = materials;
  const mPole = materials.pole;
  const mCrossArm = materials.crossArm;
  const mPoleHL = materials.poleHighlight;
  const mGood = materials.goodSpan;
  const mBird = materials.bird; // Bird material
  const mGhost = materials.ghost;

  // Birds collection (re-added after refactor)
  const birds = [];
  // Hover state trackers (trees removed but keep variable to avoid reference errors)
  let hoverPole = null;
  let hoverPt = null;
  let hoverTree = null;

  // Labels / annotation collections
  const poleHeightLabels = [];
  const sagCalculationObjects = [];

  // Ghost pole mesh placeholder
  const ghost = new THREE.Mesh(poleGeo, mGhost.clone());
  ghost.visible = false;
  ghost.userData.ghost = true;
  scene.add(ghost);

  // Last pole outer indicator (pulsing ring) + existing inner indicator
  const mLastPoleOuterIndicator = new THREE.LineBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.5,
    linewidth: 1
  });
  let lastPoleIndicator = new THREE.Line(new THREE.BufferGeometry(), mLastPoleOuterIndicator);
  lastPoleIndicator.visible = false;
  scene.add(lastPoleIndicator);
  
  // Conductor hover halo (glowing pulsing ring around pole top)
  const mConductorHalo = new THREE.LineBasicMaterial({
    color: 0x00ffe7,
    transparent: true,
    opacity: 0.8,
    linewidth: 2
  });
  let conductorHalo = new THREE.Line(new THREE.BufferGeometry(), mConductorHalo);
  conductorHalo.visible = false;
  scene.add(conductorHalo);

  // Declare mouse and ray BEFORE any picking helpers use them
  const mouse = new THREE.Vector2();
  const ray = new THREE.Raycaster();
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
  const clearanceThresholdParam = urlParams.get('clearanceThreshold');

  const customPoles = [];
  let useElevations = [];

  // Set clearance threshold from URL parameter if provided
  if (clearanceThresholdParam && !isNaN(Number(clearanceThresholdParam))) {
    UIState.clearanceThreshold = Number(clearanceThresholdParam);
    if (elements.clearanceThreshold) {
      elements.clearanceThreshold.value = UIState.clearanceThreshold;
      elements.clearanceLabel.textContent = UIState.clearanceThreshold;
    }
  }

  // Set grid visibility from URL parameter if provided
  const showGridParam = urlParams.get('showGrid');
  if (showGridParam === 'false') {
    UIState.showGrid = false;
    if (elements.showGridCheck) {
      elements.showGridCheck.checked = false;
    }
  }

  // Set tension from URL parameter if provided
  const tensionParam = urlParams.get('tension');
  if (tensionParam && !isNaN(Number(tensionParam))) {
    UIState.currentTension = Number(tensionParam);
    if (elements.tensionSlider) {
      elements.tensionSlider.value = UIState.currentTension;
      elements.tensionLabel.textContent = `${UIState.currentTension} lbs`;
    }
  }

  // Set display options from URL parameters
  const showPoleHeightLabelsParam = urlParams.get('showPoleHeightLabels');
  if (showPoleHeightLabelsParam === 'true') {
    UIState.showPoleHeightLabels = true;
    if (elements.showPoleHeightLabels) {
      elements.showPoleHeightLabels.checked = true;
    }
  }

  const showSagCalculationsParam = urlParams.get('showSagCalculations');
  if (showSagCalculationsParam === 'true') {
    UIState.showSagCalculations = true;
    if (elements.showSagCalculations) {
      elements.showSagCalculations.checked = true;
    }
  }

  const showClearanceBuffersParam = urlParams.get('showClearanceBuffers');
  if (showClearanceBuffersParam === 'true') {
    UIState.showClearanceBuffers = true;
    if (elements.showClearanceBuffers) {
      elements.showClearanceBuffers.checked = true;
    }
  }

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
  let gisElevationSurface = null; // For GIS-imported elevation surface
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
    return 0; // Always flat terrain
  }

  // Height at specific location function
  function hAt(x, z) {
    // Priority: GIS elevation surface > custom ground > flat terrain
    if (gisElevationSurface) {
      return gisElevationSurface(x, z);
    }
    if (customGround) {
      return customGround(x, z);
    }
    return calculateTerrainHeight(x, z);
  }

  function addGridLines(scene, terrain) {
    // Clean up existing grid objects and their DOM label elements
    clearGridElements();

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
    // After creating grid, ensure label visibility matches UI state
    if (typeof UIState !== 'undefined') {
      toggleGridLabels(UIState.showGridLabels);
    }
  }

  function toggleGridVisibility(visible) {
    scene.children.filter(o => o.userData.grid).forEach(g => {
      g.visible = visible;
    });
    // Re-sync labels after changing grid visibility
    toggleGridLabels(UIState.showGridLabels);
  }

  // Separate label visibility toggle
  function toggleGridLabels(visible) {
    scene.children.filter(o => o.userData.grid).forEach(g => {
      if (!g.userData.labels) return;
      g.userData.labels.forEach(label => {
        label.element.style.display = visible ? 'block' : 'none';
      });
    });
  }

  // Utility to clear clearance indicators/labels
  function clearClearanceIndicators() {
    scene.children.filter(o => o.userData.clearanceIndicator || o.userData.clearanceBuffer).forEach(indicator => {
      scene.remove(indicator);
      if (indicator.geometry) indicator.geometry.dispose();
      if (indicator.material) indicator.material.dispose();
    });
    document.querySelectorAll('.clearance-label').forEach(label => label.remove());
  }

    // The buildTerrain function has been moved to terrain.js and is imported as importedBuildTerrain
  // fitGroundInView is imported from terrain.js


  function clearSceneElements() {
    scene.children.filter(o => o.userData.environmentElement).forEach(obj => {
      scene.remove(obj);
      if (obj.traverse) {
        obj.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      } else {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });
  }

  function clearSettingElements() {
    scene.children.filter(o => o.userData.settingElement).forEach(obj => {
      scene.remove(obj);
      if (obj.traverse) {
        obj.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      } else {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });
  }

  function addCoastalElements() {
    if (!window.terrain) return;

    const waterWidth = 80;
    const waterDepth = window.terrain.geometry.parameters.height;
    const terrainPos = window.terrain.position.z;
    const terrainWidth = window.terrain.geometry.parameters.width;

    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e90ff,
      transparent: true,
      opacity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 1.5
    });

    const waterGeometry = new THREE.PlaneGeometry(waterWidth, waterDepth, 32, 24);
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(-terrainWidth / 2 - waterWidth / 2, 0.1, terrainPos);
    water.userData.environmentElement = true;
    water.userData.isWater = true;
    const originalPositions = [];
    const posAttr = waterGeometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      originalPositions.push({
        x: posAttr.getX(i),
        y: posAttr.getY(i),
        z: posAttr.getZ(i)
      });
    }
    water.userData.waveInfo = {
      time: 0,
      originalPositions
    };
    scene.add(water);

    const foamMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const foamGeometry = new THREE.PlaneGeometry(10, waterDepth, 1, 24);
    const foam = new THREE.Mesh(foamGeometry, foamMaterial);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(-terrainWidth / 2 - 5, 0.12, terrainPos);
    foam.userData.environmentElement = true;
    foam.userData.isWaterFoam = true;
    scene.add(foam);
  }

  function addMountainElements() {
    if (!window.terrain) return;

    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
    const terrainWidth = window.terrain.geometry.parameters.width;
    const terrainDepth = window.terrain.geometry.parameters.height;
    const terrainPos = window.terrain.position.z;

    for (let i = 0; i < 18; i++) {
      const geometry = new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(1.2, 3.5));
      const rock = new THREE.Mesh(geometry, rockMaterial.clone());
      const x = THREE.MathUtils.randFloat(-terrainWidth / 2, terrainWidth / 2);
      const z = THREE.MathUtils.randFloat(-terrainDepth / 2, terrainDepth / 2) + terrainPos;
      const y = hAt(x, z);
      rock.position.set(x, y + 1.0, z);
      rock.userData.environmentElement = true;
      scene.add(rock);
    }
  }

  function addDesertElements() {
    if (!window.terrain) return;

    const duneMaterial = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.5 });
    const cactusMaterial = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
    const terrainWidth = window.terrain.geometry.parameters.width;
    const terrainDepth = window.terrain.geometry.parameters.height;
    const terrainPos = window.terrain.position.z;

    for (let i = 0; i < 8; i++) {
      const geometry = new THREE.ConeGeometry(THREE.MathUtils.randFloat(6, 10), THREE.MathUtils.randFloat(2, 3), 16);
      geometry.rotateX(-Math.PI / 2);
      const dune = new THREE.Mesh(geometry, duneMaterial.clone());
      const x = THREE.MathUtils.randFloat(-terrainWidth / 3, terrainWidth / 3);
      const z = THREE.MathUtils.randFloat(-terrainDepth / 2, terrainDepth / 2) + terrainPos;
      const y = hAt(x, z);
      dune.position.set(x, y + 0.5, z);
      dune.userData.environmentElement = true;
      scene.add(dune);
    }

    for (let i = 0; i < 12; i++) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 4, 8), cactusMaterial.clone());
      const x = THREE.MathUtils.randFloat(-terrainWidth / 2, terrainWidth / 2);
      const z = THREE.MathUtils.randFloat(-terrainDepth / 2, terrainDepth / 2) + terrainPos;
      const y = hAt(x, z);
      trunk.position.set(x, y + 2, z);
      trunk.userData.environmentElement = true;
      scene.add(trunk);
    }
  }



  /* ------- Challenge Mode Functions ------- */
  
  function createBuilding(position, size, color, emissiveColor) {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshStandardMaterial({ 
      color: color,
      emissive: emissiveColor,
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.7
    });
    const building = new THREE.Mesh(geometry, material);
    building.position.copy(position);
    building.position.y += size.y / 2; // Position on ground
    building.userData.challengeBuilding = true;
    building.userData.immovable = true;
    return building;
  }
  
  function enterChallengeMode() {
    if (challengeState.active) return;
    
    // Remove clearance lines/labels when switching modes
    clearClearanceIndicators();

    // Clear existing poles
    resetScene();
    
    // Determine terrain Z extents for placement
    let minZ, maxZ;
    if (window.terrain && window.terrain.geometry && window.terrain.geometry.parameters) {
      const depth = window.terrain.geometry.parameters.height;
      const terrainPosZ = window.terrain.position.z;
      minZ = -depth / 2 + terrainPosZ;
      maxZ = depth / 2 + terrainPosZ;
    } else {
      // Fallback to SIZE constant if terrain not yet built
      minZ = -SIZE / 2;
      maxZ = SIZE / 2;
    }
    // Building depth margins so cubes sit fully on surface
    const substationSize = { x: 8, y: 12, z: 8 };
    const customerSize = { x: 6, y: 8, z: 6 };
    const substationMargin = substationSize.z / 2 + 1;
    const customerMargin = customerSize.z / 2 + 1;
    const substationZ = minZ + substationMargin;
    const customerZ = maxZ - customerMargin;
    const substationBase = hAt(0, substationZ + terrainOffsetZ);
    const customerBase = hAt(0, customerZ + terrainOffsetZ);
    
    // Create substation building (green, larger)
    challengeState.substationMesh = createBuilding(
      new THREE.Vector3(0, substationBase, substationZ + terrainOffsetZ),
      substationSize,
      0x059669, // Dark green
      0x10b981  // Emissive green
    );
    scene.add(challengeState.substationMesh);
    
    // Store substation data
    challengeState.substationBuilding = {
      x: 0,
      z: substationZ,
      h: 12,
      base: substationBase,
      obj: challengeState.substationMesh
    };
    
    // Create customer building (blue, smaller - initially dark)
    challengeState.customerMesh = createBuilding(
      new THREE.Vector3(0, customerBase, customerZ + terrainOffsetZ),
      customerSize,
      0x1e3a8a, // Dark blue
      0x000000  // No emissive (unpowered)
    );
    scene.add(challengeState.customerMesh);
    
    // Store customer data
    challengeState.customerBuilding = {
      x: 0,
      z: customerZ,
      h: 8,
      base: customerBase,
      obj: challengeState.customerMesh
    };
    
    // Create connection range indicator circle around customer
    const connectionRange = 15; // feet
    const targetCircleGeometry = createTerrainConformingCircle(
      challengeState.customerBuilding.x,
      challengeState.customerBuilding.z + terrainOffsetZ,
      connectionRange,
      64
    );
    const targetCircleMaterial = new THREE.LineBasicMaterial({
      color: 0x3b82f6, // Blue to match customer building
      transparent: true,
      opacity: 0.5,
      linewidth: 2
    });
    challengeState.targetCircle = new THREE.Line(targetCircleGeometry, targetCircleMaterial);
    challengeState.targetCircle.userData.challengeIndicator = true;
    scene.add(challengeState.targetCircle);
    
    // Activate challenge mode
    challengeState.active = true;
    challengeState.isPowered = false;
    UIState.challengeMode = true;
    UIState.challengeSpent = 0;
    
    // Show challenge panel with current budget
    if (elements.challengePanel) {
      elements.challengePanel.classList.add('active');
    }
    if (elements.challengeBudget) {
      elements.challengeBudget.textContent = `$${UIState.challengeBudget.toLocaleString()}`;
    }
    // Toggle mode buttons visibility
    const challengeBtn = document.getElementById('toggleChallengeMode');
    const sandboxBtn = document.getElementById('sandboxModeButton');
    if (challengeBtn) challengeBtn.style.display = 'none';
    if (sandboxBtn) sandboxBtn.style.display = 'inline-block';
    
    // Update UI
    updateChallengeStats();
    
    // Clear history and capture initial state
    history.clear();
    history.captureState();
  }
  
  function exitChallengeMode() {
    if (!challengeState.active) return;
    
    // Remove clearance lines/labels when exiting challenge mode
    clearClearanceIndicators();

    // Remove buildings
    if (challengeState.substationMesh) {
      scene.remove(challengeState.substationMesh);
      challengeState.substationMesh = null;
    }
    if (challengeState.customerMesh) {
      scene.remove(challengeState.customerMesh);
      challengeState.customerMesh = null;
    }
    
    // Remove target circle
    if (challengeState.targetCircle) {
      scene.remove(challengeState.targetCircle);
      if (challengeState.targetCircle.geometry) {
        challengeState.targetCircle.geometry.dispose();
      }
      if (challengeState.targetCircle.material) {
        challengeState.targetCircle.material.dispose();
      }
      challengeState.targetCircle = null;
    }
    
    // Deactivate challenge mode
    challengeState.active = false;
    challengeState.substationBuilding = null;
    challengeState.customerBuilding = null;
    challengeState.isPowered = false;
    UIState.challengeMode = false;
    
    // Hide challenge panel
    if (elements.challengePanel) {
      elements.challengePanel.classList.remove('active');
    }
    // Toggle mode buttons visibility
    const challengeBtn = document.getElementById('toggleChallengeMode');
    const sandboxBtn = document.getElementById('sandboxModeButton');
    if (challengeBtn) challengeBtn.style.display = 'inline-block';
    if (sandboxBtn) sandboxBtn.style.display = 'none';
    
    // Clear scene
    resetScene();
  }
  
  function checkIfCustomerPowered() {
    if (!challengeState.active || poles.length === 0) {
      if (challengeState.isPowered) {
        // Turn off customer building
        challengeState.customerMesh.material.emissive.setHex(0x000000);
        challengeState.customerMesh.material.emissiveIntensity = 0;
        challengeState.isPowered = false;
      }
      return false;
    }
    
    // Check if last pole is close enough to customer building
    const lastPole = poles[poles.length - 1];
    const dx = lastPole.x - challengeState.customerBuilding.x;
    const dz = lastPole.z - challengeState.customerBuilding.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // If within connection range (e.g., 15 feet)
    const isPowered = distance <= 15;
    
    if (isPowered && !challengeState.isPowered) {
      // Light up the customer building!
      challengeState.customerMesh.material.emissive.setHex(0x3b82f6); // Bright blue
      challengeState.customerMesh.material.emissiveIntensity = 0.8;
      challengeState.isPowered = true;
    } else if (!isPowered && challengeState.isPowered) {
      // Turn off
      challengeState.customerMesh.material.emissive.setHex(0x000000);
      challengeState.customerMesh.material.emissiveIntensity = 0;
      challengeState.isPowered = false;
    }
    
    return isPowered;
  }
  
  function updateChallengeStats() {
    if (!challengeState.active) return;
    
    // Calculate costs with variable pole pricing based on height
    const poleCount = poles.length;
    let poleCost = 0;
    
    // Calculate pole cost: base cost + height multiplier
    // Shorter poles (10ft) cost less, taller poles (30ft+) cost more
    poles.forEach(pole => {
      const basePoleCost = UIState.costPerPole; // $1500 for a standard pole
      const heightFactor = pole.h / 20; // 20ft is the reference height
      const thisPoleCoast = basePoleCost * heightFactor;
      poleCost += thisPoleCoast;
    });
    
    // Calculate conductor length
    let conductorLength = 0;
    for (let i = 1; i < poles.length; i++) {
      const p1 = poles[i-1];
      const p2 = poles[i];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      conductorLength += distance;
    }
    
    // Add cost for connection to substation (first pole)
    if (poles.length > 0) {
      const firstPole = poles[0];
      const dx = firstPole.x - challengeState.substationBuilding.x;
      const dz = firstPole.z - challengeState.substationBuilding.z;
      const substationDistance = Math.sqrt(dx * dx + dz * dz);
      conductorLength += substationDistance;
    }
    
    // Add cost for connection to customer (if powered)
    if (challengeState.isPowered && poles.length > 0) {
      const lastPole = poles[poles.length - 1];
      const dx = lastPole.x - challengeState.customerBuilding.x;
      const dz = lastPole.z - challengeState.customerBuilding.z;
      const customerDistance = Math.sqrt(dx * dx + dz * dz);
      conductorLength += customerDistance;
    }
    
    const conductorCost = conductorLength * UIState.costPerFoot;
    
    const totalSpent = poleCost + conductorCost;
    const remaining = UIState.challengeBudget - totalSpent;
    
    UIState.challengeSpent = totalSpent;
    
    // Update UI
    if (elements.challengeSpent) {
      elements.challengeSpent.textContent = `$${Math.round(totalSpent).toLocaleString()}`;
    }
    if (elements.challengeRemaining) {
      elements.challengeRemaining.textContent = `$${Math.round(remaining).toLocaleString()}`;
      elements.challengeRemaining.className = 'challenge-stat-value ' + (remaining >= 0 ? 'under-budget' : 'over-budget');
    }
    if (elements.challengePoles) {
      elements.challengePoles.textContent = poleCount;
    }
    
    // Check if customer is powered
    checkIfCustomerPowered();
  }
  
  function checkChallengeSolution() {
    if (!challengeState.active) return;
    
    const issues = [];
    
    // Check if customer is powered
    if (!challengeState.isPowered) {
      issues.push('❌ Customer is not powered! Place a pole within 15 feet of the customer building.');
    }
    
    // Check if there are poles
    if (poles.length === 0) {
      issues.push('❌ No poles placed! You need to connect the substation to the customer.');
    }
    
    // Check span lengths
    let hasSpanViolation = false;
    
    // Check first pole distance from substation
    if (poles.length > 0) {
      const firstPole = poles[0];
      const dx = firstPole.x - challengeState.substationBuilding.x;
      const dz = firstPole.z - challengeState.substationBuilding.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > UIState.maxSpanLength) {
        issues.push(`❌ First pole is too far from substation (${Math.round(distance)}ft > ${UIState.maxSpanLength}ft max)`);
        hasSpanViolation = true;
      }
    }
    
    // Check distances between poles
    for (let i = 1; i < poles.length; i++) {
      const p1 = poles[i-1];
      const p2 = poles[i];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance > UIState.maxSpanLength) {
        issues.push(`❌ Span ${i} is too long (${Math.round(distance)}ft > ${UIState.maxSpanLength}ft max)`);
        hasSpanViolation = true;
        break; // Only report first violation
      }
    }
    
    // Check budget
    if (UIState.challengeSpent > UIState.challengeBudget) {
      const overBudget = UIState.challengeSpent - UIState.challengeBudget;
      issues.push(`❌ Over budget by $${Math.round(overBudget).toLocaleString()}!`);
    }
    
    // Check clearances
    const clearanceOK = checkClearances();
    if (!clearanceOK) {
      issues.push('❌ Clearance violations detected! Lines are too close to the ground.');
    }
    
    // Show results
    if (issues.length === 0) {
      const savings = UIState.challengeBudget - UIState.challengeSpent;
      alert(`🎉 SUCCESS!\n\nYou powered the customer!\n\n` +
            `Budget: $${UIState.challengeBudget.toLocaleString()}\n` +
            `Spent: $${Math.round(UIState.challengeSpent).toLocaleString()}\n` +
            `Savings: $${Math.round(savings).toLocaleString()}\n` +
            `Poles used: ${poles.length}\n\n` +
            `⚡ The customer has power!`);
    } else {
      alert(`Solution Issues:\n\n${issues.join('\n')}\n\nKeep trying!`);
    }
  }
  
  function resetChallengeLevel() {
    if (!challengeState.active) return;
    
    exitChallengeMode();
    setTimeout(() => enterChallengeMode(), 50);
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
      toggleGridVisibility,
  toggleGridLabels,
      createRandomScenario,
      checkClearances,
      updatePoleHeightLabels,
      updateSagCalculations,
      copyScenarioLink,
      exportScene,
      handleFileImport,
      handleGISImport,
      handleElevationProfileImport,
      undoHistory: () => history.undo(),
      redoHistory: () => history.redo(),
      enterChallengeMode,
      exitChallengeMode,
      checkChallengeSolution,
      resetChallengeLevel
    },
    // Dependencies
    {
      scene,
      urlParams,
      customPoles, 
      SEG,
      hAt,
      addGridLines,
      importedBuildTerrain
    }
  );
  
  // Reference UI elements directly from the elements variable we retrieved above
  const slider = elements.slider;
  const hLabel = elements.heightLabel;
  // const terrainSel = elements.terrainSelect;
  const tensionSlider = elements.tensionSlider;
  const tensionLabel = elements.tensionLabel;
  const clearBtn = elements.clearButton;
  const showGridCheck = elements.showGridCheck;

  // Use the imported buildTerrain function from terrain.js
  clearSceneElements();
  const terrain = importedBuildTerrain(scene, urlParams, customPoles, null, null, SEG, hAt, addGridLines, null, null);
  const currentDarkMode = isDarkModeActive();
  scene.background = currentDarkMode ? new THREE.Color('#0a1014') : new THREE.Color(0x87ceeb);
  updateSceneLabelStylesForDarkMode(currentDarkMode);
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

  /* ------- simple clearance line indicator ------- */
  function createSimpleClearanceLine(conductorPoint, groundPoint, clearanceValue, isViolation = false) {
    // Create a simple vertical line from conductor to ground
    const color = isViolation ? 0xff0000 : 0x00ff00;
    const opacity = isViolation ? 0.9 : 0.6;
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(conductorPoint.x, conductorPoint.y, conductorPoint.z),
      new THREE.Vector3(groundPoint.x, groundPoint.y, groundPoint.z)
    ]);
    
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: color, 
      linewidth: 2,
      transparent: true,
      opacity: opacity
    });
    
    const clearanceLine = new THREE.Line(lineGeometry, lineMaterial);
    clearanceLine.userData.clearanceIndicator = true;
    scene.add(clearanceLine);
    
    // Create text label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'clearance-label';
    labelDiv.textContent = `${clearanceValue.toFixed(1)}ft`;
    labelDiv.style.position = 'absolute';
    labelDiv.style.color = isViolation ? '#ff0000' : '#00ff00';
    labelDiv.style.fontWeight = 'bold';
    labelDiv.style.fontSize = '12px';
    labelDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    labelDiv.style.padding = '2px 4px';
    labelDiv.style.borderRadius = '3px';
    labelDiv.style.border = `1px solid ${isViolation ? '#ff0000' : '#00ff00'}`;
    labelDiv.style.userSelect = 'none';
    labelDiv.style.pointerEvents = 'none';
    labelDiv.style.zIndex = '1000';
    document.body.appendChild(labelDiv);
    
    return {
      line: clearanceLine,
      label: labelDiv,
      worldPosition: new THREE.Vector3(
        conductorPoint.x, 
        (conductorPoint.y + groundPoint.y) / 2, 
        conductorPoint.z
      )
    };
  }

  /* ------- 3D clearance buffer visualization ------- */
  function createClearanceBuffer(conductorPoints, clearanceRadius, isViolation = false) {
    // Create a tube geometry following the conductor path with clearance radius
    const curve = new THREE.CatmullRomCurve3(conductorPoints);
    
    // Use different colors and opacity based on violation status
    const color = isViolation ? 0xff4444 : 0x44ff44;
    const opacity = isViolation ? 0.6 : 0.25;
    
    const tubeGeometry = new THREE.TubeGeometry(curve, conductorPoints.length, clearanceRadius, 8, false);
    const tubeMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      wireframe: false,
      side: THREE.DoubleSide
    });
    
    const clearanceBuffer = new THREE.Mesh(tubeGeometry, tubeMaterial);
    clearanceBuffer.userData.clearanceBuffer = true;
    return clearanceBuffer;
  }

  /* ------- span build & check ------- */
  function checkClearances() {
    // Remove existing clearance indicators
    scene.children.filter(o => o.userData.clearanceIndicator || o.userData.clearanceBuffer).forEach(indicator => {
      scene.remove(indicator);
      if (indicator.geometry) indicator.geometry.dispose();
      if (indicator.material) indicator.material.dispose();
    });
    
    // Remove existing clearance labels
    document.querySelectorAll('.clearance-label').forEach(label => label.remove());
    
    const spans = scene.children.filter(o => o.userData.span);
    let hasIssues = false;
    const threshold = UIState.clearanceThreshold;
    const clearanceIndicators = [];
    
    // Group spans by their pole pairs (since we have 3 conductors per span alignment)
    const spanGroups = new Map();
    
    spans.forEach(span => {
      if (span.userData.a && span.userData.b) {
        const key = `${span.userData.a.uuid}-${span.userData.b.uuid}`;
        if (!spanGroups.has(key)) {
          spanGroups.set(key, []);
        }
        spanGroups.get(key).push(span);
      }
    });
    
    // Check clearances for each span alignment (group of 3 conductors)
    spanGroups.forEach((spanGroup, key) => {
      let minClearance = Infinity;
      let violationPoint = null;
      let violationType = null;
      
      // Get the first span to determine pole A and B for center conductor calculation
      const firstSpan = spanGroup[0];
      const meshA = firstSpan.userData.a;
      const meshB = firstSpan.userData.b;
      
      // Find the actual pole data structures from the meshes
      const poleA = poles.find(p => p.obj === meshA);
      const poleB = poles.find(p => p.obj === meshB);
      
      // Skip this span if we can't find the pole data
      if (!poleA || !poleB) {
        console.warn('Could not find pole data for span');
        return;
      }
      
      // Calculate the center conductor position for clearance buffer
      const tensionFactor = (UIState.currentTension - 500) / (5000 - 500) * (5.0 - 0.2) + 0.2;
      
      const centerConductorPoints = getConductorCurve({
        poleA,
        poleB,
        tension: tensionFactor,
        samples: 32,
        lateralOffset: 0, // Center conductor
        terrainOffsetZ
      });
      
      // Validate that we have valid conductor points
      if (!centerConductorPoints || centerConductorPoints.length === 0) {
        console.warn('Invalid conductor points generated');
        return;
      }
      
      // Convert to THREE.Vector3 for buffer creation, filtering out any invalid points
      const centerVector3Points = centerConductorPoints
        .filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number')
        .map(p => new THREE.Vector3(p.x, p.y, p.z));
      
      // Skip if we don't have enough valid points
      if (centerVector3Points.length < 2) {
        console.warn('Not enough valid points for clearance buffer');
        return;
      }
      
      // Check all conductors in this span group to find the worst violation
      spanGroup.forEach(span => {
        const positions = span.geometry.attributes.position;
        
        // Check each point along the span (check all points for accuracy)
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = positions.getZ(i);
          
          // Check clearance to ground
          const groundHeight = hAt(x, z);
          const clearanceToGround = y - groundHeight;
          
          if (clearanceToGround < minClearance) {
            minClearance = clearanceToGround;
            violationPoint = { x, y, z, groundHeight };
            violationType = 'ground';
          }
        }
      });
      
      // Always create clearance buffer visualization for this span (if enabled)
      if (UIState.showClearanceBuffers) {
        const hasViolation = violationPoint && minClearance < threshold;
        const clearanceBuffer = createClearanceBuffer(centerVector3Points, threshold, hasViolation);
        scene.add(clearanceBuffer);
      }
      
      // If we found a violation, create simple line indicator for this span alignment
      if (violationPoint && minClearance < threshold) {
        hasIssues = true;
        
        if (violationType === 'ground') {
          // Find the point with actual minimum clearance (not just lowest conductor point)
          // This is important for sloped terrain where min clearance may not be at the sag point
          let minClearancePoint = null;
          let minClearanceValue = Infinity;
          
          centerConductorPoints.forEach(point => {
            const groundHeight = hAt(point.x, point.z);
            const clearance = point.y - groundHeight;
            
            if (clearance < minClearanceValue) {
              minClearanceValue = clearance;
              minClearancePoint = point;
            }
          });
          
          // Only show warning line if clearance is actually below threshold
          if (minClearancePoint && minClearanceValue < threshold) {
            const groundHeight = hAt(minClearancePoint.x, minClearancePoint.z);
            const groundPoint = { x: minClearancePoint.x, y: groundHeight, z: minClearancePoint.z };
            
            const indicator = createSimpleClearanceLine(minClearancePoint, groundPoint, minClearanceValue, true);
            clearanceIndicators.push({
              label: indicator.label,
              worldPosition: indicator.worldPosition
            });
          }
        }
      }
    });
    
    // Store clearance indicators for animation loop positioning
    window.clearanceIndicators = clearanceIndicators;
    
    // Update warning display
    const warning = elements.clearanceWarning;
    if (warning) {
      warning.style.display = hasIssues ? 'block' : 'none';
    }
    
    return !hasIssues;
  }

  function drawSpan(a, b) {
    const crossarmPositions = [-1.2, 0, 1.2];
    
    crossarmPositions.forEach(offset => {
      // Convert pounds to tension factor for catenary calculation
      // Map 500-5000 lbs to approximately 0.2-5.0 factor range
      const tensionFactor = (UIState.currentTension - 500) / (5000 - 500) * (5.0 - 0.2) + 0.2;
      
      const curvePoints = getConductorCurve({
        poleA: a,
        poleB: b,
        tension: tensionFactor,
        samples: SAMPLES,
        lateralOffset: offset,
        terrainOffsetZ
      });
      
      // Convert to THREE.Vector3 for geometry
      const pts = curvePoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
      
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mGood);
      line.userData = { span: true, a: a.obj, b: b.obj };
      scene.add(line);
    });
  }

  function rebuild() {
    // Remove existing conductor span meshes
    const oldSpans = scene.children.filter(o => o.userData.span);
    oldSpans.forEach(l => { l.geometry.dispose(); scene.remove(l); });
    // Clear previous clearance indicators so we don't accumulate duplicates
    clearClearanceIndicators();

    // Early exit when no poles (still update stats/emissive state)
    if (poles.length === 0) {
      if (challengeState.active) updateChallengeStats();
      updateLastPoleIndicator();
      return;
    }

    const initialLoad = !window.spansInitialized;

    // Sync spans array to current ordering (Phase 1 sequential)
    updateSequentialSpans();

    // Challenge: span from substation to first pole
    if (challengeState.active && challengeState.substationBuilding) {
      const substationPoint = {
        x: challengeState.substationBuilding.x,
        z: challengeState.substationBuilding.z,
        h: challengeState.substationBuilding.h,
        base: challengeState.substationBuilding.base
      };
      drawSpan(substationPoint, poles[0]);
    }

    // Draw all sequential spans
    spans.forEach(s => drawSpan(s.a, s.b));

    // Challenge: connection from last pole to customer if within range
    if (challengeState.active && challengeState.customerBuilding) {
      const connectionRange = 15; // ft
      const lastPole = poles[poles.length - 1];
      const dx = lastPole.x - challengeState.customerBuilding.x;
      const dz = lastPole.z - challengeState.customerBuilding.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const shouldPower = distance <= connectionRange;

      if (shouldPower) {
        const customerPoint = {
          x: challengeState.customerBuilding.x,
          z: challengeState.customerBuilding.z,
          h: challengeState.customerBuilding.h,
          base: challengeState.customerBuilding.base
        };
        drawSpan(lastPole, customerPoint);
      }

      // Update emissive only on state change
      if (shouldPower && !challengeState.isPowered) {
        challengeState.customerMesh.material.emissive.setHex(0x3b82f6);
        challengeState.customerMesh.material.emissiveIntensity = 0.8;
        challengeState.isPowered = true;
      } else if (!shouldPower && challengeState.isPowered) {
        challengeState.customerMesh.material.emissive.setHex(0x000000);
        challengeState.customerMesh.material.emissiveIntensity = 0;
        challengeState.isPowered = false;
      }
    }

    // Initialize birds once spans first appear, or if spans removed/readded
    if (initialLoad) {
      initBirds();
      window.spansInitialized = true;
    } else if (oldSpans.length === 0) {
      initBirds();
    }

    updateLastPoleIndicator();
    updatePoleHeightLabels();
    updateSagCalculations();
    checkClearances();
    if (challengeState.active) updateChallengeStats();
  }

  function addPole(x, z, h) {
    if (poles.some(p => p.x === x && p.z === z)) return;

    // In challenge mode, check span length limits
    if (challengeState.active && UIState.maxSpanLength) {
      let checkPoint = null;
      
      // If there are poles, check distance to last pole
      if (poles.length > 0) {
        const lastPole = poles[poles.length - 1];
        checkPoint = { x: lastPole.x, z: lastPole.z };
      } else {
        // No poles yet - check distance to substation
        checkPoint = { 
          x: challengeState.substationBuilding.x, 
          z: challengeState.substationBuilding.z 
        };
      }
      
      if (checkPoint) {
        const dx = x - checkPoint.x;
        const dz = z - checkPoint.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance > UIState.maxSpanLength) {
          alert(`Cannot place pole here!\n\nSpan length: ${Math.round(distance)}ft\nMax allowed: ${UIState.maxSpanLength}ft\n\nMove closer to the previous pole.`);
          return;
        }
      }
    }

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
    
    // Update challenge stats if in challenge mode
    if (challengeState.active) {
      updateChallengeStats();
    }
    
    // Capture state for undo/redo
    history.captureState();
  }

  function removePole(obj){ 
    const i = poles.findIndex(p => p.obj === obj); 
    if(i > -1){
      const pole = poles[i];
      
      // Remove all spans connected to this pole
      for (let j = spans.length - 1; j >= 0; j--) {
        if (spans[j].a === pole || spans[j].b === pole) {
          spans.splice(j, 1);
        }
      }
      
      scene.remove(obj); 
      poles.splice(i, 1); 
      rebuild();
      updateCrossarmOrientations();
      updateLastPoleIndicator(); // Update the last pole indicator
      
      // Update challenge stats if in challenge mode
      if (challengeState.active) {
        updateChallengeStats();
      }
      
      // Capture state for undo/redo
      history.captureState();
    }
  }

  function updateCrossarmOrientations() {
    poles.forEach((pole, index) => {
      // Remove all existing crossarms
      pole.obj.children.filter(child => child.geometry.type === 'BoxGeometry')
        .forEach(child => pole.obj.remove(child));

      // Find all spans connected to this pole
      const connectedSpans = spans.filter(s => s.a === pole || s.b === pole);
      
      // Get directions to connected poles
      const dirs = [];
      connectedSpans.forEach(span => {
        const otherPole = span.a === pole ? span.b : span.a;
        const dir = new THREE.Vector3(otherPole.x - pole.x, 0, otherPole.z - pole.z).normalize();
        dirs.push(dir);
      });
      
      // In challenge mode, check for connections to buildings
      if (challengeState.active) {
        // First pole: check for substation connection
        if (index === 0 && challengeState.substationBuilding) {
          const dir = new THREE.Vector3(
            challengeState.substationBuilding.x - pole.x, 
            0, 
            challengeState.substationBuilding.z - pole.z
          ).normalize();
          dirs.push(dir);
        }
        
        // Last pole: check for customer connection (if in range)
        if (index === poles.length - 1 && challengeState.customerBuilding) {
          const dx = pole.x - challengeState.customerBuilding.x;
          const dz = pole.z - challengeState.customerBuilding.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          if (distance <= 15) { // connection range
            const dir = new THREE.Vector3(
              challengeState.customerBuilding.x - pole.x, 
              0, 
              challengeState.customerBuilding.z - pole.z
            ).normalize();
            dirs.push(dir);
          }
        }
      }
      
      // If no conductors connected, no crossarms needed
      if (dirs.length === 0) {
        return;
      }
      
      // Check if this is an angle pole (2+ connections with acute angle)
      let acuteCase = false;
      if (dirs.length >= 2) {
        const topAngle = calculateTopAngle(
          { x: pole.x + dirs[0].x, z: pole.z + dirs[0].z }, 
          pole, 
          { x: pole.x + dirs[1].x, z: pole.z + dirs[1].z }
        );
        acuteCase = topAngle < 90;
      }
      
      // Terminal pole (only one connection) - add TWO parallel crossarms
      if (dirs.length === 1) {
        const spanDir = dirs[0];
        const perp1 = new THREE.Vector3(-spanDir.z, 0, spanDir.x).normalize();
        const perp2 = new THREE.Vector3(spanDir.z, 0, -spanDir.x).normalize();
        
        [perp1, perp2].forEach(perp => {
          const angle = -Math.atan2(perp.z, perp.x);
          const arm = new THREE.Mesh(crossArmGeo, mCrossArm);
          arm.position.y = 5;
          arm.rotation.y = angle;
          pole.obj.add(arm);
        });
      } else {
        // Multiple connections - add crossarm for each direction
        dirs.forEach(dir => {
          const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
          const angle = -Math.atan2(perp.z, perp.x);
          const arm = new THREE.Mesh(crossArmGeo, mCrossArm);
          if (acuteCase) arm.scale.x = 1;
          arm.position.y = 5;
          arm.rotation.y = angle;
          pole.obj.add(arm);
        });
      }
    });
  }

  /* ------- picking helpers ------- */
  function pick(evt, list){
    mouse.set((evt.clientX / window.innerWidth) * 2 - 1, -(evt.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(list, true)[0];
    if (!hit) return null;
    
    // If we hit a child (like a crossarm), find the parent pole mesh
    let obj = hit.object;
    while (obj.parent && !list.includes(obj)) {
      obj = obj.parent;
    }
    
    return list.includes(obj) ? obj : null;
  }
  
  const poleMeshes = () => poles.map(p => p.obj);
  

  function updateGhost() {
    ghost.visible = false;
    // Remove ghost span label if present
    const existingLabel = document.getElementById('ghostSpanLabel');
    if (existingLabel) existingLabel.style.display = 'none';
    
    // Show conductor preview if conductor tool is active and we have a start pole and hover pole
    if (UIState.conductorToolActive && UIState.conductorStartPole && UIState.conductorHoverPole) {
      // TODO: Add ghost conductor line preview between the two poles
      // For now, just highlight that a connection would be made
    }

    // Only show ghost pole if pole tool is active
    if (!UIState.poleToolActive || !hoverPt || hoverPole || hoverTree) return;
    if (poles.some(p => p.x === hoverPt.x && p.z === hoverPt.z)) return;

    const h = UIState.currentHeight;
    const base = hAt(hoverPt.x, hoverPt.z + terrainOffsetZ);

    ghost.scale.y = h / BASE_H;
    ghost.position.set(hoverPt.x, base + h / 2, hoverPt.z + terrainOffsetZ);
    ghost.visible = true;

    // Show prospective span length only in challenge mode
    if (challengeState.active) {
      // Determine start point of span (substation if no poles yet, else last pole)
      let startX, startZ;
      if (poles.length === 0 && challengeState.substationBuilding) {
        startX = challengeState.substationBuilding.x;
        startZ = challengeState.substationBuilding.z;
      } else if (poles.length > 0) {
        startX = poles[poles.length - 1].x;
        startZ = poles[poles.length - 1].z;
      } else {
        return; // No reference point yet
      }

      const dx = hoverPt.x - startX;
      const dz = hoverPt.z - startZ;
      const spanDist = Math.sqrt(dx * dx + dz * dz);
      const overLimit = UIState.maxSpanLength && spanDist > UIState.maxSpanLength;

      // Create or update label element
      let label = existingLabel;
      if (!label) {
        label = document.createElement('div');
        label.id = 'ghostSpanLabel';
        label.style.position = 'absolute';
        label.style.padding = '2px 6px';
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        label.style.borderRadius = '3px';
        label.style.pointerEvents = 'none';
        label.style.userSelect = 'none';
        label.style.zIndex = '1500';
        document.body.appendChild(label);
      }

      label.textContent = `${spanDist.toFixed(1)} ft${overLimit ? ' (too long)' : ''}`;
      label.style.backgroundColor = overLimit ? 'rgba(255,0,0,0.85)' : (document.body.classList.contains('dark-mode') ? 'rgba(10,16,20,0.85)' : 'rgba(255,255,255,0.85)');
      label.style.color = overLimit ? '#ffffff' : (document.body.classList.contains('dark-mode') ? '#00ffe7' : '#000000');
      label.style.border = overLimit ? '1px solid #ff0000' : (document.body.classList.contains('dark-mode') ? '1px solid #00ffe7' : '1px solid #00000020');
      label.style.display = 'block';

      // Position label at midpoint between start and ghost in screen space
      const midPoint = new THREE.Vector3((startX + hoverPt.x) / 2, base + h / 2, (startZ + hoverPt.z) / 2 + terrainOffsetZ);
      const projected = midPoint.clone();
      projected.project(camera);
      const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-projected.y * 0.5 + 0.5) * window.innerHeight;
      label.style.left = `${sx - label.offsetWidth / 2}px`;
      label.style.top = `${sy - 20}px`;
    }
  }

  window.addEventListener('contextmenu', e => {
    e.preventDefault();
    // Right-click is disabled - use eraser tool instead
  });

  window.addEventListener('pointerdown', e => {
    if (e.shiftKey) return;
    
    // Ignore clicks on UI elements
    if (e.target.closest('#toolPanel, #hud, #challengePanel, #scenariosPanel')) {
      return;
    }

    const pPick = pick(e, poleMeshes());
    if (pPick) {
      // Check if this is a challenge building (immovable)
      if (pPick.userData && pPick.userData.challengeBuilding) {
        return; // Don't allow dragging buildings
      }
      
      // Don't start drag if eraser tool is active
      if (UIState.eraserToolActive) {
        clickStart = [e.clientX, e.clientY];
        return;
      }
      
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
      const pole = poles.find(p => p.obj === drag);
      
      if (dragMode === 'position') {
        mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
        ray.setFromCamera(mouse, camera);
        let hit = null;
        
        if (window.terrain) {
          const intersections = ray.intersectObject(window.terrain, true);
          hit = intersections && intersections.length > 0 ? intersections[0] : null;
        }
        
        if (hit) {
          pole.x = SNAP(hit.point.x);
          pole.z = SNAP(hit.point.z - terrainOffsetZ);
          
          const base = hAt(pole.x, pole.z + terrainOffsetZ);
          pole.base = base;
          pole.obj.position.set(pole.x, base + pole.h / 2, pole.z + terrainOffsetZ);
        }
      } else if (dragMode === 'height') {
        // Height dragging doesn't need terrain intersection - just use mouse delta
        const deltaY = startY - e.clientY;
        const newHeight = Math.max(MINH, Math.min(MAXH, dragStartHeight + deltaY * DRAG_SENS));
        pole.h = SNAP(newHeight);
        pole.obj.scale.y = pole.h / BASE_H;
        pole.obj.position.y = pole.base + pole.h / 2;
      }
      
      if (pole) {
        rebuild();
        updateCrossarmOrientations();
      }
      return;
    }

    let pPick = pick(e, poleMeshes());
    
    // In conductor-only mode, use larger hit radius for easier targeting
    if (UIState.conductorToolActive && !UIState.poleToolActive && !pPick) {
      // Find nearest pole within screen-space radius
      mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      
      const clickRadius = 80; // pixels
      let nearestPole = null;
      let nearestDist = Infinity;
      
      poles.forEach(pole => {
        const poleTop = new THREE.Vector3(pole.x, pole.base + pole.h, pole.z + terrainOffsetZ);
        poleTop.project(camera);
        
        const screenX = (poleTop.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-poleTop.y * 0.5 + 0.5) * window.innerHeight;
        
        const dx = screenX - e.clientX;
        const dy = screenY - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < clickRadius && dist < nearestDist) {
          nearestDist = dist;
          nearestPole = pole.obj;
        }
      });
      
      if (nearestPole) {
        pPick = nearestPole;
      }
    }
    
    // Handle pole hover highlighting
    if (pPick !== hoverPole) {
      if (hoverPole) {
        // Don't reset material if this is the conductor start pole
        if (!UIState.conductorStartPole || hoverPole !== UIState.conductorStartPole.obj) {
          hoverPole.material = mPole;
        }
      }
      hoverPole = pPick;
      if (hoverPole) {
        // Always highlight on hover (unless eraser tool and not hovering a pole)
        if (!UIState.eraserToolActive || pPick) {
          hoverPole.material = mPoleHL;
        }
      }
    }
    
    // Update conductor hover state for preview
    if (UIState.conductorToolActive && UIState.conductorStartPole) {
      const hoveredPole = pPick ? poles.find(p => p.obj === pPick) : null;
      UIState.conductorHoverPole = hoveredPole;
    } else {
      UIState.conductorHoverPole = null;
    }

    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
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
    // Ignore clicks on UI elements
    if (e.target.closest('#toolPanel, #hud, #challengePanel, #scenariosPanel')) {
      clickStart = null; // Clear clickStart to prevent any action
      return;
    }
    
    if (drag) {
      drag = null;
      controls.enabled = true;
      updateLastPoleIndicator(); // Update indicator after drag operation completes
      
      // Capture state after drag (height or position change)
      history.captureState();
      return;
    }
    if (!clickStart) return;
    const [dx, dy] = [Math.abs(e.clientX - clickStart[0]), Math.abs(e.clientY - clickStart[1])];
    clickStart = null;
    
    // Only proceed if it's a click (not a drag)
    if (dx < 5 && dy < 5) {
      handleToolClick(e);
    }
  });
  
  function handleToolClick(e) {
    // Ignore clicks on UI elements (tool panel, HUD, etc.)
    if (e.target.closest('#toolPanel, #hud, #challengePanel, #scenariosPanel')) {
      return;
    }
    
    // Handle eraser tool
    if (UIState.eraserToolActive) {
      const pPick = pick(e, poleMeshes());
      if (pPick) {
        removePole(pPick);
        return;
      }
      
      // Check if clicking on a conductor
      mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const spanLines = scene.children.filter(o => o.userData.span);
      const spanHit = ray.intersectObjects(spanLines, true)[0];
      
      if (spanHit && spanHit.object.userData.span) {
        // Find the poles this span connects
        const spanA = spanHit.object.userData.a;
        const spanB = spanHit.object.userData.b;
        const poleA = poles.find(p => p.obj === spanA);
        const poleB = poles.find(p => p.obj === spanB);
        
        if (poleA && poleB) {
          removeSpan(poleA, poleB);
        }
      }
      return;
    }
    
    // Handle conductor-only tool
    if (UIState.conductorToolActive && !UIState.poleToolActive) {
      let pPick = pick(e, poleMeshes());
      
      // Use larger click radius in conductor mode
      if (!pPick) {
        mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
        
        const clickRadius = 80; // pixels
        let nearestPole = null;
        let nearestDist = Infinity;
        
        poles.forEach(pole => {
          const poleTop = new THREE.Vector3(pole.x, pole.base + pole.h, pole.z + terrainOffsetZ);
          poleTop.project(camera);
          
          const screenX = (poleTop.x * 0.5 + 0.5) * window.innerWidth;
          const screenY = (-poleTop.y * 0.5 + 0.5) * window.innerHeight;
          
          const dx = screenX - e.clientX;
          const dy = screenY - e.clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < clickRadius && dist < nearestDist) {
            nearestDist = dist;
            nearestPole = pole.obj;
          }
        });
        
        if (nearestPole) {
          pPick = nearestPole;
        }
      }
      
      if (pPick) {
        handleConductorToolClick(pPick);
      }
      return;
    }
    
    // Handle pole-only tool or both tools together
    if (UIState.poleToolActive && hoverPt) {
      const h = UIState.currentHeight;
      const base = hAt(hoverPt.x, hoverPt.z + terrainOffsetZ);
      
      // Get the last pole before adding the new one
      const lastPole = poles.length > 0 ? poles[poles.length - 1] : null;
      
      addPole(hoverPt.x, hoverPt.z, h);
      
      // If both tools are active and there was a previous pole, auto-connect
      if (UIState.conductorToolActive && lastPole) {
        const newPole = poles[poles.length - 1];
        addSpan(lastPole, newPole);
      }
      
      updateGhost();
    }
  }
  
  function handleConductorToolClick(poleObj) {
    const pole = poles.find(p => p.obj === poleObj);
    if (!pole) return;
    
    if (!UIState.conductorStartPole) {
      // First pole selected - store it
      UIState.conductorStartPole = pole;
      // Highlight the selected pole
      poleObj.material = mPoleHL;
    } else if (UIState.conductorStartPole === pole) {
      // Clicked same pole - deselect
      if (UIState.conductorStartPole.obj) {
        UIState.conductorStartPole.obj.material = mPole;
      }
      UIState.conductorStartPole = null;
      UIState.conductorHoverPole = null;
    } else {
      // Second pole selected - create or remove conductor
      const startPole = UIState.conductorStartPole;
      
      if (hasSpan(startPole, pole)) {
        // Span already exists - remove it
        removeSpan(startPole, pole);
        
        // Reset selection completely after removing
        if (UIState.conductorStartPole.obj) {
          UIState.conductorStartPole.obj.material = mPole;
        }
        UIState.conductorStartPole = null;
        UIState.conductorHoverPole = null;
      } else {
        // Create new span
        addSpan(startPole, pole);
        
        // Keep selection active - make the second pole the new "from" pole
        // This allows quick chaining: click A -> B -> C -> D without reselecting
        if (UIState.conductorStartPole.obj) {
          UIState.conductorStartPole.obj.material = mPole;
        }
        UIState.conductorStartPole = pole;
        poleObj.material = mPoleHL;
        UIState.conductorHoverPole = null;
      }
    }
  }
  function clearAllDOMLabels() {
    // Clear grid labels
    document.querySelectorAll('.grid-label').forEach(label => {
      if (label.parentNode) {
        label.parentNode.removeChild(label);
      }
    });

    // Clear pole height labels
    document.querySelectorAll('.pole-height-label').forEach(label => {
      if (label.parentNode) {
        label.parentNode.removeChild(label);
      }
    });

    // Clear clearance/sag calculation labels (they might not have specific classes)
    // This is a more aggressive cleanup for labels that might not be properly categorized
    document.querySelectorAll('div[style*="position: absolute"][style*="z-index"]').forEach(label => {
      if (label.parentNode === document.body && 
          (label.textContent.includes('ft') || label.style.backgroundColor.includes('rgba'))) {
        label.parentNode.removeChild(label);
      }
    });
  }

  function clearGridElements() {
    // Clean up grid objects and their DOM label elements
    scene.children.filter(o => o.userData.grid).forEach(g => {
      // Remove DOM label elements first
      if (g.userData.labels) {
        g.userData.labels.forEach(label => {
          if (label.element && label.element.parentNode) {
            label.element.parentNode.removeChild(label.element);
          }
        });
      }
      
      scene.remove(g);
      if (g.geometry) g.geometry.dispose();
    });
  }

  function resetScene() {
    clearSceneElements();
    clearSettingElements();

    // Clean up all DOM labels comprehensively
    clearAllDOMLabels();

    if (UIState.showGrid) {
      addGridLines(scene, window.terrain);
      updateSceneLabelStylesForDarkMode(isDarkModeActive());
    } else {
      clearGridElements();
    }
    
    // Clean up pole height labels array
    poleHeightLabels.length = 0;
    
    // Clean up sag calculation objects
    sagCalculationObjects.forEach(obj => {
      if (obj.line) scene.remove(obj.line);
      if (obj.sagLine) scene.remove(obj.sagLine);
      if (obj.line && obj.line.geometry) obj.line.geometry.dispose();
      if (obj.sagLine && obj.sagLine.geometry) obj.sagLine.geometry.dispose();
      if (obj.label && obj.label.parentNode) {
        obj.label.parentNode.removeChild(obj.label);
      }
    });
    sagCalculationObjects.length = 0;

    poles.forEach(p => scene.remove(p.obj));
    poles.length = 0;
    spans.length = 0; // Clear the spans array
    scene.children.filter(o => o.userData.span).forEach(l => {
      l.geometry.dispose();
      scene.remove(l);
    });
    
    // Do NOT clear terrain surface when clearing scene
    // Only clear GIS elevation surfaces if needed
    // gisElevationSurface = null;
    // customGround = null;
    
    updateGhost();
    birds.length = 0;

    // Hide all indicators when resetting
    lastPoleIndicator.visible = false;
    lastPoleInnerIndicator.visible = false;
    
    // Hide clearance warning when scene is reset
    if (elements.clearanceWarning) {
      elements.clearanceWarning.style.display = 'none';
    }
    
    // Clear undo/redo history
    history.clear();
  }

  function createRandomScenario() {
    const terrainChoices = ['flat', 'hills', 'hillsTrees'];
    const choice = terrainChoices[Math.floor(Math.random() * terrainChoices.length)];
    if (elements.terrainSelect) {
      elements.terrainSelect.value = choice;
      elements.terrainSelect.onchange();
    } else {
      resetScene();
    }

    let z = 0;
    for (let i = 0; i < 5; i++) {
      if (i > 0) z += THREE.MathUtils.randInt(15, 25);
      const h = THREE.MathUtils.randInt(10, 30);
      addPole(0, z, h);
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // Keyboard shortcuts for undo/redo
  window.addEventListener('keydown', (e) => {
    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      history.undo();
    }
    // Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      history.redo();
    }
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
    
    // Capture initial state for undo/redo
    history.captureState();
  } else {
    // Capture empty initial state
    history.captureState();
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
      if (!grid.userData.labels) return;

      grid.userData.labels.forEach(label => {
        if (!UIState.showGridLabels) {
          label.element.style.display = 'none';
          return;
        }

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
    });

    // Update pole height labels position if they exist
    if (UIState.showPoleHeightLabels && poleHeightLabels.length > 0) {
      poleHeightLabels.forEach(label => {
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
    } else if (poleHeightLabels.length > 0) {
      poleHeightLabels.forEach(label => {
        label.element.style.display = 'none';
      });
    }

    // Update sag calculation labels position if they exist
    if (UIState.showSagCalculations && sagCalculationObjects.length > 0) {
      sagCalculationObjects.forEach(sagObj => {
        const screenPosition = sagObj.labelPosition.clone();
        screenPosition.project(camera);
        
        const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
        
        if (screenPosition.z < 1) {
          sagObj.label.style.display = 'block';
          sagObj.label.style.transform = `translate(-50%, -50%)`;
          sagObj.label.style.left = `${x}px`;
          sagObj.label.style.top = `${y}px`;
        } else {
          sagObj.label.style.display = 'none';
        }
      });
    } else if (sagCalculationObjects.length > 0) {
      sagCalculationObjects.forEach(sagObj => {
        sagObj.label.style.display = 'none';
      });
    }
    
    // Update last pole indicator
    if (lastPoleIndicator.visible) {
      updateLastPoleIndicator();
    }
    
    // Update conductor hover halo
    updateConductorHalo();
    
    // Update clearance indicator label positions
    if (window.clearanceIndicators) {
      window.clearanceIndicators.forEach(indicator => {
        const screenPosition = indicator.worldPosition.clone();
        screenPosition.project(camera);
        
        const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
        
        if (screenPosition.z < 1) {
          indicator.label.style.display = 'block';
          indicator.label.style.left = `${x}px`;
          indicator.label.style.top = `${y}px`;
          indicator.label.style.transform = 'translate(-50%, -50%)';
        } else {
          indicator.label.style.display = 'none';
        }
      });
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
    clearSettingElements();
    updatePoleAppearance();
    addRoads();
  }

  function updatePoleAppearance() {
    let poleColor = EQUIPMENT_COLORS.distribution.pole;
    let crossArmColor = EQUIPMENT_COLORS.distribution.crossArm;
    
    // Check if equipmentSelect exists and has a valid value
    if (elements.equipmentSelect && elements.equipmentSelect.value && elements.equipmentSelect.value in EQUIPMENT_COLORS) {
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
    
    // Update the default pole and crossarm materials as well
    mPole.color.setHex(poleColor);
    mCrossArm.color.setHex(crossArmColor);
  }



  function addRoads() {
    if (!window.terrain) return;
    
    // Check if terrain has the expected geometry structure
    if (!window.terrain.geometry || !window.terrain.geometry.parameters) {
      return; // Skip for elevation profile terrain
    }

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
      road.userData.settingElement = true;
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
      road.userData.settingElement = true;
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
  
  function updateConductorHalo() {
    // Only show halo when conductor tool is active WITHOUT pole tool, and hovering near a pole
    if (!UIState.conductorToolActive || UIState.poleToolActive || !hoverPole) {
      conductorHalo.visible = false;
      return;
    }
    
    // Find the pole being hovered
    const pole = poles.find(p => p.obj === hoverPole);
    if (!pole) {
      conductorHalo.visible = false;
      return;
    }
    
    // Calculate pulse animation
    const currentTime = Date.now() * 0.004; // Faster pulse than last pole indicator
    const pulse = Math.sin(currentTime);
    
    // Larger radius for easier targeting (3x pole radius)
    const baseRadius = 3.0;
    const scaleFactor = 1 + 0.2 * Math.abs(pulse); // 20% size variation
    
    // Create circle at pole top height
    const poleTopY = pole.base + pole.h;
    const segments = 32;
    const points = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = pole.x + Math.cos(angle) * baseRadius * scaleFactor;
      const z = pole.z + terrainOffsetZ + Math.sin(angle) * baseRadius * scaleFactor;
      points.push(new THREE.Vector3(x, poleTopY, z));
    }
    
    // Update geometry
    if (conductorHalo.geometry) {
      conductorHalo.geometry.dispose();
    }
    conductorHalo.geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Pulse opacity for glowing effect
    const opacity = 0.6 + 0.4 * Math.abs(pulse);
    conductorHalo.material.opacity = opacity;
    
    // Change color based on conductor state
    if (UIState.conductorStartPole) {
      // Second pole selection - show different color
      conductorHalo.material.color.setHex(0xffaa00); // Orange
    } else {
      // First pole selection - cyan
      conductorHalo.material.color.setHex(0x00ffe7);
    }
    
    conductorHalo.visible = true;
  }

  function updatePoleHeightLabels() {
    // Clear existing labels
    poleHeightLabels.forEach(label => {
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    poleHeightLabels.length = 0;

    if (!UIState.showPoleHeightLabels) {
      return; // Labels are disabled, so we're done
    }

    // Create new labels for each pole
    poles.forEach(pole => {
      try {
        // Create label text showing height in feet
        const heightText = `${pole.h.toFixed(0)}ft`;
        
        // Create DOM element for the label
        const labelElement = document.createElement('div');
        labelElement.className = 'pole-height-label';
        labelElement.textContent = heightText;
        labelElement.style.position = 'absolute';
        labelElement.style.color = 'white';
        labelElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.fontWeight = 'bold';
        labelElement.style.userSelect = 'none';
        labelElement.style.pointerEvents = 'none';
        labelElement.style.whiteSpace = 'nowrap';
        labelElement.style.zIndex = '1000';
        document.body.appendChild(labelElement);
        
        // Store label info for positioning updates
        poleHeightLabels.push({
          element: labelElement,
          position: new THREE.Vector3(
            pole.x,
            pole.base + pole.h + 3, // 3 units above the pole top
            pole.z + terrainOffsetZ
          )
        });
      } catch (error) {
        console.warn('Error creating pole height label:', error);
      }
    });
  }

  function updateSagCalculations() {
    // Clear existing sag visualization objects
    sagCalculationObjects.forEach(obj => {
      scene.remove(obj.line);
      scene.remove(obj.sagLine);
      if (obj.line.geometry) obj.line.geometry.dispose();
      if (obj.sagLine.geometry) obj.sagLine.geometry.dispose();
      if (obj.label && obj.label.parentNode) {
        obj.label.parentNode.removeChild(obj.label);
      }
    });
    sagCalculationObjects.length = 0;

    if (!UIState.showSagCalculations || spans.length === 0) {
      return; // Sag calculations are disabled or no spans
    }

    // Create sag visualization for each span
    spans.forEach(span => {
      const poleA = span.a;
      const poleB = span.b;

      try {
        // Calculate straight line between poles at crossarm height
        const crossarmHeightA = poleA.base + poleA.h;
        const crossarmHeightB = poleB.base + poleB.h;

        // Create straight line geometry
        const straightLinePoints = [
          new THREE.Vector3(poleA.x, crossarmHeightA, poleA.z + terrainOffsetZ),
          new THREE.Vector3(poleB.x, crossarmHeightB, poleB.z + terrainOffsetZ)
        ];
        const straightLineGeometry = new THREE.BufferGeometry().setFromPoints(straightLinePoints);
        const straightLineMaterial = new THREE.LineBasicMaterial({ 
          color: 0xffff00, 
          linewidth: 2,
          opacity: 0.7,
          transparent: true
        });
        const straightLine = new THREE.Line(straightLineGeometry, straightLineMaterial);

        // Get the catenary curve points to find maximum sag
        // Convert pounds to tension factor for catenary calculation
        const tensionFactor = (UIState.currentTension - 500) / (5000 - 500) * (5.0 - 0.2) + 0.2;
        
        const curvePoints = getConductorCurve({
          poleA,
          poleB,
          tension: tensionFactor,
          samples: 32,
          lateralOffset: 0, // Use center conductor
          terrainOffsetZ
        });

        // Find the point with maximum sag (should be around the middle)
        let maxSagPoint = curvePoints[0];
        let maxSagIndex = 0;
        let maxSagDistance = 0;

        curvePoints.forEach((point, index) => {
          // Calculate the straight line height at this position
          const t = index / (curvePoints.length - 1);
          const straightLineHeight = crossarmHeightA + (crossarmHeightB - crossarmHeightA) * t;
          const sagDistance = straightLineHeight - point.y;
          
          if (sagDistance > maxSagDistance) {
            maxSagDistance = sagDistance;
            maxSagPoint = point;
            maxSagIndex = index;
          }
        });

        // Create vertical sag line
        const t = maxSagIndex / (curvePoints.length - 1);
        const straightLineHeight = crossarmHeightA + (crossarmHeightB - crossarmHeightA) * t;
        
        const sagLinePoints = [
          new THREE.Vector3(maxSagPoint.x, straightLineHeight, maxSagPoint.z),
          new THREE.Vector3(maxSagPoint.x, maxSagPoint.y, maxSagPoint.z)
        ];
        const sagLineGeometry = new THREE.BufferGeometry().setFromPoints(sagLinePoints);
        const sagLineMaterial = new THREE.LineBasicMaterial({ 
          color: 0xff6b6b, 
          linewidth: 3,
          opacity: 0.9,
          transparent: true
        });
        const sagLine = new THREE.Line(sagLineGeometry, sagLineMaterial);

        // Create DOM label for sag measurement
        const sagText = `${maxSagDistance.toFixed(1)}ft sag`;
        const labelElement = document.createElement('div');
        labelElement.textContent = sagText;
        labelElement.style.position = 'absolute';
        labelElement.style.color = '#ff6b6b';
        labelElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.fontWeight = 'bold';
        labelElement.style.userSelect = 'none';
        labelElement.style.pointerEvents = 'none';
        labelElement.style.whiteSpace = 'nowrap';
        labelElement.style.zIndex = '1000';
        labelElement.style.border = '1px solid #ff6b6b';
        document.body.appendChild(labelElement);

        // Add to scene
        scene.add(straightLine);
        scene.add(sagLine);

        // Store for cleanup and label positioning
        sagCalculationObjects.push({
          line: straightLine,
          sagLine: sagLine,
          label: labelElement,
          labelPosition: new THREE.Vector3(
            maxSagPoint.x,
            maxSagPoint.y - 1, // Slightly below the sag point
            maxSagPoint.z
          )
        });

      } catch (error) {
        console.warn('Error creating sag calculation for span:', error);
      }
    });
  }

  function copyScenarioLink() {
    try {
      // Build the current scenario URL
      const params = new URLSearchParams();
      
      // Serialize poles if any exist
      if (poles.length > 0) {
        // Calculate distances from first pole
        const distances = poles.map((pole, i) => {
          if (i === 0) return 0;
          const dx = pole.x - poles[0].x;
          const dz = pole.z - poles[0].z;
          return Math.round(Math.sqrt(dx * dx + dz * dz));
        });
        params.set('poles-distances', distances.join(','));
        
        // Heights
        const heights = poles.map(pole => Math.round(pole.h));
        params.set('poles-heights', heights.join(','));
        
        // Elevations
        const elevations = poles.map(pole => Math.round(pole.base));
        params.set('poles-elevations', elevations.join(','));
      }
      
      // Add current UI state
      if (UIState.clearanceThreshold !== 15) { // Only add if not default
        params.set('clearanceThreshold', UIState.clearanceThreshold.toString());
      }
      
      if (UIState.currentTension !== 2000) { // Only add if not default
        params.set('tension', UIState.currentTension.toString());
      }
      
      // Add terrain/environment/setting if not default
      if (elements.terrainSelect && elements.terrainSelect.value !== 'flat') {
        params.set('terrain', elements.terrainSelect.value);
      }
      
      if (elements.equipmentSelect && elements.equipmentSelect.value) {
        params.set('equipment', elements.equipmentSelect.value);
      }
      
      // Grid visibility
      if (UIState.showGrid === false) { // Only add if not default (true)
        params.set('showGrid', 'false');
      }

      // Display options
      if (UIState.showPoleHeightLabels === true) { // Only add if enabled
        params.set('showPoleHeightLabels', 'true');
      }

      if (UIState.showSagCalculations === true) { // Only add if enabled
        params.set('showSagCalculations', 'true');
      }

      if (UIState.showClearanceBuffers === true) { // Only add if enabled
        params.set('showClearanceBuffers', 'true');
      }
      
      // Build the full URL
      const baseUrl = window.location.origin + window.location.pathname;
      const fullUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
      
      // Copy to clipboard
      navigator.clipboard.writeText(fullUrl).then(() => {
        // Show toast notification
        if (elements.copyLinkToast) {
          elements.copyLinkToast.style.display = 'block';
          setTimeout(() => {
            elements.copyLinkToast.style.display = 'none';
          }, 2000); // Hide after 2 seconds
        }
      }).catch(err => {
        console.warn('Failed to copy to clipboard:', err);
        // Fallback: show the URL in an alert
        alert('Copy this URL:\n' + fullUrl);
      });
      
    } catch (error) {
      console.error('Error generating scenario link:', error);
      alert('Error generating link. Please try again.');
    }
  }

  function exportScene() {
    try {
      // Get current terrain info
      const currentTerrain = window.terrain;
      const terrainData = {
        dimensions: {
          width: currentTerrain ? currentTerrain.geometry.parameters.width : 100,
          depth: currentTerrain ? currentTerrain.geometry.parameters.height : 100
        },
        offset: {
          x: currentTerrain ? currentTerrain.position.x : 0,
          z: currentTerrain ? currentTerrain.position.z : terrainOffsetZ
        },
        type: elements.terrainSelect?.value || 'flat',
        gridSize: {
          x: poles.length > 0 ? 20 : 100, // Based on buildTerrain logic
          y: 100
        },
        terrainOffsetZ: terrainOffsetZ // Include the actual terrain offset
      };

      // If poles exist, capture the elevation interpolation data
      const surfaceData = {
        hasCustomGround: customGround !== null,
        elevationProfile: null
      };

      if (poles.length > 0 && customGround) {
        // Sample the terrain at multiple points to capture the elevation profile
        const minZ = Math.min(...poles.map(p => p.z));
        const maxZ = Math.max(...poles.map(p => p.z));
        const sampleCount = 50; // Number of samples along Z-axis
        const elevationProfile = [];
        
        for (let i = 0; i <= sampleCount; i++) {
          const z = minZ + (maxZ - minZ) * (i / sampleCount);
          const elevation = hAt(0, z); // Sample at x=0 (center line)
          elevationProfile.push({ z, elevation });
        }
        
        surfaceData.elevationProfile = elevationProfile;
        surfaceData.bounds = { minZ, maxZ };
      }

      // Create scene data object
      const sceneData = {
        version: "1.1", // Increment version to indicate terrain data inclusion
        timestamp: new Date().toISOString(),
        poles: poles.map(pole => ({
          x: pole.x,
          z: pole.z,
          height: pole.h,
          elevation: pole.base
        })),
        terrain: terrainData,
        surface: surfaceData,
        settings: {
          tension: UIState.currentTension,
          clearanceThreshold: UIState.clearanceThreshold,
          terrain: elements.terrainSelect?.value || 'flat',
          showGrid: UIState.showGrid,
          showSagCalculations: UIState.showSagCalculations,
          showClearanceBuffers: UIState.showClearanceBuffers,
          showPoleHeightLabels: UIState.showPoleHeightLabels
        },
        metadata: {
          appName: "GridScaper",
          userAgent: navigator.userAgent,
          screenResolution: `${screen.width}x${screen.height}`
        }
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(sceneData, null, 2);
      
      // Create download link
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.download = `gridscaper-scene-${timestamp}.json`;
      link.href = url;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      console.log('Scene exported successfully:', sceneData);
      
    } catch (error) {
      console.error('Error exporting scene:', error);
      alert('Error exporting scene. Please check the console for details.');
    }
  }

  function validateSceneData(data) {
    const errors = [];
    
    // Check required fields
    if (!data || typeof data !== 'object') {
      return ['Invalid JSON data structure'];
    }
    
    if (!data.version) {
      errors.push('Missing version field');
    }
    
    if (!Array.isArray(data.poles)) {
      errors.push('Missing or invalid poles array');
    } else {
      // Validate each pole
      data.poles.forEach((pole, index) => {
        if (typeof pole.x !== 'number' || typeof pole.z !== 'number' || 
            typeof pole.height !== 'number' || typeof pole.elevation !== 'number') {
          errors.push(`Invalid pole data at index ${index}`);
        }
        if (pole.height < 1 || pole.height > 100) {
          errors.push(`Pole height out of range at index ${index} (must be 1-100)`);
        }
      });
    }
    
    if (!data.settings || typeof data.settings !== 'object') {
      errors.push('Missing or invalid settings object');
    }
    
    // Validate terrain and surface data for v1.1+ (optional for backward compatibility)
    if (data.version !== "1.0" && data.terrain) {
      if (!data.terrain.dimensions || typeof data.terrain.dimensions.width !== 'number' || 
          typeof data.terrain.dimensions.depth !== 'number') {
        errors.push('Invalid terrain dimensions data');
      }
    }
    
    return errors;
  }

  function importScene(jsonData) {
    try {
      // Parse JSON if it's a string
      const sceneData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      // Validate scene data
      const validationErrors = validateSceneData(sceneData);
      if (validationErrors.length > 0) {
        throw new Error('Scene validation failed:\n' + validationErrors.join('\n'));
      }
      
      console.log('Importing scene:', sceneData);
      
      // Clear existing scene
      resetScene();
      
      // Restore terrain and surface data if available (v1.1+)
      if (sceneData.terrain && sceneData.surface && sceneData.version !== "1.0") {
        // Restore custom ground function if elevation profile exists
        if (sceneData.surface.hasCustomGround && sceneData.surface.elevationProfile) {
          const elevationProfile = sceneData.surface.elevationProfile;
          const bounds = sceneData.surface.bounds;
          
          customGround = (x, z) => {
            // Clamp z to the bounds of the elevation profile
            if (z <= bounds.minZ) return elevationProfile[0].elevation;
            if (z >= bounds.maxZ) return elevationProfile[elevationProfile.length - 1].elevation;
            
            // Find the segment and interpolate
            for (let i = 1; i < elevationProfile.length; i++) {
              if (z <= elevationProfile[i].z) {
                const t = (z - elevationProfile[i - 1].z) / (elevationProfile[i].z - elevationProfile[i - 1].z);
                return elevationProfile[i - 1].elevation * (1 - t) + elevationProfile[i].elevation * t;
              }
            }
            return elevationProfile[elevationProfile.length - 1].elevation;
          };
        } else {
          customGround = null;
        }
        
        console.log('Restored terrain data:', sceneData.terrain);
        console.log('Restored surface data:', sceneData.surface);
      }

      // Pre-populate poles array with imported data for terrain building
      const tempPoles = [];
      sceneData.poles.forEach(poleData => {
        tempPoles.push({ 
          x: poleData.x, 
          z: poleData.z, 
          h: poleData.height, 
          base: poleData.elevation
        });
      });
      
      // Rebuild terrain first with imported pole data to establish proper terrainOffsetZ
      if (tempPoles.length > 0) {
        showLoadingOverlay('Rebuilding terrain surface...');
        
        // Convert poles to the format expected by buildTerrain
        const customPolesForTerrain = tempPoles.map(pole => ({
          x: pole.x,
          z: pole.z,
          h: pole.h,
          elev: pole.base
        }));
        
        // Rebuild terrain with imported pole data
        const terrain = importedBuildTerrain(
          scene, 
          new URLSearchParams(), // Empty URL params since we have all the data
          customPolesForTerrain, 
          elements.terrainSelect, 
          null, 
          SEG, 
          hAt, 
          addGridLines, 
          addDefaultTrees, 
          null
        );
        
        fitGroundInView(camera, controls, terrain);
        const darkModeSync = isDarkModeActive();
        scene.background = darkModeSync ? new THREE.Color('#0a1014') : new THREE.Color(0x87ceeb);
        updateSceneLabelStylesForDarkMode(darkModeSync);
        toggleGridVisibility(UIState.showGrid);
      }
      
      // Now import poles with correct terrainOffsetZ
      showLoadingOverlay('Importing poles...');
      sceneData.poles.forEach(poleData => {
        // Add pole with imported data
        const mesh = new THREE.Mesh(poleGeo, mPole);
        mesh.scale.y = poleData.height / BASE_H;
        mesh.position.set(poleData.x, poleData.elevation + poleData.height / 2, poleData.z + terrainOffsetZ);
        mesh.userData.pole = true;

        const crossArm = new THREE.Mesh(crossArmGeo, mCrossArm);
        crossArm.position.y = 5;
        mesh.add(crossArm);

        scene.add(mesh);
        poles.push({ 
          x: poleData.x, 
          z: poleData.z, 
          h: poleData.height, 
          base: poleData.elevation, 
          obj: mesh 
        });
      });
      
      // Import settings
      const settings = sceneData.settings;
      
      if (settings.tension !== undefined) {
        UIState.currentTension = settings.tension;
        if (elements.tensionSlider) {
          elements.tensionSlider.value = settings.tension;
          elements.tensionLabel.textContent = `${settings.tension} lbs`;
        }
      }
      
      if (settings.clearanceThreshold !== undefined) {
        UIState.clearanceThreshold = settings.clearanceThreshold;
        if (elements.clearanceThreshold) {
          elements.clearanceThreshold.value = settings.clearanceThreshold;
          elements.clearanceLabel.textContent = settings.clearanceThreshold;
        }
      }
      
      // Set dropdowns and checkboxes
      if (settings.terrain && elements.terrainSelect) {
        elements.terrainSelect.value = settings.terrain;
      }
      
      if (settings.showGrid !== undefined) {
        UIState.showGrid = settings.showGrid;
        if (elements.showGridCheck) {
          elements.showGridCheck.checked = settings.showGrid;
        }
      }
      
      if (settings.showSagCalculations !== undefined) {
        UIState.showSagCalculations = settings.showSagCalculations;
        if (elements.showSagCalculations) {
          elements.showSagCalculations.checked = settings.showSagCalculations;
        }
      }
      
      if (settings.showClearanceBuffers !== undefined) {
        UIState.showClearanceBuffers = settings.showClearanceBuffers;
        if (elements.showClearanceBuffers) {
          elements.showClearanceBuffers.checked = settings.showClearanceBuffers;
        }
      }
      
      if (settings.showPoleHeightLabels !== undefined) {
        UIState.showPoleHeightLabels = settings.showPoleHeightLabels;
        if (elements.showPoleHeightLabels) {
          elements.showPoleHeightLabels.checked = settings.showPoleHeightLabels;
        }
      }
      
      // Rebuild scene with imported data (spans and final positioning)
      showLoadingOverlay('Finalizing scene...');
      rebuild();
      updateCrossarmOrientations();
      updateLastPoleIndicator();
      toggleGridVisibility(UIState.showGrid);
      updateSagCalculations();
      updatePoleHeightLabels();
      checkClearances();
      
      // Capture state after import for undo/redo
      history.captureState();
      
      // Success!
      setTimeout(() => {
        hideLoadingOverlay();
        alert(`Scene imported successfully!\n${sceneData.poles.length} poles loaded.`);
      }, 100); // Small delay to show "Rebuilding scene..." message
      
    } catch (error) {
      hideLoadingOverlay();
      console.error('Error importing scene:', error);
      alert(`Error importing scene:\n${error.message}`);
    }
  }

  // Loading overlay helpers
  function showLoadingOverlay(message = 'Loading scene...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    if (text) text.textContent = message;
    if (overlay) overlay.classList.add('active');
  }

  function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function handleFileImport() {
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.multiple = false;
    
    fileInput.onchange = function(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size too large. Please select a file smaller than 10MB.');
        return;
      }
      
      // Validate file type
      if (!file.type.includes('json') && !file.name.toLowerCase().endsWith('.json')) {
        alert('Please select a valid JSON file.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          showLoadingOverlay('Processing scene data...');
          
          // Use setTimeout to allow UI to update before heavy processing
          setTimeout(() => {
            try {
              showLoadingOverlay('Importing poles and terrain...');
              importScene(e.target.result);
              hideLoadingOverlay();
            } catch (error) {
              hideLoadingOverlay();
              console.error('File reading error:', error);
              alert('Error reading file. Please ensure it\'s a valid GridScaper scene file.');
            }
          }, 50);
        } catch (error) {
          hideLoadingOverlay();
          console.error('File reading error:', error);
          alert('Error reading file. Please ensure it\'s a valid GridScaper scene file.');
        }
      };
      
      reader.onerror = function() {
        hideLoadingOverlay();
        alert('Error reading file. Please try again.');
      };
      
      reader.readAsText(file);
    };
    
    // Trigger file picker
    fileInput.click();
  }

  function handleGISImport() {
    showGISImportDialog((gisData) => {
      try {
        showLoadingOverlay('Processing GIS data...');
        
        // Clear existing scene
        resetScene();
        
        // Store the GIS elevation surface
        gisElevationSurface = gisData.elevationSurface;
        
        // Create custom ground function that uses GIS elevations
        customGround = gisElevationSurface;
        
        showLoadingOverlay('Building terrain from GIS elevation data...');
        
        // Create custom poles data for terrain building
        const customPolesForTerrain = gisData.poles.map(pole => ({
          x: pole.x,
          z: pole.z,
          h: pole.height,
          elev: pole.elevation
        }));
        
        // Rebuild terrain with GIS data
        const terrain = importedBuildTerrain(
          scene, 
          new URLSearchParams(), 
          customPolesForTerrain, 
          elements.terrainSelect, 
          null, 
          SEG, 
          hAt, 
          addGridLines, 
          addDefaultTrees, 
          null
        );
        
        fitGroundInView(camera, controls, terrain);
        const gisDarkMode = isDarkModeActive();
        scene.background = gisDarkMode ? new THREE.Color('#0a1014') : new THREE.Color(0x87ceeb);
        updateSceneLabelStylesForDarkMode(gisDarkMode);
        toggleGridVisibility(UIState.showGrid);
        
        showLoadingOverlay('Adding poles from GIS coordinates...');
        
        // Add poles with GIS data
        gisData.poles.forEach(poleData => {
          const mesh = new THREE.Mesh(poleGeo, mPole);
          mesh.scale.y = poleData.height / BASE_H;
          mesh.position.set(poleData.x, poleData.elevation + poleData.height / 2, poleData.z + terrainOffsetZ);
          mesh.userData.pole = true;
          mesh.userData.gisId = poleData.id;
          mesh.userData.originalCoords = poleData.originalCoords;

          const crossArm = new THREE.Mesh(crossArmGeo, mCrossArm);
          crossArm.position.y = 5;
          mesh.add(crossArm);

          scene.add(mesh);
          poles.push({ 
            x: poleData.x, 
            z: poleData.z, 
            h: poleData.height, 
            base: poleData.elevation, 
            obj: mesh,
            gisId: poleData.id,
            originalCoords: poleData.originalCoords
          });
        });
        
        showLoadingOverlay('Finalizing GIS scene...');
        
        // Build spans and update scene
        rebuild();
        updateCrossarmOrientations();
        updateLastPoleIndicator();
        toggleGridVisibility(UIState.showGrid);
        updateSagCalculations();
        updatePoleHeightLabels();
        checkClearances();
        
        // Success message
        setTimeout(() => {
          hideLoadingOverlay();
          alert(`✅ GIS data imported successfully!\n\n` +
                `📍 ${gisData.poles.length} poles imported\n` +
                `📏 Scene dimensions: ${gisData.metadata.sceneSize.width}×${gisData.metadata.sceneSize.depth} ft\n` +
                `🧭 Overall bearing: ${gisData.metadata.overallBearing}°\n` +
                `⛰️ Elevation range: ${gisData.metadata.elevationRange.toFixed(1)} ft\n` +
                `🔄 Scale factor: ${gisData.metadata.scaleFactor.toFixed(2)}x`);
        }, 100);
        
      } catch (error) {
        hideLoadingOverlay();
        console.error('Error importing GIS data:', error);
        alert(`❌ Error importing GIS data:\n${error.message}`);
      }
    });
  }

  function handleElevationProfileImport() {
    showElevationProfileDialog((elevationData) => {
      try {
        showLoadingOverlay('Processing elevation profile...');
        
        // Clear existing scene completely
        resetScene();
        
        // Clear any existing terrain meshes from scene
        const terrainMeshesToRemove = [];
        scene.traverse((child) => {
          if (child.isMesh && (
            child.userData.terrain || 
            child.userData.elevationProfile ||
            child.geometry.type === 'PlaneGeometry'
          )) {
            terrainMeshesToRemove.push(child);
          }
        });
        terrainMeshesToRemove.forEach(mesh => {
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) mesh.material.dispose();
          scene.remove(mesh);
        });
        
        // Clear terrain references
        window.terrain = null;
        gisElevationSurface = null;
        customGround = null;
        
        // Store the elevation function for terrain lookups
        gisElevationSurface = elevationData.elevationFunction;
        customGround = gisElevationSurface;
        
        showLoadingOverlay('Building terrain surface...');
        
        // Create the terrain mesh from elevation profile
        const { terrain, surfaceMesh } = elevationData.terrainData;
        scene.add(surfaceMesh);
        
        // Store terrain reference for future clearing
        window.terrain = surfaceMesh;
  const elevationDarkMode = isDarkModeActive();
  scene.background = elevationDarkMode ? new THREE.Color('#0a1014') : new THREE.Color(0x87ceeb);
  updateSceneLabelStylesForDarkMode(elevationDarkMode);
        
        // Store terrain reference - pass the mesh directly to fitGroundInView
        fitGroundInView(camera, controls, surfaceMesh);
        
        showLoadingOverlay('Setting up interactive environment...');
        
        // Add grid if enabled
        toggleGridVisibility(UIState.showGrid);
        
        // Update UI elements
        updateSceneElements();
        updateLastPoleIndicator();
        
        setTimeout(() => {
          hideLoadingOverlay();
          
          const { metadata } = elevationData;
          alert(`✅ Elevation profile imported successfully!\n\n` +
                `📊 ${metadata.points} elevation points\n` +
                `📏 Profile length: ${metadata.profileLength?.toFixed(1) || 'N/A'} ft\n` +
                `⛰️ Elevation range: ${metadata.elevationRange.min.toFixed(1)} - ${metadata.elevationRange.max.toFixed(1)} ft\n` +
                `📐 Height span: ${metadata.elevationRange.span.toFixed(1)} ft\n` +
                `🎯 Scene size: ${metadata.sceneWidth} × ${metadata.sceneDepth} ft\n\n` +
                `👆 Click anywhere on the terrain to place poles!`);
        }, 100);
        
      } catch (error) {
        hideLoadingOverlay();
        console.error('Error importing elevation profile:', error);
        alert(`❌ Error importing elevation profile:\n${error.message}`);
      }
    });
  }

  // Add drag and drop functionality
  function setupDragAndDrop() {
    const overlay = document.getElementById('dragDropOverlay');
    let dragCounter = 0;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      document.addEventListener(eventName, handleDragEnter, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, handleDragLeave, false);
    });

    function handleDragEnter(e) {
      dragCounter++;
      if (overlay) {
        overlay.classList.add('active');
      }
    }

    function handleDragLeave(e) {
      dragCounter--;
      if (dragCounter === 0 && overlay) {
        overlay.classList.remove('active');
      }
    }

    // Handle dropped files
    document.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
      dragCounter = 0;
      if (overlay) {
        overlay.classList.remove('active');
      }

      const dt = e.dataTransfer;
      const files = dt.files;

      if (files.length > 0) {
        const file = files[0];
        
        // Validate file type
        if (!file.type.includes('json') && !file.name.toLowerCase().endsWith('.json')) {
          alert('Please drop a valid JSON file.');
          return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('File size too large. Please select a file smaller than 10MB.');
          return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            showLoadingOverlay('Processing dropped file...');
            
            // Use setTimeout to allow UI to update before heavy processing
            setTimeout(() => {
              try {
                showLoadingOverlay('Importing poles and terrain...');
                importScene(e.target.result);
                hideLoadingOverlay();
              } catch (error) {
                hideLoadingOverlay();
                console.error('File reading error:', error);
                alert('Error reading file. Please ensure it\'s a valid GridScaper scene file.');
              }
            }, 50);
          } catch (error) {
            hideLoadingOverlay();
            console.error('File reading error:', error);
            alert('Error reading file. Please ensure it\'s a valid GridScaper scene file.');
          }
        };

        reader.onerror = function() {
          hideLoadingOverlay();
          alert('Error reading file. Please try again.');
        };

        reader.readAsText(file);
      }
    }
  }

  // Initialize drag and drop
  setupDragAndDrop();

  // Scenarios panel functionality
  const scenariosPanel = document.getElementById('scenariosPanel');
  const scenariosToggle = document.getElementById('scenariosToggle');
  const scenariosContent = document.getElementById('scenariosContent');
  
  if (scenariosToggle) {
    scenariosToggle.addEventListener('click', () => {
      const isCollapsed = scenariosContent.classList.contains('collapsed');
      if (isCollapsed) {
        scenariosContent.classList.remove('collapsed');
        scenariosToggle.textContent = '−';
      } else {
        scenariosContent.classList.add('collapsed');
        scenariosToggle.textContent = '+';
      }
    });
  }
  
  // Handle scenario button clicks
  document.querySelectorAll('.scenario-button').forEach(button => {
    button.addEventListener('click', () => {
      const url = button.getAttribute('data-url');
      if (url) {
        window.location.href = url;
      }
    });
  });

  // HUD collapse/expand functionality
  const hudToggle = document.getElementById('hudToggle');
  const hudContent = document.getElementById('hudContent');
  const hudCollapseBtn = document.getElementById('hudCollapseBtn');
  
  if (hudToggle && hudContent && hudCollapseBtn) {
    hudToggle.addEventListener('click', () => {
      const isCollapsed = hudContent.classList.contains('collapsed');
      if (isCollapsed) {
        hudContent.classList.remove('collapsed');
        hudCollapseBtn.textContent = '−';
      } else {
        hudContent.classList.add('collapsed');
        hudCollapseBtn.textContent = '+';
      }
    });
  }
});