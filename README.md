# Quiz Scoreboard / クイズ得点表示アプリ

競技クイズ向けの **得点・参加者・問題表示アプリ** です。  
PC 1 台で起動し、**スクリーン表示用（Display）** と **操作・管理用（Control）** を切り替えて使用します。

- 最大 8 人まで対応
- 縦書き名前表示・大画面表示に最適化
- シンプル得点（±）／N◯M× 方式に対応
- CSV から問題読み込み可能
- データ保存なし（1 セッション完結型）

---

## デモ構成

- **Display 画面**  
  観客・回答者向けの表示専用画面  
  得点・名前・問題を大きく表示

- **Control 画面**  
  出題・正誤判定・得点操作・参加者設定用画面  
  Display と同一 PC 上で操作可能

---

## 使用技術

- Node.js（推奨 v18 以上）
- React + TypeScript
- Vite
- CSS Grid / Flexbox
- PapaParse（CSV 読み込み）

---

## 環境構築

### 1. Node.js の確認
```bash
node -v
```
### 2. 環境の作成
```bash
cd quiz-scoreboard
npm install
npm run dev
```
起動後、ブラウザで以下にアクセス：

http://localhost:5173/

→ Control 画面

http://localhost:5173/#/display

→ Display 画面（スクリーン用）

## 使い方（基本フロー）

### ① 参加者設定
- Control 画面上部の「参加者設定」で参加者名を入力します
- 最大 8 名まで設定可能です
- 「参加者を反映」を押すと Display 画面に即時反映されます

---

### ② 問題の読み込み
CSV ファイルを読み込むことで問題を管理できます。

#### CSV フォーマット
```csv
question_id,question,answer
1,日本で一番高い山は？,富士山
2,日本で一番広い湖は？,琵琶湖
```

### ③ 出題
- 「表示」ボタンで問題と答えを Display 側に開示
- Display 側に表示されていない状態では次の問題に進めません

### ④ 正誤判定・得点操作
- 回答者を選択
- 手動による変更も可能