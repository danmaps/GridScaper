// Terrain-related calculations and generation

// Export the offset variable so main.js can access it
export let terrainOffsetZ = 0;

// Export the function for use in main.js
export function buildTerrain(scene, urlParams, customPoles, terrainSel, environmentSel, SEG, hAt, addGridLines, addDefaultTrees, updateEnvironment) {  let terrain = null;

  // Clear existing terrain if it exists
  if (window.terrain) {
    scene.remove(window.terrain);
    window.terrain.geometry.dispose();
    window.terrain = null;
  }

  const gridSizeX = customPoles.length > 0
    ? parseInt(urlParams.get('size-x')) || 20
    : parseInt(urlParams.get('size-x')) || 100;
  const gridSizeY = parseInt(urlParams.get('size-y')) || 100;

  const maxPoleDistance = customPoles.length > 0
    ? Math.max(...customPoles.map(p => p.z))
    : 0;

  const terrainWidth = gridSizeX;
  const terrainDepth = Math.max(gridSizeY, maxPoleDistance + 40);
  terrainOffsetZ = 0;

  const g = new THREE.PlaneGeometry(terrainWidth, terrainDepth, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ 
    color: environmentSel && environmentSel.value === 'desert' ? 0xd2b48c : 0x5ca55c, 
    side: THREE.DoubleSide 
  }));
  terrain.position.z = terrainDepth / 2 - 20;
  scene.add(terrain);
  window.terrain = terrain; // Set the global terrain reference

  const positions = terrain.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const localZ = positions.getZ(i);
    const worldZ = localZ + terrain.position.z;

    const elevation = customPoles.length > 0 ? hAt(x, worldZ) : 0;
    positions.setY(i, elevation);
  }

  positions.needsUpdate = true;
  terrain.geometry.computeVertexNormals();

  addGridLines(scene, terrain);

  if (terrainSel.value === 'hillsTrees') addDefaultTrees(scene, hAt);
  if (environmentSel) updateEnvironment(scene, environmentSel);

  return terrain;
}

export function fitGroundInView(camera, controls, terrain) {
  if (terrain) {
    const terrainWidth = terrain.geometry.parameters.width;
    const terrainDepth = terrain.geometry.parameters.height;

    const centerX = 0;
    const centerZ = terrain.position.z;

    const maxDimension = Math.max(terrainWidth, terrainDepth);
    const distance = maxDimension / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

    camera.position.set(centerX + distance * 0.5, distance, centerZ + distance * 0.5);
    camera.lookAt(centerX, 0, centerZ);
    controls.target.set(centerX, 0, centerZ);
    controls.update();
  }
}

