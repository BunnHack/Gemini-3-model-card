import * as THREE from "three";
import GUI from 'lil-gui';
import { createWedgeGeometry } from './geometryUtils.js';

let gui;
let guiState = {};
let selectedObject = null;
let shapeController = null;

const onUpdateFns = {
  updatePosition: null,
  updateRotation: null,
};

function updateObjectShape() {
    if (!selectedObject) return;
    const size = selectedObject.userData.size;
    let newGeometry;
    if (guiState.shape === 'Ball') {
        const radius = Math.max(size.x, size.y, size.z) / 2;
        newGeometry = new THREE.SphereGeometry(radius, 32, 16);
    } else if (guiState.shape === 'Cylinder') {
        const radius = size.x / 2;
        newGeometry = new THREE.CylinderGeometry(radius, radius, size.y, 32);
    } else if (guiState.shape === 'Wedge') {
        newGeometry = createWedgeGeometry(size.x, size.y, size.z);
    } else { // Block
        newGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    }
    selectedObject.geometry.dispose();
    selectedObject.geometry = newGeometry;
    selectedObject.userData.shape = guiState.shape;
}

export function setupPropertiesPanel() {
  const propertiesContainer = document.getElementById('properties-container');
  if (!propertiesContainer) return;

  gui = new GUI({ container: propertiesContainer });
  gui.domElement.parentElement.style.zIndex = 'auto'; // fix lil-gui bug
  
  guiState = {
    name: '',
    shape: 'Block',
    transparency: 0,
    color: '#000000',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    anchored: false,
    canCollide: true,
    locked: false,
  };

  gui.add(guiState, 'name').name('Name').onChange(val => {
    if (selectedObject) selectedObject.name = val;
  });

  const appearanceFolder = gui.addFolder('Appearance');
  shapeController = appearanceFolder.add(guiState, 'shape', ['Block', 'Ball', 'Cylinder', 'Wedge']).name('Shape').onChange(updateObjectShape);
  appearanceFolder.addColor(guiState, 'color').name('Color').onChange(val => {
    if (selectedObject?.material?.color) selectedObject.material.color.set(val);
  });
  appearanceFolder.add(guiState, 'transparency', 0, 1, 0.01).name('Transparency').onChange(val => {
    if (selectedObject?.material) {
      selectedObject.material.transparent = val > 0;
      selectedObject.material.opacity = 1 - val;
    }
  });
  appearanceFolder.open();

  const transformFolder = gui.addFolder('Transform');
  const posFolder = transformFolder.addFolder('Position');
  posFolder.add(guiState.position, 'x', -50, 50, 0.1).name('X').onChange(() => onUpdateFns.updatePosition?.());
  posFolder.add(guiState.position, 'y', -50, 50, 0.1).name('Y').onChange(() => onUpdateFns.updatePosition?.());
  posFolder.add(guiState.position, 'z', -50, 50, 0.1).name('Z').onChange(() => onUpdateFns.updatePosition?.());

  const rotFolder = transformFolder.addFolder('Rotation');
  rotFolder.add(guiState.rotation, 'x', -180, 180, 1).name('X').onChange(() => onUpdateFns.updateRotation?.());
  rotFolder.add(guiState.rotation, 'y', -180, 180, 1).name('Y').onChange(() => onUpdateFns.updateRotation?.());
  rotFolder.add(guiState.rotation, 'z', -180, 180, 1).name('Z').onChange(() => onUpdateFns.updateRotation?.());
  transformFolder.open();

  const behaviorFolder = gui.addFolder('Behavior');
  behaviorFolder.add(guiState, 'anchored').name('Anchored').onChange(val => {
    if (selectedObject) selectedObject.userData.anchored = val;
  });
  behaviorFolder.add(guiState, 'canCollide').name('CanCollide').onChange(val => {
    if (selectedObject) selectedObject.userData.canCollide = val;
  });
  behaviorFolder.add(guiState, 'locked').name('Locked').onChange(val => {
    if (selectedObject) selectedObject.userData.locked = val;
  });
  behaviorFolder.open();

  gui.close();
  setPropsDisabled(true);

  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
        if (propertiesContainer) {
            gui.width = propertiesContainer.clientWidth;
        }
    });
  });
  resizeObserver.observe(propertiesContainer);

  onUpdateFns.updatePosition = () => {
    if (!selectedObject) return;
    selectedObject.position.set(guiState.position.x, guiState.position.y, guiState.position.z);
  };
  onUpdateFns.updateRotation = () => {
    if (!selectedObject) return;
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(guiState.rotation.x),
      THREE.MathUtils.degToRad(guiState.rotation.y),
      THREE.MathUtils.degToRad(guiState.rotation.z)
    );
    selectedObject.rotation.copy(euler);
  };
}

function setPropsDisabled(disabled) {
  if (!gui) return;
  if (disabled) {
    gui.close();
    gui.domElement.style.pointerEvents = 'none';
    gui.domElement.style.opacity = '0.5';
  } else {
    gui.open();
    gui.domElement.style.pointerEvents = '';
    gui.domElement.style.opacity = '1';
  }
}

export function updatePropertiesPanel(object) {
  selectedObject = object;
  if (!gui) return;
  if (!selectedObject) {
    setPropsDisabled(true);
    return;
  }
  setPropsDisabled(false);

  guiState.name = selectedObject.name || '';
  if (selectedObject.material?.color) {
      guiState.color = '#' + selectedObject.material.color.getHexString();
  }
  if (selectedObject.material) {
      guiState.transparency = 1 - (selectedObject.material.opacity ?? 1);
  }
  
  if (selectedObject.userData.type === 'Part') {
      guiState.shape = selectedObject.userData.shape || 'Block';
      shapeController.domElement.style.display = '';
  } else {
      shapeController.domElement.style.display = 'none';
  }

  guiState.anchored = selectedObject.userData.anchored || false;
  guiState.canCollide = selectedObject.userData.canCollide !== undefined ? selectedObject.userData.canCollide : true;
  guiState.locked = selectedObject.userData.locked || false;

  const p = selectedObject.position;
  guiState.position.x = p.x;
  guiState.position.y = p.y;
  guiState.position.z = p.z;

  const e = selectedObject.rotation;
  guiState.rotation.x = THREE.MathUtils.radToDeg(e.x);
  guiState.rotation.y = THREE.MathUtils.radToDeg(e.y);
  guiState.rotation.z = THREE.MathUtils.radToDeg(e.z);

  gui.controllersRecursive().forEach(c => c.updateDisplay());
}

