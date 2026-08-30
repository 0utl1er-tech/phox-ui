"use client";

// Phase 27a: キャンペーン受信者の選択状態ストア。
// Book 一覧・検索結果のページングやページ遷移をまたいで選択を保持する。
// モジュールスコープの Zustand ストアで十分 (localStorage 永続化はしない)。

import { create } from "zustand";

export interface SelectedCustomerInfo {
  name: string;
  /** メールアドレス。検索結果由来などで不明な場合は空文字。 */
  email: string;
}

interface CampaignSelectionState {
  /** customerId → 表示用情報 */
  selected: Map<string, SelectedCustomerInfo>;
  toggle: (id: string, info: SelectedCustomerInfo) => void;
  selectMany: (entries: [string, SelectedCustomerInfo][]) => void;
  deselectMany: (ids: string[]) => void;
  clear: () => void;
}

export const useCampaignSelectionStore = create<CampaignSelectionState>((set) => ({
  selected: new Map(),

  toggle: (id, info) =>
    set((s) => {
      const next = new Map(s.selected);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, info);
      }
      return { selected: next };
    }),

  selectMany: (entries) =>
    set((s) => {
      const next = new Map(s.selected);
      for (const [id, info] of entries) {
        next.set(id, info);
      }
      return { selected: next };
    }),

  deselectMany: (ids) =>
    set((s) => {
      const next = new Map(s.selected);
      for (const id of ids) {
        next.delete(id);
      }
      return { selected: next };
    }),

  clear: () => set({ selected: new Map() }),
}));

/** 選択件数だけ購読する軽量フック (FloatingSelectionBar 等で使用)。 */
export const useCampaignSelectionCount = () =>
  useCampaignSelectionStore((s) => s.selected.size);
