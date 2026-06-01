const core = document.querySelector('[data-nexus-core]');

if (core) {
  initNexusStudyCore(core);
}

async function initNexusStudyCore(root) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const weakDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 2);

  if (reduceMotion || isMobile || saveData || weakDevice || !hasWebGL()) {
    showFallback(root);
    return;
  }

  let THREE;
  try {
    THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  } catch (error) {
    showFallback(root);
    return;
  }

  const mount = root.querySelector('[data-nexus-canvas]');
  if (!mount) {
    showFallback(root);
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  mount.appendChild(renderer.domElement);

  const stage = new THREE.Group();
  const coreGroup = new THREE.Group();
  const particleGroup = new THREE.Group();
  const cardGroup = new THREE.Group();
  stage.add(coreGroup, particleGroup, cardGroup);
  scene.add(stage);

  scene.add(new THREE.HemisphereLight(0xbcefff, 0x062229, 1.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xffdf7b, 2.4, 8);
  rimLight.position.set(-2.6, 1.7, 2.2);
  scene.add(rimLight);

  const cyan = new THREE.Color('#9bd9ea');
  const gold = new THREE.Color('#ffe088');
  const pillWrap = new THREE.Group();
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.54, 1.9, 8, 18),
    new THREE.MeshStandardMaterial({
      color: '#eafcff',
      roughness: 0.32,
      metalness: 0.08,
      emissive: '#123c43',
      emissiveIntensity: 0.08
    })
  );
  capsule.rotation.z = Math.PI / 2;
  pillWrap.add(capsule);

  const pillBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.565, 0.565, 0.18, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#cba72f',
      roughness: 0.38,
      metalness: 0.18,
      emissive: '#735c00',
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide
    })
  );
  pillBand.rotation.z = Math.PI / 2;
  pillWrap.add(pillBand);
  coreGroup.add(pillWrap);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 24, 12),
    new THREE.MeshBasicMaterial({
      color: '#9bd9ea',
      transparent: true,
      opacity: 0.075,
      blending: THREE.AdditiveBlending
    })
  );
  coreGroup.add(glow);

  const ringBase = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.16, 96),
    new THREE.MeshBasicMaterial({
      color: cyan,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    })
  );
  const ringProgress = new THREE.Mesh(
    new THREE.RingGeometry(2.02, 2.24, 96, 1, -0.8, Math.PI * 1.45),
    new THREE.MeshBasicMaterial({
      color: gold,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    })
  );
  const ringHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.92, 2.34, 96),
    new THREE.MeshBasicMaterial({
      color: cyan,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  );
  coreGroup.add(ringHalo, ringBase, ringProgress);

  const orbitMaterial = new THREE.MeshBasicMaterial({
    color: cyan,
    transparent: true,
    opacity: 0.22
  });
  [
    [2.25, 0, 0.62, 0.1],
    [2.02, 1.04, -0.18, 0.55],
    [1.82, -0.92, 0.45, -0.35]
  ].forEach(([radius, xRot, yRot, zRot]) => {
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.008, 6, 96),
      orbitMaterial
    );
    orbit.rotation.set(xRot, yRot, zRot);
    coreGroup.add(orbit);
  });

  const particleMaterial = new THREE.MeshBasicMaterial({
    color: '#c9f6ff',
    transparent: true,
    opacity: 0.8
  });
  const particles = Array.from({ length: 24 }, (_, index) => {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(index % 5 === 0 ? 0.045 : 0.028, 8, 6),
      particleMaterial
    );
    particle.userData = {
      radius: 1.55 + (index % 4) * 0.22,
      speed: 0.22 + (index % 6) * 0.035,
      phase: index * 0.72,
      tilt: (index % 3 - 1) * 0.45
    };
    particleGroup.add(particle);
    return particle;
  });

  const labels = [
    { label: 'Clinical', x: -2.32, y: 1.12, z: 0.15, width: 1.22, height: 0.5 },
    { label: 'Practice', x: 2.28, y: 0.94, z: -0.08, width: 1.28, height: 0.5 },
    { label: 'Recall', x: -2.04, y: -1.12, z: 0.18, width: 1.12, height: 0.5 },
    { label: 'Final Exam', x: 2.06, y: -1.1, z: 0.05, width: 1.48, height: 0.52, gold: true },
    { label: "Today's Mission", subtitle: '12 weak Qs', x: 2.18, y: -0.12, z: 0.34, width: 1.72, height: 0.62, dark: true },
    { label: 'Saved Mistakes', subtitle: 'Antibiotics', x: -2.18, y: 0.02, z: 0.28, width: 1.64, height: 0.62, dark: true, gold: true }
  ];
  const cards = labels.map((item, index) => {
    const texture = makeCardTexture(THREE, item.label, item);
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(item.width, item.height),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      })
    );
    card.position.set(item.x, item.y, item.z);
    card.userData = { baseY: item.y, phase: index * 1.4 };
    cardGroup.add(card);
    return card;
  });

  let frameId = 0;
  let disposed = false;
  let pointerX = 0;
  let pointerY = 0;
  const clock = new THREE.Clock();

  function resize() {
    const rect = mount.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function animate() {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    if (document.hidden) return;

    const elapsed = clock.getElapsedTime();
    stage.rotation.y += (pointerX * 0.18 + Math.sin(elapsed * 0.3) * 0.035 - stage.rotation.y) * 0.045;
    stage.rotation.x += (-pointerY * 0.1 + Math.sin(elapsed * 0.24) * 0.025 - stage.rotation.x) * 0.045;

    pillWrap.rotation.y = elapsed * 0.34;
    pillWrap.rotation.x = Math.sin(elapsed * 0.8) * 0.08;
    ringProgress.rotation.z = elapsed * 0.22;
    particleGroup.rotation.z = elapsed * 0.08;

    particles.forEach((particle) => {
      const data = particle.userData;
      const angle = elapsed * data.speed + data.phase;
      particle.position.set(
        Math.cos(angle) * data.radius,
        Math.sin(angle) * data.radius * 0.42 + Math.sin(angle + data.tilt) * 0.22,
        Math.sin(angle) * data.radius * 0.52
      );
    });

    cards.forEach((card) => {
      card.position.y = card.userData.baseY + Math.sin(elapsed * 0.8 + card.userData.phase) * 0.08;
      card.lookAt(camera.position);
    });

    renderer.render(scene, camera);
  }

  function onPointerMove(event) {
    const rect = root.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  }

  function onPointerLeave() {
    pointerX = 0;
    pointerY = 0;
  }

  function destroy() {
    disposed = true;
    cancelAnimationFrame(frameId);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
    resizeObserver.disconnect();
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (object.material.map) object.material.map.dispose();
        object.material.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);
  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('pagehide', destroy, { once: true });

  resize();
  root.classList.add('is-ready');
  animate();
}

function makeCardTexture(THREE, label, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 216;
  const ctx = canvas.getContext('2d');
  const radius = 42;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.moveTo(radius, 18);
  ctx.lineTo(canvas.width - radius, 18);
  ctx.quadraticCurveTo(canvas.width - 18, 18, canvas.width - 18, radius);
  ctx.lineTo(canvas.width - 18, canvas.height - radius);
  ctx.quadraticCurveTo(canvas.width - 18, canvas.height - 18, canvas.width - radius, canvas.height - 18);
  ctx.lineTo(radius, canvas.height - 18);
  ctx.quadraticCurveTo(18, canvas.height - 18, 18, canvas.height - radius);
  ctx.lineTo(18, radius);
  ctx.quadraticCurveTo(18, 18, radius, 18);
  ctx.closePath();
  ctx.fillStyle = options.dark ? 'rgba(0,21,27,0.78)' : options.gold ? 'rgba(255,224,136,0.92)' : 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.strokeStyle = options.gold ? 'rgba(255,224,136,0.55)' : 'rgba(155,217,234,0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = options.dark ? '#ffffff' : options.gold ? '#4e3d00' : '#00151b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (options.subtitle) {
    ctx.font = '900 30px Manrope, Arial, sans-serif';
    ctx.fillText(label.toUpperCase(), canvas.width / 2, canvas.height / 2 - 16);
    ctx.fillStyle = options.gold ? '#ffe088' : '#9bd9ea';
    ctx.font = '800 24px Manrope, Arial, sans-serif';
    ctx.fillText(options.subtitle.toUpperCase(), canvas.width / 2, canvas.height / 2 + 26);
  } else {
    ctx.font = `900 ${label.length > 12 ? 35 : 46}px Manrope, Arial, sans-serif`;
    ctx.fillText(label.toUpperCase(), canvas.width / 2, canvas.height / 2 + 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (error) {
    return false;
  }
}

function showFallback(root) {
  root.classList.add('is-ready', 'is-fallback');
}
