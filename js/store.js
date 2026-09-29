/**
 * Store central da aplicação.
 *
 * - Guarda o estado (quadros, colunas, tarefas, membros e preferências).
 * - Expõe "ações" que são a ÚNICA forma de alterar o estado.
 * - Após cada ação, salva no localStorage e notifica os assinantes para
 *   que as telas sejam renderizadas novamente.
 *
 * Formato do estado:
 * {
 *   version, settings: { theme, view, activeBoardId, currentUserId, sidebarCollapsed },
 *   members: [{ id, name, role, color }],
 *   boards: [{
 *     id, name, description, color, nextNumber, createdAt, updatedAt,
 *     columns: [{ id, name, color, wipLimit, isDone, taskIds: [] }],
 *     labels: [{ id, name, color }],
 *     tasks: { [id]: Task },
 *     activity: [{ id, at, userId, taskId, text }]
 *   }]
 * }
 */
(function (App) {
  'use strict';

  const { STORAGE_VERSION, MAX_ACTIVITY, SAVE_DELAY, TITLE_MAX_LENGTH, PRIORITIES, DEFAULT_PRIORITY, TEMPLATES, DEFAULT_LABELS, COLORS } = App.config;
  const { uid, clone, debounce, isValidColor, isISODate, formatDate } = App.utils;

  const PRIORITY_IDS = PRIORITIES.map((priority) => priority.id);
  const THEMES = ['system', 'light', 'dark'];
  const VIEWS = ['board', 'list', 'dashboard'];

  let state = null;
  const listeners = new Set();

  const persist = debounce(() => {
    if (!App.storage.save(state)) {
      emit({ type: 'storage:error' });
    }
  }, SAVE_DELAY);

  /* =========================================================
   * Normalização (garante um estado válido mesmo com dados
   * antigos, incompletos ou importados de um arquivo)
   * ========================================================= */

  function color(value, fallback = COLORS[0].value) {
    return isValidColor(value) ? value : fallback;
  }

  function text(value, fallback = '', maxLength = 5000) {
    const result = typeof value === 'string' ? value.trim() : '';
    return (result || fallback).slice(0, maxLength);
  }

  function normalizeMember(raw) {
    return {
      id: raw.id || uid('member'),
      name: text(raw.name, 'Sem nome', 80),
      role: text(raw.role, '', 80),
      color: color(raw.color, COLORS[6].value),
    };
  }

  function normalizeTask(raw, columnId, number) {
    const now = Date.now();
    return {
      id: raw.id || uid('task'),
      number: Number.isInteger(raw.number) && raw.number > 0 ? raw.number : number,
      columnId: raw.columnId || columnId,
      title: text(raw.title, 'Sem título', TITLE_MAX_LENGTH),
      description: typeof raw.description === 'string' ? raw.description : '',
      priority: PRIORITY_IDS.includes(raw.priority) ? raw.priority : DEFAULT_PRIORITY,
      dueDate: isISODate(raw.dueDate) ? raw.dueDate : null,
      labelIds: Array.isArray(raw.labelIds) ? [...new Set(raw.labelIds)] : [],
      assigneeIds: Array.isArray(raw.assigneeIds) ? [...new Set(raw.assigneeIds)] : [],
      checklist: (Array.isArray(raw.checklist) ? raw.checklist : []).map((item) => ({
        id: item.id || uid('check'),
        text: text(item.text, 'Item', 300),
        done: Boolean(item.done),
      })),
      comments: (Array.isArray(raw.comments) ? raw.comments : []).map((comment) => ({
        id: comment.id || uid('comment'),
        text: text(comment.text, '', 5000),
        authorId: comment.authorId || null,
        createdAt: Number(comment.createdAt) || now,
      })),
      archived: Boolean(raw.archived),
      createdAt: Number(raw.createdAt) || now,
      updatedAt: Number(raw.updatedAt) || now,
      completedAt: Number(raw.completedAt) || null,
    };
  }

  function normalizeColumn(raw) {
    return {
      id: raw.id || uid('col'),
      name: text(raw.name, 'Sem nome', 60),
      color: color(raw.color),
      wipLimit: Math.max(0, Math.floor(Number(raw.wipLimit) || 0)),
      isDone: Boolean(raw.isDone),
      taskIds: Array.isArray(raw.taskIds) ? raw.taskIds : [],
    };
  }

  function normalizeBoard(raw, memberIds) {
    const now = Date.now();
    let columns = (Array.isArray(raw.columns) ? raw.columns : []).map(normalizeColumn);
    if (columns.length === 0) {
      columns = TEMPLATES[0].columns.map(normalizeColumn);
    }

    const labels = (Array.isArray(raw.labels) ? raw.labels : []).map((label) => ({
      id: label.id || uid('label'),
      name: text(label.name, 'Etiqueta', 40),
      color: color(label.color),
    }));
    const labelIds = new Set(labels.map((label) => label.id));

    // Aceita tarefas como objeto { id: task } ou como array.
    const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : Object.values(raw.tasks || {});
    const tasks = {};
    let number = 1;
    rawTasks.forEach((rawTask) => {
      const task = normalizeTask(rawTask, columns[0].id, number);
      task.labelIds = task.labelIds.filter((id) => labelIds.has(id));
      task.assigneeIds = task.assigneeIds.filter((id) => memberIds.has(id));
      tasks[task.id] = task;
      number = Math.max(number, task.number) + 1;
    });

    // Garante que cada tarefa esteja em exatamente uma coluna.
    const placed = new Set();
    columns.forEach((column) => {
      column.taskIds = column.taskIds.filter((id) => {
        if (!tasks[id] || placed.has(id)) return false;
        placed.add(id);
        tasks[id].columnId = column.id;
        return true;
      });
    });
    Object.values(tasks).forEach((task) => {
      if (placed.has(task.id)) return;
      const column = columns.find((item) => item.id === task.columnId) || columns[0];
      task.columnId = column.id;
      column.taskIds.push(task.id);
    });

    return {
      id: raw.id || uid('board'),
      name: text(raw.name, 'Quadro sem nome', 80),
      description: text(raw.description, '', 500),
      color: color(raw.color, COLORS[6].value),
      nextNumber: Math.max(Number(raw.nextNumber) || 1, number),
      createdAt: Number(raw.createdAt) || now,
      updatedAt: Number(raw.updatedAt) || now,
      columns,
      labels,
      tasks,
      activity: (Array.isArray(raw.activity) ? raw.activity : []).slice(0, MAX_ACTIVITY).map((entry) => ({
        id: entry.id || uid('act'),
        at: Number(entry.at) || now,
        userId: entry.userId || null,
        taskId: entry.taskId || null,
        text: text(entry.text, '', 500),
      })),
    };
  }

  function normalizeState(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const settings = source.settings || {};
    const members = (Array.isArray(source.members) ? source.members : []).map(normalizeMember);
    const memberIds = new Set(members.map((member) => member.id));
    const boards = (Array.isArray(source.boards) ? source.boards : []).map((board) => normalizeBoard(board, memberIds));

    return {
      version: STORAGE_VERSION,
      settings: {
        theme: THEMES.includes(settings.theme) ? settings.theme : 'system',
        view: VIEWS.includes(settings.view) ? settings.view : 'board',
        activeBoardId: boards.some((board) => board.id === settings.activeBoardId)
          ? settings.activeBoardId
          : boards[0]?.id || null,
        currentUserId: memberIds.has(settings.currentUserId) ? settings.currentUserId : members[0]?.id || null,
        sidebarCollapsed: Boolean(settings.sidebarCollapsed),
      },
      members,
      boards,
    };
  }

  /* =========================================================
   * Núcleo
   * ========================================================= */

  function emit(event) {
    listeners.forEach((listener) => listener(event));
  }

  function commit(type, payload = {}) {
    persist();
    emit({ type, ...payload });
  }

  function init() {
    const saved = App.storage.load();
    state = normalizeState(saved || App.seed.create());
    if (!saved) {
      App.storage.save(state);
    }
    return { firstRun: !saved };
  }

  /** Recarrega do localStorage (usado quando outra aba altera os dados). */
  function reloadFromStorage() {
    const saved = App.storage.load();
    if (!saved) return;
    state = normalizeState(saved);
    emit({ type: 'external' });
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function flush() {
    persist.flush();
  }

  /* =========================================================
   * Seletores
   * ========================================================= */

  function getState() {
    return state;
  }

  function getSettings() {
    return state.settings;
  }

  function getBoard(boardId) {
    return state.boards.find((board) => board.id === boardId) || null;
  }

  function getActiveBoard() {
    return getBoard(state.settings.activeBoardId);
  }

  function getTask(taskId) {
    const board = getActiveBoard();
    return board ? board.tasks[taskId] || null : null;
  }

  function getMember(memberId) {
    return state.members.find((member) => member.id === memberId) || null;
  }

  function getCurrentUser() {
    return getMember(state.settings.currentUserId);
  }

  /* =========================================================
   * Helpers internos
   * ========================================================= */

  function findColumn(board, columnId) {
    return board.columns.find((column) => column.id === columnId) || null;
  }

  function touch(board, task) {
    const now = Date.now();
    board.updatedAt = now;
    if (task) task.updatedAt = now;
  }

  function log(board, message, taskId = null) {
    board.activity.unshift({
      id: uid('act'),
      at: Date.now(),
      userId: state.settings.currentUserId,
      taskId,
      text: message,
    });
    if (board.activity.length > MAX_ACTIVITY) {
      board.activity.length = MAX_ACTIVITY;
    }
  }

  function withTask(taskId, callback) {
    const board = getActiveBoard();
    const task = board && board.tasks[taskId];
    if (!task) return null;
    return callback(board, task);
  }

  /* =========================================================
   * Ações — preferências
   * ========================================================= */

  function updateSettings(patch) {
    const allowed = {};
    if (THEMES.includes(patch.theme)) allowed.theme = patch.theme;
    if (VIEWS.includes(patch.view)) allowed.view = patch.view;
    if ('sidebarCollapsed' in patch) allowed.sidebarCollapsed = Boolean(patch.sidebarCollapsed);
    if (patch.currentUserId && getMember(patch.currentUserId)) allowed.currentUserId = patch.currentUserId;
    if (patch.activeBoardId && getBoard(patch.activeBoardId)) allowed.activeBoardId = patch.activeBoardId;

    Object.assign(state.settings, allowed);
    commit('settings:update', { patch: allowed });
  }

  /* =========================================================
   * Ações — quadros
   * ========================================================= */

  function createBoard({ name, description = '', color: boardColor, templateId = 'basic', withDefaultLabels = true }) {
    const template = TEMPLATES.find((item) => item.id === templateId) || TEMPLATES[0];
    const board = normalizeBoard(
      {
        name,
        description,
        color: boardColor,
        columns: template.columns.map((column) => ({ ...column, id: uid('col') })),
        labels: withDefaultLabels ? DEFAULT_LABELS.map((label) => ({ ...label, id: uid('label') })) : [],
      },
      new Set(state.members.map((member) => member.id))
    );

    log(board, `criou o quadro "${board.name}"`);
    state.boards.push(board);
    state.settings.activeBoardId = board.id;
    commit('board:create', { boardId: board.id });
    return board;
  }

  function updateBoard(boardId, patch) {
    const board = getBoard(boardId);
    if (!board) return;

    if (typeof patch.name === 'string' && patch.name.trim()) board.name = text(patch.name, board.name, 80);
    if (typeof patch.description === 'string') board.description = text(patch.description, '', 500);
    if (isValidColor(patch.color)) board.color = patch.color;

    touch(board);
    commit('board:update', { boardId });
  }

  function duplicateBoard(boardId) {
    const source = getBoard(boardId);
    if (!source) return null;

    const copy = clone(source);
    const labelIdMap = {};

    copy.id = uid('board');
    copy.name = `${source.name} (cópia)`.slice(0, 80);
    copy.createdAt = copy.updatedAt = Date.now();
    copy.activity = [];
    copy.columns.forEach((column) => {
      column.id = uid('col');
    });
    copy.labels.forEach((label) => {
      labelIdMap[label.id] = label.id = uid('label');
    });

    const tasks = {};
    copy.columns.forEach((column) => {
      column.taskIds = column.taskIds.map((oldId) => {
        const task = copy.tasks[oldId];
        task.id = uid('task');
        task.columnId = column.id;
        task.labelIds = task.labelIds.map((id) => labelIdMap[id]).filter(Boolean);
        tasks[task.id] = task;
        return task.id;
      });
    });
    copy.tasks = tasks;

    log(copy, `duplicou o quadro "${source.name}"`);
    state.boards.push(copy);
    state.settings.activeBoardId = copy.id;
    commit('board:create', { boardId: copy.id });
    return copy;
  }

  function deleteBoard(boardId) {
    const index = state.boards.findIndex((board) => board.id === boardId);
    if (index === -1) return;

    state.boards.splice(index, 1);
    if (state.settings.activeBoardId === boardId) {
      const next = state.boards[index] || state.boards[index - 1] || null;
      state.settings.activeBoardId = next ? next.id : null;
    }
    commit('board:delete', { boardId });
  }

  function moveBoard(boardId, toIndex) {
    const index = state.boards.findIndex((board) => board.id === boardId);
    if (index === -1) return;
    const [board] = state.boards.splice(index, 1);
    state.boards.splice(Math.max(0, Math.min(toIndex, state.boards.length)), 0, board);
    commit('board:move', { boardId });
  }

  /* =========================================================
   * Ações — colunas
   * ========================================================= */

  function addColumn(name, options = {}) {
    const board = getActiveBoard();
    if (!board) return null;

    const column = normalizeColumn({
      name,
      color: options.color || COLORS[board.columns.length % COLORS.length].value,
      wipLimit: options.wipLimit,
      isDone: options.isDone,
    });
    board.columns.push(column);
    log(board, `adicionou a coluna "${column.name}"`);
    touch(board);
    commit('column:create', { columnId: column.id });
    return column;
  }

  function updateColumn(columnId, patch) {
    const board = getActiveBoard();
    const column = board && findColumn(board, columnId);
    if (!column) return;

    if (typeof patch.name === 'string' && patch.name.trim() && patch.name.trim() !== column.name) {
      log(board, `renomeou a coluna "${column.name}" para "${patch.name.trim()}"`);
      column.name = text(patch.name, column.name, 60);
    }
    if (isValidColor(patch.color)) column.color = patch.color;
    if ('wipLimit' in patch) column.wipLimit = Math.max(0, Math.floor(Number(patch.wipLimit) || 0));
    if ('isDone' in patch && Boolean(patch.isDone) !== column.isDone) {
      column.isDone = Boolean(patch.isDone);
      // Atualiza a data de conclusão das tarefas já presentes na coluna.
      const now = Date.now();
      column.taskIds.forEach((id) => {
        board.tasks[id].completedAt = column.isDone ? board.tasks[id].completedAt || now : null;
      });
    }

    touch(board);
    commit('column:update', { columnId });
  }

  function moveColumn(columnId, toIndex) {
    const board = getActiveBoard();
    if (!board) return;
    const index = board.columns.findIndex((column) => column.id === columnId);
    if (index === -1) return;

    const target = Math.max(0, Math.min(toIndex, board.columns.length - 1));
    if (target === index) return;

    const [column] = board.columns.splice(index, 1);
    board.columns.splice(target, 0, column);
    touch(board);
    commit('column:move', { columnId });
  }

  /**
   * Remove uma coluna. Se `moveToColumnId` for informado, as tarefas são
   * transferidas para ela; caso contrário, são excluídas junto.
   */
  function deleteColumn(columnId, moveToColumnId = null) {
    const board = getActiveBoard();
    if (!board || board.columns.length <= 1) return false;

    const column = findColumn(board, columnId);
    if (!column) return false;

    const target = moveToColumnId && moveToColumnId !== columnId ? findColumn(board, moveToColumnId) : null;
    column.taskIds.forEach((id) => {
      if (target) {
        target.taskIds.push(id);
        board.tasks[id].columnId = target.id;
        board.tasks[id].completedAt = target.isDone ? board.tasks[id].completedAt || Date.now() : null;
      } else {
        delete board.tasks[id];
      }
    });

    board.columns = board.columns.filter((item) => item.id !== columnId);
    log(board, `excluiu a coluna "${column.name}"`);
    touch(board);
    commit('column:delete', { columnId });
    return true;
  }

  /** Arquiva todas as tarefas de uma coluna (útil para limpar "Concluído"). */
  function archiveColumnTasks(columnId) {
    const board = getActiveBoard();
    const column = board && findColumn(board, columnId);
    if (!column) return 0;

    let count = 0;
    column.taskIds.forEach((id) => {
      if (!board.tasks[id].archived) {
        board.tasks[id].archived = true;
        board.tasks[id].updatedAt = Date.now();
        count += 1;
      }
    });
    if (count) {
      log(board, `arquivou ${count} tarefa(s) da coluna "${column.name}"`);
      touch(board);
      commit('column:archive', { columnId });
    }
    return count;
  }

  /* =========================================================
   * Ações — etiquetas
   * ========================================================= */

  function addLabel(name, labelColor) {
    const board = getActiveBoard();
    if (!board || !name.trim()) return null;
    const label = { id: uid('label'), name: text(name, 'Etiqueta', 40), color: color(labelColor) };
    board.labels.push(label);
    touch(board);
    commit('label:create', { labelId: label.id });
    return label;
  }

  function updateLabel(labelId, patch) {
    const board = getActiveBoard();
    const label = board && board.labels.find((item) => item.id === labelId);
    if (!label) return;
    if (typeof patch.name === 'string' && patch.name.trim()) label.name = text(patch.name, label.name, 40);
    if (isValidColor(patch.color)) label.color = patch.color;
    touch(board);
    commit('label:update', { labelId });
  }

  function deleteLabel(labelId) {
    const board = getActiveBoard();
    if (!board) return;
    board.labels = board.labels.filter((label) => label.id !== labelId);
    Object.values(board.tasks).forEach((task) => {
      task.labelIds = task.labelIds.filter((id) => id !== labelId);
    });
    touch(board);
    commit('label:delete', { labelId });
  }

  /* =========================================================
   * Ações — membros da equipe
   * ========================================================= */

  function addMember({ name, role = '', color: memberColor }) {
    if (!name || !name.trim()) return null;
    const member = normalizeMember({ name, role, color: memberColor || COLORS[(state.members.length + 6) % COLORS.length].value });
    state.members.push(member);
    if (!state.settings.currentUserId) state.settings.currentUserId = member.id;
    commit('member:create', { memberId: member.id });
    return member;
  }

  function updateMember(memberId, patch) {
    const member = getMember(memberId);
    if (!member) return;
    if (typeof patch.name === 'string' && patch.name.trim()) member.name = text(patch.name, member.name, 80);
    if (typeof patch.role === 'string') member.role = text(patch.role, '', 80);
    if (isValidColor(patch.color)) member.color = patch.color;
    commit('member:update', { memberId });
  }

  function deleteMember(memberId) {
    state.members = state.members.filter((member) => member.id !== memberId);
    state.boards.forEach((board) => {
      Object.values(board.tasks).forEach((task) => {
        task.assigneeIds = task.assigneeIds.filter((id) => id !== memberId);
      });
    });
    if (state.settings.currentUserId === memberId) {
      state.settings.currentUserId = state.members[0]?.id || null;
    }
    commit('member:delete', { memberId });
  }

  /* =========================================================
   * Ações — tarefas
   * ========================================================= */

  function createTask(columnId, data = {}) {
    const board = getActiveBoard();
    const column = board && findColumn(board, columnId);
    if (!column || !data.title || !data.title.trim()) return null;

    const task = normalizeTask({ ...data, id: null, columnId }, columnId, board.nextNumber);
    task.number = board.nextNumber;
    board.nextNumber += 1;
    task.labelIds = task.labelIds.filter((id) => board.labels.some((label) => label.id === id));
    task.assigneeIds = task.assigneeIds.filter((id) => getMember(id));
    if (column.isDone) task.completedAt = Date.now();

    board.tasks[task.id] = task;
    if (data.position === 'top') column.taskIds.unshift(task.id);
    else column.taskIds.push(task.id);

    log(board, `criou a tarefa "${task.title}" em ${column.name}`, task.id);
    touch(board);
    commit('task:create', { taskId: task.id });
    return task;
  }

  function updateTask(taskId, patch) {
    return withTask(taskId, (board, task) => {
      const priorityLabel = (id) => PRIORITIES.find((priority) => priority.id === id).label;

      if (typeof patch.title === 'string' && patch.title.trim() && patch.title.trim() !== task.title) {
        log(board, `renomeou "${task.title}" para "${patch.title.trim()}"`, task.id);
        task.title = text(patch.title, task.title, TITLE_MAX_LENGTH);
      }
      if (typeof patch.description === 'string' && patch.description !== task.description) {
        task.description = patch.description;
        log(board, `atualizou a descrição de "${task.title}"`, task.id);
      }
      if (PRIORITY_IDS.includes(patch.priority) && patch.priority !== task.priority) {
        log(board, `alterou a prioridade de "${task.title}" para ${priorityLabel(patch.priority)}`, task.id);
        task.priority = patch.priority;
      }
      if ('dueDate' in patch && patch.dueDate !== task.dueDate) {
        task.dueDate = isISODate(patch.dueDate) ? patch.dueDate : null;
        log(
          board,
          task.dueDate
            ? `definiu o prazo de "${task.title}" para ${formatDate(task.dueDate)}`
            : `removeu o prazo de "${task.title}"`,
          task.id
        );
      }

      touch(board, task);
      commit('task:update', { taskId });
      return task;
    });
  }

  function toggleTaskAssignee(taskId, memberId) {
    return withTask(taskId, (board, task) => {
      const member = getMember(memberId);
      if (!member) return;
      if (task.assigneeIds.includes(memberId)) {
        task.assigneeIds = task.assigneeIds.filter((id) => id !== memberId);
        log(board, `removeu ${member.name} de "${task.title}"`, task.id);
      } else {
        task.assigneeIds.push(memberId);
        log(board, `atribuiu "${task.title}" a ${member.name}`, task.id);
      }
      touch(board, task);
      commit('task:update', { taskId });
    });
  }

  function toggleTaskLabel(taskId, labelId) {
    return withTask(taskId, (board, task) => {
      if (!board.labels.some((label) => label.id === labelId)) return;
      task.labelIds = task.labelIds.includes(labelId)
        ? task.labelIds.filter((id) => id !== labelId)
        : [...task.labelIds, labelId];
      touch(board, task);
      commit('task:update', { taskId });
    });
  }

  /**
   * Move uma tarefa para `toColumnId`, antes da tarefa `beforeTaskId`
   * (ou no final da coluna, se `beforeTaskId` for nulo).
   */
  function moveTask(taskId, toColumnId, beforeTaskId = null) {
    return withTask(taskId, (board, task) => {
      const from = findColumn(board, task.columnId);
      const to = findColumn(board, toColumnId);
      if (!from || !to) return;

      from.taskIds = from.taskIds.filter((id) => id !== taskId);
      let index = beforeTaskId ? to.taskIds.indexOf(beforeTaskId) : -1;
      if (index < 0) index = to.taskIds.length;
      to.taskIds.splice(index, 0, taskId);
      task.columnId = to.id;

      if (from !== to) {
        if (to.isDone && !from.isDone) task.completedAt = Date.now();
        if (!to.isDone) task.completedAt = null;
        log(board, `moveu "${task.title}" de ${from.name} para ${to.name}`, task.id);
        touch(board, task);
      } else {
        touch(board);
      }

      commit('task:move', { taskId, fromColumnId: from.id, toColumnId: to.id });
    });
  }

  /** Move para a primeira coluna de conclusão (ou de volta para a primeira aberta). */
  function toggleTaskDone(taskId) {
    return withTask(taskId, (board, task) => {
      const current = findColumn(board, task.columnId);
      const target = current.isDone
        ? board.columns.find((column) => !column.isDone)
        : board.columns.find((column) => column.isDone);
      if (!target) return false;
      moveTask(taskId, target.id);
      return true;
    });
  }

  function duplicateTask(taskId) {
    return withTask(taskId, (board, task) => {
      const copy = clone(task);
      copy.id = uid('task');
      copy.number = board.nextNumber;
      board.nextNumber += 1;
      copy.title = `${task.title} (cópia)`.slice(0, TITLE_MAX_LENGTH);
      copy.comments = [];
      copy.createdAt = copy.updatedAt = Date.now();
      copy.checklist = copy.checklist.map((item) => ({ ...item, id: uid('check') }));

      board.tasks[copy.id] = copy;
      const column = findColumn(board, task.columnId);
      column.taskIds.splice(column.taskIds.indexOf(task.id) + 1, 0, copy.id);

      log(board, `duplicou a tarefa "${task.title}"`, copy.id);
      touch(board);
      commit('task:create', { taskId: copy.id });
      return copy;
    });
  }

  function setTaskArchived(taskId, archived) {
    return withTask(taskId, (board, task) => {
      task.archived = Boolean(archived);
      log(board, `${archived ? 'arquivou' : 'restaurou'} a tarefa "${task.title}"`, task.id);
      touch(board, task);
      commit(archived ? 'task:archive' : 'task:restore', { taskId });
    });
  }

  function deleteTask(taskId) {
    return withTask(taskId, (board, task) => {
      const column = findColumn(board, task.columnId);
      if (column) column.taskIds = column.taskIds.filter((id) => id !== taskId);
      delete board.tasks[taskId];
      log(board, `excluiu a tarefa "${task.title}"`);
      touch(board);
      commit('task:delete', { taskId });
    });
  }

  /* ---------- Checklist ---------- */

  function addChecklistItem(taskId, itemText) {
    return withTask(taskId, (board, task) => {
      if (!itemText.trim()) return;
      task.checklist.push({ id: uid('check'), text: text(itemText, 'Item', 300), done: false });
      touch(board, task);
      commit('task:update', { taskId });
    });
  }

  function updateChecklistItem(taskId, itemId, patch) {
    return withTask(taskId, (board, task) => {
      const item = task.checklist.find((entry) => entry.id === itemId);
      if (!item) return;
      if (typeof patch.text === 'string' && patch.text.trim()) item.text = text(patch.text, item.text, 300);
      if ('done' in patch) {
        item.done = Boolean(patch.done);
        if (item.done) log(board, `concluiu "${item.text}" em "${task.title}"`, task.id);
      }
      touch(board, task);
      commit('task:update', { taskId });
    });
  }

  function deleteChecklistItem(taskId, itemId) {
    return withTask(taskId, (board, task) => {
      task.checklist = task.checklist.filter((item) => item.id !== itemId);
      touch(board, task);
      commit('task:update', { taskId });
    });
  }

  function moveChecklistItem(taskId, itemId, direction) {
    return withTask(taskId, (board, task) => {
      const index = task.checklist.findIndex((item) => item.id === itemId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= task.checklist.length) return;
      const [item] = task.checklist.splice(index, 1);
      task.checklist.splice(target, 0, item);
      touch(board, task);
      commit('task:update', { taskId });
    });
  }

  /* ---------- Comentários ---------- */

  function addComment(taskId, commentText) {
    return withTask(taskId, (board, task) => {
      if (!commentText.trim()) return;
      task.comments.push({
        id: uid('comment'),
        text: text(commentText, '', 5000),
        authorId: state.settings.currentUserId,
        createdAt: Date.now(),
      });
      log(board, `comentou em "${task.title}"`, task.id);
      touch(board, task);
      commit('task:update', { taskId });
    });
  }

  function deleteComment(taskId, commentId) {
    return withTask(taskId, (board, task) => {
      task.comments = task.comments.filter((comment) => comment.id !== commentId);
      touch(board, task);
      commit('task:update', { taskId });
    });
  }

  /* =========================================================
   * Dados: backup, importação e desfazer
   * ========================================================= */

  function snapshot() {
    return JSON.stringify(state);
  }

  function restore(serialized) {
    state = normalizeState(JSON.parse(serialized));
    commit('restore');
  }

  function exportData() {
    return {
      app: App.config.APP_NAME,
      exportedAt: new Date().toISOString(),
      ...clone(state),
    };
  }

  /** Substitui todos os dados pelos do arquivo. Lança erro se o formato for inválido. */
  function importData(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.boards)) {
      throw new Error('Arquivo inválido: nenhum quadro encontrado.');
    }
    state = normalizeState(data);
    commit('import');
  }

  function resetAll(withSampleData) {
    state = normalizeState(withSampleData ? App.seed.create() : App.seed.createEmpty());
    commit('reset');
  }

  App.store = {
    init,
    subscribe,
    flush,
    reloadFromStorage,

    getState,
    getSettings,
    getBoard,
    getActiveBoard,
    getTask,
    getMember,
    getCurrentUser,

    updateSettings,

    createBoard,
    updateBoard,
    duplicateBoard,
    deleteBoard,
    moveBoard,

    addColumn,
    updateColumn,
    moveColumn,
    deleteColumn,
    archiveColumnTasks,

    addLabel,
    updateLabel,
    deleteLabel,

    addMember,
    updateMember,
    deleteMember,

    createTask,
    updateTask,
    toggleTaskAssignee,
    toggleTaskLabel,
    moveTask,
    toggleTaskDone,
    duplicateTask,
    setTaskArchived,
    deleteTask,

    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    moveChecklistItem,

    addComment,
    deleteComment,

    snapshot,
    restore,
    exportData,
    importData,
    resetAll,
  };
})(window.App);
