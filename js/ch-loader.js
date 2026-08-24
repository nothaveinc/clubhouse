/* Clubhouse production loading animation.
 * Load immediately after the loader markup in index.html, without defer or async.
 * Display is controlled by the ch-loading class on <html>.
 * The ch-locked class holds the scroll/animation lock and is released at fade start.
 */

(function () {
  "use strict";

  /* ロゴから実測した円のジオメトリ。
     make_logo_line.py の出力をここに貼る。 */
  var GEOM = { viewBox: 1000, cx: 501.2, cy: 500.6, rx: 446.6, ry: 462.0 };

  /* 調整用パラメータ */
  var WAVE = {
    ampA: 34, // 波の振幅
    periodA: 500, // 1000 の約数であること（継ぎ目なくループさせるため）
    speedA: 455, // units/sec（参考実装の 0.91Hz 相当）
    depth: 1500, // 液面より下をどこまで塗るか
    width: 2000 // viewBox 幅 + ループ幅
  };

  var HOLD_MS = 600; // 100% を保持する時間
  var COLOR_MS = 450; // カラーへ切り替わる時間（HOLD_MS の内側に収める）
  var FADE_MS = 700; // フェードアウト時間
  var SIM_MAX = 90; // 実進捗が取れない場合に自走する上限
  var HARD_TIMEOUT_MS = 5000; // 読み込みが詰まっても必ず終わらせる
  var MIN_FILL_MS = 1800; // 1% → 100% にかける最短時間（回線が速くてもこれ未満にしない）
  var TAPER_SPAN = 6; // 残りこの%を切ったら波を収束させ、満杯時の隙間を無くす

  /* ---------- カラー到達時の「きらっ」 ----------
     ロゴに元から描かれているキラキラの実測座標（viewBox 1000 空間）。
     同じ位置で瞬かせることで、描かれた星が光ったように見せる。 */
  var STARS = [
    { x: 156, y: 447, r: 46, delay: 0.0 },
    { x: 838, y: 437, r: 42, delay: 0.14 },
    { x: 276, y: 527, r: 32, delay: 0.28 }
  ];
  // 中心を原点にした4方向の星。scale() で大きさを与える
  var STAR_D =
    "M0 -1 C .12 -.32 .32 -.12 1 0 C .32 .12 .12 .32 0 1 " +
    "C -.12 .32 -.32 .12 -1 0 C -.32 -.12 -.12 -.32 0 -1 Z";
  var SPARKLE_DELAY = 200; // 拭き上げ開始から瞬き始めるまで
  var SPARKLE_MS = 380; // 瞬きの長さ。DELAY と合わせて HOLD_MS の内側に収める

  var root = document.getElementById("chLoader");
  if (!root) return;

  /* ローダーを表示するかどうかは index.html の <head> のスクリプトが
     <html> の ch-loading クラスで指示する。付いていなければ何もせず退場する。 */
  if (!document.documentElement.classList.contains("ch-loading")) {
    if (root.parentNode) root.parentNode.removeChild(root);
    return;
  }

  var els = {
    liquid: document.getElementById("chLiquid"),
    waveA: document.getElementById("chWaveA"),
    foam: document.getElementById("chFoam"),
    ripples: document.getElementById("chRipples"),
    clip: document.getElementById("chClipShape"),
    pct: document.getElementById("chPct"),
    logo: document.getElementById("chLogo"),
    colorLayer: document.getElementById("chColorLayer"),
    colorMaskWave: document.getElementById("chColorMaskWave"),
    colorWave: document.getElementById("chColorWave"),
    sparkle: document.getElementById("chSparkle")
  };

  var SVG_NS = "http://www.w3.org/2000/svg";
  var reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  /* ---------- 液面の位置計算 ----------
     進捗 → 液面 Y。高さに対して線形なので
     0% = 円の最下部 / 50% = 円の中心 / 100% = 円の最上部 になる。 */
  function surfaceY(p) {
    return GEOM.cy + GEOM.ry - (p / 100) * (2 * GEOM.ry);
  }

  /* ---------- 波形パスの生成 ---------- */
  function wavePath(amp, period, phase) {
    var d = "";
    var step = 8;
    for (var x = 0; x <= WAVE.width; x += step) {
      var y = amp * Math.sin(((x / period) * Math.PI * 2) + phase);
      d += (x === 0 ? "M" : "L") + x + " " + y.toFixed(2) + " ";
    }
    d += "L" + WAVE.width + " " + WAVE.depth + " L0 " + WAVE.depth + " Z";
    return d;
  }

  function buildWaves(scale) {
    if (scale === undefined) scale = 1;
    // reduced-motion では揺れを消してまっすぐな液面にする
    var a = reduce ? 0 : WAVE.ampA * scale;
    els.waveA.setAttribute("d", wavePath(a, WAVE.periodA, 0));
  }

  /* ---------- 泡（液面付近に少しだけ） ---------- */
  var foam = [];
  function buildFoam() {
    els.foam.innerHTML = "";
    foam = [];
    if (reduce) return;
    for (var i = 0; i < 7; i++) {
      var c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("class", "ch-loader__foam");
      els.foam.appendChild(c);
      foam.push({
        el: c,
        x: 0,
        y: 0,
        r: 0,
        life: 0,
        dur: 0,
        seed: Math.random() * 6.28
      });
      resetFoam(foam[i], Math.random());
    }
  }
  function resetFoam(f, startLife) {
    // 液面グループ内の座標。y=0 が液面なので、その少し下から浮かせる
    f.x = GEOM.cx + (Math.random() * 2 - 1) * GEOM.rx * 0.72;
    f.y = 12 + Math.random() * 46;
    f.r = 1.8 + Math.random() * 3.4;
    f.dur = 2.2 + Math.random() * 2.6;
    f.life = startLife * f.dur;
  }

  /* ---------- カラー到達時に瞬く星 ---------- */
  var starEls = [];
  function buildSparkle() {
    els.sparkle.innerHTML = "";
    starEls = [];
    // reduced-motion では 1 つも作らない
    if (reduce) return;
    for (var i = 0; i < STARS.length; i++) {
      var g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("opacity", "0");
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", STAR_D);
      path.setAttribute("class", "ch-loader__star");
      // 半径ぶん拡大してから、親グループで位置と瞬きを与える
      path.setAttribute("transform", "scale(" + STARS[i].r + ")");
      path.setAttribute("filter", "url(#chStarGlow)");
      g.appendChild(path);
      els.sparkle.appendChild(g);
      starEls.push(g);
    }
  }

  /* ---------- 注ぎ口の波紋 ---------- */
  var ripples = [];
  function spawnRipple(y) {
    if (reduce) return;
    var e = document.createElementNS(SVG_NS, "ellipse");
    e.setAttribute("class", "ch-loader__ripple");
    e.setAttribute("cx", GEOM.cx);
    els.ripples.appendChild(e);
    ripples.push({ el: e, y: y, life: 0, dur: 1.1 });
  }

  /* ---------- 進捗の状態 ---------- */
  var target = 1; // 目標値
  var smooth = 1; // 実際に描画に使う唯一の値
  var manual = false; // デモが手動操作しているか
  var released = false; // 100% へ解放されたか
  var finishing = false;
  var startedAt = 0;
  var lastT = 0;
  var waveX = 0;
  var lastAmpScale = 1; // 直近に適用した波の振幅倍率
  var rafId = null;
  var holdTimer = null;
  var sparkleTimer = null;

  /* ---------- 描画（% と液面を同じ値から導出する） ---------- */
  function render() {
    var shown = Math.max(1, Math.min(100, Math.round(smooth)));
    var y = surfaceY(smooth);

    els.liquid.setAttribute("transform", "translate(0," + y.toFixed(2) + ")");
    els.pct.textContent = shown + "%";
    root.setAttribute("aria-valuenow", shown);
    root.setAttribute("aria-valuetext", shown + "%");

    return y;
  }

  /* ---------- メインループ ---------- */
  function frame(now) {
    if (!lastT) lastT = now;
    var dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;

    // 経過時間から決まる上限。回線が速くても MIN_FILL_MS 未満では 100% にしない
    if (!manual) {
      var cap = 1 + 99 * Math.min(1, (now - startedAt) / MIN_FILL_MS);
      var ceiling = released ? 100 : SIM_MAX;
      target = Math.max(target, Math.min(cap, ceiling));
    }

    // 唯一の真実である smooth を目標へ追従させる
    var k = 1 - Math.pow(0.0001, dt); // フレームレート非依存の lerp
    smooth += (target - smooth) * k;
    if (Math.abs(target - smooth) < 0.05) smooth = target;

    // 100% 直前で波を収束させ、満杯時に頂点へ隙間が残らないようにする
    var ampScale = Math.min(1, (100 - smooth) / TAPER_SPAN);
    if (Math.abs(ampScale - lastAmpScale) > 0.01) {
      lastAmpScale = ampScale;
      buildWaves(ampScale);
    }

    var y = render();

    // 波の横スクロール（液面の高さは揺らさないので % との対応は崩れない）
    if (!reduce) {
      waveX = (waveX + WAVE.speedA * dt) % 1000;
      els.waveA.setAttribute("transform", "translate(" + -waveX.toFixed(2) + ",0)");

      // 泡
      for (var i = 0; i < foam.length; i++) {
        var f = foam[i];
        f.life += dt;
        if (f.life >= f.dur) resetFoam(f, 0);
        var p = f.life / f.dur;
        var drift = Math.sin(f.seed + f.life * 1.4) * 3;
        f.el.setAttribute("cx", (f.x + drift).toFixed(2));
        f.el.setAttribute("cy", (f.y - p * f.y * 0.85).toFixed(2));
        f.el.setAttribute("r", (f.r * (1 - p * 0.35)).toFixed(2));
        f.el.setAttribute("opacity", (Math.sin(p * Math.PI) * 0.85).toFixed(3));
      }

      // 波紋
      for (var j = ripples.length - 1; j >= 0; j--) {
        var rp = ripples[j];
        rp.life += dt;
        var q = rp.life / rp.dur;
        if (q >= 1) {
          rp.el.parentNode && rp.el.parentNode.removeChild(rp.el);
          ripples.splice(j, 1);
          continue;
        }
        rp.el.setAttribute("cy", rp.y.toFixed(2));
        rp.el.setAttribute("rx", (10 + q * 62).toFixed(2));
        rp.el.setAttribute("ry", (3 + q * 15).toFixed(2));
        rp.el.setAttribute("opacity", (1 - q).toFixed(3));
      }

      // 注ぎ続けている間だけ、着水点に波紋を出す
      if (smooth < 99.9) {
        rippleAcc += dt;
        if (rippleAcc > 0.42) {
          rippleAcc = 0;
          spawnRipple(y);
        }
      }
    }

    // 完了判定
    if (!finishing && released && smooth >= 99.95) {
      smooth = 100;
      render();
      finish();
    }

    rafId = requestAnimationFrame(frame);
  }
  var rippleAcc = 0;

  /* ---------- 終了シーケンス ---------- */
  function finish() {
    finishing = true;
    // 100% で波紋を止める
    els.ripples.innerHTML = "";
    ripples = [];
    colorize();
    holdTimer = setTimeout(fadeOut, HOLD_MS);
  }

  function colorize() {
    // 波形マスクで下から拭き上げる。不透明度のクロスフェードだと
    // 中間フレームが濁った灰茶色になり「褪せる」ように見えるため。
    els.colorWave.setAttribute("d", wavePath(WAVE.ampA, WAVE.periodA, 0));
    els.colorLayer.setAttribute("opacity", "1");

    var from = GEOM.cy + GEOM.ry + WAVE.ampA; // 楕円の下端より下
    var to = GEOM.cy - GEOM.ry - WAVE.ampA; // 楕円の上端より上

    if (reduce) {
      els.colorMaskWave.setAttribute("transform", "translate(0," + to + ")");
      return;
    }
    sparkleTimer = setTimeout(sparkle, SPARKLE_DELAY);
    var t0 = null;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / COLOR_MS, 1);
      var e = p * p * (3 - 2 * p);
      var y = from + (to - from) * e;
      els.colorMaskWave.setAttribute(
        "transform",
        "translate(" + (-e * 260).toFixed(2) + "," + y.toFixed(2) + ")"
      );
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* 星を順にふくらませて消す。拭き上げの終盤に重ねることで
     「色が揃った瞬間に光った」ように見せる。 */
  function sparkle() {
    if (reduce || !starEls.length) return;
    els.sparkle.setAttribute("opacity", "1");
    var t0 = null;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / SPARKLE_MS, 1);
      for (var i = 0; i < starEls.length; i++) {
        var s = STARS[i];
        // 星ごとに遅れて始まり、終わりは揃える
        var q = (p - s.delay) / (1 - s.delay);
        if (q <= 0 || q >= 1) {
          starEls[i].setAttribute("opacity", "0");
          continue;
        }
        var e = Math.sin(q * Math.PI); // 出て消えるまでの山
        starEls[i].setAttribute("opacity", e.toFixed(3));
        starEls[i].setAttribute(
          "transform",
          "translate(" + s.x + "," + s.y + ") " +
            "scale(" + (0.35 + e * 0.85).toFixed(3) + ") " +
            "rotate(" + (q * 40).toFixed(1) + ")"
        );
      }
      if (p < 1) requestAnimationFrame(step);
      else els.sparkle.setAttribute("opacity", "0");
    }
    requestAnimationFrame(step);
  }

  function fadeOut() {
    var t0 = null;
    /* フェードが始まった時点でページは見えている。
       ここでロックを解けば、消えきるのを待たずに操作できる。 */
    document.documentElement.classList.remove("ch-locked");
    // CSS transition ではなく rAF で opacity を動かす。
    // 既存 style.css の reduced-motion が transition を !important で
    // 潰すため、そこに影響されない経路にしている。
    var dur = reduce ? 120 : FADE_MS;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / dur, 1);
      // ease-out
      root.style.opacity = String(1 - p * p * (3 - 2 * p));
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        destroy();
      }
    }
    requestAnimationFrame(step);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    if (holdTimer) clearTimeout(holdTimer);
    if (sparkleTimer) clearTimeout(sparkleTimer);
    rafId = null;
    sparkleTimer = null;
    /* 先にノードを外す。クラスを先に外すと 1 フレームだけ
       display 指定が失われて全画面が露出する */
    if (root.parentNode) root.parentNode.removeChild(root);
    document.documentElement.classList.remove("ch-loading");
    /* fadeOut を経ずに destroy された場合の保険 */
    document.documentElement.classList.remove("ch-locked");
    if (window.__chLoaderFailsafe) {
      clearTimeout(window.__chLoaderFailsafe);
      window.__chLoaderFailsafe = null;
    }
    if (window.ChLoader) window.ChLoader.destroyed = true;
    /* ヒーローの入場アニメなど、ページ側の演出を開始させる合図 */
    document.dispatchEvent(new CustomEvent("ch-loader:done"));
  }

  /* ---------- 起動 ---------- */
  function start() {
    els.clip.setAttribute("cx", GEOM.cx);
    els.clip.setAttribute("cy", GEOM.cy);
    els.clip.setAttribute("rx", GEOM.rx);
    els.clip.setAttribute("ry", GEOM.ry);
    buildWaves();
    buildFoam();
    buildSparkle();
    render();
    startedAt = performance.now();
    lastT = 0;
    rafId = requestAnimationFrame(frame);
  }

  // ロゴが読めなかった場合はローダーを畳んでサイトを通す。
  // 画像 1 枚の失敗でページ全体を塞がないため。
  els.logo.addEventListener("error", destroy);

  /* ---------- 外部 API ---------- */
  window.ChLoader = {
    /* 0–100 を外部から指定。% 表示と液面が同時に追従する。
       snap=true で補間を挟まず即座にその値にする（検証用） */
    setProgress: function (n, snap) {
      n = Math.max(0, Math.min(100, Number(n) || 0));
      manual = true;
      target = n;
      if (snap) {
        smooth = n;
        render();
      }
      if (n >= 100) released = true;
    },
    /* 100% へ解放し、保持 → フェードアウト → DOM 除去 */
    complete: function () {
      manual = false;
      released = true;
      target = 100;
    },
    /* 即座に DOM から取り除く */
    destroy: destroy,
    /* 現在値（検証用） */
    get value() {
      return smooth;
    },
    get surfaceY() {
      return surfaceY(smooth);
    },
    geom: GEOM,
    reducedMotion: reduce
  };

  /* ---------- 実際の読み込み進捗に連動 ---------- */
  function release() {
    if (!manual) {
      released = true;
    }
  }
  if (document.readyState === "complete") {
    setTimeout(release, 400);
  } else {
    window.addEventListener("load", release);
  }
  // 読み込みが詰まっても必ず終わらせる
  setTimeout(release, HARD_TIMEOUT_MS);

  start();
})();

