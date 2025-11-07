/**
 * GIS Import Dialog Component for GridScaper
 * 
 * Provides a user interface for importing GIS data from CSV files
 * with real-world lat/long coordinates and elevation data.
 */

import { parseGISData, convertToSceneCoordinates, createElevationSurface, validateGISData, generateSampleGISData } from '../utils/gisImport.js';

/**
 * Creates and shows the GIS import dialog
 * @param {Function} onImportComplete - Callback function when import is successful
 * @param {Function} onCancel - Callback function when import is cancelled
 */
export function showGISImportDialog(onImportComplete, onCancel = null) {
  // Create dialog overlay
  const overlay = document.createElement('div');
  overlay.className = 'gis-import-overlay';
  overlay.innerHTML = `
    <div class="gis-import-dialog">
      <div class="gis-dialog-header">
        <h3>🗺️ Import Real GIS Data</h3>
        <button class="gis-close-btn" type="button">&times;</button>
      </div>
      
      <div class="gis-dialog-content">
        <div class="gis-import-section">
          <h4>📁 Select Data Source</h4>
          <div class="gis-import-options">
            <label class="gis-import-option">
              <input type="radio" name="gis-source" value="file" checked>
              <span>Upload CSV File</span>
            </label>
            <label class="gis-import-option">
              <input type="radio" name="gis-source" value="paste">
              <span>Paste CSV Data</span>
            </label>
            <label class="gis-import-option">
              <input type="radio" name="gis-source" value="sample">
              <span>Use Sample Data</span>
            </label>
          </div>
        </div>

        <!-- File Upload -->
        <div class="gis-input-section" id="gis-file-section">
          <div class="gis-file-drop-zone" id="gis-drop-zone">
            <div class="gis-drop-icon">📄</div>
            <div class="gis-drop-text">
              <p><strong>Drop CSV file here</strong> or click to browse</p>
              <p class="gis-drop-hint">Supported formats: .csv, .txt</p>
            </div>
            <input type="file" id="gis-file-input" accept=".csv,.txt" style="display: none;">
          </div>
        </div>

        <!-- Paste Data -->
        <div class="gis-input-section" id="gis-paste-section" style="display: none;">
          <textarea 
            id="gis-paste-area" 
            placeholder="Paste CSV data here (with headers)...

Example format:
lat,lng,elevation,pole_height,pole_id
33.937721,-116.527342,1050,25,POLE_001
33.937721,-116.527322,1048,25,POLE_002"
            rows="8"
          ></textarea>
        </div>

        <!-- Sample Data -->
        <div class="gis-input-section" id="gis-sample-section" style="display: none;">
          <div class="gis-sample-preview">
            <p>📋 Using sample data from California desert region</p>
            <ul>
              <li>8 pole locations with real coordinates</li>
              <li>Elevation range: 1040-1050 feet</li>
              <li>Mixed pole heights: 20-30 feet</li>
            </ul>
          </div>
        </div>

        <!-- Format Help -->
        <div class="gis-format-help">
          <details>
            <summary>📋 Supported CSV Formats</summary>
            <div class="gis-format-examples">
              <p><strong>Required columns:</strong> latitude, longitude, elevation</p>
              <p><strong>Optional columns:</strong> pole_height, pole_id/name</p>
              
              <div class="gis-format-example">
                <strong>Format 1 - With Headers:</strong>
                <code>lat,lng,elevation,pole_height,pole_id
33.937,-116.527,1050,25,POLE_001</code>
              </div>
              
              <div class="gis-format-example">
                <strong>Format 2 - No Headers:</strong>
                <code>33.937,-116.527,1050,25</code>
                <small>(lat, lng, elevation, height)</small>
              </div>
              
              <div class="gis-format-example">
                <strong>Format 3 - Minimal:</strong>
                <code>33.937,-116.527,1050</code>
                <small>(lat, lng, elevation only)</small>
              </div>
            </div>
          </details>
        </div>

        <!-- Preview Section -->
        <div class="gis-preview-section" id="gis-preview" style="display: none;">
          <h4>🔍 Data Preview</h4>
          <div class="gis-preview-stats" id="gis-preview-stats"></div>
          <div class="gis-preview-table-container">
            <table class="gis-preview-table" id="gis-preview-table"></table>
          </div>
        </div>

        <!-- Import Options -->
        <div class="gis-options-section" id="gis-options" style="display: none;">
          <h4>⚙️ Import Options</h4>
          <div class="gis-options-grid">
            <label class="gis-option-group">
              <span>Scene Scaling:</span>
              <select id="gis-scale-option">
                <option value="auto">Auto-fit to scene</option>
                <option value="preserve">Preserve real distances</option>
                <option value="custom">Custom scale factor</option>
              </select>
            </label>
            
            <label class="gis-option-group">
              <span>Terrain Method:</span>
              <select id="gis-terrain-method">
                <option value="linear">Linear interpolation</option>
                <option value="idw">Distance weighting</option>
              </select>
            </label>
            
            <label class="gis-option-group">
              <span>Coordinate Origin:</span>
              <select id="gis-origin-option">
                <option value="center">Center at origin</option>
                <option value="first">Start from first pole</option>
              </select>
            </label>
            
            <div class="gis-option-group" id="gis-custom-scale" style="display: none;">
              <span>Scale Factor:</span>
              <input type="number" id="gis-scale-factor" value="1.0" min="0.1" max="10" step="0.1">
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div class="gis-messages" id="gis-messages"></div>
      </div>
      
      <div class="gis-dialog-footer">
        <button class="gis-btn gis-btn-secondary" id="gis-cancel-btn">Cancel</button>
        <button class="gis-btn gis-btn-primary" id="gis-import-btn" disabled>Import Scene</button>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .gis-import-overlay {
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

    .gis-import-dialog {
      background: #2a2a2a;
      color: #ffffff;
      border-radius: 12px;
      width: 90%;
      max-width: 700px;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
    }

    .gis-dialog-header {
      padding: 20px;
      background: #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #444;
    }

    .gis-dialog-header h3 {
      margin: 0;
      font-size: 18px;
      color: #73c2fb;
    }

    .gis-close-btn {
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

    .gis-close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .gis-dialog-content {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .gis-import-section,
    .gis-input-section,
    .gis-preview-section,
    .gis-options-section {
      margin-bottom: 24px;
    }

    .gis-import-section h4,
    .gis-preview-section h4,
    .gis-options-section h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #73c2fb;
      font-weight: 600;
    }

    .gis-import-options {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .gis-import-option {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 14px;
    }

    .gis-import-option input[type="radio"] {
      margin: 0;
    }

    .gis-file-drop-zone {
      border: 2px dashed #555;
      border-radius: 8px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }

    .gis-file-drop-zone:hover,
    .gis-file-drop-zone.drag-over {
      border-color: #73c2fb;
      background: rgba(115, 194, 251, 0.05);
    }

    .gis-drop-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .gis-drop-text p {
      margin: 0 0 4px 0;
    }

    .gis-drop-hint {
      color: #aaa;
      font-size: 12px;
    }

    #gis-paste-area {
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

    #gis-paste-area:focus {
      border-color: #73c2fb;
      outline: none;
    }

    .gis-sample-preview {
      background: #333;
      border-radius: 6px;
      padding: 16px;
    }

    .gis-sample-preview ul {
      margin: 12px 0 0 0;
      padding-left: 20px;
    }

    .gis-sample-preview li {
      margin: 4px 0;
      font-size: 14px;
    }

    .gis-format-help {
      margin-top: 16px;
    }

    .gis-format-help details {
      background: #333;
      border-radius: 6px;
      overflow: hidden;
    }

    .gis-format-help summary {
      padding: 12px 16px;
      cursor: pointer;
      font-weight: 500;
      background: rgba(115, 194, 251, 0.1);
    }

    .gis-format-help summary:hover {
      background: rgba(115, 194, 251, 0.15);
    }

    .gis-format-examples {
      padding: 16px;
    }

    .gis-format-example {
      margin: 12px 0;
    }

    .gis-format-example code {
      display: block;
      background: #1a1a1a;
      padding: 8px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      margin: 4px 0;
    }

    .gis-format-example small {
      color: #aaa;
      display: block;
      margin-top: 4px;
    }

    .gis-preview-stats {
      background: #333;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 13px;
    }

    .gis-preview-table-container {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #444;
      border-radius: 6px;
    }

    .gis-preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .gis-preview-table th,
    .gis-preview-table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #444;
    }

    .gis-preview-table th {
      background: #333;
      font-weight: 600;
      position: sticky;
      top: 0;
    }

    .gis-preview-table tr:hover {
      background: rgba(115, 194, 251, 0.05);
    }

    .gis-options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: start;
    }

    .gis-option-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
    }

    .gis-option-group span {
      font-weight: 500;
      color: #ddd;
    }

    .gis-option-group select,
    .gis-option-group input {
      background: #1a1a1a;
      border: 1px solid #555;
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 13px;
    }

    .gis-option-group select:focus,
    .gis-option-group input:focus {
      border-color: #73c2fb;
      outline: none;
    }

    .gis-messages {
      margin-top: 16px;
    }

    .gis-message {
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .gis-message.error {
      background: rgba(255, 69, 69, 0.1);
      border: 1px solid rgba(255, 69, 69, 0.3);
      color: #ff6b6b;
    }

    .gis-message.warning {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      color: #ffc107;
    }

    .gis-message.success {
      background: rgba(40, 167, 69, 0.1);
      border: 1px solid rgba(40, 167, 69, 0.3);
      color: #28a745;
    }

    .gis-dialog-footer {
      padding: 20px;
      background: #333;
      border-top: 1px solid #444;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .gis-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .gis-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .gis-btn-secondary {
      background: #555;
      color: white;
    }

    .gis-btn-secondary:hover:not(:disabled) {
      background: #666;
    }

    .gis-btn-primary {
      background: #73c2fb;
      color: #1a1a1a;
    }

    .gis-btn-primary:hover:not(:disabled) {
      background: #85c8fc;
    }

    @media (max-width: 600px) {
      .gis-import-dialog {
        width: 95%;
        max-height: 95vh;
      }
      
      .gis-options-grid {
        grid-template-columns: 1fr;
      }
      
      .gis-import-options {
        flex-direction: column;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(overlay);

  // State variables
  let currentData = null;
  let validationResult = null;

  // Get references to elements
  const sourceRadios = overlay.querySelectorAll('input[name="gis-source"]');
  const fileSection = overlay.getElementById('gis-file-section');
  const pasteSection = overlay.getElementById('gis-paste-section');
  const sampleSection = overlay.getElementById('gis-sample-section');
  const dropZone = overlay.getElementById('gis-drop-zone');
  const fileInput = overlay.getElementById('gis-file-input');
  const pasteArea = overlay.getElementById('gis-paste-area');
  const previewSection = overlay.getElementById('gis-preview');
  const optionsSection = overlay.getElementById('gis-options');
  const messagesContainer = overlay.getElementById('gis-messages');
  const importBtn = overlay.getElementById('gis-import-btn');
  const cancelBtn = overlay.getElementById('gis-cancel-btn');
  const closeBtn = overlay.querySelector('.gis-close-btn');
  const scaleOption = overlay.getElementById('gis-scale-option');
  const customScaleGroup = overlay.getElementById('gis-custom-scale');

  // Event handlers
  function showSection(activeSource) {
    fileSection.style.display = activeSource === 'file' ? 'block' : 'none';
    pasteSection.style.display = activeSource === 'paste' ? 'block' : 'none';
    sampleSection.style.display = activeSource === 'sample' ? 'block' : 'none';
    
    // Reset state when switching
    currentData = null;
    hidePreview();
    hideMessages();
    updateImportButton();
    
    // Auto-load sample data
    if (activeSource === 'sample') {
      setTimeout(() => processData(generateSampleGISData()), 100);
    }
  }

  function processData(csvContent) {
    currentData = null;
    hidePreview();
    hideMessages();
    
    if (!csvContent || csvContent.trim().length === 0) {
      showMessage('Please provide CSV data to process', 'warning');
      updateImportButton();
      return;
    }
    
    // Validate data
    validationResult = validateGISData(csvContent);
    
    if (!validationResult.success) {
      validationResult.errors.forEach(error => showMessage(error, 'error'));
      updateImportButton();
      return;
    }
    
    // Show warnings if any
    validationResult.warnings.forEach(warning => showMessage(warning, 'warning'));
    
    try {
      // Parse and convert data
      const parsedData = parseGISData(csvContent);
      const convertedData = convertToSceneCoordinates(parsedData.poles, {
        scaleToFit: true,
        maxSceneSize: 200,
        centerOrigin: true
      });
      
      currentData = {
        raw: csvContent,
        parsed: parsedData,
        converted: convertedData
      };
      
      showPreview();
      showOptions();
      showMessage('✅ Data processed successfully!', 'success');
      
    } catch (error) {
      showMessage(`Processing error: ${error.message}`, 'error');
    }
    
    updateImportButton();
  }

  function showPreview() {
    if (!currentData) return;
    
    const { parsed, converted } = currentData;
    const stats = overlay.getElementById('gis-preview-stats');
    const table = overlay.getElementById('gis-preview-table');
    
    // Show stats
    stats.innerHTML = `
      <strong>📊 Data Summary:</strong>
      ${parsed.poles.length} poles found • 
      Scene size: ${converted.metadata.sceneSize.width}×${converted.metadata.sceneSize.depth} ft • 
      Bearing: ${converted.metadata.overallBearing}° • 
      Elevation range: ${converted.metadata.elevationRange.toFixed(1)} ft
    `;
    
    // Show table preview (first 10 rows)
    const previewPoles = converted.poles.slice(0, 10);
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Lat/Lng</th>
          <th>Scene X,Z</th>
          <th>Elevation</th>
          <th>Height</th>
        </tr>
      </thead>
      <tbody>
        ${previewPoles.map(pole => `
          <tr>
            <td>${pole.id}</td>
            <td>${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}</td>
            <td>${pole.x.toFixed(1)}, ${pole.z.toFixed(1)}</td>
            <td>${pole.elevation.toFixed(1)} ft</td>
            <td>${pole.height} ft</td>
          </tr>
        `).join('')}
        ${converted.poles.length > 10 ? `<tr><td colspan="5"><em>... and ${converted.poles.length - 10} more poles</em></td></tr>` : ''}
      </tbody>
    `;
    
    previewSection.style.display = 'block';
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
    message.className = `gis-message ${type}`;
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
      // Get current options
      const scaleMode = scaleOption.value;
      const terrainMethod = overlay.getElementById('gis-terrain-method').value;
      const originMode = overlay.getElementById('gis-origin-option').value;
      const customScale = parseFloat(overlay.getElementById('gis-scale-factor').value) || 1.0;
      
      // Apply options to conversion
      const conversionOptions = {
        scaleToFit: scaleMode === 'auto',
        maxSceneSize: 200,
        centerOrigin: originMode === 'center'
      };
      
      if (scaleMode === 'custom') {
        conversionOptions.scaleFactor = customScale;
        conversionOptions.scaleToFit = false;
      }
      
      // Reconvert with new options
      const finalData = convertToSceneCoordinates(currentData.parsed.poles, conversionOptions);
      
      // Create elevation surface
      const elevationSurface = createElevationSurface(finalData.poles, {
        interpolationMethod: terrainMethod,
        smoothingFactor: 1.0,
        falloffDistance: 100
      });
      
      // Prepare import data
      const importData = {
        poles: finalData.poles.map(pole => ({
          x: pole.x,
          z: pole.z,
          height: pole.height,
          elevation: pole.elevation,
          id: pole.id,
          originalCoords: { lat: pole.lat, lng: pole.lng }
        })),
        elevationSurface,
        metadata: {
          ...finalData.metadata,
          importedFrom: 'gis',
          terrainMethod,
          scaleMode,
          originalData: currentData.raw
        }
      };
      
      // Close dialog
      closeDialog();
      
      // Call completion callback
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
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      showMessage('File size too large. Please select a file smaller than 5MB.', 'error');
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
      // Debounce processing
      clearTimeout(pasteArea.timeout);
      pasteArea.timeout = setTimeout(() => processData(content), 500);
    }
  });

  scaleOption.addEventListener('change', () => {
    customScaleGroup.style.display = scaleOption.value === 'custom' ? 'block' : 'none';
  });

  importBtn.addEventListener('click', handleImport);
  cancelBtn.addEventListener('click', handleCancel);
  closeBtn.addEventListener('click', handleCancel);

  // Close on outside click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      handleCancel();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', escapeHandler);
      handleCancel();
    }
  });

  // Initialize with file mode
  showSection('file');
}