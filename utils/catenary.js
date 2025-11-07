// Sag calculation constants
const MIN_SAG = 0.1;           // Minimum sag in units (prevents zero sag)
const BASE_SAG_FACTOR = 0.05;  // Base sag as percentage of span (5%)

/**
 * Solve for the catenary parameter 'a' given horizontal span and sag.
 * Uses iterative Newton-Raphson method to find 'a' such that:
 *   sag = a * (cosh(L/(2a)) - 1)
 * where L is the horizontal span length and sag is the maximum sag at midpoint.
 * 
 * @param {number} span - Horizontal span length
 * @param {number} targetSag - Desired maximum sag
 * @param {number} maxIterations - Maximum iterations for convergence
 * @returns {number} Catenary parameter 'a'
 */
function solveCatenaryParameter(span, targetSag, maxIterations = 20) {
  // Initial guess: approximate 'a' from parabolic approximation
  // For parabola: sag ≈ L²/(8a), so a ≈ L²/(8*sag)
  let a = (span * span) / (8 * targetSag);
  
  const tolerance = 0.001;
  const halfSpan = span / 2;
  
  for (let i = 0; i < maxIterations; i++) {
    const x = halfSpan / a;
    const coshX = Math.cosh(x);
    
    // Function: f(a) = a * (cosh(L/(2a)) - 1) - targetSag
    const f = a * (coshX - 1) - targetSag;
    
    // Derivative: f'(a) = cosh(x) - 1 - (L/(2a)) * sinh(x)
    const sinhX = Math.sinh(x);
    const df = coshX - 1 - x * sinhX;
    
    // Newton-Raphson update
    const aNew = a - f / df;
    
    // Check convergence
    if (Math.abs(aNew - a) < tolerance) {
      return aNew;
    }
    
    a = aNew;
  }
  
  return a;
}

/**
 * Calculate conductor curve points for a span between two poles.
 * 
 * This function computes the true catenary sag of a power line conductor between 
 * two poles, taking into account pole positions, heights, and tension factor.
 * 
 * The catenary curve is the natural shape formed by a flexible cable hanging under 
 * its own weight between two support points. The mathematical form is:
 *   y = a * cosh(x/a) + C
 * where 'a' is the catenary parameter (related to tension/weight ratio) and C is 
 * a constant that positions the curve vertically.
 * 
 * For level spans, the parameter 'a' is solved from the relationship:
 *   sag = a * (cosh(L/(2a)) - 1)
 * where L is the span length and sag is the maximum vertical distance from the 
 * straight line connecting the attachment points.
 * 
 * @param {Object} options - Configuration options for the conductor curve
 * @param {Object} options.poleA - First pole data
 * @param {number} options.poleA.x - X coordinate of pole A
 * @param {number} options.poleA.z - Z coordinate of pole A
 * @param {number} options.poleA.base - Base elevation of pole A
 * @param {number} options.poleA.h - Height of pole A above base
 * @param {Object} options.poleB - Second pole data
 * @param {number} options.poleB.x - X coordinate of pole B
 * @param {number} options.poleB.z - Z coordinate of pole B
 * @param {number} options.poleB.base - Base elevation of pole B
 * @param {number} options.poleB.h - Height of pole B above base
 * @param {number} [options.tension=1] - Tension factor (higher = less sag)
 * @param {number} [options.samples=32] - Number of points along the curve
 * @param {number} [options.lateralOffset=0] - Offset perpendicular to span direction
 * @param {number} [options.terrainOffsetZ=0] - Global terrain offset in Z direction
 * 
 * @returns {Array<{x: number, y: number, z: number}>} Array of points along the conductor curve
 * 
 * @example
 * // Basic usage with two poles
 * const poleA = { x: 0, z: 0, base: 0, h: 10 };
 * const poleB = { x: 20, z: 0, base: 0, h: 12 };
 * const curvePoints = getConductorCurve({
 *   poleA,
 *   poleB,
 *   tension: 1.5,
 *   samples: 32
 * });
 * 
 * @example
 * // With lateral offset for multiple conductors
 * const curvePoints = getConductorCurve({
 *   poleA: { x: 0, z: 0, base: 0, h: 10 },
 *   poleB: { x: 30, z: 0, base: 2, h: 10 },
 *   tension: 2.0,
 *   lateralOffset: 1.2,  // For right conductor on crossarm
 *   samples: 64
 * });
 */
export function getConductorCurve(options) {
  const {
    poleA,
    poleB,
    tension = 1,
    samples = 32,
    lateralOffset = 0,
    terrainOffsetZ = 0
  } = options;

  // Calculate crossarm heights (attachment points)
  const crossarmHeightA = poleA.base + poleA.h;
  const crossarmHeightB = poleB.base + poleB.h;

  // Calculate horizontal distance between poles
  const d = Math.hypot(poleB.x - poleA.x, poleB.z - poleA.z);
  
  // Calculate height difference between attachment points
  const heightDiff = crossarmHeightB - crossarmHeightA;
  
  // Calculate base sag based on span length and tension
  // Base sag is BASE_SAG_FACTOR (5%) of span length, reduced by tension factor
  const baseSag = Math.max(MIN_SAG, d * BASE_SAG_FACTOR) / tension;
  
  // Solve for catenary parameter 'a' using the target sag
  // This represents the ratio of horizontal tension to weight per unit length
  const a = solveCatenaryParameter(d, baseSag);
  
  // For inclined spans, we work in a tilted coordinate system
  // The catenary forms in a plane rotated by the angle of inclination
  const spanLength = Math.sqrt(d * d + heightDiff * heightDiff);
  const tiltAngle = Math.atan2(heightDiff, d);

  // Calculate direction vector and perpendicular for lateral offset
  const dirX = poleB.x - poleA.x;
  const dirZ = poleB.z - poleA.z;
  const dirLength = Math.sqrt(dirX * dirX + dirZ * dirZ);
  const normalizedDirX = dirX / dirLength;
  const normalizedDirZ = dirZ / dirLength;

  // Perpendicular vector (rotated 90 degrees)
  const perpX = -normalizedDirZ;
  const perpZ = normalizedDirX;

  // Start and end points with lateral offset applied
  const startX = poleA.x + perpX * lateralOffset;
  const startZ = poleA.z + perpZ * lateralOffset;
  const endX = poleB.x + perpX * lateralOffset;
  const endZ = poleB.z + perpZ * lateralOffset;

  // Generate curve points using true catenary equation
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    
    // Linear interpolation for x and z coordinates
    const x = startX + (endX - startX) * t;
    const z = startZ + (endZ - startZ) * t + terrainOffsetZ;
    
    // Catenary calculation in tilted coordinate system
    // Local horizontal coordinate centered at midspan
    const localX = (t - 0.5) * d;
    
    // True catenary sag: The standard catenary y = a*cosh(x/a) opens upward.
    // We want the conductor to hang downward, so we need the maximum sag at center.
    // At center (x=0): cosh(0) = 1 (minimum of cosh)
    // At endpoints (x=±d/2): cosh(d/2a) (maximum)
    // So sag = a * (cosh(d/2a) - cosh(x/a)) gives max sag at center
    const maxCosh = Math.cosh((d/2) / a);
    const catenaryY = a * (maxCosh - Math.cosh(localX / a));
    
    // Height along the straight line from pole A to pole B
    const straightLineHeight = crossarmHeightA + heightDiff * t;
    
    // Final height is straight line height MINUS the catenary sag (sag goes DOWN)
    const y = straightLineHeight - catenaryY;
    
    points.push({ x, y, z });
  }

  return points;
}
