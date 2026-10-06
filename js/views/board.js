/**
 * Visualização em quadro (Kanban).
 *
 * - Arrastar e soltar tarefas entre colunas e reordenar colunas (HTML5 DnD).
 * - Criação rápida de tarefas no rodapé de cada coluna.
 * - Navegação e movimentação pelo teclado (Alt + setas).
 * - Animação FLIP ao reposicionar os cartões após cada renderização.
 */
(function (App) {
  'use strict';

  const { escapeHtml: esc, pluralize, prefersReducedMotion } = App.utils;
  const icon = App.icon;
  const ui = App.ui;
  const domain = App.domain;

  let root = null;
  let quickAddColumnId = null;
  let drag = null;           // { type: 'task' | 'column', id, height }
  let placeholder = null;    // elemento que indica onde a tarefa vai cair
  let focusAfterRender = null;

  /* =========================================================
   * Renderização
   * ========================================================= */

  function renderCard(task, board) {
    const labels = task.labelIds.map((id) => board.labels.find((label) => label.id === id)).filter(Boolean);
    const assignees = task.assigneeIds.map((id) => App.store.getMember(id)).filter(Boolean);
    const progress = domain.getChecklistProgress(task);
    const done = domain.isTaskDone(task, board);
    const dueStatus = domain.getDueStatus(task, board);

    const meta = [
      ui.priorityBadge(task.priority, { compact: true }),
      ui.dueBadge(task, board),
      progress.total
        ? `<span class="badge ${progress.done === progress.total ? 'badge--complete' : ''}" title="Checklist">${icon('checklist')}<span>${progress.done}/${progress.total}</span></span>`
        : '',
      task.comments.length ? `<span class="badge" title="Comentários">${icon('message')}<span>${task.comments.length}</span></span>` : '',
      task.description.trim() ? `<span class="badge badge--icon" title="Possui descrição">${icon('text')}</span>` : '',
    ].join('');

    return `
      <article class="card priority-edge--${task.priority} ${done ? 'is-done' : ''} ${dueStatus === 'overdue' ? 'is-overdue' : ''}"
        draggable="true" tabindex="0" data-task-id="${task.id}"
        aria-label="${esc(task.title)}, prioridade ${esc(domain.getPriority(task.priority).label)}${task.dueDate ? `, ${esc(domain.describeDue(task, board))}` : ''}">
        ${labels.length ? `<div class="card__labels">${labels.map((label) => ui.labelChip(label)).join('')}</div>` : ''}
        <div class="card__title-row">
          <button type="button" class="card__check ${done ? 'is-checked' : ''}" data-action="toggle-done"
            aria-label="${done ? 'Reabrir tarefa' : 'Concluir tarefa'}" title="${done ? 'Reabrir' : 'Concluir'}">${icon('check')}</button>
          <h3 class="card__title">${esc(task.title)}</h3>
        </div>
        ${progress.total ? `<div class="progress progress--thin" aria-hidden="true"><span style="width: ${progress.percent}%"></span></div>` : ''}
        <footer class="card__footer">
          <div class="card__meta">
            <span class="card__number">#${task.number}</span>
            ${meta}
          </div>
          ${ui.avatarStack(assignees)}
        </footer>
      </article>`;
  }

  function renderQuickAdd(column) {
    if (quickAddColumnId !== column.id) {
      return `
        <button type="button" class="quick-add__trigger" data-action="quick-add" data-column-id="${column.id}">
          ${icon('plus')}<span>Adicionar tarefa</span>
        </button>`;
    }
    return `
      <form class="quick-add" data-quick-add="${column.id}">
        <textarea class="input quick-add__input" rows="2" maxlength="${App.config.TITLE_MAX_LENGTH}"
          placeholder="Título da tarefa… (Enter para salvar)" aria-label="Título da nova tarefa"></textarea>
        <div class="quick-add__actions">
          <button type="submit" class="btn btn--primary btn--sm">Adicionar</button>
          <button type="button" class="icon-btn icon-btn--sm" data-action="quick-add-cancel" aria-label="Cancelar">${icon('x')}</button>
          <button type="button" class="link-btn quick-add__more" data-action="quick-add-details" data-column-id="${column.id}">Mais detalhes…</button>
        </div>
      </form>`;
  }

  function renderColumn(column, board) {
    const allTasks = column.taskIds.map((id) => board.tasks[id]).filter((task) => task && !task.archived);
    const visible = allTasks.filter((task) => App.filters.matches(task, board));
    const isFiltered = visible.length !== allTasks.length;
    const overLimit = column.wipLimit > 0 && allTasks.length > column.wipLimit;
    const atLimit = column.wipLimit > 0 && allTasks.length === column.wipLimit;

    const count = column.wipLimit
      ? `${allTasks.length}/${column.wipLimit}`
      : isFiltered ? `${visible.length}/${allTasks.length}` : `${allTasks.length}`;

    return `
      <section class="column ${overLimit ? 'is-over-limit' : ''}" data-column-id="${column.id}" style="--column-color: ${column.color}"
        aria-label="Coluna ${esc(column.name)}, ${pluralize(allTasks.length, 'tarefa', 'tarefas')}">
        <header class="column__header" draggable="true" title="Arraste para reordenar a coluna">
          <span class="column__dot"></span>
          <h2 class="column__title" data-action="rename-column" title="Clique duas vezes para renomear">${esc(column.name)}</h2>
          ${column.isDone ? `<span class="column__done-flag" title="Coluna de conclusão">${icon('success')}</span>` : ''}
          <span class="column__count ${overLimit ? 'is-over' : atLimit ? 'is-at' : ''}"
            title="${column.wipLimit ? `Limite de WIP: ${column.wipLimit}` : 'Quantidade de tarefas'}">${count}</span>
          <button type="button" class="icon-btn icon-btn--sm column__menu" data-action="column-menu" aria-label="Opções da coluna ${esc(column.name)}" aria-haspopup="menu">
            ${icon('more')}
          </button>
        </header>
        ${overLimit ? `<div class="column__alert">${icon('alert')}Limite de WIP excedido</div>` : ''}
        <div class="column__body" data-drop-column="${column.id}">
          ${visible.map((task) => renderCard(task, board)).join('')}
          ${visible.length === 0 ? `<div class="column__empty">${isFiltered ? 'Nenhuma tarefa corresponde aos filtros' : 'Solte tarefas aqui'}</div>` : ''}
        </div>
        <footer class="column__footer">${renderQuickAdd(column)}</footer>
      </section>`;
  }

  function render() {
    const board = App.store.getActiveBoard();
    if (!board) return;

    // Guarda posição de rolagem e dos cartões antes de recriar o HTML.
    const boardEl = root.querySelector('.board');
    const scrollLeft = boardEl ? boardEl.scrollLeft : 0;
    const columnScroll = {};
    root.querySelectorAll('.column__body').forEach((body) => {
      columnScroll[body.dataset.dropColumn] = body.scrollTop;
    });
    const previousRects = measureCards();
    const quickAddDraft = root.querySelector('.quick-add__input')?.value || '';

    root.innerHTML = `
      <div class="board">
        ${board.columns.map((column) => renderColumn(column, board)).join('')}
        <button type="button" class="column-add" data-action="add-column">${icon('plus')}<span>Nova coluna</span></button>
      </div>`;

    const newBoardEl = root.querySelector('.board');
    newBoardEl.scrollLeft = scrollLeft;
    root.querySelectorAll('.column__body').forEach((body) => {
      body.scrollTop = columnScroll[body.dataset.dropColumn] || 0;
    });

    animateCards(previousRects);

    const quickInput = root.querySelector('.quick-add__input');
    if (quickInput) {
      quickInput.value = quickAddDraft;
      quickInput.focus();
    }

    if (focusAfterRender) {
      const card = root.querySelector(`[data-task-id="${focusAfterRender}"]`);
      if (card) {
        card.focus({ preventScroll: false });
        card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      focusAfterRender = null;
    }
  }

  /* =========================================================
   * Animação FLIP
   * ========================================================= */

  function measureCards() {
    const rects = new Map();
    root.querySelectorAll('.card[data-task-id]').forEach((card) => {
      rects.set(card.dataset.taskId, card.getBoundingClientRect());
    });
    return rects;
  }

  function animateCards(previousRects) {
    if (!previousRects.size || prefersReducedMotion()) return;

    root.querySelectorAll('.card[data-task-id]').forEach((card) => {
      const before = previousRects.get(card.dataset.taskId);
      if (!before) return;
      const after = card.getBoundingClientRect();
      const deltaX = before.left - after.left;
      const deltaY = before.top - after.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      card.animate(
        [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
      );
    });
  }

  /* =========================================================
   * Criação rápida
   * ========================================================= */

  function openQuickAdd(columnId) {
    quickAddColumnId = columnId;
    render();
    const body = root.querySelector(`[data-drop-column="${columnId}"]`);
    if (body) body.scrollTop = body.scrollHeight;
  }

  function closeQuickAdd() {
    if (!quickAddColumnId) return;
    const input = root.querySelector('.quick-add__input');
    if (input) input.value = '';
    quickAddColumnId = null;
    render();
  }

  function submitQuickAdd(form) {
    const input = form.querySelector('.quick-add__input');
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return;
    }
    input.value = '';
    App.actions.quickCreateTask(form.dataset.quickAdd, title);
    const body = root.querySelector(`[data-drop-column="${form.dataset.quickAdd}"]`);
    if (body) body.scrollTop = body.scrollHeight;
  }

  /* =========================================================
   * Renomear coluna inline
   * ========================================================= */

  function startRenameColumn(titleEl) {
    const columnId = titleEl.closest('[data-column-id]').dataset.columnId;
    const input = document.createElement('input');
    input.className = 'input input--sm column__title-input';
    input.value = titleEl.textContent.trim();
    input.maxLength = 60;
    input.setAttribute('aria-label', 'Nome da coluna');
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (save) => {
      if (finished) return;
      finished = true;
      if (save && input.value.trim()) App.store.updateColumn(columnId, { name: input.value });
      else render();
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(true);
      if (event.key === 'Escape') {
        event.stopPropagation();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  }

  /* =========================================================
   * Arrastar e soltar
   * ========================================================= */

  function getPlaceholder(height) {
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'card-placeholder';
    }
    placeholder.style.height = `${height}px`;
    return placeholder;
  }

  /** Primeiro cartão cujo centro está abaixo do cursor. */
  function getCardAfter(list, y) {
    const cards = [...list.querySelectorAll('.card:not(.is-dragging)')];
    return cards.find((card) => {
      const rect = card.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    }) || null;
  }

  function clearColumnIndicators() {
    root.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
  }

  function cleanupDrag() {
    if (placeholder) placeholder.remove();
    clearColumnIndicators();
    root.querySelectorAll('.is-dragging, .is-drop-target').forEach((el) => el.classList.remove('is-dragging', 'is-drop-target'));
    root.classList.remove('is-dragging-task', 'is-dragging-column');
    drag = null;
  }

  function onDragStart(event) {
    const card = event.target.closest('.card[data-task-id]');
    const header = event.target.closest('.column__header');

    if (card) {
      drag = { type: 'task', id: card.dataset.taskId, height: card.offsetHeight };
      event.dataTransfer.setData('text/plain', card.dataset.taskId);
      event.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(() => {
        card.classList.add('is-dragging');
        root.classList.add('is-dragging-task');
      });
    } else if (header) {
      const column = header.closest('.column');
      drag = { type: 'column', id: column.dataset.columnId };
      event.dataTransfer.setData('text/plain', column.dataset.columnId);
      event.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(() => {
        column.classList.add('is-dragging');
        root.classList.add('is-dragging-column');
      });
    }
  }

  function onDragOver(event) {
    if (!drag) return;

    if (drag.type === 'task') {
      const column = event.target.closest('.column');
      if (!column) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      const list = column.querySelector('.column__body');
      root.querySelectorAll('.is-drop-target').forEach((el) => el !== column && el.classList.remove('is-drop-target'));
      column.classList.add('is-drop-target');

      const after = getCardAfter(list, event.clientY);
      const ph = getPlaceholder(drag.height);
      const empty = list.querySelector('.column__empty');
      if (empty) empty.hidden = true;

      if (after) {
        if (after.previousElementSibling !== ph) list.insertBefore(ph, after);
      } else if (list.lastElementChild !== ph) {
        list.appendChild(ph);
      }
      return;
    }

    if (drag.type === 'column') {
      const column = event.target.closest('.column');
      if (!column || column.dataset.columnId === drag.id) {
        clearColumnIndicators();
        if (column) event.preventDefault();
        return;
      }
      event.preventDefault();
      const rect = column.getBoundingClientRect();
      const before = event.clientX < rect.left + rect.width / 2;
      clearColumnIndicators();
      column.classList.add(before ? 'drop-before' : 'drop-after');
    }
  }

  function onDrop(event) {
    if (!drag) return;
    event.preventDefault();

    if (drag.type === 'task' && placeholder && placeholder.isConnected) {
      const list = placeholder.closest('.column__body');
      let next = placeholder.nextElementSibling;
      while (next && (!next.matches('.card') || next.classList.contains('is-dragging'))) {
        next = next.nextElementSibling;
      }
      const taskId = drag.id;
      const columnId = list.dataset.dropColumn;
      const beforeTaskId = next ? next.dataset.taskId : null;
      cleanupDrag();
      if (beforeTaskId !== taskId) App.actions.moveTask(taskId, columnId, beforeTaskId);
      else render();
      return;
    }

    if (drag.type === 'column') {
      const target = root.querySelector('.drop-before, .drop-after');
      if (target) {
        const board = App.store.getActiveBoard();
        const ids = board.columns.map((column) => column.id);
        const from = ids.indexOf(drag.id);
        let to = ids.indexOf(target.dataset.columnId) + (target.classList.contains('drop-after') ? 1 : 0);
        if (from < to) to -= 1;
        const columnId = drag.id;
        cleanupDrag();
        App.store.moveColumn(columnId, to);
        return;
      }
    }

    cleanupDrag();
  }

  function onDragLeave(event) {
    // Remove o placeholder quando o cursor sai completamente do quadro.
    if (drag && drag.type === 'task' && !root.contains(event.relatedTarget)) {
      if (placeholder) placeholder.remove();
      root.querySelectorAll('.column__empty').forEach((el) => { el.hidden = false; });
      root.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    }
  }

  /* =========================================================
   * Teclado
   * ========================================================= */

  function onKeyDown(event) {
    const card = event.target.closest('.card[data-task-id]');

    if (event.target.matches('.quick-add__input')) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitQuickAdd(event.target.closest('form'));
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        closeQuickAdd();
      }
      return;
    }

    if (!card || event.target !== card) return;
    const taskId = card.dataset.taskId;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      App.taskModal.open(taskId);
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      App.actions.deleteTask(taskId);
      return;
    }

    const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!arrows.includes(event.key)) return;
    event.preventDefault();

    if (event.altKey) moveWithKeyboard(taskId, event.key);
    else focusNeighbor(card, event.key);
  }

  function moveWithKeyboard(taskId, key) {
    const board = App.store.getActiveBoard();
    const task = board.tasks[taskId];
    const columnIndex = board.columns.findIndex((column) => column.id === task.columnId);
    const column = board.columns[columnIndex];
    focusAfterRender = taskId;

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const target = board.columns[columnIndex + (key === 'ArrowLeft' ? -1 : 1)];
      if (target) App.actions.moveTask(taskId, target.id);
      return;
    }

    const ids = column.taskIds.filter((id) => !board.tasks[id].archived);
    const index = ids.indexOf(taskId);
    if (key === 'ArrowUp' && index > 0) {
      App.actions.moveTask(taskId, column.id, ids[index - 1]);
    } else if (key === 'ArrowDown' && index < ids.length - 1) {
      App.actions.moveTask(taskId, column.id, ids[index + 2] || null);
    }
  }

  function focusNeighbor(card, key) {
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const sibling = key === 'ArrowUp' ? card.previousElementSibling : card.nextElementSibling;
      if (sibling && sibling.matches('.card')) sibling.focus();
      return;
    }

    const column = card.closest('.column');
    const targetColumn = key === 'ArrowLeft' ? column.previousElementSibling : column.nextElementSibling;
    if (!targetColumn || !targetColumn.matches('.column')) return;
    const cards = [...targetColumn.querySelectorAll('.card')];
    const index = [...column.querySelectorAll('.card')].indexOf(card);
    const target = cards[Math.min(index, cards.length - 1)];
    if (target) target.focus();
  }

  /* =========================================================
   * Cliques
   * ========================================================= */

  function onClick(event) {
    const actionEl = event.target.closest('[data-action]');
    const card = event.target.closest('.card[data-task-id]');

    if (actionEl) {
      const columnId = actionEl.dataset.columnId || actionEl.closest('[data-column-id]')?.dataset.columnId;
      switch (actionEl.dataset.action) {
        case 'toggle-done':
          event.stopPropagation();
          App.actions.toggleTaskDone(card.dataset.taskId);
          return;
        case 'quick-add':
          openQuickAdd(columnId);
          return;
        case 'quick-add-cancel':
          closeQuickAdd();
          return;
        case 'quick-add-details': {
          const title = root.querySelector('.quick-add__input')?.value.trim() || '';
          closeQuickAdd();
          App.taskModal.openCreate(columnId, { title });
          return;
        }
        case 'column-menu':
          App.actions.openColumnMenu(actionEl, columnId);
          return;
        case 'add-column':
          App.actions.addColumn();
          return;
        default:
          break;
      }
    }

    if (card) App.taskModal.open(card.dataset.taskId);
  }

  /** Menu de contexto (clique direito) com as ações rápidas do cartão. */
  function openCardMenu(anchor, taskId) {
    const board = App.store.getActiveBoard();
    const task = board && board.tasks[taskId];
    if (!task) return;
    const done = domain.isTaskDone(task, board);

    App.popover.menu(anchor, [
      { label: 'Abrir', icon: 'edit', onClick: () => App.taskModal.open(taskId) },
      { label: done ? 'Reabrir tarefa' : 'Marcar como concluída', icon: done ? 'restore' : 'success', onClick: () => App.actions.toggleTaskDone(taskId) },
      { label: 'Duplicar', icon: 'copy', onClick: () => App.actions.duplicateTask(taskId) },
      'divider',
      { label: 'Arquivar', icon: 'archive', onClick: () => App.actions.archiveTask(taskId) },
      { label: 'Excluir', icon: 'trash', danger: true, onClick: () => App.actions.deleteTask(taskId) },
    ]);
  }

  function mount(element) {
    root = element;
    root.classList.add('view--board');
    quickAddColumnId = null;

    root.addEventListener('click', onClick);
    root.addEventListener('contextmenu', (event) => {
      const card = event.target.closest('.card[data-task-id]');
      if (!card) return;
      event.preventDefault();
      openCardMenu(card, card.dataset.taskId);
    });
    root.addEventListener('dblclick', (event) => {
      const title = event.target.closest('.column__title');
      if (title) startRenameColumn(title);
    });
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('submit', (event) => {
      if (event.target.matches('[data-quick-add]')) {
        event.preventDefault();
        submitQuickAdd(event.target);
      }
    });
    root.addEventListener('focusout', (event) => {
      // Fecha a criação rápida ao sair dela sem texto.
      const form = event.target.closest('[data-quick-add]');
      if (form && !form.contains(event.relatedTarget) && !form.querySelector('.quick-add__input').value.trim()) {
        setTimeout(() => {
          if (quickAddColumnId && !root.querySelector('.quick-add')?.contains(document.activeElement)) closeQuickAdd();
        }, 120);
      }
    });

    root.addEventListener('dragstart', onDragStart);
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
    root.addEventListener('dragleave', onDragLeave);
    root.addEventListener('dragend', () => {
      if (drag) {
        cleanupDrag();
        render();
      }
    });
  }

  function isInteracting() {
    return Boolean(drag) || Boolean(root && root.querySelector('.column__title-input'));
  }

  App.views = App.views || {};
  App.views.board = { mount, render, isInteracting, openQuickAdd };
})(window.App);
