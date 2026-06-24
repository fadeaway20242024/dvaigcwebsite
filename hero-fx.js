/**
 * Hero: 科技网格连线 + 鼠标聚光 + 名片 3D 倾斜（名片默认可见，无入场隐藏）
 */
import gsap from "https://esm.sh/gsap@3.12.7";
import { ScrollTrigger } from "https://esm.sh/gsap@3.12.7/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const hero = document.querySelector(".hero");
const card = document.querySelector(".hero-card");
const canvas = document.getElementById("hero-fx-canvas");
const spotlight = document.querySelector(".hero-spotlight");
const scrollBtn = document.querySelector(".hero-scroll-btn");

if (hero && card) {
  let ctx;

  const mouse = { x: 0.5, y: 0.5, active: false };
  const smooth = { x: 0.28, y: 0.48 };

  function accentRgb() {
    const accent = getComputedStyle(root).getPropertyValue("--color-accent").trim() || "#ff9a3c";
    if (accent.startsWith("#")) {
      const hex = accent.slice(1);
      const full =
        hex.length === 3
          ? hex
              .split("")
              .map((c) => c + c)
              .join("")
          : hex;
      const n = parseInt(full, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return [255, 154, 60];
  }

  function initSpotlight() {
    if (!spotlight) return;

    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = (e.clientY - rect.top) / rect.height;
      mouse.active = true;
      hero.classList.add("hero--pointer");
    };

    const onLeave = () => {
      mouse.active = false;
      hero.classList.remove("hero--pointer");
    };

    hero.addEventListener("mousemove", onMove, { passive: true });
    hero.addEventListener("mouseleave", onLeave);

    let spotRaf = 0;
    const tick = () => {
      const lerp = mouse.active ? 0.12 : 0.06;
      const targetX = mouse.active ? mouse.x : 0.28;
      const targetY = mouse.active ? mouse.y : 0.48;
      smooth.x += (targetX - smooth.x) * lerp;
      smooth.y += (targetY - smooth.y) * lerp;
      const spotX = `${smooth.x * 100}%`;
      const spotY = `${smooth.y * 100}%`;
      spotlight.style.setProperty("--spot-x", spotX);
      spotlight.style.setProperty("--spot-y", spotY);
      hero.style.setProperty("--glare-x", spotX);
      hero.style.setProperty("--glare-y", spotY);
      spotlight.style.opacity = mouse.active ? "1" : "0.55";
      spotRaf = requestAnimationFrame(tick);
    };
    spotRaf = requestAnimationFrame(tick);

    return () => {
      hero.removeEventListener("mousemove", onMove);
      hero.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(spotRaf);
    };
  }

  function initMesh() {
    if (!canvas) return () => {};

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return () => {};

    const nodes = [];
    const count = 42;
    let w = 0;
    let h = 0;
    let animId = 0;
    const linkDist = 130;
    const mouseRadius = 200;
    const meshMouse = { x: 0, y: 0, active: false };

    function resize() {
      const rect = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!nodes.length) {
        for (let i = 0; i < count; i++) {
          nodes.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.22,
            vy: (Math.random() - 0.5) * 0.22,
            size: 1 + Math.random() * 1.2,
          });
        }
      }
    }

    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      meshMouse.x = e.clientX - rect.left;
      meshMouse.y = e.clientY - rect.top;
      meshMouse.active = true;
    };
    const onLeave = () => {
      meshMouse.active = false;
    };

    hero.addEventListener("mousemove", onMove, { passive: true });
    hero.addEventListener("mouseleave", onLeave);
    const ro = new ResizeObserver(resize);
    ro.observe(hero);
    resize();

    const [r, g, b] = accentRgb();
    const isLight = () => root.getAttribute("data-theme") === "light";

    function frame() {
      ctx2d.clearRect(0, 0, w, h);
      const light = isLight();

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > w) node.vx *= -1;
        if (node.y < 0 || node.y > h) node.vy *= -1;

        if (meshMouse.active) {
          const dx = meshMouse.x - node.x;
          const dy = meshMouse.y - node.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < mouseRadius) {
            const force = (1 - dist / mouseRadius) * 0.35;
            node.x -= (dx / dist) * force * 4;
            node.y -= (dy / dist) * force * 4;
          }
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * (light ? 0.22 : 0.38);
            ctx2d.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.moveTo(a.x, a.y);
            ctx2d.lineTo(b.x, b.y);
            ctx2d.stroke();
          }
        }
      }

      for (const node of nodes) {
        const glow = light ? 0.35 : 0.55;
        ctx2d.fillStyle = `rgba(${r},${g},${b},${glow})`;
        ctx2d.fillRect(node.x - node.size, node.y - node.size, node.size * 2, node.size * 2);
      }

      if (meshMouse.active) {
        const grad = ctx2d.createRadialGradient(meshMouse.x, meshMouse.y, 0, meshMouse.x, meshMouse.y, 140);
        grad.addColorStop(0, `rgba(${r},${g},${b},${light ? 0.12 : 0.18})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(meshMouse.x - 140, meshMouse.y - 140, 280, 280);
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      hero.removeEventListener("mousemove", onMove);
      hero.removeEventListener("mouseleave", onLeave);
      ro.disconnect();
    };
  }

  function buildScroll() {
    gsap.to(card, {
      y: -28,
      autoAlpha: 0.72,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 0.5,
        invalidateOnRefresh: true,
      },
    });

    if (scrollBtn) {
      gsap.to(scrollBtn, {
        y: 20,
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: {
          trigger: hero,
          start: "50% top",
          end: "bottom top",
          scrub: 0.4,
        },
      });
    }
  }

  function buildScrollBtnBob() {
    if (!scrollBtn) return;
    gsap.to(scrollBtn, {
      y: 5,
      duration: 1.4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }

  function initInteractive() {
    const cleanups = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduce) {
      cleanups.push(initSpotlight());
      cleanups.push(initMesh());
    }

    return () => cleanups.forEach((fn) => fn?.());
  }

  function initScrollFx() {
    ctx?.revert();

    ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add({ reduceMotion: "(prefers-reduced-motion: reduce)" }, (context) => {
        if (context.conditions.reduceMotion) return;
        buildScroll();
        buildScrollBtnBob();
      });
    }, hero);
  }

  let cleanupInteractive = initInteractive();
  initScrollFx();

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });

  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
    cleanupInteractive();
    cleanupInteractive = initInteractive();
    initScrollFx();
  });

  window.addEventListener(
    "beforeunload",
    () => {
      cleanupInteractive();
      ctx?.revert();
    },
    { once: true }
  );
}
