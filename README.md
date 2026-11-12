# 羊年集福册（newyaar）

面向 2027 羊年春节的微信小程序：**集福卡 + 每日一答 + 福气小羊 + 班级/家族双榜**，接福小游戏负责「攒福气」，是后台层的数据来源。

当前阶段：**春节 15 天版本**（先跑起来，跨节日的壳子在数据结构里预留）。

## 目录

```
newyaar/
├─ project.config.json        微信开发者工具工程配置
├─ miniprogram/               小程序代码（miniprogramRoot）
│  ├─ app.js / app.json / app.wxss
│  ├─ sitemap.json
│  ├─ assets/                 四张接取物图（透明 PNG）
│  ├─ utils/
│  │  ├─ store.js             本地数据层：卡册、福气、小羊、连续天数、榜单
│  │  └─ api.js               唯一的后端切换点（local / cloud / http）
│  └─ pages/
│     ├─ index/               集福册首页：12 格卡册 + 小羊 + 每日一答 + 榜单入口
│     ├─ game/                接福 60 秒（canvas 2d）
│     ├─ sheep/               福气小羊：摸头、喂养、成长
│     └─ board/               班级榜 / 家族榜
└─ README.md
```

## 怎么打开

1. 微信开发者工具 → 导入项目 → 目录选 `D:\XCXKF\newyaar`
2. AppID 处填你自己的小程序 AppID；没有就先选「测试号」，功能都能跑（分享除外）
3. 编译即可，四个页面全部是本地数据，不需要后端

> `project.config.json` 里现在是 `touristappid`（游客模式占位），拿到正式 AppID 后替换这一行，并填 `projectname`。

## 现在的玩法闭环

- **每日一答**：一天一道年俗题，答对落印得一张福卡（答错可以重答，给提示）
- **接福 60 秒**：接住元宝/福袋/金羊得分，鞭炮扣分；一局结算按 `分数 ÷ 20` 换成福气
- **福气小羊**：每天摸一次（+1 福气）、喂一次（花 20 福气）；每喂 2 次升一阶，共 6 阶
- **双榜**：班级榜 / 家族榜，目前是演示数据

## 数据层怎么切后端

所有页面只调 `miniprogram/utils/api.js`，里面三行 TODO：

- `BACKEND = 'local'`：现在就这一档，wx.setStorageSync
- `'cloud'`：换 `wx.cloud.callFunction`
- `'http'`：换 `wx.request` 打你的 PHP 接口（记得在公众平台配 request 合法域名）

后端要存的东西最小集：`openid`、班级/家族群 ID、最高分、卡册、福气、小羊总喂养数、最后互动日期。

## 家里 Mac 怎么同步

一次性：

```bash
git clone git@github.com:<你的账号>/newyaar.git D:/XCXKF/newyaar   # 或 ~/XCXKF/newyaar
cd newyaar
```

每天晚上两边来回：

```bash
git pull --rebase     # 先拉
git add -A && git commit -m "feat: xxx"
git push
```

要点：
- `.gitignore` 已经排除了 `project.private.config.json`，它含本机路径和登录态，**不要提交**
- 小程序代码是纯文本，Mac 和 Windows 之间不会冲突；只有 `assets/` 的图片是二进制，改了图片注意别两边同时改
- 建议每台机器配一次 `git config user.name/email`，保持一致

## 还没做（按优先级）

1. 后端（班级/家族真实榜单、跨设备同步）
2. 拜年海报导出（canvas → 保存到相册 → 分享到群）
3. 激励视频真实接入（`wx.createRewardedVideoAd`，现在只是 showModal 演示）
4. 福卡视觉（现在是印章字，后面换成插画卡面）
5. 备案与资质：小程序备案 + 类目设置（IAA 小游戏另有小游戏备案流程）
6. 订阅消息：第二天「小羊饿了」的唤回（一次性订阅，用户主动授权）
