<p align="center">
  <img src="icon/128.png" width="128" height="128" alt="カリンバ練習" />
</p>

<h1 align="center">🎵 カリンバ練習</h1>

<p align="center">
  ブラウザで遊べる17鍵カリンバ練習アプリ<br />
  <a href="https://munron.github.io/kalimba/"><b>👉 ライブデモを開く</b></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PWA-ready-4ec9b0" alt="PWA"/>
  <img src="https://img.shields.io/badge/no--build-vanilla%20JS-c0884f" alt="vanilla JS"/>
  <img src="https://img.shields.io/badge/Tone.js-14.8-e8b06b" alt="Tone.js"/>
</p>

---

## ✨ 特徴

- 🎼 **フリー演奏** — 17鍵すべてに対応、横スワイプでグリッサンドも可
- 🎯 **曲練習モード** — 上から落ちてくるノーツに合わせてタップ、Perfect/Good/Miss判定とスコア表示
- 🎧 **自動演奏（視聴）** — お手本演奏で耳コピ・運指確認
- 🎹 **本物のカリンバサンプル音源** — C3〜C5の実機録音をピッチクラス毎に分離した `Tone.Sampler` で再生（同じ音は必ず同じ素材から派生）
- 📱 **PWA対応** — スマホで「ホーム画面に追加」してネイティブアプリのように起動可能
- 🌗 **横画面モード** — メニュー押下式モーダルでUIを隠して画面を最大活用

## 📚 収録曲

| タイトル | 作曲 |
|---|---|
| 海の見える街 | 久石譲（魔女の宅急便より） |

## 🎹 操作方法

### スマホ（タッチ）
- 鍵をタップ → 単音
- 横スワイプ → 連続演奏（グリッサンド）
- マルチタッチ → 複数音同時

### PC（キーボード）
画面左 → 右の17鍵に対応するキー:
```
R A S D F X C V B N M , H J K U I
```

## 🛠 ローカルで動かす

ビルド不要、純粋な静的ファイルです。

```bash
git clone https://github.com/munron/kalimba.git
cd kalimba
python3 -m http.server 8080
# ブラウザで http://localhost:8080 を開く
```

> **HTTPS必須**: 本番環境では Web Audio API の制約上 HTTPS 経由でないと音が鳴りません。GitHub Pages / Cloudflare Pages 等は自動でHTTPS化されます。

## 📁 ファイル構成

```
kalimba/
├── index.html              # マークアップ（モーダル含む）
├── styles.css              # 配色テーマ・カリンバUI・落下ノーツ等
├── app.js                  # メインロジック（Tone.js, 入力, アニメーション）
├── songs.js                # 曲データ（拍ベース定義）
├── manifest.webmanifest    # PWAマニフェスト
├── icon/                   # アプリアイコン（128 / 1024）
└── sound/                  # カリンバ実機サンプル（C3〜C5）
```

## 🎨 デザイン

ダーク+ウッド調のテーマ。マスコットキャラクターをモチーフに、舌（白色クリーム）/ 本体（ハニーグラデーション）/ ハート型サウンドホールでカリンバ感を表現しています。

## 🔧 技術スタック

- **音声合成**: [Tone.js](https://tonejs.github.io/) v14.8（CDN直読み込み）
- **フレームワーク**: なし（vanilla JavaScript）
- **ビルドツール**: なし
- **デプロイ**: GitHub Pages

## 🙏 クレジット

- カリンバ音源: [hanamoto-project.com](https://hanamoto-project.com/other/soudfont-kalimba.html)
- 楽曲: 久石譲「海の見える街」/ アレンジは [kalimbatabs.net](https://www.kalimbatabs.net/) のタブ譜を参照

## 📄 ライセンス

ソースコードは MIT License。音源・楽曲データは各提供元のライセンスに従います。
