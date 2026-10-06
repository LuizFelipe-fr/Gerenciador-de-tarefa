(function (App) {
  'use strict';

  const { escapeHtml: esc, uid } = App.utils;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const stack = [];

  function getFocusable(element) {
    return [...element.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null);
  }

  function open({ title = '', content = '', size = 'md', className = '', footer = '', onClose = null, initialFocus = null } = {}) {
    const root = document.getElementById('modal-root');
    const titleId = uid('modal-title');
    const previousFocus = document.activeElement;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal--${size} ${className}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <header class="modal__header">
          <h2 class="modal__title" id="${titleId}">${esc(title)}</h2>
          <button type="button" class="icon-btn modal__close" data-modal-close aria-label="Fechar">${App.icon('x')}</button>
        </header>
        <div class="modal__body"></div>
        ${footer ? `<footer class="modal__footer">${footer}</footer>` : ''}
      </div>
    `;

    const dialog = backdrop.querySelector('.modal');
    const body = backdrop.querySelector('.modal__body');
    if (typeof content === 'string') body.innerHTML = content;
    else if (content instanceof Node) body.appendChild(content);

    let closed = false;
    const instance = {
      el: dialog,
      body,
      footer: backdrop.querySelector('.modal__footer'),
      close,
      setTitle(value) {
        dialog.querySelector('.modal__title').textContent = value;
      },
    };

    function close(result) {
      if (closed) return;
      closed = true;
      const index = stack.indexOf(instance);
      if (index !== -1) stack.splice(index, 1);

      backdrop.classList.add('is-leaving');
      setTimeout(() => backdrop.remove(), 160);
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
      if (onClose) onClose(result);
    }

    // Fecha apenas se o clique começou E terminou no fundo (evita fechar ao selecionar texto).
    let pointerDownOnBackdrop = false;
    backdrop.addEventListener('mousedown', (event) => {
      pointerDownOnBackdrop = event.target === backdrop;
    });
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop && pointerDownOnBackdrop) close();
    });
    backdrop.addEventListener('click', (event) => {
      if (event.target.closest('[data-modal-close]')) close();
    });

    root.appendChild(backdrop);
    stack.push(instance);

    const target = (initialFocus && dialog.querySelector(initialFocus)) || getFocusable(body)[0] || dialog.querySelector('.modal__close');
    if (target) target.focus({ preventScroll: true });

    return instance;
  }

  function onKeyDown(event) {
    const top = stack[stack.length - 1];
    if (!top) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      top.close();
      return;
    }

    if (event.key === 'Tab') {
      const focusable = getFocusable(top.el);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!top.el.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', onKeyDown);

  App.modal = {
    open,
    isOpen: () => stack.length > 0,
    closeAll: () => [...stack].reverse().forEach((instance) => instance.close()),
  };
})(window.App);
