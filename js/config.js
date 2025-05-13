// Configuration constants for GridScaper

// General constants
export const CONSTANTS = {
  CLEARANCE: 1,          // ft span‑to‑span
  SAMPLES: 32,           // points per span
  DRAG_SENS: 0.05,       // ft per pixel when dragging pole
  MINH: 1,               // Minimum height for poles
  MAXH: 40,              // Maximum height for poles
  SIZE: 120,             // General sizing constant
  SEG: 120,              // Segment density for geometry
  BASE_H: 10,            // Base height for poles
  R: 0.2                 // Radius for pole geometry
};

// Helper functions
export const HELPERS = {
  SNAP: v => Math.round(v)
};

// Bird animation settings
export const BIRD_SETTINGS = {
  count: 3,
  perchHeight: 0.1,
  flySpeed: 5.0,
  wingSpeed: 2.0,
  spawnChance: 0.25
};

// Material definitions
export function createMaterials() {
  // Access THREE from the window object since it's loaded as a global script
  const THREE = window.THREE;
  
  return {
    pole: new THREE.MeshStandardMaterial({color: 0x8b5a2b}),
    crossArm: new THREE.MeshStandardMaterial({color: 0x4d4d4d}),
    poleHighlight: new THREE.MeshStandardMaterial({color: 0xffe66d}),
    goodSpan: new THREE.LineBasicMaterial({color: 0x000000}),
    badSpan: new THREE.LineBasicMaterial({color: 0xff0000}),
    ghost: new THREE.MeshStandardMaterial({color: 0x46c9ff, transparent: true, opacity: 0.4}),
    treeHighlight: new THREE.MeshStandardMaterial({color: 0xffff8d}),
    grid: new THREE.LineBasicMaterial({color: 0x555555, transparent: true, opacity: 0.5}),
    bird: new THREE.MeshStandardMaterial({color: 0x222222})
  };
}

// Environment color settings
export const ENVIRONMENT_COLORS = {
  default: 0x5ca55c,     // Default green
  desert: 0xd2b48c,      // Beige for desert
  coastal: 0xf0e68c,     // Khaki for sandy shores
  mountain: 0x4f7942,    // Dark green for mountain vegetation
  city: 0x7ccd7c         // Lighter green for manicured urban grass
};

// Equipment appearance settings
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

// Default geometries
export function createGeometries() {
  // Access THREE from the window object
  const THREE = window.THREE;
  
  return {
    pole: new THREE.CylinderGeometry(CONSTANTS.R, CONSTANTS.R, CONSTANTS.BASE_H, 8),
    crossArm: new THREE.BoxGeometry(3, 0.2, 0.2),
    birdBody: () => {
      const geo = new THREE.ConeGeometry(0.15, 0.5, 4);
      geo.rotateX(Math.PI / 2);
      return geo;
    },
    birdHead: new THREE.SphereGeometry(0.08, 8, 8),
    birdWing: new THREE.PlaneGeometry(0.3, 0.2)
  };
}
