const initI18nAndTheme = () => {
  const state = {
    lang: localStorage.getItem("lang") || "es",
    tone: localStorage.getItem("tone") || "normal",
    theme: localStorage.getItem("theme") || "dark",
    cache: {},
    isTransitioning: false,
  };

  const getLocaleKey = (lang, tone) => `${lang}:${tone}`;
  const getLocaleFile = (lang, tone) => {
    const suffix = tone === "sarcastic" ? "_sarcastic" : "";
    return `i18n/${lang}${suffix}.json?v=${Date.now()}`;
  };

  const loadMessages = async (lang, tone) => {
    const cacheKey = getLocaleKey(lang, tone);
    if (state.cache[cacheKey]) return state.cache[cacheKey];

    try {
      const response = await fetch(getLocaleFile(lang, tone));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const messages = await response.json();
      state.cache[cacheKey] = messages;
      return messages;
    } catch (error) {
      console.error(`Could not load ${lang}/${tone} from server:`, error);
      return null;
    }
  };

  const applyTranslations = (messages, lang) => {
    if (!messages) return;
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (messages[key]) el.textContent = messages[key];
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.dataset.i18nHtml;
      if (messages[key]) el.innerHTML = messages[key];
    });

    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      const mappings = el.dataset.i18nAttr.split(",");
      mappings.forEach((m) => {
        const [attr, key] = m.split(":").map((v) => v.trim());
        if (messages[key]) el.setAttribute(attr, messages[key]);
      });
    });
  };

  const updateLangUI = (lang) => {
    document.documentElement.lang = lang;
    const toggle = document.querySelector("[data-lang-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(lang === "en"));
    }
  };

  const updateToneUI = (tone) => {
    document.documentElement.dataset.tone = tone;
    const toggle = document.querySelector("[data-tone-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(tone === "sarcastic"));
    }
  };

  const setLocale = async (lang, tone, isInitial = false) => {
    if (state.isTransitioning && !isInitial) return;

    if (!isInitial) {
      state.isTransitioning = true;
      document.body.classList.add("is-switching-lang");
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const messages = await loadMessages(lang, tone);
    if (messages) {
      applyTranslations(messages, lang);
      updateLangUI(lang);
      updateToneUI(tone);
      state.lang = lang;
      state.tone = tone;
      localStorage.setItem("lang", lang);
      localStorage.setItem("tone", tone);
    }

    if (!isInitial) {
      setTimeout(() => {
        document.body.classList.remove("is-switching-lang");
        state.isTransitioning = false;
      }, 50);
    }
  };

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    state.theme = theme;
    localStorage.setItem("theme", theme);
    const toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
    }
  };

  const setupEventListeners = () => {
    const handleGlobalClick = (e) => {
      const langBtn = e.target.closest("[data-lang-toggle]");
      if (langBtn) {
        e.preventDefault();
        e.stopPropagation();
        const nextLang = state.lang === "es" ? "en" : "es";
        setLocale(nextLang, state.tone);
        return;
      }

      const toneBtn = e.target.closest("[data-tone-toggle]");
      if (toneBtn) {
        e.preventDefault();
        e.stopPropagation();
        const nextTone = state.tone === "sarcastic" ? "normal" : "sarcastic";
        setLocale(state.lang, nextTone);
        return;
      }

      const themeBtn = e.target.closest("[data-theme-toggle]");
      if (themeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const next = state.theme === "dark" ? "light" : "dark";
        setTheme(next);
        return;
      }

      // Manejo del botón Volver Arriba
      const backToTopBtn = e.target.closest('a[href="#top"]');
      if (backToTopBtn) {
        e.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
        // Actualizamos la URL sin recargar para mantener coherencia
        history.pushState(null, null, "#top");
      }
    };

    const handleGlobalKeydown = (e) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;
      if (String(e.key).toLowerCase() !== "j") return;
      const targetUrl = "diapositivas.html";
      try {
        sessionStorage.setItem("playManualAudio", "1");
        sessionStorage.setItem("playManualTransition", "1");
      } catch (err) {
        // ignore storage errors
      }
      if (!window.location.pathname.endsWith(targetUrl)) {
        window.location.href = targetUrl;
      }
    };

    const tryPlayOpenAudio = () => {
      const audio = document.getElementById("open-audio");
      if (!audio || audio.dataset.played === "true") return;
      audio.dataset.played = "true";
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          const onFirstInteraction = () => {
            audio.play().catch(() => {});
            window.removeEventListener("pointerdown", onFirstInteraction, true);
          };
          window.addEventListener("pointerdown", onFirstInteraction, true);
        });
      }
    };

    document.addEventListener("click", handleGlobalClick, true);
    document.addEventListener("keydown", handleGlobalKeydown, true);
    if (document.body.classList.contains("page--manual")) {
      let shouldAutoplay = false;
      try {
        shouldAutoplay = sessionStorage.getItem("playManualAudio") === "1";
        sessionStorage.removeItem("playManualAudio");
      } catch (err) {
        shouldAutoplay = false;
      }
      if (shouldAutoplay) {
        tryPlayOpenAudio();
      }
    }
  };

  const initBowserTransition = () => {
    if (!document.body.classList.contains("page--manual")) return;
    const canvasEl = document.getElementById("irisCanvas");
    if (!canvasEl) return;

    const IRIS_DURATION_MS = 2000;
    const MASK_RES = 1024;
    const FILL_INTERNAL_HOLES = false;
    const START_SCALE_FACTOR = 1.25;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;

    const loadSvgAsImage = async (svgUrl) => {
      const res = await fetch(svgUrl, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error(`No se pudo cargar ${svgUrl} (HTTP ${res.status})`);
      }

      const svgText = await res.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const objectUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Error cargando SVG como imagen"));
        img.src = objectUrl;
      });

      URL.revokeObjectURL(objectUrl);
      return img;
    };

    const buildSolidMaskFromImage = (img, sizePx, fillHoles) => {
      const off = document.createElement("canvas");
      off.width = sizePx;
      off.height = sizePx;
      const ctx = off.getContext("2d", { willReadFrequently: true });

      ctx.clearRect(0, 0, sizePx, sizePx);
      ctx.imageSmoothingEnabled = true;

      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;

      const scale = Math.min(sizePx / iw, sizePx / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (sizePx - dw) / 2;
      const dy = (sizePx - dh) / 2;

      ctx.drawImage(img, dx, dy, dw, dh);

      if (!fillHoles) {
        return off;
      }

      const imgData = ctx.getImageData(0, 0, sizePx, sizePx);
      const { data, width, height } = imgData;
      const ALPHA_THRESHOLD = 8;
      const visited = new Uint8Array(width * height);
      const queue = new Int32Array(width * height);
      let qh = 0;
      let qt = 0;

      const alphaAt = (idx) => data[idx * 4 + 3];

      const tryEnqueue = (pxIdx) => {
        if (visited[pxIdx] === 1) return;
        if (alphaAt(pxIdx) > ALPHA_THRESHOLD) return;
        visited[pxIdx] = 1;
        queue[qt++] = pxIdx;
      };

      for (let x = 0; x < width; x++) {
        tryEnqueue(x);
        tryEnqueue((height - 1) * width + x);
      }
      for (let y = 0; y < height; y++) {
        tryEnqueue(y * width);
        tryEnqueue(y * width + (width - 1));
      }

      while (qh < qt) {
        const i = queue[qh++];
        const x = i % width;
        const y = (i / width) | 0;

        if (x > 0) tryEnqueue(i - 1);
        if (x < width - 1) tryEnqueue(i + 1);
        if (y > 0) tryEnqueue(i - width);
        if (y < height - 1) tryEnqueue(i + width);
      }

      for (let i = 0; i < width * height; i++) {
        const a = alphaAt(i);
        if (a <= ALPHA_THRESHOLD && visited[i] === 0) {
          data[i * 4 + 0] = 0;
          data[i * 4 + 1] = 0;
          data[i * 4 + 2] = 0;
          data[i * 4 + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      return off;
    };

    const createIrisController = (canvas, maskCanvas) => {
      const ctx = canvas.getContext("2d");
      let rafId = null;
      let running = false;
      let cx = 0;
      let cy = 0;

      const resizeCanvasToViewport = () => {
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(window.innerWidth * dpr));
        const height = Math.max(1, Math.round(window.innerHeight * dpr));
        canvas.width = width;
        canvas.height = height;
        cx = width / 2;
        cy = height / 2;
        ctx.clearRect(0, 0, width, height);
      };

      const drawFrame = (scale01) => {
        const w = canvas.width;
        const h = canvas.height;

        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = "destination-out";

        const base = Math.max(w, h) * START_SCALE_FACTOR;
        const size = base * scale01;

        if (size <= 0) {
          return;
        }

        const x = cx - size / 2;
        const y = cy - size / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(maskCanvas, x, y, size, size);
      };

      const playOpen = () => {
        if (running) return;
        running = true;

        const prefersReduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (prefersReduced) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          running = false;
          return;
        }

        const start = performance.now();

        const tick = (now) => {
          const t = Math.min(1, (now - start) / IRIS_DURATION_MS);
          const eased = easeOutCubic(t);
          const scale01 = lerp(1, 0, eased);
          drawFrame(scale01);

          if (t < 1) {
            rafId = requestAnimationFrame(tick);
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            running = false;
            rafId = null;
          }
        };

        rafId = requestAnimationFrame(tick);
      };

      const reset = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        running = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };

      return {
        resizeCanvasToViewport,
        playOpen,
        reset,
      };
    };

    let shouldPlayTransition = false;
    try {
      shouldPlayTransition =
        sessionStorage.getItem("playManualTransition") === "1";
      sessionStorage.removeItem("playManualTransition");
    } catch (err) {
      shouldPlayTransition = false;
    }

    if (!shouldPlayTransition) {
      return;
    }

    (async () => {
      try {
        const bowserImg = await loadSvgAsImage("assets/bowser.svg");
        const maskCanvas = buildSolidMaskFromImage(
          bowserImg,
          MASK_RES,
          FILL_INTERNAL_HOLES,
        );

        const iris = createIrisController(canvasEl, maskCanvas);
        iris.resizeCanvasToViewport();
        window.addEventListener("resize", iris.resizeCanvasToViewport);
        iris.playOpen();
      } catch (err) {
        console.error("No se pudo iniciar la transición de Bowser.", err);
      }
    })();
  };

  setTheme(state.theme);
  setLocale(state.lang, state.tone, true);
  setupEventListeners();
  initBowserTransition();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initI18nAndTheme);
} else {
  initI18nAndTheme();
}
