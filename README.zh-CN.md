# VouoA

VouoA 是一个字幕浏览器插件，可配合桌面端使用。

[English](./README.md)

## 主要功能

- 字幕
- 字幕导入（本地 / Jimaku API）
- 通过桌面端的 Yomitan API 查词
- 通过桌面端的 AnkiConnect 制卡

## 额外功能

- 字幕队列
- 划动跳转
- 字幕背景模糊

## 使用方式

VouoA 分成两部分：

- 桌面端
- 插件

### 需要什么

- Windows 电脑（制卡需要 `Anki` 和 `Yomitan API`）
- 支持浏览器插件的浏览器（据我所知 iOS 有 `Gear` 和 `Orion`）

### 开始前

如果要制卡，要开启桌面端。

桌面端主要负责：

- Yomitan API
- AnkiConnect
- 保存 Anki 相关设置

### 如何使用

1. 开启 PC：`VouoA Desktop`、`Yomitan API`、`Anki`
2. 安装插件，左上角是主菜单
3. 透过主菜单或 <img src="./docs/yomitan-button.svg" alt="Yomitan button" width="16" height="16"> 输入电脑地址，以连接 `VouoA Desktop`
4. 导入字幕后即可点击查词

- 截图直接从当前视频画面截取，并随导卡请求发送到桌面端
- 音频由插件提供时间范围和 `source-audio-url`；桌面端会用内置 `ffmpeg` 裁剪音频，优先直接裁剪直链，失败时再回退到 `yt-dlp` + `ffmpeg`

## 提示

- 字幕延迟可以在输入区拖动调整
- 划动跳转区域默认是屏幕上半部分
- 划动跳转可以通过按钮关闭
- 开启辞典CSS 可能会导致查询速度变慢

## 用前须知

桌面端 bridge 会在局域网开放接口，不建议在公共网络环境下使用。
