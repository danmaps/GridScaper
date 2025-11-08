import { CONSTANTS } from './config.js';

export const UIState = {
  currentHeight: 20,
  currentTension: 2000, // Changed to pounds
  showGrid: true,
  showGridLabels: false,
  clearanceThreshold: 15,
  showPoleHeightLabels: false,
  showSagCalculations: false,
  showClearanceBuffers: false,
  // Challenge mode state
  challengeMode: false,
  challengeBudget: 5500,
  challengeSpent: 0,
  costPerPole: 1500,
  costPerFoot: 10,
  maxSpanLength: 40, // Maximum distance between poles in challenge mode
  // Tool state
  activeTool: 'pole', // 'pole', 'conductor', or 'eraser'
  poleToolActive: true,
  conductorToolActive: false,
  eraserToolActive: false,
  // Conductor drawing state
  conductorStartPole: null, // First pole selected for conductor drawing
  conductorHoverPole: null  // Pole being hovered over during conductor drawing
};

export const elements = {
  get slider() { return document.getElementById('heightSlider'); },
  get heightLabel() { return document.getElementById('heightLabel'); },
  // get terrainSelect() { return document.getElementById('terrainSelect'); },
  get tensionSlider() { return document.getElementById('tensionSlider'); },
  get tensionLabel() { return document.getElementById('tensionLabel'); },
  get clearButton() { return document.getElementById('clearScene'); },
  get showGridCheck() { return document.getElementById('showGridCheck'); },
  get showGridLabelsCheck() { return document.getElementById('showGridLabelsCheck'); },
  get randomButton() { return document.getElementById('randomScenario'); },
  get clearanceThreshold() { return document.getElementById('clearanceThreshold'); },
  get clearanceLabel() { return document.getElementById('clearanceLabel'); },
  get clearanceWarning() { return document.getElementById('clearanceWarning'); },
  get showPoleHeightLabels() { return document.getElementById('showPoleHeightLabels'); },
  get copyLink() { return document.getElementById('copyLink'); },
  get copyLinkToast() { return document.getElementById('copyLinkToast'); },
  get downloadJSON() { return document.getElementById('downloadJSON'); },
  get importJSON() { return document.getElementById('importJSON'); },
  get importGIS() { return document.getElementById('importGIS'); },
  get importElevation() { return document.getElementById('importElevation'); },
  get hudToggle() { return document.getElementById('hudToggle'); },
  get hudContent() { return document.getElementById('hudContent'); },
  get hudCollapseBtn() { return document.getElementById('hudCollapseBtn'); },
  get showSagCalculations() { return document.getElementById('showSagCalculations'); },
  get showClearanceBuffers() { return document.getElementById('showClearanceBuffers'); },
  get undoButton() { return document.getElementById('undoButton'); },
  get redoButton() { return document.getElementById('redoButton'); },
  // Challenge mode elements
  get toggleChallengeMode() { return document.getElementById('toggleChallengeMode'); },
  get sandboxModeButton() { return document.getElementById('sandboxModeButton'); },
  get exitChallengeMode() { return document.getElementById('exitChallengeMode'); },
  get challengePanel() { return document.getElementById('challengePanel'); },
  get challengeBudget() { return document.getElementById('challengeBudget'); },
  get challengeSpent() { return document.getElementById('challengeSpent'); },
  get challengeRemaining() { return document.getElementById('challengeRemaining'); },
  get challengePoles() { return document.getElementById('challengePoles'); },
  get checkSolution() { return document.getElementById('checkSolution'); },
  get resetChallenge() { return document.getElementById('resetChallenge'); },
  // Tool panel elements
  get toolPanel() { return document.getElementById('toolPanel'); },
  get poleTool() { return document.getElementById('poleTool'); },
  get conductorTool() { return document.getElementById('conductorTool'); },
  get eraserTool() { return document.getElementById('eraserTool'); }
};

export function initUI() {
  if (elements.slider) {
    UIState.currentHeight = Number(elements.slider.value);
    elements.heightLabel.textContent = UIState.currentHeight;
  }

  if (elements.tensionSlider) {
    UIState.currentTension = Number(elements.tensionSlider.value);
    elements.tensionLabel.textContent = `${UIState.currentTension} lbs`;
  }

  if (elements.showGridCheck) {
    UIState.showGrid = Boolean(elements.showGridCheck.checked);
  }

  if (elements.showGridLabelsCheck) {
    UIState.showGridLabels = Boolean(elements.showGridLabelsCheck.checked);
  }

  if (elements.clearanceThreshold) {
    UIState.clearanceThreshold = Number(elements.clearanceThreshold.value);
    elements.clearanceLabel.textContent = UIState.clearanceThreshold;
  }

  if (elements.showPoleHeightLabels) {
    UIState.showPoleHeightLabels = Boolean(elements.showPoleHeightLabels.checked);
  }

  if (elements.showSagCalculations) {
    UIState.showSagCalculations = Boolean(elements.showSagCalculations.checked);
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
    toggleGridVisibility,
    toggleGridLabels,
    createRandomScenario,
    checkClearances,
    updatePoleHeightLabels,
    updateSagCalculations,
    copyScenarioLink,
    exportScene,
    handleFileImport,
    handleGISImport,
    handleElevationProfileImport,
    undoHistory,
    redoHistory,
    enterChallengeMode,
    exitChallengeMode,
    checkChallengeSolution,
    resetChallengeLevel
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

  // Removed terrainSelect and its onchange handler



  if (elements.tensionSlider) {
    elements.tensionSlider.oninput = () => {
      UIState.currentTension = Number(elements.tensionSlider.value);
      elements.tensionLabel.textContent = `${UIState.currentTension} lbs`;
      rebuild();
    };
  }



  if (elements.showGridCheck) {
    elements.showGridCheck.onchange = () => {
      UIState.showGrid = Boolean(elements.showGridCheck.checked);
      toggleGridVisibility(UIState.showGrid);
    };
  }

  if (elements.showGridLabelsCheck) {
    elements.showGridLabelsCheck.onchange = () => {
      UIState.showGridLabels = Boolean(elements.showGridLabelsCheck.checked);
      if (typeof toggleGridLabels === 'function') {
        toggleGridLabels(UIState.showGridLabels);
      }
    };
  }

  if (elements.clearButton) {
    elements.clearButton.onclick = resetScene;
  }

  // Removed randomButton handler

  if (elements.copyLink) {
    elements.copyLink.onclick = copyScenarioLink;
  }

  if (elements.downloadJSON) {
    elements.downloadJSON.onclick = exportScene;
  }

  if (elements.importJSON) {
    elements.importJSON.onclick = handleFileImport;
  }

  if (elements.importGIS) {
    elements.importGIS.onclick = handleGISImport;
  }

  if (elements.importElevation) {
    elements.importElevation.onclick = handleElevationProfileImport;
  }

  if (elements.clearanceThreshold) {
    elements.clearanceThreshold.oninput = () => {
      UIState.clearanceThreshold = Number(elements.clearanceThreshold.value);
      elements.clearanceLabel.textContent = UIState.clearanceThreshold;
      if (checkClearances) {
        checkClearances();
      }
    };
  }

  if (elements.showPoleHeightLabels) {
    elements.showPoleHeightLabels.onchange = () => {
      UIState.showPoleHeightLabels = Boolean(elements.showPoleHeightLabels.checked);
      if (updatePoleHeightLabels) {
        updatePoleHeightLabels();
      }
    };
  }

  if (elements.showSagCalculations) {
    elements.showSagCalculations.onchange = () => {
      UIState.showSagCalculations = Boolean(elements.showSagCalculations.checked);
      if (updateSagCalculations) {
        updateSagCalculations();
      }
    };
  }

  if (elements.showClearanceBuffers) {
    elements.showClearanceBuffers.onchange = () => {
      UIState.showClearanceBuffers = Boolean(elements.showClearanceBuffers.checked);
      if (checkClearances) {
        checkClearances();
      }
    };
  }
  
  if (elements.undoButton) {
    elements.undoButton.onclick = undoHistory;
  }
  
  if (elements.redoButton) {
    elements.redoButton.onclick = redoHistory;
  }
  
  // Challenge mode buttons
  if (elements.toggleChallengeMode) {
    elements.toggleChallengeMode.onclick = enterChallengeMode;
  }

  if (elements.sandboxModeButton) {
    elements.sandboxModeButton.onclick = exitChallengeMode;
  }
  
  if (elements.exitChallengeMode) {
    elements.exitChallengeMode.onclick = exitChallengeMode;
  }
  
  if (elements.checkSolution) {
    elements.checkSolution.onclick = checkChallengeSolution;
  }
  
  if (elements.resetChallenge) {
    elements.resetChallenge.onclick = resetChallengeLevel;
  }
  
  // Tool panel setup
  setupToolPanel();
}

function setupToolPanel() {
  const toolButtons = [elements.poleTool, elements.conductorTool, elements.eraserTool];
  
  toolButtons.forEach(button => {
    if (!button) return;
    
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent click from reaching canvas
      const tool = button.dataset.tool;
      
      if (tool === 'eraser') {
        // Eraser is mutually exclusive
        UIState.eraserToolActive = !UIState.eraserToolActive;
        
        if (UIState.eraserToolActive) {
          UIState.poleToolActive = false;
          UIState.conductorToolActive = false;
          UIState.activeTool = 'eraser';
          elements.poleTool?.classList.remove('active');
          elements.conductorTool?.classList.remove('active');
          elements.eraserTool?.classList.add('active');
        } else {
          // If turning off eraser, default back to pole tool
          UIState.poleToolActive = true;
          UIState.activeTool = 'pole';
          elements.poleTool?.classList.add('active');
          elements.eraserTool?.classList.remove('active');
        }
      } else {
        // Pole and conductor can be toggled together
        UIState.eraserToolActive = false;
        elements.eraserTool?.classList.remove('active');
        
        if (tool === 'pole') {
          UIState.poleToolActive = !UIState.poleToolActive;
          button.classList.toggle('active', UIState.poleToolActive);
        } else if (tool === 'conductor') {
          UIState.conductorToolActive = !UIState.conductorToolActive;
          button.classList.toggle('active', UIState.conductorToolActive);
          
          // Reset conductor drawing state when toggling off
          if (!UIState.conductorToolActive) {
            UIState.conductorStartPole = null;
            UIState.conductorHoverPole = null;
          }
        }
        
        // Determine active tool
        if (UIState.poleToolActive && UIState.conductorToolActive) {
          UIState.activeTool = 'both';
        } else if (UIState.poleToolActive) {
          UIState.activeTool = 'pole';
        } else if (UIState.conductorToolActive) {
          UIState.activeTool = 'conductor';
        } else {
          // At least one must be active, default to pole
          UIState.poleToolActive = true;
          UIState.activeTool = 'pole';
          elements.poleTool?.classList.add('active');
        }
      }
    });
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key === 'p' || e.key === 'P') {
      elements.poleTool?.click();
    } else if (e.key === 'c' || e.key === 'C') {
      elements.conductorTool?.click();
    } else if (e.key === 'e' || e.key === 'E') {
      elements.eraserTool?.click();
    }
  });
}

export function getUIValues() {
  return {
    currentHeight: UIState.currentHeight,
    currentTension: UIState.currentTension,
    showGrid: UIState.showGrid,
    clearanceThreshold: UIState.clearanceThreshold,
  };
}
