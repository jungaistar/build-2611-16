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
    var W = 760, H = 300, L = 54, R = 12, T = 14, B = 46, all = [];
    series.forEach(function (s) { s.vals.forEach(function (v) { if (v != null && isFinite(v)) all.push(v); }); });
    (opt.float || []).forEach(function (f) { if (f) { all.push(f.lo); all.push(f.hi); } });
    (opt.lines || []).forEach(function (l) { if (opt.linesInScale) all.push(l.v); });
    if (!all.length) return '<p class="sub">표시할 값이 없습니다.</p>';
    var hi = Math.max(0, Math.max.apply(null, all)), lo = Math.min(0, Math.min.apply(null, all));
    if (opt.cap && hi > opt.cap) hi = opt.cap;
    var step = nice((hi - lo) / 5 || 1); hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step; if (hi === lo) hi = lo + step;
    var y = function (v) { return T + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (H - T - B); };
    var gw = (W - L - R) / cats.length, n = opt.float ? 1 : series.length, bw = Math.min(26, gw * 0.78 / n), out = [];
    for (var t = lo; t <= hi + step / 2; t += step) out.push('<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + fmtAx(t) + '</text>');
    cats.forEach(function (c, ci) {
      var cx = L + gw * ci + gw / 2;
      out.push('<text class="ax" x="' + cx + '" y="' + (H - B + 16) + '" text-anchor="middle"' + (cats.length > 12 ? ' transform="rotate(-35 ' + cx + ' ' + (H - B + 16) + ')"' : '') + '>' + h(c) + '</text>');
      if (opt.float) {
        var f = opt.float[ci]; if (!f) return;
        out.push('<rect x="' + (cx - bw / 2) + '" y="' + y(Math.max(f.hi, 0)) + '" width="' + bw + '" height="' + Math.max(1, y(0) - y(Math.max(f.hi, 0))) + '" fill="#c8341f" opacity=".85"><title>' + h(c) + ' 최대 인장 ' + E.f1(f.hi) + '</title></rect>');
        out.push('<rect x="' + (cx - bw / 2) + '" y="' + y(0) + '" width="' + bw + '" height="' + Math.max(1, y(Math.min(f.lo, 0)) - y(0)) + '" fill="#154b6e" opacity=".85"><title>' + h(c) + ' 최대 압축 ' + E.f1(f.lo) + '</title></rect>');
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
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + out.join('') + '</svg>' + leg;
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
    if (!m.ok) { state.model = state.res = null; $('#file-status').innerHTML = '<div class="warn" id="load-err"><b>' + h(name) + '</b> — ' + h(m.error) + '</div>'; ['#s-cond', '#s-sum', '#s-stress', '#s-life', '#s-table', '#s-report'].forEach(function (s) { show(s, false); }); return; }
    state.orig = JSON.parse(JSON.stringify(m)); state.model = m;
    $('#file-status').innerHTML = '<div class="ok" id="load-ok"><b>' + h(name) + '</b> — 채널 ' + m.channels.length + '개 · 시나리오 ' + m.scenarios.length + '개 · Case ' + m.cases.length + '개를 읽었습니다(응력 시트 「' + h(m.source.stressSheet) + '」' + (m.source.damageSheet ? ' · 손상 시트 「' + h(m.source.damageSheet) + '」' : '') + ').</div>' +
      (m.issues.length ? '<div class="warn" id="load-issues"><b>읽으면서 확인한 것</b><ul>' + m.issues.map(function (i) { return '<li>' + h(i) + '</li>'; }).join('') + '</ul></div>' : '');
    renderCond(); calc();
    ['#s-cond', '#s-sum', '#s-stress', '#s-life', '#s-table', '#s-report'].forEach(function (s) { show(s, true); });
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
    var ser = function (key) { return S.map(function (s, i) { return { name: s.name + (s.desc ? ' (' + s.desc + ')' : ''), color: COLORS[i % COLORS.length], vals: res.rows.map(function (r) { return r[key][i]; }) }; }); };
    var lines = res.allow ? [{ v: res.allow, label: '허용 ' + res.allow, color: '#c8341f' }, { v: -res.allow, label: '−허용', color: '#c8341f' }] : [];
    $('#c-max').innerHTML = bars(chs, ser('max'), { yLabel: U, lines: lines });
    $('#c-min').innerHTML = bars(chs, ser('min'), { yLabel: U, lines: lines });
    $('#c-env').innerHTML = bars(chs, [], { yLabel: U, lines: lines, float: res.rows.map(function (r) { return r.peakMax == null || r.peakMin == null ? null : { lo: r.peakMin, hi: r.peakMax }; }) }) + '<div class="legend"><span><i class="sw" style="background:#c8341f"></i>최대 인장(Max 의 최댓값)</span><span><i class="sw" style="background:#154b6e"></i>최대 압축(Min 의 최솟값)</span></div>';
    $('#peak').innerHTML = '<dl class="kv">' + (a ? '<dt>최대 인장</dt><dd><b>' + h(a.name) + '</b> ' + E.f1(a.peakMax) + ' ' + U + ' — ' + h(S[a.peakMaxS].name + (S[a.peakMaxS].desc ? ' · ' + S[a.peakMaxS].desc : '')) + '</dd>' : '') + (c ? '<dt>최대 압축</dt><dd><b>' + h(c.name) + '</b> ' + E.f1(c.peakMin) + ' ' + U + ' — ' + h(S[c.peakMinS].name + (S[c.peakMinS].desc ? ' · ' + S[c.peakMinS].desc : '')) + '</dd>' : '') + (res.maxRange ? '<dt>최대 응력 범위</dt><dd><b>' + h(res.maxRange.name) + '</b> ' + E.f1(res.maxRange.peakRange) + ' ' + U + ' — ' + h(S[res.maxRange.peakRangeS].name) + '</dd>' : '') +
      S.map(function (s) { return '<dt>' + h(s.name) + '</dt><dd>Max ' + E.f1(s.maxStress) + ' / Min ' + E.f1(s.minStress) + ' ' + U + (s.desc ? ' <span class="muted">(' + h(s.desc) + ')</span>' : '') + '</dd>'; }).join('') + '</dl>';
    $('#top-stress').innerHTML = '<table><tr><th>순위</th><th>채널</th><th>절댓값 최대(' + h(U) + ')</th><th>구분</th><th>시나리오</th>' + (res.allow ? '<th>안전율</th>' : '') + '</tr>' + res.topStress.map(function (r, i) { var si = r.peakAbsSign === '압축' ? r.peakMinS : r.peakMaxS; return '<tr><td>' + (i + 1) + '</td><td><b>' + h(r.name) + '</b></td><td class="num">' + E.f1(r.peakAbs) + '</td><td class="' + (r.peakAbsSign === '압축' ? 'down' : 'up') + '">' + r.peakAbsSign + '</td><td>' + h(S[si].name) + '</td>' + (res.allow ? '<td class="num' + (r.sf < 1 ? ' bad' : '') + '">' + (Math.round(r.sf * 100) / 100) + '</td>' : '') + '</tr>'; }).join('') + '</table>';
    // Life
    show('#life-body', res.hasLife);
    $('#life-none').innerHTML = res.hasLife ? '' : '<div class="warn">손상(Damage per hour) 표나 Case 가중치가 없어 수명을 계산하지 못했습니다.</div>';
    if (res.hasLife) {
      var G = E.GRADES, L = res.limits, cap = L[2] * 3, limLines = [{ v: L[0], label: 'Red < ' + E.f0(L[0]), color: G[0].color }, { v: L[1], label: 'Orange < ' + E.f0(L[1]), color: G[1].color }, { v: L[2], label: 'Yellow < ' + E.f0(L[2]), color: G[2].color }];
      $('#grade-legend').innerHTML = G.map(function (g, i) { return '<span><i class="sw" style="background:' + g.color + '"></i>' + g.label + ' — ' + (i === 0 ? 'Life < ' + E.f0(L[0]) : i === 3 ? 'Life ≥ ' + E.f0(L[2]) : E.f0(L[i - 1]) + ' ≤ Life < ' + E.f0(L[i])) + ' hr</span>'; }).join('') + '<span>막대 위 ∞ = 손상 0, ↑ = ' + E.f0(cap) + ' hr 넘음(잘라서 표시)</span>';
      $('#c-cases').innerHTML = C.map(function (k, ci) {
        return '<div><h3>' + h(k.name) + ' 수명 <small>가중치 ' + k.w.map(function (v) { return v == null ? '-' : v; }).join(' / ') + ' · 최소 ' + E.f0(k.minLife) + ' hr(' + h(k.minLifeCh) + ')</small></h3>' + bars(chs, [{ name: k.name, color: '#154b6e', vals: res.rows.map(function (r) { return r.caseLife[ci]; }) }], { yLabel: 'hr', life: true, cap: cap, lines: limLines, noLegend: true, colorOf: function (si, x) { var g = E.gradeOf(res.rows[x].caseLife[ci], L); return g ? g.color : '#999'; } }) + '</div>';
      }).join('');
      $('#c-cmp').innerHTML = bars(chs, C.map(function (k, ci) { return { name: k.name, color: COLORS[ci], vals: res.rows.map(function (r) { return r.caseLife[ci]; }) }; }), { yLabel: 'hr', life: true, cap: cap, lines: limLines });
      var ct = ml.contrib[ml.minLifeCase];
      $('#worst').innerHTML = '<dl class="kv"><dt>Worst Channel</dt><dd><b>' + h(ml.name) + '</b> ' + E.f0(ml.minLife) + ' hr ' + tag(ml.grade) + ' — ' + h(C[ml.minLifeCase].name) + '</dd><dt>그 채널의 손상 기여</dt><dd>' + S.map(function (s, i) { return h(s.name) + ' ' + (ct[i] == null ? '-' : Math.round(ct[i] * 100) + '%'); }).join(' · ') + '</dd>' +
        (res.worstScenario ? '<dt>Worst Scenario</dt><dd><b>' + h(res.worstScenario.name) + '</b>' + (res.worstScenario.desc ? ' (' + h(res.worstScenario.desc) + ')' : '') + ' — 채널 손상 합 ' + res.worstScenario.sumDmg.toExponential(2) + ' /hr, 최대 채널 ' + h(res.worstScenario.maxDmgCh) + '</dd>' : '') +
        (res.worstCase ? '<dt>Worst Case</dt><dd><b>' + h(res.worstCase.name) + '</b> — 최소 수명 ' + E.f0(res.worstCase.minLife) + ' hr(' + h(res.worstCase.minLifeCh) + ')</dd>' : '') +
        C.map(function (k) { return '<dt>' + h(k.name) + '</dt><dd>Red ' + k.count.red + ' · Orange ' + k.count.orange + ' · Yellow ' + k.count.yellow + ' · Green ' + k.count.green + '</dd>'; }).join('') + '</dl>';
      $('#top-life').innerHTML = lifeTable(res, 10);
    }
    // 전체 표
    $('#all').innerHTML = '<table><tr><th>채널</th>' + S.map(function (s) { return '<th>' + h(s.name) + ' Max</th><th>Min</th>'; }).join('') + '<th>최대 범위</th>' + S.map(function (s) { return '<th>' + h(s.name) + ' Damage/hr</th>'; }).join('') + S.map(function (s) { return '<th>' + h(s.name) + ' Total damage</th>'; }).join('') + C.map(function (k) { return '<th>' + h(k.name) + ' Life(hr)</th>'; }).join('') + '<th>위험도</th></tr>' + res.rows.map(function (r) {
      var e = function (v) { return v == null ? '' : v === 0 ? '0' : v.toExponential(2); };
      return '<tr class="' + (r.grade ? 'g-' + r.grade.key : '') + '"><td><b>' + h(r.name) + '</b></td>' + S.map(function (_, i) { return '<td class="num">' + (r.max[i] == null ? '' : E.f1(r.max[i])) + '</td><td class="num">' + (r.min[i] == null ? '' : E.f1(r.min[i])) + '</td>'; }).join('') + '<td class="num">' + (r.peakRange == null ? '' : E.f1(r.peakRange)) + '</td>' + r.dmg.map(function (v) { return '<td class="num">' + e(v) + '</td>'; }).join('') + r.total.map(function (v) { return '<td class="num">' + e(v) + '</td>'; }).join('') + r.caseLife.map(function (v) { return '<td class="num">' + (v == null ? '' : E.f0(v)) + '</td>'; }).join('') + '<td>' + tag(r.grade) + '</td></tr>';
    }).join('') + '</table>';
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
    if (t.id === 'file') { if (t.files[0]) { var f = t.files[0]; readBook(f).then(function (b) { load(b, f.name); }).catch(function (err) { $('#file-status').innerHTML = '<div class="warn" id="load-err">엑셀을 읽지 못했습니다 — ' + h(err.message) + '</div>'; }); } return; }
    if (!m) return;
    var v = t.value.trim() === '' ? null : parseFloat(t.value);
    if (t.dataset.dur != null) m.scenarios[+t.dataset.dur].durationSec = v;
    else if (t.dataset.w != null) { var p = t.dataset.w.split(':'); m.cases[+p[0]].w[+p[1]] = v; }
    calc();
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
  window.__app = { state: state };
})();
