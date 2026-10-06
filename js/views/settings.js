(function (App) {
  'use strict';

  const { escapeHtml: esc, pluralize } = App.utils;
  const { SHORTCUTS, COLORS } = App.config;
  const icon = App.icon;
  const ui = App.ui;
  const store = App.store;

  const TABS = [
    { id: 'appearance', label: 'Aparência', icon: 'palette' },
    { id: 'team', label: 'Equipe', icon: 'users' },
    { id: 'data', label: 'Dados', icon: 'database' },
    { id: 'shortcuts', label: 'Atalhos', icon: 'keyboard' },
  ];

  const THEMES = [
    { id: 'system', label: 'Automático', description: 'Segue o sistema operacional', icon: 'monitor' },
    { id: 'light', label: 'Claro', description: 'Fundo claro', icon: 'sun' },
    { id: 'dark', label: 'Escuro', description: 'Ideal para ambientes com pouca luz', icon: 'moon' },
  ];

  function renderAppearance() {
    const { theme } = store.getSettings();
    return `
      <div class="field">
        <span class="field__label">Tema</span>
        <div class="theme-grid" role="radiogroup">
          ${THEMES.map((item) => `
            <label class="theme-option">
              <input type="radio" name="theme" value="${item.id}" ${theme === item.id ? 'checked' : ''}>
              <span class="theme-option__body">
                ${icon(item.icon)}
                <strong>${item.label}</strong>
                <span class="muted small">${item.description}</span>
              </span>
            </label>`).join('')}
        </div>
      </div>`;
  }

  function renderTeam() {
    const { members, settings } = store.getState();
    const taskCount = (memberId) => store.getState().boards
      .reduce((sum, board) => sum + Object.values(board.tasks).filter((task) => task.assigneeIds.includes(memberId)).length, 0);

    return `
      <p class="muted small">Membros podem ser atribuídos às tarefas de qualquer quadro. Selecione quem é você para registrar comentários e histórico no seu nome.</p>
      <ul class="settings-list">
        ${members.map((member) => `
          <li class="settings-list__item" data-member-id="${member.id}">
            <button type="button" class="swatch-btn swatch-btn--avatar" style="--swatch: ${member.color}" data-action="member-color" aria-label="Alterar cor">
              ${esc(App.utils.initials(member.name))}
            </button>
            <div class="settings-list__fields">
              <input class="input input--sm" value="${esc(member.name)}" maxlength="80" data-field="name" aria-label="Nome">
              <input class="input input--sm" value="${esc(member.role)}" maxlength="80" data-field="role" placeholder="Cargo / função" aria-label="Cargo">
            </div>
            <span class="muted small nowrap">${pluralize(taskCount(member.id), 'tarefa', 'tarefas')}</span>
            ${member.id === settings.currentUserId
              ? '<span class="tag-accent">Você</span>'
              : `<button type="button" class="btn btn--ghost btn--sm" data-action="set-me">Sou eu</button>`}
            <button type="button" class="icon-btn icon-btn--sm" data-action="member-delete" aria-label="Remover membro" ${members.length <= 1 ? 'disabled' : ''}>${icon('trash')}</button>
          </li>`).join('')}
      </ul>
      <form class="inline-form" data-form="member">
        <input class="input input--sm" name="name" placeholder="Nome do novo membro" maxlength="80" autocomplete="off" aria-label="Nome do novo membro">
        <input class="input input--sm" name="role" placeholder="Cargo (opcional)" maxlength="80" autocomplete="off" aria-label="Cargo do novo membro">
        <button type="submit" class="btn btn--secondary btn--sm">${icon('plus')}Adicionar</button>
      </form>`;
  }

  function renderData() {
    const { boards } = store.getState();
    const tasks = boards.reduce((sum, board) => sum + Object.keys(board.tasks).length, 0);
    const kb = (App.storage.usage() / 1024).toFixed(1);

    return `
      <div class="stats-inline">
        <div><strong>${boards.length}</strong><span>${boards.length === 1 ? 'quadro' : 'quadros'}</span></div>
        <div><strong>${tasks}</strong><span>${tasks === 1 ? 'tarefa' : 'tarefas'}</span></div>
        <div><strong>${kb} KB</strong><span>armazenados</span></div>
      </div>
      <p class="muted small">
        Os dados ficam salvos neste navegador (localStorage). Faça backups periódicos para não perder informações
        ao limpar o navegador ou trocar de computador.
      </p>

      <div class="data-actions">
        <div class="data-action">
          <div>
            <strong>Exportar backup</strong>
            <p class="muted small">Baixa um arquivo .json com todos os quadros, tarefas e membros.</p>
          </div>
          <button type="button" class="btn btn--secondary" data-action="export">${icon('download')}Exportar</button>
        </div>
        <div class="data-action">
          <div>
            <strong>Importar backup</strong>
            <p class="muted small">Restaura os dados a partir de um arquivo exportado anteriormente.</p>
          </div>
          <label class="btn btn--secondary">
            ${icon('upload')}Importar
            <input type="file" accept="application/json,.json" data-action="import" hidden>
          </label>
        </div>
        <div class="data-action">
          <div>
            <strong>Restaurar dados de exemplo</strong>
            <p class="muted small">Substitui tudo pelo quadro de demonstração.</p>
          </div>
          <button type="button" class="btn btn--ghost" data-action="reset-sample">${icon('restore')}Restaurar</button>
        </div>
        <div class="data-action data-action--danger">
          <div>
            <strong>Apagar todos os dados</strong>
            <p class="muted small">Remove quadros, tarefas e membros deste navegador.</p>
          </div>
          <button type="button" class="btn btn--danger" data-action="reset-empty">${icon('trash')}Apagar tudo</button>
        </div>
      </div>`;
  }

  function renderShortcuts() {
    return `
      <ul class="shortcut-list">
        ${SHORTCUTS.map((shortcut) => `
          <li>
            <span>${esc(shortcut.description)}</span>
            <span class="shortcut-list__keys">${ui.kbd(shortcut.keys)}</span>
          </li>`).join('')}
      </ul>`;
  }

  const RENDERERS = { appearance: renderAppearance, team: renderTeam, data: renderData, shortcuts: renderShortcuts };

  function open(initialTab = 'appearance') {
    let tab = initialTab;
    let unsubscribe = null;

    const modal = App.modal.open({
      title: 'Configurações',
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
      modal.body.querySelectorAll('[data-tab]').forEach((button) => {
        const active = button.dataset.tab === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      panel.innerHTML = RENDERERS[tab]();
    }

    // Recria o painel quando os dados mudam, exceto se o usuário estiver digitando nele.
    unsubscribe = store.subscribe(() => {
      if (!App.utils.isEditingInside(panel)) render();
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
      const memberId = actionEl.closest('[data-member-id]')?.dataset.memberId;

      switch (actionEl.dataset.action) {
        case 'set-me':
          store.updateSettings({ currentUserId: memberId });
          App.toast.success('Usuário atual alterado.');
          break;
        case 'member-color': {
          const member = store.getMember(memberId);
          const popover = App.popover.open(actionEl, { content: `<div class="popover__section">${ui.colorSwatches('member-color', member.color)}</div>` });
          if (!popover) break;
          popover.el.addEventListener('change', (changeEvent) => {
            store.updateMember(memberId, { color: changeEvent.target.value });
            popover.close();
          });
          break;
        }
        case 'member-delete': {
          const member = store.getMember(memberId);
          const ok = await App.dialogs.confirm({
            title: `Remover ${member.name}?`,
            message: 'O membro será removido de todas as tarefas em que estiver atribuído.',
            confirmLabel: 'Remover',
            danger: true,
          });
          if (ok) store.deleteMember(memberId);
          break;
        }
        case 'export':
          App.actions.exportJSON();
          break;
        case 'reset-sample':
        case 'reset-empty': {
          const empty = actionEl.dataset.action === 'reset-empty';
          const ok = await App.dialogs.confirm({
            title: empty ? 'Apagar todos os dados?' : 'Restaurar dados de exemplo?',
            message: 'Os dados atuais serão substituídos. Recomendamos exportar um backup antes.',
            confirmLabel: empty ? 'Apagar tudo' : 'Restaurar',
            danger: true,
          });
          if (!ok) break;
          const snapshot = store.snapshot();
          App.filters.reset();
          store.resetAll(!empty);
          App.toast.success(empty ? 'Todos os dados foram apagados.' : 'Dados de exemplo restaurados.', {
            action: { label: 'Desfazer', onClick: () => store.restore(snapshot) },
          });
          break;
        }
        default:
          break;
      }
    });

    modal.body.addEventListener('change', (event) => {
      const target = event.target;
      if (target.name === 'theme') {
        store.updateSettings({ theme: target.value });
        return;
      }
      if (target.matches('[data-action="import"]')) {
        const file = target.files[0];
        target.value = '';
        modal.close();
        App.actions.importJSON(file);
        return;
      }
      if (target.matches('[data-member-id] [data-field]')) {
        const memberId = target.closest('[data-member-id]').dataset.memberId;
        store.updateMember(memberId, { [target.dataset.field]: target.value });
      }
    });

    modal.body.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      if (form.dataset.form !== 'member') return;
      const name = form.elements.name.value.trim();
      if (!name) {
        form.elements.name.focus();
        return;
      }
      store.addMember({ name, role: form.elements.role.value, color: COLORS[(store.getState().members.length * 3 + 6) % COLORS.length].value });
      render();
      modal.body.querySelector('[data-form="member"] [name="name"]').focus();
    });

    render();
  }

  App.settingsModal = { open };
})(window.App);
