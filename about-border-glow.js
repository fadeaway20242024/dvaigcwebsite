import { initBorderGlow } from "./border-glow.js";

function themeColors() {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  if (isLight) {
    return {
      backgroundColor: "rgba(255, 255, 255, 0.88)",
      glowColor: "24 90% 48%",
      colors: ["#e8741a", "#5b8def", "#a0c4ff"],
      glowIntensity: 0.7,
    };
  }
  return {
    backgroundColor: "rgba(16, 21, 40, 0.72)",
    glowColor: "32 95% 62%",
    colors: ["#ff9a3c", "#a0c4ff", "#1a5fd4"],
    glowIntensity: 0.85,
  };
}

let instances = [];

function mount() {
  instances.forEach((inst) => inst.destroy());
  instances = initBorderGlow(".about-info-tile", {
    edgeSensitivity: 30,
    borderRadius: 12,
    glowRadius: 24,
    coneSpread: 25,
    fillOpacity: 0.45,
    ...themeColors(),
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}

window.addEventListener("themechange", mount);

const themeObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.attributeName === "data-theme") {
      mount();
      break;
    }
  }
});
themeObserver.observe(document.documentElement, { attributes: true });
