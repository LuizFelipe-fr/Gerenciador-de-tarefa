/**
 * Dados iniciais: um quadro de exemplo para quem abre o app pela primeira vez.
 * O usuário pode excluí-lo ou restaurar um estado vazio em Configurações > Dados.
 */
(function (App) {
  'use strict';

  const { todayISO, addDays } = App.utils;
  const { DEFAULT_LABELS } = App.config;

  function createEmpty() {
    return {
      settings: { currentUserId: 'member_me' },
      members: [{ id: 'member_me', name: 'Você', role: 'Administrador', color: '#3b82f6' }],
      boards: [],
    };
  }

  function create() {
    const today = todayISO();
    const hour = 60 * 60 * 1000;
    const now = Date.now();

    const members = [
      { id: 'member_me', name: 'Luiz', role: 'Gerente de projeto', color: '#3b82f6' },
      { id: 'member_ana', name: 'Ana Souza', role: 'Desenvolvedora front-end', color: '#ec4899' },
      { id: 'member_bruno', name: 'Bruno Lima', role: 'Desenvolvedor back-end', color: '#14b8a6' },
      { id: 'member_carla', name: 'Carla Mendes', role: 'Designer UX/UI', color: '#f97316' },
    ];

    const labels = [
      ...DEFAULT_LABELS.map((label, index) => ({ ...label, id: `label_${index}` })),
      { id: 'label_design', name: 'Design', color: '#ec4899' },
      { id: 'label_backend', name: 'Back-end', color: '#6366f1' },
    ];
    const [bug, improvement, docs, research] = labels.map((label) => label.id);

    const columns = [
      { id: 'col_backlog', name: 'Backlog', color: '#64748b' },
      { id: 'col_todo', name: 'A fazer', color: '#6366f1' },
      { id: 'col_doing', name: 'Em desenvolvimento', color: '#3b82f6', wipLimit: 3 },
      { id: 'col_review', name: 'Em revisão', color: '#f97316', wipLimit: 2 },
      { id: 'col_done', name: 'Concluído', color: '#22c55e', isDone: true },
    ];

    const task = (number, columnId, data) => ({
      id: `task_${number}`,
      number,
      columnId,
      priority: 'medium',
      labelIds: [],
      assigneeIds: [],
      checklist: [],
      comments: [],
      createdAt: now - (20 - number) * 24 * hour,
      updatedAt: now - (20 - number) * 3 * hour,
      ...data,
    });

    const tasks = [
      task(1, 'col_backlog', {
        title: 'Pesquisar ferramentas de analytics',
        description: 'Comparar Google Analytics, Plausible e Matomo considerando custo, LGPD e facilidade de integração.',
        priority: 'low',
        labelIds: [research],
        assigneeIds: ['member_me'],
      }),
      task(2, 'col_backlog', {
        title: 'Criar versão em inglês do site',
        priority: 'low',
        labelIds: [improvement],
      }),
      task(3, 'col_todo', {
        title: 'Definir paleta de cores e tipografia',
        description: 'Seguir o manual da marca. Validar contraste AA para acessibilidade.',
        priority: 'high',
        dueDate: addDays(today, 2),
        labelIds: ['label_design'],
        assigneeIds: ['member_carla'],
        checklist: [
          { text: 'Cores primárias e secundárias', done: true },
          { text: 'Escala tipográfica', done: false },
          { text: 'Validar contraste', done: false },
        ],
      }),
      task(4, 'col_todo', {
        title: 'Escrever documentação da API',
        priority: 'medium',
        dueDate: addDays(today, 6),
        labelIds: [docs, 'label_backend'],
        assigneeIds: ['member_bruno'],
      }),
      task(5, 'col_doing', {
        title: 'Implementar página de login',
        description: 'Tela de login com validação de formulário, recuperação de senha e mensagens de erro amigáveis.',
        priority: 'urgent',
        dueDate: addDays(today, -1),
        labelIds: [improvement],
        assigneeIds: ['member_ana', 'member_bruno'],
        checklist: [
          { text: 'Layout da tela', done: true },
          { text: 'Validação dos campos', done: true },
          { text: 'Integração com a API', done: false },
          { text: 'Testes', done: false },
        ],
        comments: [
          { authorId: 'member_ana', text: 'Layout pronto, falta integrar com o endpoint de autenticação.', createdAt: now - 5 * hour },
          { authorId: 'member_bruno', text: 'Endpoint sobe hoje à tarde no ambiente de homologação.', createdAt: now - 3 * hour },
        ],
      }),
      task(6, 'col_doing', {
        title: 'Configurar banco de dados',
        priority: 'high',
        dueDate: today,
        labelIds: ['label_backend'],
        assigneeIds: ['member_bruno'],
      }),
      task(7, 'col_review', {
        title: 'Corrigir menu quebrado no celular',
        description: 'Em telas menores que 375px o menu sobrepõe o logotipo.',
        priority: 'high',
        dueDate: addDays(today, 1),
        labelIds: [bug],
        assigneeIds: ['member_ana'],
      }),
      task(8, 'col_done', {
        title: 'Montar protótipo navegável',
        priority: 'medium',
        labelIds: ['label_design'],
        assigneeIds: ['member_carla'],
        completedAt: now - 2 * 24 * hour,
      }),
      task(9, 'col_done', {
        title: 'Reunião de kickoff com o cliente',
        priority: 'medium',
        assigneeIds: ['member_me'],
        completedAt: now - 6 * 24 * hour,
      }),
    ];

    return {
      settings: { currentUserId: 'member_me', theme: 'system', view: 'board', activeBoardId: 'board_demo' },
      members,
      boards: [
        {
          id: 'board_demo',
          name: 'Lançamento do site',
          description: 'Quadro de exemplo — fique à vontade para editar ou excluir.',
          color: '#3b82f6',
          nextNumber: tasks.length + 1,
          columns,
          labels,
          tasks,
          activity: [
            { at: now - 3 * hour, userId: 'member_bruno', taskId: 'task_5', text: 'comentou em "Implementar página de login"' },
            { at: now - 5 * hour, userId: 'member_ana', taskId: 'task_7', text: 'moveu "Corrigir menu quebrado no celular" de Em desenvolvimento para Em revisão' },
            { at: now - 2 * 24 * hour, userId: 'member_carla', taskId: 'task_8', text: 'moveu "Montar protótipo navegável" de Em revisão para Concluído' },
            { at: now - 20 * 24 * hour, userId: 'member_me', taskId: null, text: 'criou o quadro "Lançamento do site"' },
          ],
        },
      ],
    };
  }

  App.seed = { create, createEmpty };
})(window.App);
