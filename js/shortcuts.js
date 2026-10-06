(function (App) {
  'use strict';

  const { isTypingTarget } = App.utils;

  function onKeyDown(event) {
    if (event.defaultPrevented || App.modal.isOpen() || App.popover.isOpen()) return;

    // Ctrl/Cmd + K também abre a busca (padrão comum em ferramentas web).
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      App.focusSearch();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;

    const hasBoard = Boolean(App.store.getActiveBoard());
    const key = event.key;

    switch (key.toLowerCase()) {
      case 'n':
        if (!hasBoard) return;
        event.preventDefault();
        App.taskModal.openCreate();
        break;
      case '/':
        event.preventDefault();
        App.focusSearch();
        break;
      case 'f': {
        const button = document.querySelector('[data-action="filters"]');
        if (!button) return;
        event.preventDefault();
        App.filters.openPopover(button);
        break;
      }
      case '1':
      case '2':
      case '3':
        if (!hasBoard) return;
        App.store.updateSettings({ view: ['board', 'list', 'dashboard'][Number(key) - 1] });
        break;
      case 't':
        App.actions.toggleTheme();
        break;
      case '[':
        App.toggleSidebar();
        break;
      case '?':
        App.settingsModal.open('shortcuts');
        break;
      case 'escape':
        if (App.domain.hasActiveFilters(App.filters.get())) App.filters.reset();
        break;
      default:
        break;
    }
  }

  function init() {
    document.addEventListener('keydown', onKeyDown);
  }

  App.shortcuts = { init };
})(window.App);
