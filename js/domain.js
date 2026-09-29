/**
 * Regras de negócio sobre tarefas: prioridade, prazos, progresso,
 * filtragem e ordenação. Funções puras, reutilizadas por todas as telas.
 */
(function (App) {
  'use strict';

  const { PRIORITIES, DEFAULT_PRIORITY } = App.config;
  const { todayISO, diffInDays, formatDate, normalizeText, pluralize } = App.utils;

  const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((priority) => [priority.id, priority]));

  function getPriority(id) {
    return PRIORITY_MAP[id] || PRIORITY_MAP[DEFAULT_PRIORITY];
  }

  function getColumn(board, columnId) {
    return board.columns.find((column) => column.id === columnId) || null;
  }

  function isTaskDone(task, board) {
    const column = getColumn(board, task.columnId);
    return Boolean(column && column.isDone);
  }

  /** Tarefas visíveis (não arquivadas) do quadro, na ordem das colunas. */
  function getActiveTasks(board) {
    return board.columns.flatMap((column) =>
      column.taskIds.map((id) => board.tasks[id]).filter((task) => task && !task.archived)
    );
  }

  function getArchivedTasks(board) {
    return Object.values(board.tasks)
      .filter((task) => task.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /* ---------- Prazos ---------- */

  /**
   * @returns {'done'|'overdue'|'today'|'soon'|'future'|null}
   */
  function getDueStatus(task, board) {
    if (!task.dueDate) return null;
    if (isTaskDone(task, board)) return 'done';

    const diff = diffInDays(task.dueDate, todayISO());
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    if (diff <= 2) return 'soon';
    return 'future';
  }

  function describeDue(task, board) {
    if (!task.dueDate) return '';
    const status = getDueStatus(task, board);
    const diff = diffInDays(task.dueDate, todayISO());

    if (status === 'done') return `Prazo: ${formatDate(task.dueDate)} (concluída)`;
    if (status === 'overdue') return `Atrasada há ${pluralize(-diff, 'dia', 'dias')}`;
    if (status === 'today') return 'Vence hoje';
    if (diff === 1) return 'Vence amanhã';
    return `Vence em ${diff} dias`;
  }

  /* ---------- Checklist ---------- */

  function getChecklistProgress(task) {
    const total = task.checklist.length;
    const done = task.checklist.filter((item) => item.done).length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  /* ---------- Filtros ---------- */

  function createEmptyFilters() {
    return {
      search: '',
      priorities: [],
      labelIds: [],
      assigneeIds: [],
      due: 'all',
      onlyMine: false,
    };
  }

  function countActiveFilters(filters) {
    return (
      filters.priorities.length +
      filters.labelIds.length +
      filters.assigneeIds.length +
      (filters.due !== 'all' ? 1 : 0) +
      (filters.onlyMine ? 1 : 0)
    );
  }

  function hasActiveFilters(filters) {
    return Boolean(filters.search.trim()) || countActiveFilters(filters) > 0;
  }

  function matchesDue(task, board, due) {
    if (due === 'all') return true;
    if (due === 'none') return !task.dueDate;
    if (!task.dueDate || isTaskDone(task, board)) return false;

    const diff = diffInDays(task.dueDate, todayISO());
    if (due === 'overdue') return diff < 0;
    if (due === 'today') return diff === 0;
    if (due === 'week') return diff >= 0 && diff <= 7;
    return true;
  }

  function matchesFilters(task, board, filters, currentUserId) {
    const query = normalizeText(filters.search.trim());
    if (query) {
      const labels = task.labelIds
        .map((id) => board.labels.find((label) => label.id === id))
        .filter(Boolean)
        .map((label) => label.name)
        .join(' ');
      const haystack = normalizeText(`${task.title} ${task.description} ${labels} #${task.number}`);
      if (!haystack.includes(query)) return false;
    }

    if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
    if (filters.labelIds.length && !filters.labelIds.some((id) => task.labelIds.includes(id))) return false;
    if (filters.assigneeIds.length && !filters.assigneeIds.some((id) => task.assigneeIds.includes(id))) return false;
    if (filters.onlyMine && !task.assigneeIds.includes(currentUserId)) return false;

    return matchesDue(task, board, filters.due);
  }

  /* ---------- Ordenação (visão em lista) ---------- */

  function compareTasks(a, b, key, board) {
    switch (key) {
      case 'title':
        return a.title.localeCompare(b.title, 'pt-BR');
      case 'number':
        return a.number - b.number;
      case 'status': {
        const indexA = board.columns.findIndex((column) => column.id === a.columnId);
        const indexB = board.columns.findIndex((column) => column.id === b.columnId);
        return indexA - indexB;
      }
      case 'priority':
        return getPriority(a.priority).weight - getPriority(b.priority).weight;
      case 'dueDate':
        // Tarefas sem prazo sempre ficam por último.
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      case 'progress':
        return getChecklistProgress(a).percent - getChecklistProgress(b).percent;
      case 'updatedAt':
      default:
        return a.updatedAt - b.updatedAt;
    }
  }

  function sortTasks(tasks, board, key, direction) {
    const factor = direction === 'desc' ? -1 : 1;
    return [...tasks].sort((a, b) => {
      const result = compareTasks(a, b, key, board);
      if (key === 'dueDate' && (!a.dueDate || !b.dueDate)) return result;
      return result * factor || a.number - b.number;
    });
  }

  App.domain = {
    getPriority,
    getColumn,
    isTaskDone,
    getActiveTasks,
    getArchivedTasks,
    getDueStatus,
    describeDue,
    getChecklistProgress,
    createEmptyFilters,
    countActiveFilters,
    hasActiveFilters,
    matchesFilters,
    sortTasks,
  };
})(window.App);
