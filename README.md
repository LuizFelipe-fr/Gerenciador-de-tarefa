# Fluxo — Gerenciador de Tarefas

Aplicação web de gestão de tarefas e projetos no estilo **Kanban**, feita com HTML, CSS e JavaScript puros —
sem frameworks, sem build e sem dependências. Basta abrir o `index.html` no navegador.

Pensado para uso real por equipes: múltiplos quadros, responsáveis, prazos, prioridades, checklist,
comentários, histórico de atividades, painel de indicadores, filtros, backup e muito mais.

## Funcionalidades

### Quadros e colunas
- Vários quadros (projetos), cada um com nome, descrição e cor
- Modelos prontos ao criar um quadro: *Kanban básico*, *Desenvolvimento de software*, *Marketing e conteúdo* ou *Em branco*
- Colunas personalizáveis: criar, renomear (duplo clique no título), trocar cor, reordenar (arrastando) e excluir
- **Limite de WIP** por coluna, com alerta visual quando excedido
- **Coluna de conclusão**: tarefas movidas para ela são marcadas como concluídas automaticamente
- Duplicar e excluir quadros

### Tarefas
- Arrastar e soltar entre colunas, com animação suave
- Criação rápida no rodapé da coluna (Enter cria e já deixa pronto para a próxima)
- Formulário completo de criação com status, prioridade, prazo, responsáveis e etiquetas
- Numeração automática por quadro (`#1`, `#2`…)
- Prioridades: **Urgente, Alta, Média e Baixa**
- Prazos com destaque para tarefas **atrasadas**, que vencem **hoje** ou **em breve**
- Responsáveis (membros da equipe) e etiquetas coloridas
- **Checklist** com barra de progresso e reordenação de itens
- **Comentários** (links viram clicáveis) e **histórico** de alterações por tarefa
- Duplicar, arquivar, restaurar e excluir — com opção de **Desfazer**

### Visualizações
- **Quadro** — Kanban clássico
- **Lista** — tabela ordenável por qualquer coluna, com opção de exibir arquivadas
- **Painel** — indicadores (KPIs), progresso geral, entregas dos últimos 14 dias,
  tarefas por status, por prioridade, carga da equipe, etiquetas, próximos prazos e atividade recente

### Busca e filtros
- Busca por título, descrição, etiqueta ou número (`#12`)
- Filtros por prioridade, etiqueta, responsável, prazo e "somente minhas tarefas"
- Os filtros valem para as três visualizações

### Equipe e configurações
- Cadastro de membros com nome, cargo e cor
- Escolha de quem é o usuário atual (autor de comentários e do histórico)
- Tema **claro**, **escuro** ou **automático** (segue o sistema)

### Dados
- Salvamento automático no navegador (localStorage)
- Sincronização entre abas abertas ao mesmo tempo
- **Exportar/importar backup** em JSON
- **Exportar planilha CSV** do quadro (abre direto no Excel)

### Acessibilidade e usabilidade
- Navegação completa por teclado, foco visível e janelas acessíveis (foco preso, `Esc` para fechar)
- Layout responsivo (desktop, tablet e celular)
- Respeita a preferência do sistema por menos animações

## Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `N` | Nova tarefa |
| `/` ou `Ctrl` + `K` | Buscar tarefas |
| `F` | Abrir filtros |
| `1` / `2` / `3` | Quadro / Lista / Painel |
| `T` | Alternar tema claro/escuro |
| `[` | Recolher/expandir menu lateral |
| `?` | Mostrar atalhos |
| `Esc` | Fechar janela / limpar filtros |
| `Enter` | Abrir a tarefa selecionada |
| `Alt` + `←` `→` | Mover tarefa entre colunas |
| `Alt` + `↑` `↓` | Reordenar tarefa na coluna |
| `Delete` | Excluir a tarefa selecionada |

## Como executar

1. Clone o repositório
2. Abra o arquivo `index.html` no navegador

Não precisa instalar nada. Na primeira execução é criado um quadro de exemplo para explorar
(dá para apagar em **Configurações → Dados**).

## Estrutura do projeto

```
📁 Gerenciador-de-tarefa
 ├── index.html              # Estrutura da página e ordem de carregamento dos scripts
 ├── css/
 │   ├── tokens.css          # Variáveis de design (cores, espaçamentos, temas claro/escuro)
 │   ├── base.css            # Reset, tipografia e utilitários
 │   ├── layout.css          # Menu lateral, barra superior e responsividade
 │   ├── components.css      # Botões, campos, badges, avatares, menus, toasts…
 │   ├── board.css           # Quadro Kanban, colunas e cartões
 │   ├── views.css           # Visualizações em lista e painel
 │   └── modal.css           # Janelas modais e telas de configuração
 └── js/
     ├── config.js           # Constantes: cores, prioridades, modelos, atalhos
     ├── utils.js            # Funções utilitárias (datas, texto, arquivos)
     ├── storage.js          # Persistência no localStorage
     ├── domain.js           # Regras de negócio: prazos, progresso, filtros, ordenação
     ├── seed.js             # Dados de exemplo
     ├── store.js            # Estado central + ações (única forma de alterar os dados)
     ├── actions.js          # Ações da interface (confirmações, desfazer, exportação)
     ├── shortcuts.js        # Atalhos de teclado
     ├── app.js              # Inicialização e renderização
     ├── ui/                 # Componentes: ícones, modal, popover, diálogos, toasts
     └── views/              # Telas: menu lateral, barra superior, quadro, lista,
                             # painel, janela da tarefa e configurações
```

## Arquitetura

O projeto segue um fluxo de dados em **mão única**:

```
Interação do usuário → actions / store (altera o estado) → salva no localStorage → notifica → telas renderizam
```

- **`store.js`** é a única fonte da verdade. Nenhuma tela altera dados diretamente.
- **`domain.js`** concentra as regras de negócio em funções puras, reutilizadas por todas as telas.
- **`views/`** apenas desenham o estado atual e disparam ações.
- Todo texto digitado pelo usuário é escapado antes de ir para o HTML (proteção contra XSS),
  e os dados importados são validados e normalizados.
- Os módulos são registrados no namespace global `App`, o que permite rodar direto pelo
  `file://` sem servidor nem bundler.

## Tecnologias

- HTML5 semântico
- CSS3 (variáveis, Grid, Flexbox, `color-mix`, `:has`)
- JavaScript (ES2020+, Vanilla JS)
- Fonte [Inter](https://fonts.google.com/specimen/Inter) (com fallback para as fontes do sistema)

## Autor

Projeto desenvolvido por Luiz.
