# 一起选

一个给两个人一起决定“今天吃什么”的跨平台移动端 App，基于 Expo + React Native。

这版已经不是只有本地原型了，项目现在同时支持：

- 本地单机使用
- 可配置的 Supabase 双人实时同步
- Android / iOS 上架前配置准备

## 现在已经有的功能

- 实时日历：按天查看待办、留言和点单记录
- 每日待办：支持新增、标记完成、分配给我/她/共同
- 双人留言板：记录今天想吃什么
- 菜单与点菜：预置菜单，也支持手动加新菜
- 随机转盘：帮助快速做决定
- 本地持久化：关闭 App 后数据仍然保留
- 房间码同步：两台设备填同一个房间码后可共享数据

## 本地运行

```bash
npm install
npx expo start
```

然后用：

- 安卓：Android Studio 模拟器或 Expo Go
- iPhone：Expo Go

## 配置环境变量

先复制一份：

```bash
copy .env.example .env
```

至少需要填这些：

- `EXPO_PUBLIC_IOS_BUNDLE_ID`
- `EXPO_PUBLIC_ANDROID_PACKAGE`
- `EXPO_PUBLIC_SUPPORT_EMAIL`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

如果不填 Supabase，App 仍然可以本地运行，但双人同步不会生效。

填完以后可以先跑一次发布校验：

```bash
npm run validate:release
```

## 配置 Supabase

1. 在 Supabase 新建项目
2. 打开 SQL Editor，执行 [schema.sql](./supabase/schema.sql)
3. 在 Authentication 中开启 Anonymous Sign-Ins
4. 确认 `couple_shared_states` 已加入 Realtime publication
5. 把 Project URL 和 anon key 写进 `.env`

## 构建安装包

这台 Windows 机器不能本地直接出 iOS 原生包，但项目已经带了 `eas.json` 和 [app.config.ts](./app.config.ts)，可以用 EAS 云构建：

```bash
npx eas login
npx eas build -p android --profile preview
npx eas build -p ios --profile preview
```

正式发布包：

```bash
npx eas build -p android --profile production
npx eas build -p ios --profile production
```

## 上架资料

- 隐私政策模板：[PRIVACY_POLICY.md](./docs/PRIVACY_POLICY.md)
- 上架检查清单：[APP_STORE_CHECKLIST.md](./docs/APP_STORE_CHECKLIST.md)

## 当前实现说明

- 当前双人同步基于房间码 + 匿名登录
- 这很适合 MVP、内测和情侣私用
- 如果后面做公开产品，建议继续补账号体系、情侣绑定和更严格的权限控制

## 下一步建议

- 增加账号体系和情侣绑定
- 给菜单加图片、价格、口味偏好和分类筛选
- 增加消息推送
- 增加“本周常吃”和“智能推荐”
