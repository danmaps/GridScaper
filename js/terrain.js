const THREE = window.THREE;

export let terrainOffsetZ = 0;

export function buildTerrain(scene, urlParams, customPoles, terrainSel, environmentSel, SEG, hAt, addGridLines, addDefaultTrees, updateEnvironment, elevationPoints = [], terrainWidth = 20) {
  let terrain = null;

  if (window.terrain) {
    scene.remove(window.terrain);
    window.terrain.geometry.dispose();
    window.terrain = null;
  }

  // Determine terrain width: use elevationPoints if available, otherwise customPoles
  const gridSizeX = elevationPoints.length > 0 ? terrainWidth : 
                    (customPoles.length > 0 ? parseInt(urlParams.get('size-x')) || 20 : parseInt(urlParams.get('size-x')) || 100);
  const gridSizeY = parseInt(urlParams.get('size-y')) || 100;
  const maxPoleDistance = customPoles.length > 0 ? Math.max(...customPoles.map((p) => p.z)) : 0;
  const maxElevationDistance = elevationPoints.length > 0 ? Math.max(...elevationPoints.map((p) => p.z)) : 0;

  const finalTerrainWidth = gridSizeX;
  const terrainDepth = Math.max(gridSizeY, maxPoleDistance + 40, maxElevationDistance + 40);
  terrainOffsetZ = 0;

  const geometry = new THREE.PlaneGeometry(finalTerrainWidth, terrainDepth, SEG, SEG);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: environmentSel && environmentSel.value === 'desert' ? 0xd2b48c : 0x5ca55c,
    side: THREE.DoubleSide
  });

  terrain = new THREE.Mesh(geometry, material);
  terrain.position.z = terrainDepth / 2 - 20;
  scene.add(terrain);
  window.terrain = terrain;

  const positions = terrain.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const localZ = positions.getZ(i);
    const worldZ = localZ + terrain.position.z;
    const elevation = (customPoles.length > 0 || elevationPoints.length > 0) ? hAt(x, worldZ) : 0;
    positions.setY(i, elevation);
  }

  positions.needsUpdate = true;
  terrain.geometry.computeVertexNormals();

  addGridLines(scene, terrain);

  // If you want trees, call addDefaultTrees directly elsewhere
  if (environmentSel) updateEnvironment(scene, environmentSel);

  return terrain;
}

export function fitGroundInView(camera, controls, terrain) {
  if (!terrain) return;

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
