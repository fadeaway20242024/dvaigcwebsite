(function () {
  "use strict";

  var DEFAULT_DELAY = 200;
  var DEFAULT_STEP_DURATION = 0.35;
  var SELECTOR = ".blur-text";

  function splitSegments(text, animateBy) {
    if (animateBy === "letters") {
      return Array.from(text);
    }
    return text.split(/(\s+)/).filter(function (part) {
      return part.length > 0;
    });
  }

  function isWhitespace(segment, animateBy) {
    return animateBy === "words" && /^\s+$/.test(segment);
  }

  function getKeyframes(direction) {
    var fromY = direction === "bottom" ? 50 : -50;
    var midY = direction === "bottom" ? -5 : 5;
    return {
      from: {
        filter: "blur(10px)",
        opacity: 0,
        transform: "translateY(" + fromY + "px)",
      },
      steps: [
        {
          filter: "blur(5px)",
          opacity: 0.5,
          transform: "translateY(" + midY + "px)",
        },
        {
          filter: "blur(0px)",
          opacity: 1,
          transform: "translateY(0px)",
        },
      ],
    };
  }

  function createSegment(segment, animateBy) {
    if (isWhitespace(segment, animateBy)) {
      return document.createTextNode(segment);
    }
    var span = document.createElement("span");
    span.className = "blur-text-segment";
    span.textContent = segment;
    return span;
  }

  function hasMoreWordSegments(segments, startIndex, animateBy) {
    for (var i = startIndex + 1; i < segments.length; i += 1) {
      if (!isWhitespace(segments[i], animateBy)) return true;
    }
    return false;
  }

  function appendWordSegment(parent, segment, animateBy, segments, index, indexRef) {
    if (isWhitespace(segment, animateBy)) return;
    var segNode = createSegment(segment, animateBy);
    if (segNode.nodeType === Node.ELEMENT_NODE) {
      segNode.dataset.blurIndex = String(indexRef.value);
      indexRef.value += 1;
    }
    parent.appendChild(segNode);
    if (animateBy === "words" && hasMoreWordSegments(segments, index, animateBy)) {
      parent.appendChild(document.createTextNode("\u00A0"));
    }
  }

  function replaceTextNode(node, animateBy, indexRef) {
    var text = node.textContent;
    if (!text) return;
    var segments = splitSegments(text, animateBy);
    var frag = document.createDocumentFragment();
    segments.forEach(function (segment, index) {
      if (isWhitespace(segment, animateBy)) return;
      var segNode = createSegment(segment, animateBy);
      if (segNode.nodeType === Node.ELEMENT_NODE) {
        segNode.dataset.blurIndex = String(indexRef.value);
        indexRef.value += 1;
      }
      frag.appendChild(segNode);
      if (animateBy === "words" && hasMoreWordSegments(segments, index, animateBy)) {
        frag.appendChild(document.createTextNode("\u00A0"));
      }
    });
    node.parentNode.replaceChild(frag, node);
  }

  function walkRichNode(node, animateBy, indexRef) {
    Array.from(node.childNodes).forEach(function (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        replaceTextNode(child, animateBy, indexRef);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walkRichNode(child, animateBy, indexRef);
      }
    });
  }

  function prepareElement(el) {
    if (el.dataset.blurReady === "true") return null;

    var animateBy = el.dataset.blurBy || "words";
    var direction = el.dataset.blurDirection || "top";
    var delay = Number(el.dataset.blurDelay || DEFAULT_DELAY);
    var stepDuration = Number(el.dataset.blurStepDuration || DEFAULT_STEP_DURATION);
    var baseDelay = Number(el.dataset.blurBaseDelay || 0);
    var isRich = el.classList.contains("blur-text--rich");
    var indexRef = { value: 0 };

    el.dataset.blurReady = "true";
    el.classList.add("blur-text-host");

    if (isRich) {
      walkRichNode(el, animateBy, indexRef);
    } else {
      var text = el.textContent;
      var segments = splitSegments(text, animateBy);
      el.textContent = "";
      segments.forEach(function (segment, index) {
        appendWordSegment(el, segment, animateBy, segments, index, indexRef);
      });
    }

    var keyframes = getKeyframes(direction);
    el.querySelectorAll(".blur-text-segment").forEach(function (span) {
      Object.assign(span.style, keyframes.from);
    });

    return {
      el: el,
      direction: direction,
      delay: delay,
      stepDuration: stepDuration,
      baseDelay: baseDelay,
      played: false,
    };
  }

  function animateSegment(span, keyframes, index, delay, stepDuration, onComplete) {
    var frames = [keyframes.from].concat(keyframes.steps);
    var duration = stepDuration * (frames.length - 1) * 1000;
    var animation = span.animate(frames, {
      duration: duration,
      delay: index * delay,
      fill: "forwards",
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    if (onComplete) {
      animation.onfinish = onComplete;
    }
  }

  function playPrepared(prepared) {
    if (!prepared || prepared.played) return;
    prepared.played = true;

    var keyframes = getKeyframes(prepared.direction);
    var animatable = prepared.el.querySelectorAll(".blur-text-segment");
    var total = animatable.length;
    var completed = 0;

    animatable.forEach(function (span) {
      var segmentIndex = Number(span.dataset.blurIndex || 0);
      animateSegment(span, keyframes, segmentIndex, prepared.delay, prepared.stepDuration, function () {
        completed += 1;
      });
    });

    if (total === 0 && typeof prepared.onComplete === "function") {
      prepared.onComplete();
    }
  }

  function showImmediately(prepared) {
    if (!prepared) return;
    prepared.el.querySelectorAll(".blur-text-segment").forEach(function (span) {
      span.style.filter = "blur(0px)";
      span.style.opacity = "1";
      span.style.transform = "translateY(0)";
    });
  }

  function init() {
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var items = Array.prototype.map.call(document.querySelectorAll(SELECTOR), prepareElement).filter(Boolean);

    if (!items.length) return;

    if (reducedMotion || !window.IntersectionObserver) {
      items.forEach(showImmediately);
      return;
    }

    var groups = new Map();

    items.forEach(function (prepared) {
      var groupKey =
        prepared.el.closest(
          "header, .section-heading, .process-header, .services-header, .contact-intro, .contact-panel"
        ) || prepared.el;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(prepared);
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var group = groups.get(entry.target);
          if (!group) return;
          group
            .sort(function (a, b) {
              return a.baseDelay - b.baseDelay;
            })
            .forEach(function (prepared) {
              window.setTimeout(function () {
                playPrepared(prepared);
              }, prepared.baseDelay);
            });
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    groups.forEach(function (_, groupEl) {
      observer.observe(groupEl);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
