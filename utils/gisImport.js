/**
 * GIS Import Utilities for GridScaper
 * 
 * This module provides functionality to import real-world GIS data including:
 * - CSV files with lat/long coordinates and elevation
 * - Conversion from geographic coordinates to local scene coordinates
 * - Elevation interpolation for terrain surface generation
 * - Support for various coordinate reference systems
 */

// Earth's radius in meters for coordinate calculations
const EARTH_RADIUS = 6378137;

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
function toRadians(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param {number} rad - Radians
 * @returns {number} Degrees
 */
function toDegrees(rad) {
  return rad * (180 / Math.PI);
}

/**
 * Calculate the distance between two lat/lng points using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

/**
 * Calculate the bearing between two lat/lng points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Bearing in degrees (0-360)
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Parse CSV content and extract GIS data
 * @param {string} csvContent - Raw CSV file content
 * @returns {Object} Parsed GIS data with pole locations and metadata
 */
export function parseGISData(csvContent) {
  const lines = csvContent.trim().split('\n');
  const poles = [];
  let headers = [];
  
  // Detect headers and data format
  const firstLine = lines[0].toLowerCase();
  let hasHeaders = false;
  
  // Common header patterns
  if (firstLine.includes('lat') || firstLine.includes('lng') || 
      firstLine.includes('elevation') || firstLine.includes('height') ||
      firstLine.includes('longitude') || firstLine.includes('pole')) {
    hasHeaders = true;
    headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  }
  
  // Find column indices
  let latIndex = -1, lngIndex = -1, elevIndex = -1, heightIndex = -1, idIndex = -1;
  
  if (hasHeaders) {
    headers.forEach((header, index) => {
      if (header.includes('lat')) latIndex = index;
      if (header.includes('lng') || header.includes('lon')) lngIndex = index;
      if (header.includes('elev') || header.includes('altitude')) elevIndex = index;
      if (header.includes('height') || header.includes('pole_height')) heightIndex = index;
      if (header.includes('id') || header.includes('name') || header.includes('pole')) idIndex = index;
    });
  } else {
    // Assume standard format: lat, lng, elevation, height (optional)
    latIndex = 0;
    lngIndex = 1;
    elevIndex = 2;
    heightIndex = 3;
  }
  
  // Parse data rows
  const dataStart = hasHeaders ? 1 : 0;
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    
    // Skip lines that don't have minimum required fields
    if (values.length < 3 || latIndex === -1 || lngIndex === -1) continue;
    
    const lat = parseFloat(values[latIndex]);
    const lng = parseFloat(values[lngIndex]);
    
    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.warn(`Invalid coordinates at line ${i + 1}: lat=${lat}, lng=${lng}`);
      continue;
    }
    
    // Parse elevation (required)
    let elevation = 0;
    if (elevIndex >= 0 && elevIndex < values.length) {
      elevation = parseFloat(values[elevIndex]);
      if (isNaN(elevation)) elevation = 0;
    }
    
    // Parse pole height (optional, default to 10)
    let height = 10;
    if (heightIndex >= 0 && heightIndex < values.length) {
      const parsedHeight = parseFloat(values[heightIndex]);
      if (!isNaN(parsedHeight) && parsedHeight > 0) {
        height = parsedHeight;
      }
    }
    
    // Parse ID/name (optional)
    let id = `Pole_${poles.length + 1}`;
    if (idIndex >= 0 && idIndex < values.length && values[idIndex]) {
      id = values[idIndex].replace(/['"]/g, '');
    }
    
    poles.push({
      id,
      lat,
      lng,
      elevation,
      height,
      originalIndex: i
    });
  }
  
  if (poles.length === 0) {
    throw new Error('No valid pole data found in CSV. Please check the format.');
  }
  
  return {
    poles,
    headers: hasHeaders ? lines[0].split(',').map(h => h.trim()) : null,
    totalRows: lines.length - dataStart,
    validPoles: poles.length
  };
}

/**
 * Convert GIS coordinates to local scene coordinates
 * @param {Array} gisData - Array of pole data with lat/lng coordinates
 * @param {Object} options - Conversion options
 * @returns {Object} Converted pole data with scene coordinates and metadata
 */
export function convertToSceneCoordinates(gisData, options = {}) {
  const {
    scaleToFit = true,
    maxSceneSize = 200, // Maximum scene dimension in feet/meters
    centerOrigin = true,
    preserveAspectRatio = true
  } = options;
  
  if (!gisData || gisData.length === 0) {
    throw new Error('No GIS data provided for conversion');
  }
  
  // Find bounds of the data
  const lats = gisData.map(p => p.lat);
  const lngs = gisData.map(p => p.lng);
  const elevations = gisData.map(p => p.elevation);
  
  const bounds = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minElevation: Math.min(...elevations),
    maxElevation: Math.max(...elevations)
  };
  
  // Calculate center point
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  
  // Calculate span in meters
  const latSpanMeters = calculateDistance(bounds.minLat, centerLng, bounds.maxLat, centerLng);
  const lngSpanMeters = calculateDistance(centerLat, bounds.minLng, centerLat, bounds.maxLng);
  const maxSpanMeters = Math.max(latSpanMeters, lngSpanMeters);
  
  // Calculate scale factor
  let scaleFactor = 1;
  if (scaleToFit && maxSpanMeters > 0) {
    // Convert to feet if needed (assuming maxSceneSize is in feet for GridScaper)
    const maxSpanFeet = maxSpanMeters * 3.28084; // meters to feet
    scaleFactor = maxSceneSize / maxSpanFeet;
  }
  
  // Convert each pole
  const convertedPoles = gisData.map((pole, index) => {
    // Calculate relative position from center in meters
    const deltaLatMeters = calculateDistance(centerLat, centerLng, pole.lat, centerLng);
    const deltaLngMeters = calculateDistance(centerLat, centerLng, centerLat, pole.lng);
    
    // Apply sign based on direction
    const latSign = pole.lat >= centerLat ? 1 : -1;
    const lngSign = pole.lng >= centerLng ? 1 : -1;
    
    // Convert to feet and scale
    let x = (deltaLngMeters * lngSign * 3.28084) * scaleFactor;
    let z = (deltaLatMeters * latSign * 3.28084) * scaleFactor;
    
    // Center at origin if requested
    if (!centerOrigin) {
      // Calculate the offset to keep all coordinates positive
      const allXs = gisData.map(p => {
        const dLng = calculateDistance(centerLat, centerLng, centerLat, p.lng);
        const xSign = p.lng >= centerLng ? 1 : -1;
        return (dLng * xSign * 3.28084) * scaleFactor;
      });
      const allZs = gisData.map(p => {
        const dLat = calculateDistance(centerLat, centerLng, p.lat, centerLng);
        const zSign = p.lat >= centerLat ? 1 : -1;
        return (dLat * zSign * 3.28084) * scaleFactor;
      });
      
      const minX = Math.min(...allXs);
      const minZ = Math.min(...allZs);
      
      x -= minX;
      z -= minZ;
    }
    
    return {
      ...pole,
      x: Math.round(x * 10) / 10, // Round to 1 decimal place
      z: Math.round(z * 10) / 10,
      sceneElevation: pole.elevation, // Keep original elevation for now
      distanceFromStart: index > 0 ? 
        Math.hypot(x - convertedPoles[0]?.x || 0, z - convertedPoles[0]?.z || 0) : 0
    };
  });
  
  // Calculate cumulative distances for linear arrangement option
  const totalDistance = convertedPoles.reduce((total, pole, index) => {
    if (index === 0) return 0;
    const prev = convertedPoles[index - 1];
    const dist = Math.hypot(pole.x - prev.x, pole.z - prev.z);
    pole.cumulativeDistance = total + dist;
    return total + dist;
  }, 0);
  
  // Calculate bearing/azimuth for the overall line
  const firstPole = convertedPoles[0];
  const lastPole = convertedPoles[convertedPoles.length - 1];
  const overallBearing = calculateBearing(firstPole.lat, firstPole.lng, lastPole.lat, lastPole.lng);
  
  return {
    poles: convertedPoles,
    metadata: {
      originalBounds: bounds,
      centerPoint: { lat: centerLat, lng: centerLng },
      scaleFactor,
      totalDistance: Math.round(totalDistance),
      overallBearing: Math.round(overallBearing),
      elevationRange: bounds.maxElevation - bounds.minElevation,
      sceneSize: {
        width: Math.round(Math.abs(Math.max(...convertedPoles.map(p => p.x)) - Math.min(...convertedPoles.map(p => p.x)))),
        depth: Math.round(Math.abs(Math.max(...convertedPoles.map(p => p.z)) - Math.min(...convertedPoles.map(p => p.z))))
      }
    }
  };
}

/**
 * Create a terrain surface function from GIS elevation data
 * @param {Array} poles - Array of converted pole data with x, z coordinates and elevation
 * @param {Object} options - Interpolation options
 * @returns {Function} Function that returns elevation for any x, z coordinate
 */
export function createElevationSurface(poles, options = {}) {
  const {
    interpolationMethod = 'linear', // 'linear', 'spline', or 'idw' (inverse distance weighting)
    smoothingFactor = 1.0,
    falloffDistance = 100, // Distance beyond which elevation becomes flat
    defaultElevation = null // Default elevation for areas far from poles
  } = options;
  
  if (!poles || poles.length === 0) {
    return (x, z) => 0;
  }
  
  // If only one pole, return constant elevation
  if (poles.length === 1) {
    return (x, z) => poles[0].elevation;
  }
  
  // Calculate default elevation if not provided
  const avgElevation = poles.reduce((sum, p) => sum + p.elevation, 0) / poles.length;
  const defaultElev = defaultElevation !== null ? defaultElevation : avgElevation;
  
  // Sort poles by cumulative distance for linear interpolation
  const sortedPoles = [...poles].sort((a, b) => {
    const distA = Math.hypot(a.x, a.z);
    const distB = Math.hypot(b.x, b.z);
    return distA - distB;
  });
  
  return function getElevationAt(x, z) {
    switch (interpolationMethod) {
      case 'linear':
        return linearInterpolation(x, z, sortedPoles, defaultElev, falloffDistance);
      
      case 'idw':
        return inverseDistanceWeighting(x, z, poles, defaultElev, falloffDistance);
      
      case 'spline':
        // For now, fall back to linear interpolation
        // Could implement spline interpolation in the future
        return linearInterpolation(x, z, sortedPoles, defaultElev, falloffDistance);
      
      default:
        return linearInterpolation(x, z, sortedPoles, defaultElev, falloffDistance);
    }
  };
}

/**
 * Linear interpolation between nearest poles
 * @private
 */
function linearInterpolation(x, z, sortedPoles, defaultElev, falloffDistance) {
  // Find the two closest poles to the query point
  let minDist1 = Infinity, minDist2 = Infinity;
  let pole1 = null, pole2 = null;
  
  for (const pole of sortedPoles) {
    const dist = Math.hypot(x - pole.x, z - pole.z);
    
    if (dist < minDist1) {
      minDist2 = minDist1;
      pole2 = pole1;
      minDist1 = dist;
      pole1 = pole;
    } else if (dist < minDist2) {
      minDist2 = dist;
      pole2 = pole;
    }
  }
  
  if (!pole1) return defaultElev;
  
  // If very close to a pole, return its elevation
  if (minDist1 < 0.1) return pole1.elevation;
  
  // If far from all poles, fade to default elevation
  if (minDist1 > falloffDistance) {
    const fade = Math.max(0, 1 - (minDist1 - falloffDistance) / falloffDistance);
    return defaultElev + (pole1.elevation - defaultElev) * fade;
  }
  
  // If only one pole nearby, use distance-based blending
  if (!pole2 || minDist2 > falloffDistance) {
    const fade = 1 - (minDist1 / falloffDistance);
    return defaultElev + (pole1.elevation - defaultElev) * fade;
  }
  
  // Linear interpolation between two nearest poles
  const totalDist = minDist1 + minDist2;
  if (totalDist < 0.1) return pole1.elevation;
  
  const weight1 = 1 - (minDist1 / totalDist);
  const weight2 = 1 - (minDist2 / totalDist);
  const normalizedWeight1 = weight1 / (weight1 + weight2);
  
  return pole1.elevation * normalizedWeight1 + pole2.elevation * (1 - normalizedWeight1);
}

/**
 * Inverse distance weighting interpolation
 * @private
 */
function inverseDistanceWeighting(x, z, poles, defaultElev, falloffDistance) {
  let weightedSum = 0;
  let weightSum = 0;
  
  for (const pole of poles) {
    const dist = Math.hypot(x - pole.x, z - pole.z);
    
    // If very close to a pole, return its elevation
    if (dist < 0.1) return pole.elevation;
    
    // Calculate weight (inverse of distance squared)
    const weight = 1 / (dist * dist);
    
    // Apply falloff
    const falloffWeight = dist < falloffDistance ? weight : weight * Math.exp(-(dist - falloffDistance) / falloffDistance);
    
    weightedSum += pole.elevation * falloffWeight;
    weightSum += falloffWeight;
  }
  
  if (weightSum === 0) return defaultElev;
  
  return weightedSum / weightSum;
}

/**
 * Generate sample CSV data for testing
 * @returns {string} Sample CSV content
 */
export function generateSampleGISData() {
  const sampleData = [
    ['lat', 'lng', 'elevation', 'pole_height', 'pole_id'],
    [33.937721, -116.527342, 1050, 25, 'POLE_001'],
    [33.937721, -116.527322, 1048, 25, 'POLE_002'],
    [33.936328, -116.527344, 1045, 20, 'POLE_003'],
    [33.933478, -116.527267, 1040, 30, 'POLE_004'],
    [33.934119, -116.527262, 1042, 25, 'POLE_005'],
    [33.934872, -116.527346, 1044, 25, 'POLE_006'],
    [33.937032, -116.527343, 1049, 25, 'POLE_007'],
    [33.935559, -116.527345, 1046, 20, 'POLE_008']
  ];
  
  return sampleData.map(row => row.join(',')).join('\n');
}

/**
 * Validate GIS import data before processing
 * @param {string} csvContent - Raw CSV content to validate
 * @returns {Object} Validation result with success flag and messages
 */
export function validateGISData(csvContent) {
  const errors = [];
  const warnings = [];
  
  try {
    if (!csvContent || csvContent.trim().length === 0) {
      errors.push('File is empty');
      return { success: false, errors, warnings };
    }
    
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      errors.push('File must contain at least 2 lines (header + data)');
      return { success: false, errors, warnings };
    }
    
    // Parse and validate
    const parsed = parseGISData(csvContent);
    
    if (parsed.poles.length === 0) {
      errors.push('No valid pole data found');
      return { success: false, errors, warnings };
    }
    
    if (parsed.poles.length < 2) {
      warnings.push('Only one pole found - limited terrain interpolation available');
    }
    
    // Check coordinate ranges
    const lats = parsed.poles.map(p => p.lat);
    const lngs = parsed.poles.map(p => p.lng);
    
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    
    if (latRange < 0.0001 && lngRange < 0.0001) {
      warnings.push('Pole locations are very close together - may result in small scene');
    }
    
    if (latRange > 1 || lngRange > 1) {
      warnings.push('Large coordinate range detected - scene may be very large');
    }
    
    // Check elevation data
    const elevations = parsed.poles.map(p => p.elevation);
    const elevRange = Math.max(...elevations) - Math.min(...elevations);
    
    if (elevRange === 0) {
      warnings.push('All poles have the same elevation - terrain will be flat');
    }
    
    return {
      success: true,
      errors: [],
      warnings,
      summary: {
        totalPoles: parsed.poles.length,
        latRange: latRange.toFixed(6),
        lngRange: lngRange.toFixed(6),
        elevRange: elevRange.toFixed(1)
      }
    };
    
  } catch (error) {
    errors.push(`Parsing error: ${error.message}`);
    return { success: false, errors, warnings };
  }
}