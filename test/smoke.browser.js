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
    ok(await count(pg, '#c-cases svg') === 2 && await count(pg, '#c-cases svg line.lim') >= 4 && await count(pg, '#c-cmp svg rect.bar') === 30, 'Case 별 수명 그래프(기준선) · Case 비교');
    ok(/∞/.test(await pg.textContent('#c-cases')) && /Worst Scenario/.test(await pg.textContent('#worst')), '손상 0 채널은 ∞, Worst 정리');
    ok(await count(pg, '#all tr') === 16 && await count(pg, '#report h3') === 6, '전체 표 · 보고서 6절');
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
    ok(/모두 같습니다/.test(await pg.textContent('#verify')) && await count(pg, '#all tr') === 16, '내려받은 예제 엑셀을 다시 올려도 같은 결과');
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
