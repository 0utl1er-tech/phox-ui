# ステップ配信の文面 閲覧・編集 — 設計ドキュメント

**対象リポ**: phox-ui / phox-customer / phox-e2e
**ステータス**: implementing
**最終更新**: 2026-10-17
**検討メモ**: ~/work/phox-campaign-share/ステップ配信_閲覧編集機能_検討メモ.md

---

## 1. 目的

キャンペーン詳細ページ (`/campaigns/[campaign_id]`) で、ステップ配信（1 通目 +
フォローアップ）の件名・待機日数・本文を **閲覧** し、必要なら **編集** できる
ようにする。現状は作成画面 (`/campaigns/new`) にしか本文の入力欄がなく、
作成後の文面は DB を直接読むしかない。

## 2. 採用した方針（検討メモの推奨案）

| 論点 | 決定 |
|---|---|
| running 中の直接編集 | 認めない。UI で「一時停止 → 編集 → 再開」を一体化する |
| 1 通目の件名 | 送信済み受信者が 1 件以上いればロック（本文は変更可） |
| ステップ削除 | 受信者の max(current_step) 以下のステップは削除不可 |
| 編集履歴 | 対象外（今回は入れない） |
| ステップ別送信数 | 対象外 |
| wait_days 変更 | 待機中受信者の `next_step_at` は再計算しない（次の送信判定から反映）。UI の注記で明示 |
| フォローアップの全削除 | 既存 API が `followups` 空 = 変更なしのため、**今回は不可**。編集時は最後の 1 通の削除ボタンを無効化する |

## 3. データとAPI（変更点）

### 3.1 phox-customer

**`CampaignStats` に `max_sent_step` を追加**（proto + sqlc）。
「何通目まで誰かに送ったか」を 1 つの数で表し、backend のガードと UI の
ロック表示が同じ値を見るようにする。

```proto
message CampaignStats {
  ...
  int32 waiting_followup = 12;
  // 送信済み受信者の current_step の最大値。0 = まだ誰にも送っていない。
  // 1 通目の件名ロック / ステップ削除ガードの判定に使う。
  int32 max_sent_step = 13;
}
```

`db/query/campaign.sql` の `GetCampaignStats` に 1 列追加:

```sql
  COALESCE(max(current_step) FILTER (WHERE sent_at IS NOT NULL), 0)::int AS max_sent_step
```

`internal/service/campaign/helper.go` の `campaignToProto` で `MaxSentStep` を詰める。

**`UpdateCampaign` のガード** (`internal/service/campaign/update_campaign.go`)。
status チェック（draft/paused のみ）の直後、DB を書く前に判定する。
判定ロジックは副作用のない関数に切り出してユニットテストする。

```go
// update_guard.go
type stepProgress struct {
    SentCount   int64 // 1 通以上送った受信者数 (stats.sent)
    MaxSentStep int32 // stats.max_sent_step
}

// validateStepEdit は、送信実績のあるキャンペーンの文面編集を検査する。
//   - 1 件以上送信済みで subject を現在値と異なる値に変えようとした → FailedPrecondition
//   - followups を指定し、len(followups)+1 < MaxSentStep → FailedPrecondition
//     (= 誰かが受け取ったステップを消そうとしている)
// どちらにも当たらなければ nil。
func validateStepEdit(currentSubject string, newSubject *string, followupCount int, p stepProgress) error
```

エラーメッセージ（日本語、UI にそのまま表示される）:

| ケース | message |
|---|---|
| 件名変更 | `送信済みの受信者がいるため、1通目の件名は変更できません（本文は変更できます）` |
| ステップ削除 | `{MaxSentStep}通目まで送信済みの受信者がいるため、{MaxSentStep}通目以前のステップは削除できません` |

- `newSubject == nil` または現在値と同じ文字列 → 件名ガードは発動しない。
- `followupCount == 0` → ステップガードは発動しない（API 仕様で「変更なし」）。
- `SentCount == 0` → どちらも発動しない（draft の自由編集を壊さない）。
- 進捗値は既存の `GetCampaignStats` から取る（新しいクエリは増やさない）。
  subject 変更もしくは followups 指定があるときだけクエリを発行する。

テスト: `internal/service/campaign/update_guard_test.go` に表駆動で
「未送信なら何でも通る」「件名同値は通る」「件名変更は拒否」「max=3 で 2 通構成
(followups 1 件) は拒否」「max=3 で 3 通構成は通る」「max=3 で 4 通目削除は通る」
の 6 ケース以上。

### 3.2 phox-ui のデータ層

- `src/lib/campaign.ts`: `CampaignStats.maxSentStep: number` を追加し、
  `normalizeStats` で `max_sent_step ?? maxSentStep ?? 0` を読む。
- 既存の `followups[]`・`subject`・`body` はそのまま使う。

## 4. UI 設計（phox-ui）

### 4.1 共通ヘルパー `src/lib/campaign-preview.ts`

作成画面の `previewVars` / `renderPreview` を切り出して両画面で共用する。

```ts
export interface SamplePreviewInput {
  senderName: string;
  senderMail: string;
  /** 受信者の実データがあれば (作成画面)。無ければ固定サンプル。 */
  customerName?: string;
  customerEmail?: string;
  /** 受信者の custom_fields サンプル (作成画面のみ)。 */
  fieldSample?: Record<string, string>;
  /** 参照キーの補完に使う本文群 (件名+本文すべて)。 */
  templates: string[];
}
export function buildSampleVars(input: SamplePreviewInput): TemplateVars;
/** applyTemplate + {{unsubscribe_url}} を "https://.../u/xxxxx (実送信時に挿入)" に置換 */
export function renderCampaignPreview(text: string, vars: TemplateVars): string;
/** 2 通目以降で件名が空なら "Re: <1 通目の件名>" を返す (worker と同じ規則) */
export function effectiveStepSubject(stepNo: number, subject: string, firstSubject: string): string;
```

固定サンプル: 山田 太郎 / 株式会社サンプル / taro@example.com / 03-0000-0000 /
today = todayJST()。未定義の `{{fields.x}}` は `(サンプル: x)`。

### 4.2 共通コンポーネント `src/components/crm/campaign/CampaignStepsEditor.tsx`

作成画面のフォローアップ入力部（`followups.map(...)` 〜「フォローアップを追加」
ボタン）をそのまま切り出す。見た目・文言は現状維持。

```ts
export interface FollowupDraft { waitDays: number; subject: string; body: string }
export const MAX_FOLLOWUPS = 5;
export function followupsValid(followups: FollowupDraft[]): boolean;

interface Props {
  followups: FollowupDraft[];
  onChange: (next: FollowupDraft[]) => void;
  renderPreview: (text: string) => string;
  /**
   * この通数以下のステップは削除不可 (= campaign.stats.maxSentStep)。
   * 該当ステップの削除ボタンを disabled にし title で理由を出す。
   */
  lockedThroughStep?: number;
  /** true なら最後の 1 通の削除を禁止する (編集時: API が全削除を表現できない) */
  disallowEmpty?: boolean;
  disabled?: boolean;
}
```

- 入力 id は現状どおり `followup-subject-{i}` / `followup-body-{i}`、
  待機日数の aria-label は `{i+2}通目の待機日数`。
- 削除不可の title: `{n}通目は送信済みの受信者がいるため削除できません` /
  `フォローアップを 0 通にはできません`。
- 作成画面 (`/campaigns/new`) はこのコンポーネントを使う形に置き換え、
  ローカルの `FollowupDraft` / `MAX_FOLLOWUPS` / `followupsValid` を削除する。
  見出し「フォローアップ (返信が無かった人への追いメール)」と説明文は作成画面に残す。

### 4.3 配信内容セクション `src/components/crm/campaign/CampaignContentSection.tsx`

詳細ページの **設定サマリーの直下、テスト送信の上** に置く。
`<section data-testid="campaign-content">`、見出しは `<h2>配信内容</h2>`。

```ts
interface Props {
  campaign: Campaign;
  /** UpdateCampaign / PauseCampaign / StartCampaign を呼ぶ (詳細ページの callApi) */
  callApi: (method: string, payload: Record<string, unknown>) => Promise<any>;
  onCampaignChange: (c: Campaign) => void;
  senderName: string;
  senderMail: string;
}
```

**閲覧モード**

- ヘッダ行: 見出し「配信内容」、右側に
  - チェックボックス `サンプル値で表示`（`<label>` で紐付け。OFF = テンプレートのまま表示）
  - ボタン `文面を編集`（下記の可否ルール）
- ステップごとに `<details data-testid="campaign-step-{n}">`（1 通目は open、以降は閉）
  - `<summary>`: `{n}通目` のピル + 2 通目以降は `前の送信から{d}日後` + 件名
  - 中身: 「件名」行、「本文」(`whitespace-pre-wrap`)、右上に `文面をコピー` ボタン
    (aria-label `{n}通目の文面をコピー`)。クリックで
    `件名: {件名}\n\n{本文}` を `navigator.clipboard.writeText`、2 秒間だけ
    ラベルを `コピーしました` にする。チェックボックス ON のときはサンプル値で
    展開した文面をコピーする。
  - 2 通目以降で件名が空なら `Re: {1通目の件名}` を表示し、脇に
    `（1通目への返信として送信）` を小さく添える。
- セクション末尾の注記:
  `すべてのメールの末尾に送信者情報と配信停止 URL のフッターが自動で追記されます。`

**「文面を編集」の可否**

| status | 挙動 |
|---|---|
| draft / paused | すぐ編集モードへ |
| running | 確認ダイアログ → `PauseCampaign` → 成功したら編集モードへ |
| completed / cancelled | ボタン disabled、title `完了・中止したキャンペーンは編集できません` |

確認ダイアログは `@/components/ui/dialog`（`role="dialog"`）を使う。
- 見出し: `編集のため一時停止します`
- 本文: `文面を編集するにはキャンペーンを一時停止します。送信中の 1 通は送り切ってから停止します。編集後に「再開」を押すと配信が再開されます。`
- ボタン: `一時停止して編集`（primary）/ `キャンセル`

**編集モード**（閲覧と同じ場所にフォームを出す。ページ遷移しない）

- 1 通目: 件名 `<Input id="campaign-edit-subject">`、本文 `<Textarea id="campaign-edit-body" rows=12>`
  - `campaign.stats.sent > 0` なら件名は disabled にし、下に
    `送信済みの受信者がいるため、1通目の件名は変更できません` を出す
- フォローアップ: `CampaignStepsEditor`（`lockedThroughStep = stats.maxSentStep`、
  `disallowEmpty = 元の followups.length > 0`）
- 注記: `待機日数を変えても、すでに送信予定が決まっている受信者の日時は変わりません。`
- ボタン: `保存`（primary、本文空 or followups 不正で disabled）/ `キャンセル`
- 保存 = `UpdateCampaign { id, subject?, body, followups }`
  - 件名がロックされている場合は `subject` を送らない
  - `followups` は `{ wait_days, subject, body }` の配列。空配列なら送らない
  - 成功: `onCampaignChange(normalizeCampaign(data.campaign))`、閲覧モードに戻る。
    status が paused なら緑の帯で
    `保存しました。配信を再開するには「再開」を押してください。` と
    ボタン `再開`（`StartCampaign` → `onCampaignChange`）を出す。
    draft のときは `保存しました。` のみ。
  - 失敗: backend の message を赤字で表示（編集モードのまま）

### 4.4 詳細ページ `src/app/(crm)/campaigns/[campaign_id]/page.tsx`

- `CampaignContentSection` を設定サマリーの直下に挿入。
- `senderName/senderMail` は `useAuthStore` の `user?.name / user?.email`。
- 既存のシーケンスピル表示（設定サマリー内）は残す。

### 4.5 文言規約

ja-ui-copy スキルに従う（ボタンは名詞止め、状態は漢語、説明は 1 文）。
カード左端の色線・過度な角丸などの装飾は加えない。既存ページの
`bg-white border rounded-xl p-4` に合わせる。

## 5. E2E（phox-e2e）

`specs/campaign/step-content.md` + `tests/campaign/step-content.spec.ts`。
Page Object は `pages/CampaignDetailPage.ts`（新規: 既存 worktree 版を取り込み
配信内容用のロケータを追加）。

準備は Connect API で行う（ウィザードは別スペックの範囲）:
1. `MailboxService/CreateMailbox` で送信元を 1 件作成
2. 顧客 1 件を UI で作成し代表メールを付ける（既存ヘルパー流用）、または
   `CustomerService` の API で作成
3. `CampaignService/CreateCampaign` に `followups: [{wait_days: 3, subject: "", body: ...}, {wait_days: 5, subject: "2通目件名", body: ...}]`
   と送信窓 0〜24 時・全曜日・sender 入りで下書きを作る

シナリオ:

1. **閲覧**: 詳細ページに `配信内容` 見出し、`campaign-step-1..3` が出る。
   2 通目の件名が `Re: {1通目の件名}`、3 通目が指定件名。
   `サンプル値で表示` を ON にすると本文の `{{customer_name}}` が `山田 太郎` に変わる。
   `文面をコピー` を押すとラベルが `コピーしました` に変わる
   （clipboard 権限は `context.grantPermissions(["clipboard-read","clipboard-write"])`）。
2. **一時停止 → 編集 → 再開**: `開始` → ステータス `実行中` → `文面を編集` →
   ダイアログ `編集のため一時停止します` → `一時停止して編集` → ステータス
   `一時停止` かつ `campaign-edit-body` が見える → 2 通目の本文を書き換えて
   `保存` → 帯 `保存しました。配信を再開するには「再開」を押してください。` →
   閲覧モードの 2 通目本文が新しい文になっている → セクション内の `再開` →
   ステータス `実行中`。最後に `中止` で後片付け（confirm は accept）。
3. **編集不可**: 中止後は `文面を編集` が disabled。

## 6. 対象外（今回やらない）

- 編集履歴（CampaignStepRevision）
- ステップ別送信数の表示
- running 中の直接編集
- フォローアップの全削除（API 変更が必要）
- `next_step_at` の再計算
