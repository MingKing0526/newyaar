const store = require('../../utils/store');
const api = require('../../utils/api');

const DURATION = 60; // 秒，复活时加 15

const TYPES = {
  ingot: { pts: 10, r: 29, sway: 13, w: 56 },
  pouch: { pts: 30, r: 33, sway: 10, w: 23 },
  goat: { pts: 50, r: 37, sway: 17, w: 11 },
  firecracker: { pts: -20, r: 27, sway: 22, w: 10, bad: true }
};

Page({
  data: {
    score: 0,
    best: 0,
    left: DURATION,
    leftPct: 100,
    over: false,
    fqiGain: 0,
    doubleUsed: false
  },

  onLoad() {
    this.items = [];
    this.effects = [];
    this.floats = [];
    this.sprites = {};
    this.running = false;
    this.elapsed = 0;
    this.duration = DURATION;
    this.score = 0;
    this.streak = 0;
    this.lastCatch = 0;
    this.spawnIn = 0.5;
    this.lastSecond = DURATION;
    this.raf = 0;
    this.lastTs = 0;

    this._loop = this.loop.bind(this);
    this.setData({ best: store.get().best });
    this.initCanvas();
  },

  onShow() {
    if (this.canvas && !this.data.over && !this.running) {
      this.start();
    }
  },

  onHide() {
    this.stop();
  },

  onUnload() {
    this.stop();
  },

  initCanvas() {
    const q = wx.createSelectorQuery().in(this);
    q.select('#stage').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const dpr = info.pixelRatio || 2;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);

      this.canvas = canvas;
      this.ctx = ctx;
      this.W = res[0].width;
      this.H = res[0].height;

      this.loadSprites(() => {
        this.draw();
        this.start();
      });
    });
  },

  loadSprites(cb) {
    const list = [
      ['ingot', '/assets/ingot.png'],
      ['pouch', '/assets/pouch.png'],
      ['goat', '/assets/goat.png'],
      ['firecracker', '/assets/firecracker.png']
    ];
    let left = list.length;
    list.forEach(([key, src]) => {
      const img = this.canvas.createImage();
      img.onload = () => {
        this.sprites[key] = img;
        left -= 1;
        if (left === 0 && cb) cb();
      };
      img.onerror = () => {
        left -= 1;
        if (left === 0 && cb) cb();
      };
      img.src = src;
    });
  },

  start() {
    this.running = true;
    this.lastTs = 0;
    this.raf = this.canvas.requestAnimationFrame(this._loop);
  },

  stop() {
    this.running = false;
    if (this.raf && this.canvas) this.canvas.cancelAnimationFrame(this.raf);
    this.raf = 0;
  },

  loop(ts) {
    if (!this.running) return;
    if (!this.lastTs) this.lastTs = ts;
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (dt > 0.06) dt = 0.06;

    this.update(dt);
    this.draw();
    this.raf = this.canvas.requestAnimationFrame(this._loop);
  },

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.endGame();
      return;
    }

    const leftSec = Math.ceil(this.duration - this.elapsed);
    if (leftSec !== this.lastSecond) {
      this.lastSecond = leftSec;
      this.setData({
        left: leftSec,
        leftPct: Math.max(0, (this.duration - this.elapsed) / this.duration * 100)
      });
    }

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawn();
      const p = Math.min(1, this.elapsed / this.duration);
      this.spawnIn = (0.74 - p * 0.4) * (0.82 + Math.random() * 0.4);
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += it.vy * dt;
      it.phase += dt * it.freq;
      it.x = it.baseX + Math.sin(it.phase) * it.sway;
      it.rot += it.spin * dt;
      if (it.y - it.r > this.H + 10) this.items.splice(i, 1);
    }

    for (let j = this.effects.length - 1; j >= 0; j--) {
      const e = this.effects[j];
      e.t += dt;
      if (e.t > 0.55) this.effects.splice(j, 1);
    }
    for (let k = this.floats.length - 1; k >= 0; k--) {
      const f = this.floats[k];
      f.t += dt;
      f.y -= 46 * dt;
      if (f.t > 0.95) this.floats.splice(k, 1);
    }
  },

  spawn() {
    const p = Math.min(1, this.elapsed / this.duration);
    const wBad = 6 + p * 13;
    const keys = ['ingot', 'pouch', 'goat', 'firecracker'];
    const weight = [TYPES.ingot.w, TYPES.pouch.w, TYPES.goat.w, wBad];
    let total = 0;
    for (let i = 0; i < weight.length; i++) total += weight[i];

    let roll = Math.random() * total;
    let key = 'ingot';
    for (let i = 0; i < keys.length; i++) {
      roll -= weight[i];
      if (roll <= 0) {
        key = keys[i];
        break;
      }
    }

    const t = TYPES[key];
    const r = t.r * (1 + p * 0.05);
    const baseX = 42 + Math.random() * Math.max(60, this.W - 84);

    this.items.push({
      key: key,
      r: r,
      baseX: baseX,
      x: baseX,
      y: -r - 8,
      vy: (78 + p * 96) * (0.85 + Math.random() * 0.35),
      sway: t.sway * (0.7 + Math.random() * 0.7),
      freq: 1.1 + Math.random() * 1.1,
      phase: Math.random() * 6.28,
      rot: (Math.random() - 0.5) * 0.25,
      spin: key === 'firecracker' ? (Math.random() - 0.5) * 1.2 : 0,
      bad: !!t.bad
    });
  },

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.W, this.H);

    ctx.strokeStyle = 'rgba(107,25,23,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, this.H - 6);
    ctx.lineTo(this.W - 14, this.H - 6);
    ctx.stroke();

    this.items.forEach((it) => {
      const img = this.sprites[it.key];
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      if (img) {
        ctx.drawImage(img, -it.r, -it.r, it.r * 2, it.r * 2);
      } else {
        ctx.fillStyle = it.bad ? '#C0372E' : '#C99A3D';
        ctx.beginPath();
        ctx.arc(0, 0, it.r * 0.8, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
    });

    this.effects.forEach((e) => {
      const a = 1 - e.t / 0.55;
      ctx.strokeStyle = e.bad ? 'rgba(192,55,46,' + a + ')' : 'rgba(201,154,61,' + a + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + e.t * 46, 0, 6.283);
      ctx.stroke();
    });

    this.floats.forEach((f) => {
      const a = Math.max(0, 1 - f.t / 0.95);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.font = '600 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.txt, f.x, f.y);
      ctx.globalAlpha = 1;
    });
  },

  onTouch(e) {
    if (!this.running || this.data.over) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    const px = t.x;
    const py = t.y;

    let best = -1;
    let bestD = 99999;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const d = Math.sqrt(Math.pow(it.x - px, 2) + Math.pow(it.y - py, 2));
      if (d < it.r * 1.4 && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    this.collect(best);
  },

  collect(idx) {
    const it = this.items[idx];
    this.items.splice(idx, 1);

    if (it.bad) {
      this.score = Math.max(0, this.score - 20);
      this.streak = 0;
      this.floats.push({ x: it.x, y: it.y, txt: '-20', color: '#2C6B58', t: 0 });
      this.effects.push({ x: it.x, y: it.y, r: it.r, t: 0, bad: true });
    } else {
      let gain = TYPES[it.key].pts;
      this.streak += 1;
      if (this.streak % 3 === 0) gain += 15;
      this.score += gain;
      this.lastCatch = Date.now();
      this.floats.push({ x: it.x, y: it.y, txt: '+' + gain, color: '#8C2620', t: 0 });
      this.effects.push({ x: it.x, y: it.y, r: it.r, t: 0 });
    }
    this.setData({ score: this.score });
  },

  endGame() {
    this.stop();
    const gain = Math.max(1, Math.floor(this.score / 20));
    store.addFqi(gain);
    api.submitScore(this.score).then((res) => {
      this.setData({
        over: true,
        best: res.best,
        fqiGain: gain
      });
    });
  },

  again() {
    this.items = [];
    this.effects = [];
    this.floats = [];
    this.elapsed = 0;
    this.duration = DURATION;
    this.score = 0;
    this.streak = 0;
    this.spawnIn = 0.5;
    this.lastSecond = DURATION;
    this.setData({ over: false, score: 0, left: DURATION, leftPct: 100, fqiGain: 0, doubleUsed: false });
    this.start();
  },

  goHome() {
    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  },

  /* 广告位演示：真实接入时换成 wx.createRewardedVideoAd */
  watchAd() {
    wx.showModal({
      title: '广告位演示',
      content: '真实版本这里是一条激励视频，看完本局福气翻倍。原型阶段不加载广告。',
      confirmText: '当作看完了',
      cancelText: '算了',
      success: (r) => {
        if (!r.confirm) return;
        const extra = Math.max(1, Math.floor(this.score / 20));
        store.addFqi(extra);
        this.setData({
          doubleUsed: true,
          fqiGain: this.data.fqiGain + extra
        });
        wx.showToast({ title: '福气 +' + extra, icon: 'none' });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '我在羊年集福册接了 ' + this.data.score + ' 分，你来看看',
      path: '/pages/index/index'
    };
  }
});
