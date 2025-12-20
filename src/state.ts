import type { Flash, LogEvent, Mode, Player, PlayerStatus, QA } from "./types";

export type AppState = {
  mode: Mode;

  // nmモード設定
  nmN: number; // N○
  nmM: number; // M×

  // 勝ち抜け順位の採番
  nextWinRank: number;

  players: Player[];
  selectedPlayerId: string | null;

  quiz: QA[];
  qIndex: number;
  revealQA: boolean;

  // simpleモードの加減点
  deltaPlus: number;
  deltaMinus: number;

  logs: LogEvent[];
  flash: Flash | null;
};

export type Action =
  | { type: "SET_MODE"; mode: Mode }
  | { type: "SET_NM_RULE"; n?: number; m?: number }
  | { type: "SET_PLAYERS"; players: Player[] }
  | { type: "SELECT_PLAYER"; playerId: string | null }
  | { type: "LOAD_QUIZ"; quiz: QA[] }
  | { type: "NEXT_Q" }
  | { type: "PREV_Q" }
  | { type: "TOGGLE_REVEAL" }
  | { type: "SET_DELTA"; plus?: number; minus?: number }
  | { type: "APPLY_RESULT"; kind: "correct" | "wrong" } // modeに応じて挙動が変わる
  | { type: "SET_SCORE"; playerId: string; score: number } // simple用
  | { type: "SET_NM_COUNT"; playerId: string; correct?: number; wrong?: number } // nm用
  | { type: "SET_STATUS_ACTIVE"; playerId: string }
  | { type: "SET_STATUS_WIN"; playerId: string }
  | { type: "SET_STATUS_LOSE"; playerId: string }
  | { type: "ADD_LOG"; text: string }
  | { type: "SET_FLASH"; flash: Flash | null };

const uid = (): string => crypto.randomUUID();

const clampInt = (n: number): number => {
  // Why not: 小数を許す設計もあるが、運用は整数なので切り捨て
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
};

const clampNonNegInt = (n: number): number => Math.max(0, clampInt(n));

const pushLog = (logs: LogEvent[], text: string, limit: number = 8): LogEvent[] => {
  const next: LogEvent[] = [{ id: uid(), at: Date.now(), text }, ...logs];
  return next.slice(0, limit);
};

const defaultStatus = (): PlayerStatus => ({ kind: "active" });

export const initialAppState: AppState = {
  mode: "simple",
  nmN: 3,
  nmM: 2,
  nextWinRank: 1,

  players: [],
  selectedPlayerId: null,

  quiz: [],
  qIndex: 0,
  revealQA: false,

  deltaPlus: 1,
  deltaMinus: -1,

  logs: [],
  flash: null,
};

export const makePlayersFromNames = (names: string[], maxPlayers: number = 8): Player[] => {
  /**
   * 入力された名前配列から参加者データを作成する
   * How: 空欄を除去して最大人数に制限、スコア/○×/状態を初期化する
   */
  const trimmed: string[] = names.map((s) => s.trim()).filter((s) => s.length > 0);
  const limited: string[] = trimmed.slice(0, maxPlayers); // Why not: 無制限は表示崩れ・操作事故の原因
  return limited.map((name) => ({
    id: uid(),
    name,
    score: 0,
    correct: 0,
    wrong: 0,
    status: defaultStatus(),
  }));
};

const formatRank = (rank: number): string => {
  const n: number = Math.max(1, clampInt(rank));
  const mod100: number = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10: number = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
};

const setPlayer = (players: Player[], playerId: string, f: (p: Player) => Player): Player[] =>
  players.map((p) => (p.id === playerId ? f(p) : p));

const isDecided = (p: Player): boolean => p.status.kind === "win" || p.status.kind === "lose";

export const appReducer = (state: AppState, action: Action): AppState => {
  /**
   * 状態遷移を一箇所に集約する
   * How: modeに応じてAPPLY_RESULTの挙動を切り替える
   */
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode, logs: pushLog(state.logs, `モード: ${action.mode}`) };

    case "SET_NM_RULE":
      return {
        ...state,
        nmN: action.n !== undefined ? Math.max(1, clampInt(action.n)) : state.nmN,
        nmM: action.m !== undefined ? Math.max(1, clampInt(action.m)) : state.nmM,
      };

    case "SET_PLAYERS":
      return {
        ...state,
        players: action.players,
        selectedPlayerId: action.players[0]?.id ?? null,
        nextWinRank: 1,
      };

    case "SELECT_PLAYER":
      return { ...state, selectedPlayerId: action.playerId };

    case "LOAD_QUIZ":
      return { ...state, quiz: action.quiz, qIndex: 0, revealQA: false };

    case "NEXT_Q": {
        if (state.quiz.length === 0) return state;

        // How: 開示していない状態では次へ進めない（表示側の「出題済み」を担保）
        if (!state.revealQA) {
            return { ...state, logs: pushLog(state.logs, "次の問題へ進むには開示（A）が必要です") };
        }

        const nextIndex: number = Math.min(state.qIndex + 1, state.quiz.length - 1);
        return { ...state, qIndex: nextIndex, revealQA: false };
        }

    case "PREV_Q": {
        if (state.quiz.length === 0) return state;

        // Why not: 戻る時も同様にガード（運用上の事故を減らす）
        if (!state.revealQA) {
            return { ...state, logs: pushLog(state.logs, "前の問題へ戻るには開示（A）が必要です") };
        }

        const prevIndex: number = Math.max(state.qIndex - 1, 0);
        return { ...state, qIndex: prevIndex, revealQA: false };
    }


    case "TOGGLE_REVEAL":
      return { ...state, revealQA: !state.revealQA };

    case "SET_DELTA":
      return {
        ...state,
        deltaPlus: action.plus !== undefined ? clampInt(action.plus) : state.deltaPlus,
        deltaMinus: action.minus !== undefined ? clampInt(action.minus) : state.deltaMinus,
      };

    case "APPLY_RESULT": {
      if (!state.selectedPlayerId) return state;
      const pid: string = state.selectedPlayerId;

      const target: Player | undefined = state.players.find((p) => p.id === pid);
      if (!target) return state;

      // Why not: 勝ち抜け/失格後の加点事故を防ぐ（手動でactiveに戻してから操作）
      if (isDecided(target)) {
        return { ...state, logs: pushLog(state.logs, "決着済みのプレイヤーには反映できません") };
      }

      if (state.mode === "simple") {
        const delta: number = action.kind === "correct" ? state.deltaPlus : state.deltaMinus;
        const players: Player[] = setPlayer(state.players, pid, (p) => ({ ...p, score: clampInt(p.score + delta) }));
        const sign: string = delta >= 0 ? `+${delta}` : `${delta}`;
        const text: string = `${target.name} ${action.kind === "correct" ? "正解" : "不正解"} ${sign}`;

        return {
          ...state,
          players,
          logs: pushLog(state.logs, text),
          flash: { playerId: pid, kind: action.kind },
        };
      }

      // nm モード
      const n: number = Math.max(1, clampInt(state.nmN));
      const m: number = Math.max(1, clampInt(state.nmM));

      let players: Player[] = state.players;
      let nextWinRank: number = state.nextWinRank;

      players = setPlayer(players, pid, (p) => {
        const correct: number = action.kind === "correct" ? clampNonNegInt(p.correct + 1) : p.correct;
        const wrong: number = action.kind === "wrong" ? clampNonNegInt(p.wrong + 1) : p.wrong;

        let status: PlayerStatus = p.status;

        // How: N到達で勝ち抜け、M到達で失格（同時到達の可能性は低いが、先に勝ち抜け判定）
        if (correct >= n) {
          status = { kind: "win", rank: nextWinRank };
        } else if (wrong >= m) {
          status = { kind: "lose" };
        }

        return { ...p, correct, wrong, status };
      });

      const updated: Player | undefined = players.find((p) => p.id === pid);
      if (!updated) return state;

      const baseText: string =
        action.kind === "correct"
          ? `${updated.name} ○（${updated.correct}/${n}）`
          : `${updated.name} ×（${updated.wrong}/${m}）`;

      let logs = pushLog(state.logs, baseText);

      if (updated.status.kind === "win" && target.status.kind !== "win") {
        logs = pushLog(logs, `${updated.name} 勝ち抜け ${formatRank(updated.status.rank)}`);
        nextWinRank += 1;
      } else if (updated.status.kind === "lose" && target.status.kind !== "lose") {
        logs = pushLog(logs, `${updated.name} 失格 LOSE`);
      }

      return {
        ...state,
        players,
        nextWinRank,
        logs,
        flash: { playerId: pid, kind: action.kind },
      };
    }

    case "SET_SCORE": {
      const players: Player[] = setPlayer(state.players, action.playerId, (p) => ({
        ...p,
        score: clampInt(action.score),
      }));
      const name: string = state.players.find((p) => p.id === action.playerId)?.name ?? "unknown";
      return { ...state, players, logs: pushLog(state.logs, `${name} 得点を手動修正`) };
    }

    case "SET_NM_COUNT": {
      const players: Player[] = setPlayer(state.players, action.playerId, (p) => ({
        ...p,
        correct: action.correct !== undefined ? clampNonNegInt(action.correct) : p.correct,
        wrong: action.wrong !== undefined ? clampNonNegInt(action.wrong) : p.wrong,
      }));
      const name: string = state.players.find((p) => p.id === action.playerId)?.name ?? "unknown";
      return { ...state, players, logs: pushLog(state.logs, `${name} ○×を手動修正`) };
    }

    case "SET_STATUS_ACTIVE": {
      const players: Player[] = setPlayer(state.players, action.playerId, (p) => ({ ...p, status: { kind: "active" } }));
      const name: string = state.players.find((p) => p.id === action.playerId)?.name ?? "unknown";
      return { ...state, players, logs: pushLog(state.logs, `${name} 状態: active`) };
    }

    case "SET_STATUS_WIN": {
      const rank: number = state.nextWinRank;
      const players: Player[] = setPlayer(state.players, action.playerId, (p) => ({ ...p, status: { kind: "win", rank } }));
      const name: string = state.players.find((p) => p.id === action.playerId)?.name ?? "unknown";
      return { ...state, players, nextWinRank: rank + 1, logs: pushLog(state.logs, `${name} 手動で勝ち抜け ${formatRank(rank)}`) };
    }

    case "SET_STATUS_LOSE": {
      const players: Player[] = setPlayer(state.players, action.playerId, (p) => ({ ...p, status: { kind: "lose" } }));
      const name: string = state.players.find((p) => p.id === action.playerId)?.name ?? "unknown";
      return { ...state, players, logs: pushLog(state.logs, `${name} 手動で失格 LOSE`) };
    }

    case "ADD_LOG":
      return { ...state, logs: pushLog(state.logs, action.text) };

    case "SET_FLASH":
      return { ...state, flash: action.flash };

    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
};

export const formatTime = (ms: number): string => {
  const d: Date = new Date(ms);
  const hh: string = String(d.getHours()).padStart(2, "0");
  const mm: string = String(d.getMinutes()).padStart(2, "0");
  const ss: string = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

export const formatRankText = (rank: number): string => formatRank(rank);
