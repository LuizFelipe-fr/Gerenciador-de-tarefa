(function (App) {
  'use strict';

  const { escapeHtml: esc, formatDateTime, timeAgo, autoGrow, todayISO } = App.utils;
  const { PRIORITIES, TITLE_MAX_LENGTH } = App.config;
  const icon = App.icon;
  const ui = App.ui;
  const store = App.store;
  const domain = App.domain;

  let current = null; // { modal, taskId, tab }

  // Detalhes da tarefa

  function renderLayout(task, board) {
    return `
      <div class="task-detail">
        <div class="task-detail__main">
          <textarea class="task-detail__title" data-field="title" rows="1" maxlength="${TITLE_MAX_LENGTH}" aria-label="Título da tarefa">${esc(task.title)}</textarea>
          <div class="task-detail__crumb" data-region="crumb"></div>

          <section class="detail-section">
            <h3 class="detail-section__title">${icon('text')}Descrição</h3>
            <textarea class="input task-detail__description" data-field="description" rows="4"
              placeholder="Adicione mais detalhes, links ou critérios de aceite…">${esc(task.description)}</textarea>
          </section>

          <section class="detail-section">
            <h3 class="detail-section__title">${icon('checklist')}Checklist <span class="detail-section__aside" data-region="checklist-count"></span></h3>
            <div data-region="checklist"></div>
            <form class="inline-form" data-form="checklist">
              <input class="input input--sm" name="text" placeholder="Adicionar item…" maxlength="300" autocomplete="off" aria-label="Novo item da checklist">
              <button type="submit" class="btn btn--secondary btn--sm">Adicionar</button>
            </form>
          </section>

          <section class="detail-section">
            <div class="tabs" role="tablist">
              <button type="button" role="tab" class="tabs__item" data-tab="comments">${icon('message')}Comentários <span data-region="comment-count"></span></button>
              <button type="button" role="tab" class="tabs__item" data-tab="history">${icon('activity')}Histórico</button>
            </div>
            <div data-region="tab-content"></div>
          </section>
        </div>

        <aside class="task-detail__side">
          <label class="field">
            <span class="field__label">Status</span>
            <select class="input" data-field="columnId">
              ${board.columns.map((column) => `<option value="${column.id}" ${column.id === task.columnId ? 'selected' : ''}>${esc(column.name)}</option>`).join('')}
            </select>
          </label>

          <label class="field">
            <span class="field__label">Prioridade</span>
            <select class="input" data-field="priority">
              ${PRIORITIES.map((priority) => `<option value="${priority.id}" ${priority.id === task.priority ? 'selected' : ''}>${priority.label}</option>`).join('')}
            </select>
          </label>

          <div class="field">
            <span class="field__label">Prazo</span>
            <div class="date-field">
              <input type="date" class="input" data-field="dueDate" value="${task.dueDate || ''}" aria-label="Prazo">
              <button type="button" class="icon-btn icon-btn--sm" data-action="clear-due" aria-label="Remover prazo" title="Remover prazo">${icon('x')}</button>
            </div>
            <span class="field__hint" data-region="due-hint"></span>
          </div>

          <div class="field">
            <span class="field__label">Responsáveis</span>
            <div data-region="assignees"></div>
          </div>

          <div class="field">
            <span class="field__label">Etiquetas</span>
            <div data-region="labels"></div>
          </div>

          <div class="task-detail__actions">
            <button type="button" class="btn btn--secondary btn--block" data-action="toggle-done" data-region="done-button"></button>
            <button type="button" class="btn btn--ghost btn--block" data-action="duplicate">${icon('copy')}Duplicar</button>
            <button type="button" class="btn btn--ghost btn--block" data-action="archive" data-region="archive-button"></button>
            <button type="button" class="btn btn--ghost btn--block btn--danger-text" data-action="delete">${icon('trash')}Excluir</button>
          </div>

          <dl class="task-detail__meta" data-region="meta"></dl>
        </aside>
      </div>`;
  }

  function region(name) {
    return current.modal.body.querySelector(`[data-region="${name}"]`);
  }

  function renderChecklist(task) {
    const progress = domain.getChecklistProgress(task);
    region('checklist-count').textContent = progress.total ? `${progress.done}/${progress.total}` : '';
    region('checklist').innerHTML = progress.total
      ? `
        <div class="progress checklist__progress" aria-hidden="true"><span style="width: ${progress.percent}%"></span></div>
        <ul class="checklist">
          ${task.checklist.map((item, index) => `
            <li class="checklist__item ${item.done ? 'is-done' : ''}" data-item-id="${item.id}">
              <input type="checkbox" ${item.done ? 'checked' : ''} data-action="check-item" aria-label="Concluir item">
              <input class="checklist__text" value="${esc(item.text)}" data-action="edit-item" maxlength="300" aria-label="Texto do item">
              <span class="checklist__tools">
                <button type="button" class="icon-btn icon-btn--xs" data-action="item-up" aria-label="Mover para cima" ${index === 0 ? 'disabled' : ''}>${icon('chevronUp')}</button>
                <button type="button" class="icon-btn icon-btn--xs" data-action="item-down" aria-label="Mover para baixo" ${index === task.checklist.length - 1 ? 'disabled' : ''}>${icon('chevronDown')}</button>
                <button type="button" class="icon-btn icon-btn--xs" data-action="item-delete" aria-label="Excluir item">${icon('trash')}</button>
              </span>
            </li>`).join('')}
        </ul>`
      : '<p class="muted small">Divida a tarefa em etapas menores.</p>';
  }

  function renderTabs(task, board) {
    region('comment-count').textContent = task.comments.length ? `(${task.comments.length})` : '';
    current.modal.body.querySelectorAll('[data-tab]').forEach((tab) => {
      const active = tab.dataset.tab === current.tab;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    const content = region('tab-content');
    if (current.tab === 'comments') {
      const user = store.getCurrentUser();
      content.innerHTML = `
        <form class="comment-form" data-form="comment">
          ${user ? ui.avatar(user) : ''}
          <div class="comment-form__body">
            <textarea class="input" name="text" rows="2" placeholder="Escreva um comentário… (Ctrl+Enter para enviar)" aria-label="Novo comentário"></textarea>
            <button type="submit" class="btn btn--primary btn--sm">Comentar</button>
          </div>
        </form>
        ${task.comments.length ? `
          <ul class="comments">
            ${[...task.comments].reverse().map((comment) => {
              const author = store.getMember(comment.authorId);
              return `
                <li class="comment" data-comment-id="${comment.id}">
                  ${author ? ui.avatar(author) : `<span class="avatar avatar--ghost">${icon('user')}</span>`}
                  <div class="comment__body">
                    <div class="comment__header">
                      <strong>${esc(author ? author.name : 'Usuário removido')}</strong>
                      <span class="muted small" title="${esc(formatDateTime(comment.createdAt))}">${esc(timeAgo(comment.createdAt))}</span>
                      <button type="button" class="icon-btn icon-btn--xs comment__delete" data-action="delete-comment" aria-label="Excluir comentário">${icon('trash')}</button>
                    </div>
                    <div class="comment__text">${ui.richText(comment.text)}</div>
                  </div>
                </li>`;
            }).join('')}
          </ul>` : '<p class="muted small">Nenhum comentário ainda.</p>'}`;
      return;
    }

    const history = board.activity.filter((entry) => entry.taskId === task.id);
    content.innerHTML = history.length
      ? `<ul class="activity">
          ${history.map((entry) => {
            const member = store.getMember(entry.userId);
            return `
              <li class="activity__item">
                ${member ? ui.avatar(member, 'sm') : `<span class="avatar avatar--sm avatar--ghost">${icon('user')}</span>`}
                <p><strong>${esc(member ? member.name : 'Alguém')}</strong> ${esc(entry.text)}
                  <span class="activity__time" title="${esc(formatDateTime(entry.at))}">${esc(timeAgo(entry.at))}</span></p>
              </li>`;
          }).join('')}
        </ul>`
      : '<p class="muted small">Sem registros de histórico.</p>';
  }

  function renderSide(task, board) {
    const members = store.getState().members;
    const column = domain.getColumn(board, task.columnId);
    const done = domain.isTaskDone(task, board);

    region('crumb').innerHTML = `
      <span class="muted">#${task.number}</span> ·
      <span class="status-pill" style="--dot: ${column.color}">${esc(column.name)}</span>
      em <strong>${esc(board.name)}</strong>
      ${task.archived ? '<span class="tag-muted">Arquivada</span>' : ''}`;

    region('due-hint').textContent = domain.describeDue(task, board);
    region('due-hint').className = `field__hint due-text--${domain.getDueStatus(task, board) || 'none'}`;

    region('assignees').innerHTML = members.length
      ? `<div class="chip-picker">
          ${members.map((member) => {
            const selected = task.assigneeIds.includes(member.id);
            return `
              <button type="button" class="picker-chip ${selected ? 'is-selected' : ''}" data-action="toggle-assignee" data-member-id="${member.id}" aria-pressed="${selected}">
                ${ui.avatar(member, 'xs')}<span>${esc(member.name)}</span>${selected ? icon('check') : ''}
              </button>`;
          }).join('')}
        </div>`
      : '<p class="muted small">Cadastre membros em Configurações &gt; Equipe.</p>';

    region('labels').innerHTML = board.labels.length
      ? `<div class="chip-picker">
          ${board.labels.map((label) => {
            const selected = task.labelIds.includes(label.id);
            return `
              <button type="button" class="picker-chip picker-chip--label ${selected ? 'is-selected' : ''}" style="--label-color: ${label.color}"
                data-action="toggle-label" data-label-id="${label.id}" aria-pressed="${selected}">
                <span class="color-dot" style="--dot: ${label.color}"></span><span>${esc(label.name)}</span>${selected ? icon('check') : ''}
              </button>`;
          }).join('')}
          <button type="button" class="link-btn small" data-action="manage-labels">Gerenciar etiquetas</button>
        </div>`
      : '<button type="button" class="link-btn small" data-action="manage-labels">Criar etiquetas</button>';

    region('done-button').innerHTML = done ? `${icon('restore')}Reabrir tarefa` : `${icon('check')}Marcar como concluída`;
    region('archive-button').innerHTML = task.archived ? `${icon('restore')}Restaurar` : `${icon('archive')}Arquivar`;

    region('meta').innerHTML = `
      <div><dt>Criada</dt><dd title="${esc(formatDateTime(task.createdAt))}">${esc(timeAgo(task.createdAt))}</dd></div>
      <div><dt>Atualizada</dt><dd title="${esc(formatDateTime(task.updatedAt))}">${esc(timeAgo(task.updatedAt))}</dd></div>
      ${task.completedAt ? `<div><dt>Concluída</dt><dd>${esc(formatDateTime(task.completedAt))}</dd></div>` : ''}`;

    // Mantém os selects sincronizados (ex.: tarefa movida pelo botão "concluir").
    const statusSelect = current.modal.body.querySelector('[data-field="columnId"]');
    if (document.activeElement !== statusSelect) statusSelect.value = task.columnId;
  }

  /** Atualiza as regiões dinâmicas sem recriar os campos que o usuário edita. */
  function refresh() {
    if (!current) return;
    const board = store.getActiveBoard();
    const task = store.getTask(current.taskId);
    if (!task || !board) {
      current.modal.close();
      return;
    }
    renderChecklist(task);
    renderTabs(task, board);
    renderSide(task, board);
  }

  function saveTitle(textarea) {
    const value = textarea.value.replace(/\s+/g, ' ').trim();
    const task = store.getTask(current.taskId);
    if (!value) {
      textarea.value = task.title;
      autoGrow(textarea);
      return;
    }
    if (value !== task.title) store.updateTask(current.taskId, { title: value });
  }

  function bindEvents(body) {
    const taskId = current.taskId;

    body.addEventListener('input', (event) => {
      if (event.target.matches('textarea')) autoGrow(event.target);
    });

    body.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target.matches('[data-field="title"]') && event.key === 'Enter') {
        event.preventDefault();
        target.blur();
      }
      if (target.matches('[data-action="edit-item"]') && event.key === 'Enter') {
        event.preventDefault();
        target.blur();
      }
      if (target.closest('[data-form="comment"]') && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        target.closest('form').requestSubmit();
      }
    });

    body.addEventListener('focusout', (event) => {
      const target = event.target;
      if (target.matches('[data-field="title"]')) saveTitle(target);
      if (target.matches('[data-field="description"]')) {
        const task = store.getTask(taskId);
        if (task && target.value !== task.description) store.updateTask(taskId, { description: target.value });
      }
      if (target.matches('[data-action="edit-item"]')) {
        const itemId = target.closest('[data-item-id]').dataset.itemId;
        if (target.value.trim()) store.updateChecklistItem(taskId, itemId, { text: target.value });
      }
    });

    body.addEventListener('change', (event) => {
      const target = event.target;
      if (target.matches('[data-field="columnId"]')) App.actions.moveTask(taskId, target.value);
      if (target.matches('[data-field="priority"]')) store.updateTask(taskId, { priority: target.value });
      if (target.matches('[data-field="dueDate"]')) store.updateTask(taskId, { dueDate: target.value || null });
      if (target.matches('[data-action="check-item"]')) {
        const itemId = target.closest('[data-item-id]').dataset.itemId;
        store.updateChecklistItem(taskId, itemId, { done: target.checked });
      }
    });

    body.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      const input = form.elements.text;
      if (!input.value.trim()) {
        input.focus();
        return;
      }
      if (form.dataset.form === 'checklist') store.addChecklistItem(taskId, input.value);
      if (form.dataset.form === 'comment') store.addComment(taskId, input.value);
      input.value = '';
      // O formulário de comentário é recriado ao atualizar a aba; devolve o foco.
      const refocus = body.querySelector(`[data-form="${form.dataset.form}"] [name="text"]`);
      if (refocus) refocus.focus();
    });

    body.addEventListener('click', async (event) => {
      const tab = event.target.closest('[data-tab]');
      if (tab) {
        current.tab = tab.dataset.tab;
        refresh();
        return;
      }

      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      const itemId = actionEl.closest('[data-item-id]')?.dataset.itemId;

      switch (actionEl.dataset.action) {
        case 'clear-due':
          body.querySelector('[data-field="dueDate"]').value = '';
          store.updateTask(taskId, { dueDate: null });
          break;
        case 'toggle-assignee':
          store.toggleTaskAssignee(taskId, actionEl.dataset.memberId);
          break;
        case 'toggle-label':
          store.toggleTaskLabel(taskId, actionEl.dataset.labelId);
          break;
        case 'manage-labels':
          App.boardSettings.open(store.getSettings().activeBoardId, 'labels');
          break;
        case 'item-up':
          store.moveChecklistItem(taskId, itemId, -1);
          break;
        case 'item-down':
          store.moveChecklistItem(taskId, itemId, 1);
          break;
        case 'item-delete':
          store.deleteChecklistItem(taskId, itemId);
          break;
        case 'delete-comment': {
          const commentId = actionEl.closest('[data-comment-id]').dataset.commentId;
          const ok = await App.dialogs.confirm({ title: 'Excluir comentário?', confirmLabel: 'Excluir', danger: true });
          if (ok) store.deleteComment(taskId, commentId);
          break;
        }
        case 'toggle-done':
          App.actions.toggleTaskDone(taskId);
          break;
        case 'duplicate': {
          const copy = store.duplicateTask(taskId);
          if (copy) {
            App.toast.success('Tarefa duplicada.');
            open(copy.id);
          }
          break;
        }
        case 'archive': {
          const task = store.getTask(taskId);
          if (task.archived) {
            store.setTaskArchived(taskId, false);
            App.toast.success('Tarefa restaurada.');
          } else {
            current.modal.close();
            App.actions.archiveTask(taskId);
          }
          break;
        }
        case 'delete':
          if (await App.actions.deleteTask(taskId) && current) current.modal.close();
          break;
        default:
          break;
      }
    });
  }

  function open(taskId) {
    const board = store.getActiveBoard();
    const task = store.getTask(taskId);
    if (!task || !board) return;

    if (current) current.modal.close();

    const modal = App.modal.open({
      title: `Tarefa #${task.number}`,
      size: 'lg',
      className: 'modal--task',
      content: renderLayout(task, board),
      initialFocus: '.modal__close',
      onClose: () => {
        // Salva campos com foco antes de fechar (título/descrição).
        const active = modal.body.querySelector(':focus');
        if (active) active.blur();
        if (current && current.modal === modal) current = null;
      },
    });

    current = { modal, taskId, tab: 'comments' };
    bindEvents(modal.body);
    refresh();
    modal.body.querySelectorAll('textarea').forEach(autoGrow);
  }

  // Criação de tarefa

  function openCreate(columnId = null, defaults = {}) {
    const board = store.getActiveBoard();
    if (!board) {
      App.toast.info('Crie um quadro antes de adicionar tarefas.');
      return;
    }
    const targetColumnId = columnId || board.columns[0].id;
    const members = store.getState().members;
    const currentUserId = store.getSettings().currentUserId;

    const modal = App.modal.open({
      title: 'Nova tarefa',
      size: 'md',
      content: `
        <form class="form" data-create-form novalidate>
          <label class="field">
            <span class="field__label">Título *</span>
            <input class="input" name="title" maxlength="${TITLE_MAX_LENGTH}" value="${esc(defaults.title || '')}" placeholder="O que precisa ser feito?" autocomplete="off">
          </label>
          <label class="field">
            <span class="field__label">Descrição</span>
            <textarea class="input" name="description" rows="3" placeholder="Detalhes, links, critérios de aceite…"></textarea>
          </label>
          <div class="form__row">
            <label class="field">
              <span class="field__label">Status</span>
              <select class="input" name="columnId">
                ${board.columns.map((column) => `<option value="${column.id}" ${column.id === targetColumnId ? 'selected' : ''}>${esc(column.name)}</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span class="field__label">Prioridade</span>
              <select class="input" name="priority">
                ${PRIORITIES.map((priority) => `<option value="${priority.id}" ${priority.id === App.config.DEFAULT_PRIORITY ? 'selected' : ''}>${priority.label}</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span class="field__label">Prazo</span>
              <input type="date" class="input" name="dueDate" min="${todayISO()}">
            </label>
          </div>
          ${members.length ? `
            <fieldset class="field">
              <legend class="field__label">Responsáveis</legend>
              <div class="chip-picker">
                ${members.map((member) => `
                  <label class="picker-chip picker-chip--check">
                    <input type="checkbox" name="assignees" value="${member.id}" ${member.id === defaults.assigneeId ? 'checked' : ''}>
                    ${ui.avatar(member, 'xs')}<span>${esc(member.name)}${member.id === currentUserId ? ' (você)' : ''}</span>
                  </label>`).join('')}
              </div>
            </fieldset>` : ''}
          ${board.labels.length ? `
            <fieldset class="field">
              <legend class="field__label">Etiquetas</legend>
              <div class="chip-picker">
                ${board.labels.map((label) => `
                  <label class="picker-chip picker-chip--check" style="--label-color: ${label.color}">
                    <input type="checkbox" name="labels" value="${label.id}">
                    <span class="color-dot" style="--dot: ${label.color}"></span><span>${esc(label.name)}</span>
                  </label>`).join('')}
              </div>
            </fieldset>` : ''}
          <label class="check-row">
            <input type="checkbox" name="openAfter">
            <span>Abrir a tarefa após criar (para adicionar checklist e comentários)</span>
          </label>
        </form>`,
      footer: `
        <button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button>
        <button type="button" class="btn btn--primary" data-confirm>${icon('plus')}Criar tarefa</button>`,
    });

    const form = modal.body.querySelector('form');
    const checkedValues = (name) => [...form.querySelectorAll(`[name="${name}"]:checked`)].map((input) => input.value);

    const submit = () => {
      const title = form.elements.title.value.trim();
      if (!title) {
        form.elements.title.classList.add('is-invalid');
        form.elements.title.focus();
        return;
      }
      const task = store.createTask(form.elements.columnId.value, {
        title,
        description: form.elements.description.value,
        priority: form.elements.priority.value,
        dueDate: form.elements.dueDate.value || null,
        assigneeIds: checkedValues('assignees'),
        labelIds: checkedValues('labels'),
      });
      const openAfter = form.elements.openAfter.checked;
      modal.close();
      if (!task) return;

      App.toast.success('Tarefa criada.', { action: openAfter ? null : { label: 'Abrir', onClick: () => open(task.id) } });
      if (openAfter) open(task.id);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submit();
    });
    form.addEventListener('keydown', (event) => {
      const isTitle = event.target === form.elements.title;
      if (event.key === 'Enter' && (isTitle || event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submit();
      }
    });
    form.elements.title.addEventListener('input', () => form.elements.title.classList.remove('is-invalid'));
    modal.footer.querySelector('[data-confirm]').addEventListener('click', submit);
  }

  App.taskModal = {
    open,
    openCreate,
    refresh,
    close: () => current && current.modal.close(),
    isOpen: () => Boolean(current),
  };
})(window.App);
