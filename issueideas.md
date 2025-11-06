**ready‑to‑paste backlog** for a `vibeathon` branch that turns GridScaper into a competition‑ready POC. I grouped issues by milestone/epic and wrote them in a GitHub‑friendly format (title + body) with clear **goals, acceptance criteria, and tasks**. Where relevant, I referenced existing repo artifacts (URL params, scene export, environments/contexts) so you can wire things up quickly. [\[github.com\]](https://github.com/danmaps/gridscaper), [\[danmaps.github.io\]](https://danmaps.github.io/GridScaper/?poles-distances=0,25,50&poles-heights=20,25,20&poles-elevations=10,0,10), [\[github.com\]](https://github.com/danmaps/GridScaper/blob/main/GridScaper_Contexts_and_Equipment.md)

> **How to use:** Create three milestones—**AI Clearance Coach**, **Share & Import**, **Cost/Risk**—then paste each issue below into GitHub. Apply labels like `feat`, `ui`, `perf`, `docs`, `tech-debt`, `good first issue`.

***

## Milestone: AI Clearance Coach

### 1) **feat: Safety clearance rule engine (client-side)**

**Body**

```md
**Goal**
Add a lightweight, client-side rule engine to evaluate clearances between conductors/poles and nearby objects in the scene.

**Context**
GridScaper already models poles, spans, and sag, with environment/setting presets. We'll add simulated (test-only) rules (e.g., min distance to structures/vegetation) and return PASS/WARN/FAIL.

**Acceptance Criteria**
- A `/rules/clearances.json` file defines rules by voltage class (e.g., Distribution/Sub/Transmission) and environment modifiers (e.g., Desert, Coastal).
- A pure JS module evaluates current scene against rules and returns a per-span & per-pole status.
- Unit tests cover at least the core rule combinations.

**Tasks**
- [ ] Create `rules/clearances.json` (test data only).
- [ ] Implement `utils/ruleEngine.ts` with evaluation functions.
- [ ] Wire to scene graph (poles, spans, environment).
- [ ] Add basic unit tests.

**Labels:** feat, core, safety
**Milestone:** AI Clearance Coach
```

### 2) **feat: Clearance visualization overlays (buffers + status)**

```md
**Goal**
Visualize safety results in-scene: colored buffers and label chips (OK/Warn/Fail) for each span and near-pole objects.

**Acceptance Criteria**
- Toggle: "Clearance Coach" shows/hides overlay.
- Buffers around conductors/poles change color (green/yellow/red).
- Tooltip shows rule key that failed (e.g., "Span clearance to structure < X ft").

**Tasks**
- [ ] Add UI toggle in right/left panel.
- [ ] Draw dynamic buffer meshes or lines that follow current sag.
- [ ] Implement status badges with minimal CSS.
- [ ] Performance check on low settings.

**Labels:** feat, ui
**Milestone:** AI Clearance Coach
```

### 3) **feat: Simplified catenary API from existing sag calc**

```md
**Goal**
Expose a simple function `getConductorCurve(span): Vec3[]` that returns points along the current catenary/sag for evaluation and rendering.

**Acceptance Criteria**
- Given pole A/B positions, height, and tension/sag factor, return a polyline suitable for collision checks.
- Works with existing sag controls.

**Tasks**
- [ ] Refactor sag math into `utils/catenary.ts`.
- [ ] Add JSDoc + example usage.

**Labels:** feat, core
**Milestone:** AI Clearance Coach
```

### 4) **feat: Object classification for clearance checks**

```md
**Goal**
Tag generated scene objects (buildings, trees, water, roads, birds-perch) with types and bounding volumes for rule evaluation.

**Acceptance Criteria**
- All dynamic scene elements (from Setting/Environment presets) have metadata: {type, aabb/sphere, height}.
- API: `scene.query({ type: 'building' | 'tree' | 'road' })`.

**Tasks**
- [ ] Extend environment/setting generators with metadata tags.
- [ ] Provide `utils/spatialIndex.ts` for quick queries.

**Labels:** feat, core
**Milestone:** AI Clearance Coach
```

### 5) **ui: Clearance details panel**

```md
**Goal**
Provide a docked panel listing spans/poles with current PASS/WARN/FAIL and suggested fixes (e.g., "Raise pole by 5 ft" or "Shift pole 3 ft").

**Acceptance Criteria**
- Sort by severity (Fail > Warn > Pass).
- Clicking a row highlights the span/pole in-scene.
- Export a short text summary.

**Tasks**
- [ ] Build panel UI.
- [ ] Hook into rule engine.
- [ ] Implement "Copy summary" button.

**Labels:** ui, feat
**Milestone:** AI Clearance Coach
```

***

## Milestone: Share & Import

### 6) **feat: Import scene from JSON (complement to existing export)**

```md
**Goal**
Allow users to import a previously downloaded scene JSON and rehydrate poles/spans/terrain/tension.

**Context**
GridScaper already supports JSON export and URL parameterization. This adds the complementary Import flow.

**Acceptance Criteria**
- "Import Scene" button opens file picker.
- Successful import replaces current scene.
- Validation with friendly error messages.

**Tasks**
- [ ] Implement `importScene(json)` with schema validation.
- [ ] Add UI button + drag-and-drop support.
- [ ] Update README with example workflow.

**Labels:** feat, io
**Milestone:** Share & Import
```

 [\[github.com\]](https://github.com/danmaps/gridscaper)

### 7) **feat: Copy scenario link (URL parameter builder)**

```md
**Goal**
Provide a "Copy Link" that assembles current state into URL parameters for quick sharing.

**Acceptance Criteria**
- Clicking "Copy Link" writes a full URL to clipboard.
- URL reproduces poles, heights, elevations, tension, terrain, and environment/setting/equipment choices.
- Links under 2,000 chars when possible (document if larger).

**Tasks**
- [ ] Serialize current scene to compact query params (use existing approach).
- [ ] Add snackbar/toast confirmation.

**Labels:** feat, share
**Milestone:** Share & Import
```

 [\[danmaps.github.io\]](https://danmaps.github.io/GridScaper/?poles-distances=0,25,50&poles-heights=20,25,20&poles-elevations=10,0,10)

### 8) **feat: Scenario comparer (A/B switcher)**

```md
**Goal**
Load two saved scenes and quickly flip A/B with a hotkey to visualize differences.

**Acceptance Criteria**
- Two slots: Scenario A and Scenario B.
- Hotkey `Tab` toggles A<->B; UI shows diff highlights (poles added/removed/height deltas).
- Works with Import or URL-based scenes.

**Tasks**
- [ ] Implement A/B slots.
- [ ] Compute diffs (counts, pole location deltas, span changes).
- [ ] Simple highlight shader or outline.

**Labels:** feat, ui
**Milestone:** Share & Import
```

### 9) **docs: README “Vibe‑A‑Thon” quickstart + demo links**

```md
**Goal**
Add a dedicated section to README with 60‑second quickstart, feature bullets, and parameterized demo URLs.

**Acceptance Criteria**
- Section includes: run locally, open GitHub Pages demo, Import/Export/Copy Link steps.
- At least 3 preset demo URLs: (1) Residential/Coastal, (2) Rural/Mountain, (3) Desert/Transmission.

**Tasks**
- [ ] Author new README section.
- [ ] Add animated GIFs/screenshots.
- [ ] Link to Pages site.

**Labels:** docs
**Milestone:** Share & Import
```

 [\[github.com\]](https://github.com/danmaps/GridScaper/blob/main/README.md), [\[danmaps.github.io\]](https://danmaps.github.io/GridScaper/?poles-distances=0,25,50&poles-heights=20,25,20&poles-elevations=10,0,10)

### 10) **ops: Enable GitHub Pages build check (CI)**

```md
**Goal**
Ensure Pages deployment is healthy (even if minimal), with a status badge in README.

**Acceptance Criteria**
- Minimal CI workflow that builds static site (if applicable) or validates bundle.
- Badge appears in README.
- Fails on missing assets.

**Tasks**
- [ ] Add `.github/workflows/pages.yml`.
- [ ] Document how to trigger after pushes.

**Labels:** ops, ci, docs
**Milestone:** Share & Import
```

 [\[github.com\]](https://github.com/danmaps/GridScaper/actions/workflows/pages/)

***

## Milestone: Cost/Risk

### 11) **feat: Toy cost model (unit rates + terrain factors)**

```md
**Goal**
Display a running cost and duration estimate from test rates based on pole count/height, terrain, access difficulty, and environment multipliers.

**Acceptance Criteria**
- `rates.json` defines base units and multipliers.
- Cost panel shows totals and per-factor breakdown.
- Switching terrain/setting updates totals instantly.

**Tasks**
- [ ] Create `rules/rates.json` (test data only).
- [ ] Implement `utils/costModel.ts`.
- [ ] UI panel + delta view (before/after).

**Labels:** feat, business-value
**Milestone:** Cost/Risk
```

### 12) **feat: Wildfire risk overlay (procedural heatmap)**

```md
**Goal**
Add a simulated hazard heatmap that increases required clearance and cost multipliers in "HD zones."

**Acceptance Criteria**
- Toggle: "Wildfire Risk" paints the terrain with a gradient.
- Rule engine reads a "risk" value per span for stricter clearances.
- Cost model applies a multiplier when risk > threshold.

**Tasks**
- [ ] Procedurally generate risk grid/texture.
- [ ] Integrate with rule engine and cost model.

**Labels:** feat, risk, visuals
**Milestone:** Cost/Risk
```

### 13) **feat: Stakeholder (Guided) mode**

```md
**Goal**
Present a simplified, read-only walkthrough (Current → Option A → Option B) with captions to explain tradeoffs.

**Acceptance Criteria**
- Toggle "Stakeholder Mode" hides advanced controls.
- Stepper with 3 frames and caption text.
- Export share link that launches directly into this mode.

**Tasks**
- [ ] UI mode flag in URL params.
- [ ] Caption JSON + renderer.
- [ ] Minimal theming for clarity.

**Labels:** ui, storytelling
**Milestone:** Cost/Risk
```

***

## Cross‑cutting Improvements

### 14) **perf: Low‑fidelity visual preset (“Lite Mode”)**

```md
**Goal**
Improve performance on modest laptops by reducing render complexity.

**Acceptance Criteria**
- Preset disables shadows, reduces tree/building counts, and simplifies line meshes.
- Toggle persists across reload (URL param).

**Tasks**
- [ ] Implement preset.
- [ ] Quick FPS sanity check.

**Labels:** perf, ux
```

 [\[github.com\]](https://github.com/danmaps/gridscaper)

### 15) **ui: Keyboard & mouse help overlay**

```md
**Goal**
Add an in-app shortcut sheet (add pole, delete pole, drag, A/B compare, toggle overlays).

**Acceptance Criteria**
- `?` hotkey opens overlay.
- Matches actual bindings.
- Link to README.

**Tasks**
- [ ] Build overlay component.
- [ ] Keep bindings centralized.

**Labels:** ui, docs
```

### 16) **tech-debt: Scene schema definition**

```md
**Goal**
Define a versioned JSON schema for exported/imported scenes.

**Acceptance Criteria**
- `schema/scene.schema.json` with required/optional fields.
- Validation errors are user-friendly.

**Tasks**
- [ ] Add schema + validator.
- [ ] Include schema version in exports.

**Labels:** tech-debt, io
```

### 17) **tests: Minimal unit tests for rules/cost/catenary**

```md
**Goal**
Establish a small test harness for critical functions.

**Acceptance Criteria**
- Tests for rule evaluation, cost math, catenary sample points.
- Runs in CI.

**Tasks**
- [ ] Add test framework setup.
- [ ] Write 6–8 core tests.

**Labels:** tests, ci
```

### 18) **docs: RULES.md (simulated clearances)**

```md
**Goal**
Document that all rules and data are simulated/test-only per event policy.

**Acceptance Criteria**
- CLEAR disclaimer that no production data is used.
- Table summarizing classes and example clearances.

**Tasks**
- [ ] Author `RULES.md`.
- [ ] Link from README and in-app “i” icon.

**Labels:** docs, compliance
```

### 19) **accessibility: High-contrast mode & colorblind-safe status**

```md
**Goal**
Ensure clearance statuses (green/yellow/red) are legible for colorblind users.

**Acceptance Criteria**
- Add shapes/patterns or icons to differentiate states.
- High-contrast toggle.

**Tasks**
- [ ] Update CSS tokens.
- [ ] Verify tooltips with text labels.

**Labels:** accessibility, ui
```

### 20) **polish: Screenshot/GIF capture**

```md
**Goal**
One-click capture of the canvas for slide decks and README.

**Acceptance Criteria**
- "Capture" button downloads a PNG (and optional short GIF if feasible).
- Works in Lite Mode.

**Tasks**
- [ ] Canvas to blob.
- [ ] Simple spinner + file name stamp.

**Labels:** polish, ux
```

***

## Optional “Nice to Have”

### 21) **feat: Pole snapping & alignment guides**

```md
**Goal**
Show guides to align new poles along a bearing, with snap increments.

**Labels:** ui, feat
```

### 22) **feat: Undo/redo history**

```md
**Goal**
Add CTRL+Z / CTRL+Y for pole add/remove/move and parameter changes.

**Labels:** ux, feat
```

***

## Milestone mapping (recommended)

*   **AI Clearance Coach:** Issues 1–5
*   **Share & Import:** Issues 6–10
*   **Cost/Risk:** Issues 11–13
*   **Cross‑cutting:** Issues 14–20
*   **Optional:** Issues 21–22

***

