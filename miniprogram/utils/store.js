/**
 * 本地数据层：春节 15 天版本
 * 所有数据先落在 wx.setStorageSync，后续接后端时只需换掉 utils/api.js 里的实现，
 * 页面层不用动。
 */

const KEY = 'jiefu_mp_v1';

/* 12 张年俗福卡：rare 0 普通 / 1 稀有 / 2 传说 */
const CARDS = [
  { id: 'c01', ch: '联', name: '贴春联', rare: 0 },
  { id: 'c02', ch: '岁', name: '守岁', rare: 0 },
  { id: 'c03', ch: '福', name: '接福', rare: 0 },
  { id: 'c04', ch: '拜', name: '拜年', rare: 0 },
  { id: 'c05', ch: '钱', name: '压岁钱', rare: 1 },
  { id: 'c06', ch: '饭', name: '年夜饭', rare: 0 },
  { id: 'c07', ch: '尘', name: '扫尘', rare: 0 },
  { id: 'c08', ch: '剪', name: '剪纸', rare: 0 },
  { id: 'c09', ch: '谜', name: '猜灯谜', rare: 1 },
  { id: 'c10', ch: '龙', name: '舞龙灯', rare: 1 },
  { id: 'c11', ch: '灶', name: '祭灶', rare: 0 },
  { id: 'c12', ch: '宵', name: '闹元宵', rare: 2 }
];

/* 每日一答：题目按日期轮换，答错可重来，答对当天落印得卡 */
const QUIZ = [
  { q: '春节贴的“福”字为什么常常倒着贴？', opts: ['为了贴得省事', '取“福到了”的谐音', '让字更醒目'], a: 1, tip: '“倒”与“到”同音，取“福到临门”的彩头。' },
  { q: '传说中“年”是一只什么？', opts: ['守岁的老人', '怕红色和响声的怪兽', '送财的神仙'], a: 1, tip: '年兽怕红、怕火、怕响，所以有了红纸、鞭炮和灯火。' },
  { q: '压岁钱最早压的是什么？', opts: ['“祟”，一种小妖', '一年的收成', '长辈的祝福信'], a: 0, tip: '压岁钱原作“压祟钱”，本意是给孩子压住邪祟。' },
  { q: '年夜饭上必有鱼，取的是哪个彩头？', opts: ['年年有余', '鱼米之乡', '如鱼得水'], a: 0, tip: '鱼与“余”同音，图的是年年有余。' },
  { q: '2027 年是十二生肖里的哪一年？', opts: ['马年', '羊年', '猴年'], a: 1, tip: '丁未年，属羊，所以今年叫羊年。' },
  { q: '“腊月二十四，掸尘扫房子”说的是哪件事？', opts: ['扫尘', '祭灶', '守岁'], a: 0, tip: '扫尘谐音“扫陈”，把一年的旧尘旧事都扫出去。' },
  { q: '元宵节还有一个名字叫什么？', opts: ['上元节', '中元节', '下元节'], a: 0, tip: '正月十五为上元节，赏灯吃元宵都在这一天。' },
  { q: '春联的上联应该贴在门的哪一边？', opts: ['面对门的右边', '面对门的左边', '随便贴'], a: 0, tip: '上联在右，下联在左，横批从右往左读。' },
  { q: '“过了腊八就是年”，腊八要喝什么？', opts: ['腊八粥', '屠苏酒', '桂花酿'], a: 0, tip: '腊八粥用八样粮食熬成，寓意五谷丰登。' },
  { q: '拜年时行的拱手礼，男子怎么抱手？', opts: ['左手抱右手', '右手抱左手', '双手合十'], a: 0, tip: '男左女右：男子左手在外，女子右手在外。' }
];

/* 榜单演示数据（后端接上后由接口返回） */
const CLASS_ROWS = [
  { name: '王小雨', score: 1820, me: false },
  { name: '李念', score: 1740, me: false },
  { name: '陈子昂', score: 1610, me: false },
  { name: '我', score: 0, me: true },
  { name: '周乐言', score: 980, me: false },
  { name: '何一诺', score: 860, me: false },
  { name: '赵小满', score: 640, me: false }
];
const FAMILY_ROWS = [
  { name: '二舅', score: 3240, me: false },
  { name: '三姑', score: 2870, me: false },
  { name: '表哥', score: 2610, me: false },
  { name: '我妈', score: 2340, me: false },
  { name: '我', score: 0, me: true }
];

const FEED_COST = 20;
const LEVEL_NAMES = ['初生', '认人', '会拜年', '会鞠躬', '会转圈', '穿新衣'];

let state = null;

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function dayNum(s) {
  const p = s.split('-');
  return Math.floor(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) / 86400000);
}

function defaults() {
  return {
    cards: [],
    dup: {},
    fqi: 0,
    best: 0,
    quizDate: '',
    streak: { n: 0, last: '' },
    sheep: { totalTouch: 0, totalFeed: 0, lastTouch: '', lastFeed: '' },
    board: { classRows: CLASS_ROWS.slice(), familyRows: FAMILY_ROWS.slice() }
  };
}

function init() {
  let raw = null;
  try {
    raw = wx.getStorageSync(KEY);
  } catch (e) {
    raw = null;
  }
  if (raw && raw.cards) {
    state = raw;
  } else {
    state = defaults();
    save();
  }
  return state;
}

function get() {
  if (!state) init();
  return state;
}

function save() {
  try {
    wx.setStorageSync(KEY, state);
  } catch (e) {
    // 存储失败不影响当前这一局
  }
}

/* ---------- 福气 ---------- */
function addFqi(n) {
  get();
  state.fqi += n;
  if (state.fqi < 0) state.fqi = 0;
  save();
  return state.fqi;
}

/* ---------- 卡册 ---------- */
function hasCard(id) {
  return get().cards.indexOf(id) >= 0;
}

function addCard(id) {
  get();
  if (hasCard(id)) {
    state.dup[id] = (state.dup[id] || 0) + 1;
    save();
    return { isNew: false, dup: state.dup[id] };
  }
  state.cards.push(id);
  save();
  return { isNew: true, dup: 0 };
}

function cardView() {
  get();
  const list = CARDS.map(function (c) {
    return {
      id: c.id,
      ch: c.ch,
      name: c.name,
      rare: c.rare,
      got: state.cards.indexOf(c.id) >= 0,
      dup: state.dup[c.id] || 0
    };
  });
  return {
    list: list,
    gotCount: state.cards.length,
    total: CARDS.length
  };
}

/* 按稀有度抽一张：普通 70% / 稀有 25% / 传说 5% */
function pickCardByRarity() {
  const roll = Math.random();
  let target = 0;
  if (roll > 0.95) target = 2;
  else if (roll > 0.70) target = 1;
  const pool = CARDS.filter(function (c) { return c.rare === target; });
  const fallback = CARDS.filter(function (c) { return c.rare === 0; });
  const use = pool.length ? pool : fallback;
  return use[Math.floor(Math.random() * use.length)];
}

/* 优先抽还没集到的卡，集齐后才出重复卡 */
function pickCardForUser() {
  get();
  const missing = CARDS.filter(function (c) { return state.cards.indexOf(c.id) < 0; });
  if (!missing.length) return pickCardByRarity();
  const notRare = missing.filter(function (c) { return c.rare === 0; });
  const pool = notRare.length ? notRare : missing;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------- 每日一答 ---------- */
function todayQuiz() {
  get();
  const idx = Math.abs(dayNum(todayStr())) % QUIZ.length;
  return {
    q: QUIZ[idx].q,
    opts: QUIZ[idx].opts,
    a: QUIZ[idx].a,
    tip: QUIZ[idx].tip,
    done: state.quizDate === todayStr()
  };
}

function answerQuiz(pick) {
  const quiz = todayQuiz();
  if (quiz.done) return { ok: false, msg: '今天已经答过了，明天再来' };
  if (pick !== quiz.a) return { ok: false, wrong: true, msg: '再想想，答案藏在年俗里' };
  const card = pickCardForUser();
  const res = addCard(card.id);
  state.quizDate = todayStr();
  save();
  return { ok: true, card: card, isNew: res.isNew, dup: res.dup, tip: quiz.tip };
}

/* ---------- 小羊 ---------- */
function sheepView() {
  get();
  const s = state.sheep;
  const level = Math.min(LEVEL_NAMES.length, 1 + Math.floor(s.totalFeed / 2));
  const today = todayStr();
  const tips = [
    '它还在打量你，先摸摸头吧',
    '它记住你的手了',
    '它学会给你拜年了',
    '它一见你就鞠躬',
    '它会围着你转圈',
    '它穿上了你给它换的新衣'
  ];
  const gapFeed = s.lastFeed ? dayNum(today) - dayNum(s.lastFeed) : 99;
  return {
    level: level,
    levelName: LEVEL_NAMES[level - 1],
    tip: tips[level - 1],
    canTouch: s.lastTouch !== today,
    canFeed: s.lastFeed !== today && state.fqi >= FEED_COST,
    fqi: state.fqi,
    feedCost: FEED_COST,
    mood: gapFeed >= 2 ? 'hungry' : (s.lastFeed === today ? 'happy' : 'normal'),
    totalTouch: s.totalTouch,
    totalFeed: s.totalFeed,
    streak: state.streak.n
  };
}

function touchSheep() {
  get();
  const today = todayStr();
  if (state.sheep.lastTouch === today) {
    return { ok: false, msg: '今天已经摸过了，明天再来' };
  }
  state.sheep.lastTouch = today;
  state.sheep.totalTouch += 1;
  state.fqi += 1;
  save();
  return { ok: true, fqi: state.fqi };
}

function feedSheep() {
  get();
  const today = todayStr();
  if (state.sheep.lastFeed === today) {
    return { ok: false, msg: '今天已经喂过了' };
  }
  if (state.fqi < FEED_COST) {
    return { ok: false, msg: '福气不够，去接福攒一点回来' };
  }
  state.fqi -= FEED_COST;
  state.sheep.lastFeed = today;
  state.sheep.totalFeed += 1;
  save();
  const v = sheepView();
  return { ok: true, fqi: state.fqi, level: v.level, levelName: v.levelName };
}

/* ---------- 连续天数 ---------- */
function checkStreak() {
  get();
  const today = todayStr();
  const last = state.streak.last;
  if (last === today) return state.streak.n;
  if (last && dayNum(today) - dayNum(last) === 1) {
    state.streak.n += 1;
  } else {
    state.streak.n = 1;
  }
  state.streak.last = today;
  save();
  return state.streak.n;
}

/* ---------- 分数与榜单 ---------- */
function submitScore(score) {
  get();
  if (score > state.best) state.best = score;
  const rows = state.board.classRows;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].me) rows[i].score = state.best;
  }
  const frows = state.board.familyRows;
  for (let i = 0; i < frows.length; i++) {
    if (frows[i].me) frows[i].score = state.best;
  }
  save();
  return state.best;
}

function boardView(type) {
  get();
  const rows = (type === 'family' ? state.board.familyRows : state.board.classRows).slice();
  rows.sort(function (a, b) { return b.score - a.score; });
  let myRank = 0;
  for (let i = 0; i < rows.length; i++) {
    rows[i].rank = i + 1;
    if (rows[i].me) myRank = i + 1;
  }
  return { rows: rows, myRank: myRank, total: rows.length };
}

module.exports = {
  init: init,
  get: get,
  addFqi: addFqi,
  cardView: cardView,
  addCard: addCard,
  pickCardForUser: pickCardForUser,
  todayQuiz: todayQuiz,
  answerQuiz: answerQuiz,
  sheepView: sheepView,
  touchSheep: touchSheep,
  feedSheep: feedSheep,
  checkStreak: checkStreak,
  submitScore: submitScore,
  boardView: boardView,
  todayStr: todayStr
};
