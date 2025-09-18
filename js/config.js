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
