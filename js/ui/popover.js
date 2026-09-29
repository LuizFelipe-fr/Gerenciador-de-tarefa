/**
 * Popovers ancorados em um elemento (menus de contexto, filtros, seletores).
 * Apenas um popover fica aberto por vez.
 *
 * App.popover.menu(botao, [
 *   { label: 'Renomear', icon: 'edit', onClick: () => {} },
 *   'divider',
 *   { label: 'Excluir', icon: 'trash', danger: true, onClick: () => {} },
 * ]);
 */
(function (App) {
  'use strict';

  const { escapeHtml: esc } = App.utils;
  const GAP = 6;
  const MARGIN = 8;

  let current = null;

  function position(popover, anchor, align) {
    const rect = anchor.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = popover;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = align === 'end' ? rect.right - width : rect.left;
    left = Math.max(MARGIN, Math.min(left, viewportW - width - MARGIN));

    let top = rect.bottom + GAP;
    if (top + height > viewportH - MARGIN && rect.top - height - GAP > MARGIN) {
      top = rect.top - height - GAP;
    }
    top = Math.max(MARGIN, Math.min(top, viewportH - height - MARGIN));

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function close() {
    if (!current) return;
    const { el, anchor, onClose } = current;
    current = null;
    el.remove();
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', close);
    if (onClose) onClose();
  }

  function onOutside(event) {
    if (!current) return;
    if (current.el.contains(event.target) || current.anchor.contains(event.target)) return;
    close();
  }

  function onKeyDown(event) {
    if (!current) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const anchor = current.anchor;
      close();
      anchor.focus();
      return;
    }

    // Navegação por setas em menus.
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const items = [...current.el.querySelectorAll('.menu__item:not([disabled])')];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      items[(next + items.length) % items.length].focus();
    }
  }

  function open(anchor, { content, className = '', align = 'start', onClose = null } = {}) {
    // Clicar de novo no mesmo botão fecha o popover.
    if (current && current.anchor === anchor) {
      close();
      return null;
    }
    close();

    const el = document.createElement('div');
    el.className = `popover ${className}`;
    if (typeof content === 'string') el.innerHTML = content;
    else if (content instanceof Node) el.appendChild(content);

    document.body.appendChild(el);
    position(el, anchor, align);
    anchor.setAttribute('aria-expanded', 'true');

    current = { el, anchor, onClose };
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', close);

    return { el, close, reposition: () => position(el, anchor, align) };
  }

  function menu(anchor, items, options = {}) {
    const list = document.createElement('div');
    list.className = 'menu';
    list.setAttribute('role', 'menu');

    items.filter(Boolean).forEach((item) => {
      if (item === 'divider') {
        list.insertAdjacentHTML('beforeend', '<div class="menu__divider" role="separator"></div>');
        return;
      }
      if (item.heading) {
        list.insertAdjacentHTML('beforeend', `<div class="menu__heading">${esc(item.heading)}</div>`);
        return;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `menu__item${item.danger ? ' menu__item--danger' : ''}`;
      button.setAttribute('role', 'menuitem');
      button.disabled = Boolean(item.disabled);
      button.innerHTML = `
        ${item.icon ? App.icon(item.icon) : '<span class="icon"></span>'}
        <span class="menu__label">${esc(item.label)}</span>
        ${item.checked ? App.icon('check', 'menu__check') : ''}
        ${item.hint ? `<span class="menu__hint">${esc(item.hint)}</span>` : ''}
      `;
      button.addEventListener('click', () => {
        close();
        item.onClick();
      });
      list.appendChild(button);
    });

    const popover = open(anchor, { ...options, content: list, className: 'popover--menu' });
    if (popover) {
      const first = popover.el.querySelector('.menu__item:not([disabled])');
      if (first) first.focus();
    }
    return popover;
  }

  App.popover = { open, menu, close, isOpen: () => Boolean(current) };
})(window.App);
