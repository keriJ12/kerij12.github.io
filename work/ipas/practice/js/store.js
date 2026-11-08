/* store.js — 所有 localStorage 讀寫都走這裡，其他檔案不要直接碰 localStorage。
 *
 * 密碼用 PBKDF2-SHA256／12 萬次迭代＋每個帳號各自的隨機鹽。
 * 但要講清楚：純前端網站**無法**做到真正的會員驗證——任何人打開開發者工具
 * 就能改掉自己的啟用狀態，題庫 JSON 也能整包下載。雜湊只保護「密碼本身」，
 * 不保護「內容」。要真的擋人必須有後端。
 *
 * crypto.subtle 只在安全情境下可用（https 或 localhost）。
 * 直接雙擊 index.html 用 file:// 開會沒有，這時會退回弱雜湊並在帳號上標記 algo，
 * 登入時照原本註冊用的演算法驗，所以兩種開法都不會壞。想要真雜湊就用本機 http 伺服器開。
 *
 * 作品集「直接試玩」模式（?demo=1）：sessionStorage 裡有 ipas.demo = '1' 時，
 * 這裡的所有讀寫全部改走 sessionStorage，帳號／啟用狀態／作答進度都只活在這個分頁，
 * 關掉就消失，不會在 localStorage 留下任何東西。一般帳號的流程與雜湊完全不變。
 */
(function (global) {
  'use strict';

  var NS = 'ipas.';
  var K = {
    users: NS + 'users',
    session: NS + 'session',
    usedCodes: NS + 'usedCodes',
    progress: function (email) { return NS + 'progress.' + email; }
  };

  var PBKDF2_ITERATIONS = 120000;

  var DEMO_KEY = NS + 'demo';
  function isDemo() {
    try { return global.sessionStorage.getItem(DEMO_KEY) === '1'; } catch (e) { return false; }
  }
  // 試玩模式下一切都走 sessionStorage；平常走 localStorage。
  function storage() { return isDemo() ? global.sessionStorage : global.localStorage; }

  function hasSubtle() {
    return !!(global.crypto && global.crypto.subtle && global.isSecureContext);
  }

  function bytesToBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return global.btoa(s);
  }

  function base64ToBytes(b64) {
    var raw = global.atob(b64), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function randomSalt() {
    return bytesToBase64(global.crypto.getRandomValues(new Uint8Array(16)));
  }

  function read(key, fallback) {
    try {
      var raw = storage().getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('讀取失敗', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      storage().setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('寫入失敗（可能是無痕模式或空間已滿）', key, e);
      return false;
    }
  }

  // 退路：file:// 開啟時沒有 crypto.subtle，只能用這個。防肉眼，不防人。
  function weakHash(text, salt) {
    var s = 'ipas-kit\u0000' + salt + '\u0000' + text, h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function pbkdf2(password, salt) {
    return global.crypto.subtle
      .importKey('raw', new global.TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return global.crypto.subtle.deriveBits({
          name: 'PBKDF2',
          salt: base64ToBytes(salt),
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        }, key, 256);
      })
      .then(function (bits) { return bytesToBase64(new Uint8Array(bits)); });
  }

  var Store = {
    /* ---------- 作品集試玩模式 ---------- */
    isDemo: isDemo,
    enterDemo: function () {
      try { global.sessionStorage.setItem(DEMO_KEY, '1'); return true; } catch (e) { return false; }
    },
    leaveDemo: function () {
      try {
        var ss = global.sessionStorage;
        ss.removeItem(DEMO_KEY);
        // 把試玩期間寫進 sessionStorage 的 ipas.* 一併清掉
        for (var i = ss.length - 1; i >= 0; i--) {
          var k = ss.key(i);
          if (k && k.indexOf(NS) === 0) ss.removeItem(k);
        }
      } catch (e) {}
    },

    /* ---------- 使用者 ---------- */
    users: function () { return read(K.users, {}); },

    getUser: function (email) {
      return this.users()[String(email || '').trim().toLowerCase()] || null;
    },

    saveUser: function (user) {
      var all = this.users();
      all[user.email] = user;
      write(K.users, all);
      return user;
    },

    /* ---------- 密碼 ---------- */
    usingStrongHash: hasSubtle,

    /* 回傳 Promise<{algo, salt, hash}>，存進 user.password */
    makePassword: function (password) {
      if (hasSubtle()) {
        var salt = randomSalt();
        return pbkdf2(password, salt).then(function (h) {
          return { algo: 'pbkdf2', salt: salt, hash: h };
        });
      }
      var weakSalt = String(Date.now()) + Math.random().toString(36).slice(2);
      return Promise.resolve({ algo: 'weak', salt: weakSalt, hash: weakHash(password, weakSalt) });
    },

    /* 用「當初註冊時的演算法」驗，所以 file:// 建的帳號在 localhost 也登得進去 */
    verifyPassword: function (password, record) {
      if (!record || !record.hash) return Promise.resolve(false);
      if (record.algo === 'pbkdf2') {
        if (!hasSubtle()) return Promise.resolve(false);
        return pbkdf2(password, record.salt).then(function (h) { return h === record.hash; });
      }
      return Promise.resolve(weakHash(password, record.salt) === record.hash);
    },

    /* ---------- 登入狀態 ----------
     * 用 sessionStorage：關掉瀏覽器就登出，比較符合「付費內容」的預期。
     * 帳號與進度仍在 localStorage，不會因此消失。 */
    currentEmail: function () {
      try { return global.sessionStorage.getItem(K.session); } catch (e) { return null; }
    },
    setSession: function (email) {
      try { global.sessionStorage.setItem(K.session, email); } catch (e) {}
    },
    clearSession: function () {
      try { global.sessionStorage.removeItem(K.session); } catch (e) {}
    },

    currentUser: function () {
      var email = this.currentEmail();
      return email ? this.getUser(email) : null;
    },

    /* ---------- 啟用碼 ---------- */
    usedCodes: function () { return read(K.usedCodes, []); },
    markCodeUsed: function (code) {
      var list = this.usedCodes();
      if (list.indexOf(code) === -1) { list.push(code); write(K.usedCodes, list); }
    },

    /* ---------- 作答進度 ---------- */
    blankProgress: function () { return { answers: {}, wrong: [] }; },

    progress: function (email) {
      email = email || this.currentEmail();
      if (!email) return this.blankProgress();
      var p = read(K.progress(email), null);
      if (!p || typeof p !== 'object') return this.blankProgress();
      if (!p.answers) p.answers = {};
      if (!Array.isArray(p.wrong)) p.wrong = [];
      return p;
    },

    saveProgress: function (progress, email) {
      email = email || this.currentEmail();
      if (!email) return false;
      return write(K.progress(email), progress);
    },

    /* 記一次作答。答對就把該題移出錯題本，答錯就加進去。 */
    recordAnswer: function (questionId, chosenIndex, isCorrect) {
      var p = this.progress();
      var rec = p.answers[questionId] || { times: 0, wrongTimes: 0 };
      rec.times += 1;
      if (!isCorrect) rec.wrongTimes += 1;
      rec.correct = !!isCorrect;
      rec.chosen = chosenIndex;
      rec.at = new Date().toISOString();
      p.answers[questionId] = rec;

      var at = p.wrong.indexOf(questionId);
      if (isCorrect) { if (at !== -1) p.wrong.splice(at, 1); }
      else if (at === -1) { p.wrong.push(questionId); }

      this.saveProgress(p);
      return p;
    },

    resetProgress: function () {
      var email = this.currentEmail();
      if (!email) return;
      this.saveProgress(this.blankProgress(), email);
    }
  };

  global.Store = Store;
})(window);
