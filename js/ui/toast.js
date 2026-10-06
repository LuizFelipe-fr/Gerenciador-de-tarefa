(function (App) {
  'use strict';

  const { escapeHtml: esc } = App.utils;
  const ICONS = { success: 'success', error: 'alert', warning: 'alert', info: 'info' };
  const MAX_VISIBLE = 4;

  let root = null;

  function getRoot() {
    if (!root) root = document.getElementById('toast-root');
    return root;
  }

  function dismiss(toast) {
    if (!toast.isConnected || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Garantia caso a animação esteja desativada.
    setTimeout(() => toast.remove(), 400);
  }

  function show(message, { type = 'info', action = null, duration = 4500 } = {}) {
    const container = getRoot();
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `
      ${App.icon(ICONS[type] || 'info', 'toast__icon')}
      <p class="toast__message">${esc(message)}</p>
      ${action ? `<button type="button" class="toast__action">${esc(action.label)}</button>` : ''}
      <button type="button" class="toast__close" aria-label="Fechar notificação">${App.icon('x')}</button>
    `;

    let timer = setTimeout(() => dismiss(toast), action ? Math.max(duration, 6000) : duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      timer = setTimeout(() => dismiss(toast), 2000);
    });
    toast.querySelector('.toast__close').addEventListener('click', () => dismiss(toast));
    if (action) {
      toast.querySelector('.toast__action').addEventListener('click', () => {
        action.onClick();
        dismiss(toast);
      });
    }

    container.appendChild(toast);
    const toasts = container.querySelectorAll('.toast:not(.is-leaving)');
    if (toasts.length > MAX_VISIBLE) dismiss(toasts[0]);

    return toast;
  }

  App.toast = {
    show,
    success: (message, options) => show(message, { ...options, type: 'success' }),
    error: (message, options) => show(message, { ...options, type: 'error' }),
    warning: (message, options) => show(message, { ...options, type: 'warning' }),
    info: (message, options) => show(message, { ...options, type: 'info' }),
  };
})(window.App);
