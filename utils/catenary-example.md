# Catenary API Usage Examples

The `getConductorCurve()` function calculates conductor sag points for power line spans between poles.

## Basic Usage

```javascript
import { getConductorCurve } from './utils/catenary.js';

// Define two poles
const poleA = { x: 0, z: 0, base: 0, h: 10 };
const poleB = { x: 30, z: 0, base: 0, h: 12 };

// Get curve points
const curvePoints = getConductorCurve({
  poleA,
  poleB,
  tension: 1.5,
  samples: 32
});

// curvePoints is an array of {x, y, z} objects
// e.g., [{x: 0, y: 10, z: 0}, {x: 0.9375, y: 9.952, z: 0}, ...]
```

## Multiple Conductors on Crossarm

Use the `lateralOffset` parameter to create parallel conductors:

```javascript
const crossarmPositions = [-1.2, 0, 1.2]; // left, center, right

crossarmPositions.forEach(offset => {
  const points = getConductorCurve({
    poleA,
    poleB,
    tension: 2.0,
    lateralOffset: offset,  // Offset perpendicular to span
    samples: 64
  });
  
  // Use points for rendering or collision detection
  renderConductor(points);
});
```

## With THREE.js

Convert points to THREE.Vector3 for rendering:

```javascript
const curvePoints = getConductorCurve({
  poleA: { x: 0, z: 0, base: 0, h: 10 },
  poleB: { x: 40, z: 0, base: 2, h: 10 },
  tension: 1.0,
  samples: 32
});

// Convert to THREE.Vector3
const pts = curvePoints.map(p => new THREE.Vector3(p.x, p.y, p.z));

// Create line geometry
const geometry = new THREE.BufferGeometry().setFromPoints(pts);
const line = new THREE.Line(geometry, material);
scene.add(line);
```

## Collision Detection

Use the curve points for clearance checks:

```javascript
const curvePoints = getConductorCurve({
  poleA,
  poleB,
  tension: UIState.currentTension,
  samples: 64  // More samples for better accuracy
});

// Check if any point is too close to an obstacle
const hasCollision = curvePoints.some(point => {
  const distanceToTree = Math.hypot(
    point.x - tree.x,
    point.z - tree.z
  );
  return distanceToTree < CLEARANCE_DISTANCE && point.y < tree.height;
});
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `poleA` | Object | required | First pole: `{x, z, base, h}` |
| `poleB` | Object | required | Second pole: `{x, z, base, h}` |
| `tension` | Number | 1 | Tension factor (higher = less sag) |
| `samples` | Number | 32 | Number of points along curve |
| `lateralOffset` | Number | 0 | Perpendicular offset from center |
| `terrainOffsetZ` | Number | 0 | Global Z offset for terrain |

## Understanding Sag Calculation

The function calculates sag using the formula:
- Base sag = 5% of horizontal span distance
- Actual sag = base sag / tension factor
- Vertical position follows a sine curve for realistic catenary shape

For a 30-unit span with tension=1.5:
- Horizontal distance: 30 units
- Base sag: 30 × 0.05 = 1.5 units
- Actual sag: 1.5 / 1.5 = 1.0 units
- Maximum sag occurs at t=0.5 (midpoint)
