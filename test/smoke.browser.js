/* 브라우저에 실제로 띄워 본다 — node test/smoke.browser.js (playwright 가 없으면 건너뜀) */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
var chromium;
try { chromium = require('playwright').chromium; }
catch (e) { try { chromium = require('playwright-core').chromium; } catch (e2) { console.log('playwright 가 없어 화면 연기 테스트를 건너뜁니다.'); process.exit(0); } }
var XLSX = require('../lib/xlsx.full.min.js'), S = require('../js/stress.js');
var ROOT = path.join(__dirname, '..');
var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
var srv = http.createServer(function (q, s) { var p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(p, function (e, b) { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); s.end(b); }); });
var passed = 0, failed = 0;
function ok(c, label, d) { if (process.env.SMOKE_V) console.log((c ? '  o ' : '  x ') + label); if (c) passed++; else { failed++; console.log('  X ' + label + (d != null ? '  ' + d : '')); } }
var count = function (pg, sel) { return pg.$$eval(sel, function (t) { return t.length; }); };
srv.listen(0, async function () {
  var base = 'http://127.0.0.1:' + srv.address().port + '/';
  var br = await chromium.launch(); var ctx = await br.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  var pg = await ctx.newPage(), errs = []; pg.on('pageerror', function (e) { errs.push(e.message); });
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b16-smoke-'));
  try {
    await pg.goto(base);
    ok(await pg.isHidden('#s-stress') && await pg.isHidden('#s-report'), '처음엔 결과가 숨어 있다');
    await pg.click('#btn-sample'); await pg.waitForSelector('#report h3');
    ok(/채널 15개 · 시나리오 4개 · Case 2개/.test(await pg.textContent('#load-ok')), '예제 읽기');
    ok(/모두 같습니다/.test(await pg.textContent('#verify')), '파일 값과 재계산 검산');
    ok(await count(pg, '#summary .stat') === 6, '자동 분석 요약 6장');
    ok(await count(pg, '#c-max svg rect.bar') === 60 && await count(pg, '#c-min svg rect.bar') === 60, 'Max · Min 그래프(15채널 × 4시나리오)');
    ok(await count(pg, '#c-env svg rect') === 30, 'Max/Min 비교(채널마다 인장 · 압축 막대)');
    ok(await count(pg, '#top-stress tr') === 11 && await count(pg, '#top-life tr') === 11, 'Stress · Life Top10');
    ok(await count(pg, '#c-cases svg') === 2 && await count(pg, '#c-cases svg line.lim') >= 4 && await count(pg, '#c-cases svg rect.bar') === 30, 'Case 별 수명 그래프(기준선) — Case 마다 한 장');
    ok(/∞/.test(await pg.textContent('#c-cases')) && /Worst Scenario/.test(await pg.textContent('#worst')), '손상 0 채널은 ∞, Worst 정리');
    ok(await count(pg, '#all-stress tr') === 17 && await count(pg, '#all-life tr') === 16 && await count(pg, '#report h3') === 6, '전체 표 · 보고서 6절');
    // ---------- v1.1 그래프 창 ----------
    var sel = function (id, k, v) { return pg.selectOption('#ctl-' + id + ' select[data-k="' + k + '"]', v); };
    ok(await count(pg, '#all-stress tr:first-child th.grp') === 4 && /Stress range/.test(await pg.textContent('#all-stress')) && !/최대 범위/.test(await pg.textContent('#s-table')), '(v1.1) 표 — 시나리오 이름이 한 줄 위, 「Stress range」');
    ok(await count(pg, '#all-dmg tr') === 17 && (await pg.$$eval('#all-life td', function (a) { return a.filter(function (x) { return /Damage 0 \(검증 필요\)/.test(x.textContent); }).length; })) === 2, '(v1.1) 손상 표 · 수명 표를 따로, 손상 0 채널은 「검증 필요」');
    ok(await pg.$$eval('#win-st svg.big, #win-lf svg.big, #win-dm svg.big', function (a) { var w = a[0].getBoundingClientRect().width; return a.length >= 7 && a.every(function (x) { return Math.abs(x.getBoundingClientRect().width - w) < 2 && x.getBoundingClientRect().left === a[0].getBoundingClientRect().left; }); }), '(v1.1) 그래프는 한 줄에 하나씩 크게');
    await pg.uncheck('#ctl-st input[data-k="hide"][data-i="1"]');
    ok(await count(pg, '#c-max rect.bar') === 45 && await count(pg, '#c-env svg rect') === 30, '(v1.1) 시나리오 숨기기 — Max 45개, Max/Min 비교는 그대로');
    await sel('st', 'mode', 'split');
    ok(await count(pg, '#c-max svg') === 3 && await count(pg, '#c-min svg') === 3 && await count(pg, '#c-max rect.bar') === 45, '(v1.1) 시나리오마다 따로 — 켜 둔 3개만');
    await pg.check('#ctl-st input[data-k="hide"][data-i="1"]'); await sel('st', 'mode', 'combined');
    ok(await count(pg, '#c-max text.lbl') === 0, '(v1.1) 값 표시는 처음엔 꺼져 있다');
    await sel('st', 'label', 'd2');
    var lb = await pg.$$eval('#c-max text.lbl', function (a) { return a.map(function (x) { return x.textContent; }); });
    ok(lb.length === 60 && lb.every(function (t) { return /^-?[\d,]+\.\d\d$/.test(t); }), '(v1.1) 값 표시 소수점 2자리', lb.slice(0, 3).join(' '));
    await sel('st', 'label', 'int');
    ok((await pg.$$eval('#c-max text.lbl', function (a) { return a.every(function (x) { return /^-?[\d,]+$/.test(x.textContent); }); })) && await count(pg, '#c-env text.lbl') === 30, '(v1.1) 값 표시 정수 · Max/Min 비교에도');
    await sel('st', 'type', 'line');
    ok(await count(pg, '#c-max polyline') === 4 && await count(pg, '#c-max circle') === 60 && await count(pg, '#c-max rect.bar') === 0, '(v1.1) 꺾은선 그래프');
    await sel('st', 'type', 'bar'); await sel('st', 'label', 'off');
    await pg.fill('#ctl-st input[data-k="per"]', '6'); await pg.dispatchEvent('#ctl-st input[data-k="per"]', 'change');
    ok(await count(pg, '#c-max rect.bar') === 24 && /1 \/ 3 쪽/.test(await pg.textContent('#win-st .pager')), '(v1.1) 한 화면 채널 수 6 → 3쪽');
    await pg.click('#win-st .pager [data-act="next"]'); await pg.click('#win-st .pager [data-act="next"]');
    ok(await count(pg, '#c-max rect.bar') === 12 && /3 \/ 3 쪽/.test(await pg.textContent('#win-st .pager')) && await pg.isDisabled('#win-st .pager [data-act="next"]'), '(v1.1) 쪽 넘기기 — 마지막 쪽은 3채널');
    await pg.fill('#ctl-st input[data-k="per"]', '15'); await pg.dispatchEvent('#ctl-st input[data-k="per"]', 'change');
    await pg.fill('#ctl-st input[data-k="q"]', 'ch1');
    ok(await count(pg, '#c-max rect.bar') === 28 && await pg.evaluate(function () { return document.activeElement && document.activeElement.dataset.k === 'q'; }), '(v1.1) 채널 검색 — Ch1 · Ch10~15, 입력 칸은 그대로');
    await pg.fill('#ctl-st input[data-k="q"]', '');
    await pg.click('#ctl-st .chpick summary'); await pg.uncheck('#ctl-st input[data-k="sel"][value="Ch2"]');
    ok(await count(pg, '#c-max rect.bar') === 56 && /14 \/ 15개/.test(await pg.textContent('#ctl-st .chpick summary')) && await pg.isVisible('#ctl-st .chlist'), '(v1.1) 채널 선택 — 하나 빼면 14개, 목록은 열린 채');
    await pg.click('#ctl-st .chpick [data-act="all"]');
    ok(await count(pg, '#c-max rect.bar') === 60, '(v1.1) 전체 선택');
    // Life
    await sel('lf', 'top', '5'); await sel('lf', 'sort', 'asc'); await sel('lf', 'label', 'on');
    var lf = await pg.$$eval('#c-cases .win:nth-child(2) text.lbl', function (a) { return a.map(function (x) { return +x.textContent.replace(/,/g, ''); }); });
    var top5 = await pg.$$eval('#top-life tr td:nth-child(2)', function (a) { return a.slice(0, 5).map(function (x) { return x.textContent; }).sort().join(); });
    var cats5 = await pg.$$eval('#c-cases .win:nth-child(1) rect.bar', function (a) { return a.map(function (x) { return x.dataset.ch; }).sort().join(); });
    ok(lf.length === 5 && lf.every(function (v, i) { return !i || lf[i - 1] <= v; }) && cats5 === top5, '(v1.1) Life Top 5 · 오름차순 · 숫자는 15,891 처럼', JSON.stringify(lf));
    await sel('lf', 'top', '0'); await sel('lf', 'sort', 'none'); await sel('lf', 'label', 'off');
    await sel('lf', 'scale', 'log');
    ok(/\(로그\)/.test(await pg.textContent('#c-cases')) && (await pg.$$eval('#c-cases .win:first-child text.ax', function (a) { return a.some(function (x) { return x.textContent === '100,000'; }); })), '(v1.1) 로그 축 — 눈금은 100,000 처럼');
    await sel('lf', 'scale', 'lin'); await sel('lf', 'by', 'scen');
    ok(await count(pg, '#c-cases svg') === 4 && /시나리오별 수명/.test(await pg.textContent('#c-cases')) && await count(pg, '#ctl-lf input[data-k="hide"]') === 4, '(v1.1) 시나리오별 수명 평가');
    await sel('lf', 'mode', 'combined');
    ok(await count(pg, '#c-cases svg') === 1 && await count(pg, '#c-cases rect.bar') === 60, '(v1.1) 시나리오를 한 그래프에 겹쳐 비교');
    await sel('lf', 'by', 'case'); await sel('lf', 'mode', 'split');
    var tipTxt = await pg.$eval('#c-cases rect.bar[data-ch="Ch1"] title', function (x) { return x.textContent; });
    ok(/Channel: Ch1/.test(tipTxt) && /Case: Case1/.test(tipTxt) && /Life: [\d,]+ hr/.test(tipTxt) && /Damage: /.test(tipTxt) && /Scenario 기여/.test(tipTxt), '(v1.1) 막대에 올리면 Channel · Case · Life · Damage · Scenario', tipTxt.replace(/\n/g, ' / '));
    // Damage
    ok(await count(pg, '#c-dmg svg') === 2 && /\(로그\)/.test(await pg.textContent('#c-dmg')) && await pg.isVisible('#s-dmg'), '(v1.1) Damage Dashboard — Case 마다 한 장, 처음엔 로그 축');
    await sel('dm', 'by', 'scen'); await sel('dm', 'mode', 'combined'); await sel('dm', 'top', '5');
    ok(await count(pg, '#c-dmg svg') === 1 && await pg.$$eval('#c-dmg text.ax', function (a) { return a.filter(function (x) { return /^Ch/.test(x.textContent); }).length; }) === 5, '(v1.1) Damage — 시나리오별 · Top 5');
    await sel('dm', 'by', 'case'); await sel('dm', 'mode', 'split'); await sel('dm', 'top', '0');
    // 채널을 누르면 Stress 로
    await pg.click('#c-cases rect.bar[data-ch="Ch7"]');
    ok(/Ch7/.test(await pg.textContent('#ctl-st .linked')) && await count(pg, '#c-max rect.bar') === 4 && await count(pg, '#c-env svg rect') === 2, '(v1.1) Life 막대를 누르면 Stress Dashboard 가 그 채널만');
    await pg.click('#ctl-st .linked [data-act="all"]');
    ok(await count(pg, '#c-max rect.bar') === 60 && await count(pg, '#ctl-st .linked') === 0, '(v1.1) 전체 채널 보기로 되돌리기');
    var rep0 = await pg.textContent('#report');
    ok(/최대 인장 응력은/.test(rep0) && /개선 우선순위/.test(rep0) && !/\*\*/.test(rep0), '보고서 문장(굵은 글씨로 바뀜)');
    // 조건 고치기
    var life0 = await pg.textContent('#top-life');
    await pg.fill('input[data-w="1:0"]', '0.9'); await pg.dispatchEvent('input[data-w="1:0"]', 'change');
    ok(await pg.textContent('#top-life') !== life0 && /가중치 합이 1.5/.test(await pg.textContent('#res-notes')) && /고친 상태/.test(await pg.textContent('#verify')), '가중치를 고치면 다시 계산 · 합이 1 이 아니면 알림');
    await pg.click('#btn-reset');
    ok(await pg.textContent('#top-life') === life0, '엑셀 값으로 되돌리기');
    var sum0 = await pg.textContent('#summary');
    await pg.fill('#lim0', '1000'); await pg.dispatchEvent('#lim0', 'change');
    ok(await pg.textContent('#summary') !== sum0 && /Red 0/.test(await pg.textContent('#summary')), '위험도 기준을 바꾸면 등급이 바뀐다');
    await pg.fill('#lim0', '20000'); await pg.dispatchEvent('#lim0', 'change');
    await pg.fill('#allow', '250'); await pg.dispatchEvent('#allow', 'change');
    ok(/안전율/.test(await pg.textContent('#top-stress')) && /허용 응력을 넘습니다/.test(await pg.textContent('#report')), '허용 응력 → 안전율 · 초과 알림');
    // 내려받은 예제를 다시 올린다(파일 경로 전체 확인)
    var d1 = await Promise.all([pg.waitForEvent('download'), pg.click('#btn-sample-xlsx')]); var f1 = path.join(tmp, 'sample.xlsx'); await d1[0].saveAs(f1);
    await pg.setInputFiles('#file', f1); await pg.waitForFunction(function () { return /sample\.xlsx/.test(document.querySelector('#load-ok').textContent); });
    ok(/모두 같습니다/.test(await pg.textContent('#verify')) && await count(pg, '#all-stress tr') === 17 && await count(pg, '#all-life tr') === 16, '내려받은 예제 엑셀을 다시 올려도 같은 결과');
    var d2 = await Promise.all([pg.waitForEvent('download'), pg.click('#btn-export')]); var f2 = path.join(tmp, 'out.xlsx'); await d2[0].saveAs(f2);
    ok(XLSX.read(fs.readFileSync(f2), { type: 'buffer' }).SheetNames.join() === '응력,손상·수명,TOP10,보고서', '결과 엑셀 4시트');
    // 응력 표만 있는 파일 · 표가 없는 파일
    var w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet(S.sampleBook().sheets['MaxMin stress']), 'only'); var f3 = path.join(tmp, 'only.xlsx'); fs.writeFileSync(f3, XLSX.write(w, { type: 'buffer', bookType: 'xlsx' }));
    await pg.setInputFiles('#file', f3); await pg.waitForFunction(function () { return /only\.xlsx/.test(document.querySelector('#load-ok').textContent); });
    ok(await pg.isHidden('#life-body') && /수명을 계산하지 못했습니다/.test(await pg.textContent('#life-none')) && await count(pg, '#c-max svg rect.bar') === 60, '손상 표가 없으면 응력만(수명은 지어내지 않음)');
    var w2 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w2, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'x'); var f4 = path.join(tmp, 'bad.xlsx'); fs.writeFileSync(f4, XLSX.write(w2, { type: 'buffer', bookType: 'xlsx' }));
    await pg.setInputFiles('#file', f4); await pg.waitForSelector('#load-err');
    ok(await pg.isHidden('#s-stress'), '표를 못 찾으면 결과를 숨기고 이유를 알린다');
    await pg.click('#btn-sample'); await pg.waitForSelector('#report h3');
    for (var wd of [390, 768]) { await pg.setViewportSize({ width: wd, height: 800 }); var over = await pg.evaluate(function () { return document.documentElement.scrollWidth - document.documentElement.clientWidth; }); ok(over <= 1, wd + 'px 에서 가로 넘침 없음', over); }
    for (var page of ['guide.html', 'plan.html']) { var rr = await pg.goto(base + page); ok(rr.status() === 200, page + ' 열림'); }
    ok(errs.length === 0, '페이지 오류 없음', errs.join(' | '));
  } catch (e) { failed++; console.log('  X 중단: ' + e.message.split('\n')[0]); if (errs.length) console.log('    ' + errs.join(' | ')); }
  await br.close(); srv.close();
  console.log('화면 연기 테스트: 통과 ' + passed + ' · 실패 ' + failed);
  process.exit(failed ? 1 : 0);
});
