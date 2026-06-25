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
    document.body.dataset.currentView = target;
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


function initHomeHeroVideo(){
  const video = document.querySelector('.hero-video');
  if (!video) return;
  let resetPending = false;

  const ensurePlaying = () => {
    try {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    } catch (_) {}
  };

  video.muted = true;
  video.defaultMuted = true;
  video.loop = false;

  const rewindBeforeEnd = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const cutoff = Math.max(0.08, video.duration - 0.10);
    if (video.currentTime >= cutoff && !resetPending) {
      resetPending = true;
      try { video.currentTime = 0.04; } catch (_) { video.currentTime = 0; }
      ensurePlaying();
      requestAnimationFrame(() => { resetPending = false; });
    } else if (video.currentTime < 0.5) {
      resetPending = false;
    }
  };

  video.addEventListener('timeupdate', rewindBeforeEnd);
  video.addEventListener('ended', () => {
    try { video.currentTime = 0.04; } catch (_) { video.currentTime = 0; }
    ensurePlaying();
  });
  video.addEventListener('loadedmetadata', ensurePlaying);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.body?.dataset?.currentView === 'home') ensurePlaying();
  });
  ensurePlaying();
}

initHomeHeroVideo();



function initVarDocsExplorer(){
  const shell = document.querySelector('.var-docs-shell');
  if (!shell) return;

  const search = document.getElementById('varDocsSearch');
  const grid = document.getElementById('varFolderGrid');
  const empty = document.getElementById('varDocsEmpty');
  const title = document.getElementById('varDocsFolderTitle');
  const count = document.getElementById('varDocsCount');
  const detail = document.getElementById('varDocDetail');
  const detailBack = document.getElementById('varDocBack');
  const detailKicker = document.getElementById('varDocPageKicker');
  const detailTitle = document.getElementById('varDocPageTitle');
  const detailLead = document.getElementById('varDocPageLead');
  const detailBody = document.getElementById('varDocPageBody');
  const items = [...shell.querySelectorAll('.var-sidebar-item, .var-sidebar-link')];
  const cards = [...shell.querySelectorAll('.var-folder-card')];

  let activeCategory = 'general';
  let activeDoc = null;

  const folderNames = {
    general: 'ОБЩЕВОЙСКОВОЙ УСТАВ',
    regulations: 'РЕГЛАМЕНТЫ',
    security: 'СЛУЖБА БЕЗОПАСНОСТИ',
    legion501: '501 ЛЕГИОН',
    recon91: '91-Й РАЗВЕДЫВАТЕЛЬНЫЙ',
    wolf104: '104TH БАТАЛЬОН'
  };

  const docPages = {
    'Основные строевые понятия': {
      kicker:'Кодекс Республики',
      lead:'Краткий свод базовой терминологии, необходимой для понимания строевых команд, элементов построения и повседневного взаимодействия в подразделении.',
      sections:[
        { heading:'Ключевые термины', paragraphs:['Документ описывает основные понятия строя: фронт, тыл, фланг, дистанция, интервал, колонна, шеренга и другие базовые элементы построения.', 'Материал используется как стартовая справка для каждого бойца перед изучением практических строевых дисциплин.'] },
        { heading:'Что должен знать боец', list:['Различать основные типы построений и положение в строю.', 'Понимать голосовые команды командира отделения.', 'Соблюдать дистанцию, равнение и порядок движения подразделения.'] }
      ]
    },
    'Построения': {
      kicker:'Кодекс Республики',
      lead:'Справочный раздел по формированию строя, вариантам колонн и шеренг, а также применению построений на плацу, при передвижении и в торжественных мероприятиях.',
      sections:[
        { heading:'Содержимое папки', paragraphs:['В папке собраны материалы по линейным построениям, перестроению в движении, разворотам на месте и при смене направления.', 'Документы используются при проведении плац-подготовки и церемониальных построений.'] },
        { heading:'Основные темы', list:['Построение в одну и две шеренги.', 'Колонна по одному, по два и по отделениям.', 'Перестроение и развороты по команде.'] }
      ]
    },
    'Дисциплинарный устав': {
      kicker:'Кодекс Республики',
      lead:'Раздел, посвящённый дисциплине, поощрениям, взысканиям и общему порядку рассмотрения нарушений внутри подразделений ВАР.',
      sections:[
        { heading:'Назначение', paragraphs:['Устав определяет, как фиксируются нарушения, кто выносит взыскания и в каком порядке рассматриваются спорные ситуации.', 'Также здесь описываются варианты поощрений за образцовую службу и высокие показатели.'] },
        { heading:'Ключевые блоки', list:['Поощрения и формы служебного поощрения.', 'Замечания, выговоры и дисциплинарные взыскания.', 'Порядок служебного разбирательства.'] }
      ]
    },
    'Устав ВАР': {
      kicker:'Кодекс Республики',
      lead:'Основной нормативный раздел, содержащий принципы службы в Великой Армии Республики, общие обязанности военнослужащих и базовые требования к личному составу.',
      sections:[
        { heading:'Что включает папка', paragraphs:['Папка объединяет главный свод внутренних норм, описывает структуру подчинения и закрепляет общие правила службы.', 'Используется как основной ориентир для повседневной деятельности бойцов и командного состава.'] },
        { heading:'Основные положения', list:['Статус и обязанности военнослужащего ВАР.', 'Подчинение приказам и соблюдение регламентов.', 'Ответственность за дисциплину и службу.'] }
      ]
    },
    'Правила и обязанности в строю': {
      kicker:'Кодекс Республики',
      lead:'Практический раздел о поведении военнослужащего в строю: от выправки и реакции на команды до обязанностей рядового состава во время построений и смотров.',
      sections:[
        { heading:'О чём раздел', paragraphs:['В документах раскрываются поведение в строю, форма обращения к старшим, правила выхода из строя и действия по тревоге.', 'Материал нужен для ежедневной дисциплины и единообразного поведения личного состава.'] },
        { heading:'Особое внимание', list:['Соблюдение субординации.', 'Реакция на строевые команды.', 'Порядок доклада и выхода из строя.'] }
      ]
    },
    'Проверка': {
      kicker:'Кодекс Республики',
      lead:'Сборник положений о проведении проверок подразделений, смотров внешнего вида, контроля оснащения и оценки готовности личного состава.',
      sections:[
        { heading:'Для чего нужен раздел', paragraphs:['Папка описывает порядок инспекций, проверок состояния подразделения и оформление результатов смотров.', 'Используется командирами и проверяющими лицами при контроле боевой и дисциплинарной готовности.'] },
        { heading:'Внутри раздела', list:['Смотр внешнего вида.', 'Проверка вооружения и снаряжения.', 'Оформление результатов проверки.'] }
      ]
    },
    'Курс молодого бойца': {
      kicker:'Регламент ВАР',
      lead:'Вводный раздел для кадетов и новичков: этапы обучения, обязательные занятия, нормативы допуска и базовые требования к прохождению КМБ.',
      sections:[
        { heading:'О разделе', paragraphs:['Материалы КМБ помогают новичкам быстрее освоиться в гарнизоне, изучить внутренние требования и получить стартовый набор знаний.', 'Папка используется инструкторами и кураторами при обучении рекрутов.'] },
        { heading:'Содержимое', list:['Порядок обучения и сдачи нормативов.', 'Базовая строевая и тактическая подготовка.', 'Критерии допуска к дальнейшей службе.'] }
      ]
    },
    'Техника безопасности': {
      kicker:'Регламент ВАР',
      lead:'Нормы безопасного обращения с оружием, техникой и служебным оснащением, а также правила поведения в гарнизоне и на тренировочных площадках.',
      sections:[
        { heading:'Что описано', paragraphs:['Папка фиксирует основные ограничения и правила предотвращения инцидентов при тренировках, патрулях и службе в казармах.', 'Особое внимание уделяется использованию оружия и работе в потенциально опасных зонах.'] },
        { heading:'Темы', list:['Безопасность обращения с вооружением.', 'Правила в арсенале и на полигоне.', 'Общие меры предупреждения происшествий.'] }
      ]
    },
    'Повышение и учёт': {
      kicker:'Регламент ВАР',
      lead:'Материалы по ведению кадрового учёта, отчётности подразделений, порядку повышений и фиксации служебных достижений бойцов.',
      sections:[
        { heading:'Содержимое', paragraphs:['В разделе собраны базовые правила учёта состава, оформления повышений и ведения внутренней документации подразделений.', 'Используется командирами отделений и кадровыми офицерами.'] },
        { heading:'Основные темы', list:['Критерии повышения.', 'Учёт активности и состава.', 'Ведение отчётных таблиц и журналов.'] }
      ]
    },
    'Полномочия СБ': {
      kicker:'Служба Безопасности',
      lead:'Описание полномочий сотрудников СБ, пределов вмешательства, оснований для проверок, задержаний и проведения внутренних расследований.',
      sections:[
        { heading:'Раздел охватывает', paragraphs:['Документы определяют рамки работы Службы Безопасности, её взаимодействие с командованием и порядок применения мер воздействия.', 'Также регламентируются основания для досмотров, проверок и служебных действий.'] },
        { heading:'Базовые блоки', list:['Полномочия и ограничения сотрудников СБ.', 'Проверочные мероприятия.', 'Основания для задержаний и докладов.'] }
      ]
    },
    'Процессуальные действия': {
      kicker:'Служба Безопасности',
      lead:'Внутренние процедуры оформления проверок, задержаний, протоколов и докладов, а также порядок работы с материалами расследований.',
      sections:[
        { heading:'Назначение', paragraphs:['Раздел нужен для единообразного проведения процессуальных действий и корректного оформления служебных материалов.', 'Используется СБ и уполномоченными должностными лицами при внутренней работе.'] },
        { heading:'Внутри папки', list:['Оформление протоколов.', 'Порядок допроса и опроса.', 'Рапорты и фиксация результатов расследований.'] }
      ]
    },
    'Документы 501 Легиона': {
      kicker:'501 Легион',
      lead:'Внутренний раздел 501-го Легиона: стандарты подразделения, организационные материалы, боевые указания и внутренняя нормативная база.',
      sections:[
        { heading:'О разделе', paragraphs:['Папка объединяет локальные документы конкретного подразделения и служит отдельной базой для личного состава легиона.', 'Содержимое актуализируется по мере развития внутренней структуры и задач подразделения.'] },
        { heading:'Основные материалы', list:['Внутренние стандарты подразделения.', 'Боевые и организационные инструкции.', 'Памятки для состава легиона.'] }
      ]
    },
    '91-й разведывательный корпус': {
      kicker:'91-й корпус',
      lead:'Специализированный раздел по материалам разведывательного корпуса: патрули, разведзадачи, доклады и порядок действий в полевых операциях.',
      sections:[
        { heading:'Содержимое папки', paragraphs:['Материалы ориентированы на разведывательные подразделения и описывают порядок сбора данных, маршруты патрулей и подготовку отчётности.', 'Раздел также может включать тактические памятки и регламенты для полевых задач.'] },
        { heading:'Что внутри', list:['Патрули и разведывательные задачи.', 'Полевые доклады.', 'Поведение на разведоперациях.'] }
      ]
    },
    '104th Батальон': {
      kicker:'104th Батальон',
      lead:'Локальный архив батальона Wolfpack: внутренние инструкции, требования подразделения, памятки и организационные документы для состава.',
      sections:[
        { heading:'О странице', paragraphs:['Эта папка служит точкой входа во внутреннюю документацию 104-го батальона и объединяет материалы, актуальные только для его личного состава.', 'Материалы могут обновляться в зависимости от изменений во внутренней организации подразделения.'] },
        { heading:'Ключевые блоки', list:['Внутренние правила подразделения.', 'Инструкции и памятки.', 'Организационные материалы Wolfpack.'] }
      ]
    }
  };

  const pluralizeDocs = visible => `${visible} ${visible === 1 ? 'документ' : (visible >= 2 && visible <= 4 ? 'документа' : 'документов')} в папке`;

  const renderDetailBody = doc => {
    if (!detailBody) return;
    detailBody.innerHTML = (doc.sections || []).map(section => {
      const paragraphs = (section.paragraphs || []).map(text => `<p>${holonetEscape(text)}</p>`).join('');
      const list = Array.isArray(section.list) && section.list.length
        ? `<ul>${section.list.map(item => `<li>${holonetEscape(item)}</li>`).join('')}</ul>`
        : '';
      return `<section class="var-doc-section"><h4>${holonetEscape(section.heading || '')}</h4>${paragraphs}${list}</section>`;
    }).join('');
  };

  const openDoc = card => {
    if (!card || !detail || !grid) return;
    const name = card.dataset.varTitle || card.querySelector('b')?.textContent?.trim() || 'Документ ВАР';
    const doc = docPages[name] || {
      kicker: card.querySelector('span')?.textContent?.trim() || folderNames[activeCategory] || 'Архив ВАР',
      lead: card.querySelector('small')?.textContent?.trim() || 'Материал готовится к наполнению.',
      sections:[{ heading:'Описание', paragraphs:['Эта страница подготовлена как отдельная карточка документа ВАР. Контент можно будет заменить на полноценный текст документа позже.'] }]
    };

    activeDoc = name;
    if (detailKicker) detailKicker.textContent = doc.kicker || 'Архив ВАР';
    if (detailTitle) detailTitle.textContent = name;
    if (detailLead) detailLead.textContent = doc.lead || '';
    renderDetailBody(doc);

    detail.hidden = false;
    shell.classList.add('showing-doc');
    requestAnimationFrame(() => detail.classList.add('is-active'));
    if (title) title.textContent = name.toUpperCase();
    if (count) count.textContent = 'страница документа';
  };

  const closeDoc = () => {
    activeDoc = null;
    if (!detail) return;
    const keepY = window.scrollY;
    detail.classList.remove('is-active');
    detail.hidden = true;
    shell.classList.remove('showing-doc');
    update(false);
    requestAnimationFrame(() => window.scrollTo({ top: keepY, left: 0, behavior: 'instant' }));
  };

  const update = (animate = true) => {
    const query = (search?.value || '').trim().toLowerCase();
    let visible = 0;

    if (grid && animate) {
      grid.classList.remove('is-updating');
      void grid.offsetWidth;
      grid.classList.add('is-updating');
    }

    cards.forEach(card => {
      const inCategory = card.dataset.varCategory === activeCategory;
      const haystack = `${card.dataset.varTitle || ''} ${card.dataset.varText || ''} ${card.textContent || ''}`.toLowerCase();
      const matched = !query || haystack.includes(query);
      const show = inCategory && matched;
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (title) title.textContent = folderNames[activeCategory] || 'ДОКУМЕНТАЦИЯ';
    if (count) count.textContent = pluralizeDocs(visible);
    if (empty) empty.hidden = visible !== 0;
    if (grid) grid.classList.toggle('is-empty', visible === 0);
  };

  const setCategory = category => {
    if (!category) return;
    activeCategory = category;
    items.forEach(x => x.classList.toggle('active', x.dataset.varCategory === category && x.classList.contains('var-sidebar-item')));
    if (activeDoc) closeDoc(); else update();
  };

  items.forEach(item => {
    item.addEventListener('click', () => setCategory(item.dataset.varCategory));
  });

  cards.forEach(card => {
    card.addEventListener('click', () => openDoc(card));
  });

  detailBack?.addEventListener('click', closeDoc);
  search?.addEventListener('input', () => { if (activeDoc) closeDoc(); else update(); });
  update();
}

initVarDocsExplorer();



let holonetLastLoadedAt = 0;
let holonetLoading = false;

function holonetEscape(value){
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function holonetFormatTime(value){
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('ru-RU', { day:'2-digit', month:'short' }).replace('.', '');
  } catch (_) {
    return '';
  }
}
function holonetSetStatus(text){
  const status = document.getElementById('holonetStatus');
  if (status) status.textContent = text || '';
}
function holonetRender(items){
  const feed = document.getElementById('holonetFeed');
  const list = document.getElementById('holonetList');
  if (!feed || !list) return;

  if (!Array.isArray(items) || !items.length) {
    list.innerHTML = '<p class="hero-holonet-empty">Опубликованных передач пока нет.</p>';
    feed.classList.remove('has-items');
    holonetSetStatus('нет сигнала');
    return;
  }

  feed.classList.add('has-items');
  holonetSetStatus('последние публикации');
  list.innerHTML = items.map(item => {
    const date = holonetFormatTime(item.timestamp);
    const author = item.author ? `<small>${holonetEscape(item.author)}</small>` : '';
    const link = item.url ? ` href="${holonetEscape(item.url)}" target="_blank" rel="noopener"` : '';
    return `<article class="hero-holonet-item">
      <a${link}>
        <div class="hero-holonet-meta"><span>${date || 'сводка'}</span>${author}</div>
        <b>${holonetEscape(item.title || 'Передача Голонета')}</b>
        <p>${holonetEscape(item.text || '')}</p>
      </a>
    </article>`;
  }).join('');
}
async function loadHolonetAnnouncements(force = false){
  const feed = document.getElementById('holonetFeed');
  if (!feed || holonetLoading) return;
  const now = Date.now();
  if (!force && holonetLastLoadedAt && now - holonetLastLoadedAt < 120000) return;
  holonetLoading = true;
  holonetSetStatus('приём сигнала…');
  try {
    const data = await apiJson('/api/announcements?t=' + Date.now(), { cache:'no-store' });
    holonetLastLoadedAt = Date.now();
    holonetRender(Array.isArray(data?.announcements) ? data.announcements : []);
    if (data && data.ok === false) holonetSetStatus('сигнал недоступен');
  } catch (_) {
    holonetRender([]);
    holonetSetStatus('сигнал недоступен');
  } finally {
    holonetLoading = false;
  }
}
function refreshHolonetIfActive(){
  const homeActive = document.getElementById('view-home')?.classList.contains('active') || document.body?.dataset?.currentView === 'home';
  if (homeActive) loadHolonetAnnouncements(false);
}
loadHolonetAnnouncements(true);
setInterval(refreshHolonetIfActive, 120000);

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


const authButton = document.getElementById('authButton');
const authUser = document.getElementById('authUser');
const authAvatar = document.getElementById('authAvatar');
const authName = document.getElementById('authName');
const logoutButton = document.getElementById('logoutButton');
const steamAuthLink = document.querySelector('[data-steam-auth-link]');
const editorToolbar = document.getElementById('editorToolbar');
const editorSection = document.getElementById('editorSection');
const editToggle = document.getElementById('editToggle');
const editSave = document.getElementById('editSave');
const editCancel = document.getElementById('editCancel');
const editableDocs = [...document.querySelectorAll('.editable-doc[data-doc-key]')];
let authState = { user: null, canEdit: false, permissions: { canEditAll:false, canEditDocs:false, canEditAny:false, canAccessAllTabs:false } };
let steamAuthState = { authenticated:false, steam:null, sam:{rank:'user'}, permissions:{canEditAll:false, canEditDocs:false, canEditAny:false, canAccessAllTabs:false} };
let authLoaded = false;
let editingDoc = null;
let editingBefore = '';

function docTitle(doc){
  const key = doc?.dataset?.docKey || '';
  if (key === 'rules') return 'Правила';
  if (key === 'lore') return 'Лор';
  if (key === 'charter') return 'Документация';
  return 'Документ';
}

function canEditDocument(doc){
  if (!doc) return false;
  const key = doc.dataset?.docKey || '';
  const permissions = authState?.permissions || {};
  if (permissions.canEditAll) return true;
  if (permissions.canEditDocs && key === 'charter') return true;
  return Boolean(authState?.canEdit && key !== 'charter');
}

function samRankLabel(){
  return authState?.sam?.rank || steamAuthState?.sam?.rank || 'user';
}

function formatContentMeta(meta){
  if (!meta || !meta.updatedAt) return 'Последнее изменение: пока нет';
  let when = meta.updatedAt;
  try {
    when = new Date(meta.updatedAt).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch (_) {}
  const name = meta.updatedByName || meta.updatedBySteamId64 || 'неизвестно';
  const rank = meta.updatedByRank ? ` • ${meta.updatedByRank}` : '';
  return `Последнее изменение: ${name}${rank} • ${when}`;
}

function renderContentMeta(key, meta){
  document.querySelectorAll(`[data-content-meta="${key}"]`).forEach(node => {
    node.textContent = formatContentMeta(meta);
  });
}

async function apiJson(url, options){
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...(options || {}) });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}


function removeDocumentNumberEyebrows(){
  document.querySelectorAll('.eyebrow').forEach((node) => {
    const text = (node.textContent || '').trim();
    if (/^Документ\s*\d+/i.test(text)) node.remove();
  });
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
        if (data.meta) renderContentMeta(key, data.meta);
        if (key === 'charter' && typeof initVarDocsExplorer === 'function') setTimeout(initVarDocsExplorer, 0);
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

  authLoaded = true;
  renderAuthState();
  updateEditorToolbar();
  cleanAuthUrl();
  window.dispatchEvent(new CustomEvent('eotg:auth-updated'));
}



async function loadSteamAuthState(){
  if (!steamAuthLink) return;
  try {
    const data = await apiJson('/api/steam-auth/me?t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
    steamAuthState = {
      authenticated: Boolean(data && data.authenticated && data.steam && data.steam.steamId64),
      steam: data?.steam || null,
      sam: data?.sam || { rank:'user' },
      permissions: data?.permissions || { canEditAll:false, canEditDocs:false, canEditAny:false, canAccessAllTabs:false },
      displayName: data?.displayName || ''
    };

    steamAuthLink.classList.toggle('is-authenticated', steamAuthState.authenticated);
    steamAuthLink.classList.toggle('is-admin', Boolean(steamAuthState.permissions.canEditAll));
    steamAuthLink.classList.toggle('is-commander', Boolean(!steamAuthState.permissions.canEditAll && steamAuthState.permissions.canEditDocs));

    if (steamAuthState.authenticated) {
      const persona = steamAuthState.displayName || steamAuthState.steam?.personaName || steamAuthState.steam?.steamId64 || 'Steam авторизация активна';
      const rank = steamAuthState.sam?.rank || 'user';
      steamAuthLink.setAttribute('title', `${persona} • SAM: ${rank}`);
      steamAuthLink.setAttribute('aria-label', `Steam авторизован: ${persona}, SAM: ${rank}`);

      authState.steam = steamAuthState.steam;
      authState.sam = steamAuthState.sam;
      authState.permissions = steamAuthState.permissions;
      authState.canEdit = Boolean(steamAuthState.permissions.canEditAny);

      if (!authState.user || authState.hintOnly) {
        authState.user = {
          id: steamAuthState.steam?.steamId64 || '',
          username: persona,
          global_name: persona,
          avatar_url: steamAuthState.steam?.avatar || 'assets/steam-auth-icon.png'
        };
        authState.hintOnly = false;
      }
    } else {
      steamAuthLink.setAttribute('title', 'Авторизация через Steam');
      steamAuthLink.setAttribute('aria-label', 'Авторизация через Steam');
      authState.steam = null;
      authState.sam = { rank:'user' };
      authState.permissions = { canEditAll:false, canEditDocs:false, canEditAny:false, canAccessAllTabs:false };
      authState.canEdit = false;
    }

    renderAuthState();
    updateEditorToolbar();
    updateRoleGatedNavigation();
    window.dispatchEvent(new CustomEvent('eotg:auth-updated'));
  } catch (_) {
    steamAuthState = { authenticated:false, steam:null, sam:{rank:'user'}, permissions:{canEditAll:false, canEditDocs:false, canEditAny:false, canAccessAllTabs:false} };
    steamAuthLink.classList.remove('is-authenticated', 'is-admin', 'is-commander');
    steamAuthLink.setAttribute('title', 'Авторизация через Steam');
    steamAuthLink.setAttribute('aria-label', 'Авторизация через Steam');
  }
}

function renderAuthState(){
  if (authState.user) {
    if (authButton) authButton.hidden = true;
    if (authUser) authUser.hidden = false;
    if (authName) authName.textContent = (authState.user.global_name || authState.user.username || 'Пользователь') + (authState.sam?.rank && authState.sam.rank !== 'user' ? ' • ' + authState.sam.rank : '');
    if (authAvatar) authAvatar.src = authState.user.avatar_url || 'assets/favicon.png';
  } else {
    if (authButton) authButton.hidden = false;
    if (authUser) authUser.hidden = true;
  }
  updateRoleGatedNavigation();
}

function activeEditableDoc(){
  const view = document.querySelector('.view.active');
  if (!view) return null;
  return view.querySelector('.editable-doc[data-doc-key]');
}

function updateEditorToolbar(){
  const doc = activeEditableDoc();
  const show = Boolean(canEditDocument(doc));
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
  if (!doc || !canEditDocument(doc)) return;
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
    const result = await apiJson('/api/content', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ key, before, after })
    });
    doc.dataset.originalHtml = after;
    if (result && result.meta) renderContentMeta(key, result.meta);
    stopEditing(false);
    if (key === 'charter' && typeof initVarDocsExplorer === 'function') setTimeout(initVarDocsExplorer, 0);
    alert('Изменения сохранены. Права проверены через Steam + SAM MySQL. Лог отправлен в Discord.');
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


const commandCenterRoleId = '1493983291152400444';
const commandCenterRoleMention = '<@&1493983291152400444>';
const commandCenterLock = document.getElementById('commandCenterLock');
const commandCenterView = document.getElementById('commandCenterView');
const commandCenterAccessText = document.getElementById('commandCenterAccessText');
const commandCenterAccessStatus = document.getElementById('commandCenterAccessStatus');
const commandCenterAuthButton = document.getElementById('commandCenterAuthButton');
const commandCenterRefresh = document.getElementById('commandCenterRefresh');
const commandCenterSummary = document.getElementById('commandCenterSummary');
const commandCenterPlayers = document.getElementById('commandCenterPlayers');
const commandCenterCommands = document.getElementById('commandCenterCommands');
const commandCenterOnlineCount = document.getElementById('commandCenterOnlineCount');
const commandCenterCommandStatus = document.getElementById('commandCenterCommandStatus');
let commandCenterCache = { players: [], jobs: [], recentCommands: [] };
let commandCenterLoading = false;

function commandCenterHasAccess(){
  if (authState?.permissions?.canAccessAllTabs) return true;
  const roles = Array.isArray(authState?.roles) ? authState.roles.map(String) : [];
  return roles.includes(commandCenterRoleId);
}
function commandCenterSetGate(text, status, showLogin){
  if (commandCenterAccessText) commandCenterAccessText.textContent = text || '';
  if (commandCenterAccessStatus) commandCenterAccessStatus.textContent = status || '';
  if (commandCenterAuthButton) commandCenterAuthButton.hidden = !showLogin;
}
function commandCenterLockView(){
  if (commandCenterLock) commandCenterLock.hidden = false;
  if (commandCenterView) commandCenterView.hidden = true;
}
function commandCenterUnlockView(){
  if (commandCenterLock) commandCenterLock.hidden = true;
  if (commandCenterView) commandCenterView.hidden = false;
}
function commandCenterEscape(value){
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function commandCenterJobLabel(jobId){
  const job = commandCenterCache.jobs.find(j => j.id === jobId);
  return job ? job.name : jobId || 'Неизвестно';
}
function commandCenterRankLabel(jobId, rankId){
  const job = commandCenterCache.jobs.find(j => j.id === jobId);
  const rank = job?.ranks?.find(r => r.id === rankId);
  return rank ? rank.name : rankId || 'Без звания';
}
function commandCenterTime(ts){
  const n = Number(ts || 0);
  if (!n) return '—';
  try { return new Date(n * 1000).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); } catch (_) { return String(n); }
}
function commandCenterJobOptions(selected){
  return commandCenterCache.jobs.map(job => `<option value="${commandCenterEscape(job.id)}" ${job.id === selected ? 'selected' : ''}>${commandCenterEscape(job.name)} [${commandCenterEscape(job.id)}]</option>`).join('');
}
function commandCenterRankOptions(jobId, selected){
  const job = commandCenterCache.jobs.find(j => j.id === jobId) || commandCenterCache.jobs[0];
  const ranks = Array.isArray(job?.ranks) ? job.ranks : [];
  return ranks.map(rank => `<option value="${commandCenterEscape(rank.id)}" ${rank.id === selected ? 'selected' : ''}>${commandCenterEscape(rank.name || rank.id)} [${commandCenterEscape(rank.id)}]</option>`).join('');
}
function commandCenterStatusLabel(status){
  if (status === 'success') return 'Выполнено';
  if (status === 'error') return 'Ошибка';
  if (status === 'processing') return 'В обработке';
  return 'Ожидает';
}
function commandCenterRenderCommands(){
  if (!commandCenterCommands) return;
  const commands = commandCenterCache.recentCommands || [];
  if (!commands.length) {
    commandCenterCommands.innerHTML = '<p class="command-center-empty">Команд пока нет.</p>';
    return;
  }
  commandCenterCommands.innerHTML = commands.map(cmd => `
    <div class="command-center-command ${commandCenterEscape(cmd.status)}">
      <b>#${Number(cmd.id || 0)} • ${commandCenterStatusLabel(cmd.status)}</b>
      <span>${commandCenterEscape(commandCenterJobLabel(cmd.job))} / ${commandCenterEscape(commandCenterRankLabel(cmd.job, cmd.rank))}</span>
      <small>${commandCenterEscape(cmd.actorName || 'Командный центр')} • ${commandCenterTime(cmd.createdAt)}${cmd.error ? ' • ' + commandCenterEscape(cmd.error) : ''}</small>
    </div>
  `).join('');
}
function commandCenterRenderPlayers(){
  if (!commandCenterPlayers) return;
  const players = commandCenterCache.players || [];
  if (commandCenterOnlineCount) commandCenterOnlineCount.textContent = String(players.length);
  if (!commandCenterCache.jobs.length) {
    commandCenterPlayers.innerHTML = '<p class="command-center-empty">Каталог профессий пока пуст. Убедитесь, что Lua-модуль запущен на сервере и успел синхронизировать профессии.</p>';
    return;
  }
  if (!players.length) {
    commandCenterPlayers.innerHTML = '<p class="command-center-empty">Сейчас нет игроков с активным персонажем или сервер ещё не отправил heartbeat.</p>';
    return;
  }
  commandCenterPlayers.innerHTML = players.map((p, index) => {
    const currentJob = commandCenterCache.jobs.find(j => j.id === p.job) || commandCenterCache.jobs[0];
    const selectedJob = currentJob?.id || '';
    const selectedRank = currentJob?.ranks?.some(r => r.id === p.rank) ? p.rank : (currentJob?.defaultRank || currentJob?.ranks?.[0]?.id || '');
    return `
      <form class="command-center-player" data-index="${index}">
        <div class="command-center-player-main">
          <div>
            <b>${commandCenterEscape(p.characterName || p.playerName || p.steamId64)}</b>
            <span>${commandCenterEscape(p.playerName || 'Игрок')} • CharID ${Number(p.characterId || 0)} • ${commandCenterEscape(p.steamId || p.steamId64)}</span>
          </div>
          <em>сейчас: ${commandCenterEscape(p.jobName || commandCenterJobLabel(p.job))} / ${commandCenterEscape(p.rankName || commandCenterRankLabel(p.job, p.rank))}</em>
        </div>
        <div class="command-center-edit-row">
          <label><span>Профессия</span><select name="job">${commandCenterJobOptions(selectedJob)}</select></label>
          <label><span>Звание</span><select name="rank">${commandCenterRankOptions(selectedJob, selectedRank)}</select></label>
          <button class="primary" type="submit">Сменить</button>
        </div>
        <p class="command-center-row-status"></p>
      </form>`;
  }).join('');

  commandCenterPlayers.querySelectorAll('.command-center-player').forEach(form => {
    const index = Number(form.dataset.index || 0);
    const player = commandCenterCache.players[index];
    const jobSelect = form.elements.job;
    const rankSelect = form.elements.rank;
    const status = form.querySelector('.command-center-row-status');
    jobSelect?.addEventListener('change', () => {
      const job = commandCenterCache.jobs.find(j => j.id === jobSelect.value);
      const selectedRank = job?.defaultRank || job?.ranks?.[0]?.id || '';
      if (rankSelect) rankSelect.innerHTML = commandCenterRankOptions(jobSelect.value, selectedRank);
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      if (status) { status.textContent = 'Отправляем команду на сервер...'; status.className = 'command-center-row-status loading'; }
      try {
        const data = await apiJson('/api/command-center', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            steamId64: player.steamId64,
            characterId: player.characterId,
            job: jobSelect.value,
            rank: rankSelect.value
          })
        });
        if (status) { status.textContent = `Команда #${data.commandId || '?'} отправлена. Сервер применит её в ближайший тик.`; status.className = 'command-center-row-status ok'; }
        setTimeout(() => commandCenterRefreshData(false), 1200);
      } catch (err) {
        if (status) { status.textContent = 'Ошибка: ' + err.message; status.className = 'command-center-row-status err'; }
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
}
async function commandCenterRefreshData(showLoading = true){
  if (!commandCenterLock || !commandCenterView) return;
  if (!authLoaded) {
    commandCenterLockView();
    commandCenterSetGate('Проверяем Discord-авторизацию и роли...', 'Проверка доступа...', false);
    return;
  }
  if ((!authState.user || authState.hintOnly) && !authState?.permissions?.canAccessAllTabs) {
    commandCenterLockView();
    commandCenterSetGate('Командный центр доступен администраторам SAM или игрокам с ролью ' + commandCenterRoleMention + '.', 'Авторизуйтесь через Steam или Discord, чтобы подтвердить доступ.', true);
    return;
  }
  if (!commandCenterHasAccess()) {
    commandCenterLockView();
    commandCenterSetGate('У вашего Discord-профиля нет доступа к Командному центру.', 'Нужна роль ' + commandCenterRoleMention + '.', false);
    return;
  }
  commandCenterUnlockView();
  if (commandCenterLoading) return;
  commandCenterLoading = true;
  if (showLoading && commandCenterSummary) commandCenterSummary.textContent = 'Загружаем игроков онлайн и каталог профессий...';
  if (commandCenterCommandStatus) commandCenterCommandStatus.textContent = 'SYNC';
  try {
    const data = await apiJson('/api/command-center?t=' + Date.now(), { cache:'no-store' });
    commandCenterCache = {
      players: Array.isArray(data.players) ? data.players : [],
      jobs: Array.isArray(data.jobs) ? data.jobs : [],
      recentCommands: Array.isArray(data.recentCommands) ? data.recentCommands : []
    };
    if (commandCenterSummary) commandCenterSummary.textContent = `Онлайн-целей: ${commandCenterCache.players.length}. Профессий в каталоге: ${commandCenterCache.jobs.length}.`;
    commandCenterRenderPlayers();
    commandCenterRenderCommands();
    if (commandCenterCommandStatus) commandCenterCommandStatus.textContent = 'READY';
  } catch (err) {
    if (commandCenterSummary) commandCenterSummary.textContent = 'Ошибка загрузки Командного центра: ' + err.message;
    if (commandCenterPlayers) commandCenterPlayers.innerHTML = '<p class="command-center-empty">Не удалось получить данные. Проверьте MySQL env vars сайта и наличие таблиц Lua-модуля.</p>';
    if (commandCenterCommandStatus) commandCenterCommandStatus.textContent = 'ERROR';
  } finally {
    commandCenterLoading = false;
  }
}
function commandCenterRefreshIfActive(){
  if (location.hash === '#command-center' || document.getElementById('view-command-center')?.classList.contains('active')) {
    commandCenterRefreshData(false);
  }
}
commandCenterAuthButton?.addEventListener('click', () => { location.href = '/api/auth/login'; });
commandCenterRefresh?.addEventListener('click', () => commandCenterRefreshData(true));
window.addEventListener('eotg:auth-updated', commandCenterRefreshIfActive);
window.addEventListener('hashchange', () => { if (location.hash === '#command-center') setTimeout(() => commandCenterRefreshData(true), 120); });




const originalShowViewForEditor = showView;
showView = function(id, push = true, sound = true){
  stopEditing(false);
  originalShowViewForEditor(id, push, sound);
  setTimeout(() => { updateEditorToolbar(); updateCharterSideNav(); updateRoleGatedNavigation(); refreshHolonetIfActive(); commandCenterRefreshIfActive(); }, 470);
};

loadEditableContent().then(async () => { removeDocumentNumberEyebrows(); await loadAuthState(); await loadSteamAuthState(); updateEditorToolbar(); updateRoleGatedNavigation(); });


const canvas = document.getElementById('stars');
const ctx = canvas?.getContext('2d');
let w, h, stars;

function resize(){
  if (!canvas || !ctx) return;
  const ratio = devicePixelRatio || 1;
  w = canvas.width = innerWidth * ratio;
  h = canvas.height = innerHeight * ratio;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  const count = Math.min(420, Math.floor(innerWidth * innerHeight / 3600));
  stars = Array.from({length:count}, () => ({
    x: Math.random()*w,
    y: Math.random()*h,
    r: (Math.random()*1.35 + .18) * ratio,
    a: Math.random()*0.65 + 0.15,
    s: Math.random()*0.018 + 0.004,
    vx: (Math.random()*0.045 + 0.008) * ratio
  }));
}

function draw(){
  if (!canvas || !ctx) return;
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
  requestAnimationFrame(draw);
}
if (canvas && ctx) {
  resize();
  draw();
  addEventListener('resize', resize);
}



const galaxyAccessStatus = document.getElementById('galaxyAccessStatus');
const galaxyAccessText = document.getElementById('galaxyAccessText');
const galaxyAuthButton = document.getElementById('galaxyAuthButton');
const galaxyLock = document.getElementById('galaxyLock');
const galaxyView = document.getElementById('galaxyView');
const galaxyEventCompose = document.getElementById('galaxyEventCompose');
const galaxyEventStatus = document.getElementById('galaxyEventStatus');
const galaxyEventForm = document.getElementById('galaxyEventForm');
const galaxyEventBooking = document.getElementById('galaxyEventBooking');
const galaxyEventReload = document.getElementById('galaxyEventReload');
const galaxyEventTitle = document.getElementById('galaxyEventTitle');
const galaxyEventDescription = document.getElementById('galaxyEventDescription');
const galaxyEventAddons = document.getElementById('galaxyEventAddons');
const galaxyEventUnits = document.getElementById('galaxyEventUnits');
const galaxyEventTime = document.getElementById('galaxyEventTime');
const galaxyMapAdmin = document.getElementById('galaxyMapAdmin');
const galaxyMapAdminStatus = document.getElementById('galaxyMapAdminStatus');
const galaxyMapAdminToggle = document.getElementById('galaxyMapAdminToggle');
const galaxyMapAdminSave = document.getElementById('galaxyMapAdminSave');
const galaxyMapAdminReload = document.getElementById('galaxyMapAdminReload');
const galaxyMapAdminForm = document.getElementById('galaxyMapAdminForm');
const galaxyMapAdminName = document.getElementById('galaxyMapAdminName');
const galaxyMapAdminControl = document.getElementById('galaxyMapAdminControl');
const galaxyMapAdminSector = document.getElementById('galaxyMapAdminSector');
const galaxyMapAdminCoords = document.getElementById('galaxyMapAdminCoords');
const galaxyMapAdminDelete = document.getElementById('galaxyMapAdminDelete');
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
const galaxyAccessRoles = ['1493983291152400444', '1509282764695011580', '1305567485218521169'];
const galaxyAccessRoleMentions = '<@&1493983291152400444>, <@&1509282764695011580>, <@&1305567485218521169>';
const galaxyMapAdminRoles = ['1305567485218521169'];

function updateRoleGatedNavigation(){
  const roles = Array.isArray(authState?.roles) ? authState.roles.map(String) : [];
  const allTabs = Boolean(authState?.permissions?.canAccessAllTabs);
  const canGalaxy = allTabs || roles.some(role => galaxyAccessRoles.includes(role));
  const canCommandCenter = allTabs || roles.includes(commandCenterRoleId);
  document.querySelectorAll('[data-role-gated="galaxy"]').forEach(el => { el.hidden = !canGalaxy; });
  document.querySelectorAll('[data-role-gated="command-center"]').forEach(el => { el.hidden = !canCommandCenter; });
}

let galaxyLoadingStarted = false;
let galaxyEventBookings = [];
let galaxyEventBookingsLoading = false;
let galaxyMapAdminEnabled = false;
let galaxyMapAdminDirty = false;
let galaxyMapLayoutLoaded = false;
let galaxyPlanetDrag = null;
let galaxySuppressPlanetClick = false;

function galaxyHasRoleAccess(){
  if (authState?.permissions?.canAccessAllTabs) return true;
  const roles = Array.isArray(authState?.roles) ? authState.roles.map(String) : [];
  return galaxyAccessRoles.some(role => roles.includes(role));
}
function galaxyCanMapAdmin(){
  if (authState?.permissions?.canEditAll) return true;
  const roles = Array.isArray(authState?.roles) ? authState.roles.map(String) : [];
  return galaxyMapAdminRoles.some(role => roles.includes(role));
}
function galaxyIsUnlocked(){
  return !!(galaxyView && !galaxyView.hidden);
}
function galaxySetGate(text, status, showLogin){
  if (galaxyAccessText && text) galaxyAccessText.textContent = text;
  if (galaxyAccessStatus) galaxyAccessStatus.textContent = status || '';
  if (galaxyAuthButton) galaxyAuthButton.hidden = !showLogin;
}

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
  if (!galaxyHasRoleAccess()) {
    updateGalaxyAccessGate(false);
    return;
  }
  if (galaxyLoadingStarted || galaxyIsUnlocked()) return;
  galaxyLoadingStarted = true;
  if (!galaxyLock || !galaxyView) return unlockGalaxy();
  galaxyLock.classList.add('loading');
  galaxySetGate('Доступ подтверждён Discord-ролями. Загружаем тактическую карту...', 'Инициализация тактической сети...', false);
  galaxyStartLoadSound();
  setTimeout(() => {
    sessionStorage.setItem('eotgGalaxyAccess','1');
    galaxyLock.classList.remove('loading');
    galaxyLoadingStarted = false;
    unlockGalaxy();
  }, 5000);
}

function galaxySetMapAdminStatus(text, mode){
  if (!galaxyMapAdminStatus) return;
  galaxyMapAdminStatus.textContent = text || '';
  galaxyMapAdminStatus.className = 'galaxy-map-admin-status' + (mode ? ' ' + mode : '');
}
function galaxyUpdateMapAdminVisibility(){
  if (!galaxyMapAdmin) return;
  const can = authLoaded && galaxyCanMapAdmin() && galaxyIsUnlocked();
  galaxyMapAdmin.hidden = !can;
  if (!can) {
    galaxyMapAdminEnabled = false;
    galaxyMap?.classList.remove('admin-editing');
    return;
  }
  renderGalaxyMapAdmin();
}
function galaxyMarkMapDirty(reason){
  galaxyMapAdminDirty = true;
  galaxySetMapAdminStatus(reason || 'есть несохранённые изменения', 'dirty');
  renderGalaxySectorList();
  renderGalaxyPlanetList();
}
function galaxyPointInPolygon(point, polygon){
  let inside = false;
  for (let i=0, j=polygon.length-1; i<polygon.length; j=i++) {
    const xi=polygon[i][0], yi=polygon[i][1], xj=polygon[j][0], yj=polygon[j][1];
    const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj-xi) * (point.y-yi) / ((yj-yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function galaxySectorFromPoint(x,y){
  const point = {x,y};
  const exact = galaxySectorPolygons.find(s => galaxyPointInPolygon(point, s.points));
  if (exact) return exact.id;
  let best = galaxySectorPolygons[0], dist = Infinity;
  galaxySectorPolygons.forEach(s => {
    const c = galaxyPolygonCenter(s.points);
    const d = Math.hypot(c.x-x, c.y-y);
    if (d < dist) { dist = d; best = s; }
  });
  return best?.id || 1;
}
function galaxyWorldPoint(evt){
  const p = galaxySvgPoint(evt);
  const k = galaxyCurrent.k || galaxyTarget.k || 1;
  return { x:(p.x - galaxyCurrent.x) / k, y:(p.y - galaxyCurrent.y) / k };
}
function galaxyClampPlanetPoint(p){
  return { x:Math.max(90, Math.min(1190, p.x)), y:Math.max(60, Math.min(735, p.y)) };
}
function galaxyPlanetPayload(){
  return galaxyPlanets.map(p => ({
    name:String(p.name || '').trim(),
    sector:Number(p.sector) || galaxySectorFromPoint(Number(p.x)||0, Number(p.y)||0),
    region:String(p.region || 'Внешнее Кольцо'),
    control:['republic','cis','neutral'].includes(p.control) ? p.control : 'neutral',
    value:String(p.value || 'Система'),
    x:Math.round((Number(p.x)||0) * 10) / 10,
    y:Math.round((Number(p.y)||0) * 10) / 10,
    desc:String(p.desc || 'Описание системы не задано.')
  })).filter(p => p.name);
}
function galaxyApplyMapPlanets(planets){
  if (!Array.isArray(planets) || !planets.length) return false;
  const clean = planets.map(p => ({
    name:String(p.name || '').trim(),
    sector:Number(p.sector) || galaxySectorFromPoint(Number(p.x)||0, Number(p.y)||0),
    region:String(p.region || 'Внешнее Кольцо'),
    control:['republic','cis','neutral'].includes(p.control) ? p.control : 'neutral',
    value:String(p.value || 'Система'),
    x:Number(p.x) || 640,
    y:Number(p.y) || 410,
    desc:String(p.desc || 'Описание системы не задано.')
  })).filter(p => p.name);
  if (!clean.length) return false;
  const previous = galaxySelected?.name || '';
  galaxyPlanets.length = 0;
  clean.forEach(p => galaxyPlanets.push(p));
  galaxySelected = clean.find(p => p.name === previous) || clean[0];
  return true;
}
async function loadGalaxyMapLayout(force){
  if (galaxyMapLayoutLoaded && !force) return false;
  galaxyMapLayoutLoaded = true;
  try {
    const data = await apiJson('/api/galaxy-map?t=' + Date.now(), { cache:'no-store', credentials:'same-origin' });
    if (data && Array.isArray(data.planets) && data.planets.length && galaxyApplyMapPlanets(data.planets)) {
      galaxyMapAdminDirty = false;
      renderGalaxy();
      renderGalaxyMapAdmin();
      galaxySetMapAdminStatus('карта загружена с сервера', 'ok');
      return true;
    }
  } catch (_) {}
  renderGalaxyMapAdmin();
  return false;
}
async function saveGalaxyMapLayout(){
  if (!galaxyCanMapAdmin()) return galaxySetMapAdminStatus('нет роли для сохранения карты', 'err');
  const planets = galaxyPlanetPayload();
  if (!planets.length) return galaxySetMapAdminStatus('нельзя сохранить пустую карту', 'err');
  galaxySetMapAdminStatus('сохранение карты...', 'loading');
  if (galaxyMapAdminSave) galaxyMapAdminSave.disabled = true;
  try {
    const data = await apiJson('/api/galaxy-map', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body:JSON.stringify({ planets })
    });
    if (!data.ok) throw new Error(data.error || 'save failed');
    galaxyMapAdminDirty = false;
    galaxySetMapAdminStatus(data.savedTo === 'github' ? 'карта сохранена в GitHub' : 'карта сохранена', 'ok');
  } catch (err) {
    galaxySetMapAdminStatus('ошибка сохранения', 'err');
    alert('Не удалось сохранить карту: ' + (err.message || err));
  } finally {
    if (galaxyMapAdminSave) galaxyMapAdminSave.disabled = false;
  }
}
function renderGalaxyMapAdmin(){
  if (!galaxyMapAdmin || galaxyMapAdmin.hidden) return;
  if (galaxyMapAdminToggle) galaxyMapAdminToggle.textContent = galaxyMapAdminEnabled ? 'Выключить редактирование' : 'Включить редактирование';
  galaxyMap?.classList.toggle('admin-editing', galaxyMapAdminEnabled);
  const p = galaxySelected || galaxyPlanets[0];
  if (!p) return;
  if (galaxyMapAdminName) galaxyMapAdminName.value = p.name || '';
  if (galaxyMapAdminControl) galaxyMapAdminControl.value = p.control || 'neutral';
  if (galaxyMapAdminSector) galaxyMapAdminSector.value = String(p.sector || galaxySectorFromPoint(p.x,p.y)).padStart(2,'0');
  if (galaxyMapAdminCoords) galaxyMapAdminCoords.value = `X ${Math.round(p.x)} / Y ${Math.round(p.y)}`;
  if (!galaxyMapAdminDirty) galaxySetMapAdminStatus(galaxyMapAdminEnabled ? 'режим редактирования включён' : 'готово к редактированию', galaxyMapAdminEnabled ? 'loading' : 'ok');
}
function applyGalaxyMapAdminForm(){
  const p = galaxySelected;
  if (!p) return;
  const oldName = p.name;
  const nextName = (galaxyMapAdminName?.value || '').trim();
  if (!nextName) return galaxySetMapAdminStatus('название не может быть пустым', 'err');
  const duplicate = galaxyPlanets.find(x => x !== p && x.name.toLowerCase() === nextName.toLowerCase());
  if (duplicate) return galaxySetMapAdminStatus('планета с таким названием уже есть', 'err');
  p.name = nextName;
  p.control = galaxyMapAdminControl?.value || p.control;
  p.sector = galaxySectorFromPoint(p.x, p.y);
  galaxySelected = p;
  if (oldName !== nextName) galaxyRenameLocalWarRefs(oldName, nextName);
  galaxyMarkMapDirty('планета изменена, не забудьте сохранить карту');
  renderGalaxy();
  galaxyFocusPlanet(p);
}
function deleteGalaxySelectedPlanet(){
  const p = galaxySelected;
  if (!p) return;
  if (!confirm(`Удалить планету ${p.name}? Это также изменит количество планет в секторе ${String(p.sector).padStart(2,'0')}.`)) return;
  const oldName = p.name;
  const idx = galaxyPlanets.indexOf(p);
  if (idx >= 0) galaxyPlanets.splice(idx, 1);
  galaxyRemoveLocalWarRefs(oldName);
  galaxySelected = galaxyPlanets[idx] || galaxyPlanets[idx-1] || galaxyPlanets[0] || null;
  galaxyMarkMapDirty('планета удалена, не забудьте сохранить карту');
  renderGalaxy();
}
function galaxyRenameLocalWarRefs(oldName, nextName){
  try {
    const resultKey = 'eotgGalaxyControlV2';
    const controls = JSON.parse(localStorage.getItem(resultKey) || '{}');
    if (Object.prototype.hasOwnProperty.call(controls, oldName)) { controls[nextName] = controls[oldName]; delete controls[oldName]; localStorage.setItem(resultKey, JSON.stringify(controls)); }
    const cooldownKey = 'eotgGalaxyCooldownV2';
    const cds = JSON.parse(localStorage.getItem(cooldownKey) || '{}');
    if (Object.prototype.hasOwnProperty.call(cds, oldName)) { cds[nextName] = cds[oldName]; delete cds[oldName]; localStorage.setItem(cooldownKey, JSON.stringify(cds)); }
    ['eotgGalaxyWarV3','eotgGalaxyWarV2'].forEach(key => {
      const s = JSON.parse(localStorage.getItem(key) || 'null');
      if (s && s.target === oldName) s.target = nextName;
      if (s && s.origin === oldName) s.origin = nextName;
      if (s) localStorage.setItem(key, JSON.stringify(s));
    });
  } catch (_) {}
}
function galaxyRemoveLocalWarRefs(name){
  try {
    const resultKey = 'eotgGalaxyControlV2';
    const controls = JSON.parse(localStorage.getItem(resultKey) || '{}');
    delete controls[name]; localStorage.setItem(resultKey, JSON.stringify(controls));
    const cooldownKey = 'eotgGalaxyCooldownV2';
    const cds = JSON.parse(localStorage.getItem(cooldownKey) || '{}');
    delete cds[name]; localStorage.setItem(cooldownKey, JSON.stringify(cds));
  } catch (_) {}
}
function startGalaxyPlanetDrag(evt, planet, node){
  if (!galaxyCanMapAdmin() || !galaxyMapAdminEnabled || !planet) return false;
  evt.preventDefault();
  evt.stopPropagation();
  galaxyPlanetDrag = { planet, pointerId:evt.pointerId, moved:false };
  galaxyPointerDown = false;
  galaxyMapShell?.classList.add('dragging-planet');
  galaxyMap?.setPointerCapture?.(evt.pointerId);
  galaxySelected = planet;
  renderGalaxyPanel(planet);
  renderGalaxyPlanetList();
  renderGalaxyMapAdmin();
  return true;
}
function updateGalaxyPlanetDrag(evt){
  if (!galaxyPlanetDrag) return false;
  evt.preventDefault();
  const p = galaxyPlanetDrag.planet;
  const point = galaxyClampPlanetPoint(galaxyWorldPoint(evt));
  p.x = point.x;
  p.y = point.y;
  p.sector = galaxySectorFromPoint(point.x, point.y);
  galaxyPlanetDrag.moved = true;
  galaxySelected = p;
  renderGalaxy();
  galaxyMapShell?.classList.add('dragging-planet');
  galaxyMarkMapDirty('позиция планеты изменена, не забудьте сохранить карту');
  return true;
}
function stopGalaxyPlanetDrag(){
  if (!galaxyPlanetDrag) return;
  const moved = galaxyPlanetDrag.moved;
  galaxyPlanetDrag = null;
  if (moved) {
    galaxySuppressPlanetClick = true;
    setTimeout(() => { galaxySuppressPlanetClick = false; }, 120);
  }
  galaxyMapShell?.classList.remove('dragging-planet');
  renderGalaxyMapAdmin();
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
  renderGalaxyMapAdmin();
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
    group.addEventListener('pointerdown', e => { if (startGalaxyPlanetDrag(e, p, group)) return; e.stopPropagation(); });
    group.addEventListener('click', e => { e.stopPropagation(); if (galaxySuppressPlanetClick) return; galaxyFocusPlanet(p); });
    const orbit = document.createElementNS(ns,'circle'); orbit.setAttribute('cx', p.x); orbit.setAttribute('cy', p.y); orbit.setAttribute('r', '16'); orbit.setAttribute('class','galaxy-planet-orbit');
    const dot = document.createElementNS(ns,'circle'); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', '5.2'); dot.setAttribute('class','galaxy-planet');
    const name = document.createElementNS(ns,'text'); name.setAttribute('x', p.x + 20); name.setAttribute('y', p.y + 6); name.setAttribute('class','galaxy-planet-name'); name.textContent = p.name;
    group.append(orbit,dot,name); galaxyWorld.appendChild(group);
  });
  renderGalaxyPanel(galaxySelected);
  renderGalaxyPlanetList();
  renderGalaxyMapAdmin();
  galaxyCurrent = {...galaxyTarget};
  galaxyApplyTransform();
}
function lockGalaxy(){
  if (!galaxyLock || !galaxyView) return;
  galaxyView.hidden = true;
  galaxyLock.hidden = false;
  galaxyUpdateMapAdminVisibility();
}
function unlockGalaxy(){
  if (!galaxyLock || !galaxyView) return;
  if (!galaxyHasRoleAccess()) {
    sessionStorage.removeItem('eotgGalaxyAccess');
    lockGalaxy();
    updateGalaxyAccessGate(false);
    return;
  }
  galaxyLock.hidden = true;
  galaxyView.hidden = false;
  galaxySetTransform(0, 0, 1);
  renderGalaxy();
  galaxyUpdateMapAdminVisibility();
  loadGalaxyMapLayout(false);
  setTimeout(() => loadGalaxyEventBookings(false), 250);
}
function updateGalaxyAccessGate(autoLoad){
  if (!galaxyLock || !galaxyView) return;
  if (!authLoaded) {
    lockGalaxy();
    galaxySetGate('Проверяем Discord-авторизацию и роли...', 'Проверка доступа...', false);
    return;
  }
  if (!authState.user || authState.hintOnly) {
    sessionStorage.removeItem('eotgGalaxyAccess');
    lockGalaxy();
    galaxySetGate('Доступ к галактической карте открыт только игрокам с Discord-ролями: ' + galaxyAccessRoleMentions + '.', 'Авторизуйтесь через Discord, чтобы подтвердить роль.', true);
    return;
  }
  if (!galaxyHasRoleAccess()) {
    sessionStorage.removeItem('eotgGalaxyAccess');
    lockGalaxy();
    galaxySetGate('У вашего Discord-профиля нет роли для доступа к галактической карте.', 'Нужна одна из ролей: ' + galaxyAccessRoleMentions + '.', false);
    return;
  }
  if (sessionStorage.getItem('eotgGalaxyAccess') === '1') {
    unlockGalaxy();
  } else {
    lockGalaxy();
    galaxySetGate('Доступ подтверждён. Запускаем загрузку галактической карты.', 'Подготовка загрузки...', false);
    if (autoLoad) galaxyBeginLoading();
  }
}
function checkGalaxyAccess(){ updateGalaxyAccessGate(true); }
galaxyAuthButton?.addEventListener('click', () => { location.href = '/api/auth/login'; });

function galaxyEventSetStatus(text, cls){
  if (!galaxyEventStatus) return;
  galaxyEventStatus.textContent = text || '';
  galaxyEventStatus.className = 'galaxy-event-status' + (cls ? ' ' + cls : '');
}
function galaxyEventBookingLabel(b){
  const op = b.operation === 'diplomacy' ? 'Дипломатия' : 'Боевой вылет';
  return `${op}: ${b.planet || 'планета'}${b.threadId ? ' • ветка создана' : ''}`;
}
function galaxyEventDefaultTitle(b){
  if (!b) return 'Оперативный вылет';
  return b.operation === 'diplomacy' ? `Дипломатическая миссия: ${b.planet}` : `Боевой вылет: ${b.planet}`;
}
function galaxyEventDefaultDescription(b){
  if (!b) return '';
  if (b.operation === 'diplomacy') return `Республиканская делегация направляется к системе ${b.planet}. Цель — закрепить влияние ВАР и не допустить вмешательства КНС.`;
  return `Силы ВАР готовят оперативный вылет к системе ${b.planet}. Задача — выполнить приказ командования и удержать инициативу на фронте.`;
}
function renderGalaxyEventCompose(){
  if (!galaxyEventCompose || !galaxyEventBooking) return;
  if (!authState?.user || !galaxyEventBookings.length) {
    galaxyEventCompose.hidden = true;
    return;
  }
  galaxyEventCompose.hidden = false;
  const current = galaxyEventBooking.value;
  galaxyEventBooking.innerHTML = galaxyEventBookings.map(b => `<option value="${String(b.key).replace(/"/g,'&quot;')}">${galaxyEventBookingLabel(b)}</option>`).join('');
  if (current && galaxyEventBookings.some(b => b.key === current)) galaxyEventBooking.value = current;
  const selected = galaxyEventBookings.find(b => b.key === galaxyEventBooking.value) || galaxyEventBookings[0];
  if (selected) {
    if (galaxyEventTitle && !galaxyEventTitle.value.trim()) galaxyEventTitle.value = galaxyEventDefaultTitle(selected);
    if (galaxyEventDescription && !galaxyEventDescription.value.trim()) galaxyEventDescription.value = galaxyEventDefaultDescription(selected);
  }
  galaxyEventSetStatus(`активных броней: ${galaxyEventBookings.length}`, 'ok');
}
async function loadGalaxyEventBookings(force){
  if (!galaxyIsUnlocked() || galaxyEventBookingsLoading) return;
  if (!force && galaxyEventBookings.length) return renderGalaxyEventCompose();
  galaxyEventBookingsLoading = true;
  galaxyEventSetStatus('проверка броней...', 'loading');
  try {
    const data = await apiJson('/api/event-bookings?t=' + Date.now(), { cache:'no-store', credentials:'same-origin' });
    galaxyEventBookings = Array.isArray(data.bookings) ? data.bookings : [];
    renderGalaxyEventCompose();
    if (!galaxyEventBookings.length && galaxyEventCompose) galaxyEventCompose.hidden = true;
  } catch (err) {
    galaxyEventBookings = [];
    if (galaxyEventCompose) galaxyEventCompose.hidden = true;
    galaxyEventSetStatus('не удалось проверить брони', 'err');
  } finally {
    galaxyEventBookingsLoading = false;
  }
}
galaxyEventBooking?.addEventListener('change', () => {
  const selected = galaxyEventBookings.find(b => b.key === galaxyEventBooking.value);
  if (!selected) return;
  if (galaxyEventTitle) galaxyEventTitle.value = galaxyEventDefaultTitle(selected);
  if (galaxyEventDescription) galaxyEventDescription.value = galaxyEventDefaultDescription(selected);
});
galaxyEventReload?.addEventListener('click', () => loadGalaxyEventBookings(true));
galaxyEventForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!galaxyEventForm.reportValidity()) return;
  const submit = galaxyEventForm.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  galaxyEventSetStatus('отправка webhook...', 'loading');
  try {
    const form = new FormData(galaxyEventForm);
    const payload = Object.fromEntries(form.entries());
    payload.bookingKey = galaxyEventBooking?.value || payload.bookingKey || '';
    const data = await apiJson('/api/event-announcement', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(payload)
    });
    if (!data.ok) throw new Error(data.error || 'Webhook error');
    galaxyEventSetStatus('анонс отправлен', 'ok');
  } catch (err) {
    galaxyEventSetStatus('ошибка отправки', 'err');
    alert('Не удалось отправить анонс: ' + (err.message || err));
  } finally {
    if (submit) submit.disabled = false;
  }
});

galaxyMapAdminToggle?.addEventListener('click', () => {
  if (!galaxyCanMapAdmin()) return galaxySetMapAdminStatus('нет роли ивентолога для редактирования', 'err');
  galaxyMapAdminEnabled = !galaxyMapAdminEnabled;
  galaxyMap?.classList.toggle('admin-editing', galaxyMapAdminEnabled);
  renderGalaxyMapAdmin();
});
galaxyMapAdminSave?.addEventListener('click', saveGalaxyMapLayout);
galaxyMapAdminReload?.addEventListener('click', async () => {
  galaxyMapLayoutLoaded = false;
  await loadGalaxyMapLayout(true);
  renderGalaxy();
});
galaxyMapAdminForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  applyGalaxyMapAdminForm();
});
galaxyMapAdminControl?.addEventListener('change', () => {
  if (!galaxySelected) return;
  galaxySelected.control = galaxyMapAdminControl.value || 'neutral';
  galaxyMarkMapDirty('статус планеты изменён, не забудьте сохранить карту');
  renderGalaxy();
});
galaxyMapAdminDelete?.addEventListener('click', deleteGalaxySelectedPlanet);
galaxyFilters.forEach(btn => btn.addEventListener('click', () => { galaxyFilters.forEach(b => b.classList.remove('active')); btn.classList.add('active'); galaxyFilter = btn.dataset.filter || 'all'; renderGalaxy(); }));
galaxyRegionFilter?.addEventListener('change', () => { galaxyRegion = galaxyRegionFilter.value || 'all'; renderGalaxy(); });
galaxySearch?.addEventListener('input', () => { galaxyQuery = galaxySearch.value.trim().toLowerCase(); renderGalaxy(); });
document.getElementById('galaxyZoomIn')?.addEventListener('click', () => galaxyZoomAt(null, 1.22));
document.getElementById('galaxyZoomOut')?.addEventListener('click', () => galaxyZoomAt(null, .82));
document.getElementById('galaxyReset')?.addEventListener('click', () => galaxySetTransform(0, 0, 1));
galaxyMap?.addEventListener('wheel', e => { e.preventDefault(); galaxyZoomAt(e, e.deltaY < 0 ? 1.16 : .86); }, {passive:false});
galaxyMap?.addEventListener('pointerdown', e => { if (galaxyPlanetDrag) return; galaxyPointerDown = true; galaxyDidDrag = false; galaxyStart = {x:e.clientX, y:e.clientY, tx:galaxyTarget.x, ty:galaxyTarget.y}; galaxyMap.setPointerCapture?.(e.pointerId); galaxyMapShell?.classList.add('dragging'); });
galaxyMap?.addEventListener('pointermove', e => {
  const world = galaxyWorldPoint(e);
  if (galaxyCoords) galaxyCoords.textContent = `SECTOR: ${galaxySelected ? String(galaxySelected.sector).padStart(2,'0') : '--'} // GRID: X ${Math.round(world.x)} Y ${Math.round(world.y)}`;
  if (updateGalaxyPlanetDrag(e)) return;
  if (!galaxyPointerDown) return;
  const rect = galaxyMap.getBoundingClientRect();
  const sx = 1280 / rect.width, sy = 820 / rect.height;
  const dx = (e.clientX - galaxyStart.x) * sx;
  const dy = (e.clientY - galaxyStart.y) * sy;
  if (Math.abs(dx)+Math.abs(dy) > 3) galaxyDidDrag = true;
  galaxySetTransform(galaxyStart.tx + dx, galaxyStart.ty + dy, galaxyTarget.k, true);
});
['pointerup','pointercancel','pointerleave'].forEach(ev => galaxyMap?.addEventListener(ev, e => { stopGalaxyPlanetDrag(); galaxyPointerDown = false; galaxyMapShell?.classList.remove('dragging'); }));
['pointerup','pointercancel','blur'].forEach(ev => window.addEventListener(ev, () => { stopGalaxyPlanetDrag(); galaxyPointerDown = false; galaxyMapShell?.classList.remove('dragging'); }, {passive:true}));
window.addEventListener('eotg:auth-updated', updateRoleGatedNavigation);
window.addEventListener('DOMContentLoaded', updateRoleGatedNavigation);
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
    music:'assets/sounds/galaxy-battle.mp3'
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
  function operationType(s){
    return s && (s.operation === 'diplomacy' || s.type === 'diplomacy' || s.kind === 'diplomacy') ? 'diplomacy' : 'battle';
  }
  function operationLabel(s){
    return operationType(s) === 'diplomacy' ? 'дипломатическая миссия' : 'боевой вылет';
  }
  function planetMeta(name){
    const p = galaxyPlanets.find(x => x.name === name) || {};
    return { target:name || p.name || '', sector:p.sector || '', region:p.region || '', control:p.control || '' };
  }
  function notifyMapLog(event, data){
    try {
      fetch('/api/galaxy-log', {
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ event, data })
      }).catch(()=>{});
    } catch(_) {}
  }
  function normalizeState(s){
    if (!s || !s.target) return null;
    s.status = normalizeStatus(s.status);
    s.operation = operationType(s);
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
      if(operationType(s)==='diplomacy'){
        s.status='awaiting_admin';
        s.awaitingAdminAt=now;
        s.lastTick=now;
        s.log=[`Дипломатическая миссия прибыла к планете ${s.target}. Ожидается решение администратора: победа ВАР или КНС.`];
      } else {
        s.status='battle';
        s.battleAt=now;
        s.lastTick=now;
        s.log=['Флот прибыл к планете. Начинается орбитальное сражение.'];
      }
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
  function randomBattleWinner(s){
    const republicPower = (s.republic || []).reduce((sum,x)=>sum + Math.max(0, Number(x.hp) || 0), 0);
    const cisPower = (s.cis || []).reduce((sum,x)=>sum + Math.max(0, Number(x.hp) || 0), 0);
    const total = Math.max(1, republicPower + cisPower);
    const republicChance = Math.max(.35, Math.min(.65, republicPower / total));
    return Math.random() < republicChance ? 'republic' : 'cis';
  }
  function resolveFleetBattle(s, early){
    const result=randomBattleWinner(s);
    s.status='awaiting_admin';
    s.awaitingAdminAt=Date.now();
    s.fleetBattleResult=result;
    s.fleetBattleEndedEarly=Boolean(early);
    s.log=[result==='republic'
      ? `Битва флота у планеты ${s.target} завершена${early ? ' досрочно' : ''}. Рандомный исход: победили Venator. Ожидается решение администратора по боевому вылету.`
      : `Битва флота у планеты ${s.target} завершена${early ? ' досрочно' : ''}. Рандомный исход: победили силы КНС. Ожидается решение администратора по боевому вылету.`];
    s.republic.forEach(x=>{ x.hp=Math.max(result==='republic' ? 18 : 5, x.hp); });
    s.cis.forEach(x=>{ x.hp=Math.max(result==='cis' ? 18 : 0, Math.min(x.hp, result==='cis' ? 100 : 20)); });
    stopMusic();
    if(!s.fleetBattleLogSent){
      s.fleetBattleLogSent=true;
      notifyMapLog('fleet_battle_result', { ...planetMeta(s.target), winner:result, early:Boolean(early), operation:operationType(s) });
    }
  }
  function waitForAdminDecision(s){
    resolveFleetBattle(s, false);
  }
  function finishBattleEarlyRandom(){
    const s=state();
    if(!s || s.status!=='battle' || operationType(s)==='diplomacy') return;
    if(!authState || !authState.canEdit){
      alert('Закончить битву флота досрочно может только администратор с нужной Discord-ролью.');
      return;
    }
    if(!confirm('Закончить битву флота досрочно? Победитель битвы флота будет определён случайно, затем боевой вылет перейдёт к решению администратора.')) return;
    resolveFleetBattle(s, true);
    save(s);
    renderGalaxy();
    galaxyFocusPlanet(galaxyPlanets.find(p=>p.name===s.target) || galaxySelected);
  }
  function finishByAdmin(winner){
    const s=state();
    if(!s || s.status!=='awaiting_admin') return;
    if(!authState || !authState.canEdit){
      alert('Завершить боевой вылет может только администратор с нужной Discord-ролью. Авторизуйтесь через Discord.');
      return;
    }
    const result = winner === 'republic' ? 'republic' : 'cis';
    const previousControl = (galaxyPlanets.find(p=>p.name===s.target) || {}).control || planetMeta(s.target).control || '';
    const r=controls();
    r[s.target]=result;
    setControls(r);
    s.status='finished';
    s.result=result;
    s.finishedAt=Date.now();
    s.adminEndedBy=authState.user?.global_name || authState.user?.username || authState.user?.id || 'Администратор';
    const opText = operationType(s)==='diplomacy' ? 'дипломатическую миссию' : 'боевой вылет';
    s.log=[result==='republic'
      ? `Администратор завершил ${opText}: победа ВАР. Планета ${s.target} перешла под контроль Республики.`
      : `Администратор завершил ${opText}: победа КНС. Планета ${s.target} перешла под контроль КНС.`];
    save(s);
    notifyMapLog('operation_final_result', { ...planetMeta(s.target), previousControl, result, operation:operationType(s) });
    applyControls();
    stopMusic();
    renderGalaxy();
    galaxyFocusPlanet(galaxyPlanets.find(p=>p.name===s.target) || galaxySelected);
  }
  function launch(target){
    if(!target || target.control!=='cis') return;
    const active=state();
    if(isActiveState(active)){
      alert(`Уже активна операция: ${operationLabel(active)} к планете ${active.target}. Новый флот можно отправить только после решения администратора.`);
      return;
    }
    if(!canLaunch(target.name)) return;
    const origin=nearestRepublic(target); if(!origin) return;
    const now=Date.now(), cd=cooldowns(); cd[target.name]=now; write(cooldownKey,cd);
    save({
      operation:'battle',
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
    notifyMapLog('fleet_launch', { ...planetMeta(target.name), origin:origin.name, etaMs:travelMs });
    renderGalaxy(); galaxyFocusPlanet(target); startTimer();
  }
  function launchDiplomacy(target){
    if(!target || target.control!=='neutral') return;
    const active=state();
    if(isActiveState(active)){
      alert(`Уже активна операция: ${operationLabel(active)} к планете ${active.target}. Новую миссию можно начать только после решения администратора.`);
      return;
    }
    if(!canLaunch(target.name)) return;
    const origin=nearestRepublic(target); if(!origin) return;
    const now=Date.now(), cd=cooldowns(); cd[target.name]=now; write(cooldownKey,cd);
    save({
      operation:'diplomacy',
      target:target.name,
      origin:origin.name,
      startedAt:now,
      arrivalAt:now+travelMs,
      status:'travel',
      lastTick:now,
      republic:ships('r'),
      cis:[],
      log:['Дипломатическая миссия начата. Флот Venator направлен к нейтральной планете.']
    });
    notifyMapLog('diplomacy_launch', { ...planetMeta(target.name), origin:origin.name, etaMs:travelMs });
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
      const label = active ? 'Уже активна операция' : (!cooldownReady ? 'Захват доступен раз в день' : 'Выслать флот для захвата');
      const notice = active
        ? `<p class="galaxy-war-warning">Сейчас активна операция: <b>${operationLabel(s)}</b> к планете <b>${s.target}</b>. Можно отправить только один флот.</p>`
        : `<p>Система удерживается КНС. Можно направить ударную группу Venator для захвата и организации боевого вылета.</p>`;
      box.innerHTML = `<p class="eyebrow">Флотская операция</p>${notice}<button class="galaxy-fleet-button galaxy-launch-btn" ${disabled?'disabled':''}>${label}</button>`;
      box.querySelector('button')?.addEventListener('click',()=>launch(planet));
    } else if(planet.control==='neutral'){
      const cooldownReady = canLaunch(planet.name) || active;
      const disabled = active || !cooldownReady;
      const label = active ? 'Уже активна операция' : (!cooldownReady ? 'Миссия доступна раз в день' : 'Начать дипломатическую миссию');
      const notice = active
        ? `<p class="galaxy-war-warning">Сейчас активна операция: <b>${operationLabel(s)}</b> к планете <b>${s.target}</b>. Новую миссию можно начать только после решения администратора.</p>`
        : `<p>Планета сохраняет нейтралитет. Можно направить дипломатическую миссию Venator; после прибытия администратор выберет исход — ВАР или КНС.</p>`;
      box.innerHTML = `<p class="eyebrow">Дипломатическая операция</p>${notice}<button class="galaxy-fleet-button galaxy-launch-btn" ${disabled?'disabled':''}>${label}</button>`;
      box.querySelector('button')?.addEventListener('click',()=>launchDiplomacy(planet));
    } else {
      box.innerHTML = `<p class="eyebrow">Флотская операция</p><p>Захват или дипломатическая миссия доступны только для планет КНС или нейтральных планет.</p>`;
    }
    const last=s&&s.target===planet.name&&s.status==='finished'?`<div class="galaxy-result-card ${s.result==='cis'?'defeat':''}">${s.log?.[0]||'Результат боя сохранён.'}</div>`:'';
    box.insertAdjacentHTML('beforeend', last);
    galaxyPanel.insertBefore(box, document.getElementById('galaxySectorList'));
    bindAdminControls(box);
  };
  function statusHtml(s){
    const diplomacy = operationType(s)==='diplomacy';
    if(s.status==='travel'){
      const pct=Math.min(100,(Date.now()-s.startedAt)/(s.arrivalAt-s.startedAt)*100);
      const text = diplomacy
        ? `Дипломатическая миссия Venator в пути из системы <b>${s.origin}</b>.`
        : `Флот Venator в пути из системы <b>${s.origin}</b>.`;
      return `<p>${text}</p><div class="galaxy-war-progress"><i style="width:${pct}%"></i></div><p class="galaxy-war-time">До прибытия: ${fmt(s.arrivalAt-Date.now())}</p>`;
    }
    if(s.status==='battle'){
      const left=fmt((s.battleAt||Date.now())+battleDurationMs-Date.now());
      const admin = authState && authState.canEdit;
      const early = admin ? '<div class="galaxy-admin-finish"><button type="button" class="galaxy-fleet-button galaxy-early-finish">Закончить битву флота досрочно</button><p class="galaxy-war-warning">Победитель будет определён рандомно.</p></div>' : '';
      return `<p>У орбиты идёт сражение. Мунифиценты КНС появляются только у этой планеты и ведут бой с Venator.</p><p class="galaxy-war-time">До решения исхода боя: ${left}</p>${hpHtml(s)}${early}`;
    }
    if(s.status==='awaiting_admin'){
      const admin = authState && authState.canEdit;
      if(diplomacy){
        return `<p>Дипломатическая миссия прибыла. Venator удерживают орбиту без боя, пока администратор не выберет итог миссии.</p>${admin ? adminHtml(s) : '<p class="galaxy-war-warning">Ожидается администратор с Discord-ролью для завершения дипломатической миссии.</p>'}`;
      }
      const fleetResult = s.fleetBattleResult ? `<p class="galaxy-war-warning">Итог битвы флота: <b>${s.fleetBattleResult==='republic' ? 'победили Venator' : 'победили силы КНС'}</b>. Финальный статус планеты всё ещё выбирает администратор.</p>` : '';
      return `<p>Бой флота завершён. Планета пока остаётся во вражеском статусе, а Venator удерживают орбиту до решения администратора.</p>${fleetResult}${hpHtml(s)}${admin ? adminHtml(s) : '<p class="galaxy-war-warning">Ожидается администратор с Discord-ролью для завершения боевого вылета.</p>'}`;
    }
    return `${s.log?.[0]||'Операция завершена.'}${diplomacy ? '' : hpHtml(s)}`;
  }
  function hpHtml(s){
    const row=(t,a,c)=>`<div class="galaxy-hp-row ${c}"><b>${t}</b>${a.map(x=>`<span><i style="width:${Math.round(x.hp)}%"></i><em>${Math.round(x.hp)}%</em></span>`).join('')}</div>`;
    return `<div class="galaxy-hp-grid">${row('Venator',s.republic,'rep')}${row('Мунифиценты КНС',s.cis,'cis')}</div>`;
  }
  function adminHtml(s){
    const diplomacy = operationType(s)==='diplomacy';
    return `<div class="galaxy-admin-finish"><button type="button" class="galaxy-fleet-button galaxy-admin-open">${diplomacy ? 'Закончить дипломатическую миссию' : 'Закончить боевой вылет'}</button><div class="galaxy-admin-choices" hidden><p>${diplomacy ? 'Выберите итог дипломатической миссии:' : 'Выберите итог боя:'}</p><button type="button" data-war-result="republic">${diplomacy ? 'Победа ВАР' : 'Победили силы ВАР'}</button><button type="button" data-war-result="cis">${diplomacy ? 'Победа КНС' : 'Победили силы КНС'}</button></div></div>`;
  }
  function bindAdminControls(root){
    const open=root.querySelector('.galaxy-admin-open');
    const choices=root.querySelector('.galaxy-admin-choices');
    open?.addEventListener('click',()=>{ if(choices) choices.hidden = !choices.hidden; });
    root.querySelector('.galaxy-early-finish')?.addEventListener('click',()=>finishBattleEarlyRandom());
    root.querySelectorAll('[data-war-result]').forEach(btn=>btn.addEventListener('click',()=>{
      const result=btn.getAttribute('data-war-result');
      const s=state();
      const diplomacy=operationType(s)==='diplomacy';
      const text=result==='republic'
        ? (diplomacy ? 'Подтвердить дипломатическую победу ВАР? Планета станет республиканской.' : 'Подтвердить победу ВАР? Планета станет республиканской.')
        : (diplomacy ? 'Подтвердить дипломатическую победу КНС? Планета станет вражеской.' : 'Подтвердить победу КНС? Планета останется вражеской.');
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
  function isBattleIntroReady(s){ return true; }
  function battleVideoKey(s){ return ''; }
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
      startMusic();
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
      label.setAttribute('x',target.x+46); label.setAttribute('y',target.y-38); label.setAttribute('class','galaxy-fleet-label'); label.textContent=operationType(s)==='diplomacy' ? 'Дипломатическая миссия: ждёт решения' : 'Ожидает решения администратора'; layer.appendChild(label);
    }
  }
  function startMusic(){ if(music&&!music.paused)return; try{ music=music||new Audio(assets.music); music.loop=true; music.volume=.34; music.play().catch(()=>{}); }catch(e){} }
  function stopMusic(){ if(music){ music.pause(); music.currentTime=0; } }
  function playVideo(s){ return; }
  function maybeVideo(){ return; }
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
  window.addEventListener('eotg:auth-updated',()=>{ if(location.hash==='#galaxy') { checkGalaxyAccess(); galaxyUpdateMapAdminVisibility(); if(galaxyIsUnlocked()) { renderGalaxyPanel(galaxySelected); renderGalaxyMapAdmin(); renderShips(); loadGalaxyEventBookings(true); loadGalaxyMapLayout(false); } } });
})();

