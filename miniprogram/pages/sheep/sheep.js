const store = require('../../utils/store');

Page({
  data: {
    sheep: {},
    ach: [],
    cards: 0
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const v = store.sheepView();
    const cv = store.cardView();
    this.setData({
      sheep: v,
      cards: cv.gotCount,
      ach: [
        { name: '第一次摸头', done: v.totalTouch >= 1 },
        { name: '喂满 3 次', done: v.totalFeed >= 3 },
        { name: '连续来 7 天', done: v.streak >= 7 },
        { name: '集齐 12 张福卡', done: cv.gotCount >= 12 }
      ]
    });
  },

  touchSheep() {
    const r = store.touchSheep();
    wx.showToast({ title: r.ok ? '它蹭了蹭你的手，福气 +1' : r.msg, icon: 'none' });
    if (r.ok && wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    this.refresh();
  },

  feedSheep() {
    const r = store.feedSheep();
    if (!r.ok) {
      wx.showToast({ title: r.msg, icon: 'none' });
      return;
    }
    wx.showToast({ title: '它吃得很香 · ' + r.levelName, icon: 'none' });
    this.refresh();
  },

  goGame() {
    wx.navigateTo({ url: '/pages/game/game' });
  },

  onShareAppMessage() {
    return {
      title: '我养了一只福气小羊，它已经会' + (this.data.sheep.levelName || '认人') + '了',
      path: '/pages/index/index'
    };
  }
});
