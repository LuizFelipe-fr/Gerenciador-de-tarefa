/**
 * Funções utilitárias puras (sem dependência do estado da aplicação).
 */
(function (App) {
  'use strict';

  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const relativeFormat = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

  /* ---------- Identificadores e texto ---------- */

  function uid(prefix = 'id') {
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}${random}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  function isValidColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  }

  /* ---------- Datas ---------- */

  function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseISODate(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function isISODate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDays(iso, amount) {
    const date = parseISODate(iso);
    date.setDate(date.getDate() + amount);
    return toISODate(date);
  }

  /** Diferença em dias inteiros entre duas datas ISO (a - b). */
  function diffInDays(isoA, isoB) {
    return Math.round((parseISODate(isoA) - parseISODate(isoB)) / DAY_MS);
  }

  function formatDate(iso) {
    if (!isISODate(iso)) return '';
    const date = parseISODate(iso);
    const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
    return date.getFullYear() === new Date().getFullYear() ? base : `${base} ${date.getFullYear()}`;
  }

  function formatDateTime(timestamp) {
    return dateTimeFormat.format(new Date(timestamp));
  }

  function timeAgo(timestamp) {
    const seconds = Math.round((timestamp - Date.now()) / 1000);
    const abs = Math.abs(seconds);

    if (abs < 45) return 'agora mesmo';
    if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), 'hour');
    if (abs < 86400 * 30) return relativeFormat.format(Math.round(seconds / 86400), 'day');
    return formatDateTime(timestamp);
  }

  /* ---------- Funções de controle ---------- */

  /** Debounce com `flush()` para forçar a execução pendente (ex.: antes de fechar a aba). */
  function debounce(fn, wait) {
    let timer = null;
    let pendingArgs = null;

    function debounced(...args) {
      pendingArgs = args;
      clearTimeout(timer);
      timer = setTimeout(debounced.flush, wait);
    }

    debounced.flush = () => {
      if (!pendingArgs) return;
      clearTimeout(timer);
      const args = pendingArgs;
      pendingArgs = null;
      fn(...args);
    };

    return debounced;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* ---------- DOM ---------- */

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isTypingTarget(element) {
    if (!element) return false;
    const tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
  }

  /** O usuário está digitando em um campo de texto dentro de `container`? */
  function isEditingInside(container) {
    const element = document.activeElement;
    if (!element || !container.contains(element)) return false;
    if (element.tagName === 'TEXTAREA' || element.isContentEditable) return true;
    return element.tagName === 'INPUT' && !['radio', 'checkbox', 'file', 'button', 'submit'].includes(element.type);
  }

  /** Ajusta a altura de um textarea ao conteúdo. */
  function autoGrow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  /* ---------- Arquivos ---------- */

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function slugify(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quadro';
  }

  App.utils = {
    uid,
    escapeHtml,
    initials,
    pluralize,
    normalizeText,
    isValidColor,
    toISODate,
    parseISODate,
    isISODate,
    todayISO,
    addDays,
    diffInDays,
    formatDate,
    formatDateTime,
    timeAgo,
    debounce,
    clone,
    prefersReducedMotion,
    isTypingTarget,
    isEditingInside,
    autoGrow,
    downloadFile,
    readFileAsText,
    slugify,
  };
})(window.App);
