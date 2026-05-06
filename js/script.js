import { Pane } from "https://esm.sh/tweakpane@4.0.4";

window.addEventListener("load", () => {
  initPixelFluidCursor();
});

function initPixelFluidCursor() {
  const ACCENT = parseHexColor(
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-color")
      .trim() || "#004bff",
  );

  const config = {
    SIM_RESOLUTION: 150,
    DYE_RESOLUTION: 220,
    PIXEL_SIZE: 16,
    VELOCITY_DISSIPATION: 0.77,
    DENSITY_DISSIPATION: 0.95,
    PRESSURE_ITERATIONS: 10,
    SPLAT_FORCE: 18,
    SPLAT_RADIUS: 2.1,
    SPEED_RADIUS_GAIN: 0.045,
    SPEED_FORCE_GAIN: 1.1,
    FRAME_VORTEX_FORCE: 12,
    FRAME_VORTEX_RADIUS: 0.5,
    FRAME_VORTEX_DYE: 0.22,
    FRAME_VORTEX_SAMPLES: 44,
    FRAME_VORTEX_BAND: 60,
    FRAME_VORTEX_PULL: 0.35,
    FRAME_VORTEX_SPIN: 1.2,
    FRAME_PADDING_BASE: 12,
    FRAME_PADDING_MAX: 36,
    FRAME_TRAVEL_SPEED: 90,
    FRAME_WRAP_IN_SPEED: 1.9,
    FRAME_WRAP_OUT_SPEED: 2.3,
    FRAME_ENABLED: true,
    FRICTION: 0.22,
    COLOR_BASE_INTENSITY: 0.6,
    COLOR_SPEED_INTENSITY: 0.006,
    COLOR_R_MULT: 1,
    COLOR_G_MULT: 1,
    COLOR_B_MULT: 1,
    COLOR_FRAME_INTENSITY: 1.05,
    COLOR_CLAMP: 1.6,
    ALPHA_MULTIPLIER: 1.4,
  };

  const canvas = document.createElement("canvas");
  canvas.id = "fluid";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.maxHeight = "100svh";
  // canvas.style.zIndex = "30";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  const dyeCanvas = document.createElement("canvas");
  const dyeCtx = dyeCanvas.getContext("2d", { alpha: true });
  const pixelCanvas = document.createElement("canvas");
  const pixelCtx = pixelCanvas.getContext("2d", { alpha: true });

  let width = 0;
  let height = 0;
  let simW = 0;
  let simH = 0;
  let cellCount = 0;
  let hoveredMaskRect = null;
  let elapsedTime = 0;
  let lastTime = 0;
  let dpr = 1;
  let viewportWidthCss = window.innerWidth;
  let viewportHeightCss = window.innerHeight;

  let vx = null;
  let vy = null;
  let vx0 = null;
  let vy0 = null;
  let pressure = null;
  let pressure0 = null;
  let divergence = null;
  let dyeR = null;
  let dyeG = null;
  let dyeB = null;
  let dyeR0 = null;
  let dyeG0 = null;
  let dyeB0 = null;
  const heroQuotes = document.querySelector(".hero__quotes");
  const wrapState = {
    element: null,
    rect: null,
    progress: 0,
    anchor: 0,
    direction: 1,
  };

  const pointer = {
    targetX: window.innerWidth * 0.5,
    targetY: window.innerHeight * 0.5,
    smoothX: window.innerWidth * 0.5,
    smoothY: window.innerHeight * 0.5,
    prevX: window.innerWidth * 0.5,
    prevY: window.innerHeight * 0.5,
    speed: 0,
    ready: false,
  };

  const idx = (x, y) => x + y * simW;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function parseHexColor(hex) {
    const clean = hex.startsWith("#") ? hex.slice(1) : hex;
    if (clean.length !== 6) return { r: 0, g: 75 / 255, b: 1 };
    const int = Number.parseInt(clean, 16);
    if (Number.isNaN(int)) return { r: 0, g: 75 / 255, b: 1 };
    return {
      r: ((int >> 16) & 255) / 255,
      g: ((int >> 8) & 255) / 255,
      b: (int & 255) / 255,
    };
  }

  function syncFrameVisibility() {
    if (!heroQuotes) return;
    heroQuotes.style.display = config.FRAME_ENABLED ? "" : "none";
  }

  function setupPane() {
    const pane = new Pane({ title: "Pixel Fluid Cursor" });
    pane.element.style.position = "fixed";
    pane.element.style.top = "12px";
    pane.element.style.right = "12px";
    pane.element.style.zIndex = "120";
    // pane.element.style.width = "320px";
    pane.element.style.pointerEvents = "auto";

    const sim = pane.addFolder({ title: "Simulation" });
    sim
      .addBinding(config, "SIM_RESOLUTION", {
        min: 72,
        max: 360,
        step: 1,
        label: "Sim Res",
      })
      .on("change", () => resize());
    sim
      .addBinding(config, "DYE_RESOLUTION", {
        min: 120,
        max: 900,
        step: 1,
        label: "Dye Res",
      })
      .on("change", () => resize());
    sim.addBinding(config, "PRESSURE_ITERATIONS", {
      min: 4,
      max: 60,
      step: 1,
      label: "Pressure Iter",
    });
    sim.addBinding(config, "VELOCITY_DISSIPATION", {
      min: 0.5,
      max: 1.0,
      step: 0.001,
      label: "Vel Diss",
    });
    sim.addBinding(config, "DENSITY_DISSIPATION", {
      min: 0.5,
      max: 1.0,
      step: 0.001,
      label: "Dye Diss",
    });
    sim.addBinding(config, "PIXEL_SIZE", {
      min: 1,
      max: 100,
      step: 1,
      label: "Pixel Size",
    });

    const pointerFolder = pane.addFolder({ title: "Pointer Splat" });
    pointerFolder.addBinding(config, "FRICTION", {
      min: 0.03,
      max: 0.4,
      step: 0.005,
      label: "Friction",
    });
    pointerFolder.addBinding(config, "SPLAT_FORCE", {
      min: 4,
      max: 120,
      step: 1,
      label: "Base Force",
    });
    pointerFolder.addBinding(config, "SPLAT_RADIUS", {
      min: 0.6,
      max: 10,
      step: 0.1,
      label: "Base Radius",
    });
    pointerFolder.addBinding(config, "SPEED_FORCE_GAIN", {
      min: 0.2,
      max: 8,
      step: 0.1,
      label: "Speed Force",
    });
    pointerFolder.addBinding(config, "SPEED_RADIUS_GAIN", {
      min: 0.01,
      max: 0.3,
      step: 0.005,
      label: "Speed Radius",
    });

    const frameFolder = pane.addFolder({ title: "Mask Frame" });
    frameFolder
      .addBinding(config, "FRAME_ENABLED", {
        label: "Enabled",
      })
      .on("change", syncFrameVisibility);
    frameFolder.addBinding(config, "FRAME_VORTEX_FORCE", {
      min: 1,
      max: 120,
      step: 1,
      label: "Vortex Force",
    });
    frameFolder.addBinding(config, "FRAME_VORTEX_RADIUS", {
      min: 0.5,
      max: 12,
      step: 0.1,
      label: "Vortex Radius",
    });
    frameFolder.addBinding(config, "FRAME_VORTEX_DYE", {
      min: 0,
      max: 1,
      step: 0.01,
      label: "Vortex Dye",
    });
    frameFolder.addBinding(config, "FRAME_VORTEX_SAMPLES", {
      min: 8,
      max: 180,
      step: 1,
      label: "Vortex Samples",
    });
    frameFolder.addBinding(config, "FRAME_VORTEX_BAND", {
      min: 4,
      max: 80,
      step: 1,
      label: "Vortex Band",
    });
    frameFolder.addBinding(config, "FRAME_VORTEX_PULL", {
      min: -1,
      max: 1,
      step: 0.01,
      label: "Vortex Pull",
    });
    frameFolder.addBinding(config, "FRAME_VORTEX_SPIN", {
      min: 0,
      max: 3,
      step: 0.01,
      label: "Vortex Spin",
    });
    frameFolder.addBinding(config, "FRAME_PADDING_BASE", {
      min: 0,
      max: 80,
      step: 1,
      label: "Pad Base",
    });
    frameFolder.addBinding(config, "FRAME_PADDING_MAX", {
      min: 6,
      max: 140,
      step: 1,
      label: "Pad Max",
    });
    frameFolder.addBinding(config, "FRAME_TRAVEL_SPEED", {
      min: 10,
      max: 280,
      step: 1,
      label: "Travel",
    });

    const renderFolder = pane.addFolder({ title: "Render" });
    renderFolder.addBinding(config, "COLOR_CLAMP", {
      min: 0.3,
      max: 3,
      step: 0.01,
      label: "Color Clamp",
    });
    renderFolder.addBinding(config, "ALPHA_MULTIPLIER", {
      min: 0.1,
      max: 3,
      step: 0.01,
      label: "Alpha",
    });
    const colorFolder = pane.addFolder({ title: "Color" });
    colorFolder.addBinding(config, "COLOR_BASE_INTENSITY", {
      min: 0.1,
      max: 2,
      step: 0.01,
      label: "Base",
    });
    colorFolder.addBinding(config, "COLOR_SPEED_INTENSITY", {
      min: 0,
      max: 0.03,
      step: 0.001,
      label: "Speed Boost",
    });
    colorFolder.addBinding(config, "COLOR_R_MULT", {
      min: 0,
      max: 2,
      step: 0.01,
      label: "R Mult",
    });
    colorFolder.addBinding(config, "COLOR_G_MULT", {
      min: 0,
      max: 2,
      step: 0.01,
      label: "G Mult",
    });
    colorFolder.addBinding(config, "COLOR_B_MULT", {
      min: 0,
      max: 2,
      step: 0.01,
      label: "B Mult",
    });
    colorFolder.addBinding(config, "COLOR_FRAME_INTENSITY", {
      min: 0,
      max: 2,
      step: 0.01,
      label: "Frame",
    });

    pane
      .addButton({ title: "Clear Fluid" })
      .on("click", () => createFieldArrays());
  }

  function createFieldArrays() {
    cellCount = simW * simH;
    vx = new Float32Array(cellCount);
    vy = new Float32Array(cellCount);
    vx0 = new Float32Array(cellCount);
    vy0 = new Float32Array(cellCount);
    pressure = new Float32Array(cellCount);
    pressure0 = new Float32Array(cellCount);
    divergence = new Float32Array(cellCount);
    dyeR = new Float32Array(cellCount);
    dyeG = new Float32Array(cellCount);
    dyeB = new Float32Array(cellCount);
    dyeR0 = new Float32Array(cellCount);
    dyeG0 = new Float32Array(cellCount);
    dyeB0 = new Float32Array(cellCount);
  }

  function resize() {
    const viewport = window.visualViewport;
    viewportWidthCss = viewport ? viewport.width : window.innerWidth;
    viewportHeightCss = viewport ? viewport.height : window.innerHeight;

    dpr = window.devicePixelRatio || 1;
    width = Math.max(1, Math.floor(viewportWidthCss * dpr));
    height = Math.max(1, Math.floor(viewportHeightCss * dpr));

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${viewportWidthCss}px`;
    canvas.style.height = `${viewportHeightCss}px`;

    const aspect = width / height;
    simH = Math.max(48, Math.floor(config.SIM_RESOLUTION));
    simW = Math.max(48, Math.floor(simH * aspect));

    const dyeBase = Math.max(simH, Math.floor(config.DYE_RESOLUTION));
    const dyeAspectW = Math.max(64, Math.floor(dyeBase * aspect));
    const dyeAspectH = Math.max(64, dyeBase);
    dyeCanvas.width = dyeAspectW;
    dyeCanvas.height = dyeAspectH;

    createFieldArrays();
  }

  function sample(field, x, y) {
    const cx = clamp(x, 0, simW - 1);
    const cy = clamp(y, 0, simH - 1);
    return field[idx(cx, cy)];
  }

  function bilerp(field, x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const tx = x - x0;
    const ty = y - y0;

    const a = sample(field, x0, y0);
    const b = sample(field, x1, y0);
    const c = sample(field, x0, y1);
    const d = sample(field, x1, y1);

    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  function addSplat(normX, normY, forceX, forceY, radiusCells, color) {
    const cx = Math.floor(normX * (simW - 1));
    const cy = Math.floor(normY * (simH - 1));
    const rad = Math.max(1.2, radiusCells);
    const minX = clamp(Math.floor(cx - rad * 2), 0, simW - 1);
    const maxX = clamp(Math.floor(cx + rad * 2), 0, simW - 1);
    const minY = clamp(Math.floor(cy - rad * 2), 0, simH - 1);
    const maxY = clamp(Math.floor(cy + rad * 2), 0, simH - 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const falloff = Math.exp(-(dx * dx + dy * dy) / (rad * rad));
        const i = idx(x, y);

        vx[i] += forceX * falloff;
        vy[i] += forceY * falloff;
        dyeR[i] += color.r * falloff;
        dyeG[i] += color.g * falloff;
        dyeB[i] += color.b * falloff;
      }
    }
  }

  function addFlowImpulse(
    normX,
    normY,
    forceX,
    forceY,
    radiusCells,
    color,
    dyeAmount = 0,
  ) {
    const cx = Math.floor(normX * (simW - 1));
    const cy = Math.floor(normY * (simH - 1));
    const rad = Math.max(1.2, radiusCells);
    const minX = clamp(Math.floor(cx - rad * 2), 0, simW - 1);
    const maxX = clamp(Math.floor(cx + rad * 2), 0, simW - 1);
    const minY = clamp(Math.floor(cy - rad * 2), 0, simH - 1);
    const maxY = clamp(Math.floor(cy + rad * 2), 0, simH - 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const falloff = Math.exp(-(dx * dx + dy * dy) / (rad * rad));
        const i = idx(x, y);

        vx[i] += forceX * falloff;
        vy[i] += forceY * falloff;
        if (dyeAmount > 0) {
          dyeR[i] += color.r * falloff * dyeAmount;
          dyeG[i] += color.g * falloff * dyeAmount;
          dyeB[i] += color.b * falloff * dyeAmount;
        }
      }
    }
  }

  function advectScalar(src, dst, dt, dissipation) {
    const dt0x = dt * (simW - 2);
    const dt0y = dt * (simH - 2);

    for (let y = 0; y < simH; y++) {
      for (let x = 0; x < simW; x++) {
        const i = idx(x, y);
        const backX = x - vx[i] * dt0x;
        const backY = y - vy[i] * dt0y;
        dst[i] = bilerp(src, backX, backY) * dissipation;
      }
    }
  }

  function advectVelocity(dt) {
    const dt0x = dt * (simW - 2);
    const dt0y = dt * (simH - 2);

    for (let y = 0; y < simH; y++) {
      for (let x = 0; x < simW; x++) {
        const i = idx(x, y);
        const backX = x - vx[i] * dt0x;
        const backY = y - vy[i] * dt0y;
        vx0[i] = bilerp(vx, backX, backY) * config.VELOCITY_DISSIPATION;
        vy0[i] = bilerp(vy, backX, backY) * config.VELOCITY_DISSIPATION;
      }
    }
    [vx, vx0] = [vx0, vx];
    [vy, vy0] = [vy0, vy];
  }

  function solvePressure() {
    for (let y = 1; y < simH - 1; y++) {
      for (let x = 1; x < simW - 1; x++) {
        const i = idx(x, y);
        const div =
          (vx[idx(x + 1, y)] -
            vx[idx(x - 1, y)] +
            vy[idx(x, y + 1)] -
            vy[idx(x, y - 1)]) *
          0.5;
        divergence[i] = div;
        pressure[i] = 0;
      }
    }

    for (let k = 0; k < config.PRESSURE_ITERATIONS; k++) {
      for (let y = 1; y < simH - 1; y++) {
        for (let x = 1; x < simW - 1; x++) {
          const i = idx(x, y);
          pressure0[i] =
            (pressure[idx(x - 1, y)] +
              pressure[idx(x + 1, y)] +
              pressure[idx(x, y - 1)] +
              pressure[idx(x, y + 1)] -
              divergence[i]) *
            0.25;
        }
      }
      [pressure, pressure0] = [pressure0, pressure];
    }

    for (let y = 1; y < simH - 1; y++) {
      for (let x = 1; x < simW - 1; x++) {
        const i = idx(x, y);
        vx[i] -= (pressure[idx(x + 1, y)] - pressure[idx(x - 1, y)]) * 0.5;
        vy[i] -= (pressure[idx(x, y + 1)] - pressure[idx(x, y - 1)]) * 0.5;
      }
    }
  }

  function updatePointerFluid(dt) {
    pointer.smoothX += (pointer.targetX - pointer.smoothX) * config.FRICTION;
    pointer.smoothY += (pointer.targetY - pointer.smoothY) * config.FRICTION;

    const dx = pointer.smoothX - pointer.prevX;
    const dy = pointer.smoothY - pointer.prevY;
    pointer.speed = Math.hypot(dx, dy);

    const normX = clamp(pointer.smoothX / viewportWidthCss, 0, 1);
    const normY = clamp(pointer.smoothY / viewportHeightCss, 0, 1);

    const speedBoost = clamp(pointer.speed * 1.6, 0, 60);
    const radius = config.SPLAT_RADIUS + speedBoost * config.SPEED_RADIUS_GAIN;
    const force = config.SPLAT_FORCE + speedBoost * config.SPEED_FORCE_GAIN;
    const intensity =
      config.COLOR_BASE_INTENSITY + speedBoost * config.COLOR_SPEED_INTENSITY;

    const isHoveringMask = Boolean(hoveredMaskRect);
    const baseColor = isHoveringMask ? { r: 1, g: 1, b: 1 } : ACCENT;

    addSplat(normX, normY, dx * force * dt, dy * force * dt, radius, {
      r: baseColor.r * intensity * config.COLOR_R_MULT,
      g: baseColor.g * intensity * config.COLOR_G_MULT,
      b: baseColor.b * intensity * config.COLOR_B_MULT,
    });

    pointer.prevX = pointer.smoothX;
    pointer.prevY = pointer.smoothY;
  }

  function pointInPerimeter(t, left, top, right, bottom) {
    const w = right - left;
    const h = bottom - top;
    const perimeter = w * 2 + h * 2;
    const d = ((t % perimeter) + perimeter) % perimeter;

    if (d <= w) return { x: left + d, y: top };
    if (d <= w + h) return { x: right, y: top + (d - w) };
    if (d <= w * 2 + h) return { x: right - (d - (w + h)), y: bottom };
    return { x: left, y: bottom - (d - (w * 2 + h)) };
  }

  function distanceOnRectPerimeter(x, y, left, top, right, bottom) {
    const w = right - left;
    const h = bottom - top;
    const perimeter = Math.max(1, w * 2 + h * 2);
    const cx = clamp(x, left, right);
    const cy = clamp(y, top, bottom);

    const topDist = Math.abs(y - top);
    const rightDist = Math.abs(x - right);
    const bottomDist = Math.abs(y - bottom);
    const leftDist = Math.abs(x - left);
    const minDist = Math.min(topDist, rightDist, bottomDist, leftDist);

    if (minDist === topDist) return clamp(cx - left, 0, perimeter);
    if (minDist === rightDist) return clamp(w + (cy - top), 0, perimeter);
    if (minDist === bottomDist)
      return clamp(w + h + (right - cx), 0, perimeter);
    return clamp(w + h + w + (bottom - cy), 0, perimeter);
  }

  function applyMaskVortex(dt) {
    if (!config.FRAME_ENABLED) return;
    if (!hoveredMaskRect && !wrapState.rect) return;

    const isActiveHover = Boolean(hoveredMaskRect);
    const baseRect = hoveredMaskRect || wrapState.rect;
    if (!baseRect) return;

    const nextProgress = isActiveHover
      ? wrapState.progress + dt * config.FRAME_WRAP_IN_SPEED
      : wrapState.progress - dt * config.FRAME_WRAP_OUT_SPEED;
    wrapState.progress = clamp(nextProgress, 0, 1);
    if (!isActiveHover && wrapState.progress <= 0.001) {
      wrapState.rect = null;
      wrapState.element = null;
      return;
    }

    const pad = clamp(
      config.FRAME_PADDING_BASE + pointer.speed * 0.45,
      config.FRAME_PADDING_BASE,
      config.FRAME_PADDING_MAX,
    );
    const left = baseRect.left - pad;
    const top = baseRect.top - pad;
    const right = baseRect.right + pad;
    const bottom = baseRect.bottom + pad;
    const perimeter = Math.max(1, (right - left) * 2 + (bottom - top) * 2);
    const coveredLength = Math.max(
      config.FRAME_VORTEX_SAMPLES,
      perimeter * wrapState.progress,
    );

    const samples = Math.max(
      3,
      Math.floor(
        config.FRAME_VORTEX_SAMPLES * (0.2 + wrapState.progress * 0.8),
      ),
    );
    const forceBase =
      config.FRAME_VORTEX_FORCE + clamp(pointer.speed * 0.5, 0, 24);
    const band = config.FRAME_VORTEX_BAND * (0.3 + wrapState.progress * 0.7);

    for (let i = 0; i < samples; i++) {
      const ratio = i / Math.max(1, samples - 1);
      const along = ratio * coveredLength;
      const travel =
        wrapState.anchor +
        wrapState.direction * along +
        elapsedTime *
          config.FRAME_TRAVEL_SPEED *
          config.FRAME_VORTEX_SPIN *
          0.18;
      const p = pointInPerimeter(travel, left, top, right, bottom);
      const pAhead = pointInPerimeter(
        travel + wrapState.direction * 14,
        left,
        top,
        right,
        bottom,
      );
      const dirX = pAhead.x - p.x;
      const dirY = pAhead.y - p.y;
      const dirLen = Math.max(0.0001, Math.hypot(dirX, dirY));
      const nX = -dirY / dirLen;
      const nY = dirX / dirLen;
      const tX = dirX / dirLen;
      const tY = dirY / dirLen;
      const pulse = 0.6 + Math.sin(elapsedTime * 4 + i * 0.5) * 0.4;
      const swirlForceX =
        (tX + nX * config.FRAME_VORTEX_PULL) * forceBase * pulse * dt;
      const swirlForceY =
        (tY + nY * config.FRAME_VORTEX_PULL) * forceBase * pulse * dt;

      const outerX = p.x + nX * band * 0.26;
      const outerY = p.y + nY * band * 0.26;
      const innerX = p.x - nX * band * 0.2;
      const innerY = p.y - nY * band * 0.2;

      addFlowImpulse(
        clamp(p.x / viewportWidthCss, 0, 1),
        clamp(p.y / viewportHeightCss, 0, 1),
        swirlForceX,
        swirlForceY,
        config.FRAME_VORTEX_RADIUS,
        { r: 1, g: 1, b: 1 },
        config.FRAME_VORTEX_DYE,
      );

      addFlowImpulse(
        clamp(outerX / viewportWidthCss, 0, 1),
        clamp(outerY / viewportHeightCss, 0, 1),
        swirlForceX + nX * forceBase * 0.2 * dt,
        swirlForceY + nY * forceBase * 0.2 * dt,
        config.FRAME_VORTEX_RADIUS * 0.9,
        { r: 1, g: 1, b: 1 },
        config.FRAME_VORTEX_DYE * 0.8,
      );

      addFlowImpulse(
        clamp(innerX / viewportWidthCss, 0, 1),
        clamp(innerY / viewportHeightCss, 0, 1),
        swirlForceX - nX * forceBase * 0.16 * dt,
        swirlForceY - nY * forceBase * 0.16 * dt,
        config.FRAME_VORTEX_RADIUS * 0.75,
        { r: 1, g: 1, b: 1 },
        config.FRAME_VORTEX_DYE * 0.7,
      );
    }
  }

  function updateHoveredMaskRect(x, y) {
    const hovered = document.elementFromPoint(x, y);
    const maskNode = hovered ? hovered.closest(".mask-p5") : null;

    if (maskNode) {
      hoveredMaskRect = maskNode.getBoundingClientRect();

      if (wrapState.element !== maskNode) {
        wrapState.element = maskNode;
        wrapState.rect = hoveredMaskRect;
        wrapState.progress = 0;

        const entryPad = config.FRAME_PADDING_BASE;
        wrapState.anchor = distanceOnRectPerimeter(
          x,
          y,
          hoveredMaskRect.left - entryPad,
          hoveredMaskRect.top - entryPad,
          hoveredMaskRect.right + entryPad,
          hoveredMaskRect.bottom + entryPad,
        );

        const vxEntry = pointer.targetX - pointer.prevX;
        const vyEntry = pointer.targetY - pointer.prevY;
        wrapState.direction = vxEntry + vyEntry >= 0 ? 1 : -1;
      } else {
        wrapState.rect = hoveredMaskRect;
      }
      return;
    }

    if (hoveredMaskRect && wrapState.rect) {
      const exitPad = config.FRAME_PADDING_BASE;
      wrapState.anchor = distanceOnRectPerimeter(
        x,
        y,
        wrapState.rect.left - exitPad,
        wrapState.rect.top - exitPad,
        wrapState.rect.right + exitPad,
        wrapState.rect.bottom + exitPad,
      );
      const vxExit = pointer.targetX - pointer.prevX;
      const vyExit = pointer.targetY - pointer.prevY;
      wrapState.direction = vxExit + vyExit >= 0 ? 1 : -1;
    }

    hoveredMaskRect = null;
  }

  function renderDye() {
    const imageData = dyeCtx.createImageData(simW, simH);
    const pixels = imageData.data;

    for (let i = 0; i < cellCount; i++) {
      const o = i * 4;
      const r = clamp(dyeR[i], 0, config.COLOR_CLAMP);
      const g = clamp(dyeG[i], 0, config.COLOR_CLAMP);
      const b = clamp(dyeB[i], 0, config.COLOR_CLAMP);
      const alpha = clamp(Math.max(r, g, b) * config.ALPHA_MULTIPLIER, 0, 1);

      pixels[o] = Math.floor(r * 255);
      pixels[o + 1] = Math.floor(g * 255);
      pixels[o + 2] = Math.floor(b * 255);
      pixels[o + 3] = Math.floor(alpha * 255);
    }

    dyeCanvas.width = simW;
    dyeCanvas.height = simH;
    dyeCtx.putImageData(imageData, 0, 0);

    const pixelStep = Math.max(1, Math.floor(config.PIXEL_SIZE * dpr));
    const pixelW = Math.max(1, Math.floor(width / pixelStep));
    const pixelH = Math.max(1, Math.floor(height / pixelStep));

    if (pixelCanvas.width !== pixelW || pixelCanvas.height !== pixelH) {
      pixelCanvas.width = pixelW;
      pixelCanvas.height = pixelH;
    }

    pixelCtx.clearRect(0, 0, pixelW, pixelH);
    pixelCtx.imageSmoothingEnabled = false;
    pixelCtx.drawImage(dyeCanvas, 0, 0, pixelW, pixelH);

    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixelCanvas, 0, 0, width, height);
  }

  function frame(now) {
    if (lastTime === 0) lastTime = now;
    const dt = clamp((now - lastTime) * 0.001, 0.001, 0.018);
    lastTime = now;
    elapsedTime += dt;

    if (pointer.ready) {
      updatePointerFluid(dt);
      applyMaskVortex(dt);
    }

    advectVelocity(dt);
    solvePressure();
    advectScalar(dyeR, dyeR0, dt, config.DENSITY_DISSIPATION);
    advectScalar(dyeG, dyeG0, dt, config.DENSITY_DISSIPATION);
    advectScalar(dyeB, dyeB0, dt, config.DENSITY_DISSIPATION);
    [dyeR, dyeR0] = [dyeR0, dyeR];
    [dyeG, dyeG0] = [dyeG0, dyeG];
    [dyeB, dyeB0] = [dyeB0, dyeB];
    renderDye();

    requestAnimationFrame(frame);
  }

  function onPointerMove(clientX, clientY) {
    pointer.targetX = clientX;
    pointer.targetY = clientY;
    pointer.ready = true;
    updateHoveredMaskRect(clientX, clientY);
  }

  window.addEventListener("mousemove", (event) => {
    onPointerMove(event.clientX, event.clientY);
  });

  window.addEventListener(
    "touchmove",
    (event) => {
      if (!event.touches.length) return;
      const touch = event.touches[0];
      onPointerMove(touch.clientX, touch.clientY);
    },
    { passive: true },
  );

  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }

  resize();
  setupPane();
  syncFrameVisibility();
  requestAnimationFrame(frame);
}
