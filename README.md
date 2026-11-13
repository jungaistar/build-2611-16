# build-2611-16 · 응력 계측 결과 후처리 대시보드

생성형 AI 업무자동화 전문가과정 **2차수** 수강생 프로젝트 16 — 기획 노현석. (04번 「계측 데이터 처리 · 3D 그래프」와 같은 기획자의 두 번째 과제)

**바로 쓰기: https://build-2611-16.jobability.co.kr/**

응력 계측 결과 엑셀(시나리오별 Max/Min Stress · Damage per hour · Case 가중치 · Duration time)을 올리면
Stress · Life 대시보드, 취약 채널 TOP10, 위험도 평가, 6절 보고서를 만듭니다. 파일은 브라우저 안에서만 처리합니다.

| 파일 | 역할 |
|---|---|
| `js/stress.js` | 계산 엔진 — 표 찾기 · 손상/수명 계산 · 순위 · 위험도 · 검산 · 보고서 문장 · 엑셀 시트. **계산은 전부 여기** |
| `js/app.js` | 화면(조건 표 · SVG 막대 그래프 · 표 · 보고서 · 인쇄) |
| `samples/stress_sample.xlsx` | 가짜 예제(입력 양식) — `Stress.sampleBook()` 과 같은 내용 |
| `test/logic.test.js` · `test/smoke.browser.js` | 계산 규칙 · 화면 연기 테스트 |
| `CLAUDE.md` | 작업 지시서 + 기획 프롬프트 |

예제 데이터는 실제 계측값이 아닙니다. 기획자가 보낸 엑셀의 값은 저장소에 넣지 않았습니다(배치와 수식만 반영).

## 기획서 · 버전

- https://build-2611-16.jobability.co.kr/plan.html — 워드 판 `docs/기획서/`
- 원본 `docs/plan.json` → 생성기 `build-2611-00/tools/plandoc/make_plan.py`
