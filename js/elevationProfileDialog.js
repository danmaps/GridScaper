/**
 * Elevation Profile Import Dialog for GridScaper
 * 
 * Provides interface for importing elevation profile data from GIS exports
 * to create terrain surfaces for interactive pole placement.
 */

import { parseElevationProfile, createTerrainFromProfile, validateElevationProfile, generateSampleElevationProfile } from '../utils/elevationProfile.js';

/**
 * Shows the elevation profile import dialog
 * @param {Function} onImportComplete - Callback when import is successful
 * @param {Function} onCancel - Callback when import is cancelled
 */
export function showElevationProfileDialog(onImportComplete, onCancel = null) {
  // Create dialog overlay
  const overlay = document.createElement('div');
  overlay.className = 'elevation-import-overlay';
  overlay.innerHTML = `
    <div class="elevation-import-dialog">
      <div class="elevation-dialog-header">
        <h3>📈 Import Elevation Profile</h3>
        <button class="elevation-close-btn" type="button">&times;</button>
      </div>
      
      <div class="elevation-dialog-content">
        <div class="elevation-intro">
          <p>Import elevation profile data from GIS exports to create terrain surfaces for pole placement. Perfect for data from ArcGIS, QGIS, AutoCAD Civil 3D, or other surveying tools.</p>
        </div>

        <div class="elevation-import-section">
          <h4>📁 Select Data Source</h4>
          <div class="elevation-import-options">
            <label class="elevation-import-option">
              <input type="radio" name="elevation-source" value="file" checked>
              <span>Upload CSV File</span>
            </label>
            <label class="elevation-import-option">
              <input type="radio" name="elevation-source" value="paste">
              <span>Paste CSV Data</span>
            </label>
            <label class="elevation-import-option">
              <input type="radio" name="elevation-source" value="sample">
              <span>Use Sample Profile</span>
            </label>
          </div>
        </div>

        <!-- File Upload -->
        <div class="elevation-input-section" id="elevation-file-section">
          <div class="elevation-file-drop-zone" id="elevation-drop-zone">
            <div class="elevation-drop-icon">📊</div>
            <div class="elevation-drop-text">
              <p><strong>Drop elevation profile CSV here</strong> or click to browse</p>
              <p class="elevation-drop-hint">From ArcGIS, Civil 3D, QGIS, or other GIS tools</p>
            </div>
            <input type="file" id="elevation-file-input" accept=".csv,.txt" style="display: none;">
          </div>
        </div>

        <!-- Paste Data -->
        <div class="elevation-input-section" id="elevation-paste-section" style="display: none;">
          <textarea 
            id="elevation-paste-area" 
            placeholder="Paste elevation profile CSV data here...

Example format (from your SCE GeoView export):
X,Y,Distance (feet),Ground Elevation (feet)
-13039679.78,4033348.47,0,1920.57
-13039674.76,4033345.62,15.68,1908.57
-13039672.25,4033344.20,25.36,1911.85"
            rows="10"
          ></textarea>
        </div>

        <!-- Sample Data -->
        <div class="elevation-input-section" id="elevation-sample-section" style="display: none;">
          <div class="elevation-sample-preview">
            <p>📊 Using sample elevation profile data</p>
            <ul>
              <li>25 elevation points along a profile</li>
              <li>Distance range: 0 - 299 feet</li>
              <li>Elevation range: 1884 - 1920 feet</li>
              <li>Realistic terrain variations</li>
            </ul>
          </div>
        </div>

        <!-- Format Help -->
        <div class="elevation-format-help">
          <details>
            <summary>📋 Supported Profile Formats</summary>
            <div class="elevation-format-examples">
              <p><strong>Required:</strong> Elevation/Ground height column</p>
              <p><strong>Optional:</strong> X/Y coordinates, Distance along profile</p>
              
              <div class="elevation-format-example">
                <strong>ArcGIS Portal Export (like yours):</strong>
                <code>X,Y,Distance (feet),Ground Elevation (feet)
-13039679.78,4033348.47,0,1920.57
-13039674.76,4033345.62,15.68,1908.57</code>
              </div>
              
              <div class="elevation-format-example">
                <strong>Civil 3D Profile Export:</strong>
                <code>Station,Elevation
0+00,1920.57
0+15.68,1908.57</code>
              </div>
              
              <div class="elevation-format-example">
                <strong>Simple Distance-Elevation:</strong>
                <code>Distance,Elevation
0,1920.57
15.68,1908.57</code>
              </div>
            </div>
          </details>
        </div>

        <!-- Preview Section -->
        <div class="elevation-preview-section" id="elevation-preview" style="display: none;">
          <h4>🔍 Profile Preview</h4>
          <div class="elevation-preview-stats" id="elevation-preview-stats"></div>
          <div class="elevation-preview-chart" id="elevation-preview-chart">
            <canvas id="elevation-chart-canvas" width="400" height="150"></canvas>
          </div>
          <div class="elevation-preview-table-container">
            <table class="elevation-preview-table" id="elevation-preview-table"></table>
          </div>
        </div>

        <!-- Terrain Options -->
        <div class="elevation-options-section" id="elevation-options" style="display: none;">
          <h4>⚙️ Terrain Options</h4>
          <div class="elevation-options-grid">
            <label class="elevation-option-group">
              <span>Scene Width:</span>
              <select id="elevation-scene-width">
                <option value="100">100 feet</option>
                <option value="200" selected>200 feet</option>
                <option value="300">300 feet</option>
                <option value="500">500 feet</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            
            <label class="elevation-option-group">
              <span>Scene Depth:</span>
              <select id="elevation-scene-depth">
                <option value="50">50 feet</option>
                <option value="100" selected>100 feet</option>
                <option value="150">150 feet</option>
                <option value="200">200 feet</option>
              </select>
            </label>
            
            <label class="elevation-option-group">
              <span>Height Scale:</span>
              <select id="elevation-height-scale">
                <option value="0.5">0.5x (compressed)</option>
                <option value="1.0" selected>1.0x (natural)</option>
                <option value="1.5">1.5x (enhanced)</option>
                <option value="2.0">2.0x (exaggerated)</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            
            <div class="elevation-option-group" id="elevation-custom-width" style="display: none;">
              <span>Custom Width (ft):</span>
              <input type="number" id="elevation-width-value" value="200" min="50" max="2000" step="10">
            </div>
            
            <div class="elevation-option-group" id="elevation-custom-height" style="display: none;">
              <span>Custom Height Scale:</span>
              <input type="number" id="elevation-height-value" value="1.0" min="0.1" max="10" step="0.1">
            </div>
            
            <label class="elevation-option-group full-width">
              <input type="checkbox" id="elevation-center-profile" checked>
              <span>Center profile in scene</span>
            </label>
          </div>
        </div>

        <!-- Messages -->
        <div class="elevation-messages" id="elevation-messages"></div>
      </div>
      
      <div class="elevation-dialog-footer">
        <button class="elevation-btn elevation-btn-secondary" id="elevation-cancel-btn">Cancel</button>
        <button class="elevation-btn elevation-btn-primary" id="elevation-import-btn" disabled>Create Terrain Surface</button>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .elevation-import-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    }

    .elevation-import-dialog {
      background: #2a2a2a;
      color: #ffffff;
      border-radius: 12px;
      width: 90%;
      max-width: 800px;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
    }

    .elevation-dialog-header {
      padding: 20px;
      background: #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #444;
    }

    .elevation-dialog-header h3 {
      margin: 0;
      font-size: 18px;
      color: #73c2fb;
    }

    .elevation-close-btn {
      background: none;
      border: none;
      color: #ccc;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .elevation-close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .elevation-dialog-content {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .elevation-intro {
      background: rgba(115, 194, 251, 0.1);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 20px;
      font-size: 14px;
      line-height: 1.4;
    }

    .elevation-import-section,
    .elevation-input-section,
    .elevation-preview-section,
    .elevation-options-section {
      margin-bottom: 24px;
    }

    .elevation-import-section h4,
    .elevation-preview-section h4,
    .elevation-options-section h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #73c2fb;
      font-weight: 600;
    }

    .elevation-import-options {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .elevation-import-option {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 14px;
    }

    .elevation-file-drop-zone {
      border: 2px dashed #555;
      border-radius: 8px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .elevation-file-drop-zone:hover,
    .elevation-file-drop-zone.drag-over {
      border-color: #73c2fb;
      background: rgba(115, 194, 251, 0.05);
    }

    .elevation-drop-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .elevation-drop-hint {
      color: #aaa;
      font-size: 12px;
    }

    #elevation-paste-area {
      width: 100%;
      min-height: 200px;
      background: #1a1a1a;
      border: 1px solid #555;
      border-radius: 6px;
      color: white;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      resize: vertical;
    }

    .elevation-sample-preview {
      background: #333;
      border-radius: 6px;
      padding: 16px;
    }

    .elevation-format-help {
      margin-top: 16px;
    }

    .elevation-format-help details {
      background: #333;
      border-radius: 6px;
      overflow: hidden;
    }

    .elevation-format-help summary {
      padding: 12px 16px;
      cursor: pointer;
      font-weight: 500;
      background: rgba(115, 194, 251, 0.1);
    }

    .elevation-format-examples {
      padding: 16px;
    }

    .elevation-format-example {
      margin: 12px 0;
    }

    .elevation-format-example code {
      display: block;
      background: #1a1a1a;
      padding: 8px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      margin: 4px 0;
    }

    .elevation-preview-stats {
      background: #333;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 13px;
    }

    .elevation-preview-chart {
      background: #1a1a1a;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
      text-align: center;
    }

    #elevation-chart-canvas {
      max-width: 100%;
      height: auto;
      border: 1px solid #444;
      border-radius: 4px;
    }

    .elevation-preview-table-container {
      max-height: 150px;
      overflow-y: auto;
      border: 1px solid #444;
      border-radius: 6px;
    }

    .elevation-preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .elevation-preview-table th,
    .elevation-preview-table td {
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid #444;
    }

    .elevation-preview-table th {
      background: #333;
      font-weight: 600;
      position: sticky;
      top: 0;
    }

    .elevation-options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      align-items: start;
    }

    .elevation-option-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
    }

    .elevation-option-group.full-width {
      grid-column: 1 / -1;
      flex-direction: row;
      align-items: center;
    }

    .elevation-option-group span {
      font-weight: 500;
      color: #ddd;
    }

    .elevation-option-group select,
    .elevation-option-group input[type="number"] {
      background: #1a1a1a;
      border: 1px solid #555;
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 13px;
    }

    .elevation-messages {
      margin-top: 16px;
    }

    .elevation-message {
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .elevation-message.error {
      background: rgba(255, 69, 69, 0.1);
      border: 1px solid rgba(255, 69, 69, 0.3);
      color: #ff6b6b;
    }

    .elevation-message.warning {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      color: #ffc107;
    }

    .elevation-message.success {
      background: rgba(40, 167, 69, 0.1);
      border: 1px solid rgba(40, 167, 69, 0.3);
      color: #28a745;
    }

    .elevation-dialog-footer {
      padding: 20px;
      background: #333;
      border-top: 1px solid #444;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .elevation-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .elevation-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .elevation-btn-secondary {
      background: #555;
      color: white;
    }

    .elevation-btn-secondary:hover:not(:disabled) {
      background: #666;
    }

    .elevation-btn-primary {
      background: #73c2fb;
      color: #1a1a1a;
    }

    .elevation-btn-primary:hover:not(:disabled) {
      background: #85c8fc;
    }

    @media (max-width: 768px) {
      .elevation-import-dialog {
        width: 95%;
        max-height: 95vh;
      }
      
      .elevation-options-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(overlay);

  // State variables
  let currentData = null;
  let validationResult = null;

  // Get element references
  const sourceRadios = overlay.querySelectorAll('input[name="elevation-source"]');
  const fileSection = overlay.querySelector('#elevation-file-section');
  const pasteSection = overlay.querySelector('#elevation-paste-section');
  const sampleSection = overlay.querySelector('#elevation-sample-section');
  const dropZone = overlay.querySelector('#elevation-drop-zone');
  const fileInput = overlay.querySelector('#elevation-file-input');
  const pasteArea = overlay.querySelector('#elevation-paste-area');
  const previewSection = overlay.querySelector('#elevation-preview');
  const optionsSection = overlay.querySelector('#elevation-options');
  const messagesContainer = overlay.querySelector('#elevation-messages');
  const importBtn = overlay.querySelector('#elevation-import-btn');
  const cancelBtn = overlay.querySelector('#elevation-cancel-btn');
  const closeBtn = overlay.querySelector('.elevation-close-btn');
  const sceneWidthSelect = overlay.querySelector('#elevation-scene-width');
  const customWidthGroup = overlay.querySelector('#elevation-custom-width');
  const heightScaleSelect = overlay.querySelector('#elevation-height-scale');
  const customHeightGroup = overlay.querySelector('#elevation-custom-height');

  // Event handlers
  function showSection(activeSource) {
    fileSection.style.display = activeSource === 'file' ? 'block' : 'none';
    pasteSection.style.display = activeSource === 'paste' ? 'block' : 'none';
    sampleSection.style.display = activeSource === 'sample' ? 'block' : 'none';
    
    currentData = null;
    hidePreview();
    hideMessages();
    updateImportButton();
    
    if (activeSource === 'sample') {
      setTimeout(() => processData(generateSampleElevationProfile()), 100);
    }
  }

  function processData(csvContent) {
    currentData = null;
    hidePreview();
    hideMessages();
    
    if (!csvContent || csvContent.trim().length === 0) {
      showMessage('Please provide elevation profile data to process', 'warning');
      updateImportButton();
      return;
    }
    
    // Validate data
    validationResult = validateElevationProfile(csvContent);
    
    if (!validationResult.success) {
      validationResult.errors.forEach(error => showMessage(error, 'error'));
      updateImportButton();
      return;
    }
    
    // Show warnings
    validationResult.warnings.forEach(warning => showMessage(warning, 'warning'));
    
    try {
      // Parse data
      const profileData = parseElevationProfile(csvContent);
      
      currentData = {
        raw: csvContent,
        parsed: profileData
      };
      
      showPreview();
      showOptions();
      showMessage('✅ Elevation profile processed successfully!', 'success');
      
    } catch (error) {
      showMessage(`Processing error: ${error.message}`, 'error');
    }
    
    updateImportButton();
  }

  function showPreview() {
    if (!currentData) return;
    
    const { parsed } = currentData;
    const stats = overlay.querySelector('#elevation-preview-stats');
    const table = overlay.querySelector('#elevation-preview-table');
    const canvas = overlay.querySelector('#elevation-chart-canvas');
    
    // Show stats
    stats.innerHTML = `
      <strong>📊 Profile Summary:</strong>
      ${parsed.points.length} elevation points • 
      Range: ${parsed.stats.elevationRange.min.toFixed(1)} - ${parsed.stats.elevationRange.max.toFixed(1)} ft • 
      Span: ${parsed.stats.elevationRange.span.toFixed(1)} ft • 
      ${parsed.hasDistance ? `Distance: ${parsed.stats.distanceRange.span.toFixed(1)} ft` : 'No distance data'}
    `;
    
    // Draw simple elevation chart
    drawElevationChart(canvas, parsed.points);
    
    // Show table preview
    const previewPoints = parsed.points.slice(0, 8);
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          ${parsed.hasDistance ? '<th>Distance</th>' : ''}
          <th>Elevation</th>
          ${parsed.hasCoordinates ? '<th>X, Y</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${previewPoints.map((point, i) => `
          <tr>
            <td>${i + 1}</td>
            ${parsed.hasDistance ? `<td>${point.distance.toFixed(1)} ft</td>` : ''}
            <td>${point.elevation.toFixed(1)} ft</td>
            ${parsed.hasCoordinates && point.x !== null ? `<td>${point.x.toFixed(2)}, ${point.y.toFixed(2)}</td>` : ''}
          </tr>
        `).join('')}
        ${parsed.points.length > 8 ? `<tr><td colspan="4"><em>... and ${parsed.points.length - 8} more points</em></td></tr>` : ''}
      </tbody>
    `;
    
    previewSection.style.display = 'block';
  }

  function drawElevationChart(canvas, points) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    if (points.length < 2) return;
    
    // Find min/max values
    const elevations = points.map(p => p.elevation);
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    const elevSpan = maxElev - minElev;
    
    // Set up drawing
    ctx.strokeStyle = '#73c2fb';
    ctx.fillStyle = 'rgba(115, 194, 251, 0.2)';
    ctx.lineWidth = 2;
    
    // Draw elevation profile
    ctx.beginPath();
    points.forEach((point, i) => {
      const x = (i / (points.length - 1)) * (width - 20) + 10;
      const y = height - 20 - ((point.elevation - minElev) / elevSpan) * (height - 40);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Fill area under curve
    ctx.lineTo(width - 10, height - 20);
    ctx.lineTo(10, height - 20);
    ctx.closePath();
    ctx.fill();
    
    // Draw labels
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.fillText(`${minElev.toFixed(0)} ft`, 2, height - 5);
    ctx.fillText(`${maxElev.toFixed(0)} ft`, 2, 15);
  }

  function showOptions() {
    optionsSection.style.display = 'block';
  }

  function hidePreview() {
    previewSection.style.display = 'none';
  }

  function hideOptions() {
    optionsSection.style.display = 'none';
  }

  function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `elevation-message ${type}`;
    message.textContent = text;
    messagesContainer.appendChild(message);
  }

  function hideMessages() {
    messagesContainer.innerHTML = '';
  }

  function updateImportButton() {
    importBtn.disabled = !currentData;
  }

  function handleImport() {
    if (!currentData) return;
    
    try {
      // Get options
      const sceneWidthValue = sceneWidthSelect.value === 'custom' ? 
        parseInt(overlay.querySelector('#elevation-width-value').value) : 
        parseInt(sceneWidthSelect.value);
      
      const sceneDepth = parseInt(overlay.querySelector('#elevation-scene-depth').value);
      
      const heightScaleValue = heightScaleSelect.value === 'custom' ?
        parseFloat(overlay.querySelector('#elevation-height-value').value) :
        parseFloat(heightScaleSelect.value);
      
      const centerProfile = overlay.querySelector('#elevation-center-profile').checked;
      
      // Create terrain
      const terrainData = createTerrainFromProfile(currentData.parsed, {
        sceneWidth: sceneWidthValue,
        sceneDepth,
        heightScale: heightScaleValue,
        centerProfile,
        surfaceResolution: 1
      });
      
      // Create THREE.js mesh for the terrain
      const THREE = window.THREE;
      const { bounds, elevationFunction } = terrainData;
      const segments = 50;
      
      const terrainWidth = bounds.x.max - bounds.x.min;
      const terrainDepth = bounds.z.max - bounds.z.min;
      
      const geometry = new THREE.PlaneGeometry(
        terrainWidth,
        terrainDepth,
        segments,
        segments
      );
      
      // Apply elevation to vertices with proper normalization
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getY(i); // Note: PlaneGeometry uses Y for what we think of as Z
        const normalizedY = elevationFunction(x, z); // This should return normalized elevation (min = 0)
        positions.setZ(i, normalizedY); // Set Z as elevation (Y in our world coordinates)
      }
      
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      
      // Create terrain material
      const material = new THREE.MeshLambertMaterial({
        color: 0x4a5d23,
        wireframe: false,
        transparent: true,
        opacity: 0.8
      });
      
      const surfaceMesh = new THREE.Mesh(geometry, material);
      surfaceMesh.rotation.x = -Math.PI / 2; // Rotate to lay flat (XZ plane)
      surfaceMesh.position.y = 0; // Ensure terrain sits at ground level
      surfaceMesh.userData.elevationProfile = true;
      
      const importData = {
        terrainData: {
          terrain: terrainData,
          surfaceMesh: surfaceMesh
        },
        elevationFunction: terrainData.elevationFunction,
        metadata: {
          type: 'elevationProfile',
          originalData: currentData.raw,
          points: currentData.parsed.points.length,
          elevationRange: currentData.parsed.stats.elevationRange,
          profileLength: terrainData.metadata.profileLength,
          sceneWidth: sceneWidthValue,
          sceneDepth,
          ...terrainData.metadata,
          importOptions: {
            sceneWidth: sceneWidthValue,
            sceneDepth,
            heightScale: heightScaleValue,
            centerProfile
          }
        }
      };
      
      closeDialog();
      
      if (onImportComplete) {
        onImportComplete(importData);
      }
      
    } catch (error) {
      showMessage(`Import error: ${error.message}`, 'error');
    }
  }

  function closeDialog() {
    document.head.removeChild(style);
    document.body.removeChild(overlay);
  }

  function handleCancel() {
    closeDialog();
    if (onCancel) onCancel();
  }

  // Event listeners
  sourceRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      showSection(e.target.value);
    });
  });

  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  function handleFileSelect(file) {
    if (!file.type.includes('text') && !file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      showMessage('Please select a CSV or text file', 'error');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      showMessage('File size too large. Please select a file smaller than 10MB.', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => processData(e.target.result);
    reader.onerror = () => showMessage('Error reading file', 'error');
    reader.readAsText(file);
  }

  pasteArea.addEventListener('input', () => {
    const content = pasteArea.value.trim();
    if (content.length > 0) {
      clearTimeout(pasteArea.timeout);
      pasteArea.timeout = setTimeout(() => processData(content), 500);
    }
  });

  sceneWidthSelect.addEventListener('change', () => {
    customWidthGroup.style.display = sceneWidthSelect.value === 'custom' ? 'block' : 'none';
  });

  heightScaleSelect.addEventListener('change', () => {
    customHeightGroup.style.display = heightScaleSelect.value === 'custom' ? 'block' : 'none';
  });

  importBtn.addEventListener('click', handleImport);
  cancelBtn.addEventListener('click', handleCancel);
  closeBtn.addEventListener('click', handleCancel);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      handleCancel();
    }
  });

  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', escapeHandler);
      handleCancel();
    }
  });

  // Initialize
  showSection('file');
}