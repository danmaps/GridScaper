const THREE = window.THREE;

export const CONSTANTS = {
  CLEARANCE: 1,
  SAMPLES: 32,
  DRAG_SENS: 0.05,
  MINH: 1,
  MAXH: 40,
  SIZE: 120,
  SEG: 120,
  BASE_H: 10,
  R: 0.2
};

export const HELPERS = {
  SNAP: (value) => Math.round(value)
};

export const BIRD_SETTINGS = {
  count: 3,
  perchHeight: 0.1,
  flySpeed: 5,
  wingSpeed: 2,
  spawnChance: 0.25
};

export function createMaterials() {
  return {
    pole: new THREE.MeshStandardMaterial({ color: 0x8b5a2b }),
    crossArm: new THREE.MeshStandardMaterial({ color: 0x4d4d4d }),
    poleHighlight: new THREE.MeshStandardMaterial({ color: 0xffe66d }),
    goodSpan: new THREE.LineBasicMaterial({ color: 0x000000 }),
    badSpan: new THREE.LineBasicMaterial({ color: 0xff0000 }),
    ghost: new THREE.MeshStandardMaterial({ color: 0x46c9ff, transparent: true, opacity: 0.4 }),
    treeHighlight: new THREE.MeshStandardMaterial({ color: 0xffff8d }),
    grid: new THREE.LineBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 }),
    bird: new THREE.MeshStandardMaterial({ color: 0x222222 })
  };
}

export const ENVIRONMENT_COLORS = {
  default: 0x5ca55c,
  desert: 0xd2b48c,
  coastal: 0xf0e68c,
  mountain: 0x4f7942,
  city: 0x7ccd7c
};

export const EQUIPMENT_COLORS = {
  distribution: {
    pole: 0x8b5a2b,
    crossArm: 0x4d4d4d
  },
  subTransmission: {
    pole: 0x708090,
    crossArm: 0x303030
  },
  bulkTransmission: {
    pole: 0xa9a9a9,
    crossArm: 0xa9a9a9
  },
  generation: {
    pole: 0x708090,
    crossArm: 0x1e90ff
  }
};

export function createGeometries() {
  return {
    pole: new THREE.CylinderGeometry(CONSTANTS.R, CONSTANTS.R, CONSTANTS.BASE_H, 8),
    crossArm: new THREE.BoxGeometry(3, 0.2, 0.2),
    birdBody: () => {
      const geometry = new THREE.ConeGeometry(0.15, 0.5, 4);
      geometry.rotateX(Math.PI / 2);
      return geometry;
    },
    birdHead: new THREE.SphereGeometry(0.08, 8, 8),
    birdWing: new THREE.PlaneGeometry(0.3, 0.2)
  };
}

export function createTransmissionTower(height, material) {
  const tower = new THREE.Group();
  
  // Height parameter is the LOWEST tier height (where conductors attach)
  // Tiers are spaced 5 units apart (fixed separation)
  // Tower structure extends downward to reach from ground to lowest tier
  const tierSpacing = 5; // Fixed 5-unit spacing between tiers
  const tier1Height = height; // Lowest tier at specified height
  const tier2Height = height + tierSpacing; // Middle tier
  const tier3Height = height + tierSpacing * 2; // Top tier
  
  // Tower extends from ground to top tier
  const actualTowerHeight = tier3Height;
  
  // Scale factors based on lowest tier height - much wider tower
  const baseWidth = 0.8 + (height / 40) * 0.8; // Much wider base for taller towers
  const topWidth = 0.5; // Wider top
  
  // Create lattice frame using line segments
  // Main vertical legs (tapered from bottom to top)
  const legPositions = [
    { x: baseWidth / 2, z: baseWidth / 2 },
    { x: -baseWidth / 2, z: baseWidth / 2 },
    { x: -baseWidth / 2, z: -baseWidth / 2 },
    { x: baseWidth / 2, z: -baseWidth / 2 }
  ];
  
  // Create main vertical members
  const legMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, linewidth: 2 });
  legPositions.forEach(pos => {
    const legGeo = new THREE.BufferGeometry();
    const legPoints = [
      new THREE.Vector3(pos.x * baseWidth / baseWidth, -actualTowerHeight / 2, pos.z * baseWidth / baseWidth),
      new THREE.Vector3(pos.x * topWidth / baseWidth, actualTowerHeight / 2, pos.z * topWidth / baseWidth)
    ];
    legGeo.setFromPoints(legPoints);
    const legLine = new THREE.Line(legGeo, legMaterial);
    tower.add(legLine);
  });
  
  // Create X-bracing pattern on each face (simplified)
  const bracingMaterial = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 });
  const faces = [
    // Front face
    { p1: legPositions[0], p2: legPositions[1] },
    // Back face
    { p1: legPositions[2], p2: legPositions[3] },
    // Left face
    { p1: legPositions[1], p2: legPositions[2] },
    // Right face
    { p1: legPositions[3], p2: legPositions[0] }
  ];
  
  faces.forEach(face => {
    // Create X pattern with diagonals - density based on actual tower height
    const numDiagonals = Math.floor((actualTowerHeight / 10) * 4);
    for (let i = 0; i < numDiagonals; i++) {
      const t = i / Math.max(1, numDiagonals - 1);
      const y1 = -actualTowerHeight / 2 + t * actualTowerHeight;
      const y2 = -actualTowerHeight / 2 + (t + 0.25) * actualTowerHeight;
      
      // Lerp between base and top width
      const w1 = baseWidth + (topWidth - baseWidth) * t;
      const w2 = baseWidth + (topWidth - baseWidth) * (t + 0.25);
      
      // Diagonal 1 (/)
      const diag1Geo = new THREE.BufferGeometry();
      diag1Geo.setFromPoints([
        new THREE.Vector3(face.p1.x * w1 / baseWidth, y1, face.p1.z * w1 / baseWidth),
        new THREE.Vector3(face.p2.x * w2 / baseWidth, y2, face.p2.z * w2 / baseWidth)
      ]);
      tower.add(new THREE.Line(diag1Geo, bracingMaterial));
      
      // Diagonal 2 (\)
      const diag2Geo = new THREE.BufferGeometry();
      diag2Geo.setFromPoints([
        new THREE.Vector3(face.p2.x * w1 / baseWidth, y1, face.p2.z * w1 / baseWidth),
        new THREE.Vector3(face.p1.x * w2 / baseWidth, y2, face.p1.z * w2 / baseWidth)
      ]);
      tower.add(new THREE.Line(diag2Geo, bracingMaterial));
    }
  });
  
  // Create horizontal tiers for conductor attachment points (3 fixed tiers)
  // Tiers are positioned at fixed heights relative to the lowest tier
  const tierMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const tierHeights = [tier1Height, tier2Height, tier3Height];
  
  tierHeights.forEach((tierHeight, tierIdx) => {
    // Convert world tier height to local tower coordinates
    // Tower center is at actualTowerHeight / 2, so tier is at tierHeight - actualTowerHeight/2
    const tierY = -actualTowerHeight / 2 + tierHeight;
    
    // Get tier width based on position in tower
    const normalizedPos = (tierY + actualTowerHeight / 2) / actualTowerHeight;
    const tierWidth = baseWidth + (topWidth - baseWidth) * normalizedPos;
    
    // Create two attachment points
    const attachmentPositions = [
      new THREE.Vector3(tierWidth * 0.75, tierY, 0),
      new THREE.Vector3(-tierWidth * 0.75, tierY, 0)
    ];
    
    attachmentPositions.forEach(pos => {
      const attachGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);
      const attach = new THREE.Mesh(attachGeo, tierMaterial);
      attach.position.copy(pos);
      tower.add(attach);
    });
  });
  
  return tower;
}

// Tower tier heights: fixed vertical spacing between tiers
// tier1 = the height parameter (lowest tier)
// tier2 = height + 5
// tier3 = height + 10
// When height changes, tiers stay at these fixed vertical spacings, tower grows downward
export const TOWER_TIER_FRACTIONS = [1.0, 1.25, 1.5];
