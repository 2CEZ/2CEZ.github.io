/* =========================================================
   2CEZ — script commun aux trois pages
   Chaque partie ne s'active que si la page contient
   les éléments dont elle a besoin.
   ========================================================= */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Lit une couleur définie dans style.css (par exemple --accent)
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Attend les polices, mais pas plus de 2 secondes
  function fontsReady() {
    const timeout = new Promise(function (resolve) { setTimeout(resolve, 2000); });
    const fonts = document.fonts
      ? Promise.all([
          document.fonts.load('900 100px "Unbounded"'),
          document.fonts.load('500 20px "JetBrains Mono"')
        ]).catch(function () {})
      : Promise.resolve();
    return Promise.race([fonts, timeout]);
  }

  /* -------------------------------------------------------
     1. Logos dessinés dans un canvas
     Outil commun : calcule la taille du texte 2CEZ pour
     qu'il remplisse la largeur disponible.
     ------------------------------------------------------- */
  function fitText(canvas, ctx, text, maxSize, padTop) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = canvas.parentElement.clientWidth;

    ctx.font = '900 100px "Unbounded", "Arial Black", sans-serif';
    const ratio = ctx.measureText(text).width / 100;
    const size = Math.floor(Math.min(maxSize, box / (ratio * 1.04)));
    const font = "900 " + size + 'px "Unbounded", "Arial Black", sans-serif';

    ctx.font = font;
    const m = ctx.measureText(text);
    const ascent = m.actualBoundingBoxAscent || size * 0.75;
    const descent = m.actualBoundingBoxDescent || 0;
    const pad = Math.round(size * 0.06);
    const top = Math.round(size * (padTop || 0));

    const box2 = {
      dpr: dpr,
      size: size,
      font: font,
      cw: Math.ceil(m.width + pad * 2),
      ch: Math.ceil(ascent + descent + pad * 2 + top),
      x: pad,
      y: pad + top + ascent,
      textTop: pad + top,
      textWidth: m.width
    };

    canvas.style.width = box2.cw + "px";
    canvas.style.height = box2.ch + "px";
    canvas.width = Math.round(box2.cw * dpr);
    canvas.height = Math.round(box2.ch * dpr);
    return box2;
  }

  // Lance une animation qui se met en pause quand le logo n'est plus visible
  function animate(canvas, frame, fps) {
    let visible = true;
    let last = 0;
    const interval = 1000 / (fps || 60);
    function loop(time) {
      requestAnimationFrame(loop);
      if (!visible || time - last < interval) return;
      last = time;
      frame(time / 1000);
    }
    requestAnimationFrame(loop);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }).observe(canvas);
    }
  }

  function onResize(callback) {
    let timer;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(callback, 150);
    });
  }

  /* --- 1a. Accueil : les lettres sont un égaliseur ---
     Des barres verticales montent et descendent comme sur
     une table de mixage ; on ne les voit qu'à l'intérieur
     des lettres. La souris fait monter les barres proches. */
  function initEqLogo() {
    const canvas = document.querySelector("#logo-eq");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const text = canvas.dataset.text || "2CEZ";
    let L, bars, levels, peaks, barW, gap;
    let pointer = -1; // position de la souris dans le logo (-1 = absente)
    let start = null;

    function layout() {
      L = fitText(canvas, ctx, text, 190, 0);
      barW = Math.max(3, L.size * 0.034);
      gap = barW * 0.5;
      bars = Math.ceil(L.cw / (barW + gap));
      levels = new Float32Array(bars);
      peaks = new Float32Array(bars);
    }

    function frame(t) {
      if (start === null) start = t;
      const intro = Math.min(1, (t - start) / 1.4); // montée au chargement
      const accent = cssVar("--accent");
      const accent2 = cssVar("--accent-2");
      const fg = cssVar("--fg");

      ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, L.cw, L.ch);

      const grad = ctx.createLinearGradient(0, L.ch, 0, L.textTop);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, accent2);

      for (let i = 0; i < bars; i++) {
        const x = i * (barW + gap);
        // un mélange d'ondes donne un mouvement « musical »
        let target = 0.72 + 0.16 * Math.sin(t * 2.3 + i * 0.32) + 0.12 * Math.sin(t * 5.1 + i * 1.7);
        if (pointer >= 0) {
          const d = Math.abs(x - pointer) / (L.size * 0.6);
          if (d < 1) target = Math.max(target, 1 - d * 0.15);
        }
        target = Math.min(1, target) * intro;
        levels[i] += (target - levels[i]) * 0.25;
        peaks[i] = Math.max(peaks[i] - 0.006, levels[i]);

        const span = L.ch - L.textTop;
        const h = levels[i] * span;
        ctx.fillStyle = grad;
        ctx.fillRect(x, L.ch - h, barW, h);
        ctx.fillStyle = fg;
        ctx.fillRect(x, L.ch - peaks[i] * span - 3, barW, 2);
      }

      ctx.font = L.font;
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "#000";
      ctx.fillText(text, L.x, L.y);

      // Contour fantôme : les lettres restent lisibles au repos
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "rgba(236, 232, 241, 0.1)";
      ctx.fillText(text, L.x, L.y);
      ctx.globalCompositeOperation = "source-over";
    }

    fontsReady().then(function () {
      layout();
      canvas.closest(".logo").classList.add("is-live");
      if (reduceMotion) {
        start = -10;
        for (let i = 0; i < 40; i++) frame(0);
        return;
      }
      animate(canvas, frame, 60);
      canvas.addEventListener("pointermove", function (e) {
        pointer = e.clientX - canvas.getBoundingClientRect().left;
      });
      canvas.addEventListener("pointerleave", function () { pointer = -1; });
      onResize(layout);
    });
  }

  /* --- 1b. Studio : les lettres brûlent ---
     Un petit feu est simulé dans une grille, on ne garde que
     ce qui tombe dans les lettres, et des braises s'envolent. */
  function initFireLogo() {
    const canvas = document.querySelector("#logo-feu");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const text = canvas.dataset.text || "2CEZ";
    const small = document.createElement("canvas");
    const sctx = small.getContext("2d");
    const SCALE = 4; // une case du feu = 4 pixels
    const palette = buildPalette();
    const sparks = [];
    let L, W, H, fire, image;

    function buildPalette() {
      const stops = [
        [0, [18, 6, 4]],
        [0.22, [96, 16, 6]],
        [0.45, [200, 48, 12]],
        [0.7, [255, 128, 32]],
        [0.88, [255, 200, 80]],
        [1, [255, 244, 200]]
      ];
      const colors = [];
      for (let i = 0; i <= 36; i++) {
        const t = i / 36;
        let k = 0;
        while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
        const a = stops[k];
        const b = stops[k + 1];
        const u = (t - a[0]) / (b[0] - a[0]);
        colors.push(a[1].map(function (v, j) { return Math.round(v + (b[1][j] - v) * u); }));
      }
      return colors;
    }

    function layout() {
      L = fitText(canvas, ctx, text, 190, 0.32); // place au-dessus pour les braises
      W = Math.ceil(L.cw / SCALE);
      H = Math.ceil(L.ch / SCALE) + 2;
      small.width = W;
      small.height = H;
      image = sctx.createImageData(W, H);
      fire = new Uint8Array(W * H);
      for (let x = 0; x < W; x++) fire[(H - 1) * W + x] = 36; // la ligne du bas brûle au maximum
      for (let i = 0; i < 80; i++) step();
    }

    // Le feu monte d'une ligne, en se refroidissant un peu au hasard
    function step() {
      for (let x = 0; x < W; x++) {
        for (let y = 1; y < H; y++) {
          const src = y * W + x;
          const value = fire[src];
          if (value === 0) {
            fire[src - W] = 0;
            continue;
          }
          const r = (Math.random() * 3) | 0;
          const dst = Math.max(0, src - W - r + 1);
          const cool = (r & 1) + (Math.random() < 0.3 ? 1 : 0);
          fire[dst] = Math.max(0, value - cool);
        }
      }
    }

    function render() {
      const d = image.data;
      for (let i = 0; i < fire.length; i++) {
        const c = palette[fire[i]];
        d[i * 4] = c[0];
        d[i * 4 + 1] = c[1];
        d[i * 4 + 2] = c[2];
        d[i * 4 + 3] = 255;
      }
      sctx.putImageData(image, 0, 0);

      ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, L.cw, L.ch);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, 0, 0, W, H, 0, 0, L.cw, L.ch + SCALE * 2);

      ctx.font = L.font;
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "#000";
      ctx.fillText(text, L.x, L.y);

      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#2a0f07";
      ctx.fillText(text, L.x, L.y);

      // Braises
      ctx.globalCompositeOperation = "lighter";
      sparks.forEach(function (p) {
        const a = Math.max(0, p.life);
        ctx.fillStyle = "rgba(255," + Math.round(120 + 100 * a) + ",40," + a + ")";
        ctx.fillRect(p.x, p.y, p.s, p.s);
      });
      ctx.globalCompositeOperation = "source-over";
    }

    function moveSparks() {
      if (sparks.length < 46 && Math.random() < 0.6) {
        sparks.push({
          x: L.x + Math.random() * L.textWidth,
          y: L.textTop + L.size * (0.1 + Math.random() * 0.4),
          vx: (Math.random() - 0.5) * 0.6,
          vy: -(0.6 + Math.random() * 1.4),
          s: 1.5 + Math.random() * 2,
          life: 1
        });
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx + Math.sin(p.y * 0.05) * 0.3;
        p.y += p.vy;
        p.life -= 0.018;
        if (p.life <= 0 || p.y < 0) sparks.splice(i, 1);
      }
    }

    fontsReady().then(function () {
      layout();
      render();
      canvas.closest(".logo").classList.add("is-live");
      if (reduceMotion) return;
      animate(canvas, function () {
        step();
        moveSparks();
        render();
      }, 30);
      onResize(function () {
        layout();
        render();
      });
    });
  }

  /* -------------------------------------------------------
     2. Pochettes générées (page Studio)
     Chaque titre donne toujours la même pochette.
     ------------------------------------------------------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function withAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function drawCover(cv, title, kind, index) {
    if (!cv) return;
    const c = cv.getContext("2d");
    const s = cv.width;
    const rnd = seeded(hash(title + kind));

    // Voix : couleurs chaudes. Instrumentales : couleurs froides.
    const warm = [["#ff6a2b", "#3a0f08", "#ffc451"], ["#e8432e", "#1e0a10", "#ffb38a"], ["#ffb02e", "#401a06", "#fff1c9"]];
    const cool = [["#4fb0a5", "#0b1f22", "#d9f2ea"], ["#9d8cf0", "#17122b", "#f0e9ff"], ["#d9c08f", "#1f1810", "#fff6e0"], ["#6f9fe0", "#0c1626", "#e3eeff"]];
    const set = kind === "voix" ? warm : cool;
    const col = set[index % set.length];
    const main = col[0];
    const deep = col[1];
    const light = col[2];

    c.fillStyle = deep;
    c.fillRect(0, 0, s, s);

    const cx = s * (0.25 + rnd() * 0.5);
    const cy = s * (0.3 + rnd() * 0.4);
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, s * 0.9);
    glow.addColorStop(0, withAlpha(main, 0.55));
    glow.addColorStop(1, withAlpha(main, 0));
    c.fillStyle = glow;
    c.fillRect(0, 0, s, s);

    const mode = index % 3;
    if (mode === 0) {
      // Soleil rayé
      const r = s * (0.22 + rnd() * 0.1);
      c.fillStyle = main;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = deep;
      for (let i = 0; i < 6; i++) {
        const y = cy + r * 0.1 + i * r * 0.17;
        c.fillRect(cx - r - 2, y, 2 * r + 4, r * 0.035 + i * r * 0.018);
      }
    } else if (mode === 1) {
      // Sillons de vinyle
      c.strokeStyle = light;
      for (let i = 0; i < 14; i++) {
        c.globalAlpha = 0.15 + 0.5 * rnd();
        c.lineWidth = 1 + rnd() * 2;
        const rr = s * 0.08 + i * s * 0.034;
        const a0 = rnd() * Math.PI * 2;
        c.beginPath();
        c.arc(cx, cy, rr, a0, a0 + Math.PI * (0.6 + rnd() * 1.2));
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = main;
      c.beginPath();
      c.arc(cx, cy, s * 0.05, 0, Math.PI * 2);
      c.fill();
    } else {
      // Forme d'onde
      const f1 = 2 + rnd() * 3;
      const f2 = 5 + rnd() * 6;
      const ph = rnd() * 6;
      c.strokeStyle = light;
      c.lineWidth = s * 0.012;
      for (let k = 0; k < 3; k++) {
        c.globalAlpha = 1 - k * 0.3;
        c.beginPath();
        for (let x = 0; x <= s; x += 2) {
          const t = x / s;
          const y = cy + (Math.sin(t * f1 * 6.283 + ph + k * 0.6) * 0.6 + Math.sin(t * f2 * 6.283 + ph) * 0.4) * s * 0.13 * Math.sin(t * Math.PI);
          if (x === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    // Grain
    const grains = Math.floor(s * s * 0.06);
    for (let i = 0; i < grains; i++) {
      c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.14)";
      c.fillRect(rnd() * s, rnd() * s, 1, 1);
    }

    // Numéro et signature
    c.fillStyle = light;
    c.textBaseline = "top";
    c.textAlign = "left";
    c.font = "500 " + Math.round(s * 0.075) + 'px "JetBrains Mono", monospace';
    c.fillText(String(index + 1).padStart(2, "0"), s * 0.07, s * 0.07);
    c.textBaseline = "alphabetic";
    c.textAlign = "right";
    c.font = "900 " + Math.round(s * 0.08) + 'px "Unbounded", sans-serif';
    c.fillText("2CEZ", s * 0.93, s * 0.93);
  }

  /* -------------------------------------------------------
     3. Lecteur de musique + visualiseur (page Studio)
     ------------------------------------------------------- */
  function initStudio() {
    const tracks = Array.prototype.slice.call(document.querySelectorAll(".track"));
    if (!tracks.length) return;

    const audio = new Audio();
    audio.preload = "none";
    const viz = document.querySelector("#visualiseur");
    const vctx = viz ? viz.getContext("2d") : null;

    let audioContext = null;
    let analyser = null;
    let data = null;
    let current = null;
    let drawing = false;

    function format(sec) {
      if (!isFinite(sec)) return "--:--";
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return m + ":" + String(s).padStart(2, "0");
    }

    function markMissing(track) {
      track.classList.add("is-missing");
      track.querySelector(".t-play").disabled = true;
      track.querySelector(".t-play").setAttribute("aria-label", track.dataset.title + " : bientôt disponible");
      track.querySelector(".t-duree").textContent = "Bientôt";
    }

    // Pochettes (après le chargement des polices)
    fontsReady().then(function () {
      document.querySelectorAll(".tracklist").forEach(function (list) {
        list.querySelectorAll(".track").forEach(function (track, i) {
          drawCover(track.querySelector(".cover"), track.dataset.title, track.dataset.kind, i);
        });
      });
    });

    tracks.forEach(function (track) {
      // On vérifie que le fichier existe et on lit sa durée
      const probe = new Audio();
      probe.preload = "metadata";
      probe.addEventListener("loadedmetadata", function () {
        track.querySelector(".t-duree").textContent = format(probe.duration);
      });
      probe.addEventListener("error", function () { markMissing(track); });
      probe.src = track.dataset.src;

      track.querySelector(".t-play").addEventListener("click", function () { toggle(track); });

      const progress = track.querySelector(".t-progress");
      progress.addEventListener("input", function () {
        if (current === track && isFinite(audio.duration)) {
          audio.currentTime = (progress.value / 100) * audio.duration;
        }
      });
    });

    function setupAnalyser() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        audioContext = new Ctx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        data = new Uint8Array(analyser.frequencyBinCount);
        audioContext.createMediaElementSource(audio).connect(analyser);
        analyser.connect(audioContext.destination);
      } catch (e) {
        analyser = null;
      }
    }

    function toggle(track) {
      if (track.classList.contains("is-missing")) return;
      if (!audioContext) setupAnalyser();
      if (audioContext && audioContext.state === "suspended") audioContext.resume();

      if (current === track) {
        if (audio.paused) audio.play().catch(function () {});
        else audio.pause();
        return;
      }

      if (current) {
        current.classList.remove("is-current", "is-playing");
        current.querySelector(".t-progress").disabled = true;
        current.querySelector(".t-progress").value = 0;
      }
      current = track;
      track.classList.add("is-current");
      track.querySelector(".t-progress").disabled = false;
      audio.src = track.dataset.src;
      audio.play().catch(function () {});
    }

    audio.addEventListener("play", function () {
      if (!current) return;
      current.classList.add("is-playing");
      current.querySelector(".t-play").setAttribute("aria-label", "Mettre en pause " + current.dataset.title);
      if (!drawing) {
        drawing = true;
        requestAnimationFrame(draw);
      }
    });

    audio.addEventListener("pause", function () {
      if (!current) return;
      current.classList.remove("is-playing");
      current.querySelector(".t-play").setAttribute("aria-label", "Lire " + current.dataset.title);
    });

    audio.addEventListener("timeupdate", function () {
      if (!current || !isFinite(audio.duration)) return;
      current.querySelector(".t-progress").value = (audio.currentTime / audio.duration) * 100;
    });

    audio.addEventListener("error", function () {
      if (current) markMissing(current);
    });

    // À la fin d'un morceau, on passe au suivant disponible
    audio.addEventListener("ended", function () {
      const start = tracks.indexOf(current);
      for (let i = 1; i <= tracks.length; i++) {
        const next = tracks[(start + i) % tracks.length];
        if (!next.classList.contains("is-missing") && next !== current) {
          toggle(next);
          return;
        }
      }
    });

    // Visualiseur : des barres en miroir depuis le centre
    function sizeViz() {
      if (!viz) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viz.width = Math.round(viz.clientWidth * dpr);
      viz.height = Math.round(viz.clientHeight * dpr);
    }

    function paint(values) {
      if (!vctx) return;
      const w = viz.width;
      const h = viz.height;
      vctx.clearRect(0, 0, w, h);
      const bars = 48;
      const gap = Math.max(2, w / 400);
      const bw = (w - gap * (bars * 2 - 1)) / (bars * 2);
      const grad = vctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, cssVar("--accent"));
      grad.addColorStop(1, cssVar("--accent-2"));
      vctx.fillStyle = grad;
      for (let i = 0; i < bars; i++) {
        const v = values ? values[i] / 255 : 0;
        const bh = Math.max(h * 0.03, v * h * 0.95);
        const xr = w / 2 + gap / 2 + i * (bw + gap);
        const xl = w / 2 - gap / 2 - (i + 1) * bw - i * gap;
        vctx.fillRect(xr, h - bh, bw, bh);
        vctx.fillRect(xl, h - bh, bw, bh);
      }
    }

    function draw() {
      if (audio.paused) {
        drawing = false;
        paint(null);
        return;
      }
      requestAnimationFrame(draw);
      if (analyser) {
        analyser.getByteFrequencyData(data);
        paint(data);
      }
    }

    sizeViz();
    paint(null);
    window.addEventListener("resize", function () {
      sizeViz();
      paint(null);
    });

    // Lien SoundCloud pas encore renseigné
    document.querySelectorAll('[aria-disabled="true"]').forEach(function (link) {
      link.addEventListener("click", function (e) { e.preventDefault(); });
    });
  }

  /* -------------------------------------------------------
     4. Galerie du jeu + visionneuse (page Industrie)
     ------------------------------------------------------- */
  function initGallery() {
    const assets = Array.prototype.slice.call(document.querySelectorAll(".asset"));
    const dialog = document.querySelector("#visionneuse");
    if (!assets.length || !dialog) return;

    const stage = dialog.querySelector(".viewer-stage");
    const caption = dialog.querySelector(".viewer-caption");
    const counter = dialog.querySelector(".viewer-count");
    let index = 0;

    assets.forEach(function (asset, i) {
      const media = asset.querySelector("img, video");
      if (media) {
        media.addEventListener("error", function () { asset.classList.add("is-missing"); });
        // Image déjà en échec avant que le script ne démarre
        if (media.tagName === "IMG" && media.complete && media.naturalWidth === 0) {
          asset.classList.add("is-missing");
        }
        if (media.tagName === "VIDEO" && (media.error || media.networkState === 3)) {
          asset.classList.add("is-missing");
        }
      }
      asset.addEventListener("click", function () { open(i); });
    });

    function show(i) {
      index = (i + assets.length) % assets.length;
      const asset = assets[index];
      const src = asset.dataset.src;
      stage.textContent = "";

      if (asset.classList.contains("is-missing")) {
        const empty = document.createElement("p");
        empty.className = "viewer-empty";
        empty.textContent = "Ce fichier n'est pas encore en ligne : " + src;
        stage.appendChild(empty);
      } else if (asset.dataset.type === "video") {
        const video = document.createElement("video");
        video.src = src;
        video.controls = true;
        video.playsInline = true;
        stage.appendChild(video);
      } else {
        const img = document.createElement("img");
        img.src = src;
        img.alt = asset.dataset.caption;
        stage.appendChild(img);
      }

      caption.textContent = asset.dataset.caption;
      counter.textContent = index + 1 + " / " + assets.length;
    }

    function open(i) {
      show(i);
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    function close() {
      stage.querySelectorAll("video").forEach(function (v) { v.pause(); });
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    dialog.querySelector(".viewer-close").addEventListener("click", close);
    dialog.querySelector(".viewer-prev").addEventListener("click", function () { show(index - 1); });
    dialog.querySelector(".viewer-next").addEventListener("click", function () { show(index + 1); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) close(); });
    dialog.addEventListener("close", function () {
      stage.querySelectorAll("video").forEach(function (v) { v.pause(); });
    });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }

  initEqLogo();
  initFireLogo();
  initStudio();
  initGallery();
})();
