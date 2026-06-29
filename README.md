# VouoA

VouoA is a subtitle browser extension that works together with the desktop app.

[简体中文说明](./README.zh-CN.md)

## Main Features

- Subtitle display
- Subtitle import from local files or the Jimaku API
- Word lookup through the desktop app's Yomitan API
- Anki card export through the desktop app's AnkiConnect bridge

## Extra Features

- Subtitle queue
- Swipe jump
- Subtitle background blur

## How It Works

VouoA has two parts:

- Desktop app
- Browser extension

### Requirements

- A Windows PC (`Anki` and `Yomitan API` are required for card export)
- A browser that supports extensions
  - On iOS, browsers such as `Gear` and `Orion` may work

### Before You Start

If you want to export Anki cards, the desktop app needs to be running.

The desktop app mainly handles:

- Yomitan API access
- AnkiConnect communication
- Saving Anki-related settings

### Usage

1. Start your PC-side tools: `VouoA Desktop`, `Yomitan API`, and `Anki`
2. Install the extension; the main menu is in the top-left corner
3. Enter your PC address through the main menu or <img src="./docs/yomitan-button.svg" alt="Yomitan button" width="16" height="16"> to connect to `VouoA Desktop`
4. Import subtitles, then click subtitle text to look up words

- Screenshots are captured directly from the current video frame and sent to the desktop app with the export request
- For audio, the extension sends the time range and `source-audio-url`; the desktop app first tries direct source clipping, then falls back to `yt-dlp` if needed

## Tips

- Subtitle delay can be adjusted by dragging in the input area
- The swipe jump area is in the upper half of the screen by default
- Swipe jump can be turned off with its button

## Warning

The desktop bridge opens local network endpoints, so it is not recommended to use VouoA on public or untrusted networks.
