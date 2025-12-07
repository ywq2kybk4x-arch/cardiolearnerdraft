import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const container = document.getElementById('conduction-container');

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.2, 3.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// Lighting setup
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222233, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(2, 2, 3);
scene.add(dirLight);

// Global settings exposed for external control
export const conductionSettings = {
  bpm: 72,
  phaseOffset: 0,
};

export function setHeartRate(newBpm) {
  if (typeof newBpm === 'number' && !Number.isNaN(newBpm)) {
    conductionSettings.bpm = newBpm;
    if (conductionMaterial && conductionMaterial.uniforms.uSpeed) {
      conductionMaterial.uniforms.uSpeed.value = newBpm / 60;
    }
  }
}

export function setConductionPhaseOffset(offset) {
  if (typeof offset === 'number' && !Number.isNaN(offset)) {
    conductionSettings.phaseOffset = offset;
    if (conductionMaterial && conductionMaterial.uniforms.uPhaseOffset) {
      conductionMaterial.uniforms.uPhaseOffset.value = offset;
    }
  }
}

let conductionMesh = null;
let conductionMaterial = null;
const clock = new THREE.Clock();
let modelCenter = new THREE.Vector3();
const DEBUG_CONDUCTION_SHADER = false;

// GLB loading
const loader = new GLTFLoader();
// TODO: Adjust model path if moved
loader.load(
  '/assets/cardiac_conduction_system.glb',
  (gltf) => {
    scene.add(gltf.scene);
    frameModel(gltf.scene);
    findConductionMesh(gltf.scene);
  },
  undefined,
  (error) => {
    console.error('Error loading conduction model:', error);
  }
);

function applyConductionShader(mesh) {
  conductionMesh = mesh;

  const geometry = conductionMesh.geometry;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;

  const posAttr = geometry.getAttribute('position');
  if (posAttr) {
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);
    const rangeY = Math.max(max.y - min.y, 0.0001);
    for (let i = 0; i < count; i += 1) {
      const y = posAttr.getY(i);
      const normY = (y - min.y) / rangeY;
      colors[i * 3] = normY;
      colors[i * 3 + 1] = 0;
      colors[i * 3 + 2] = 0;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  conductionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMinY: { value: min.y },
      uMaxY: { value: max.y },
      uBaseColor: { value: new THREE.Color(0x806600) },
      uGlowColor: { value: new THREE.Color(0xffff66) },
      uWidth: { value: 0.15 },
      uSpeed: { value: conductionSettings.bpm / 60 },
      uPhaseOffset: { value: conductionSettings.phaseOffset },
    },
    side: THREE.DoubleSide,
    depthWrite: true,
    vertexShader: `
      attribute vec3 color;
      varying float vCoord;
      void main() {
        float s = color.r;
        vCoord = clamp(s, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPhaseOffset;
      uniform vec3 uBaseColor;
      uniform vec3 uGlowColor;
      uniform float uWidth;
      uniform float uSpeed;
      varying float vCoord;

      float conductionWarp(float s) {
        if (s < 0.25) {
          return s * (0.30 / 0.25);
        } else if (s < 0.35) {
          return 0.30 + (s - 0.25) * ((0.55 - 0.30) / (0.35 - 0.25));
        } else {
          return 0.55 + (s - 0.35) * ((1.0 - 0.55) / (1.0 - 0.35));
        }
      }

      void main() {
        const bool DEBUG_CONDUCTION = ${DEBUG_CONDUCTION_SHADER ? 'true' : 'false'};
        if (DEBUG_CONDUCTION) {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
          return;
        }
        float beatPhase = fract(uTime * uSpeed + uPhaseOffset);
        float coord = conductionWarp(vCoord);
        float dist = abs(coord - beatPhase);
        float band = smoothstep(uWidth, 0.0, dist);
        float glow = pow(1.0 - band, 2.0);
        vec3 color = uBaseColor + glow * uGlowColor;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  conductionMesh.material = conductionMaterial;
}

// Identify conduction mesh by name and apply traveling-wave shader
function findConductionMesh(root) {
  let found = false;
  let brightestMesh = null;
  let brightest = 0;

  root.traverse((child) => {
    if (!child.isMesh || !child.material || !child.material.color) return;

    console.log('mesh:', child.name, 'color:', child.material.color.getHexString());

    const n = (child.name || '').toLowerCase();
    const nameMatch =
      n.includes('conduction') ||
      n.includes('bundle') ||
      n.includes('purkinje') ||
      n.includes('sa_node') ||
      n.includes('sa') ||
      n.includes('path');

    const color = child.material.color;
    const brightness = color.r + color.g + color.b;
    if (isYellowish(color) && brightness > brightest) {
      brightest = brightness;
      brightestMesh = child;
    }

    if (!nameMatch || found) return;

    console.log('Using conduction mesh:', child.name);
    applyConductionShader(child);
    found = true;
  });

  if (!found && brightestMesh) {
    console.warn('Conduction mesh not found by name; using brightest yellowish mesh:', brightestMesh.name);
    applyConductionShader(brightestMesh);
    found = true;
  }

  if (!found) {
    console.warn('Conduction mesh not found – adjust name matching rules.');
  }
}

// Approximate check for a yellow color
function isYellowish(color) {
  const r = color.r;
  const g = color.g;
  const b = color.b;
  return r > 0.7 && g > 0.6 && b < 0.3 && Math.abs(r - g) < 0.2;
}

// Frame the loaded model so it fits the view
function frameModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  modelCenter = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.2;

  const direction = new THREE.Vector3(0, 0, 1);
  camera.position.copy(modelCenter.clone().add(direction.multiplyScalar(distance)));
  camera.near = distance / 100;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();
  camera.lookAt(modelCenter);

  controls.target.copy(modelCenter);
  controls.update();

  dirLight.position.copy(camera.position.clone().add(new THREE.Vector3(2, 2, 1)));
}

// Handle window resize
window.addEventListener('resize', onWindowResize);
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop with heartbeat-style pulse
function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  if (conductionMaterial) {
    conductionMaterial.uniforms.uTime.value = elapsed;
    conductionMaterial.uniforms.uSpeed.value = conductionSettings.bpm / 60.0;
    conductionMaterial.uniforms.uPhaseOffset.value = conductionSettings.phaseOffset || 0.0;
    if (typeof window !== 'undefined') {
      window.debugConduction = {
        uTime: conductionMaterial.uniforms.uTime.value,
        bpm: conductionSettings.bpm,
        phaseOffset: conductionSettings.phaseOffset,
      };
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
