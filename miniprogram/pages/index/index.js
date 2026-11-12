const store = require('../../utils/store');

Page({
  data: {
    cards: [],
    gotCount: 0,
    total: 12,
    sheep: {},
    quiz: { q: '', opts: [], done: false },
    quizOpen: false,
    quizPick: -1,
    quizResult: '',
    fqi: 0,
    best: 0,
    streak: 0
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const cv = store.cardView();
    const sv = store.sheepView();
    const q = store.todayQuiz();
    this.setData({
      cards: cv.list,
      gotCount: cv.gotCount,
      total: cv.total,
      sheep: sv,
      quiz: q,
      fqi: sv.fqi,
      best: store.get().best,
      streak: sv.streak
    });
  },

  goGame() {
    wx.navigateTo({ url: '/pages/game/game' });
  },

  goSheep() {
    wx.navigateTo({ url: '/pages/sheep/sheep' });
  },

  goBoard(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: '/pages/board/board?type=' + type });
  },

  openQuiz() {
    if (this.data.quiz.done) {
      wx.showToast({ title: '今天答过了，明天再来', icon: 'none' });
      return;
    }
    this.setData({ quizOpen: true, quizPick: -1, quizResult: '' });
  },

  closeQuiz() {
    this.setData({ quizOpen: false });
  },

  noop() {},

  pickOpt(e) {
    const i = Number(e.currentTarget.dataset.i);
    this.setData({ quizPick: i });

    const res = store.answerQuiz(i);
    if (res.ok) {
      const head = res.isNew ? '新卡入手：' : '重复一张：';
      this.setData({
        quizResult: head + res.card.name + '。' + res.tip
      });
      this.refresh();
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } else {
      this.setData({ quizResult: res.msg });
    }
  }
});
