/* build-2611-16 · 화면 — 그리기만 한다. 읽기 · 계산 · 판정 · 보고서 문장은 js/stress.js(Stress) 에 있다. */
(function () {
  'use strict';
  var E = window.Stress, state = { model: null, orig: null, res: null, file: '' };
  var $ = function (q) { return document.querySelector(q); };
  var COLORS = ['#154b6e', '#d9822b', '#0a6045', '#8a4fa3', '#b03a5b', '#5b6b7b', '#2f8fb5', '#9a7b00'];
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function md(s) { return h(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  function show(id, on) { $(id).hidden = !on; }
  function unit() { return $('#unit').value.trim() || 'MPa'; }
  function tag(g) { return g ? '<span class="tag" style="background:' + g.color + '">' + g.label + '</span>' : '<span class="muted">-</span>'; }
  function nice(v) { var p = Math.pow(10, Math.floor(Math.log10(v || 1))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  function fmtAx(v) { var a = Math.abs(v); return a >= 1e6 ? (v / 1e6) + 'M' : a >= 1e4 ? (v / 1e3) + 'k' : String(Math.round(v * 100) / 100); }

  /** 묶음 막대 그래프(SVG). series:[{name,color,vals}], opt:{lines:[{v,label,color}], colorOf(si,ci), cap, float:[{lo,hi}], yLabel} */
  function bars(cats, series, opt) {
    opt = opt || {};
    var W = 1100, H = 380, L = 78, R = 16, T = 24, B = 54, all = [];
    series.forEach(function (s) { s.vals.forEach(function (v) { if (v != null && isFinite(v)) all.push(v); }); });
    (opt.float || []).forEach(function (f) { if (f) { all.push(f.lo); all.push(f.hi); } });
    (opt.lines || []).forEach(function (l) { if (opt.linesInScale) all.push(l.v); });
    if (!all.length) return '<p class="sub">표시할 값이 없습니다.</p>';
    var hi = Math.max(0, Math.max.apply(null, all)), lo = Math.min(0, Math.min.apply(null, all));
    if (opt.cap && hi > opt.cap) hi = opt.cap;
    var step = nice((hi - lo) / 5 || 1); hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step; if (hi === lo) hi = lo + step;
    var y = function (v) { return T + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (H - T - B); };
    var gw = (W - L - R) / cats.length, n = opt.float ? 1 : series.length, bw = Math.min(opt.float ? 46 : 26, gw * 0.78 / n), out = [];
    for (var t = lo; t <= hi + step / 2; t += step) out.push('<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + fmtAx(t) + '</text>');
    cats.forEach(function (c, ci) {
      var cx = L + gw * ci + gw / 2;
      out.push('<text class="ax" x="' + cx + '" y="' + (H - B + 16) + '" text-anchor="middle"' + (cats.length > 12 ? ' transform="rotate(-35 ' + cx + ' ' + (H - B + 16) + ')"' : '') + '>' + h(c) + '</text>');
      if (opt.float) {
        var f = opt.float[ci]; if (!f) return;
        out.push('<rect x="' + (cx - bw / 2) + '" y="' + y(Math.max(f.hi, 0)) + '" width="' + bw + '" height="' + Math.max(1, y(0) - y(Math.max(f.hi, 0))) + '" fill="#c8341f" opacity=".85"><title>' + h(c) + ' 최대 인장 ' + E.f1(f.hi) + '</title></rect>');
        out.push('<rect x="' + (cx - bw / 2) + '" y="' + y(0) + '" width="' + bw + '" height="' + Math.max(1, y(Math.min(f.lo, 0)) - y(0)) + '" fill="#154b6e" opacity=".85"><title>' + h(c) + ' 최대 압축 ' + E.f1(f.lo) + '</title></rect>');
        if (opt.label) out.push('<text class="lbl" x="' + cx + '" y="' + (y(Math.max(f.hi, 0)) - 4) + '" text-anchor="middle">' + h(opt.label(f.hi)) + '</text><text class="lbl" x="' + cx + '" y="' + (y(Math.min(f.lo, 0)) + 12) + '" text-anchor="middle">' + h(opt.label(f.lo)) + '</text>');
        return;
      }
      series.forEach(function (s, si) {
        var v = s.vals[ci]; if (v == null) return;
        var inf = !isFinite(v), vv = inf ? hi : v, x = cx - n * bw / 2 + si * bw, y0 = y(0), y1 = y(vv);
        var col = opt.colorOf ? opt.colorOf(si, ci) : s.color;
        out.push('<rect class="bar" x="' + (x + 0.5) + '" y="' + Math.min(y0, y1) + '" width="' + (bw - 1) + '" height="' + Math.max(1, Math.abs(y1 - y0)) + '" fill="' + col + '"' + (inf || (opt.cap && v > opt.cap) ? ' opacity=".45"' : '') + '><title>' + h(c) + ' · ' + h(s.name) + ' ' + (inf ? '∞' : (opt.life ? E.f0(v) : E.f1(v))) + '</title></rect>');
        if (inf) out.push('<text class="lbl" x="' + (x + bw / 2) + '" y="' + (y1 + 12) + '" text-anchor="middle">∞</text>');
        else if (opt.cap && v > opt.cap) out.push('<text class="lbl" x="' + (x + bw / 2) + '" y="' + (y1 + 12) + '" text-anchor="middle">↑</text>');
      });
    });
    out.push('<line class="zero" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>');
    (opt.lines || []).forEach(function (l) { if (l.v > hi || l.v < lo) return; out.push('<line class="lim" stroke="' + l.color + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(l.v) + '" y2="' + y(l.v) + '"/><text class="ax" x="' + (W - R - 4) + '" y="' + (y(l.v) - 4) + '" text-anchor="end" fill="' + l.color + '">' + h(l.label) + '</text>'); });
    if (opt.yLabel) out.push('<text class="ax" x="6" y="12">' + h(opt.yLabel) + '</text>');
    var leg = opt.float || opt.noLegend ? '' : '<div class="legend">' + series.map(function (s) { return '<span><i class="sw" style="background:' + s.color + '"></i>' + h(s.name) + '</span>'; }).join('') + '</div>';
    return '<svg class="big" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + out.join('') + '</svg>' + leg;
  }

  /* ---------- v1.1 큰 그래프 한 장(막대 · 꺾은선, 선형 · 로그, 막대 위 숫자) ----------
   * series:[{name,color,vals}], opt:{type,label(fn v→글자),log,cap,lines,colorOf(si,ci),yLabel,tip(si,ci),axFmt,pick} */
  function chart(cats, series, opt) {
    opt = opt || {};
    var lab = opt.label, W = 1100, H = opt.tall ? 440 : 380, L = 78, R = 16, T = lab ? 70 : 20, B = opt.tall && lab ? 96 : 54, all = [];
    series.forEach(function (s) { s.vals.forEach(function (v) { if (v != null && isFinite(v) && (!opt.log || v > 0)) all.push(v); }); (s.lows || []).forEach(function (v) { if (v != null && isFinite(v)) all.push(v); }); });
    if (!cats.length || !series.length) return '<p class="sub nochart">표시할 채널 · 항목이 없습니다. 위에서 보기 조건을 확인하세요.</p>';
    if (!all.length) all = [opt.log ? 1 : 0];
    var hi, lo, y, ticks = [], ax = opt.axFmt || fmtAx, base;
    if (opt.log) {
      var ll = Math.floor(Math.log10(Math.min.apply(null, all))), lh = Math.ceil(Math.log10(Math.max.apply(null, all))); if (lh === ll) lh = ll + 1;
      lo = Math.pow(10, ll); hi = Math.pow(10, lh); base = lo;
      y = function (v) { var g = v > 0 ? Math.log10(v) : ll; g = Math.max(ll, Math.min(lh, g)); return T + (lh - g) / (lh - ll) * (H - T - B); };
      for (var d = ll; d <= lh; d++) ticks.push(Math.pow(10, d));
    } else {
      hi = Math.max(0, Math.max.apply(null, all)); lo = Math.min(0, Math.min.apply(null, all));
      (opt.lines || []).forEach(function (l) { if (opt.linesInScale) { hi = Math.max(hi, l.v); lo = Math.min(lo, l.v); } });
      if (opt.cap && hi > opt.cap) hi = opt.cap;
      var step = nice((hi - lo) / 6 || 1); hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step; if (hi === lo) hi = lo + step; base = 0;
      y = function (v) { return T + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (H - T - B); };
      for (var t = lo; t <= hi + step / 2; t += step) ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
    }
    var out = [], gw = (W - L - R) / cats.length, n = series.length, line = opt.type === 'line', bw = Math.min(46, gw * 0.82 / n), turn = (line ? gw : bw) < 46;
    ticks.forEach(function (t) { out.push('<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + ax(t) + '</text>'); });
    var over = function (v) { return !opt.log && opt.cap && v > opt.cap; };
    var text = function (x, yy, v, up) {
      var tx = !isFinite(v) ? '∞' : lab ? lab(v) : (over(v) ? '↑' : ''); if (!tx) return '';
      if (over(v) && lab) tx += ' ↑';
      var ty = up ? yy - 5 : yy + 13;
      return turn && tx.length > 2 ? '<text class="lbl" x="' + x + '" y="' + ty + '" transform="rotate(-90 ' + x + ' ' + ty + ')" text-anchor="' + (up ? 'start' : 'end') + '" dominant-baseline="central">' + h(tx) + '</text>' : '<text class="lbl" x="' + x + '" y="' + ty + '" text-anchor="middle">' + h(tx) + '</text>';
    };
    var attr = function (si, ci) { return (opt.pick ? ' class="bar pick" data-ch="' + h(cats[ci]) + '"' : ' class="bar"'); };
    var tip = function (si, ci, v) { return '<title>' + h(opt.tip ? opt.tip(si, ci) : cats[ci] + ' · ' + series[si].name + ' ' + (isFinite(v) ? v : '∞')) + '</title>'; };
    cats.forEach(function (c, ci) {
      var cx = L + gw * ci + gw / 2;
      out.push('<text class="ax" x="' + cx + '" y="' + (H - B + 17) + '" text-anchor="middle"' + (cats.length > 14 ? ' transform="rotate(-35 ' + cx + ' ' + (H - B + 17) + ')"' : '') + '>' + h(c) + '</text>');
      if (line) return;
      series.forEach(function (s, si) {
        var v = s.vals[ci]; if (v == null) return;
        var inf = !isFinite(v), x = cx - n * bw / 2 + si * bw, col = opt.colorOf ? opt.colorOf(si, ci) : s.color;
        if (opt.log && !inf && v <= 0) { out.push('<text class="lbl" x="' + (x + bw / 2) + '" y="' + (y(base) - 5) + '" text-anchor="middle">0' + '</text>'); return; }
        if (s.lows) {   // Min ~ Max 를 한 막대로(아래 끝 Min · 위 끝 Max)
          var lv = s.lows[ci]; if (lv == null) return;
          var ya = y(v), yb = y(lv);
          out.push('<rect' + attr(si, ci) + ' x="' + (x + 0.5) + '" y="' + Math.min(ya, yb) + '" width="' + Math.max(1, bw - 1) + '" height="' + Math.max(1, Math.abs(yb - ya)) + '" fill="' + col + '">' + tip(si, ci, v) + '</rect>');
          out.push(text(x + bw / 2, Math.min(ya, yb), v, true) + text(x + bw / 2, Math.max(ya, yb), lv, false)); return;
        }
        var y0 = y(base), y1 = y(inf ? hi : v), top = Math.min(y0, y1), neg = !inf && v < 0;
        out.push('<rect' + attr(si, ci) + ' x="' + (x + 0.5) + '" y="' + top + '" width="' + Math.max(1, bw - 1) + '" height="' + Math.max(1, Math.abs(y1 - y0)) + '" fill="' + col + '"' + (inf || over(v) ? ' opacity=".45"' : '') + '>' + tip(si, ci, v) + '</rect>');
        out.push(neg ? text(x + bw / 2, Math.max(y0, y1), v, false) : text(x + bw / 2, top, v, true));
      });
    });
    if (line) series.forEach(function (s, si) {
      var pts = [];
      s.vals.forEach(function (v, ci) { if (v == null || (opt.log && isFinite(v) && v <= 0)) return; var cx = L + gw * ci + gw / 2, yy = y(isFinite(v) ? v : hi); pts.push(cx + ',' + yy); });
      if (pts.length > 1) out.push('<polyline fill="none" stroke="' + s.color + '" stroke-width="2" points="' + pts.join(' ') + '"/>');
      s.vals.forEach(function (v, ci) {
        if (v == null || (opt.log && isFinite(v) && v <= 0)) return;
        var cx = L + gw * ci + gw / 2, yy = y(isFinite(v) ? v : hi), col = opt.colorOf ? opt.colorOf(si, ci) : s.color;
        out.push('<circle' + attr(si, ci) + ' cx="' + cx + '" cy="' + yy + '" r="4.5" fill="' + col + '" stroke="#fff" stroke-width="1">' + tip(si, ci, v) + '</circle>' + text(cx, yy - 3, v, true));
      });
    });
    if (!opt.log) out.push('<line class="zero" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>');
    (opt.lines || []).forEach(function (l) { if (l.v > hi || l.v < lo) return; out.push('<line class="lim" stroke="' + l.color + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(l.v) + '" y2="' + y(l.v) + '"/><text class="ax" x="' + (W - R - 4) + '" y="' + (y(l.v) - 4) + '" text-anchor="end" fill="' + l.color + '">' + h(l.label) + '</text>'); });
    if (opt.yLabel) out.push('<text class="ax" x="6" y="12">' + h(opt.yLabel) + (opt.log ? ' (로그)' : '') + '</text>');
    var leg = opt.noLegend ? '' : '<div class="legend">' + series.map(function (s) { return '<span><i class="sw" style="background:' + s.color + '"></i>' + h(s.name) + '</span>'; }).join('') + '</div>';
    return '<svg class="big" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + out.join('') + '</svg>' + leg;
  }

  /* ---------- v1.1 그래프 창(패널) — 보기 조건은 창마다 따로 ---------- */
  var P = {
    st: { hide: {}, mode: 'combined', type: 'bar', label: 'off', per: 15, page: 0, q: '', sel: null },
    lf: { hide: {}, by: 'case', mode: 'split', type: 'bar', label: 'off', per: 15, page: 0, q: '', sel: null, sort: 'none', top: 0, scale: 'lin' },
    dm: { hide: {}, by: 'case', mode: 'split', type: 'bar', label: 'off', per: 15, page: 0, q: '', sel: null, sort: 'none', top: 0, scale: 'log' }
  };
  function full(v) { return E.fmtLabel(v, 'life'); }
  function sLabel(s) { return s.name + (s.desc ? ' (' + s.desc + ')' : ''); }
  function seriesOf(id) { var res = state.res; return id === 'st' || P[id].by === 'scen' ? res.scenarios.map(sLabel) : res.cases.map(function (c) { return c.name; }); }
  function valOf(id, r, si) { var p = P[id]; return id === 'lf' ? (p.by === 'case' ? r.caseLife[si] : r.life[si]) : (p.by === 'case' ? r.caseDmg[si] : r.dmg[si]); }
  function visible(id) { var out = []; seriesOf(id).forEach(function (_, i) { if (!P[id].hide[(P[id].by || 's') + i]) out.push(i); }); return out; }
  function chosen(id) {
    var p = P[id], res = state.res, vis = visible(id), o = { sel: p.sel, q: p.q };
    if (id !== 'st') {
      o.key = function (r) { var a = vis.map(function (i) { return valOf(id, r, i); }).filter(function (v) { return v != null; }); return a.length ? (id === 'lf' ? Math.min.apply(null, a) : Math.max.apply(null, a)) : null; };
      o.worst = id === 'lf' ? 'low' : 'high'; o.topN = p.top; o.sort = p.sort;
    }
    return E.paginate(E.pickChannels(res.rows, o), p.per, p.page);
  }
  function opts(k, list, cur) { return list.map(function (x) { return '<option value="' + x[0] + '"' + (String(x[0]) === String(cur) ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); }
  function ctl(id) {
    var p = P[id], res = state.res, names = seriesOf(id), d = function (k) { return ' data-p="' + id + '" data-k="' + k + '"'; }, o = [];
    var what = id === 'st' ? '시나리오' : (p.by === 'case' ? 'Case' : '시나리오');
    if (id !== 'st') o.push('<label>평가 단위 <select' + d('by') + '>' + opts('by', [['case', 'Case 별'], ['scen', '시나리오별']], p.by) + '</select></label>');
    o.push('<label>보기 <select' + d('mode') + '>' + opts('mode', [['combined', '한 그래프에 겹쳐 비교'], ['split', what + '마다 따로']], p.mode) + '</select></label>');
    o.push('<label>그래프 종류 <select' + d('type') + '>' + opts('type', [['bar', '막대'], ['line', '꺾은선']], p.type) + '</select></label>');
    if (id !== 'st') o.push('<label>세로축 <select' + d('scale') + '>' + opts('scale', [['lin', '선형'], ['log', '로그']], p.scale) + '</select></label>');
    o.push('<label>값 표시(Data Label) <select' + d('label') + '>' + opts('label', id === 'st' ? [['off', '끔'], ['int', '정수'], ['d1', '소수점 1자리'], ['d2', '소수점 2자리']] : [['off', '끔'], ['on', '켬']], p.label) + '</select></label>');
    if (id !== 'st') {
      o.push('<label>정렬(' + (id === 'lf' ? 'Life' : 'Damage') + ' 기준) <select' + d('sort') + '>' + opts('sort', [['none', '채널 순서'], ['asc', '오름차순'], ['desc', '내림차순']], p.sort) + '</select></label>');
      o.push('<label>Worst Channel <select' + d('top') + '>' + opts('top', [[0, '전체'], [5, 'Top 5'], [10, 'Top 10'], [20, 'Top 20']], p.top) + '</select></label>');
    }
    o.push('<label>한 화면 채널 수 <input type="number" min="1" max="200" step="1" value="' + p.per + '"' + d('per') + '></label>');
    o.push('<label>채널 검색 <input type="text" placeholder="예) Ch1" value="' + h(p.q) + '"' + d('q') + '></label>');
    var tog = '<div class="togs"><b>' + what + ' 표시</b>' + names.map(function (n, i) { return '<label class="chk"><input type="checkbox"' + d('hide') + ' data-i="' + i + '"' + (p.hide[(p.by || 's') + i] ? '' : ' checked') + '><i class="sw" style="background:' + COLORS[i % COLORS.length] + '"></i>' + h(n) + '</label>'; }).join('') + '</div>';
    var chs = res.rows.map(function (r) { return r.name; }), nsel = p.sel ? p.sel.length : chs.length;
    var pick = '<details class="chpick"' + (p.open ? ' open' : '') + ' data-p="' + id + '"><summary>채널 선택 <small>' + nsel + ' / ' + chs.length + '개 표시</small></summary><div class="btnrow"><button class="btn sm" data-p="' + id + '" data-act="all">전체 선택</button><button class="btn sm" data-p="' + id + '" data-act="none">전체 해제</button></div><div class="chlist">' +
      chs.map(function (c) { return '<label class="chk"><input type="checkbox"' + d('sel') + ' value="' + h(c) + '"' + (!p.sel || p.sel.indexOf(c) >= 0 ? ' checked' : '') + '>' + h(c) + '</label>'; }).join('') + '</div></details>';
    var back = id === 'st' && p.linked ? '<div class="note linked">Life · Damage 그래프에서 고른 채널 <b>' + h(p.sel.join(', ')) + '</b> 만 보는 중입니다. <button class="btn sm" data-p="st" data-act="all">전체 채널 보기</button></div>' : '';
    return back + '<div class="ctl">' + o.join('') + '</div>' + tog + pick;
  }
  function pager(id, pg) {
    return '<div class="pager" data-pager="' + id + '"><button class="btn sm" data-p="' + id + '" data-act="prev"' + (pg.page <= 0 ? ' disabled' : '') + '>이전</button><span>' + (pg.page + 1) + ' / ' + pg.pages + ' 쪽 · 채널 ' + pg.total + '개 중 ' + pg.items.length + '개</span><button class="btn sm" data-p="' + id + '" data-act="next"' + (pg.page >= pg.pages - 1 ? ' disabled' : '') + '>다음</button></div>';
  }
  function drawPanel(id, withCtl) {
    var res = state.res; if (!res) return;
    if (id !== 'st' && !res.hasLife) return;
    var p = P[id], U = unit(), names = seriesOf(id), vis = visible(id), pg = chosen(id), rows = pg.items, cats = rows.map(function (r) { return r.name; }), S = res.scenarios, C = res.cases;
    p.page = pg.page;
    if (withCtl) $('#ctl-' + id).innerHTML = ctl(id);
    var blocks = function (title, get, o) {
      var mk = function (list) { return list.map(function (i) { return { name: names[i], color: COLORS[i % COLORS.length], vals: rows.map(function (r) { return get(r, i); }), lows: o.low ? rows.map(function (r) { return o.low(r, i); }) : null, idx: i }; }); };
      var one = function (ser, sub) { var oo = Object.assign({}, o, { type: o.low ? 'bar' : p.type }); if (oo.wrap) oo = oo.wrap(oo, ser); return '<div class="win"><h3>' + h(title) + (sub ? ' — ' + h(sub) : '') + '</h3>' + chart(cats, ser, oo) + '</div>'; };
      if (!vis.length) return '<div class="win"><h3>' + h(title) + '</h3><p class="sub nochart">표시할 항목을 하나 이상 켜 주세요.</p></div>';
      return p.mode === 'combined' ? one(mk(vis), '') : vis.map(function (i) { return one(mk([i]), names[i]); }).join('');
    };
    var html = '';
    if (id === 'st') {
      var lp = res.allow ? [{ v: res.allow, label: '허용 +' + res.allow, color: '#c8341f' }] : [], ln = res.allow ? [{ v: -res.allow, label: '허용 −' + res.allow, color: '#c8341f' }] : [], lines = lp.concat(ln);
      var lab = p.label === 'off' ? null : function (v) { return E.fmtLabel(v, p.label); };
      var so = function (word, ls, low) { return { yLabel: U, lines: ls, linesInScale: true, label: lab, low: low, tall: !!low, tip: function (si, ci) { return 'Channel: ' + cats[ci] + '\nScenario: ' + this.names[si] + '\n' + (low ? 'Max Stress: ' + E.fmtLabel(this.vals[si][ci], 'd2') + ' ' + U + '\nMin Stress: ' + E.fmtLabel(this.lows[si][ci], 'd2') + ' ' + U : word + ': ' + E.fmtLabel(this.vals[si][ci], 'd2') + ' ' + U); }, wrap: function (oo, ser) { oo.tip = oo.tip.bind({ names: ser.map(function (s) { return s.name; }), vals: ser.map(function (s) { return s.vals; }), lows: ser.map(function (s) { return s.lows; }) }); return oo; } }; };
      html += '<div id="c-mm">' + blocks('시나리오별 Min ~ Max Stress', function (r, i) { return r.max[i]; }, so('', lines, function (r, i) { return r.min[i]; })) + '<p class="sub">막대의 아래 끝이 Min, 위 끝이 Max 입니다. 0 선 아래는 압축입니다.</p></div>';
      html += '<div id="c-max">' + blocks('시나리오별 Max Stress', function (r, i) { return r.max[i]; }, so('Max Stress', lp)) + '</div>';
      html += '<div id="c-min">' + blocks('시나리오별 Min Stress', function (r, i) { return r.min[i]; }, so('Min Stress', ln)) + '</div>';
      html += '<div class="win"><h3>Max / Min 비교 <small>채널마다 전 시나리오의 최대 인장(빨강) ~ 최대 압축(파랑)</small></h3><div id="c-env">' + (cats.length ? bars(cats, [], { yLabel: U, lines: lines, label: lab, float: rows.map(function (r) { return r.peakMax == null || r.peakMin == null ? null : { lo: r.peakMin, hi: r.peakMax }; }) }) + '<div class="legend"><span><i class="sw" style="background:#c8341f"></i>최대 인장(Max 의 최댓값)</span><span><i class="sw" style="background:#154b6e"></i>최대 압축(Min 의 최솟값)</span></div>' : '<p class="sub nochart">표시할 채널이 없습니다.</p>') + '</div></div>';
    } else {
      var isL = id === 'lf', G = E.GRADES, Lm = res.limits, cap = Lm[2] * 3, byC = p.by === 'case';
      var limLines = isL ? [{ v: Lm[0], label: 'Red < ' + full(Lm[0]), color: G[0].color }, { v: Lm[1], label: 'Orange < ' + full(Lm[1]), color: G[1].color }, { v: Lm[2], label: 'Yellow < ' + full(Lm[2]), color: G[2].color }] : [];
      var lifeOf = function (r, i) { return byC ? r.caseLife[i] : r.life[i]; }, dmgOf = function (r, i) { return byC ? r.caseDmg[i] : r.dmg[i]; };
      var o = { yLabel: isL ? 'Life (hr)' : 'Damage (/hr)', lines: limLines, log: p.scale === 'log', cap: isL ? cap : null, pick: true, noLegend: p.mode === 'split',
        axFmt: isL ? full : function (v) { return v === 0 ? '0' : v.toExponential(0); }, label: p.label === 'on' ? function (v) { return E.fmtLabel(v, isL ? 'life' : 'exp'); } : null,
        wrap: function (oo, ser) {
          oo.tip = function (si, ci) { var r = rows[ci], i = ser[si].idx, dv = dmgOf(r, i), lv = lifeOf(r, i), ct = byC && r.contrib[i] ? '\nScenario 기여: ' + S.map(function (s, k) { return s.name + ' ' + (r.contrib[i][k] == null ? '-' : Math.round(r.contrib[i][k] * 100) + '%'); }).join(' · ') : '';
            return 'Channel: ' + r.name + '\n' + (byC ? 'Case: ' : 'Scenario: ') + names[i] + '\nLife: ' + (lv == null ? '-' : full(lv) + ' hr') + '\nDamage: ' + (dv == null ? '-' : E.fmtLabel(dv, 'exp') + ' /hr') + ct + '\n(누르면 Stress Dashboard 에서 이 채널을 봅니다)'; };
          if (p.mode === 'split') oo.colorOf = function (si, ci) { var g = E.gradeOf(lifeOf(rows[ci], ser[si].idx), Lm); return g ? g.color : '#999'; };
          return oo;
        } };
      var word = (byC ? 'Case 별 ' : '시나리오별 ') + (isL ? '수명(Life)' : '손상(Damage per hour)');
      html += '<div id="' + (isL ? 'c-cases' : 'c-dmg') + '">' + blocks(word, isL ? lifeOf : dmgOf, o) + '</div>';
    }
    $('#win-' + id).innerHTML = pager(id, pg) + html + (pg.pages > 1 ? pager(id, pg) : '');
  }

  function readBook(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { try { var wb = XLSX.read(r.result, { type: 'array' }), sheets = {}; wb.SheetNames.forEach(function (n) { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); }); res({ names: wb.SheetNames, sheets: sheets }); } catch (e) { rej(e); } };
      r.onerror = rej; r.readAsArrayBuffer(file);
    });
  }
  function load(book, name) {
    var m = E.parseBook(book); state.file = name;
    if (!m.ok) { state.model = state.res = null; $('#file-status').innerHTML = '<div class="warn" id="load-err"><b>' + h(name) + '</b> — ' + h(m.error) + '</div>'; ['#s-cond', '#s-sum', '#s-stress', '#s-life', '#s-dmg', '#s-table', '#s-report'].forEach(function (s) { show(s, false); }); return; }
    state.orig = JSON.parse(JSON.stringify(m)); state.model = m;
    ['st', 'lf', 'dm'].forEach(function (k) { P[k].hide = {}; P[k].sel = null; P[k].q = ''; P[k].page = 0; P[k].linked = false; });
    $('#file-status').innerHTML = '<div class="ok" id="load-ok"><b>' + h(name) + '</b> — 채널 ' + m.channels.length + '개 · 시나리오 ' + m.scenarios.length + '개 · Case ' + m.cases.length + '개를 읽었습니다(응력 시트 「' + h(m.source.stressSheet) + '」' + (m.source.damageSheet ? ' · 손상 시트 「' + h(m.source.damageSheet) + '」' : '') + ').</div>' +
      (m.issues.length ? '<div class="warn" id="load-issues"><b>읽으면서 확인한 것</b><ul>' + m.issues.map(function (i) { return '<li>' + h(i) + '</li>'; }).join('') + '</ul></div>' : '');
    renderCond(); calc();
    ['#s-cond', '#s-sum', '#s-stress', '#s-life', '#s-dmg', '#s-table', '#s-report'].forEach(function (s) { show(s, true); });
  }
  function renderCond() {
    var m = state.model, heads = m.weightHeads || [];
    $('#cond').innerHTML = '<table><tr><th>시나리오</th><th>설명(범례)</th><th>Duration time(s)</th>' + m.cases.map(function (c) { return '<th>' + h(c.name) + ' 가중치</th>'; }).join('') + (heads.some(Boolean) ? '<th>가중치 표의 열 머리글</th>' : '') + '</tr>' +
      m.scenarios.map(function (s, i) {
        return '<tr><td><b>' + h(s.name) + '</b></td><td>' + h(s.desc) + '</td><td><input type="number" step="any" min="0" data-dur="' + i + '" value="' + (s.durationSec == null ? '' : s.durationSec) + '"></td>' +
          m.cases.map(function (c, k) { return '<td><input type="number" step="any" min="0" data-w="' + k + ':' + i + '" value="' + (c.w[i] == null ? '' : c.w[i]) + '"></td>'; }).join('') + (heads.some(Boolean) ? '<td class="muted">' + h(heads[i]) + '</td>' : '') + '</tr>';
      }).join('') + (m.cases.length ? '<tr><td colspan="3" class="muted" style="text-align:right">가중치 합</td>' + m.cases.map(function (c, k) { return '<td id="wsum-' + k + '"></td>'; }).join('') + (heads.some(Boolean) ? '<td></td>' : '') + '</tr>' : '') + '</table>';
  }
  function calc() {
    var m = state.model; if (!m) return;
    var lim = [+$('#lim0').value, +$('#lim1').value, +$('#lim2').value], al = parseFloat($('#allow').value);
    var res = state.res = E.analyze(m, { limits: lim, allow: isFinite(al) ? al : null }), U = unit(), S = res.scenarios, C = res.cases, chs = res.rows.map(function (r) { return r.name; });
    m.cases.forEach(function (c, k) { var s = c.w.reduce(function (a, v) { return a + (v || 0); }, 0); $('#wsum-' + k).innerHTML = '<b' + (Math.abs(s - 1) > 0.005 ? ' class="bad"' : '') + '>' + (Math.round(s * 1000) / 1000) + '</b>'; });
    var edited = JSON.stringify(m.cases) !== JSON.stringify(state.orig.cases) || JSON.stringify(m.scenarios) !== JSON.stringify(state.orig.scenarios);
    $('#notes').innerHTML = (res.notes.length ? '<div class="warn" id="res-notes"><b>확인이 필요한 것</b><ul>' + res.notes.map(function (n) { return '<li>' + h(n) + '</li>'; }).join('') + '</ul></div>' : '') +
      (res.verify && !edited ? (res.verify.diff.length ? '<div class="warn" id="verify"><b>파일에 적힌 Case Life 와 다시 계산한 값이 다릅니다(' + res.verify.diff.length + '건)</b><ul>' + res.verify.diff.slice(0, 12).map(function (d) { return '<li>' + h(d) + '</li>'; }).join('') + '</ul></div>' : '<div class="ok" id="verify">검산 — 파일에 적힌 Case Life ' + res.verify.compared + '개와 다시 계산한 값이 모두 같습니다.</div>') : (edited ? '<div class="note" id="verify">가중치 · Duration 을 고친 상태입니다. 아래 결과는 고친 값으로 계산한 것입니다.</div>' : ''));
    // 요약
    var a = res.maxTension, c = res.maxCompression, ml = res.minLife, cards = [];
    if (a) cards.push(['', '최대 응력 채널(인장)', a.name + ' · ' + E.f1(a.peakMax) + ' ' + U, S[a.peakMaxS].name]);
    if (c) cards.push(['', '최대 압축응력 채널', c.name + ' · ' + E.f1(c.peakMin) + ' ' + U, S[c.peakMinS].name]);
    if (res.hasLife) {
      cards.push(['g-' + ml.grade.key, '최소 수명 채널(Worst Channel)', ml.name + ' · ' + E.f0(ml.minLife) + ' hr', C[ml.minLifeCase].name + ' · ' + ml.grade.label]);
      if (res.worstScenario) cards.push(['', 'Worst Scenario(손상 합 최대)', res.worstScenario.name, res.worstScenario.desc]);
      if (res.worstCase) cards.push(['', 'Worst Case', res.worstCase.name, '최소 수명 ' + E.f0(res.worstCase.minLife) + ' hr']);
      cards.push([res.count.red ? 'g-red' : res.count.orange ? 'g-orange' : res.count.yellow ? 'g-yellow' : 'g-green', '위험도 평가', 'Red ' + res.count.red + ' · Orange ' + res.count.orange, 'Yellow ' + res.count.yellow + ' · Green ' + res.count.green]);
    }
    $('#summary').innerHTML = cards.map(function (x) { return '<div class="stat ' + x[0] + '">' + h(x[1]) + '<b>' + h(x[2]) + '</b>' + h(x[3]) + '</div>'; }).join('');
    // Stress
    drawPanel('st', true);
    $('#peak').innerHTML = '<dl class="kv">' + (a ? '<dt>최대 인장</dt><dd><b>' + h(a.name) + '</b> ' + E.f1(a.peakMax) + ' ' + U + ' — ' + h(S[a.peakMaxS].name + (S[a.peakMaxS].desc ? ' · ' + S[a.peakMaxS].desc : '')) + '</dd>' : '') + (c ? '<dt>최대 압축</dt><dd><b>' + h(c.name) + '</b> ' + E.f1(c.peakMin) + ' ' + U + ' — ' + h(S[c.peakMinS].name + (S[c.peakMinS].desc ? ' · ' + S[c.peakMinS].desc : '')) + '</dd>' : '') + (res.maxRange ? '<dt>최대 Stress range</dt><dd><b>' + h(res.maxRange.name) + '</b> ' + E.f1(res.maxRange.peakRange) + ' ' + U + ' — ' + h(S[res.maxRange.peakRangeS].name) + '</dd>' : '') +
      S.map(function (s) { return '<dt>' + h(s.name) + '</dt><dd>Max ' + E.f1(s.maxStress) + ' / Min ' + E.f1(s.minStress) + ' ' + U + (s.desc ? ' <span class="muted">(' + h(s.desc) + ')</span>' : '') + '</dd>'; }).join('') + '</dl>';
    $('#top-stress').innerHTML = '<table><tr><th>순위</th><th>채널</th><th>절댓값 최대(' + h(U) + ')</th><th>구분</th><th>시나리오</th>' + (res.allow ? '<th>안전율</th>' : '') + '</tr>' + res.topStress.map(function (r, i) { var si = r.peakAbsSign === '압축' ? r.peakMinS : r.peakMaxS; return '<tr><td>' + (i + 1) + '</td><td><b>' + h(r.name) + '</b></td><td class="num">' + E.f1(r.peakAbs) + '</td><td class="' + (r.peakAbsSign === '압축' ? 'down' : 'up') + '">' + r.peakAbsSign + '</td><td>' + h(S[si].name) + '</td>' + (res.allow ? '<td class="num' + (r.sf < 1 ? ' bad' : '') + '">' + (Math.round(r.sf * 100) / 100) + '</td>' : '') + '</tr>'; }).join('') + '</table>';
    // Life
    show('#life-body', res.hasLife);
    show('#dmg-body', res.hasLife); $('#dmg-none').innerHTML = res.hasLife ? '' : '<div class="warn">손상(Damage per hour) 표가 없어 그리지 못했습니다.</div>';
    $('#life-none').innerHTML = res.hasLife ? '' : '<div class="warn">손상(Damage per hour) 표나 Case 가중치가 없어 수명을 계산하지 못했습니다.</div>';
    if (res.hasLife) {
      var G = E.GRADES, L = res.limits, cap = L[2] * 3;
      $('#grade-legend').innerHTML = G.map(function (g, i) { return '<span><i class="sw" style="background:' + g.color + '"></i>' + g.label + ' — ' + (i === 0 ? 'Life < ' + full(L[0]) : i === 3 ? 'Life ≥ ' + full(L[2]) : full(L[i - 1]) + ' ≤ Life < ' + full(L[i])) + ' hr</span>'; }).join('') + '<span>∞ = 손상 0 · ↑ = 선형 축에서 ' + full(cap) + ' hr 넘음(잘라서 표시, 로그 축은 그대로)</span>';
      drawPanel('lf', true); drawPanel('dm', true);
      var ct = ml.contrib[ml.minLifeCase];
      $('#worst').innerHTML = '<dl class="kv"><dt>Worst Channel</dt><dd><b>' + h(ml.name) + '</b> ' + E.f0(ml.minLife) + ' hr ' + tag(ml.grade) + ' — ' + h(C[ml.minLifeCase].name) + '</dd><dt>그 채널의 손상 기여</dt><dd>' + S.map(function (s, i) { return h(s.name) + ' ' + (ct[i] == null ? '-' : Math.round(ct[i] * 100) + '%'); }).join(' · ') + '</dd>' +
        (res.worstScenario ? '<dt>Worst Scenario</dt><dd><b>' + h(res.worstScenario.name) + '</b>' + (res.worstScenario.desc ? ' (' + h(res.worstScenario.desc) + ')' : '') + ' — 채널 손상 합 ' + res.worstScenario.sumDmg.toExponential(2) + ' /hr, 최대 채널 ' + h(res.worstScenario.maxDmgCh) + '</dd>' : '') +
        (res.worstCase ? '<dt>Worst Case</dt><dd><b>' + h(res.worstCase.name) + '</b> — 최소 수명 ' + E.f0(res.worstCase.minLife) + ' hr(' + h(res.worstCase.minLifeCh) + ')</dd>' : '') +
        C.map(function (k) { return '<dt>' + h(k.name) + '</dt><dd>Red ' + k.count.red + ' · Orange ' + k.count.orange + ' · Yellow ' + k.count.yellow + ' · Green ' + k.count.green + '</dd>'; }).join('') + '</dl>';
      $('#top-life').innerHTML = lifeTable(res, 10);
    }
    // 전체 표 — 응력 · 손상 · 수명을 따로(시나리오 이름은 한 줄 위에)
    var e = function (v) { return v == null ? '' : v === 0 ? '0' : v.toExponential(2); }, gc = function (r) { return r.grade ? 'g-' + r.grade.key : ''; };
    $('#all-stress').innerHTML = '<table><tr><th rowspan="2">채널</th>' + S.map(function (s) { return '<th colspan="2" class="grp">' + h(s.name) + (s.desc ? '<small>' + h(s.desc) + '</small>' : '') + '</th>'; }).join('') + '<th rowspan="2">Stress range<br>(' + h(U) + ')</th></tr><tr>' + S.map(function () { return '<th>Max</th><th>Min</th>'; }).join('') + '</tr>' +
      res.rows.map(function (r) { return '<tr class="' + gc(r) + '"><td><b>' + h(r.name) + '</b></td>' + S.map(function (_, i) { return '<td class="num">' + (r.max[i] == null ? '' : E.f1(r.max[i])) + '</td><td class="num">' + (r.min[i] == null ? '' : E.f1(r.min[i])) + '</td>'; }).join('') + '<td class="num"><b>' + (r.peakRange == null ? '' : E.f1(r.peakRange)) + '</b></td></tr>'; }).join('') + '</table>';
    show('#all-dmg-box', res.hasLife); show('#all-life-box', res.hasLife);
    if (res.hasLife) {
      $('#all-dmg').innerHTML = '<table><tr><th rowspan="2">채널</th>' + S.map(function (s) { return '<th colspan="2" class="grp">' + h(s.name) + (s.desc ? '<small>' + h(s.desc) + '</small>' : '') + '</th>'; }).join('') + '</tr><tr>' + S.map(function () { return '<th>Damage/hr</th><th>Total damage</th>'; }).join('') + '</tr>' +
        res.rows.map(function (r) { return '<tr class="' + gc(r) + '"><td><b>' + h(r.name) + '</b></td>' + S.map(function (_, i) { return '<td class="num">' + e(r.dmg[i]) + '</td><td class="num">' + e(r.total[i]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
      $('#all-life').innerHTML = '<table><tr><th>채널</th>' + C.map(function (k) { return '<th>' + h(k.name) + ' (h)</th>'; }).join('') + '<th>Worst Case</th><th>최소 수명 (h)</th><th>위험도</th><th>판정</th></tr>' +
        res.rows.map(function (r) { var z = r.dmg.some(function (v) { return v != null; }) && r.dmg.every(function (v) { return v == null || v === 0; }); return '<tr class="' + gc(r) + '"><td><b>' + h(r.name) + '</b></td>' + r.caseLife.map(function (v) { return '<td class="num">' + (v == null ? '' : full(v)) + '</td>'; }).join('') + '<td>' + (r.minLifeCase >= 0 ? h(C[r.minLifeCase].name) : '') + '</td><td class="num"><b>' + (r.minLife == null ? '' : full(r.minLife)) + '</b></td><td>' + tag(r.grade) + '</td><td class="muted">' + (z ? 'Damage 0 (검증 필요)' : '') + '</td></tr>'; }).join('') + '</table>';
    }
    // 보고서
    var rep = E.report(res, { unit: U });
    $('#report').innerHTML = '<p class="meta">파일 ' + h(state.file) + ' · 채널 ' + res.rows.length + '개 · 시나리오 ' + S.length + '개 · 작성 ' + new Date().toISOString().slice(0, 10) + '</p>' + rep.map(function (s) {
      return '<h3>■ ' + h(s.title) + '</h3>' + (s.table ? '<div class="cols2"><div><div class="tablewrap free">' + $('#top-stress').innerHTML + '</div></div><div><div class="tablewrap free">' + (res.hasLife ? lifeTable(res, 10) : '<p class="sub">수명 자료 없음</p>') + '</div></div></div>' : '<ul>' + s.lines.map(function (l) { return '<li>' + md(l) + '</li>'; }).join('') + '</ul>');
    }).join('');
  }
  function lifeTable(res, n) {
    return '<table><tr><th>순위</th><th>채널</th><th>최소 수명(hr)</th><th>기준 Case</th>' + res.cases.map(function (k) { return '<th>' + h(k.name) + '</th>'; }).join('') + '<th>위험도</th></tr>' + res.topLife.slice(0, n).map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><td><b>' + h(r.name) + '</b></td><td class="num"><b>' + E.f0(r.minLife) + '</b></td><td>' + h(res.cases[r.minLifeCase].name) + '</td>' + r.caseLife.map(function (v) { return '<td class="num">' + E.f0(v) + '</td>'; }).join('') + '<td>' + tag(r.grade) + '</td></tr>'; }).join('') + '</table>';
  }

  document.addEventListener('change', function (e) {
    var t = e.target, m = state.model;
    if (t.dataset.p && state.res) {
      var id = t.dataset.p, p = P[id], k = t.dataset.k;
      if (k === 'hide') p.hide[(p.by || 's') + t.dataset.i] = !t.checked;
      else if (k === 'sel') { var boxes = [].slice.call(document.querySelectorAll('#ctl-' + id + ' input[data-k="sel"]')), on = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); p.sel = on.length === boxes.length ? null : on; p.linked = false; p.open = true; }
      else if (k === 'per') p.per = Math.max(1, Math.min(200, parseInt(t.value, 10) || 15));
      else if (k === 'top') p.top = +t.value;
      else if (k === 'q') p.q = t.value;
      else p[k] = t.value;
      p.page = 0; drawPanel(id, k !== 'q'); return;
    }
    if (t.id === 'file') { if (t.files[0]) { var f = t.files[0]; readBook(f).then(function (b) { load(b, f.name); }).catch(function (err) { $('#file-status').innerHTML = '<div class="warn" id="load-err">엑셀을 읽지 못했습니다 — ' + h(err.message) + '</div>'; }); } return; }
    if (!m) return;
    var v = t.value.trim() === '' ? null : parseFloat(t.value);
    if (t.dataset.dur != null) m.scenarios[+t.dataset.dur].durationSec = v;
    else if (t.dataset.w != null) { var p = t.dataset.w.split(':'); m.cases[+p[0]].w[+p[1]] = v; }
    calc();
  });
  document.addEventListener('input', function (e) { var t = e.target; if (t.dataset.p && t.dataset.k === 'q' && state.res) { P[t.dataset.p].q = t.value; P[t.dataset.p].page = 0; drawPanel(t.dataset.p, false); } });
  document.addEventListener('toggle', function (e) { var t = e.target; if (t.classList && t.classList.contains('chpick')) P[t.dataset.p].open = t.open; }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null, pk = e.target.closest ? e.target.closest('.pick') : null;
    if (b && state.res) {
      var id = b.dataset.p, p = P[id], a = b.dataset.act;
      if (a === 'prev') p.page--; else if (a === 'next') p.page++;
      else if (a === 'all') { p.sel = null; p.linked = false; p.page = 0; } else if (a === 'none') { p.sel = []; p.linked = false; p.open = true; p.page = 0; }
      drawPanel(id, a === 'all' || a === 'none'); return;
    }
    if (pk && state.res) { P.st.sel = [pk.dataset.ch]; P.st.linked = true; P.st.q = ''; P.st.page = 0; drawPanel('st', true); $('#s-stress').scrollIntoView(); }
  });
  var drop = $('#drop');
  ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) readBook(f).then(function (b) { load(b, f.name); }); });
  function sampleWb() { var B = E.sampleBook(), wb = XLSX.utils.book_new(); B.names.forEach(function (n) { var ws = XLSX.utils.aoa_to_sheet(B.sheets[n]); ws['!merges'] = B.merges[n]; XLSX.utils.book_append_sheet(wb, ws, n); }); return wb; }
  $('#btn-sample').addEventListener('click', function () { load(E.sampleBook(), '응력계측결과_예제(가상).xlsx'); $('#s-sum').scrollIntoView(); });
  $('#btn-sample-xlsx').addEventListener('click', function () { XLSX.writeFile(sampleWb(), '응력계측결과_예제(가상).xlsx'); });
  $('#btn-reset').addEventListener('click', function () { state.model = JSON.parse(JSON.stringify(state.orig)); renderCond(); calc(); });
  $('#btn-print').addEventListener('click', function () { window.print(); });
  $('#btn-export').addEventListener('click', function () { var sh = E.exportSheets(state.res, { unit: unit() }), wb = XLSX.utils.book_new(); Object.keys(sh).forEach(function (n) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh[n]), n); }); XLSX.writeFile(wb, '응력계측_후처리_' + new Date().toISOString().slice(0, 10) + '.xlsx'); });
  window.__app = { state: state, P: P };
})();
