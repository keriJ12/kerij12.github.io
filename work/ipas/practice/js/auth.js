/* auth.js — 註冊、登入、啟用碼。
 *
 * 啟用碼目前寫死在前端，是「示範等級」：
 *   IPAS-DEMO-2026  正常開通，180 天
 *   IPAS-USED-0000  模擬「已被使用」
 *   IPAS-EXPD-1999  模擬「已過期」
 * 真的要賣，啟用碼必須存在後端由伺服器驗證，否則買家改一行 JS 就能自己開通。
 */
(function (global) {
  'use strict';

  var VALID_DAYS = 180;

  // status: ok / used / expired
  var CODES = {
    'IPAS-DEMO-2026': { status: 'ok', days: VALID_DAYS, note: '示範啟用碼' },
    'IPAS-USED-0000': { status: 'used', note: '示範：已被使用' },
    'IPAS-EXPD-1999': { status: 'expired', note: '示範：已過期' }
  };

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function normEmail(v) { return String(v || '').trim().toLowerCase(); }
  function normCode(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, ''); }

  function daysBetween(a, b) {
    return Math.ceil((b - a) / 86400000);
  }

  var Auth = {
    VALID_DAYS: VALID_DAYS,
    demoCodes: CODES,

    /* ---------- 註冊 ----------
     * 回傳 Promise，因為 PBKDF2 是非同步的。 */
    register: function (email, password, password2) {
      email = normEmail(email);
      if (!EMAIL_RE.test(email)) return Promise.resolve({ ok: false, error: '請輸入有效的 Email' });
      if (!password || password.length < 6) {
        return Promise.resolve({ ok: false, error: '密碼至少 6 個字' });
      }
      if (password2 !== undefined && password !== password2) {
        return Promise.resolve({ ok: false, error: '兩次輸入的密碼不一樣' });
      }
      if (Store.getUser(email)) {
        return Promise.resolve({ ok: false, error: '這個 Email 已經註冊過了，請直接登入' });
      }

      return Store.makePassword(password).then(function (pw) {
        var user = {
          email: email,
          password: pw,
          createdAt: new Date().toISOString(),
          activation: null
        };
        Store.saveUser(user);
        Store.setSession(email);
        return { ok: true, user: user };
      });
    },

    /* ---------- 登入 ---------- */
    login: function (email, password) {
      email = normEmail(email);
      var user = Store.getUser(email);
      if (!user) return Promise.resolve({ ok: false, error: '查無此帳號，請先註冊' });
      if (!user.password && user.pwHash) {
        // 2026-09-17 之前用舊雜湊建的帳號，沒有鹽可以驗，只能請他重建
        return Promise.resolve({
          ok: false, error: '這個帳號是舊版建立的，密碼格式已更新，請改用「註冊」重新建立一次'
        });
      }

      return Store.verifyPassword(password || '', user.password).then(function (ok) {
        if (!ok) return { ok: false, error: 'Email 或密碼不對' };
        Store.setSession(email);
        return { ok: true, user: user };
      });
    },

    logout: function () { Store.clearSession(); },

    /* ---------- 啟用碼 ---------- */
    redeem: function (rawCode) {
      var user = Store.currentUser();
      if (!user) return { ok: false, error: '請先登入' };

      var code = normCode(rawCode);
      if (!code) return { ok: false, error: '請輸入啟用碼' };

      var entry = CODES[code];
      if (!entry) return { ok: false, error: '查無此啟用碼，請確認是否輸入正確' };
      if (entry.status === 'used') {
        return { ok: false, error: '此啟用碼已被使用過，無法重複開通' };
      }
      if (entry.status === 'expired') {
        return { ok: false, error: '此啟用碼已過期，請聯繫賣家換新碼' };
      }

      var now = new Date();
      var expires = new Date(now.getTime() + (entry.days || VALID_DAYS) * 86400000);
      user.activation = {
        code: code,
        activatedAt: now.toISOString(),
        expiresAt: expires.toISOString()
      };
      Store.saveUser(user);
      Store.markCodeUsed(code);
      return { ok: true, user: user, expiresAt: expires };
    },

    /* ---------- 目前狀態 ---------- */
    status: function () {
      var user = Store.currentUser();
      if (!user) return { signedIn: false, active: false };
      var act = user.activation;
      if (!act) return { signedIn: true, active: false, user: user, reason: 'none' };

      var expires = new Date(act.expiresAt);
      var now = new Date();
      if (now > expires) {
        return { signedIn: true, active: false, user: user, reason: 'expired', expiresAt: expires };
      }
      return {
        signedIn: true,
        active: true,
        user: user,
        expiresAt: expires,
        daysLeft: daysBetween(now, expires)
      };
    },

    /* 用台北時區格式化，不要跟著使用者電腦的時區跑 */
    formatDate: function (d) {
      d = (d instanceof Date) ? d : new Date(d);
      try {
        return new Intl.DateTimeFormat('zh-TW', {
          year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Taipei'
        }).format(d);
      } catch (e) {
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      }
    }
  };

  global.Auth = Auth;
})(window);
