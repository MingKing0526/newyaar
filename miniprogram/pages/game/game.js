/**
 * 金羊出圈 · 五关推羊（小程序版）
 * 一日的五关串成一条线：第 1 关出门 → 第 2 关 … → 第 5 关，全过才为省份 +1 支烟花
 * 关卡不手摆：data/levels.js 里 46 关都经 BFS 求解器验证过最少步数
 * 每个设备按唯一 ID 哈希取关，重开还是同一盘
 */
const store = require('../../utils/store');
const { POOL } = require('../../data/levels');

const BOARD = 580;        // 7×7 及以下的棋盘边长（rpx）
const BOARD_BIG = 620;    // 8×8 用大一点的格，保证手指点得着
const boardOf = (n) => (n >= 8 ? BOARD_BIG : BOARD);
const DV = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const PROV = '广东';
const DAY_FW = 3;         // 演示：广东当夜已有的烟花数
const WOLF_EVERY = 4;     // 第五关：狼每走 4 步就逼近金羊一格

/* 选关：设备唯一 ID + 关号 → 哈希 → 池内某一关 */
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
  let saved = wx.getStorageSync('jy_pick_v1');
  if (!saved || !saved.uid || saved.uid !== uid || !saved.picks
      || saved.picks.length !== pools.length) {
    saved = { uid: uid, picks: pools.map((arr, t) => h32(uid + '#' + t) % arr.length) };
    wx.setStorageSync('jy_pick_v1', saved);
  }
  return pools.map((arr, t) => {
    const L = arr[saved.picks[t] % arr.length];
    return {
      name: L.nm,
      n: L.n,
      gate: L.g,
      min: L.m,
      budget: L.m + (t === 0 ? 1 : 0),
      gold: L.c,
      rocks: L.r,
      sheep: L.s,
      wolf: L.w || null
    };
  });
}

Page({
  data: {
    view: 'play',
    idx: 1,
    idxMax: 5,
    name: '',
    min: 0,
    used: 0,
    budget: 0,
    low: false,
    dots: [],
    board: BOARD,
    cell: 0,
    rocks: [],
    sheep: [],
    gold: { l: 0, t: 0, s: 0 },
    gateBox: { l: 0, t: 0, s: 0 },
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
      title: '羊年五道羊圈，我把金羊赶出去了，你试试',
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
    this.sheep = L.sheep.map((s, k) => ({ r: s[0], c: s[1], d: s[2], k: k }));
    this.used = 0;
    this.budget = L.budget;
    this.adUsed = false;
    this.mode = 'play';
    this.hunter = L.wolf ? { r: L.wolf[0], c: L.wolf[1] } : null;

    const rocks = this.rocks.map((o, k) => ({
      k: k, l: pad(o.c), t: pad(o.r), s: cell
    }));

    this.setData({
      view: 'play',
      idx: i + 1,
      name: L.name,
      min: L.min,
      budget: this.budget,
      used: 0,
      low: false,
      cell: cell,
      board: B,
      rocks: rocks,
      gateBox: { l: pad(this.GATE[1]), t: pad(this.GATE[0]), s: cell },
      wolf: null,
      hunter: this.hunter ? { l: this.hunter.c * cell, t: this.hunter.r * cell, s: cell } : null,
      hasWolf: !!this.hunter,
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
    for (let i = 0; i < 5; i++) {
      out.push({ i: i, cls: i < cur ? 'on' : (i === cur ? 'now' : '') });
    }
    return out;
  },

  sheepView(cell) {
    return this.sheep.map((o) => ({
      k: o.k, d: o.d, l: o.c * cell, t: o.r * cell, s: cell
    }));
  },

  occupied(r, c, skipGold) {
    if (!skipGold && this.gold.r === r && this.gold.c === c) return true;
    for (let i = 0; i < this.rocks.length; i++) {
      if (this.rocks[i].r === r && this.rocks[i].c === c) return true;
    }
    for (let j = 0; j < this.sheep.length; j++) {
      if (this.sheep[j].r === r && this.sheep[j].c === c) return true;
    }
    return false;
  },

  /* 点羊：朝自己的箭头走一格，推不动就抖一下不算步 */
  tapSheep(e) {
    if (this.mode !== 'play') return;
    const k = e.currentTarget.dataset.k;
    const sh = this.sheep[k];
    if (!sh) return;
    const v = DV[sh.d];
    const nr = sh.r + v[0];
    const nc = sh.c + v[1];
    const blocked = nr < 0 || nr >= this.N || nc < 0 || nc >= this.N
      || this.occupied(nr, nc)
      || (nr === this.GATE[0] && nc === this.GATE[1]);
    if (blocked) {
      wx.vibrateShort({ type: 'light' });
      this.bump(k);
      return;
    }
    sh.r = nr;
    sh.c = nc;
    this.used += 1;
    wx.vibrateShort({ type: 'light' });
    this.setData({
      sheep: this.sheepView(this.data.cell),
      used: this.used,
      low: this.budget - this.used <= 1
    });
    this.tickWolf();
    this.checkEnd();
  },

  /* 狼每 5 步朝金羊逼近一格（绕石头，不进门口） */
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
        if (t.r === this.GATE[0] && t.c === this.GATE[1]) continue;
        if (this.rocks.some((o) => o.r === t.r && o.c === t.c)) continue;
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
    // 从终点回退到“贴着狼的那一格”
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

  bump(k) {
    this.setData({ bumpK: k });
    setTimeout(() => this.setData({ bumpK: -1 }), 260);
  },

  padTap(e) {
    this.goldMove(e.currentTarget.dataset.d);
  },

  goldMove(d) {
    if (this.mode !== 'play') return;
    const v = DV[d];
    const nr = this.gold.r + v[0];
    const nc = this.gold.c + v[1];
    const blocked = nr < 0 || nr >= this.N || nc < 0 || nc >= this.N
      || this.occupied(nr, nc, true);
    if (blocked) {
      wx.vibrateShort({ type: 'light' });
      this.setData({ goldBump: true });
      setTimeout(() => this.setData({ goldBump: false }), 260);
      return;
    }
    const won = nr === this.GATE[0] && nc === this.GATE[1];
    this.gold = { r: nr, c: nc };
    this.used += 1;
    wx.vibrateShort({ type: 'light' });
    this.setData({
      gold: { l: nc * this.data.cell, t: nr * this.data.cell, s: this.data.cell },
      used: this.used,
      low: this.budget - this.used <= 1
    });
    if (won) {
      this.win();
      return;
    }
    this.tickWolf();
    this.checkEnd();
  },

  anyMove() {
    const g = this.gold;
    for (const k in DV) {
      const v = DV[k];
      const nr = g.r + v[0];
      const nc = g.c + v[1];
      if (nr >= 0 && nr < this.N && nc >= 0 && nc < this.N && !this.occupied(nr, nc, true)) return true;
    }
    for (let i = 0; i < this.sheep.length; i++) {
      const sh = this.sheep[i];
      const v = DV[sh.d];
      const nr = sh.r + v[0];
      const nc = sh.c + v[1];
      if (nr >= 0 && nr < this.N && nc >= 0 && nc < this.N && !this.occupied(nr, nc)
          && !(nr === this.GATE[0] && nc === this.GATE[1])) return true;
    }
    return false;
  },

  checkEnd() {
    if (this.used >= this.budget) {
      this.fail('步子用光了');
      return;
    }
    if (!this.anyMove()) this.fail('羊群把路堵死了');
  },

  /* ============ 失败：狼来了 ============ */
  fail(reason) {
    if (this.mode !== 'play') return;
    this.mode = 'fail';
    wx.vibrateShort({ type: 'heavy' });

    const cell = this.data.cell;
    const wr = Math.min(this.N - 1.6, this.gold.r - 0.7);
    const wc = Math.max(0, Math.min(this.N - 1.6, this.gold.c - 0.55));
    this.setData({
      wolf: { l: wc * cell, t: wr * cell, s: cell * 1.6 }
    });

    setTimeout(() => {
      this.setData({
        card: 'fail',
        cardTitle: '狼蹲在门口了',
        cardBody: reason + '，金羊卡在第 ' + (this.idx + 1) + ' 关。这一天得从第一关重新开始。',
        cardSteps: '本关最少 ' + this.data.min + ' 步 · 你用掉 ' + this.used + ' 步'
      });
    }, 900);
  },

  /* 广告位：原型阶段用弹窗模拟，接真广告时换成 wx.createRewardedVideoAd */
  watchAd() {
    wx.showModal({
      title: '广告位演示',
      content: '真实版本这里是一条激励视频，看完给本关加 3 步。每关只能补一次。',
      confirmText: '当作看完了',
      cancelText: '算了',
      success: (res) => {
        if (!res.confirm) return;
        this.budget += 3;
        this.adUsed = true;
        this.mode = 'play';
        this.setData({
          budget: this.budget,
          adUsed: true,
          wolf: null,
          card: '',
          low: this.budget - this.used <= 1
        });
        wx.showToast({ title: '步数 +3', icon: 'none' });
      }
    });
  },

  /* ============ 过关 ============ */
  win() {
    this.mode = 'win';
    wx.vibrateShort({ type: 'medium' });

    const cell = this.data.cell;
    // 金羊落门后向下走出棋盘
    this.setData({
      gold: { l: this.gold.c * cell, t: (this.N + 0.5) * cell, s: cell, fade: true }
    });

    setTimeout(() => {
      if (this.idx >= 4) {
        this.toScene();
        return;
      }
      this.setData({
        card: 'pass',
        cardTitle: '第 ' + (this.idx + 1) + ' 关 · 出圈',
        cardBody: '金羊从这道门挤出来了，前面还有 ' + (4 - this.idx) + ' 道门。',
        cardSteps: '你用 ' + this.used + ' 步 · 本关最少 ' + this.data.min + ' 步'
      });
      this.passTimer = setTimeout(() => this.nextLevel(), 1500);
    }, 420);
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
    const flock = [];
    for (let i = 0; i < DAY_FW; i++) flock.push({ k: 'f' + i, gold: false });

    this.setData({
      view: 'scene',
      card: '',
      fw: DAY_FW,
      fwShow: DAY_FW,
      flock: flock,
      goldIn: false,
      sparks: [],
      boom: false
    });

    setTimeout(() => this.setData({ goldIn: true }), 60);

    setTimeout(() => {
      const flock2 = flock.concat([{ k: 'gold', gold: true }]);
      this.setData({ flock: flock2, fwShow: DAY_FW + 1, sparks: this.buildSparks(false) });
      setTimeout(() => this.setData({ boom: true }), 80);
      wx.vibrateShort({ type: 'medium' });
      store.addFqi(2);
      const key = 'jy_clear_' + new Date().toISOString().slice(0, 10);
      wx.setStorageSync(key, true);
    }, 950);
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

  again() {
    if (this.passTimer) {
      clearTimeout(this.passTimer);
      this.passTimer = 0;
    }
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
