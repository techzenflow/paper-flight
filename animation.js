(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: true });
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const DURATION = 28;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = { jade: [100, 151, 137], terra: [194, 129, 104], blue: [123, 151, 182], sand: [199, 171, 109], lilac: [167, 147, 180] };
  const stages = [
    { at: 0, title: '一张纸的可能', english: 'THE BEGINNING', note: '一切，从一张纸开始' },
    { at: .16, title: '折出最初的轮廓', english: 'THE FIRST FOLD', note: '每一道折痕，都是伏笔' },
    { at: .35, title: '把心意慢慢聚拢', english: 'FINDING THE FORM', note: '让平凡，悄悄有了形状' },
    { at: .51, title: '引颈，向着远方', english: 'BECOMING A CRANE', note: '想飞的心，先抬起了头' },
    { at: .68, title: '舒展一双翅膀', english: 'UNFOLDING THE WINGS', note: '折过的痕迹，成了翅膀' },
    { at: .84, title: '这一刻，乘风而起', english: 'A LITTLE FREEDOM', note: '把想象，交给风' },
  ];
  const state = { time: 0, playing: false, speed: 1, color: [...colors.jade], targetColor: [...colors.jade], yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, width: 1, height: 1, dpr: 1, stage: -1, sound: false, dragging: false, autoStarted: false };

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const lerp3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normal = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);

  // A single triangulated square: the shared vertices stay connected throughout.
  // The ten boundary vertices become the head, neck, tail and two wings.
  const outline = [[0, -1.7], [.34, -1.36], [.85, -.85], [1.7, 0], [.85, .85], [0, 1.7], [-.85, .85], [-1.7, 0], [-.85, -.85], [-.34, -1.36]];
  const craneOutline = [[-1.66, 1.12, 0], [-1.15, 1.12, -.025], [-.48, .08, -.055], [.12, .65, -2.05], [.65, -.22, -.06], [1.7, 1.05, 0], [.65, -.22, .06], [.12, .65, 2.05], [-.48, .08, .055], [-1.32, 1.36, .025]];
  const craneInner = [[-1.3, 1.18, 0], [-1.12, .94, -.025], [-.45, .08, -.11], [0, .22, -.28], [.35, .05, -.17], [.62, .12, 0], [.35, .05, .17], [0, .22, .28], [-.45, .08, .11], [-1.25, 1.26, .025]];
  const paper = [[0, 0, 0], ...outline.map(([u, v]) => [u, 0, v]), ...outline.map(([u, v]) => [u * .38, 0, v * .38])];
  const finalCrane = [[-.45, .15, 0], ...craneOutline, ...craneInner];
  const triangles = [];
  for (let i = 0; i < 10; i++) {
    const n = (i + 1) % 10;
    triangles.push([0, 11 + i, 11 + n], [11 + i, 1 + i, 1 + n], [11 + i, 1 + n, 11 + n]);
  }

  const squareBase = paper.map(([x, , z], i) => [x * .69, -.1 - z * .7, Math.sign(x || .01) * .035 + (i > 10 ? .03 : 0)]);
  const birdOutline = [[-.1, 1.72, 0], [-.13, 1.35, -.025], [-.3, -.38, -.06], [.04, 1.6, -.24], [.3, -.38, -.05], [.13, 1.72, 0], [.3, -.38, .05], [.04, 1.6, .24], [-.3, -.38, .06], [-.13, 1.35, .025]];
  const birdBase = [[0, .12, 0], ...birdOutline, ...craneInner.map(([x, y, z]) => [x * .5, y - .2, z * .45])];
  const neckUp = finalCrane.map(v => [...v]);
  neckUp[4] = [.12, 1.75, -.42];
  neckUp[8] = [.12, 1.75, .42];

  function verticesAt(progress) {
    let v;
    if (progress < .235) {
      // Hinge the left half over the diagonal, hold the crease, and reopen it.
      let angle = progress < .105 ? smooth((progress - .025) / .08) * Math.PI * .975 : (1 - smooth((progress - .14) / .095)) * Math.PI * .975;
      v = paper.map(([x, y, z]) => x < 0 ? [x * Math.cos(angle), -x * Math.sin(angle) + .004, z] : [x, y, z]);
    } else if (progress < .365) {
      const t = smooth((progress - .235) / .13);
      v = paper.map((p, i) => lerp3(p, squareBase[i], t));
    } else if (progress < .515) {
      const t = smooth((progress - .385) / .13);
      v = squareBase.map((p, i) => lerp3(p, birdBase[i], t));
    } else if (progress < .675) {
      const t = smooth((progress - .535) / .14);
      v = birdBase.map((p, i) => lerp3(p, neckUp[i], t));
    } else {
      const t = smooth((progress - .685) / .105);
      v = neckUp.map((p, i) => lerp3(p, finalCrane[i], t));
    }

    if (progress > .79) {
      const flapTime = (progress - .79) * DURATION;
      const amp = mix(.08, .7, smooth((progress - .82) / .06));
      const angle = Math.sin(flapTime * 6) * amp;
      [4, 8].forEach(index => {
        const side = index === 4 ? -1 : 1;
        const wing = v[index];
        const z = wing[2];
        const y = wing[1] - .17;
        wing[1] = .17 + y * Math.cos(angle) - z * Math.sin(angle * side);
        wing[2] = y * Math.sin(angle * side) + z * Math.cos(angle);
      });
    }
    return v;
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    state.width = Math.max(bounds.width, 1);
    state.height = Math.max(bounds.height, 1);
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);

  function project(point, yaw, pitch, scale, offsetX, offsetY, flight = [0, 0, 0]) {
    const [x, y, z] = point;
    const xx = x * Math.cos(yaw) + z * Math.sin(yaw);
    const zz = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const yy = y * Math.cos(pitch) - zz * Math.sin(pitch);
    const depth = y * Math.sin(pitch) + zz * Math.cos(pitch);
    const perspective = 8 / (8 - depth * .35);
    return { x: offsetX + (xx + flight[0]) * scale * perspective, y: offsetY - (yy + flight[1]) * scale * perspective, depth, world: point };
  }

  function draw(time) {
    const w = state.width, h = state.height, p = state.time / DURATION;
    ctx.clearRect(0, 0, w, h);
    // The floor is deliberately quiet: thin registration rings and a soft shadow.
    const cx = w * .52, cy = h * .57;
    const floorScale = Math.min(w * .19, h * .265);
    ctx.save();
    ctx.strokeStyle = 'rgba(139, 159, 120, .10)';
    ctx.lineWidth = .65;
    for (const r of [1.03, 1.62, 2.24]) {
      ctx.beginPath();
      ctx.ellipse(cx, h * .765, floorScale * r, floorScale * r * .27, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([2, 7]);
    ctx.beginPath();ctx.moveTo(cx - floorScale * 2.7, h * .765);ctx.lineTo(cx + floorScale * 2.7, h * .765);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx, h * .66);ctx.lineTo(cx, h * .9);ctx.stroke();
    ctx.restore();

    const fly = smooth((p - .855) / .145);
    const shadowAlpha = .17 * (1 - fly);
    ctx.save();
    ctx.translate(cx + fly * w * .35, h * .76);
    ctx.scale(1, .25);
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, floorScale * 1.6);
    shadow.addColorStop(0, `rgba(58,83,62,${shadowAlpha})`);
    shadow.addColorStop(.4, `rgba(78,97,66,${shadowAlpha * .55})`);
    shadow.addColorStop(1, 'rgba(78,97,66,0)');
    ctx.fillStyle = shadow;ctx.fillRect(-floorScale * 2, -floorScale * 2, floorScale * 4, floorScale * 4);ctx.restore();

    // A stable view makes the folds legible; dragging adds a damped orbit.
    const baseYaw = -.53;
    const pitch = .42 + state.pitch;
    const yaw = baseYaw + state.yaw + fly * .45;
    const scale = Math.min(w * .205, h * .285) * (1 - fly * .38);
    const lift = p > .79 ? Math.sin((p - .79) * 17) * .04 : 0;
    const flight = [fly * 6.5, fly * 5 + lift, 0];
    const verts = verticesAt(p);
    const projected = verts.map(v => project(v, yaw, pitch, scale, cx, cy, flight));
    const faces = triangles.map((indices, index) => {
      const points = indices.map(i => projected[i]);
      const n = normal(cross(sub(verts[indices[1]], verts[indices[0]]), sub(verts[indices[2]], verts[indices[0]])));
      const lighting = Math.abs(dot(n, normal([-.5, .85, .5])));
      return { indices, points, depth: points.reduce((a, b) => a + b.depth, 0) / 3, lighting, index };
    }).sort((a, b) => a.depth - b.depth || a.index - b.index);

    ctx.save();
    ctx.globalAlpha = 1 - smooth((p - .977) / .023);
    for (const face of faces) {
      const pts = face.points;
      const variation = (face.index % 3 - 1) * .027;
      const shade = .72 + face.lighting * .4 + variation;
      const rgb = state.color.map(c => Math.round(clamp(c * shade, 0, 255)));
      // Small gradients across each triangle suggest the fibres and tension of paper.
      const gradient = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[1].x + .01, pts[1].y + .01);
      gradient.addColorStop(0, `rgb(${rgb.map(c => Math.min(c + 9, 255)).join(',')})`);
      gradient.addColorStop(1, `rgb(${rgb.join(',')})`);
      ctx.beginPath();ctx.moveTo(pts[0].x, pts[0].y);ctx.lineTo(pts[1].x, pts[1].y);ctx.lineTo(pts[2].x, pts[2].y);ctx.closePath();
      ctx.fillStyle = gradient;ctx.fill();
      // Matching strokes seal subpixel seams without drawing a wireframe.
      ctx.strokeStyle = `rgba(${rgb.join(',')},.72)`;ctx.lineWidth = .65;ctx.lineJoin = 'round';ctx.stroke();
    }

    // Main creases are restrained highlights, following the same shared mesh.
    const creaseAlpha = p < .02 ? .07 : .15;
    ctx.strokeStyle = `rgba(239,247,224,${creaseAlpha})`;
    ctx.lineWidth = .7;
    for (const [a, b] of [[1, 11], [4, 14], [6, 16], [8, 18], [0, 14], [0, 18], [11, 16]]) {
      ctx.beginPath();ctx.moveTo(projected[a].x, projected[a].y);ctx.lineTo(projected[b].x, projected[b].y);ctx.stroke();
    }
    ctx.restore();

    // Fixed-seed drifting specks; motion stops together with the paper.
    ctx.fillStyle = '#9aa98c';
    for (let i = 0; i < 13; i++) {
      const x = ((Math.sin(i * 127.1) * 43758.5453 % 1) + 1) % 1;
      const y = ((Math.sin(i * 311.7) * 19763.153 % 1) + 1) % 1;
      ctx.globalAlpha = .13 + (i % 3) * .035;
      ctx.beginPath();ctx.arc(w * (.15 + x * .75) + Math.sin(state.time * .2 + i) * 6, h * (.2 + y * .55) - Math.sin(state.time * .13 + i) * 6, i % 3 === 0 ? 1.1 : .65, 0, TAU);ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (p > .97) {
      ctx.save();ctx.globalAlpha = smooth((p - .97) / .03);ctx.textAlign = 'center';
      ctx.fillStyle = '#7e9276';ctx.font = '14px "SimSun", serif';ctx.fillText('风会记得，每一道折痕。', cx, h * .47);
      ctx.fillStyle = '#a1ac93';ctx.font = '8px "Segoe UI", sans-serif';ctx.letterSpacing = '2px';ctx.fillText('EVERY FOLD LEADS TO FLIGHT', cx, h * .47 + 26);ctx.restore();
    }
  }

  function updateUI() {
    const p = state.time / DURATION;
    $('seek').value = state.time;
    $('seek').setAttribute('aria-valuetext', `${Math.floor(state.time)}秒，共28秒`);
    $('seek-progress').style.width = `${p * 100}%`;
    $('current-time').textContent = `00:${String(Math.floor(state.time)).padStart(2, '0')}`;
    const index = stages.reduce((n, stage, i) => p + 1e-7 >= stage.at ? i : n, 0);
    if (index !== state.stage) {
      state.stage = index;
      const stage = stages[index];
      const number = String(index + 1).padStart(2, '0');
      $('scene-number').textContent = number;
      $('step-pill').textContent = number;
      $('step-title').textContent = stage.title;
      $('step-english').textContent = stage.english;
      $('paper-note-text').textContent = stage.note;
      document.querySelectorAll('.step').forEach((button, i) => {
        button.classList.toggle('active', i === index);
        button.classList.toggle('done', i < index);
        if (i === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    }
    $('paper-note').style.opacity = p > .89 ? 0 : 1;
    $('play-label').textContent = state.playing ? '暂停片刻' : state.time >= DURATION ? '再折一次' : state.time > 0 ? '继续旅程' : '开始折叠';
    $('play-button').setAttribute('aria-label', state.playing ? '暂停动画' : state.time >= DURATION ? '重新播放动画' : '播放动画');
    $('play-icon').innerHTML = state.playing ? '<path d="M5 4h3v12H5zM12 4h3v12h-3z" fill="currentColor"/>' : '<path d="m7 4 9 6-9 6Z" fill="currentColor"/>';
  }

  function togglePlay() {
    state.autoStarted = true;
    if (state.time >= DURATION) state.time = 0;
    state.playing = !state.playing;
    updateUI();
    updateSound();
  }
  function replay() {
    state.autoStarted = true;
    state.time = 0;state.playing = true;
    updateUI();updateSound();
  }
  $('play-button').addEventListener('click', togglePlay);
  $('replay-button').addEventListener('click', replay);
  $('seek').addEventListener('input', event => {
    state.autoStarted = true;
    state.time = Number(event.target.value);
    if (state.time >= DURATION) state.playing = false;
    updateUI();updateSound();
  });
  document.querySelectorAll('.step').forEach(button => button.addEventListener('click', () => {
    state.autoStarted = true;
    state.time = Number(button.dataset.time);
    updateUI();
  }));
  document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => {
    state.targetColor = [...colors[button.dataset.color]];
    document.querySelectorAll('.swatch').forEach(b => {
      const active = b === button;
      b.classList.toggle('active', active);b.setAttribute('aria-pressed', active);
    });
  }));
  const speeds = [1, 1.5, 2, .5];
  $('speed-button').addEventListener('click', () => {
    state.speed = speeds[(speeds.indexOf(state.speed) + 1) % speeds.length];
    $('speed-button').firstChild.textContent = `${state.speed}× `;
    $('speed-button').setAttribute('aria-label', `当前播放速度${state.speed}倍，点击切换`);
  });
  $('reset-view').addEventListener('click', () => { state.targetYaw = 0;state.targetPitch = 0; });

  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, yaw: state.targetYaw, pitch: state.targetPitch };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');state.dragging = true;
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    state.targetYaw = drag.yaw + (event.clientX - drag.x) * .007;
    state.targetPitch = clamp(drag.pitch + (event.clientY - drag.y) * .004, -.6, .85);
  });
  const endDrag = () => { drag = null;state.dragging = false;canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      event.preventDefault();
      if (event.code === 'ArrowLeft') state.targetYaw -= .15;
      if (event.code === 'ArrowRight') state.targetYaw += .15;
      if (event.code === 'ArrowUp') state.targetPitch = clamp(state.targetPitch - .1, -.6, .85);
      if (event.code === 'ArrowDown') state.targetPitch = clamp(state.targetPitch + .1, -.6, .85);
    }
  });
  window.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(document.activeElement.tagName) || $('about-dialog').open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') { event.preventDefault();togglePlay(); }
    if (event.code === 'KeyR') replay();
  });
  $('about-button').addEventListener('click', () => { $('about-dialog').showModal();updateSound(); });
  $('about-dialog').addEventListener('click', event => { if (event.target === $('about-dialog')) { const r = event.target.getBoundingClientRect();if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });

  // Optional, entirely local ambient sound. Created only after an explicit click.
  let audio = null;
  async function startAudio() {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) throw new Error('Audio is unavailable');
    if (!audio) {
      const context = new AudioClass();
      const gain = context.createGain();gain.gain.value = 0;gain.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) { previous = (previous + Math.random() * .035 - .0175) / 1.015;data[i] = previous * 2; }
      const wind = context.createBufferSource();wind.buffer = buffer;wind.loop = true;
      const filter = context.createBiquadFilter();filter.type = 'lowpass';filter.frequency.value = 750;wind.connect(filter);filter.connect(gain);wind.start();
      [174.61, 261.63, 349.23].forEach((frequency, i) => {
        const oscillator = context.createOscillator();oscillator.type = 'sine';oscillator.frequency.value = frequency;
        const level = context.createGain();level.gain.value = .014 / (i + 1);oscillator.connect(level);level.connect(gain);oscillator.start();
      });
      audio = { context, gain };
    }
    await audio.context.resume();
  }
  function updateSound() {
    if (!audio) return;
    const now = audio.context.currentTime;
    audio.gain.gain.setTargetAtTime(state.sound && state.playing && !document.hidden && !$('about-dialog').open ? .5 : 0, now, .3);
  }
  $('sound-button').addEventListener('click', async () => {
    try {
      if (!state.sound) await startAudio();
      state.sound = !state.sound;
      $('sound-button').setAttribute('aria-pressed', state.sound);
      $('sound-button').setAttribute('aria-label', state.sound ? '关闭环境音' : '开启环境音');
      $('sound-waves').setAttribute('d', state.sound ? 'M14 7a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'm15 9 5 5m0-5-5 5');
      updateSound();
    } catch {
      $('sound-button').setAttribute('aria-label', '当前浏览器不支持环境音');
      $('sound-button').title = '当前浏览器不支持环境音';
    }
  });

  let last = performance.now();
  let lastUI = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, .1);last = now;
    if (!document.hidden) {
      if (state.playing && !$('about-dialog').open) {
        state.time = Math.min(DURATION, state.time + dt * state.speed);
        if (state.time >= DURATION) { state.playing = false;updateSound();updateUI(); }
      }
      const damping = 1 - Math.exp(-dt * 10);
      state.yaw = mix(state.yaw, state.targetYaw, damping);
      state.pitch = mix(state.pitch, state.targetPitch, damping);
      state.color = state.color.map((c, i) => mix(c, state.targetColor[i], damping));
      draw(now / 1000);
      if (now - lastUI > 80) { updateUI();lastUI = now; }
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { last = performance.now();updateSound(); });
  $('about-dialog').addEventListener('close', updateSound);
  resize();updateUI();requestAnimationFrame(frame);
  // Give the opening composition a moment to breathe, respecting reduced motion.
  if (!reducedMotion) setTimeout(() => { if (!state.autoStarted && !document.hidden && !$('about-dialog').open) { state.playing = true;state.autoStarted = true;updateUI(); } }, 1600);
})();
