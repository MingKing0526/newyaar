const store = require('./utils/store');

App({
  globalData: {
    appName: '羊年集福册',
    /** 由页面把最近一局的分数带进来，供结算与分享使用 */
    lastScore: 0,
    lastFqi: 0
  },

  onLaunch() {
    store.init();
  },

  onShow() {
    // 每次回到前台都校验一次连续天数，断签不惩罚，只重置计数
    store.checkStreak();
  }
});
