/* ==========================================================
   three-scene.js  —  Three.js visual layer
   ambientParticles() — full-page floating botanical particles
   ========================================================== */

import * as THREE from 'three';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----------------------------------------------------------
   Full-page ambient particle field
---------------------------------------------------------- */
(function ambientParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 30);
  camera.position.z = 10;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  /* Soft circular sprite */
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = spriteCanvas.height = 64;
  const pctx  = spriteCanvas.getContext('2d');
  const pgrad = pctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  pgrad.addColorStop(0, 'rgba(255,255,255,1)');
  pgrad.addColorStop(1, 'rgba(255,255,255,0)');
  pctx.fillStyle = pgrad;
  pctx.fillRect(0, 0, 64, 64);
  const spriteTex = new THREE.CanvasTexture(spriteCanvas);

  /* Particle data */
  const count     = window.innerWidth < 700 ? 55 : 130;
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);
  const speeds    = new Float32Array(count);
  const phases    = new Float32Array(count);

  const palette = [
    new THREE.Color(0x7da18c),  // soft botanical green
    new THREE.Color(0xe8c092),  // warm honey earth
    new THREE.Color(0xaacfb8),  // light sage
  ];

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    speeds[i]  = 0.15 + Math.random() * 0.35;
    phases[i]  = Math.random() * Math.PI * 2;
    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const mat = new THREE.PointsMaterial({
    size: 0.16,
    map: spriteTex,
    transparent: true,
    opacity: 0.55,
    vertexColors: true,
    depthWrite: false,
    sizeAttenuation: true,
  });

  scene.add(new THREE.Points(geo, mat));

  /* Resize */
  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  /* Static frame for reduced-motion users */
  if (reducedMotion) {
    renderer.render(scene, camera);
    return;
  }

  /* Drift animation */
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t   = clock.getElapsedTime();
    const pos = geo.attributes.position.array;

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speeds[i] * 0.004;
      pos[i * 3]     += Math.sin(t * 0.4 + phases[i]) * 0.0018;
      // Wrap particles that drift off the top
      if (pos[i * 3 + 1] > 6.2) {
        pos[i * 3 + 1] = -6.2;
        pos[i * 3]     = (Math.random() - 0.5) * 16;
      }
    }
    geo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }
  animate();
})();
