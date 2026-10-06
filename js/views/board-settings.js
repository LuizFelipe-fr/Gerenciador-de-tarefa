(function (App) {
  'use strict';

  const { escapeHtml: esc, timeAgo, pluralize } = App.utils;
  const { COLORS } = App.config;
  const icon = App.icon;
  const ui = App.ui;
  const store = App.store;
  const domain = App.domain;

  const TABS = [
    { id: 'general', label: 'Geral', icon: 'settings' },
    { id: 'labels', label: 'Etiquetas', icon: 'tag' },
    { id: 'archived', label: 'Arquivadas', icon: 'archive' },
  ];

  function renderGeneral(board) {
    return `
      <form class="form" data-form="general" novalidate>
        <label class="field">
          <span class="field__label">Nome do quadro</span>
          <input class="input" name="name" value="${esc(board.name)}" maxlength="80" autocomplete="off">
        </label>
        <label class="field">
          <span class="field__label">Descrição</span>
          <textarea class="input" name="description" rows="3" maxlength="500">${esc(board.description)}</textarea>
        </label>
        <div class="field">
          <span class="field__label">Cor</span>
          ${ui.colorSwatches('color', board.color)}
        </div>
        <div class="form__actions">
          <button type="submit" class="btn btn--primary">Salvar alterações</button>
        </div>
      </form>

      <div class="danger-zone">
        <div>
          <strong>Excluir quadro</strong>
          <p class="muted small">Remove o quadro, suas colunas e ${pluralize(Object.keys(board.tasks).length, 'tarefa', 'tarefas')}.</p>
        </div>
        <button type="button" class="btn btn--danger" data-action="delete-board">${icon('trash')}Excluir</button>
      </div>`;
  }

  function renderLabels(board) {
    const usage = (labelId) => Object.values(board.tasks).filter((task) => task.labelIds.includes(labelId)).length;
    const nextColor = COLORS[board.labels.length % COLORS.length].value;

    return `
      <p class="muted small">As etiquetas ajudam a categorizar e filtrar tarefas deste quadro.</p>
      <ul class="settings-list">
        ${board.labels.map((label) => `
          <li class="settings-list__item" data-label-id="${label.id}">
            <button type="button" class="swatch-btn" style="--swatch: ${label.color}" data-action="label-color" aria-label="Alterar cor da etiqueta"></button>
            <input class="input input--sm" value="${esc(label.name)}" maxlength="40" data-action="label-name" aria-label="Nome da etiqueta">
            <span class="muted small nowrap">${pluralize(usage(label.id), 'tarefa', 'tarefas')}</span>
            <button type="button" class="icon-btn icon-btn--sm" data-action="label-delete" aria-label="Excluir etiqueta">${icon('trash')}</button>
          </li>`).join('')}
      </ul>
      ${board.labels.length === 0 ? '<p class="muted small">Nenhuma etiqueta criada.</p>' : ''}
      <form class="inline-form" data-form="label">
        <button type="button" class="swatch-btn" style="--swatch: ${nextColor}" data-action="new-label-color" data-color="${nextColor}" aria-label="Cor da nova etiqueta"></button>
        <input class="input input--sm" name="name" placeholder="Nova etiqueta…" maxlength="40" autocomplete="off" aria-label="Nome da nova etiqueta">
        <button type="submit" class="btn btn--secondary btn--sm">${icon('plus')}Adicionar</button>
      </form>`;
  }

  function renderArchived(board) {
    const tasks = domain.getArchivedTasks(board);
    if (!tasks.length) {
      return ui.emptyState({ iconName: 'archive', title: 'Nenhuma tarefa arquivada', text: 'Tarefas arquivadas saem do quadro, mas continuam guardadas aqui.' });
    }
    return `
      <ul class="settings-list">
        ${tasks.map((task) => {
          const column = domain.getColumn(board, task.columnId);
          return `
            <li class="settings-list__item" data-task-id="${task.id}">
              <div class="settings-list__main">
                <button type="button" class="link-btn" data-action="open-task">${esc(task.title)}</button>
                <span class="muted small">#${task.number} · ${esc(column.name)} · arquivada ${esc(timeAgo(task.updatedAt))}</span>
              </div>
              <button type="button" class="btn btn--secondary btn--sm" data-action="restore-task">${icon('restore')}Restaurar</button>
              <button type="button" class="icon-btn icon-btn--sm" data-action="delete-task" aria-label="Excluir permanentemente">${icon('trash')}</button>
            </li>`;
        }).join('')}
      </ul>`;
  }

  function open(boardId, initialTab = 'general') {
    const board = store.getBoard(boardId);
    if (!board) return;
    if (store.getSettings().activeBoardId !== boardId) store.updateSettings({ activeBoardId: boardId });

    let tab = initialTab;
    let unsubscribe = null;

    const modal = App.modal.open({
      title: 'Configurações do quadro',
      size: 'md',
      content: `
        <div class="tabs tabs--underline" role="tablist">
          ${TABS.map((item) => `<button type="button" role="tab" class="tabs__item" data-tab="${item.id}">${icon(item.icon)}${item.label}</button>`).join('')}
        </div>
        <div class="tab-panel" data-panel></div>`,
      onClose: () => unsubscribe && unsubscribe(),
    });

    const panel = modal.body.querySelector('[data-panel]');

    function render() {
      const current = store.getBoard(boardId);
      if (!current) {
        modal.close();
        return;
      }
      modal.body.querySelectorAll('[data-tab]').forEach((button) => {
        const active = button.dataset.tab === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      if (tab === 'general') panel.innerHTML = renderGeneral(current);
      if (tab === 'labels') panel.innerHTML = renderLabels(current);
      if (tab === 'archived') panel.innerHTML = renderArchived(current);
    }

    // Atualiza as abas de listas quando os dados mudam (ex.: desfazer).
    unsubscribe = store.subscribe(() => {
      if (tab !== 'general' && !App.utils.isEditingInside(panel)) render();
    });

    modal.body.addEventListener('click', async (event) => {
      const tabButton = event.target.closest('[data-tab]');
      if (tabButton) {
        tab = tabButton.dataset.tab;
        render();
        return;
      }

      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      const labelId = actionEl.closest('[data-label-id]')?.dataset.labelId;
      const taskId = actionEl.closest('[data-task-id]')?.dataset.taskId;

      switch (actionEl.dataset.action) {
        case 'delete-board':
          if (await App.actions.deleteBoard(boardId)) modal.close();
          break;
        case 'label-color':
        case 'new-label-color': {
          const selected = labelId ? store.getBoard(boardId).labels.find((label) => label.id === labelId).color : actionEl.dataset.color;
          const popover = App.popover.open(actionEl, { content: `<div class="popover__section">${ui.colorSwatches('label-color', selected)}</div>` });
          if (!popover) break;
          popover.el.addEventListener('change', (changeEvent) => {
            const value = changeEvent.target.value;
            if (labelId) {
              store.updateLabel(labelId, { color: value });
              render();
            } else {
              actionEl.dataset.color = value;
              actionEl.style.setProperty('--swatch', value);
            }
            popover.close();
          });
          break;
        }
        case 'label-delete': {
          const label = store.getBoard(boardId).labels.find((item) => item.id === labelId);
          const ok = await App.dialogs.confirm({
            title: `Excluir a etiqueta "${label.name}"?`,
            message: 'Ela será removida de todas as tarefas.',
            confirmLabel: 'Excluir',
            danger: true,
          });
          if (ok) {
            store.deleteLabel(labelId);
            render();
          }
          break;
        }
        case 'open-task':
          modal.close();
          App.taskModal.open(taskId);
          break;
        case 'restore-task':
          store.setTaskArchived(taskId, false);
          App.toast.success('Tarefa restaurada.');
          render();
          break;
        case 'delete-task':
          await App.actions.deleteTask(taskId);
          render();
          break;
        default:
          break;
      }
    });

    modal.body.addEventListener('change', (event) => {
      if (event.target.matches('[data-action="label-name"]')) {
        const labelId = event.target.closest('[data-label-id]').dataset.labelId;
        store.updateLabel(labelId, { name: event.target.value });
      }
    });

    modal.body.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;

      if (form.dataset.form === 'general') {
        const name = form.elements.name.value.trim();
        if (!name) {
          form.elements.name.classList.add('is-invalid');
          form.elements.name.focus();
          return;
        }
        store.updateBoard(boardId, {
          name,
          description: form.elements.description.value,
          color: form.elements.color.value,
        });
        App.toast.success('Quadro atualizado.');
        modal.close();
      }

      if (form.dataset.form === 'label') {
        const name = form.elements.name.value.trim();
        if (!name) {
          form.elements.name.focus();
          return;
        }
        const colorButton = form.querySelector('[data-action="new-label-color"]');
        store.addLabel(name, colorButton.dataset.color);
        render();
        modal.body.querySelector('[data-form="label"] [name="name"]').focus();
      }
    });

    render();
  }

  App.boardSettings = { open };
})(window.App);
