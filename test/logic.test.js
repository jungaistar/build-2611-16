/* 계산 규칙 고정 — node test/logic.test.js. 손으로 셀 수 있는 작은 표와 대조한다. */
'use strict';
var S = require('../js/stress.js');
var passed = 0, failed = 0;
function ok(c, label, d) { if (c) passed++; else { failed++; console.log('  X ' + label + (d != null ? '\n      ' + d : '')); } }
function eq(g, w, label) { ok(JSON.stringify(g) === JSON.stringify(w), label, '기대: ' + JSON.stringify(w) + '  실제: ' + JSON.stringify(g)); }
function near(g, w, label) { ok(typeof g === 'number' && Math.abs(g - w) <= 1e-9 * Math.max(1, Math.abs(w)), label, '기대: ' + w + '  실제: ' + g); }

/* 손으로 만든 표 — 채널 3 · 시나리오 2 */
var s1 = [[], ['', '', '', '', '', 'S1', '부하', '사이클'], ['', '', '', '', '', 'S2', '무부하', '사이클'], [],
  ['', 'S1', '', 'S2', ''], ['', 'Max', 'Min', 'Max', 'Min'], ['A', 100, -50, 80, -20], ['B', 10, -200, 5, -150], ['C', 30, -30, '', -10], ['', '', '', '', ''], ['메모', 1, 2, 3, 4]];
var s2 = [['', '부하', '무부하'], ['Case1', 0.5, 0.5], ['Case2', 0.9, 0.1], [], ['', 'S1', 'S2', '', '', 'Life in hour', ''], ['Duration time', 360, 720, '', '', 'Case1', 'Case2'],
  ['', 'Damage per hour', '', '', 'A', 1 / 0.00003, 1 / 0.000038], ['', 'S1', 'S2', '', 'B', 99999, 1 / 0.000093], ['A', 0.00004, 0.00002, '', 'C', '#DIV/0!', '#DIV/0!'], ['B', 0.0001, 0.00003], ['C', 0, 0]];
var book = { names: ['응력', '손상'], sheets: { '응력': s1, '손상': s2 } };
var m = S.parseBook(book);
ok(m.ok && m.source.stressSheet === '응력' && m.source.damageSheet === '손상', '시트 이름과 무관하게 표를 찾는다');
eq(m.scenarios, [{ name: 'S1', desc: '부하', kind: '사이클', durationSec: 360 }, { name: 'S2', desc: '무부하', kind: '사이클', durationSec: 720 }], '시나리오 이름 · 범례 · Duration');
eq(m.channels.map(function (c) { return [c.name, c.max, c.min, c.dmg]; }), [['A', [100, 80], [-50, -20], [0.00004, 0.00002]], ['B', [10, 5], [-200, -150], [0.0001, 0.00003]], ['C', [30, null], [-30, -10], [0, 0]]], '채널 값 — 빈 칸은 null, 0 은 0, 표 밖 행은 읽지 않는다');
eq(m.cases, [{ name: 'Case1', w: [0.5, 0.5] }, { name: 'Case2', w: [0.9, 0.1] }], 'Case 가중치');
eq(m.weightHeads, ['부하', '무부하'], '가중치 표의 열 머리글');
ok(/C · S2 Max 값이 비어/.test(m.issues.join()), '빈 응력 값을 알린다');
eq([S.num('#DIV/0!'), S.num(''), S.num(0), S.num('1,234.5'), S.num('1e-5'), S.num('abc')], [null, null, 0, 1234.5, 0.00001, null], '숫자 읽기 — 오류 값 · 빈 칸은 null');

var r = S.analyze(m), A = r.rows[0], B = r.rows[1], C = r.rows[2];
eq([A.range, A.peakMax, A.peakMaxS, A.peakMin, A.peakRange], [[150, 100], 100, 0, -50, 150], '응력 범위 · 최대 인장 · 최대 압축');
eq([B.peakAbs, B.peakAbsSign, A.peakAbsSign], [200, '압축', '인장'], '절댓값 최대와 인장/압축 구분');
near(A.life[0], 25000, 'Life(시나리오) = 1 ÷ Damage per hour');
near(A.total[0], 0.00004 * 360 / 3600, 'Total damage = Damage per hour × Duration ÷ 3600');
near(A.caseDmg[0], 0.00003, 'Case1 손상 = Σ 손상 × 가중치'); near(A.caseDmg[1], 0.000038, 'Case2 손상');
near(A.caseLife[0], 1 / 0.00003, 'Case Life = 1 ÷ Case 손상'); near(B.caseLife[1], 1 / 0.000093, 'B Case2 Life');
eq([C.caseDmg, C.caseLife, C.minLife, C.grade.key], [[0, 0], [Infinity, Infinity], Infinity, 'green'].map(function (x) { return x; }), '손상 0 → 수명 ∞ · Green(#DIV/0! 대신)');
near(A.contrib[1][0], 0.00004 * 0.9 / 0.000038, '시나리오 기여율');
eq([r.maxTension.name, r.maxCompression.name, r.maxRange.name, r.minLife.name, r.minLife.minLifeCase], ['A', 'B', 'B', 'B', 1], '최대 응력 · 최소 수명 채널');
eq([r.worstScenario.name, r.worstCase.name], ['S1', 'Case2'], 'Worst Scenario(손상 합) · Worst Case(최소 수명)');
eq(r.topStress.map(function (x) { return x.name; }), ['B', 'A', 'C'], 'Stress 순위(절댓값)');
eq(r.topLife.map(function (x) { return x.name; }), ['B', 'A', 'C'], 'Life 순위(짧은 순, ∞ 는 맨 뒤)');
eq([S.gradeOf(19999.9).key, S.gradeOf(20000).key, S.gradeOf(49999).key, S.gradeOf(50000).key, S.gradeOf(99999).key, S.gradeOf(100000).key, S.gradeOf(Infinity).key, S.gradeOf(null)], ['red', 'orange', 'orange', 'yellow', 'yellow', 'green', 'green', null], '위험도 경계값');
eq([B.grade.key, A.grade.key, r.count], ['red', 'orange', { red: 1, orange: 1, yellow: 0, green: 1, none: 0 }], '채널 등급 = 가장 불리한 Case 의 수명');
eq(S.analyze(m, { limits: [5000, 8000, 9000] }).count, { red: 0, orange: 0, yellow: 0, green: 3, none: 0 }, '위험도 기준을 바꾸면 등급이 바뀐다');
ok(/기본값/.test(S.analyze(m, { limits: [9, 5, 1] }).notes.join()), '기준이 커지는 순서가 아니면 기본값을 쓰고 알린다');
ok(r.verify.compared === 4 && r.verify.diff.length === 1 && /^B Case1: 파일 99,?999/.test(r.verify.diff[0].replace(',', '')), '파일에 적힌 Case Life 와 다르면 짚는다(오류 값 칸은 비교 안 함)', JSON.stringify(r.verify));
var sf = S.analyze(m, { allow: 150 });
near(sf.rows[1].sf, 0.75, '허용 응력을 넣으면 안전율 = 허용 ÷ 절댓값 최대'); ok(r.rows[1].sf === undefined, '허용 응력이 없으면 안전율을 만들지 않는다');

/* 가중치 · 범례 확인 */
var m2 = JSON.parse(JSON.stringify(m)); m2.cases[0].w = [0.5, 0.3]; m2.weightHeads = ['무부하', '부하'];
var r2 = S.analyze(m2);
ok(/가중치 합이 0.8/.test(r2.notes.join()), '가중치 합이 1 이 아니면 알린다');
ok(/순서가 다릅니다/.test(r2.notes.join()) && /S1\(부하\) ↔ 가중치 1번째 열\(무부하\)/.test(r2.notes.join()), '가중치 머리글과 시나리오 설명의 순서가 다르면 알린다(계산은 엑셀처럼 열 순서)');
near(r2.rows[0].caseDmg[0], 0.00004 * 0.5 + 0.00002 * 0.3, '알림과 별개로 계산은 열 순서대로');
var m3 = JSON.parse(JSON.stringify(m)); m3.scenarios[1].desc = '부하';
ok(/설명이 같습니다 — S1 · S2/.test(S.analyze(m3).notes.join()), '시나리오 설명이 겹치면 알린다');

/* 빠진 표 */
var only = S.parseBook({ names: ['a'], sheets: { a: s1 } }), ro = S.analyze(only);
ok(only.ok && only.issues.length === 4 && !ro.hasLife && ro.maxTension.name === 'A' && ro.count.none === 3, '응력 표만 있어도 응력 분석은 한다(수명은 없음)');
ok(/수명을 계산하지 못했습니다/.test(S.report(ro)[1].lines[0]) && /등급을 매기지 않았습니다/.test(S.report(ro)[3].lines[0]), '수명 자료가 없으면 보고서가 지어내지 않는다');
ok(!S.parseBook({ names: ['x'], sheets: { x: [['아무', '표'], [1, 2]] } }).ok, 'Max · Min 표가 없으면 읽지 않는다');
var sw = JSON.parse(JSON.stringify(s1)); sw[6] = ['A', -50, 100, 80, -20];
ok(/Min\(100\)이 Max\(-50\)보다 큽니다/.test(S.parseBook({ names: ['a', 'b'], sheets: { a: sw, b: s2 } }).issues.join()), 'Max · Min 이 뒤바뀐 행을 알린다');
var dmis = JSON.parse(JSON.stringify(s2)); dmis[10] = ['Z', 0.1, 0.1];
var pm = S.parseBook({ names: ['a', 'b'], sheets: { a: s1, b: dmis } });
ok(/C — 손상 표에 이 채널이 없습니다/.test(pm.issues.join()) && /Z — 손상 표에만/.test(pm.issues.join()), '두 표의 채널이 어긋나면 알린다');

/* 보고서 · 엑셀 */
var rep = S.report(r, { unit: 'MPa' });
eq(rep.map(function (x) { return x.title; }), ['최대 응력 분석', '최소 수명 분석', '취약 채널 TOP10', '구조 건전성 평가', '개선 우선순위', '종합 결론'], '보고서 6절');
ok(/\*\*A\*\* 의 \*\*100\.0 MPa\*\*/.test(rep[0].lines[0]) && /\*\*B\*\* 의 \*\*-200\.0 MPa\*\*/.test(rep[0].lines[1]), '최대 응력 문장의 숫자');
ok(/\*\*B\*\* 로 \*\*10,753 hr\*\*/.test(rep[1].lines[0]) && /C — 수명은 ∞/.test(rep[1].lines.join('\n')), '최소 수명 문장 · 손상 0 채널');
ok(/Red 1 · Orange 1 · Yellow 0 · Green 1/.test(rep[3].lines[1]) && /Red 채널이 있어/.test(rep[3].lines[2]), '건전성 평가');
ok(rep[4].lines.length === 2 && /^1순위 \*\*B\*\* — Red/.test(rep[4].lines[0]) && /주 기여 S1\(부하\) 97%/.test(rep[4].lines[0]), '개선 우선순위(Green 제외) · 주 기여 시나리오');
var sh = S.exportSheets(r, { unit: 'MPa' });
eq(Object.keys(sh), ['응력', '손상·수명', 'TOP10', '보고서'], '엑셀 4시트');
ok(sh['응력'].length === 4 && sh['손상·수명'][3].indexOf('∞') > 0 && sh['손상·수명'][0].length === 1 + 2 * 5 + 3, '엑셀 행 · ∞ 표기');

/* 예제 — 올려 주신 엑셀과 같은 배치 */
var sm = S.parseBook(S.sampleBook()), sr = S.analyze(sm);
ok(sm.ok && sm.issues.length === 0 && sm.channels.length === 15 && sm.scenarios.length === 4 && sm.cases.length === 2, '예제: 채널 15 · 시나리오 4 · Case 2, 읽기 알림 없음');
ok(sr.verify.diff.length === 0 && sr.verify.compared > 20 && sr.notes.length === 0, '예제: 파일 값과 재계산 일치, 알림 없음');
ok(sr.count.red >= 1 && sr.count.green >= 3 && sr.rows.filter(function (x) { return x.minLife === Infinity; }).length === 2, '예제: 등급이 고루 나오고 손상 0 채널 2개');
var before = JSON.stringify(sm); S.analyze(sm, { allow: 300 }); ok(JSON.stringify(sm) === before, '계산이 입력을 바꾸지 않는다');

console.log('계산 규칙 테스트: 통과 ' + passed + ' · 실패 ' + failed);
process.exit(failed ? 1 : 0);
