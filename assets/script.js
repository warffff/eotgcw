const views = [...document.querySelectorAll('.view')];
const navLinks = [...document.querySelectorAll('[data-view]')];
const mainNav = document.getElementById('mainNav');
const mobileMenu = document.getElementById('mobileMenu');
let currentView = document.querySelector('.view.active')?.id?.replace('view-', '') || 'home';
let isSwitchingView = false;
let queuedView = null;

const tabSwitchSound = new Audio('assets/tab-switch.mp3');
tabSwitchSound.preload = 'auto';
tabSwitchSound.volume = 0.38;

function playTabSound() {
  try {
    tabSwitchSound.pause();
    tabSwitchSound.currentTime = 0;
    const promise = tabSwitchSound.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  } catch (_) {}
}

function setNavActive(target) {
  document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.view === target));
}

function showView(id, push = true, sound = true) {
  const target = document.getElementById(`view-${id}`) ? id : 'home';
  const activeNow = document.getElementById(`view-${currentView}`);
  const nextView = document.getElementById(`view-${target}`);

  if (!nextView) return;

  if (target === currentView && nextView.classList.contains('active')) {
    mainNav?.classList.remove('open');
    return;
  }

  if (isSwitchingView) {
    queuedView = { id: target, push, sound };
    return;
  }

  if (sound) playTabSound();
  if (push) history.replaceState(null, '', `#${target}`);
  setNavActive(target);
  mainNav?.classList.remove('open');
  isSwitchingView = true;

  const finishSwitch = () => {
    views.forEach(v => {
      v.classList.remove('active', 'entering', 'leaving');
    });

    currentView = target;
    nextView.classList.add('active', 'entering');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      nextView.classList.remove('entering');
      isSwitchingView = false;
      if (queuedView) {
        const q = queuedView;
        queuedView = null;
        showView(q.id, q.push, q.sound);
      }
    }, 420);
  };

  if (activeNow && activeNow.classList.contains('active')) {
    activeNow.classList.remove('entering');
    activeNow.classList.add('leaving');
    setTimeout(finishSwitch, 180);
  } else {
    finishSwitch();
  }
}

function viewExists(id) {
  return Boolean(id && document.getElementById(`view-${id}`));
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-view]');
  if (!tab) return;
  const target = tab.dataset.view;
  if (!target || !viewExists(target)) return;
  event.preventDefault();
  event.stopPropagation();
  galaxyPointerDown = false;
  galaxyMapShell?.classList.remove('dragging');
  showView(target, true, true);
}, true);
mobileMenu?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  mainNav.classList.toggle('open');
});
window.addEventListener('DOMContentLoaded', () => {
  const hash = location.hash.replace('#','');
  showView(viewExists(hash) ? hash : 'home', false, false);
});
window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#','');
  if (!hash) return showView('home', false, false);
  if (viewExists(hash)) showView(hash, false, false);
});

document.addEventListener('click', (event) => {
  const link = event.target.closest('.charter-index a[href^="#"], .charter-side-nav a[href^="#"]');
  if (!link) return;
  const target = document.querySelector(link.getAttribute('href'));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function updateCharterSideNav(){
  const charterView = document.getElementById('view-charter');
  const charterDoc = document.querySelector('#view-charter .charter-doc');
  const active = Boolean(charterView?.classList.contains('active') && charterDoc);
  let visible = false;
  if (active) {
    const docTop = charterDoc.getBoundingClientRect().top + window.scrollY;
    visible = window.scrollY > docTop + 360;
  }
  document.body.classList.toggle('charter-side-nav-visible', visible);
}
window.addEventListener('scroll', updateCharterSideNav, { passive:true });
window.addEventListener('resize', updateCharterSideNav);


const recruitWebhookUrl = 'https://discord.com/api/webhooks/1511008044618743978/Kf0UxyaelQJNZRjFAiZ7MPPP-EPYLjcpDCpxKxHYE8KIuib6dSFoVO4Vyh9yWeMnwNqJ';
const recruitForm = document.getElementById('recruitForm');
const recruitStatus = document.getElementById('recruitStatus');
const fieldsPreview = document.getElementById('embedFieldsPreview');
const descPreview = document.getElementById('embedDescPreview');
const copyEmbedJson = document.getElementById('copyEmbedJson');

const recruitFields = [
  ['nickname','Ваш никнейм'],
  ['age','Ваш возраст'],
  ['position','Желаемая должность'],
  ['experience','Был ли опыт работы на проектах'],
  ['activity','Сколько времени готовы уделять проекту'],
  ['motivation','Почему хотите попасть в персонал'],
  ['whyYou','Почему именно вас стоит принять'],
  ['jvsKnowledge','Насколько хорошо знакомы с эпохой Clone Wars'],
  ['rpKnowledge','Насколько хорошо разбираетесь в RP'],
  ['conflict','Как поступите при конфликте между игроками'],
  ['friendViolation','Как поступите, если знакомый нарушит правила'],
  ['trial','Готовы ли пройти испытательный срок'],
  ['extra','Дополнительная информация'],
  ['discord','Ваш Discord']
];

function cleanEmbedValue(value, fallback = 'Не указано') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.length > 950 ? text.slice(0, 947) + '...' : text;
}

function getRecruitData() {
  const data = {};
  if (!recruitForm) return data;
  for (const [name] of recruitFields) data[name] = recruitForm.elements[name]?.value || '';
  return data;
}

function buildRecruitPayload() {
  const data = getRecruitData();
  const nickname = cleanEmbedValue(data.nickname, 'Кандидат');
  const position = cleanEmbedValue(data.position, 'Должность не указана');
  return {
    username: 'Edge of the Galaxy • Набор',
    avatar_url: location.origin + location.pathname.replace(/[^/]*$/, '') + 'assets/favicon.png',
    embeds: [{
      title: '🧢 Новая заявка в персонал проекта',
      description: `**Кандидат:** ${nickname}\n**Желаемая должность:** ${position}`,
      color: 8900331,
      fields: recruitFields.map(([name, label]) => ({
        name: label,
        value: cleanEmbedValue(data[name]),
        inline: ['nickname','age','position','trial','discord'].includes(name)
      })),
      footer: { text: 'Edge of the Galaxy: Clone Wars • Формуляр набора' },
      timestamp: new Date().toISOString()
    }]
  };
}

function updateRecruitPreview() {
  if (!recruitForm || !fieldsPreview) return;
  const payload = buildRecruitPayload();
  const embed = payload.embeds[0];
  if (descPreview) descPreview.innerHTML = embed.description.replace(/\*\*/g,'').replace(/\n/g,'<br>');
  fieldsPreview.innerHTML = '';
  for (const f of embed.fields) {
    const row = document.createElement('div');
    row.className = 'fake-field';
    const name = document.createElement('b');
    name.textContent = f.name;
    const value = document.createElement('span');
    value.textContent = f.value;
    row.append(name, value);
    fieldsPreview.appendChild(row);
  }
}

recruitForm?.addEventListener('input', updateRecruitPreview);
recruitForm?.addEventListener('change', updateRecruitPreview);
copyEmbedJson?.addEventListener('click', async () => {
  const text = JSON.stringify(buildRecruitPayload(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    if (recruitStatus) { recruitStatus.textContent = 'JSON сообщения скопирован в буфер обмена.'; recruitStatus.className = 'recruit-status ok'; }
  } catch (_) {
    if (recruitStatus) { recruitStatus.textContent = 'Не удалось скопировать JSON автоматически.'; recruitStatus.className = 'recruit-status err'; }
  }
});

recruitForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!recruitForm.reportValidity()) return;
  const submit = recruitForm.querySelector('.recruit-submit');
  if (submit) submit.disabled = true;
  if (recruitStatus) { recruitStatus.textContent = 'Отправка заявки в Discord...'; recruitStatus.className = 'recruit-status'; }
  try {
    const response = await fetch(recruitWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRecruitPayload())
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    recruitForm.reset();
    updateRecruitPreview();
    if (recruitStatus) { recruitStatus.textContent = 'Заявка успешно отправлена в Discord.'; recruitStatus.className = 'recruit-status ok'; }
  } catch (err) {
    if (recruitStatus) { recruitStatus.textContent = 'Не удалось отправить заявку. Проверьте веб-хук, CORS/блокировки браузера или попробуйте позже.'; recruitStatus.className = 'recruit-status err'; }
  } finally {
    if (submit) submit.disabled = false;
  }
});
updateRecruitPreview();


// v16: Discord OAuth authorization and document editor
const authButton = document.getElementById('authButton');
const authUser = document.getElementById('authUser');
const authAvatar = document.getElementById('authAvatar');
const authName = document.getElementById('authName');
const logoutButton = document.getElementById('logoutButton');
const editorToolbar = document.getElementById('editorToolbar');
const editorSection = document.getElementById('editorSection');
const editToggle = document.getElementById('editToggle');
const editSave = document.getElementById('editSave');
const editCancel = document.getElementById('editCancel');
const editableDocs = [...document.querySelectorAll('.editable-doc[data-doc-key]')];
let authState = { user: null, canEdit: false };
let editingDoc = null;
let editingBefore = '';

function docTitle(doc){
  const key = doc?.dataset?.docKey || '';
  if (key === 'rules') return 'Правила';
  if (key === 'lore') return 'Лор';
  if (key === 'charter') return 'Устав';
  return 'Документ';
}

async function apiJson(url, options){
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...(options || {}) });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadEditableContent(){
  for (const doc of editableDocs) {
    const key = doc.dataset.docKey;
    doc.dataset.originalHtml = doc.innerHTML;
    try {
      const data = await apiJson(`/api/content?key=${encodeURIComponent(key)}`);
      if (data && data.html) {
        doc.innerHTML = data.html;
        doc.dataset.originalHtml = data.html;
      }
    } catch (_) {}
  }
}



function readCookieValue(name){
  return document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=').slice(1).join('=') || '';
}

function decodeUserHint(){
  const raw = readCookieValue('eotg_user_hint');
  if (!raw) return null;
  try {
    let normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4) normalized += '=';
    const json = decodeURIComponent(escape(atob(normalized)));
    const user = JSON.parse(json);
    if (!user || !user.id) return null;
    return user;
  } catch (_) {
    return null;
  }
}

function cleanAuthUrl(){
  try {
    const url = new URL(location.href);
    if (url.searchParams.has('auth')) {
      url.searchParams.delete('auth');
      history.replaceState(null, '', url.pathname + (url.search || '') + (url.hash || '#home'));
    }
  } catch (_) {}
}

async function loadAuthState(){
  try {
    const data = await apiJson('/api/auth/me?t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
    authState = data && data.user ? data : { user: null, canEdit: false };
  } catch (_) {
    authState = { user: null, canEdit: false };
  }

  if (!authState.user) {
    const hint = decodeUserHint();
    if (hint) authState = { user: hint, canEdit: false, hintOnly: true };
  }

  renderAuthState();
  updateEditorToolbar();
  cleanAuthUrl();
  window.dispatchEvent(new CustomEvent('eotg:auth-updated'));
}

function renderAuthState(){
  if (authState.user) {
    authButton.hidden = true;
    authUser.hidden = false;
    authName.textContent = authState.user.global_name || authState.user.username || 'Пользователь';
    authAvatar.src = authState.user.avatar_url || 'assets/favicon.png';
  } else {
    authButton.hidden = false;
    authUser.hidden = true;
  }
}

function activeEditableDoc(){
  const view = document.querySelector('.view.active');
  if (!view) return null;
  return view.querySelector('.editable-doc[data-doc-key]');
}

function updateEditorToolbar(){
  const doc = activeEditableDoc();
  const show = Boolean(authState.canEdit && doc);
  if (!editorToolbar) return;
  editorToolbar.hidden = !show;
  if (!show) return;
  editorSection.textContent = docTitle(doc);
}

function stopEditing(reset){
  if (!editingDoc) return;
  if (reset) editingDoc.innerHTML = editingBefore;
  editingDoc.contentEditable = 'false';
  editingDoc.classList.remove('is-editing');
  editingDoc = null;
  editingBefore = '';
  editToggle.hidden = false;
  editSave.hidden = true;
  editCancel.hidden = true;
}

function startEditing(){
  const doc = activeEditableDoc();
  if (!doc || !authState.canEdit) return;
  stopEditing(false);
  editingDoc = doc;
  editingBefore = doc.innerHTML;
  doc.contentEditable = 'true';
  doc.classList.add('is-editing');
  doc.focus();
  editToggle.hidden = true;
  editSave.hidden = false;
  editCancel.hidden = false;
}

async function saveEditing(){
  if (!editingDoc) return;
  const doc = editingDoc;
  const key = doc.dataset.docKey;
  const before = editingBefore;
  const after = doc.innerHTML;
  editSave.disabled = true;
  try {
    await apiJson('/api/content', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ key, before, after })
    });
    doc.dataset.originalHtml = after;
    stopEditing(false);
    alert('Изменения сохранены в GitHub. Vercel автоматически обновит сайт после redeploy. Лог отправлен в Discord.');
  } catch (err) {
    alert('Не удалось сохранить изменения: ' + err.message);
  } finally {
    editSave.disabled = false;
  }
}

authButton?.addEventListener('click', () => { location.href = '/api/auth/login'; });
logoutButton?.addEventListener('click', async () => { try { await fetch('/api/auth/logout', {method:'POST'}); } catch(_){} location.reload(); });
editToggle?.addEventListener('click', startEditing);
editSave?.addEventListener('click', saveEditing);
editCancel?.addEventListener('click', () => stopEditing(true));




// Hook editor toolbar into existing view switches.
const originalShowViewForEditor = showView;
showView = function(id, push = true, sound = true){
  stopEditing(false);
  originalShowViewForEditor(id, push, sound);
  setTimeout(() => { updateEditorToolbar(); updateCharterSideNav(); refreshHolonetIfActive(); }, 470);
};

loadEditableContent().then(loadAuthState);

const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
const fxCanvas = document.getElementById('battleFx');
const fx = fxCanvas.getContext('2d');
let w, h, stars, sabers, duelBursts;
const saberColors = [
  'rgba(72,170,255,',
  'rgba(125,211,252,',
  'rgba(176,226,255,',
  'rgba(38,146,232,',
  'rgba(135,206,235,'
];

function resize(){
  const ratio = devicePixelRatio || 1;
  w = canvas.width = fxCanvas.width = innerWidth * ratio;
  h = canvas.height = fxCanvas.height = innerHeight * ratio;
  canvas.style.width = fxCanvas.style.width = innerWidth + 'px';
  canvas.style.height = fxCanvas.style.height = innerHeight + 'px';
  const count = Math.min(360, Math.floor(innerWidth * innerHeight / 4200));
  stars = Array.from({length:count}, () => ({
    x: Math.random()*w,
    y: Math.random()*h,
    r: (Math.random()*1.45 + .2) * ratio,
    a: Math.random()*0.65 + 0.15,
    s: Math.random()*0.018 + 0.004,
    vx: (Math.random()*0.055 + 0.01) * ratio
  }));
  sabers = [];
  duelBursts = [];
}

function spawnSaber(){
  const ratio = devicePixelRatio || 1;
  const side = Math.random() > .5 ? -1 : 1;
  const y = (Math.random() * 0.72 + 0.12) * h;
  const len = (Math.random()*170 + 130) * ratio;
  const speed = (Math.random()*6 + 7) * ratio * side;
  const angle = (Math.random()*.22 - .11);
  sabers.push({
    x: side > 0 ? -len : w + len,
    y, len, speed, angle,
    life: 1,
    width: (Math.random()*3 + 3) * ratio,
    color: saberColors[Math.floor(Math.random()*saberColors.length)]
  });
}

function spawnDuel(){
  const ratio = devicePixelRatio || 1;
  duelBursts.push({
    x: (Math.random()*.7 + .15) * w,
    y: (Math.random()*.45 + .28) * h,
    t: 0,
    life: Math.random()*90 + 95,
    s: (Math.random()*0.5 + 0.75) * ratio,
    c1: saberColors[Math.floor(Math.random()*saberColors.length)],
    c2: saberColors[Math.floor(Math.random()*saberColors.length)]
  });
}

function drawHumanSilhouette(x, y, s, alpha){
  fx.save();
  fx.globalAlpha = alpha;
  fx.fillStyle = 'rgba(7,19,32,.52)';
  fx.beginPath(); fx.arc(x, y - 18*s, 6*s, 0, Math.PI*2); fx.fill();
  fx.fillRect(x - 5*s, y - 12*s, 10*s, 28*s);
  fx.fillRect(x - 13*s, y + 13*s, 8*s, 22*s);
  fx.fillRect(x + 5*s, y + 13*s, 8*s, 22*s);
  fx.restore();
}

function drawSaberLine(x1,y1,x2,y2,width,color,alpha){
  fx.save();
  fx.lineCap = 'round';
  fx.strokeStyle = color + (0.28*alpha) + ')';
  fx.lineWidth = width * 4.4;
  fx.beginPath(); fx.moveTo(x1,y1); fx.lineTo(x2,y2); fx.stroke();
  fx.strokeStyle = color + (0.86*alpha) + ')';
  fx.lineWidth = width * 2.1;
  fx.beginPath(); fx.moveTo(x1,y1); fx.lineTo(x2,y2); fx.stroke();
  fx.strokeStyle = 'rgba(255,240,244,' + (0.92*alpha) + ')';
  fx.lineWidth = Math.max(1, width * .75);
  fx.beginPath(); fx.moveTo(x1,y1); fx.lineTo(x2,y2); fx.stroke();
  fx.restore();
}

function draw(){
  ctx.clearRect(0,0,w,h);
  for(const st of stars){
    st.a += st.s;
    const alpha = .13 + Math.abs(Math.sin(st.a)) * .78;
    st.x += st.vx;
    if(st.x > w+5) st.x = -5;
    ctx.beginPath();
    ctx.fillStyle = `rgba(205,238,255,${alpha})`;
    ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
    ctx.fill();
  }

  fx.clearRect(0,0,w,h);
  if(Math.random() < 0.0018 && sabers.length < 1) spawnSaber();
  if(Math.random() < 0.00055 && duelBursts.length < 1) spawnDuel();

  for(let i=sabers.length-1;i>=0;i--){
    const s = sabers[i];
    s.x += s.speed;
    s.life -= .0068;
    const dx = Math.cos(s.angle)*s.len;
    const dy = Math.sin(s.angle)*s.len;
    const alpha = Math.max(0, Math.min(1, s.life));
    drawSaberLine(s.x, s.y, s.x + dx, s.y + dy, s.width, s.color, alpha);
    if(s.x < -s.len*2 || s.x > w+s.len*2 || s.life <= 0) sabers.splice(i,1);
  }

  for(let i=duelBursts.length-1;i>=0;i--){
    const d = duelBursts[i];
    d.t++;
    const p = d.t / d.life;
    const alpha = Math.sin(Math.PI * p) * .28;
    const swing = Math.sin(d.t*.075) * 32 * d.s;
    drawHumanSilhouette(d.x - 46*d.s, d.y + 32*d.s, d.s, alpha*.75);
    drawHumanSilhouette(d.x + 46*d.s, d.y + 32*d.s, d.s, alpha*.75);
    drawSaberLine(d.x - 48*d.s, d.y + 2*d.s, d.x + 38*d.s, d.y - 36*d.s + swing, 3.2*d.s, d.c1, alpha);
    drawSaberLine(d.x + 48*d.s, d.y + 2*d.s, d.x - 40*d.s, d.y - 30*d.s - swing, 3.2*d.s, d.c2, alpha);
    if(d.t % 48 === 0){
      fx.save();
      fx.fillStyle = `rgba(190,230,255,${alpha*.25})`;
      fx.beginPath(); fx.arc(d.x, d.y - 18*d.s, 28*d.s, 0, Math.PI*2); fx.fill();
      fx.restore();
    }
    if(d.t > d.life) duelBursts.splice(i,1);
  }
  requestAnimationFrame(draw);
}
resize(); draw();
addEventListener('resize', resize);






const galaxyPasswordForm = document.getElementById('galaxyPasswordForm');
const galaxyPasswordInput = document.getElementById('galaxyPasswordInput');
const galaxyPasswordStatus = document.getElementById('galaxyPasswordStatus');
const galaxyLock = document.getElementById('galaxyLock');
const galaxyView = document.getElementById('galaxyView');
const galaxyMap = document.getElementById('galaxyMap');
const galaxyMapShell = document.getElementById('galaxyMapShell');
const galaxyPanel = document.getElementById('galaxyPanel');
const galaxySearch = document.getElementById('galaxySearch');
const galaxyRegionFilter = document.getElementById('galaxyRegionFilter');
const galaxyPlanetList = document.getElementById('galaxyPlanetList');
const galaxyCoords = document.getElementById('galaxyCoords');
const galaxyFilters = [...document.querySelectorAll('.galaxy-filter')];
const galaxyClickAudioUrl = 'assets/sounds/galaxy-click.mp3';
const galaxyLoadAudioUrl = 'assets/sounds/galaxy-load.mp3';

const galaxyPlanets = [
  {name:'Кей', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Форпост', x:185, y:115, desc:'Малый сепаратистский форпост.'},
  {name:'Бескин', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Оккупированная зона', x:260, y:130, desc:'Система под влиянием КНС, используемая для переброски дроидных сил.'},
  {name:'Бастион', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Укреплённый сектор', x:345, y:105, desc:'Опорный пункт КНС на внешних маршрутах.'},
  {name:'Дубриллион', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Флотский узел', x:390, y:140, desc:'Система, через которую КНС ведёт снабжение удалённых сил.'},
  {name:'Джеймус', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Боевой сектор', x:325, y:190, desc:'Позиция сепаратистских сил.'},
  {name:'Мунлист', sector:1, region:'Внешнее Кольцо', control:'republic', value:'Оспариваемый рубеж', x:210, y:200, desc:'Мир на линии соприкосновения сил.'},
  {name:'Майито', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Оккупированная зона', x:275, y:245, desc:'Промежуточная база КНС.'},
  {name:'Зигрулла', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Тыл КНС', x:165, y:265, desc:'Малый мир под сепаратистским влиянием.'},
  {name:'Яг-Днор', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Фронтовая система', x:245, y:310, desc:'Система у границы боевых действий.'},
  {name:'Борск', sector:1, region:'Внешнее Кольцо', control:'cis', value:'Военный маршрут', x:330, y:320, desc:'Промежуточная система на маршрутах КНС.'},

  {name:'Датомир', sector:2, region:'Дикое Пространство', control:'neutral', value:'Опасная зона', x:675, y:130, desc:'Труднодоступная система с высоким риском для разведки и наземных операций.'},
  {name:'Орд-Трасси', sector:2, region:'Внешнее Кольцо', control:'cis', value:'Военный маршрут', x:760, y:150, desc:'Система на маршрутах КНС.'},
  {name:'Мортуум', sector:2, region:'Внешнее Кольцо', control:'cis', value:'Оккупированная зона', x:710, y:230, desc:'Удалённый мир под влиянием сепаратистов.'},
  {name:'Генерис', sector:2, region:'Среднее Кольцо', control:'cis', value:'Промежуточная база', x:760, y:265, desc:'Система поддержки фронтовых сил КНС.'},
  {name:'Мапалор', sector:2, region:'Среднее Кольцо', control:'neutral', value:'Нейтральный мир', x:610, y:285, desc:'Система с нестабильным политическим статусом.'},
  {name:'Рилот', sector:2, region:'Внешнее Кольцо', control:'neutral', value:'Спорный мир', x:700, y:310, desc:'Пограничная система с меняющимся влиянием сторон.'},
  {name:'Мон-Кала', sector:2, region:'Среднее Кольцо', control:'neutral', value:'Спорная система', x:575, y:300, desc:'Важная флотская система с нестабильной политической обстановкой.'},

  {name:'Крофир', sector:3, region:'Внешнее Кольцо', control:'republic', value:'Передовой узел', x:990, y:155, desc:'Удалённая система, используемая как точка контроля внешних маршрутов.'},
  {name:'Вихиндор', sector:3, region:'Среднее Кольцо', control:'republic', value:'Гарнизон', x:1040, y:315, desc:'Оборонительный пункт Среднего Кольца.'},
  {name:'Кашиик', sector:3, region:'Среднее Кольцо', control:'republic', value:'Союзники вуки', x:1005, y:435, desc:'Стратегический лесной мир, удерживаемый союзными силами Республики.'},
  {name:'Калшик', sector:3, region:'Внешнее Кольцо', control:'republic', value:'Дальний гарнизон', x:1110, y:525, desc:'Отдалённый мир под контролем Республики.'},
  {name:'Набу', sector:3, region:'Среднее Кольцо', control:'republic', value:'Союзный мир', x:1000, y:615, desc:'Союзная Республика система с важным политическим и культурным влиянием.'},
  {name:'Вортекс', sector:3, region:'Среднее Кольцо', control:'republic', value:'Передовой рубеж', x:910, y:560, desc:'Система на границе республиканского контроля, важная для патрулей.'},
  {name:'Чандрила', sector:3, region:'Центральные Миры', control:'republic', value:'Политический центр', x:865, y:455, desc:'Важная республиканская система с высоким дипломатическим значением.'},

  {name:'Геонозис', sector:4, region:'Внешнее Кольцо', control:'cis', value:'Дроидные фабрики', x:165, y:410, desc:'Символ сепаратистского производства и тяжёлых наземных сражений.'},
  {name:'Гарки', sector:4, region:'Внешнее Кольцо', control:'cis', value:'Оккупированная точка', x:260, y:405, desc:'Система под контролем дроидных войск.'},
  {name:'Даланан', sector:4, region:'Среднее Кольцо', control:'cis', value:'Оккупированная зона', x:360, y:430, desc:'Мир под давлением КНС.'},
  {name:'Фаздо', sector:4, region:'Среднее Кольцо', control:'cis', value:'Боевой сектор', x:235, y:485, desc:'Сепаратистская точка контроля.'},
  {name:'Бигрис', sector:4, region:'Среднее Кольцо', control:'cis', value:'Оккупированная точка', x:335, y:520, desc:'Система под контролем КНС.'},
  {name:'Уба', sector:4, region:'Внешнее Кольцо', control:'cis', value:'Опорный пункт', x:465, y:420, desc:'Сепаратистская система внешнего кольца.'},
  {name:'Адуар', sector:4, region:'Внешнее Кольцо', control:'cis', value:'Промышленный мир', x:515, y:505, desc:'Используется силами КНС для поддержки фронта.'},
  {name:'Увальнор', sector:4, region:'Среднее Кольцо', control:'cis', value:'Спорная зона', x:480, y:560, desc:'Система, через которую проходят боевые маршруты.'},
  {name:'Сар-Кана', sector:4, region:'Среднее Кольцо', control:'cis', value:'Линия фронта', x:410, y:585, desc:'Пограничная точка сепаратистского влияния.'},
  {name:'Кейтум', sector:4, region:'Среднее Кольцо', control:'cis', value:'Боевой маршрут', x:525, y:590, desc:'Система, важная для перемещения сил КНС.'},
  {name:'Знок', sector:4, region:'Среднее Кольцо', control:'cis', value:'Переходный узел', x:585, y:430, desc:'Система между секторами боевых действий.'},
  {name:'Амгар', sector:4, region:'Среднее Кольцо', control:'cis', value:'Оккупированная зона', x:565, y:485, desc:'Система под сепаратистским контролем.'},
  {name:'Итор', sector:4, region:'Среднее Кольцо', control:'cis', value:'Опасная зона', x:640, y:465, desc:'Система, ценные ресурсы которой стали причиной боевых действий.'},
  {name:'Ларин-минор', sector:4, region:'Среднее Кольцо', control:'cis', value:'Фронтовой мир', x:600, y:535, desc:'Малый мир на линии фронта.'},

  {name:'Корусант', sector:5, region:'Центральные Миры', control:'republic', value:'Главная столица', x:400, y:520, desc:'Столица Галактики, резиденция Сената и главный центр координации сил Республики.'},
  {name:'Ансион', sector:5, region:'Среднее Кольцо', control:'republic', value:'Стабильный мир', x:235, y:650, desc:'Региональная система с республиканским гарнизоном.'},
  {name:'Анкус', sector:5, region:'Среднее Кольцо', control:'republic', value:'Патрульный сектор', x:170, y:655, desc:'Система обеспечения маршрутов снабжения.'},
  {name:'Прэйс', sector:5, region:'Внешнее Кольцо', control:'republic', value:'Спорная система', x:180, y:705, desc:'Окраинный мир, удерживаемый силами Республики.'},
  {name:'Красные Близнецы', sector:5, region:'Внешнее Кольцо', control:'republic', value:'Пограничная система', x:310, y:680, desc:'Парная система на рубеже контроля Республики.'},
  {name:'Раго', sector:5, region:'Внешнее Кольцо', control:'republic', value:'Маршрут снабжения', x:370, y:625, desc:'Система на торговом пути внешних снабженческих линий.'},
  {name:'Ордна-Мантелл', sector:5, region:'Среднее Кольцо', control:'republic', value:'Тактический узел', x:450, y:675, desc:'Мир на пересечении маршрутов снабжения и военных перемещений.'},
  {name:'Алин', sector:5, region:'Среднее Кольцо', control:'republic', value:'Тыловая система', x:535, y:690, desc:'Система поддержки региональных операций.'},
  {name:'Формакас', sector:5, region:'Среднее Кольцо', control:'republic', value:'Передовая линия', x:345, y:560, desc:'Оспариваемая система рядом с линией фронта.'},

  {name:'Тарис', sector:6, region:'Среднее Кольцо', control:'cis', value:'Городская система', x:650, y:365, desc:'Стратегический мир с городской инфраструктурой.'},
  {name:'Альдераан', sector:6, region:'Центральные Миры', control:'republic', value:'Дипломатический узел', x:745, y:595, desc:'Мир Сената, дипломатии и гуманитарных инициатив Республики.'},
  {name:'Фелучия', sector:6, region:'Внешнее Кольцо', control:'cis', value:'Боевые действия', x:670, y:665, desc:'Джунглевая система, где КНС регулярно разворачивает дроидные силы.'}
];
const galaxySectorPolygons = [
  {id:1, points:[[120,80],[430,80],[410,170],[360,250],[370,330],[250,360],[120,360]]},
  {id:2, points:[[430,80],[760,80],[820,160],[780,270],[650,330],[520,315],[410,170]]},
  {id:3, points:[[760,80],[1165,80],[1165,705],[910,705],[840,590],[880,455],[780,270],[820,160]]},
  {id:4, points:[[120,360],[250,360],[370,330],[520,315],[610,430],[560,560],[405,625],[120,625]]},
  {id:5, points:[[120,625],[405,625],[560,560],[650,705],[120,705]]},
  {id:6, points:[[520,315],[650,330],[780,270],[880,455],[840,590],[910,705],[650,705],[560,560],[610,430]]}
];
const galaxySectors = galaxySectorPolygons.map(s => ({ id:s.id, name:`Сектор ${s.id}` }));
const galaxyStars = Array.from({length:190}, (_, i) => {
  const n = Math.sin((i + 7) * 129.731) * 10000;
  const m = Math.sin((i + 11) * 91.413) * 10000;
  return { x: ((n - Math.floor(n)) * 1450) - 85, y: ((m - Math.floor(m)) * 980) - 65, r: .55 + (((n * m) % 1 + 1) % 1) * 1.45, o:.18 + (((n + m) % 1 + 1) % 1) * .7 };
});
let galaxyFilter = 'all';
let galaxyRegion = 'all';
let galaxyQuery = '';
let galaxySelected = galaxyPlanets[0];
let galaxyWorld = null;
let galaxyPointerDown = false;
let galaxyDidDrag = false;
let galaxyStart = {x:0,y:0,tx:0,ty:0};
let galaxyTarget = {x:0,y:0,k:1};
let galaxyCurrent = {x:0,y:0,k:1};
let galaxyAnimationStarted = false;


function galaxyPlayClick(){
  try { const a = new Audio(galaxyClickAudioUrl); a.volume = .42; a.play().catch(()=>{}); } catch(e) {}
}
function galaxyStartLoadSound(){
  let a;
  try { a = new Audio(galaxyLoadAudioUrl); } catch(e) { return null; }
  a.volume = .05;
  a.play().catch(()=>{});
  const started = performance.now();
  const tick = () => {
    const t = Math.min(1, (performance.now() - started) / 5000);
    a.volume = .05 + t * .75;
    if (t < 1 && !a.ended) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return a;
}
function galaxyBeginLoading(){
  if (!galaxyLock || !galaxyView) return unlockGalaxy();
  galaxyLock.classList.add('loading');
  if (galaxyPasswordStatus) galaxyPasswordStatus.textContent = 'Инициализация тактической сети...';
  galaxyStartLoadSound();
  setTimeout(() => {
    sessionStorage.setItem('eotgGalaxyAccess','1');
    galaxyLock.classList.remove('loading');
    unlockGalaxy();
  }, 5000);
}

function galaxyFactionLabel(value){ return value === 'republic' ? 'Галактическая Республика' : value === 'cis' ? 'Конфедерация независимых систем' : 'Нейтрально'; }
function galaxyFactionShort(value){ return value === 'republic' ? 'Респ.' : value === 'cis' ? 'КНС' : value === 'contested' ? 'Спорный' : 'Нейтр.'; }
function galaxyFactionClass(value){ return value === 'republic' ? 'republic' : value === 'cis' ? 'cis' : 'neutral'; }
function galaxySectorControl(id){
  const list = galaxyPlanets.filter(p => p.sector === id);
  const counts = { republic:0, cis:0, neutral:0 };
  list.forEach(p => counts[p.control]++);
  const top = Math.max(counts.republic, counts.cis, counts.neutral);
  if (!top) return 'neutral';
  if (counts.republic === top && counts.republic > counts.cis && counts.republic > counts.neutral) return 'republic';
  if (counts.cis === top && counts.cis > counts.republic && counts.cis > counts.neutral) return 'cis';
  if (counts.neutral === top && counts.neutral > counts.republic && counts.neutral > counts.cis) return 'neutral';
  if (counts.republic === top && counts.cis === top) return counts.republic >= counts.neutral ? 'neutral' : 'neutral';
  return counts.republic > counts.cis ? 'republic' : counts.cis > counts.republic ? 'cis' : 'neutral';
}
function galaxyFilteredPlanets(){
  return galaxyPlanets.filter(p => (galaxyFilter === 'all' || p.control === galaxyFilter) && (galaxyRegion === 'all' || p.region === galaxyRegion) && (!galaxyQuery || p.name.toLowerCase().includes(galaxyQuery)));
}
function galaxyPolygonPath(points){
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
}
function galaxyPolygonCenter(points){
  const sum = points.reduce((a, p) => ({x:a.x+p[0], y:a.y+p[1]}), {x:0,y:0});
  return {x:sum.x/points.length, y:sum.y/points.length};
}
function galaxyApplyTransform(){
  if (!galaxyWorld) return;
  galaxyWorld.setAttribute('transform', `translate(${galaxyCurrent.x.toFixed(2)} ${galaxyCurrent.y.toFixed(2)}) scale(${galaxyCurrent.k.toFixed(4)})`);
}
function galaxySetTransform(x, y, k, immediate){
  galaxyTarget.x = Math.max(-1250, Math.min(760, x));
  galaxyTarget.y = Math.max(-860, Math.min(620, y));
  galaxyTarget.k = Math.max(.62, Math.min(4.2, k));
  if (immediate) {
    galaxyCurrent = {...galaxyTarget};
    galaxyApplyTransform();
    galaxyAnimationStarted = false;
    return;
  }
  galaxyStartAnimation();
}
function galaxyStartAnimation(){
  if (galaxyAnimationStarted) return;
  galaxyAnimationStarted = true;
  requestAnimationFrame(galaxyAnimate);
}
function galaxyAnimate(){
  galaxyCurrent.x += (galaxyTarget.x - galaxyCurrent.x) * .18;
  galaxyCurrent.y += (galaxyTarget.y - galaxyCurrent.y) * .18;
  galaxyCurrent.k += (galaxyTarget.k - galaxyCurrent.k) * .18;
  galaxyApplyTransform();
  if (Math.abs(galaxyTarget.x-galaxyCurrent.x)+Math.abs(galaxyTarget.y-galaxyCurrent.y)+Math.abs(galaxyTarget.k-galaxyCurrent.k) > .02) requestAnimationFrame(galaxyAnimate); else galaxyAnimationStarted = false;
}
function galaxySvgPoint(evt){
  const rect = galaxyMap.getBoundingClientRect();
  return { x:(evt.clientX - rect.left) * 1280 / rect.width, y:(evt.clientY - rect.top) * 820 / rect.height };
}
function galaxyZoomAt(evt, factor){
  if (!galaxyMap) return;
  const p = evt && evt.clientX ? galaxySvgPoint(evt) : {x:640,y:410};
  const oldK = galaxyCurrent.k || galaxyTarget.k || 1;
  const nextK = Math.max(.62, Math.min(4.2, oldK * factor));
  const wx = (p.x - galaxyCurrent.x) / oldK;
  const wy = (p.y - galaxyCurrent.y) / oldK;
  galaxySetTransform(p.x - wx * nextK, p.y - wy * nextK, nextK);
}
function galaxyFocusPlanet(planet){
  galaxyPlayClick();
  galaxySelected = planet;
  galaxySetTransform(640 - planet.x * 1.55, 410 - planet.y * 1.55, 1.55);
  renderGalaxyPanel(planet);
  renderGalaxyPlanetList();
  galaxyMap?.querySelectorAll('.galaxy-planet-wrap').forEach(el => el.classList.toggle('selected', el.dataset.name === planet.name));
  const active = galaxyMap?.querySelector(`[data-name="${CSS.escape(planet.name)}"]`);
  active?.classList.remove('pulse-on-select');
  requestAnimationFrame(() => active?.classList.add('pulse-on-select'));
}
function renderGalaxyPanel(planet){
  if (!galaxyPanel || !planet) return;
  galaxyPanel.innerHTML = `<p class="eyebrow">Система выбрана</p><h3>${planet.name}</h3><div class="galaxy-control ${galaxyFactionClass(planet.control)}">${galaxyFactionLabel(planet.control)}</div><dl class="galaxy-data"><div><dt>Сектор</dt><dd>${String(planet.sector).padStart(2,'0')}</dd></div><div><dt>Регион</dt><dd>${planet.region}</dd></div><div><dt>Ценность</dt><dd>${planet.value}</dd></div></dl><p>${planet.desc}</p><div class="galaxy-sector-list" id="galaxySectorList"></div>`;
  renderGalaxySectorList();
}
function renderGalaxySectorList(){
  const target = document.getElementById('galaxySectorList');
  if (!target) return;
  target.innerHTML = galaxySectors.map(s => {
    const control = galaxySectorControl(s.id);
    const count = galaxyPlanets.filter(p => p.sector === s.id).length;
    return `<button class="galaxy-sector-chip ${control}" data-sector="${s.id}"><span>${s.name}</span><b>${galaxyFactionShort(control)}</b><i>${count} систем</i></button>`;
  }).join('');
  target.querySelectorAll('[data-sector]').forEach(btn => btn.addEventListener('click', () => {
    const p = galaxyPlanets.find(x => x.sector === Number(btn.dataset.sector));
    if (p) galaxyFocusPlanet(p);
  }));
}
function renderGalaxyPlanetList(){
  if (!galaxyPlanetList) return;
  const list = galaxyFilteredPlanets();
  galaxyPlanetList.innerHTML = list.map(p => `<button class="galaxy-planet-row ${p.control} ${galaxySelected?.name === p.name ? 'active' : ''}" data-name="${p.name}"><b>${p.name}</b><span>${p.region}</span></button>`).join('') || '<div class="galaxy-empty">Системы не найдены</div>';
  galaxyPlanetList.querySelectorAll('[data-name]').forEach(btn => btn.addEventListener('click', () => {
    const p = galaxyPlanets.find(x => x.name === btn.dataset.name);
    if (p) galaxyFocusPlanet(p);
  }));
}
function renderGalaxy(){
  if (!galaxyMap) return;
  galaxyMap.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = ``;
  galaxyMap.appendChild(defs);
  galaxyWorld = document.createElementNS(ns,'g');
  galaxyWorld.setAttribute('class','galaxy-world');
  galaxyMap.appendChild(galaxyWorld);
  galaxyStars.forEach(s => { const st = document.createElementNS(ns, 'circle'); st.setAttribute('cx', String(s.x)); st.setAttribute('cy', String(s.y)); st.setAttribute('r', String(s.r)); st.setAttribute('class','galaxy-star'); st.setAttribute('opacity', String(s.o)); galaxyWorld.appendChild(st); });
  for (let gx=-120; gx<=1400; gx+=120){ const l = document.createElementNS(ns,'line'); l.setAttribute('x1',gx); l.setAttribute('y1',-80); l.setAttribute('x2',gx); l.setAttribute('y2',940); l.setAttribute('class','galaxy-grid-line'); galaxyWorld.appendChild(l); }
  for (let gy=-80; gy<=940; gy+=120){ const l = document.createElementNS(ns,'line'); l.setAttribute('x1',-120); l.setAttribute('y1',gy); l.setAttribute('x2',1400); l.setAttribute('y2',gy); l.setAttribute('class','galaxy-grid-line'); galaxyWorld.appendChild(l); }
  galaxySectorPolygons.forEach(sector => {
    const control = galaxySectorControl(sector.id);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', galaxyPolygonPath(sector.points));
    path.setAttribute('class', `galaxy-sector ${control}`);
    galaxyWorld.appendChild(path);
    const c = galaxyPolygonCenter(sector.points);
    const text = document.createElementNS(ns,'text');
    text.setAttribute('x', c.x.toFixed(1));
    text.setAttribute('y', c.y.toFixed(1));
    text.setAttribute('class','galaxy-sector-label');
    text.setAttribute('text-anchor','middle');
    text.textContent = String(sector.id).padStart(2,'0');
    galaxyWorld.appendChild(text);
  });
  const visiblePlanets = new Set(galaxyFilteredPlanets());
  galaxyPlanets.forEach(p => {
    const hidden = !visiblePlanets.has(p);
    const group = document.createElementNS(ns,'g');
    group.setAttribute('class', `galaxy-planet-wrap ${p.control} ${hidden ? 'hidden' : ''} ${galaxySelected?.name === p.name ? 'selected' : ''}`);
    group.setAttribute('data-name', p.name);
    group.addEventListener('pointerdown', e => e.stopPropagation());
    group.addEventListener('click', e => { e.stopPropagation(); galaxyFocusPlanet(p); });
    const orbit = document.createElementNS(ns,'circle'); orbit.setAttribute('cx', p.x); orbit.setAttribute('cy', p.y); orbit.setAttribute('r', '16'); orbit.setAttribute('class','galaxy-planet-orbit');
    const dot = document.createElementNS(ns,'circle'); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', '5.2'); dot.setAttribute('class','galaxy-planet');
    const name = document.createElementNS(ns,'text'); name.setAttribute('x', p.x + 20); name.setAttribute('y', p.y + 6); name.setAttribute('class','galaxy-planet-name'); name.textContent = p.name;
    group.append(orbit,dot,name); galaxyWorld.appendChild(group);
  });
  renderGalaxyPanel(galaxySelected);
  renderGalaxyPlanetList();
  galaxyCurrent = {...galaxyTarget};
  galaxyApplyTransform();
}
function unlockGalaxy(){
  if (!galaxyLock || !galaxyView) return;
  galaxyLock.hidden = true;
  galaxyView.hidden = false;
  galaxySetTransform(0, 0, 1);
  renderGalaxy();
}
function checkGalaxyAccess(){ if (sessionStorage.getItem('eotgGalaxyAccess') === '1') unlockGalaxy(); }
galaxyPasswordForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if ((galaxyPasswordInput?.value || '').trim() === '1969') galaxyBeginLoading();
  else if (galaxyPasswordStatus) galaxyPasswordStatus.textContent = 'Неверный код допуска.';
});
galaxyFilters.forEach(btn => btn.addEventListener('click', () => { galaxyFilters.forEach(b => b.classList.remove('active')); btn.classList.add('active'); galaxyFilter = btn.dataset.filter || 'all'; renderGalaxy(); }));
galaxyRegionFilter?.addEventListener('change', () => { galaxyRegion = galaxyRegionFilter.value || 'all'; renderGalaxy(); });
galaxySearch?.addEventListener('input', () => { galaxyQuery = galaxySearch.value.trim().toLowerCase(); renderGalaxy(); });
document.getElementById('galaxyZoomIn')?.addEventListener('click', () => galaxyZoomAt(null, 1.22));
document.getElementById('galaxyZoomOut')?.addEventListener('click', () => galaxyZoomAt(null, .82));
document.getElementById('galaxyReset')?.addEventListener('click', () => galaxySetTransform(0, 0, 1));
galaxyMap?.addEventListener('wheel', e => { e.preventDefault(); galaxyZoomAt(e, e.deltaY < 0 ? 1.16 : .86); }, {passive:false});
galaxyMap?.addEventListener('pointerdown', e => { galaxyPointerDown = true; galaxyDidDrag = false; galaxyStart = {x:e.clientX, y:e.clientY, tx:galaxyTarget.x, ty:galaxyTarget.y}; galaxyMap.setPointerCapture?.(e.pointerId); galaxyMapShell?.classList.add('dragging'); });
galaxyMap?.addEventListener('pointermove', e => {
  if (galaxyCoords) galaxyCoords.textContent = `SECTOR: ${galaxySelected ? String(galaxySelected.sector).padStart(2,'0') : '--'} // GRID: X ${Math.round(galaxySvgPoint(e).x)} Y ${Math.round(galaxySvgPoint(e).y)}`;
  if (!galaxyPointerDown) return;
  const rect = galaxyMap.getBoundingClientRect();
  const sx = 1280 / rect.width, sy = 820 / rect.height;
  const dx = (e.clientX - galaxyStart.x) * sx;
  const dy = (e.clientY - galaxyStart.y) * sy;
  if (Math.abs(dx)+Math.abs(dy) > 3) galaxyDidDrag = true;
  galaxySetTransform(galaxyStart.tx + dx, galaxyStart.ty + dy, galaxyTarget.k, true);
});
['pointerup','pointercancel','pointerleave'].forEach(ev => galaxyMap?.addEventListener(ev, e => { galaxyPointerDown = false; galaxyMapShell?.classList.remove('dragging'); }));
['pointerup','pointercancel','blur'].forEach(ev => window.addEventListener(ev, () => { galaxyPointerDown = false; galaxyMapShell?.classList.remove('dragging'); }, {passive:true}));
window.addEventListener('DOMContentLoaded', checkGalaxyAccess);
window.addEventListener('hashchange', () => { if (location.hash === '#galaxy') setTimeout(checkGalaxyAccess, 120); });

(function(){
  const storeKey = 'eotgGalaxyWarV3';
  const legacyStoreKey = 'eotgGalaxyWarV2';
  const resultKey = 'eotgGalaxyControlV2';
  const cooldownKey = 'eotgGalaxyCooldownV2';
  const travelMs = 60 * 1000;
  const battleDurationMs = 18 * 60 * 60 * 1000;
  const cooldownMs = 24 * 60 * 60 * 1000;
  const battleStepMs = 5 * 60 * 1000;
  const assets = {
    venator:'assets/galaxy/venator.png',
    cis:'assets/galaxy/cis-cruiser.png',
    laserRed:'assets/galaxy/laser-red.png',
    laserBlue:'assets/galaxy/laser-blue.png',
    music:'assets/sounds/galaxy-battle.mp3',
    video:'assets/video/republic-venator-arrival.mp4'
  };
  let music = null;
  let timer = null;
  let videoMark = '';
  let fleetLoop = false;

  function read(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed || fallback;
    } catch(e){ return fallback; }
  }
  function write(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }
  function controls(){ return read(resultKey, {}); }
  function setControls(v){ write(resultKey, v); }
  function applyControls(){ const r=controls(); galaxyPlanets.forEach(p=>{ if(r[p.name]) p.control=r[p.name]; }); }
  function cooldowns(){ return read(cooldownKey, {}); }
  function ships(prefix){ return [0,1,2].map((_,i)=>({id:prefix+i,hp:100,max:100})); }
  function normalizeStatus(status){
    if (status === 'pending' || status === 'pending_admin' || status === 'awaitingAdmin') return 'awaiting_admin';
    return status || 'travel';
  }
  function normalizeState(s){
    if (!s || !s.target) return null;
    s.status = normalizeStatus(s.status);
    s.republic = Array.isArray(s.republic) && s.republic.length ? s.republic : ships('r');
    s.cis = Array.isArray(s.cis) && s.cis.length ? s.cis : ships('c');
    if (!s.startedAt) s.startedAt = Date.now();
    if (!s.arrivalAt) s.arrivalAt = s.startedAt + travelMs;
    return s;
  }
  function loadRawState(){
    const current = normalizeState(read(storeKey, null));
    if (current) return current;
    const legacy = normalizeState(read(legacyStoreKey, null));
    if (legacy && legacy.status !== 'finished') {
      write(storeKey, legacy);
      return legacy;
    }
    return null;
  }
  function save(s){ write(storeKey, s); }
  function state(){ const s=loadRawState(); return s ? update(s) : null; }
  function stateForRender(){
    const s=loadRawState();
    if(!s) return null;
    const now=Date.now();
    s.status = normalizeStatus(s.status);
    if((s.status==='travel' && now>=s.arrivalAt) || (s.status==='battle' && now-(s.battleAt||now) >= battleDurationMs)) return update(s);
    return s;
  }
  function isActiveState(s){ return !!(s && ['travel','battle','awaiting_admin'].includes(normalizeStatus(s.status))); }
  function hasActiveOperation(){ return isActiveState(loadRawState()); }
  function canLaunch(name){
    if (hasActiveOperation()) return false;
    const c=cooldowns();
    return !c[name] || Date.now()-c[name] >= cooldownMs;
  }
  function nearestRepublic(target){
    let best=null, d=Infinity;
    galaxyPlanets.forEach(p=>{ if(p.control!=='republic')return; const n=Math.hypot(p.x-target.x,p.y-target.y); if(n<d){d=n;best=p;} });
    return best || galaxyPlanets.find(p=>p.control==='republic');
  }
  function update(s){
    const now=Date.now();
    s.status = normalizeStatus(s.status);
    if(s.status==='travel' && now>=s.arrivalAt){
      s.status='battle';
      s.battleAt=now;
      s.lastTick=now;
      s.log=['Флот прибыл к планете. Начинается орбитальное сражение.'];
    }
    if(s.status==='battle'){
      const steps=Math.min(240, Math.floor((now-(s.lastTick||now))/battleStepMs));
      for(let i=0;i<steps;i++) damage(s);
      if(steps) s.lastTick += steps*battleStepMs;
      if(now-(s.battleAt||now) >= battleDurationMs) waitForAdminDecision(s);
    }
    save(s);
    return s;
  }
  function damage(s){
    const ra=s.republic.filter(x=>x.hp>1), ca=s.cis.filter(x=>x.hp>1); if(!ra.length||!ca.length)return;
    const hit=(arr,amount)=>{ const x=arr[Math.floor(Math.random()*arr.length)]; x.hp=Math.max(1,x.hp-amount); };
    hit(ca,.45+Math.random()*1.65);
    hit(ra,.30+Math.random()*1.40);
  }
  function waitForAdminDecision(s){
    s.status='awaiting_admin';
    s.awaitingAdminAt=Date.now();
    s.log=[`Бой у планеты ${s.target} завершён. Ожидается решение администратора: победили силы КНС или ВАР.`];
    s.republic.forEach(x=>{ x.hp=Math.max(18, x.hp); });
    s.cis.forEach(x=>{ x.hp=Math.max(0, Math.min(x.hp, 20)); });
    stopMusic();
  }
  function finishByAdmin(winner){
    const s=state();
    if(!s || s.status!=='awaiting_admin') return;
    if(!authState || !authState.canEdit){
      alert('Завершить боевой вылет может только администратор с нужной Discord-ролью. Авторизуйтесь через Discord.');
      return;
    }
    const result = winner === 'republic' ? 'republic' : 'cis';
    const r=controls();
    r[s.target]=result;
    setControls(r);
    s.status='finished';
    s.result=result;
    s.finishedAt=Date.now();
    s.adminEndedBy=authState.user?.global_name || authState.user?.username || authState.user?.id || 'Администратор';
    s.log=[result==='republic'
      ? `Администратор завершил боевой вылет: силы ВАР победили. Планета ${s.target} перешла под контроль Республики.`
      : `Администратор завершил боевой вылет: силы КНС победили. Планета ${s.target} осталась под контролем КНС.`];
    save(s);
    applyControls();
    stopMusic();
    renderGalaxy();
    galaxyFocusPlanet(galaxyPlanets.find(p=>p.name===s.target) || galaxySelected);
  }
  function launch(target){
    if(!target || target.control!=='cis') return;
    const active=state();
    if(isActiveState(active)){
      alert(`Уже активен боевой вылет к планете ${active.target}. Новый флот можно отправить только после решения администратора.`);
      return;
    }
    if(!canLaunch(target.name)) return;
    const origin=nearestRepublic(target); if(!origin) return;
    const now=Date.now(), cd=cooldowns(); cd[target.name]=now; write(cooldownKey,cd);
    save({
      target:target.name,
      origin:origin.name,
      startedAt:now,
      arrivalAt:now+travelMs,
      status:'travel',
      lastTick:now,
      republic:ships('r'),
      cis:ships('c'),
      log:['Флот выслан.']
    });
    renderGalaxy(); galaxyFocusPlanet(target); startTimer();
  }
  function fmt(ms){ ms=Math.max(0,ms); const h=Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000), sec=Math.floor(ms%60000/1000); return h>0 ? `${String(h).padStart(2,'0')}ч ${String(m).padStart(2,'0')}м` : `${String(m).padStart(2,'0')}м ${String(sec).padStart(2,'0')}с`; }

  const oldPanel = renderGalaxyPanel;
  renderGalaxyPanel = function(planet){
    oldPanel(planet); if(!galaxyPanel||!planet)return;
    const s=state();
    const active=isActiveState(s);
    const current=active && s.target===planet.name;
    const box=document.createElement('div'); box.className='galaxy-war-panel';
    if(current){
      box.innerHTML = `<p class="eyebrow">Флотская операция</p>${statusHtml(s)}`;
    } else if(planet.control==='cis'){
      const cooldownReady = canLaunch(planet.name) || active;
      const disabled = active || !cooldownReady;
      const label = active ? 'Уже активен боевой вылет' : (!cooldownReady ? 'Захват доступен раз в день' : 'Выслать флот для захвата');
      const notice = active
        ? `<p class="galaxy-war-warning">Сейчас идёт боевой вылет к планете <b>${s.target}</b>. Можно отправить только один флот на бой.</p>`
        : `<p>Система удерживается КНС. Можно направить ударную группу Venator для захвата и организации боевого вылета.</p>`;
      box.innerHTML = `<p class="eyebrow">Флотская операция</p>${notice}<button class="galaxy-fleet-button galaxy-launch-btn" ${disabled?'disabled':''}>${label}</button>`;
      box.querySelector('button')?.addEventListener('click',()=>launch(planet));
    } else {
      box.innerHTML = `<p class="eyebrow">Флотская операция</p><p>Захват доступен только для вражеских планет КНС.</p>`;
    }
    const last=s&&s.target===planet.name&&s.status==='finished'?`<div class="galaxy-result-card ${s.result==='cis'?'defeat':''}">${s.log?.[0]||'Результат боя сохранён.'}</div>`:'';
    box.insertAdjacentHTML('beforeend', last);
    galaxyPanel.insertBefore(box, document.getElementById('galaxySectorList'));
    bindAdminControls(box);
  };
  function statusHtml(s){
    if(s.status==='travel'){
      const pct=Math.min(100,(Date.now()-s.startedAt)/(s.arrivalAt-s.startedAt)*100);
      return `<p>Флот Venator в пути из системы <b>${s.origin}</b>.</p><div class="galaxy-war-progress"><i style="width:${pct}%"></i></div><p class="galaxy-war-time">До прибытия: ${fmt(s.arrivalAt-Date.now())}</p>`;
    }
    if(s.status==='battle'){
      const left=fmt((s.battleAt||Date.now())+battleDurationMs-Date.now());
      return `<p>У орбиты идёт сражение. Мунифиценты КНС появляются только у этой планеты и ведут бой с Venator.</p><p class="galaxy-war-time">До решения исхода боя: ${left}</p>${hpHtml(s)}`;
    }
    if(s.status==='awaiting_admin'){
      const admin = authState && authState.canEdit;
      return `<p>Бой завершён. Планета пока остаётся во вражеском статусе, а Venator удерживают орбиту до решения администратора.</p>${hpHtml(s)}${admin ? adminHtml() : '<p class="galaxy-war-warning">Ожидается администратор с Discord-ролью для завершения боевого вылета.</p>'}`;
    }
    return `${s.log?.[0]||'Бой завершён.'}${hpHtml(s)}`;
  }
  function hpHtml(s){
    const row=(t,a,c)=>`<div class="galaxy-hp-row ${c}"><b>${t}</b>${a.map(x=>`<span><i style="width:${Math.round(x.hp)}%"></i><em>${Math.round(x.hp)}%</em></span>`).join('')}</div>`;
    return `<div class="galaxy-hp-grid">${row('Venator',s.republic,'rep')}${row('Мунифиценты КНС',s.cis,'cis')}</div>`;
  }
  function adminHtml(){
    return `<div class="galaxy-admin-finish"><button type="button" class="galaxy-fleet-button galaxy-admin-open">Закончить боевой вылет</button><div class="galaxy-admin-choices" hidden><p>Выберите итог боя:</p><button type="button" data-war-result="republic">Победили силы ВАР</button><button type="button" data-war-result="cis">Победили силы КНС</button></div></div>`;
  }
  function bindAdminControls(root){
    const open=root.querySelector('.galaxy-admin-open');
    const choices=root.querySelector('.galaxy-admin-choices');
    open?.addEventListener('click',()=>{ if(choices) choices.hidden = !choices.hidden; });
    root.querySelectorAll('[data-war-result]').forEach(btn=>btn.addEventListener('click',()=>{
      const result=btn.getAttribute('data-war-result');
      const text=result==='republic'?'Подтвердить победу ВАР? Планета станет республиканской.':'Подтвердить победу КНС? Планета останется вражеской.';
      if(confirm(text)) finishByAdmin(result);
    }));
  }

  const oldRender = renderGalaxy;
  renderGalaxy = function(){ applyControls(); oldRender(); renderShips(); maybeVideo(); startFleetLoop(); };
  function img(ns,href,x,y,w,h,cls,rot,opacity){
    const im=document.createElementNS(ns,'image');
    im.setAttribute('href',href); im.setAttribute('x',x-w/2); im.setAttribute('y',y-h/2); im.setAttribute('width',w); im.setAttribute('height',h);
    im.setAttribute('class',cls); im.setAttribute('preserveAspectRatio','xMidYMid meet');
    if(typeof opacity==='number') im.setAttribute('opacity',String(Math.max(0,Math.min(1,opacity))));
    if(typeof rot==='number') im.setAttribute('transform',`rotate(${rot.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);
    return im;
  }
  function routePath(origin,target){
    const dx=target.x-origin.x, dy=target.y-origin.y, mx=(origin.x+target.x)/2, my=(origin.y+target.y)/2;
    const len=Math.max(1,Math.hypot(dx,dy));
    const bend=Math.min(90,Math.max(28,len*.11));
    const cx=mx-dy/len*bend, cy=my+dx/len*bend;
    return `M ${origin.x} ${origin.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${target.x} ${target.y}`;
  }
  function pathPoint(origin,target,t,offset){
    const dx=target.x-origin.x, dy=target.y-origin.y, mx=(origin.x+target.x)/2, my=(origin.y+target.y)/2;
    const len=Math.max(1,Math.hypot(dx,dy));
    const bend=Math.min(90,Math.max(28,len*.11));
    const cx=mx-dy/len*bend, cy=my+dx/len*bend;
    const u=1-t;
    const x=u*u*origin.x+2*u*t*cx+t*t*target.x;
    const y=u*u*origin.y+2*u*t*cy+t*t*target.y+offset;
    const tx=2*u*(cx-origin.x)+2*t*(target.x-cx);
    const ty=2*u*(cy-origin.y)+2*t*(target.y-cy);
    return {x,y,angle:Math.atan2(ty,tx)*57.2958};
  }
  function isBattleIntroReady(s){ return !!(s && s.status==='battle' && videoMark === battleVideoKey(s) + ':done'); }
  function battleVideoKey(s){ return String(s.target || '') + ':' + String(s.battleAt || 'battle'); }
  function battlePositions(target, now, status){
    const pending = status === 'awaiting_admin';
    if(pending){
      return {
        rep:[0,1,2].map(i=>{
          const a=(now/2300+i*2.094)%(Math.PI*2);
          return {x:target.x+Math.cos(a)*42,y:target.y+Math.sin(a)*26,rot:a*57.2958+90};
        }),
        cis:[]
      };
    }
    return {
      rep:[0,1,2].map(i=>({
        x:target.x-86+Math.sin(now/720+i*1.2)*5,
        y:target.y-46+i*44+Math.cos(now/760+i)*4,
        rot:-7+Math.sin(now/1100+i)*3
      })),
      cis:[0,1,2].map(i=>({
        x:target.x+92+Math.sin(now/690+i)*5,
        y:target.y-46+i*44+Math.cos(now/820+i*1.15)*4,
        rot:187+Math.cos(now/1080+i)*3
      }))
    };
  }
  function battleFade(now, startedAt){
    const t=Math.max(0, Math.min(1, (now-(startedAt||now))/3200));
    return 1 - Math.pow(1-t, 3);
  }
  function addShotSprite(ns, layer, from, to, href, cls, progress, width, height){
    if(!from || !to) return;
    const dx=to.x-from.x, dy=to.y-from.y;
    const angle=Math.atan2(dy,dx)*57.2958;
    const flight=0.10 + Math.max(0,Math.min(1,progress)) * 0.80;
    const x=from.x + dx*flight;
    const y=from.y + dy*flight;
    const shot=img(ns, href, x, y, width, height, `galaxy-shot ${cls}`, angle, .95);
    layer.appendChild(shot);
    if(progress > .72){
      const impact=document.createElementNS(ns,'circle');
      const lead=Math.min(0.97, flight + 0.035);
      impact.setAttribute('cx',(from.x + dx*lead).toFixed(1));
      impact.setAttribute('cy',(from.y + dy*lead).toFixed(1));
      impact.setAttribute('r', cls==='red' ? '2.7' : '2.1');
      impact.setAttribute('class', `galaxy-shot-impact ${cls}`);
      impact.setAttribute('opacity', String(Math.min(.82, (progress-.72)*3.2)));
      layer.appendChild(impact);
    }
  }
  function renderShips(){
    if(!galaxyWorld)return;
    galaxyWorld.querySelectorAll('.galaxy-war-layer').forEach(n=>n.remove());
    const ns='http://www.w3.org/2000/svg';
    const layer=document.createElementNS(ns,'g');
    layer.setAttribute('class','galaxy-war-layer');
    galaxyWorld.appendChild(layer);
    const now=Date.now();
    const s=stateForRender(); if(!s)return;
    const target=galaxyPlanets.find(p=>p.name===s.target), origin=galaxyPlanets.find(p=>p.name===s.origin); if(!target||!origin)return;
    if(s.status==='travel'){
      const route=document.createElementNS(ns,'path');
      route.setAttribute('d',routePath(origin,target));
      route.setAttribute('class','galaxy-fleet-route');
      layer.appendChild(route);
      const t=Math.max(0,Math.min(1,(now-s.startedAt)/(s.arrivalAt-s.startedAt)));
      const progress=document.createElementNS(ns,'path');
      progress.setAttribute('d',routePath(origin,target));
      progress.setAttribute('class','galaxy-fleet-progress');
      progress.setAttribute('pathLength','100');
      progress.setAttribute('stroke-dasharray',`${Math.max(1,t*100)} 100`);
      layer.appendChild(progress);
      for(let i=0;i<3;i++){
        const tt=Math.max(0,Math.min(1,t-i*.032));
        const p=pathPoint(origin,target,tt,(i-1)*12);
        layer.appendChild(img(ns,assets.venator,p.x,p.y,34,20,'galaxy-ship republic-ship travelling',p.angle));
      }
      const label=document.createElementNS(ns,'text');
      const lp=pathPoint(origin,target,Math.min(1,t+.035),-26);
      label.setAttribute('x',lp.x); label.setAttribute('y',lp.y); label.setAttribute('class','galaxy-fleet-label'); label.textContent='Флот в пути'; layer.appendChild(label);
      return;
    }
    if(s.status==='battle'){
      maybeVideo();
      if(isBattleIntroReady(s)) startMusic();
      const fade=battleFade(now, s.battleAt || now);
      const pos=battlePositions(target, now, s.status);
      pos.rep.forEach((p,i)=>{
        const startX=target.x-160-i*14;
        const startY=target.y-62+i*42;
        const x=startX+(p.x-startX)*Math.max(.58, fade), y=startY+(p.y-startY)*Math.max(.58, fade);
        layer.appendChild(img(ns,assets.venator,x,y,42,24,'galaxy-ship republic-ship battle',p.rot,.92));
      });
      pos.cis.forEach((p,i)=>{
        const startX=target.x+178+i*18;
        const startY=target.y-74+i*46;
        const x=startX+(p.x-startX)*fade, y=startY+(p.y-startY)*fade;
        layer.appendChild(img(ns,assets.cis,x,y,56,33,'galaxy-ship cis-ship battle',p.rot,Math.max(.28,fade)));
      });
      if(fade>.45){
        const cycle=1350;
        const local=(now % cycle) / cycle;
        const volley=Math.floor(now / cycle);
        if(local < .46){
          addShotSprite(ns,layer,pos.rep[volley%3],pos.cis[(volley+1)%3],assets.laserBlue,'blue',local/.46,36,10);
        }
        if(local > .18 && local < .64){
          addShotSprite(ns,layer,pos.cis[(volley+2)%3],pos.rep[(volley+1)%3],assets.laserRed,'red',(local-.18)/.46,44,15);
        }
        if(volley % 3 === 1 && local > .54 && local < .92){
          addShotSprite(ns,layer,pos.rep[(volley+1)%3],pos.cis[volley%3],assets.laserBlue,'blue',(local-.54)/.38,34,10);
        }
      }
      return;
    }
    if(s.status==='awaiting_admin'){
      const pos=battlePositions(target, now, s.status);
      pos.rep.forEach(p=>layer.appendChild(img(ns,assets.venator,p.x,p.y,38,22,'galaxy-ship republic-ship orbiting victorious',p.rot,.96)));
      const label=document.createElementNS(ns,'text');
      label.setAttribute('x',target.x+46); label.setAttribute('y',target.y-38); label.setAttribute('class','galaxy-fleet-label'); label.textContent='Ожидает решения администратора'; layer.appendChild(label);
    }
  }
  function startMusic(){ if(music&&!music.paused)return; try{ music=music||new Audio(assets.music); music.loop=true; music.volume=.34; music.play().catch(()=>{}); }catch(e){} }
  function stopMusic(){ if(music){ music.pause(); music.currentTime=0; } }
  function playVideo(s){
    if(document.querySelector('.galaxy-video-overlay')) return;
    stopMusic();
    const key=battleVideoKey(s);
    const overlay=document.createElement('div');
    overlay.className='galaxy-video-overlay';
    overlay.innerHTML=`<video class="galaxy-arrival-video" src="${assets.video}" autoplay muted playsinline preload="auto"></video><div class="galaxy-video-shade"></div><div class="galaxy-video-title">ПРИБЫТИЕ ФЛОТА РЕСПУБЛИКИ</div><button type="button" class="galaxy-video-play" hidden>Продолжить бой</button>`;
    document.body.classList.add('galaxy-video-playing');
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('active'));
    const v=overlay.querySelector('video');
    const playBtn=overlay.querySelector('.galaxy-video-play');
    v.defaultMuted=true; v.muted=true; v.volume=0;
    let closed=false;
    const close=()=>{
      if(closed) return;
      closed=true;
      videoMark=key+':done';
      overlay.classList.remove('active');
      overlay.classList.add('closing');
      document.body.classList.remove('galaxy-video-playing');
      setTimeout(()=>overlay.remove(),700);
      startMusic();
    };
    v.addEventListener('ended',close,{once:true});
    v.addEventListener('error',close,{once:true});
    playBtn.addEventListener('click',()=>{ playBtn.hidden=true; close(); });
    const tryPlay=()=>{
      const p=v.play();
      if(p && p.catch) p.catch(()=>setTimeout(()=>{
        const retry=v.play();
        if(retry && retry.catch) retry.catch(close);
      },250));
    };
    v.load(); tryPlay();
  }
  function maybeVideo(){ const s=stateForRender(); if(!s||s.status!=='battle'||!galaxyView||galaxyView.hidden)return; const key=battleVideoKey(s); if(videoMark===key || videoMark===key+':done')return; videoMark=key; playVideo(s); }
  function startFleetLoop(){
    if(fleetLoop) return;
    fleetLoop = true;
    const step=()=>{
      if(galaxyView && !galaxyView.hidden && galaxyWorld) renderShips();
      fleetLoop = galaxyView && !galaxyView.hidden;
      if(fleetLoop) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function startTimer(){
    if(timer)return;
    timer=setInterval(()=>{
      if(galaxyView&&!galaxyView.hidden){
        const before=state();
        renderGalaxyPanel(galaxySelected);
        renderGalaxyPlanetList();
        if(before && (before.status==='finished' || before.status==='awaiting_admin')) renderGalaxy();
      }
    },2500);
    startFleetLoop();
  }
  const oldUnlock=unlockGalaxy; unlockGalaxy=function(){ oldUnlock(); startTimer(); maybeVideo(); };
  window.addEventListener('hashchange',()=>{ if(location.hash==='#galaxy') { videoMark=''; setTimeout(()=>{startTimer();renderGalaxy();},180); } });
  window.addEventListener('eotg:auth-updated',()=>{ if(location.hash==='#galaxy') { renderGalaxyPanel(galaxySelected); renderShips(); } });
})();

