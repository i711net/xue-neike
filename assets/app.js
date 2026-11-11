/* 学内科 · 应用逻辑（无依赖，纯静态） */
(function () {
  'use strict';
  var IM = window.IM, main = document.getElementById('main'), side = document.getElementById('side');
  var LET = ['A', 'B', 'C', 'D', 'E'];

  /* ---------- 工具 ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('im_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('im_' + k, JSON.stringify(v)); } catch (e) { } }
  };
  function sys(id) { return IM.systems.filter(function (s) { return s.id === id; })[0]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmtTime(sec) { var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function readyCount(s) { return s.chapters.filter(function (c) { return c.ready; }).length; }

  /* ---------- 讲义标记 → HTML ---------- */
  function renderLecture(text) {
    var lines = text.split('\n'), out = [], list = null, table = null;
    function flush() {
      if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
      if (table) {
        out.push('<div class="tbl-wrap"><table><thead><tr>' + table[0].map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          table.slice(1).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
        table = null;
      }
    }
    lines.forEach(function (raw) {
      var l = raw.trim(); if (!l) { flush(); return; }
      if (l.indexOf('- ') === 0) { if (table) flush(); (list = list || []).push('<li>' + inline(l.slice(2)) + '</li>'); return; }
      if (l.charAt(0) === '|') { if (list) flush(); (table = table || []).push(l.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); })); return; }
      flush();
      if (l.indexOf('## ') === 0) out.push('<h3>' + inline(l.slice(3)) + '</h3>');
      else if (l.indexOf('> ') === 0) out.push('<div class="note"><span>指南与进展</span>' + inline(l.slice(2)) + '</div>');
      else out.push('<p>' + inline(l) + '</p>');
    });
    flush(); return out.join('');
  }

  /* ---------- 题库 ---------- */
  var bank = [];
  /* 选项位置按题目 id 固定轮转，避免正确答案集中在某几个字母上；纯数值型选项保持原顺序 */
  function rot(id, o, a) {
    if (o.every(function (t) { return /^[\d<>≥≤.]/.test(t); })) return { o: o, a: a };
    var h = 0, i; for (i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
    var k = h % o.length; return { o: o.slice(k).concat(o.slice(0, k)), a: (a - k + o.length) % o.length };
  }
  IM.systems.forEach(function (s) {
    s.chapters.forEach(function (c, ci) {
      (c.quiz || []).forEach(function (q, qi) {
        var b = { id: s.id + '-' + ci + '-' + qi, sys: s.id, ch: ci };
        if (q[0] === 'A3') { b.type = 'A3/A4'; b.stem = q[1]; b.items = q[2].map(function (x, xi) { var r = rot(b.id + '#' + xi, x[1], x[2]); return { q: x[0], o: r.o, a: r.a, e: x[3] }; }); }
        else if (q[0] === 'B1') { b.type = 'B1'; b.shared = true; b.items = q[2].map(function (x) { return { q: x[0], o: q[1], a: x[1], e: x[2] }; }); }
        else { var r = rot(b.id, q[2], q[3]); b.type = q[0]; b.items = [{ q: q[1], o: r.o, a: r.a, e: q[4] }]; }
        bank.push(b);
      });
    });
  });
  function countQ(blocks) { return blocks.reduce(function (n, b) { return n + b.items.length; }, 0); }
  function flatten(blocks) {
    var qs = [];
    blocks.forEach(function (b) { b.items.forEach(function (it, i) { qs.push({ b: b, it: it, i: i, key: b.id + '#' + i }); }); });
    return qs;
  }
  function pick(blocks, n) {
    var out = [], c = 0; shuffle(blocks).some(function (b) { if (c + b.items.length <= n) { out.push(b); c += b.items.length; } return c >= n; });
    var order = { 'A1': 0, 'A2': 1, 'A3/A4': 2, 'B1': 3 };
    return out.sort(function (x, y) { return order[x.type] - order[y.type]; });
  }

  /* ---------- 侧栏（学习区目录） ---------- */
  function renderSide(curSys, curCh) {
    var done = store.get('done', {});
    side.innerHTML = '<div class="side-title">学科目录</div>' + IM.systems.map(function (s) {
      var open = s.id === curSys;
      return '<details class="side-sys"' + (open ? ' open' : '') + '><summary><span>' + s.icon + ' ' + esc(s.name) + '</span><em>' + readyCount(s) + '/' + s.chapters.length + '</em></summary><ol>' +
        s.chapters.map(function (c, i) {
          var cls = (c.ready ? '' : 'wip ') + (open && i === curCh ? 'cur ' : '') + (done[s.id + '-' + i] ? 'done' : '');
          return '<li class="' + cls + '"><a href="#/learn/' + s.id + '/' + i + '">' + esc(c.title) + '</a></li>';
        }).join('') + '</ol></details>';
    }).join('');
  }

  /* ---------- 页面：首页 ---------- */
  function pageHome() {
    var totalCh = 0, readyCh = 0; IM.systems.forEach(function (s) { totalCh += s.chapters.length; readyCh += readyCount(s); });
    var hist = store.get('hist', []), wrong = Object.keys(store.get('wrong', {})).length;
    main.innerHTML =
      '<section class="hero"><p class="eyebrow">INTERNAL MEDICINE</p><h1>西医内科学<br>学习与考试平台</h1>' +
      '<p class="lead">按系统、按章节整理讲义与重点，配执业医师考试题型的章节自测与计时模拟卷。先学，再练，最后上考场。</p>' +
      '<div class="stats"><div><b>' + IM.systems.length + '</b>个系统</div><div><b>' + readyCh + '<i>/' + totalCh + '</i></b>章已上线</div><div><b>' + countQ(bank) + '</b>道试题</div></div></section>' +
      '<section class="doors">' +
      '<a class="door learn" href="#/learn"><span class="door-no">01</span><h2>学习区</h2><p>讲义精讲 · 重点提示 · 章节自测<br>标记学习进度，随学随测</p><span class="go">进入学习 →</span></a>' +
      '<a class="door exam" href="#/exam"><span class="door-no">02</span><h2>考试区</h2><p>A1 / A2 / A3·A4 / B1 题型<br>系统练习 · 计时模拟考 · 错题本' + (wrong ? '（' + wrong + ' 题待复习）' : '') + '</p><span class="go">进入考场 →</span></a>' +
      '</section>' +
      '<h2 class="sec">学科总览</h2>' + sysGrid() +
      (hist.length ? '<p class="hint">最近一次模拟：' + esc(hist[0].title) + '，得分 ' + hist[0].score + ' 分。<a href="#/exam/history">查看成绩记录</a></p>' : '') +
      '<p class="hint">当前<b>呼吸系统</b>与<b>循环系统</b>的主要章节已完整上线；其余系统的章节目录已搭好，内容分批建设中。</p>';
  }
  function sysGrid() {
    var done = store.get('done', {});
    return '<div class="grid">' + IM.systems.map(function (s) {
      var r = readyCount(s), d = s.chapters.filter(function (c, i) { return done[s.id + '-' + i]; }).length;
      return '<a class="card' + (r ? '' : ' card-wip') + '" href="#/learn/' + s.id + '"><div class="card-h"><span class="ico">' + s.icon + '</span><h3>' + esc(s.name) + '</h3><span class="tag ' + (r ? 'on' : '') + '">' + (r ? '已上线' : '建设中') + '</span></div>' +
        '<p>' + esc(s.desc) + '</p><div class="bar"><i style="width:' + (r ? Math.round(d / r * 100) : 0) + '%"></i></div><small>共 ' + s.chapters.length + ' 章 · 已上线 ' + r + ' 章' + (r ? ' · 已学 ' + d + ' 章' : '') + '</small></a>';
    }).join('') + '</div>';
  }

  /* ---------- 页面：学习区 ---------- */
  function pageLearn() { main.innerHTML = '<h1 class="page-h">学习区</h1><p class="lead">选择一个系统开始。每章包含<b>讲义精讲</b>、<b>重点提示</b>与<b>章节自测</b>三部分。</p>' + sysGrid(); }
  function pageSystem(s) {
    var done = store.get('done', {});
    main.innerHTML = '<p class="crumb"><a href="#/learn">学习区</a> / ' + esc(s.name) + '</p><h1 class="page-h">' + s.icon + ' ' + esc(s.name) + '</h1><p class="lead">' + esc(s.desc) + '</p>' +
      '<ol class="chap-list">' + s.chapters.map(function (c, i) {
        return '<li class="' + (c.ready ? '' : 'wip') + '"><a href="#/learn/' + s.id + '/' + i + '"><span class="n">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span><span class="t">' + esc(c.title) + '</span>' +
          (c.ready ? '<span class="m">' + (done[s.id + '-' + i] ? '✓ 已学 · ' : '') + countQ(bank.filter(function (b) { return b.sys === s.id && b.ch === i; })) + ' 题</span>' : '<span class="m">建设中</span>') + '</a></li>';
      }).join('') + '</ol>' +
      (readyCount(s) ? '<p><button class="btn" data-act="sys-practice" data-sys="' + s.id + '">本系统综合练习 →</button></p>' : '');
  }
  function pageChapter(s, i, tab) {
    var c = s.chapters[i], done = store.get('done', {}), key = s.id + '-' + i;
    var head = '<p class="crumb"><a href="#/learn">学习区</a> / <a href="#/learn/' + s.id + '">' + esc(s.name) + '</a></p><h1 class="page-h">' + esc(c.title) + '</h1>';
    var nav = '<div class="pager">' + (i > 0 ? '<a href="#/learn/' + s.id + '/' + (i - 1) + '">← ' + esc(s.chapters[i - 1].title) + '</a>' : '<span></span>') +
      (i < s.chapters.length - 1 ? '<a href="#/learn/' + s.id + '/' + (i + 1) + '">' + esc(s.chapters[i + 1].title) + ' →</a>' : '<span></span>') + '</div>';
    if (!c.ready) { main.innerHTML = head + '<div class="empty"><b>本章内容建设中</b><p>章节目录已就位，讲义、重点与题库将在后续批次上线。</p></div>' + nav; return; }
    var blocks = bank.filter(function (b) { return b.sys === s.id && b.ch === i; });
    tab = tab || 'lecture';
    var tabs = '<div class="tabs">' + [['lecture', '讲义精讲'], ['keys', '重点提示'], ['quiz', '章节自测（' + countQ(blocks) + '）']].map(function (t) {
      return '<a class="' + (t[0] === tab ? 'on' : '') + '" href="#/learn/' + s.id + '/' + i + '/' + t[0] + '">' + t[1] + '</a>';
    }).join('') + '</div>';
    var body;
    if (tab === 'keys') body = '<ol class="keys">' + c.keys.map(function (k) { return '<li>' + inline(k) + '</li>'; }).join('') + '</ol>';
    else if (tab === 'quiz') body = '<div class="quiz-inline">' + flatten(blocks).map(function (q, n) { return qCard(q, n, null, true); }).join('') + '</div>';
    else body = '<article class="lecture">' + renderLecture(c.lecture) + '</article>';
    main.innerHTML = head + tabs + body +
      '<div class="done-row"><button class="btn ' + (done[key] ? 'ghost' : '') + '" data-act="done" data-key="' + key + '">' + (done[key] ? '✓ 已标记为学完（点击取消）' : '标记本章已学完') + '</button>' +
      (tab !== 'quiz' ? '<a class="btn ghost" href="#/learn/' + s.id + '/' + i + '/quiz">去做章节自测 →</a>' : '') + '</div>' + nav;
  }

  /* ---------- 题目卡片 ---------- */
  // sel: 已选下标（null 未答）；reveal: 是否显示答案
  function qCard(q, n, sel, instant, reveal) {
    var b = q.b, it = q.it, h = '<div class="q" data-key="' + q.key + '" data-a="' + it.a + '"' + (instant ? ' data-instant="1"' : '') + '>';
    h += '<div class="q-meta"><span class="q-no">第 ' + (n + 1) + ' 题</span><span class="q-type">' + b.type + ' 型题</span><span class="q-src">' + esc(sys(b.sys).name.replace('疾病', '')) + ' · ' + esc(sys(b.sys).chapters[b.ch].title) + '</span></div>';
    if (b.stem) h += '<div class="q-stem"><em>共用题干' + (b.items.length > 1 ? '（' + (q.i + 1) + '/' + b.items.length + '）' : '') + '</em>' + esc(b.stem) + '</div>';
    if (b.shared) h += '<div class="q-stem"><em>共用备选答案（' + (q.i + 1) + '/' + b.items.length + '）</em>以下各题共用 A–E 五个备选答案，每个答案可选一次、多次或不选。</div>';
    h += '<p class="q-text">' + esc(it.q) + '</p><div class="opts">' + it.o.map(function (o, k) {
      var cls = ''; if (reveal) { if (k === it.a) cls = 'ok'; else if (k === sel) cls = 'bad'; } else if (k === sel) cls = 'sel';
      return '<button class="opt ' + cls + '" data-k="' + k + '"' + (reveal ? ' disabled' : '') + '><i>' + LET[k] + '</i><span>' + esc(o) + '</span></button>';
    }).join('') + '</div>';
    h += '<div class="exp"' + (reveal ? '' : ' hidden') + '><b>正确答案：' + LET[it.a] + '</b>　' + inline(it.e) + '</div></div>';
    return h;
  }
  function markWrong(key, isWrong) { var w = store.get('wrong', {}); if (isWrong) w[key] = Date.now(); else delete w[key]; store.set('wrong', w); }

  /* ---------- 页面：考试区大厅 ---------- */
  var S = null; // 当前会话
  function pageExam() {
    var live = IM.systems.filter(readyCount), wrong = Object.keys(store.get('wrong', {})).length, hist = store.get('hist', []);
    var total = countQ(bank);
    main.innerHTML = '<h1 class="page-h">考试区</h1><p class="lead">题型与国家执业医师资格考试一致：<b>A1</b> 单句型最佳选择题、<b>A2</b> 病例摘要型、<b>A3/A4</b> 病例组型、<b>B1</b> 标准配伍题。</p>' +
      '<div class="exam-grid">' +
      '<section class="panel"><h2>模拟考试</h2><p>随机组卷、限时作答，交卷后统一评分并给出解析。</p>' +
      '<form id="mockForm"><label>考试范围</label><div class="checks">' + live.map(function (s) { return '<label><input type="checkbox" name="sys" value="' + s.id + '" checked> ' + esc(s.name) + '</label>'; }).join('') + '</div>' +
      '<label>题量与时间</label><div class="checks">' + [[30, 30], [50, 50], [100, 100]].filter(function (x) { return x[0] <= total || x[0] === 30; }).map(function (x, i) {
        return '<label><input type="radio" name="n" value="' + x[0] + '"' + (i === 1 || (i === 0 && total < 50) ? ' checked' : '') + '> ' + x[0] + ' 题 / ' + x[1] + ' 分钟</label>';
      }).join('') + '</div><button class="btn amber" type="submit">开始模拟考试</button></form></section>' +
      '<section class="panel"><h2>系统练习</h2><p>按系统刷题，选完即出答案与解析。</p><div class="sys-btns">' + live.map(function (s) {
        return '<button class="btn ghost" data-act="sys-practice" data-sys="' + s.id + '">' + s.icon + ' ' + esc(s.name) + '<small>' + countQ(bank.filter(function (b) { return b.sys === s.id; })) + ' 题</small></button>';
      }).join('') + '</div>' +
      '<h2 style="margin-top:22px">题型专练</h2><div class="sys-btns">' + ['A1', 'A2', 'A3/A4', 'B1'].map(function (t) {
        return '<button class="btn ghost" data-act="type-practice" data-type="' + t + '">' + t + ' 型题<small>' + countQ(bank.filter(function (b) { return b.type === t; })) + ' 题</small></button>';
      }).join('') + '</div></section>' +
      '<section class="panel"><h2>错题本</h2><p>答错的题自动收录；在错题重练中答对后自动移出。</p><p class="big">' + wrong + '<small> 题</small></p>' +
      (wrong ? '<button class="btn" data-act="wrong-practice">错题重练</button> <button class="btn ghost" data-act="wrong-clear">清空</button>' : '<p class="muted">暂无错题。</p>') + '</section>' +
      '<section class="panel"><h2>成绩记录</h2>' + (hist.length ? '<table class="hist"><thead><tr><th>时间</th><th>试卷</th><th>得分</th><th>用时</th></tr></thead><tbody>' + hist.slice(0, 8).map(function (h) {
        return '<tr><td>' + esc(h.date) + '</td><td>' + esc(h.title) + '</td><td><b class="' + (h.score >= 60 ? 'pass' : 'fail') + '">' + h.score + '</b></td><td>' + fmtTime(h.used) + '</td></tr>';
      }).join('') + '</tbody></table><p><a href="#/exam/history">全部记录 →</a></p>' : '<p class="muted">还没有模拟考试记录。成绩只保存在本机浏览器中。</p>') + '</section></div>';
  }
  function pageHistory() {
    var hist = store.get('hist', []);
    main.innerHTML = '<p class="crumb"><a href="#/exam">考试区</a> / 成绩记录</p><h1 class="page-h">成绩记录</h1>' + (hist.length ?
      '<table class="hist"><thead><tr><th>时间</th><th>试卷</th><th>题数</th><th>答对</th><th>得分</th><th>用时</th></tr></thead><tbody>' + hist.map(function (h) {
        return '<tr><td>' + esc(h.date) + '</td><td>' + esc(h.title) + '</td><td>' + h.total + '</td><td>' + h.right + '</td><td><b class="' + (h.score >= 60 ? 'pass' : 'fail') + '">' + h.score + '</b></td><td>' + fmtTime(h.used) + '</td></tr>';
      }).join('') + '</tbody></table><p><button class="btn ghost" data-act="hist-clear">清空记录</button></p>' : '<div class="empty"><b>暂无记录</b></div>');
  }

  /* ---------- 会话：练习 / 考试 ---------- */
  var timer = null;
  function start(mode, title, blocks, minutes, fromWrong) {
    if (!blocks.length) { alertBox('这个范围内暂时没有题目。'); return; }
    S = { mode: mode, title: title, qs: flatten(blocks), ans: {}, flag: {}, cur: 0, t0: Date.now(), limit: minutes ? minutes * 60 : 0, fromWrong: !!fromWrong, done: false };
    location.hash = '#/exam/run'; if (location.hash === '#/exam/run') route();
  }
  function alertBox(msg) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600); }
  function pageRun() {
    if (!S) { location.hash = '#/exam'; return; }
    if (S.done) { pageResult(); return; }
    var q = S.qs[S.cur], sel = S.ans[q.key], exam = S.mode === 'exam';
    var answered = Object.keys(S.ans).length;
    main.innerHTML = '<div class="run"><div class="run-main">' +
      '<div class="run-bar"><div><b>' + esc(S.title) + '</b><small>' + (exam ? '模拟考试 · 交卷后出成绩' : '练习模式 · 即时解析') + '</small></div>' +
      (exam ? '<div class="clock" id="clock">--:--</div>' : '') + '</div>' +
      '<div class="progress"><i style="width:' + Math.round(answered / S.qs.length * 100) + '%"></i></div>' +
      qCard(q, S.cur, sel === undefined ? null : sel, false, !exam && sel !== undefined) +
      '<div class="run-nav"><button class="btn ghost" data-act="prev"' + (S.cur === 0 ? ' disabled' : '') + '>← 上一题</button>' +
      '<button class="btn ghost" data-act="flag">' + (S.flag[q.key] ? '★ 取消标记' : '☆ 标记待查') + '</button>' +
      (S.cur < S.qs.length - 1 ? '<button class="btn" data-act="next">下一题 →</button>' : '<button class="btn amber" data-act="submit">' + (exam ? '交卷' : '完成练习') + '</button>') + '</div></div>' +
      '<aside class="sheet"><h3>答题卡 <small>' + answered + ' / ' + S.qs.length + '</small></h3><div class="sheet-grid">' + S.qs.map(function (x, n) {
        var cls = n === S.cur ? 'cur ' : ''; if (S.ans[x.key] !== undefined) cls += exam ? 'ans ' : (S.ans[x.key] === x.it.a ? 'ok ' : 'bad '); if (S.flag[x.key]) cls += 'flag';
        return '<button class="' + cls + '" data-act="goto" data-n="' + n + '">' + (n + 1) + '</button>';
      }).join('') + '</div><button class="btn amber block" data-act="submit">' + (exam ? '交卷' : '结束并查看结果') + '</button><button class="btn ghost block" data-act="quit">退出</button></aside></div>';
    tick();
  }
  function tick() {
    clearInterval(timer); if (!S || S.done || !S.limit) return;
    function upd() {
      var left = S.limit - Math.floor((Date.now() - S.t0) / 1000), el = document.getElementById('clock');
      if (left <= 0) { clearInterval(timer); finish(); return; }
      if (el) { el.textContent = fmtTime(left); el.classList.toggle('hot', left < 300); }
    }
    upd(); timer = setInterval(upd, 1000);
  }
  function finish() {
    clearInterval(timer); S.done = true; S.used = Math.floor((Date.now() - S.t0) / 1000);
    var right = 0; S.qs.forEach(function (q) {
      var a = S.ans[q.key];
      if (a === q.it.a) { right++; if (S.fromWrong) markWrong(q.key, false); } else if (a !== undefined || S.mode === 'exam') markWrong(q.key, true);
    });
    S.right = right; S.score = Math.round(right / S.qs.length * 100);
    if (S.mode === 'exam') {
      var d = new Date(), hist = store.get('hist', []);
      hist.unshift({ date: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + ' ' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(), title: S.title, total: S.qs.length, right: right, score: S.score, used: S.used });
      store.set('hist', hist.slice(0, 50));
    }
    pageResult(); window.scrollTo(0, 0);
  }
  function pageResult() {
    function group(fn) {
      var m = {}; S.qs.forEach(function (q) { var k = fn(q); m[k] = m[k] || [0, 0]; m[k][1]++; if (S.ans[q.key] === q.it.a) m[k][0]++; });
      return Object.keys(m).map(function (k) { var p = Math.round(m[k][0] / m[k][1] * 100); return '<div class="brk"><span>' + esc(k) + '</span><div class="bar"><i style="width:' + p + '%"></i></div><em>' + m[k][0] + '/' + m[k][1] + '</em></div>'; }).join('');
    }
    var unanswered = S.qs.filter(function (q) { return S.ans[q.key] === undefined; }).length;
    main.innerHTML = '<p class="crumb"><a href="#/exam">考试区</a> / 结果</p><div class="result"><div class="score ' + (S.score >= 60 ? 'pass' : 'fail') + '"><b>' + S.score + '</b><small>分</small></div>' +
      '<div><h1>' + esc(S.title) + '</h1><p>共 ' + S.qs.length + ' 题，答对 ' + S.right + ' 题' + (unanswered ? '，未答 ' + unanswered + ' 题' : '') + '，用时 ' + fmtTime(S.used) + '。' +
      (S.mode === 'exam' ? (S.score >= 60 ? '达到 60 分合格线。' : '未达 60 分合格线，建议回到学习区复习薄弱章节。') : '') + '</p>' +
      '<p><a class="btn" href="#/exam">返回考试区</a> <button class="btn ghost" data-act="only-wrong">只看错题</button></p></div></div>' +
      '<div class="brk-grid"><section><h3>按系统</h3>' + group(function (q) { return sys(q.b.sys).name; }) + '</section><section><h3>按题型</h3>' + group(function (q) { return q.b.type + ' 型题'; }) + '</section>' +
      '<section><h3>按章节</h3>' + group(function (q) { return sys(q.b.sys).chapters[q.b.ch].title; }) + '</section></div>' +
      '<h2 class="sec">逐题解析</h2><div id="review">' + S.qs.map(function (q, n) {
        var a = S.ans[q.key]; return '<div class="rv ' + (a === q.it.a ? 'r-ok' : 'r-bad') + '">' + qCard(q, n, a === undefined ? null : a, false, true) + '</div>';
      }).join('') + '</div>';
  }

  /* ---------- 搜索 ---------- */
  function pageSearch(kw) {
    var hits = [];
    IM.systems.forEach(function (s) {
      s.chapters.forEach(function (c, i) {
        var inTitle = c.title.indexOf(kw) >= 0, pos = c.ready ? c.lecture.indexOf(kw) : -1;
        if (!inTitle && pos < 0 && c.ready) { var kk = c.keys.join(' '); pos = kk.indexOf(kw); if (pos >= 0) { hits.push({ s: s, i: i, c: c, snip: kk.slice(Math.max(0, pos - 30), pos + 60) }); return; } }
        if (inTitle || pos >= 0) hits.push({ s: s, i: i, c: c, snip: pos >= 0 ? c.lecture.slice(Math.max(0, pos - 30), pos + 60).replace(/[#>|*\n-]/g, ' ') : '' });
      });
    });
    main.innerHTML = '<h1 class="page-h">搜索：' + esc(kw) + '</h1><p class="lead">找到 ' + hits.length + ' 个相关章节。</p><ol class="chap-list">' + hits.map(function (h) {
      return '<li class="' + (h.c.ready ? '' : 'wip') + '"><a href="#/learn/' + h.s.id + '/' + h.i + '"><span class="n">' + h.s.icon + '</span><span class="t">' + esc(h.c.title) + (h.snip ? '<small>…' + esc(h.snip).split(esc(kw)).join('<mark>' + esc(kw) + '</mark>') + '…</small>' : '') + '</span><span class="m">' + esc(h.s.name) + '</span></a></li>';
    }).join('') + '</ol>';
  }

  /* ---------- 路由 ---------- */
  function route() {
    var p = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
    clearInterval(timer); document.body.classList.remove('side-open');
    var area = p[0] || 'home', s;
    document.body.className = 'r-' + area + (area === 'learn' ? ' has-side' : '');
    [].forEach.call(document.querySelectorAll('[data-nav]'), function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === area); });
    if (area === 'learn') {
      s = p[1] && sys(p[1]); var ci = p[2] === undefined ? -1 : parseInt(p[2], 10);
      renderSide(s ? s.id : null, ci);
      if (s && s.chapters[ci]) pageChapter(s, ci, p[3]); else if (s) pageSystem(s); else pageLearn();
    } else if (area === 'exam') {
      if (p[1] === 'run') pageRun(); else if (p[1] === 'history') pageHistory(); else pageExam();
    } else if (area === 'search' && p[1]) pageSearch(p.slice(1).join('/'));
    else pageHome();
    if (!(area === 'exam' && p[1] === 'run')) window.scrollTo(0, 0);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    var opt = e.target.closest('.opt');
    if (opt && !opt.disabled) {
      var card = opt.closest('.q'), k = +opt.getAttribute('data-k'), a = +card.getAttribute('data-a'), key = card.getAttribute('data-key');
      if (card.getAttribute('data-instant')) { // 章节自测：即时判分
        [].forEach.call(card.querySelectorAll('.opt'), function (o, n) { o.disabled = true; if (n === a) o.classList.add('ok'); else if (n === k) o.classList.add('bad'); });
        card.querySelector('.exp').hidden = false; if (k !== a) markWrong(key, true); return;
      }
      if (S && !S.done) {
        if (S.mode !== 'exam' && S.ans[key] !== undefined) return;
        S.ans[key] = k; if (S.mode !== 'exam') { if (k !== a) markWrong(key, true); else if (S.fromWrong) markWrong(key, false); }
        pageRun();
      }
      return;
    }
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'done') { var d = store.get('done', {}), dk = el.getAttribute('data-key'); if (d[dk]) delete d[dk]; else d[dk] = 1; store.set('done', d); route(); }
    else if (act === 'sys-practice') { var sy = sys(el.getAttribute('data-sys')); start('practice', sy.name + ' · 系统练习', shuffle(bank.filter(function (b) { return b.sys === sy.id; }))); }
    else if (act === 'type-practice') { var t = el.getAttribute('data-type'); start('practice', t + ' 型题专练', shuffle(bank.filter(function (b) { return b.type === t; }))); }
    else if (act === 'wrong-practice') {
      var w = store.get('wrong', {}), qs = flatten(bank).filter(function (q) { return w[q.key]; });
      if (!qs.length) { alertBox('错题本是空的。'); return; }
      S = { mode: 'practice', title: '错题重练', qs: qs, ans: {}, flag: {}, cur: 0, t0: Date.now(), limit: 0, fromWrong: true, done: false }; location.hash = '#/exam/run';
    }
    else if (act === 'wrong-clear') { store.set('wrong', {}); route(); }
    else if (act === 'hist-clear') { store.set('hist', []); route(); }
    else if (act === 'only-wrong') { document.getElementById('review').classList.toggle('only-wrong'); el.textContent = el.textContent === '只看错题' ? '显示全部' : '只看错题'; }
    else if (S && !S.done) {
      if (act === 'prev') { S.cur--; pageRun(); } else if (act === 'next') { S.cur++; pageRun(); }
      else if (act === 'goto') { S.cur = +el.getAttribute('data-n'); pageRun(); }
      else if (act === 'flag') { var fk = S.qs[S.cur].key; S.flag[fk] = !S.flag[fk]; pageRun(); }
      else if (act === 'quit') { S = null; location.hash = '#/exam'; }
      else if (act === 'submit') {
        var left = S.qs.length - Object.keys(S.ans).length;
        if (left && el.getAttribute('data-sure') !== '1') { [].forEach.call(document.querySelectorAll('[data-act=submit]'), function (b) { b.setAttribute('data-sure', '1'); b.textContent = '还有 ' + left + ' 题未答，再点一次确认'; }); return; }
        finish();
      }
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'mockForm') return; e.preventDefault();
    var f = e.target, ids = [].filter.call(f.querySelectorAll('[name=sys]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
    var n = +f.querySelector('[name=n]:checked').value;
    if (!ids.length) { alertBox('请至少选择一个系统。'); return; }
    var blocks = pick(bank.filter(function (b) { return ids.indexOf(b.sys) >= 0; }), n);
    start('exam', '内科学模拟卷（' + countQ(blocks) + ' 题）', blocks, n);
  });
  document.getElementById('searchBox').addEventListener('keydown', function (e) { if (e.key === 'Enter' && this.value.trim()) { location.hash = '#/search/' + encodeURIComponent(this.value.trim()); this.blur(); } });
  document.getElementById('menuBtn').addEventListener('click', function () { if (!document.body.classList.contains('has-side')) { location.hash = '#/learn'; return; } document.body.classList.toggle('side-open'); });
  document.getElementById('sideMask').addEventListener('click', function () { document.body.classList.remove('side-open'); });
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', function (e) { if (S && !S.done && S.mode === 'exam') { e.preventDefault(); e.returnValue = ''; } });
  route();
})();
