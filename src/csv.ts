import Papa from "papaparse";
import type { QA } from "./types";

type QARecord = {
  question_id?: string;
  question?: string;
  answer?: string;
};

export const parseQuizCsv = async (file: File): Promise<QA[]> => {
  /**
   * CSVをQA配列に変換する
   * How: papaparseでheader行を利用し、必要カラムのみ取り出す
   */
  const text: string = await file.text();

  const result = Papa.parse<QARecord>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    // Why not: エラー詳細を全部UIに出すと運用時にうるさいため、最初は1つに絞る
    throw new Error(`CSVの解析に失敗しました: ${result.errors[0]?.message ?? "unknown error"}`);
  }

  const rows: QA[] = (result.data ?? [])
    .map((r) => ({
      question_id: (r.question_id ?? "").toString().trim(),
      question: (r.question ?? "").toString(),
      answer: (r.answer ?? "").toString(),
    }))
    .filter((r) => r.question_id.length > 0 || r.question.length > 0 || r.answer.length > 0);

  if (rows.length === 0) {
    throw new Error("CSVに有効な行がありません（question_id, question, answer を確認してください）");
  }

  return rows;
};
