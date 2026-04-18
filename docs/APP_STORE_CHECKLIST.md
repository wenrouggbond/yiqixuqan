# 上架检查清单

最后更新日期：2026-04-08

## 1. 先补环境变量

复制 `.env.example` 为 `.env`，至少填写这些值：

- `EXPO_PUBLIC_IOS_BUNDLE_ID`
- `EXPO_PUBLIC_ANDROID_PACKAGE`
- `EXPO_PUBLIC_SUPPORT_EMAIL`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_EAS_PROJECT_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

其中 `EXPO_PUBLIC_EAS_PROJECT_ID` 可通过 `eas init` 或 Expo 后台项目设置获取。

## 2. 初始化 Supabase

1. 在 Supabase 新建项目
2. 打开 SQL Editor，执行 [schema.sql](../supabase/schema.sql)
3. 在 Authentication 中启用 Anonymous Sign-Ins
4. 确认 `couple_shared_states` 已加入 Realtime publication
5. 复制 Project URL 和 anon key 到 `.env`
6. 运行 `eas init` 获取 `EXPO_PUBLIC_EAS_PROJECT_ID`，或从 Expo 后台复制到 `.env`
7. 正式构建前执行 `eas env:push production --path .env --force`

## 3. 生成安装包

先把发布变量同步到 EAS production 环境，再执行正式商店构建：

```bash
npm install
npx expo start
npm run validate:release
eas env:push production --path .env --force
npx eas build -p android --profile production
npx eas build -p ios --profile production
```

注意：`npm run validate:release` 现在会额外执行 `expo-doctor`、覆盖率测试，并以 production 环境求值 `app.config.ts`；其中 `validate:release` 会校验 Supabase 等发布变量，`app.config.ts` 会拒绝 Expo 发布配置中的占位值或缺失值，避免误打出不可上架包。

## 4. Android 上架前要准备

- Google Play 开发者账号
- 应用图标
- 商店截图
- 应用名称、短描述、长描述
- 隐私政策 URL
- Data safety 表单
- 内容分级问卷
- 如果是新的个人账号，先完成 closed testing

## 5. iPhone 上架前要准备

- Apple Developer Program 账号
- App Store Connect 新建应用
- 应用名称、副标题、关键词、描述
- iPhone 截图
- 隐私政策 URL
- App Privacy 信息
- 年龄分级
- 审核说明

## 6. 当前这版产品描述建议

你在商店文案里可以写：

- 双人共享每日待办
- 双人留言板
- 菜单记录与点菜
- 随机转盘帮助决定今天吃什么
- 日历视图查看每日内容

你暂时不要夸大去写：

- 智能推荐算法
- AI 营养分析
- 多端账号体系
- 消息推送

除非这些功能已经真的完成并可审核验证。

## 7. 审核时建议提供的说明

- 这是一个情侣/双人共享餐食计划工具
- 可通过相同房间码实现双设备共享
- 如审核需要，可使用同一房间码在两台测试设备复现同步
- 如未配置云同步，应用仍可本地单机运行
