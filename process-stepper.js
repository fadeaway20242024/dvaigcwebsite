(function () {
  "use strict";

  var STEPS = [
    {
      title: "创意沟通",
      body: "了解品牌诉求、投放场景与目标受众，梳理创意方向与核心信息。对齐参考片、预算档期与交付标准，明确项目边界。",
      points: ["需求访谈与 Brief 整理", "参考片与竞品视觉分析", "交付节点与版本规划"],
    },
    {
      title: "风格定调",
      body: "确定整体视觉基调：色彩体系、光影质感、镜头语言与美术风格。输出 mood board 或风格样片，确保后续生成方向一致。",
      points: ["色彩与光影语言定义", "镜头与构图风格样片", "品牌调性视觉对齐"],
    },
    {
      title: "分镜头脚本拆解",
      body: "将创意拆解为可执行的分镜与镜头表，明确每镜时长、景别、运镜方式与叙事节奏，为生成与剪辑提供蓝图。",
      points: ["分镜脚本与镜头表", "叙事节奏与转场设计", "旁白/字幕结构预排"],
    },
    {
      title: "资产生成",
      body: "生成或整合角色、场景、产品等关键视觉资产，建立项目视觉库。统一材质、比例与风格，支撑批量镜头生产。",
      points: ["角色 / 场景 / 产品资产", "关键帧与视觉参考库", "多版本资产筛选定稿"],
    },
    {
      title: "视频生成",
      body: "按分镜执行 AIGC 视频生成与选片，完成核心镜头素材的批量产出。结合运镜控制与首尾帧策略，保证镜头连贯性。",
      points: ["按镜生成与多 take 选片", "运镜与动作节奏控制", "镜头衔接与一致性校验"],
    },
    {
      title: "音乐 / 音效生成",
      body: "匹配 BGM、音效与环境声，必要时定制或生成音乐片段。强化情绪层次与品牌氛围，为剪辑节奏提供听觉骨架。",
      points: ["BGM 风格选型或生成", "环境声与细节音效", "人声 / 旁白节奏预对位"],
    },
    {
      title: "剪辑包装",
      body: "精剪、调色、字幕与包装元素合成，形成结构完整、节奏流畅的导演剪辑版。统一全片影调，强化品牌记忆点。",
      points: ["精剪与节奏打磨", "调色与画面统一", "字幕 / 包装 / 特效合成"],
    },
    {
      title: "成片交付",
      body: "输出成片及多平台裁切版本，附带工程说明与素材归档。支持后续二创、复投与品牌延展使用。",
      points: ["主片与多平台裁切版", "工程说明与素材归档", "修改反馈与最终确认"],
    },
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCheckIcon() {
    return (
      '<svg class="process-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />' +
      "</svg>"
    );
  }

  function renderIndicators(current) {
    var html = "";
    STEPS.forEach(function (_, index) {
      var step = index + 1;
      var status = step === current ? "active" : step < current ? "complete" : "inactive";
      html +=
        '<button type="button" class="process-step-indicator process-step-indicator--' +
        status +
        '" data-step="' +
        step +
        '" aria-label="第 ' +
        step +
        " 步：" +
        escapeHtml(STEPS[index].title) +
        '" aria-current="' +
        (status === "active" ? "step" : "false") +
        '">' +
        '<span class="process-step-indicator-inner">';
      if (status === "complete") {
        html += renderCheckIcon();
      } else if (status === "active") {
        html += '<span class="process-step-active-dot" aria-hidden="true"></span>';
      } else {
        html += '<span class="process-step-number">' + step + "</span>";
      }
      html += "</span></button>";
      if (step < STEPS.length) {
        html +=
          '<span class="process-step-connector' +
          (step < current ? " is-complete" : "") +
          '" aria-hidden="true"><span class="process-step-connector-fill"></span></span>';
      }
    });
    return html;
  }

  function renderStepContent(step) {
    var data = STEPS[step - 1];
    if (!data) return "";
    var points = data.points
      .map(function (item) {
        return "<li>" + escapeHtml(item) + "</li>";
      })
      .join("");
    return (
      '<article class="process-step-panel" data-step-panel="' +
      step +
      '">' +
      '<p class="process-step-kicker">STEP ' +
      String(step).padStart(2, "0") +
      "</p>" +
      "<h3 class=\"process-step-title\">" +
      escapeHtml(data.title) +
      "</h3>" +
      '<p class="process-step-body">' +
      escapeHtml(data.body) +
      "</p>" +
      '<ul class="process-step-points">' +
      points +
      "</ul></article>"
    );
  }

  function renderCompleted() {
    return (
      '<article class="process-step-panel process-step-panel--done">' +
      '<p class="process-step-kicker">COMPLETED</p>' +
      "<h3 class=\"process-step-title\">全流程已走完</h3>" +
      '<p class="process-step-body">从创意沟通到成片交付，八个环节环环相扣。若你有项目计划，欢迎随时联系，一起开启下一支片。</p>' +
      '<a class="process-step-cta" href="#contact">预约沟通 →</a>' +
      "</article>"
    );
  }

  function mount(root) {
    var current = 1;
    var direction = 1;
    var total = STEPS.length;

    root.innerHTML =
      '<div class="process-stepper-card">' +
      '<div class="process-stepper-indicators" id="process-indicators" role="tablist" aria-label="服务流程步骤"></div>' +
      '<div class="process-stepper-content" id="process-content" aria-live="polite"></div>' +
      '<div class="process-stepper-footer" id="process-footer">' +
      '<button type="button" class="process-stepper-back" id="process-back">上一步</button>' +
      '<button type="button" class="process-stepper-next" id="process-next">下一步</button>' +
      "</div></div>";

    var indicatorsEl = root.querySelector("#process-indicators");
    var contentEl = root.querySelector("#process-content");
    var footerEl = root.querySelector("#process-footer");
    var backBtn = root.querySelector("#process-back");
    var nextBtn = root.querySelector("#process-next");

    function isDone() {
      return current > total;
    }

    function render() {
      if (isDone()) {
        indicatorsEl.innerHTML = renderIndicators(total + 1);
        contentEl.innerHTML = renderCompleted();
        footerEl.classList.add("is-complete");
        footerEl.setAttribute("aria-hidden", "true");
        return;
      }

      footerEl.classList.remove("is-complete");
      footerEl.removeAttribute("aria-hidden");
      indicatorsEl.innerHTML = renderIndicators(current);
      contentEl.innerHTML = renderStepContent(current);
      footerEl.hidden = false;

      backBtn.disabled = current === 1;
      backBtn.classList.toggle("is-inactive", current === 1);
      nextBtn.textContent = current === total ? "完成流程" : "下一步";

      contentEl.dataset.direction = String(direction);

      indicatorsEl.querySelectorAll("[data-step]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var target = Number(btn.getAttribute("data-step"));
          if (!target || target === current) return;
          direction = target > current ? 1 : -1;
          current = target;
          render();
        });
      });
    }

    backBtn.addEventListener("click", function () {
      if (current <= 1) return;
      direction = -1;
      current -= 1;
      render();
    });

    nextBtn.addEventListener("click", function () {
      if (isDone()) return;
      direction = 1;
      if (current >= total) {
        current = total + 1;
      } else {
        current += 1;
      }
      render();
    });

    render();
  }

  function init() {
    var root = document.getElementById("process-stepper-root");
    if (root) mount(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
