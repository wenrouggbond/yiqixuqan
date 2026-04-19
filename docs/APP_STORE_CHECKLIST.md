# Android 优先上架检查清单

最后更新日期：2026-04-19

当前发布优先级：**先完成 Android 上架，iOS 暂停**。  
原因不是代码未就绪，而是 iOS 正式发布仍依赖 Apple Developer Program。现阶段先把 Google Play 提交流程做完，再启动微信小程序最小 POC。

## 1. 先补环境变量

复制 `.env.example` 为 `.env`，至少填写这些值：

- `EXPO_PUBLIC_IOS_BUNDLE_ID`
- `EXPO_PUBLIC_ANDROID_PACKAGE`
- `EXPO_PUBLIC_SUPPORT_EMAIL`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_EAS_PROJECT_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

其中 `EXPO_PUBLIC_EAS_PROJECT_ID` 目前主要用于 `scripts/validate-release.mjs` 校验；当前 `app.config.ts` 已内置固定的 EAS project id。

## 2. 初始化 Supabase

1. 在 Supabase 新建项目
2. 打开 SQL Editor，执行 [schema.sql](../supabase/schema.sql)
3. 在 Authentication 中启用 Anonymous Sign-Ins
4. 确认 `couple_shared_states` 已加入 Realtime publication
5. 复制 Project URL 和 anon key 到 `.env`
6. 如本地 `.env` 仍需通过发布校验，可从 Expo 后台复制 `EXPO_PUBLIC_EAS_PROJECT_ID` 到 `.env`
7. 正式构建前执行 `eas env:push production --path .env --force`

## 3. Android 发布主流程

先把发布变量同步到 EAS production 环境，再执行 Android 正式商店构建：

```bash
npm install
npm run validate:release
eas env:push production --path .env --force
npx eas build -p android --profile production
```

注意：`npm run validate:release` 会额外执行 `expo-doctor`、覆盖率测试，并以 production 环境求值 `app.config.ts`；其中 `validate:release` 会校验 Supabase 等发布变量，`app.config.ts` 会拒绝占位值或缺失值，避免误打出不可上架包。

如果你已经有可用 AAB，本阶段重点应转向 **Google Play Console 提交材料**，不要反复重跑无意义构建。

## 4. Android 上架前要准备

- Google Play 开发者账号
- 应用图标
- 商店截图
- 应用名称、短描述、长描述
- 隐私政策 URL
- Data safety 表单
- 内容分级问卷
- 如果是新的个人账号，先完成 closed testing

## 5. Android 提交前最后核对

- `EXPO_PUBLIC_PRIVACY_POLICY_URL` 指向公网可访问的 `https://` 页面
- 已拿到最终用于上传的 AAB
- 商店截图已准备完成
- `docs/STORE_LISTING_TEMPLATE.md` 中的名称、短描述、长描述已定稿
- Data safety 已按实际情况填写
- 内容分级问卷已完成
- 如账号要求，closed testing 已完成

## 6. iOS 当前状态

- 当前暂停，不作为本阶段阻塞项
- 已保留现有配置与文档
- 待 Apple Developer Program 就位后再恢复构建、证书与提交流程

## 7. 当前这版产品描述建议

你在商店文案里可以写：

- 双人共享每日待办
- 菜单记录与用餐记录
- 随机转盘帮助决定今天吃什么
- 日历视图查看每日内容

你暂时不要夸大去写：

- 智能推荐算法
- AI 营养分析
- 多端账号体系
- 消息推送

除非这些功能已经真的完成并可审核验证。

## 8. Google Play Data safety 填写建议

以下内容按**当前代码现状**整理，适合先作为后台填写草稿；最终仍以 Google Play Console 当期表单字段为准。

### 可先准备为“会处理”的数据
- 用户内容：待办、菜单自定义内容、用餐记录；如兼容历史版本数据，还可能包含历史留言内容
- 标识符：匿名会话标识、`clientId`、房间码、配对口令、恢复令牌等同步相关标识

### 主要用途
- App 功能本身
- 维持匿名会话与双端同步

### 可先准备为“未见使用”的能力
- 未见定位权限
- 未见相机、麦克风、通讯录、相册/文件读取
- 未见广告 SDK / 广告 ID
- 未见分析 SDK
- 未见支付 / 订阅 SDK
- 未见邮箱、手机号、OAuth 账号体系

### 后台逐项填写草稿
- 是否收集到服务器：**倾向填 是**（启用云同步的发布版本会把相关数据写入云端）
- 是否共享给第三方用于广告：**倾向填 否**
- 数据用途：**至少包含 App 功能；涉及匿名会话、房间鉴权、恢复令牌、限流时，还要逐题核对是否涉及账号管理 / 安全 / 防滥用**
- 是否传输中加密：**需你确认生产环境确实全程使用 `https://` 后再填 是**
- 是否支持用户删除数据：**需你按实际产品与后端能力确认后再填**

### 仍需人工确认的项
- 生产环境是否全程使用 `https://` 传输
- 隐私政策线上页面是否已公开可访问，且内容与当前数据流一致
- 是否需要在后台声明“开发者或运维可访问云端数据”
- 数据保留与删除口径应如何填写
- 若未来接入新的 SDK、埋点、广告或支付，需重新填写 Data safety

### 建议准备好的后台说明口径
- 本应用主要处理双人协作场景中的待办、菜单与用餐记录
- 当前版本支持 Supabase 云同步；是否启用取决于发布构建配置，而不是终端用户在 App 内自行配置
- 当前代码未见定位、相机、通讯录、广告、分析、支付等能力
- 当前使用匿名会话维持同步身份，不涉及邮箱或手机号注册

## 9. Google Play 内容分级填写草稿

基于当前产品形态，可先按“生活工具 / 双人协作工具”方向准备：
- 不主打暴力、赌博、药品、酒精、成人内容
- 不主打新闻、金融、医疗、社交广场
- 当前版本不提供新的用户之间自由文本交流或公开社区能力
- 如后台问到用户交互、消息交流、用户生成内容，应按“当前版本不提供新的自由文本交流入口，但兼容历史版本数据时可能保留历史留言内容”逐题核对

人工确认点：
- 如后台题目与当前草稿有差异，优先按后台最新问题逐项核对

## 10. 商店截图建议

推荐优先准备 5-6 张截图，尽量展示“结果态”而不是空状态或配置态：

1. 首页上半屏总览：体现日期、统计、身份切换、同步状态，避免拍入开发态说明区
2. 日历与当天统计：体现按天查看记录
3. 每日待办：体现双人分工
4. 菜单与选择记录：体现常吃菜单沉淀
5. 转盘结果：体现“今晚吃什么”决策能力

避免放进截图的内容：
- 房间码 / 配对口令输入框
- 冲突处理按钮
- 空状态页面
- “上架准备版”之类开发措辞
- AI 推荐、智能分析等当前未实现能力

## 10. 审核时建议提供的说明

- 这是一个情侣/双人共享餐食计划工具
- 可通过同一组房间码与配对口令实现双设备共享
- 如审核需要，可使用同一组房间码与配对口令在两台测试设备复现同步
- 如未配置云同步，应用仍可本地单机运行

## 11. 当前代码依据

- `D:\code\couple-meal-app\src\models.ts`
- `D:\code\couple-meal-app\src\sync.ts`
- `D:\code\couple-meal-app\src\hooks\useCloudSync.ts`
- `D:\code\couple-meal-app\App.tsx`
- `D:\code\couple-meal-app\src\sections\*.tsx`
- `D:\code\couple-meal-app\package.json`
- `D:\code\couple-meal-app\supabase\schema.sql`
