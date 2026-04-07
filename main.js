(function () {
  "use strict";

  /**
   * 视频案例：将 embedUrl 换成你的 YouTube/Vimeo/Bilibili 嵌入地址。
   * Bilibili 示例：https://player.bilibili.com/player.html?bvid=BVxxxx&high_quality=1&danmaku=0
   */
  const videos = [
    {
      id: "v1",
      title: "Showreel 2025 · 生成式影像混剪",
      category: "showreel",
      tags: ["Showreel", "Mixed"],
      duration: "01:52",
      desc: "概念片、商业镜头与实验片段的蒙太奇，展示节奏与光影一致性。",
      thumbGradient: "linear-gradient(145deg, #06201a 0%, #0f3d32 42%, #3d2f0a 100%)",
      embedUrl: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
    },
    {
      id: "v2",
      title: "品牌片 · 城市脉冲",
      category: "commercial",
      tags: ["Commercial", "AIGC+实拍"],
      duration: "00:48",
      desc: "夜景与生成建筑延伸的合成，强调霓虹与车轨的层次。",
      thumbGradient: "linear-gradient(155deg, #1a0f08 0%, #4a2c14 40%, #1a3d2e 100%)",
      embedUrl: "https://player.vimeo.com/video/148751763",
    },
    {
      id: "v3",
      title: "实验 · 单镜头长呼吸",
      category: "experimental",
      tags: ["Experimental", "Loop"],
      duration: "00:36",
      desc: "单一镜头内的光影漂移，测试角色与场景的时序稳定性。",
      thumbGradient: "linear-gradient(135deg, #0d1814 0%, #234038 50%, #5c4a1a 100%)",
      embedUrl: "",
    },
    {
      id: "v4",
      title: "MV 片段 · 故障诗",
      category: "experimental",
      tags: ["MV", "Glitch"],
      duration: "01:05",
      desc: "歌词可视化与频闪节奏，克制使用颗粒与色差。",
      thumbGradient: "linear-gradient(120deg, #101812 0%, #1e2a24 45%, #4a3d12 100%)",
      embedUrl: "",
    },
    {
      id: "v5",
      title: "产品发布 · 预告 15s",
      category: "commercial",
      tags: ["Launch", "Teaser"],
      duration: "00:15",
      desc: "硬件轮廓光 + 生成环境雾，突出材质与体积光。",
      thumbGradient: "linear-gradient(160deg, #080c0a 0%, #163028 55%, #6b5420 100%)",
      embedUrl: "",
    },
    {
      id: "v6",
      title: "幕后流程速览",
      category: "showreel",
      tags: ["BTS", "Pipeline"],
      duration: "02:10",
      desc: "从 moodboard、分镜到合成与母带交付的快速演示（可换为你的长视频）。",
      thumbGradient: "linear-gradient(145deg, #0a1210 0%, #1a3028 40%, #3d3518 100%)",
      embedUrl: "",
    },
  ];

  const projects = [
    {
      id: "p1",
      title: "科技品牌 · 生成式发布会开场",
      category: "commercial",
      tags: ["TVC", "Runway"],
      desc: "90 秒开场：生成场景与实拍主讲穿插，统一调色与镜头语言。",
      long: "分镜阶段锁定构图与光比；生成批次用参考图约束风格；实拍绿幕与 CG 环境对接，最后在 DaVinci 做 HDR 母带与多比例裁切。",
      featured: true,
      gradient: "linear-gradient(135deg, #071410 0%, #1a3d30 50%, #4a3d10 100%)",
    },
    {
      id: "p2",
      title: "音乐人 MV · 梦境走廊",
      category: "mv",
      tags: ["MV", "Stylized"],
      desc: "走廊无限循环的视觉母题，强调色调渐变与节拍剪辑点。",
      long: "音乐结构映射镜头重复与变形；AIGC 负责纹理与天空盒迭代，手工修补人物边缘与手持抖动。",
      wide: true,
      gradient: "linear-gradient(125deg, #120a06 0%, #3d2814 45%, #1a3020 100%)",
    },
    {
      id: "p3",
      title: "纪录片片头 · 数据之海",
      category: "commercial",
      tags: ["Title", "Motion"],
      desc: "抽象粒子与真实档案画面叠化，建立严肃基调。",
      long: "粒子系统与生成海洋素材分层合成；字幕安全区与播出版本字幕流单独导出。",
      tall: true,
      gradient: "linear-gradient(160deg, #050807 0%, #142820 40%, #2d4a38 100%)",
    },
    {
      id: "p4",
      title: "时尚概念 · 织物与风",
      category: "experimental",
      tags: ["Concept", "Lookdev"],
      desc: "无对白短片：材质特写与慢门，探索布面与风的互动。",
      long: "多模型出图后统一色彩分级；风与布的动态用实拍素材混合生成补帧，避免塑料感。",
      gradient: "linear-gradient(135deg, #0c100e 0%, #1e3228 48%, #5c4a22 100%)",
    },
    {
      id: "p5",
      title: "游戏宣发 · 15s 竖版广告",
      category: "commercial",
      tags: ["Social", "9:16"],
      desc: "竖屏节奏广告：前三秒钩子 + UI 与角色混剪。",
      long: "平台 A/B 测试两版片头；生成背景与 UI 录屏对齐安全区；输出含无字幕净版。",
      gradient: "linear-gradient(135deg, #080a09 0%, #16302a 50%, #4a3810 100%)",
    },
    {
      id: "p6",
      title: "展览空间 · 循环投影",
      category: "experimental",
      tags: ["Installation", "Loop"],
      desc: "展馆墙面 8 分钟无缝循环，避免跳点与频闪敏感。",
      long: "循环点做交叉淡化；亮度按现场照度校准；提供工程版 ProRes 与 HAP 备选方案。",
      gradient: "linear-gradient(135deg, #0a0c0b 0%, #1a2820 45%, #3d3018 100%)",
    },
  ];

  const grid = document.getElementById("project-grid");
  const filters = document.getElementById("filters");
  const videoGrid = document.getElementById("video-grid");
  const videoFilters = document.getElementById("video-filters");
  const themeToggle = document.getElementById("theme-toggle");

  const projectModal = document.getElementById("project-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalText = document.getElementById("modal-text");
  const modalPreview = document.getElementById("modal-preview");
  const modalTags = document.getElementById("modal-tags");
  const modalClose = document.getElementById("modal-close");

  const videoModal = document.getElementById("video-modal");
  const videoModalTitle = document.getElementById("video-modal-title");
  const videoFrameWrap = document.getElementById("video-frame-wrap");
  const videoModalTags = document.getElementById("video-modal-tags");
  const videoModalDesc = document.getElementById("video-modal-desc");
  const videoModalClose = document.getElementById("video-modal-close");

  const projectCategories = [
    { id: "all", label: "全部" },
    { id: "commercial", label: "商业 / 品牌" },
    { id: "mv", label: "MV" },
    { id: "experimental", label: "实验 / 艺术" },
  ];

  const videoCategories = [
    { id: "all", label: "全部" },
    { id: "showreel", label: "Showreel" },
    { id: "commercial", label: "商业" },
    { id: "experimental", label: "实验" },
  ];

  let activeFilter = "all";
  let activeVideoFilter = "all";

  function getStoredTheme() {
    try {
      return localStorage.getItem("portfolio-theme");
    } catch {
      return null;
    }
  }

  /** 默认深色未来感；浅色为 data-theme="light" */
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
    if (stored === "light") {
      applyTheme("light");
      return;
    }
    if (stored === "dark") {
      applyTheme("dark");
      return;
    }
    applyTheme("dark");
  }

  themeToggle.addEventListener("click", function () {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    applyTheme(isLight ? "dark" : "light");
  });

  function bindFilterButtons(container, onChange) {
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

  function renderVideoFilters() {
    videoFilters.innerHTML = videoCategories
      .map(function (c) {
        const pressed = c.id === activeVideoFilter;
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
    bindFilterButtons(videoFilters, function (id) {
      activeVideoFilter = id;
      renderVideos();
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function projectCard(p) {
    const classes = ["project-card", "reveal"];
    if (p.featured) classes.push("featured");
    if (p.wide) classes.push("wide");
    if (p.tall) classes.push("tall");

    const tagsHtml = p.tags
      .map(function (t) {
        return '<span class="tag">' + escapeHtml(t) + "</span>";
      })
      .join("");

    return (
      '<button type="button" class="' +
      classes.join(" ") +
      '" data-id="' +
      p.id +
      '" aria-haspopup="dialog">' +
      '<span class="project-visual">' +
      '<span class="project-gradient" style="--card-gradient:' +
      p.gradient +
      '"></span>' +
      '<span class="project-pattern" aria-hidden="true"></span>' +
      '<span class="corner-frame" aria-hidden="true"></span>' +
      '<span class="project-overlay">' +
      '<span class="overlay-hint">案例详情</span>' +
      '<span class="overlay-arrow" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>' +
      "</span></span></span>" +
      '<span class="project-body">' +
      '<span class="project-meta">' +
      tagsHtml +
      "</span>" +
      '<span class="project-title">' +
      escapeHtml(p.title) +
      "</span>" +
      '<p class="project-desc">' +
      escapeHtml(p.desc) +
      "</p></span></button>"
    );
  }

  function videoCard(v) {
    const tagsHtml = v.tags
      .map(function (t) {
        return '<span class="tag">' + escapeHtml(t) + "</span>";
      })
      .join("");

    return (
      '<button type="button" class="video-card reveal" data-vid="' +
      v.id +
      '" aria-haspopup="dialog">' +
      '<span class="video-thumb">' +
      '<span class="video-thumb-gradient" style="--thumb-gradient:' +
      v.thumbGradient +
      '"></span>' +
      '<span class="video-thumb-noise" aria-hidden="true"></span>' +
      '<span class="video-play">' +
      '<span class="video-play-icon">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
      "</span></span>" +
      '<span class="video-duration">' +
      escapeHtml(v.duration) +
      "</span></span>" +
      '<span class="video-body">' +
      '<span class="video-meta">' +
      tagsHtml +
      "</span>" +
      '<span class="video-title">' +
      escapeHtml(v.title) +
      "</span>" +
      '<p class="video-desc">' +
      escapeHtml(v.desc) +
      "</p></span></button>"
    );
  }

  function renderProjects() {
    const list =
      activeFilter === "all"
        ? projects
        : projects.filter(function (p) {
            return p.category === activeFilter;
          });
    grid.innerHTML = list.map(projectCard).join("");
    grid.querySelectorAll(".project-card").forEach(function (card) {
      card.addEventListener("click", function () {
        const id = card.getAttribute("data-id");
        const p = projects.find(function (x) {
          return x.id === id;
        });
        if (p) openProjectModal(p);
      });
    });
    observeReveals(grid);
  }

  function renderVideos() {
    const list =
      activeVideoFilter === "all"
        ? videos
        : videos.filter(function (v) {
            return v.category === activeVideoFilter;
          });
    videoGrid.innerHTML = list.map(videoCard).join("");
    videoGrid.querySelectorAll(".video-card").forEach(function (card) {
      card.addEventListener("click", function () {
        const id = card.getAttribute("data-vid");
        const v = videos.find(function (x) {
          return x.id === id;
        });
        if (v) openVideoModal(v);
      });
    });
    observeReveals(videoGrid);
  }

  function openProjectModal(p) {
    modalTitle.textContent = p.title;
    modalText.innerHTML = "<p>" + escapeHtml(p.long) + "</p>";
    modalPreview.style.background = p.gradient;
    modalTags.innerHTML = p.tags
      .map(function (t) {
        return '<span class="tag">' + escapeHtml(t) + "</span>";
      })
      .join("");
    projectModal.classList.add("is-open");
    projectModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    modalClose.focus();
  }

  function closeProjectModal() {
    projectModal.classList.remove("is-open");
    projectModal.setAttribute("aria-hidden", "true");
    if (!videoModal.classList.contains("is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  function openVideoModal(v) {
    videoModalTitle.textContent = v.title;
    videoModalDesc.textContent = v.desc;
    videoModalTags.innerHTML = v.tags
      .map(function (t) {
        return '<span class="tag">' + escapeHtml(t) + "</span>";
      })
      .join("");

    if (v.embedUrl && v.embedUrl.trim()) {
      videoFrameWrap.innerHTML =
        '<div class="video-frame">' +
        '<iframe title="' +
        escapeHtml(v.title) +
        '" src="' +
        escapeHtml(v.embedUrl) +
        '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
        "</div>";
    } else {
      videoFrameWrap.innerHTML =
        '<div class="video-placeholder" role="status">暂未配置嵌入链接。请在 <strong>main.js</strong> 中找到该条目，填写 <code>embedUrl</code>（YouTube / Vimeo / Bilibili 播放器地址）。</div>';
    }

    videoModal.classList.add("is-open");
    videoModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    videoModalClose.focus();
  }

  function closeVideoModal() {
    videoFrameWrap.innerHTML = "";
    videoModal.classList.remove("is-open");
    videoModal.setAttribute("aria-hidden", "true");
    if (!projectModal.classList.contains("is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  modalClose.addEventListener("click", closeProjectModal);
  projectModal.addEventListener("click", function (e) {
    if (e.target === projectModal) closeProjectModal();
  });

  videoModalClose.addEventListener("click", closeVideoModal);
  videoModal.addEventListener("click", function (e) {
    if (e.target === videoModal) closeVideoModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (videoModal.classList.contains("is-open")) closeVideoModal();
    else if (projectModal.classList.contains("is-open")) closeProjectModal();
  });

  let revealObserver;
  function observeReveals(container) {
    if (revealObserver) revealObserver.disconnect();
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
    var sections = ["showreel", "work", "about", "contact"].map(function (id) {
      return document.getElementById(id);
    });

    function update() {
      var y = window.scrollY + 100;
      var showreelEl = document.getElementById("showreel");
      if (showreelEl && y + 48 < showreelEl.offsetTop) {
        links.forEach(function (a) {
          a.removeAttribute("aria-current");
        });
        return;
      }
      var current = "showreel";
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

  initTheme();
  renderProjectFilters();
  renderVideoFilters();
  renderProjects();
  renderVideos();
  setActiveNav();
})();
