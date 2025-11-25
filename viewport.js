import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { setupPropertiesPanel, updatePropertiesPanel } from './propertiesPanel.js';
import { initPublish } from './publish.js';
import { exportToRbxlx } from './rbxlxExporter.js';
import { exportToRbxl } from './rbxlExporter.js';
import { loadRbxlxContent } from './rbxlxImporter.js';
import studioApp from './studioApp.js';
import { log } from './logger.js';
import { createWedgeGeometry } from './geometryUtils.js';

const viewportEl = document.querySelector("#viewport .view");
let scene, camera, renderer, controls, transformControls, selectedObject;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let lastT = performance.now();

function initThree() {
  scene = new THREE.Scene();
  studioApp.scene = scene;

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load('/DefaultSkybox2021.png', (texture) => {
    scene.background = texture;
  });

  const width = viewportEl.clientWidth;
  const height = viewportEl.clientHeight;

  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(3, 4, 5);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  viewportEl.appendChild(renderer.domElement);
  studioApp.rendererDom = renderer.domElement;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 2;
  controls.maxDistance = 20;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  const gridHelper = new THREE.GridHelper(50, 50, 0x0078d7, 0xcccccc);
  scene.add(gridHelper);

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.addEventListener('dragging-changed', e => (controls.enabled = !e.value));
  transformControls.addEventListener('objectChange', () => {
    if (selectedObject === transformControls.object) {
      updatePropertiesPanel(selectedObject);
    }
  });
  scene.add(transformControls);

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now(); const dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;

    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function onViewportResize() {
  if (!camera || !renderer) return;
  const width = viewportEl.clientWidth;
  const height = viewportEl.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function clearScene() {
    const toRemove = [];
    scene.children.forEach(child => {
        if (child.isMesh && (child.userData.type === 'Part' || child.userData.type === 'SpawnLocation')) {
            toRemove.push(child);
        }
    });
    toRemove.forEach(child => scene.remove(child));
    studioApp.emit('sceneCleared');
    selectObject(null); // Deselect any object
    log('[Studio] Cleared all parts from the scene.');
}

function createObject(options = {}) {
  const { type = 'Part', name, shape = 'Block' } = options;
  if (type !== 'Part' && type !== 'SpawnLocation') {
    log(`[Studio] Object type "${type}" not supported.`, 'warn');
    return;
  }

  const partName = name || getUniqueName(type);

  let geometry, material, part;
  let size;

  if (type === 'SpawnLocation') {
    size = options.size || new THREE.Vector3(12, 1, 12);
    geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    material = new THREE.MeshStandardMaterial({ color: options.color || 0x333333, roughness: 0.8, metalness: 0 });
    part = new THREE.Mesh(geometry, material);
    part.userData.type = 'SpawnLocation';
    part.userData.anchored = options.anchored !== undefined ? options.anchored : true;
    part.userData.canCollide = options.canCollide !== undefined ? options.canCollide : true;
    part.userData.locked = options.locked !== undefined ? options.locked : false;
  } else { // Part
    size = options.size || (shape === 'Ball' ? new THREE.Vector3(4, 4, 4) : new THREE.Vector3(4, 1, 2));
    
    if (shape === 'Ball') {
      const radius = Math.max(size.x, size.y, size.z) / 2;
      geometry = new THREE.SphereGeometry(radius, 32, 16);
    } else if (shape === 'Cylinder') {
      const radius = size.x / 2;
      geometry = new THREE.CylinderGeometry(radius, radius, size.y, 32);
    } else if (shape === 'Wedge') {
        geometry = createWedgeGeometry(size.x, size.y, size.z);
    } else { // Block
      geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    }
    
    material = new THREE.MeshStandardMaterial({ color: options.color || 0xA3A2A5, roughness: 0.8, metalness: 0 });
    part = new THREE.Mesh(geometry, material);
    part.userData.type = 'Part';
    part.userData.shape = shape;
    part.userData.anchored = options.anchored !== undefined ? options.anchored : false;
    part.userData.canCollide = options.canCollide !== undefined ? options.canCollide : true;
    part.userData.locked = options.locked !== undefined ? options.locked : false;
  }
  
  part.name = partName;
  part.userData.size = size.clone();

  if (options.position) {
    part.position.copy(options.position);
  } else {
    part.position.set(0, 4, 0);
  }

  if(options.quaternion) {
    part.quaternion.copy(options.quaternion);
  }

  scene.add(part);
  
  if(!options.suppressLog) log(`[Studio] Created ${part.name}.`);
  studioApp.emit('objectAdded', part);
  selectObject(part);
  return part;
}
studioApp.createObject = createObject;

function getUniqueName(baseName) {
    let name = baseName;
    let counter = 2;
    while (scene.getObjectByName(name)) {
        name = `${baseName} ${counter++}`;
    }
    return name;
}

function selectObject(object) {
  if (selectedObject && selectedObject !== object) {
    if (selectedObject.material?.emissive) selectedObject.material.emissive.setHex(0x000000);
  }

  if (object) {
    selectedObject = object;
    if (selectedObject.material?.emissive) selectedObject.material.emissive.setHex(0x222222);
    if (transformControls?.enabled) transformControls.attach(selectedObject);
  } else {
    selectedObject = null;
    transformControls.detach();
  }
  updatePropertiesPanel(object);
}

function selectObjectByName(name) {
  if (!scene) return;
  const object = scene.getObjectByName(name);
  selectObject(object);
}
studioApp.selectObjectByName = selectObjectByName;

function wireSimControls() {
  const createBtn = document.querySelector('.asset .btn');
  if (createBtn) createBtn.addEventListener('click', () => {
    const title = createBtn.closest(".asset").querySelector(".title").textContent.trim();
    const type = title.includes("Part") ? "Part" : title.includes("Model") ? "Model" : "Part";
    const name = getUniqueName(type);
    createObject({type, name});
  });

  const createPartBtn = document.getElementById('create-part');
  if (createPartBtn) createPartBtn.addEventListener('click', () => createObject({ type: 'Part', shape: 'Block' }));

  const createSphereBtn = document.getElementById('create-sphere');
  if (createSphereBtn) createSphereBtn.addEventListener('click', () => createObject({ type: 'Part', shape: 'Ball' }));

  const createCylinderBtn = document.getElementById('create-cylinder');
  if (createCylinderBtn) createCylinderBtn.addEventListener('click', () => createObject({ type: 'Part', shape: 'Cylinder' }));
  
  const createWedgeBtn = document.getElementById('create-wedge');
  if (createWedgeBtn) createWedgeBtn.addEventListener('click', () => createObject({ type: 'Part', shape: 'Wedge' }));

  const createSpawnBtn = document.getElementById('create-spawnlocation');
  if (createSpawnBtn) createSpawnBtn.addEventListener('click', () => createObject({ type: 'SpawnLocation' }));
  
  const exportBtn = document.getElementById('export-rbxlx');
  if (exportBtn) exportBtn.addEventListener('click', () => exportToRbxlx(scene));

  const exportBinBtn = document.getElementById('export-rbxl');
  if (exportBinBtn) exportBinBtn.addEventListener('click', () => exportToRbxl(scene));

  const loadBtn = document.getElementById('load-rbxlx-button');
  const fileLoader = document.getElementById('rbxlx-file-loader');
  
  if (loadBtn && fileLoader) {
    loadBtn.addEventListener('click', () => fileLoader.click());
    fileLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            clearScene();
            loadRbxlxContent(e.target.result, scene);
        };
        reader.onerror = (e) => {
            log(`Error reading file: ${e.target.error.name}`, 'error');
        }
        reader.readAsText(file);
        
        // Reset file input to allow loading the same file again
        event.target.value = '';
    });
  }

  initPublish(() => scene);
}

function setTool(mode) {
  if (!transformControls) return;
  if (mode === 'select') { transformControls.enabled = false; transformControls.detach(); return; }
  transformControls.enabled = true; transformControls.setMode(mode);
  if (selectedObject) transformControls.attach(selectedObject);
}

function wireTools() {
  // Updated to use IDs for more robustness with the new HTML structure
  const map = {
    'tool-select': 'select',
    'tool-move': 'translate',
    'tool-scale': 'scale',
    'tool-rotate': 'rotate'
  };

  Object.entries(map).forEach(([id, mode]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        // Update active state visual
        Object.keys(map).forEach(k => {
            document.getElementById(k)?.classList.remove('active');
        });
        btn.classList.add('active');
        
        setTool(mode);
      });
    }
  });
  
  // Default tool
  setTool('select');
}

renderer?.domElement?.addEventListener('pointerdown', (event) => {
  if (!renderer || !camera) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(scene.children.filter(c => c.isMesh && c.userData.type === 'Part'), false);
  const hit = intersects[0]?.object;
  selectObject(hit);
});

initThree();
setupPropertiesPanel();
const resizeObserver = new ResizeObserver(() => requestAnimationFrame(onViewportResize));
resizeObserver.observe(viewportEl);
wireTools();
wireSimControls();
updatePropertiesPanel(null); // Initialize with no selection