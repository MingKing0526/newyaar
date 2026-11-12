/**
 * 数据接口层（唯一的后端切换点）
 *
 * BACKEND = 'local'  本地存储，当前默认。开发者工具里就能跑通全流程。
 * BACKEND = 'cloud'  微信云开发：把下面的 TODO 换成 wx.cloud.callFunction('xxx')
 * BACKEND = 'http'  自建 PHP 接口：换成 wx.request 调你的域名（需在后台配 request 合法域名）
 *
 * 页面只调这里的函数，不直接碰 store，之后换后端不用改页面。
 */
const store = require('./store');

const BACKEND = 'local';

/* 提交一局分数，返回历史最高分 */
function submitScore(score) {
  if (BACKEND === 'local') {
    return Promise.resolve({ best: store.submitScore(score) });
  }
  // TODO(cloud): return wx.cloud.callFunction({ name: 'submitScore', data: { score } })
  // TODO(http):  return new Promise((resolve, reject) => wx.request({ url: 'https://your.domain/api/score', method: 'POST', data: { score }, success: r => resolve(r.data), fail: reject }))
  return Promise.resolve({ best: score });
}

/* 上报一次喂羊，返回最新等级（后端可在这里做“同一只羊”的跨设备同步） */
function submitFeed() {
  if (BACKEND === 'local') {
    return Promise.resolve({ level: 0 });
  }
  return Promise.resolve({ level: 0 });
}

/* 拉取榜单：type = 'class' | 'family' */
function fetchBoard(type) {
  if (BACKEND === 'local') {
    return Promise.resolve(store.boardView(type));
  }
  return Promise.resolve(store.boardView(type));
}

module.exports = {
  submitScore: submitScore,
  submitFeed: submitFeed,
  fetchBoard: fetchBoard
};
