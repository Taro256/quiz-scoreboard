import { useEffect } from "react";

export type ShortcutHandlers = {
  enabled: boolean;
  onNext: () => void;
  onPrev: () => void;
  onToggleAnswer: () => void;
  onSelectPlayerIndex: (index0: number) => void;
  onCorrect: () => void;
  onWrong: () => void;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag: string = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
};

export const useShortcuts = (handlers: ShortcutHandlers): void => {
  /**
   * キーボードショートカットを登録する
   * How: keydownをdocumentに貼り、入力中はショートカットを無視する
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!handlers.enabled) return;
      if (isEditableTarget(e.target)) return; // Why not: 入力中にEnterで加点される事故を防ぐ

      const key: string = e.key;

      if (key === "n" || key === "N") {
        e.preventDefault();
        handlers.onNext();
        return;
      }
      if (key === "p" || key === "P") {
        e.preventDefault();
        handlers.onPrev();
        return;
      }
      if (key === "a" || key === "A") {
        e.preventDefault();
        handlers.onToggleAnswer();
        return;
      }
      if (key >= "1" && key <= "8") {
        e.preventDefault();
        handlers.onSelectPlayerIndex(Number(key) - 1);
        return;
      }
      if (key === "Enter") {
        e.preventDefault();
        handlers.onCorrect();
        return;
      }
      if (key === "Backspace") {
        e.preventDefault();
        handlers.onWrong();
        return;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
};
