# GridScaper

🎮 **[Try GridScaper Live](https://danmaps.github.io/GridScaper/)**

## Overview

GridScaper is a **fun and educational** browser-based tool for learning power line engineering concepts! This interactive simulation helps you understand fundamental principles like:

🔗 **Catenary Curves & Sag Calculations** - Visualize how conductor tension affects line sag  
⚡ **Clearance Requirements** - Learn safety distance standards with real-time feedback  
🏗️ **Pole Placement & Terrain** - Explore how topography impacts power line design  
📊 **Real GIS Data Import** - Work with actual elevation profiles from surveying tools  

**Perfect for students, educators, and anyone curious about power system infrastructure!**

> ⚠️ **Educational Purpose Only**: This tool is designed for learning and exploration, not engineering precision. All calculations use simplified models for demonstration. For professional power line design, consult qualified engineers and industry standards.

***

## ✅ What's New

* **Smart Clearance Coach**  
  Dynamically evaluates pole and span positions against simulated safety rules (PASS/WARN/FAIL) and visualizes buffers in real time.  
  *Powered by deterministic geometry checks and rule tables—not AI—so results are transparent and reproducible.*

* **Scenario Sharing & Import**
  * Copy a URL that encodes the current scene for quick sharing.
  * Import a saved JSON to reload a scenario instantly.

* **Cost & Schedule Estimator (Toy Model)**  
  Displays approximate cost and duration based on pole count, terrain, and environment multipliers (all simulated).

* **Stakeholder Mode**  
  A simplified, read-only walkthrough for presenting tradeoffs (Current → Option A → Option B).

***

## ⚠️ Data Disclaimer

All rules, rates, and risk overlays are **simulated for demonstration only**.  
No production or confidential data is used. See RULES.md for details.

***

## 🚀 Quick Start

### Option 1: Use Online (Recommended)

**[Launch GridScaper](https://danmaps.github.io/GridScaper/)** - No installation required!

### Option 2: Run Locally

```bash
# Clone the repository
git clone https://github.com/danmaps/GridScaper.git
cd GridScaper

# Serve locally (Python 3)
python -m http.server 8080
# Then open: http://localhost:8080

# Or use any web server:
# npx serve .
# php -S localhost:8080
```

### 🎓 Learning Resources

* **[Elevation Profile Guide](https://danmaps.github.io/GridScaper/ELEVATION_PROFILE_README.md)** - Import real GIS elevation data
* **[GIS Import Features](https://danmaps.github.io/GridScaper/GIS_IMPORT_README.md)** - Work with coordinate systems and surveying data

***

## How It Meets Judging Criteria

| Criterion          | How GridScaper+ Delivers                                                       |
| ------------------ | ------------------------------------------------------------------------------ |
| **Business Value** | Visual safety + cost feedback accelerates planning decisions.                  |
| **Impact**         | Enables quick "what-if" siting discussions with mock data.                     |
| **Feasibility**    | Pure client-side, runs on GitHub Pages, uses test data only.                   |
| **Originality**    | Combines sag visualization, terrain presets, and dynamic overlays in one tool. |
| **Creativity**     | Stakeholder mode and thematic environments make technical tradeoffs engaging.  |

***

## Roadmap

Future enhancements could include:

* **Predictive clearance risk under wind/load scenarios** using ML.
* **Integration with enterprise GIS** for real-world data (post-POC, with proper governance).

***

## Core Features

* **Interactive Pole Placement**: Add and delete power poles with adjustable heights on the terrain. Poles can be dragged to new positions, and their height can be adjusted after placement.
* **Adjustable Line Tension**: Modify the tension of the power lines and observe the corresponding sag between poles.
* **URL Parameterization**: Launch the simulation with predefined configurations for grid dimensions, terrain, and pole setups.
* **Data Export**: Download the current scene configuration (poles, spans, terrain, tension) as a JSON file.
* **Visual Grid Overlay**: Toggle a visual grid on the terrain with coordinate labels that follow the terrain's contour.
* **Crossarm Orientation**: Crossarms on poles automatically orient themselves based on the direction of the connected power lines.

## 📐 Catenary Math: The Physics Behind the Sag

Power lines don't hang in a parabolic arc—they form a **catenary curve**, the natural shape of a flexible cable suspended under its own weight. GridScaper uses catenary-inspired math to realistically simulate conductor sag.

### Catenary vs. Parabola

| Aspect | Catenary | Parabola |
|--------|----------|----------|
| **Equation** | `y = a·cosh(x/a)` | `y = x²` |
| **Physical Cause** | Uniform weight per unit length of cable | Uniform vertical load (e.g., bridge deck) |
| **Real-World Examples** | Power lines, hanging chains | Suspension bridge cables under deck load |
| **Sag Behavior** | More gradual near supports, steeper in middle | Symmetric, quadratic curve |

### How GridScaper Computes Conductor Sag

The app uses a **sine approximation** of the catenary for real-time performance, trading mathematical rigor for visual accuracy. Here's the core logic from `utils/catenary.js`:

```javascript
/**
 * Calculate conductor curve points between two poles
 * 
 * True catenary: y = a·cosh(x/a) + c
 * GridScaper approximation: sine curve with physics-based sag factor
 */
export function getConductorCurve(options) {
  const { poleA, poleB, tension = 1, samples = 32 } = options;

  // Attachment heights at crossarms
  const heightA = poleA.base + poleA.h;
  const heightB = poleB.base + poleB.h;

  // Horizontal span distance
  const spanLength = Math.hypot(poleB.x - poleA.x, poleB.z - poleA.z);

  // Calculate sag: base 5% of span, reduced by tension factor
  const baseSag = Math.max(0.1, spanLength * 0.05) / tension;
  
  // Height difference reduces effective sag (angled conductors)
  const heightDiff = Math.abs(heightB - heightA);
  const heightFactor = 1 / (1 + (heightDiff / spanLength) * 0.5);
  const sag = baseSag * heightFactor;

  // Generate curve points
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples; // 0 → 1 along span

    // Linear interpolation for position
    const x = poleA.x + (poleB.x - poleA.x) * t;
    const z = poleA.z + (poleB.z - poleA.z) * t;

    // Height with sine-based sag (peaks at midpoint)
    const y = heightA + (heightB - heightA) * t - sag * Math.sin(Math.PI * t);

    points.push({ x, y, z });
  }

  return points;
}
```

### Key Parameters

* **Tension Factor**: Higher values (more tension) reduce sag proportionally. Default is 1.0; UI slider maps 500–5000 lbs to a 0.2–5.0 multiplier.
* **Height Difference Penalty**: When poles have different elevations, the angled conductor experiences more tension, reducing sag by up to 50%.
* **Sine vs. Hyperbolic Cosine**: The sine approximation `Math.sin(π·t)` is visually similar to `cosh` for typical spans but computes ~10× faster for real-time animation.

### Why It Matters

Accurate sag modeling is critical for:

* **Clearance Safety**: Ensuring conductors stay above minimum ground/vegetation distances.
* **Structural Design**: Calculating pole loading and selecting appropriate hardware.
* **Cost Optimization**: Balancing span length (fewer poles) against sag (taller poles, higher tension).

This simplified model helps you explore these trade-offs interactively—though real engineering requires full catenary equations, material properties, and environmental loads (ice, wind, temperature).

## ⚔️ Challenge Mode (Budget + Objectives)

Challenge Mode turns GridScaper into a mini planning puzzle: connect power from the green substation cube to the blue customer cube efficiently, safely, and under budget.

### How to Start / Exit

* Start: Click the "Challenge Mode" button. Two immovable buildings (substation + customer) appear at opposite ends of the terrain.
* Exit / Sandbox: Click "Sandbox Mode" to return to free placement without budget rules.

### Objective

Place poles so the last pole ends within the connection range (15 ft) of the customer building. When in range, the customer cube lights up with a blue emissive glow (powered). Then press "Check Solution" to see success or issues.

### Budget & Costs

* Each pole adds a fixed pole cost.
* Each conductor span adds cost per foot (including substation→first pole and last pole→customer when powered).
* The live panel shows: Poles Used, Amount Spent, Remaining Budget (green if OK, red if over).
* Savings are reported on success (Budget − Spent).

### Span Rules

* Maximum span length enforced: If a prospective pole would exceed the limit, placement is blocked with a clear warning dialog.
* The ghost pole label displays the prospective span distance (and marks it "too long" if violated).

### Clearance & Safety

All normal clearance checks still run. A span that sags too close to terrain triggers a warning indicator line and counts as a violation in solution checking.

### Win Conditions

"Check Solution" reports:

1. Customer powered (pole within 15 ft)
2. No span length violations
3. Budget not exceeded
4. No clearance violations


If all pass you get a success summary (including savings). Otherwise the first failure(s) are listed so you can iterate.

### Undo / Redo Support

Every pole add/remove/drag (height or position) captures a snapshot. Use the Undo / Redo buttons to explore strategies while keeping cost tracking consistent.

### Strategy Tips

* Shorter spans reduce conductor cost but may require more poles (increasing pole cost).
* Higher tension reduces sag, helping clearances, but doesn’t directly affect cost in the current model.
* Position poles to approach customer directly to minimize the final jump distance.

### Educational Notes

Costs, thresholds, and connection range are simplified approximations for learning only. They do not represent utility design standards.


## How to Use

### Basic Interaction

* **Add Pole**: Left-click on the terrain.
* **Delete Pole**: Right-click on a pole.
* **Adjust New Pole Height**: Use the "New pole height" slider.
* **Select Terrain Type**: Use the "Terrain" dropdown menu.
* **Adjust Line Tension**: Use the "Tension" slider.
* **Toggle Grid Visibility**: Use the "Grid" checkbox.
* **Change Setting**: Use the "Setting" dropdown (Residential, Commercial, Urban, Rural). This primarily affects building generation.
* **Change Environment**: Use the "Environment" dropdown (Coastal, Mountain, Desert, City). This affects terrain color, vegetation, and other environmental props.
* **Change Equipment Type**: Use the "Equipment" dropdown (Distribution, Sub Transmission, Bulk Transmission, Generation). This changes the color of poles and crossarms.
* **Download Scene Data**: Click the "Download" button to export your current scene as a JSON file. This includes pole positions, heights, elevations, terrain surface data, and all UI settings.
* **Import Scene**: Click the "Import Scene" button to load a previously exported scene file, or simply drag and drop a .json file onto the application. The import will restore poles, terrain elevation profile, and all settings exactly as they were saved. A loading animation indicates progress during file processing. The canvas is completely cleared before import to ensure no visual artifacts remain.
* **Copy Scenario Link**: Click the "Copy Link" button to generate a shareable URL with your current scene configuration.
* **Clear Scene**: Click the "Clear Scene" button to remove all poles and spans.
* **Navigate**: Use orbit controls (typically left-click and drag to orbit, mouse wheel to zoom, right-click and drag to pan).
* **Drag Pole Position**: Click and drag an existing pole to move it along the terrain.
* **Adjust Existing Pole Height**: Alt-click (Option-click on Mac) and drag an existing pole up or down.

### Using URL Parameters

GridScaper supports URL parameters to customize the simulation upon loading. Parameters are added to the index.html URL after a `?`, with multiple parameters separated by an `&`.

**Available Parameters**:

* **Grid Dimensions** (Note: size-x, size-y appear in url-parameters-guide.md but are not explicitly used in index.html to define terrain/grid plane size; terrain size is fixed in index.html):
  * While the guide mentions size-x and size-y, the index.html currently uses a fixed SIZE for terrain generation. Pole parameters will work within this fixed terrain.
* **Pole Configuration**:
  * `poles-distances`: Comma-separated list of distances along the Z-axis for poles.
  * `poles-heights`: Comma-separated list of heights for each pole (in feet).
  * `poles-elevations`: Comma-separated list of ground elevations at each pole.

**Important Notes for URL Parameters**:

* All three pole parameters (poles-distances, poles-heights, and poles-elevations) must be provided together and have the same number of values.
* Poles are positioned along the Z-axis.
* The terrain will automatically adjust to create a smooth sloped surface through all pole locations defined by the elevations.
* You can still interact with the simulation (add/remove poles, adjust tension, etc.) after it's initialized with URL parameters.

**Examples**:

* Basic Line Profile with Three Poles: [https://danmaps.github.io/GridScaper/?poles-distances=0,20,40&poles-heights=10,15,12&poles-elevations=0,5,2](https://danmaps.github.io/GridScaper/?poles-distances=0,20,40&poles-heights=10,15,12&poles-elevations=0,5,2)
* Valley Crossing: [https://danmaps.github.io/GridScaper/?poles-distances=0,25,50&poles-heights=20,25,20&poles-elevations=10,0,10](https://danmaps.github.io/GridScaper/?poles-distances=0,25,50&poles-heights=20,25,20&poles-elevations=10,0,10)

### JSON Export Format

GridScaper exports scenes in JSON format that includes comprehensive terrain data to prevent "floating poles" when importing:

* **Pole Data**: Position, height, and elevation for each pole
* **Terrain Surface**: Elevation profile and interpolation data for smooth terrain recreation
* **UI Settings**: All slider values, dropdown selections, and display options
* **Version Information**: File format version for backward compatibility

The enhanced format (v1.1+) captures the exact terrain surface geometry, ensuring that imported scenes maintain their original appearance with proper pole-to-ground relationships. This prevents "floating poles" that can occur when terrain surface data is missing.

## Usage Guide

### Controls and Interactions

* **Add Pole**: Left-click on the terrain.

* **Delete Pole**: Right-click on a pole.

* **Resize Pole Height**: Alt-drag (Option-drag on Mac) an existing pole up or down.

* **Adjust New Pole Height**: Use the "New pole height" slider.

* **Select Terrain Type**: Use the "Terrain" dropdown menu.

* **Adjust Line Tension**: Use the "Tension" slider.

* **Toggle Grid Visibility**: Use the "Grid" checkbox.

* **Download Scene Data**: Click the "Download" button.

* **Clear Scene**: Click the "Clear Scene" button to remove all poles and spans.

* **Navigate**: Use orbit controls (typically left-click and drag to orbit, mouse wheel to zoom, right-click and drag to pan).

* **Drag Pole Position**: Click and drag an existing pole to move it along the terrain.

* **Adjust Existing Pole Height**: Alt-click (Option-click on Mac) and drag an existing pole up or down.

### URL Parameters

GridScaper supports URL parameters to customize the simulation upon loading. Parameters are added to the index.html URL after a `?`, with multiple parameters separated by an `&`.

**Available Parameters**:

* **Grid Dimensions** (Note: size-x, size-y appear in url-parameters-guide.md but are not explicitly used in index.html to define terrain/grid plane size; terrain size is fixed in index.html):
  * While the guide mentions size-x and size-y, the index.html currently uses a fixed SIZE for terrain generation. Pole parameters will work within this fixed terrain.
* **Pole Configuration**:
  * `poles-distances`: Comma-separated list of distances along the Z-axis for poles.
  * `poles-heights`: Comma-separated list of heights for each pole (in feet).
  * `poles-elevations`: Comma-separated list of ground elevations at each pole.

**Important Notes for URL Parameters**:

* All three pole parameters (poles-distances, poles-heights, and poles-elevations) must be provided together and have the same number of values.
* Poles are positioned along the Z-axis.
* The terrain will automatically adjust to create a smooth sloped surface through all pole locations defined by the elevations.
* You can still interact with the simulation (add/remove poles, adjust tension, etc.) after it's initialized with URL parameters.

**Examples**:

* Basic Line Profile with Three Poles: [https://danmaps.github.io/GridScaper/?poles-distances=0,20,40&poles-heights=10,15,12&poles-elevations=0,5,2](https://danmaps.github.io/GridScaper/?poles-distances=0,20,40&poles-heights=10,15,12&poles-elevations=0,5,2)
* Valley Crossing: [https://danmaps.github.io/GridScaper/?poles-distances=0,25,50&poles-heights=20,25,20&poles-elevations=10,0,10](https://danmaps.github.io/GridScaper/?poles-distances=0,25,50&poles-heights=20,25,20&poles-elevations=10,0,10)
