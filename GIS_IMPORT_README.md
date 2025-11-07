# GIS Data Import Feature

GridScaper now supports importing real-world Geographic Information System (GIS) data, allowing you to visualize power line installations using actual survey coordinates and elevation data.

## Overview

The GIS import feature converts latitude/longitude coordinates with elevation data into a 3D scene with accurate spatial relationships and terrain surface interpolation. This enables modeling of real-world power line routes instead of just conceptual linear arrangements.

## Supported Data Formats

### CSV File Structure

The system accepts CSV files with the following columns (flexible header detection):

**Required columns:**
- `lat` / `latitude` - Decimal degrees latitude
- `lng` / `lon` / `longitude` - Decimal degrees longitude  
- `elevation` / `elev` / `altitude` - Ground elevation in feet

**Optional columns:**
- `pole_height` / `height` - Pole height in feet (defaults to 10ft)
- `pole_id` / `id` / `name` - Pole identifier (auto-generated if missing)

### Example Format (with headers)

```csv
lat,lng,elevation,pole_height,pole_id
33.937721,-116.527342,1050,25,POLE_001
33.937721,-116.527322,1048,25,POLE_002
33.936328,-116.527344,1045,20,POLE_003
33.933478,-116.527267,1040,30,POLE_004
```

### Alternative Formats

**Without headers (positional):**
```csv
33.937721,-116.527342,1050,25
33.937721,-116.527322,1048,25
33.936328,-116.527344,1045,20
```

**Minimal format (lat, lng, elevation only):**
```csv
33.937721,-116.527342,1050
33.937721,-116.527322,1048
33.936328,-116.527344,1045
```

## How to Import GIS Data

### Step 1: Access Import Dialog
Click the **🗺️ Import GIS** button in the GridScaper control panel.

### Step 2: Choose Data Source
Select one of three options:
- **Upload CSV File** - Browse and select a `.csv` or `.txt` file
- **Paste CSV Data** - Copy and paste CSV content directly
- **Use Sample Data** - Load example data from California desert region

### Step 3: Preview and Validate
The system will:
- Automatically detect the CSV format and column structure
- Validate coordinate ranges and data completeness
- Display a preview table showing converted scene coordinates
- Show statistics about the dataset (pole count, scene dimensions, etc.)

### Step 4: Configure Import Options
Adjust import settings as needed:

**Scene Scaling:**
- **Auto-fit to scene** - Automatically scales data to fit GridScaper's coordinate system
- **Preserve real distances** - Maintains actual geographic scale
- **Custom scale factor** - Apply manual scaling (useful for large geographic areas)

**Terrain Method:**
- **Linear interpolation** - Simple interpolation between nearby poles (fast)
- **Distance weighting** - Inverse distance weighted interpolation (smoother terrain)

**Coordinate Origin:**
- **Center at origin** - Places the pole cluster center at (0,0)
- **Start from first pole** - Uses first pole as origin reference

### Step 5: Import and Visualize
Click **Import Scene** to:
- Clear the current scene
- Generate 3D terrain surface from elevation data
- Place poles at calculated scene coordinates
- Build conductor spans with proper sag calculations
- Update the camera view to frame the imported data

## Technical Details

### Coordinate Conversion
The system uses the Haversine formula to calculate distances between geographic coordinates and converts them to local scene coordinates in feet. The conversion process:

1. **Calculate Center Point** - Determines the geographic center of all pole locations
2. **Distance Calculation** - Computes distances from center to each pole using spherical geometry
3. **Scene Projection** - Converts distances to scene coordinates (X,Z) in feet
4. **Elevation Mapping** - Preserves elevation data for 3D terrain generation

### Terrain Surface Generation
The elevation surface is created using interpolation algorithms:

- **Linear Interpolation** - Creates straight-line elevation changes between poles
- **Inverse Distance Weighting** - Smoother surfaces using weighted averages based on proximity
- **Falloff Handling** - Manages terrain elevation beyond pole locations

### Scale Factors
Typical scale factors for different geographic areas:
- **Local distribution** (few miles): 0.1x - 1.0x  
- **Regional transmission** (10+ miles): 0.01x - 0.1x
- **Long-distance transmission** (50+ miles): 0.001x - 0.01x

## Use Cases

### Survey Data Integration
Import pole locations from GPS surveys or engineering drawings:
```csv
lat,lng,elevation,pole_height,pole_id
40.7128,-74.0060,150,45,NYC_T001
40.7135,-74.0055,155,45,NYC_T002
40.7142,-74.0050,148,45,NYC_T003
```

### Design Validation
Verify power line designs against existing topography and infrastructure constraints.

### Route Planning
Visualize proposed routes with real terrain to assess clearance requirements and construction challenges.

### Educational Modeling
Create realistic scenarios for training and educational purposes using actual utility data.

## Data Quality Guidelines

### Coordinate Accuracy
- Use decimal degrees with at least 6 decimal places for sub-meter accuracy
- Ensure coordinates are in WGS84/NAD83 datum (standard GPS format)
- Verify coordinate order (latitude first, longitude second)

### Elevation Data
- Provide elevations in consistent units (feet recommended)
- Include both ground elevation and pole heights when available
- Consider using surveyed elevations rather than estimated values

### File Preparation
- Save files as UTF-8 encoded CSV
- Avoid special characters in pole IDs
- Keep file sizes under 5MB for optimal performance
- Include headers when possible for automatic column detection

## Limitations and Considerations

### Geographic Scope
- Optimized for local to regional scale projects (under 100 miles)
- Very large geographic areas may require custom scaling
- Coordinate precision limited to scene coordinate resolution

### Terrain Modeling
- Interpolation assumes reasonable terrain between poles
- Complex topography may require additional elevation data points
- Does not account for terrain obstacles (buildings, trees, etc.)

### Performance
- Large datasets (1000+ poles) may impact rendering performance
- Consider data filtering for very dense pole arrangements
- Scene size affects memory usage and interaction responsiveness

## Troubleshooting

### Common Import Issues

**"No valid pole data found"**
- Check CSV format and column headers
- Verify coordinate values are numeric
- Ensure minimum 2-3 data rows exist

**"Invalid coordinates"**
- Validate latitude range (-90 to +90 degrees)
- Validate longitude range (-180 to +180 degrees)
- Check for swapped lat/lng columns

**"Scene too large/small"**
- Adjust scale factor in import options
- Use auto-fit scaling for initial imports
- Consider coordinate accuracy for small areas

**"Elevation interpolation errors"**
- Verify elevation values are numeric
- Check for extreme elevation differences
- Try different terrain interpolation methods

### Data Validation Tips
1. **Preview coordinates** in an external mapping tool first
2. **Check elevation ranges** for reasonableness
3. **Test with sample data** to verify formatting
4. **Start small** with 5-10 poles for initial validation

## Future Enhancements

The GIS import system provides a foundation for additional features:
- Support for KML/KMZ files
- Integration with online elevation services
- Batch processing of multiple routes
- Export of scene coordinates back to GIS formats
- Advanced terrain modeling with DEMs (Digital Elevation Models)

This feature significantly expands GridScaper's utility for real-world power line engineering and visualization applications.