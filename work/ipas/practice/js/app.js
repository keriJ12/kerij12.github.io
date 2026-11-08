/* app.js — 畫面與事件（邏輯與 DOM 結構）。 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function show(id) {
    $$('.screen').forEach(function (s) { s.hidden = (s.id !== id); });
  }

  function flash(node, message, kind) {
    if (!node) return;
    node.textContent = message || '';
    node.className = 'msg' + (message ? ' msg--' + (kind || 'error') : '');
  }

  /* ================= 目前的練習回合 ================= */
  var session = { list: [], index: 0, answered: false, label: '' };

  /* ================= 登入 / 註冊 ================= */
  /* 非同步送出的共用外殼：送出中把按鈕鎖起來，避免連點兩次建出兩個帳號。 */
  function submitAsync(form, msgNode, run) {
    var btn = form.querySelector('button[type="submit"]');
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '處理中…'; }
    flash(msgNode, '');
    run().then(function (r) {
      if (!r.ok) { flash(msgNode, r.error, 'error'); return; }
      route();
    }).catch(function (err) {
      console.error(err);
      flash(msgNode, '暫時無法儲存，請確認瀏覽器允許本機儲存', 'error');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    });
  }

  function initAuthScreen() {
    $$('.authtab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.dataset.pane;
        $$('.authtab').forEach(function (b) {
          var on = (b === btn);
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', String(on));
        });
        $$('.authpane').forEach(function (p) { p.hidden = (p.dataset.pane !== target); });
        flash($('#auth-msg'), '');
      });
    });

    $('#form-login').addEventListener('submit', function (e) {
      e.preventDefault();
      submitAsync(this, $('#auth-msg'), function () {
        return Auth.login($('#login-email').value, $('#login-pw').value);
      });
    });

    $('#form-register').addEventListener('submit', function (e) {
      e.preventDefault();
      submitAsync(this, $('#auth-msg'), function () {
        return Auth.register($('#reg-email').value, $('#reg-pw').value, $('#reg-pw2').value);
      });
    });
  }

  /* ================= 啟用碼 ================= */
  function initActivateScreen() {
    $('#form-activate').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = Auth.redeem($('#activate-code').value);
      if (!r.ok) return flash($('#activate-msg'), r.error, 'error');
      flash($('#activate-msg'),
        '開通成功，使用期限至 ' + Auth.formatDate(r.expiresAt) + '（' + Auth.VALID_DAYS + ' 天）',
        'ok');
      setTimeout(route, 900);
    });

    $('#activate-logout').addEventListener('click', function () {
      Auth.logout();
      route();
    });
  }

  function renderActivateScreen() {
    var st = Auth.status();
    $('#activate-who').textContent = st.user ? st.user.email : '';
    flash($('#activate-msg'),
      st.reason === 'expired'
        ? '你的使用期限已於 ' + Auth.formatDate(st.expiresAt) + ' 到期，請輸入新的啟用碼'
        : '',
      'error');
    $('#activate-code').value = '';
  }

  /* ================= 主畫面外框 ================= */
  function initShell() {
    $$('.navtab').forEach(function (btn) {
      btn.addEventListener('click', function () { openTab(btn.dataset.tab); });
    });
    $('#btn-logout').addEventListener('click', function () {
      Auth.logout();
      if (Store.isDemo()) {
        // 試玩結束：清掉分頁內的暫存，並把 ?demo=1 從網址拿掉，免得重新整理又自動進去
        Store.leaveDemo();
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      }
      route();
    });
  }

  /* ================= 作品集「直接試玩」 =================
   * 網址帶 ?demo=1 時：不註冊、不輸入啟用碼，直接用一個預填的示範帳號進主畫面。
   * Store 在試玩模式下所有讀寫都走 sessionStorage，所以帳號、啟用狀態、作答進度
   * 都只留在這個分頁，關掉就消失；localStorage 裡既有的一般帳號完全不受影響。 */
  var DEMO_EMAIL = 'demo@portfolio.local';

  function wantsDemo() {
    return /[?&]demo=1(?:&|$)/.test(location.search);
  }

  function enterDemo() {
    if (!Store.enterDemo()) return false;
    var now = new Date();
    var user = Store.getUser(DEMO_EMAIL);
    if (!user) {
      user = {
        email: DEMO_EMAIL,
        // 沒有真密碼：algo 'demo' 不會通過 verifyPassword，所以這個帳號只能靠 ?demo=1 進來
        password: { algo: 'demo', salt: '', hash: '' },
        createdAt: now.toISOString(),
        activation: {
          code: 'IPAS-DEMO-2026',
          activatedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + Auth.VALID_DAYS * 86400000).toISOString()
        }
      };
      Store.saveUser(user);
    }
    Store.setSession(DEMO_EMAIL);
    return true;
  }

  function openTab(name) {
    $$('.navtab').forEach(function (b) {
      var on = (b.dataset.tab === name);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
    $$('.tabpane').forEach(function (p) { p.hidden = (p.dataset.tab !== name); });
    if (name === 'progress') renderProgress();
    if (name === 'practice') renderPracticeSetup();
    if (name === 'wrong') renderWrongBook();
  }

  /* ================= 進度頁 ================= */
  function renderProgress() {
    var o = Quiz.overview();
    $('#stat-answered').textContent = o.answered;
    $('#stat-answered-total').textContent = '／' + o.totalAnswerable + ' 題';
    $('#stat-accuracy').textContent = o.accuracy + '%';
    $('#stat-wrong').textContent = o.wrongCount;

    var wrap = $('#mastery-list');
    wrap.innerHTML = '';
    Quiz.masteryByTopic().forEach(function (row) {
      var item = el('div', 'mastery');

      var head = el('div', 'mastery__head');
      head.appendChild(el('span', 'mastery__name', row.topic));
      head.appendChild(el('span', 'mastery__pct',
        row.answered ? row.pct + '%' : '尚未作答'));
      item.appendChild(head);

      var track = el('div', 'bar');
      var fill = el('div', 'bar__fill bar--' + row.band);
      fill.style.width = (row.answered ? row.pct : 0) + '%';
      track.appendChild(fill);
      item.appendChild(track);

      item.appendChild(el('div', 'mastery__sub',
        '已做 ' + row.answered + '／' + row.total + ' 題（涵蓋 ' + row.coverage + '%）'
        + '　答對 ' + row.correct + ' 題'));
      wrap.appendChild(item);
    });
  }

  /* ================= 練習設定 ================= */
  function renderPracticeSetup() {
    show('screen-app');
    $('#practice-setup').hidden = false;
    $('#practice-run').hidden = true;

    var topicBox = $('#filter-topics');
    if (!topicBox.dataset.ready) {
      Quiz.topics.forEach(function (t) {
        var lab = el('label', 'chk');
        var input = el('input');
        input.type = 'checkbox';
        input.value = t.topic;
        lab.appendChild(input);
        lab.appendChild(el('span', null, t.topic + '（' + t.count + '）'));
        topicBox.appendChild(lab);
      });
      topicBox.dataset.ready = '1';
    }
    updatePoolCount();
  }

  function currentFilters() {
    return {
      topics: $$('#filter-topics input:checked').map(function (i) { return i.value; }),
      stars: $$('#filter-stars input:checked').map(function (i) { return Number(i.value); }),
      unseenFirst: $('#opt-unseen').checked,
      limit: Number($('#opt-limit').value) || 0
    };
  }

  function updatePoolCount() {
    var f = currentFilters();
    f.limit = 0;
    $('#pool-count').textContent = Quiz.pick(f).length;
  }

  function initPractice() {
    $('#practice-setup').addEventListener('change', updatePoolCount);

    $('#btn-start').addEventListener('click', function () {
      var f = currentFilters();
      var list = Quiz.pick(f);
      if (!list.length) return flash($('#practice-msg'), '這個條件下沒有題目，放寬一點再試', 'error');
      flash($('#practice-msg'), '');
      startSession(list, '自選練習');
    });

    $('#btn-next').addEventListener('click', function () {
      if (session.index < session.list.length - 1) {
        session.index += 1;
        renderQuestion();
      } else {
        finishSession();
      }
    });

    $('#btn-quit').addEventListener('click', function () {
      renderPracticeSetup();
      renderProgress();
    });
  }

  function startSession(list, label) {
    session = { list: list, index: 0, answered: false, label: label };
    $('#practice-setup').hidden = true;
    $('#practice-run').hidden = false;
    openTabSilently('practice');
    renderQuestion();
  }

  function openTabSilently(name) {
    $$('.navtab').forEach(function (b) {
      var on = (b.dataset.tab === name);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
    $$('.tabpane').forEach(function (p) { p.hidden = (p.dataset.tab !== name); });
  }

  function stars(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  /* 題目來源標示。擬真題一定要看得出是擬真，不能讓人誤以為是官方原題。
   * label 由 build_data.py 產生；舊資料沒有 label 時退回卷次＋題號。 */
  function sourceLabel(q) {
    return q.label || (q.paper + '　第 ' + q.number + ' 題');
  }

  function renderQuestion() {
    var q = session.list[session.index];
    session.answered = false;

    $('#run-label').textContent = session.label;
    $('#run-count').textContent = (session.index + 1) + ' / ' + session.list.length;
    $('#q-meta').textContent =
      sourceLabel(q) + '　' + q.code + ' ' + q.codeName + '　' + q.type + '　' + stars(q.stars);
    $('#q-stem').textContent = q.stem || '（本題僅提供考點索引，未收錄題幹）';

    var box = $('#q-options');
    box.innerHTML = '';
    q.options.forEach(function (text, i) {
      var btn = el('button', 'option');
      btn.type = 'button';
      btn.appendChild(el('span', 'option__letter', 'ABCD'[i]));
      btn.appendChild(el('span', 'option__text', text));
      btn.addEventListener('click', function () { answer(q, i, box); });
      box.appendChild(btn);
    });

    $('#q-explain').hidden = true;
    $('#btn-next').hidden = true;
  }

  function answer(q, chosen, box) {
    if (session.answered) return;
    session.answered = true;

    var correct = Quiz.grade(q, chosen);
    $$('.option', box).forEach(function (btn, i) {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('option--right');
      if (i === chosen && !correct) btn.classList.add('option--wrong');
    });

    var ex = $('#q-explain');
    ex.innerHTML = '';
    ex.appendChild(el('div', 'verdict verdict--' + (correct ? 'right' : 'wrong'),
      correct ? '答對了' : '答錯了　正解：' + 'ABCD'[q.answer]));
    if (q.point) ex.appendChild(row('考點', q.point));
    if (q.signal) ex.appendChild(row('辨識訊號', q.signal));
    if (q.trap) ex.appendChild(row('干擾形狀', q.trap));
    if (q.keywords && q.keywords.length) ex.appendChild(row('關鍵字', q.keywords.join('、')));
    ex.hidden = false;

    $('#btn-next').hidden = false;
    $('#btn-next').textContent =
      session.index < session.list.length - 1 ? '下一題' : '完成這輪';
    $('#btn-next').focus();
  }

  function row(label, value) {
    var d = el('div', 'exrow');
    d.appendChild(el('span', 'exrow__label', label));
    d.appendChild(el('span', 'exrow__value', value));
    return d;
  }

  function finishSession() {
    var ids = session.list.map(function (q) { return q.id; });
    var p = Store.progress();
    var right = ids.filter(function (id) {
      return p.answers[id] && p.answers[id].correct;
    }).length;

    $('#practice-run').hidden = true;
    $('#practice-setup').hidden = false;
    flash($('#practice-msg'),
      '這輪做完 ' + ids.length + ' 題，答對 ' + right + ' 題（'
      + Math.round(right / ids.length * 100) + '%）', 'ok');
    renderProgress();
    updatePoolCount();
  }

  /* ================= 錯題本 ================= */
  function renderWrongBook() {
    var list = Quiz.wrongQuestions();
    $('#wrong-count').textContent = list.length;
    $('#btn-practice-wrong').disabled = list.length === 0;

    var wrap = $('#wrong-list');
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.appendChild(el('p', 'empty', '目前沒有待複習的錯題。答錯的題會自動進來，答對一次就移除。'));
      return;
    }
    list.forEach(function (q) {
      var item = el('div', 'wrongitem');
      item.appendChild(el('div', 'wrongitem__meta',
        sourceLabel(q) + '　' + q.code + ' ' + q.codeName + '　' + stars(q.stars)));
      item.appendChild(el('div', 'wrongitem__point', q.point || q.stem.slice(0, 60)));
      wrap.appendChild(item);
    });
  }

  function initWrongBook() {
    $('#btn-practice-wrong').addEventListener('click', function () {
      var list = Quiz.wrongQuestions();
      if (!list.length) return;
      startSession(list.sort(function () { return Math.random() - 0.5; }), '錯題複習');
    });
  }

  /* ================= 深淺模式 =================
   * 決定：手動切換，不跟隨系統設定。
   * 首次載入的套用在 index.html 的 <head> inline script，這裡只負責切換與記錄。 */
  var THEME_KEY = 'ipas.theme';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}

    var btn = $('#btn-theme');
    if (!btn) return;
    var dark = (theme === 'dark');
    var label = dark ? '切換到淺色模式' : '切換到深色模式';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', label);
    btn.title = label;
    var icon = $('.themetoggle__icon', btn);
    if (icon) icon.textContent = dark ? '☀' : '☾';
  }

  function initTheme() {
    applyTheme(currentTheme());
    var btn = $('#btn-theme');
    if (!btn) return;
    btn.addEventListener('click', function () {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  /* ================= 路由 ================= */
  function route() {
    var st = Auth.status();
    // 右上角那排只在「已登入且已開通」時才有意義
    $('.topbar__right').hidden = !st.active;

    if (!st.signedIn) { show('screen-auth'); return; }
    if (!st.active) { show('screen-activate'); renderActivateScreen(); return; }

    show('screen-app');
    if (Store.isDemo()) {
      $('#who').textContent = '試玩帳號';
      $('#expiry').textContent = '進度只留在這個分頁';
    } else {
      $('#who').textContent = st.user.email;
      $('#expiry').textContent = '有效期至 ' + Auth.formatDate(st.expiresAt)
        + '（剩 ' + st.daysLeft + ' 天）';
    }
    openTab('progress');
  }

  /* ================= 啟動 ================= */
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    if (!window.IPAS_DATA) {
      document.body.innerHTML =
        '<p style="padding:2rem">讀不到題庫（data/questions.js 沒有載入）。</p>';
      return;
    }
    var m = Quiz.meta;
    document.body.dataset.mode = m.mode;

    // 作品集「直接試玩」入口：要在 route() 之前完成
    var demo = wantsDemo() && enterDemo();

    $('#build-banner').textContent =
      m.banner + '　題庫 ' + m.total + ' 題（可作答 ' + m.answerable + '）　產生於 ' + m.builtAt
      + (demo ? '　｜　直接試玩模式：帳號與進度只存在這個分頁，關掉就消失' : '');

    // 標籤文字依建置模式決定，不寫死在 HTML
    var PILL = {
      member: '原創擬真題 · 非官方試題',
      demo: 'DEMO · 示範版'
    };
    if (PILL[m.mode]) {
      $$('.demo-pill').forEach(function (p) { p.textContent = PILL[m.mode]; });
    }

    initAuthScreen();
    initActivateScreen();
    initShell();
    initPractice();
    initWrongBook();
    route();
  });
})();
