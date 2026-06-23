import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const container = document.getElementById("webglScene");
const loveAction = document.getElementById("loveAction");
const loveButton = document.getElementById("loveButton");
const letterOverlay = document.getElementById("letterOverlay");
const loveLetter = document.getElementById("loveLetter");
const letterClose = document.getElementById("letterClose");
const lovePage = document.getElementById("lovePage");
const questionIntro = document.getElementById("questionIntro");
const questionYesButton = document.getElementById("questionYesButton");
const questionNoButton = document.getElementById("questionNoButton");
const questionButtons = document.getElementById("questionButtons");
const questionHint = document.getElementById("questionHint");
const questionBurst = document.getElementById("questionBurst");
const backgroundMusic = document.getElementById("backgroundMusic");
let centralHeart;
let orbitTextGroup;
let floatingTextGroup;
let environmentDust;
let floorGlow;
let heartFaceTextGroup;
const ambientHeartGroups = [];
const floorRings = [];
const bursts = [];
let loadedFont = null;
let resizeTimer = null;
let isWorldStatic = document.body.classList.contains("intro-active");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020003);
scene.fog = new THREE.FogExp2(0x050006, 0.021);

const camera = new THREE.PerspectiveCamera(
  46,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

const initialCameraPosition = new THREE.Vector3(0, 0.4, 15.8);
camera.position.copy(initialCameraPosition);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance"
});

function getRenderPixelRatio() {
  const deviceRatio = window.devicePixelRatio || 1;
  const maximumRatio = window.innerWidth < 700 ? 1.75 : 2.25;
  return Math.min(deviceRatio, maximumRatio);
}

renderer.setPixelRatio(getRenderPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;
renderer.domElement.className = "webgl-canvas";
container.appendChild(renderer.domElement);

const multisampleTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: false
  }
);

// O EffectComposer renderiza fora do canvas principal. Sem multisampling,
// as bordas das geometrias 3D — especialmente letras — ficam serrilhadas.
const maximumSamples = window.innerWidth < 700 ? 2 : 4;
multisampleTarget.samples = Math.min(
  maximumSamples,
  renderer.capabilities.maxSamples || maximumSamples
);

const composer = new EffectComposer(renderer, multisampleTarget);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.38,
  0.2,
  0.74
);
bloomPass.strength = 0.38;
bloomPass.radius = 0.2;
bloomPass.threshold = 0.74;
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.rotateSpeed = 0.58;
controls.enableZoom = false;
controls.enablePan = false;
controls.minAzimuthAngle = -Infinity;
controls.maxAzimuthAngle = Infinity;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI - 0.08;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = null;
controls.mouseButtons.RIGHT = null;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.ROTATE;
controls.update();

const world = new THREE.Group();
scene.add(world);

const clock = new THREE.Clock();
let isDocumentVisible = !document.hidden;
let lastStaticRenderAt = 0;
const staticRenderInterval = 1000 / 18;

document.addEventListener("visibilitychange", () => {
  isDocumentVisible = !document.hidden;

  if (isDocumentVisible) {
    clock.getDelta();
    lastStaticRenderAt = 0;
  }
});

const glowTexture = createGlowTexture();
const heartGeometry = createRoundedHeartGeometry();
const ambientParticleGeometry = createSurfaceParticleGeometry(
  heartGeometry,
  window.innerWidth < 700 ? 220 : 360,
  0.035
);

createLighting();
createEnvironment();
createCentralHeart();
createHeartFaceTexts();

// Reconstrói o texto assim que a Montserrat estiver disponível.
// A primeira criação garante fallback imediato; a segunda aplica a fonte correta.
if (document.fonts?.load) {
  document.fonts.load('800 164px "Montserrat"').then(() => {
    createHeartFaceTexts();
  });
}

createAmbientHearts();
createFloor();
loadReal3DText();
configureInteraction();
configureLetter();
configureResize();
configureQuestionIntro();
configureHeartCursorTrail();
render();

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);

  gradient.addColorStop(0, "rgba(255,246,251,0.72)");
  gradient.addColorStop(0.12, "rgba(255,215,235,0.58)");
  gradient.addColorStop(0.36, "rgba(255,54,145,0.34)");
  gradient.addColorStop(1, "rgba(255,0,88,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLighting() {
  scene.add(new THREE.HemisphereLight(0xff8ecf, 0x12000c, 0.72));

  const keyLight = new THREE.PointLight(0xffc6e8, 22, 32, 1.7);
  keyLight.position.set(-4.8, 6.2, 8.5);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0xff1f72, 18, 28, 1.8);
  fillLight.position.set(6.5, 0.8, 4.5);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0x8d2cff, 14, 32, 1.8);
  rimLight.position.set(2.5, 5.5, -9.5);
  scene.add(rimLight);

  const lowerLight = new THREE.PointLight(0xff144f, 11, 22, 1.9);
  lowerLight.position.set(0, -5.2, 3.5);
  scene.add(lowerLight);
}

function createHeartShape() {
  const shape = new THREE.Shape();

  shape.moveTo(0, 1.05);
  shape.bezierCurveTo(-0.18, 1.52, -0.76, 1.92, -1.43, 1.92);
  shape.bezierCurveTo(-2.34, 1.92, -2.82, 1.14, -2.82, 0.29);
  shape.bezierCurveTo(-2.82, -0.87, -1.91, -1.85, 0, -3.32);
  shape.bezierCurveTo(1.91, -1.85, 2.82, -0.87, 2.82, 0.29);
  shape.bezierCurveTo(2.82, 1.14, 2.34, 1.92, 1.43, 1.92);
  shape.bezierCurveTo(0.76, 1.92, 0.18, 1.52, 0, 1.05);

  return shape;
}

function createRoundedHeartGeometry() {
  const geometry = new THREE.ExtrudeGeometry(createHeartShape(), {
    depth: 2.15,
    steps: 2,
    curveSegments: 32,
    bevelEnabled: true,
    bevelThickness: 0.62,
    bevelSize: 0.58,
    bevelOffset: -0.08,
    bevelSegments: 14
  });

  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function createHeartMaterial(color, emissive, opacity = 1) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: 0.2,
    metalness: 0.04,
    roughness: 0.32,
    clearcoat: 0.68,
    clearcoatRoughness: 0.2,
    sheen: 0.38,
    sheenColor: new THREE.Color(0xffb8df),
    sheenRoughness: 0.42,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide
  });
}

function createSurfaceParticleGeometry(geometry, count, normalOffset = 0.025) {
  const samplingMesh = new THREE.Mesh(geometry);
  const sampler = new MeshSurfaceSampler(samplingMesh).build();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const red = new THREE.Color(0xff164f);
  const pink = new THREE.Color(0xff5ab4);
  const pale = new THREE.Color(0xffd0ea);

  for (let index = 0; index < count; index += 1) {
    sampler.sample(position, normal);
    position.addScaledVector(normal, normalOffset + Math.random() * 0.04);

    const offset = index * 3;
    positions[offset] = position.x;
    positions[offset + 1] = position.y;
    positions[offset + 2] = position.z;

    const color = red
      .clone()
      .lerp(pink, Math.random() * 0.8)
      .lerp(pale, Math.random() < 0.08 ? 0.75 : 0);

    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return particleGeometry;
}

function createHeartParticleLayer(geometry, size, opacity) {
  const material = new THREE.PointsMaterial({
    size,
    map: glowTexture,
    alphaTest: 0.018,
    transparent: true,
    opacity,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 4;
  return points;
}

function createHeartGlowShell(geometry, color, scale = 1.055, opacity = 0.13) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const shell = new THREE.Mesh(geometry, material);
  shell.scale.setScalar(scale);
  shell.renderOrder = 1;
  return shell;
}

function createCentralHeart() {
  centralHeart = new THREE.Group();
  centralHeart.name = "centralHeart";
  centralHeart.position.set(0, 0.45, 0);
  centralHeart.scale.setScalar(window.innerWidth < 700 ? 0.88 : 1);
  world.add(centralHeart);

  const solid = new THREE.Mesh(
    heartGeometry,
    createHeartMaterial(0xff1b68, 0x72001f)
  );
  solid.castShadow = false;
  solid.receiveShadow = false;
  solid.renderOrder = 2;
  centralHeart.add(solid);

  const glowShell = createHeartGlowShell(heartGeometry, 0xff145f, 1.06, 0.07);
  centralHeart.add(glowShell);

  const particleGeometry = createSurfaceParticleGeometry(
    heartGeometry,
    window.innerWidth < 700 ? 1200 : 2250,
    0.04
  );
  const particles = createHeartParticleLayer(
    particleGeometry,
    window.innerWidth < 700 ? 0.078 : 0.062,
    0.38
  );
  particles.userData.baseOpacity = particles.material.opacity;
  centralHeart.add(particles);

  const edgeGeometry = new THREE.EdgesGeometry(heartGeometry, 28);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xff9fd6,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.scale.setScalar(1.007);
  centralHeart.add(edges);

  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(4.7, 42, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff005f,
      transparent: true,
      opacity: 0.018,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  aura.scale.set(1.1, 1.22, 0.95);
  centralHeart.add(aura);

  centralHeart.userData.solid = solid;
  centralHeart.userData.glowShell = glowShell;
  centralHeart.userData.particles = particles;
}

function createAmbientHearts() {
  const heartData = [
    { position: [-7.2, 3.5, -5.8], scale: 0.36, rotation: [0.22, 0.75, -0.3], color: 0xff2c90 },
    { position: [6.9, 3.6, -7.2], scale: 0.47, rotation: [-0.18, -0.82, 0.27], color: 0xff315f },
    { position: [-7.7, -2.4, 1.1], scale: 0.29, rotation: [0.34, 1.18, -0.48], color: 0xff227d },
    { position: [7.1, -1.8, 2.9], scale: 0.25, rotation: [-0.4, -1.08, 0.23], color: 0xff406f },
    { position: [-4.2, 5.5, 1.7], scale: 0.195, rotation: [0.52, 0.34, -0.18], color: 0xff4aa5 },
    { position: [4.1, 5.2, 4.2], scale: 0.225, rotation: [-0.3, 0.67, 0.46], color: 0xff2f72 }
  ];

  heartData.forEach((data, index) => {
    const group = new THREE.Group();
    group.position.set(...data.position);
    group.rotation.set(...data.rotation);
    group.scale.setScalar(data.scale);

    const mesh = new THREE.Mesh(
      heartGeometry,
      createHeartMaterial(data.color, 0x6b001e, 0.72)
    );
    group.add(mesh);

    group.add(createHeartGlowShell(heartGeometry, data.color, 1.06, 0.04));

    const particles = createHeartParticleLayer(
      ambientParticleGeometry,
      0.052,
      0.18
    );
    group.add(particles);

    group.userData.baseY = group.position.y;
    group.userData.floatOffset = index * 0.92;
    group.userData.rotationSpeed = randomBetween(-0.11, 0.11);
    group.userData.pulseOffset = randomBetween(0, Math.PI * 2);

    world.add(group);
    ambientHeartGroups.push(group);
  });
}

function createEnvironment() {
  const dustCount = window.innerWidth < 700 ? 800 : 1750;
  const positions = new Float32Array(dustCount * 3);
  const colors = new Float32Array(dustCount * 3);
  const colorA = new THREE.Color(0xff71c1);
  const colorB = new THREE.Color(0xff174f);
  const colorC = new THREE.Color(0xb447ff);

  for (let index = 0; index < dustCount; index += 1) {
    const offset = index * 3;
    const radius = randomBetween(8, 28);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(randomBetween(-1, 1));

    positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
    positions[offset + 1] = radius * Math.cos(phi) * 0.68;
    positions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const color = colorA
      .clone()
      .lerp(colorB, Math.random())
      .lerp(colorC, Math.random() * 0.18);

    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.082,
    map: glowTexture,
    alphaTest: 0.018,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  environmentDust = new THREE.Points(geometry, material);
  environmentDust.name = "environmentDust";
  world.add(environmentDust);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(8.2, 48, 30),
    new THREE.MeshBasicMaterial({
      color: 0x650034,
      transparent: true,
      opacity: 0.018,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  halo.scale.set(1.2, 0.9, 1.2);
  world.add(halo);
}

function createFloor() {
  const floorGroup = new THREE.Group();
  floorGroup.position.y = -4.45;
  world.add(floorGroup);

  floorGlow = new THREE.Mesh(
    new THREE.CircleGeometry(7.6, 96),
    new THREE.MeshBasicMaterial({
      color: 0xff0b71,
      transparent: true,
      opacity: 0.026,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.scale.set(1, 1, 1);
  floorGroup.add(floorGlow);

  for (let index = 0; index < 5; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.15 + index * 0.92, 0.022, 10, 180),
      new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xff1493 : 0xff315e,
        transparent: true,
        opacity: 0.25 - index * 0.03,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    ring.rotation.x = Math.PI / 2;
    ring.userData.phase = index * 0.78;
    ring.userData.baseOpacity = ring.material.opacity;
    floorGroup.add(ring);
    floorRings.push(ring);
  }

  const floorParticleCount = window.innerWidth < 700 ? 520 : 1000;
  const positions = new Float32Array(floorParticleCount * 3);
  const colors = new Float32Array(floorParticleCount * 3);
  const pink = new THREE.Color(0xff1493);
  const red = new THREE.Color(0xff315e);

  for (let index = 0; index < floorParticleCount; index += 1) {
    const offset = index * 3;
    const radius = Math.sqrt(Math.random()) * 7.4;
    const angle = Math.random() * Math.PI * 2;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = randomBetween(-0.045, 0.045);
    positions[offset + 2] = Math.sin(angle) * radius;

    const color = pink.clone().lerp(red, Math.random());
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  floorGroup.add(
    new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.055,
        map: glowTexture,
        alphaTest: 0.018,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      })
    )
  );
}

function loadReal3DText() {
  const loader = new FontLoader();

  loader.load(
    "./fonts/montserrat-bold.typeface.json",
    (font) => {
      loadedFont = font;
      createOrbitingText(font);
      createFloatingText(font);
    },
    undefined,
    (error) => {
      console.error(
        "Não foi possível carregar a fonte 3D com suporte ao português:",
        error
      );
    }
  );
}

function centerTextGeometry(geometry) {
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  geometry.translate(
    -(box.max.x + box.min.x) / 2,
    -(box.max.y + box.min.y) / 2,
    -(box.max.z + box.min.z) / 2
  );
}

function disposeObject3D(group) {
  if (!group) return;

  group.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        if (material.map) {
          material.map.dispose();
        }

        material.dispose();
      });
    }
  });

  group.parent?.remove(group);
}

function getOrbitTextSize(phrase) {
  const isMobile = window.innerWidth < 700;

  if (phrase.length >= 24) {
    return isMobile ? 0.135 : 0.165;
  }

  if (phrase.length >= 19) {
    return isMobile ? 0.155 : 0.19;
  }

  return isMobile ? 0.19 : 0.225;
}

function createTextMaterial(color = 0xff9fdd) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: 0xff087f,
    emissiveIntensity: 0.32,
    roughness: 0.24,
    metalness: 0.06,
    clearcoat: 0.5,
    clearcoatRoughness: 0.16,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide
  });
}

function createHeartTextTexture(label) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Sombra discreta para separar o branco do rosa sem criar clarão.
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '800 164px "Montserrat", Arial, sans-serif';
  context.lineJoin = "round";
  context.miterLimit = 2;
  context.shadowColor = "rgba(70, 0, 28, 0.72)";
  context.shadowBlur = 12;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 4;
  context.strokeStyle = "rgba(90, 0, 34, 0.68)";
  context.lineWidth = 10;
  context.strokeText(label, canvas.width / 2, canvas.height / 2 + 1);

  // Sem halo branco: preserva a cor branca, mas evita o clarão no bloom.
  context.shadowColor = "rgba(0, 0, 0, 0)";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = "rgba(255, 255, 255, 0.96)";
  context.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function disposeHeartFaceTexts() {
  if (!heartFaceTextGroup) return;

  heartFaceTextGroup.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    object.material?.map?.dispose();
    object.material?.dispose();
  });

  centralHeart?.remove(heartFaceTextGroup);
  heartFaceTextGroup = null;
}

function createHeartFaceTexts() {
  if (!centralHeart) return;

  disposeHeartFaceTexts();

  heartGeometry.computeBoundingBox();
  const heartBounds = heartGeometry.boundingBox;
  const shellScale = 1.06;
  const faceOffset = window.innerWidth < 700 ? 0.24 : 0.28;
  const frontZ = heartBounds.max.z * shellScale + faceOffset;
  const backZ = heartBounds.min.z * shellScale - faceOffset;

  heartFaceTextGroup = new THREE.Group();
  heartFaceTextGroup.name = "heartFaceTextGroup";
  centralHeart.add(heartFaceTextGroup);

  const label = "EU TE AMO, SARA!";
  const texture = createHeartTextTexture(label);
  const planeWidth = window.innerWidth < 700 ? 4.0 : 4.55;
  const planeHeight = planeWidth / 4;
  const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 1, 1);

  const makeMaterial = () => {
    const map = texture.clone();
    map.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      alphaTest: 0.015,
      depthTest: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.NormalBlending,
      toneMapped: true
    });
  };

  const frontText = new THREE.Mesh(planeGeometry, makeMaterial());
  frontText.name = "frontHeartText";
  frontText.position.set(0, 0.08, frontZ);
  frontText.renderOrder = 30;
  frontText.frustumCulled = false;
  heartFaceTextGroup.add(frontText);

  const backText = new THREE.Mesh(planeGeometry.clone(), makeMaterial());
  backText.name = "backHeartText";
  backText.position.set(0, 0.08, backZ);
  backText.rotation.y = Math.PI;
  backText.renderOrder = 30;
  backText.frustumCulled = false;
  heartFaceTextGroup.add(backText);

  texture.dispose();
}

function createOrbitingText(font) {
  orbitTextGroup = new THREE.Group();
  orbitTextGroup.position.y = 0.36;
  world.add(orbitTextGroup);

  const phrases = [
    "EU TE AMO",
    "MEU AMOR!",
    "PARA SEMPRE",
    "MEU CORAÇÃO É SEU",
    "VOCÊ É MEU MUNDO",
    "EU TE ESCOLHO SEMPRE",
    "VOCÊ É MEU AMOR ETERNO",
    "MINHA PESSOA FAVORITA",
    "EM VOCÊ ENCONTRO MEU LAR"
  ];

  const radius = window.innerWidth < 700 ? 4.7 : 5.7;

  phrases.forEach((phrase, index) => {
    const geometry = new TextGeometry(phrase, {
      font,
      size: getOrbitTextSize(phrase),
      depth: 0.12,
      curveSegments: 20,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.012,
      bevelSegments: 8
    });

    centerTextGeometry(geometry);

    const mesh = new THREE.Mesh(
      geometry,
      createTextMaterial(index % 2 === 0 ? 0xffb0e3 : 0xff7fa8)
    );

    const angle = (index / phrases.length) * Math.PI * 2;
    mesh.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle * 2) * 0.35,
      Math.sin(angle) * radius
    );
    mesh.rotation.y = Math.PI / 2 - angle;
    mesh.rotation.z = Math.sin(angle) * 0.055;
    mesh.userData.facesCamera = true;
    orbitTextGroup.add(mesh);
  });

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xff1493,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const ringA = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.016, 10, 240),
    ringMaterial.clone()
  );
  ringA.rotation.x = Math.PI / 2;
  orbitTextGroup.add(ringA);

  const ringB = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.94, 0.011, 8, 220),
    ringMaterial.clone()
  );
  ringB.rotation.x = Math.PI / 2;
  ringB.rotation.y = 0.16;
  ringB.rotation.z = 0.11;
  orbitTextGroup.add(ringB);
}

function createFloatingText(font) {
  floatingTextGroup = new THREE.Group();
  world.add(floatingTextGroup);

  const items = [
    { text: "VOCÊ É MEU LUGAR FAVORITO", position: [-7.2, 1.6, -1.8], rotation: [0.05, 0.8, -0.08] },
    { text: "SINTO MUITO SUA FALTA QUANDO NÃO ESTÁ COMIGO", position: [6.2, 1.9, -2.6], rotation: [-0.06, -0.88, 0.08] },
    {
      text: "MEU CORAÇÃO ESCOLHEU VOCÊ", position: [-5.8, -2.5, 2.7], rotation: [0.08, 0.72, 0.05]
    },
    {
      text: "PARA SEMPRE JUNTOS", position: [5.4, -2.2, 3.5], rotation: [-0.06, -0.72, -0.06]
    }
  ];

  items.forEach((item, index) => {
    const geometry = new TextGeometry(item.text, {
      font,
      size: window.innerWidth < 700 ? 0.14 : 0.18,
      depth: 0.085,
      curveSegments: 18,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.009,
      bevelSegments: 7
    });

    centerTextGeometry(geometry);

    const mesh = new THREE.Mesh(
      geometry,
      createTextMaterial(index % 2 === 0 ? 0xff9fdc : 0xff819f)
    );

    mesh.position.set(...item.position);
    mesh.rotation.set(...item.rotation);
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.floatOffset = index * 1.4;
    mesh.userData.facesCamera = true;
    floatingTextGroup.add(mesh);
  });
}

function createLoveBurst() {
  const particleCount = window.innerWidth < 700 ? 145 : 250;
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const red = new THREE.Color(0xff174f);
  const pink = new THREE.Color(0xffb0e3);

  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * 3;
    const direction = new THREE.Vector3(
      randomBetween(-1, 1),
      randomBetween(-1, 1),
      randomBetween(-1, 1)
    ).normalize();

    const speed = randomBetween(2.1, 5.4);
    velocities[offset] = direction.x * speed;
    velocities[offset + 1] = direction.y * speed;
    velocities[offset + 2] = direction.z * speed;

    const color = red.clone().lerp(pink, Math.random());
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.095,
      map: glowTexture,
      alphaTest: 0.018,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    })
  );

  points.position.copy(centralHeart.position);
  world.add(points);
  bursts.push({ points, velocities, age: 0, duration: 1.65 });
}

function updateBursts(delta) {
  for (let burstIndex = bursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
    const burst = bursts[burstIndex];
    burst.age += delta;

    const positions = burst.points.geometry.attributes.position.array;

    for (let index = 0; index < positions.length; index += 3) {
      burst.velocities[index + 1] -= 0.8 * delta;
      positions[index] += burst.velocities[index] * delta;
      positions[index + 1] += burst.velocities[index + 1] * delta;
      positions[index + 2] += burst.velocities[index + 2] * delta;
    }

    burst.points.geometry.attributes.position.needsUpdate = true;
    burst.points.material.opacity = Math.max(0, 0.65 * (1 - burst.age / burst.duration));

    if (burst.age >= burst.duration) {
      world.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
      bursts.splice(burstIndex, 1);
    }
  }
}


function configureQuestionIntro() {
  if (!questionIntro || !questionYesButton || !questionNoButton || !questionButtons) {
    document.body.classList.remove("intro-active");
    lovePage?.setAttribute("aria-hidden", "false");
    return;
  }

  let isAccepted = false;
  let escapeCount = 0;
  let lastEscapeAt = 0;
  let hintTimer = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function createQuestionBurst() {
    if (!questionBurst || reducedMotion.matches) return;

    questionBurst.replaceChildren();

    for (let index = 0; index < 24; index += 1) {
      const heart = document.createElement("span");
      const angle = (index / 24) * Math.PI * 2 + Math.random() * 0.24;
      const distance = 82 + Math.random() * 120;

      heart.className = "question-burst__heart";
      heart.textContent = Math.random() > 0.34 ? "❤" : "♡";
      heart.style.setProperty("--burst-x", `${Math.cos(angle) * distance}px`);
      heart.style.setProperty("--burst-y", `${Math.sin(angle) * distance - 36}px`);
      heart.style.setProperty("--burst-rotation", `${(Math.random() - 0.5) * 170}deg`);
      heart.style.setProperty("--burst-delay", `${Math.random() * 120}ms`);
      heart.style.setProperty("--burst-size", `${10 + Math.random() * 11}px`);
      heart.style.setProperty(
        "--burst-color",
        Math.random() > 0.5 ? "#ff75b5" : "#ffd0e5"
      );

      questionBurst.appendChild(heart);
    }
  }

  function finishIntro() {
    resetStaticWorldView();
    isWorldStatic = false;
    questionIntro.classList.add("is-hidden");
    questionIntro.setAttribute("aria-hidden", "true");
    document.body.classList.remove("intro-active", "intro-revealing");
    lovePage?.setAttribute("aria-hidden", "false");

    window.setTimeout(() => {
      questionIntro.hidden = true;
      loveButton?.focus({ preventScroll: true });
    }, reducedMotion.matches ? 0 : 270);
  }

  function acceptQuestion() {
    if (isAccepted) return;
    isAccepted = true;

    if (backgroundMusic) {
      backgroundMusic.volume = 0.28;
      backgroundMusic.play().catch((error) => {
        console.warn("Não foi possível iniciar a música de fundo:", error);
      });
    }

    isWorldStatic = true;
    resetStaticWorldView();

    questionYesButton.disabled = true;
    questionNoButton.disabled = true;
    createQuestionBurst();
    questionIntro.classList.add("is-accepted");

    if (reducedMotion.matches) {
      finishIntro();
      return;
    }

    window.setTimeout(() => {
      questionIntro.classList.add("is-revealing");
      document.body.classList.add("intro-revealing");
    }, 650);

    window.setTimeout(finishIntro, 1550);
  }

  function overlaps(rectA, rectB, gap = 0) {
    return !(
      rectA.right + gap < rectB.left ||
      rectA.left - gap > rectB.right ||
      rectA.bottom + gap < rectB.top ||
      rectA.top - gap > rectB.bottom
    );
  }

  function moveNoButton(pointerEvent = null) {
    if (isAccepted) return;

    const now = performance.now();
    if (now - lastEscapeAt < 75) return;
    lastEscapeAt = now;

    const arenaRect = questionButtons.getBoundingClientRect();
    const buttonRect = questionNoButton.getBoundingClientRect();
    const yesRectPage = questionYesButton.getBoundingClientRect();
    const width = buttonRect.width;
    const height = buttonRect.height;
    const maxX = Math.max(0, arenaRect.width - width);
    const maxY = Math.max(0, arenaRect.height - height);
    const safeGap = 12;

    const yesRect = {
      left: yesRectPage.left - arenaRect.left,
      top: yesRectPage.top - arenaRect.top,
      right: yesRectPage.right - arenaRect.left,
      bottom: yesRectPage.bottom - arenaRect.top
    };

    let nextX = Math.random() * maxX;
    let nextY = Math.random() * maxY;

    for (let attempt = 0; attempt < 28; attempt += 1) {
      const candidate = {
        left: nextX,
        top: nextY,
        right: nextX + width,
        bottom: nextY + height
      };

      const pointerX = pointerEvent ? pointerEvent.clientX - arenaRect.left : null;
      const pointerY = pointerEvent ? pointerEvent.clientY - arenaRect.top : null;
      const pointerIsFarEnough =
        pointerX === null ||
        Math.hypot(pointerX - (nextX + width / 2), pointerY - (nextY + height / 2)) > 105;

      if (!overlaps(candidate, yesRect, safeGap) && pointerIsFarEnough) break;

      nextX = Math.random() * maxX;
      nextY = Math.random() * maxY;
    }

    questionNoButton.style.right = "auto";
    questionNoButton.style.left = `${Math.max(0, Math.min(maxX, nextX))}px`;
    questionNoButton.style.top = `${Math.max(0, Math.min(maxY, nextY))}px`;
    questionNoButton.style.transform = "none";

    questionNoButton.classList.remove("is-escaping");
    void questionNoButton.offsetWidth;
    questionNoButton.classList.add("is-escaping");

    escapeCount += 1;
    if (questionHint && escapeCount >= 2) {
      if (hintTimer === null) {
        questionHint.textContent = "O botão ‘não’ é um pouquinho tímido…";
        questionHint.classList.add("is-visible");

        hintTimer = window.setTimeout(() => {
          if (isAccepted) return;

          questionHint.textContent = "Acho que a resposta foi escolhida hehe";
        }, 15000);
      }

      questionHint.classList.add("is-visible");
    }
  }

  questionYesButton.addEventListener("click", acceptQuestion);

  questionNoButton.addEventListener("pointerenter", (event) => moveNoButton(event));
  questionNoButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    moveNoButton(event);
  });
  questionNoButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    moveNoButton(event);
  });
  questionNoButton.addEventListener("focus", () => moveNoButton());

  questionIntro.addEventListener("pointermove", (event) => {
    if (isAccepted || (event.pointerType && event.pointerType !== "mouse")) return;

    const rect = questionNoButton.getBoundingClientRect();
    const closestX = Math.max(rect.left, Math.min(event.clientX, rect.right));
    const closestY = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
    const distance = Math.hypot(event.clientX - closestX, event.clientY - closestY);

    if (distance < 78) moveNoButton(event);
  });

  window.addEventListener("resize", () => {
    if (isAccepted) return;
    questionNoButton.style.left = "";
    questionNoButton.style.right = "";
    questionNoButton.style.top = "";
    questionNoButton.style.transform = "";
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      document.body.classList.contains("intro-active") &&
      document.activeElement !== questionNoButton
    ) {
      event.preventDefault();
      acceptQuestion();
    }
  });

}

function configureLetter() {
  const stopScenePointer = (event) => event.stopPropagation();
  let suppressNextContextMenu = false;

  [loveAction, letterOverlay, loveLetter].forEach((element) => {
    element.addEventListener("pointerdown", stopScenePointer);
    element.addEventListener("pointermove", stopScenePointer);
    element.addEventListener("pointerup", stopScenePointer);
    element.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });

  function setLetterOpen(isOpen) {
    letterOverlay.classList.toggle("is-open", isOpen);
    letterOverlay.setAttribute("aria-hidden", String(!isOpen));
    loveButton.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      createLoveBurst();
      window.setTimeout(() => letterClose.focus(), 80);
    } else {
      window.setTimeout(() => loveButton.focus(), 40);
    }
  }

  loveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLetterOpen(true);
  });

  letterClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLetterOpen(false);
  });

  letterOverlay.addEventListener("click", (event) => {
    if (event.target === letterOverlay) setLetterOpen(false);
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      const isMouseClick = event.pointerType === "mouse";
      const isPrimaryOrSecondaryButton = event.button === 0 || event.button === 2;

      if (
        !letterOverlay.classList.contains("is-open") ||
        !isMouseClick ||
        !isPrimaryOrSecondaryButton
      ) {
        return;
      }

      suppressNextContextMenu = event.button === 2;
      event.preventDefault();
      event.stopPropagation();
      setLetterOpen(false);
    },
    true
  );

  document.addEventListener(
    "contextmenu",
    (event) => {
      if (!suppressNextContextMenu) return;

      suppressNextContextMenu = false;
      event.preventDefault();
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && letterOverlay.classList.contains("is-open")) {
      event.preventDefault();
      setLetterOpen(false);
    }
  });
}

function configureHeartCursorTrail() {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cursor = document.getElementById("heartCursor");
  const trail = document.getElementById("heartTrail");

  if (!finePointer.matches || !cursor || !trail) return;

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let cursorX = targetX;
  let cursorY = targetY;
  let lastTrailAt = 0;
  let lastPointerX = targetX;
  let lastPointerY = targetY;
  let isOverLoveButton = false;
  let isOverLetter = false;
  let animationFrameId = null;
  let isCursorAnimationRunning = false;

  const pinkTones = ["#ff76b8", "#ff9dca"];
  const buttonTones = ["#fff0f8", "#ff72b2"];

  function animateCursor() {
    if (!isCursorAnimationRunning) {
      animationFrameId = null;
      return;
    }

    cursorX += (targetX - cursorX) * 0.24;
    cursorY += (targetY - cursorY) * 0.24;

    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;

    animationFrameId = window.requestAnimationFrame(animateCursor);
  }

  function startCursorAnimation() {
    if (isCursorAnimationRunning) return;

    isCursorAnimationRunning = true;
    animationFrameId = window.requestAnimationFrame(animateCursor);
  }

  function stopCursorAnimation() {
    isCursorAnimationRunning = false;

    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function createTrailParticle(x, y, isButtonParticle = false) {
    if (reducedMotion.matches || isOverLetter) return;

    if (trail.childElementCount >= 32) {
      trail.firstElementChild?.remove();
    }

    const particle = document.createElement("span");
    const tones = isButtonParticle ? buttonTones : pinkTones;
    const drift = isButtonParticle ? 28 : 20;
    const lift = isButtonParticle ? 34 : 24;

    particle.className = `heart-trail-particle${isButtonParticle ? " is-button-particle" : ""}`;
    particle.textContent = Math.random() > 0.42 ? "❤" : "♡";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty("--trail-color", tones[Math.floor(Math.random() * tones.length)]);
    particle.style.setProperty("--trail-size", `${isButtonParticle ? 11 + Math.random() * 5 : 9 + Math.random() * 4}px`);
    particle.style.setProperty("--trail-x", `${(Math.random() - 0.5) * drift}px`);
    particle.style.setProperty("--trail-y", `${-(lift + Math.random() * 18)}px`);
    particle.style.setProperty("--trail-rotation", `${(Math.random() - 0.5) * 70}deg`);
    particle.style.setProperty("--trail-scale", `${1.05 + Math.random() * 0.42}`);
    particle.style.setProperty("--trail-duration", `${isButtonParticle ? 720 + Math.random() * 180 : 760 + Math.random() * 180}ms`);
    particle.style.setProperty(
      "--trail-glow",
      isButtonParticle ? "rgba(255, 95, 170, 0.32)" : "rgba(255, 120, 184, 0.18)"
    );

    trail.appendChild(particle);
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
  }

  function emitButtonSparkle(x, y) {
    for (let index = 0; index < 3; index += 1) {
      window.setTimeout(() => {
        createTrailParticle(
          x + (Math.random() - 0.5) * 14,
          y + (Math.random() - 0.5) * 10,
          true
        );
      }, index * 28);
    }
  }

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;

    targetX = event.clientX;
    targetY = event.clientY;
    cursor.classList.add("is-visible");
    startCursorAnimation();

    const elementUnderPointer = event.target instanceof Element ? event.target : null;
    isOverLoveButton = Boolean(elementUnderPointer?.closest("#loveButton, #questionYesButton, #questionNoButton"));
    isOverLetter = Boolean(elementUnderPointer?.closest(".love-letter"));
    cursor.classList.toggle("is-over-love-button", isOverLoveButton);

    const now = performance.now();
    const distance = Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
    const minimumInterval = isOverLoveButton ? 26 : 42;

    if (distance >= 4 && now - lastTrailAt >= minimumInterval) {
      createTrailParticle(event.clientX, event.clientY, isOverLoveButton);
      lastTrailAt = now;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    }
  }, { capture: true, passive: true });

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    cursor.classList.add("is-pressed");

    if (event.target instanceof Element && event.target.closest("#loveButton, #questionYesButton, #questionNoButton")) {
      emitButtonSparkle(event.clientX, event.clientY);
    }
  }, { capture: true, passive: true });

  document.addEventListener("pointerup", () => {
    cursor.classList.remove("is-pressed");
  }, { capture: true, passive: true });

  document.addEventListener("pointerleave", () => {
    cursor.classList.remove("is-visible", "is-over-love-button", "is-pressed");
    stopCursorAnimation();
  });

  document.addEventListener("pointerenter", (event) => {
    if (!event.pointerType || event.pointerType === "mouse") {
      targetX = event.clientX;
      targetY = event.clientY;
      cursor.classList.add("is-visible");
      startCursorAnimation();
    }
  });

  loveButton?.addEventListener("mouseenter", () => {
    cursor.classList.add("is-over-love-button");
    emitButtonSparkle(targetX, targetY);
  });

  loveButton?.addEventListener("mouseleave", () => {
    cursor.classList.remove("is-over-love-button");
  });

  questionYesButton?.addEventListener("mouseenter", () => {
    cursor.classList.add("is-over-love-button");
    emitButtonSparkle(targetX, targetY);
  });

  questionYesButton?.addEventListener("mouseleave", () => {
    cursor.classList.remove("is-over-love-button");
  });

  window.addEventListener("blur", () => {
    cursor.classList.remove("is-visible", "is-over-love-button", "is-pressed");
    stopCursorAnimation();
  });

  window.addEventListener("beforeunload", () => {
    stopCursorAnimation();
  });
}

function configureInteraction() {
  renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

  renderer.domElement.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetCamera();
  });

  window.addEventListener(
    "wheel",
    (event) => {
      if (event.target === renderer.domElement || event.ctrlKey) event.preventDefault();
    },
    { passive: false }
  );

  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    window.addEventListener(eventName, (event) => event.preventDefault(), {
      passive: false
    });
  });

  document.addEventListener("selectstart", (event) => event.preventDefault());
  document.addEventListener("dragstart", (event) => event.preventDefault());
}

function resetCamera() {
  camera.position.copy(initialCameraPosition);
  camera.up.set(0, 1, 0);
  controls.target.set(0, -0.1, 0);
  controls.update();
}

function resetStaticWorldView() {
  resetCamera();

  if (environmentDust) {
    environmentDust.rotation.set(0, 0, 0);
  }

  if (centralHeart) {
    centralHeart.rotation.set(0, 0, 0);
    centralHeart.scale.setScalar(window.innerWidth < 700 ? 0.88 : 1);
  }

  if (orbitTextGroup) {
    orbitTextGroup.rotation.set(0, 0, 0);
  }

  if (floatingTextGroup) {
    floatingTextGroup.children.forEach((mesh) => {
      mesh.position.y = mesh.userData.baseY;
    });
  }

  floorRings.forEach((ring) => {
    ring.scale.setScalar(1);
    ring.material.opacity = ring.userData.baseOpacity;
  });

  if (floorGlow) {
    floorGlow.material.opacity = 0.026;
  }
}

function configureResize() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(getRenderPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    multisampleTarget.samples = Math.min(
      window.innerWidth < 700 ? 2 : 4,
      renderer.capabilities.maxSamples || 4
    );
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);

    window.clearTimeout(resizeTimer);

    resizeTimer = window.setTimeout(() => {
      if (!loadedFont) {
        createHeartFaceTexts();
        return;
      }

      disposeObject3D(orbitTextGroup);
      disposeObject3D(floatingTextGroup);

      orbitTextGroup = null;
      floatingTextGroup = null;

      createOrbitingText(loadedFont);
      createFloatingText(loadedFont);
      createHeartFaceTexts();
    }, 180);
  });
}

function orientTextTowardCamera(group) {
  if (!group) return;

  group.children.forEach((object) => {
    if (object.userData.facesCamera) {
      object.lookAt(camera.position);
    }
  });
}

function animateWorld(elapsed, delta) {
  if (environmentDust) {
    environmentDust.rotation.y += delta * 0.01;
    environmentDust.rotation.x = Math.sin(elapsed * 0.08) * 0.03;
  }

  if (centralHeart) {
    const pulse = 1 + Math.sin(elapsed * 2.15) * 0.018;
    const baseScale = window.innerWidth < 700 ? 0.88 : 1;
    centralHeart.scale.setScalar(baseScale * pulse);
    centralHeart.rotation.y += delta * 0.07;
    centralHeart.rotation.x = Math.sin(elapsed * 0.28) * 0.025;

    const sparkle = 0.32 + Math.sin(elapsed * 3.2) * 0.055;
    centralHeart.userData.particles.material.opacity = sparkle;
    centralHeart.userData.glowShell.material.opacity = 0.055 + Math.sin(elapsed * 2.15) * 0.012;
  }

  ambientHeartGroups.forEach((group) => {
    group.position.y =
      group.userData.baseY +
      Math.sin(elapsed * 0.62 + group.userData.floatOffset) * 0.23;
    group.rotation.y += delta * group.userData.rotationSpeed;

    const pulse = 1 + Math.sin(elapsed * 1.45 + group.userData.pulseOffset) * 0.025;
    const originalScale = group.userData.originalScale || group.scale.x;
    group.userData.originalScale = originalScale;
    group.scale.setScalar(originalScale * pulse);
  });

  if (orbitTextGroup) {
    orbitTextGroup.rotation.y += delta * 0.23;
    orbitTextGroup.rotation.z = Math.sin(elapsed * 0.22) * 0.045;
  }

  if (floatingTextGroup) {
    floatingTextGroup.children.forEach((mesh) => {
      mesh.position.y =
        mesh.userData.baseY +
        Math.sin(elapsed * 0.72 + mesh.userData.floatOffset) * 0.15;
    });
  }

  floorRings.forEach((ring, index) => {
    const wave = 0.5 + 0.5 * Math.sin(elapsed * 1.35 - ring.userData.phase);
    const scale = 0.96 + wave * 0.08;
    ring.scale.setScalar(scale);
    ring.material.opacity = ring.userData.baseOpacity * (0.55 + wave * 0.45);
    ring.rotation.z += delta * (0.025 + index * 0.004);
  });

  if (floorGlow) {
    floorGlow.material.opacity = 0.024 + Math.sin(elapsed * 1.4) * 0.006;
  }

  updateBursts(delta);
}

function render(timestamp) {
  requestAnimationFrame(render);

  if (!isDocumentVisible) return;

  if (
    isWorldStatic &&
    timestamp - lastStaticRenderAt < staticRenderInterval
  ) {
    return;
  }

  lastStaticRenderAt = timestamp;

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  controls.update();
  if (!isWorldStatic) {
    animateWorld(elapsed, delta);
  }
  orientTextTowardCamera(orbitTextGroup);
  orientTextTowardCamera(floatingTextGroup);
  composer.render();
}
