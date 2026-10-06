(function (App) {
  'use strict';

  const { escapeHtml: esc } = App.utils;

  function confirm({ title = 'Tem certeza?', message = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false } = {}) {
    return new Promise((resolve) => {
      let confirmed = false;
      const modal = App.modal.open({
        title,
        size: 'sm',
        content: message ? `<p class="dialog-message">${esc(message)}</p>` : '',
        footer: `
          <button type="button" class="btn btn--ghost" data-modal-close>${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm>${esc(confirmLabel)}</button>
        `,
        initialFocus: '[data-confirm]',
        onClose: () => resolve(confirmed),
      });

      modal.footer.querySelector('[data-confirm]').addEventListener('click', () => {
        confirmed = true;
        modal.close();
      });
    });
  }

  function prompt({ title, label = '', value = '', placeholder = '', confirmLabel = 'Salvar', type = 'text', min, max, required = true } = {}) {
    return new Promise((resolve) => {
      let result = null;
      const modal = App.modal.open({
        title,
        size: 'sm',
        content: `
          <form class="form" data-prompt-form novalidate>
            <label class="field">
              ${label ? `<span class="field__label">${esc(label)}</span>` : ''}
              <input class="input" name="value" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"
                ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} autocomplete="off">
            </label>
          </form>
        `,
        footer: `
          <button type="button" class="btn btn--ghost" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn--primary" data-confirm>${esc(confirmLabel)}</button>
        `,
        onClose: () => resolve(result),
      });

      const form = modal.body.querySelector('form');
      const input = form.elements.value;

      function submit() {
        const current = input.value.trim();
        if (required && !current) {
          input.classList.add('is-invalid');
          input.focus();
          return;
        }
        result = current;
        modal.close();
      }

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit();
      });
      modal.footer.querySelector('[data-confirm]').addEventListener('click', submit);
      input.addEventListener('input', () => input.classList.remove('is-invalid'));
      input.select();
    });
  }

  App.dialogs = { confirm, prompt };
})(window.App);
