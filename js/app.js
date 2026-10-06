(function (App) {
  'use strict';

  const store = App.store;
  const MOBILE_BREAKPOINT = 900;
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const els = {};
  let currentView = null;
  let viewRoot = null;
  let renderPending = false;

  /* ---------- Tema ---------- */

  function applyTheme() {
    const { theme } = store.getSettings();
    const resolved = theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : theme;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    const themeColor = document.getElementById('theme-color-meta');
    if (themeColor) themeColor.setAttribute('content', resolved === 'dark' ? '#0e1117' : '#f4f5f8');
  }

  /* ---------- Menu lateral ---------- */

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  function toggleSidebar() {
    if (isMobile()) {
      els.app.classList.toggle('is-sidebar-open');
      return;
    }
    store.updateSettings({ sidebarCollapsed: !store.getSettings().sidebarCollapsed });
  }

  function openMobileSidebar() {
    els.app.classList.add('is-sidebar-open');
  }

  function closeMobileSidebar() {
    els.app.classList.remove('is-sidebar-open');
  }

  /* ---------- Renderização ---------- */

  function renderView() {
    const board = store.getActiveBoard();
    const { view } = store.getSettings();

    if (!board) {
      currentView = null;
      viewRoot = null;
      els.view.innerHTML = App.ui.emptyState({
        iconName: 'kanban',
        title: 'Nenhum quadro por aqui',
        text: 'Crie um quadro para organizar as tarefas do seu time.',
        actionLabel: 'Criar quadro',
        action: 'new-board',
      });
      return;
    }

    if (currentView !== view || !viewRoot) {
      els.view.innerHTML = '';
      viewRoot = document.createElement('div');
      viewRoot.className = 'view-root';
      els.view.appendChild(viewRoot);
      App.views[view].mount(viewRoot);
      currentView = view;
    }

    // Evita recriar o quadro no meio de um arrastar/renomear; ele se atualiza ao terminar.
    if (view === 'board' && App.views.board.isInteracting()) return;
    App.views[view].render();
  }

  function renderNow() {
    renderPending = false;
    const board = store.getActiveBoard();
    const { sidebarCollapsed } = store.getSettings();

    applyTheme();
    els.app.classList.toggle('is-sidebar-collapsed', sidebarCollapsed);
    document.title = board ? `${board.name} · ${App.config.APP_NAME}` : App.config.APP_NAME;

    App.views.sidebar.render(els.sidebar);
    App.views.topbar.render(els.topbar);
    renderView();
  }

  /** Agenda uma renderização (várias mudanças no mesmo ciclo viram uma só). */
  function render() {
    if (renderPending) return;
    renderPending = true;
    queueMicrotask(renderNow);
  }

  function focusSearch() {
    if (!store.getActiveBoard()) return;
    App.views.topbar.focusSearch(els.topbar);
  }

  /* ---------- Reações a mudanças do estado ---------- */

  function onStoreChange(event) {
    if (event.type === 'storage:error') {
      App.toast.error('Não foi possível salvar. O armazenamento do navegador pode estar cheio — exporte um backup.');
      return;
    }

    if (event.type === 'external') {
      App.popover.close();
      App.toast.info('Os dados foram atualizados em outra aba.');
    }

    if (event.type === 'settings:update' && event.patch.activeBoardId) {
      App.modal.closeAll();
    }

    // A janela de tarefa é atualizada na hora (mantém o foco em formulários).
    App.taskModal.refresh();
    render();
  }

  function notifyOverdue() {
    const board = store.getActiveBoard();
    if (!board) return;
    const overdue = App.domain.getActiveTasks(board).filter((task) => App.domain.getDueStatus(task, board) === 'overdue');
    if (!overdue.length) return;

    App.toast.warning(
      overdue.length === 1 ? 'Há 1 tarefa atrasada neste quadro.' : `Há ${overdue.length} tarefas atrasadas neste quadro.`,
      { action: { label: 'Ver', onClick: () => App.filters.set({ due: 'overdue' }) }, duration: 8000 }
    );
  }

  /* ---------- Inicialização ---------- */

  function bindGlobalEvents() {
    els.view.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="new-board"]')) App.actions.openCreateBoard();
    });

    els.backdrop.addEventListener('click', closeMobileSidebar);

    darkQuery.addEventListener('change', () => {
      if (store.getSettings().theme === 'system') render();
    });

    window.addEventListener('resize', () => {
      if (!isMobile()) closeMobileSidebar();
    });

    // Sincroniza os dados quando outra aba do navegador altera o localStorage.
    window.addEventListener('storage', (event) => {
      if (event.key === App.storage.key) store.reloadFromStorage();
    });

    // Garante que alterações pendentes sejam gravadas antes de sair.
    window.addEventListener('beforeunload', store.flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') store.flush();
    });
  }

  function init() {
    els.app = document.getElementById('app');
    els.sidebar = document.getElementById('sidebar');
    els.topbar = document.getElementById('topbar');
    els.view = document.getElementById('view');
    els.backdrop = document.getElementById('sidebar-backdrop');

    const { firstRun } = store.init();

    App.views.sidebar.mount(els.sidebar);
    App.views.topbar.mount(els.topbar);
    App.shortcuts.init();
    bindGlobalEvents();
    store.subscribe(onStoreChange);

    renderNow();
    document.documentElement.classList.remove('is-loading');

    if (firstRun) {
      App.toast.info('Bem-vindo! Criamos um quadro de exemplo para você explorar. Pressione ? para ver os atalhos.', { duration: 9000 });
    } else {
      notifyOverdue();
    }
  }

  Object.assign(App, {
    render,
    focusSearch,
    toggleSidebar,
    openMobileSidebar,
    closeMobileSidebar,
  });

  document.addEventListener('DOMContentLoaded', init);
})(window.App);
