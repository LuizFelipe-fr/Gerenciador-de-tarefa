/**
 * Menu lateral: marca, lista de quadros, usuário atual e atalhos globais.
 */
(function (App) {
  'use strict';

  const { escapeHtml: esc } = App.utils;
  const icon = App.icon;

  function openTaskCount(board) {
    return App.domain.getActiveTasks(board).filter((task) => !App.domain.isTaskDone(task, board)).length;
  }

  function render(root) {
    const state = App.store.getState();
    const { activeBoardId, theme } = state.settings;
    const user = App.store.getCurrentUser();
    const isDark = document.documentElement.dataset.theme === 'dark';

    root.innerHTML = `
      <div class="sidebar__brand">
        <span class="brand-logo">${icon('kanban')}</span>
        <span class="brand-name">${esc(App.config.APP_NAME)}</span>
        <button type="button" class="icon-btn sidebar__collapse" data-action="toggle-sidebar" aria-label="Recolher menu" title="Recolher menu ( [ )">
          ${icon('sidebar')}
        </button>
      </div>

      <nav class="sidebar__section" aria-label="Quadros">
        <div class="sidebar__section-header">
          <span>Quadros</span>
          <button type="button" class="icon-btn icon-btn--sm" data-action="new-board" aria-label="Novo quadro" title="Novo quadro">${icon('plus')}</button>
        </div>
        <ul class="board-nav">
          ${state.boards.map((board) => `
            <li>
              <button type="button" class="board-nav__item ${board.id === activeBoardId ? 'is-active' : ''}" data-board-id="${board.id}"
                ${board.id === activeBoardId ? 'aria-current="page"' : ''} title="${esc(board.name)}">
                <span class="board-nav__dot" style="--dot: ${board.color}"></span>
                <span class="board-nav__name">${esc(board.name)}</span>
                <span class="board-nav__count" title="Tarefas em aberto">${openTaskCount(board)}</span>
              </button>
            </li>`).join('')}
        </ul>
        ${state.boards.length === 0 ? '<p class="sidebar__empty">Nenhum quadro ainda.</p>' : ''}
        <button type="button" class="sidebar__new" data-action="new-board">${icon('plus')}<span>Novo quadro</span></button>
      </nav>

      <div class="sidebar__footer">
        <button type="button" class="sidebar__link" data-action="shortcuts">${icon('keyboard')}<span>Atalhos de teclado</span></button>
        <button type="button" class="sidebar__link" data-action="toggle-theme" title="Tema: ${theme === 'system' ? 'automático' : theme === 'dark' ? 'escuro' : 'claro'}">
          ${icon(isDark ? 'sun' : 'moon')}<span>${isDark ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
        <button type="button" class="sidebar__link" data-action="settings">${icon('settings')}<span>Configurações</span></button>
        ${user ? `
          <button type="button" class="sidebar__user" data-action="settings-team" title="Trocar usuário">
            ${App.ui.avatar(user)}
            <span class="sidebar__user-info">
              <strong>${esc(user.name)}</strong>
              <span>${esc(user.role || 'Membro da equipe')}</span>
            </span>
          </button>` : ''}
      </div>
    `;
  }

  function mount(root) {
    root.addEventListener('click', (event) => {
      const boardButton = event.target.closest('[data-board-id]');
      if (boardButton) {
        App.actions.switchBoard(boardButton.dataset.boardId);
        App.closeMobileSidebar();
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;

      switch (actionButton.dataset.action) {
        case 'new-board':
          App.actions.openCreateBoard();
          break;
        case 'toggle-sidebar':
          App.toggleSidebar();
          break;
        case 'toggle-theme':
          App.actions.toggleTheme();
          break;
        case 'settings':
          App.settingsModal.open();
          break;
        case 'settings-team':
          App.settingsModal.open('team');
          break;
        case 'shortcuts':
          App.settingsModal.open('shortcuts');
          break;
        default:
          break;
      }
    });
  }

  App.views = App.views || {};
  App.views.sidebar = { mount, render };
})(window.App);
