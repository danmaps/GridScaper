# GridScaper

## Overview

GridScaper+ is a browser-based proof-of-concept for **interactive line siting**. It builds on the original GridScaper prototype with new features designed for rapid planning and stakeholder engagement—using **test data only**.

***

## ✅ What's New for Vibe‑A‑Thon

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

## Quickstart

```bash
# Clone and switch to vibeathon branch
git clone https://github.com/danmaps/GridScaper.git
cd GridScaper
git checkout vibeathon

# Install and run locally
npm install
npm run dev
```

Or open the **GitHub Pages demo**:  
`https://danmaps.github.io/GridScaper/?preset=Residential&env=Coastal`

***

## Demo Links

* **Residential / Coastal:**  
  `https://danmaps.github.io/GridScaper/?preset=Residential&env=Coastal`
* **Rural / Mountain:**  
  `https://danmaps.github.io/GridScaper/?preset=Rural&env=Mountain`
* **Desert / Transmission:**  
  `https://danmaps.github.io/GridScaper/?preset=Desert&env=Transmission`

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
* **Terrain Customization**: Select from different terrain types:
  * Flat
  * Rolling Hills
  * Hills + Trees (adds generic trees to the rolling hills terrain)
  * The terrain automatically adjusts to pole elevations when URL parameters are used.
* **Adjustable Line Tension**: Modify the tension of the power lines and observe the corresponding sag between poles.
* **Multiple Contexts & Environments**: Simulate various settings which influence building styles, density, and environmental elements:
  * **Settings (Contexts)**: Residential, Commercial, Urban, Rural
  * **Environments**: Coastal, Mountain, Desert, City
* **Diverse Equipment Types**: Represent different parts of the power grid, primarily affecting the appearance (color) of poles and crossarms:
  * Distribution
  * Sub Transmission
  * Bulk Transmission
  * Generation
* **Dynamic Scene Elements**: The application dynamically adds environmental elements based on selected settings:
  * **Buildings**: Type, density, and color of buildings change based on the selected "Setting" and "Environment".
  * **Vegetation**: Trees (generic, palm, pine, urban-style) are added depending on the "Environment" and "Terrain" settings. Cacti and tumbleweeds appear in the Desert environment.
  * **Water Features**: A coastal water body with animated waves and foam is added in the "Coastal" environment.
  * **Roads/Paths**: Basic roads or paths are added in certain environments.
  * **Birds**: Animated birds can appear and perch on power lines.
* **URL Parameterization**: Launch the simulation with predefined configurations for grid dimensions and pole setups.
* **Data Export**: Download the current scene configuration (poles, spans, terrain, tension) as a JSON file.
* **Visual Grid Overlay**: Toggle a visual grid on the terrain with coordinate labels that follow the terrain's contour.
* **Crossarm Orientation**: Crossarms on poles automatically orient themselves based on the direction of the connected power lines.

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
* **Download Scene Data**: Click the "Download" button.
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

## Contexts and Equipment

The simulation includes various settings (contexts) and equipment types that influence the visual appearance of the scene.

### Settings (Contexts)

The primary effect of changing the "Setting" is the type and density of buildings generated.

* **Residential**: Generates a higher number of smaller buildings, suggesting single-family homes. Pole equipment typically defaults to "Distribution."
* **Commercial**: Generates fewer, but larger buildings, suggesting commercial structures.
* **Urban**: Generates more densely packed buildings, some of which can be taller, suggesting an urban core.
* **Rural**: Generates very few buildings, suggesting open or agricultural areas. Birds may be visible on lines.

### Environments

The "Environment" selection changes the terrain color and adds specific environmental props:

* **Coastal**: Features a khaki terrain color, a water body with animated waves and foam, palm trees, a dock, and a basic road. Birds are typically white.
* **Mountain**: Features a dark green terrain color, pine trees, rocks, and a mountain path/road.
* **Desert**: Features a beige terrain color, saguaro cacti, tumbleweeds, and a desert road.
* **City**: Features a lighter green terrain color (suggesting manicured grass), urban-style trees with round canopies, a main road, and cross-streets.

### Equipment

The "Equipment" selection mainly changes the color of the poles and crossarms to visually suggest different types of power lines.

* **Distribution (~4kV–35kV)**: Poles are typically colored brown (suggesting wood).
* **Sub Transmission (~33kV–138kV)**: Poles are typically colored gray (suggesting steel).
* **Bulk Transmission (230kV+)**: Poles are typically colored silver/light gray (suggesting galvanized steel for larger structures). Users can create long spans with noticeable sag.
* **Generation**: Poles are colored gray (steel) with blue accented crossarms. This setting is a visual cue; specific generation facilities like solar panels or wind turbines are not automatically added.

## Usage Guide

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

## Scene Configuration

### Settings (Contexts)

The primary effect of changing the "Setting" is the type and density of buildings generated.

* **Residential**: Generates a higher number of smaller buildings, suggesting single-family homes. Pole equipment typically defaults to "Distribution."
* **Commercial**: Generates fewer, but larger buildings, suggesting commercial structures.
* **Urban**: Generates more densely packed buildings, some of which can be taller, suggesting an urban core.
* **Rural**: Generates very few buildings, suggesting open or agricultural areas. Birds may be visible on lines.

### Environments

The "Environment" selection changes the terrain color and adds specific environmental props:

* **Coastal**: Features a khaki terrain color, a water body with animated waves and foam, palm trees, a dock, and a basic road. Birds are typically white.
* **Mountain**: Features a dark green terrain color, pine trees, rocks, and a mountain path/road.
* **Desert**: Features a beige terrain color, saguaro cacti, tumbleweeds, and a desert road.
* **City**: Features a lighter green terrain color (suggesting manicured grass), urban-style trees with round canopies, a main road, and cross-streets.

### Equipment Types

The "Equipment" selection mainly changes the color of the poles and crossarms to visually suggest different types of power lines.

* **Distribution (~4kV–35kV)**: Poles are typically colored brown (suggesting wood).
* **Sub Transmission (~33kV–138kV)**: Poles are typically colored gray (suggesting steel).
* **Bulk Transmission (230kV+)**: Poles are typically colored silver/light gray (suggesting galvanized steel for larger structures). Users can create long spans with noticeable sag.
* **Generation**: Poles are colored gray (steel) with blue accented crossarms. This setting is a visual cue; specific generation facilities like solar panels or wind turbines are not automatically added.
