/* =========================================================
   ATENA — app.js
   O "cérebro" do app. Está dividido em blocos:
     1. Store      -> salva/lê dados no aparelho (localStorage)
     2. Tema       -> modo escuro/claro
     3. Navegação  -> troca de telas pela barra inferior
     4. Tela inicial -> saudação, data, frase e resumo
     5. Tarefas    -> projetos por dia da semana e tarefas
     6. Filosofia  -> frases e princípios + frase do dia
     7. Mindset    -> aprendizados e pensamentos positivos
     8. Desempenho -> nota, foco, erros, vitórias + gráfico
     9. Leitura    -> meta anual de livros + anel de progresso
    10. Configurações -> nome, tema, backup (exportar/importar)
    11. Foco       -> relógio + Pomodoro + tempo de estudo
    12. Lembretes  -> notificações nos horários escolhidos
    13. Hábitos    -> checklist diário + sequência
    14. XP         -> pontos, níveis, sequência, medalhas, confete
    15. Finanças   -> gastos do mês + metas de economia
    16. Voz        -> fala o resumo + comandos de voz/texto
    17. Anotações  -> notas rápidas com data
    18. Service worker -> faz o app funcionar offline
   Para adicionar uma função nova no futuro, crie um bloco novo
   e registre-o em "modules" (lá embaixo).
   ========================================================= */

'use strict';

/* ---------- 1. STORE: tudo que é salvo fica aqui ---------- */
// Os dados ficam num único objeto salvo com a chave "atena-data".
// Assim fica fácil exportar/importar backup depois.
const STORAGE_KEY = 'atena-data';

// Valores iniciais (usados na primeira vez que o app abre)
const DEFAULT_DATA = {
  settings: {
    userTitle: 'senhor',     // como o app chama você
    assistantName: 'Atena',  // nome do assistente
    theme: 'dark',           // 'dark' ou 'light'
    focusMin: 25,            // minutos de foco no Pomodoro
    breakMin: 5,             // minutos de pausa
    splash: true,            // abertura com o Mega Brain
    splashVoice: true,       // Atena fala a saudação na abertura
    dayEnd: true,            // aviso do fechamento do dia
    dayEndTime: '21:00',     // horário do aviso
  },
  projects: [], // projetos: { id, name, weekday (0=domingo ... 6=sábado) }
  tasks: [],    // tarefas:  { id, projectId, title, doneDates: ['2026-11-22', ...] }
  habits: [],   // hábitos: { id, name, emoji, doneDates: [...] }
  xpLog: [],    // XP ganho: { key, date, amount, reason }
  badges: {},   // medalhas conquistadas: { 'first-task': '2026-11-22' }
  mindset: [],  // Mindset: { id, type: 'aprendizado'|'pensamento', text, ref, fav, createdAt }
  performance: {}, // desempenho por dia: { '2026-11-22': { score, focus, wins, errors } }
  reading: { goals: {}, books: [] }, // meta de leitura por ano + livros
  focusLog: [], // Pomodoros concluídos: { date, minutes, at }
  pomo: null,   // estado do timer: { mode, running, endsAt, remaining }
  reminders: null, // lembretes (criados com exemplos na primeira vez)
  finance: null, // finanças: { expenses: [...], goals: [...] } (criado na 1ª vez)
  notes: [],    // anotações: { id, text, createdAt, updatedAt } (datas em ISO)
  studies: null, // estudos: { plan, exams, questions } (criado na 1ª vez)
  moods: {},    // humor por dia: { '2026-11-22': { level: 1..5, note, at } }
  devProjects: [], // projetos de programação: { id, name, emoji, desc, tech, repo, status, steps, createdAt, finishedAt }
  workouts: [], // treinos: { id, date, name, exercises: [{ name, sets, reps, weight }], minutes, note }
  weekGoals: {}, // metas por semana: { '2026-11-16' (segunda): [{ id, text, done }] }
  dayEndShown: null, // último dia em que o aviso de fechamento apareceu
  // Filosofia do cérebro: { id, text, author, type: 'frase' | 'principio' }
  quotes: [
    { id: 'q1', type: 'frase', author: '', text: 'A disciplina é a ponte entre metas e conquistas.' },
    { id: 'q2', type: 'frase', author: '', text: 'Pequenos passos todos os dias constroem grandes resultados.' },
    { id: 'q3', type: 'principio', author: '', text: 'O cérebro se fortalece com cada desafio que você enfrenta.' },
    { id: 'q4', type: 'principio', author: '', text: 'Foque no progresso, não na perfeição.' },
    { id: 'q5', type: 'frase', author: '', text: 'Quem domina a própria mente domina o próprio dia.' },
  ],
  dailyQuote: null, // { date: '2026-11-22', id: 'q3' } = frase sorteada hoje
};

const Store = {
  data: null,
  onSave: null, // função chamada depois de cada gravação

  // Carrega do aparelho. Se não existir nada, usa os valores iniciais.
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      // "Mescla" com os padrões, para campos novos aparecerem em versões futuras
      this.data = { ...structuredClone(DEFAULT_DATA), ...saved };
      this.data.settings = { ...DEFAULT_DATA.settings, ...(saved && saved.settings) };
      // Migração: nas versões antigas as frases eram só texto. Agora são objetos.
      this.data.quotes = this.data.quotes.map((q) =>
        typeof q === 'string' ? { id: uid(), type: 'frase', author: '', text: q } : q);
    } catch (e) {
      this.data = structuredClone(DEFAULT_DATA);
    }
    return this.data;
  },

  // Grava no aparelho
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      if (this.onSave) this.onSave(); // usado pela sincronização na nuvem
    } catch (e) {
      console.warn('Não foi possível salvar:', e);
    }
  },
};

/* ---------- Pequenas funções de ajuda ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Data no formato "2026-11-22" (útil para comparar dias)
const dateKey = (d) => d.toLocaleDateString('sv-SE');
const todayKey = () => dateKey(new Date());

// Cria um id único simples para cada item (projeto, tarefa...)
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Protege contra código malicioso: transforma "<" em "&lt;" etc.
const esc = (txt) => String(txt).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Nomes dos dias (0 = domingo, como o JavaScript conta)
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/* ---------- 2. TEMA (escuro / claro) ---------- */
const ICON_MOON = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
const ICON_SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';

const Theme = {
  apply(theme) {
    document.documentElement.dataset.theme = theme;
    // No modo escuro mostramos o sol (para ir pro claro) e vice-versa
    $('#themeIcon').innerHTML = theme === 'dark' ? ICON_SUN : ICON_MOON;
    $('meta[name="theme-color"]').content = theme === 'dark' ? '#070b1a' : '#eef2fb';
  },
  // Muda o tema e salva
  set(theme) {
    Store.data.settings.theme = theme;
    Store.save();
    this.apply(theme);
  },
  init() {
    this.apply(Store.data.settings.theme);
    $('#themeToggle').addEventListener('click', () => {
      this.set(Store.data.settings.theme === 'dark' ? 'light' : 'dark');
    });
  },
};

/* ---------- 3. NAVEGAÇÃO entre telas ---------- */
const Router = {
  go(name) {
    const screen = $(`.screen[data-screen="${name}"]`);
    if (!screen) return;
    $$('.screen').forEach((s) => s.classList.toggle('active', s === screen));
    // Telas "filhas" (ex.: Anotações) mantêm acesa a aba "mãe" (Mais)
    const tabName = screen.dataset.parent || name;
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.go === tabName));
    window.scrollTo({ top: 0 });
  },
  init() {
    // Quando a página rola, a barra do topo ganha fundo de vidro
    // (assim o conteúdo não fica por baixo do nome "Atena")
    window.addEventListener('scroll', () => {
      $('.topbar').classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });

    // Qualquer botão com data-go="nome" abre a tela com esse nome
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-go]');
      if (btn) this.go(btn.dataset.go);
    });
  },
};

/* ---------- 4. TELA INICIAL ---------- */
const Home = {
  // Escolhe a saudação pelo horário
  greetingText() {
    const h = new Date().getHours();
    const title = Store.data.settings.userTitle;
    let period;
    if (h >= 5 && h < 12) period = 'Bom dia';
    else if (h >= 12 && h < 18) period = 'Boa tarde';
    else period = 'Boa noite';
    return `${period}, ${title}! Tudo bem?`;
  },


  // Monta o resumo do dia com o que já existe salvo
  summary() {
    const today = todayKey();
    const tasks = Tasks.tasksForDay(new Date().getDay());
    const done = tasks.filter((t) => t.doneDates.includes(today)).length;
    const habits = Store.data.habits;
    const habitsDone = habits.filter((h) => h.doneDates && h.doneDates.includes(today)).length;
    const xp = Store.data.xpLog.filter((x) => x.date === today).reduce((s, x) => s + x.amount, 0);
    return { total: tasks.length, done, habits: habits.length, habitsDone, xp };
  },

  render() {
    const s = Store.data.settings;
    $('#assistantName').textContent = s.assistantName;
    $('#greeting').textContent = this.greetingText();

    // Ex.: "domingo, 22 de novembro de 2026"
    const date = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    // Deixa só a primeira letra maiúscula: "Domingo, 22 de novembro de 2026"
    $('#todayDate').textContent = date.charAt(0).toUpperCase() + date.slice(1);

    const q = Philosophy.today();
    $('#dailyQuote').textContent = q ? `“${q.text}”` : 'Cadastre suas frases na seção Filosofia do cérebro.';
    $('#dailyQuoteAuthor').textContent = q && q.author ? `— ${q.author}` : '';

    const sum = this.summary();
    $('#statTasks').textContent = `${sum.done}/${sum.total}`;
    $('#statHabits').textContent = `${sum.habitsDone}/${sum.habits}`;
    $('#statXp').textContent = sum.xp;

    const pending = sum.total - sum.done;
    $('#daySummary').textContent = sum.total
      ? `Você tem ${pending} tarefa(s) pendente(s) e já concluiu ${sum.done}. Vamos com tudo!`
      : `Nenhuma tarefa cadastrada para hoje ainda. Que tal definir suas prioridades, ${s.userTitle}?`;

    // Barra de progresso (com pequeno atraso para a animação aparecer)
    const pct = sum.total ? Math.round((sum.done / sum.total) * 100) : 0;
    setTimeout(() => { $('#dayProgress').style.width = pct + '%'; }, 300);
    WeekGoals.render();
    DayEnd.render();
  },

  init() {
    this.render();
    // Atualiza a saudação a cada minuto (ex.: muda de "Bom dia" para "Boa tarde")
    setInterval(() => this.render(), 60 * 1000);
  },
};


/* ---------- 5. PROJETOS E TAREFAS ---------- */
// Cada projeto pertence a um dia da semana (ex.: "Faculdade" na segunda).
// As tarefas se repetem toda semana; marcar como concluída vale só
// para a data daquela semana (guardada em doneDates).
const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

const Tasks = {
  selectedDay: new Date().getDay(), // começa no dia de hoje

  // Data real do dia escolhido NESTA semana (semana começando na segunda)
  dateForWeekday(wd) {
    const now = new Date();
    const offset = ((wd + 6) % 7) - ((now.getDay() + 6) % 7);
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    return dateKey(d);
  },

  projectsForDay(wd) {
    return Store.data.projects.filter((p) => p.weekday === wd);
  },

  tasksForDay(wd) {
    const ids = this.projectsForDay(wd).map((p) => p.id);
    return Store.data.tasks.filter((t) => ids.includes(t.projectId));
  },

  // ----- Ações (cada uma salva e redesenha a tela) -----
  addProject(name) {
    Store.data.projects.push({ id: uid(), name, weekday: this.selectedDay });
    this.commit();
  },
  renameProject(id) {
    const p = Store.data.projects.find((x) => x.id === id);
    const name = prompt('Novo nome do projeto:', p.name);
    if (name && name.trim()) { p.name = name.trim(); this.commit(); }
  },
  deleteProject(id) {
    if (!confirm('Apagar este projeto e todas as tarefas dele?')) return;
    Store.data.projects = Store.data.projects.filter((p) => p.id !== id);
    Store.data.tasks = Store.data.tasks.filter((t) => t.projectId !== id);
    this.commit();
  },
  addTask(projectId, title) {
    Store.data.tasks.push({ id: uid(), projectId, title, doneDates: [] });
    this.commit();
  },
  renameTask(id) {
    const t = Store.data.tasks.find((x) => x.id === id);
    const title = prompt('Editar tarefa:', t.title);
    if (title && title.trim()) { t.title = title.trim(); this.commit(); }
  },
  deleteTask(id) {
    Store.data.tasks = Store.data.tasks.filter((t) => t.id !== id);
    this.commit();
  },
  toggleTask(id, li) {
    const t = Store.data.tasks.find((x) => x.id === id);
    const date = this.dateForWeekday(this.selectedDay);
    const isDone = t.doneDates.includes(date);
    t.doneDates = isDone ? t.doneDates.filter((d) => d !== date) : [...t.doneDates, date];
    Store.save();
    // XP: +10 ao concluir, retira se desmarcar
    const key = `task:${t.id}:${date}`;
    if (isDone) XP.revoke(key); else XP.award(key, 'task', t.title, date);

    // Anima direto no item (sem redesenhar tudo, para a animação aparecer)
    li.classList.toggle('done', !isDone);
    if (!isDone) this.celebrate(li);
    this.renderProgress(li.closest('.project'));
    Home.render();
  },

  // Animação ao concluir: a caixinha "pula" e soltam faíscas
  celebrate(li) {
    li.classList.remove('pop'); void li.offsetWidth; li.classList.add('pop');
    const check = li.querySelector('.check');
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.style.setProperty('--a', i * 45 + 'deg');
      check.appendChild(s);
      setTimeout(() => s.remove(), 650);
    }
    if (navigator.vibrate) navigator.vibrate(15); // vibração curtinha no celular
  },

  commit() {
    Store.save();
    this.render();
    Home.render();
  },

  // ----- Desenho da tela -----
  renderWeekdays() {
    const today = new Date().getDay();
    const order = [1, 2, 3, 4, 5, 6, 0]; // segunda primeiro
    $('#weekdays').innerHTML = order.map((wd) => `
      <button class="wd ${wd === this.selectedDay ? 'active' : ''} ${wd === today ? 'today' : ''}"
              data-wd="${wd}" role="tab" aria-label="${WEEKDAYS[wd]}">${WEEKDAYS_SHORT[wd]}</button>`).join('');
    const [y, m, d] = this.dateForWeekday(this.selectedDay).split('-');
    $('#dayLabel').textContent = `${WEEKDAYS[this.selectedDay]}, ${d}/${m}` +
      (this.selectedDay === today ? ' · hoje' : '');
    $('#projectInput').placeholder = `Novo projeto para ${WEEKDAYS[this.selectedDay].toLowerCase()}...`;
  },

  renderProgress(card) {
    const date = this.dateForWeekday(this.selectedDay);
    const tasks = Store.data.tasks.filter((t) => t.projectId === card.dataset.id);
    const done = tasks.filter((t) => t.doneDates.includes(date)).length;
    card.querySelector('.project-count').textContent = `${done}/${tasks.length}`;
    card.querySelector('.progress-bar').style.width = tasks.length ? (done / tasks.length) * 100 + '%' : '0';
  },

  render() {
    this.renderWeekdays();
    const date = this.dateForWeekday(this.selectedDay);
    const projects = this.projectsForDay(this.selectedDay);

    if (!projects.length) {
      $('#projectList').innerHTML = `<div class="card glass empty">Nenhum projeto para ${WEEKDAYS[this.selectedDay].toLowerCase()} ainda.<br>Crie o primeiro no campo acima.</div>`;
      return;
    }

    $('#projectList').innerHTML = projects.map((p, i) => {
      const tasks = Store.data.tasks.filter((t) => t.projectId === p.id);
      return `
      <article class="card glass project" data-id="${p.id}" style="--i:${i}">
        <div class="project-head">
          <span class="project-name">${esc(p.name)}</span>
          <span class="project-count"></span>
          <button class="mini-btn" data-act="edit-project" aria-label="Renomear projeto">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del-project" aria-label="Apagar projeto">${ICON_TRASH}</button>
        </div>
        <div class="progress"><span class="progress-bar"></span></div>
        <ul class="task-list">
          ${tasks.map((t) => `
            <li class="task ${t.doneDates.includes(date) ? 'done' : ''}" data-id="${t.id}">
              <button class="check" data-act="toggle" aria-label="Concluir tarefa">${ICON_CHECK}</button>
              <span class="task-title">${esc(t.title)}</span>
              <button class="mini-btn" data-act="edit-task" aria-label="Editar tarefa">${ICON_EDIT}</button>
              <button class="mini-btn" data-act="del-task" aria-label="Apagar tarefa">${ICON_TRASH}</button>
            </li>`).join('')}
        </ul>
        <form class="add-row task-add" data-act="add-task" autocomplete="off">
          <input maxlength="100" placeholder="Nova tarefa..." aria-label="Nova tarefa" />
          <button class="add-btn" aria-label="Adicionar tarefa">+</button>
        </form>
      </article>`;
    }).join('');

    $$('#projectList .project').forEach((card) => this.renderProgress(card));
  },

  init() {
    // Trocar de dia
    $('#weekdays').addEventListener('click', (e) => {
      const btn = e.target.closest('.wd');
      if (!btn) return;
      this.selectedDay = Number(btn.dataset.wd);
      this.render();
    });

    // Criar projeto
    $('#projectForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#projectInput').value.trim();
      if (!name) return;
      $('#projectInput').value = '';
      this.addProject(name);
    });

    // Um único "ouvinte" cuida de todos os botões da lista (mais leve)
    $('#projectList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.tagName === 'FORM') return;
      const card = btn.closest('.project');
      const li = btn.closest('.task');
      switch (btn.dataset.act) {
        case 'toggle': this.toggleTask(li.dataset.id, li); break;
        case 'edit-task': this.renameTask(li.dataset.id); break;
        case 'del-task': this.deleteTask(li.dataset.id); break;
        case 'edit-project': this.renameProject(card.dataset.id); break;
        case 'del-project': this.deleteProject(card.dataset.id); break;
      }
    });

    // Criar tarefa dentro de um projeto
    $('#projectList').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      const title = input.value.trim();
      if (!title) return;
      const projectId = e.target.closest('.project').dataset.id;
      this.addTask(projectId, title);
      // Mantém o cursor no campo para digitar a próxima tarefa
      const again = $(`.project[data-id="${projectId}"] .task-add input`);
      if (again) again.focus();
    });

    this.render();
  },
};

/* ---------- 6. FILOSOFIA DO CÉREBRO ---------- */
const Philosophy = {
  editingId: null,
  filter: 'all',

  // Frase de hoje: sorteada na primeira vez que o app abre no dia e guardada,
  // assim fica a mesma o dia inteiro.
  today() {
    const quotes = Store.data.quotes;
    if (!quotes.length) return null;
    const dq = Store.data.dailyQuote;
    const current = dq && dq.date === todayKey() && quotes.find((q) => q.id === dq.id);
    if (current) return current;
    return this.pick();
  },

  // Sorteia uma frase (evitando repetir a atual, se houver outras)
  pick() {
    const quotes = Store.data.quotes;
    const currentId = Store.data.dailyQuote && Store.data.dailyQuote.id;
    const options = quotes.length > 1 ? quotes.filter((q) => q.id !== currentId) : quotes;
    const chosen = options[Math.floor(Math.random() * options.length)];
    Store.data.dailyQuote = { date: todayKey(), id: chosen.id };
    Store.save();
    return chosen;
  },

  save(text, author, type) {
    if (this.editingId) {
      const q = Store.data.quotes.find((x) => x.id === this.editingId);
      Object.assign(q, { text, author, type });
    } else {
      Store.data.quotes.unshift({ id: uid(), text, author, type });
    }
    Store.save();
    this.resetForm();
    this.refresh();
  },

  edit(id) {
    const q = Store.data.quotes.find((x) => x.id === id);
    this.editingId = id;
    $('#philoText').value = q.text;
    $('#philoAuthor').value = q.author || '';
    $(`input[name="philoType"][value="${q.type}"]`).checked = true;
    $('#philoSave').textContent = 'Atualizar';
    $('#philoCancel').hidden = false;
    $('#philoForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#philoText').focus();
  },

  remove(id, card) {
    if (!confirm('Apagar este item?')) return;
    Store.data.quotes = Store.data.quotes.filter((x) => x.id !== id);
    Store.save();
    if (this.editingId === id) this.resetForm();
    card.classList.add('leaving');
    setTimeout(() => this.refresh(), 300);
  },

  resetForm() {
    this.editingId = null;
    $('#philoText').value = '';
    $('#philoAuthor').value = '';
    $('input[name="philoType"][value="frase"]').checked = true;
    $('#philoSave').textContent = 'Salvar';
    $('#philoCancel').hidden = true;
  },

  // Redesenha esta tela e a tela inicial (que mostra a frase do dia)
  refresh() {
    this.render();
    Home.render();
  },

  render() {
    const q = this.today();
    $('#philoToday').textContent = q ? `“${q.text}”` : 'Nenhuma frase cadastrada ainda.';
    $('#philoTodayAuthor').textContent = q && q.author ? `— ${q.author}` : '';
    $('#philoShuffle').hidden = Store.data.quotes.length < 2;

    $$('#philoFilter .seg').forEach((b) => b.classList.toggle('active', b.dataset.filter === this.filter));
    const list = Store.data.quotes.filter((x) => this.filter === 'all' || x.type === this.filter);
    if (!list.length) {
      $('#philoList').innerHTML = '<div class="card glass empty">Nada por aqui ainda.<br>Cadastre no formulário acima.</div>';
      return;
    }
    $('#philoList').innerHTML = list.map((x, i) => `
      <article class="card glass note philo ${q && q.id === x.id ? 'is-today' : ''}" data-id="${x.id}" style="--i:${Math.min(i, 8)}">
        <span class="tag ${x.type}">${x.type === 'principio' ? 'Princípio' : 'Frase'}</span>
        <p class="note-text">${esc(x.text)}</p>
        <div class="note-foot">
          <span class="note-date">${x.author ? '— ' + esc(x.author) : ''}</span>
          <button class="mini-btn" data-act="edit" aria-label="Editar">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del" aria-label="Apagar">${ICON_TRASH}</button>
        </div>
      </article>`).join('');
  },

  init() {
    $('#philoForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('#philoText').value.trim();
      if (!text) return;
      const type = $('input[name="philoType"]:checked').value;
      this.save(text, $('#philoAuthor').value.trim(), type);
    });
    $('#philoCancel').addEventListener('click', () => this.resetForm());
    $('#philoShuffle').addEventListener('click', () => {
      this.pick();
      this.refresh();
      const card = $('.today-quote');
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    });
    $('#philoFilter').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      this.filter = b.dataset.filter;
      this.render();
    });
    $('#philoList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('.philo');
      if (btn.dataset.act === 'edit') this.edit(card.dataset.id);
      if (btn.dataset.act === 'del') this.remove(card.dataset.id, card);
    });
    this.render();
  },
};

/* ---------- 7. MINDSET ---------- */
// Aprendizados e pensamentos positivos do livro Mindset.
const ICON_STAR = '<svg viewBox="0 0 24 24"><path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/></svg>';

const Mindset = {
  editingId: null,
  filter: 'all',

  save(text, ref, type) {
    if (this.editingId) {
      Object.assign(Store.data.mindset.find((x) => x.id === this.editingId), { text, ref, type });
    } else {
      Store.data.mindset.unshift({ id: uid(), type, text, ref, fav: false, createdAt: new Date().toISOString() });
    }
    Store.save();
    this.resetForm();
    this.render();
  },

  edit(id) {
    const m = Store.data.mindset.find((x) => x.id === id);
    this.editingId = id;
    $('#msText').value = m.text;
    $('#msRef').value = m.ref || '';
    $(`input[name="msType"][value="${m.type}"]`).checked = true;
    $('#msSave').textContent = 'Atualizar';
    $('#msCancel').hidden = false;
    $('#msForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#msText').focus();
  },

  remove(id, card) {
    if (!confirm('Apagar este item?')) return;
    Store.data.mindset = Store.data.mindset.filter((x) => x.id !== id);
    Store.save();
    if (this.editingId === id) this.resetForm();
    card.classList.add('leaving');
    setTimeout(() => this.render(), 300);
  },

  toggleFav(id, btn) {
    const m = Store.data.mindset.find((x) => x.id === id);
    m.fav = !m.fav;
    Store.save();
    btn.classList.toggle('on', m.fav);
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    this.renderHeader();
    if (this.filter === 'fav') this.render();
  },

  resetForm() {
    this.editingId = null;
    $('#msText').value = '';
    $('#msRef').value = '';
    $('input[name="msType"][value="aprendizado"]').checked = true;
    $('#msSave').textContent = 'Salvar';
    $('#msCancel').hidden = true;
  },

  renderHeader() {
    const all = Store.data.mindset;
    const favs = all.filter((x) => x.fav);
    $('#msCountLearn').textContent = all.filter((x) => x.type === 'aprendizado').length;
    $('#msCountThought').textContent = all.filter((x) => x.type === 'pensamento').length;
    $('#msCountFav').textContent = favs.length;
    // Lembrete: um favorito sorteado (ou qualquer item, se não houver favoritos)
    const pool = favs.length ? favs : all;
    $('#msReminder').textContent = pool.length
      ? `“${pool[Math.floor(Math.random() * pool.length)].text}”`
      : 'Habilidades se desenvolvem com esforço, estratégia e ajuda. Registre aqui o que o livro te ensinar.';
  },

  render() {
    this.renderHeader();
    $$('#msFilter .seg').forEach((b) => b.classList.toggle('active', b.dataset.filter === this.filter));
    const list = Store.data.mindset.filter((x) =>
      this.filter === 'all' || (this.filter === 'fav' ? x.fav : x.type === this.filter));
    if (!list.length) {
      $('#msList').innerHTML = '<div class="card glass empty">Nada por aqui ainda.<br>Escreva no formulário acima.</div>';
      return;
    }
    $('#msList').innerHTML = list.map((x, i) => `
      <article class="card glass note ms" data-id="${x.id}" style="--i:${Math.min(i, 8)}">
        <span class="tag ${x.type === 'pensamento' ? 'positivo' : ''}">${x.type === 'pensamento' ? 'Pensamento positivo' : 'Aprendizado'}</span>
        <p class="note-text">${esc(x.text)}</p>
        <div class="note-foot">
          <span class="note-date">${x.ref ? esc(x.ref) + ' · ' : ''}${new Date(x.createdAt).toLocaleDateString('pt-BR')}</span>
          <button class="mini-btn star ${x.fav ? 'on' : ''}" data-act="fav" aria-label="Favoritar">${ICON_STAR}</button>
          <button class="mini-btn" data-act="edit" aria-label="Editar">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del" aria-label="Apagar">${ICON_TRASH}</button>
        </div>
      </article>`).join('');
  },

  init() {
    $('#msForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('#msText').value.trim();
      if (!text) return;
      this.save(text, $('#msRef').value.trim(), $('input[name="msType"]:checked').value);
    });
    $('#msCancel').addEventListener('click', () => this.resetForm());
    $('#msFilter').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      this.filter = b.dataset.filter;
      this.render();
    });
    $('#msList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('.ms');
      const id = card.dataset.id;
      if (btn.dataset.act === 'fav') this.toggleFav(id, btn);
      if (btn.dataset.act === 'edit') this.edit(id);
      if (btn.dataset.act === 'del') this.remove(id, card);
    });
    this.render();
  },
};

/* ---------- 8. DESEMPENHO ---------- */
// Cada dia fica salvo assim: performance['2026-11-22'] = { score, focus, wins, errors }
const Performance = {
  range: 7, // quantos dias o gráfico mostra

  // Lista dos últimos N dias (do mais antigo ao mais novo)
  lastDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(dateKey(d));
    }
    return out;
  },

  // Preenche o formulário com o dia escolhido (se já houver registro)
  loadForm(date) {
    const e = Store.data.performance[date];
    $('#perfDate').value = date;
    $('#perfScore').value = e ? e.score : 7;
    $('#perfFocus').value = e ? e.focus : 70;
    $('#perfWins').value = e ? e.wins : '';
    $('#perfErrors').value = e ? e.errors : '';
    $('#perfSave').textContent = e ? 'Atualizar dia' : 'Salvar dia';
    this.updateOutputs();
  },

  updateOutputs() {
    $('#perfScoreOut').textContent = $('#perfScore').value;
    $('#perfFocusOut').textContent = $('#perfFocus').value + '%';
    // Pinta a parte "cheia" do controle deslizante
    ['#perfScore', '#perfFocus'].forEach((id) => {
      const el = $(id);
      el.style.setProperty('--fill', (el.value / el.max) * 100 + '%');
    });
  },

  save() {
    const date = $('#perfDate').value || todayKey();
    Store.data.performance[date] = {
      score: Number($('#perfScore').value),
      focus: Number($('#perfFocus').value),
      wins: $('#perfWins').value.trim(),
      errors: $('#perfErrors').value.trim(),
    };
    Store.save();
    XP.award(`perf:${date}`, 'perf', 'Registro do dia', date);
    $('#perfSave').textContent = 'Salvo ✓';
    setTimeout(() => this.loadForm(date), 1200);
    this.render();
  },

  remove(date) {
    if (!confirm('Apagar o registro deste dia?')) return;
    delete Store.data.performance[date];
    Store.save();
    this.loadForm($('#perfDate').value);
    this.render();
  },

  // ----- Gráfico em SVG (sem bibliotecas) -----
  renderChart() {
    const days = this.lastDays(this.range);
    const data = Store.data.performance;
    const W = 320, H = 150, P = 10; // largura, altura e margem do desenho
    const x = (i) => P + (i * (W - 2 * P)) / (days.length - 1);
    const y = (v) => H - P - (v / 100) * (H - 2 * P); // v vai de 0 a 100

    // Monta a linha ligando só os dias que têm registro
    const series = (getValue) => {
      const pts = days.map((d, i) => (data[d] ? [x(i), y(getValue(data[d]))] : null)).filter(Boolean);
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2"/>`).join('');
      return { line, dots, count: pts.length };
    };
    const score = series((e) => e.score * 10);
    const focus = series((e) => e.focus);

    // Linhas de fundo (0, 50, 100)
    const grid = [0, 50, 100].map((v) =>
      `<line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`).join('');

    // Rótulos dos dias embaixo (no modo 30 dias, só alguns)
    const step = this.range === 7 ? 1 : 5;
    const labels = days.map((d, i) => {
      if (i % step && i !== days.length - 1) return '';
      const [, m, dd] = d.split('-');
      const txt = this.range === 7 ? WEEKDAYS_SHORT[new Date(d + 'T12:00').getDay()] : `${dd}/${m}`;
      return `<text x="${x(i)}" y="${H + 12}" text-anchor="middle">${txt}</text>`;
    }).join('');

    // Faixa do humor (embaixo dos dias): emoji no modo 7 dias, bolinha colorida no de 30
    const moodRow = days.map((d, i) => {
      const m = Store.data.moods[d];
      if (!m) return '';
      const mood = MOODS[m.level - 1];
      return this.range === 7
        ? `<text x="${x(i)}" y="${H + 34}" text-anchor="middle" class="mood-emoji">${mood.emoji}</text>`
        : `<circle cx="${x(i)}" cy="${H + 29}" r="3.4" fill="${mood.color}"/>`;
    }).join('');
    const moodCount = days.filter((d) => Store.data.moods[d]).length;

    if (!score.count && !moodCount) {
      $('#perfChart').innerHTML = `<div class="chart-empty">Registre seu primeiro dia abaixo para ver o gráfico.</div>`;
      return;
    }
    // pathLength="1" permite animar a linha "sendo desenhada"
    $('#perfChart').innerHTML = `
      <svg viewBox="0 0 ${W} ${H + 42}" role="img" aria-label="Gráfico de nota, foco e humor">
        <defs>
          <linearGradient id="gScore" x1="0" x2="1"><stop offset="0" stop-color="#3da9ff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
        </defs>
        ${grid}
        <path d="${focus.line}" class="line focus" pathLength="1"/>
        <path d="${score.line}" class="line score" pathLength="1"/>
        <g class="dots focus">${focus.dots}</g>
        <g class="dots score">${score.dots}</g>
        <g class="labels">${labels}</g>
        <g class="mood-row">${moodRow}</g>
      </svg>`;
  },

  renderAverages() {
    const entries = this.lastDays(this.range).map((d) => Store.data.performance[d]).filter(Boolean);
    const avg = (f) => entries.reduce((s, e) => s + f(e), 0) / entries.length;
    $('#avgScore').textContent = entries.length ? avg((e) => e.score).toFixed(1) : '–';
    $('#avgFocus').textContent = entries.length ? Math.round(avg((e) => e.focus)) + '%' : '–';
    $('#daysLogged').textContent = entries.length;
    Mood.renderInsight(this.lastDays(this.range));
  },

  renderList() {
    const dates = Object.keys(Store.data.performance).sort().reverse().slice(0, 30);
    if (!dates.length) {
      $('#perfList').innerHTML = '<div class="card glass empty">Nenhum dia registrado ainda.</div>';
      return;
    }
    $('#perfList').innerHTML = dates.map((d, i) => {
      const e = Store.data.performance[d];
      const label = new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      return `
      <article class="card glass note perf-item" data-date="${d}" style="--i:${Math.min(i, 8)}">
        <div class="perf-item-head">
          <span class="perf-badge">${e.score}</span>
          <div class="perf-item-info">
            <strong>${label}</strong>
            <span class="note-date">Foco ${e.focus}%${Store.data.moods[d] ? ' · humor ' + MOODS[Store.data.moods[d].level - 1].emoji : ''}</span>
          </div>
          <button class="mini-btn" data-act="edit" aria-label="Editar dia">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del" aria-label="Apagar dia">${ICON_TRASH}</button>
        </div>
        ${e.wins ? `<p class="perf-line win"><b>Vitórias:</b> ${esc(e.wins)}</p>` : ''}
        ${e.errors ? `<p class="perf-line err"><b>Erros:</b> ${esc(e.errors)}</p>` : ''}
      </article>`;
    }).join('');
  },

  render() {
    this.renderChart();
    this.renderAverages();
    this.renderList();
  },

  init() {
    $('#perfDate').max = todayKey(); // não deixa escolher datas futuras
    this.loadForm(todayKey());
    $('#perfScore').addEventListener('input', () => this.updateOutputs());
    $('#perfFocus').addEventListener('input', () => this.updateOutputs());
    $('#perfDate').addEventListener('change', () => this.loadForm($('#perfDate').value || todayKey()));
    $('#perfForm').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
    $('#perfRange').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      this.range = Number(b.dataset.days);
      $$('#perfRange .seg').forEach((s) => s.classList.toggle('active', s === b));
      this.render();
    });
    $('#perfList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const date = btn.closest('.perf-item').dataset.date;
      if (btn.dataset.act === 'edit') {
        this.loadForm(date);
        $('#perfForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (btn.dataset.act === 'del') this.remove(date);
    });
    this.render();
  },
};

/* ---------- 9. META DE LEITURA ---------- */
// reading = { goals: { 2026: 12 }, books: [{ id, title, author, status: 'lido'|'lendo', rating, finishedAt, startedAt }] }
const ICON_BOOK_DONE = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

const Reading = {
  editingId: null,
  rating: 0,

  year: () => new Date().getFullYear(),
  goal() { return Store.data.reading.goals[this.year()] || 12; },

  readThisYear() {
    const y = String(this.year());
    return Store.data.reading.books.filter((b) => b.status === 'lido' && (b.finishedAt || '').startsWith(y));
  },

  setRating(v) {
    this.rating = v;
    $$('#bookStars button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) <= v));
  },

  save(title, author, status) {
    const books = Store.data.reading.books;
    if (this.editingId) {
      const b = books.find((x) => x.id === this.editingId);
      // Se mudou de "lendo" para "lido", marca a data de término hoje
      if (status === 'lido' && b.status !== 'lido') b.finishedAt = todayKey();
      Object.assign(b, { title, author, status, rating: status === 'lido' ? this.rating : 0 });
    } else {
      books.unshift({
        id: uid(), title, author, status,
        rating: status === 'lido' ? this.rating : 0,
        startedAt: todayKey(),
        finishedAt: status === 'lido' ? todayKey() : null,
      });
    }
    Store.save();
    // XP para cada livro lido que ainda não deu XP
    Store.data.reading.books.filter((b) => b.status === 'lido').forEach((b) => XP.award(`book:${b.id}`, 'book', b.title));
    this.resetForm();
    this.render();
  },

  // "Terminei!" num livro que estava sendo lido
  finish(id) {
    const b = Store.data.reading.books.find((x) => x.id === id);
    b.status = 'lido';
    b.finishedAt = todayKey();
    Store.save();
    XP.award(`book:${b.id}`, 'book', b.title);
    this.render();
    // Pequena comemoração no anel
    const ring = $('.ring-wrap');
    ring.classList.remove('cheer'); void ring.offsetWidth; ring.classList.add('cheer');
  },

  edit(id) {
    const b = Store.data.reading.books.find((x) => x.id === id);
    this.editingId = id;
    $('#bookTitle').value = b.title;
    $('#bookAuthor').value = b.author || '';
    $(`input[name="bookStatus"][value="${b.status}"]`).checked = true;
    this.setRating(b.rating || 0);
    this.toggleStars();
    $('#bookSave').textContent = 'Atualizar';
    $('#bookCancel').hidden = false;
    $('#bookForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  remove(id) {
    if (!confirm('Apagar este livro?')) return;
    Store.data.reading.books = Store.data.reading.books.filter((x) => x.id !== id);
    Store.save();
    if (this.editingId === id) this.resetForm();
    this.render();
  },

  resetForm() {
    this.editingId = null;
    $('#bookTitle').value = '';
    $('#bookAuthor').value = '';
    $('input[name="bookStatus"][value="lido"]').checked = true;
    this.setRating(0);
    this.toggleStars();
    $('#bookSave').textContent = 'Adicionar';
    $('#bookCancel').hidden = true;
  },

  // Estrelas só aparecem para livros já lidos
  toggleStars() {
    $('#bookStars').hidden = $('input[name="bookStatus"]:checked').value !== 'lido';
  },

  renderRing() {
    const done = this.readThisYear().length;
    const goal = this.goal();
    const pct = Math.min(100, (done / goal) * 100);
    $('#ringCount').textContent = done;
    $('#ringGoal').textContent = `de ${goal} livro${goal > 1 ? 's' : ''}`;
    $('#goalYear').textContent = this.year();
    $('#goalInput').value = goal;
    // Começa vazio e anima até o valor certo
    const fg = $('#ringFg');
    fg.style.strokeDashoffset = 100;
    requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = 100 - pct; }));

    // Ritmo: quantos livros por mês faltam para bater a meta
    const left = goal - done;
    const monthsLeft = 12 - new Date().getMonth(); // inclui o mês atual
    const perMonth = Math.ceil(left / monthsLeft);
    const msg = left <= 0
      ? 'Meta batida! Que orgulho. 🎉'
      : `Faltam ${left} livro(s): cerca de ${perMonth} por mês até dezembro.`;
    $('#ringPace').textContent = msg;
  },

  bookCard(b, i) {
    const stars = b.status === 'lido' && b.rating ? '★'.repeat(b.rating) + '☆'.repeat(5 - b.rating) : '';
    const info = b.status === 'lido'
      ? (b.finishedAt ? 'Terminado em ' + new Date(b.finishedAt + 'T12:00').toLocaleDateString('pt-BR') : '')
      : 'Desde ' + new Date(b.startedAt + 'T12:00').toLocaleDateString('pt-BR');
    return `
      <article class="card glass note book" data-id="${b.id}" style="--i:${Math.min(i, 8)}">
        <div class="book-head">
          <div class="book-spine ${b.status}"></div>
          <div class="book-info">
            <strong>${esc(b.title)}</strong>
            ${b.author ? `<span class="muted">${esc(b.author)}</span>` : ''}
            ${stars ? `<span class="book-stars">${stars}</span>` : ''}
            <span class="note-date">${info}</span>
          </div>
        </div>
        <div class="note-foot">
          <span class="note-date"></span>
          ${b.status === 'lendo' ? `<button class="ghost-btn small-btn finish-btn" data-act="finish">Terminei!</button>` : ''}
          <button class="mini-btn" data-act="edit" aria-label="Editar livro">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del" aria-label="Apagar livro">${ICON_TRASH}</button>
        </div>
      </article>`;
  },

  render() {
    this.renderRing();
    const reading = Store.data.reading.books.filter((b) => b.status === 'lendo');
    const read = this.readThisYear();
    $('#readingLabel').hidden = !reading.length;
    $('#readingList').innerHTML = reading.map((b, i) => this.bookCard(b, i)).join('');
    $('#readLabel').textContent = `Lidos em ${this.year()} (${read.length})`;
    $('#readList').innerHTML = read.length
      ? read.map((b, i) => this.bookCard(b, i)).join('')
      : '<div class="card glass empty">Nenhum livro lido este ano ainda.<br>Cadastre o primeiro acima.</div>';
  },

  init() {
    $('#goalForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = parseInt($('#goalInput').value, 10);
      if (n > 0) {
        Store.data.reading.goals[this.year()] = n;
        Store.save();
        this.renderRing();
      }
    });
    $('#bookForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#bookTitle').value.trim();
      if (!title) { $('#bookTitle').focus(); return; }
      this.save(title, $('#bookAuthor').value.trim(), $('input[name="bookStatus"]:checked').value);
    });
    $('#bookForm').addEventListener('change', (e) => { if (e.target.name === 'bookStatus') this.toggleStars(); });
    $('#bookStars').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      // Tocar de novo na mesma estrela zera a nota
      if (b) this.setRating(Number(b.dataset.v) === this.rating ? 0 : Number(b.dataset.v));
    });
    $('#bookCancel').addEventListener('click', () => this.resetForm());
    // Um ouvinte só para as duas listas
    ['#readingList', '#readList'].forEach((sel) => $(sel).addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.closest('.book').dataset.id;
      if (btn.dataset.act === 'finish') this.finish(id);
      if (btn.dataset.act === 'edit') this.edit(id);
      if (btn.dataset.act === 'del') this.remove(id);
    }));
    // Quando abrir a tela, anima o anel de novo
    $('[data-go="reading"]').addEventListener('click', () => this.renderRing());
    this.render();
  },
};

/* ---------- 10. CONFIGURAÇÕES ---------- */
// Mostra um aviso rápido embaixo da tela
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

const Settings = {
  fill() {
    const s = Store.data.settings;
    $('#setUserTitle').value = s.userTitle;
    $('#setAssistant').value = s.assistantName;
    $('#setFocusMin').value = s.focusMin;
    $('#setBreakMin').value = s.breakMin;
    this.preview();
    $$('#setTheme .seg').forEach((b) => b.classList.toggle('active', b.dataset.theme === s.theme));
    this.storageInfo();
  },

  // Mostra como vai ficar a saudação enquanto digita
  preview() {
    const title = $('#setUserTitle').value.trim() || 'senhor';
    const name = $('#setAssistant').value.trim() || 'Atena';
    $('#setPreview').textContent = `${name}: "Bom dia, ${title}! Tudo bem?"`;
  },

  save() {
    const s = Store.data.settings;
    s.userTitle = $('#setUserTitle').value.trim() || 'senhor';
    s.assistantName = $('#setAssistant').value.trim() || 'Atena';
    // Tempos do Pomodoro (limitados a valores razoáveis)
    s.focusMin = Math.min(120, Math.max(1, parseInt($('#setFocusMin').value, 10) || 25));
    s.breakMin = Math.min(60, Math.max(1, parseInt($('#setBreakMin').value, 10) || 5));
    Store.save();
    if (!Focus.state.running) Focus.reset(); // aplica o novo tempo no timer parado
    Home.render();
    toast('Configurações salvas ✓');
  },

  // ----- Exportar: cria um arquivo .json e baixa -----
  exportData() {
    const json = JSON.stringify({ app: 'atena', exportedAt: new Date().toISOString(), data: Store.data }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `atena-backup-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup exportado ✓');
  },

  // ----- Importar: lê o arquivo, confere e substitui os dados -----
  importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        // Aceita o formato do backup ({ app, data }) ou só os dados
        const data = parsed && parsed.app === 'atena' ? parsed.data : parsed;
        if (!data || typeof data !== 'object' || !data.settings) throw new Error('formato');
        if (!confirm('Importar este backup? Os dados atuais deste aparelho serão substituídos.')) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        location.reload(); // recarrega o app com os dados novos
      } catch (e) {
        toast('Arquivo inválido. Escolha um backup da Atena.');
      }
    };
    reader.readAsText(file);
  },

  resetAll() {
    if (!confirm('Tem certeza? Isso apaga TODOS os seus dados deste aparelho.')) return;
    if (!confirm('Última confirmação: apagar tudo mesmo?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  },

  storageInfo() {
    const bytes = (localStorage.getItem(STORAGE_KEY) || '').length * 2; // cada letra ~2 bytes
    const kb = (bytes / 1024).toFixed(1);
    $('#storageInfo').textContent = `Espaço usado: ${kb} KB (o limite do navegador é cerca de 5.000 KB).`;
  },

  init() {
    $('#settingsForm').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
    $('#setUserTitle').addEventListener('input', () => this.preview());
    $('#setAssistant').addEventListener('input', () => this.preview());
    $('#setTheme').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      Theme.set(b.dataset.theme);
      this.fill();
    });
    $('#exportBtn').addEventListener('click', () => this.exportData());
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      if (e.target.files[0]) this.importData(e.target.files[0]);
      e.target.value = ''; // permite escolher o mesmo arquivo de novo
    });
    $('#resetBtn').addEventListener('click', () => this.resetAll());
    // Atualiza os campos sempre que a tela é aberta
    $('[data-go="settings"]').addEventListener('click', () => this.fill());
    this.fill();
  },
};

/* ---------- 11. FOCO: RELÓGIO + POMODORO ---------- */
// O timer guarda a HORA EM QUE VAI TERMINAR (endsAt). Assim ele continua certo
// mesmo se o celular bloquear a tela ou a página for recarregada.
// focusLog = [{ date: '2026-11-22', minutes: 25, at: '...ISO' }]
const ICON_PLAY = '<path d="M7 4l13 8-13 8z"/>';
const ICON_PAUSE = '<path d="M7 4h4v16H7zM14 4h4v16h-4z"/>';

const Focus = {
  tick: null,

  durations() {
    const s = Store.data.settings;
    return { focus: (s.focusMin || 25) * 60, break: (s.breakMin || 5) * 60 };
  },

  // Estado do timer (fica salvo em Store.data.pomo)
  get state() {
    if (!Store.data.pomo) Store.data.pomo = { mode: 'focus', running: false, endsAt: null, remaining: this.durations().focus };
    return Store.data.pomo;
  },

  secondsLeft() {
    const st = this.state;
    return st.running ? Math.max(0, Math.round((st.endsAt - Date.now()) / 1000)) : st.remaining;
  },

  start() {
    const st = this.state;
    st.running = true;
    st.endsAt = Date.now() + st.remaining * 1000;
    Store.save();
    this.ensureAudio();
    this.render();
  },

  pause() {
    const st = this.state;
    st.remaining = this.secondsLeft();
    st.running = false;
    st.endsAt = null;
    Store.save();
    this.render();
  },

  setMode(mode) {
    const st = this.state;
    st.mode = mode;
    st.running = false;
    st.endsAt = null;
    st.remaining = this.durations()[mode];
    Store.save();
    this.render();
  },

  reset() { this.setMode(this.state.mode); },

  // Chamado quando o tempo acaba
  complete() {
    const st = this.state;
    if (st.mode === 'focus') {
      const minutes = Math.round(this.durations().focus / 60);
      const at = new Date().toISOString();
      Store.data.focusLog.push({ date: todayKey(), minutes, at });
      XP.award(`pomo:${at}`, 'pomo', 'Pomodoro');
      this.alert('Pomodoro concluído! Hora de uma pausa. ☕');
      this.setMode('break');
      this.start(); // a pausa começa sozinha
    } else {
      this.alert('Pausa terminada. Bora focar de novo! 🔥');
      this.setMode('focus');
    }
    this.renderStats();
  },

  // ----- Avisos: som, vibração e notificação -----
  ensureAudio() {
    // O navegador só deixa tocar som depois de um toque do usuário
    if (!this.audio) {
      try { this.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sem som */ }
    }
  },

  beep() {
    if (!this.audio) return;
    const ctx = this.audio;
    // Três notas curtinhas subindo (som original, gerado na hora)
    [660, 880, 1100].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.18);
    });
  },

  alert(msg) {
    this.beep();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    toast(msg);
    // Notificação do sistema (só se o usuário já tiver permitido; a permissão
    // será pedida na etapa de Lembretes)
    if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(Store.data.settings.assistantName, {
        body: msg, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [200, 100, 200],
      })).catch(() => {});
    }
  },

  // ----- Desenho -----
  fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },

  renderClock() {
    const now = new Date();
    $('#clockTime').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $('#clockSec').textContent = String(now.getSeconds()).padStart(2, '0');
    const d = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#clockDate').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  },

  render() {
    const st = this.state;
    const left = this.secondsLeft();
    const total = this.durations()[st.mode];
    $('#pomoTime').textContent = this.fmt(left);
    $('#pomoFg').style.strokeDashoffset = 100 - ((total - left) / total) * 100;
    $('#pomoCard').classList.toggle('is-break', st.mode === 'break');
    $('#pomoCard').classList.toggle('is-running', st.running);
    $$('#pomoMode .seg').forEach((b) => b.classList.toggle('active', b.dataset.mode === st.mode));
    $('#pomoStartIcon').innerHTML = st.running ? ICON_PAUSE : ICON_PLAY;
    $('#pomoStart').setAttribute('aria-label', st.running ? 'Pausar' : 'Iniciar');

    let label;
    if (st.mode === 'focus') label = st.running ? 'Focando…' : (left < total ? 'Pausado' : 'Pronto para focar');
    else label = st.running ? 'Respire, descanse' : 'Pausa';
    $('#pomoLabel').textContent = label;

    // Mostra o tempo no título da aba do navegador enquanto roda
    document.title = st.running ? `${this.fmt(left)} · ${st.mode === 'focus' ? 'Foco' : 'Pausa'}` : Store.data.settings.assistantName;
  },

  renderStats() {
    const log = Store.data.focusLog;
    const today = todayKey();
    const todayItems = log.filter((x) => x.date === today);
    const todayMin = todayItems.reduce((s, x) => s + x.minutes, 0);
    $('#focusToday').textContent = todayMin >= 60 ? `${Math.floor(todayMin / 60)}h${String(todayMin % 60).padStart(2, '0')}` : `${todayMin} min`;
    $('#focusSessions').textContent = todayItems.length;

    // Barras dos últimos 7 dias
    const days = Performance.lastDays(7);
    const mins = days.map((d) => log.filter((x) => x.date === d).reduce((s, x) => s + x.minutes, 0));
    const week = mins.reduce((a, b) => a + b, 0);
    $('#focusWeek').textContent = (week / 60).toFixed(1).replace('.', ',') + ' h';
    const max = Math.max(60, ...mins);
    $('#focusBars').innerHTML = days.map((d, i) => `
      <div class="wbar ${d === today ? 'today' : ''}" title="${mins[i]} min">
        <span style="height:${(mins[i] / max) * 100}%"></span>
        <small>${WEEKDAYS_SHORT[new Date(d + 'T12:00').getDay()]}</small>
      </div>`).join('');
  },

  // Roda 1x por segundo, mas só quando o app está visível
  loop() {
    clearInterval(this.tick);
    this.tick = setInterval(() => {
      if (document.hidden) return;
      this.renderClock();
      if (this.state.running) {
        if (this.secondsLeft() <= 0) this.complete();
        else this.render();
      }
    }, 1000);
  },

  init() {
    if (!Store.data.focusLog) Store.data.focusLog = [];
    $('#pomoStart').addEventListener('click', () => (this.state.running ? this.pause() : this.start()));
    $('#pomoReset').addEventListener('click', () => this.reset());
    $('#pomoSkip').addEventListener('click', () => this.setMode(this.state.mode === 'focus' ? 'break' : 'focus'));
    $('#pomoMode').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (b) this.setMode(b.dataset.mode);
    });
    // Ao voltar para o app, confere se o tempo acabou enquanto estava fora
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.state.running && this.secondsLeft() <= 0) this.complete();
    });
    if (this.state.running && this.secondsLeft() <= 0) this.complete();
    this.renderClock();
    this.render();
    this.renderStats();
    this.loop();
  },
};

/* ---------- 12. LEMBRETES ---------- */
// reminders = [{ id, time: '09:00', text, days: [0..6], enabled, lastFired: '2026-11-22' }]
// IMPORTANTE: sem um servidor, o navegador só consegue mostrar os lembretes
// enquanto o app estiver aberto ou minimizado. Notificações com o app
// totalmente fechado precisam de "push" por servidor (etapa de Sincronização).
const MOTIVATION = [
  'Um passo de cada vez. Você está indo bem!',
  'Lembre por que você começou.',
  'Foco no próximo pequeno passo.',
  'Disciplina hoje, liberdade amanhã.',
  'Beba um copo de água e respire fundo.',
  'Você é mais capaz do que imagina.',
  'Progresso, não perfeição.',
];

const Reminders = {
  editingId: null,
  timer: null,

  supported: () => 'Notification' in window,

  // ----- Permissão -----
  async askPermission() {
    if (!this.supported()) return;
    const result = await Notification.requestPermission();
    this.renderPerm();
    if (result === 'granted') this.notify('Notificações ativadas! Vou te lembrar nos horários escolhidos. 💙');
  },

  renderPerm() {
    let text, showBtn = true;
    if (!this.supported()) { text = 'Este navegador não aceita notificações. No celular, instale o app na tela inicial.'; showBtn = false; }
    else if (Notification.permission === 'granted') { text = 'Ativadas ✓. Os lembretes aparecem no celular (e no relógio, se ele espelhar as notificações).'; showBtn = false; }
    else if (Notification.permission === 'denied') { text = 'Bloqueadas. Libere nas configurações do navegador: cadeado ao lado do endereço → Notificações → Permitir.'; showBtn = false; }
    else text = 'Toque em "Permitir" para receber os lembretes como notificação.';
    $('#permText').textContent = text;
    $('#permBtn').hidden = !showBtn;
  },

  // Mostra a notificação (pelo service worker, que funciona melhor no celular)
  notify(body) {
    const title = Store.data.settings.assistantName;
    toast(body);
    if (!this.supported() || Notification.permission !== 'granted') return;
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [150, 80, 150], tag: 'atena-' + Date.now() };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts)).catch(() => new Notification(title, opts));
    } else {
      try { new Notification(title, opts); } catch (e) { /* alguns celulares só aceitam pelo service worker */ }
    }
  },

  textFor(r) {
    return r.text || MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)];
  },

  // ----- Verificação: roda a cada 20 segundos -----
  check() {
    const now = new Date();
    const today = todayKey();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let changed = false;
    Store.data.reminders.forEach((r) => {
      if (!r.enabled || r.lastFired === today || !r.days.includes(now.getDay())) return;
      const [h, m] = r.time.split(':').map(Number);
      const diff = nowMin - (h * 60 + m);
      // Dispara na hora certa, ou até 15 min depois se o app estava fechado
      if (diff >= 0 && diff <= 15) {
        r.lastFired = today;
        changed = true;
        this.notify(this.textFor(r));
      }
    });
    if (changed) { Store.save(); this.render(); }
  },

  // ----- CRUD -----
  selectedDays() {
    return [...$$('#remDays button.on')].map((b) => Number(b.dataset.d));
  },

  save() {
    const time = $('#remTime').value;
    const days = this.selectedDays();
    if (!time || !days.length) { toast('Escolha um horário e pelo menos um dia.'); return; }
    const text = $('#remText').value.trim();
    if (this.editingId) {
      const r = Store.data.reminders.find((x) => x.id === this.editingId);
      Object.assign(r, { time, text, days, lastFired: null });
    } else {
      Store.data.reminders.push({ id: uid(), time, text, days, enabled: true, lastFired: null });
    }
    Store.save();
    this.resetForm();
    this.render();
    if (this.supported() && Notification.permission === 'default') this.askPermission();
  },

  edit(id) {
    const r = Store.data.reminders.find((x) => x.id === id);
    this.editingId = id;
    $('#remTime').value = r.time;
    $('#remText').value = r.text;
    $$('#remDays button').forEach((b) => b.classList.toggle('on', r.days.includes(Number(b.dataset.d))));
    $('#remSave').textContent = 'Atualizar';
    $('#remCancel').hidden = false;
    $('#remForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  remove(id) {
    if (!confirm('Apagar este lembrete?')) return;
    Store.data.reminders = Store.data.reminders.filter((x) => x.id !== id);
    Store.save();
    if (this.editingId === id) this.resetForm();
    this.render();
  },

  toggle(id) {
    const r = Store.data.reminders.find((x) => x.id === id);
    r.enabled = !r.enabled;
    Store.save();
    this.render();
  },

  resetForm() {
    this.editingId = null;
    $('#remTime').value = '09:00';
    $('#remText').value = '';
    $$('#remDays button').forEach((b) => b.classList.add('on'));
    $('#remSave').textContent = 'Adicionar';
    $('#remCancel').hidden = true;
  },

  daysLabel(days) {
    if (days.length === 7) return 'Todos os dias';
    const wk = [1, 2, 3, 4, 5];
    if (days.length === 5 && wk.every((d) => days.includes(d))) return 'Segunda a sexta';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Fins de semana';
    return [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => WEEKDAYS[d].slice(0, 3)).join(', ');
  },

  render() {
    this.renderPerm();
    const list = [...Store.data.reminders].sort((a, b) => a.time.localeCompare(b.time));
    if (!list.length) {
      $('#remList').innerHTML = '<div class="card glass empty">Nenhum lembrete ainda.</div>';
      return;
    }
    $('#remList').innerHTML = list.map((r, i) => `
      <article class="card glass note rem ${r.enabled ? '' : 'off'}" data-id="${r.id}" style="--i:${Math.min(i, 8)}">
        <div class="rem-row">
          <div class="rem-info">
            <strong class="rem-time">${r.time}</strong>
            <span>${r.text ? esc(r.text) : '<i>Frase motivacional</i>'}</span>
            <span class="note-date">${this.daysLabel(r.days)}${r.lastFired === todayKey() ? ' · já avisou hoje' : ''}</span>
          </div>
          <button class="switch ${r.enabled ? 'on' : ''}" data-act="toggle" role="switch" aria-checked="${r.enabled}" aria-label="Ligar ou desligar"><span></span></button>
        </div>
        <div class="note-foot">
          <span class="note-date"></span>
          <button class="mini-btn" data-act="edit" aria-label="Editar lembrete">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del" aria-label="Apagar lembrete">${ICON_TRASH}</button>
        </div>
      </article>`).join('');
  },

  init() {
    // Lembretes de exemplo na primeira vez
    if (!Store.data.reminders) {
      Store.data.reminders = [
        { id: uid(), time: '09:00', text: 'Beba um copo de água 💧', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, lastFired: null },
        { id: uid(), time: '15:00', text: '', days: [1, 2, 3, 4, 5], enabled: true, lastFired: null },
        { id: uid(), time: '21:00', text: 'Registre como foi seu dia no Desempenho', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, lastFired: null },
      ];
      Store.save();
    }
    $('#permBtn').addEventListener('click', () => this.askPermission());
    $('#testNotif').addEventListener('click', () => this.notify(this.textFor({ text: '' })));
    $('#remDays').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) b.classList.toggle('on');
    });
    $('#remForm').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
    $('#remCancel').addEventListener('click', () => this.resetForm());
    $('#remList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.closest('.rem').dataset.id;
      if (btn.dataset.act === 'toggle') this.toggle(id);
      if (btn.dataset.act === 'edit') this.edit(id);
      if (btn.dataset.act === 'del') this.remove(id);
    });
    this.render();
    this.check();
    this.timer = setInterval(() => this.check(), 20 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
  },
};

/* ---------- 13. HÁBITOS ---------- */
// habits = [{ id, name, emoji, doneDates: ['2026-11-22', ...] }]
const DEFAULT_HABITS = [
  ['💧', 'Beber água'], ['😴', 'Dormir bem'], ['🏃', 'Exercício'],
  ['💊', 'Remédio no horário'], ['🇬🇧', 'Estudar inglês'],
];

const Habits = {
  isDone(h, date) { return h.doneDates.includes(date); },

  toggle(id, date) {
    const h = Store.data.habits.find((x) => x.id === id);
    const done = this.isDone(h, date);
    h.doneDates = done ? h.doneDates.filter((d) => d !== date) : [...h.doneDates, date];
    Store.save();
    const key = `habit:${h.id}:${date}`;
    if (done) XP.revoke(key); else XP.award(key, 'habit', h.name, date);
    return !done; // true = acabou de marcar
  },

  // Sequência: quantos dias seguidos até hoje (ou até ontem, se hoje ainda não marcou)
  streak(h) {
    let count = 0;
    const d = new Date();
    if (!this.isDone(h, dateKey(d))) d.setDate(d.getDate() - 1);
    while (this.isDone(h, dateKey(d))) { count++; d.setDate(d.getDate() - 1); }
    return count;
  },

  add(name, emoji) {
    Store.data.habits.push({ id: uid(), name, emoji: emoji || '⭐', doneDates: [] });
    Store.save();
    this.renderAll();
  },

  rename(id) {
    const h = Store.data.habits.find((x) => x.id === id);
    const name = prompt('Nome do hábito:', h.name);
    if (name && name.trim()) { h.name = name.trim(); Store.save(); this.renderAll(); }
  },

  remove(id) {
    if (!confirm('Apagar este hábito e todo o histórico dele?')) return;
    Store.data.habits = Store.data.habits.filter((x) => x.id !== id);
    Store.save();
    this.renderAll();
  },

  // Checklist da tela inicial
  renderHome() {
    const today = todayKey();
    const habits = Store.data.habits;
    $('#homeHabits').innerHTML = habits.length ? habits.map((h) => `
      <li class="task habit ${this.isDone(h, today) ? 'done' : ''}" data-id="${h.id}">
        <button class="check" data-act="toggle" aria-label="Marcar ${esc(h.name)}">${ICON_CHECK}</button>
        <span class="habit-emoji">${esc(h.emoji)}</span>
        <span class="task-title">${esc(h.name)}</span>
        ${this.streak(h) >= 2 ? `<span class="fire" title="Dias seguidos">🔥${this.streak(h)}</span>` : ''}
      </li>`).join('') : '<li class="muted">Cadastre hábitos em Mais → Hábitos.</li>';
  },

  // Tela completa com os últimos 7 dias
  renderList() {
    const days = Performance.lastDays(7);
    const habits = Store.data.habits;
    if (!habits.length) {
      $('#habitList').innerHTML = '<div class="card glass empty">Nenhum hábito ainda.</div>';
      return;
    }
    $('#habitList').innerHTML = habits.map((h, i) => {
      const s = this.streak(h);
      const week = days.filter((d) => this.isDone(h, d)).length;
      return `
      <article class="card glass habit-card" data-id="${h.id}" style="--i:${Math.min(i, 8)}">
        <div class="project-head">
          <span class="habit-emoji big">${esc(h.emoji)}</span>
          <span class="project-name">${esc(h.name)}</span>
          <span class="fire ${s ? '' : 'cold'}">🔥 ${s} dia${s === 1 ? '' : 's'}</span>
          <button class="mini-btn" data-act="edit" aria-label="Renomear">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del" aria-label="Apagar">${ICON_TRASH}</button>
        </div>
        <div class="habit-week">
          ${days.map((d) => `
            <button class="hday ${this.isDone(h, d) ? 'on' : ''} ${d === todayKey() ? 'today' : ''}" data-act="day" data-date="${d}"
                    aria-label="${d}">
              <small>${WEEKDAYS_SHORT[new Date(d + 'T12:00').getDay()]}</small>
              <i></i>
            </button>`).join('')}
        </div>
        <p class="note-date">${week} de 7 dias nesta semana</p>
      </article>`;
    }).join('');
  },

  renderAll() {
    this.renderHome();
    this.renderList();
    Home.render();
  },

  init() {
    if (!Store.data.habitsSeeded) {
      if (!Store.data.habits.length) {
        Store.data.habits = DEFAULT_HABITS.map(([emoji, name]) => ({ id: uid(), name, emoji, doneDates: [] }));
      }
      Store.data.habitsSeeded = true;
      Store.save();
    }
    // Tela inicial: marcar hábito de hoje
    $('#homeHabits').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act="toggle"]');
      if (!btn) return;
      const li = btn.closest('.habit');
      const nowDone = this.toggle(li.dataset.id, todayKey());
      li.classList.toggle('done', nowDone);
      if (nowDone) Tasks.celebrate(li);
      setTimeout(() => this.renderAll(), nowDone ? 650 : 0);
    });
    $('#habitForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#habitInput').value.trim();
      if (!name) return;
      this.add(name, $('#habitEmoji').value.trim());
      $('#habitInput').value = '';
    });
    $('#habitList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.closest('.habit-card').dataset.id;
      if (btn.dataset.act === 'day') {
        const on = this.toggle(id, btn.dataset.date);
        btn.classList.toggle('on', on);
        if (on) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
        setTimeout(() => this.renderAll(), 350);
      }
      if (btn.dataset.act === 'edit') this.rename(id);
      if (btn.dataset.act === 'del') this.remove(id);
    });
    this.renderHome();
    this.renderList();
  },
};

/* ---------- 14. PONTOS, NÍVEIS E CONQUISTAS ---------- */
// xpLog = [{ key, date, amount, reason }]. A "key" evita ganhar XP duas vezes
// pela mesma coisa (e permite tirar o XP se desmarcar a tarefa).
const XP_VALUES = { task: 10, habit: 5, pomo: 20, perf: 15, book: 50, quiz: 15, mood: 5, goal: 30, step: 5, proj: 100, workout: 25 };

// Medalhas: cada uma tem um teste que olha os dados
const BADGES = [
  { id: 'first-task', icon: '✅', name: 'Primeiro passo', desc: 'Conclua sua primeira tarefa', test: (s) => s.tasks >= 1 },
  { id: 'tasks-50', icon: '🏗️', name: 'Construtor', desc: 'Conclua 50 tarefas', test: (s) => s.tasks >= 50 },
  { id: 'first-pomo', icon: '🍅', name: 'Primeiro foco', desc: 'Complete 1 Pomodoro', test: (s) => s.pomos >= 1 },
  { id: 'pomo-25', icon: '🧠', name: 'Mente afiada', desc: 'Complete 25 Pomodoros', test: (s) => s.pomos >= 25 },
  { id: 'habits-30', icon: '🌱', name: 'Raízes fortes', desc: 'Cumpra hábitos 30 vezes', test: (s) => s.habits >= 30 },
  { id: 'streak-3', icon: '🔥', name: 'Aquecendo', desc: 'Sequência de 3 dias', test: (s) => s.bestStreak >= 3 },
  { id: 'streak-7', icon: '⚡', name: 'Semana perfeita', desc: 'Sequência de 7 dias', test: (s) => s.bestStreak >= 7 },
  { id: 'streak-30', icon: '🌟', name: 'Imparável', desc: 'Sequência de 30 dias', test: (s) => s.bestStreak >= 30 },
  { id: 'perf-7', icon: '📈', name: 'Autoconhecimento', desc: 'Registre 7 dias no Desempenho', test: (s) => s.perfDays >= 7 },
  { id: 'mood-7', icon: '🙂', name: 'Autoconsciente', desc: 'Registre o humor em 7 dias', test: (s) => s.moods >= 7 },
  { id: 'goals-3', icon: '🎯', name: 'Semana cumprida', desc: 'Cumpra 3 metas da semana', test: (s) => s.goals >= 3 },
  { id: 'proj-1', icon: '🚀', name: 'Deploy feito', desc: 'Conclua 1 projeto de programação', test: (s) => s.projs >= 1 },
  { id: 'workout-10', icon: '🏋️', name: 'Atleta', desc: 'Registre 10 treinos', test: (s) => s.workouts >= 10 },
  { id: 'book-1', icon: '📖', name: 'Leitor', desc: 'Termine 1 livro', test: (s) => s.books >= 1 },
  { id: 'level-5', icon: '🦉', name: 'Sábio', desc: 'Chegue ao nível 5', test: (s) => s.level >= 5 },
  { id: 'level-10', icon: '👑', name: 'Mestre', desc: 'Chegue ao nível 10', test: (s) => s.level >= 10 },
];

const XP = {
  // Nível N começa em 50 × N × (N − 1) XP: 0, 100, 300, 600, 1000, 1500...
  levelStart: (n) => 50 * n * (n - 1),
  total() { return Store.data.xpLog.reduce((s, x) => s + x.amount, 0); },
  level(total = this.total()) {
    let n = 1;
    while (total >= this.levelStart(n + 1)) n++;
    return n;
  },

  // Dá XP (se ainda não deu por essa mesma "key")
  award(key, type, reason, date = todayKey()) {
    if (Store.data.xpLog.some((x) => x.key === key)) return;
    const before = this.level();
    const amount = XP_VALUES[type];
    Store.data.xpLog.push({ key, date, amount, reason });
    Store.save();
    this.floatXp(amount);
    const after = this.level();
    if (after > before) this.levelUp(after);
    this.checkBadges();
    this.render();
  },

  // Tira o XP (ex.: desmarcou a tarefa)
  revoke(key) {
    const n = Store.data.xpLog.length;
    Store.data.xpLog = Store.data.xpLog.filter((x) => x.key !== key);
    if (Store.data.xpLog.length !== n) { Store.save(); this.render(); }
  },

  // Sequência geral: dias seguidos em que ganhou algum XP
  streakInfo() {
    const days = new Set(Store.data.xpLog.map((x) => x.date));
    let current = 0;
    const d = new Date();
    if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dateKey(d))) { current++; d.setDate(d.getDate() - 1); }
    // Melhor sequência de todas
    let best = 0, run = 0, prev = null;
    [...days].sort().forEach((k) => {
      const t = new Date(k + 'T12:00').getTime();
      run = prev && t - prev < 1.5 * 86400000 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    });
    return { current, best: Math.max(best, current) };
  },

  stats() {
    const log = Store.data.xpLog;
    const count = (p) => log.filter((x) => x.key.startsWith(p)).length;
    return {
      tasks: count('task:'), habits: count('habit:'), pomos: count('pomo:'),
      perfDays: count('perf:'), books: count('book:'), moods: count('mood:'), goals: count('goal:'), projs: count('proj:'), workouts: count('workout:'),
      bestStreak: this.streakInfo().best, level: this.level(),
    };
  },

  checkBadges() {
    const s = this.stats();
    const got = Store.data.badges;
    BADGES.forEach((b) => {
      if (!got[b.id] && b.test(s)) {
        got[b.id] = todayKey();
        Store.save();
        setTimeout(() => { toast(`Medalha conquistada: ${b.icon} ${b.name}!`); Sound.chime(); }, 900);
      }
    });
  },

  // "+10 XP" subindo na tela
  floatXp(amount) {
    const el = document.createElement('div');
    el.className = 'xp-float';
    el.textContent = `+${amount} XP`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  },

  levelUp(n) {
    const msgs = ['Você está ficando imparável!', 'Mais forte a cada dia.', 'A sabedoria cresce com a prática.', 'Disciplina gera resultados. Parabéns!'];
    $('#levelUpNum').textContent = n;
    $('#levelUpMsg').textContent = msgs[n % msgs.length];
    $('#levelUp').hidden = false;
    Confetti.burst();
    Sound.fanfare();
    if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 200]);
  },

  render() {
    const total = this.total();
    const lv = this.level(total);
    const start = this.levelStart(lv);
    const next = this.levelStart(lv + 1);
    const { current } = this.streakInfo();
    // Cartão da tela inicial
    $('#levelBadge').textContent = lv;
    $('#levelTitle').textContent = `Nível ${lv}`;
    $('#levelText').textContent = `${total - start} / ${next - start} XP para o nível ${lv + 1}`;
    $('#levelBar').style.width = ((total - start) / (next - start)) * 100 + '%';
    $('#dayStreak').textContent = `🔥 ${current} dia${current === 1 ? '' : 's'}`;
    $('#dayStreak').classList.toggle('cold', !current);
    // Tela de conquistas
    $('#xpTotal').textContent = `${total} XP · Nível ${lv}`;
    $('#xpNext').textContent = `Faltam ${next - total} XP para o nível ${lv + 1}. Sequência atual: ${current} dia(s).`;
    const got = Store.data.badges;
    $('#badgeCount').textContent = `Medalhas (${Object.keys(got).length}/${BADGES.length})`;
    $('#badgeGrid').innerHTML = BADGES.map((b) => `
      <div class="badge card glass ${got[b.id] ? 'got' : ''}">
        <span class="badge-icon">${got[b.id] ? b.icon : '🔒'}</span>
        <strong>${b.name}</strong>
        <small>${b.desc}</small>
      </div>`).join('');
    Home.render();
  },

  init() {
    if (!Store.data.badges) Store.data.badges = {};
    $('#levelUpOk').addEventListener('click', () => { $('#levelUp').hidden = true; });
    this.render();
  },
};

/* ----- Sons originais gerados na hora (Web Audio, sem arquivos) ----- */
const Sound = {
  ctx() {
    if (!this._ctx) { try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    return this._ctx;
  },
  notes(list, type = 'triangle') {
    const ctx = this.ctx();
    if (!ctx) return;
    list.forEach(([freq, start, dur]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      const t = ctx.currentTime + start;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    });
  },
  fanfare() { this.notes([[523, 0, 0.15], [659, 0.15, 0.15], [784, 0.3, 0.15], [1047, 0.45, 0.5]]); },
  chime() { this.notes([[880, 0, 0.2], [1320, 0.12, 0.35]], 'sine'); },
};

/* ----- Confete leve em canvas (some sozinho depois de ~3 s) ----- */
const Confetti = {
  burst() {
    const c = document.createElement('canvas');
    c.className = 'confetti';
    c.width = innerWidth; c.height = innerHeight;
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const colors = ['#3da9ff', '#22d3ee', '#8b5cf6', '#fbbf24', '#34d399', '#fb7185'];
    // 120 pedacinhos é bonito e não pesa no celular
    const parts = Array.from({ length: 120 }, () => ({
      x: c.width / 2, y: c.height * 0.4,
      vx: (Math.random() - 0.5) * 14, vy: Math.random() * -14 - 4,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    const frame = (t) => {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t - t0 < 3000) requestAnimationFrame(frame); else c.remove();
    };
    requestAnimationFrame(frame);
  },
};

/* ---------- 15. FINANÇAS ---------- */
// finance = {
//   expenses: [{ id, amount, desc, cat, date }],
//   goals:    [{ id, name, emoji, target, saved, history: [{ date, amount }] }]
// }
const CATEGORIES = [
  { id: 'comida', label: 'Comida', emoji: '🍔', color: '#fb923c' },
  { id: 'transporte', label: 'Transporte', emoji: '🚌', color: '#3da9ff' },
  { id: 'estudos', label: 'Estudos', emoji: '📚', color: '#8b5cf6' },
  { id: 'lazer', label: 'Lazer', emoji: '🎮', color: '#22d3ee' },
  { id: 'casa', label: 'Casa', emoji: '🏠', color: '#34d399' },
  { id: 'saude', label: 'Saúde', emoji: '💊', color: '#fb7185' },
  { id: 'outros', label: 'Outros', emoji: '📦', color: '#a3acd1' },
];

// Formata dinheiro: 1234.5 -> "R$ 1.234,50"
const money = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Lê um valor digitado ("12,50", "1.234,5" ou "12.5") e vira número
const parseMoney = (txt) => {
  let t = String(txt).trim().replace(/[^\d.,]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // "1.250" = mil duzentos e cinquenta
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

const Finance = {
  month: todayKey().slice(0, 7), // "2026-11"
  cat: 'comida',

  get data() { return Store.data.finance; },

  monthLabel(m) {
    const [y, mm] = m.split('-').map(Number);
    const s = new Date(y, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  shiftMonth(delta) {
    const [y, mm] = this.month.split('-').map(Number);
    const d = new Date(y, mm - 1 + delta, 1);
    this.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.render();
  },
  monthExpenses(m = this.month) { return this.data.expenses.filter((e) => e.date.startsWith(m)); },

  addExpense() {
    const amount = parseMoney($('#expAmount').value);
    if (!amount) { toast('Digite um valor válido.'); $('#expAmount').focus(); return; }
    const date = $('#expDate').value || todayKey();
    this.data.expenses.push({ id: uid(), amount, desc: $('#expDesc').value.trim(), cat: this.cat, date });
    Store.save();
    $('#expAmount').value = '';
    $('#expDesc').value = '';
    this.month = date.slice(0, 7);
    toast(`Gasto de ${money(amount)} anotado.`);
    this.render();
  },

  removeExpense(id) {
    if (!confirm('Apagar este gasto?')) return;
    this.data.expenses = this.data.expenses.filter((e) => e.id !== id);
    Store.save();
    this.render();
  },

  // ----- Metas de economia -----
  addGoal() {
    const name = $('#savGoalName').value.trim();
    const target = parseMoney($('#savGoalTarget').value);
    if (!name || !target) { toast('Dê um nome e um valor para a meta.'); return; }
    this.data.goals.push({ id: uid(), name, emoji: $('#savGoalEmoji').value.trim() || '🎯', target, saved: 0, history: [] });
    Store.save();
    $('#savGoalName').value = ''; $('#savGoalTarget').value = '';
    this.renderGoals();
  },

  deposit(id, sign) {
    const g = this.data.goals.find((x) => x.id === id);
    const txt = prompt(sign > 0 ? `Quanto guardou para "${g.name}"?` : `Quanto tirou de "${g.name}"?`, '');
    const v = parseMoney(txt || '');
    if (!v) return;
    const wasDone = g.saved >= g.target;
    g.saved = Math.max(0, Math.round((g.saved + sign * v) * 100) / 100);
    g.history.push({ date: todayKey(), amount: sign * v });
    Store.save();
    this.renderGoals();
    if (!wasDone && g.saved >= g.target) {
      toast(`Meta "${g.name}" alcançada! 🎉`);
      Confetti.burst(); Sound.fanfare();
    }
  },

  editGoal(id) {
    const g = this.data.goals.find((x) => x.id === id);
    const v = parseMoney(prompt(`Novo valor da meta "${g.name}" (R$):`, String(g.target).replace('.', ',')) || '');
    if (v) { g.target = v; Store.save(); this.renderGoals(); }
  },

  removeGoal(id) {
    if (!confirm('Apagar esta meta?')) return;
    this.data.goals = this.data.goals.filter((x) => x.id !== id);
    Store.save();
    this.renderGoals();
  },

  // ----- Desenho -----
  renderSummary() {
    const list = this.monthExpenses();
    const total = list.reduce((s, e) => s + e.amount, 0);
    $('#finMonth').textContent = this.monthLabel(this.month);
    $('#finTotal').textContent = money(total);
    // Compara com o mês anterior
    const [y, mm] = this.month.split('-').map(Number);
    const pd = new Date(y, mm - 2, 1);
    const prevKey = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
    const prev = this.monthExpenses(prevKey).reduce((s, e) => s + e.amount, 0);
    let cmp = 'gastos no mês';
    if (prev > 0) {
      const diff = ((total - prev) / prev) * 100;
      cmp = `${diff <= 0 ? '▼' : '▲'} ${Math.abs(diff).toFixed(0)}% em relação ao mês anterior`;
    }
    $('#finCompare').textContent = cmp;
    $('#finCompare').className = 'muted small center ' + (prev > 0 ? (total <= prev ? 'good' : 'bad') : '');

    // Barras por categoria (maior primeiro)
    const byCat = CATEGORIES.map((c) => ({ ...c, sum: list.filter((e) => e.cat === c.id).reduce((s, e) => s + e.amount, 0) }))
      .filter((c) => c.sum > 0).sort((a, b) => b.sum - a.sum);
    $('#finCats').innerHTML = byCat.length ? byCat.map((c) => `
      <div class="cat-bar">
        <div class="cat-bar-top"><span>${c.emoji} ${c.label}</span><b>${money(c.sum)}</b></div>
        <div class="progress"><span class="progress-bar" style="width:${(c.sum / total) * 100}%; background:${c.color}; box-shadow:0 0 10px ${c.color}"></span></div>
      </div>`).join('') : '<p class="muted small center">Nenhum gasto neste mês.</p>';
  },

  renderList() {
    const list = this.monthExpenses().sort((a, b) => b.date.localeCompare(a.date));
    $('#expLabel').textContent = `Gastos de ${this.monthLabel(this.month).toLowerCase()} (${list.length})`;
    $('#expList').innerHTML = list.length ? `<div class="card glass exp-card">${list.map((e) => {
      const c = CATEGORIES.find((x) => x.id === e.cat) || CATEGORIES[6];
      const [, m, d] = e.date.split('-');
      return `
        <div class="exp-item" data-id="${e.id}">
          <span class="exp-emoji" style="background:${c.color}22">${c.emoji}</span>
          <div class="exp-info"><strong>${esc(e.desc || c.label)}</strong><span class="note-date">${d}/${m} · ${c.label}</span></div>
          <b class="exp-amount">${money(e.amount)}</b>
          <button class="mini-btn" data-act="del" aria-label="Apagar gasto">${ICON_TRASH}</button>
        </div>`;
    }).join('')}</div>` : '<div class="card glass empty">Nenhum gasto anotado neste mês.</div>';
  },

  renderGoals() {
    const goals = this.data.goals;
    $('#goalList').innerHTML = goals.map((g, i) => {
      const pct = Math.min(100, (g.saved / g.target) * 100);
      const done = g.saved >= g.target;
      return `
      <article class="card glass goal ${done ? 'done' : ''}" data-id="${g.id}" style="--i:${i}">
        <div class="project-head">
          <span class="habit-emoji big">${esc(g.emoji)}</span>
          <span class="project-name">${esc(g.name)}</span>
          <span class="goal-pct">${pct.toFixed(0)}%</span>
          <button class="mini-btn" data-act="edit" aria-label="Mudar valor da meta">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del" aria-label="Apagar meta">${ICON_TRASH}</button>
        </div>
        <div class="progress goal-bar"><span class="progress-bar" data-pct="${pct}"></span></div>
        <div class="goal-foot">
          <span class="note-date">${money(g.saved)} de ${money(g.target)}${done ? ' · conquistada! 🎉' : ` · faltam ${money(g.target - g.saved)}`}</span>
          <button class="ghost-btn small-btn" data-act="minus" aria-label="Retirar">−</button>
          <button class="primary-btn small-btn" data-act="plus">+ Guardar</button>
        </div>
      </article>`;
    }).join('');
    // Anima as barras depois de desenhar
    requestAnimationFrame(() => $$('#goalList .progress-bar').forEach((b) => { b.style.width = b.dataset.pct + '%'; }));
  },

  renderCats() {
    $('#expCats').innerHTML = CATEGORIES.map((c) =>
      `<button type="button" class="chip ${c.id === this.cat ? 'on' : ''}" data-cat="${c.id}">${c.emoji} ${c.label}</button>`).join('');
  },

  render() {
    this.renderSummary();
    this.renderList();
    this.renderGoals();
  },

  init() {
    if (!Store.data.finance) {
      // Metas de exemplo (o senhor pode mudar os valores no lápis)
      Store.data.finance = {
        expenses: [],
        goals: [
          { id: uid(), name: 'Moto', emoji: '🏍️', target: 15000, saved: 0, history: [] },
          { id: uid(), name: 'Notebook', emoji: '💻', target: 4000, saved: 0, history: [] },
        ],
      };
      Store.save();
    }
    $('#expDate').value = todayKey();
    $('#expDate').max = todayKey();
    this.renderCats();
    $('#expCats').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      this.cat = b.dataset.cat;
      this.renderCats();
    });
    $('#expForm').addEventListener('submit', (e) => { e.preventDefault(); this.addExpense(); });
    $('#savGoalForm').addEventListener('submit', (e) => { e.preventDefault(); this.addGoal(); });
    $('#finPrev').addEventListener('click', () => this.shiftMonth(-1));
    $('#finNext').addEventListener('click', () => this.shiftMonth(1));
    $('#expList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act="del"]');
      if (btn) this.removeExpense(btn.closest('.exp-item').dataset.id);
    });
    $('#goalList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.closest('.goal').dataset.id;
      if (btn.dataset.act === 'plus') this.deposit(id, 1);
      if (btn.dataset.act === 'minus') this.deposit(id, -1);
      if (btn.dataset.act === 'edit') this.editGoal(id);
      if (btn.dataset.act === 'del') this.removeGoal(id);
    });
    this.render();
  },
};

/* ---------- 16. VOZ (falar e ouvir comandos) ---------- */
// Usa a Web Speech API do próprio navegador (gratuita, sem servidor).
// - Falar:  speechSynthesis (funciona em quase todos os navegadores)
// - Ouvir:  SpeechRecognition (Chrome/Edge no PC e Chrome no Android)
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const Voice = {
  voice: null,
  listening: false,
  // Outras partes do app (ex.: o cérebro de partículas) podem "escutar" quando ela fala
  onLevel: null, // função(nivel 0..1)

  pickVoice() {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('pt'));
    // Preferência: vozes femininas conhecidas em pt-BR
    const female = /francisca|maria|luciana|vit[oó]ria|camila|thalita|fernanda|helo[ií]sa|female|feminina|google portugu[eê]s do brasil/i;
    this.voice = voices.find((v) => v.lang === 'pt-BR' && female.test(v.name))
      || voices.find((v) => v.lang === 'pt-BR')
      || voices[0] || null;
  },

  speak(text) {
    if (!('speechSynthesis' in window)) { toast(text); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    if (this.voice) u.voice = this.voice;
    u.rate = 1.02;
    u.pitch = 1.1;
    this.setOrb('speaking');
    // A cada palavra, dá um "pulso" (usado pela orbe e depois pelo cérebro)
    u.onboundary = () => {
      $('#voiceOrb').classList.remove('beat'); void $('#voiceOrb').offsetWidth; $('#voiceOrb').classList.add('beat');
      if (this.onLevel) this.onLevel(1);
    };
    u.onend = u.onerror = () => { this.setOrb(''); if (this.onLevel) this.onLevel(0); };
    speechSynthesis.speak(u);
  },

  // Texto do resumo do dia (também usado pelo botão "Ouvir resumo")
  summaryText() {
    const s = Home.summary();
    const name = Store.data.settings.userTitle;
    const parts = [$('#greeting').textContent, 'O que temos para hoje:'];
    parts.push(s.total ? `${s.done} de ${s.total} tarefas concluídas.` : 'Nenhuma tarefa para hoje ainda.');
    parts.push(`${s.habitsDone} de ${s.habits} hábitos cumpridos.`);
    if (s.xp) parts.push(`Você já ganhou ${s.xp} pontos de experiência.`);
    const sub = Studies.todaySubject();
    if (sub) parts.push(`Matéria do dia: ${sub}.`);
    const q = Philosophy.today();
    if (q) parts.push(`Frase do dia: ${q.text}`);
    parts.push(`Vamos com tudo, ${name}!`);
    return parts.join(' ');
  },

  // ----- Painel -----
  open() {
    $('#voicePanel').hidden = false;
    $('#voiceHeard').textContent = '';
    $('#voiceReply').textContent = '';
    $('#voiceStatus').textContent = this.recognitionSupported()
      ? 'Toque no microfone e fale'
      : 'Microfone não disponível neste navegador. Digite o comando abaixo.';
    $('#micBtn').hidden = !this.recognitionSupported();
  },
  close() {
    $('#voicePanel').hidden = true;
    this.stopListening();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  },
  setOrb(state) {
    $('#voiceOrb').className = 'orb brain-orb ' + state;
  },

  // ----- Ouvir -----
  recognitionSupported: () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,

  listen() {
    if (this.listening) { this.stopListening(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.rec = rec;
    this.listening = true;
    this.setOrb('listening');
    $('#micBtn').classList.add('on');
    $('#voiceStatus').textContent = 'Ouvindo…';
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      $('#voiceHeard').textContent = `“${r[0].transcript}”`;
      if (r.isFinal) this.handle(r[0].transcript);
    };
    rec.onerror = (e) => {
      $('#voiceStatus').textContent = e.error === 'not-allowed'
        ? 'Permita o microfone no navegador para usar a voz.'
        : 'Não consegui ouvir. Tente de novo.';
    };
    rec.onend = () => this.stopListening(true);
    try { rec.start(); } catch (e) { this.stopListening(); }
  },
  stopListening(fromEnd) {
    if (this.rec && !fromEnd) try { this.rec.stop(); } catch (e) { /* já parou */ }
    this.listening = false;
    $('#micBtn').classList.remove('on');
    if ($('#voiceOrb').classList.contains('listening')) this.setOrb('');
    if ($('#voiceStatus').textContent === 'Ouvindo…') $('#voiceStatus').textContent = 'Toque no microfone e fale';
  },

  // Responde na tela e em voz alta
  reply(text) {
    $('#voiceReply').textContent = text;
    this.speak(text);
  },

  // ----- Entender o comando -----
  handle(raw) {
    const text = raw.trim();
    const t = norm(text);
    // Pega o que vem depois da palavra-chave, mantendo maiúsculas/acentos originais
    const after = (re) => { const m = text.match(re); return m ? m[m.length - 1].trim().replace(/^[:,\-–]\s*/, '') : ''; };
    let m;

    // 1) Anotação
    if (/^(anotar|anota|anotacao|nota|lembrar de)\b/.test(t)) {
      const body = after(/^(anotar|anota|anotação|anotacao|nota|lembrar de)\s*(.*)$/i);
      if (!body) return this.reply('O que devo anotar?');
      const now = new Date().toISOString();
      Store.data.notes.unshift({ id: uid(), text: body.charAt(0).toUpperCase() + body.slice(1), createdAt: now, updatedAt: now });
      Store.save(); Notes.render();
      return this.reply(`Anotado: ${body}.`);
    }

    // 2) Nova tarefa (vai para o projeto "Geral" de hoje)
    if (/^(nova tarefa|adicionar tarefa|criar tarefa|tarefa)\b/.test(t)) {
      const title = after(/^(nova tarefa|adicionar tarefa|criar tarefa|tarefa)\s*(.*)$/i);
      if (!title) return this.reply('Qual é a tarefa?');
      const wd = new Date().getDay();
      let proj = Store.data.projects.find((p) => p.weekday === wd && norm(p.name) === 'geral');
      if (!proj) { proj = { id: uid(), name: 'Geral', weekday: wd }; Store.data.projects.push(proj); }
      Store.data.tasks.push({ id: uid(), projectId: proj.id, title: title.charAt(0).toUpperCase() + title.slice(1), doneDates: [] });
      Store.save(); Tasks.render(); Home.render();
      return this.reply(`Tarefa criada para hoje: ${title}.`);
    }

    // 3) Marcar hábito
    if ((m = t.match(/^(cumpri|marquei|marcar|marca|fiz|feito)\s+(o habito\s+|habito\s+)?(.*)$/))) {
      const q = m[3];
      const h = Store.data.habits.find((x) => norm(x.name).includes(q) || q.includes(norm(x.name)))
        || Store.data.habits.find((x) => norm(x.name).split(' ').some((w) => w.length > 3 && q.includes(w)));
      if (!h) return this.reply(`Não encontrei o hábito "${q}".`);
      if (!Habits.isDone(h, todayKey())) { Habits.toggle(h.id, todayKey()); Habits.renderAll(); }
      return this.reply(`Hábito ${h.name} marcado. Muito bem!`);
    }

    // 4) Gasto: "gastei 25 reais com almoço" / "gastei 12,50 em ônibus"
    if ((m = text.match(/^gastei\s+([\d.,]+)\s*(reais|real|r\$)?\s*(com|em|no|na|de)?\s*(.*)$/i))) {
      const amount = parseMoney(m[1]);
      if (!amount) return this.reply('Não entendi o valor.');
      const descOriginal = m[4] || '';
      const desc = norm(descOriginal);
      const guess = [
        ['comida', /almoco|janta|lanche|comida|mercado|pizza|cafe|restaurante|ifood/],
        ['transporte', /onibus|uber|gasolina|metro|passagem|combustivel|moto/],
        ['estudos', /livro|curso|faculdade|apostila|escola/],
        ['lazer', /jogo|cinema|show|netflix|bar|festa/],
        ['saude', /remedio|farmacia|medico|academia/],
        ['casa', /aluguel|luz|agua|internet|conta/],
      ].find(([, re]) => re.test(desc));
      const cat = guess ? guess[0] : 'outros';
      Store.data.finance.expenses.push({ id: uid(), amount, desc: descOriginal ? descOriginal.charAt(0).toUpperCase() + descOriginal.slice(1) : '', cat, date: todayKey() });
      Store.save(); Finance.render();
      return this.reply(`Anotei um gasto de ${money(amount)}${descOriginal ? ' com ' + descOriginal : ''}.`);
    }

    // 5) Pomodoro
    if (/(iniciar|comecar|começar|inicia).*(foco|pomodoro)/.test(t)) {
      Router.go('focus');
      if (Focus.state.mode !== 'focus') Focus.setMode('focus');
      if (!Focus.state.running) Focus.start();
      return this.reply('Foco iniciado. Bom estudo!');
    }
    if (/(pausar|parar).*(foco|pomodoro|timer)/.test(t)) {
      if (Focus.state.running) Focus.pause();
      return this.reply('Timer pausado.');
    }

    // Fechamento do dia e metas da semana
    if (/como foi (o )?meu mes|relatorio do mes|resumo do mes/.test(t)) {
      Report.month = todayKey().slice(0, 7);
      $('#voiceReply').textContent = 'Lendo o relatório do mês…';
      return this.speak(Report.text());
    }
    if (/fechamento|como foi (o )?meu dia|fim do dia/.test(t)) {
      $('#voiceReply').textContent = 'Lendo o fechamento do dia…';
      return this.speak(DayEnd.text());
    }
    if (/^(meta|nova meta)\b/.test(t)) {
      const body = after(/^(nova meta|meta)\s*(.*)$/i);
      if (!body) return this.reply('Qual é a meta?');
      if (!WeekGoals.add(body)) return this.reply('A semana já tem 5 metas.');
      return this.reply(`Meta da semana adicionada: ${body}`);
    }

    // 6) Resumo e frase
    if (/resumo|como (esta|está) (o )?meu dia|o que temos/.test(t)) {
      $('#voiceReply').textContent = 'Lendo o resumo do dia…';
      return this.speak(this.summaryText());
    }
    if (/frase/.test(t)) {
      const q = Philosophy.today();
      return this.reply(q ? q.text : 'Você ainda não cadastrou frases.');
    }

    // Humor: "humor ótimo", "estou bem", "me sinto cansado"
    if ((m = t.match(/^(humor|estou|me sinto|to)\s+(.*)$/))) {
      const w = m[2];
      const level = /otim|excelent|feliz|incrivel|animad/.test(w) ? 5
        : /pessim|horrivel|muito mal|triste|pessimo/.test(w) ? 1
        : /ruim|mal|cansad|estressad|desanimad/.test(w) ? 2
        : /normal|ok|mais ou menos|regular/.test(w) ? 3
        : /bem|bom|tranquil/.test(w) ? 4 : 0;
      if (level) {
        Mood.set(todayKey(), level);
        Mood.loadDiary(todayKey());
        const mood = MOODS[level - 1];
        return this.reply(level >= 4 ? `Que ótimo! Registrei seu humor: ${mood.name} ${mood.emoji}`
          : `Registrei seu humor: ${mood.name} ${mood.emoji}. Amanhã é um novo dia, ${Store.data.settings.userTitle}.`);
      }
    }

    // 7) Abrir telas
    const screens = [
      ['report', /relatorio|mensal|balanco/], ['dev', /projetos? (dev|de programacao)|programacao|codigo/], ['workout', /treino|academia|musculacao/],
      ['home', /inicio|inicial|home/], ['tasks', /tarefa|projeto/], ['focus', /foco|pomodoro|relogio/],
      ['stats', /desempenho|evolucao|grafico/], ['notes', /anota/], ['habits', /habito/],
      ['finance', /financ|gasto|dinheiro/], ['reading', /leitura|livro/], ['achievements', /conquista|nivel|medalha/],
      ['studies', /estud|materia|prova|quiz/], ['stats', /humor|diario/], ['mindset', /mindset/], ['philosophy', /filosofia/], ['reminders', /lembrete/], ['settings', /configura/],
    ];
    if (/^(abrir|abre|ir para|vai para|mostrar|mostra)\b/.test(t)) {
      const hit = screens.find(([, re]) => re.test(t));
      if (hit) { Router.go(hit[0]); this.close(); return; }
    }

    this.reply('Não entendi. Toque em "O que posso dizer?" para ver os comandos.');
  },

  init() {
    if ('speechSynthesis' in window) {
      this.pickVoice();
      speechSynthesis.onvoiceschanged = () => this.pickVoice(); // as vozes carregam depois
    }
    $('#voiceBtn').addEventListener('click', () => this.open());
    $('#voiceClose').addEventListener('click', () => this.close());
    $('#voicePanel').addEventListener('click', (e) => { if (e.target.id === 'voicePanel') this.close(); });
    $('#micBtn').addEventListener('click', () => this.listen());
    $('#voiceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#voiceInput').value.trim();
      if (!v) return;
      $('#voiceHeard').textContent = `“${v}”`;
      $('#voiceInput').value = '';
      this.handle(v);
    });
    $('#speakSummary').addEventListener('click', () => this.speak(this.summaryText()));
  },
};

/* ---------- 17. ESTUDOS: MATÉRIA DO DIA + QUIZ ---------- */
// studies = {
//   plan:      { 1: 'Cálculo', 2: 'Física', ... 5: '...' }  (1 = segunda ... 5 = sexta)
//   exams:     [{ id, type: 'prova'|'trabalho', title, subject, date: '2026-12-01' }]
//   questions: [{ id, subject, q, a, right, wrong, createdAt }]
// }
// O quiz funciona como "cartões de memória": o app mostra a pergunta,
// o senhor pensa, toca em "Ver resposta" e diz se acertou ou errou.
const Studies = {
  quiz: null,           // quiz em andamento: { list, index, right, showing, subject }
  quizSubject: 'all',   // matéria escolhida para o quiz
  examType: 'prova',

  get data() { return Store.data.studies; },

  // Matéria de hoje (sábado e domingo não têm)
  todaySubject() {
    const wd = new Date().getDay();
    return wd >= 1 && wd <= 5 ? (this.data.plan[wd] || '') : '';
  },

  // Todas as matérias já usadas (para o autocompletar e o filtro do quiz)
  subjects() {
    const set = new Set();
    Object.values(this.data.plan).forEach((x) => x && set.add(x));
    this.data.exams.forEach((x) => x.subject && set.add(x.subject));
    this.data.questions.forEach((x) => x.subject && set.add(x.subject));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  // Quantos dias faltam até uma data (0 = hoje, negativo = já passou)
  daysUntil(date) {
    const today = new Date(todayKey() + 'T12:00');
    return Math.round((new Date(date + 'T12:00') - today) / 86400000);
  },
  countdownText(n) {
    if (n === 0) return 'é hoje!';
    if (n === 1) return 'amanhã';
    if (n > 1) return `em ${n} dias`;
    return n === -1 ? 'foi ontem' : `foi há ${-n} dias`;
  },

  // Próximas provas/trabalhos (de hoje em diante), em ordem de data
  upcoming() {
    return this.data.exams
      .filter((e) => this.daysUntil(e.date) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  // ----- Plano da semana -----
  renderPlan() {
    const today = new Date().getDay();
    $('#planList').innerHTML = [1, 2, 3, 4, 5].map((wd) => `
      <label class="plan-row ${wd === today ? 'today' : ''}">
        <span class="plan-day">${WEEKDAYS[wd].slice(0, 3)}</span>
        <input class="line-input" data-wd="${wd}" list="subjectList" maxlength="40"
               placeholder="Matéria de ${WEEKDAYS[wd].toLowerCase()}" value="${esc(this.data.plan[wd] || '')}" />
      </label>`).join('');
  },

  // ----- Provas e trabalhos -----
  renderExams() {
    // Primeiro as próximas (mais perto no topo), depois as que já passaram
    const past = this.data.exams.filter((e) => this.daysUntil(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date));
    const list = [...this.upcoming(), ...past];
    if (!list.length) {
      $('#examList').innerHTML = '<div class="card glass empty">Nenhuma prova ou trabalho cadastrado.</div>';
      return;
    }
    $('#examList').innerHTML = list.map((e, i) => {
      const n = this.daysUntil(e.date);
      const urgency = n < 0 ? 'past' : n <= 3 ? 'urgent' : '';
      const date = new Date(e.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      return `
      <article class="card glass exam-card ${urgency}" data-id="${e.id}" style="--i:${Math.min(i, 8)}">
        <div class="exam-count"><strong>${n < 0 ? '✓' : n}</strong><small>${n < 0 ? 'feito' : n === 1 ? 'dia' : 'dias'}</small></div>
        <div class="exam-info">
          <span class="tag ${e.type}">${e.type === 'prova' ? 'Prova' : 'Trabalho'}</span>
          <p class="exam-title">${esc(e.title)}${e.subject ? ` · <span class="muted">${esc(e.subject)}</span>` : ''}</p>
          <p class="note-date">${date} · ${this.countdownText(n)}</p>
        </div>
        <button class="mini-btn" data-act="del" aria-label="Apagar">${ICON_TRASH}</button>
      </article>`;
    }).join('');
  },

  // ----- Perguntas -----
  renderQuestions() {
    const qs = this.data.questions;
    $('#qLabel').textContent = `Minhas perguntas (${qs.length})`;
    if (!qs.length) {
      $('#questionList').innerHTML = '<div class="card glass empty">Cadastre perguntas acima para montar seu quiz.</div>';
      return;
    }
    // Agrupa por matéria
    const groups = {};
    qs.forEach((q) => { (groups[q.subject || 'Sem matéria'] ||= []).push(q); });
    $('#questionList').innerHTML = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((sub) => `
      <details class="card glass q-group">
        <summary><span>${esc(sub)}</span><span class="tag">${groups[sub].length}</span></summary>
        ${groups[sub].map((q) => {
          const total = q.right + q.wrong;
          const rate = total ? Math.round((q.right / total) * 100) + '% de acerto' : 'ainda não respondida';
          return `
          <div class="q-item" data-id="${q.id}">
            <p class="q-text">${esc(q.q)}</p>
            <p class="q-answer">${esc(q.a)}</p>
            <div class="note-foot">
              <span class="note-date">${rate}</span>
              <button class="mini-btn" data-act="del" aria-label="Apagar">${ICON_TRASH}</button>
            </div>
          </div>`;
        }).join('')}
      </details>`).join('');
  },

  // Botões (chips) para escolher a matéria do quiz
  renderQuizSubjects() {
    const counts = {};
    this.data.questions.forEach((q) => { const k = q.subject || 'Sem matéria'; counts[k] = (counts[k] || 0) + 1; });
    const subs = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (this.quizSubject !== 'all' && !counts[this.quizSubject]) this.quizSubject = 'all';
    const chip = (val, label, n) =>
      `<button class="chip ${this.quizSubject === val ? 'on' : ''}" data-sub="${esc(val)}">${esc(label)} · ${n}</button>`;
    $('#quizSubjects').innerHTML = chip('all', 'Todas', this.data.questions.length) + subs.map((x) => chip(x, x, counts[x])).join('');
    $('#quizGo').disabled = !this.data.questions.length;
  },

  renderDatalist() {
    $('#subjectList').innerHTML = this.subjects().map((x) => `<option value="${esc(x)}"></option>`).join('');
  },

  // Card da tela inicial
  renderHome() {
    const sub = this.todaySubject();
    const wd = new Date().getDay();
    $('#homeSubject').classList.toggle('soft', !sub);
    $('#homeSubject').textContent = sub || (wd === 0 || wd === 6
      ? 'Fim de semana: revise o que quiser 📚'
      : 'Defina a matéria de hoje em Estudos');
    const next = this.upcoming()[0];
    $('#homeExam').textContent = next
      ? `Próxima ${next.type}: ${next.title}${next.subject ? ' (' + next.subject + ')' : ''} ${this.countdownText(this.daysUntil(next.date))}`
      : 'Nenhuma prova ou trabalho marcado.';
  },

  renderAll() {
    this.renderDatalist();
    this.renderPlan();
    this.renderExams();
    this.renderQuestions();
    this.renderQuizSubjects();
    this.renderHome();
  },

  showTab(name) {
    $$('#studyTabs .seg').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.study-pane').forEach((p) => { p.hidden = p.dataset.pane !== name; });
  },

  // ----- Quiz -----
  // Embaralha, mas coloca primeiro as perguntas com mais erros (máx. 10)
  startQuiz(subject = this.quizSubject) {
    let pool = this.data.questions;
    if (subject !== 'all') pool = pool.filter((q) => (q.subject || 'Sem matéria') === subject);
    if (!pool.length) { toast('Nenhuma pergunta para essa matéria ainda.'); return; }
    const list = pool
      .map((q) => ({ q, w: (q.wrong - q.right) + Math.random() * 2 }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 10)
      .map((x) => x.q);
    this.quiz = { list, index: 0, right: 0, showing: false, subject };
    $('#quizStart').hidden = true;
    $('#quizBox').hidden = false;
    this.renderQuiz();
  },

  renderQuiz() {
    const z = this.quiz;
    const box = $('#quizBox');
    if (z.index >= z.list.length) return this.finishQuiz();
    const q = z.list[z.index];
    const pct = Math.round((z.index / z.list.length) * 100);
    box.innerHTML = `
      <div class="card-head-row">
        <p class="card-eyebrow">${esc(q.subject || 'Quiz')} · ${z.index + 1} de ${z.list.length}</p>
        <button class="link-btn" data-act="quit">Sair</button>
      </div>
      <div class="progress"><span class="progress-bar" style="width:${pct}%"></span></div>
      <p class="quiz-q">${esc(q.q)}</p>
      ${z.showing
        ? `<p class="quiz-a">${esc(q.a)}</p>
           <div class="quiz-actions">
             <button class="ghost-btn wrong" data-act="wrong">✗ Errei</button>
             <button class="primary-btn right" data-act="right">✓ Acertei</button>
           </div>`
        : `<button class="primary-btn wide-btn" data-act="show">Ver resposta</button>`}`;
    box.classList.remove('flip'); void box.offsetWidth; box.classList.add('flip');
  },

  answer(ok) {
    const z = this.quiz;
    const q = z.list[z.index];
    if (ok) { q.right++; z.right++; } else q.wrong++;
    Store.save();
    z.index++;
    z.showing = false;
    this.renderQuiz();
  },

  finishQuiz() {
    const z = this.quiz;
    const pct = Math.round((z.right / z.list.length) * 100);
    // XP uma vez por dia por fazer quiz
    XP.award(`quiz:${todayKey()}`, 'quiz', 'Quiz de estudos');
    const msg = pct >= 80 ? 'Excelente! O conteúdo está fixado. 🦉'
      : pct >= 50 ? 'Bom trabalho! Revise as que errou.'
      : 'Continue praticando, cada revisão fortalece a memória.';
    $('#quizBox').innerHTML = `
      <p class="card-eyebrow">Resultado</p>
      <p class="quiz-score">${z.right}<small>/${z.list.length}</small></p>
      <p class="center">${msg}</p>
      <div class="quiz-actions">
        <button class="ghost-btn" data-act="quit">Fechar</button>
        <button class="primary-btn" data-act="again">Refazer</button>
      </div>`;
    if (pct >= 80) { Confetti.burst(); Sound.fanfare(); }
    this.renderQuestions();
  },

  quitQuiz() {
    this.quiz = null;
    $('#quizBox').hidden = true;
    $('#quizStart').hidden = false;
  },

  init() {
    if (!Store.data.studies) {
      Store.data.studies = { plan: {}, exams: [], questions: [] };
      Store.save();
    }
    $('#examDate').value = todayKey();

    // Abas
    $('#studyTabs').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (b) this.showTab(b.dataset.tab);
    });

    // Plano: salva quando sai do campo
    $('#planList').addEventListener('change', (e) => {
      const inp = e.target.closest('input[data-wd]');
      if (!inp) return;
      this.data.plan[inp.dataset.wd] = inp.value.trim();
      Store.save();
      this.renderDatalist();
      this.renderHome();
      toast('Plano salvo');
    });

    // Provas
    $('#examType').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      this.examType = b.dataset.type;
      $$('#examType .seg').forEach((x) => x.classList.toggle('active', x === b));
    });
    $('#examForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#examTitle').value.trim();
      const date = $('#examDate').value;
      if (!title || !date) { toast('Preencha o título e a data.'); return; }
      this.data.exams.push({ id: uid(), type: this.examType, title, subject: $('#examSubject').value.trim(), date });
      Store.save();
      $('#examTitle').value = '';
      $('#examSubject').value = '';
      this.renderAll();
      toast('Adicionado!');
    });
    $('#examList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="del"]');
      if (!b) return;
      if (!confirm('Apagar este item?')) return;
      const id = b.closest('.exam-card').dataset.id;
      this.data.exams = this.data.exams.filter((x) => x.id !== id);
      Store.save();
      this.renderAll();
    });

    // Perguntas
    $('#questionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#qText').value.trim();
      const a = $('#qAnswer').value.trim();
      if (!q || !a) { toast('Escreva a pergunta e a resposta.'); return; }
      const subject = $('#qSubject').value.trim() || this.todaySubject();
      this.data.questions.push({ id: uid(), subject, q, a, right: 0, wrong: 0, createdAt: new Date().toISOString() });
      Store.save();
      $('#qText').value = '';
      $('#qAnswer').value = '';
      $('#qText').focus();
      this.renderAll();
      toast('Pergunta salva');
    });
    $('#questionList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="del"]');
      if (!b) return;
      if (!confirm('Apagar esta pergunta?')) return;
      const id = b.closest('.q-item').dataset.id;
      this.data.questions = this.data.questions.filter((x) => x.id !== id);
      Store.save();
      this.renderAll();
    });

    // Quiz
    $('#quizSubjects').addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      this.quizSubject = c.dataset.sub;
      this.renderQuizSubjects();
    });
    $('#quizGo').addEventListener('click', () => this.startQuiz());
    $('#quizBox').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'show') { this.quiz.showing = true; this.renderQuiz(); }
      if (act === 'right') this.answer(true);
      if (act === 'wrong') this.answer(false);
      if (act === 'again') this.startQuiz(this.quiz.subject);
      if (act === 'quit') this.quitQuiz();
    });

    // Botão "Fazer quiz" da tela inicial: abre já na aba Quiz com a matéria do dia
    $('#homeQuizBtn').addEventListener('click', () => {
      const sub = this.todaySubject();
      const has = sub && this.data.questions.some((q) => q.subject === sub);
      this.quizSubject = has ? sub : 'all';
      this.renderQuizSubjects();
      this.showTab('quiz');
    });

    this.renderAll();
  },
};

/* ---------- 18. DIÁRIO DE HUMOR ---------- */
// moods = { '2026-11-22': { level: 1..5, note: '...', at: ISO } }
// Aparece junto do gráfico de Desempenho para comparar humor e rendimento.
const MOODS = [
  { level: 1, emoji: '😞', name: 'Péssimo', color: '#fb7185' },
  { level: 2, emoji: '😕', name: 'Ruim',    color: '#f59e0b' },
  { level: 3, emoji: '😐', name: 'Normal',  color: '#a3a3c2' },
  { level: 4, emoji: '🙂', name: 'Bem',     color: '#22d3ee' },
  { level: 5, emoji: '😄', name: 'Ótimo',   color: '#4ade80' },
];

const Mood = {
  selected: null, // nível escolhido no diário (antes de salvar)

  get(date) { return Store.data.moods[date]; },

  // Salva o humor de um dia (e dá XP uma vez por dia)
  set(date, level, note) {
    const old = this.get(date);
    Store.data.moods[date] = { level, note: note !== undefined ? note : (old ? old.note : ''), at: new Date().toISOString() };
    Store.save();
    XP.award(`mood:${date}`, 'mood', 'Diário de humor', date);
    Performance.render();
    this.renderHome();
  },

  // Botões de rosto (usados na tela inicial e no diário)
  pickerHTML(current) {
    return MOODS.map((m) => `
      <button type="button" class="mood-btn ${current === m.level ? 'on' : ''}" data-level="${m.level}"
              style="--mc:${m.color}" aria-label="${m.name}">
        <span>${m.emoji}</span><small>${m.name}</small>
      </button>`).join('');
  },

  renderHome() {
    const m = this.get(todayKey());
    $('#homeMood').innerHTML = this.pickerHTML(m && m.level);
  },

  loadDiary(date) {
    const m = this.get(date);
    $('#moodDate').value = date;
    this.selected = m ? m.level : null;
    $('#moodNote').value = m ? m.note : '';
    this.renderDiary();
  },

  renderDiary() {
    $('#moodPicker').innerHTML = this.pickerHTML(this.selected);
    const mood = this.selected && MOODS[this.selected - 1];
    $('#moodLabel').textContent = mood ? `Humor: ${mood.name}` : 'Toque no rosto que combina com o seu dia';
    $('#moodSave').disabled = !this.selected;
  },

  // Frase que compara a nota do dia com o humor (precisa de dados dos dois tipos)
  renderInsight(days) {
    const perf = Store.data.performance;
    const both = days.filter((d) => perf[d] && this.get(d));
    const el = $('#moodInsight');
    const moodDays = days.filter((d) => this.get(d));
    if (!moodDays.length) { el.hidden = true; return; }
    const avgMood = moodDays.reduce((s, d) => s + this.get(d).level, 0) / moodDays.length;
    const face = MOODS[Math.round(avgMood) - 1];
    let txt = `Humor médio: ${face.emoji} ${face.name}.`;
    const good = both.filter((d) => this.get(d).level >= 4);
    const other = both.filter((d) => this.get(d).level < 4);
    if (good.length && other.length) {
      const avg = (arr) => arr.reduce((s, d) => s + perf[d].score, 0) / arr.length;
      txt += ` Nos dias de humor bom sua nota média foi ${avg(good).toFixed(1)}; nos outros, ${avg(other).toFixed(1)}.`;
    }
    el.textContent = txt;
    el.hidden = false;
  },

  init() {
    $('#moodDate').max = todayKey();
    this.loadDiary(todayKey());
    this.renderHome();

    // Tela inicial: um toque já salva
    $('#homeMood').addEventListener('click', (e) => {
      const b = e.target.closest('.mood-btn');
      if (!b) return;
      const level = Number(b.dataset.level);
      this.set(todayKey(), level);
      if ($('#moodDate').value === todayKey()) this.loadDiary(todayKey());
      const btn = $(`#homeMood .mood-btn[data-level="${level}"]`);
      btn.classList.add('pop');
      toast(`Humor registrado: ${MOODS[level - 1].emoji} ${MOODS[level - 1].name}`);
    });

    // Diário: escolhe o rosto, escreve a nota e salva
    $('#moodPicker').addEventListener('click', (e) => {
      const b = e.target.closest('.mood-btn');
      if (!b) return;
      this.selected = Number(b.dataset.level);
      this.renderDiary();
      $(`#moodPicker .mood-btn[data-level="${this.selected}"]`).classList.add('pop');
    });
    $('#moodDate').addEventListener('change', () => this.loadDiary($('#moodDate').value || todayKey()));
    $('#moodSave').addEventListener('click', () => {
      if (!this.selected) return;
      this.set($('#moodDate').value || todayKey(), this.selected, $('#moodNote').value.trim());
      $('#moodSave').textContent = 'Salvo ✓';
      setTimeout(() => { $('#moodSave').textContent = 'Salvar humor'; }, 1200);
    });
  },
};

/* ---------- 19. ANOTAÇÕES ---------- */
const Notes = {
  editingId: null, // quando não é null, o formulário está editando essa nota

  // Formata a data: "hoje, 14:32", "ontem, 09:10" ou "18/11/2026, 20:05"
  formatDate(iso) {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (dateKey(d) === todayKey()) return `hoje, ${time}`;
    if (dateKey(d) === dateKey(yesterday)) return `ontem, ${time}`;
    return `${d.toLocaleDateString('pt-BR')}, ${time}`;
  },

  save(text) {
    const now = new Date().toISOString();
    if (this.editingId) {
      const n = Store.data.notes.find((x) => x.id === this.editingId);
      n.text = text; n.updatedAt = now;
    } else {
      // unshift = coloca no começo (as mais novas aparecem primeiro)
      Store.data.notes.unshift({ id: uid(), text, createdAt: now, updatedAt: now });
    }
    Store.save();
    this.resetForm();
    this.render();
  },

  edit(id) {
    const n = Store.data.notes.find((x) => x.id === id);
    this.editingId = id;
    $('#noteInput').value = n.text;
    $('#noteSave').textContent = 'Atualizar';
    $('#noteCancel').hidden = false;
    $('#noteInput').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  remove(id, card) {
    if (!confirm('Apagar esta anotação?')) return;
    Store.data.notes = Store.data.notes.filter((x) => x.id !== id);
    Store.save();
    if (this.editingId === id) this.resetForm();
    // Animação de saída antes de sumir
    card.classList.add('leaving');
    setTimeout(() => this.render(), 300);
  },

  resetForm() {
    this.editingId = null;
    $('#noteInput').value = '';
    $('#noteSave').textContent = 'Salvar';
    $('#noteCancel').hidden = true;
  },

  render() {
    const q = $('#noteSearch').value.trim().toLowerCase();
    const notes = Store.data.notes.filter((n) => n.text.toLowerCase().includes(q));
    if (!notes.length) {
      $('#noteList').innerHTML = `<div class="card glass empty">${q ? 'Nenhuma anotação encontrada.' : 'Nenhuma anotação ainda.<br>Escreva a primeira no campo acima.'}</div>`;
      return;
    }
    $('#noteList').innerHTML = notes.map((n, i) => `
      <article class="card glass note" data-id="${n.id}" style="--i:${Math.min(i, 8)}">
        <p class="note-text">${esc(n.text)}</p>
        <div class="note-foot">
          <span class="note-date">${this.formatDate(n.createdAt)}${n.updatedAt !== n.createdAt ? ' · editada' : ''}</span>
          <button class="mini-btn" data-act="edit" aria-label="Editar anotação">${ICON_EDIT}</button>
          <button class="mini-btn" data-act="del" aria-label="Apagar anotação">${ICON_TRASH}</button>
        </div>
      </article>`).join('');
  },

  init() {
    $('#noteForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('#noteInput').value.trim();
      if (text) this.save(text);
    });
    // Ctrl+Enter também salva (atalho no PC)
    $('#noteInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#noteForm').requestSubmit();
    });
    $('#noteCancel').addEventListener('click', () => this.resetForm());
    $('#noteSearch').addEventListener('input', () => this.render());
    $('#noteList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('.note');
      if (btn.dataset.act === 'edit') this.edit(card.dataset.id);
      if (btn.dataset.act === 'del') this.remove(card.dataset.id, card);
    });
    this.render();
  },
};

/* ---------- 19. MEGA BRAIN (cérebro de partículas) ---------- */
// Desenhado em canvas 2D, sem bibliotecas: cada ponto do cérebro tem
// coordenadas 3D (x, y, z). A cada quadro giramos os pontos e usamos
// "perspectiva" (o que está longe fica menor e mais escuro).
// Para poupar bateria: poucas partículas, e a animação PARA quando a
// tela está escondida ou o cérebro não está visível.

// Gera os pontos do cérebro (só uma vez, depois é reaproveitado)
function makeBrainPoints(count) {
  const pts = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  const nCereb = Math.round(count * 0.82);   // cérebro (2 hemisférios)
  const nCerebel = Math.round(count * 0.13); // cerebelo (atrás, embaixo)
  const nStem = count - nCereb - nCerebel;   // tronco

  for (let i = 0; i < nCereb; i++) {
    const side = i % 2 ? 1 : -1;
    // Direção aleatória numa esfera
    const th = rand(0, Math.PI * 2);
    const ph = Math.acos(rand(-1, 1));
    // "Dobras" do cérebro (giros): ondulações na superfície
    const fold = 1 + 0.1 * Math.sin(9 * th + 3 * Math.sin(5 * ph)) * Math.cos(7 * ph);
    const r = (Math.random() < 0.85 ? rand(0.93, 1) : rand(0.3, 0.9)) * fold;
    let x = Math.sin(ph) * Math.cos(th) * 0.46 * r;
    let y = Math.cos(ph) * 0.62 * r;
    let z = Math.sin(ph) * Math.sin(th) * 0.86 * r;
    if (side * x < -0.3) x *= 0.5;          // achata o lado de dentro
    x += side * 0.33;
    if (side * x < 0.035) x = side * rand(0.035, 0.07); // fenda entre os hemisférios
    if (y < -0.22) y = -0.22 + (y + 0.22) * 0.45;       // base mais reta
    pts.push({ x, y: y + 0.08, z, kind: 0 });
  }
  for (let i = 0; i < nCerebel; i++) {
    const th = rand(0, Math.PI * 2), ph = Math.acos(rand(-1, 1));
    const r = rand(0.9, 1) * (1 + 0.05 * Math.sin(ph * 30));
    pts.push({
      x: Math.sin(ph) * Math.cos(th) * 0.4 * r,
      y: -0.4 + Math.cos(ph) * 0.17 * r,
      z: -0.52 + Math.sin(ph) * Math.sin(th) * 0.26 * r,
      kind: 1,
    });
  }
  for (let i = 0; i < nStem; i++) {
    const t = Math.random(), a = rand(0, Math.PI * 2);
    pts.push({ x: Math.cos(a) * 0.09, y: -0.3 - t * 0.55, z: -0.22 - t * 0.12 + Math.sin(a) * 0.09, kind: 2 });
  }
  return pts;
}

// Uma "bolinha de luz" pré-desenhada (bem mais rápido do que desenhar brilho em cada ponto)
function glowSprite(color, size = 32) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

class BrainRenderer {
  constructor(canvas, count) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pts = makeBrainPoints(count);
    this.sprites = [glowSprite('#1d4ed8'), glowSprite('#3da9ff'), glowSprite('#22d3ee'), glowSprite('#a5f3fc')];
    this.angle = 0;     // tempo do balanço (o cérebro mostra o perfil e gira de leve)
    this.pulse = 0;      // sobe quando a Atena fala uma palavra
    this.speaking = false;
    this.running = false;
    this.makeLinks();
    this.sparks = Array.from({ length: 14 }, () => this.newSpark());
  }

  // "Sinapses": liga alguns pontos aos vizinhos mais próximos
  makeLinks() {
    const sample = this.pts.filter((p) => p.kind === 0).sort(() => Math.random() - 0.5).slice(0, 170);
    this.links = [];
    sample.forEach((a) => {
      sample
        .map((b) => [b, (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2])
        .filter(([b, d]) => b !== a && d < 0.035)
        .sort((m, n) => m[1] - n[1])
        .slice(0, 2)
        .forEach(([b]) => this.links.push([a, b]));
    });
  }
  newSpark() {
    return { link: this.links[Math.floor(Math.random() * this.links.length)], t: Math.random(), speed: 0.006 + Math.random() * 0.012 };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return false;
    if (this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    return true;
  }

  setLevel(v) {
    if (v > 0) { this.pulse = 1; this.speaking = true; } else this.speaking = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (t) => {
      if (!this.running) return;
      this.draw(t / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  draw(time) {
    if (!this.resize()) return;
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.angle += (this.speaking ? 0.014 : 0.006) * (reduce ? 0.3 : 1);
    // Começa de perfil (a forma mais reconhecível) e balança para os lados
    const rot = Math.PI / 2 + Math.sin(this.angle) * 1.1;
    this.pulse *= 0.92;

    // Respiração leve + pulso da fala
    const scale = Math.min(W, H) * 0.46 * (1 + 0.015 * Math.sin(time * 1.6) + 0.07 * this.pulse);
    const cosA = Math.cos(rot), sinA = Math.sin(rot);
    const tilt = 0.18, cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    const cx = W / 2, cy = H * 0.47;
    const cam = 3.2;

    const project = (p) => {
      // gira em volta do eixo Y e inclina um pouco no eixo X
      const x = p.x * cosA + p.z * sinA;
      let z = -p.x * sinA + p.z * cosA;
      const y = p.y * cosT - z * sinT;
      z = p.y * sinT + z * cosT;
      const f = cam / (cam + z);
      return { sx: cx + x * scale * f, sy: cy - y * scale * f, z, f };
    };

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; // pontos sobrepostos somam luz (efeito neon)

    // Sinapses
    ctx.lineWidth = Math.max(1, W / 400);
    ctx.strokeStyle = `rgba(61, 169, 255, ${0.08 + 0.12 * this.pulse})`;
    ctx.beginPath();
    this.links.forEach(([a, b]) => {
      const pa = project(a), pb = project(b);
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
    });
    ctx.stroke();

    // Partículas
    const base = Math.max(4, W / 55);
    const boost = 1 + 0.6 * this.pulse;
    for (const p of this.pts) {
      const q = project(p);
      const depth = (1 - q.z) / 2;                  // 0 = fundo, 1 = frente
      const level = Math.min(3, Math.floor(depth * 3.2 + this.pulse * 0.8));
      const size = base * q.f * (0.6 + depth * 0.7) * boost;
      ctx.globalAlpha = Math.min(1, 0.25 + depth * 0.75);
      ctx.drawImage(this.sprites[level], q.sx - size / 2, q.sy - size / 2, size, size);
    }

    // Impulsos elétricos correndo pelas sinapses
    ctx.globalAlpha = 1;
    const speedUp = this.speaking ? 2.2 : 1;
    this.sparks.forEach((s, i) => {
      s.t += s.speed * speedUp;
      if (s.t >= 1) { this.sparks[i] = this.newSpark(); this.sparks[i].t = 0; return; }
      const [a, b] = s.link;
      const pa = project(a), pb = project(b);
      const size = base * 2.4 * pa.f;
      ctx.drawImage(this.sprites[3], pa.sx + (pb.sx - pa.sx) * s.t - size / 2, pa.sy + (pb.sy - pa.sy) * s.t - size / 2, size, size);
    });
    ctx.globalCompositeOperation = 'source-over';
  }
}

const Brain = {
  splash: null,
  voice: null,

  // Celulares mais fracos recebem menos partículas
  particleCount(big) {
    const weak = (navigator.hardwareConcurrency || 4) <= 4 || window.innerWidth < 500;
    return big ? (weak ? 1200 : 1800) : (weak ? 600 : 900);
  },

  showSplash(speakNow = false) {
    const el = $('#splash');
    el.hidden = false;
    el.classList.remove('leaving');
    $('#splashName').textContent = Store.data.settings.assistantName.toUpperCase();
    $('#splashGreet').textContent = Home.greetingText();
    if (!this.splash) this.splash = new BrainRenderer($('#splashBrain'), this.particleCount(true));
    this.splash.start();
    this.splashOpen = true;
    if (speakNow) this.enter();
  },

  // Toque na abertura: fala a saudação e entra no app
  enter() {
    if (this.entering) return;
    this.entering = true;
    const s = Store.data.settings;
    if (s.splashVoice) Voice.speak(Home.greetingText());
    setTimeout(() => $('#splash').classList.add('leaving'), s.splashVoice ? 1800 : 300);
    setTimeout(() => {
      $('#splash').hidden = true;
      this.splash && this.splash.stop();
      this.splashOpen = false;
      this.entering = false;
    }, s.splashVoice ? 2500 : 1000);
  },

  renderSettings() {
    const s = Store.data.settings;
    [['#setSplash', s.splash], ['#setSplashVoice', s.splashVoice]].forEach(([id, on]) => {
      $(id).classList.toggle('on', on);
      $(id).setAttribute('aria-checked', on);
    });
  },

  init() {
    // Todo "pulso" da fala chega aos dois cérebros
    Voice.onLevel = (v) => {
      this.splash && this.splash.setLevel(v);
      this.voice && this.voice.setLevel(v);
    };

    if (Store.data.settings.splash && !$('#splash').hidden) this.showSplash();
    else $('#splash').hidden = true;
    $('#splash').addEventListener('click', () => { if ($('#lockScreen').hidden) this.enter(); });

    // Cérebro do painel de voz: só anima enquanto o painel está aberto
    this.voice = new BrainRenderer($('#voiceBrain'), this.particleCount(false));
    new MutationObserver(() => {
      if ($('#voicePanel').hidden) this.voice.stop(); else this.voice.start();
    }).observe($('#voicePanel'), { attributes: true, attributeFilter: ['hidden'] });

    // Economia de bateria: app escondido = animação parada
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.splash && this.splash.stop();
        this.voice.stop();
      } else {
        if (this.splashOpen) this.splash.start();
        if (!$('#voicePanel').hidden) this.voice.start();
      }
    });

    // Configurações
    this.renderSettings();
    $('#setSplash').addEventListener('click', () => {
      Store.data.settings.splash = !Store.data.settings.splash;
      Store.save(); this.renderSettings();
    });
    $('#setSplashVoice').addEventListener('click', () => {
      Store.data.settings.splashVoice = !Store.data.settings.splashVoice;
      Store.save(); this.renderSettings();
    });
    $('#previewSplash').addEventListener('click', () => this.showSplash(true));
  },
};

/* ---------- 20. SINCRONIZAÇÃO NA NUVEM (Firebase) ---------- */
// Como funciona:
// - O app continua salvando TUDO no aparelho (funciona offline).
// - Quando o senhor entra com a conta Google, uma cópia dos dados vai para
//   o Firestore (banco do Firebase), no documento users/<seu id>.
// - Outro aparelho logado na mesma conta recebe essa cópia.
// - Cada mudança sobe sozinha alguns segundos depois (para gastar pouco).
// A configuração do Firebase fica salva neste aparelho (chave "atena-sync"),
// então não é preciso mexer no código.
const FIREBASE_VERSION = '10.12.2';
const SYNC_KEY = 'atena-sync';

const Sync = {
  meta: null,  // { config, updatedAt, syncedAt, deviceId }
  api: null,   // funções do Firebase já carregadas
  user: null,
  timer: null,
  stopWatch: null,

  loadMeta() {
    try { this.meta = JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { this.meta = {}; }
    this.meta = { config: null, updatedAt: 0, syncedAt: 0, ...this.meta };
    if (!this.meta.deviceId) { this.meta.deviceId = uid(); this.saveMeta(); }
  },
  saveMeta() { localStorage.setItem(SYNC_KEY, JSON.stringify(this.meta)); },

  // Lê o bloco "firebaseConfig" colado (aceita o código JS do console ou JSON)
  parseConfig(text) {
    const cfg = {};
    const re = /["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(text))) cfg[m[1]] = m[2];
    const need = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missing = need.filter((k) => !cfg[k]);
    if (missing.length) throw new Error('Faltou: ' + missing.join(', '));
    return cfg;
  },

  // Baixa o Firebase da internet (só quando a sincronização está configurada)
  async loadFirebase(config) {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
    const [appM, authM, fsM] = await Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js'),
    ]);
    const app = appM.initializeApp(config);
    const auth = authM.getAuth(app);
    const db = fsM.getFirestore(app);
    const ref = (id) => fsM.doc(db, 'users', id);
    return {
      onUser: (cb) => authM.onAuthStateChanged(auth, cb),
      signIn: async () => {
        const provider = new authM.GoogleAuthProvider();
        try {
          await authM.signInWithPopup(auth, provider);
        } catch (e) {
          // Se o navegador bloquear a janelinha, entra pela página inteira
          if (/popup-blocked|operation-not-supported/.test(e.code || '')) return authM.signInWithRedirect(auth, provider);
          throw e;
        }
      },
      signOut: () => authM.signOut(auth),
      get: async (id) => { const snap = await fsM.getDoc(ref(id)); return snap.exists() ? snap.data() : null; },
      put: (id, payload) => fsM.setDoc(ref(id), payload),
      watch: (id, cb) => fsM.onSnapshot(ref(id), (snap) => cb(snap.exists() ? snap.data() : null)),
    };
  },

  async connect() {
    if (!this.meta.config || this.api) return;
    if (!navigator.onLine) { this.status('Sem internet. Os dados ficam no aparelho e sobem quando a conexão voltar.'); return; }
    this.status('Conectando...');
    try {
      this.api = await this.loadFirebase(this.meta.config);
    } catch (e) {
      console.warn(e);
      this.api = null;
      this.status('Não foi possível carregar o Firebase. Confira a internet e a configuração.');
      return;
    }
    this.api.onUser((user) => {
      this.user = user;
      if (this.stopWatch) { this.stopWatch(); this.stopWatch = null; }
      if (user) this.firstSync();
      this.render();
    });
    this.render();
  },

  // Ao entrar: decide se usa os dados da nuvem ou envia os deste aparelho
  async firstSync() {
    try {
      this.status('Sincronizando...');
      const remote = await this.api.get(this.user.uid);
      const m = this.meta;
      const localChanged = m.updatedAt > m.syncedAt;
      if (!remote) {
        await this.upload();
      } else if (!m.syncedAt) {
        // Primeira vez neste aparelho e já existem dados na nuvem
        const when = new Date(remote.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        if (confirm(`Encontrei dados seus na nuvem (salvos em ${when}).\n\nOK = usar os dados da nuvem neste aparelho\nCancelar = enviar os dados DESTE aparelho para a nuvem`)) {
          return this.applyRemote(remote);
        }
        await this.upload();
      } else if (remote.updatedAt > m.syncedAt && !localChanged) {
        return this.applyRemote(remote);
      } else if (remote.updatedAt > m.syncedAt && localChanged) {
        if (confirm('Os dados mudaram neste aparelho E em outro.\n\nOK = usar os dados da NUVEM\nCancelar = manter os deste aparelho')) {
          return this.applyRemote(remote);
        }
        await this.upload();
      } else if (localChanged) {
        await this.upload();
      }
      this.watch();
      this.render();
    } catch (e) {
      this.fail(e);
    }
  },

  // Fica "escutando" mudanças feitas em outro aparelho
  watch() {
    if (this.stopWatch) return;
    this.stopWatch = this.api.watch(this.user.uid, (remote) => {
      if (!remote || remote.device === this.meta.deviceId) return;
      if (remote.updatedAt <= this.meta.syncedAt) return;
      if (this.meta.updatedAt > this.meta.syncedAt) return; // há mudança local esperando subir: ela vence
      toast('Atualizando com dados de outro aparelho...');
      setTimeout(() => this.applyRemote(remote), 1200);
    });
  },

  // Troca os dados deste aparelho pelos da nuvem e recarrega o app
  applyRemote(remote) {
    localStorage.setItem(STORAGE_KEY, remote.data);
    this.meta.updatedAt = this.meta.syncedAt = remote.updatedAt;
    this.saveMeta();
    location.reload();
  },

  async upload() {
    if (!this.api || !this.user) return;
    clearTimeout(this.timer);
    const data = JSON.stringify(Store.data);
    if (data.length > 900000) { this.status('Dados grandes demais para a nuvem (limite de 1 MB). Faça um backup manual.'); return; }
    const payload = { data, updatedAt: Date.now(), device: this.meta.deviceId };
    try {
      await this.api.put(this.user.uid, payload);
      this.meta.syncedAt = payload.updatedAt;
      if (this.meta.updatedAt < payload.updatedAt) this.meta.updatedAt = payload.updatedAt;
      this.saveMeta();
      this.render();
    } catch (e) {
      this.fail(e);
    }
  },

  // Chamado pelo Store a cada gravação: marca a mudança e agenda o envio
  onLocalChange() {
    this.meta.updatedAt = Date.now();
    this.saveMeta();
    if (!this.user) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.upload(), 4000);
  },

  fail(e) {
    console.warn(e);
    const code = (e && e.code) || '';
    const msg = code.includes('unauthorized-domain')
      ? `Este endereço não está autorizado. No Firebase: Authentication → Configurações → Domínios autorizados → adicione "${location.hostname}".`
      : code.includes('permission-denied')
        ? 'O Firestore recusou o acesso. Confira se as regras do FIREBASE.md foram publicadas.'
        : code.includes('popup-closed') ? 'Login cancelado.'
          : 'Algo deu errado na sincronização. Os dados continuam salvos no aparelho.';
    this.status(msg, true);
  },

  status(text, isError = false) {
    $('#syncStatus').textContent = text;
    $('#syncStatus').classList.toggle('error', isError);
  },

  render() {
    const hasConfig = !!this.meta.config;
    $('#syncSetup').hidden = hasConfig;
    $('#syncAccount').hidden = !hasConfig;
    const logged = !!this.user;
    $('#syncLogin').hidden = logged;
    $('#syncNow').hidden = !logged;
    $('#syncLogout').hidden = !logged;
    if (!hasConfig) this.status('Desligada. Os dados ficam só neste aparelho.');
    else if (!this.api) return;
    else if (!logged) this.status('Pronta. Entre com o Google para ligar.');
    else {
      const last = this.meta.syncedAt
        ? new Date(this.meta.syncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '—';
      this.status(`Conectado como ${this.user.email || this.user.displayName} · última sincronização às ${last}`);
    }
  },

  init() {
    this.loadMeta();
    Store.onSave = () => this.onLocalChange();

    $('#syncSaveConfig').addEventListener('click', () => {
      try {
        this.meta.config = this.parseConfig($('#syncConfig').value);
        this.saveMeta();
        toast('Configuração salva ✓');
        this.render();
        this.connect();
      } catch (e) {
        this.status('Configuração incompleta. ' + e.message, true);
      }
    });
    $('#syncChangeConfig').addEventListener('click', () => {
      if (!confirm('Trocar a configuração? O senhor sairá da conta e o app vai recarregar.')) return;
      this.meta.config = null;
      this.meta.syncedAt = 0;
      this.saveMeta();
      location.reload();
    });
    $('#syncLogin').addEventListener('click', async () => {
      if (!this.api) { await this.connect(); if (!this.api) return; }
      try { await this.api.signIn(); } catch (e) { this.fail(e); }
    });
    $('#syncLogout').addEventListener('click', async () => {
      await this.upload();
      await this.api.signOut();
      this.meta.syncedAt = 0; // ao entrar de novo, pergunta o que fazer
      this.saveMeta();
      toast('Saiu da conta. Os dados continuam neste aparelho.');
    });
    $('#syncNow').addEventListener('click', async () => { await this.upload(); toast('Sincronizado ✓'); });

    // Envia o que faltar quando o app vai para segundo plano ou a internet volta
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.user && this.meta.updatedAt > this.meta.syncedAt) this.upload();
    });
    window.addEventListener('online', () => {
      if (!this.api) this.connect();
      else if (this.user && this.meta.updatedAt > this.meta.syncedAt) this.upload();
    });

    this.render();
    this.connect();
  },
};

/* ---------- 21. BLOQUEIO (PIN e digital/rosto) ---------- */
// lock (chave "atena-lock", só neste aparelho, não vai para o backup nem para a nuvem):
//   { enabled, salt, hash, credId, lockAfter (minutos), hiddenAt }
// O PIN nunca é guardado: guardamos o "hash" (uma impressão digital do PIN).
// A digital/rosto usa WebAuthn: o próprio celular confere a biometria.
const LOCK_KEY = 'atena-lock';

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

const Lock = {
  cfg: null,
  mode: 'unlock',   // unlock | set1 | set2 | verify
  pin: '',
  firstPin: '',
  fails: 0,
  blockedUntil: 0,
  resolve: null,    // usado quando pedimos o PIN para confirmar algo
  bioAvailable: false,

  load() {
    try { this.cfg = JSON.parse(localStorage.getItem(LOCK_KEY)) || {}; } catch (e) { this.cfg = {}; }
    this.cfg = { enabled: false, lockAfter: 1, ...this.cfg };
  },
  save() { localStorage.setItem(LOCK_KEY, JSON.stringify(this.cfg)); },

  async hash(pin, salt) {
    const bytes = new TextEncoder().encode(salt + ':' + pin);
    return toB64(await crypto.subtle.digest('SHA-256', bytes));
  },

  // ----- Tela do teclado -----
  open(mode, title) {
    this.mode = mode;
    this.pin = '';
    $('#lockTitle').textContent = title;
    $('#lockMsg').textContent = '';
    $('#lockCancel').hidden = mode === 'unlock';
    $('#lockForgot').hidden = mode !== 'unlock';
    $('#bioKey').style.visibility = mode === 'unlock' && this.cfg.credId && this.bioAvailable ? 'visible' : 'hidden';
    $('#lockScreen').hidden = false;
    this.dots();
  },
  close() { $('#lockScreen').hidden = true; },

  dots(state = '') {
    $$('#pinDots i').forEach((d, i) => d.classList.toggle('on', i < this.pin.length));
    const box = $('#pinDots');
    box.classList.remove('shake', 'ok');
    if (state) { void box.offsetWidth; box.classList.add(state); }
  },

  async press(k) {
    if (k === 'bio') return this.bioUnlock();
    if (Date.now() < this.blockedUntil) return;
    if (k === 'del') { this.pin = this.pin.slice(0, -1); this.dots(); return; }
    if (this.pin.length >= 4) return;
    this.pin += k;
    this.dots();
    if (this.pin.length === 4) setTimeout(() => this.complete(), 120);
  },

  async complete() {
    const pin = this.pin;
    if (this.mode === 'set1') {
      this.firstPin = pin;
      this.open('set2', 'Repita o novo PIN');
      return;
    }
    if (this.mode === 'set2') {
      if (pin !== this.firstPin) {
        this.pin = ''; this.dots('shake');
        $('#lockMsg').textContent = 'Os PINs não são iguais. Comece de novo.';
        setTimeout(() => this.open('set1', 'Crie um PIN de 4 dígitos'), 1100);
        return;
      }
      this.cfg.salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
      this.cfg.hash = await this.hash(pin, this.cfg.salt);
      this.cfg.enabled = true;
      this.save();
      this.dots('ok');
      setTimeout(() => { this.close(); this.renderSettings(); toast('PIN salvo 🔒'); }, 400);
      return;
    }
    // unlock ou verify: confere o PIN
    const ok = (await this.hash(pin, this.cfg.salt)) === this.cfg.hash;
    if (ok) {
      this.fails = 0;
      this.dots('ok');
      setTimeout(() => this.success(), 250);
    } else {
      this.fails++;
      this.pin = '';
      this.dots('shake');
      if (this.fails >= 5) {
        this.blockedUntil = Date.now() + 30000;
        $('#lockMsg').textContent = 'Muitas tentativas. Espere 30 segundos.';
        setTimeout(() => { $('#lockMsg').textContent = ''; this.fails = 0; }, 30000);
      } else {
        $('#lockMsg').textContent = `PIN incorreto (${this.fails} de 5)`;
      }
    }
  },

  success() {
    this.close();
    if (this.mode === 'verify') {
      if (this.resolve) this.resolve(true);
      this.resolve = null;
      return;
    }
    // Desbloqueou ao abrir: se a abertura do cérebro estiver na tela, já entra (e fala a saudação)
    if (Brain.splashOpen) Brain.enter();
  },

  // Pede o PIN atual antes de desligar/trocar (devolve true ou false)
  verify(title) {
    return new Promise((res) => {
      this.resolve = res;
      this.open('verify', title);
    });
  },

  // ----- Digital / rosto (WebAuthn) -----
  async checkBio() {
    try {
      this.bioAvailable = !!(window.PublicKeyCredential
        && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (e) { this.bioAvailable = false; }
  },

  async registerBio() {
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Atena' },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'atena', displayName: Store.data.settings.userTitle },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
        },
      });
      this.cfg.credId = toB64(cred.rawId);
      this.save();
      toast('Digital/rosto ativado ✓');
    } catch (e) {
      console.warn(e);
      toast('Não foi possível ativar a biometria.');
    }
    this.renderSettings();
  },

  async bioUnlock() {
    if (!this.cfg.credId) return;
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: fromB64(this.cfg.credId) }],
          userVerification: 'required',
          timeout: 60000,
        },
      });
      this.dots('ok');
      setTimeout(() => this.success(), 200);
    } catch (e) {
      $('#lockMsg').textContent = 'Biometria cancelada. Use o PIN.';
    }
  },

  // Esqueceu o PIN: o único jeito é apagar os dados deste aparelho
  forgot() {
    const sync = (() => { try { return JSON.parse(localStorage.getItem('atena-sync')) || {}; } catch (e) { return {}; } })();
    const extra = sync.config
      ? '\n\nComo a sincronização está configurada, depois é só entrar com o Google para trazer seus dados da nuvem.'
      : '\n\nSem sincronização, só dá para recuperar com um arquivo de backup.';
    if (!confirm('Para tirar o PIN é preciso apagar os dados DESTE aparelho.' + extra + '\n\nApagar e recomeçar?')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOCK_KEY);
    if (sync.config) { sync.syncedAt = 0; sync.updatedAt = 0; localStorage.setItem('atena-sync', JSON.stringify(sync)); }
    location.reload();
  },

  // ----- Configurações -----
  renderSettings() {
    const c = this.cfg;
    const set = (id, on) => { $(id).classList.toggle('on', on); $(id).setAttribute('aria-checked', on); };
    set('#setLock', c.enabled);
    set('#setBio', !!c.credId);
    $('#lockOptions').hidden = !c.enabled;
    $('#bioRow').hidden = !this.bioAvailable;
    $$('#setLockAfter .seg').forEach((b) => b.classList.toggle('active', Number(b.dataset.min) === c.lockAfter));
  },

  init() {
    this.load();

    // Se a tela de bloqueio já apareceu (script no index.html), prepara o teclado
    if (this.cfg.enabled) this.open('unlock', `Olá, ${Store.data.settings.userTitle}! Digite seu PIN`);
    else this.close();

    $('#keypad').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.press(b.dataset.k);
    });
    // Teclado físico (no PC)
    document.addEventListener('keydown', (e) => {
      if ($('#lockScreen').hidden) return;
      if (/^[0-9]$/.test(e.key)) this.press(e.key);
      if (e.key === 'Backspace') this.press('del');
    });
    $('#lockCancel').addEventListener('click', () => {
      this.close();
      if (this.resolve) this.resolve(false);
      this.resolve = null;
      this.renderSettings();
    });
    $('#lockForgot').addEventListener('click', () => this.forgot());

    // Bloqueia de novo quando o app fica escondido por um tempo
    document.addEventListener('visibilitychange', () => {
      if (!this.cfg.enabled) return;
      if (document.hidden) { this.cfg.hiddenAt = Date.now(); this.save(); return; }
      const away = (Date.now() - (this.cfg.hiddenAt || Date.now())) / 60000;
      if (away >= this.cfg.lockAfter && $('#lockScreen').hidden) this.open('unlock', 'Digite seu PIN');
    });

    // Configurações
    $('#setLock').addEventListener('click', async () => {
      if (!this.cfg.enabled) { this.open('set1', 'Crie um PIN de 4 dígitos'); return; }
      if (!(await this.verify('Digite o PIN atual para desligar'))) return;
      this.cfg = { enabled: false, lockAfter: this.cfg.lockAfter };
      this.save();
      this.renderSettings();
      toast('Bloqueio desligado');
    });
    $('#changePin').addEventListener('click', async () => {
      if (!(await this.verify('Digite o PIN atual'))) return;
      this.open('set1', 'Crie o novo PIN');
    });
    $('#setBio').addEventListener('click', () => {
      if (this.cfg.credId) { delete this.cfg.credId; this.save(); this.renderSettings(); }
      else this.registerBio();
    });
    $('#setLockAfter').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      this.cfg.lockAfter = Number(b.dataset.min);
      this.save();
      this.renderSettings();
    });
    this.renderSettings();

    // Descobre (sem travar a abertura) se o aparelho tem digital/rosto
    this.checkBio().then(() => {
      this.renderSettings();
      if (!$('#lockScreen').hidden && this.mode === 'unlock') {
        $('#bioKey').style.visibility = this.cfg.credId && this.bioAvailable ? 'visible' : 'hidden';
      }
    });
  },
};

/* ---------- 22. METAS DA SEMANA ---------- */
// weekGoals = { '2026-11-16': [{ id, text, done }] }  (a chave é a segunda-feira da semana)
const WeekGoals = {
  MAX: 5,

  // Segunda-feira da semana de uma data
  weekKey(d = new Date()) {
    const x = new Date(d);
    const wd = x.getDay();
    x.setDate(x.getDate() - (wd === 0 ? 6 : wd - 1));
    return dateKey(x);
  },
  list(key = this.weekKey()) { return Store.data.weekGoals[key] || []; },

  add(text) {
    const key = this.weekKey();
    const list = Store.data.weekGoals[key] || (Store.data.weekGoals[key] = []);
    if (list.length >= this.MAX) return false;
    list.push({ id: uid(), text: text.charAt(0).toUpperCase() + text.slice(1), done: false });
    Store.save();
    this.render();
    return true;
  },

  toggle(id) {
    const g = this.list().find((x) => x.id === id);
    g.done = !g.done;
    Store.save();
    if (g.done) XP.award(`goal:${g.id}`, 'goal', g.text); else XP.revoke(`goal:${g.id}`);
    return g.done;
  },

  remove(id) {
    const key = this.weekKey();
    Store.data.weekGoals[key] = this.list().filter((x) => x.id !== id);
    Store.save();
    XP.revoke(`goal:${id}`);
    this.render();
  },

  render() {
    const list = this.list();
    const done = list.filter((g) => g.done).length;
    $('#weekCount').textContent = `${done}/${list.length}`;
    $('#weekForm').hidden = list.length >= this.MAX;

    // Dica: semana passada ou convite para definir metas
    const prev = new Date(); prev.setDate(prev.getDate() - 7);
    const last = this.list(this.weekKey(prev));
    let hint = '';
    if (!list.length) hint = `Defina até 3 metas para esta semana, ${Store.data.settings.userTitle}. Cada meta cumprida vale 30 XP.`;
    else if (done === list.length) hint = 'Todas as metas da semana cumpridas! 🏆';
    if (last.length) hint += `${hint ? ' ' : ''}Semana passada: ${last.filter((g) => g.done).length} de ${last.length}.`;
    $('#weekHint').textContent = hint;
    $('#weekHint').hidden = !hint;

    $('#weekGoals').innerHTML = list.map((g) => `
      <li class="task ${g.done ? 'done' : ''}" data-id="${g.id}">
        <button class="check" data-act="toggle" aria-label="Marcar meta">${ICON_CHECK}</button>
        <span class="task-title">${esc(g.text)}</span>
        <button class="mini-btn" data-act="del" aria-label="Apagar meta">${ICON_TRASH}</button>
      </li>`).join('');
  },

  init() {
    $('#weekForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('#weekInput').value.trim();
      if (!text) return;
      this.add(text);
      $('#weekInput').value = '';
    });
    $('#weekGoals').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const li = b.closest('li');
      if (b.dataset.act === 'del') {
        if (confirm('Apagar esta meta?')) this.remove(li.dataset.id);
        return;
      }
      const done = this.toggle(li.dataset.id);
      li.classList.toggle('done', done);
      if (done) {
        Tasks.celebrate(li);
        if (this.list().every((g) => g.done)) { Confetti.burst(); Sound.fanfare(); }
      }
      setTimeout(() => this.render(), done ? 650 : 0);
    });
    this.render();
  },
};

/* ---------- 23. FECHAMENTO DO DIA ---------- */
// Junta tudo do dia: tarefas, hábitos, foco, humor, XP e metas da semana.
const DayEnd = {
  open: null, // null = automático (abre sozinho à noite); true/false = o usuário escolheu

  isEvening() { return new Date().getHours() >= 18; },

  collect() {
    const today = todayKey();
    const tasks = Tasks.tasksForDay(new Date().getDay());
    const habits = Store.data.habits;
    const focus = Store.data.focusLog.filter((f) => f.date === today);
    const mood = Store.data.moods[today];
    const goals = WeekGoals.list();
    return {
      tasksDone: tasks.filter((t) => t.doneDates.includes(today)),
      tasksLeft: tasks.filter((t) => !t.doneDates.includes(today)),
      habitsDone: habits.filter((h) => h.doneDates.includes(today)),
      habitsLeft: habits.filter((h) => !h.doneDates.includes(today)),
      pomos: focus.length,
      focusMin: focus.reduce((s, f) => s + f.minutes, 0),
      xp: Store.data.xpLog.filter((x) => x.date === today).reduce((s, x) => s + x.amount, 0),
      mood: mood ? MOODS[mood.level - 1] : null,
      goalsDone: goals.filter((g) => g.done).length,
      goalsTotal: goals.length,
      perf: Store.data.performance[today],
    };
  },

  // Texto falado pela Atena
  text() {
    const d = this.collect();
    const title = Store.data.settings.userTitle;
    const parts = [`Fechamento do dia, ${title}.`];
    const totalT = d.tasksDone.length + d.tasksLeft.length;
    if (totalT) parts.push(`Você concluiu ${d.tasksDone.length} de ${totalT} tarefas.`);
    if (d.tasksLeft.length) parts.push(`Ficou faltando: ${d.tasksLeft.slice(0, 3).map((t) => t.title).join(', ')}.`);
    if (d.habitsDone.length + d.habitsLeft.length) parts.push(`Hábitos: ${d.habitsDone.length} de ${d.habitsDone.length + d.habitsLeft.length}.`);
    if (d.focusMin) parts.push(`Foram ${d.focusMin} minutos de foco.`);
    parts.push(d.xp ? `Você ganhou ${d.xp} pontos de experiência hoje.` : 'Hoje ainda não teve pontos de experiência.');
    if (d.goalsTotal) parts.push(`Metas da semana: ${d.goalsDone} de ${d.goalsTotal}.`);
    if (!d.mood) parts.push('Não esqueça de registrar seu humor.');
    if (!d.perf) parts.push('E registre como foi o dia no Desempenho.');
    const good = totalT ? d.tasksDone.length / totalT >= 0.7 : d.xp >= 30;
    parts.push(good ? 'Excelente dia! Descanse bem.' : 'Amanhã é uma nova chance. Descanse bem.');
    return parts.join(' ');
  },

  render() {
    const evening = this.isEvening();
    const show = this.open === null ? evening : this.open;
    $('#dayEnd').hidden = !show;
    $('#dayCardTitle').textContent = evening ? 'Fechamento do dia' : 'Resumo do dia';
    $('#dayEndToggle').textContent = show ? 'Esconder' : 'Ver fechamento';
    if (!show) return;

    const d = this.collect();
    const totalT = d.tasksDone.length + d.tasksLeft.length;
    const totalH = d.habitsDone.length + d.habitsLeft.length;
    const cell = (num, label) => `<div><strong>${num}</strong><span>${label}</span></div>`;
    $('#dayEndGrid').innerHTML =
      cell(`${d.tasksDone.length}/${totalT}`, 'tarefas') +
      cell(`${d.habitsDone.length}/${totalH}`, 'hábitos') +
      cell(`${d.focusMin}`, 'min de foco') +
      cell(`${d.xp}`, 'XP hoje') +
      cell(d.mood ? d.mood.emoji : '—', 'humor') +
      cell(`${d.goalsDone}/${d.goalsTotal}`, 'metas sem.');

    const block = (title, items, cls) => items.length
      ? `<p class="day-end-label ${cls}">${title}</p><ul class="day-end-list">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    const todo = [];
    if (!d.mood) todo.push('Registrar o humor de hoje');
    if (!d.perf) todo.push('Registrar a nota do dia no Desempenho');
    $('#dayEndLists').innerHTML =
      block('✓ Feito', [...d.tasksDone.map((t) => t.title), ...d.habitsDone.map((h) => `${h.emoji} ${h.name}`)], 'ok') +
      block('○ Faltou', [...d.tasksLeft.map((t) => t.title), ...d.habitsLeft.map((h) => `${h.emoji} ${h.name}`)], 'left') +
      block('Antes de dormir', todo, 'next');
  },

  // Aviso no horário escolhido (com o app aberto ou minimizado)
  check() {
    const s = Store.data.settings;
    if (!s.dayEnd) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (hhmm < s.dayEndTime || Store.data.dayEndShown === todayKey()) return;
    Store.data.dayEndShown = todayKey();
    Store.save();
    const d = this.collect();
    const totalT = d.tasksDone.length + d.tasksLeft.length;
    Reminders.notify(`Fechamento do dia: ${d.tasksDone.length}/${totalT} tarefas e ${d.xp} XP. Abra para ver o resumo completo.`);
    this.render();
  },

  renderSettings() {
    const s = Store.data.settings;
    $('#setDayEnd').classList.toggle('on', s.dayEnd);
    $('#setDayEnd').setAttribute('aria-checked', s.dayEnd);
    $('#setDayEndTime').value = s.dayEndTime;
  },

  init() {
    $('#dayEndToggle').addEventListener('click', () => {
      this.open = $('#dayEnd').hidden; // estava escondido -> abre; aberto -> fecha
      this.render();
    });
    $('#dayEndSpeak').addEventListener('click', () => Voice.speak(this.text()));
    $('#setDayEnd').addEventListener('click', () => {
      Store.data.settings.dayEnd = !Store.data.settings.dayEnd;
      Store.save(); this.renderSettings();
    });
    $('#setDayEndTime').addEventListener('change', () => {
      Store.data.settings.dayEndTime = $('#setDayEndTime').value || '21:00';
      Store.data.dayEndShown = null; // permite avisar hoje no novo horário
      Store.save();
      toast(`Aviso do fechamento às ${Store.data.settings.dayEndTime}`);
    });
    this.renderSettings();
    this.render();
    this.check();
    setInterval(() => this.check(), 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { this.check(); this.render(); } });
  },
};

/* ---------- 24. PROJETOS DE PROGRAMAÇÃO ---------- */
// devProjects = [{ id, name, emoji, desc, tech: ['HTML', 'JS'], repo: 'https://github.com/...',
//                  status: 'ativo'|'pausado'|'concluido', steps: [{ id, text, done, doneAt }], createdAt, finishedAt }]
// O % de progresso = etapas concluídas ÷ total de etapas.
const DEV_STATUS = { ativo: 'Ativo', pausado: 'Pausado', concluido: 'Concluído' };

const Dev = {
  filter: 'ativo',
  openId: null, // projeto aberto (mostrando detalhes)

  get list() { return Store.data.devProjects; },
  find(id) { return this.list.find((p) => p.id === id); },

  pct(p) {
    if (!p.steps.length) return p.status === 'concluido' ? 100 : 0;
    return Math.round((p.steps.filter((x) => x.done).length / p.steps.length) * 100);
  },

  add(name, emoji) {
    const p = { id: uid(), name, emoji: emoji || '💻', desc: '', tech: [], repo: '', status: 'ativo', steps: [], createdAt: todayKey(), finishedAt: null };
    this.list.unshift(p);
    this.openId = p.id;
    this.filter = 'ativo';
    Store.save();
    this.render();
  },

  // Quando todas as etapas são concluídas, o projeto pode virar "Concluído"
  checkFinished(p, before) {
    const now = this.pct(p);
    if (now === 100 && before < 100 && p.steps.length && p.status !== 'concluido') {
      setTimeout(() => {
        if (confirm(`Todas as etapas de "${p.name}" foram concluídas! Marcar o projeto como concluído?`)) this.setStatus(p, 'concluido');
      }, 500);
    }
  },

  setStatus(p, status) {
    p.status = status;
    if (status === 'concluido') {
      p.finishedAt = todayKey();
      XP.award(`proj:${p.id}`, 'proj', p.name);
      Confetti.burst();
      Sound.fanfare();
      toast(`🚀 Projeto concluído: ${p.name}!`);
    } else {
      p.finishedAt = null;
      XP.revoke(`proj:${p.id}`);
    }
    Store.save();
    this.render();
  },

  renderStats() {
    const active = this.list.filter((p) => p.status === 'ativo');
    $('#devActive').textContent = active.length;
    $('#devAvg').textContent = active.length ? Math.round(active.reduce((s, p) => s + this.pct(p), 0) / active.length) + '%' : '–';
    const week = WeekGoals.weekKey();
    $('#devWeek').textContent = this.list.reduce((s, p) => s + p.steps.filter((x) => x.done && x.doneAt >= week).length, 0);
  },

  render() {
    this.renderStats();
    $$('#devFilter .seg').forEach((b) => b.classList.toggle('active', b.dataset.f === this.filter));
    const items = this.list.filter((p) => p.status === this.filter);
    if (!items.length) {
      const msg = { ativo: 'Nenhum projeto ativo. Crie o primeiro acima!', pausado: 'Nenhum projeto pausado.', concluido: 'Nenhum projeto concluído ainda. Bora codar! 💪' };
      $('#devList').innerHTML = `<div class="card glass empty">${msg[this.filter]}</div>`;
      return;
    }
    $('#devList').innerHTML = items.map((p, i) => {
      const pct = this.pct(p);
      const done = p.steps.filter((x) => x.done).length;
      const open = this.openId === p.id;
      return `
      <article class="card glass dev-card ${open ? 'open' : ''}" data-id="${p.id}" style="--i:${Math.min(i, 8)}">
        <div class="dev-head" data-act="open">
          <span class="dev-emoji">${esc(p.emoji)}</span>
          <div class="dev-title">
            <strong>${esc(p.name)}</strong>
            <span class="note-date">${p.steps.length ? `${done} de ${p.steps.length} etapas` : 'sem etapas ainda'}${p.finishedAt ? ' · concluído em ' + new Date(p.finishedAt + 'T12:00').toLocaleDateString('pt-BR') : ''}</span>
          </div>
          <span class="dev-pct">${pct}%</span>
        </div>
        <div class="progress"><span class="progress-bar" style="width:${pct}%"></span></div>
        ${p.tech.length ? `<div class="chips">${p.tech.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
        ${open ? `
        <div class="dev-body">
          <textarea class="boxed" data-field="desc" rows="2" maxlength="300" placeholder="Descrição do projeto...">${esc(p.desc)}</textarea>
          <input class="line-input" data-field="tech" maxlength="120" placeholder="Tecnologias (separe por vírgula: HTML, CSS, JS)" value="${esc(p.tech.join(', '))}" />
          <input class="line-input" data-field="repo" maxlength="200" inputmode="url" placeholder="Link do GitHub (https://github.com/...)" value="${esc(p.repo)}" />
          ${/^https?:\/\//.test(p.repo) ? `<a class="link-btn dev-repo" href="${esc(p.repo)}" target="_blank" rel="noopener">Abrir repositório ↗</a>` : ''}
          <p class="section-label">Etapas</p>
          <ul class="task-list dev-steps">
            ${p.steps.map((st) => `
              <li class="task ${st.done ? 'done' : ''}" data-step="${st.id}">
                <button class="check" data-act="step" aria-label="Marcar etapa">${ICON_CHECK}</button>
                <span class="task-title">${esc(st.text)}</span>
                <button class="mini-btn" data-act="delstep" aria-label="Apagar etapa">${ICON_TRASH}</button>
              </li>`).join('')}
          </ul>
          <form class="week-add" data-act="addstep" autocomplete="off">
            <input class="line-input" maxlength="80" placeholder="Nova etapa (ex.: Criar tela de login)" aria-label="Nova etapa" />
            <button class="add-btn" aria-label="Adicionar etapa">+</button>
          </form>
          <div class="segmented tiny dev-status">
            ${Object.entries(DEV_STATUS).map(([k, v]) => `<button class="seg ${p.status === k ? 'active' : ''}" data-act="status" data-status="${k}">${v}</button>`).join('')}
          </div>
          <button class="ghost-btn small-btn danger-text" data-act="del">Apagar projeto</button>
        </div>` : ''}
      </article>`;
    }).join('');
  },

  init() {
    $('#devForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#devName').value.trim();
      if (!name) return;
      this.add(name, $('#devEmoji').value.trim());
      $('#devName').value = '';
    });
    $('#devFilter').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      this.filter = b.dataset.f;
      this.render();
    });

    const list = $('#devList');
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.tagName === 'FORM') return;
      const card = b.closest('.dev-card');
      const p = this.find(card.dataset.id);
      const act = b.dataset.act;
      if (act === 'open') { this.openId = this.openId === p.id ? null : p.id; this.render(); }
      if (act === 'step') {
        const st = p.steps.find((x) => x.id === b.closest('li').dataset.step);
        const before = this.pct(p);
        st.done = !st.done;
        st.doneAt = st.done ? todayKey() : null;
        Store.save();
        if (st.done) { XP.award(`step:${st.id}`, 'step', st.text); Tasks.celebrate(b.closest('li')); } else XP.revoke(`step:${st.id}`);
        setTimeout(() => this.render(), st.done ? 600 : 0);
        this.checkFinished(p, before);
      }
      if (act === 'delstep') {
        const id = b.closest('li').dataset.step;
        p.steps = p.steps.filter((x) => x.id !== id);
        XP.revoke(`step:${id}`);
        Store.save(); this.render();
      }
      if (act === 'status') this.setStatus(p, b.dataset.status);
      if (act === 'del' && confirm(`Apagar o projeto "${p.name}"?`)) {
        Store.data.devProjects = this.list.filter((x) => x.id !== p.id);
        Store.save(); this.render();
      }
    });
    // Nova etapa
    list.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      const p = this.find(e.target.closest('.dev-card').dataset.id);
      p.steps.push({ id: uid(), text, done: false, doneAt: null });
      Store.save();
      this.render();
      $(`.dev-card[data-id="${p.id}"] form input`).focus();
    });
    // Descrição, tecnologias e link: salvam ao sair do campo
    list.addEventListener('change', (e) => {
      const f = e.target.dataset.field;
      if (!f) return;
      const p = this.find(e.target.closest('.dev-card').dataset.id);
      const v = e.target.value.trim();
      if (f === 'tech') p.tech = v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10);
      else p[f] = v;
      Store.save();
      this.render();
      toast('Projeto atualizado');
    });
    this.render();
  },
};

/* ---------- 25. TREINOS ---------- */
// workouts = [{ id, date: '2026-11-22', name: 'Treino A', exercises: [{ name, sets, reps, weight }], minutes, note }]
const Workout = {
  get list() { return Store.data.workouts; },

  // Uma linha de exercício no formulário
  rowHTML(ex = {}) {
    return `
      <div class="wo-row">
        <input class="wo-ex" list="woExercises" maxlength="40" placeholder="Supino" value="${esc(ex.name || '')}" aria-label="Exercício" />
        <input class="wo-n" type="number" min="0" max="20" inputmode="numeric" placeholder="4" value="${ex.sets || ''}" aria-label="Séries" />
        <input class="wo-n" type="number" min="0" max="100" inputmode="numeric" placeholder="10" value="${ex.reps || ''}" aria-label="Repetições" />
        <input class="wo-n" type="number" min="0" max="999" step="0.5" inputmode="decimal" placeholder="0" value="${ex.weight || ''}" aria-label="Carga em kg" />
        <button type="button" class="mini-btn" data-act="delrow" aria-label="Tirar exercício">${ICON_TRASH}</button>
      </div>`;
  },
  resetForm() {
    $('#woDate').value = todayKey();
    $('#woName').value = '';
    $('#woRows').innerHTML = this.rowHTML() + this.rowHTML() + this.rowHTML();
    $('#woMin').value = '';
    $('#woNote').value = '';
    $('#woCopy').hidden = true;
  },

  // Último treino com o mesmo nome (para copiar os exercícios)
  lastByName(name) {
    const n = norm(name);
    return [...this.list].sort((a, b) => b.date.localeCompare(a.date)).find((w) => norm(w.name) === n);
  },

  save() {
    const exercises = [...$$('#woRows .wo-row')].map((r) => {
      const [ex, sets, reps, weight] = r.querySelectorAll('input');
      return { name: ex.value.trim(), sets: Number(sets.value) || 0, reps: Number(reps.value) || 0, weight: Number(weight.value) || 0 };
    }).filter((e) => e.name);
    const name = $('#woName').value.trim() || 'Treino';
    if (!exercises.length) { toast('Adicione pelo menos um exercício.'); return; }
    const date = $('#woDate').value || todayKey();
    this.list.push({ id: uid(), date, name, exercises, minutes: Number($('#woMin').value) || 0, note: $('#woNote').value.trim() });
    Store.save();
    XP.award(`workout:${date}`, 'workout', name, date);
    // Marca também o hábito de exercício daquele dia (se existir)
    const habit = Store.data.habits.find((h) => /exercicio|treino|academia/.test(norm(h.name)));
    if (habit && !habit.doneDates.includes(date)) Habits.toggle(habit.id, date);
    Habits.renderAll();
    toast(`💪 Treino salvo: ${name}`);
    $('#woExSelect').value = exercises[0].name;
    this.resetForm();
    this.render();
  },

  remove(id) {
    if (!confirm('Apagar este treino?')) return;
    const w = this.list.find((x) => x.id === id);
    Store.data.workouts = this.list.filter((x) => x.id !== id);
    if (!this.list.some((x) => x.date === w.date)) XP.revoke(`workout:${w.date}`);
    Store.save();
    this.render();
  },

  // Todos os nomes de exercícios já usados
  exerciseNames() {
    const set = new Set();
    this.list.forEach((w) => w.exercises.forEach((e) => set.add(e.name)));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  renderStats() {
    const week = WeekGoals.weekKey();
    const month = todayKey().slice(0, 7);
    const inWeek = this.list.filter((w) => w.date >= week);
    $('#woWeek').textContent = new Set(inWeek.map((w) => w.date)).size;
    $('#woMonth').textContent = new Set(this.list.filter((w) => w.date.startsWith(month)).map((w) => w.date)).size;
    $('#woMinutes').textContent = inWeek.reduce((s, w) => s + w.minutes, 0);
    // Bolinhas de seg a dom
    const days = [...Array(7)].map((_, i) => { const d = new Date(week + 'T12:00'); d.setDate(d.getDate() + i); return dateKey(d); });
    $('#woWeekDots').innerHTML = days.map((d) => `
      <span class="${this.list.some((w) => w.date === d) ? 'on' : ''} ${d === todayKey() ? 'today' : ''}">
        <i></i><small>${WEEKDAYS[new Date(d + 'T12:00').getDay()].slice(0, 3)}</small>
      </span>`).join('');
  },

  renderChart() {
    const names = this.exerciseNames();
    const sel = $('#woExSelect');
    const current = sel.value;
    sel.innerHTML = names.map((n) => `<option>${esc(n)}</option>`).join('');
    if (names.includes(current)) sel.value = current;
    const ex = sel.value;
    if (!ex) {
      $('#woChart').innerHTML = '<div class="chart-empty">Registre treinos para ver a evolução da carga.</div>';
      $('#woPR').textContent = '';
      return;
    }
    // Maior carga do exercício em cada data
    const byDate = {};
    this.list.forEach((w) => w.exercises.forEach((e) => {
      if (e.name === ex) byDate[w.date] = Math.max(byDate[w.date] || 0, e.weight);
    }));
    const pts = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    const max = Math.max(...pts.map((p) => p[1]), 1);
    const min = Math.min(...pts.map((p) => p[1]));
    const W = 320, H = 130, P = 14;
    const x = (i) => (pts.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (pts.length - 1));
    const lo = Math.max(0, min - (max - min) * 0.3 - 1);
    const y = (v) => H - P - ((v - lo) / (max - lo || 1)) * (H - 2 * P);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
    $('#woChart').innerHTML = `
      <svg viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="Evolução de carga de ${esc(ex)}">
        <path d="${line}" class="line wo-line" pathLength="1"/>
        <g class="dots score">${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="3.4"/>`).join('')}</g>
        <g class="labels">${pts.map((p, i) => `<text x="${x(i).toFixed(1)}" y="${(y(p[1]) - 8).toFixed(1)}" text-anchor="middle">${p[1]}</text>
          <text x="${x(i).toFixed(1)}" y="${H + 12}" text-anchor="middle">${p[0].slice(8)}/${p[0].slice(5, 7)}</text>`).join('')}</g>
      </svg>`;
    const first = pts[0][1], last = pts[pts.length - 1][1];
    const diff = last - first;
    $('#woPR').textContent = `Recorde: ${max} kg` + (pts.length > 1 ? ` · ${diff >= 0 ? '+' : ''}${diff} kg desde ${pts[0][0].slice(8)}/${pts[0][0].slice(5, 7)}` : '');
  },

  renderList() {
    const items = [...this.list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    if (!items.length) {
      $('#woList').innerHTML = '<div class="card glass empty">Nenhum treino registrado ainda. Bora! 💪</div>';
      return;
    }
    $('#woList').innerHTML = items.map((w, i) => {
      const date = new Date(w.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      return `
      <article class="card glass wo-card" data-id="${w.id}" style="--i:${Math.min(i, 8)}">
        <div class="project-head">
          <span class="habit-emoji big">🏋️</span>
          <div class="perf-item-info">
            <strong>${esc(w.name)}</strong>
            <span class="note-date">${date}${w.minutes ? ` · ${w.minutes} min` : ''} · ${w.exercises.length} exercício(s)</span>
          </div>
          <button class="mini-btn" data-act="del" aria-label="Apagar treino">${ICON_TRASH}</button>
        </div>
        <ul class="wo-ex-list">
          ${w.exercises.map((e) => `<li><span>${esc(e.name)}</span><b>${e.sets || '-'}×${e.reps || '-'}${e.weight ? ` · ${e.weight} kg` : ''}</b></li>`).join('')}
        </ul>
        ${w.note ? `<p class="perf-line">${esc(w.note)}</p>` : ''}
      </article>`;
    }).join('');
  },

  render() {
    $('#woNames').innerHTML = [...new Set(this.list.map((w) => w.name))].map((n) => `<option value="${esc(n)}"></option>`).join('');
    $('#woExercises').innerHTML = this.exerciseNames().map((n) => `<option value="${esc(n)}"></option>`).join('');
    this.renderStats();
    this.renderChart();
    this.renderList();
  },

  init() {
    $('#woDate').max = todayKey();
    this.resetForm();
    $('#woAddRow').addEventListener('click', () => {
      $('#woRows').insertAdjacentHTML('beforeend', this.rowHTML());
      [...$$('#woRows .wo-ex')].pop().focus();
    });
    $('#woRows').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="delrow"]');
      if (b && $$('#woRows .wo-row').length > 1) b.closest('.wo-row').remove();
    });
    // Ao digitar um nome de treino já usado, oferece copiar os exercícios
    $('#woName').addEventListener('input', () => {
      const last = this.lastByName($('#woName').value.trim());
      $('#woCopy').hidden = !last;
      if (last) {
        const d = new Date(last.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        $('#woCopy').textContent = `↺ Copiar exercícios do último "${last.name}" (${d})`;
      }
    });
    $('#woCopy').addEventListener('click', () => {
      const last = this.lastByName($('#woName').value.trim());
      if (!last) return;
      $('#woRows').innerHTML = last.exercises.map((e) => this.rowHTML(e)).join('');
      if (!$('#woMin').value && last.minutes) $('#woMin').value = last.minutes;
      $('#woCopy').hidden = true;
      toast('Exercícios copiados. Ajuste as cargas se aumentou!');
    });
    $('#woForm').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
    $('#woExSelect').addEventListener('change', () => this.renderChart());
    $('#woList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="del"]');
      if (b) this.remove(b.closest('.wo-card').dataset.id);
    });
    this.render();
  },
};

/* ---------- 26. RELATÓRIO MENSAL ---------- */
// Junta os números do mês escolhido e compara com o mês anterior.
const Report = {
  month: null, // '2026-11'

  shift(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  label(ym) {
    const [y, m] = ym.split('-').map(Number);
    const t = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  },
  daysIn(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  },

  // Todos os números de um mês
  stats(ym) {
    const d = Store.data;
    const inM = (date) => (date || '').startsWith(ym);
    const countDates = (arr) => arr.reduce((s, x) => s + x.doneDates.filter(inM).length, 0);
    const xpLog = d.xpLog.filter((x) => inM(x.date));
    const perf = Object.entries(d.performance).filter(([k]) => inM(k)).map(([, v]) => v);
    const moods = Object.entries(d.moods).filter(([k]) => inM(k)).map(([, v]) => v.level);
    const expenses = ((d.finance && d.finance.expenses) || []).filter((e) => inM(e.date));
    return {
      xp: xpLog.reduce((s, x) => s + x.amount, 0),
      xpLog,
      tasks: countDates(d.tasks),
      habits: countDates(d.habits),
      focus: d.focusLog.filter((f) => inM(f.date)).reduce((s, f) => s + f.minutes, 0),
      workouts: new Set(d.workouts.filter((w) => inM(w.date)).map((w) => w.date)).size,
      spent: expenses.reduce((s, e) => s + e.amount, 0),
      expenses,
      books: d.reading.books.filter((b) => b.status === 'lido' && inM(b.finishedAt)).length,
      score: perf.length ? perf.reduce((s, p) => s + p.score, 0) / perf.length : null,
      mood: moods.length ? moods.reduce((s, v) => s + v, 0) / moods.length : null,
      moods,
      badges: Object.entries(d.badges).filter(([, date]) => inM(date)).map(([id]) => BADGES.find((b) => b.id === id)).filter(Boolean),
    };
  },

  // Seta de comparação: para gastos, gastar MENOS é bom
  delta(now, before, lowerIsBetter = false) {
    if (now === null || before === null || before === undefined) return '';
    const diff = now - before;
    if (Math.abs(diff) < 0.05) return '<em class="flat">=</em>';
    const good = lowerIsBetter ? diff < 0 : diff > 0;
    let pct = before ? Math.round((diff / before) * 100) : null;
    const txt = pct !== null ? `${pct > 0 ? '+' : ''}${pct}%` : (diff > 0 ? 'novo' : '');
    return `<em class="${good ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${txt}</em>`;
  },

  renderGrid(c, p) {
    const tile = (val, label, d) => `<div><strong>${val}</strong><span>${label}</span>${d}</div>`;
    const fmt1 = (v) => (v === null ? '–' : v.toFixed(1).replace('.', ','));
    $('#repGrid').innerHTML = [
      tile(c.xp, 'XP', this.delta(c.xp, p.xp)),
      tile(c.tasks, 'tarefas', this.delta(c.tasks, p.tasks)),
      tile(c.habits, 'hábitos', this.delta(c.habits, p.habits)),
      tile(String(Math.round(c.focus / 60 * 10) / 10).replace('.', ',') + 'h', 'de foco', this.delta(c.focus, p.focus)),
      tile(c.workouts, 'treinos', this.delta(c.workouts, p.workouts)),
      tile(c.books, 'livros', this.delta(c.books, p.books)),
      tile(fmt1(c.score), 'nota média', this.delta(c.score, p.score)),
      tile(c.mood === null ? '–' : MOODS[Math.round(c.mood) - 1].emoji, 'humor', this.delta(c.mood, p.mood)),
      tile(money(c.spent).replace(',00', ''), 'gastos', this.delta(c.spent, p.spent, true)),
    ].join('');
  },

  renderXpChart(c) {
    const n = this.daysIn(this.month);
    const per = Array(n).fill(0);
    c.xpLog.forEach((x) => { per[Number(x.date.slice(8)) - 1] += x.amount; });
    const max = Math.max(...per, 10);
    const W = 320, H = 110, gap = 2, bw = (W - gap * (n - 1)) / n;
    const today = todayKey();
    const bars = per.map((v, i) => {
      const h = v ? Math.max(3, (v / max) * H) : 0;
      const day = `${this.month}-${String(i + 1).padStart(2, '0')}`;
      return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="${day === today ? 'today' : ''}"/>`;
    }).join('');
    const labels = [1, 8, 15, 22, n].map((dd) =>
      `<text x="${((dd - 1) * (bw + gap) + bw / 2).toFixed(1)}" y="${H + 13}" text-anchor="middle">${dd}</text>`).join('');
    $('#repXpChart').innerHTML = `
      <svg viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="XP por dia">
        <line x1="0" x2="${W}" y1="${H}" y2="${H}" class="grid"/>
        <g class="rep-bar">${bars}</g>
        <g class="labels">${labels}</g>
      </svg>`;
  },

  bar(label, value, pct, color) {
    return `
      <div class="cat-bar">
        <div class="cat-bar-top"><span>${label}</span><b>${value}</b></div>
        <div class="progress"><span class="progress-bar" style="width:${Math.min(100, pct)}%;${color ? `background:${color}` : ''}"></span></div>
      </div>`;
  },

  renderHabits() {
    const ym = this.month;
    const cur = ym === todayKey().slice(0, 7);
    const days = cur ? Number(todayKey().slice(8)) : this.daysIn(ym);
    const hs = Store.data.habits;
    $('#repHabits').innerHTML = hs.length ? hs.map((h) => {
      const n = h.doneDates.filter((d) => d.startsWith(ym)).length;
      return this.bar(`${esc(h.emoji)} ${esc(h.name)}`, `${n}/${days} dias`, (n / days) * 100);
    }).join('') : '<p class="muted small">Nenhum hábito cadastrado.</p>';
  },

  renderSpend(c) {
    const total = c.spent;
    if (!total) { $('#repSpend').innerHTML = '<p class="muted small">Nenhum gasto registrado neste mês.</p>'; return; }
    const by = {};
    c.expenses.forEach((e) => { by[e.cat] = (by[e.cat] || 0) + e.amount; });
    $('#repSpend').innerHTML = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([cat, v]) => {
      const info = CATEGORIES.find((x) => x.id === cat) || CATEGORIES[CATEGORIES.length - 1];
      return this.bar(`${info.emoji} ${info.label}`, `${money(v)} · ${Math.round((v / total) * 100)}%`, (v / total) * 100, info.color);
    }).join('');
  },

  renderMood(c) {
    const counts = [0, 0, 0, 0, 0];
    c.moods.forEach((l) => counts[l - 1]++);
    const max = Math.max(...counts, 1);
    $('#repMood').innerHTML = c.moods.length ? MOODS.map((m, i) => `
      <div class="rep-mood-col">
        <b>${counts[i]}</b>
        <span class="rep-mood-bar" style="height:${Math.max(4, (counts[i] / max) * 70)}px;background:${m.color}"></span>
        <i>${m.emoji}</i>
      </div>`).join('') : '<p class="muted small">Nenhum humor registrado neste mês.</p>';
  },

  // Frases de destaque
  highlights(c, p) {
    const out = [];
    if (c.xpLog.length) {
      const per = {};
      c.xpLog.forEach((x) => { per[x.date] = (per[x.date] || 0) + x.amount; });
      const [bd, bv] = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
      out.push(`🏆 Melhor dia: ${bd.slice(8)}/${bd.slice(5, 7)} com ${bv} XP`);
      out.push(`📅 Dias ativos: ${Object.keys(per).length}`);
    }
    const ym = this.month;
    const best = Store.data.habits.map((h) => [h, h.doneDates.filter((d) => d.startsWith(ym)).length]).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1]) out.push(`🌱 Hábito mais forte: ${best[0].emoji} ${best[0].name} (${best[1]} dias)`);
    if (c.badges.length) out.push(`🎖️ Medalhas: ${c.badges.map((b) => b.icon + ' ' + b.name).join(', ')}`);
    if (p.xp && c.xp > p.xp) out.push(`📈 ${c.xp - p.xp} XP a mais que no mês anterior`);
    if (p.spent && c.spent < p.spent) out.push(`💰 Gastou ${money(p.spent - c.spent)} a menos que no mês anterior`);
    if (!out.length) out.push('Ainda não há dados neste mês. Bora começar! 💪');
    return out;
  },

  text() {
    const c = this.stats(this.month), p = this.stats(this.shift(this.month, -1));
    const title = Store.data.settings.userTitle;
    const parts = [`Relatório de ${this.label(this.month)}, ${title}.`];
    parts.push(`Você ganhou ${c.xp} pontos de experiência${p.xp ? `, contra ${p.xp} no mês anterior` : ''}.`);
    parts.push(`Concluiu ${c.tasks} tarefas, cumpriu hábitos ${c.habits} vezes e fez ${Math.round(c.focus / 60)} horas de foco.`);
    if (c.workouts) parts.push(`Foram ${c.workouts} dias de treino.`);
    if (c.books) parts.push(`Terminou ${c.books} livro${c.books > 1 ? 's' : ''}.`);
    if (c.spent) parts.push(`Os gastos somaram ${money(c.spent)}.`);
    parts.push(c.xp >= p.xp ? 'Você está evoluindo. Continue assim!' : 'Este mês foi mais leve. Vamos retomar o ritmo!');
    return parts.join(' ');
  },

  render() {
    if (!this.month) this.month = todayKey().slice(0, 7);
    const c = this.stats(this.month), p = this.stats(this.shift(this.month, -1));
    $('#repMonth').textContent = this.label(this.month);
    $('#repNext').disabled = this.month >= todayKey().slice(0, 7);
    const lv = XP.level();
    $('#repHeadline').textContent = c.xp
      ? `${c.xp} XP no mês · nível ${lv} hoje`
      : 'Sem atividade registrada neste mês.';
    this.renderGrid(c, p);
    this.renderXpChart(c);
    this.renderHabits();
    this.renderSpend(c);
    this.renderMood(c);
    $('#repHighlights').innerHTML = this.highlights(c, p).map((h) => `<li>${esc(h)}</li>`).join('');
  },

  init() {
    $('#repPrev').addEventListener('click', () => { this.month = this.shift(this.month, -1); this.render(); });
    $('#repNext').addEventListener('click', () => { this.month = this.shift(this.month, 1); this.render(); });
    $('#repSpeak').addEventListener('click', () => Voice.speak(this.text()));
    $('#repShare').addEventListener('click', async () => {
      const c = this.stats(this.month);
      const txt = `📊 Meu mês no Atena (${this.label(this.month)})\n` +
        `⭐ ${c.xp} XP · ✅ ${c.tasks} tarefas · 🌱 ${c.habits} hábitos\n` +
        `⏱️ ${Math.round(c.focus / 60)}h de foco · 🏋️ ${c.workouts} treinos · 📖 ${c.books} livros\n` +
        this.highlights(c, this.stats(this.shift(this.month, -1))).join('\n');
      try {
        if (navigator.share) await navigator.share({ title: 'Relatório Atena', text: txt });
        else { await navigator.clipboard.writeText(txt); toast('Relatório copiado ✓'); }
      } catch (e) { /* o usuário cancelou */ }
    });
    // Atualiza sempre que a tela é aberta
    document.addEventListener('click', (e) => { if (e.target.closest('[data-go="report"]')) this.render(); });
    this.render();
  },
};

/* ---------- 27. SERVICE WORKER (funcionar offline) ---------- */
function registerServiceWorker() {
  // Só funciona em "localhost" ou em sites com https
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Atena: pronta para funcionar offline.'))
      .catch((err) => console.warn('Service worker falhou:', err));
  }
}

/* ---------- INICIALIZAÇÃO ---------- */
// Lista de módulos do app. Novas funções entram aqui.
const modules = [Theme, Router, Tasks, Philosophy, Mindset, Performance, Reading, Settings, Focus, Reminders, Habits, XP, Finance, Voice, Studies, Mood, Notes, WeekGoals, DayEnd, Dev, Workout, Report, Home, Brain, Sync, Lock];

document.addEventListener('DOMContentLoaded', () => {
  Store.load();
  modules.forEach((m) => m.init());
  registerServiceWorker();
});
