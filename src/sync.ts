import type { AppState } from "./state";

const CHANNEL_NAME: string = "quiz-scoreboard-sync";

/**
 * Control/Display間で状態を同期する
 * How: BroadcastChannelでstateスナップショットを配信する（同一PCの別タブ想定）
 */
export class StateSync {
  private readonly ch: BroadcastChannel;

  constructor() {
    this.ch = new BroadcastChannel(CHANNEL_NAME);
  }

  public publish(state: AppState): void {
    // Why not: 差分同期も可能だが、MVPではスナップショットが一番安全でバグりにくい
    this.ch.postMessage({ type: "STATE", state });
  }

  public subscribe(onState: (state: AppState) => void): () => void {
    const handler = (ev: MessageEvent): void => {
      const data: unknown = ev.data;
      if (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        (data as { type: unknown }).type === "STATE" &&
        "state" in data
      ) {
        onState((data as { state: AppState }).state);
      }
    };

    this.ch.addEventListener("message", handler);
    return () => this.ch.removeEventListener("message", handler);
  }

  public close(): void {
    this.ch.close();
  }
}
