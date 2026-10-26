// Graphlay — interactive 3D hero (Three.js r169, self-hosted, MIT licence)
import * as THREE from './three.module.min.js';

const root = document.documentElement;
const canvas = document.getElementById('stage');
const hero = document.querySelector('.hero');

const fail = () => root.classList.add('no-webgl');

let renderer = null;
if (canvas && hero) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (_) {
    fail();
  }
} else {
  fail();
}
if (renderer) start(renderer);

function start(renderer) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const clamp = THREE.MathUtils.clamp;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.6;

  const CAM_Z = 15;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.9, CAM_Z);
  camera.lookAt(0, 0, 0);

  // Lights
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xc9b49a, 1.0));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
  key.position.set(4, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  key.shadow.radius = 10;
  key.shadow.blurSamples = 12;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.45);
  fill.position.set(-8, 2, 4);
  scene.add(fill);

  // Shadow catcher "floor"
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ color: 0x3b2614, opacity: 0.2 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Materials
  const C = {
    verm: 0xE4471B, mari: 0xF0A22E, indigo: 0x23308C, leaf: 0x2E6B57,
    ink: 0x1d1a16, pink: 0xE98BA8, cream: 0xF7F0E4,
  };
  const gloss = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.16 });
  const clay = (c, flat = false) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.74, metalness: 0, flatShading: flat });
  const satin = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, sheen: 0.7, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffffff) });

  const defs = [
    { g: new THREE.TorusGeometry(1.15, 0.46, 48, 128), m: gloss(C.verm), p: [0.4, 0.9, 0], r: [1.0, 0.35, 0.15], size: 1.6 },
    { g: new THREE.SphereGeometry(1.0, 64, 48), m: clay(C.mari), p: [2.6, -0.5, 0.4], r: [0, 0, 0], size: 1.0 },
    { g: new THREE.CapsuleGeometry(0.5, 1.5, 12, 32), m: gloss(C.indigo), p: [-1.5, -0.6, 0.9], r: [0.3, 0.2, -0.9], size: 1.2 },
    { g: new THREE.ConeGeometry(0.8, 1.6, 64, 1), m: clay(C.leaf), p: [0.7, -1.75, -1.0], r: [0.25, 0, 0.35], size: 1.0 },
    { g: new THREE.TorusKnotGeometry(0.5, 0.17, 180, 24), m: gloss(C.ink), p: [2.8, 1.85, -1.0], r: [0.4, 0.3, 0], size: 0.8 },
    { g: new THREE.CylinderGeometry(0.72, 0.72, 0.26, 64), m: satin(C.pink), p: [-1.7, 1.6, -0.6], r: [1.15, 0.2, 0.4], size: 0.8 },
    { g: new THREE.IcosahedronGeometry(0.58, 0), m: clay(C.cream, true), p: [1.45, 0.05, 2.2], r: [0.3, 0.5, 0.1], size: 0.6 },
    { g: new THREE.SphereGeometry(0.22, 32, 24), m: gloss(C.verm), p: [-0.4, -1.95, 1.6], r: [0, 0, 0], size: 0.25 },
    { g: new THREE.SphereGeometry(0.17, 32, 24), m: gloss(C.indigo), p: [3.95, 0.7, 0.8], r: [0, 0, 0], size: 0.2 },
    { g: new THREE.SphereGeometry(0.2, 32, 24), m: clay(C.mari), p: [-2.65, 0.65, 0.4], r: [0, 0, 0], size: 0.22 },
  ];

  const rig = new THREE.Group();     // placed by layout()
  const cluster = new THREE.Group(); // follows the pointer
  rig.add(cluster);
  scene.add(rig);

  const objs = defs.map((d, i) => {
    const mesh = new THREE.Mesh(d.g, d.m);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.position.set(...d.p);
    mesh.rotation.set(...d.r);
    mesh.userData = {
      base: new THREE.Vector3(...d.p),
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      rs: new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.45, 0),
      size: d.size,
      fa: 0.12 + Math.random() * 0.14,          // float amplitude
      fs: 0.6 + Math.random() * 0.5,            // float speed
      ph: Math.random() * Math.PI * 2,          // phase
      sc: 1, sv: 0,                             // squash spring
      delay: reduce ? -10 : 0.15 + i * 0.07,    // intro pop-in
    };
    cluster.add(mesh);
    return mesh;
  });

  // Centre the cluster around the origin and measure it
  const box = new THREE.Box3().setFromObject(cluster);
  const centre = box.getCenter(new THREE.Vector3());
  objs.forEach((o) => { o.userData.base.sub(centre); o.position.copy(o.userData.base); });
  const size = box.getSize(new THREE.Vector3());
  const CW = size.x, CH = size.y;

  // ---------- Layout ----------
  let baseY = 0;
  let lastW = 0, lastH = 0;
  const NAV = 72;

  function layout(force = false) {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h;

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    const visW = visH * camera.aspect;
    const upp = visH / h; // world units per CSS pixel
    const portrait = w / window.innerHeight < 0.95 || w <= 760;

    let s, x, y;
    if (portrait) {
      const bandPx = window.innerHeight * 0.4;          // matches padding-top: 40svh
      const bandH = Math.max(140, bandPx - NAV - 20);
      s = Math.min((visW * 0.92) / CW, (bandH * upp) / CH);
      x = 0;
      const cy = NAV + 6 + bandH / 2;
      y = visH / 2 - cy * upp;
    } else {
      s = clamp((visW * 0.4) / CW, 0.45, 1.15);
      x = visW / 2 - (CW * s) / 2 - visW * 0.045;
      y = 0.25;
    }
    rig.scale.setScalar(s);
    rig.position.set(x, y, 0);
    baseY = y;
    floor.position.y = y - (CH * s) / 2 - 0.7 * s;
    floor.visible = !portrait; // floor would be seen edge-on when the shapes sit above eye level
    key.position.set(x + 4, y + 10, 7);
    key.target.position.set(x, y, 0);
  }

  // ---------- Pointer ----------
  const ndc = new THREE.Vector2(0, 0);
  const smooth = new THREE.Vector2(0, 0);
  let pointerIn = false;
  let lastMove = -10;
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const ptrLocal = new THREE.Vector3(999, 999, 999);

  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointerIn = e.clientY >= r.top && e.clientY <= r.bottom;
  };

  window.addEventListener('pointermove', (e) => {
    toNdc(e);
    lastMove = clock.elapsedTime;
    if (!coarse) {
      raycaster.setFromCamera(ndc, camera);
      const over = raycaster.intersectObjects(objs, false).length > 0;
      canvas.style.cursor = over ? 'pointer' : '';
    }
  }, { passive: true });
  window.addEventListener('pointerleave', () => { pointerIn = false; }, { passive: true });
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) pointerIn = false; }, { passive: true });

  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    toNdc(e);
    lastMove = clock.elapsedTime;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(objs, false);
    if (hits.length) {
      const u = hits[0].object.userData;
      u.sv -= 9;                                           // squash
      u.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 6);
      u.vel.add(new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 3, (Math.random() - 0.5) * 4));
    } else if (raycaster.ray.intersectPlane(plane, hit)) {
      // ripple: nudge everything away from the tap point
      const local = cluster.worldToLocal(hit.clone());
      objs.forEach((o) => {
        const d = o.position.clone().sub(local);
        const dist = Math.max(0.6, d.length());
        o.userData.vel.addScaledVector(d.normalize(), 9 / dist);
        o.userData.spin.addScalar((Math.random() - 0.5) * 3);
      });
    }
    wake();
  });

  // ---------- Animation ----------
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const d = new THREE.Vector3();
  const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

  let running = false;
  let visible = true;
  let firstFrame = true;
  let rafId = 0;

  function frame() {
    rafId = 0;
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const t = clock.elapsedTime;

    // scroll progress through the hero (0 → 1)
    const rect = hero.getBoundingClientRect();
    const sp = clamp(-rect.top / Math.max(1, rect.height), 0, 1);
    const spread = 1 + sp * 0.9;

    // pointer → cluster rotation (or gentle sway when idle / touch)
    const active = pointerIn && !coarse && t - lastMove < 6;
    const tx = active ? ndc.x : (reduce ? 0 : Math.sin(t * 0.35) * 0.5);
    const ty = active ? ndc.y : (reduce ? 0 : Math.cos(t * 0.27) * 0.3);
    const k = 1 - Math.exp(-3 * dt);
    smooth.x += (tx - smooth.x) * k;
    smooth.y += (ty - smooth.y) * k;
    cluster.rotation.y = smooth.x * 0.38;
    cluster.rotation.x = -smooth.y * 0.22;
    rig.rotation.z = sp * 0.22;
    rig.position.y = baseY + sp * 2.2;

    // pointer position in cluster space
    if (pointerIn) {
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) { ptrLocal.copy(hit); cluster.worldToLocal(ptrLocal); }
    } else {
      ptrLocal.set(999, 999, 999);
    }

    for (const o of objs) {
      const u = o.userData;
      const fy = reduce ? 0 : Math.sin(t * u.fs + u.ph) * u.fa;
      tmp.copy(u.base).multiplyScalar(spread);
      tmp.y += fy;

      acc.subVectors(tmp, o.position).multiplyScalar(16);              // spring home
      d.subVectors(o.position, ptrLocal);
      const dist = d.length();
      const R = 1.6 + u.size;
      if (dist < R && dist > 1e-4) acc.addScaledVector(d.multiplyScalar(1 / dist), (R - dist) * 34); // repel

      u.vel.addScaledVector(acc, dt);
      u.vel.multiplyScalar(Math.exp(-5.5 * dt));
      o.position.addScaledVector(u.vel, dt);

      u.spin.multiplyScalar(Math.exp(-2.4 * dt));
      const idle = reduce ? 0 : 1;
      o.rotation.x += (u.rs.x * idle + u.spin.x) * dt;
      o.rotation.y += (u.rs.y * idle + u.spin.y) * dt;
      o.rotation.z += u.spin.z * dt;

      u.sv += ((1 - u.sc) * 170 - u.sv * 11) * dt;                     // squash spring
      u.sc += u.sv * dt;
      const intro = easeOutBack(clamp((t - u.delay) / 0.9, 0, 1));
      o.scale.setScalar(Math.max(0.0001, u.sc * intro));
    }

    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; canvas.classList.add('ready'); }
    if (running) rafId = requestAnimationFrame(frame);
  }

  function wake() {
    if (!running && visible && !document.hidden) {
      running = true;
      clock.getDelta();
      rafId = requestAnimationFrame(frame);
    }
  }
  function sleep() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // Only render while the hero is on screen and the tab is visible
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) wake(); else sleep();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (document.hidden) sleep(); else wake(); });

  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { layout(); if (!running) frame(); }, 120);
  }, { passive: true });

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); sleep(); fail(); });

  layout(true);
  wake();
}

// A tiny procedural studio environment for soft, realistic reflections
function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(24, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xcbbda8, side: THREE.BackSide })
  );
  env.add(room);
  const panel = (w, h, pos, intensity, color) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(10, 5, [0, 11, 3], 5, 0xffffff);     // softbox above
  panel(5, 8, [-11, 2, 5], 2.2, 0xffe2c4);   // warm side
  panel(5, 8, [11, 1, -3], 1.6, 0xdde6ff);   // cool rim
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}
