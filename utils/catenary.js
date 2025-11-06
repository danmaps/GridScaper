/**
 * Calculate conductor curve points for a span between two poles.
 * 
 * This function computes the sag of a power line conductor between two poles,
 * taking into account pole positions, heights, and tension factor.
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

  // Calculate sag based on span length and tension
  // Base sag is 5% of span length, reduced by tension factor
  const sag = Math.max(0.1, d * 0.05) / tension;

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

  // Generate curve points
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    
    // Linear interpolation for x and z
    const x = startX + (endX - startX) * t;
    const z = startZ + (endZ - startZ) * t + terrainOffsetZ;
    
    // Linear interpolation for base height + catenary sag
    // The sag follows a sin curve, maximum at middle (t=0.5)
    const y = crossarmHeightA + (crossarmHeightB - crossarmHeightA) * t - sag * Math.sin(Math.PI * t);
    
    points.push({ x, y, z });
  }

  return points;
}
