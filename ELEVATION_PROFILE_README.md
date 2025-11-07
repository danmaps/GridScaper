# Elevation Profile Import for GridScaper

This feature allows you to import real elevation profile data from GIS systems and surveying tools to create realistic terrain surfaces for power line design and visualization in GridScaper.

## 🎯 What This Feature Does

Instead of using simple linear pole arrangements or basic terrain models, you can now:

- **Import real elevation data** from ArcGIS Portal, Civil 3D, QGIS, and other GIS tools
- **Create accurate terrain surfaces** from elevation profiles along power line routes
- **Place poles interactively** on realistic topography
- **Visualize sag and clearance** calculations with actual ground elevation data

## 📊 Supported Data Formats

### ArcGIS Portal Elevation Profiles
Perfect for data exported from SCE GeoView or similar ArcGIS Portal applications:
```csv
X,Y,Distance (feet),Ground Elevation (feet)
-13039679.78,4033348.47,0,1920.57
-13039674.76,4033345.62,15.68,1908.57
-13039672.25,4033344.20,25.36,1911.85
```

### AutoCAD Civil 3D Profile Exports
Standard profile station/elevation format:
```csv
Station,Elevation
0+00,1920.57
0+15.68,1908.57
0+25.36,1911.85
```

### Simple Distance-Elevation Data
Basic format with distance and elevation:
```csv
Distance,Elevation
0,1920.57
15.68,1908.57
25.36,1911.85
```

### QGIS Profile Tool Output
Distance-based elevation profiles:
```csv
Distance (m),Elevation (m)
0.00,585.53
4.78,582.05
7.73,586.12
```

## 🚀 How to Use

### 1. Access the Import Dialog
Click the **📈 Elevation Profile** button in the Actions section of GridScaper.

### 2. Choose Your Data Source
- **Upload CSV File**: Drag & drop or browse for elevation profile CSV files
- **Paste CSV Data**: Copy and paste elevation data directly from other applications
- **Use Sample Profile**: Try the feature with realistic sample elevation data

### 3. Preview Your Data
The dialog automatically:
- **Detects column headers** and data structure
- **Shows elevation statistics** (range, span, point count)
- **Displays a profile chart** visualization
- **Validates data quality** and highlights any issues

### 4. Configure Terrain Options
- **Scene Width**: How wide the terrain surface should be (100-2000 ft)
- **Scene Depth**: How deep the terrain surface extends (50-200 ft)
- **Height Scale**: Vertical exaggeration for terrain visualization (0.5x - 10x)
- **Center Profile**: Whether to center the elevation profile in the scene

### 5. Create Terrain Surface
Click **Create Terrain Surface** to:
- Generate a 3D terrain mesh from your elevation data
- Set up the scene for interactive pole placement
- Enable realistic sag and clearance calculations

## 🎛️ Interactive Features

Once your elevation profile is imported:

- **Click to place poles** anywhere on the terrain surface
- **Automatic ground elevation detection** at each pole location
- **Real conductor sag calculations** using actual terrain heights
- **Clearance analysis** with true ground-to-conductor distances
- **3D visualization** of power lines over realistic topography

## 💡 Tips for Best Results

### Data Quality
- **More points = smoother terrain**: 20+ elevation points recommended
- **Consistent spacing**: Regular distance intervals work best
- **Clean data**: Remove duplicate points and outliers

### Scene Configuration
- **Match your use case**: Use natural height scale (1.0x) for accurate clearances
- **Consider visualization**: Use enhanced height scale (1.5x-2.0x) for dramatic presentations
- **Scene size matters**: Larger scenes show more context but may impact performance

### File Preparation
- **CSV format preferred**: Ensure comma-separated values
- **Clear headers**: Use descriptive column names (Distance, Elevation, etc.)
- **Consistent units**: Feet are preferred, but meters work too
- **UTF-8 encoding**: Ensure special characters display correctly

## 🔧 Technical Details

### Coordinate Systems
- **Projected coordinates**: X,Y coordinates are preserved but used for reference only
- **Distance-based profiles**: Profile distance determines terrain layout
- **Elevation interpolation**: Linear interpolation between profile points
- **Scene mapping**: Profile mapped to GridScaper's coordinate system

### Terrain Generation
- **Surface mesh creation**: Triangulated mesh from elevation profile
- **Interpolation methods**: Linear interpolation perpendicular to profile
- **Elevation functions**: Continuous elevation lookup for any scene position
- **Height scaling**: Configurable vertical exaggeration for visualization

### Integration with GridScaper
- **Replaces default terrain**: Elevation profile becomes the active terrain
- **Maintains all features**: Pole placement, sag calculations, clearance checks
- **Export compatibility**: Scenes with elevation profiles can be saved/loaded
- **Performance optimized**: Efficient mesh generation and elevation lookups

## 📁 Sample Data

The `sample-elevation-profile.csv` file demonstrates the expected format with:
- 25 realistic elevation points
- Distance range: 0-216 feet
- Elevation range: 1878-1920 feet (42 ft span)
- Terrain variations typical of power line routes

## ⚠️ Limitations

- **Profile-based only**: Designed for linear elevation profiles, not area elevation grids
- **Single profile**: One elevation profile per scene (cannot combine multiple profiles)
- **Memory considerations**: Very large profiles (1000+ points) may impact performance
- **Unit consistency**: Mixed units within same dataset not supported

## 🆘 Troubleshooting

### Common Issues
- **"No elevation column found"**: Ensure column headers include words like "elevation", "height", or "ground"
- **"Insufficient data points"**: Profiles need at least 2 elevation points
- **"Invalid distance values"**: Distance values must increase monotonically
- **File won't import**: Check file encoding (use UTF-8) and format (CSV preferred)

### Performance Issues
- **Large files**: Files over 5MB may load slowly
- **Many points**: Profiles with 500+ points may impact real-time interaction
- **Complex terrain**: High vertical variation may require height scale adjustment

### Data Quality Issues
- **Gaps in elevation**: Linear interpolation fills gaps between points
- **Outlier elevations**: Review elevation statistics and remove obvious errors
- **Incorrect units**: Verify elevation units match your expectations

---

*This elevation profile import feature transforms GridScaper from a basic pole arrangement tool into a professional power line design platform capable of working with real-world topographic data.*