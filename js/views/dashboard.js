/**
 * Painel de indicadores do quadro: KPIs, distribuição, carga da equipe,
 * tendência de entregas, próximos prazos e atividade recente.
 *
 * Os gráficos são HTML/CSS puros (sem bibliotecas) e respeitam os filtros ativos.
 */
(function (App) {
  'use strict';

  const { escapeHtml: esc, todayISO, addDays, diffInDays, toISODate, formatDate, timeAgo, formatDateTime } = App.utils;
  const { PRIORITIES } = App.config;
  const icon = App.icon;
  const ui = App.ui;
  const domain = App.domain;

  const TREND_DAYS = 14;
  let root = null;

  /* ---------- Cálculos ---------- */

  function computeStats(board) {
    const tasks = domain.getActiveTasks(board).filter((task) => App.filters.matches(task, board));
    const today = todayISO();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const open = tasks.filter((task) => !domain.isTaskDone(task, board));
    const done = tasks.filter((task) => domain.isTaskDone(task, board));
    const overdue = open.filter((task) => task.dueDate && diffInDays(task.dueDate, today) < 0);
    const dueSoon = open.filter((task) => task.dueDate && diffInDays(task.dueDate, today) >= 0 && diffInDays(task.dueDate, today) <= 7);
    const completedThisWeek = done.filter((task) => task.completedAt && task.completedAt >= weekAgo);

    const byColumn = board.columns.map((column) => ({
      label: column.name,
      color: column.color,
      value: tasks.filter((task) => task.columnId === column.id).length,
    }));

    const byPriority = PRIORITIES.map((priority) => ({
      id: priority.id,
      label: priority.label,
      value: open.filter((task) => task.priority === priority.id).length,
    }));

    const members = App.store.getState().members;
    const byMember = members
      .map((member) => ({
        member,
        value: open.filter((task) => task.assigneeIds.includes(member.id)).length,
        overdue: overdue.filter((task) => task.assigneeIds.includes(member.id)).length,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const unassigned = open.filter((task) => task.assigneeIds.length === 0).length;

    const byLabel = board.labels
      .map((label) => ({ label: label.name, color: label.color, value: tasks.filter((task) => task.labelIds.includes(label.id)).length }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    // Entregas por dia (últimos N dias), com base na data de conclusão.
    const trend = [];
    for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
      const day = addDays(today, -offset);
      trend.push({
        day,
        value: done.filter((task) => task.completedAt && toISODate(new Date(task.completedAt)) === day).length,
      });
    }

    const upcoming = open
      .filter((task) => task.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 8);

    return {
      total: tasks.length,
      open,
      done,
      overdue,
      dueSoon,
      completedThisWeek,
      completion: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
      byColumn,
      byPriority,
      byMember,
      unassigned,
      byLabel,
      trend,
      upcoming,
    };
  }

  /* ---------- Componentes do painel ---------- */

  function kpi({ label, value, detail = '', iconName, tone = '' }) {
    return `
      <div class="kpi ${tone ? `kpi--${tone}` : ''}">
        <div class="kpi__header">
          <span class="kpi__label">${esc(label)}</span>
          <span class="kpi__icon">${icon(iconName)}</span>
        </div>
        <strong class="kpi__value">${value}</strong>
        ${detail ? `<span class="kpi__detail">${detail}</span>` : ''}
      </div>`;
  }

  /** Barras horizontais de uma única série; `marker` identifica a categoria. */
  function barList(items, { marker = () => '', emptyText = 'Sem dados' } = {}) {
    if (!items.length || items.every((item) => item.value === 0)) {
      return `<p class="muted small chart-empty">${esc(emptyText)}</p>`;
    }
    const max = Math.max(...items.map((item) => item.value), 1);
    return `
      <ul class="bar-list">
        ${items.map((item) => `
          <li class="bar-list__row" data-tip="${esc(item.label)}: ${item.value}">
            <span class="bar-list__label">${marker(item)}<span>${esc(item.label)}</span></span>
            <span class="bar-list__track">
              <span class="bar-list__bar" style="width: ${item.value ? Math.max((item.value / max) * 100, 2) : 0}%"></span>
            </span>
            <span class="bar-list__value">${item.value}${item.suffix || ''}</span>
          </li>`).join('')}
      </ul>`;
  }

  function trendChart(trend) {
    const max = Math.max(...trend.map((point) => point.value), 1);
    const total = trend.reduce((sum, point) => sum + point.value, 0);
    return `
      <div class="column-chart" role="img" aria-label="${total} tarefas concluídas nos últimos ${TREND_DAYS} dias">
        <div class="column-chart__plot">
          ${trend.map((point) => `
            <div class="column-chart__col" data-tip="${esc(formatDate(point.day))}: ${point.value} ${point.value === 1 ? 'concluída' : 'concluídas'}">
              <span class="column-chart__bar" style="height: ${point.value ? Math.max((point.value / max) * 100, 4) : 0}%"></span>
            </div>`).join('')}
        </div>
        <div class="column-chart__axis">
          <span>${esc(formatDate(trend[0].day))}</span>
          <span>Hoje</span>
        </div>
      </div>`;
  }

  function panel(title, body, { iconName = '', className = '', aside = '' } = {}) {
    return `
      <section class="panel ${className}">
        <header class="panel__header">
          <h2 class="panel__title">${iconName ? icon(iconName) : ''}${esc(title)}</h2>
          ${aside}
        </header>
        <div class="panel__body">${body}</div>
      </section>`;
  }

  function upcomingList(tasks, board) {
    if (!tasks.length) return '<p class="muted small chart-empty">Nenhuma tarefa com prazo em aberto.</p>';
    return `
      <ul class="task-mini-list">
        ${tasks.map((task) => `
          <li>
            <button type="button" class="task-mini" data-task-id="${task.id}">
              ${ui.dueBadge(task, board)}
              <span class="task-mini__title">${esc(task.title)}</span>
              ${ui.avatarStack(task.assigneeIds.map((id) => App.store.getMember(id)).filter(Boolean), 2)}
            </button>
          </li>`).join('')}
      </ul>`;
  }

  function activityList(board) {
    const entries = board.activity.slice(0, 12);
    if (!entries.length) return '<p class="muted small chart-empty">Nenhuma atividade registrada.</p>';
    return `
      <ul class="activity">
        ${entries.map((entry) => {
          const member = App.store.getMember(entry.userId);
          return `
            <li class="activity__item">
              ${member ? ui.avatar(member, 'sm') : `<span class="avatar avatar--sm avatar--ghost">${icon('user')}</span>`}
              <p>
                <strong>${esc(member ? member.name : 'Alguém')}</strong> ${esc(entry.text)}
                <span class="activity__time" title="${esc(formatDateTime(entry.at))}">${esc(timeAgo(entry.at))}</span>
              </p>
            </li>`;
        }).join('')}
      </ul>`;
  }

  /* ---------- Renderização ---------- */

  function render() {
    const board = App.store.getActiveBoard();
    if (!board) return;

    const stats = computeStats(board);
    const filtered = App.domain.hasActiveFilters(App.filters.get());

    root.innerHTML = `
      <div class="dashboard">
        ${filtered ? `<div class="notice">${icon('filter')}Os indicadores consideram apenas as tarefas que correspondem aos filtros atuais.</div>` : ''}

        <div class="kpi-grid">
          ${kpi({ label: 'Tarefas ativas', value: stats.total, detail: `${stats.open.length} em aberto`, iconName: 'kanban' })}
          ${kpi({ label: 'Concluídas', value: stats.done.length, detail: `${stats.completedThisWeek.length} nos últimos 7 dias`, iconName: 'success', tone: 'good' })}
          ${kpi({ label: 'Em atraso', value: stats.overdue.length, detail: stats.overdue.length ? 'Precisam de atenção' : 'Tudo em dia', iconName: 'alert', tone: stats.overdue.length ? 'critical' : '' })}
          ${kpi({ label: 'Vencem em 7 dias', value: stats.dueSoon.length, detail: 'Prazos próximos', iconName: 'calendar', tone: stats.dueSoon.length ? 'warning' : '' })}
        </div>

        <div class="dashboard__grid">
          ${panel('Progresso geral', `
            <div class="completion">
              <strong class="completion__value">${stats.completion}%</strong>
              <span class="muted small">${stats.done.length} de ${stats.total} tarefas concluídas</span>
            </div>
            <div class="progress progress--lg" role="progressbar" aria-valuenow="${stats.completion}" aria-valuemin="0" aria-valuemax="100">
              <span style="width: ${stats.completion}%"></span>
            </div>
          `, { iconName: 'target' })}

          ${panel(`Entregas nos últimos ${TREND_DAYS} dias`, trendChart(stats.trend), { iconName: 'trending' })}

          ${panel('Tarefas por status', barList(stats.byColumn, {
            marker: (item) => `<span class="color-dot" style="--dot: ${item.color}"></span>`,
          }), { iconName: 'kanban' })}

          ${panel('Em aberto por prioridade', barList(stats.byPriority, {
            marker: (item) => `<span class="priority-flag priority--${item.id}">${icon('flag')}</span>`,
            emptyText: 'Nenhuma tarefa em aberto.',
          }), { iconName: 'flag' })}

          ${panel('Carga da equipe', barList(
            [
              ...stats.byMember.map((item) => ({
                label: item.member.name,
                value: item.value,
                member: item.member,
                suffix: item.overdue ? ` <span class="bar-list__warn" title="Em atraso">· ${item.overdue} atrasada${item.overdue > 1 ? 's' : ''}</span>` : '',
              })),
              ...(stats.unassigned ? [{ label: 'Sem responsável', value: stats.unassigned }] : []),
            ],
            {
              marker: (item) => (item.member ? ui.avatar(item.member, 'xs') : `<span class="avatar avatar--xs avatar--ghost">${icon('user')}</span>`),
              emptyText: 'Nenhuma tarefa em aberto.',
            }
          ), { iconName: 'users', aside: '<span class="muted small">Tarefas em aberto</span>' })}

          ${panel('Etiquetas', barList(stats.byLabel, {
            marker: (item) => `<span class="color-dot" style="--dot: ${item.color}"></span>`,
            emptyText: 'Nenhuma tarefa com etiqueta.',
          }), { iconName: 'tag' })}

          ${panel('Próximos prazos', upcomingList(stats.upcoming, board), { iconName: 'calendar' })}

          ${panel('Atividade recente', activityList(board), { iconName: 'activity' })}
        </div>
      </div>`;
  }

  function mount(element) {
    root = element;
    root.classList.add('view--dashboard');
    root.addEventListener('click', (event) => {
      const taskButton = event.target.closest('[data-task-id]');
      if (taskButton) App.taskModal.open(taskButton.dataset.taskId);
    });
  }

  App.views = App.views || {};
  App.views.dashboard = { mount, render };
})(window.App);
