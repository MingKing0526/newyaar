const api = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    type: 'class',
    rows: [],
    myRank: 0,
    total: 0,
    best: 0
  },

  onLoad(query) {
    if (query && query.type === 'family') {
      this.setData({ type: 'family' });
    }
  },

  onShow() {
    this.load();
  },

  load() {
    api.fetchBoard(this.data.type).then((res) => {
      this.setData({
        rows: res.rows,
        myRank: res.myRank,
        total: res.total,
        best: store.get().best
      });
    });
  },

  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.type) return;
    this.setData({ type }, () => this.load());
  },

  goGame() {
    wx.navigateTo({ url: '/pages/game/game' });
  },

  onShareAppMessage() {
    const title = this.data.type === 'family'
      ? '我在羊年福气榜拿了第 ' + this.data.myRank + ' 名，来比比'
      : '我们班的羊年福气榜，来看看谁最旺';
    return {
      title: title,
      path: '/pages/board/board?type=' + this.data.type
    };
  }
});
