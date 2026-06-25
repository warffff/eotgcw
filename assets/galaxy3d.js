(function(){
  'use strict';

  const MAX_WAIT_MS = 9000;
  const startedAt = Date.now();
  let bootTimer = null;

  function ready(){
    return typeof THREE !== 'undefined'
      && typeof galaxyPlanets !== 'undefined'
      && typeof galaxyMapShell !== 'undefined'
      && document.getElementById('galaxy3dStage')
      && document.getElementById('galaxy3dCanvas');
  }

  function waitForDependencies(){
    if (ready()) return initGalaxy3D();
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      const stage = document.getElementById('galaxy3dStage');
      if (stage) {
        stage.innerHTML = '<div class="galaxy-3d-error">3D-карта не загрузилась. Проверьте подключение к CDN three.js.</div>';
      }
      return;
    }
    bootTimer = setTimeout(waitForDependencies, 120);
  }

  function initGalaxy3D(){
    if (bootTimer) clearTimeout(bootTimer);

    const shell = document.getElementById('galaxyMapShell');
    const stage = document.getElementById('galaxy3dStage');
    const canvas = document.getElementById('galaxy3dCanvas');
    const labelsLayer = document.getElementById('galaxy3dLabels');
    if (!shell || !stage || !canvas || !labelsLayer) return;

    shell.classList.add('galaxy-3d-ready');

    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const starsGroup = new THREE.Group();
    scene.add(starsGroup);
    scene.add(group);

    const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);
    camera.position.set(0, -55, 980);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const ambient = new THREE.AmbientLight(0xaee8ff, 0.82);
    const key = new THREE.PointLight(0x6bdcff, 2.2, 1700);
    key.position.set(-260, -300, 760);
    const red = new THREE.PointLight(0xff5470, 1.4, 1200);
    red.position.set(440, 220, 360);
    scene.add(ambient, key, red);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const planetMeshes = new Map();
    const planetLabels = new Map();
    let sectorLayer = new THREE.Group();
    let nebula = null;
    let selectedName = '';
    let isDragging = false;
    let dragMoved = false;
    let last = { x:0, y:0 };
    let targetRot = { x:-0.34, y:0.18 };
    let currentRot = { x:targetRot.x, y:targetRot.y };
    let targetZoom = 980;
    let currentZoom = 980;

    const colorMap = {
      republic: 0x5ee7ff,
      cis: 0xff4260,
      neutral: 0xb7c9d8,
      contested: 0xd9e7ef
    };
    const glowMap = {
      republic: 0x1bd8ff,
      cis: 0xff284b,
      neutral: 0xbdd2e3,
      contested: 0xd9e7ef
    };

    function hash(text){
      let h = 2166136261;
      for (let i=0;i<String(text).length;i++) {
        h ^= String(text).charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return Math.abs(h >>> 0);
    }

    function mapTo3D(p){
      const h = hash(p.name || 'planet');
      const sectorDepth = ((Number(p.sector) || 1) - 3) * 18;
      return new THREE.Vector3((Number(p.x || 0) - 640) * 0.86, (410 - Number(p.y || 0)) * 0.86, ((h % 150) - 75) * 0.9 + sectorDepth);
    }

    function sectorPoint(point, sectorId){
      return new THREE.Vector3((point[0] - 640) * 0.86, (410 - point[1]) * 0.86, (Number(sectorId) - 3) * 18 - 35);
    }

    function planetControl(p){
      return p?.control === 'republic' ? 'republic' : p?.control === 'cis' ? 'cis' : 'neutral';
    }

    function visiblePlanetSet(){
      try {
        if (typeof galaxyFilteredPlanets === 'function') return new Set(galaxyFilteredPlanets());
      } catch (_) {}
      return new Set(galaxyPlanets || []);
    }

    function makeTextLabel(p){
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'galaxy-3d-label';
      label.textContent = p.name;
      label.dataset.name = p.name;
      label.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        choosePlanet(p);
      });
      labelsLayer.appendChild(label);
      planetLabels.set(p.name, label);
      return label;
    }

    function makePlanet(p){
      const control = planetControl(p);
      const base = colorMap[control] || colorMap.neutral;
      const glow = glowMap[control] || glowMap.neutral;
      const size = 5.4 + ((hash(p.name) % 32) / 32) * 3.2;
      const geometry = new THREE.SphereGeometry(size, 26, 18);
      const material = new THREE.MeshStandardMaterial({
        color: base,
        emissive: glow,
        emissiveIntensity: 0.42,
        roughness: 0.42,
        metalness: 0.14
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(mapTo3D(p));
      mesh.userData.planet = p;
      mesh.userData.baseSize = size;

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.8, size * 2.2, 48),
        new THREE.MeshBasicMaterial({ color: glow, transparent:true, opacity:0.24, side:THREE.DoubleSide, depthWrite:false })
      );
      halo.rotation.x = Math.PI / 2;
      halo.userData.isHalo = true;
      mesh.add(halo);

      group.add(mesh);
      planetMeshes.set(p.name, mesh);
      makeTextLabel(p);
      return mesh;
    }

    function buildNebula(){
      const positions = [];
      const colors = [];
      const colorA = new THREE.Color(0x5adfff);
      const colorB = new THREE.Color(0xff3f63);
      for (let i=0;i<900;i++) {
        const t = i / 900;
        const arm = i % 4;
        const radius = 80 + Math.pow(t, .72) * 610 + Math.random() * 26;
        const angle = t * Math.PI * 7.2 + arm * Math.PI * .5 + Math.random() * .22;
        const x = Math.cos(angle) * radius * (1.05 + Math.random() * .22);
        const y = Math.sin(angle) * radius * .58 + (Math.random() - .5) * 55;
        const z = (Math.random() - .5) * 260;
        positions.push(x, y, z);
        const mixed = colorA.clone().lerp(colorB, (Math.sin(angle) + 1) * .28 + Math.random() * .12);
        colors.push(mixed.r, mixed.g, mixed.b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({ size:2.7, transparent:true, opacity:.34, vertexColors:true, blending:THREE.AdditiveBlending, depthWrite:false });
      nebula = new THREE.Points(geo, mat);
      nebula.rotation.z = -0.13;
      group.add(nebula);
    }

    function buildStars(){
      const positions = [];
      for (let i=0;i<1200;i++) {
        positions.push((Math.random()-.5)*2100, (Math.random()-.5)*1350, (Math.random()-.5)*1400 - 240);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ color:0xdff8ff, size:1.7, transparent:true, opacity:.72, depthWrite:false });
      const cloud = new THREE.Points(geo, mat);
      starsGroup.add(cloud);
    }

    function buildSectors(){
      group.remove(sectorLayer);
      sectorLayer = new THREE.Group();
      if (typeof galaxySectorPolygons !== 'undefined') {
        galaxySectorPolygons.forEach(sector => {
          const points = (sector.points || []).map(point => sectorPoint(point, sector.id));
          if (points.length < 3) return;
          points.push(points[0].clone());
          let control = 'neutral';
          try { if (typeof galaxySectorControl === 'function') control = galaxySectorControl(sector.id); } catch (_) {}
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: colorMap[control] || colorMap.neutral, transparent:true, opacity:.34 }));
          sectorLayer.add(line);

          const center = points.slice(0, -1).reduce((sum, v) => sum.add(v), new THREE.Vector3()).multiplyScalar(1 / (points.length - 1));
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(38, 39.3, 80),
            new THREE.MeshBasicMaterial({ color: colorMap[control] || colorMap.neutral, transparent:true, opacity:.12, side:THREE.DoubleSide, depthWrite:false })
          );
          ring.position.copy(center);
          ring.rotation.x = Math.PI / 2;
          sectorLayer.add(ring);
        });
      }
      group.add(sectorLayer);
    }

    function rebuildPlanetsIfNeeded(){
      const names = new Set((galaxyPlanets || []).map(p => p.name));
      let needs = planetMeshes.size !== names.size;
      for (const name of names) if (!planetMeshes.has(name)) needs = true;
      if (!needs) return;
      planetMeshes.forEach(mesh => group.remove(mesh));
      planetMeshes.clear();
      planetLabels.forEach(label => label.remove());
      planetLabels.clear();
      (galaxyPlanets || []).forEach(makePlanet);
    }

    function syncFromState(){
      if (!Array.isArray(galaxyPlanets)) return;
      rebuildPlanetsIfNeeded();
      const visible = visiblePlanetSet();
      (galaxyPlanets || []).forEach(p => {
        const mesh = planetMeshes.get(p.name);
        if (!mesh) return;
        const control = planetControl(p);
        mesh.position.copy(mapTo3D(p));
        mesh.material.color.setHex(colorMap[control] || colorMap.neutral);
        mesh.material.emissive.setHex(glowMap[control] || glowMap.neutral);
        mesh.visible = visible.has(p);
        mesh.userData.planet = p;
        const label = planetLabels.get(p.name);
        if (label) {
          label.textContent = p.name;
          label.dataset.name = p.name;
          label.classList.toggle('hidden', !mesh.visible);
        }
      });
      buildSectors();
      syncSelection();
    }

    function syncSelection(){
      let active = '';
      try { active = galaxySelected?.name || ''; } catch (_) {}
      selectedName = active;
      planetMeshes.forEach((mesh, name) => {
        const selected = name === selectedName;
        mesh.scale.setScalar(selected ? 1.72 : 1);
        mesh.material.emissiveIntensity = selected ? 1.2 : .42;
        const label = planetLabels.get(name);
        if (label) label.classList.toggle('selected', selected);
      });
    }

    function choosePlanet(p){
      if (!p) return;
      try {
        if (typeof galaxyFocusPlanet === 'function') galaxyFocusPlanet(p);
        else {
          if (typeof renderGalaxyPanel === 'function') renderGalaxyPanel(p);
          if (typeof renderGalaxyPlanetList === 'function') renderGalaxyPlanetList();
        }
      } catch (_) {}
      focusPlanet(p);
      syncSelection();
    }

    function focusPlanet(p){
      const mesh = planetMeshes.get(p?.name || '');
      if (!mesh) return;
      const v = mesh.position.clone();
      targetRot.x = THREE.MathUtils.clamp(-v.y / 840, -0.68, 0.68) - .28;
      targetRot.y = THREE.MathUtils.clamp(v.x / 760, -0.78, 0.78);
      targetZoom = 660;
    }

    function pointerCoords(event){
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickPlanet(event){
      pointerCoords(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...planetMeshes.values()].filter(m => m.visible), false);
      if (hits.length) choosePlanet(hits[0].object.userData.planet);
    }

    function updateLabels(){
      const rect = stage.getBoundingClientRect();
      planetMeshes.forEach((mesh, name) => {
        const label = planetLabels.get(name);
        if (!label || !mesh.visible) return;
        const pos = mesh.getWorldPosition(new THREE.Vector3()).project(camera);
        const behind = pos.z < -1 || pos.z > 1;
        label.classList.toggle('hidden', behind);
        if (behind) return;
        label.style.transform = `translate3d(${((pos.x + 1) * .5 * rect.width).toFixed(1)}px, ${((-pos.y + 1) * .5 * rect.height).toFixed(1)}px, 0)`;
      });
    }

    function resize(){
      const rect = stage.getBoundingClientRect();
      const width = Math.max(320, rect.width || shell.clientWidth || 900);
      const height = Math.max(420, rect.height || shell.clientHeight || 720);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    canvas.addEventListener('pointerdown', event => {
      isDragging = true;
      dragMoved = false;
      last.x = event.clientX;
      last.y = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
      stage.classList.add('dragging');
    });

    canvas.addEventListener('pointermove', event => {
      const rect = canvas.getBoundingClientRect();
      const worldX = ((event.clientX - rect.left) / rect.width) * 1280;
      const worldY = ((event.clientY - rect.top) / rect.height) * 820;
      if (typeof galaxyCoords !== 'undefined' && galaxyCoords) {
        let sector = '--';
        try { sector = galaxySelected ? String(galaxySelected.sector).padStart(2,'0') : '--'; } catch (_) {}
        galaxyCoords.textContent = `SECTOR: ${sector} // 3D GRID: X ${Math.round(worldX)} Y ${Math.round(worldY)}`;
      }
      if (!isDragging) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
      targetRot.y += dx * 0.0042;
      targetRot.x = THREE.MathUtils.clamp(targetRot.x + dy * 0.0036, -1.02, .72);
      last.x = event.clientX;
      last.y = event.clientY;
    });

    function stopDrag(event){
      if (!isDragging) return;
      isDragging = false;
      stage.classList.remove('dragging');
      if (event && !dragMoved) pickPlanet(event);
    }
    canvas.addEventListener('pointerup', stopDrag);
    canvas.addEventListener('pointercancel', stopDrag);
    canvas.addEventListener('pointerleave', () => { isDragging = false; stage.classList.remove('dragging'); });

    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      targetZoom = THREE.MathUtils.clamp(targetZoom + event.deltaY * 0.55, 430, 1500);
    }, { passive:false });

    document.getElementById('galaxyZoomIn')?.addEventListener('click', () => { targetZoom = Math.max(430, targetZoom - 120); });
    document.getElementById('galaxyZoomOut')?.addEventListener('click', () => { targetZoom = Math.min(1500, targetZoom + 140); });
    document.getElementById('galaxyReset')?.addEventListener('click', () => {
      targetRot = { x:-0.34, y:0.18 };
      targetZoom = 980;
    });

    const originalRenderGalaxy = typeof renderGalaxy === 'function' ? renderGalaxy : null;
    if (originalRenderGalaxy) {
      renderGalaxy = function(){
        const result = originalRenderGalaxy.apply(this, arguments);
        requestAnimationFrame(syncFromState);
        return result;
      };
    }

    const originalFocusPlanet = typeof galaxyFocusPlanet === 'function' ? galaxyFocusPlanet : null;
    if (originalFocusPlanet) {
      galaxyFocusPlanet = function(planet){
        const result = originalFocusPlanet.apply(this, arguments);
        requestAnimationFrame(() => {
          focusPlanet(planet);
          syncFromState();
        });
        return result;
      };
    }

    window.addEventListener('resize', resize);
    window.addEventListener('eotg:auth-updated', () => setTimeout(syncFromState, 80));
    window.addEventListener('hashchange', () => setTimeout(syncFromState, 180));

    buildStars();
    buildNebula();
    (galaxyPlanets || []).forEach(makePlanet);
    buildSectors();
    resize();
    syncFromState();

    function animate(){
      requestAnimationFrame(animate);
      currentRot.x += (targetRot.x - currentRot.x) * .08;
      currentRot.y += (targetRot.y - currentRot.y) * .08;
      currentZoom += (targetZoom - currentZoom) * .08;
      group.rotation.x = currentRot.x;
      group.rotation.y = currentRot.y;
      starsGroup.rotation.y += 0.00035;
      if (nebula) nebula.rotation.z += 0.00018;
      camera.position.z = currentZoom;
      camera.lookAt(0, 0, 0);
      syncSelection();
      renderer.render(scene, camera);
      updateLabels();
    }
    animate();
  }

  waitForDependencies();
})();
