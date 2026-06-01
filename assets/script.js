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

navLinks.forEach(el => el.addEventListener('click', () => showView(el.dataset.view, true, true)));
mobileMenu?.addEventListener('click', () => mainNav.classList.toggle('open'));
window.addEventListener('DOMContentLoaded', () => showView(location.hash.replace('#','') || 'home', false, false));
window.addEventListener('hashchange', () => showView(location.hash.replace('#','') || 'home', false, false));


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
  if (key === 'factions') return 'Фракции';
  return 'Документ';
}

async function apiJson(url, options){
  const res = await fetch(url, options);
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

async function loadAuthState(){
  try {
    const data = await apiJson('/api/auth/me');
    authState = data;
  } catch (_) {
    authState = { user: null, canEdit: false };
  }
  renderAuthState();
  updateEditorToolbar();
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
  setTimeout(updateEditorToolbar, 470);
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
