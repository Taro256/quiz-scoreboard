export type Mode = "simple" | "nm";

export type PlayerStatus =
  | { kind: "active" }
  | { kind: "win"; rank: number }
  | { kind: "lose" };

export type Player = {
  id: string;
  name: string;

  // simpleモード用
  score: number;

  // nmモード用
  correct: number; // ○
  wrong: number; // ×

  status: PlayerStatus;
};

export type QA = {
  question_id: string;
  question: string;
  answer: string;
};

export type LogEvent = {
  id: string;
  at: number;
  text: string;
};

export type Flash = {
  playerId: string;
  kind: "correct" | "wrong";
  // Why not: Flashにタイムアウトを持たせるより、UI側でsetTimeout管理の方が単純
};

export type DisplayComment = string;