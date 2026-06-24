(function () {
  "use strict";

  let projects = [];

  const PROJECTS_STORAGE_KEY = "portfolio-projects-draft";
  const PROJECTS_JSON_URL = "data/projects.json";
  const MEDIA_CACHE_VER = "20250623d";

  async function loadProjects() {
    const isLocalHost =
      location.hostname === "127.0.0.1" || location.hostname === "localhost";

    let jsonData = null;
    let draftData = null;

    try {
      const res = await fetch(PROJECTS_JSON_URL + "?v=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length) jsonData = json;
      }
    } catch (_) {
      /* ignore */
    }

    if (isLocalHost) {
      try {
        const draft = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (draft) {
          const parsed = JSON.parse(draft);
          if (Array.isArray(parsed) && parsed.length) draftData = parsed;
        }
      } catch (_) {
        /* ignore */
      }
    }

    const data = jsonData || draftData;
    return (data || []).map(normalizeCaseMedia);
  }

  function isDirectVideoUrl(url) {
    const value = String(url || "").trim();
    if (!value) return false;
    try {
      return /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.test(new URL(value, "https://example.com").pathname);
    } catch (_) {
      return /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.test(value);
    }
  }

  function resolveCaseExternalUrl(p, cs) {
    cs = cs || {};
    const external = String(p.externalUrl || "").trim();
    if (external) return external;
    const legacyVideo = String(cs.videoUrl || "").trim();
    if (legacyVideo && !isDirectVideoUrl(legacyVideo)) return legacyVideo;
    const embed = String(p.embedUrl || "").trim();
    if (embed && /xinpianchang\.com/i.test(embed)) return embed;
    return "";
  }

  function resolveDirectVideoUrl(p, cs) {
    cs = cs || {};
    const candidates = [cs.videoUrl, p.previewVideoUrl];
    for (let i = 0; i < candidates.length; i++) {
      const value = String(candidates[i] || "").trim();
      if (value && isDirectVideoUrl(value)) return value;
    }
    return "";
  }

  function normalizeCaseMedia(p) {
    if (!p || !p.caseStudy) return p;
    const cs = p.caseStudy;
    const videoUrl = String(cs.videoUrl || "").trim();
    if (videoUrl && !isDirectVideoUrl(videoUrl)) {
      if (!String(p.externalUrl || "").trim()) p.externalUrl = videoUrl;
      cs.videoUrl = "";
    }

    const poster = String(p.posterUrl || cs.videoPoster || "").trim();
    if (poster) {
      p.posterUrl = poster;
      cs.videoPoster = poster;
    }

    cs.galleryAspect = String(cs.galleryAspect || "").trim() === "9:16" ? "9:16" : "16:9";
    if (Array.isArray(cs.gallery)) {
      cs.gallery = cs.gallery.filter(function (src) {
        return String(src || "").trim();
      });
    }
    return p;
  }

  function galleryAspectWrapClass(aspect) {
    return String(aspect || "").trim() === "9:16"
      ? "case-stills-wrap--portrait"
      : "case-stills-wrap--landscape";
  }

  const caseLayout = document.getElementById("case-layout");
  const caseMediaMain = document.getElementById("case-media-main");
  const caseGallery = document.getElementById("case-gallery");

  let caseLayoutMetricsHandler = null;
  let caseLayoutMetricsProject = null;
  let caseLeftResizeObserver = null;

  function isPortraitGallery(aspect) {
    return String(aspect || "").trim() === "9:16";
  }

  function countActiveCaseStills() {
    if (!caseGallery) return 0;
    return caseGallery.querySelectorAll(".case-still:not(.is-broken)").length;
  }

  function measureLeftColumnHeight() {
    if (!caseLayout) return 0;
    const leftCol = caseLayout.querySelector(".case-left");
    if (!leftCol) return 0;

    const cover = leftCol.querySelector(".case-media-main");
    const stillsWrap = leftCol.querySelector(".case-stills-wrap");
    if (cover && stillsWrap) {
      const coverRect = cover.getBoundingClientRect();
      const stillsRect = stillsWrap.getBoundingClientRect();
      if (coverRect.height > 0 && stillsRect.height > 0) {
        return Math.ceil(stillsRect.bottom - coverRect.top);
      }
    }

    return Math.ceil(leftCol.getBoundingClientRect().height);
  }

  function clearCaseLayoutMetrics() {
    if (caseLayoutMetricsHandler) {
      window.removeEventListener("resize", caseLayoutMetricsHandler);
      caseLayoutMetricsHandler = null;
    }
    if (caseLeftResizeObserver) {
      caseLeftResizeObserver.disconnect();
      caseLeftResizeObserver = null;
    }
    caseLayoutMetricsProject = null;
    if (caseLayout) {
      caseLayout.classList.remove("case-layout--height-synced", "case-layout--portrait");
      caseLayout.style.removeProperty("--case-col-height");
      caseLayout.style.height = "";
      caseLayout.style.minHeight = "";
      caseLayout.style.maxHeight = "";
      const leftCol = caseLayout.querySelector(".case-left");
      const rightCol = caseLayout.querySelector(".case-right");
      const panel = caseLayout.querySelector(".case-panel");
      if (leftCol) {
        leftCol.style.height = "";
        leftCol.style.minHeight = "";
        leftCol.style.maxHeight = "";
      }
      if (rightCol) {
        rightCol.style.height = "";
        rightCol.style.minHeight = "";
        rightCol.style.maxHeight = "";
      }
      if (panel) {
        panel.style.height = "";
        panel.style.minHeight = "";
        panel.style.maxHeight = "";
      }
    }
    if (caseGallery) {
      caseGallery.style.removeProperty("--portrait-still-w");
      caseGallery.style.removeProperty("--portrait-still-h");
      caseGallery.style.removeProperty("--portrait-gap");
    }
  }

  function bindCaseLeftResizeObserver() {
    if (!caseLayout || caseLeftResizeObserver || typeof ResizeObserver === "undefined") return;
    const leftCol = caseLayout.querySelector(".case-left");
    if (!leftCol) return;

    caseLeftResizeObserver = new ResizeObserver(function () {
      if (caseLayoutMetricsProject) syncCaseColumnHeights(caseLayoutMetricsProject);
    });
    caseLeftResizeObserver.observe(leftCol);
  }

  function layoutPortraitGallery(p) {
    if (!caseGallery || !caseLayout || !p || !p.caseStudy) return;
    if (!isPortraitGallery(p.caseStudy.galleryAspect)) return;

    const stillsWrap = caseGallery.closest(".case-stills-wrap");
    const leftCol = stillsWrap && stillsWrap.closest(".case-left");
    const count = countActiveCaseStills();
    if (!stillsWrap || !leftCol || !count) return;

    const cols = 4;
    const gridGap = 5;
    const leftW = leftCol.clientWidth;
    if (leftW <= 0) return;

    const cellW = (leftW - gridGap * (cols - 1)) / cols;
    const cellH = (cellW * 16) / 9;

    caseGallery.style.setProperty("--portrait-still-w", cellW.toFixed(2) + "px");
    caseGallery.style.setProperty("--portrait-still-h", cellH.toFixed(2) + "px");
    caseGallery.style.setProperty("--portrait-gap", gridGap + "px");
  }

  function syncCaseColumnHeights(p) {
    if (!caseLayout || caseLayout.hidden) return;
    if (window.matchMedia("(max-width: 960px)").matches) {
      clearCaseLayoutMetrics();
      return;
    }

    const isPortrait = isPortraitGallery(p && p.caseStudy && p.caseStudy.galleryAspect);
    const leftCol = caseLayout.querySelector(".case-left");
    const rightCol = caseLayout.querySelector(".case-right");
    const panel = caseLayout.querySelector(".case-panel");
    if (!leftCol || !rightCol || !panel) return;

    caseLayout.classList.toggle("case-layout--portrait", isPortrait);

    leftCol.style.height = "";
    leftCol.style.minHeight = "";
    leftCol.style.maxHeight = "";

    if (isPortrait) {
      caseLayout.classList.remove("case-layout--height-synced");
      layoutPortraitGallery(p);
    } else {
      caseLayout.classList.add("case-layout--height-synced");
      if (caseGallery) {
        caseGallery.style.removeProperty("--portrait-still-w");
        caseGallery.style.removeProperty("--portrait-still-h");
        caseGallery.style.removeProperty("--portrait-gap");
      }
    }

    void leftCol.offsetHeight;

    const h = measureLeftColumnHeight();
    if (h <= 0) return;

    const heightPx = h + "px";
    caseLayout.style.setProperty("--case-col-height", heightPx);
    caseLayout.style.height = heightPx;
    caseLayout.style.minHeight = "0";
    caseLayout.style.maxHeight = heightPx;

    rightCol.style.height = heightPx;
    rightCol.style.minHeight = "0";
    rightCol.style.maxHeight = heightPx;

    panel.style.height = "100%";
    panel.style.minHeight = "0";
    panel.style.maxHeight = "100%";
  }

  function applyCaseLayoutMetrics(p) {
    if (!p || !p.caseStudy) return;
    syncCaseColumnHeights(p);
    bindCaseLeftResizeObserver();
  }

  function scheduleCaseLayoutMetrics(p) {
    if (!p || !p.caseStudy) {
      clearCaseLayoutMetrics();
      return;
    }

    caseLayoutMetricsProject = p;
    if (!caseLayoutMetricsHandler) {
      caseLayoutMetricsHandler = function () {
        if (caseLayoutMetricsProject) applyCaseLayoutMetrics(caseLayoutMetricsProject);
      };
      window.addEventListener("resize", caseLayoutMetricsHandler);
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        applyCaseLayoutMetrics(p);
        requestAnimationFrame(function () {
          applyCaseLayoutMetrics(p);
        });
      });
    });
    window.setTimeout(function () {
      if (caseLayoutMetricsProject === p) applyCaseLayoutMetrics(p);
    }, 120);
    window.setTimeout(function () {
      if (caseLayoutMetricsProject === p) applyCaseLayoutMetrics(p);
    }, 400);
  }

  const grid = document.getElementById("project-grid");
  const filters = document.getElementById("filters");
  const themeToggle = document.getElementById("theme-toggle");

  const projectModal = document.getElementById("project-modal");
  const modalPanel = projectModal ? projectModal.querySelector(".modal") : null;
  const modalBody = modalPanel ? modalPanel.querySelector(".modal-body") : null;
  const modalTitle = document.getElementById("modal-title");
  const modalText = document.getElementById("modal-text");
  const modalPreview = document.getElementById("modal-preview");
  const modalEmbedWrap = document.getElementById("modal-embed-wrap");
  const modalTags = document.getElementById("modal-tags");
  const modalClose = document.getElementById("modal-close");
  const modalWatch = document.getElementById("modal-watch");
  const caseIntroKicker = document.getElementById("case-intro-kicker");
  const caseIntroTitle = document.getElementById("case-intro-title");
  const caseIntroSubtitle = document.getElementById("case-intro-subtitle");
  const caseIntroBody = document.getElementById("case-intro-body");
  const caseDecor = document.getElementById("case-decor");
  const caseBriefGrid = document.getElementById("case-brief-grid");
  const caseMetaStrip = document.getElementById("case-meta-strip");
  const modalActions = document.querySelector(".modal-actions");
  const caseStillLightbox = document.getElementById("case-still-lightbox");
  const caseStillLightboxImg = document.getElementById("case-still-lightbox-img");
  const caseStillLightboxCaption = document.getElementById("case-still-lightbox-caption");
  const caseStillLightboxClose = document.getElementById("case-still-lightbox-close");

  let activeCaseStillIndex = -1;

  const projectCategories = [
    { id: "all", label: "全部" },
    { id: "ai-ad", label: "AI广告" },
    { id: "ai-short", label: "AI短片" },
    { id: "ai-ecommerce", label: "AI电商" },
    { id: "ai-live-action", label: "AI+实拍" },
    { id: "style-experiment", label: "视觉探索" },
  ];

  let activeFilter = "all";

  function getStoredTheme() {
    try {
      return localStorage.getItem("portfolio-theme");
    } catch {
      return null;
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("portfolio-theme", theme);
    } catch {
      /* ignore */
    }
    const isLight = theme === "light";
    if (!themeToggle) return;
    themeToggle.setAttribute("aria-label", isLight ? "切换为深色模式" : "切换为浅色模式");
    const iconSun = themeToggle.querySelector("[data-icon='sun']");
    const iconMoon = themeToggle.querySelector("[data-icon='moon']");
    if (iconSun && iconMoon) {
      iconSun.classList.toggle("hidden", isLight);
      iconMoon.classList.toggle("hidden", !isLight);
    }
  }

  function initTheme() {
    const stored = getStoredTheme();
    if (stored === "dark") {
      applyTheme("dark");
      return;
    }
    applyTheme("light");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      applyTheme(isLight ? "dark" : "light");
    });
  }

  function bindFilterButtons(container, onChange) {
    if (!container) return;
    container.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onChange(btn.getAttribute("data-filter") || "all", btn);
        container.querySelectorAll(".filter-btn").forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
      });
    });
  }

  function renderProjectFilters() {
    if (!filters) return;
    filters.innerHTML = projectCategories
      .map(function (c) {
        const pressed = c.id === activeFilter;
        return (
          '<button type="button" class="filter-btn" data-filter="' +
          c.id +
          '" aria-pressed="' +
          pressed +
          '">' +
          c.label +
          "</button>"
        );
      })
      .join("");
    bindFilterButtons(filters, function (id) {
      activeFilter = id;
      renderProjects();
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function resolveMediaUrl(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^(https?:|data:)/i.test(value)) return value;
    if (value.startsWith("/")) return value;
    const joiner = value.includes("?") ? "&" : "?";
    return value + joiner + "v=" + MEDIA_CACHE_VER;
  }

  function bindBrokenImageFallback(img) {
    if (!img || img.dataset.fallbackBound === "1") return;
    img.dataset.fallbackBound = "1";
    img.addEventListener("error", function () {
      const still = img.closest(".case-still");
      if (!still) return;
      still.classList.add("is-broken");
      img.removeAttribute("src");
    });
  }

  function projectRowMedia(p) {
    const poster = p.posterUrl && String(p.posterUrl).trim();
    const previewSrc = p.previewVideoUrl && String(p.previewVideoUrl).trim();
    const previewBlock = previewSrc
      ? '<video class="project-row-preview" src="' +
        escapeHtml(previewSrc) +
        '" muted loop playsinline preload="metadata" aria-hidden="true"></video>'
      : "";
    const coverBlock = poster
      ? '<img class="project-row-cover" src="' +
        escapeHtml(resolveMediaUrl(poster)) +
        '" alt="" width="960" height="540" loading="lazy" decoding="async" />'
      : '<span class="project-row-poster-gradient" style="--card-gradient:' +
        p.gradient +
        '"></span>' +
        '<span class="project-row-poster-pattern" aria-hidden="true"></span>' +
        '<span class="project-row-poster-corner" aria-hidden="true"></span>';

    return (
      '<button type="button" class="project-row-hit" data-project-open="' +
      p.id +
      '" aria-label="查看「' +
      escapeHtml(p.title) +
      '」详情与成片">' +
      '<span class="project-row-visual">' +
      coverBlock +
      previewBlock +
      '<span class="project-row-play" aria-hidden="true">' +
      '<span class="project-row-play-btn">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
      "</span></span>" +
      "</span></button>"
    );
  }

  function projectRow(p) {
    const tagsHtml = p.tags.length
      ? '<div class="project-row-meta">' +
        p.tags
          .map(function (t) {
            return '<span class="tag">' + escapeHtml(t) + "</span>";
          })
          .join("") +
        "</div>"
      : "";

    return (
      '<article class="project-row reveal" data-id="' +
      p.id +
      '" aria-labelledby="proj-title-' +
      p.id +
      '">' +
      '<div class="project-row-media">' +
      projectRowMedia(p) +
      "</div>" +
      '<div class="project-row-copy">' +
      tagsHtml +
      '<h3 class="project-row-title" id="proj-title-' +
      p.id +
      '">' +
      escapeHtml(p.title) +
      "</h3>" +
      '<p class="project-row-lead">' +
      escapeHtml(p.desc) +
      "</p>" +
      "</div></article>"
    );
  }

  function renderProjects() {
    if (!grid) return;
    const list =
      activeFilter === "all"
        ? projects
        : projects.filter(function (p) {
            return p.category === activeFilter;
          });
    grid.innerHTML = list.map(projectRow).join("");
    grid.querySelectorAll("[data-project-open]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const id = btn.getAttribute("data-project-open");
        const p = projects.find(function (x) {
          return x.id === id;
        });
        if (!p) return;
        btn.classList.remove("project-row-hit--pulse");
        void btn.offsetWidth;
        btn.classList.add("project-row-hit--pulse");
        window.setTimeout(function () {
          btn.classList.remove("project-row-hit--pulse");
        }, 480);
        openProjectModal(p);
      });
    });
    bindRowPreviewHover(grid);
    observeReveals(grid);
  }

  function bindRowPreviewHover(container) {
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    container.querySelectorAll(".project-row").forEach(function (row) {
      const hit = row.querySelector(".project-row-hit");
      const vid = row.querySelector("video.project-row-preview");
      if (!hit) return;
      row.addEventListener("mouseenter", function () {
        hit.classList.add("is-hover-preview");
        if (vid) vid.play().catch(function () {});
      });
      row.addEventListener("mouseleave", function () {
        hit.classList.remove("is-hover-preview");
        if (!vid) return;
        vid.pause();
        try {
          vid.currentTime = 0;
        } catch (e) {
          /* ignore */
        }
      });
    });
  }

  function pauseCaseVideo() {
    if (!caseMediaMain) return;
    const vid = caseMediaMain.querySelector("video");
    if (vid) vid.pause();
  }

  function renderCaseVideoPlayer(p) {
    if (!caseMediaMain) return;
    normalizeCaseMedia(p);
    const cs = p.caseStudy || {};
    const directVideo = resolveDirectVideoUrl(p, cs);
    const poster = resolveMediaUrl(cs.videoPoster || p.posterUrl || "");
    const external = resolveCaseExternalUrl(p, cs);
    let mediaHtml = "";

    if (directVideo) {
      mediaHtml =
        '<video class="case-video" controls playsinline preload="metadata" poster="' +
        escapeHtml(poster) +
        '">' +
        '<source src="' +
        escapeHtml(directVideo) +
        '" type="video/mp4" />' +
        "您的浏览器不支持视频播放。" +
        "</video>";
    } else {
      mediaHtml =
        '<div class="case-video-fallback">' +
        '<img class="case-video-poster" src="' +
        escapeHtml(poster) +
        '" alt="' +
        escapeHtml(p.title) +
        '" loading="eager" decoding="async" draggable="false" />' +
        (external
          ? '<a class="case-video-play" href="' +
            escapeHtml(external) +
            '" target="_blank" rel="noopener noreferrer" aria-label="在新片场观看全片">' +
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
            "</a>"
          : "") +
        "</div>";
    }

    caseMediaMain.innerHTML =
      '<div class="case-media-vignette" aria-hidden="true"></div>' +
      mediaHtml +
      (external && directVideo
        ? '<a class="case-media-watch btn btn-primary" href="' +
          escapeHtml(external) +
          '" target="_blank" rel="noopener noreferrer"><span>新片场观看全片</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg></a>'
        : external && !directVideo
          ? '<span class="case-media-hint">点击播放按钮 · 新片场观看全片</span>'
          : "");

  }

  function closeCaseStillLightbox() {
    if (!caseStillLightbox) return;
    caseStillLightbox.hidden = true;
    caseStillLightbox.setAttribute("aria-hidden", "true");
    if (caseStillLightboxImg) {
      caseStillLightboxImg.removeAttribute("src");
      caseStillLightboxImg.alt = "";
    }
    if (caseStillLightboxCaption) caseStillLightboxCaption.textContent = "";
    activeCaseStillIndex = -1;
    setActiveCaseStill(-1);
  }

  function openCaseStillLightbox(src, caption, index) {
    if (!caseStillLightbox || !caseStillLightboxImg) return;
    pauseCaseVideo();
    caseStillLightboxImg.src = src;
    caseStillLightboxImg.alt = caption;
    caseStillLightboxImg.setAttribute("draggable", "false");
    if (caseStillLightboxCaption) caseStillLightboxCaption.textContent = caption;
    caseStillLightbox.hidden = false;
    caseStillLightbox.setAttribute("aria-hidden", "false");
    activeCaseStillIndex = index;
    setActiveCaseStill(index);
    if (caseStillLightboxClose) caseStillLightboxClose.focus();
  }

  function setActiveCaseStill(index) {
    if (!caseGallery) return;
    caseGallery.querySelectorAll(".case-still").forEach(function (btn, i) {
      btn.classList.toggle("is-active", index >= 0 && i === index);
    });
  }

  function renderCaseKicker(kicker) {
    if (!caseIntroKicker) return;
    const text = kicker || "Case Study";
    caseIntroKicker.innerHTML =
      '<span class="case-intro-kicker__dot" aria-hidden="true"></span>' +
      escapeHtml(text);
  }

  function renderCaseMetaStrip(cs) {
    if (!caseMetaStrip) return;
    const meta = Array.isArray(cs.meta)
      ? cs.meta.filter(function (item) {
          return item && (item.label || item.value);
        })
      : [];
    if (!meta.length) {
      caseMetaStrip.innerHTML = "";
      caseMetaStrip.hidden = true;
      return;
    }
    caseMetaStrip.hidden = false;
    caseMetaStrip.innerHTML = meta
      .map(function (item) {
        return (
          '<div class="case-meta-item">' +
          '<span class="case-meta-label">' +
          escapeHtml(item.label || "") +
          "</span>" +
          '<span class="case-meta-value">' +
          escapeHtml(item.value || "") +
          "</span></div>"
        );
      })
      .join("");
  }

  function renderCaseStillsGrid(p, gallery, aspect) {
    if (!caseGallery || !gallery.length) return;
    const cs = p.caseStudy || {};
    const title = cs.title || p.title;
    const isPortrait = String(aspect || cs.galleryAspect || "").trim() === "9:16";
    const resolvedGallery = gallery.map(resolveMediaUrl).filter(Boolean);

    caseGallery.classList.toggle("case-stills-grid--portrait-row", isPortrait);

    caseGallery.innerHTML = resolvedGallery
      .map(function (src, i) {
        const num = String(i + 1).padStart(2, "0");
        return (
          '<button type="button" class="case-still" data-case-still="' +
          i +
          '" aria-label="放大预览剧照 ' +
          num +
          '">' +
          '<img src="' +
          escapeHtml(src) +
          '" alt="' +
          escapeHtml(title + " 剧照 " + num) +
          '" loading="lazy" decoding="async" draggable="false" />' +
          "</button>"
        );
      })
      .join("");

    caseGallery.querySelectorAll("img").forEach(function (img) {
      bindBrokenImageFallback(img);
      if (isPortrait && !img.complete) {
        img.addEventListener(
          "load",
          function () {
            scheduleCaseLayoutMetrics(p);
          },
          { once: true }
        );
      }
    });

    caseGallery.querySelectorAll("[data-case-still]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const index = Number(btn.getAttribute("data-case-still"));
        if (!Number.isFinite(index) || !resolvedGallery[index]) return;
        const num = String(index + 1).padStart(2, "0");
        openCaseStillLightbox(
          resolvedGallery[index],
          (cs.title || p.title) + " · 剧照 " + num,
          index
        );
      });
    });
  }

  function renderCaseLayout(p) {
    if (!caseLayout || !caseGallery || !caseBriefGrid) return;
    const cs = p.caseStudy || {};
    const gallery = Array.isArray(cs.gallery) ? cs.gallery.filter(Boolean) : [];
    const displayGallery = gallery.length ? gallery : p.posterUrl ? [p.posterUrl] : [];
    const cards = Array.isArray(cs.cards) ? cs.cards.slice(0, 4) : [];

    caseLayout.hidden = false;
    caseLayout.classList.toggle(
      "case-layout--portrait",
      String(cs.galleryAspect || "").trim() === "9:16"
    );
    if (caseIntroKicker) renderCaseKicker(cs.kicker);
    if (caseIntroTitle) caseIntroTitle.textContent = cs.title || p.title;
    if (caseIntroSubtitle) {
      const subtitle = cs.titleEn || p.subtitle || "";
      caseIntroSubtitle.textContent = subtitle;
      caseIntroSubtitle.hidden = !subtitle;
    }
    if (caseIntroBody) caseIntroBody.textContent = cs.intro || p.long;
    if (caseDecor) caseDecor.textContent = cs.decor || (cs.title || p.title || "C").charAt(0).toUpperCase();
    closeCaseStillLightbox();
    renderCaseVideoPlayer(p);
    renderCaseMetaStrip(cs);

    const stillsWrap = caseGallery ? caseGallery.closest(".case-stills-wrap") : null;
    if (stillsWrap) {
      stillsWrap.classList.remove("case-stills-wrap--landscape", "case-stills-wrap--portrait");
      stillsWrap.classList.add(galleryAspectWrapClass(cs.galleryAspect));
    }

    renderCaseStillsGrid(p, displayGallery, cs.galleryAspect);

    caseBriefGrid.innerHTML = cards
      .map(function (card, index) {
        return (
          '<article class="case-brief-card" style="--case-card-i:' +
          index +
          '">' +
          "<h5>" +
          escapeHtml(card.title || "") +
          "</h5>" +
          "<p>" +
          escapeHtml(card.body || "") +
          "</p>" +
          "</article>"
        );
      })
      .join("");

    scheduleCaseLayoutMetrics(p);
  }

  function resetCaseLayout() {
    clearCaseLayoutMetrics();
    closeCaseStillLightbox();
    pauseCaseVideo();
    if (caseLayout) caseLayout.hidden = true;
    if (caseMediaMain) caseMediaMain.innerHTML = "";
    if (caseGallery) caseGallery.innerHTML = "";
    if (caseBriefGrid) caseBriefGrid.innerHTML = "";
    if (caseMetaStrip) {
      caseMetaStrip.innerHTML = "";
      caseMetaStrip.hidden = true;
    }
    if (caseDecor) caseDecor.textContent = "";
    if (caseIntroSubtitle) {
      caseIntroSubtitle.textContent = "";
      caseIntroSubtitle.hidden = false;
    }
  }

  function openProjectModal(p) {
    if (!projectModal || !modalTitle) return;
    const rawEmbed = p.embedUrl && String(p.embedUrl).trim();
    const external = p.externalUrl && String(p.externalUrl).trim();
    const isXpcEmbed = rawEmbed && /xinpianchang\.com/i.test(rawEmbed);
    const embed = isXpcEmbed ? "" : rawEmbed;
    modalTitle.textContent = p.title;
    modalText.innerHTML = "<p>" + escapeHtml(p.long) + "</p>";
    modalTags.innerHTML = p.tags
      .map(function (t) {
        return '<span class="tag">' + escapeHtml(t) + "</span>";
      })
      .join("");

    if (modalWatch) {
      if (external && !p.caseStudy) {
        modalWatch.href = external;
        modalWatch.hidden = false;
      } else {
        modalWatch.removeAttribute("href");
        modalWatch.hidden = true;
      }
    }

    const useCaseLayout = !!p.caseStudy;
    if (modalPanel) {
      modalPanel.classList.toggle("modal--with-embed", !!embed && !useCaseLayout);
      modalPanel.classList.toggle("modal--case", useCaseLayout);
    }

    if (useCaseLayout) {
      renderCaseLayout(p);
      if (modalEmbedWrap) {
        modalEmbedWrap.innerHTML = "";
        modalEmbedWrap.hidden = true;
      }
      if (modalPreview) modalPreview.hidden = true;
      if (modalTags) {
        modalTags.innerHTML = "";
        modalTags.hidden = true;
      }
      if (modalText) modalText.hidden = true;
      if (modalActions) modalActions.hidden = true;
      if (modalTitle) modalTitle.textContent = (p.caseStudy && p.caseStudy.kicker) || p.title;
    } else if (embed && modalEmbedWrap) {
      resetCaseLayout();
      modalEmbedWrap.innerHTML =
        '<div class="modal-embed-frame">' +
        '<iframe title="' +
        escapeHtml(p.title) +
        '" src="' +
        escapeHtml(embed) +
        '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
        "</div>";
      modalEmbedWrap.hidden = false;
      if (modalPreview) {
        modalPreview.hidden = true;
        modalPreview.style.background = "";
      }
      if (modalTags) modalTags.hidden = false;
      if (modalText) modalText.hidden = false;
      if (modalActions) modalActions.hidden = false;
    } else {
      resetCaseLayout();
      if (modalEmbedWrap) {
        modalEmbedWrap.innerHTML = "";
        modalEmbedWrap.hidden = true;
      }
      if (modalPreview) {
        modalPreview.hidden = false;
        modalPreview.style.background = p.gradient;
      }
      if (modalTags) modalTags.hidden = false;
      if (modalText) modalText.hidden = false;
      if (modalActions) modalActions.hidden = false;
    }

    projectModal.classList.add("is-open");
    projectModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    if (modalBody) modalBody.scrollTop = 0;
    if (modalClose) modalClose.focus();
  }

  function closeProjectModal() {
    if (!projectModal) return;
    resetCaseLayout();
    if (modalEmbedWrap) {
      modalEmbedWrap.innerHTML = "";
      modalEmbedWrap.hidden = true;
    }
    if (modalPreview) modalPreview.hidden = false;
    if (modalTags) modalTags.hidden = false;
    if (modalText) modalText.hidden = false;
    if (modalActions) modalActions.hidden = false;
    if (modalPanel) {
      modalPanel.classList.remove("modal--with-embed");
      modalPanel.classList.remove("modal--case");
    }
    projectModal.classList.remove("is-open");
    projectModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  if (modalClose) {
    modalClose.addEventListener("click", closeProjectModal);
  }
  if (projectModal) {
    projectModal.addEventListener("click", function (e) {
      if (e.target === projectModal) closeProjectModal();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (caseStillLightbox && !caseStillLightbox.hidden) {
      closeCaseStillLightbox();
      return;
    }
    if (projectModal && projectModal.classList.contains("is-open")) closeProjectModal();
  });

  if (caseStillLightbox) {
    caseStillLightbox.addEventListener("click", function (e) {
      if (e.target === caseStillLightbox) closeCaseStillLightbox();
    });
  }
  if (caseStillLightboxClose) {
    caseStillLightboxClose.addEventListener("click", closeCaseStillLightbox);
  }

  function preventCaseContextMenu(e) {
    e.preventDefault();
  }

  function preventCaseImageDrag(e) {
    const target = e.target;
    if (target && (target.tagName === "IMG" || target.tagName === "VIDEO")) {
      e.preventDefault();
    }
  }

  function onCaseModalContextMenu(e) {
    if (!modalPanel || !modalPanel.classList.contains("modal--case")) return;
    preventCaseContextMenu(e);
  }

  if (modalPanel) {
    modalPanel.addEventListener("contextmenu", onCaseModalContextMenu);
    modalPanel.addEventListener("dragstart", preventCaseImageDrag);
    modalPanel.addEventListener(
      "wheel",
      function (e) {
        if (!modalPanel.classList.contains("modal--case") || !modalBody) return;

        const maxScroll = modalBody.scrollHeight - modalBody.clientHeight;
        if (maxScroll <= 1) return;

        const next = modalBody.scrollTop + e.deltaY;
        const clamped = Math.max(0, Math.min(maxScroll, next));
        if (clamped === modalBody.scrollTop) return;

        modalBody.scrollTop = clamped;
        e.preventDefault();
      },
      { passive: false, capture: true }
    );
  }
  if (caseStillLightbox) {
    caseStillLightbox.addEventListener("contextmenu", preventCaseContextMenu);
    caseStillLightbox.addEventListener("dragstart", preventCaseImageDrag);
  }

  let revealObserver;
  function observeReveals(container) {
    if (!container) return;
    if (revealObserver) revealObserver.disconnect();
    if (!window.IntersectionObserver) {
      container.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      container.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    container.querySelectorAll(".reveal").forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  document.querySelectorAll(".reveal-static").forEach(function (el) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }
    if (!window.IntersectionObserver) {
      el.classList.add("is-visible");
      return;
    }
    var o = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            o.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    o.observe(el);
  });

  function setActiveNav() {
    var links = document.querySelectorAll(".nav-main a[href^='#']");
    var sections = ["about", "work", "services", "process", "contact"].map(function (id) {
      return document.getElementById(id);
    });

    function update() {
      var y = window.scrollY + 100;
      var aboutEl = document.getElementById("about");
      if (aboutEl && y + 48 < aboutEl.offsetTop) {
        links.forEach(function (a) {
          a.removeAttribute("aria-current");
        });
        return;
      }
      var current = "about";
      sections.forEach(function (sec) {
        if (sec && sec.offsetTop <= y) current = sec.id;
      });
      links.forEach(function (a) {
        var href = a.getAttribute("href");
        if (href === "#" + current) {
          a.setAttribute("aria-current", "page");
        } else {
          a.removeAttribute("aria-current");
        }
      });
    }

    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  async function bootstrap() {
    projects = await loadProjects();
    initTheme();
    renderProjectFilters();
    renderProjects();
    setActiveNav();
  }

  try {
    bootstrap().catch(function (err) {
      console.error("Portfolio 初始化失败:", err);
      document.querySelectorAll(".reveal, .reveal-static").forEach(function (el) {
        el.classList.add("is-visible");
      });
    });
  } catch (err) {
    console.error("Portfolio 脚本异常:", err);
    document.querySelectorAll(".reveal, .reveal-static").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  window.setTimeout(function () {
    document.querySelectorAll(".reveal:not(.is-visible)").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }, 1200);
})();
