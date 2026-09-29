/**
 * Barra superior: título do quadro, ações, troca de visualização, busca e filtros.
 */
(function (App) {
  'use strict';

  const { escapeHtml: esc, debounce } = App.utils;
  const icon = App.icon;

  const VIEWS = [
    { id: 'board', label: 'Quadro', icon: 'kanban', key: '1' },
    { id: 'list', label: 'Lista', icon: 'list', key: '2' },
    { id: 'dashboard', label: 'Painel', icon: 'chart', key: '3' },
  ];

  const applySearch = debounce((value) => App.filters.set({ search: value }), 120);

  function resultSummary(board) {
    const filters = App.filters.get();
    if (!App.domain.hasActiveFilters(filters)) return '';
    const tasks = App.domain.getActiveTasks(board);
    const visible = tasks.filter((task) => App.filters.matches(task, board)).length;
    return `
      <span class="filter-summary">
        ${visible} de ${tasks.length} tarefas
        <button type="button" class="link-btn" data-action="clear-filters">Limpar filtros</button>
      </span>`;
  }

  function render(root) {
    const board = App.store.getActiveBoard();
    const { view } = App.store.getSettings();

    // Preserva o foco/cursor da busca, já que o HTML é recriado.
    const activeSearch = root.contains(document.activeElement) && document.activeElement.matches('[data-search]')
      ? { start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd }
      : null;

    if (!board) {
      root.innerHTML = `
        <div class="topbar__row">
          <button type="button" class="icon-btn topbar__menu" data-action="open-sidebar" aria-label="Abrir menu">${icon('menu')}</button>
          <h1 class="topbar__title">${esc(App.config.APP_NAME)}</h1>
        </div>`;
      return;
    }

    const filters = App.filters.get();
    const filterCount = App.domain.countActiveFilters(filters);
    const members = [...new Set(App.domain.getActiveTasks(board).flatMap((task) => task.assigneeIds))]
      .map((id) => App.store.getMember(id))
      .filter(Boolean);

    root.innerHTML = `
      <div class="topbar__row">
        <button type="button" class="icon-btn topbar__menu" data-action="open-sidebar" aria-label="Abrir menu">${icon('menu')}</button>
        <div class="topbar__heading">
          <span class="topbar__dot" style="--dot: ${board.color}"></span>
          <div class="topbar__titles">
            <h1 class="topbar__title">
              <button type="button" class="topbar__title-btn" data-action="board-settings" title="Configurações do quadro">${esc(board.name)}</button>
            </h1>
            ${board.description ? `<p class="topbar__description">${esc(board.description)}</p>` : ''}
          </div>
        </div>

        <div class="topbar__actions">
          ${members.length ? `<span class="topbar__members" title="Pessoas com tarefas neste quadro">${App.ui.avatarStack(members, 4)}</span>` : ''}
          <button type="button" class="btn btn--primary" data-action="new-task" title="Nova tarefa (N)">
            ${icon('plus')}<span class="hide-sm">Nova tarefa</span>
          </button>
          <button type="button" class="icon-btn" data-action="board-menu" aria-label="Mais opções do quadro" aria-haspopup="menu">${icon('more')}</button>
        </div>
      </div>

      <div class="topbar__row topbar__row--tools">
        <div class="segmented" role="tablist" aria-label="Visualização">
          ${VIEWS.map((item) => `
            <button type="button" role="tab" class="segmented__item ${view === item.id ? 'is-active' : ''}" data-view="${item.id}"
              aria-selected="${view === item.id}" title="${item.label} (${item.key})">
              ${icon(item.icon)}<span>${item.label}</span>
            </button>`).join('')}
        </div>

        <div class="topbar__filters">
          ${resultSummary(board)}
          <label class="search">
            ${icon('search')}
            <input type="search" class="search__input" data-search placeholder="Buscar tarefas…" value="${esc(filters.search)}" aria-label="Buscar tarefas">
            <kbd class="search__kbd">/</kbd>
          </label>
          <button type="button" class="btn btn--ghost ${filterCount ? 'is-active' : ''}" data-action="filters" aria-haspopup="dialog" title="Filtros (F)">
            ${icon('filter')}<span class="hide-sm">Filtros</span>${filterCount ? `<span class="count-pill">${filterCount}</span>` : ''}
          </button>
        </div>
      </div>
    `;

    if (activeSearch) {
      const input = root.querySelector('[data-search]');
      input.focus();
      input.setSelectionRange(activeSearch.start, activeSearch.end);
    }
  }

  function openBoardMenu(anchor) {
    const board = App.store.getActiveBoard();
    const archivedCount = App.domain.getArchivedTasks(board).length;

    App.popover.menu(anchor, [
      { label: 'Configurações do quadro', icon: 'settings', onClick: () => App.boardSettings.open(board.id) },
      { label: 'Etiquetas', icon: 'tag', onClick: () => App.boardSettings.open(board.id, 'labels') },
      { label: `Tarefas arquivadas (${archivedCount})`, icon: 'archive', onClick: () => App.boardSettings.open(board.id, 'archived') },
      { label: 'Nova coluna', icon: 'plus', onClick: () => App.actions.addColumn() },
      'divider',
      { label: 'Exportar planilha (CSV)', icon: 'download', onClick: () => App.actions.exportCSV(board.id) },
      { label: 'Duplicar quadro', icon: 'copy', onClick: () => App.actions.duplicateBoard(board.id) },
      'divider',
      { label: 'Excluir quadro', icon: 'trash', danger: true, onClick: () => App.actions.deleteBoard(board.id) },
    ], { align: 'end' });
  }

  function mount(root) {
    root.addEventListener('input', (event) => {
      if (event.target.matches('[data-search]')) applySearch(event.target.value);
    });

    root.addEventListener('keydown', (event) => {
      if (event.target.matches('[data-search]') && event.key === 'Escape') {
        event.stopPropagation();
        event.target.value = '';
        applySearch('');
        applySearch.flush();
        event.target.blur();
      }
    });

    root.addEventListener('click', (event) => {
      const viewButton = event.target.closest('[data-view]');
      if (viewButton) {
        App.store.updateSettings({ view: viewButton.dataset.view });
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;

      switch (actionButton.dataset.action) {
        case 'open-sidebar':
          App.openMobileSidebar();
          break;
        case 'new-task':
          App.taskModal.openCreate();
          break;
        case 'board-menu':
          openBoardMenu(actionButton);
          break;
        case 'board-settings':
          App.boardSettings.open(App.store.getSettings().activeBoardId);
          break;
        case 'filters':
          App.filters.openPopover(actionButton);
          break;
        case 'clear-filters':
          App.filters.reset();
          break;
        default:
          break;
      }
    });
  }

  function focusSearch(root) {
    const input = root.querySelector('[data-search]');
    if (input) {
      input.focus();
      input.select();
    }
  }

  App.views = App.views || {};
  App.views.topbar = { mount, render, focusSearch };
})(window.App);
