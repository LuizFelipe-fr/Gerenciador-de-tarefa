window.App = window.App || {};

(function (App) {
  'use strict';

  const COLORS = [
    { value: '#64748b', name: 'Cinza' },
    { value: '#ef4444', name: 'Vermelho' },
    { value: '#f97316', name: 'Laranja' },
    { value: '#eab308', name: 'Amarelo' },
    { value: '#22c55e', name: 'Verde' },
    { value: '#14b8a6', name: 'Turquesa' },
    { value: '#3b82f6', name: 'Azul' },
    { value: '#6366f1', name: 'Índigo' },
    { value: '#a855f7', name: 'Roxo' },
    { value: '#ec4899', name: 'Rosa' },
  ];

  const PRIORITIES = [
    { id: 'urgent', label: 'Urgente', weight: 4 },
    { id: 'high', label: 'Alta', weight: 3 },
    { id: 'medium', label: 'Média', weight: 2 },
    { id: 'low', label: 'Baixa', weight: 1 },
  ];

  const DUE_FILTERS = [
    { id: 'all', label: 'Qualquer prazo' },
    { id: 'overdue', label: 'Atrasadas' },
    { id: 'today', label: 'Vencem hoje' },
    { id: 'week', label: 'Próximos 7 dias' },
    { id: 'none', label: 'Sem prazo' },
  ];

  const TEMPLATES = [
    {
      id: 'basic',
      name: 'Kanban básico',
      description: 'A fazer, em progresso e concluído.',
      columns: [
        { name: 'A fazer', color: '#64748b' },
        { name: 'Em progresso', color: '#3b82f6' },
        { name: 'Concluído', color: '#22c55e', isDone: true },
      ],
    },
    {
      id: 'software',
      name: 'Desenvolvimento de software',
      description: 'Fluxo com backlog, revisão e limites de WIP.',
      columns: [
        { name: 'Backlog', color: '#64748b' },
        { name: 'A fazer', color: '#6366f1' },
        { name: 'Em desenvolvimento', color: '#3b82f6', wipLimit: 3 },
        { name: 'Em revisão', color: '#f97316', wipLimit: 2 },
        { name: 'Concluído', color: '#22c55e', isDone: true },
      ],
    },
    {
      id: 'marketing',
      name: 'Marketing e conteúdo',
      description: 'Da ideia à publicação.',
      columns: [
        { name: 'Ideias', color: '#a855f7' },
        { name: 'Planejado', color: '#6366f1' },
        { name: 'Produzindo', color: '#3b82f6', wipLimit: 4 },
        { name: 'Revisão', color: '#f97316' },
        { name: 'Publicado', color: '#22c55e', isDone: true },
      ],
    },
    {
      id: 'empty',
      name: 'Em branco',
      description: 'Uma única coluna para você montar do seu jeito.',
      columns: [
        { name: 'A fazer', color: '#64748b' },
      ],
    },
  ];

  const DEFAULT_LABELS = [
    { name: 'Bug', color: '#ef4444' },
    { name: 'Melhoria', color: '#3b82f6' },
    { name: 'Documentação', color: '#14b8a6' },
    { name: 'Pesquisa', color: '#a855f7' },
  ];

  const SHORTCUTS = [
    { keys: ['N'], description: 'Nova tarefa' },
    { keys: ['/'], description: 'Buscar tarefas' },
    { keys: ['F'], description: 'Abrir filtros' },
    { keys: ['1'], description: 'Visualização em quadro' },
    { keys: ['2'], description: 'Visualização em lista' },
    { keys: ['3'], description: 'Painel de indicadores' },
    { keys: ['T'], description: 'Alternar tema claro/escuro' },
    { keys: ['['], description: 'Recolher/expandir menu lateral' },
    { keys: ['?'], description: 'Mostrar atalhos' },
    { keys: ['Esc'], description: 'Fechar janela / limpar busca' },
    { keys: ['Enter'], description: 'Abrir tarefa selecionada' },
    { keys: ['Alt', '←', '→'], description: 'Mover tarefa entre colunas' },
    { keys: ['Alt', '↑', '↓'], description: 'Reordenar tarefa na coluna' },
  ];

  App.config = Object.freeze({
    APP_NAME: 'Fluxo',
    STORAGE_KEY: 'fluxo:state',
    STORAGE_VERSION: 1,
    MAX_ACTIVITY: 300,
    SAVE_DELAY: 250,
    TITLE_MAX_LENGTH: 200,
    COLORS,
    PRIORITIES,
    DEFAULT_PRIORITY: 'medium',
    DUE_FILTERS,
    TEMPLATES,
    DEFAULT_LABELS,
    SHORTCUTS,
  });
})(window.App);
