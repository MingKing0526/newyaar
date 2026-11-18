/**
 * 金羊出圈 · 一天三十关（推箱子内核）
 * 规则 = 经典 Sokoban：金羊只能推、不能拉，一次只推一格，羊后面是墙/边/另一只羊就推不动
 * 目标：把每只羊都推进羊圈，门才开；金羊走进门 = 过关
 * 推错一步羊卡进墙角，这一局就废了 —— 难度来自死锁，不是来自步数
 * 一天 6 组 × 5 档 = 30 关，走完一组为省份 +1 支烟花
 * 每个设备按唯一 ID 哈希取关，重开还是同一盘
 */
const store = require('../../utils/store');
const { POOL } = require('../../data/levels');

const DV = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const PROV = '广东';
const DAY_FW = 3;         // 演示：广东当夜已有的烟花数
const WOLF_EVERY = 6;     // 第五档：狼每走 6 步逼近金羊一格
const TIERS = 5;          // 每组五档
const ROUNDS = 6;         // 一天六组
const TOTAL = TIERS * ROUNDS;   // 一天 30 关
const SLACK = [4, 3, 3, 2, 2];  // 各档在最少步数上多给的余量
const UNDO_FREE = 3;      // 每关免费悔步次数

function boardOf(n) {
  if (n >= 9) return 660;
  if (n >= 8) return 620;
  return 580;
}

/* 选关：设备唯一 ID + 组号 + 档位 → 哈希 → 池内某一关 */
function loadUid() {
  let uid = wx.getStorageSync('jy_uid');
  if (!uid) {
    uid = 'g' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
    wx.setStorageSync('jy_uid', uid);
  }
  return uid;
}
function h32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
function pickLevels(uid) {
  const pools = POOL.filter((a) => a && a.length);
  const tierOf = (t) => pools[t] || pools[pools.length - 1];
  let saved = wx.getStorageSync('jy_pick_v4');
  if (!saved || !saved.uid || saved.uid !== uid || !saved.picks || saved.picks.length !== TOTAL) {
    const picks = [];
    for (let r = 0; r < ROUNDS; r++) {
      for (let t = 0; t < TIERS; t++) {
        picks.push(h32(uid + '#r' + r + 't' + t) % tierOf(t).length);
      }
    }
    saved = { uid: uid, picks: picks };
    wx.setStorageSync('jy_pick_v4', saved);
  }
  const out = [];
  for (let r = 0; r < ROUNDS; r++) {
    for (let t = 0; t < TIERS; t++) {
      const arr = tierOf(t);
      const L = arr[saved.picks[r * TIERS + t] % arr.length];
      out.push({
        name: L.nm,
        n: L.n,
        gate: L.g,
        min: L.m,
        budget: L.m + SLACK[t],
        gold: L.c,
        rocks: L.r,
        sheep: L.s,
        goals: L.goal,
        wolf: L.w || null,
        tier: t
      });
    }
  }
  return out;
}

Page({
  data: {
    view: 'play',
    idx: 1,
    total: TOTAL,
    round: 1,
    rounds: ROUNDS,
    name: '',
    min: 0,
    used: 0,
    budget: 0,
    low: false,
    dots: [],
    board: 580,
    cell: 0,
    rocks: [],
    sheep: [],
    goals: [],
    filled: 0,
    need: 0,
    gold: { l: 0, t: 0, s: 0 },
    gateBox: { l: 0, t: 0, s: 0 },
    gateOpen: false,
    bumpK: -1,
    goldBump: false,
    hunter: null,
    hasWolf: false,
    wolf: null,
    card: '',
    cardTitle: '',
    cardBody: '',
    cardSteps: '',
    adUsed: false,
    undoLeft: UNDO_FREE,
    penName: PROV,
    fw: DAY_FW,
    fwShow: DAY_FW,
    flock: [],
    sparks: [],
    boom: false,
    uidTag: ''
  },

  onLoad() {
    const uid = loadUid();
    this.LEVELS = pickLevels(uid);
    this.setData({ uidTag: uid.slice(-4).toUpperCase() });
    this.loadLevel(0);
  },

  onShareAppMessage() {
    return {
      title: '羊年三十关，我把金羊赶出羊圈了，你试试',
      path: '/pages/game/game'
    };
  },

  /* ============ 关卡 ============ */
  loadLevel(i) {
    const L = this.LEVELS[i];
    const n = L.n;
    const B = boardOf(n);
    const cell = B / n;
    const pad = (v) => v * cell;

    this.idx = i;
    this.N = n;
    this.GATE = L.gate;
    this.gold = { r: L.gold[0], c: L.gold[1] };
    this.rocks = L.rocks.map((rc) => ({ r: rc[0], c: rc[1] }));
    this.goals = L.goals.map((rc) => ({ r: rc[0], c: rc[1] }));
    this.sheep = L.sheep.map((s, k) => ({ r: s[0], c: s[1], k: k }));
    this.used = 0;
    this.budget = L.budget;
    this.adUsed = false;
    this.undoLeft = UNDO_FREE;
    this.hist = [];
    this.mode = 'play';
    this.hunter = L.wolf ? { r: L.wolf[0], c: L.wolf[1] } : null;

    this.setData({
      view: 'play',
      idx: i + 1,
      total: TOTAL,
      round: Math.floor(i / TIERS) + 1,
      rounds: ROUNDS,
      name: L.name,
      min: L.min,
      budget: this.budget,
      used: 0,
      low: false,
      cell: cell,
      board: B,
      rocks: this.rocks.map((o, k) => ({ k: k, l: pad(o.c), t: pad(o.r), s: cell })),
      goals: this.goals.map((o, k) => ({ k: k, l: pad(o.c), t: pad(o.r), s: cell })),
      filled: this.countFilled(),
      need: this.goals.length,
      gateBox: { l: pad(this.GATE[1]), t: pad(this.GATE[0]), s: cell },
      gateOpen: this.countFilled() === this.goals.length,
      wolf: null,
      hunter: this.hunter ? { l: this.hunter.c * cell, t: this.hunter.r * cell, s: cell } : null,
      hasWolf: !!this.hunter,
      undoLeft: this.undoLeft,
      card: '',
      boom: false,
      sparks: [],
      dots: this.dotsOf(i),
      sheep: this.sheepView(cell),
      gold: { l: pad(this.gold.c), t: pad(this.gold.r), s: cell }
    });
  },

  dotsOf(cur) {
    const out = [];
    const k = cur % TIERS;
    for (let i = 0; i < TIERS; i++) {
      out.push({ i: i, cls: i < k ? 'on' : (i === k ? 'now' : '') });
    }
    return out;
  },

  sheepView(cell) {
    return this.sheep.map((o) => {
      const on = this.goals.some((g) => g.r === o.r && g.c === o.c);
      return { k: o.k, l: o.c * cell, t: o.r * cell, s: cell, on: on };
    });
  },

  countFilled() {
    return this.sheep.filter((o) => this.goals.some((g) => g.r === o.r && g.c === o.c)).length;
  },

  inBoard(p) {
    return p.r >= 0 && p.r < this.N && p.c >= 0 && p.c < this.N;
  },
  isRock(p) {
    return this.rocks.some((o) => o.r === p.r && o.c === p.c);
  },
  isGate(p) {
    return this.GATE[0] === p.r && this.GATE[1] === p.c;
  },
  sheepAt(p) {
    return this.sheep.findIndex((o) => o.r === p.r && o.c === p.c);
  },

  /* ============ 推箱子 ============ */
  padTap(e) {
    this.move(e.currentTarget.dataset.d);
  },

  move(d) {
    if (this.mode !== 'play') return;
    const v = DV[d];
    const t = { r: this.gold.r + v[0], c: this.gold.c + v[1] };

    if (!this.inBoard(t) || this.isRock(t)) {
      this.refuse();
      return;
    }

    if (this.isGate(t)) {
      if (this.countFilled() < this.goals.length) {
        wx.showToast({ title: '羊还没全进圈，门锁着', icon: 'none' });
        this.refuse();
        return;
      }
      this.step(t, null);
      this.win();
      return;
    }

    const si = this.sheepAt(t);
    if (si >= 0) {
      const b = { r: t.r + v[0], c: t.c + v[1] };
      if (!this.inBoard(b) || this.isRock(b) || this.isGate(b) || this.sheepAt(b) >= 0) {
        wx.showToast({ title: '这只羊后面顶住了', icon: 'none' });
        this.refuse();
        return;
      }
      this.pushHist();
      this.sheep[si].r = b.r;
      this.sheep[si].c = b.c;
      this.step(t, si);
      return;
    }

    this.pushHist();
    this.step(t, null);
  },

  /* 记一步：金羊走到 t，顺便更新羊、羊圈、狼、剩余步 */
  step(t, pushed) {
    this.gold = { r: t.r, c: t.c };
    this.used += 1;
    const filled = this.countFilled();
    wx.vibrateShort({ type: pushed === null ? 'light' : 'medium' });
    this.setData({
      gold: { l: t.c * this.data.cell, t: t.r * this.data.cell, s: this.data.cell },
      sheep: this.sheepView(this.data.cell),
      filled: filled,
      gateOpen: filled === this.goals.length,
      used: this.used,
      low: this.budget - this.used <= 1
    });
    this.tickWolf();
    if (this.mode === 'play' && this.stuck()) {
      this.fail('这只羊被推进死角，再也进不了圈');
      return;
    }
    if (this.mode === 'play' && this.used >= this.budget) {
      this.fail('步子用光了');
    }
  },

  /* 死锁判定：羊卡在墙角（两个垂直方向都是墙/边）且不在圈里，就永远救不回来 */
  stuck() {
    for (let i = 0; i < this.sheep.length; i++) {
      const s = this.sheep[i];
      if (this.goals.some((g) => g.r === s.r && g.c === s.c)) continue;
      const blocked = (p) => !this.inBoard(p) || this.isRock(p) || this.isGate(p);
      const up = blocked({ r: s.r - 1, c: s.c });
      const dn = blocked({ r: s.r + 1, c: s.c });
      const lf = blocked({ r: s.r, c: s.c - 1 });
      const rt = blocked({ r: s.r, c: s.c + 1 });
      if ((up && lf) || (up && rt) || (dn && lf) || (dn && rt)) return true;
    }
    return false;
  },

  pushHist() {
    if (!this.hist) this.hist = [];
    this.hist.push({
      gold: { r: this.gold.r, c: this.gold.c },
      sheep: this.sheep.map((o) => ({ r: o.r, c: o.c })),
      used: this.used,
      hunter: this.hunter ? { r: this.hunter.r, c: this.hunter.c } : null
    });
    if (this.hist.length > 60) this.hist.shift();
  },

  undo() {
    if (this.mode !== 'play' || !this.hist || !this.hist.length) return;
    if (this.undoLeft <= 0) {
      wx.showToast({ title: '本关悔步用完了', icon: 'none' });
      return;
    }
    const h = this.hist.pop();
    this.gold = h.gold;
    this.sheep = h.sheep.map((o, k) => ({ r: o.r, c: o.c, k: k }));
    this.used = h.used;
    this.hunter = h.hunter;
    this.undoLeft -= 1;
    const filled = this.countFilled();
    this.setData({
      gold: { l: this.gold.c * this.data.cell, t: this.gold.r * this.data.cell, s: this.data.cell },
      sheep: this.sheepView(this.data.cell),
      filled: filled,
      gateOpen: filled === this.goals.length,
      used: this.used,
      low: this.budget - this.used <= 1,
      undoLeft: this.undoLeft,
      hunter: this.hunter ? { l: this.hunter.c * this.data.cell, t: this.hunter.r * this.data.cell, s: this.data.cell } : null
    });
    wx.vibrateShort({ type: 'light' });
  },

  refuse() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ goldBump: true });
    setTimeout(() => this.setData({ goldBump: false }), 240);
  },

  /* ============ 狼 ============ */
  wolfNext(from, to) {
    const n = this.N;
    const key = (o) => o.r + ',' + o.c;
    if (from.r === to.r && from.c === to.c) return from;
    const seen = { [key(from)]: true };
    const back = {};
    const q = [{ r: from.r, c: from.c }];
    let reach = null;
    for (let h = 0; h < q.length && !reach; h++) {
      const cur = q[h];
      for (const k in DV) {
        const v = DV[k];
        const t = { r: cur.r + v[0], c: cur.c + v[1] };
        const kk = key(t);
        if (t.r < 0 || t.r >= n || t.c < 0 || t.c >= n || seen[kk]) continue;
        if (this.isGate(t) || this.isRock(t) || this.sheepAt(t) >= 0) continue;
        seen[kk] = true;
        back[kk] = cur;
        if (t.r === to.r && t.c === to.c) {
          reach = t;
          break;
        }
        q.push(t);
      }
    }
    if (!reach) return from;
    let cur = reach;
    while (back[key(cur)] && !(back[key(cur)].r === from.r && back[key(cur)].c === from.c)) {
      cur = back[key(cur)];
    }
    if (!back[key(cur)]) return from;
    return cur;
  },

  tickWolf() {
    if (!this.hunter || this.mode !== 'play') return;
    if (this.used % WOLF_EVERY !== 0) return;
    const nxt = this.wolfNext(this.hunter, { r: this.gold.r, c: this.gold.c });
    this.hunter = nxt;
    this.setData({ hunter: { l: nxt.c * this.data.cell, t: nxt.r * this.data.cell, s: this.data.cell } });
    if (nxt.r === this.gold.r && nxt.c === this.gold.c) {
      this.fail('狼追上金羊了');
      return;
    }
    wx.vibrateShort({ type: 'medium' });
  },

  /* ============ 失败 ============ */
  fail(reason) {
    if (this.mode !== 'play') return;
    this.mode = 'fail';
    wx.vibrateShort({ type: 'heavy' });

    const cell = this.data.cell;
    const wr = Math.min(this.N - 1.6, this.gold.r - 0.7);
    const wc = Math.max(0, Math.min(this.N - 1.6, this.gold.c - 0.55));
    this.setData({ wolf: { l: wc * cell, t: wr * cell, s: cell * 1.6 } });

    setTimeout(() => {
      this.setData({
        card: 'fail',
        cardTitle: '狼蹲在门口了',
        cardBody: reason + '，金羊卡在第 ' + (this.idx + 1) + ' 关。第 '
          + (Math.floor(this.idx / TIERS) + 1) + ' 组要从第 '
          + (this.idx - this.idx % TIERS + 1) + ' 关重来。',
        cardSteps: '本关最少 ' + this.data.min + ' 步 · 你用掉 ' + this.used + ' 步'
      });
    }, 700);
  },

  /* 广告位：原型阶段弹窗模拟，接真广告时换 wx.createRewardedVideoAd */
  watchAd() {
    wx.showModal({
      title: '广告位演示',
      content: '真实版本这里是一条激励视频，看完给本关加 3 步 + 3 次悔步。每关只能补一次。',
      confirmText: '当作看完了',
      cancelText: '算了',
      success: (res) => {
        if (!res.confirm) return;
        this.budget += 3;
        this.undoLeft += 3;
        this.adUsed = true;
        this.mode = 'play';
        this.setData({
          budget: this.budget,
          adUsed: true,
          undoLeft: this.undoLeft,
          wolf: null,
          card: '',
          low: this.budget - this.used <= 1
        });
        wx.showToast({ title: '步数 +3 · 悔步 +3', icon: 'none' });
      }
    });
  },

  /* ============ 过关 ============ */
  win() {
    if (this.mode !== 'play') return;
    this.mode = 'win';
    wx.vibrateShort({ type: 'medium' });

    const cell = this.data.cell;
    this.setData({
      gold: { l: this.gold.c * cell, t: (this.N + 0.5) * cell, s: cell, fade: true }
    });

    setTimeout(() => {
      if (this.idx >= TOTAL - 1) {
        this.toScene();
        return;
      }
      const round = Math.floor(this.idx / TIERS) + 1;
      const endOfRound = this.idx % TIERS === TIERS - 1;
      this.setData({
        card: 'pass',
        cardTitle: endOfRound
          ? '第 ' + round + ' 组 · 五道门全过'
          : '第 ' + (this.idx + 1) + ' 关 · 出圈',
        cardBody: endOfRound
          ? ('这一组走完了，' + PROV + ' 记下 1 支烟花。接着开第 ' + (round + 1) + ' 组。')
          : ('金羊从这道门挤出来了，这一组还剩 ' + (TIERS - 1 - (this.idx % TIERS)) + ' 道门。'),
        cardSteps: '你用 ' + this.used + ' 步 · 本关最少 ' + this.data.min + ' 步'
      });
      this.passTimer = setTimeout(() => this.nextLevel(), endOfRound ? 2200 : 1400);
    }, 400);
  },

  nextLevel() {
    if (this.passTimer) {
      clearTimeout(this.passTimer);
      this.passTimer = 0;
    }
    this.loadLevel(this.idx + 1);
  },

  /* ============ 金羊进省圈 ============ */
  toScene() {
    this.mode = 'scene';
    const fw = DAY_FW + ROUNDS;
    const flock = [];
    for (let i = 0; i < fw; i++) flock.push({ k: 'f' + i, gold: false });

    this.setData({
      view: 'scene',
      card: '',
      fw: fw,
      fwShow: fw,
      flock: flock,
      goldIn: false,
      sparks: [],
      boom: false
    });

    setTimeout(() => this.setData({ goldIn: true }), 60);

    setTimeout(() => {
      const flock2 = flock.concat([{ k: 'gold', gold: true }]);
      this.setData({ flock: flock2, fwShow: fw, sparks: this.buildSparks(false) });
      setTimeout(() => this.setData({ boom: true }), 80);
      wx.vibrateShort({ type: 'medium' });
      store.addFqi(2);
      const key = 'jy_clear_' + new Date().toISOString().slice(0, 10);
      wx.setStorageSync(key, 30);
    }, 900);
  },

  buildSparks(boom) {
    const out = [];
    const colors = ['#C99A3D', '#C0372E', '#F2D08A', '#E8B84B'];
    for (let b = 0; b < 3; b++) {
      const cx = 30 + b * 22;
      const cy = 16 + (b % 2) * 10;
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10 + b * 0.4;
        const dist = 8 + (i % 3) * 4;
        out.push({
          k: 's' + b + '_' + i,
          x: cx,
          y: cy,
          dx: boom ? Math.cos(a) * dist : 0,
          dy: boom ? Math.sin(a) * dist : 0,
          c: colors[(b + i) % colors.length],
          dl: (b * 0.18 + (i % 4) * 0.03).toFixed(2)
        });
      }
    }
    return out;
  },

  /* 失败卡：从本组第一关重来 */
  again() {
    if (this.passTimer) {
      clearTimeout(this.passTimer);
      this.passTimer = 0;
    }
    const start = this.idx - (this.idx % TIERS);
    this.loadLevel(start);
  },

  sceneAgain() {
    this.loadLevel(0);
  },

  backHome() {
    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  }
});
