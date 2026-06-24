(function () {
  "use strict";

  const PROJECTS_JSON_URL = "data/projects.json";
  const ADMIN_CONFIG_URL = "data/admin-config.json";
  const PROJECTS_STORAGE_KEY = "portfolio-projects-draft";
  const AUTH_KEY = "portfolio-admin-auth";
  const API_SAVE_URL = "/api/projects";
  const API_UPLOAD_URL = "/api/upload";
  const API_GENERATE_BRIEF_URL = "/api/generate-brief-card";
  const API_GENERATE_INTRO_URL = "/api/generate-intro";

  const CATEGORIES = [
    { id: "ai-ad", label: "AI广告" },
    { id: "ai-short", label: "AI短片" },
    { id: "ai-ecommerce", label: "AI电商" },
    { id: "ai-live-action", label: "AI+实拍" },
    { id: "style-experiment", label: "视觉探索" },
  ];

  const CARD_TITLES = ["Project Background", "Design Goal", "Process", "Output"];

  const FORMAT_ASPECT_OPTIONS = [
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
  ];

  const loginScreen = document.getElementById("login-screen");
  const adminApp = document.getElementById("admin-app");
  const loginForm = document.getElementById("login-form");
  const loginPassword = document.getElementById("login-password");
  const loginTitle = document.getElementById("login-title");
  const appTitle = document.getElementById("app-title");
  const projectNav = document.getElementById("project-nav");
  const projectForm = document.getElementById("project-form");
  const saveStatus = document.getElementById("save-status");
  const toast = document.getElementById("toast");
  const importFile = document.getElementById("import-file");
  const imageUploadInput = document.getElementById("image-upload-input");

  let adminPassword = "800412";
  let projects = [];
  let activeIndex = 0;
  let dirty = false;
  let toastTimer = null;
  let pendingUpload = null;

  function showToast(message, type) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = "admin-toast is-visible" + (type ? " admin-toast--" + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  function setDirty(value) {
    dirty = value;
    if (!saveStatus) return;
    saveStatus.textContent = value ? "有未保存修改" : "已同步";
    saveStatus.classList.toggle("is-dirty", value);
  }

  function defaultCaseStudy(index) {
    return {
      kicker: "AIGC Creative Video",
      title: "",
      titleEn: "",
      decor: "",
      videoUrl: "",
      videoPoster: "",
      intro: "",
      meta: [
        { label: "Format", value: "" },
        { label: "Genre", value: "" },
        { label: "Year", value: "" },
        { label: "AI PLATFORM", value: "" },
      ],
      gallery: [],
      galleryAspect: "16:9",
      cards: CARD_TITLES.map(function (title) {
        return { title: title, body: "" };
      }),
    };
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

  function normalizeGalleryAspect(value) {
    return String(value || "").trim() === "9:16" ? "9:16" : "16:9";
  }

  function galleryAspectWrapClass(aspect) {
    return normalizeGalleryAspect(aspect) === "9:16"
      ? "case-stills-wrap--portrait"
      : "case-stills-wrap--landscape";
  }

  function galleryAspectSlotClass(aspect) {
    return normalizeGalleryAspect(aspect) === "9:16"
      ? "admin-still-slot--portrait"
      : "admin-still-slot--landscape";
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
    return p;
  }

  function normalizeProject(project, index) {
    const p = Object.assign({}, project);
    p.id = p.id || "p" + (index + 1);
    p.tags = Array.isArray(p.tags) ? p.tags : [];
    p.category = p.category || "ai-ad";
    if (p.caseStudy) {
      const cs = p.caseStudy;
      cs.meta = Array.isArray(cs.meta) ? cs.meta : [];
      cs.gallery = Array.isArray(cs.gallery) ? cs.gallery : [];
      cs.gallery = cs.gallery.filter(function (src) {
        return String(src || "").trim();
      });
      cs.gallery = cs.gallery.slice(0, gallerySlotCount(cs.galleryAspect));
      cs.galleryAspect = normalizeGalleryAspect(cs.galleryAspect);
      cs.cards = Array.isArray(cs.cards) ? cs.cards : [];
      while (cs.cards.length < 4) {
        cs.cards.push({ title: CARD_TITLES[cs.cards.length] || "Section", body: "" });
      }
      cs.cards = cs.cards.slice(0, 4);
      p.caseStudy = cs;
    }
    return normalizeCaseMedia(p);
  }

  async function loadAdminConfig() {
    try {
      const res = await fetch(ADMIN_CONFIG_URL + "?v=" + Date.now());
      if (!res.ok) return;
      const cfg = await res.json();
      if (cfg.password) adminPassword = String(cfg.password);
      if (cfg.siteName) {
        if (loginTitle) loginTitle.textContent = cfg.siteName;
        if (appTitle) appTitle.textContent = cfg.siteName;
        document.title = cfg.siteName;
      }
    } catch (_) {
      /* ignore */
    }
  }

  async function fetchProjectsFromServer() {
    const res = await fetch(PROJECTS_JSON_URL + "?v=" + Date.now());
    if (!res.ok) throw new Error("无法读取 data/projects.json");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("projects.json 格式错误");
    return data.map(normalizeProject);
  }

  async function loadProjects() {
    projects = await fetchProjectsFromServer();
    projects = projects.map(normalizeProject);
  }

  function nextProjectId() {
    let max = 0;
    projects.forEach(function (p) {
      const match = String(p.id || "").match(/^p(\d+)$/i);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return "p" + (max + 1);
  }

  function getProjectThumb(p) {
    if (p.posterUrl) return p.posterUrl;
    if (p.caseStudy && p.caseStudy.videoPoster) return p.caseStudy.videoPoster;
    return "";
  }

  function renderNavThumb(p) {
    const src = getProjectThumb(p);
    if (src) {
      return (
        '<span class="admin-nav-thumb"><img src="' +
        escapeAttr(src) +
        '" alt="" loading="lazy" decoding="async" /></span>'
      );
    }
    const grad =
      p.gradient || "linear-gradient(135deg, #0a0c1b 0%, #1f3f46 48%, #4fb39f 100%)";
    return (
      '<span class="admin-nav-thumb admin-nav-thumb--empty" style="--thumb-gradient:' +
      escapeAttr(grad) +
      '"></span>'
    );
  }

  function addProject() {
    readFormIntoProject();
    const id = nextProjectId();
    const index = projects.length;
    const label = id.replace(/^p/i, "");
    projects.push(
      normalizeProject(
        {
          id: id,
          title: "新案例 " + label,
          category: "ai-ad",
          tags: [],
          desc: "",
          long: "",
          gradient: "linear-gradient(135deg, #0a0c1b 0%, #1f3f46 48%, #4fb39f 100%)",
          posterUrl: "",
          previewVideoUrl: "",
          embedUrl: "",
          externalUrl: "",
          caseStudy: defaultCaseStudy(index),
        },
        index
      )
    );
    activeIndex = index;
    setDirty(true);
    renderNav();
    renderForm();
    showToast("已新增 " + id.toUpperCase() + "，记得保存并发布", "success");
  }

  function isAuthed() {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function showApp() {
    if (loginScreen) loginScreen.hidden = true;
    if (adminApp) adminApp.hidden = false;
  }

  function showLogin() {
    if (loginScreen) loginScreen.hidden = false;
    if (adminApp) adminApp.hidden = true;
  }

  function fieldHtml(id, label, value, opts) {
    opts = opts || {};
    const hint = opts.hint ? '<span class="admin-field-hint">' + opts.hint + "</span>" : "";
    if (opts.type === "textarea") {
      return (
        '<div class="admin-field">' +
        '<label for="' +
        id +
        '">' +
        label +
        "</label>" +
        '<textarea id="' +
        id +
        '" name="' +
        id +
        '" rows="' +
        (opts.rows || 4) +
        '">' +
        escapeHtml(value || "") +
        "</textarea>" +
        hint +
        "</div>"
      );
    }
    if (opts.type === "select") {
      const options = (opts.options || [])
        .map(function (opt) {
          const selected = opt.id === value ? " selected" : "";
          return '<option value="' + escapeHtml(opt.id) + '"' + selected + ">" + escapeHtml(opt.label) + "</option>";
        })
        .join("");
      return (
        '<div class="admin-field">' +
        '<label for="' +
        id +
        '">' +
        label +
        "</label>" +
        '<select id="' +
        id +
        '" name="' +
        id +
        '">' +
        options +
        "</select>" +
        hint +
        "</div>"
      );
    }
    return (
      '<div class="admin-field">' +
      '<label for="' +
      id +
      '">' +
      label +
      "</label>" +
      '<input id="' +
      id +
      '" name="' +
      id +
      '" type="' +
      (opts.type || "text") +
      '" value="' +
      escapeAttr(value || "") +
      '" />' +
      hint +
      "</div>"
    );
  }

  function imageFieldHtml(id, label, value, uploadType, opts) {
    opts = opts || {};
    const hint = opts.hint ? '<span class="admin-field-hint">' + opts.hint + "</span>" : "";
    const src = value || "";
    return (
      '<div class="admin-field admin-field--image">' +
      '<label for="' +
      id +
      '">' +
      label +
      "</label>" +
      '<div class="admin-image-input-row">' +
      '<input id="' +
      id +
      '" name="' +
      id +
      '" type="text" value="' +
      escapeAttr(src) +
      '" />' +
      '<button type="button" class="admin-btn" data-upload-image data-upload-type="' +
      escapeAttr(uploadType) +
      '" data-target="' +
      id +
      '">上传图片</button>' +
      "</div>" +
      hint +
      '<img class="admin-preview-thumb" data-preview-for="' +
      id +
      '" src="' +
      escapeAttr(src) +
      '" alt=""' +
      (src ? "" : ' hidden') +
      " />" +
      "</div>"
    );
  }

  function isFormatMetaLabel(label) {
    return /^format$/i.test(String(label || "").trim());
  }

  function normalizeFormatMetaValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (FORMAT_ASPECT_OPTIONS.some(function (opt) { return opt.value === raw; })) return raw;
    if (/9\s*:\s*16|竖版/.test(raw)) return "9:16";
    if (/3\s*:\s*4/.test(raw)) return "3:4";
    if (/4\s*:\s*3/.test(raw)) return "4:3";
    if (/16\s*:\s*9|横版/.test(raw)) return "16:9";
    return raw;
  }

  function renderMetaValueControl(item, className) {
    const value = item.value || "";
    const cls = className || "admin-meta-value-input";
    if (!isFormatMetaLabel(item.label)) {
      return (
        '<input type="text" class="' +
        cls +
        '" data-meta-value placeholder="Value" value="' +
        escapeAttr(value) +
        '" />'
      );
    }

    const current = normalizeFormatMetaValue(value);
    const known = FORMAT_ASPECT_OPTIONS.some(function (opt) {
      return opt.value === current;
    });
    let optionsHtml = FORMAT_ASPECT_OPTIONS.map(function (opt) {
      return (
        '<option value="' +
        escapeAttr(opt.value) +
        '"' +
        (current === opt.value ? " selected" : "") +
        ">" +
        escapeHtml(opt.label) +
        "</option>"
      );
    }).join("");

    if (current && !known) {
      optionsHtml =
        '<option value="' +
        escapeAttr(current) +
        '" selected>' +
        escapeHtml(current) +
        "</option>" +
        optionsHtml;
    }
    if (!current) {
      optionsHtml =
        '<option value="" selected disabled>选择比例</option>' + optionsHtml;
    }

    return (
      '<select class="' +
      cls +
      ' admin-meta-value-select" data-meta-value aria-label="画面比例">' +
      optionsHtml +
      "</select>"
    );
  }

  function renderMetaRows(meta) {
    return (meta || [])
      .map(function (item, i) {
        return (
          '<div class="admin-list-row" data-meta-row="' +
          i +
          '">' +
          '<input type="text" data-meta-label placeholder="Label" value="' +
          escapeAttr(item.label || "") +
          '" />' +
          renderMetaValueControl(item, "") +
          '<button type="button" class="admin-btn admin-btn--danger" data-remove-meta>删除</button>' +
          "</div>"
        );
      })
      .join("");
  }

  function gallerySlotCount(aspect) {
    return normalizeGalleryAspect(aspect) === "9:16" ? 8 : 9;
  }

  function padGallery(gallery, aspect) {
    const maxSlots = gallerySlotCount(aspect);
    const g = Array.isArray(gallery) ? gallery.slice(0, maxSlots) : [];
    while (g.length < maxSlots) g.push("");
    return g;
  }

  function readGalleryFromDom() {
    if (!projectForm) return { gallery: [], aspect: "16:9" };
    const aspectEl = projectForm.querySelector('input[name="gallery-aspect"]:checked');
    const aspect = normalizeGalleryAspect(aspectEl ? aspectEl.value : "16:9");
    const max = gallerySlotCount(aspect);
    const gallery = [];
    for (let i = 0; i < max; i++) {
      const slot = projectForm.querySelector('[data-gallery-slot="' + i + '"]');
      const input = slot && slot.querySelector("[data-gallery-src]");
      gallery.push(input && input.value ? String(input.value).trim() : "");
    }
    return { gallery: gallery, aspect: aspect };
  }

  function swapGallerySlots(fromIndex, toIndex) {
    if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex) || fromIndex === toIndex) return;
    const p = projects[activeIndex];
    if (!p || !p.caseStudy) return;

    const state = readGalleryFromDom();
    const gallery = state.gallery;
    const max = gallerySlotCount(state.aspect);
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= max || toIndex >= max) return;
    if (!gallery[fromIndex]) return;

    const tmp = gallery[toIndex];
    gallery[toIndex] = gallery[fromIndex];
    gallery[fromIndex] = tmp;

    p.caseStudy.gallery = gallery;
    refreshAdminGallery(state.aspect);
    setDirty(true);
    showToast("剧照顺序已调整", "success");
  }

  function bindGalleryClearEvents() {
    if (!projectForm) return;
    projectForm.querySelectorAll("[data-clear-still]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        const i = Number(btn.getAttribute("data-clear-still"));
        clearStillSlot(i);
        setDirty(true);
      });
    });
  }

  function bindGalleryDragDrop() {
    if (!projectForm || projectForm.dataset.galleryDragBound === "1") return;
    projectForm.dataset.galleryDragBound = "1";

    let dragFromIndex = null;

    projectForm.addEventListener("dragstart", function (e) {
      const handle = e.target.closest("[data-gallery-drag]");
      if (!handle || !projectForm.contains(handle)) return;
      const slot = handle.closest("[data-gallery-slot]");
      if (!slot || !slot.classList.contains("has-image")) return;

      dragFromIndex = Number(slot.getAttribute("data-gallery-slot"));
      if (!Number.isFinite(dragFromIndex)) return;

      slot.classList.add("is-dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(dragFromIndex));
      }
      e.stopPropagation();
    });

    projectForm.addEventListener("dragend", function (e) {
      const slot = e.target.closest(".admin-still-slot");
      if (slot) slot.classList.remove("is-dragging");
      projectForm.querySelectorAll(".admin-still-slot.is-drop-target").forEach(function (el) {
        el.classList.remove("is-drop-target");
      });
      dragFromIndex = null;
    });

    projectForm.addEventListener("dragover", function (e) {
      const slot = e.target.closest("[data-gallery-slot]");
      if (!slot || !projectForm.contains(slot)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

      const toIndex = Number(slot.getAttribute("data-gallery-slot"));
      if (!Number.isFinite(toIndex) || dragFromIndex === null || toIndex === dragFromIndex) return;

      projectForm.querySelectorAll(".admin-still-slot.is-drop-target").forEach(function (el) {
        el.classList.remove("is-drop-target");
      });
      slot.classList.add("is-drop-target");
    });

    projectForm.addEventListener("dragleave", function (e) {
      const slot = e.target.closest("[data-gallery-slot]");
      if (slot && !slot.contains(e.relatedTarget)) {
        slot.classList.remove("is-drop-target");
      }
    });

    projectForm.addEventListener("drop", function (e) {
      const slot = e.target.closest("[data-gallery-slot]");
      if (!slot || !projectForm.contains(slot)) return;
      e.preventDefault();
      e.stopPropagation();
      slot.classList.remove("is-drop-target");

      const toIndex = Number(slot.getAttribute("data-gallery-slot"));
      const fromIndex =
        dragFromIndex !== null
          ? dragFromIndex
          : Number(e.dataTransfer && e.dataTransfer.getData("text/plain"));
      swapGallerySlots(fromIndex, toIndex);
    });
  }

  function refreshAdminGallery(aspect) {
    if (!projectForm) return;
    const p = projects[activeIndex];
    if (!p || !p.caseStudy) return;

    aspect = normalizeGalleryAspect(aspect || p.caseStudy.galleryAspect);
    p.caseStudy.galleryAspect = aspect;
    p.caseStudy.gallery = padGallery(p.caseStudy.gallery, aspect);

    const wrap = projectForm.querySelector(".case-stills-wrap");
    const grid = projectForm.querySelector(".case-stills-grid");
    if (wrap) {
      wrap.classList.remove("case-stills-wrap--landscape", "case-stills-wrap--portrait");
      wrap.classList.add(galleryAspectWrapClass(aspect));
    }
    if (grid) {
      grid.classList.toggle("case-stills-grid--portrait-admin", aspect === "9:16");
      grid.innerHTML = renderVisualGallery(p.caseStudy.gallery, aspect);
    }
    applyGalleryAspectPreview(aspect);
    bindGalleryClearEvents();
    bindGalleryDragDrop();
  }

  function renderHomeCardBar(p) {
    return (
      '<section class="admin-home-bar">' +
      '<div class="admin-home-bar-head">' +
      "<h2>首页案例卡</h2>" +
      '<span class="admin-home-bar-id">' +
      escapeHtml(p.id.toUpperCase()) +
      "</span></div>" +
      '<div class="admin-home-bar-grid">' +
      fieldHtml("card-title", "列表标题", p.title) +
      fieldHtml("card-desc", "副标题", p.desc) +
      fieldHtml("card-category", "分类", p.category, { type: "select", options: CATEGORIES }) +
      fieldHtml("card-tags", "英文标签", (p.tags || []).join(", "), { hint: "TVC, Cinematic" }) +
      fieldHtml("card-preview-video", "悬停预览视频", p.previewVideoUrl || "") +
      "</div></section>"
    );
  }

  function renderVisualMedia(p, cs, hasCase) {
    normalizeCaseMedia(p);
    const poster = p.posterUrl || "";
    const directVideo = hasCase ? resolveDirectVideoUrl(p, cs) : "";
    const externalUrl = resolveCaseExternalUrl(p, cs);
    let mediaInner = "";

    if (directVideo) {
      mediaInner =
        '<video class="case-video admin-media-preview" src="' +
        escapeAttr(directVideo) +
        '" controls muted playsinline></video>';
    } else if (poster) {
      mediaInner =
        '<div class="case-video-fallback admin-media-fallback">' +
        '<img class="case-video-poster admin-media-preview" id="admin-main-poster" src="' +
        escapeAttr(poster) +
        '" alt="" />' +
        (externalUrl
          ? '<span class="case-video-play admin-media-play-hint" aria-hidden="true">' +
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            "</span>"
          : "") +
        "</div>";
    } else {
      mediaInner = '<div class="admin-media-empty" aria-hidden="true">点击「封面」上传</div>';
    }

    return (
      '<div class="admin-media-block">' +
      '<div class="case-media-main admin-media-main">' +
      '<div class="case-media-vignette" aria-hidden="true"></div>' +
      mediaInner +
      "</div>" +
      '<div class="admin-media-controls">' +
      '<div class="admin-media-toolbar">' +
      '<button type="button" class="admin-btn admin-btn--sm" data-upload-image data-upload-type="cover" data-target="card-poster">上传封面</button>' +
      "</div>" +
      '<input name="card-external" class="admin-media-url" placeholder="全片外链（新片场作品页，点击封面播放钮跳转）" value="' +
      escapeAttr(externalUrl) +
      '" />' +
      "</div>" +
      '<input type="hidden" id="card-poster" name="card-poster" value="' +
      escapeAttr(p.posterUrl || "") +
      '" />' +
      "</div>"
    );
  }

  function renderGalleryAspectToolbar(aspect) {
    const current = normalizeGalleryAspect(aspect);
    return (
      '<div class="admin-gallery-aspect-bar">' +
      '<span class="admin-gallery-aspect-label">剧照比例</span>' +
      '<div class="admin-gallery-aspect-options" role="radiogroup" aria-label="剧照比例">' +
      '<label class="admin-gallery-aspect-opt">' +
      '<input type="radio" name="gallery-aspect" value="16:9"' +
      (current === "16:9" ? " checked" : "") +
      ' />' +
      "<span>16:9 横版</span></label>" +
      '<label class="admin-gallery-aspect-opt">' +
      '<input type="radio" name="gallery-aspect" value="9:16"' +
      (current === "9:16" ? " checked" : "") +
      ' />' +
      "<span>9:16 竖版</span></label>" +
      "</div>" +
      '<span class="admin-gallery-drag-hint">拖动 ⠿ 可调整剧照顺序</span></div>'
    );
  }

  function applyGalleryAspectPreview(aspect) {
    if (!projectForm) return;
    const wrapClass = galleryAspectWrapClass(aspect);
    const slotClass = galleryAspectSlotClass(aspect);
    const wrap = projectForm.querySelector(".case-stills-wrap");
    if (wrap) {
      wrap.classList.remove("case-stills-wrap--landscape", "case-stills-wrap--portrait");
      wrap.classList.add(wrapClass);
    }
    projectForm.querySelectorAll(".admin-still-slot").forEach(function (slot) {
      slot.classList.remove("admin-still-slot--landscape", "admin-still-slot--portrait");
      slot.classList.add(slotClass);
    });
  }

  function renderVisualGallery(gallery, aspect) {
    const slotClass = galleryAspectSlotClass(aspect);
    return padGallery(gallery, aspect)
      .map(function (src, i) {
        const slot = String(i + 1).padStart(2, "0");
        const hasImage = !!src;
        return (
          '<button type="button" class="case-still admin-still-slot ' +
          slotClass +
          (hasImage ? " has-image" : "") +
          '" data-gallery-slot="' +
          i +
          '" data-upload-image data-upload-type="gallery" data-gallery-index="' +
          slot +
          '" data-target-gallery="' +
          i +
          '">' +
          (hasImage
            ? '<img src="' + escapeAttr(src) + '" alt="剧照 ' + slot + '" />'
            : '<span class="admin-still-empty">+</span>') +
          '<span class="admin-still-overlay">点击上传</span>' +
          '<span class="admin-still-badge">' +
          slot +
          "</span>" +
          (hasImage
            ? '<span class="admin-still-clear" data-clear-still="' + i + '" role="button" tabindex="0" aria-label="清除剧照">×</span>' +
              '<span class="admin-still-drag" draggable="true" data-gallery-drag="' +
              i +
              '" title="拖动调整顺序" aria-label="拖动调整顺序">⠿</span>'
            : "") +
          '<input type="hidden" data-gallery-src value="' +
          escapeAttr(src || "") +
          '" />' +
          "</button>"
        );
      })
      .join("");
  }

  function renderVisualMeta(meta) {
    const items = Array.isArray(meta) ? meta : [];
    const rows = items
      .map(function (item, i) {
        return (
          '<div class="case-meta-item admin-meta-item" data-meta-row="' +
          i +
          '">' +
          '<input class="admin-meta-label-input" data-meta-label placeholder="LABEL" value="' +
          escapeAttr(item.label || "") +
          '" />' +
          renderMetaValueControl(item, "admin-meta-value-input") +
          '<button type="button" class="admin-btn admin-btn--danger admin-btn--sm" data-remove-meta>×</button>' +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="case-meta-strip admin-meta-strip">' +
      rows +
      '<div class="admin-meta-actions">' +
      '<button type="button" class="admin-btn admin-btn--sm" id="btn-add-meta">+ Meta 行</button>' +
      "</div></div>"
    );
  }

  function renderVisualBriefCards(cards) {
    return (cards || [])
      .slice(0, 4)
      .map(function (card, i) {
        return (
          '<article class="case-brief-card admin-brief-card" data-card-block="' +
          i +
          '">' +
          '<input name="card-title-' +
          i +
          '" class="admin-brief-title-input" value="' +
          escapeAttr(card.title || CARD_TITLES[i] || "") +
          '" aria-label="卡片标题" />' +
          '<div class="admin-brief-ai-row">' +
          '<input name="card-hint-' +
          i +
          '" class="admin-brief-hint-input" placeholder="简单提示（可选）如：强调速度感与品牌调性" aria-label="AI 提示词" />' +
          '<button type="button" class="admin-btn admin-btn--sm admin-btn--ai" data-generate-brief="' +
          i +
          '">✨ AI 生成</button>' +
          "</div>" +
          '<textarea name="card-body-' +
          i +
          '" class="admin-brief-body-input" rows="3" aria-label="卡片正文" maxlength="60">' +
          escapeHtml(card.body || "") +
          "</textarea></article>"
        );
      })
      .join("");
  }

  function renderAdvancedSettings(p) {
    return (
      '<details class="admin-advanced">' +
      "<summary>更多设置（外链、渐变、备用文案）</summary>" +
      '<div class="admin-advanced-body admin-grid-2">' +
      fieldHtml("card-long", "弹窗备用长文", p.long, { type: "textarea", rows: 3 }) +
      fieldHtml("card-gradient", "无封面渐变", p.gradient) +
      fieldHtml("card-embed", "嵌入播放地址", p.embedUrl || "", { hint: "仅非二级页弹窗使用" }) +
      "</div></details>"
    );
  }

  function renderForm() {
    const p = projects[activeIndex];
    if (!p || !projectForm) return;
    const cs = p.caseStudy;
    const hasCase = !!cs;
    const galleryAspect = hasCase ? cs.galleryAspect : "16:9";
    const gallery = hasCase ? padGallery(cs.gallery, galleryAspect) : padGallery([], galleryAspect);
    const meta = hasCase ? cs.meta : [];
    const cards = hasCase
      ? cs.cards
      : CARD_TITLES.map(function (t) {
          return { title: t, body: "" };
        });

    projectForm.innerHTML =
      '<input type="hidden" name="project-id" value="' +
      escapeAttr(p.id) +
      '" />' +
      renderHomeCardBar(p) +
      '<div class="admin-visual-toolbar">' +
      "<h2>案例详情 · 可视化编辑</h2>" +
      '<label class="admin-toggle"><input type="checkbox" id="case-enabled" ' +
      (hasCase ? "checked" : "") +
      " />启用二级详情页</label></div>" +
      '<div class="admin-visual-shell" id="case-fields" ' +
      (hasCase ? "" : 'hidden') +
      ">" +
      (hasCase
        ? '<div class="case-layout admin-case-layout">' +
          '<div class="case-left">' +
          renderVisualMedia(p, cs, hasCase) +
          renderGalleryAspectToolbar(galleryAspect) +
          '<div class="case-stills-wrap ' +
          galleryAspectWrapClass(galleryAspect) +
          '">' +
          '<div class="case-stills-grid' +
          (galleryAspect === "9:16" ? " case-stills-grid--portrait-admin" : "") +
          '" aria-label="剧照上传区">' +
          renderVisualGallery(gallery, galleryAspect) +
          "</div></div></div>" +
          '<div class="case-right">' +
          '<div class="case-panel admin-case-panel">' +
          '<input name="case-decor" class="case-decor admin-decor-input" value="' +
          escapeAttr(cs.decor || "") +
          '" maxlength="2" aria-label="装饰字" />' +
          '<header class="case-panel-head">' +
          '<p class="case-intro-kicker">' +
          '<span class="case-intro-kicker__dot" aria-hidden="true"></span>' +
          '<input name="case-kicker" class="admin-inline-input admin-kicker-input" value="' +
          escapeAttr(cs.kicker || "") +
          '" placeholder="AIGC Creative Video" />' +
          "</p>" +
          '<h4 class="case-intro-title">' +
          '<textarea name="case-title" class="admin-inline-input admin-title-input admin-title-textarea" rows="2" aria-label="大标题" placeholder="大标题（Enter 换行）">' +
          escapeHtml(cs.title || "") +
          "</textarea></h4>" +
          '<p class="case-intro-subtitle">' +
          '<input name="case-title-en" class="admin-inline-input admin-subtitle-input" value="' +
          escapeAttr(cs.titleEn || "") +
          '" placeholder="副标题" />' +
          "</p></header>" +
          '<hr class="case-panel-rule" aria-hidden="true" />' +
          '<div class="case-panel-synopsis">' +
          '<div class="admin-intro-ai-row">' +
          '<input name="case-intro-hint" class="admin-brief-hint-input" placeholder="简单提示（可选）如：突出 IP 活动与南京在地元素" aria-label="简介 AI 提示词" />' +
          '<button type="button" class="admin-btn admin-btn--sm admin-btn--ai" id="btn-generate-intro">✨ AI 生成简介</button>' +
          "</div>" +
          '<textarea name="case-intro" class="case-intro-body admin-intro-input" placeholder="项目简介…" maxlength="100">' +
          escapeHtml(cs.intro || "") +
          "</textarea></div>" +
          renderVisualMeta(meta) +
          '<div class="case-brief-grid">' +
          renderVisualBriefCards(cards) +
          "</div></div></div></div>"
        : "") +
      "</div>" +
      (!hasCase
        ? '<div class="admin-case-disabled" id="case-disabled-hint">勾选「启用二级详情页」后，将显示与前台一致的左右布局编辑器。</div>'
        : "") +
      renderAdvancedSettings(p);

    bindFormEvents();
  }

  function bindFormEvents() {
    if (!projectForm) return;

    projectForm.querySelectorAll("input, textarea, select").forEach(function (el) {
      el.addEventListener("input", function () {
        setDirty(true);
      });
      el.addEventListener("change", function () {
        setDirty(true);
      });
    });

    const caseEnabled = document.getElementById("case-enabled");
    const caseFields = document.getElementById("case-fields");
    const caseDisabledHint = document.getElementById("case-disabled-hint");
    if (caseEnabled) {
      caseEnabled.addEventListener("change", function () {
        if (caseEnabled.checked && !projects[activeIndex].caseStudy) {
          projects[activeIndex].caseStudy = defaultCaseStudy(activeIndex);
          renderForm();
          setDirty(true);
          return;
        }
        if (caseFields) caseFields.hidden = !caseEnabled.checked;
        if (caseDisabledHint) caseDisabledHint.hidden = caseEnabled.checked;
        if (!caseEnabled.checked) setDirty(true);
      });
    }

    const addMeta = document.getElementById("btn-add-meta");
    if (addMeta) {
      addMeta.addEventListener("click", function () {
        readFormIntoProject();
        const cs = projects[activeIndex].caseStudy;
        if (!cs) return;
        cs.meta.push({ label: "", value: "" });
        renderForm();
        setDirty(true);
      });
    }

    bindGalleryClearEvents();
    bindGalleryDragDrop();

    projectForm.querySelectorAll("[data-remove-meta]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        readFormIntoProject();
        const row = btn.closest("[data-meta-row]");
        const i = Number(row && row.getAttribute("data-meta-row"));
        const cs = projects[activeIndex].caseStudy;
        if (!cs || !Number.isFinite(i)) return;
        cs.meta.splice(i, 1);
        renderForm();
        setDirty(true);
      });
    });

    projectForm.querySelectorAll('input[name="gallery-aspect"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        readFormIntoProject();
        refreshAdminGallery(radio.value);
        setDirty(true);
      });
    });

    bindUploadEvents();
    projectForm.querySelectorAll("[data-generate-brief]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        generateBriefCard(Number(btn.getAttribute("data-generate-brief")));
      });
    });
    const genIntroBtn = document.getElementById("btn-generate-intro");
    if (genIntroBtn) {
      genIntroBtn.addEventListener("click", generateIntro);
    }
    requestAnimationFrame(function () {
      initAutoGrowTextareas();
    });
  }

  function collectBriefCardsFromForm() {
    const cards = [];
    for (let i = 0; i < 4; i++) {
      const titleEl = projectForm.querySelector('[name="card-title-' + i + '"]');
      const bodyEl = projectForm.querySelector('[name="card-body-' + i + '"]');
      cards.push({
        title: titleEl && titleEl.value ? titleEl.value.trim() : CARD_TITLES[i],
        body: bodyEl && bodyEl.value ? bodyEl.value.trim() : "",
      });
    }
    return cards;
  }

  async function generateIntro() {
    readFormIntoProject();
    const p = projects[activeIndex];
    if (!p || !p.caseStudy) {
      showToast("请先启用二级详情页", "error");
      return;
    }

    const btn = document.getElementById("btn-generate-intro");
    const originalLabel = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "生成中…";
    }

    try {
      const cs = p.caseStudy;
      const hintEl = projectForm.querySelector('[name="case-intro-hint"]');
      const hint = hintEl && hintEl.value ? hintEl.value.trim() : "";
      const cards = collectBriefCardsFromForm();
      const hasCardText = cards.some(function (c) {
        return c.body;
      });
      if (!hasCardText && !hint) {
        throw new Error("请先填写四栏正文或简单提示");
      }

      const res = await fetch(API_GENERATE_INTRO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hint: hint,
          title: cs.title || p.title || "",
          titleEn: cs.titleEn || p.desc || "",
          cards: cards,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error((data && data.error) || "生成失败");
      }

      const introEl = projectForm.querySelector('[name="case-intro"]');
      if (introEl && data.intro) introEl.value = String(data.intro).slice(0, 100);
      cs.intro = data.intro || "";
      projects[activeIndex] = p;

      initAutoGrowTextareas();
      setDirty(true);
      showToast("项目简介已生成", "success");
    } catch (err) {
      showToast(err && err.message ? err.message : "生成失败", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel || "✨ AI 生成简介";
      }
    }
  }

  function collectProjectImages(p) {
    const cs = p.caseStudy || {};
    const paths = [];
    const seen = {};

    function add(path) {
      path = String(path || "").trim();
      if (!path || path.startsWith("http://") || path.startsWith("https://") || seen[path]) return;
      seen[path] = true;
      paths.push(path);
    }

    add(cs.videoPoster);
    add(p.posterUrl);
    if (Array.isArray(cs.gallery)) {
      cs.gallery.forEach(add);
    }
    return paths.slice(0, 6);
  }

  async function generateBriefCard(cardIndex) {
    readFormIntoProject();
    const p = projects[activeIndex];
    if (!p || !p.caseStudy) {
      showToast("请先启用二级详情页", "error");
      return;
    }
    if (!Number.isFinite(cardIndex) || cardIndex < 0 || cardIndex > 3) {
      showToast("栏目索引无效", "error");
      return;
    }

    const btn = projectForm.querySelector('[data-generate-brief="' + cardIndex + '"]');
    const originalLabel = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "生成中…";
    }

    try {
      const cs = p.caseStudy;
      const hintEl = projectForm.querySelector('[name="card-hint-' + cardIndex + '"]');
      const titleEl = projectForm.querySelector('[name="card-title-' + cardIndex + '"]');
      const hint = hintEl && hintEl.value ? hintEl.value.trim() : "";
      const cardTitle = titleEl && titleEl.value ? titleEl.value.trim() : CARD_TITLES[cardIndex];

      const res = await fetch(API_GENERATE_BRIEF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardIndex: cardIndex,
          cardTitle: cardTitle,
          hint: hint,
          title: cs.title || p.title || "",
          titleEn: cs.titleEn || p.desc || "",
          intro: cs.intro || p.long || p.desc || "",
          desc: p.desc || "",
          tags: p.tags || [],
          meta: cs.meta || [],
          category: p.category || "",
          images: collectProjectImages(p),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error((data && data.error) || "生成失败");
      }

      const bodyEl = projectForm.querySelector('[name="card-body-' + cardIndex + '"]');
      if (titleEl && data.card && data.card.title) titleEl.value = data.card.title;
      if (bodyEl && data.card && data.card.body) bodyEl.value = String(data.card.body).slice(0, 60);

      if (!cs.cards) cs.cards = CARD_TITLES.map(function (t) {
        return { title: t, body: "" };
      });
      cs.cards[cardIndex] = {
        title: (data.card && data.card.title) || cardTitle,
        body: (data.card && data.card.body) || "",
      };
      projects[activeIndex] = p;

      initAutoGrowTextareas();
      setDirty(true);
      showToast("「" + (cardTitle || CARD_TITLES[cardIndex]) + "」已生成", "success");
    } catch (err) {
      showToast(err && err.message ? err.message : "生成失败", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel || "✨ AI 生成";
      }
    }
  }

  function fitAutoGrowTextarea(el) {
    if (!el || el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    const min = parseFloat(getComputedStyle(el).minHeight) || 0;
    el.style.height = Math.max(el.scrollHeight, min) + "px";
  }

  function initAutoGrowTextareas(scope) {
    const root = scope || projectForm;
    if (!root) return;
    root.querySelectorAll(".admin-intro-input, .admin-brief-body-input, .admin-title-textarea").forEach(function (ta) {
      fitAutoGrowTextarea(ta);
      if (ta.dataset.autoGrowBound) return;
      ta.dataset.autoGrowBound = "1";
      ta.addEventListener("input", function () {
        fitAutoGrowTextarea(ta);
      });
    });
  }

  function updateMainPosterPreview(path) {
    if (!projectForm || !path) return;
    const main = projectForm.querySelector(".admin-media-main");
    if (!main) return;
    const video = main.querySelector("video.admin-media-preview");
    if (video) video.remove();
    const empty = main.querySelector(".admin-media-empty");
    if (empty) empty.remove();
    let img = main.querySelector("img.admin-media-preview");
    if (!img) {
      img = document.createElement("img");
      img.className = "case-video-poster admin-media-preview";
      img.id = "admin-main-poster";
      img.alt = "";
      const vignette = main.querySelector(".case-media-vignette");
      if (vignette && vignette.nextSibling) {
        main.insertBefore(img, vignette.nextSibling);
      } else {
        main.appendChild(img);
      }
    }
    img.src = path + "?v=" + Date.now();
  }

  function updateStillSlot(rowIndex, path) {
    if (!projectForm) return;
    const slot = projectForm.querySelector('[data-gallery-slot="' + rowIndex + '"]');
    if (!slot) return;
    const input = slot.querySelector("[data-gallery-src]");
    if (input) input.value = path || "";

    if (!path) {
      clearStillSlot(rowIndex);
      return;
    }

    let img = slot.querySelector("img");
    const empty = slot.querySelector(".admin-still-empty");
    if (empty) empty.remove();
    if (!img) {
      img = document.createElement("img");
      img.alt = "剧照";
      slot.insertBefore(img, slot.firstChild);
    }
    img.src = path + "?v=" + Date.now();
    slot.classList.add("has-image");

    if (!slot.querySelector("[data-clear-still]")) {
      const clearBtn = document.createElement("span");
      clearBtn.className = "admin-still-clear";
      clearBtn.setAttribute("data-clear-still", String(rowIndex));
      clearBtn.setAttribute("role", "button");
      clearBtn.setAttribute("tabindex", "0");
      clearBtn.setAttribute("aria-label", "清除剧照");
      clearBtn.textContent = "×";
      clearBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        clearStillSlot(rowIndex);
        setDirty(true);
      });
      slot.appendChild(clearBtn);
    }
  }

  function clearStillSlot(rowIndex) {
    if (!projectForm) return;
    const slot = projectForm.querySelector('[data-gallery-slot="' + rowIndex + '"]');
    if (!slot) return;
    const input = slot.querySelector("[data-gallery-src]");
    if (input) input.value = "";
    const img = slot.querySelector("img");
    if (img) img.remove();
    const clearBtn = slot.querySelector("[data-clear-still]");
    if (clearBtn) clearBtn.remove();
    slot.classList.remove("has-image");
    if (!slot.querySelector(".admin-still-empty")) {
      const empty = document.createElement("span");
      empty.className = "admin-still-empty";
      empty.textContent = "+";
      slot.insertBefore(empty, slot.firstChild);
    }
  }

  function getProjectIdFromForm() {
    if (!projectForm) return "p1";
    const el = projectForm.elements.namedItem("project-id");
    return el && "value" in el && el.value ? String(el.value) : (projects[activeIndex] && projects[activeIndex].id) || "p1";
  }

  function updateImagePreview(targetId, path) {
    if (!projectForm || !path) return;
    const preview = projectForm.querySelector('[data-preview-for="' + targetId + '"]');
    if (preview) {
      preview.src = path + "?v=" + Date.now();
      preview.hidden = false;
    }
  }

  function updateGalleryPreview(rowIndex, path) {
    updateStillSlot(rowIndex, path);
  }

  async function uploadImageFile(file, uploadType, options) {
    options = options || {};
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", options.projectId || getProjectIdFromForm());
    formData.append("type", uploadType);
    if (options.galleryIndex) formData.append("index", options.galleryIndex);

    const res = await fetch(API_UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok || !data || !data.ok) {
      const fallback =
        !data && res.status === 0
          ? "上传失败：服务器无响应，请确认已用 dev-server.py 启动并重启本地服务"
          : "上传失败，请确认已用 dev-server.py 启动本地服务";
      throw new Error((data && data.error) || fallback);
    }

    return data.path;
  }

  function bindUploadEvents() {
    if (!projectForm || projectForm.dataset.uploadBound === "1") return;
    projectForm.dataset.uploadBound = "1";

    projectForm.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-upload-image]");
      if (!btn || !projectForm.contains(btn)) return;
      if (e.target.closest("[data-clear-still]")) return;
      if (e.target.closest("[data-gallery-drag]")) return;

      pendingUpload = {
        type: btn.getAttribute("data-upload-type") || "cover",
        targetId: btn.getAttribute("data-target") || "",
        galleryRow: btn.getAttribute("data-target-gallery"),
        galleryIndex: btn.getAttribute("data-gallery-index") || "01",
      };
      if (imageUploadInput) imageUploadInput.click();
    });
  }

  function readFormIntoProject() {
    if (!projectForm || !projects[activeIndex]) return;
    const p = projects[activeIndex];
    const val = function (name) {
      const el = projectForm.elements.namedItem(name);
      return el && "value" in el ? String(el.value).trim() : "";
    };

    p.title = val("card-title");
    p.category = val("card-category");
    p.tags = val("card-tags")
      .split(/[,，]/)
      .map(function (t) {
        return t.trim();
      })
      .filter(Boolean);
    p.desc = val("card-desc");
    p.long = val("card-long");
    p.gradient = val("card-gradient");
    p.posterUrl = val("card-poster");
    p.previewVideoUrl = val("card-preview-video");
    p.embedUrl = val("card-embed");
    p.externalUrl = val("card-external");

    const caseEnabled = document.getElementById("case-enabled");
    if (!caseEnabled || !caseEnabled.checked) {
      delete p.caseStudy;
      return;
    }

    const cs = p.caseStudy || defaultCaseStudy(activeIndex);
    cs.kicker = val("case-kicker");
    cs.title = val("case-title");
    cs.titleEn = val("case-title-en");
    cs.decor = val("case-decor");
    cs.videoUrl = "";
    cs.videoPoster = p.posterUrl;
    cs.intro = val("case-intro");

    const aspectEl = projectForm.querySelector('input[name="gallery-aspect"]:checked');
    cs.galleryAspect = normalizeGalleryAspect(aspectEl ? aspectEl.value : cs.galleryAspect);

    cs.meta = [];
    projectForm.querySelectorAll("[data-meta-row]").forEach(function (row) {
      const label = row.querySelector("[data-meta-label]");
      const value = row.querySelector("[data-meta-value]");
      const l = label && label.value ? label.value.trim() : "";
      const v = value && value.value ? value.value.trim() : "";
      if (l || v) cs.meta.push({ label: l, value: v });
    });

    cs.gallery = [];
    Array.from(projectForm.querySelectorAll("[data-gallery-slot]"))
      .sort(function (a, b) {
        return Number(a.getAttribute("data-gallery-slot")) - Number(b.getAttribute("data-gallery-slot"));
      })
      .forEach(function (slot) {
        const input = slot.querySelector("[data-gallery-src]");
        const src = input && input.value ? input.value.trim() : "";
        cs.gallery.push(src);
      });

    cs.cards = [];
    for (let i = 0; i < 4; i++) {
      cs.cards.push({
        title: val("card-title-" + i) || CARD_TITLES[i],
        body: val("card-body-" + i),
      });
    }

    p.caseStudy = cs;
    projects[activeIndex] = normalizeProject(p, activeIndex);
  }

  function renderNav() {
    if (!projectNav) return;
    projectNav.innerHTML =
      '<div class="admin-sidebar-scroll">' +
      '<p class="admin-sidebar-label">' +
      projects.length +
      " 个案例 · 拖拽排序</p>" +
      '<div class="admin-nav-list">' +
      projects
        .map(function (p, i) {
          const active = i === activeIndex ? " is-active" : "";
          const subtitle = p.desc || "未填写副标题";
          return (
            '<button type="button" class="admin-nav-btn' +
            active +
            '" data-nav-index="' +
            i +
            '" draggable="true">' +
            '<span class="admin-nav-drag" aria-hidden="true" title="拖动排序">⠿</span>' +
            renderNavThumb(p) +
            '<span class="admin-nav-copy">' +
            '<span class="admin-nav-title">' +
            escapeHtml(p.title || p.id) +
            "</span>" +
            "<small>" +
            escapeHtml(subtitle) +
            "</small></span></button>"
          );
        })
        .join("") +
      "</div>" +
      '<button type="button" class="admin-nav-add" id="btn-add-project">+ 新增案例</button>' +
      "</div>";

    projectNav.querySelectorAll("[data-nav-index]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const next = Number(btn.getAttribute("data-nav-index"));
        if (!Number.isFinite(next) || next === activeIndex) return;
        readFormIntoProject();
        activeIndex = next;
        renderNav();
        renderForm();
      });
    });

    const addBtn = document.getElementById("btn-add-project");
    if (addBtn) {
      addBtn.addEventListener("click", addProject);
    }

    bindNavDragDrop();
  }

  function reorderProjects(fromIndex, toIndex) {
    if (
      !Number.isFinite(fromIndex) ||
      !Number.isFinite(toIndex) ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= projects.length ||
      toIndex >= projects.length
    ) {
      return;
    }

    readFormIntoProject();
    const moved = projects.splice(fromIndex, 1)[0];
    projects.splice(toIndex, 0, moved);

    if (activeIndex === fromIndex) {
      activeIndex = toIndex;
    } else if (fromIndex < activeIndex && toIndex >= activeIndex) {
      activeIndex -= 1;
    } else if (fromIndex > activeIndex && toIndex <= activeIndex) {
      activeIndex += 1;
    }

    setDirty(true);
    renderNav();
    renderForm();
    showToast("案例顺序已调整，保存并发布后主页同步", "success");
  }

  function bindNavDragDrop() {
    if (!projectNav) return;
    const list = projectNav.querySelector(".admin-nav-list");
    if (!list) return;

    let dragFromIndex = null;

    list.querySelectorAll(".admin-nav-btn[draggable]").forEach(function (btn) {
      btn.addEventListener("dragstart", function (e) {
        dragFromIndex = Number(btn.getAttribute("data-nav-index"));
        btn.classList.add("is-dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(dragFromIndex));
        }
      });

      btn.addEventListener("dragend", function () {
        btn.classList.remove("is-dragging");
        list.querySelectorAll(".admin-nav-btn").forEach(function (item) {
          item.classList.remove("is-drop-target");
        });
        dragFromIndex = null;
      });

      btn.addEventListener("dragover", function (e) {
        e.preventDefault();
        const toIndex = Number(btn.getAttribute("data-nav-index"));
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        if (dragFromIndex !== null && toIndex !== dragFromIndex) {
          btn.classList.add("is-drop-target");
        }
      });

      btn.addEventListener("dragleave", function () {
        btn.classList.remove("is-drop-target");
      });

      btn.addEventListener("drop", function (e) {
        e.preventDefault();
        btn.classList.remove("is-drop-target");
        const toIndex = Number(btn.getAttribute("data-nav-index"));
        const fromIndex =
          dragFromIndex !== null
            ? dragFromIndex
            : Number(e.dataTransfer && e.dataTransfer.getData("text/plain"));
        reorderProjects(fromIndex, toIndex);
      });
    });
  }

  function syncDraftToBrowser() {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (_) {
      /* ignore */
    }
  }

  async function saveProjects() {
    readFormIntoProject();

    try {
      const res = await fetch(API_SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projects),
      });
      if (!res.ok) throw new Error("保存 API 不可用，请使用 dev-server.py 启动");
      syncDraftToBrowser();
      setDirty(false);
      renderNav();
      showToast("已保存到 data/projects.json，主页已同步", "success");
      return;
    } catch (err) {
      syncDraftToBrowser();
      setDirty(false);
      renderNav();
      showToast("已写入浏览器草稿（" + err.message + "）", "success");
    }
  }

  function exportJson() {
    readFormIntoProject();
    const blob = new Blob([JSON.stringify(projects, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "projects.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("已导出 projects.json", "success");
  }

  function importJsonFile(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(String(reader.result || ""));
        if (!Array.isArray(data)) throw new Error("必须是数组");
        projects = data.map(normalizeProject);
        activeIndex = Math.min(activeIndex, Math.max(0, projects.length - 1));
        setDirty(true);
        renderNav();
        renderForm();
        showToast("已导入，记得点击保存并发布", "success");
      } catch (err) {
        showToast("导入失败：" + err.message, "error");
      }
    };
    reader.readAsText(file);
  }

  async function reloadFromServer() {
    if (dirty && !window.confirm("有未保存修改，重新加载将丢失，继续吗？")) return;
    try {
      projects = await fetchProjectsFromServer();
      activeIndex = 0;
      setDirty(false);
      renderNav();
      renderForm();
      showToast("已从 data/projects.json 重新加载", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  async function initApp() {
    await loadProjects();
    renderNav();
    renderForm();
    setDirty(false);
  }

  loginForm &&
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const pwd = loginPassword ? loginPassword.value : "";
      if (pwd !== adminPassword) {
        showToast("密码错误", "error");
        return;
      }
      try {
        sessionStorage.setItem(AUTH_KEY, "1");
      } catch (_) {
        /* ignore */
      }
      showApp();
      initApp();
    });

  document.getElementById("btn-save") &&
    document.getElementById("btn-save").addEventListener("click", saveProjects);
  document.getElementById("btn-export") &&
    document.getElementById("btn-export").addEventListener("click", exportJson);
  document.getElementById("btn-import") &&
    document.getElementById("btn-import").addEventListener("click", function () {
      if (importFile) importFile.click();
    });
  document.getElementById("btn-reload") &&
    document.getElementById("btn-reload").addEventListener("click", reloadFromServer);
  document.getElementById("btn-logout") &&
    document.getElementById("btn-logout").addEventListener("click", function () {
      try {
        sessionStorage.removeItem(AUTH_KEY);
      } catch (_) {
        /* ignore */
      }
      showLogin();
    });

  importFile &&
    importFile.addEventListener("change", function () {
      const file = importFile.files && importFile.files[0];
      if (file) importJsonFile(file);
      importFile.value = "";
    });

  imageUploadInput &&
    imageUploadInput.addEventListener("change", function () {
      const file = imageUploadInput.files && imageUploadInput.files[0];
      const job = pendingUpload;
      imageUploadInput.value = "";
      pendingUpload = null;
      if (!file || !job) return;

      const uploadBtns = projectForm ? projectForm.querySelectorAll("[data-upload-image]") : [];
      uploadBtns.forEach(function (b) {
        if (job.targetId && b.getAttribute("data-target") === job.targetId) b.disabled = true;
        if (job.galleryRow !== null && job.galleryRow !== undefined && b.getAttribute("data-target-gallery") === job.galleryRow) {
          b.disabled = true;
        }
      });

      uploadImageFile(file, job.type, {
        projectId: getProjectIdFromForm(),
        galleryIndex: job.galleryIndex,
      })
        .then(function (path) {
          if (job.type === "gallery" && job.galleryRow !== null && job.galleryRow !== undefined) {
            updateStillSlot(Number(job.galleryRow), path);
          } else if (job.targetId === "card-poster" || job.type === "cover") {
            const input = document.getElementById("card-poster");
            if (input) input.value = path;
            updateMainPosterPreview(path);
          }
          readFormIntoProject();
          setDirty(true);
          showToast("图片已上传：" + path + "（记得点「保存并发布」）", "success");
        })
        .catch(function (err) {
          showToast(err.message || "上传失败", "error");
        })
        .finally(function () {
          uploadBtns.forEach(function (b) {
            b.disabled = false;
          });
        });
    });

  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  loadAdminConfig().then(function () {
    if (isAuthed()) {
      showApp();
      initApp();
    } else {
      showLogin();
    }
  });
})();
