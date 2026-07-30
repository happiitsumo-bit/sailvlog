(function () {
  "use strict";

  const host = document.getElementById("screen-host");
  const frame = document.getElementById("preview-frame");
  const screenName = document.getElementById("current-screen-name");
  const routeName = document.getElementById("current-route");
  const lab = document.querySelector(".mock-lab");
  const navButtons = Array.from(document.querySelectorAll("[data-screen]"));
  const viewportButtons = Array.from(document.querySelectorAll("[data-viewport]"));
  const themeToggle = document.getElementById("theme-toggle");

  let replayTimer = null;
  let replaySeconds = 842;

  const pageMeta = {
    flow: { label: "画面遷移図", route: "product flow" },
    login: { label: "ログイン", route: "/login" },
    register: { label: "新規登録", route: "/register" },
    sessions: { label: "セッション一覧", route: "/sessions" },
    upload: { label: "GPX取込", route: "/sessions/new" },
    replay: { label: "部内リプレイ", route: "/sessions/42?t=842&boats=101,103" },
    publish: { label: "公開昇格", route: "/sessions/42 · dialog" },
    handbook: { label: "収録ハンドブック", route: "/handbook" },
    public: { label: "公開リプレイ", route: "/p/8Jq2xNbF4tKa" },
    forbidden: { label: "権限なし", route: "/sessions/42 · 403" },
    notfound: { label: "公開URLが見つからない", route: "/p/expiredSlug · 404" }
  };

  function go(screen) {
    const safeScreen = pageMeta[screen] ? screen : "flow";
    if (location.hash.slice(1) === safeScreen) {
      render(safeScreen);
    } else {
      location.hash = safeScreen;
    }
  }

  function productTopbar(active) {
    return `
      <header class="product-topbar">
        <button type="button" class="product-brand" data-go="sessions">sailvlog</button>
        <nav class="product-nav-links" aria-label="メインナビゲーション">
          <button type="button" data-go="sessions" class="${active === "sessions" ? "is-active" : ""}">セッション</button>
          <button type="button" data-go="handbook" class="${active === "handbook" ? "is-active" : ""}">収録ガイド</button>
        </nav>
        <div class="user-chip">
          <span class="desktop-only">江の島大学ヨット部</span>
          <span class="avatar" aria-label="ユーザー: 家永">家</span>
        </div>
      </header>
    `;
  }

  function mobileTabs(active) {
    return `
      <nav class="mobile-tabbar" aria-label="モバイルナビゲーション">
        <button type="button" data-go="sessions" class="${active === "sessions" ? "is-active" : ""}">
          <span aria-hidden="true">≋</span><span>セッション</span>
        </button>
        <button type="button" data-go="upload" class="${active === "upload" ? "is-active" : ""}">
          <span aria-hidden="true">＋</span><span>取込</span>
        </button>
        <button type="button" data-go="handbook" class="${active === "handbook" ? "is-active" : ""}">
          <span aria-hidden="true">?</span><span>収録ガイド</span>
        </button>
      </nav>
    `;
  }

  function flowScreen() {
    return `
      <section class="product-shell flow-screen">
        <div class="flow-header">
          <span class="screen-eyebrow">PRODUCT FLOW / PHASE 1</span>
          <h1>練習の記録が、反省会を経て外へ届くまで。</h1>
          <p>認証、GPX取込、部内リプレイ、公開昇格、匿名の公開閲覧までを一本の主導線に整理しています。各ボックスを押すと、その画面のモックを開けます。</p>
        </div>

        <section class="flow-section" aria-labelledby="flow-main-title">
          <h2 id="flow-main-title">部内の基本導線</h2>
          <div class="flow-lanes">
            <button type="button" class="flow-node" data-go="login">
              <span class="flow-route">/login</span>
              <strong>ログイン</strong>
              <small>部員・マネ艇担当・主将が認証</small>
            </button>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <button type="button" class="flow-node" data-go="sessions">
              <span class="flow-route">/sessions</span>
              <strong>セッション一覧</strong>
              <small>部内の練習・レースを選ぶ</small>
            </button>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <button type="button" class="flow-node" data-go="upload">
              <span class="flow-route">/sessions/new</span>
              <strong>GPX取込</strong>
              <small>複数艇を同期して保存</small>
            </button>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <button type="button" class="flow-node" data-go="replay">
              <span class="flow-route">/sessions/[id]</span>
              <strong>部内リプレイ</strong>
              <small>比較・レグ・反省メモ・共有</small>
            </button>
          </div>
        </section>

        <section class="flow-section" aria-labelledby="flow-public-title">
          <h2 id="flow-public-title">公開昇格の追加導線</h2>
          <div class="flow-lanes">
            <button type="button" class="flow-node" data-go="replay">
              <span class="flow-route">TEAM ONLY</span>
              <strong>反省会を終える</strong>
              <small>生のメモは部内に残す</small>
            </button>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <button type="button" class="flow-node" data-go="publish">
              <span class="flow-route">DIALOG</span>
              <strong>公開する</strong>
              <small>要約・注釈・公開範囲を選ぶ</small>
            </button>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <button type="button" class="flow-node" data-go="public">
              <span class="flow-route">/p/[slug]</span>
              <strong>公開リプレイ</strong>
              <small>ログイン不要・読み取り専用</small>
            </button>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <button type="button" class="flow-node" data-go="notfound">
              <span class="flow-route">UNPUBLISH</span>
              <strong>公開を取り消す</strong>
              <small>旧URLは一律404になる</small>
            </button>
          </div>
        </section>

        <section class="flow-section" aria-labelledby="flow-branch-title">
          <h2 id="flow-branch-title">分岐と補助画面</h2>
          <div class="flow-branches">
            <button type="button" class="flow-node" data-go="register">
              <span class="flow-route">AUTH BRANCH</span>
              <strong>新規登録</strong>
              <small>部内利用者のアカウント作成。公開ビューには登録導線を出さない。</small>
            </button>
            <button type="button" class="flow-node" data-go="handbook">
              <span class="flow-route">SUPPORT</span>
              <strong>収録ハンドブック</strong>
              <small>出艇前から着艇後まで、GPX収録を失敗しないための手順。</small>
            </button>
            <button type="button" class="flow-node" data-go="forbidden">
              <span class="flow-route">PERMISSION</span>
              <strong>403 権限なし</strong>
              <small>他Teamの部内URLを開いた場合は、内容を一切見せない。</small>
            </button>
          </div>
        </section>

        <div class="flow-boundary">
          <h3>公開ビューで意図的に作らないもの</h3>
          <div class="boundary-items">
            <span>ログイン要求</span>
            <span>公開一覧・検索</span>
            <span>注釈追加</span>
            <span>フォロー</span>
            <span>いいね</span>
            <span>公開側コメント</span>
            <span>閲覧数表示</span>
          </div>
        </div>
      </section>
    `;
  }

  function authScreen(mode) {
    const register = mode === "register";
    return `
      <section class="product-shell auth-shell">
        <div class="auth-panel">
          <div class="auth-panel-inner">
            <button type="button" class="product-brand" data-go="sessions">sailvlog</button>
            <h1 class="auth-title">${register ? "部の振り返りに参加する。" : "海に出た日の続きを、ここで。"}</h1>
            <p class="auth-lead">${register ? "個人アカウントを作り、所属チームのセッションを共有します。" : "練習・レースの航跡と、反省会で交わした言葉を開きます。"}</p>
            <form class="form-stack" data-demo-form="${register ? "register" : "login"}">
              ${register ? `
                <div class="field">
                  <label for="auth-name">表示名</label>
                  <input id="auth-name" type="text" value="家永 泰地" autocomplete="name">
                </div>
              ` : ""}
              <div class="field">
                <label for="auth-email">メールアドレス</label>
                <input id="auth-email" type="email" value="${register ? "taichi@example.jp" : "taichi@sail.example.jp"}" autocomplete="email">
              </div>
              <div class="field">
                <label for="auth-password">パスワード</label>
                <input id="auth-password" type="password" value="sailvlog-demo" autocomplete="${register ? "new-password" : "current-password"}">
                ${register ? `<p class="field-hint">8文字以上。部内で使い回さないパスワードを設定してください。</p>` : ""}
              </div>
              <button type="submit" class="mock-btn primary">${register ? "アカウントを作成" : "ログイン"}</button>
            </form>
            <p class="form-footnote">
              ${register ? "すでにアカウントをお持ちですか？" : "はじめて使いますか？"}
              <button type="button" data-go="${register ? "login" : "register"}">${register ? "ログイン" : "新規登録"}</button>
            </p>
          </div>
        </div>
        <div class="auth-visual">
          <div class="auth-compass" aria-hidden="true"></div>
          <div class="auth-visual-copy">
            <span class="screen-eyebrow">KNOWLEDGE THAT SAILS</span>
            <h2>航跡を再生し、判断を言葉にする。</h2>
            <p>大学ヨット部の週次反省会を、記憶だけに頼らない時間へ。複数艇のGPXと議論のメモが、次の出艇まで残ります。</p>
          </div>
        </div>
      </section>
    `;
  }

  function sessionsScreen() {
    return `
      <section class="product-shell">
        ${productTopbar("sessions")}
        <header class="page-hero">
          <div class="page-hero-content">
            <span class="screen-eyebrow">ENOSHIMA UNIVERSITY / 2026 SEASON</span>
            <h1 class="hero-title">セッション</h1>
            <p class="hero-subtitle">練習とレースの航跡、反省メモを部内で蓄積します。</p>
          </div>
        </header>
        <div class="page-wrap">
          <div class="page-heading-row">
            <div>
              <span class="route-caption">12 sessions · 最終更新 7月24日</span>
              <div class="stats-row">
                <div class="stat"><span>今月の収録</span><strong>8回</strong></div>
                <div class="stat"><span>反省メモ</span><strong>46件</strong></div>
                <div class="stat"><span>参加した艇</span><strong>6艇</strong></div>
              </div>
            </div>
            <button type="button" class="mock-btn primary" data-go="upload">＋ GPXを取り込む</button>
          </div>

          <div class="filter-bar">
            <div class="filter-chips" role="group" aria-label="セッション種別">
              <button type="button" class="mock-chip" aria-pressed="true" data-filter="all">すべて</button>
              <button type="button" class="mock-chip" aria-pressed="false" data-filter="practice">練習</button>
              <button type="button" class="mock-chip" aria-pressed="false" data-filter="race">レース</button>
            </div>
            <span class="route-caption desktop-only">新しい順 ↓</span>
          </div>

          <div class="session-grid" id="session-grid">
            <button type="button" class="session-card" data-kind="practice" data-go="replay">
              <div class="session-card-head">
                <span class="type-chip practice">練習</span>
                <span class="status-chip unlisted">リンク限定</span>
              </div>
              <h3>江の島 定期練習</h3>
              <p>南西8–12kt。上マーク回航後の展開とスピン準備を重点的に確認。</p>
              <div class="session-card-meta">
                <span>6艇 · 12メモ</span>
                <span class="date-label">2026.07.20</span>
              </div>
            </button>

            <button type="button" class="session-card" data-kind="race" data-go="replay">
              <div class="session-card-head">
                <span class="type-chip race">レース</span>
                <span class="status-chip public">公開中</span>
              </div>
              <h3>関東学生ヨット選手権 Day 1</h3>
              <p>第2レース。スタート後3分の右海面選択と、L1の艇間比較。</p>
              <div class="session-card-meta">
                <span>4艇 · 9メモ</span>
                <span class="date-label">2026.07.13</span>
              </div>
            </button>

            <button type="button" class="session-card" data-kind="practice" data-go="replay">
              <div class="session-card-head">
                <span class="type-chip practice">練習</span>
              </div>
              <h3>強風域 ボートスピード練習</h3>
              <p>南南西16–20kt。上りの高さと艇速のトレードオフを2艇で比較。</p>
              <div class="session-card-meta">
                <span>3艇 · 7メモ</span>
                <span class="date-label">2026.07.06</span>
              </div>
            </button>

            <button type="button" class="session-card" data-kind="practice" data-go="replay">
              <div class="session-card-head">
                <span class="type-chip practice">練習</span>
              </div>
              <h3>微風 タック反復</h3>
              <p>東2–5kt。タック後の加速角度とクルー動作のタイミングを確認。</p>
              <div class="session-card-meta">
                <span>5艇 · 18メモ</span>
                <span class="date-label">2026.06.29</span>
              </div>
            </button>
          </div>
        </div>
        ${mobileTabs("sessions")}
      </section>
    `;
  }

  function uploadScreen() {
    return `
      <section class="product-shell">
        ${productTopbar("sessions")}
        <header class="page-hero">
          <div class="page-hero-content">
            <span class="screen-eyebrow">IMPORT / MULTI-BOAT GPX</span>
            <h1 class="hero-title">セッションを登録</h1>
            <p class="hero-subtitle">複数艇のGPXを1秒単位で同期し、ひとつの反省会にまとめます。</p>
          </div>
        </header>
        <div class="page-wrap">
          <div class="stepper" aria-label="登録手順">
            <div class="step done"><span>✓</span><strong>基本情報</strong></div>
            <div class="step active"><span>2</span><strong>GPX取込</strong></div>
            <div class="step"><span>3</span><strong>確認・保存</strong></div>
          </div>

          <form data-demo-form="upload">
            <section class="upload-section" aria-labelledby="basic-title">
              <div class="section-heading-row">
                <div>
                  <span class="screen-eyebrow">STEP 1</span>
                  <h2 id="basic-title">基本情報</h2>
                </div>
              </div>
              <div class="form-grid">
                <div class="field full">
                  <label for="session-title">セッション名</label>
                  <input id="session-title" type="text" value="江の島 定期練習">
                </div>
                <div class="field">
                  <label for="session-type">種別</label>
                  <select id="session-type"><option selected>練習</option><option>レース</option></select>
                </div>
                <div class="field">
                  <label for="session-date">実施日</label>
                  <input id="session-date" type="date" value="2026-07-20">
                </div>
                <div class="field">
                  <label for="session-venue">会場</label>
                  <input id="session-venue" type="text" value="江の島">
                </div>
                <div class="field">
                  <label for="session-team">チーム</label>
                  <select id="session-team"><option selected>江の島大学ヨット部</option></select>
                </div>
              </div>
            </section>

            <section class="upload-section" aria-labelledby="gpx-title">
              <div class="section-heading-row">
                <div>
                  <span class="screen-eyebrow">STEP 2</span>
                  <h2 id="gpx-title">GPXファイル</h2>
                </div>
                <span class="route-caption">3 files · 00:58:24</span>
              </div>
              <div class="drop-zone">
                <div>
                  <strong>ここにGPXをドロップ</strong>
                  <p>艇ごとに1ファイル。複数選択できます。</p>
                  <label for="gpx-files" class="mock-btn">ファイルを選択</label>
                  <input id="gpx-files" class="visually-hidden" type="file" accept=".gpx" multiple>
                </div>
              </div>

              <div class="file-list" aria-label="取込ファイル">
                <div class="file-row">
                  <div class="file-name"><span class="file-ok">✓</span><span>470_4423_tanaka.gpx</span></div>
                  <div class="field"><label class="visually-hidden" for="boat-1">艇ラベル</label><input id="boat-1" value="4423 田中 / 佐藤"></div>
                  <button type="button" class="mock-btn small ghost">削除</button>
                </div>
                <div class="file-row">
                  <div class="file-name"><span class="file-ok">✓</span><span>470_4712_ienaga.gpx</span></div>
                  <div class="field"><label class="visually-hidden" for="boat-2">艇ラベル</label><input id="boat-2" value="4712 家永 / 鈴木"></div>
                  <button type="button" class="mock-btn small ghost">削除</button>
                </div>
                <div class="file-row">
                  <div class="file-name"><span class="file-ok">✓</span><span>coach_boat.gpx</span></div>
                  <div class="field"><label class="visually-hidden" for="boat-3">艇ラベル</label><input id="boat-3" value="マネ艇"></div>
                  <button type="button" class="mock-btn small ghost">削除</button>
                </div>
              </div>
            </section>

            <section class="upload-section" aria-labelledby="preview-title">
              <div class="section-heading-row">
                <div>
                  <span class="screen-eyebrow">STEP 3</span>
                  <h2 id="preview-title">同期プレビュー</h2>
                </div>
                <span class="status-chip public">解析OK</span>
              </div>
              <div class="preview-chart" aria-label="3艇の航跡プレビュー">
                <canvas class="track-canvas" data-track-mode="preview"></canvas>
              </div>
              <div class="action-row" style="margin-top:18px">
                <button type="button" class="mock-btn ghost" data-go="sessions">一覧に戻る</button>
                <button type="submit" class="mock-btn primary">保存してリプレイを開く</button>
              </div>
            </section>
          </form>
        </div>
        ${mobileTabs("upload")}
      </section>
    `;
  }

  function replayContent(options) {
    const publicMode = Boolean(options && options.publicMode);
    return `
      <div class="${publicMode ? "public-replay" : "replay-map"}" aria-label="${publicMode ? "公開された" : "部内"}複数艇航跡リプレイ">
        <canvas class="track-canvas" data-track-mode="${publicMode ? "public" : "replay"}"></canvas>
        <div class="map-overlay">
          <span class="wind-chip">↗ SW 10–12 kt</span>
          <span class="scale-chip">200 m</span>
        </div>
      </div>
      <div class="${publicMode ? "public-controls" : "replay-controls"}">
        <div class="primary-controls">
          <button type="button" class="mock-btn primary play-button" data-replay-play>▶ 再生</button>
          <button type="button" class="mock-chip active" data-speed="1">1x</button>
          <button type="button" class="mock-chip" data-speed="4">4x</button>
          <button type="button" class="mock-chip" data-speed="8">8x</button>
          <div class="time-readout"><span data-current-time>00:14:02</span> <span>/ 00:58:24</span></div>
        </div>
        <div class="timeline">
          <label for="${publicMode ? "public-seek" : "team-seek"}" class="visually-hidden">再生位置</label>
          <input id="${publicMode ? "public-seek" : "team-seek"}" type="range" min="0" max="3504" value="842" data-replay-range>
          <div class="annotation-pins" aria-hidden="true">
            <span style="left:24%"></span>
            <span style="left:49%"></span>
            <span style="left:73%"></span>
          </div>
        </div>
        <div class="leg-row">
          <button type="button" class="mock-chip">スタート</button>
          <button type="button" class="mock-chip active">上マーク L1</button>
          <button type="button" class="mock-chip">下マーク L2</button>
          <button type="button" class="mock-chip">フィニッシュ</button>
        </div>
      </div>
    `;
  }

  function replayShell(withPublishDialog) {
    return `
      <section class="replay-shell">
        ${productTopbar("sessions")}
        <header class="replay-header">
          <div class="replay-title">
            <span class="screen-eyebrow">PRACTICE / TEAM ONLY</span>
            <h1>江の島 定期練習</h1>
            <p>2026.07.20 · 南西8–12kt · 6艇</p>
          </div>
          <div class="replay-actions">
            <button type="button" class="mock-btn small" data-copy-url>この場面のURLをコピー</button>
            <button type="button" class="mock-btn small primary" data-go="publish">公開する</button>
          </div>
        </header>
        <div class="replay-layout">
          <main class="replay-main">
            ${replayContent({ publicMode: false })}
          </main>
          <aside class="replay-aside">
            <section class="aside-section">
              <h2>比較する2艇</h2>
              <div class="boat-list">
                <label class="boat-row"><input type="checkbox" checked><span class="boat-line" style="--boat-color:#72d4ed"></span><span>4423 田中 / 佐藤</span></label>
                <label class="boat-row"><input type="checkbox" checked><span class="boat-line" style="--boat-color:#ff9b82"></span><span>4712 家永 / 鈴木</span></label>
                <label class="boat-row"><input type="checkbox"><span class="boat-line" style="--boat-color:#f0c85a"></span><span>4631 山口 / 伊藤</span></label>
                <label class="boat-row"><input type="checkbox"><span class="boat-line" style="--boat-color:#8ed39e"></span><span>4450 渡辺 / 林</span></label>
                <label class="boat-row"><input type="checkbox"><span class="boat-line dashed" style="--boat-color:#72d4ed"></span><span>4518 佐々木 / 森</span></label>
                <label class="boat-row"><input type="checkbox"><span class="boat-line dashed" style="--boat-color:#ff9b82"></span><span>マネ艇</span></label>
              </div>
            </section>
            <section class="aside-section">
              <div class="section-heading-row">
                <h3>反省メモ</h3>
                <span class="route-caption">12件</span>
              </div>
              <div class="memo-list">
                <div class="memo-card"><button type="button" data-seek-to="842"><time>00:14:02</time><p>ここのタックが早すぎた。右のブローを待てた。</p></button></div>
                <div class="memo-card"><button type="button" data-seek-to="1710"><time>00:28:30</time><p>上マーク回航前にスピン準備の声掛けを始める。</p></button></div>
                <div class="memo-card"><button type="button" data-seek-to="2525"><time>00:42:05</time><p>下りで4423の方が先にプレッシャーへ入っている。</p></button></div>
              </div>
              <div class="memo-composer">
                <label for="memo-input" class="visually-hidden">現在時刻にメモを追加</label>
                <textarea id="memo-input" placeholder="現在時刻に反省メモを残す"></textarea>
                <button type="button" class="mock-btn small">00:14:02 に追加</button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    `;
  }

  function replayScreen() {
    return replayShell(false);
  }

  function publishScreen() {
    return `
      <section class="dialog-screen">
        ${replayShell(true)}
        <div class="dialog-backdrop">
          <section class="publish-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-title">
            <header class="dialog-head">
              <div>
                <span class="screen-eyebrow">PUBLISH LEARNING</span>
                <h2 id="publish-title">このセッションを公開する</h2>
                <p>部外へ伝える学びと、見せるメモだけを選びます。</p>
              </div>
              <button type="button" class="dialog-close" aria-label="閉じる" data-go="replay">×</button>
            </header>
            <div class="dialog-body">
              <section class="dialog-section">
                <label for="learning-summary"><strong>学びの要約</strong> <span aria-hidden="true">*</span></label>
                <textarea id="learning-summary" maxlength="400">上マーク回航後の展開が遅れる原因は、下りに入る前のスピン準備タイミングだった。回航直前ではなく、アプローチ中に役割確認を始めることで、加速に使える時間を増やせる。</textarea>
                <span class="char-count"><span id="summary-count">84</span> / 400</span>
              </section>

              <section class="dialog-section">
                <div>
                  <h3>公開する反省メモ</h3>
                  <p class="privacy-note">反省会のメモは既定ですべて非公開です。部外へ伝えてよいものだけ選んでください。</p>
                </div>
                <div class="annotation-choice-list">
                  <label class="annotation-choice">
                    <input type="checkbox">
                    <time>00:14:02</time>
                    <span>ここのタックが早すぎた。右のブローを待てた。</span>
                  </label>
                  <label class="annotation-choice">
                    <input type="checkbox" checked>
                    <time>00:28:30</time>
                    <span>上マーク回航前にスピン準備の声掛けを始める。</span>
                  </label>
                  <label class="annotation-choice">
                    <input type="checkbox" checked>
                    <time>00:42:05</time>
                    <span>下りで4423の方が先にプレッシャーへ入っている。</span>
                  </label>
                </div>
              </section>

              <fieldset class="dialog-section" style="border:0;padding:0;margin:0">
                <legend class="fieldset-label">公開範囲</legend>
                <div class="publish-options">
                  <label class="publish-option">
                    <input type="radio" name="visibility" checked>
                    <span><strong>リンクを知っている人だけ</strong><span>検索には出ません。URLを転送された人は閲覧できます。</span></span>
                  </label>
                  <label class="publish-option">
                    <input type="radio" name="visibility">
                    <span><strong>だれでも</strong><span>検索エンジンから見つかる可能性があります。</span></span>
                  </label>
                </div>
              </fieldset>

              <p class="warning-note"><strong>公開前に確認：</strong> 航跡の先頭・末尾に、自宅や移動経路など陸上の位置情報が含まれていないか確認してください。</p>
            </div>
            <footer class="dialog-foot">
              <button type="button" class="mock-btn ghost" data-go="replay">キャンセル</button>
              <button type="button" class="mock-btn primary" data-publish-confirm>公開してURLをコピー</button>
            </footer>
          </section>
        </div>
      </section>
    `;
  }

  function handbookScreen() {
    return `
      <section class="product-shell">
        ${productTopbar("handbook")}
        <header class="page-hero">
          <div class="page-hero-content">
            <span class="screen-eyebrow">FIELD GUIDE / 1HZ GPX</span>
            <h1 class="hero-title">収録ハンドブック</h1>
            <p class="hero-subtitle">海上で失敗しないために、出艇前の3分で確認する手順です。</p>
          </div>
        </header>
        <div class="page-wrap handbook-layout">
          <nav class="handbook-toc desktop-only" aria-label="目次">
            <a href="#setup">Geo Trackerの設定</a>
            <a href="#before">出艇前チェック</a>
            <a href="#after">着艇後にやること</a>
            <a href="#import">sailvlogへの取込</a>
            <a href="#meeting">反省会前</a>
          </nav>
          <article class="handbook-content">
            <section class="handbook-section" id="setup">
              <span class="screen-eyebrow">01 / INITIAL SETUP</span>
              <h2>Geo Trackerの設定</h2>
              <ol>
                <li>Geo Trackerをインストールし、記録間隔を最短に設定する。</li>
                <li>位置情報の許可を「常に許可」にする。</li>
                <li>バッテリー最適化の対象外に設定し、バックグラウンド記録を許可する。</li>
                <li>陸上で3〜5分試し録りし、GPXの点が約1秒間隔か確認する。</li>
              </ol>
              <p class="info-band">Geo Tracker以外でも、1秒間隔でGPXを書き出せる手段なら利用できます。</p>
            </section>

            <section class="handbook-section" id="before">
              <span class="screen-eyebrow">02 / BEFORE SAILING</span>
              <h2>出艇前チェック</h2>
              <div class="check-item"><input id="check-1" type="checkbox"><label for="check-1">GPSをオンにした</label></div>
              <div class="check-item"><input id="check-2" type="checkbox"><label for="check-2">記録開始を押した</label></div>
              <div class="check-item"><input id="check-3" type="checkbox"><label for="check-3">省電力モードをオフにした</label></div>
              <div class="check-item"><input id="check-4" type="checkbox"><label for="check-4">防水袋へ入れ、画面をロックした</label></div>
            </section>

            <section class="handbook-section" id="after">
              <span class="screen-eyebrow">03 / AFTER SAILING</span>
              <h2>着艇後にやること</h2>
              <ol>
                <li>記録を停止し、開始・終了時刻が妥当か確認する。</li>
                <li>GPX形式で書き出す。原本は消さない。</li>
                <li>マネ艇担当のLINEまたは部のDriveへ送る。</li>
              </ol>
            </section>

            <section class="handbook-section" id="import">
              <span class="screen-eyebrow">04 / IMPORT</span>
              <h2>sailvlogへの取込</h2>
              <ol>
                <li>「セッション」から「GPXを取り込む」を開く。</li>
                <li>同じ練習のGPXをまとめて選び、各艇のラベルを入力する。</li>
                <li>同期プレビューで軌跡が大きくずれていないか確認する。</li>
                <li>保存してリプレイを開く。</li>
              </ol>
              <button type="button" class="mock-btn primary" data-go="upload">GPX取込画面を見る</button>
            </section>

            <section class="handbook-section" id="meeting">
              <span class="screen-eyebrow">05 / BEFORE REVIEW</span>
              <h2>反省会の直前に一度開く</h2>
              <p>無料ホスティングは一定時間アクセスがないと休止します。席に着く前に対象セッションを開いておくと、反省会開始時の待ち時間を避けられます。</p>
            </section>
          </article>
        </div>
        ${mobileTabs("handbook")}
      </section>
    `;
  }

  function publicScreen() {
    return `
      <section class="public-shell">
        <header class="public-topbar">
          <button type="button" class="product-brand" data-go="flow">sailvlog</button>
          <span class="public-label">リンク限定公開</span>
        </header>
        <main class="public-wrap">
          <header class="public-header">
            <span class="screen-eyebrow">SHARED LEARNING / ENOSHIMA UNIVERSITY</span>
            <h1>江の島 定期練習</h1>
            <p>2026年7月20日 · 江の島大学ヨット部 · 南西8–12kt</p>
          </header>

          <section class="learning-summary">
            <span>この練習で分かったこと</span>
            <p>上マーク回航後の展開が遅れる原因は、下りに入る前のスピン準備タイミングだった。回航直前ではなく、アプローチ中に役割確認を始めることで、加速に使える時間を増やせる。</p>
          </section>

          ${replayContent({ publicMode: true })}

          <section class="public-memos" aria-labelledby="public-memos-title">
            <div class="section-heading-row">
              <div>
                <span class="screen-eyebrow">SELECTED NOTES</span>
                <h2 id="public-memos-title">公開されたメモ</h2>
              </div>
              <span class="route-caption">2 notes</span>
            </div>
            <div class="public-memo"><time>00:28:30</time><p>上マーク回航前にスピン準備の声掛けを始める。</p></div>
            <div class="public-memo"><time>00:42:05</time><p>下りで4423の方が先にプレッシャーへ入っている。艇間の差は回航より前から生まれていた。</p></div>
          </section>

          <aside class="about-product">
            <h2>sailvlogとは</h2>
            <p>大学ヨット部の反省会で、複数艇のGPS航跡と議論を重ねて残すツールです。このページはチームが選んだ学びだけを、読み取り専用で公開しています。</p>
          </aside>
        </main>
      </section>
    `;
  }

  function errorScreen(code) {
    const forbidden = code === 403;
    return `
      <section class="product-shell">
        ${forbidden ? productTopbar("sessions") : `
          <header class="public-topbar">
            <button type="button" class="product-brand" data-go="flow">sailvlog</button>
            <span class="public-label">公開ページ</span>
          </header>
        `}
        <div class="error-screen">
          <div class="error-inner">
            <div class="error-compass" aria-hidden="true"></div>
            <div class="error-code">${code}</div>
            <h1>${forbidden ? "このセッションは閲覧できません" : "公開ページが見つかりません"}</h1>
            <p>${forbidden
              ? "このセッションは別のチームに所属しています。所属チームのセッション一覧へ戻ってください。"
              : "URLが間違っているか、公開が取り消された可能性があります。非公開と存在しないURLは同じ表示になります。"
            }</p>
            ${forbidden
              ? `<button type="button" class="mock-btn primary" data-go="sessions">セッション一覧へ戻る</button>`
              : `<button type="button" class="mock-btn ghost" data-go="flow">画面遷移図へ戻る</button>`
            }
          </div>
        </div>
      </section>
    `;
  }

  const renderers = {
    flow: flowScreen,
    login: () => authScreen("login"),
    register: () => authScreen("register"),
    sessions: sessionsScreen,
    upload: uploadScreen,
    replay: replayScreen,
    publish: publishScreen,
    handbook: handbookScreen,
    public: publicScreen,
    forbidden: () => errorScreen(403),
    notfound: () => errorScreen(404)
  };

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.min(3504, Math.round(totalSeconds)));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
  }

  function stopReplayTimer() {
    if (replayTimer) {
      window.clearInterval(replayTimer);
      replayTimer = null;
    }
  }

  function drawTracks() {
    const canvases = host.querySelectorAll(".track-canvas");
    canvases.forEach((canvas) => {
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      const context = canvas.getContext("2d");
      context.scale(scale, scale);

      const width = rect.width;
      const height = rect.height;

      context.strokeStyle = "rgba(143, 209, 226, .10)";
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 42) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += 42) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      const mode = canvas.dataset.trackMode;
      const trackCount = mode === "preview" ? 3 : 6;
      const colors = ["#72d4ed", "#ff9b82", "#f0c85a", "#8ed39e", "#72d4ed", "#ff9b82"];
      const labels = ["4423", "4712", "4631", "4450", "4518", "M艇"];
      const points = [];

      for (let index = 0; index < trackCount; index += 1) {
        const offset = (index - (trackCount - 1) / 2) * 7.5;
        const linePoints = [];
        for (let step = 0; step <= 70; step += 1) {
          const t = step / 70;
          const x = width * (0.10 + t * 0.78) + Math.sin(t * 9 + index) * 12 + offset * 0.6;
          const y = height * (0.82 - t * 0.65) + Math.sin(t * 15 + index * 0.9) * (18 + index * 1.2) + offset;
          linePoints.push([x, y]);
        }
        points.push(linePoints);

        context.save();
        context.strokeStyle = colors[index];
        context.lineWidth = index < 2 ? 2.5 : 1.7;
        context.globalAlpha = index < 2 ? 0.96 : 0.68;
        if (index >= 4) context.setLineDash([8, 6]);
        context.beginPath();
        linePoints.forEach((point, pointIndex) => {
          if (pointIndex === 0) context.moveTo(point[0], point[1]);
          else context.lineTo(point[0], point[1]);
        });
        context.stroke();
        context.restore();

        const markerPoint = linePoints[Math.min(linePoints.length - 1, 38 + index * 2)];
        context.beginPath();
        context.fillStyle = colors[index];
        context.arc(markerPoint[0], markerPoint[1], 5.5, 0, Math.PI * 2);
        context.fill();
        context.font = "600 11px -apple-system, sans-serif";
        context.fillStyle = "#eaf8fb";
        context.fillText(labels[index], markerPoint[0] + 9, markerPoint[1] - 7);
      }

      context.save();
      context.strokeStyle = "rgba(206, 239, 247, .28)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(width * 0.77, height * 0.22, Math.min(width, height) * 0.12, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    });
  }

  function updateReplayUI(seconds) {
    replaySeconds = Math.max(0, Math.min(3504, Number(seconds)));
    host.querySelectorAll("[data-current-time]").forEach((node) => {
      node.textContent = formatTime(replaySeconds);
    });
    host.querySelectorAll("[data-replay-range]").forEach((range) => {
      range.value = String(replaySeconds);
    });
  }

  function bindScreenInteractions() {
    host.querySelectorAll("[data-go]").forEach((button) => {
      button.addEventListener("click", () => go(button.dataset.go));
    });

    host.querySelectorAll("[data-demo-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const destination = form.dataset.demoForm === "upload" ? "replay" : "sessions";
        go(destination);
      });
    });

    host.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter;
        host.querySelectorAll("[data-filter]").forEach((peer) => peer.setAttribute("aria-pressed", String(peer === button)));
        host.querySelectorAll(".session-card").forEach((card) => {
          card.hidden = filter !== "all" && card.dataset.kind !== filter;
        });
      });
    });

    host.querySelectorAll("[data-replay-play]").forEach((button) => {
      button.addEventListener("click", () => {
        if (replayTimer) {
          stopReplayTimer();
          button.textContent = "▶ 再生";
          return;
        }
        button.textContent = "Ⅱ 一時停止";
        replayTimer = window.setInterval(() => {
          const activeSpeed = Number(host.querySelector("[data-speed].active")?.dataset.speed || 1);
          replaySeconds += activeSpeed;
          if (replaySeconds >= 3504) {
            replaySeconds = 3504;
            stopReplayTimer();
            button.textContent = "▶ 再生";
          }
          updateReplayUI(replaySeconds);
        }, 1000);
      });
    });

    host.querySelectorAll("[data-speed]").forEach((button) => {
      button.addEventListener("click", () => {
        host.querySelectorAll("[data-speed]").forEach((peer) => peer.classList.remove("active"));
        button.classList.add("active");
      });
    });

    host.querySelectorAll("[data-replay-range]").forEach((range) => {
      range.addEventListener("input", () => updateReplayUI(range.value));
    });

    host.querySelectorAll("[data-seek-to]").forEach((button) => {
      button.addEventListener("click", () => updateReplayUI(button.dataset.seekTo));
    });

    const summary = host.querySelector("#learning-summary");
    const summaryCount = host.querySelector("#summary-count");
    if (summary && summaryCount) {
      summaryCount.textContent = String(summary.value.length);
      summary.addEventListener("input", () => {
        summaryCount.textContent = String(summary.value.length);
      });
    }

    const publishConfirm = host.querySelector("[data-publish-confirm]");
    if (publishConfirm) {
      publishConfirm.addEventListener("click", () => go("public"));
    }

    const copyButton = host.querySelector("[data-copy-url]");
    if (copyButton) {
      copyButton.addEventListener("click", () => {
        copyButton.textContent = "URLをコピーしました";
        window.setTimeout(() => {
          copyButton.textContent = "この場面のURLをコピー";
        }, 1600);
      });
    }

    window.requestAnimationFrame(drawTracks);
  }

  function render(screen) {
    stopReplayTimer();
    replaySeconds = 842;
    const meta = pageMeta[screen];
    host.innerHTML = renderers[screen]();
    screenName.textContent = meta.label;
    routeName.textContent = meta.route;
    navButtons.forEach((button) => {
      if (button.dataset.screen === screen) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    bindScreenInteractions();
  }

  navButtons.forEach((button) => {
    button.addEventListener("click", () => go(button.dataset.screen));
  });

  viewportButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mobile = button.dataset.viewport === "mobile";
      frame.classList.toggle("is-mobile", mobile);
      viewportButtons.forEach((peer) => {
        peer.setAttribute("aria-pressed", String(peer === button));
      });
      window.requestAnimationFrame(drawTracks);
    });
  });

  themeToggle.addEventListener("click", () => {
    const nextTheme = lab.dataset.theme === "dark" ? "light" : "dark";
    lab.dataset.theme = nextTheme;
  });

  window.addEventListener("hashchange", () => {
    const screen = location.hash.slice(1);
    render(pageMeta[screen] ? screen : "flow");
  });

  window.addEventListener("resize", () => window.requestAnimationFrame(drawTracks));

  if (!location.hash) location.hash = "flow";
  else render(pageMeta[location.hash.slice(1)] ? location.hash.slice(1) : "flow");
})();
