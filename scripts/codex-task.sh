#!/usr/bin/env bash
# codex-task.sh — Claude CLI（オーケストレーター）から codex exec（独立ワーカー）へ委譲する。
#
# 正本: docs/dev-org/PROCESS-routine-claude-codex.md §3.6（オーナー裁定 2026-07-30）
#
# なぜスクリプトにするか:
#   運用ルールの2番「Codexには境界を明示する」を人間の記憶に頼ると必ず抜ける。実際に
#   2026-07-30の委譲では、Codexが守った制約は全て Team Lead がプロンプトに手打ちしたもので、
#   書き忘れた制約は存在しないのと同じだった。境界はコードに固定し、毎回自動で前置する。
#
# 使い方:
#   scripts/codex-task.sh audit    <slug> <prompt-file>   # 調査・レビュー（read-only・書込不可）
#   scripts/codex-task.sh impl     <slug> <prompt-file>   # 実装（専用worktree・workspace-write）
#   scripts/codex-task.sh research <slug> <prompt-file>   # ネット調査（捨てdir・network有効）
#
# 最終報告は必ず .codex-reports/<slug>.md に落ちる（gitignore済み）。
# Codex が沈黙してもファイルは残るので、成果が worktree に埋まって消えることがない
# （2026-07-30に未コミット2,600行がworktreeに埋まっていた事故への対策）。

set -euo pipefail

MODE="${1:-}"
SLUG="${2:-}"
PROMPT_FILE="${3:-}"

usage() {
  sed -n '2,25p' "$0" >&2
  exit 2
}

[[ -n "$MODE" && -n "$SLUG" && -n "$PROMPT_FILE" ]] || usage
[[ -f "$PROMPT_FILE" ]] || { echo "ERROR: プロンプトファイルが無い: $PROMPT_FILE" >&2; exit 2; }
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "ERROR: slugは英小文字・数字・ハイフンのみ: $SLUG" >&2; exit 2; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

REPORT_DIR="$REPO_ROOT/.codex-reports"
mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/$SLUG.md"
EVENTS="$REPORT_DIR/$SLUG.events.jsonl"

# --- 全モード共通の境界（運用ルール2の機械化） -------------------------------
# ここに書いたものは毎回 Codex に前置される。個別プロンプトはこの後ろに連結される。
read -r -d '' COMMON_BOUNDARY <<'EOS' || true
## 越えてはいけない境界（この節は委譲元が自動で付けている。個別指示より優先する）

- **`git commit` / `git push` / タグ作成 / デプロイを実行しない。** 統合とGit操作は委譲元（Claude）の責務。
- **`docs/dev-org/` 配下の正本を書き換えない。** 気づきは報告に書く。正本を書く主体は1本に限定されている。
- **新しいnpm依存を追加しない。** 過去に無断追加で backend が起動不能になっている（ARCH.md ADR-011）。
- **色・間隔をハードコードしない。** `design-system/theme.json` のトークンを使う（ADR-008）。
- **秘密情報に `NEXT_PUBLIC_` を付けない。** クライアントバンドルに焼かれる（ADR-010）。
- **未認証で読めるレスポンスは「含めるものだけを列挙」する。** 除外し忘れが事故になる構造を作らない（ADR-007）。
- **backendのテストで `request(app)` を使わない。** `src/__tests__/helpers/testServer.ts` の `setupTestServer()` を使う（呼び出しごとにHTTPサーバを生成するレースで低頻度404のflakeが出る）。
- **PRD §5「明示的に入れない」（自動解析・3D再生・LIVE・動画・ゲーミフィケーション）は提案もしない。**

## 返却形式（必ずこの5節で報告する）

1. **何をしたか** — 1〜2行
2. **変更したファイル** — 一覧（変更していないなら「なし」と書く）
3. **検証** — 実行したコマンドと**実際の出力**（件数・エラー数）。実行していないものは「未検証」と明記する
4. **判断したこと** — 設計上の分岐と、選ばなかった案
5. **残リスク・未完了** — 分かっていて直していないもの

「できました」「問題ありません」だけの報告は不可。根拠が無いものは「未検証」と書く。
EOS

# --- テスト実行の注意（backend/frontend を触るモードのみ） -------------------
read -r -d '' TEST_NOTE <<'EOS' || true

## 検証コマンドとベースライン（下回ったら未完成）

- backend:  `cd backend && npx tsc --noEmit`（0件） / `npx jest --runInBand`（**16 suites / 154 passed**） / `npm run build`
- frontend: `cd frontend && npx tsc --noEmit`（0件） / `npx vitest run`（**7 files / 59 passed**） / `npm run build`

**backendのテストは同時に2つ走らせると壊れる**（共有テストDB × TRUNCATE）。必ず単独で実行する。
EOS

run_codex() {
  # $1: sandbox mode, 残り: 追加オプション
  local sandbox="$1"; shift
  local prompt
  prompt="$(printf '%s\n\n---\n\n%s\n' "$(cat "$PROMPT_FILE")" "$COMMON_BOUNDARY")"

  echo "[codex-task] mode=$MODE slug=$SLUG sandbox=$sandbox" >&2
  echo "[codex-task] report -> $REPORT" >&2

  # --ephemeral: セッションを保存しない。一発で終わる仕事向け。
  # 詰まりそうな仕事で resume したい場合は、この関数を使わず手で叩く
  # （--ephemeral と `codex exec resume` は排他）。
  codex exec \
    --ephemeral \
    --sandbox "$sandbox" \
    --output-last-message "$REPORT" \
    "$@" \
    "$prompt"
}

case "$MODE" in

  # ── 調査・設計レビュー: read-only。1行も書けない ──────────────────────────
  audit)
    run_codex read-only -C "$REPO_ROOT"
    ;;

  # ── 実装: 専用worktree + workspace-write。1タスク1worktree・1書き手 ────────
  impl)
    WT_DIR="$REPO_ROOT/../sailvlog-wt/$SLUG"
    BRANCH="codex/$SLUG"

    if [[ -d "$WT_DIR" ]]; then
      echo "[codex-task] 既存worktreeを再利用: $WT_DIR" >&2
    else
      mkdir -p "$(dirname "$WT_DIR")"
      git worktree add "$WT_DIR" -b "$BRANCH" HEAD
      # node_modules は .gitignore なのでworktreeには来ない。実測 frontend 297M + backend 185M
      # = 482M/worktree。同一コミットから切るので package.json は同一で、symlink で足りる。
      # ※ worktree内で package.json を変更する場合はこのsymlinkを外して npm ci が必要
      #   （共有ディレクトリを書き換えて本線を壊すため）。
      for d in backend frontend; do
        if [[ -d "$REPO_ROOT/$d/node_modules" && ! -e "$WT_DIR/$d/node_modules" ]]; then
          ln -s "$REPO_ROOT/$d/node_modules" "$WT_DIR/$d/node_modules"
          echo "[codex-task] symlink: $d/node_modules（482MBのnpm ciを回避）" >&2
        fi
      done
    fi

    # 個別プロンプトに worktree 限定の境界を足す
    PROMPT_FILE_AUG="$REPORT_DIR/$SLUG.prompt.md"
    {
      cat "$PROMPT_FILE"
      printf '\n\n## 作業場所の限定\n\n'
      printf -- '- 変更してよいのは **`%s` 配下だけ**。\n' "$WT_DIR"
      printf -- '- 他のworktree・本線（`%s`）には触らない。\n' "$REPO_ROOT"
      printf -- '- `node_modules` は本線へのsymlink。**`npm install` / `npm ci` を実行しない**（本線を壊す）。依存を変える必要が出たら実行せずに報告する。\n'
      printf '%s\n' "$TEST_NOTE"
    } > "$PROMPT_FILE_AUG"
    PROMPT_FILE="$PROMPT_FILE_AUG"

    run_codex workspace-write -C "$WT_DIR"

    echo "[codex-task] --- worktree の差分 ---" >&2
    git -C "$WT_DIR" status --short >&2 || true
    echo "[codex-task] worktree: $WT_DIR (branch: $BRANCH)" >&2
    echo "[codex-task] 統合は委譲元が行う。畳むときは: git worktree remove '$WT_DIR'" >&2
    ;;

  # ── ネット調査: 捨てdir + network有効 ─────────────────────────────────────
  # network_access は workspace_write 名前空間にあり「read-only かつネット有り」は
  # 指定できない（実測 2026-07-30）。よって書込先を捨てdirに限定してリポジトリを守る。
  research)
    SCRATCH="$REPORT_DIR/scratch-$SLUG"
    mkdir -p "$SCRATCH"
    echo "[codex-task] 書込先を捨てdirに限定: $SCRATCH（リポジトリは書けない）" >&2
    run_codex workspace-write \
      -C "$SCRATCH" \
      --skip-git-repo-check \
      -c 'sandbox_workspace_write.network_access=true'
    ;;

  *)
    echo "ERROR: 不明なモード: $MODE" >&2
    usage
    ;;
esac

echo >&2
echo "[codex-task] ===== 最終報告 ($REPORT) =====" >&2
cat "$REPORT" 2>/dev/null || echo "(報告ファイルが空。Codexが報告を返さなかった可能性あり)" >&2
