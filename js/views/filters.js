/**
 * Estado de busca/filtros da sessão (não é salvo — reinicia ao trocar de quadro)
 * e o popover de filtros exibido na barra superior.
 */
(function (App) {
  'use strict';

  const { PRIORITIES, DUE_FILTERS } = App.config;
  const { escapeHtml: esc } = App.utils;
  const domain = App.domain;

  let filters = domain.createEmptyFilters();

  function get() {
    return filters;
  }

  function set(patch) {
    filters = { ...filters, ...patch };
    App.render();
  }

  function reset({ keepSearch = false } = {}) {
    const search = keepSearch ? filters.search : '';
    filters = { ...domain.createEmptyFilters(), search };
    App.render();
  }

  function toggleInList(key, value) {
    const list = filters[key];
    set({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] });
  }

  /** Tarefa passa nos filtros atuais? */
  function matches(task, board) {
    return domain.matchesFilters(task, board, filters, App.store.getSettings().currentUserId);
  }

  function renderPopoverContent(board) {
    const members = App.store.getState().members;

    const checkbox = (key, value, label, extra = '') => `
      <label class="check-row">
        <input type="checkbox" data-filter="${key}" value="${value}" ${filters[key].includes(value) ? 'checked' : ''}>
        ${extra}<span>${esc(label)}</span>
      </label>`;

    return `
      <div class="filters">
        <div class="filters__header">
          <strong>Filtros</strong>
          <button type="button" class="btn btn--ghost btn--sm" data-filter-reset>Limpar</button>
        </div>

        <label class="check-row check-row--highlight">
          <input type="checkbox" data-filter-mine ${filters.onlyMine ? 'checked' : ''}>
          ${App.icon('user')}<span>Somente minhas tarefas</span>
        </label>

        <div class="filters__group">
          <span class="filters__title">Prazo</span>
          <select class="input input--sm" data-filter-due>
            ${DUE_FILTERS.map((option) => `<option value="${option.id}" ${filters.due === option.id ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>

        <div class="filters__group">
          <span class="filters__title">Prioridade</span>
          ${PRIORITIES.map((priority) => checkbox('priorities', priority.id, priority.label, `<span class="priority-dot priority--${priority.id}"></span>`)).join('')}
        </div>

        <div class="filters__group">
          <span class="filters__title">Etiquetas</span>
          ${board.labels.length
            ? board.labels.map((label) => checkbox('labelIds', label.id, label.name, `<span class="color-dot" style="--dot: ${label.color}"></span>`)).join('')
            : '<p class="muted small">Nenhuma etiqueta neste quadro.</p>'}
        </div>

        <div class="filters__group">
          <span class="filters__title">Responsáveis</span>
          ${members.length
            ? members.map((member) => checkbox('assigneeIds', member.id, member.name, App.ui.avatar(member, 'xs'))).join('')
            : '<p class="muted small">Nenhum membro cadastrado.</p>'}
        </div>
      </div>
    `;
  }

  function openPopover(anchor) {
    const board = App.store.getActiveBoard();
    if (!board) return;

    const popover = App.popover.open(anchor, {
      content: renderPopoverContent(board),
      className: 'popover--filters',
      align: 'end',
    });
    if (!popover) return;

    const refresh = () => {
      popover.el.innerHTML = renderPopoverContent(board);
    };

    popover.el.addEventListener('change', (event) => {
      const target = event.target;
      if (target.matches('[data-filter]')) toggleInList(target.dataset.filter, target.value);
      else if (target.matches('[data-filter-mine]')) set({ onlyMine: target.checked });
      else if (target.matches('[data-filter-due]')) set({ due: target.value });
    });
    popover.el.addEventListener('click', (event) => {
      if (event.target.closest('[data-filter-reset]')) {
        reset({ keepSearch: true });
        refresh();
      }
    });
  }

  App.filters = { get, set, reset, matches, openPopover };
})(window.App);
