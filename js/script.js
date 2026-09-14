import { Pane } from "https://esm.sh/tweakpane@4.0.4";

window.addEventListener("load", () => {
  initPixelFluidCursor();
});

function initPixelFluidCursor() {
  const initialAccentHex = normalizeHexColor(
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
    FRICTION: 0.22,
    COLOR_BASE_INTENSITY: 0.6,
    COLOR_SPEED_INTENSITY: 0.006,
    COLOR_R_MULT: 1,
    COLOR_G_MULT: 1,
    COLOR_B_MULT: 1,
    COLOR_BASE_HEX: initialAccentHex,
  };
  const RENDER_COLOR_CLAMP = 1.6;
  const RENDER_ALPHA_DARK = 1.4;
  const RENDER_ALPHA_LIGHT = 1.85;
  const lightSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
  let isLightScheme = lightSchemeQuery.matches;

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
  const pointer = {
    targetX: window.innerWidth * 0.5,
    targetY: window.innerHeight * 0.5,
    smoothX: window.innerWidth * 0.5,
    smoothY: window.innerHeight * 0.5,
    prevX: window.innerWidth * 0.5,
    prevY: window.innerHeight * 0.5,
    speed: 0,
    ready: false,
    lastInputAt: 0,
  };
  const POINTER_IDLE_MS = 80;
  const POINTER_SPLAT_SPEED = 0.04;

  const idx = (x, y) => x + y * simW;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  let accentColor = parseHexColor(config.COLOR_BASE_HEX);

  const themeState = { THEME: "system" };
  const THEME_OPTIONS = {
    System: "system",
    Dark: "dark",
    Light: "light",
  };
  const presetState = { MODE: "balanced" };
  const PRESET_OPTIONS = {
    "Balanced Flow": "balanced",
    "Brushing Flow": "brushing",
    "Fast cursor": "fast",
    "Neon Pulse": "neon",
    "Vortex Heavy": "vortex",
    Custom: "custom",
  };
  const PRESETS = {
    balanced: {
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
      FRICTION: 0.22,
      COLOR_BASE_INTENSITY: 0.6,
      COLOR_SPEED_INTENSITY: 0.006,
      COLOR_R_MULT: 1,
      COLOR_G_MULT: 1,
      COLOR_B_MULT: 1,
      COLOR_BASE_HEX: initialAccentHex,
    },
    brushing: {
      SIM_RESOLUTION: 250,
      DYE_RESOLUTION: 200,
      PIXEL_SIZE: 8,
      VELOCITY_DISSIPATION: 0.8,
      DENSITY_DISSIPATION: 0.99,
      PRESSURE_ITERATIONS: 8,
      SPLAT_FORCE: 6,
      SPLAT_RADIUS: 7.0,
      SPEED_RADIUS_GAIN: 0.06,
      SPEED_FORCE_GAIN: 0.8,
      FRICTION: 0.175,
      COLOR_BASE_INTENSITY: 0.2,
      COLOR_SPEED_INTENSITY: 0.001,
      COLOR_R_MULT: 1,
      COLOR_G_MULT: 1,
      COLOR_B_MULT: 1,
      COLOR_BASE_HEX: initialAccentHex,
    },
    fast: {
      SIM_RESOLUTION: 95,
      DYE_RESOLUTION: 190,
      PIXEL_SIZE: 12,
      VELOCITY_DISSIPATION: 0.575,
      DENSITY_DISSIPATION: 0.875,
      PRESSURE_ITERATIONS: 8,
      SPLAT_FORCE: 12,
      SPLAT_RADIUS: 1.6,
      SPEED_RADIUS_GAIN: 0.03,
      SPEED_FORCE_GAIN: 0.8,
      FRICTION: 0.3,
      COLOR_BASE_INTENSITY: 0.45,
      COLOR_SPEED_INTENSITY: 0.003,
      COLOR_R_MULT: 1,
      COLOR_G_MULT: 1,
      COLOR_B_MULT: 1,
      COLOR_BASE_HEX: initialAccentHex,
    },
    neon: {
      SIM_RESOLUTION: 180,
      DYE_RESOLUTION: 260,
      PIXEL_SIZE: 12,
      VELOCITY_DISSIPATION: 0.88,
      DENSITY_DISSIPATION: 0.97,
      PRESSURE_ITERATIONS: 14,
      SPLAT_FORCE: 28,
      SPLAT_RADIUS: 2.8,
      SPEED_RADIUS_GAIN: 0.08,
      SPEED_FORCE_GAIN: 1.9,
      FRICTION: 0.18,
      COLOR_BASE_INTENSITY: 0.85,
      COLOR_SPEED_INTENSITY: 0.012,
      COLOR_R_MULT: 0.8,
      COLOR_G_MULT: 0.95,
      COLOR_B_MULT: 1.35,
      COLOR_BASE_HEX: "#3e7dff",
    },
    vortex: {
      SIM_RESOLUTION: 200,
      DYE_RESOLUTION: 240,
      PIXEL_SIZE: 12,
      VELOCITY_DISSIPATION: 0.93,
      DENSITY_DISSIPATION: 0.95,
      PRESSURE_ITERATIONS: 12,
      SPLAT_FORCE: 88,
      SPLAT_RADIUS: 0.6,
      SPEED_RADIUS_GAIN: 0.3,
      SPEED_FORCE_GAIN: 5.4,
      FRICTION: 0.36,
      COLOR_BASE_INTENSITY: 0.58,
      COLOR_SPEED_INTENSITY: 0.005,
      COLOR_R_MULT: 1,
      COLOR_G_MULT: 1,
      COLOR_B_MULT: 1.1,
      COLOR_BASE_HEX: initialAccentHex,
    },
  };

  function normalizeHexColor(hex) {
    const clean = hex.startsWith("#") ? hex.slice(1) : hex;
    if (clean.length === 3) {
      return `#${clean
        .split("")
        .map((ch) => ch + ch)
        .join("")}`.toLowerCase();
    }
    if (clean.length === 6) return `#${clean}`.toLowerCase();
    return "#004bff";
  }

  function parseHexColor(hex) {
    const normalized = normalizeHexColor(hex);
    const clean = normalized.slice(1);
    if (clean.length !== 6) return { r: 0, g: 75 / 255, b: 1 };
    const int = Number.parseInt(clean, 16);
    if (Number.isNaN(int)) return { r: 0, g: 75 / 255, b: 1 };
    return {
      r: ((int >> 16) & 255) / 255,
      g: ((int >> 8) & 255) / 255,
      b: (int & 255) / 255,
    };
  }

  function refreshAccentColor() {
    config.COLOR_BASE_HEX = normalizeHexColor(config.COLOR_BASE_HEX);
    accentColor = parseHexColor(config.COLOR_BASE_HEX);
    document.documentElement.style.setProperty(
      "--accent-color",
      config.COLOR_BASE_HEX,
    );
  }

  function getAccentChannels() {
    return {
      r: accentColor.r * config.COLOR_R_MULT,
      g: accentColor.g * config.COLOR_G_MULT,
      b: accentColor.b * config.COLOR_B_MULT,
    };
  }

  function isDarkInkColor() {
    const { r, g, b } = getAccentChannels();

    return Math.max(r, g, b) < 1;
  }

  function applyTheme(mode = themeState.THEME) {
    themeState.THEME = mode;
    const root = document.documentElement;

    if (mode === "system") {
      root.removeAttribute("data-theme");
      isLightScheme = lightSchemeQuery.matches;
      return;
    }

    root.setAttribute("data-theme", mode);
    isLightScheme = mode === "light";
  }

  function syncColorScheme() {
    if (themeState.THEME === "system") {
      isLightScheme = lightSchemeQuery.matches;
    }
  }

  function setupMobileScrollLock() {
    const isCoarsePointer = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;
    if (!isCoarsePointer) return;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";
    canvas.style.touchAction = "none";
  }

  function setupPane() {
    const pane = new Pane({ title: "Fluid Pixel Cursor" });
    pane.expanded = false;
    pane.element.style.position = "fixed";
    pane.element.style.top = "12px";
    pane.element.style.right = "12px";
    pane.element.style.zIndex = "120";
    // pane.element.style.width = "320px";
    pane.element.style.pointerEvents = "auto";

    const presetsFolder = pane.addFolder({ title: "Presets" });
    let sim;
    let pointerFolder;
    let colorFolder;
    let clearButton;

    const setManualControlsVisible = (isVisible) => {
      if (sim) sim.hidden = !isVisible;
      if (pointerFolder) pointerFolder.hidden = !isVisible;
      if (colorFolder) colorFolder.hidden = !isVisible;
      if (clearButton) clearButton.hidden = !isVisible;
    };

    const applyPreset = (presetName) => {
      if (presetName === "custom") {
        setManualControlsVisible(true);
        sim.expanded = true;
        pointerFolder.expanded = false;
        colorFolder.expanded = false;
        pane.refresh();
        return;
      }

      const values = PRESETS[presetName];
      if (!values) return;
      Object.assign(config, values);
      refreshAccentColor();
      resize();
      setManualControlsVisible(false);
      sim.expanded = true;
      pointerFolder.expanded = false;
      colorFolder.expanded = false;
      pane.refresh();
    };

    presetsFolder
      .addBinding(themeState, "THEME", {
        label: "Theme",
        options: THEME_OPTIONS,
      })
      .on("change", (event) => {
        applyTheme(event.value);
      });
    presetsFolder
      .addBinding(presetState, "MODE", {
        label: "Variant",
        options: PRESET_OPTIONS,
      })
      .on("change", (event) => {
        applyPreset(event.value);
      });

    sim = pane.addFolder({ title: "Simulation" });
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

    pointerFolder = pane.addFolder({ title: "Pointer Splat" });
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

    colorFolder = pane.addFolder({ title: "Color" });
    colorFolder
      .addBinding(config, "COLOR_BASE_HEX", {
        // view: "color",
        label: "Base Color",
      })
      .on("change", refreshAccentColor);
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

    clearButton = pane
      .addButton({ title: "Clear Fluid" })
      .on("click", () => createFieldArrays());

    setManualControlsVisible(false);
    applyPreset(presetState.MODE);
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
    const hasInput = performance.now() - pointer.lastInputAt < POINTER_IDLE_MS;

    if (hasInput && pointer.speed > POINTER_SPLAT_SPEED) {
      const channels = getAccentChannels();
      const useInk = isLightScheme && isDarkInkColor();
      const ink =
        intensity *
        Math.max(1 - Math.max(channels.r, channels.g, channels.b), 0.55);

      addSplat(normX, normY, dx * force * dt, dy * force * dt, radius, {
        r: useInk ? ink : channels.r * intensity,
        g: useInk ? ink : channels.g * intensity,
        b: useInk ? ink : channels.b * intensity,
      });
    }

    pointer.prevX = pointer.smoothX;
    pointer.prevY = pointer.smoothY;
  }

  function renderDye() {
    const imageData = dyeCtx.createImageData(simW, simH);
    const pixels = imageData.data;
    const darkInk = isLightScheme && isDarkInkColor();
    const inkColor = darkInk ? getAccentChannels() : null;

    for (let i = 0; i < cellCount; i++) {
      const o = i * 4;
      let r;
      let g;
      let b;
      let alpha;

      if (darkInk) {
        const ink = Math.max(0, dyeR[i], dyeG[i], dyeB[i]);
        r = clamp(inkColor.r, 0, 1);
        g = clamp(inkColor.g, 0, 1);
        b = clamp(inkColor.b, 0, 1);
        alpha = clamp(
          clamp(ink, 0, RENDER_COLOR_CLAMP) * RENDER_ALPHA_LIGHT,
          0,
          1,
        );
      } else if (isLightScheme) {
        r = Math.max(0, dyeR[i]);
        g = Math.max(0, dyeG[i]);
        b = Math.max(0, dyeB[i]);
        const intensity = Math.max(r, g, b);
        const inv = intensity > 1e-6 ? 1 / intensity : 0;
        alpha = clamp(
          clamp(intensity, 0, RENDER_COLOR_CLAMP) * RENDER_ALPHA_LIGHT,
          0,
          1,
        );
        r *= inv;
        g *= inv;
        b *= inv;
      } else {
        r = clamp(dyeR[i], 0, RENDER_COLOR_CLAMP);
        g = clamp(dyeG[i], 0, RENDER_COLOR_CLAMP);
        b = clamp(dyeB[i], 0, RENDER_COLOR_CLAMP);
        alpha = clamp(Math.max(r, g, b) * RENDER_ALPHA_DARK, 0, 1);
      }

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

    if (pointer.ready) {
      updatePointerFluid(dt);
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
    pointer.lastInputAt = performance.now();
  }

  window.addEventListener("mousemove", (event) => {
    onPointerMove(event.clientX, event.clientY);
  });

  window.addEventListener(
    "touchmove",
    (event) => {
      if (!event.touches.length) return;
      const touch = event.touches[0];
      event.preventDefault();
      onPointerMove(touch.clientX, touch.clientY);
    },
    { passive: false },
  );

  window.addEventListener("touchend", () => {
    pointer.lastInputAt = 0;
  });
  window.addEventListener("touchcancel", () => {
    pointer.lastInputAt = 0;
  });

  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }

  resize();
  setupMobileScrollLock();
  applyTheme();
  setupPane();
  lightSchemeQuery.addEventListener("change", syncColorScheme);
  requestAnimationFrame(frame);
}
