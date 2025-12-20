import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Flash, Mode, Player, QA } from "./types";
import { parseQuizCsv } from "./csv";
import { useShortcuts } from "./keyboard";
import { StateSync } from "./sync";
import {
  appReducer,
  formatRankText,
  formatTime,
  initialAppState,
  makePlayersFromNames,
  type AppState,
} from "./state";

type ViewMode = "display" | "control";

const getViewMode = (): ViewMode => {
  const hash: string = window.location.hash;
  if (hash.includes("/display")) return "display";
  return "control";
};

const App: React.FC = () => {
  const vm: ViewMode = useMemo(getViewMode, []);
  return vm === "display" ? <DisplayApp /> : <ControlApp />;
};

const DisplayApp: React.FC = () => {
  const [state, setState] = useState<AppState>(initialAppState);

  useEffect(() => {
    const sync = new StateSync();
    const unsubscribe = sync.subscribe((s) => setState(s));
    return () => {
      unsubscribe();
      sync.close();
    };
  }, []);

  const currentQA: QA | null = useMemo(() => {
    if (state.quiz.length === 0) return null;
    return state.quiz[state.qIndex] ?? null;
  }, [state.quiz, state.qIndex]);

  return (
    <div className="containerDisplay">
      <div className="panel">
        <div className="questionBox">
          <div className="headerRow">
            <div className="questionId">
              {currentQA ? `Q: ${currentQA.question_id}（${state.qIndex + 1}/${state.quiz.length}）` : ""}
            </div>
            <div className="badge">表示専用（/#/display）</div>
          </div>

          <div className="questionText">{state.revealQA && currentQA ? currentQA.question : ""}</div>

          {state.revealQA && currentQA && (
            <div className="answerBox">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>答え</div>
              {currentQA.answer}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="gridPlayersWide">
          {state.players.map((p) => {
            const flashing: boolean = state.flash?.playerId === p.id;
            const flashKind: Flash["kind"] | null = flashing ? state.flash!.kind : null;

            const renderBottom = (): React.ReactNode => {
              if (p.status.kind === "win") {
                return (
                  <div className="scoreBand">
                    <div className="scoreWin">{formatRankText(p.status.rank)}</div>
                  </div>
                );
              }
              if (p.status.kind === "lose") {
                return (
                  <div className="scoreBand">
                    <div className="scoreLose">LOSE</div>
                  </div>
                );
              }

              if (state.mode === "nm") {
                return (
                  <div className="scoreBand">
                    <div className="nmCounts">
                      <span className="nmOk">{p.correct}○</span>
                      <span className="nmNg">{p.wrong}×</span>
                    </div>
                  </div>
                );
              }

              return (
                <div className="scoreBand">
                  <div className="scoreValue">{p.score}</div>
                </div>
              );
            };

            return (
              <div key={p.id} className="playerCard">
                {flashing && <div className={`flash ${flashKind === "correct" ? "correct" : "wrong"}`} />}
                <div className="playerNameVertical">{p.name}</div>
                {renderBottom()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ControlApp: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [nameInputs, setNameInputs] = useState<string[]>(Array.from({ length: 8 }, () => ""));
  const [csvError, setCsvError] = useState<string | null>(null);

  const syncRef = useRef<StateSync | null>(null);

  useEffect(() => {
    syncRef.current = new StateSync();
    return () => syncRef.current?.close();
  }, []);

  useEffect(() => {
    syncRef.current?.publish(state);
  }, [state]);

  const currentQA: QA | null = useMemo(() => {
    if (state.quiz.length === 0) return null;
    return state.quiz[state.qIndex] ?? null;
  }, [state.quiz, state.qIndex]);

  const selectedIndex0: number = useMemo(() => {
    if (!state.selectedPlayerId) return -1;
    return state.players.findIndex((p) => p.id === state.selectedPlayerId);
  }, [state.players, state.selectedPlayerId]);

  useShortcuts({
    enabled: true,
    onNext: () => dispatch({ type: "NEXT_Q" }),
    onPrev: () => dispatch({ type: "PREV_Q" }),
    onToggleAnswer: () => dispatch({ type: "TOGGLE_REVEAL" }), // A: 開示
    onSelectPlayerIndex: (index0: number) => {
      const p: Player | undefined = state.players[index0];
      if (!p) return;
      dispatch({ type: "SELECT_PLAYER", playerId: p.id });
    },
    onCorrect: () => dispatch({ type: "APPLY_RESULT", kind: "correct" }),
    onWrong: () => dispatch({ type: "APPLY_RESULT", kind: "wrong" }),
  });

  useEffect(() => {
    if (!state.flash) return;
    const t: number = window.setTimeout(() => dispatch({ type: "SET_FLASH", flash: null }), 1500);
    return () => window.clearTimeout(t);
  }, [state.flash]);

  const onStart = (): void => {
    const players = makePlayersFromNames(nameInputs, 8);
    if (players.length === 0) {
      dispatch({ type: "ADD_LOG", text: "参加者名を1人以上入力してください" });
      return;
    }
    dispatch({ type: "SET_PLAYERS", players });
  };

  const onCsvFile = async (file: File): Promise<void> => {
    try {
      setCsvError(null);
      const quiz: QA[] = await parseQuizCsv(file);
      dispatch({ type: "LOAD_QUIZ", quiz });
      dispatch({ type: "ADD_LOG", text: `CSV読み込み: ${quiz.length}問` });
    } catch (e) {
      const msg: string = e instanceof Error ? e.message : "CSVの読み込みに失敗しました";
      setCsvError(msg);
      dispatch({ type: "ADD_LOG", text: "CSV読み込みに失敗" });
    }
  };

  const setMode = (mode: Mode): void => dispatch({ type: "SET_MODE", mode });

  return (
    <div className="containerControl">
      <div className="panel headerRow">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="badge">Control（/#/control）</div>
          <a className="badge" href="/#/display" target="_blank" rel="noreferrer">
            表示画面を開く（新規タブ）
          </a>
          <div className="badge">ショートカット: N 次 / P 前 / A 開示 / 1-8 選択 / Enter 正解 / Backspace 不正解</div>
          <div className="badge">選択中: {selectedIndex0 >= 0 ? `${selectedIndex0 + 1}番` : "なし"}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label className="btn">
            CSV読み込み
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const f: File | undefined = e.target.files?.[0];
                if (!f) return;
                void onCsvFile(f);
                e.target.value = "";
              }}
            />
          </label>

          <button className="btn" onClick={() => window.location.reload()}>
            リセット（再読み込み）
          </button>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="badge">モード</div>
            <button className={`btn ${state.mode === "simple" ? "primary" : ""}`} onClick={() => setMode("simple")}>
              シンプル（±）
            </button>
            <button className={`btn ${state.mode === "nm" ? "primary" : ""}`} onClick={() => setMode("nm")}>
              N○M×
            </button>

            {state.mode === "nm" && (
              <>
                <label className="badge">
                  N○
                  <input
                    className="input miniInput"
                    type="number"
                    value={state.nmN}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      dispatch({ type: "SET_NM_RULE", n: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="badge">
                  M×
                  <input
                    className="input miniInput"
                    type="number"
                    value={state.nmM}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      dispatch({ type: "SET_NM_RULE", m: Number(e.target.value) })
                    }
                  />
                </label>
              </>
            )}
          </div>

          <div className="badge">Displayはモードに追従します</div>
        </div>
      </div>

      <div className="panel">
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>参加者設定（最大8名）</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            {nameInputs.map((v, i) => (
              <input
                key={i}
                className="input"
                placeholder={`参加者 ${i + 1}`}
                value={v}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const next: string[] = [...nameInputs];
                  next[i] = e.target.value;
                  setNameInputs(next);
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" onClick={onStart}>
              参加者を反映
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="questionBox">
          <div className="headerRow">
            <div className="questionId">
              {currentQA ? `Q: ${currentQA.question_id}（${state.qIndex + 1}/${state.quiz.length}）` : "CSV未読み込み"}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn" disabled={state.quiz.length === 0} onClick={() => dispatch({ type: "PREV_Q" })}>
                前（P）
              </button>
              <button className="btn primary" disabled={state.quiz.length === 0} onClick={() => dispatch({ type: "NEXT_Q" })}>
                次（N）
              </button>
              <button className="btn" disabled={state.quiz.length === 0} onClick={() => dispatch({ type: "TOGGLE_REVEAL" })}>
                {state.revealQA ? "非表示" : "開示"}（A）
              </button>
            </div>
          </div>

          <div className="questionText">{currentQA ? currentQA.question : ""}

          </div>

          {csvError && <div style={{ color: "#ff9b9b" }}>{csvError}</div>}

          {currentQA && (
            <div className="answerBox">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>答え（Controlでは常時表示）</div>
              {currentQA.answer}
            </div>
          )}

          <div style={{ height: 12 }} />

          {state.mode === "simple" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <label className="badge">
                加点
                <input
                  className="input miniInput"
                  type="number"
                  value={state.deltaPlus}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    dispatch({ type: "SET_DELTA", plus: Number(e.target.value) })
                  }
                />
              </label>
              <label className="badge">
                減点
                <input
                  className="input miniInput"
                  type="number"
                  value={state.deltaMinus}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    dispatch({ type: "SET_DELTA", minus: Number(e.target.value) })
                  }
                />
              </label>

              <button className="btn primary" disabled={!state.selectedPlayerId} onClick={() => dispatch({ type: "APPLY_RESULT", kind: "correct" })}>
                正解（Enter）
              </button>
              <button className="btn danger" disabled={!state.selectedPlayerId} onClick={() => dispatch({ type: "APPLY_RESULT", kind: "wrong" })}>
                不正解（Backspace）
              </button>

              <div className="badge">クリック or 1-8キーで回答者選択</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button className="btn primary" disabled={!state.selectedPlayerId} onClick={() => dispatch({ type: "APPLY_RESULT", kind: "correct" })}>
                ○（Enter）
              </button>
              <button className="btn danger" disabled={!state.selectedPlayerId} onClick={() => dispatch({ type: "APPLY_RESULT", kind: "wrong" })}>
                ×（Backspace）
              </button>
              <div className="badge">N={state.nmN}, M={state.nmM}（到達で勝ち抜け/失格）</div>
            </div>
          )}

          <div style={{ height: 12 }} />

          <div className="gridPlayersWide">
            {state.players.map((p, idx) => {
              const selected: boolean = p.id === state.selectedPlayerId;
              return (
                <div
                  key={p.id}
                  className={`playerCardControl ${selected ? "selected" : ""}`}
                  onClick={() => dispatch({ type: "SELECT_PLAYER", playerId: p.id })}
                  title={`ショートカット: ${idx + 1}`}
                  role="button"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div className="badge" style={{ padding: "4px 8px" }}>
                      {idx + 1}
                    </div>
                    {selected && (
                      <div className="badge" style={{ padding: "4px 8px" }}>
                        選択中
                      </div>
                    )}
                  </div>

                  <div style={{ fontWeight: 800, fontSize: 16 }}>{p.name}</div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); dispatch({ type: "SET_STATUS_ACTIVE", playerId: p.id }); }}>
                      Active
                    </button>
                    <button className="btn primary" onClick={(e) => { e.stopPropagation(); dispatch({ type: "SET_STATUS_WIN", playerId: p.id }); }}>
                      勝ち抜け
                    </button>
                    <button className="btn danger" onClick={(e) => { e.stopPropagation(); dispatch({ type: "SET_STATUS_LOSE", playerId: p.id }); }}>
                      失格
                    </button>
                  </div>

                  <div style={{ height: 8 }} />

                  {state.mode === "simple" ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div className="badge" style={{ padding: "4px 8px" }}>得点</div>
                      <input
                        className="scoreEdit"
                        type="number"
                        value={p.score}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => dispatch({ type: "SET_SCORE", playerId: p.id, score: Number(e.target.value) })}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div className="badge" style={{ padding: "4px 8px" }}>○</div>
                      <input
                        className="scoreEdit"
                        type="number"
                        value={p.correct}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          dispatch({ type: "SET_NM_COUNT", playerId: p.id, correct: Number(e.target.value) })
                        }
                      />
                      <div className="badge" style={{ padding: "4px 8px" }}>×</div>
                      <input
                        className="scoreEdit"
                        type="number"
                        value={p.wrong}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          dispatch({ type: "SET_NM_COUNT", playerId: p.id, wrong: Number(e.target.value) })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ height: 12 }} />

          <div className="panel" style={{ padding: 10, background: "#0e141d" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>直近ログ（保存なし）</div>
            <div className="logList">
              {state.logs.length === 0 ? (
                <div style={{ color: "#a7b7cc" }}>まだイベントがありません</div>
              ) : (
                state.logs.map((l) => (
                  <div key={l.id} className="logItem">
                    <span>{l.text}</span>
                    <span style={{ color: "#90a7c2" }}>{formatTime(l.at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
