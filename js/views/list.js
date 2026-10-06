(function (App) {
  'use strict';

  const { escapeHtml: esc, timeAgo, formatDateTime } = App.utils;
  const icon = App.icon;
  const ui = App.ui;
  const domain = App.domain;

  const COLUMNS = [
    { key: 'number', label: '#', className: 'col-number' },
    { key: 'title', label: 'Tarefa', className: 'col-title' },
    { key: 'status', label: 'Status', className: 'col-status' },
    { key: 'priority', label: 'Prioridade', className: 'col-priority' },
    { key: null, label: 'Responsáveis', className: 'col-assignees' },
    { key: 'dueDate', label: 'Prazo', className: 'col-due' },
    { key: 'progress', label: 'Checklist', className: 'col-progress' },
    { key: 'updatedAt', label: 'Atualizada', className: 'col-updated' },
  ];

  let root = null;
  let sort = { key: 'status', direction: 'asc' };
  let showArchived = false;

  function renderRow(task, board) {
    const column = domain.getColumn(board, task.columnId);
    const done = domain.isTaskDone(task, board);
    const progress = domain.getChecklistProgress(task);
    const labels = task.labelIds.map((id) => board.labels.find((label) => label.id === id)).filter(Boolean);
    const assignees = task.assigneeIds.map((id) => App.store.getMember(id)).filter(Boolean);

    return `
      <tr class="${done ? 'is-done' : ''} ${task.archived ? 'is-archived' : ''}" data-task-id="${task.id}" tabindex="0">
        <td class="col-number">
          <button type="button" class="card__check ${done ? 'is-checked' : ''}" data-action="toggle-done"
            aria-label="${done ? 'Reabrir tarefa' : 'Concluir tarefa'}" ${task.archived ? 'disabled' : ''}>${icon('check')}</button>
          <span class="muted">#${task.number}</span>
        </td>
        <td class="col-title">
          <span class="table__title">${esc(task.title)}</span>
          ${task.archived ? '<span class="tag-muted">Arquivada</span>' : ''}
          ${labels.length ? `<span class="table__labels">${labels.map((label) => ui.labelChip(label)).join('')}</span>` : ''}
        </td>
        <td class="col-status">
          <span class="status-pill" style="--dot: ${column.color}">${esc(column.name)}</span>
        </td>
        <td class="col-priority">${ui.priorityBadge(task.priority)}</td>
        <td class="col-assignees">${assignees.length ? ui.avatarStack(assignees, 4) : '<span class="muted">—</span>'}</td>
        <td class="col-due">${task.dueDate ? ui.dueBadge(task, board) : '<span class="muted">—</span>'}</td>
        <td class="col-progress">
          ${progress.total
            ? `<div class="mini-progress" title="${progress.done} de ${progress.total} itens">
                <div class="progress"><span style="width: ${progress.percent}%"></span></div>
                <span class="small muted">${progress.done}/${progress.total}</span>
              </div>`
            : '<span class="muted">—</span>'}
        </td>
        <td class="col-updated"><span class="small muted" title="${esc(formatDateTime(task.updatedAt))}">${esc(timeAgo(task.updatedAt))}</span></td>
      </tr>`;
  }

  function render() {
    const board = App.store.getActiveBoard();
    if (!board) return;

    const source = showArchived
      ? [...domain.getActiveTasks(board), ...domain.getArchivedTasks(board)]
      : domain.getActiveTasks(board);
    const tasks = domain.sortTasks(source.filter((task) => App.filters.matches(task, board)), board, sort.key, sort.direction);
    const archivedCount = domain.getArchivedTasks(board).length;

    const header = COLUMNS.map((column) => {
      if (!column.key) return `<th class="${column.className}" scope="col">${column.label}</th>`;
      const active = sort.key === column.key;
      const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
      return `
        <th class="${column.className}" scope="col" aria-sort="${ariaSort}">
          <button type="button" class="th-sort ${active ? 'is-active' : ''}" data-sort="${column.key}">
            ${column.label}${icon(active ? (sort.direction === 'asc' ? 'arrowUp' : 'arrowDown') : 'sort')}
          </button>
        </th>`;
    }).join('');

    root.innerHTML = `
      <div class="list-view">
        <div class="list-view__toolbar">
          <span class="muted small">${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
          ${archivedCount ? `
            <label class="check-row check-row--inline">
              <input type="checkbox" data-toggle-archived ${showArchived ? 'checked' : ''}>
              <span>Mostrar arquivadas (${archivedCount})</span>
            </label>` : ''}
        </div>
        ${tasks.length
          ? `<div class="table-wrap">
              <table class="table">
                <thead><tr>${header}</tr></thead>
                <tbody>${tasks.map((task) => renderRow(task, board)).join('')}</tbody>
              </table>
            </div>`
          : App.domain.hasActiveFilters(App.filters.get())
            ? ui.emptyState({ iconName: 'search', title: 'Nenhuma tarefa encontrada', text: 'Tente ajustar a busca ou os filtros.' })
            : ui.emptyState({ title: 'Nenhuma tarefa ainda', text: 'Crie a primeira tarefa deste quadro.', actionLabel: 'Nova tarefa', action: 'new-task' })}
      </div>`;
  }

  function mount(element) {
    root = element;
    root.classList.add('view--list');

    root.addEventListener('click', (event) => {
      const sortButton = event.target.closest('[data-sort]');
      if (sortButton) {
        const key = sortButton.dataset.sort;
        sort = sort.key === key
          ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: key === 'updatedAt' ? 'desc' : 'asc' };
        render();
        return;
      }

      const row = event.target.closest('tr[data-task-id]');
      if (event.target.closest('[data-action="toggle-done"]')) {
        App.actions.toggleTaskDone(row.dataset.taskId);
        return;
      }
      if (event.target.closest('[data-action="new-task"]')) {
        App.taskModal.openCreate();
        return;
      }
      if (row) App.taskModal.open(row.dataset.taskId);
    });

    root.addEventListener('keydown', (event) => {
      const row = event.target.closest('tr[data-task-id]');
      if (!row || event.target !== row) return;
      if (event.key === 'Enter') App.taskModal.open(row.dataset.taskId);
      if (event.key === 'ArrowDown' && row.nextElementSibling) {
        event.preventDefault();
        row.nextElementSibling.focus();
      }
      if (event.key === 'ArrowUp' && row.previousElementSibling) {
        event.preventDefault();
        row.previousElementSibling.focus();
      }
    });

    root.addEventListener('change', (event) => {
      if (event.target.matches('[data-toggle-archived]')) {
        showArchived = event.target.checked;
        render();
      }
    });
  }

  App.views = App.views || {};
  App.views.list = { mount, render };
})(window.App);
