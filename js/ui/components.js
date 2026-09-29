/**
 * Pequenos componentes de interface que retornam HTML (string).
 * Todo texto vindo do usuário passa por `escapeHtml`.
 */
(function (App) {
  'use strict';

  const { escapeHtml: esc, initials, formatDate } = App.utils;
  const { COLORS } = App.config;
  const icon = App.icon;

  function avatar(member, size = 'md') {
    if (!member) return '';
    return `
      <span class="avatar avatar--${size}" style="--avatar-color: ${member.color}" title="${esc(member.name)}">
        ${esc(initials(member.name))}
      </span>`;
  }

  function avatarStack(members, max = 3) {
    if (!members.length) return '';
    const visible = members.slice(0, max).map((member) => avatar(member, 'sm')).join('');
    const extra = members.length > max
      ? `<span class="avatar avatar--sm avatar--more" title="${esc(members.slice(max).map((m) => m.name).join(', '))}">+${members.length - max}</span>`
      : '';
    return `<span class="avatar-stack">${visible}${extra}</span>`;
  }

  function labelChip(label, { removable = false } = {}) {
    return `
      <span class="label-chip" style="--label-color: ${label.color}">
        <span class="label-chip__dot"></span>${esc(label.name)}
        ${removable ? `<button type="button" class="label-chip__remove" data-label-id="${label.id}" aria-label="Remover etiqueta">${icon('x')}</button>` : ''}
      </span>`;
  }

  function priorityBadge(priority, { compact = false } = {}) {
    const info = App.domain.getPriority(priority);
    return `
      <span class="badge badge--priority priority--${info.id}" title="Prioridade ${esc(info.label)}">
        ${icon('flag')}${compact ? '' : `<span>${esc(info.label)}</span>`}
      </span>`;
  }

  function dueBadge(task, board) {
    if (!task.dueDate) return '';
    const status = App.domain.getDueStatus(task, board);
    return `
      <span class="badge badge--due due--${status}" title="${esc(App.domain.describeDue(task, board))}">
        ${icon(status === 'done' ? 'check' : 'calendar')}<span>${esc(formatDate(task.dueDate))}</span>
      </span>`;
  }

  function colorSwatches(name, selected) {
    return `
      <div class="swatches" role="radiogroup">
        ${COLORS.map((color) => `
          <label class="swatch" style="--swatch: ${color.value}" title="${color.name}">
            <input type="radio" name="${name}" value="${color.value}" ${color.value === selected ? 'checked' : ''} aria-label="${color.name}">
            <span>${icon('check')}</span>
          </label>`).join('')}
      </div>`;
  }

  function emptyState({ iconName = 'inbox', title, text = '', actionLabel = '', action = '' }) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${icon(iconName)}</div>
        <h3>${esc(title)}</h3>
        ${text ? `<p>${esc(text)}</p>` : ''}
        ${actionLabel ? `<button type="button" class="btn btn--primary" data-action="${action}">${icon('plus')}${esc(actionLabel)}</button>` : ''}
      </div>`;
  }

  function kbd(keys) {
    return keys.map((key) => `<kbd>${esc(key)}</kbd>`).join('');
  }

  /** Converte texto simples em HTML seguro, preservando quebras de linha e links. */
  function richText(value) {
    return esc(value)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');
  }

  App.ui = App.ui || {};
  Object.assign(App.ui, {
    avatar,
    avatarStack,
    labelChip,
    priorityBadge,
    dueBadge,
    colorSwatches,
    emptyState,
    kbd,
    richText,
  });
})(window.App);
