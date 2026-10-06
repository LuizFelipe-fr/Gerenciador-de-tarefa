(function (App) {
  'use strict';

  const { escapeHtml: esc, todayISO, slugify, downloadFile, readFileAsText, formatDate, formatDateTime, pluralize } = App.utils;
  const { TEMPLATES, COLORS } = App.config;
  const store = App.store;
  const domain = App.domain;

  /** Executa uma ação destrutiva oferecendo "Desfazer" no toast. */
  function withUndo(message, action) {
    const snapshot = store.snapshot();
    action();
    App.toast.success(message, {
      action: {
        label: 'Desfazer',
        onClick: () => {
          store.restore(snapshot);
          App.toast.info('Ação desfeita.');
        },
      },
    });
  }

  function countVisibleTasks(board, column) {
    return column.taskIds.filter((id) => board.tasks[id] && !board.tasks[id].archived).length;
  }

  function warnWipLimit(columnId) {
    const board = store.getActiveBoard();
    const column = board && domain.getColumn(board, columnId);
    if (!column || !column.wipLimit) return;
    const count = countVisibleTasks(board, column);
    if (count > column.wipLimit) {
      App.toast.warning(`"${column.name}" passou do limite de ${column.wipLimit} tarefas em andamento (${count}).`);
    }
  }

  /* ---------- Tarefas ---------- */

  function quickCreateTask(columnId, title) {
    const task = store.createTask(columnId, { title });
    if (task) warnWipLimit(columnId);
    return task;
  }

  function moveTask(taskId, columnId, beforeTaskId = null) {
    const task = store.getTask(taskId);
    if (!task) return;
    const changedColumn = task.columnId !== columnId;
    store.moveTask(taskId, columnId, beforeTaskId);
    if (changedColumn) warnWipLimit(columnId);
  }

  function toggleTaskDone(taskId) {
    const board = store.getActiveBoard();
    const task = store.getTask(taskId);
    if (!board || !task) return;

    const wasDone = domain.isTaskDone(task, board);
    if (!store.toggleTaskDone(taskId)) {
      App.toast.warning('Marque uma coluna como "coluna de conclusão" para usar este recurso.');
      return;
    }
    if (!wasDone) App.toast.success(`"${task.title}" concluída!`);
  }

  function archiveTask(taskId) {
    const task = store.getTask(taskId);
    if (!task) return;
    store.setTaskArchived(taskId, true);
    App.toast.success('Tarefa arquivada.', {
      action: { label: 'Desfazer', onClick: () => store.setTaskArchived(taskId, false) },
    });
  }

  async function deleteTask(taskId) {
    const task = store.getTask(taskId);
    if (!task) return false;

    const confirmed = await App.dialogs.confirm({
      title: 'Excluir tarefa?',
      message: `"${task.title}" será excluída permanentemente. Você ainda poderá desfazer logo em seguida.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) return false;

    withUndo('Tarefa excluída.', () => store.deleteTask(taskId));
    return true;
  }

  function duplicateTask(taskId) {
    const copy = store.duplicateTask(taskId);
    if (copy) App.toast.success('Tarefa duplicada.', { action: { label: 'Abrir', onClick: () => App.taskModal.open(copy.id) } });
    return copy;
  }

  /* ---------- Colunas ---------- */

  async function addColumn() {
    const name = await App.dialogs.prompt({ title: 'Nova coluna', label: 'Nome da coluna', placeholder: 'Ex.: Em validação', confirmLabel: 'Criar' });
    if (name) store.addColumn(name);
  }

  async function renameColumn(columnId) {
    const board = store.getActiveBoard();
    const column = domain.getColumn(board, columnId);
    const name = await App.dialogs.prompt({ title: 'Renomear coluna', label: 'Nome da coluna', value: column.name });
    if (name) store.updateColumn(columnId, { name });
  }

  async function setWipLimit(columnId) {
    const board = store.getActiveBoard();
    const column = domain.getColumn(board, columnId);
    const value = await App.dialogs.prompt({
      title: 'Limite de WIP',
      label: 'Máximo de tarefas simultâneas nesta coluna (0 = sem limite)',
      value: String(column.wipLimit || 0),
      type: 'number',
      min: 0,
      max: 99,
    });
    if (value !== null) store.updateColumn(columnId, { wipLimit: Number(value) });
  }

  function deleteColumn(columnId) {
    const board = store.getActiveBoard();
    const column = domain.getColumn(board, columnId);
    if (!column) return;

    if (board.columns.length <= 1) {
      App.toast.warning('O quadro precisa ter pelo menos uma coluna.');
      return;
    }

    const taskCount = column.taskIds.length;
    const others = board.columns.filter((item) => item.id !== columnId);

    const modal = App.modal.open({
      title: `Excluir coluna "${column.name}"?`,
      size: 'sm',
      content: taskCount
        ? `
          <p class="dialog-message">Esta coluna tem ${pluralize(taskCount, 'tarefa', 'tarefas')}. O que fazer com ${taskCount === 1 ? 'ela' : 'elas'}?</p>
          <label class="field">
            <span class="field__label">Destino das tarefas</span>
            <select class="input" data-target>
              ${others.map((item) => `<option value="${item.id}">Mover para "${esc(item.name)}"</option>`).join('')}
              <option value="">Excluir as tarefas junto com a coluna</option>
            </select>
          </label>`
        : '<p class="dialog-message">A coluna está vazia e será removida do quadro.</p>',
      footer: `
        <button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button>
        <button type="button" class="btn btn--danger" data-confirm>Excluir coluna</button>
      `,
    });

    modal.footer.querySelector('[data-confirm]').addEventListener('click', () => {
      const select = modal.body.querySelector('[data-target]');
      const targetId = select ? select.value : null;
      modal.close();
      withUndo('Coluna excluída.', () => store.deleteColumn(columnId, targetId || null));
    });
  }

  function archiveColumnTasks(columnId) {
    const snapshot = store.snapshot();
    const count = store.archiveColumnTasks(columnId);
    if (!count) {
      App.toast.info('Não há tarefas para arquivar nesta coluna.');
      return;
    }
    App.toast.success(`${pluralize(count, 'tarefa arquivada', 'tarefas arquivadas')}.`, {
      action: { label: 'Desfazer', onClick: () => store.restore(snapshot) },
    });
  }

  function openColumnMenu(anchor, columnId) {
    const board = store.getActiveBoard();
    const index = board.columns.findIndex((column) => column.id === columnId);
    const column = board.columns[index];

    App.popover.menu(anchor, [
      { label: 'Adicionar tarefa', icon: 'plus', onClick: () => App.taskModal.openCreate(columnId) },
      'divider',
      { label: 'Renomear', icon: 'edit', onClick: () => renameColumn(columnId) },
      { label: 'Alterar cor', icon: 'palette', onClick: () => openColumnColorPicker(anchor, columnId) },
      { label: column.wipLimit ? `Limite de WIP (${column.wipLimit})` : 'Definir limite de WIP', icon: 'target', onClick: () => setWipLimit(columnId) },
      {
        label: 'Coluna de conclusão',
        icon: 'success',
        checked: column.isDone,
        onClick: () => store.updateColumn(columnId, { isDone: !column.isDone }),
      },
      'divider',
      { label: 'Mover para a esquerda', icon: 'chevronLeft', disabled: index === 0, onClick: () => store.moveColumn(columnId, index - 1) },
      { label: 'Mover para a direita', icon: 'chevronRight', disabled: index === board.columns.length - 1, onClick: () => store.moveColumn(columnId, index + 1) },
      'divider',
      { label: 'Arquivar todas as tarefas', icon: 'archive', onClick: () => archiveColumnTasks(columnId) },
      { label: 'Excluir coluna', icon: 'trash', danger: true, onClick: () => deleteColumn(columnId) },
    ], { align: 'end' });
  }

  function openColumnColorPicker(anchor, columnId) {
    const board = store.getActiveBoard();
    const column = domain.getColumn(board, columnId);
    const popover = App.popover.open(anchor, {
      content: `<div class="popover__section"><strong class="small">Cor da coluna</strong>${App.ui.colorSwatches('column-color', column.color)}</div>`,
      align: 'end',
    });
    if (!popover) return;
    popover.el.addEventListener('change', (event) => {
      store.updateColumn(columnId, { color: event.target.value });
      popover.close();
    });
  }

  /* ---------- Quadros ---------- */

  function openCreateBoard() {
    const modal = App.modal.open({
      title: 'Novo quadro',
      size: 'md',
      content: `
        <form class="form" data-board-form novalidate>
          <label class="field">
            <span class="field__label">Nome do quadro *</span>
            <input class="input" name="name" maxlength="80" placeholder="Ex.: Campanha de fim de ano" autocomplete="off" required>
          </label>
          <label class="field">
            <span class="field__label">Descrição</span>
            <textarea class="input" name="description" rows="2" maxlength="500" placeholder="Objetivo do quadro (opcional)"></textarea>
          </label>
          <div class="field">
            <span class="field__label">Modelo</span>
            <div class="template-grid">
              ${TEMPLATES.map((template, index) => `
                <label class="template-option">
                  <input type="radio" name="template" value="${template.id}" ${index === 0 ? 'checked' : ''}>
                  <span class="template-option__body">
                    <strong>${esc(template.name)}</strong>
                    <span class="muted small">${esc(template.description)}</span>
                    <span class="template-option__columns">
                      ${template.columns.map((column) => `<span style="--dot: ${column.color}">${esc(column.name)}</span>`).join('')}
                    </span>
                  </span>
                </label>`).join('')}
            </div>
          </div>
          <div class="field">
            <span class="field__label">Cor</span>
            ${App.ui.colorSwatches('color', COLORS[6].value)}
          </div>
          <label class="check-row">
            <input type="checkbox" name="labels" checked>
            <span>Criar etiquetas padrão (Bug, Melhoria, Documentação, Pesquisa)</span>
          </label>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button>
        <button type="button" class="btn btn--primary" data-confirm>Criar quadro</button>
      `,
    });

    const form = modal.body.querySelector('form');
    const submit = () => {
      const name = form.elements.name.value.trim();
      if (!name) {
        form.elements.name.classList.add('is-invalid');
        form.elements.name.focus();
        return;
      }
      store.createBoard({
        name,
        description: form.elements.description.value,
        templateId: form.elements.template.value,
        color: form.elements.color.value,
        withDefaultLabels: form.elements.labels.checked,
      });
      App.filters.reset();
      modal.close();
      App.toast.success(`Quadro "${name}" criado.`);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submit();
    });
    form.elements.name.addEventListener('input', () => form.elements.name.classList.remove('is-invalid'));
    modal.footer.querySelector('[data-confirm]').addEventListener('click', submit);
  }

  function switchBoard(boardId) {
    if (store.getSettings().activeBoardId === boardId) return;
    App.filters.reset();
    store.updateSettings({ activeBoardId: boardId });
  }

  async function deleteBoard(boardId) {
    const board = store.getBoard(boardId);
    if (!board) return false;

    const taskCount = Object.keys(board.tasks).length;
    const confirmed = await App.dialogs.confirm({
      title: `Excluir o quadro "${board.name}"?`,
      message: `Todas as colunas e ${pluralize(taskCount, 'tarefa', 'tarefas')} deste quadro serão removidas.`,
      confirmLabel: 'Excluir quadro',
      danger: true,
    });
    if (!confirmed) return false;

    App.filters.reset();
    withUndo('Quadro excluído.', () => store.deleteBoard(boardId));
    return true;
  }

  function duplicateBoard(boardId) {
    const copy = store.duplicateBoard(boardId);
    if (copy) {
      App.filters.reset();
      App.toast.success(`Quadro duplicado como "${copy.name}".`);
    }
  }

  /* ---------- Importação e exportação ---------- */

  function exportJSON() {
    const data = store.exportData();
    const filename = `fluxo-backup-${todayISO()}.json`;
    downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
    App.toast.success('Backup exportado.');
  }

  async function importJSON(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await readFileAsText(file));
      const boards = Array.isArray(data.boards) ? data.boards.length : 0;
      const confirmed = await App.dialogs.confirm({
        title: 'Importar backup?',
        message: `O arquivo contém ${pluralize(boards, 'quadro', 'quadros')}. Os dados atuais serão substituídos (você pode desfazer logo em seguida).`,
        confirmLabel: 'Importar',
        danger: true,
      });
      if (!confirmed) return;

      App.filters.reset();
      withUndo('Backup importado com sucesso.', () => store.importData(data));
    } catch (error) {
      console.error(error);
      App.toast.error(error instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : error.message);
    }
  }

  /** CSV compatível com Excel em português (separador ";" e BOM UTF-8). */
  function exportCSV(boardId) {
    const board = store.getBoard(boardId);
    if (!board) return;

    const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['ID', 'Título', 'Status', 'Prioridade', 'Responsáveis', 'Etiquetas', 'Prazo', 'Checklist', 'Criada em', 'Concluída em', 'Arquivada', 'Descrição'];

    const rows = Object.values(board.tasks)
      .sort((a, b) => a.number - b.number)
      .map((task) => {
        const column = domain.getColumn(board, task.columnId);
        const progress = domain.getChecklistProgress(task);
        return [
          `#${task.number}`,
          task.title,
          column ? column.name : '',
          domain.getPriority(task.priority).label,
          task.assigneeIds.map((id) => store.getMember(id)?.name).filter(Boolean).join(', '),
          task.labelIds.map((id) => board.labels.find((label) => label.id === id)?.name).filter(Boolean).join(', '),
          task.dueDate ? formatDate(task.dueDate) : '',
          progress.total ? `${progress.done}/${progress.total}` : '',
          formatDateTime(task.createdAt),
          task.completedAt ? formatDateTime(task.completedAt) : '',
          task.archived ? 'Sim' : 'Não',
          task.description,
        ].map(cell).join(';');
      });

    const csv = `﻿${[header.map(cell).join(';'), ...rows].join('\r\n')}`;
    downloadFile(`${slugify(board.name)}-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
    App.toast.success('Planilha CSV exportada.');
  }

  /* ---------- Aparência ---------- */

  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    store.updateSettings({ theme: current === 'dark' ? 'light' : 'dark' });
  }

  App.actions = {
    quickCreateTask,
    moveTask,
    toggleTaskDone,
    archiveTask,
    deleteTask,
    duplicateTask,
    addColumn,
    renameColumn,
    setWipLimit,
    deleteColumn,
    archiveColumnTasks,
    openColumnMenu,
    openCreateBoard,
    switchBoard,
    deleteBoard,
    duplicateBoard,
    exportJSON,
    importJSON,
    exportCSV,
    toggleTheme,
  };
})(window.App);
