### [Feature] Replace Hardcoded Tower Geometry With glTF/GLB Model

**Summary**

The current tower geometry is procedurally created and hardcoded in JavaScript. This limits visual quality, modularity, and future flexibility. We should migrate to using an external 3D model format so towers can be designed, iterated, and styled properly outside the codebase.

**Why This Matters**
• Improves visual fidelity for both puzzle mode and homepage mode
• Allows custom-designed lattice towers, crossarms, and attachment points
• Enables consistent tower variants (standard, corner, high elevation, double circuit)
• Simplifies future refactors to catenary anchoring, node logic, and 2.5D rendering
• Reduces code noise and complexity in rendering setup
• Unlocks potential for LOD, custom materials, and stylized looks

**Proposed Format: glTF / GLB**

glTF (especially .glb) is the recommended modern format for web-based 3D workflows.

Advantages:
- Native support in Three.js via GLTFLoader
- Compact binary format with clean material support
- Supports named nodes for conductor attachment points
- Reliable hierarchy preservation (useful for pole nodes, crossarms, etc.)
- Easy to clone instances without re-loading
- Wide tooling support (Blender, exporters, compression tools)

**Proposed Workflow**
1. Create a modular tower model in Blender
2. Define clear sub-object names for:
    - root
    - crossarms
    - attachment points for span anchors
    - any future components
3. Export as .glb with transforms applied
4. Load model once at init
5. Clone for each pole instance and position based on terrain
6. Update pole rendering code to use the model instead of procedural geometry

**Acceptance Criteria**
- Tower models are no longer created via raw Three.js geometry in code
- A .glb tower model is loaded through GLTFLoader
- Tower instances clone the imported mesh
- Conductor spans correctly anchor to named attachment nodes
- Visual output matches or exceeds current clarity in both 2.5D and 3D views
- Performance remains within 60fps desktop / 30fps mobile goals

**Future Extensions**
- Multiple tower variants in a single GLB
- LOD for distant towers
- Stylized or blueprint-inspired material sets
- Possible AI-generated decorative textures.