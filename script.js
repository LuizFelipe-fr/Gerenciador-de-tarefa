const tasklist = document.querySelectorAll('.task-list');
const addButtons = document.querySelectorAll('.add-task-btn'); 

// Cria task
function createTask(list, taskText) {
  if (!taskText) return;

  const task = document.createElement('div');
  task.className = 'task';

  // Texto da task
  const span = document.createElement('span');
  span.textContent = taskText;

  // Container dos botões
  const controls = document.createElement('div');
  controls.className = 'task-controls';

  // Botão remover
  const removeBtn = document.createElement('button');
  removeBtn.textContent = '🗑️';
  removeBtn.className = 'remove-btn';

  removeBtn.addEventListener('click', () => {
    task.remove();
  });

  controls.appendChild(removeBtn);

  task.appendChild(span);
  task.appendChild(controls);

  list.appendChild(task);

  updateMoveButtons(task);
}


function updateMoveButtons(task) {
  // Remove botões antigos
  task.querySelectorAll('.move-btn').forEach(btn => btn.remove());

  const columnsOrder = ['todo', 'in-progress', 'done'];
  const parentList = task.parentElement;
  const currentIndex = columnsOrder.indexOf(parentList.id);


  if (currentIndex > 0) {
    const btnLeft = document.createElement('button');
    btnLeft.textContent = '⬅️';
    btnLeft.className = 'move-btn';
    btnLeft.dataset.target = columnsOrder[currentIndex - 1];
    task.appendChild(btnLeft);
  }


  if (currentIndex < columnsOrder.length - 1) {
    const btnRight = document.createElement('button');
    btnRight.textContent = '➡️';
    btnRight.className = 'move-btn';
    btnRight.dataset.target = columnsOrder[currentIndex + 1];
    task.appendChild(btnRight);
  }
}

// Evento de clique para mover com animação deslizante
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('move-btn')) {
    const task = e.target.parentElement;
    const targetList = document.getElementById(e.target.dataset.target);

    const oldRect = task.getBoundingClientRect();

    targetList.appendChild(task);

    const newRect = task.getBoundingClientRect();
    const deltaX = oldRect.left - newRect.left;
    const deltaY = oldRect.top - newRect.top;

    task.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    task.style.transition = 'transform 0s';

    requestAnimationFrame(() => {
      task.style.transition = 'transform 0.3s ease';
      task.style.transform = 'translate(0, 0)';
    });

    task.addEventListener('transitionend', function cleanup() {
      task.style.transform = '';
      task.style.transition = '';
      task.removeEventListener('transitionend', cleanup);
    });

    updateMoveButtons(task);
  }
});

// Adiciona tarefas a partir dos inputs do site
addButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    const input = tasklist[index].parentElement.querySelector('.new-task-input');
    const taskText = input.value.trim();
    if (!taskText) return;

    createTask(tasklist[index], taskText);
    input.value = ''; // limpa o input depois de criar a task
  });
});
