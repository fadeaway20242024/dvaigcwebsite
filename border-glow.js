/**
 * BorderGlow — vanilla port of Vue Bits BorderGlow for edge-reactive mesh border glow.
 */

const GRADIENT_POSITIONS = [
  "80% 55%",
  "69% 34%",
  "8% 6%",
  "41% 38%",
  "86% 85%",
  "82% 18%",
  "51% 4%",
];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function parseHSL(hslStr) {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 32, s: 95, l: 62 };
  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
  };
}

function buildBoxShadow(glowColor, intensity) {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const layers = [
    [0, 0, 0, 1, 100, true],
    [0, 0, 1, 0, 60, true],
    [0, 0, 3, 0, 50, true],
    [0, 0, 6, 0, 40, true],
    [0, 0, 15, 0, 30, true],
    [0, 0, 25, 2, 20, true],
    [0, 0, 50, 2, 10, true],
    [0, 0, 1, 0, 60, false],
    [0, 0, 3, 0, 50, false],
    [0, 0, 6, 0, 40, false],
    [0, 0, 15, 0, 30, false],
    [0, 0, 25, 2, 20, false],
    [0, 0, 50, 2, 10, false],
  ];
  return layers
    .map(([x, y, blur, spread, alpha, inset]) => {
      const a = Math.min(alpha * intensity, 100);
      return `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px hsl(${base} / ${a}%)`;
    })
    .join(", ");
}

function buildMeshGradients(colors) {
  const gradients = [];
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    gradients.push(`radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`);
  }
  gradients.push(`linear-gradient(${colors[0]} 0 100%)`);
  return gradients;
}

function getCenterOfElement(el) {
  const { width, height } = el.getBoundingClientRect();
  return [width / 2, height / 2];
}

function getEdgeProximity(el, x, y) {
  const [cx, cy] = getCenterOfElement(el);
  const dx = x - cx;
  const dy = y - cy;
  let kx = Infinity;
  let ky = Infinity;
  if (dx !== 0) kx = cx / Math.abs(dx);
  if (dy !== 0) ky = cy / Math.abs(dy);
  return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
}

function getCursorAngle(el, x, y) {
  const [cx, cy] = getCenterOfElement(el);
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return 0;
  const radians = Math.atan2(dy, dx);
  let degrees = radians * (180 / Math.PI) + 90;
  if (degrees < 0) degrees += 360;
  return degrees;
}

const DEFAULTS = {
  edgeSensitivity: 30,
  glowColor: "32 95% 62%",
  backgroundColor: "rgba(16, 21, 40, 0.72)",
  borderRadius: 12,
  glowRadius: 28,
  glowIntensity: 0.85,
  coneSpread: 25,
  fillOpacity: 0.45,
  colors: ["#ff9a3c", "#a0c4ff", "#1a5fd4"],
};

export class BorderGlow {
  constructor(element, options = {}) {
    this.source = element;
    this.opts = { ...DEFAULTS, ...options };
    this.isHovered = false;
    this.cursorAngle = 45;
    this.edgeProximity = 0;
    this.meshBorder = null;
    this.meshFill = null;
    this.outerGlow = null;
    this.outerGlowInner = null;
    this.wrapper = null;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.init();
  }

  init() {
    const el = this.source;
    const parent = el.parentNode;
    if (!parent) return;

    const computed = getComputedStyle(el);
    const radius = parseFloat(computed.borderRadius) || this.opts.borderRadius;

    const wrapper = document.createElement("div");
    wrapper.className = "border-glow";
    wrapper.style.borderRadius = `${radius}px`;

    const meshBorder = document.createElement("div");
    meshBorder.className = "border-glow__mesh-border";
    meshBorder.setAttribute("aria-hidden", "true");

    const meshFill = document.createElement("div");
    meshFill.className = "border-glow__mesh-fill";
    meshFill.setAttribute("aria-hidden", "true");

    const outerGlow = document.createElement("div");
    outerGlow.className = "border-glow__outer";
    outerGlow.setAttribute("aria-hidden", "true");
    const outerGlowInner = document.createElement("span");
    outerGlow.appendChild(outerGlowInner);

    parent.insertBefore(wrapper, el);
    wrapper.append(meshBorder, meshFill, outerGlow, el);

    el.classList.add("border-glow__inner");

    this.wrapper = wrapper;
    this.meshBorder = meshBorder;
    this.meshFill = meshFill;
    this.outerGlow = outerGlow;
    this.outerGlowInner = outerGlowInner;
    this.opts.borderRadius = radius;

    this.meshGradients = buildMeshGradients(this.opts.colors);
    this.borderBg = this.meshGradients.map((g) => `${g} border-box`);
    this.fillBg = this.meshGradients.map((g) => `${g} padding-box`);

    outerGlowInner.style.boxShadow = buildBoxShadow(this.opts.glowColor, this.opts.glowIntensity);
    outerGlow.style.inset = `-${this.opts.glowRadius}px`;

    const onMove = (e) => {
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.edgeProximity = getEdgeProximity(wrapper, x, y);
      this.cursorAngle = getCursorAngle(wrapper, x, y);
      this.paint();
    };

    const onEnter = () => {
      this.isHovered = true;
      wrapper.classList.add("is-active");
      this.paint();
    };

    const onLeave = () => {
      this.isHovered = false;
      this.edgeProximity = 0;
      wrapper.classList.remove("is-active");
      this.paint();
    };

    wrapper.addEventListener("pointermove", onMove, { passive: true });
    wrapper.addEventListener("pointerenter", onEnter);
    wrapper.addEventListener("pointerleave", onLeave);

    this.cleanup = () => {
      wrapper.removeEventListener("pointermove", onMove);
      wrapper.removeEventListener("pointerenter", onEnter);
      wrapper.removeEventListener("pointerleave", onLeave);
    };

    this.paint();
  }

  paint() {
    if (!this.meshBorder) return;

    const { edgeSensitivity, coneSpread, backgroundColor, fillOpacity, glowRadius } = this.opts;
    const colorSensitivity = edgeSensitivity + 20;
    const visible = this.isHovered && !this.reduceMotion;

    const borderOpacity = visible
      ? Math.max(0, (this.edgeProximity * 100 - colorSensitivity) / (100 - colorSensitivity))
      : 0;
    const glowOpacity = visible
      ? Math.max(0, (this.edgeProximity * 100 - edgeSensitivity) / (100 - edgeSensitivity))
      : 0;

    const angleDeg = `${this.cursorAngle.toFixed(3)}deg`;
    const coneMask = `conic-gradient(from ${angleDeg} at center, black ${coneSpread}%, transparent ${
      coneSpread + 15
    }%, transparent ${100 - coneSpread - 15}%, black ${100 - coneSpread}%)`;
    const outerMask = `conic-gradient(from ${angleDeg} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`;

    const fillMask = [
      "linear-gradient(to bottom, black, black)",
      "radial-gradient(ellipse at 50% 50%, black 40%, transparent 65%)",
      "radial-gradient(ellipse at 66% 66%, black 5%, transparent 40%)",
      "radial-gradient(ellipse at 33% 33%, black 5%, transparent 40%)",
      "radial-gradient(ellipse at 66% 33%, black 5%, transparent 40%)",
      "radial-gradient(ellipse at 33% 66%, black 5%, transparent 40%)",
      `conic-gradient(from ${angleDeg} at center, transparent 5%, black 15%, black 85%, transparent 95%)`,
    ].join(", ");

    this.meshBorder.style.opacity = String(borderOpacity);
    this.meshBorder.style.background = [
      `linear-gradient(${backgroundColor} 0 100%) padding-box`,
      "linear-gradient(rgb(255 255 255 / 0%) 0% 100%) border-box",
      ...this.borderBg,
    ].join(", ");
    this.meshBorder.style.maskImage = coneMask;
    this.meshBorder.style.webkitMaskImage = coneMask;

    this.meshFill.style.opacity = String(borderOpacity * fillOpacity);
    this.meshFill.style.background = this.fillBg.join(", ");
    this.meshFill.style.maskImage = fillMask;
    this.meshFill.style.webkitMaskImage = fillMask;

    this.outerGlow.style.opacity = String(glowOpacity);
    this.outerGlow.style.maskImage = outerMask;
    this.outerGlow.style.webkitMaskImage = outerMask;
    this.outerGlowInner.style.inset = `${glowRadius}px`;
  }

  destroy() {
    this.cleanup?.();
    if (this.wrapper && this.source) {
      this.source.classList.remove("border-glow__inner");
      this.wrapper.parentNode?.insertBefore(this.source, this.wrapper);
      this.wrapper.remove();
    }
  }
}

export function initBorderGlow(selector, options = {}) {
  const instances = [];
  document.querySelectorAll(selector).forEach((el) => {
    instances.push(new BorderGlow(el, options));
  });
  return instances;
}
