/* quiz.js — 選題、篩選、計分、掌握度統計。純邏輯，這裡不碰 DOM。 */
(function (global) {
  'use strict';

  var DATA = global.IPAS_DATA || { meta: {}, topics: [], codes: [], questions: [] };
  var BY_ID = {};
  DATA.questions.forEach(function (q) { BY_ID[q.id] = q; });

  // 掌握度分級門檻，配色由 css 的 .bar--low/.bar--mid/.bar--high 決定
  var LOW = 60, MID = 85;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var Quiz = {
    meta: DATA.meta,
    topics: DATA.topics,
    codes: DATA.codes,
    all: DATA.questions,
    LOW: LOW,
    MID: MID,

    byId: function (id) { return BY_ID[id] || null; },

    papers: function () { return (DATA.meta.papers || []).slice(); },

    /* 只有帶答案與選項的題目能拿來作答 */
    answerable: function () {
      return DATA.questions.filter(function (q) { return q.answer >= 0 && q.options.length; });
    },

    /**
     * opts = {
     *   topics: ['L113 機器學習概念', ...]   空 = 全部
     *   stars:  [1,2,3]                      空 = 全部
     *   papers: ['115-2', ...]               空 = 全部
     *   ids:    ['114-4-S1-001', ...]        有值時只從這些題挑（錯題本用）
     *   unseenFirst: true                    沒做過的排前面
     *   limit:  20                           取幾題，0 = 不限
     * }
     */
    pick: function (opts) {
      opts = opts || {};
      var progress = Store.progress();
      var pool = this.answerable();

      if (opts.ids && opts.ids.length) {
        var want = {};
        opts.ids.forEach(function (id) { want[id] = true; });
        pool = pool.filter(function (q) { return want[q.id]; });
      }
      if (opts.topics && opts.topics.length) {
        pool = pool.filter(function (q) { return opts.topics.indexOf(q.topic) !== -1; });
      }
      if (opts.stars && opts.stars.length) {
        pool = pool.filter(function (q) { return opts.stars.indexOf(q.stars) !== -1; });
      }
      if (opts.papers && opts.papers.length) {
        pool = pool.filter(function (q) { return opts.papers.indexOf(q.paper) !== -1; });
      }

      pool = shuffle(pool);

      if (opts.unseenFirst) {
        var unseen = [], seen = [];
        pool.forEach(function (q) {
          (progress.answers[q.id] ? seen : unseen).push(q);
        });
        pool = unseen.concat(seen);
      }

      var limit = opts.limit || 0;
      return limit > 0 ? pool.slice(0, limit) : pool;
    },

    grade: function (question, chosenIndex) {
      var correct = chosenIndex === question.answer;
      Store.recordAnswer(question.id, chosenIndex, correct);
      return correct;
    },

    /* ---------- 統計 ---------- */
    band: function (pct) { return pct < LOW ? 'low' : (pct < MID ? 'mid' : 'high'); },

    overview: function () {
      var p = Store.progress();
      var ids = Object.keys(p.answers);
      var right = 0, attempts = 0;
      ids.forEach(function (id) {
        var r = p.answers[id];
        attempts += r.times || 1;
        if (r.correct) right += 1;
      });
      return {
        answered: ids.length,                                   // 做過幾題（不重複）
        attempts: attempts,                                     // 總作答次數
        accuracy: ids.length ? Math.round(right / ids.length * 100) : 0,
        wrongCount: p.wrong.length,
        totalAnswerable: this.answerable().length
      };
    },

    /* 每個評鑑主題（方向）的掌握度：該主題做過的題裡，目前答對的比例 */
    masteryByTopic: function () {
      var p = Store.progress();
      var acc = {};
      this.topics.forEach(function (t) {
        acc[t.topic] = { topic: t.topic, subject: t.subject, total: 0, answered: 0, correct: 0 };
      });
      this.answerable().forEach(function (q) {
        var row = acc[q.topic];
        if (!row) return;
        row.total += 1;
        var r = p.answers[q.id];
        if (r) {
          row.answered += 1;
          if (r.correct) row.correct += 1;
        }
      });
      var self = this;
      return Object.keys(acc).map(function (k) {
        var row = acc[k];
        row.pct = row.answered ? Math.round(row.correct / row.answered * 100) : 0;
        row.coverage = row.total ? Math.round(row.answered / row.total * 100) : 0;
        row.band = row.answered ? self.band(row.pct) : 'none';
        return row;
      }).sort(function (a, b) { return a.topic.localeCompare(b.topic); });
    },

    wrongQuestions: function () {
      var p = Store.progress();
      return p.wrong.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    }
  };

  global.Quiz = Quiz;
})(window);
