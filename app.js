/* ============================================================
 * カリンバ練習 - メインアプリ
 * ============================================================ */

// ---------- カリンバ鍵盤の音配置 (17鍵Cメジャー / 一般的なシミュレータ準拠) ----------
// 左端=D6, 中央 (idx=8)=C4 (最低音), 右端=E6
const TINES = [
  { idx: 0,  note: "D6" },
  { idx: 1,  note: "B5" },
  { idx: 2,  note: "G5" },
  { idx: 3,  note: "E5" },
  { idx: 4,  note: "C5" },
  { idx: 5,  note: "A4" },
  { idx: 6,  note: "F4" },
  { idx: 7,  note: "D4" },
  { idx: 8,  note: "C4" },
  { idx: 9,  note: "E4" },
  { idx: 10, note: "G4" },
  { idx: 11, note: "B4" },
  { idx: 12, note: "D5" },
  { idx: 13, note: "F5" },
  { idx: 14, note: "A5" },
  { idx: 15, note: "C6" },
  { idx: 16, note: "E6" },
];

const NOTE_LABELS = {
  doremi: { C: "ド", D: "レ", E: "ミ", F: "ファ", G: "ソ", A: "ラ", B: "シ" },
  abc:    { C: "C",  D: "D",  E: "E",  F: "F",   G: "G",  A: "A",  B: "B"  },
  number: { C: "1",  D: "2",  E: "3",  F: "4",   G: "5",  A: "6",  B: "7"  },
};

// PC用キーボードショートカット (画面左から右に並べた17鍵に対応 / 一般的なカリンバシミュレータ準拠)
const KEY_MAP = ['r','a','s','d','f','x','c','v','b','n','m',',','h','j','k','u','i'];
const KEY_TO_IDX = Object.fromEntries(KEY_MAP.map((k, i) => [k, i]));

// ---------- アプリ状態 ----------
const state = {
  mode: 'free',
  labelStyle: 'doremi',
  speed: 3.5,
  volume: -8,
  vibrate: true,

  songId: null,
  isPlaying: false,
  autoPlay: false,
  songStartTime: 0,
  songNotes: [],
  songEndTime: 0,
  hitCount: 0,
  totalCount: 0,
  rafId: null,
};

// ---------- DOM参照 ----------
const kalimbaEl    = document.getElementById('kalimba');
const notesTrack   = document.getElementById('notesTrack');
const overlayMsg   = document.getElementById('overlayMsg');
const scoreEl      = document.getElementById('score');
const playBtn      = document.getElementById('playBtn');
const songSelect   = document.getElementById('songSelect');
const hitLineEl    = document.getElementById('hitLine');
const songBarEl    = document.getElementById('songBar');

// ---------- オーディオ ----------
// 設計: ピッチクラスごとに専用 Sampler を作る (素材は C4〜B4 の7音のみ)
//   D6 → D4 サンプラーで +24 半音
//   C5 → C4 サンプラーで +12 半音
//   C4 → C4 サンプラーで ±0
//   ... のように同じ文字 (C/D/E/F/G/A/B) の音は必ず同じ素材から派生
const BASE_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
const samplers = {};
let reverb = null;
let masterVolume = null;
let audioReady = false;
let audioInitPromise = null;

async function initAudio() {
  if (audioInitPromise) return audioInitPromise;
  audioInitPromise = (async () => {
    if (typeof Tone === 'undefined') {
      console.error('Tone.js が読み込まれていません');
      return;
    }
    await Tone.start();
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }

    // +24半音の薄さを補うためリバーブ強め
    reverb = new Tone.Reverb({ decay: 3.0, preDelay: 0.02, wet: 0.30 }).toDestination();
    await reverb.generate();

    // マスターボリューム → リバーブ
    masterVolume = new Tone.Volume(state.volume).connect(reverb);

    // 7音分の Sampler。各々がアンカー1点だけ持つので Sampler が
    // 「最近傍」を選ぶ余地がなく、必ず指定の素材から派生する。
    BASE_NOTES.forEach(base => {
      samplers[base] = new Tone.Sampler({
        urls: { [base]: `${base}.wav` },
        baseUrl: 'sound/',
        release: 1.8,
        attack: 0,
      }).connect(masterVolume);
    });

    await Tone.loaded();

    // 低音側の存在感を少し補強 (ユーザー指示)
    samplers['C4'].volume.value = 2;
    samplers['D4'].volume.value = 1;
    samplers['B4'].volume.value = -1;

    audioReady = true;
    console.log('[kalimba] samplers ready');
  })();
  return audioInitPromise;
}

function ensureAudioRunning() {
  if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state === 'suspended') {
    Tone.context.resume();
  }
}

function playNote(note) {
  if (!audioReady) return;
  ensureAudioRunning();
  // 音名の頭文字 (C/D/E/F/G/A/B) で対応する素材を選択 → 目的の音高で再生
  const sampler = samplers[note[0] + '4'];
  if (!sampler) return;
  try {
    sampler.triggerAttack(note);
  } catch (e) { console.warn(e); }
}

// ---------- カリンバ描画 ----------
function renderKalimba() {
  kalimbaEl.innerHTML = '';
  TINES.forEach(tine => {
    const dist = Math.abs(tine.idx - 8);
    // 上端揃え + 中央が一番下に伸びる: 中央 92% → 端 52%
    const heightPct = 92 - dist * 5;

    const tineEl = document.createElement('div');
    tineEl.className = 'tine';
    tineEl.dataset.idx = tine.idx;
    tineEl.dataset.note = tine.note;
    tineEl.dataset.noteClass = tine.note[0]; // CSSの色分けに使用
    tineEl.style.height = `${heightPct}%`;

    // キーボードショートカット表示
    const keyHint = KEY_MAP[tine.idx];
    if (keyHint) {
      const keyEl = document.createElement('span');
      keyEl.className = 'key-hint';
      keyEl.textContent = keyHint.toUpperCase();
      tineEl.appendChild(keyEl);
    }

    // 音名ラベル (中央: 数字譜の流儀でオクターブを上下のドットで示す)
    const noteLetter = tine.note[0];
    const octave = parseInt(tine.note.slice(-1), 10);
    const label = document.createElement('span');
    label.className = 'label';
    if (state.labelStyle !== 'none') {
      const text = NOTE_LABELS[state.labelStyle][noteLetter];
      // C4基準: 5=•上, 6=••上, 3=•下 (今回は3未使用)
      let above = '';
      if (octave === 5) above = '•';
      else if (octave >= 6) above = '••';
      label.innerHTML =
        `<span class="dots dots-above">${above}</span>` +
        `<span class="num">${text}</span>`;
    }
    tineEl.appendChild(label);

    kalimbaEl.appendChild(tineEl);
  });
}

// ---------- カリンバ全体での入力処理 (グリッサンド対応) ----------
// pointerdown でアクティブ化し、pointermove で elementFromPoint により
// 現在指が乗っているタインを判定。前回と違うタインに入ったら playNote。
function setupKalimbaInteraction() {
  const activePointers = new Map(); // pointerId -> 直近に鳴らした tineIdx

  const tineIdxFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return -1;
    const tineEl = el.closest && el.closest('.tine');
    if (!tineEl) return -1;
    const idx = parseInt(tineEl.dataset.idx, 10);
    return Number.isNaN(idx) ? -1 : idx;
  };

  const triggerByIdx = (idx) => {
    if (idx < 0) return;
    handleTineTap(idx);
  };

  const onPointerDown = (e) => {
    const idx = tineIdxFromPoint(e.clientX, e.clientY);
    if (idx < 0) return;
    e.preventDefault();
    activePointers.set(e.pointerId, idx);
    triggerByIdx(idx);
  };

  const onPointerMove = (e) => {
    if (!activePointers.has(e.pointerId)) return;
    const idx = tineIdxFromPoint(e.clientX, e.clientY);
    if (idx < 0) return;                                    // 鍵盤外
    if (activePointers.get(e.pointerId) === idx) return;    // 同じ鍵 → 再発火しない
    activePointers.set(e.pointerId, idx);
    triggerByIdx(idx);
  };

  const onPointerEnd = (e) => {
    activePointers.delete(e.pointerId);
  };

  if ('PointerEvent' in window) {
    kalimbaEl.addEventListener('pointerdown', onPointerDown);
    // move / up は document に張ることでスワイプが鍵盤外に出ても追跡できる
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerEnd);
    document.addEventListener('pointercancel', onPointerEnd);
  } else {
    // 旧ブラウザフォールバック
    kalimbaEl.addEventListener('mousedown', (e) => {
      const idx = tineIdxFromPoint(e.clientX, e.clientY);
      if (idx >= 0) { e.preventDefault(); triggerByIdx(idx); }
    });
    kalimbaEl.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const idx = tineIdxFromPoint(t.clientX, t.clientY);
        if (idx >= 0) triggerByIdx(idx);
      }
      e.preventDefault();
    }, { passive: false });
    kalimbaEl.addEventListener('touchmove', (e) => {
      // touchmove で各指の位置を見て新しい鍵に入ったら鳴らす
      for (const t of e.changedTouches) {
        const idx = tineIdxFromPoint(t.clientX, t.clientY);
        const key = 't' + t.identifier;
        if (idx >= 0 && activePointers.get(key) !== idx) {
          activePointers.set(key, idx);
          triggerByIdx(idx);
        }
      }
      e.preventDefault();
    }, { passive: false });
    kalimbaEl.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) activePointers.delete('t' + t.identifier);
    });
  }
}

async function handleTineTap(idx) {
  const tine = TINES[idx];
  const tineEl = kalimbaEl.querySelector(`.tine[data-idx="${idx}"]`);
  if (!tineEl) return;

  // 押下アニメ (音が鳴らなくても視覚フィードバック)
  tineEl.classList.add('pressed');
  setTimeout(() => tineEl.classList.remove('pressed'), 100);

  if (state.vibrate && navigator.vibrate) {
    try { navigator.vibrate(8); } catch (e) {}
  }

  // 音声: 未初期化なら遅延初期化 (PCで初期化失敗した場合の保険)
  if (!audioReady) {
    try { await initAudio(); } catch (e) { console.warn(e); }
  } else {
    ensureAudioRunning();
  }
  playNote(tine.note);

  if (state.mode === 'song' && state.isPlaying) {
    checkHit(tine.note);
  }
}

// ---------- 曲モード ----------
function loadSongs() {
  songSelect.innerHTML = '';
  SONGS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.title} - ${s.composer}`;
    songSelect.appendChild(opt);
  });
  state.songId = SONGS[0].id;
  songSelect.value = state.songId;
}

function getCurrentSong() {
  return SONGS.find(s => s.id === state.songId);
}

function getTineXForNote(noteName) {
  const tineIdx = TINES.findIndex(t => t.note === noteName);
  if (tineIdx < 0) return null;
  const tineEl = kalimbaEl.querySelector(`.tine[data-idx="${tineIdx}"]`);
  if (!tineEl) return null;
  const trackRect = notesTrack.getBoundingClientRect();
  const tineRect  = tineEl.getBoundingClientRect();
  return {
    x: tineRect.left - trackRect.left + tineRect.width / 2,
    width: Math.max(20, tineRect.width),
  };
}

function getHitLineY() {
  const trackRect   = notesTrack.getBoundingClientRect();
  const kalimbaRect = kalimbaEl.getBoundingClientRect();
  return Math.max(40, kalimbaRect.top - trackRect.top - 6);
}

function positionHitLine() {
  hitLineEl.style.top = `${getHitLineY()}px`;
}

function startSong() {
  const song = getCurrentSong();
  if (!song) return;

  cleanupSong();

  const beatSec  = 60 / song.bpm;
  // 落下時間より長いカウントイン (最初のノーツが画面上端から始まる)
  const countIn  = Math.max(state.speed, (song.countInBeats || 0) * beatSec);

  state.songNotes = song.notes.map(n => ({
    time: n.beat * beatSec + countIn,
    note: n.n,
    len:  n.len * beatSec,
    hit: false,
    missed: false,
    autoPlayed: false,
    spawned: false,
    el: null,
  }));

  state.songEndTime  = Math.max(...state.songNotes.map(n => n.time + n.len)) + 1.5;
  state.hitCount     = 0;
  state.totalCount   = state.songNotes.length;
  state.songStartTime = Tone.now();
  state.isPlaying    = true;

  // ボタン表示: 起動した側が "停止" になり、もう一方は無効化
  const listenBtn = document.getElementById('listenBtn');
  if (state.autoPlay) {
    listenBtn.textContent = '■ 停止';
    listenBtn.classList.add('active');
    playBtn.disabled = true;
  } else {
    playBtn.textContent = '■ 停止';
    listenBtn.disabled = true;
  }
  // 視聴モードのスコアは無意味なので薄く
  scoreEl.style.opacity = state.autoPlay ? '0.35' : '1';

  updateScoreDisplay();
  positionHitLine();

  state.rafId = requestAnimationFrame(animateSong);
}

function stopSong() {
  state.isPlaying = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  cleanupSong();

  const listenBtn = document.getElementById('listenBtn');
  playBtn.textContent = '▶ 演奏';
  playBtn.disabled = false;
  listenBtn.textContent = '🎧 視聴';
  listenBtn.classList.remove('active');
  listenBtn.disabled = false;
  scoreEl.style.opacity = '1';
}

function cleanupSong() {
  notesTrack.innerHTML = '';
  state.songNotes.forEach(n => { n.el = null; });
}

function animateSong() {
  if (!state.isPlaying) return;

  const elapsed = Tone.now() - state.songStartTime;
  const hitY    = getHitLineY();
  const speed   = state.speed;
  const pxPerSec = hitY / speed;

  for (const note of state.songNotes) {
    const dt = note.time - elapsed; // 正: まだ来ていない / 負: 過ぎた

    // 自動演奏: 時刻が到来したら自動で鳴らす
    if (state.autoPlay && !note.autoPlayed && !note.hit && dt <= 0 && dt > -0.4) {
      note.autoPlayed = true;
      note.hit = true; // 以降のミス判定をスキップ
      playNote(note.note);

      const tIdx = TINES.findIndex(t => t.note === note.note);
      if (tIdx >= 0) {
        const tEl = kalimbaEl.querySelector(`.tine[data-idx="${tIdx}"]`);
        if (tEl) {
          tEl.classList.add('pressed', 'glow');
          setTimeout(() => tEl.classList.remove('pressed', 'glow'), 220);
        }
      }
      if (note.el) {
        note.el.classList.add('hit');
        const elRef = note.el;
        setTimeout(() => elRef.remove(), 320);
        note.el = null;
      }
    }

    // 出現
    if (!note.spawned && dt <= speed && dt > -1.5) {
      const pos = getTineXForNote(note.note);
      if (pos) {
        const el = document.createElement('div');
        el.className = 'falling-note';
        const h = Math.max(28, note.len * pxPerSec * 0.9);
        el.style.width  = `${pos.width}px`;
        el.style.left   = `${pos.x - pos.width / 2}px`;
        el.style.height = `${h}px`;
        el.style.top    = '0';

        if (state.labelStyle !== 'none') {
          el.textContent = NOTE_LABELS[state.labelStyle][note.note[0]];
        }
        notesTrack.appendChild(el);
        note.el = el;
        note.spawned = true;
      }
    }

    // 位置更新
    if (note.el) {
      const noteHeight = parseFloat(note.el.style.height);
      const bottomY = hitY - dt * pxPerSec;
      const topY = bottomY - noteHeight;
      note.el.style.transform = `translate3d(0, ${topY}px, 0)`;

      // ミス判定
      if (!note.hit && !note.missed && dt < -0.25) {
        note.missed = true;
        note.el.classList.add('miss');
        showOverlay('Miss', 'miss');
      }

      // 画面外へ消える
      if (dt < -1.4) {
        note.el.remove();
        note.el = null;
      }
    }
  }

  if (elapsed > state.songEndTime) {
    const accuracy = state.totalCount ? Math.round(state.hitCount / state.totalCount * 100) : 0;
    stopSong();
    showOverlay(`完了！ ${state.hitCount}/${state.totalCount} (${accuracy}%)`, 'perfect');
    return;
  }

  state.rafId = requestAnimationFrame(animateSong);
}

const HIT_WINDOW_PERFECT = 0.13;
const HIT_WINDOW_GOOD    = 0.28;

function checkHit(noteName) {
  const elapsed = Tone.now() - state.songStartTime;

  let best = null;
  let bestDt = Infinity;
  for (const note of state.songNotes) {
    if (note.hit || note.missed) continue;
    if (note.note !== noteName) continue;
    const dt = Math.abs(note.time - elapsed);
    if (dt < bestDt) {
      best = note;
      bestDt = dt;
    }
  }

  if (best && bestDt < HIT_WINDOW_GOOD) {
    best.hit = true;
    state.hitCount++;
    if (best.el) {
      best.el.classList.add('hit');
      const elRef = best.el;
      setTimeout(() => { elRef.remove(); }, 320);
      best.el = null;
    }
    showOverlay(bestDt < HIT_WINDOW_PERFECT ? 'Perfect!' : 'Good!',
                bestDt < HIT_WINDOW_PERFECT ? 'perfect'  : 'good');

    // 鍵盤ハイライト
    const tineIdx = TINES.findIndex(t => t.note === noteName);
    if (tineIdx >= 0) {
      const tineEl = kalimbaEl.querySelector(`.tine[data-idx="${tineIdx}"]`);
      tineEl.classList.add('glow');
      setTimeout(() => tineEl.classList.remove('glow'), 220);
    }
    updateScoreDisplay();
  }
}

function updateScoreDisplay() {
  scoreEl.textContent = `${state.hitCount} / ${state.totalCount}`;
}

let overlayTimer = null;
function showOverlay(text, cls) {
  overlayMsg.textContent = text;
  overlayMsg.className = `overlay-msg show ${cls}`;
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => {
    overlayMsg.className = 'overlay-msg';
  }, 700);
}

// ---------- UIバインド ----------
function applyModeClass(mode) {
  document.body.classList.toggle('mode-song', mode === 'song');
  document.body.classList.toggle('mode-free', mode === 'free');
}

function applySongBarEnabled(enabled) {
  // フリー演奏中は曲バーの各コントロールをアクセス不可に (CSS は body.mode-free で透明度・pointer制御)
  songBarEl.querySelectorAll('select, button').forEach(el => {
    el.disabled = !enabled;
    if (!enabled) el.setAttribute('tabindex', '-1');
    else el.removeAttribute('tabindex');
  });
  songBarEl.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (state.mode === mode) return;
      if (state.isPlaying) stopSong();

      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      state.mode = mode;
      applyModeClass(mode);
      applySongBarEnabled(mode === 'song');

      if (mode === 'song') {
        if (!state.songId) state.songId = SONGS[0].id;
        songSelect.value = state.songId;
        updateScoreDisplay();
      } else {
        cleanupSong();
      }
      requestAnimationFrame(() => requestAnimationFrame(positionHitLine));
    });
  });
}

function setupSettings() {
  const modal = document.getElementById('settingsModal');
  document.getElementById('settingsBtn').addEventListener('click', () => {
    modal.hidden = false;
  });
  document.getElementById('settingsClose').addEventListener('click', () => {
    modal.hidden = true;
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  // ラベル
  const labelSeg = document.getElementById('labelStyleSeg');
  labelSeg.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      labelSeg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      state.labelStyle = btn.dataset.val;
      renderKalimba();
    });
  });

  // 速度
  const speedRange = document.getElementById('speedRange');
  const speedVal   = document.getElementById('speedVal');
  speedRange.addEventListener('input', () => {
    state.speed = parseFloat(speedRange.value);
    speedVal.textContent = `${state.speed}秒`;
  });

  // 音量 (マスターボリューム経由で全 Sampler を一括制御)
  const volumeRange = document.getElementById('volumeRange');
  volumeRange.addEventListener('input', () => {
    state.volume = parseFloat(volumeRange.value);
    if (masterVolume) masterVolume.volume.value = state.volume;
  });

  // 振動
  const vibrateToggle = document.getElementById('vibrateToggle');
  vibrateToggle.addEventListener('change', () => {
    state.vibrate = vibrateToggle.checked;
  });
}

function setupSongControls() {
  songSelect.addEventListener('change', () => {
    if (state.isPlaying) stopSong();
    state.songId = songSelect.value;
  });

  // 「▶ 演奏」: 自分でタップして遊ぶモードで開始
  playBtn.addEventListener('click', () => {
    if (state.isPlaying) {
      stopSong();
    } else {
      state.autoPlay = false;
      startSong();
    }
  });

  // 「🎧 視聴」: 自動演奏で曲を聴くモードで開始
  const listenBtn = document.getElementById('listenBtn');
  listenBtn.addEventListener('click', () => {
    if (state.isPlaying) {
      stopSong();
    } else {
      state.autoPlay = true;
      startSong();
    }
  });
}

function setupResize() {
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      positionHitLine();
    }, 80);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

function setupMenu() {
  const menuBtn = document.getElementById('menuBtn');
  const backdrop = document.getElementById('menuBackdrop');
  if (!menuBtn) return;

  const closeMenu = () => document.body.classList.remove('menu-open');
  const toggleMenu = () => document.body.classList.toggle('menu-open');

  menuBtn.addEventListener('click', toggleMenu);
  backdrop.addEventListener('click', closeMenu);

  // タブ切替や演奏開始時に自動で閉じる
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', closeMenu));
  document.getElementById('playBtn').addEventListener('click', closeMenu);
  document.getElementById('listenBtn').addEventListener('click', closeMenu);

  // 横向き判定 (複数手段OR / モバイルChromeでも確実に効くように)
  const isLandscapeNow = () => {
    if (window.innerWidth > window.innerHeight) return true;
    if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) return true;
    if (screen.orientation && screen.orientation.type && screen.orientation.type.indexOf('landscape') >= 0) return true;
    return false;
  };
  const updateOrientation = () => {
    const isLandscape = isLandscapeNow();
    document.body.classList.toggle('is-landscape', isLandscape);
    if (!isLandscape) closeMenu();
  };
  updateOrientation();

  // 各種イベントを購読 (モバイルでは発火タイミングがバラつくので冗長に)
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', () => {
    // orientationchange直後はサイズが未確定の場合あり → 遅延再判定
    setTimeout(updateOrientation, 50);
    setTimeout(updateOrientation, 250);
    setTimeout(updateOrientation, 600);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateOrientation);
  }
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', updateOrientation);
  }
  if (window.matchMedia) {
    const mql = window.matchMedia('(orientation: landscape)');
    if (mql.addEventListener)      mql.addEventListener('change', updateOrientation);
    else if (mql.addListener)      mql.addListener(updateOrientation);
  }
}

function setupKeyboard() {
  window.addEventListener('keydown', (e) => {
    // モーダル表示中・入力欄フォーカス中は無視
    if (e.repeat) return;
    if (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const startModal = document.getElementById('startModal');
    if (startModal && !startModal.hidden) return;

    const idx = KEY_TO_IDX[e.key.toLowerCase()];
    if (idx !== undefined) {
      e.preventDefault();
      handleTineTap(idx);
    }
  });
}

// ---------- 起動 ----------
function init() {
  applyModeClass('free');
  loadSongs();
  renderKalimba();
  setupKalimbaInteraction();
  setupTabs();
  setupSettings();
  setupSongControls();
  setupResize();
  setupKeyboard();
  setupMenu();
  applySongBarEnabled(false);  // 初期 = フリー演奏なので曲バーは無効化

  requestAnimationFrame(() => requestAnimationFrame(positionHitLine));

  const startBtn = document.getElementById('startAppBtn');
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    const original = startBtn.textContent;
    startBtn.textContent = '準備中…';
    try {
      await initAudio();
    } catch (e) {
      console.error('audio init failed', e);
    }
    document.getElementById('startModal').hidden = true;
    startBtn.disabled = false;
    startBtn.textContent = original;
    positionHitLine();
  });
}

init();
