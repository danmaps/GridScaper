import { CONSTANTS } from './config.js';

export const UIState = {
  currentHeight: 20,
  currentTension: 1,
  showGrid: true
};

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
  get showGridCheck() { return document.getElementById('showGridCheck'); },
  get randomButton() { return document.getElementById('randomScenario'); }
};

export function initUI() {
  if (elements.slider) {
    UIState.currentHeight = Number(elements.slider.value);
    elements.heightLabel.textContent = UIState.currentHeight;
  }

  if (elements.tensionSlider) {
    UIState.currentTension = Number(elements.tensionSlider.value);
    elements.tensionLabel.textContent = `${UIState.currentTension.toFixed(1)} A`;
  }

  if (elements.showGridCheck) {
    UIState.showGrid = Boolean(elements.showGridCheck.checked);
  }

  return { elements };
}

export function setupUI(callbacks, dependencies) {
  const {
    updateGhost,
    clearSceneElements,
    resetScene,
    updateSceneElements,
    rebuild,
    updateEnvironment,
    toggleGridVisibility,
    createRandomScenario
  } = callbacks;

  const {
    scene,
    trees,
    treeData,
    urlParams,
    customPoles,
    SEG,
    hAt,
    addGridLines,
    addDefaultTrees,
    importedBuildTerrain
  } = dependencies;

  if (elements.slider) {
    elements.slider.oninput = () => {
      UIState.currentHeight = Number(elements.slider.value);
      elements.heightLabel.textContent = UIState.currentHeight;
      updateGhost();
    };
  }

  if (elements.terrainSelect) {
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
  }

  if (elements.tensionSlider) {
    elements.tensionSlider.oninput = () => {
      UIState.currentTension = Number(elements.tensionSlider.value);
      elements.tensionLabel.textContent = `${UIState.currentTension.toFixed(1)} A`;
      rebuild();
    };
  }

  if (elements.settingSelect) {
    elements.settingSelect.onchange = updateSceneElements;
  }

  if (elements.environmentSelect) {
    elements.environmentSelect.onchange = () => {
      updateEnvironment();
      updateSceneElements();
    };
  }

  if (elements.equipmentSelect) {
    elements.equipmentSelect.onchange = updateSceneElements;
  }

  if (elements.showGridCheck) {
    elements.showGridCheck.onchange = () => {
      UIState.showGrid = Boolean(elements.showGridCheck.checked);
      toggleGridVisibility(UIState.showGrid);
    };
  }

  if (elements.clearButton) {
    elements.clearButton.onclick = resetScene;
  }

  if (elements.randomButton) {
    elements.randomButton.onclick = createRandomScenario;
  }
}

export function getUIValues() {
  return {
    currentHeight: UIState.currentHeight,
    currentTension: UIState.currentTension,
    showGrid: UIState.showGrid,
  };
}
