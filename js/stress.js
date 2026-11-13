/*
 * build-2611-16 · 응력 계측 결과 후처리 — 계산 엔진
 * 엑셀 읽기 · 손상/수명 계산 · 순위 · 위험도 · 보고서 문장은 전부 이 파일에 둔다(test/logic.test.js 로 고정).
 * js/app.js 는 그리기만 한다. 값이 없으면 지어내지 않고 「없음」으로 둔다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Stress = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEF_LIMITS = [20000, 50000, 100000];           // Red < 20000 ≤ Orange < 50000 ≤ Yellow < 100000 ≤ Green
  var GRADES = [
    { key: 'red', label: 'Red', ko: '즉시 검토', color: '#c8341f' },
    { key: 'orange', label: 'Orange', ko: '우선 개선', color: '#d9822b' },
    { key: 'yellow', label: 'Yellow', ko: '관찰', color: '#c9a400' },
    { key: 'green', label: 'Green', ko: '양호', color: '#0a6045' }
  ];
  function txt(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  /** 빈 칸 · 오류 값(#DIV/0!)은 null — 0 과 구분한다 */
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = txt(v).replace(/,/g, '');
    if (s === '' || s[0] === '#') return null;
    return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? parseFloat(s) : null;
  }
  function low(v) { return txt(v).toLowerCase().replace(/\s/g, ''); }
  function isCh(v) { var t = txt(v); return t !== '' && num(v) == null; }

  /* ───────────── 엑셀 읽기 ───────────── */
  /** Max · Min 머리줄이 있는 표(시나리오별 Max/Min Stress) */
  function findStress(aoa) {
    for (var r = 0; r < aoa.length; r++) {
      var row = aoa[r] || [], pairs = [];
      for (var c = 0; c < row.length; c++) if (low(row[c]) === 'max' && low(row[c + 1]) === 'min') pairs.push(c);
      if (!pairs.length) continue;
      var up = aoa[r - 1] || [], names = pairs.map(function (c, i) { return txt(up[c]) || txt(up[c + 1]) || '시나리오' + (i + 1); });
      var chCol = -1;
      for (var k = pairs[0] - 1; k >= 0; k--) if (isCh((aoa[r + 1] || [])[k])) { chCol = k; break; }
      if (chCol < 0) continue;
      var rows = [];
      for (var q = r + 1; q < aoa.length; q++) {
        var d = aoa[q] || []; if (!isCh(d[chCol])) { if (rows.length) break; else continue; }
        rows.push({ row: q + 1, name: txt(d[chCol]), max: pairs.map(function (c) { return num(d[c]); }), min: pairs.map(function (c) { return num(d[c + 1]); }) });
      }
      if (rows.length) return { headerRow: r + 1, scenarios: names, channels: rows };
    }
    return null;
  }
  /** 머리줄에 시나리오 이름이 2개 이상 있고 바로 아래부터 채널 행이 이어지는 표 — title 낱말이 위 3줄 안에 있어야 한다 */
  function findBlock(aoa, scen, titleRe, skipRe) {
    var want = scen.map(low);
    for (var r = 0; r < aoa.length; r++) {
      var row = aoa[r] || [];
      for (var c = 0; c < row.length; c++) {
        if (low(row[c]) !== want[0]) continue;
        var ok = want.every(function (w, i) { return low(row[c + i]) === w; }); if (!ok) continue;
        var title = '';
        for (var u = r - 1; u >= Math.max(0, r - 2) && !title; u--) for (var x = c; x < c + want.length && !title; x++) if (txt((aoa[u] || [])[x])) title = txt(aoa[u][x]);
        if (!titleRe.test(title) || (skipRe && skipRe.test(title))) continue;
        var chCol = c - 1, rows = [];
        for (var q = r + 1; q < aoa.length; q++) {
          var d = aoa[q] || []; if (!isCh(d[chCol])) break;
          rows.push({ row: q + 1, name: txt(d[chCol]), v: want.map(function (_, i) { return num(d[c + i]); }) });
        }
        if (rows.length) return { headerRow: r + 1, col: c, rows: rows };
      }
    }
    return null;
  }
  function findRowLabel(aoa, re, n) {
    for (var r = 0; r < aoa.length; r++) {
      var row = aoa[r] || [];
      for (var c = 0; c < row.length; c++) if (re.test(txt(row[c]))) {
        var vals = []; for (var i = 1; i <= n; i++) vals.push(num(row[c + i]));
        if (vals.some(function (v) { return v != null; })) return { row: r + 1, col: c, vals: vals };
      }
    }
    return null;
  }
  /** 「시나리오1 | 부하 요철 | 사이클」 꼴 범례 */
  function findLegend(aoa, scen) {
    var out = {};
    aoa.forEach(function (row) {
      (row || []).forEach(function (v, c) {
        var i = scen.map(low).indexOf(low(v)); if (i < 0 || out[i]) return;
        var d = txt(row[c + 1]); if (d && num(row[c + 1]) == null && scen.map(low).indexOf(low(d)) < 0 && !/^(max|min)$/i.test(d)) out[i] = { desc: d, kind: txt(row[c + 2]) };
      });
    });
    return out;
  }
  /** Case 가중치 표: 「Case1 | 0.25 | 0.25 …」 — 위쪽 두 줄의 머리글(무부하/부하 · 기본/요철)도 함께 읽는다 */
  function findCases(aoa, n) {
    var out = [];
    for (var r = 0; r < aoa.length; r++) {
      var row = aoa[r] || [];
      for (var c = 0; c < row.length; c++) {
        if (!/^case\s*\d+$/i.test(txt(row[c]))) continue;
        var w = []; for (var i = 1; i <= n; i++) w.push(num(row[c + i]));
        if (w.filter(function (v) { return v != null; }).length < 2) continue;
        if (out.length && out[0].col !== c) continue;
        out.push({ name: txt(row[c]), w: w, row: r + 1, col: c });
        break;
      }
    }
    if (!out.length) return { cases: [], heads: [] };
    var r0 = out[0].row - 1, c0 = out[0].col, heads = [];
    for (var k = 1; k <= n; k++) {
      var a = '', b = txt((aoa[r0 - 1] || [])[c0 + k]);
      for (var x = c0 + k; x > c0 && !a; x--) a = txt((aoa[r0 - 2] || [])[x]);   // 병합 머리글은 왼쪽 값을 물려받는다
      heads.push(txt(a + ' ' + b));
    }
    return { cases: out.map(function (o) { return { name: o.name, w: o.w }; }), heads: heads };
  }
  /** 파일에 적혀 있는 Case 별 Life(검산용) */
  function findFileLife(aoa, caseNames) {
    for (var r = 0; r < aoa.length; r++) {
      var row = aoa[r] || [];
      for (var c = 0; c < row.length; c++) {
        if (!/life\s*in\s*hour/i.test(txt(row[c]))) continue;
        var h = aoa[r + 1] || []; if (low(h[c]) !== low(caseNames[0])) continue;
        var chCol = -1; for (var k = c - 1; k >= 0; k--) if (isCh((aoa[r + 2] || [])[k]) && !/^case/i.test(txt((aoa[r + 1] || [])[k]))) { chCol = k; break; }
        if (chCol < 0) continue;
        var out = {};
        for (var q = r + 2; q < aoa.length; q++) { var d = aoa[q] || []; if (!isCh(d[chCol])) break; out[txt(d[chCol])] = caseNames.map(function (_, i) { return num(d[c + i]); }); }
        return out;
      }
    }
    return null;
  }

  /** 통합문서 → 입력 모델. 못 찾은 것은 issues 에 적고 비워 둔다 */
  function parseBook(book) {
    var names = book.names || Object.keys(book.sheets), issues = [], st = null, stSheet = '';
    names.forEach(function (n) { if (!st) { st = findStress(book.sheets[n]); if (st) stSheet = n; } });
    if (!st) return { ok: false, error: 'Max · Min 머리줄이 있는 시나리오별 응력 표를 찾지 못했습니다 — 채널 이름 열 오른쪽에 시나리오마다 「Max | Min」 두 칸이 있어야 합니다.', issues: [] };
    var scen = st.scenarios, n = scen.length, legend = {}, dmg = null, dmgSheet = '', dur = null, cases = { cases: [], heads: [] }, fileLife = null;
    names.forEach(function (sn) {
      var aoa = book.sheets[sn];
      var lg = findLegend(aoa, scen); Object.keys(lg).forEach(function (i) { if (!legend[i]) legend[i] = lg[i]; });
      if (!dmg) { dmg = findBlock(aoa, scen, /damage\s*per\s*hour|시간당\s*손상/i); if (dmg) dmgSheet = sn; }
      if (!dur) dur = findRowLabel(aoa, /^duration\s*time|^지속\s*시간|^계측\s*시간/i, n);
      if (!cases.cases.length) cases = findCases(aoa, n);
    });
    if (cases.cases.length) names.forEach(function (sn) { if (!fileLife) fileLife = findFileLife(book.sheets[sn], cases.cases.map(function (c) { return c.name; })); });
    if (!dmg) issues.push('「Damage per hour」 표(시나리오 이름 머리줄 + 채널 행)를 찾지 못했습니다 — 수명 분석 없이 응력만 보여 줍니다.');
    if (!dur) issues.push('「Duration time」 줄을 찾지 못했습니다 — Total damage 는 계산하지 않습니다.');
    if (!cases.cases.length) issues.push('Case 가중치 표(Case1 · Case2 …)를 찾지 못했습니다 — Case 수명은 계산하지 않습니다.');
    var byName = {}; (dmg ? dmg.rows : []).forEach(function (x) { byName[low(x.name)] = x.v; });
    var channels = st.channels.map(function (ch) {
      var d = byName[low(ch.name)];
      if (dmg && !d) issues.push(ch.name + ' — 손상 표에 이 채널이 없습니다.');
      return { name: ch.name, max: ch.max, min: ch.min, dmg: d || scen.map(function () { return null; }) };
    });
    if (dmg) dmg.rows.forEach(function (x) { if (!st.channels.some(function (c) { return low(c.name) === low(x.name); })) issues.push(x.name + ' — 손상 표에만 있고 응력 표에는 없는 채널입니다(분석에서 뺐습니다).'); });
    channels.forEach(function (ch) {
      ch.max.forEach(function (v, i) { if (v == null) issues.push(ch.name + ' · ' + scen[i] + ' Max 값이 비어 있습니다.'); else if (ch.min[i] != null && ch.min[i] > v) issues.push(ch.name + ' · ' + scen[i] + ' — Min(' + ch.min[i] + ')이 Max(' + v + ')보다 큽니다. 열이 바뀌지 않았는지 확인하세요.'); });
      ch.dmg.forEach(function (v, i) { if (v != null && v < 0) issues.push(ch.name + ' · ' + scen[i] + ' 손상 값이 음수입니다.'); });
    });
    return {
      ok: true, issues: issues, fileLife: fileLife, weightHeads: cases.heads,
      source: { stressSheet: stSheet, damageSheet: dmgSheet },
      scenarios: scen.map(function (s, i) { return { name: s, desc: legend[i] ? legend[i].desc : '', kind: legend[i] ? legend[i].kind : '', durationSec: dur ? dur.vals[i] : null }; }),
      channels: channels, cases: cases.cases
    };
  }

  /* ───────────── 계산 ───────────── */
  function inv(d) { return d == null ? null : d > 0 ? 1 / d : (d === 0 ? Infinity : null); }
  function gradeOf(life, limits) {
    if (life == null) return null;
    var L = limits || DEF_LIMITS;
    return life < L[0] ? GRADES[0] : life < L[1] ? GRADES[1] : life < L[2] ? GRADES[2] : GRADES[3];
  }
  /**
   * model: parseBook 결과(화면에서 가중치 · 지속 시간을 고친 것 포함), opt: { limits:[a,b,c], allow: 허용 응력(선택) }
   * 수식은 올려 주신 엑셀과 같다 —
   *   Life(시나리오) = 1 ÷ Damage per hour,  Total damage = Damage per hour × Duration(s) ÷ 3600,
   *   Case Damage per hour = Σ(시나리오 Damage per hour × Case 가중치),  Case Life = 1 ÷ Case Damage per hour
   */
  function analyze(model, opt) {
    opt = opt || {};
    var limits = (opt.limits || DEF_LIMITS).slice(), S = model.scenarios, C = model.cases, notes = [];
    if (!(limits[0] < limits[1] && limits[1] < limits[2])) { notes.push('위험도 기준이 커지는 순서가 아니라 기본값(20,000 · 50,000 · 100,000 hr)을 썼습니다.'); limits = DEF_LIMITS.slice(); }
    C.forEach(function (c) {
      var s = c.w.reduce(function (a, v) { return a + (v || 0); }, 0);
      if (c.w.some(function (v) { return v == null; })) notes.push(c.name + ' — 가중치가 빈 시나리오가 있습니다(그 시나리오는 0 으로 계산).');
      if (Math.abs(s - 1) > 0.005) notes.push(c.name + ' — 가중치 합이 ' + (Math.round(s * 1000) / 1000) + ' 입니다(1 이 아님). 운전 비율이 맞는지 확인하세요.');
    });
    var rows = model.channels.map(function (ch) {
      var o = { name: ch.name, max: ch.max, min: ch.min, dmg: ch.dmg };
      o.range = ch.max.map(function (v, i) { return v != null && ch.min[i] != null ? v - ch.min[i] : null; });
      o.life = ch.dmg.map(inv);
      o.total = ch.dmg.map(function (d, i) { return d != null && isNum(S[i].durationSec) ? d * S[i].durationSec / 3600 : null; });
      var fin = function (a) { return a.filter(function (v) { return v != null; }); };
      o.peakMax = fin(ch.max).length ? Math.max.apply(null, fin(ch.max)) : null; o.peakMaxS = o.peakMax == null ? -1 : ch.max.indexOf(o.peakMax);
      o.peakMin = fin(ch.min).length ? Math.min.apply(null, fin(ch.min)) : null; o.peakMinS = o.peakMin == null ? -1 : ch.min.indexOf(o.peakMin);
      o.peakRange = fin(o.range).length ? Math.max.apply(null, fin(o.range)) : null; o.peakRangeS = o.peakRange == null ? -1 : o.range.indexOf(o.peakRange);
      o.peakAbs = o.peakMax == null && o.peakMin == null ? null : Math.max(Math.abs(o.peakMax || 0), Math.abs(o.peakMin || 0));
      o.peakAbsSign = o.peakAbs == null ? '' : (Math.abs(o.peakMin || 0) > Math.abs(o.peakMax || 0) ? '압축' : '인장');
      var hasD = ch.dmg.some(function (d) { return d != null; });
      o.caseDmg = C.map(function (c) { return hasD ? ch.dmg.reduce(function (a, d, i) { return a + (d || 0) * (c.w[i] || 0); }, 0) : null; });
      o.caseLife = o.caseDmg.map(inv);
      o.contrib = C.map(function (c, k) { return ch.dmg.map(function (d, i) { return o.caseDmg[k] > 0 ? (d || 0) * (c.w[i] || 0) / o.caseDmg[k] : null; }); });
      var lf = fin(o.caseLife);
      o.minLife = lf.length ? Math.min.apply(null, lf) : null; o.minLifeCase = o.minLife == null ? -1 : o.caseLife.indexOf(o.minLife);
      o.grade = gradeOf(o.minLife, limits);
      if (isNum(opt.allow) && opt.allow > 0 && o.peakAbs) o.sf = opt.allow / o.peakAbs;
      return o;
    });
    var pick = function (key, dir) { var b = null; rows.forEach(function (r) { if (r[key] == null) return; if (!b || (dir > 0 ? r[key] > b[key] : r[key] < b[key])) b = r; }); return b; };
    var top = function (key, dir, n) { return rows.filter(function (r) { return r[key] != null; }).sort(function (a, b) { return dir * (b[key] - a[key]) || (a.name < b.name ? -1 : 1); }).slice(0, n || 10); };
    var maxT = pick('peakMax', 1), maxC = pick('peakMin', -1), maxR = pick('peakRange', 1), minL = pick('minLife', -1);
    // 시나리오 · Case 단위 요약
    var scen = S.map(function (s, i) {
      var d = rows.map(function (r) { return r.dmg[i]; }).filter(function (v) { return v != null; });
      var mx = rows.map(function (r) { return r.max[i]; }).filter(function (v) { return v != null; }), mn = rows.map(function (r) { return r.min[i]; }).filter(function (v) { return v != null; });
      var top1 = null; rows.forEach(function (r) { if (r.dmg[i] != null && (!top1 || r.dmg[i] > top1.dmg[i])) top1 = r; });
      return { name: s.name, desc: s.desc, durationSec: s.durationSec, sumDmg: d.length ? d.reduce(function (a, v) { return a + v; }, 0) : null, maxDmg: d.length ? Math.max.apply(null, d) : null, maxDmgCh: top1 && top1.dmg[i] > 0 ? top1.name : '', maxStress: mx.length ? Math.max.apply(null, mx) : null, minStress: mn.length ? Math.min.apply(null, mn) : null };
    });
    var cases = C.map(function (c, k) {
      var worst = null; rows.forEach(function (r) { if (r.caseLife[k] != null && (!worst || r.caseLife[k] < worst.caseLife[k])) worst = r; });
      var cnt = { red: 0, orange: 0, yellow: 0, green: 0 }; rows.forEach(function (r) { var g = gradeOf(r.caseLife[k], limits); if (g) cnt[g.key]++; });
      return { name: c.name, w: c.w, minLife: worst ? worst.caseLife[k] : null, minLifeCh: worst ? worst.name : '', count: cnt };
    });
    var worstScen = null; scen.forEach(function (s) { if (s.sumDmg != null && (!worstScen || s.sumDmg > worstScen.sumDmg)) worstScen = s; });
    var worstCase = null; cases.forEach(function (c) { if (c.minLife != null && (!worstCase || c.minLife < worstCase.minLife)) worstCase = c; });
    var count = { red: 0, orange: 0, yellow: 0, green: 0, none: 0 }; rows.forEach(function (r) { if (r.grade) count[r.grade.key]++; else count.none++; });
    // 가중치 머리글과 시나리오 설명이 같은 순서인지(엑셀 수식은 열 순서대로 곱한다)
    var heads = model.weightHeads || [], mism = [];
    var norm = function (s) { return txt(s).replace(/\s/g, ''); };
    if (heads.length === S.length && heads.some(Boolean) && S.some(function (s) { return s.desc; })) S.forEach(function (s, i) { if (s.desc && heads[i] && norm(s.desc) !== norm(heads[i])) mism.push(s.name + '(' + s.desc + ') ↔ 가중치 ' + (i + 1) + '번째 열(' + heads[i] + ')'); });
    if (mism.length) notes.push('Case 가중치 표의 열 머리글과 시나리오 설명의 순서가 다릅니다 — ' + mism.join(', ') + '. 엑셀 수식은 열 순서대로(시나리오1 × 첫째 열 …) 곱하므로 이 도구도 그대로 계산했습니다. 가중치가 의도한 시나리오에 걸려 있는지 확인하세요.');
    var descs = {}; S.forEach(function (s) { if (!s.desc) return; (descs[norm(s.desc)] = descs[norm(s.desc)] || []).push(s.name); });
    Object.keys(descs).forEach(function (k) { if (descs[k].length > 1) notes.push('시나리오 설명이 같습니다 — ' + descs[k].join(' · ') + '. 범례를 확인하세요.'); });
    // 파일에 적힌 Case Life 와 다시 계산한 값 비교(가중치를 고치지 않았을 때 의미가 있다)
    var verify = null;
    if (model.fileLife) {
      var diff = [], n = 0;
      rows.forEach(function (r) { var f = model.fileLife[r.name]; if (!f) return; r.caseLife.forEach(function (v, k) { if (f[k] == null || v == null || !isFinite(v)) return; n++; if (Math.abs(v - f[k]) > Math.max(1e-6 * Math.abs(f[k]), 1e-6)) diff.push(r.name + ' ' + C[k].name + ': 파일 ' + Math.round(f[k]) + ' ↔ 계산 ' + Math.round(v)); }); });
      verify = { compared: n, diff: diff };
    }
    return {
      rows: rows, scenarios: scen, cases: cases, limits: limits, notes: notes, verify: verify, count: count, allow: isNum(opt.allow) && opt.allow > 0 ? opt.allow : null,
      maxTension: maxT, maxCompression: maxC, maxRange: maxR, minLife: minL, worstScenario: worstScen, worstCase: worstCase,
      topStress: top('peakAbs', 1, 10), topLife: top('minLife', -1, 10), hasLife: rows.some(function (r) { return r.minLife != null; })
    };
  }

  /* ───────────── 보고서 문장 — 숫자는 계산 결과에서만 가져온다 ───────────── */
  function f0(v) { return v == null ? '없음' : !isFinite(v) ? '∞(손상 없음)' : Math.round(v).toLocaleString('ko-KR'); }
  function f1(v) { return v == null ? '없음' : (Math.round(v * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function sName(res, i) { var s = res.scenarios[i]; return s ? s.name + (s.desc ? '(' + s.desc + ')' : '') : ''; }
  function report(res, meta) {
    meta = meta || {}; var U = meta.unit || 'MPa', out = [], L = res.limits;
    var a = res.maxTension, c = res.maxCompression, r = res.maxRange, m = res.minLife;
    var s1 = [];
    if (a) s1.push('최대 인장 응력은 **' + a.name + '** 의 **' + f1(a.peakMax) + ' ' + U + '** 입니다(' + sName(res, a.peakMaxS) + ').');
    if (c) s1.push('최대 압축 응력은 **' + c.name + '** 의 **' + f1(c.peakMin) + ' ' + U + '** 입니다(' + sName(res, c.peakMinS) + ').');
    if (r) s1.push('응력 범위(Max − Min)가 가장 큰 채널은 **' + r.name + '** 로 **' + f1(r.peakRange) + ' ' + U + '** 입니다(' + sName(res, r.peakRangeS) + ').');
    if (res.allow && a) { var worst = res.rows.filter(function (x) { return x.sf != null; }).sort(function (x, y) { return x.sf - y.sf; })[0]; s1.push('입력한 허용 응력 ' + f1(res.allow) + ' ' + U + ' 기준 최소 안전율은 **' + worst.name + '** 의 **' + (Math.round(worst.sf * 100) / 100) + '** 입니다' + (worst.sf < 1 ? ' — **허용 응력을 넘습니다.**' : '.')); }
    out.push({ title: '최대 응력 분석', lines: s1.length ? s1 : ['응력 값이 없습니다.'] });
    var s2 = [];
    if (!res.hasLife) s2.push('손상(Damage per hour) 또는 Case 가중치가 없어 수명을 계산하지 못했습니다.');
    else {
      s2.push('최소 수명 채널은 **' + m.name + '** 로 **' + f0(m.minLife) + ' hr** 입니다(' + res.cases[m.minLifeCase].name + ').');
      res.cases.forEach(function (k) { s2.push(k.name + ' — 최소 수명 **' + f0(k.minLife) + ' hr**(' + k.minLifeCh + '), Red ' + k.count.red + ' · Orange ' + k.count.orange + ' · Yellow ' + k.count.yellow + ' · Green ' + k.count.green + '.'); });
      if (res.worstCase) s2.push('더 불리한 운전 조건은 **' + res.worstCase.name + '** 입니다.');
      if (res.worstScenario) s2.push('채널 손상 합이 가장 큰 시나리오는 **' + res.worstScenario.name + (res.worstScenario.desc ? '(' + res.worstScenario.desc + ')' : '') + '** 입니다(시간당 손상 합 ' + res.worstScenario.sumDmg.toExponential(2) + (res.worstScenario.maxDmgCh ? ', 최대 채널 ' + res.worstScenario.maxDmgCh : '') + ').');
      var k0 = m.minLifeCase, ct = m.contrib[k0], bi = -1; ct.forEach(function (v, i) { if (v != null && (bi < 0 || v > ct[bi])) bi = i; });
      if (bi >= 0) s2.push(m.name + ' 의 손상은 ' + sName(res, bi) + ' 가 **' + Math.round(ct[bi] * 100) + '%** 를 차지합니다(' + res.cases[k0].name + ' 기준).');
      var zero = res.rows.filter(function (x) { return x.minLife === Infinity; }).map(function (x) { return x.name; });
      if (zero.length) s2.push('손상이 0 으로 계측된 채널: ' + zero.join(', ') + ' — 수명은 ∞ 로 표시했습니다(엑셀에서는 #DIV/0!).');
    }
    out.push({ title: '최소 수명 분석', lines: s2 });
    out.push({ title: '취약 채널 TOP10', table: true, lines: [] });
    var s4 = [], n = res.count;
    if (res.hasLife) {
      s4.push('위험도 기준(가장 불리한 Case 의 수명): Red < ' + f0(L[0]) + ' hr ≤ Orange < ' + f0(L[1]) + ' hr ≤ Yellow < ' + f0(L[2]) + ' hr ≤ Green.');
      s4.push('전체 ' + res.rows.length + '개 채널 중 **Red ' + n.red + ' · Orange ' + n.orange + ' · Yellow ' + n.yellow + ' · Green ' + n.green + '**' + (n.none ? ' · 판정 불가 ' + n.none : '') + '.');
      s4.push(n.red ? '**Red 채널이 있어 목표 수명을 만족한다고 볼 수 없습니다.** 해당 부위의 구조 검토가 필요합니다.' : n.orange ? 'Red 는 없으나 Orange 채널이 있어 개선 검토가 필요합니다.' : n.yellow ? 'Red · Orange 는 없고 Yellow 채널은 다음 계측에서 추이를 확인합니다.' : '모든 채널이 Green 입니다.');
    } else s4.push('수명 자료가 없어 응력 크기만으로는 건전성 등급을 매기지 않았습니다.');
    out.push({ title: '구조 건전성 평가', lines: s4 });
    var pr = res.topLife.filter(function (x) { return x.grade && x.grade.key !== 'green'; }).map(function (x, i) {
      var k = x.minLifeCase, ct = x.contrib[k], bi = -1; ct.forEach(function (v, j) { if (v != null && (bi < 0 || v > ct[bi])) bi = j; });
      return (i + 1) + '순위 **' + x.name + '** — ' + x.grade.label + '(' + x.grade.ko + '), 수명 ' + f0(x.minLife) + ' hr, 최대 응력 ' + f1(x.peakAbs) + ' ' + U + '(' + x.peakAbsSign + ')' + (bi >= 0 ? ', 주 기여 ' + sName(res, bi) + ' ' + Math.round(ct[bi] * 100) + '%' : '');
    });
    out.push({ title: '개선 우선순위', lines: pr.length ? pr : [res.hasLife ? '개선 우선 대상(Red · Orange · Yellow)이 없습니다.' : '수명 자료가 없어 우선순위를 정하지 않았습니다.'] });
    var end = [];
    if (res.hasLife) end.push((n.red ? '**' + m.name + ' 등 Red ' + n.red + '개 채널**을 먼저 검토해야 합니다.' : n.orange ? 'Orange ' + n.orange + '개 채널의 개선 검토를 권합니다.' : '현재 계측 조건에서 수명 기준을 벗어난 채널은 없습니다.') + ' 최소 수명은 ' + f0(m.minLife) + ' hr(' + m.name + ', ' + res.cases[m.minLifeCase].name + ')입니다.');
    if (a) end.push('응력은 ' + a.name + '(인장 ' + f1(a.peakMax) + ' ' + U + ')' + (c ? ' · ' + c.name + '(압축 ' + f1(c.peakMin) + ' ' + U + ')' : '') + ' 가 가장 큽니다.');
    end.push('이 판정은 올린 계측값과 Case 가중치를 그대로 계산한 결과이며, 재질 · 용접 등급 · 목표 수명에 따른 최종 판단은 담당 엔지니어가 합니다.');
    out.push({ title: '종합 결론', lines: end });
    return out;
  }

  /* ───────────── 엑셀 내려받기 ───────────── */
  function exportSheets(res, meta) {
    var U = (meta && meta.unit) || 'MPa', S = res.scenarios, C = res.cases, x = function (v) { return v == null ? '' : !isFinite(v) ? '∞' : v; };
    var a = [['채널'].concat([].concat.apply([], S.map(function (s) { return [s.name + ' Max', s.name + ' Min', s.name + ' Stress range']; }))).concat(['최대 인장(' + U + ')', '최대 압축(' + U + ')', '최대 범위', '절댓값 최대', '구분'].concat(res.allow ? ['안전율'] : []))];
    res.rows.forEach(function (r) { a.push([r.name].concat([].concat.apply([], S.map(function (_, i) { return [x(r.max[i]), x(r.min[i]), x(r.range[i])]; }))).concat([x(r.peakMax), x(r.peakMin), x(r.peakRange), x(r.peakAbs), r.peakAbsSign].concat(res.allow ? [x(r.sf)] : []))); });
    var b = [['채널'].concat(S.map(function (s) { return s.name + ' Damage/hr'; })).concat(S.map(function (s) { return s.name + ' Life(hr)'; })).concat(S.map(function (s) { return s.name + ' Total damage'; })).concat(C.map(function (c) { return c.name + ' Damage/hr'; })).concat(C.map(function (c) { return c.name + ' Life(hr)'; })).concat(['최소 수명(hr)', '기준 Case', '위험도'])];
    res.rows.forEach(function (r) { b.push([r.name].concat(r.dmg.map(x)).concat(r.life.map(x)).concat(r.total.map(x)).concat(r.caseDmg.map(x)).concat(r.caseLife.map(x)).concat([x(r.minLife), r.minLifeCase >= 0 ? C[r.minLifeCase].name : '', r.grade ? r.grade.label : ''])); });
    var c = [['순위', '채널', '절댓값 최대(' + U + ')', '구분', '시나리오']].concat(res.topStress.map(function (r, i) { return [i + 1, r.name, r.peakAbs, r.peakAbsSign, S[r.peakAbsSign === '압축' ? r.peakMinS : r.peakMaxS].name]; }));
    c.push([]); c.push(['순위', '채널', '최소 수명(hr)', '기준 Case', '위험도']);
    res.topLife.forEach(function (r, i) { c.push([i + 1, r.name, x(r.minLife), C[r.minLifeCase].name, r.grade.label]); });
    var d = [['보고서']]; report(res, meta).forEach(function (s) { d.push([]); d.push(['■ ' + s.title]); s.lines.forEach(function (l) { d.push([l.replace(/\*\*/g, '')]); }); });
    d.push([]); d.push(['계산 조건']); S.forEach(function (s, i) { d.push([s.name, s.desc, 'Duration(s)', x(s.durationSec)].concat(C.map(function (k) { return k.name + ' 가중치 ' + x(k.w[i]); }))); });
    d.push(['위험도 기준(hr)', res.limits.join(' / ')]); res.notes.forEach(function (n) { d.push(['알림', n]); });
    return { '응력': a, '손상·수명': b, 'TOP10': c, '보고서': d };
  }

  /* ───────────── 예제(가짜 값) — 올려 주신 엑셀과 같은 배치 ───────────── */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function sampleBook() {
    var R = rng(2616), scen = ['시나리오1', '시나리오2', '시나리오3', '시나리오4'], desc = ['부하 요철', '무부하 요철', '부하 기본', '무부하 기본'], sev = [1.25, 0.8, 1.0, 0.55], dur = [180, 210, 330, 240], nCh = 15;
    var E = function (n) { var a = []; for (var i = 0; i < n; i++) a.push(''); return a; };
    var s1 = []; for (var i = 0; i < 8; i++) s1.push(E(11));
    scen.forEach(function (s, i) { s1[2 + i][8] = s; s1[2 + i][9] = desc[i]; s1[2 + i][10] = '사이클'; });
    var h1 = E(11), h2 = E(11); scen.forEach(function (s, i) { h1[2 + 2 * i] = s; h2[2 + 2 * i] = 'Max'; h2[3 + 2 * i] = 'Min'; }); s1.push(h1); s1.push(h2);
    var s2 = []; for (var j = 0; j < 9; j++) s2.push(E(19));
    scen.forEach(function (s, i) { s2[1 + i][16] = s; s2[1 + i][17] = desc[i]; s2[1 + i][18] = '사이클'; });
    s2[2][2] = '부하'; s2[2][4] = '무부하'; s2[3][2] = '요철'; s2[3][3] = '요철'; s2[3][4] = '기본'; s2[3][5] = '기본';   // 예제는 머리글을 시나리오 순서(부하 요철 · 무부하 요철 · 부하 기본 · 무부하 기본)에 맞춰 둔다
    s2[2][3] = ''; s2[4] = ['', 'Case1', 0.25, 0.25, 0.25, 0.25].concat(E(13)); s2[5] = ['', 'Case2', 0.4, 0.1, 0.4, 0.1].concat(E(13));
    s2[2][2] = '부하 요철'; s2[2][3] = '무부하 요철'; s2[2][4] = '부하 기본'; s2[2][5] = '무부하 기본'; s2[3][2] = s2[3][3] = s2[3][4] = s2[3][5] = '';
    var r9 = E(19); scen.forEach(function (s, i) { r9[2 + i] = s; }); r9[14] = 'Damage per hour'; r9[16] = 'Life in hour'; s2.push(r9);
    var r10 = E(19); r10[1] = 'Duration time'; dur.forEach(function (d, i) { r10[2 + i] = d; }); r10[14] = 'Case1'; r10[15] = 'Case2'; r10[16] = 'Case1'; r10[17] = 'Case2'; s2.push(r10);
    var r11 = E(19); r11[1] = 'Duration hour'; dur.forEach(function (d, i) { r11[2 + i] = d / 3600; }); s2.push(r11);
    s2.push(E(19)); var r13 = E(19); r13[2] = 'Damage per hour'; r13[6] = 'Life in hour'; s2.push(r13);
    var r14 = E(19); scen.forEach(function (s, i) { r14[2 + i] = s; r14[6 + i] = s; }); s2.push(r14);
    var rows = [];
    for (var c = 1; c <= nCh; c++) {
      var amp = 30 + R() * 230, bias = R() < 0.5 ? -1 : 1, quiet = c === 5 || c === 11;
      var mx = [], mn = [], dm = [];
      sev.forEach(function (k) {
        var hi = amp * k * (0.75 + R() * 0.5), lo = amp * k * (0.2 + R() * 0.5);
        var M = Math.round((bias > 0 ? hi : lo * 0.3) * 10) / 10, m = -Math.round((bias > 0 ? lo * 0.3 : hi) * 10) / 10, rg = M - m;
        mx.push(M); mn.push(m); dm.push(quiet || rg < 45 ? 0 : +(Math.pow(rg / 100, 3.2) * 1.5e-6 * (0.7 + R() * 0.6)).toPrecision(3));
      });
      rows.push({ name: 'Ch' + c, mx: mx, mn: mn, dm: dm });
    }
    rows.forEach(function (x) { var a = E(11); a[1] = x.name; x.mx.forEach(function (v, i) { a[2 + 2 * i] = v; a[3 + 2 * i] = x.mn[i]; }); s1.push(a); });
    rows.forEach(function (x, k) {
      var a = E(19); a[1] = x.name; x.dm.forEach(function (v, i) { a[2 + i] = v; a[6 + i] = v > 0 ? 1 / v : '#DIV/0!'; });
      s2.push(a);
    });
    // 오른쪽 Case 블록(11행부터) — 파일에 적힌 값(검산 대상)
    rows.forEach(function (x, k) {
      var t = s2[11 + k]; t[13] = x.name;
      [[0.25, 0.25, 0.25, 0.25], [0.4, 0.1, 0.4, 0.1]].forEach(function (w, ci) { var d = x.dm.reduce(function (a, v, i) { return a + v * w[i]; }, 0); t[14 + ci] = d; t[16 + ci] = d > 0 ? 1 / d : '#DIV/0!'; });
    });
    s2.push(E(19)); s2.push(E(19)); var tt = E(19); tt[2] = 'Total damage'; s2.push(tt); var th = E(19); scen.forEach(function (s, i) { th[2 + i] = s; }); s2.push(th);
    rows.forEach(function (x) { var a = E(19); a[1] = x.name; x.dm.forEach(function (v, i) { a[2 + i] = v * dur[i] / 3600; }); s2.push(a); });
    return { names: ['MaxMin stress', 'Damage per hour'], sheets: { 'MaxMin stress': s1, 'Damage per hour': s2 }, merges: { 'MaxMin stress': scen.map(function (_, i) { return { s: { r: 8, c: 2 + 2 * i }, e: { r: 8, c: 3 + 2 * i } }; }), 'Damage per hour': [{ s: { r: 12, c: 2 }, e: { r: 12, c: 5 } }, { s: { r: 12, c: 6 }, e: { r: 12, c: 9 } }, { s: { r: 8, c: 14 }, e: { r: 8, c: 15 } }, { s: { r: 8, c: 16 }, e: { r: 8, c: 17 } }] } };
  }

  /* ---------- v1.1 그래프 보기 도우미(화면이 쓰는 순수 함수) ---------- */
  /** 막대 위 숫자. mode: 'int' | 'd1' | 'd2' | 'life'(천 단위 쉼표 정수) | 'exp'(지수 2자리). 없음 → '', 무한 → '∞' */
  function fmtLabel(v, mode) {
    if (v == null || (typeof v === 'number' && isNaN(v))) return '';
    if (!isFinite(v)) return '∞';
    if (mode === 'exp') return v === 0 ? '0' : v.toExponential(2);
    var d = mode === 'd1' ? 1 : mode === 'd2' ? 2 : 0;
    return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  /** 채널 고르기. opt: { sel:[이름]|null, q:검색어, key:function(row)→값|null, worst:'low'|'high', topN, sort:'none'|'asc'|'desc' }
   *  topN 은 key 가 나쁜 쪽(worst) N개. sort 가 none 이면 원래 채널 순서를 지킨다. key 가 없는 채널은 정렬에서 뒤로. */
  function pickChannels(rows, opt) {
    opt = opt || {};
    var q = low(opt.q), out = rows.filter(function (r) { return (!opt.sel || opt.sel.indexOf(r.name) >= 0) && (!q || low(r.name).indexOf(q) >= 0); });
    var key = opt.key, cmp = function (dir) { return function (a, b) { var x = key(a), y = key(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return x === y ? 0 : (x < y ? -dir : dir); }; };
    if (key && opt.topN > 0) {
      var keep = out.filter(function (r) { return key(r) != null; }).slice().sort(cmp(opt.worst === 'high' ? -1 : 1)).slice(0, opt.topN);
      out = out.filter(function (r) { return keep.indexOf(r) >= 0; });
    }
    if (key && (opt.sort === 'asc' || opt.sort === 'desc')) out = out.slice().sort(cmp(opt.sort === 'asc' ? 1 : -1));
    return out;
  }
  /** 쪽 나누기. per 가 0 이하면 한 쪽에 전부. page 는 범위 안으로 맞춘다. */
  function paginate(list, per, page) {
    per = Math.floor(per) > 0 ? Math.floor(per) : (list.length || 1);
    var pages = Math.max(1, Math.ceil(list.length / per)); page = Math.min(Math.max(0, page | 0), pages - 1);
    return { items: list.slice(page * per, page * per + per), pages: pages, page: page, per: per, total: list.length };
  }

  return {
    DEF_LIMITS: DEF_LIMITS, GRADES: GRADES, num: num, parseBook: parseBook, findStress: findStress, findBlock: findBlock, findCases: findCases,
    analyze: analyze, gradeOf: gradeOf, report: report, exportSheets: exportSheets, sampleBook: sampleBook, f0: f0, f1: f1, fmtLabel: fmtLabel, pickChannels: pickChannels, paginate: paginate
  };
});
