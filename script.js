const initI18nAndTheme = () => {
  const state = {
    lang: localStorage.getItem('lang') || 'es',
    theme: localStorage.getItem('theme') || 'dark',
    cache: {},
    isTransitioning: false
  };

  const loadMessages = async (lang) => {
    if (state.cache[lang]) return state.cache[lang];

    try {
      const response = await fetch(`i18n/${lang}.json?v=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const messages = await response.json();
      state.cache[lang] = messages;
      return messages;
    } catch (error) {
      console.error(`Could not load ${lang} from server:`, error);
      return null;
    }
  };

  const applyTranslations = (messages, lang) => {
    if (!messages) return;
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (messages[key]) el.textContent = messages[key];
    });

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.dataset.i18nHtml;
      if (messages[key]) el.innerHTML = messages[key];
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const mappings = el.dataset.i18nAttr.split(',');
      mappings.forEach(m => {
        const [attr, key] = m.split(':').map(v => v.trim());
        if (messages[key]) el.setAttribute(attr, messages[key]);
      });
    });
  };

  const updateLangUI = (lang) => {
    document.documentElement.lang = lang;
    const toggle = document.querySelector('[data-lang-toggle]');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(lang === 'en'));
    }
  };

  const setLanguage = async (lang, isInitial = false) => {
    if (state.isTransitioning && !isInitial) return;

    if (!isInitial) {
      state.isTransitioning = true;
      document.body.classList.add('is-switching-lang');
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const messages = await loadMessages(lang);
    if (messages) {
      applyTranslations(messages, lang);
      updateLangUI(lang);
      state.lang = lang;
      localStorage.setItem('lang', lang);
    }

    if (!isInitial) {
      setTimeout(() => {
        document.body.classList.remove('is-switching-lang');
        state.isTransitioning = false;
      }, 50);
    }
  };

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    state.theme = theme;
    localStorage.setItem('theme', theme);
    const toggle = document.querySelector('[data-theme-toggle]');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    }
  };

  const setupEventListeners = () => {
    const handleGlobalClick = (e) => {
      const langBtn = e.target.closest('[data-lang-toggle]');
      if (langBtn) {
        e.preventDefault();
        e.stopPropagation();
        const nextLang = state.lang === 'es' ? 'en' : 'es';
        setLanguage(nextLang);
        return;
      }

      const themeBtn = e.target.closest('[data-theme-toggle]');
      if (themeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const next = state.theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        return;
      }

      // Manejo del botón Volver Arriba
      const backToTopBtn = e.target.closest('a[href="#top"]');
      if (backToTopBtn) {
        e.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        // Actualizamos la URL sin recargar para mantener coherencia
        history.pushState(null, null, '#top');
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
  };

  setTheme(state.theme);
  setLanguage(state.lang, true);
  setupEventListeners();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initI18nAndTheme);
} else {
  initI18nAndTheme();
}
