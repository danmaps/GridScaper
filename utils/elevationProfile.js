/**
 * Elevation Profile Utilities for GridScaper
 * 
 * This module handles elevation profile data from GIS exports (ArcGIS, QGIS, etc.)
 * and creates interactive terrain surfaces for pole placement.
 */

/**
 * Parse elevation profile CSV data from GIS exports
 * @param {string} csvContent - Raw CSV content from elevation profile export
 * @returns {Object} Parsed elevation profile data
 */
export function parseElevationProfile(csvContent) {
  const lines = csvContent.trim().split('\n');
  const points = [];
  let headers = [];
  
  if (lines.length < 2) {
    throw new Error('Elevation profile must contain header and data rows');
  }
  
  // Parse headers
  headers = lines[0].split(',').map(h => h.trim());
  console.log('Detected headers:', headers);
  
  // Find column indices
  let xIndex = -1, yIndex = -1, distIndex = -1, elevIndex = -1;
  
  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    if (h.includes('x') || h === 'a') xIndex = index;
    if (h.includes('y') || h === 'b') yIndex = index;
    if (h.includes('distance') || h.includes('dist') || h === 'c') distIndex = index;
    if (h.includes('elevation') || h.includes('elev') || h.includes('ground') || h === 'd') elevIndex = index;
  });
  
  // Validate required columns
  if (elevIndex === -1) {
    throw new Error('No elevation column found. Expected column containing "elevation", "elev", or "ground"');
  }
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    
    if (values.length < headers.length) continue;
    
    // Parse coordinates (if available)
    let x = null, y = null;
    if (xIndex >= 0 && yIndex >= 0) {
      x = parseFloat(values[xIndex]);
      y = parseFloat(values[yIndex]);
      if (isNaN(x) || isNaN(y)) {
        console.warn(`Invalid coordinates at line ${i + 1}: x=${x}, y=${y}`);
        continue;
      }
    }
    
    // Parse distance
    let distance = 0;
    if (distIndex >= 0) {
      distance = parseFloat(values[distIndex]);
      if (isNaN(distance)) distance = 0;
    }
    
    // Parse elevation (required)
    const elevation = parseFloat(values[elevIndex]);
    if (isNaN(elevation)) {
      console.warn(`Invalid elevation at line ${i + 1}: ${values[elevIndex]}`);
      continue;
    }
    
    points.push({
      x,
      y,
      distance,
      elevation,
      index: i - 1
    });
  }
  
  if (points.length === 0) {
    throw new Error('No valid elevation data found');
  }
  
  // Sort by distance if available
  if (distIndex >= 0) {
    points.sort((a, b) => a.distance - b.distance);
  }
  
  // Calculate statistics
  const elevations = points.map(p => p.elevation);
  const distances = points.map(p => p.distance);
  
  const stats = {
    pointCount: points.length,
    elevationRange: {
      min: Math.min(...elevations),
      max: Math.max(...elevations),
      span: Math.max(...elevations) - Math.min(...elevations)
    },
    distanceRange: {
      min: Math.min(...distances),
      max: Math.max(...distances),
      span: Math.max(...distances) - Math.min(...distances)
    },
    averageElevation: elevations.reduce((sum, e) => sum + e, 0) / elevations.length
  };
  
  return {
    points,
    headers,
    stats,
    hasCoordinates: xIndex >= 0 && yIndex >= 0,
    hasDistance: distIndex >= 0
  };
}

/**
 * Convert elevation profile to GridScaper terrain surface
 * @param {Object} profileData - Parsed elevation profile data
 * @param {Object} options - Conversion options
 * @returns {Object} Terrain surface data for GridScaper
 */
export function createTerrainFromProfile(profileData, options = {}) {
  const {
    sceneWidth = 200,    // Maximum scene width in feet
    sceneDepth = 100,    // Scene depth in feet
    surfaceResolution = 1, // Terrain point spacing in feet
    heightScale = 1.0,   // Vertical exaggeration factor
    centerProfile = true, // Center the profile in the scene
    profileDirection = 'horizontal' // 'horizontal' or 'vertical'
  } = options;
  
  const { points, stats } = profileData;
  
  if (points.length < 2) {
    throw new Error('Need at least 2 elevation points to create terrain');
  }
  
  // Determine profile axis and scale
  let profileLength = stats.distanceRange.span;
  if (profileLength === 0) {
    // Fall back to point indices if no distance data
    profileLength = points.length - 1;
  }
  
  // Scale profile to fit scene
  const scaleX = profileLength > 0 ? sceneWidth / profileLength : 1;
  
  // Convert elevation profile points to scene coordinates
  const terrainPoints = points.map((point, index) => {
    let sceneX, sceneZ;
    
    if (profileData.hasDistance && point.distance !== undefined) {
      // Use actual distance measurements
      sceneX = (point.distance - stats.distanceRange.min) * scaleX;
    } else {
      // Use point index as distance
      sceneX = index * (sceneWidth / (points.length - 1));
    }
    
    // Center horizontally if requested
    if (centerProfile) {
      sceneX -= sceneWidth / 2;
    }
    
    // Always center vertically at Z=0 for profile
    sceneZ = 0;
    
    // Apply height scaling and normalize to ground level
    const sceneY = (point.elevation - stats.elevationRange.min) * heightScale;
    
    if (index === 0) {
      console.log('Elevation normalization debug:', {
        originalElevation: point.elevation,
        minElevation: stats.elevationRange.min,
        maxElevation: stats.elevationRange.max,
        normalizedElevation: sceneY,
        heightScale: heightScale
      });
    }
    
    return {
      x: sceneX,
      z: sceneZ,
      y: sceneY,
      originalElevation: point.elevation,
      distance: point.distance || index,
      index
    };
  });
  
  // Create interpolation function for the terrain surface
  function getElevationAt(x, z) {
    // For profile data, we primarily interpolate along the X-axis
    // and provide a surface with some width in the Z direction
    
    // Find the two closest points along X-axis
    let leftPoint = terrainPoints[0];
    let rightPoint = terrainPoints[terrainPoints.length - 1];
    
    // Find bracketing points
    for (let i = 0; i < terrainPoints.length - 1; i++) {
      const p1 = terrainPoints[i];
      const p2 = terrainPoints[i + 1];
      
      if (x >= p1.x && x <= p2.x) {
        leftPoint = p1;
        rightPoint = p2;
        break;
      }
    }
    
    // Linear interpolation along X-axis
    let elevation;
    if (leftPoint.x === rightPoint.x) {
      elevation = leftPoint.y;
    } else {
      const t = (x - leftPoint.x) / (rightPoint.x - leftPoint.x);
      elevation = leftPoint.y + (rightPoint.y - leftPoint.y) * t;
    }
    
    // Apply Z-axis falloff (terrain width)
    const maxZDistance = sceneDepth / 2;
    const zDistance = Math.abs(z);
    
    if (zDistance > maxZDistance) {
      // Beyond terrain width, use edge elevation
      return elevation;
    }
    
    // Optional: slight elevation variation across width
    // const zVariation = Math.sin(z * 0.1) * 0.5; // Small undulation
    // elevation += zVariation;
    
    return elevation;
  }
  
  // Create terrain mesh points for visualization
  const meshResolution = Math.max(1, Math.floor(surfaceResolution));
  const meshPoints = [];
  
  for (let x = -sceneWidth / 2; x <= sceneWidth / 2; x += meshResolution) {
    for (let z = -sceneDepth / 2; z <= sceneDepth / 2; z += meshResolution) {
      const elevation = getElevationAt(x, z);
      meshPoints.push({ x, z, y: elevation });
    }
  }
  
  return {
    elevationFunction: getElevationAt,
    profilePoints: terrainPoints,
    meshPoints,
    bounds: {
      x: { min: -sceneWidth / 2, max: sceneWidth / 2 },
      z: { min: -sceneDepth / 2, max: sceneDepth / 2 },
      y: { 
        min: Math.min(...terrainPoints.map(p => p.y)), 
        max: Math.max(...terrainPoints.map(p => p.y)) 
      }
    },
    metadata: {
      originalStats: stats,
      scaleFactorX: scaleX,
      heightScale,
      sceneWidth,
      sceneDepth,
      profileLength,
      pointCount: points.length
    }
  };
}

/**
 * Create visual representation of elevation profile
 * @param {Object} terrainData - Terrain data from createTerrainFromProfile
 * @param {Object} scene - Three.js scene
 * @param {Object} materials - Three.js materials
 * @returns {Object} Three.js objects representing the terrain
 */
export function createProfileVisualization(terrainData, scene, materials) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.userData.elevationProfile = true;
  
  // Create terrain mesh
  const { bounds, elevationFunction } = terrainData;
  const segments = 50;
  
  const geometry = new THREE.PlaneGeometry(
    bounds.x.max - bounds.x.min,
    bounds.z.max - bounds.z.min,
    segments,
    segments
  );
  
  // Apply elevation to vertices
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = elevationFunction(x, z);
    positions.setY(i, y);
  }
  
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  
  // Create terrain material
  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a6f47,
    wireframe: false,
    transparent: true,
    opacity: 0.8
  });
  
  const terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.userData.terrain = true;
  group.add(terrainMesh);
  
  // Create profile line visualization
  const profilePoints = terrainData.profilePoints.map(p => 
    new THREE.Vector3(p.x, p.y + 0.5, p.z) // Slightly above terrain
  );
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(profilePoints);
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0xff6b6b, 
    linewidth: 3 
  });
  const profileLine = new THREE.Line(lineGeometry, lineMaterial);
  profileLine.userData.profileLine = true;
  group.add(profileLine);
  
  // Create elevation markers at profile points
  terrainData.profilePoints.forEach((point, index) => {
    if (index % 5 === 0) { // Show every 5th point to avoid clutter
      const markerGeometry = new THREE.SphereGeometry(0.3, 8, 8);
      const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(point.x, point.y + 0.5, point.z);
      marker.userData.elevationMarker = true;
      marker.userData.elevation = point.originalElevation;
      marker.userData.distance = point.distance;
      group.add(marker);
    }
  });
  
  return {
    group,
    terrainMesh,
    profileLine,
    bounds: terrainData.bounds
  };
}

/**
 * Validate elevation profile data
 * @param {string} csvContent - Raw CSV content
 * @returns {Object} Validation result
 */
export function validateElevationProfile(csvContent) {
  const errors = [];
  const warnings = [];
  
  try {
    if (!csvContent || csvContent.trim().length === 0) {
      errors.push('File is empty');
      return { success: false, errors, warnings };
    }
    
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      errors.push('File must contain header and at least one data row');
      return { success: false, errors, warnings };
    }
    
    // Parse and validate
    const profileData = parseElevationProfile(csvContent);
    
    if (profileData.points.length === 0) {
      errors.push('No valid elevation data found');
      return { success: false, errors, warnings };
    }
    
    if (profileData.points.length < 3) {
      warnings.push('Very few elevation points - terrain may be simple');
    }
    
    // Check elevation range
    if (profileData.stats.elevationRange.span === 0) {
      warnings.push('All elevations are the same - terrain will be flat');
    }
    
    if (profileData.stats.elevationRange.span > 1000) {
      warnings.push('Large elevation range detected - consider height scaling');
    }
    
    if (!profileData.hasDistance) {
      warnings.push('No distance data found - using point indices for spacing');
    }
    
    return {
      success: true,
      errors: [],
      warnings,
      summary: {
        pointCount: profileData.points.length,
        elevationRange: `${profileData.stats.elevationRange.min.toFixed(1)} - ${profileData.stats.elevationRange.max.toFixed(1)} ft`,
        elevationSpan: profileData.stats.elevationRange.span.toFixed(1),
        distanceSpan: profileData.hasDistance ? profileData.stats.distanceRange.span.toFixed(1) + ' ft' : 'N/A',
        hasCoordinates: profileData.hasCoordinates
      }
    };
    
  } catch (error) {
    errors.push(`Parsing error: ${error.message}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Generate sample elevation profile data for testing
 * @returns {string} Sample CSV content
 */
export function generateSampleElevationProfile() {
  const sampleData = [
    ['X', 'Y', 'Distance (feet)', 'Ground Elevation (feet)'],
    ['-13039679.78', '4033348.471009304', '0', '1920.5749493051175'],
    ['-13039674.76', '4033345.625110424', '15.68244169816272', '1908.5749493051175'],
    ['-13039672.25', '4033344.202160415', '25.36226247244096', '1911.852349186774'],
    ['-13039669.75', '4033342.779210407', '35.06629359245458', '1915.062910132275'],
    ['-13039664.73', '4033339.933330393', '54.70712494894819', '1917.5969107473642'],
    ['-13039662.22', '4033338.510356836', '64.88845144356556', '1918.2560030464674'],
    ['-13039659.71', '4033337.087404675', '75.07226567925091', '1918.7507327439394'],
    ['-13039657.2', '4033335.664452889', '85.25608611737226', '1918.8709450107747'],
    ['-13039652.18', '4033332.818546675', '105.6253286839850', '1918.7760205060825'],
    ['-13039649.68', '4033331.395592492', '115.8094488188967', '1918.6474364267234'],
    ['-13039647.17', '4033329.972638441', '125.9935589538077', '1918.7973125154301'],
    ['-13039642.15', '4033327.126736942', '146.3617811036236', '1919.365652438063'],
    ['-13039639.64', '4033325.704', '156.5459372555301', '1909.682266204255'],
    ['-13039637.13', '4033324.280524252', '166.7300929439855', '1906.902329630058'],
    ['-13039634.62', '4033322.857866472', '176.9142732834456', '1901.489985048547'],
    ['-13039629.61', '4033320.011952176', '197.2826441698127', '1891.565915517697'],
    ['-13039627.1', '4033318.588955338', '207.4668536307066', '1887.590128940841'],
    ['-13039624.59', '4033317.166038111', '217.6510661679900', '1885.316149917431'],
    ['-13039622.08', '4033315.743065084', '227.8352776928771', '1884.2619334637718'],
    ['-13039617.06', '4033312.897164167', '248.2036130727034', '1891.534835024984'],
    ['-13039614.55', '4033311.474248275', '258.3878217615515', '1896.692390453604'],
    ['-13039612.04', '4033310.051258504', '268.57202542451569', '1901.056121237399'],
    ['-13039607.03', '4033307.205326927', '288.9395013235995', '1903.644370505608'],
    ['-13039604.52', '4033305.782366668', '299.12356916955433', '1904.7397616965543']
  ];
  
  return sampleData.map(row => row.join(',')).join('\n');
}