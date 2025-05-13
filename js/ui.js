// UI Module for GridScaper
import { CONSTANTS } from './config.js';

// UI state management
export const UIState = {
  currentHeight: 20,
  currentTension: 1.0,
  showGrid: true
};

// UI element references
export const elements = {
  get slider() { return document.getElementById('heightSlider'); },
  get heightLabel() { return document.getElementById('heightLabel'); },
  get terrainSelect() { return document.getElementById('terrainSelect'); },
  get tensionSlider() { return document.getElementById('tensionSlider'); },
  get tensionLabel() { return document.getElementById('tensionLabel'); },
  get settingSelect() { return document.getElementById('settingSelect'); },
  get environmentSelect() { return document.getElementById('environmentSelect'); },
  get equipmentSelect() { return document.getElementById('equipmentSelect'); },
  get clearButton() { return document.getElementById('clearScene'); },
  get showGridCheck() { return document.getElementById('showGridCheck'); }
};

/**
 * Initialize UI state from element values
 * This can be called early in the initialization process
 */
export function initUI() {
  // Initialize state from UI elements if elements are available
  if (elements.slider) {
    UIState.currentHeight = +elements.slider.value;
  }
  if (elements.tensionSlider) {
    UIState.currentTension = +elements.tensionSlider.value;
  }
  if (elements.showGridCheck) {
    UIState.showGrid = elements.showGridCheck.checked;
  }
  
  return { elements };
}

/**
 * Set up event handlers for UI elements
 * This should be called after all dependencies are available
 */
export function setupUI(callbacks, dependencies) {
  const { updateGhost, clearSceneElements, resetScene, updateSceneElements, 
          rebuild, updateEnvironment, toggleGridVisibility } = callbacks;
          
  const { scene, trees, treeData, urlParams, customPoles, SEG, hAt, 
          addGridLines, addDefaultTrees, importedBuildTerrain } = dependencies;
  
  // Height slider
  elements.slider.oninput = () => {
    UIState.currentHeight = +elements.slider.value;
    elements.heightLabel.textContent = UIState.currentHeight;
    updateGhost();
  };
  
  // Terrain select
  elements.terrainSelect.onchange = () => {
    clearSceneElements();
    trees.clear();
    treeData.length = 0;
    importedBuildTerrain(
      scene, 
      urlParams, 
      customPoles, 
      elements.terrainSelect, 
      elements.environmentSelect, 
      SEG, 
      hAt, 
      addGridLines, 
      addDefaultTrees, 
      updateEnvironment
    );
    resetScene();
    updateSceneElements();
  };
  
  // Tension slider
  elements.tensionSlider.oninput = () => {
    UIState.currentTension = +elements.tensionSlider.value;
    elements.tensionLabel.textContent = UIState.currentTension.toFixed(1) + '×';
    rebuild();
  };
  
  // Setting select
  if (elements.settingSelect) {
    elements.settingSelect.onchange = updateSceneElements;
  }
  
  // Environment select
  if (elements.environmentSelect) {
    elements.environmentSelect.onchange = () => {
      updateSceneElements();
      updateEnvironment();
    };
  }
  
  // Equipment select
  if (elements.equipmentSelect) {
    elements.equipmentSelect.onchange = updateSceneElements;
  }
  
  // Show grid checkbox
  if (elements.showGridCheck) {
    elements.showGridCheck.onchange = () => {
      UIState.showGrid = elements.showGridCheck.checked;
      toggleGridVisibility(UIState.showGrid);
    };
  }
  
  // Clear button
  elements.clearButton.onclick = resetScene;
}

/**
 * Get the current UI values
 * @returns {Object} - Object containing current UI values
 */
export function getUIValues() {
  return {
    currentHeight: UIState.currentHeight,
    currentTension: UIState.currentTension,
    showGrid: UIState.showGrid
  };
}
