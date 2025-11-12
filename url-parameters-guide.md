# GridScaper URL Parameters Guide

GridScaper supports several URL parameters that allow you to customize the simulation without modifying the code. This guide explains the available parameters and how to use them.

## Available Parameters

### Grid Dimensions
- `size-x`: Width of the grid in units
- `size-y`: Depth of the grid in units

### Pole Configuration
- `elevation`: **New simplified parameter** - Comma-separated list of ground elevations for terrain profile only (creates terrain, does NOT place poles)
- `width`: Terrain width in feet (default: 20). Works with the `elevation` parameter to control terrain dimensions
- `poles-distances`: (Legacy) Comma-separated list of distances along the Z-axis for poles
- `poles-heights`: (Legacy) Comma-separated list of heights for each pole
- `poles-elevations`: (Legacy) Comma-separated list of ground elevations at each pole

## Usage

Parameters are added to the URL after a question mark (`?`), with multiple parameters separated by an ampersand (`&`).

```
GridScaper.html?parameter1=value1&parameter2=value2
```

## Examples

### Example 1: Custom Grid Size

Create a 200×150 unit grid:

```
?size-x=200&size-y=150
```

### Example 2: Rolling Hills (Simplified Format)

Create a challenging rolling hills terrain with 15 elevation points spaced every 10 feet:

```
?elevation=0,10,0,20,10,5,0,5,10,20,30,20,10,5,0
```

This creates a terrain profile from z=0 to z=140 with varying ground elevations. **No poles are placed** - you can add them interactively after the terrain loads.

### Example 2a: Rolling Hills with Custom Width

Create the same terrain but with a wider (40 ft) surface:

```
?elevation=0,10,0,20,10,5,0,5,10,20,30,20,10,5,0&width=40
```

### Example 3: Basic Line Profile with Three Poles (Legacy Format)

Create a line with poles at z=0, z=20 and z=40, with varying heights and elevations:

```
?poles-distances=0,20,40&poles-heights=10,15,12&poles-elevations=0,5,2
```

### Example 4: Deep Valley Crossing (Legacy Format)

Simulate a power line crossing a deep valley:

```
?poles-distances=0,50,100&poles-heights=30,50,30&poles-elevations=20,-30,20
```

### Example 5: Steep Hill Crossing (Legacy Format)

Simulate a power line crossing a steep hill:

```
?poles-distances=0,40,80&poles-heights=40,20,40&poles-elevations=0,50,0
```

### Example 6: Combined Parameters

Customize both grid size and pole placement:

```
?size-x=100&size-y=100&poles-distances=0,30,60,90&poles-heights=15,20,20,15&poles-elevations=0,5,5,0
```

## Important Notes

1. **Simplified `elevation` parameter**: Just provide comma-separated elevations to create a terrain profile. Points are spaced every 10 feet. **No poles are placed** - this only creates the terrain surface. Add poles interactively after loading.

2. **Legacy parameters**: All three pole parameters (`poles-distances`, `poles-heights`, and `poles-elevations`) must be provided together and have the same number of values. These parameters DO place poles along with the terrain.

3. The simplified `elevation` parameter takes precedence over legacy parameters if both are present.

4. When pole parameters are provided, the grid width will automatically be set to 50 units unless explicitly specified with `size-x`.

5. Poles are positioned along the Z-axis (lengthwise along the terrain strip) rather than across it.

6. Distances are in arbitrary units, heights are in feet, and elevations are relative to zero.

7. The terrain will automatically adjust to match the provided elevations, creating a smooth sloped surface through all pole locations.

8. You can still interact with the simulation after it's initialized with URL parameters - add poles, adjust tension, etc.
