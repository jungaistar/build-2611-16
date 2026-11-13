// 로그인 설정 — 이 파일 한 곳만 바꾸면 된다(생성: build-2611-00/tools/kit/apply-kit.mjs, 대문 문구 출처 docs/plan.json).
// 내 Supabase 로 옮길 때: url · anonKey 를 내 프로젝트 값으로, 카카오를 설정하지 않았으면 kakao: false. 안내 = docs/내_깃허브로_옮기기.md
// prefix 는 supabase/auth.sql 의 표 이름 앞부분과 같아야 한다.
window.AUTH_CONFIG = {
  "url": "https://hcmgdztsgjvzcyxyayaj.supabase.co",
  "anonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjbWdkenRzZ2p2emN5eHlheWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzU4ODcsImV4cCI6MjA4NzAxMTg4N30.gznaPzY1l8qDAPsEyYNR9KS7f7VqS3xaw-_2HTSwSZw",
  "prefix": "build261116",
  "kakao": true,
  "idleMinutes": 30,
  "localBypass": true,
  "board": true,
  "site": {
    "title": "응력 계측 결과 후처리 대시보드",
    "summary": "응력 계측 결과 엑셀(시나리오별 Max/Min Stress · Damage per hour · Case 가중치 · Duration time)을 올리면 응력 · 수명 대시보드와 취약 채널 TOP10, 위험도 평가, 6절 보고서를 만드는 브라우저 도구입니다. 계산식은 엑셀과 같고 파일에 적힌 값과 다시 계산한 값을 대조합니다.",
    "course": "생성형 AI 업무자동화 전문가과정 · 2차수",
    "features": [
      {
        "name": "엑셀 읽기",
        "desc": "표를 위치가 아니라 내용(머리글)으로 찾아 채널 · 시나리오 수가 달라도 읽습니다."
      },
      {
        "name": "계산 조건",
        "desc": "Case 가중치 · Duration time · 위험도 기준 · 허용 응력을 바꾸면 바로 다시 계산합니다."
      },
      {
        "name": "Stress Dashboard",
        "desc": "시나리오별 Max · Min, 범위 비교, 최대 응력 채널, Top10."
      },
      {
        "name": "Life Dashboard",
        "desc": "Case 별 수명과 비교, Top10, Worst Channel · Scenario · Case."
      },
      {
        "name": "검산 · 알림",
        "desc": "파일의 Case Life 와 재계산 대조, 가중치 합 · 가중치 머리글 순서 · 범례 중복 · Max/Min 뒤바뀜 알림."
      },
      {
        "name": "보고서",
        "desc": "6절 보고서, 인쇄(PDF) · 엑셀."
      }
    ],
    "steps": [
      "엑셀 올리기",
      "표 찾기",
      "계산",
      "순위 · 등급",
      "검산 · 알림",
      "대시보드"
    ],
    "flow": [
      {
        "step": "엑셀 올리기",
        "desc": "시트 전부 읽기"
      },
      {
        "step": "표 찾기",
        "desc": "Max/Min · Damage · Case · Duration · 범례"
      },
      {
        "step": "계산",
        "desc": "범위 · Life · Total damage · Case 손상 · Case Life"
      },
      {
        "step": "순위 · 등급",
        "desc": "Top10 · Worst · 위험도"
      },
      {
        "step": "검산 · 알림",
        "desc": "파일 값 대조, 입력 확인"
      },
      {
        "step": "대시보드",
        "desc": "SVG 그래프 · 표"
      }
    ],
    "goals": [
      "보내 주신 엑셀 배치를 그대로 읽습니다(시트 이름 · 표 위치 · 채널 수 · 시나리오 수는 달라도 됨).",
      "Stress Dashboard 6종과 Life Dashboard 5종을 한 화면에 그립니다.",
      "최대 응력 채널 · 최소 수명 채널 · Worst Scenario · Worst Case · 위험도를 자동으로 뽑습니다."
    ],
    "screen": "docs/img/screen.png",
    "plan": "plan.html",
    "report": "report.html",
    "home": true,
    "guide": {
      "screens": [],
      "data": [
        {
          "name": "시나리오",
          "fields": "이름 · 설명(범례) · Duration time(s)"
        },
        {
          "name": "채널",
          "fields": "이름 · 시나리오별 Max · Min · Damage per hour"
        },
        {
          "name": "Case",
          "fields": "이름 · 시나리오별 가중치"
        },
        {
          "name": "계산 결과",
          "fields": "범위 · 시나리오 Life · Total damage · Case 손상 · Case Life · 기여율 · 최소 수명 · 위험도 · (선택) 안전율"
        }
      ],
      "rules": [
        "표는 위치가 아니라 내용으로 찾습니다. Max · Min 표가 없으면 읽지 않고, 다른 표가 없으면 그 분석만 빼고 알립니다.",
        "빈 칸 · 오류 값(#DIV/0!)은 「값 없음」입니다. 0 과 구분합니다.",
        "Life = 1 ÷ Damage per hour. 손상이 0 이면 ∞(손상 없음)로 두고 Green 으로 봅니다.",
        "Case Damage per hour = Σ(시나리오 Damage per hour × 가중치), 엑셀 수식과 같이 열 순서대로 곱합니다. 가중치 머리글과 시나리오 설명 순서가 다르면 계산은 그대로 하고 알립니다.",
        "채널 위험도는 가장 불리한 Case 의 수명으로 매깁니다. 경계값은 Red < a ≤ Orange < b ≤ Yellow < c ≤ Green.",
        "Stress Top10 은 절댓값 최대 기준, Life Top10 은 수명이 짧은 순입니다.",
        "Worst Scenario = 전 채널 시간당 손상 합이 가장 큰 시나리오, Worst Case = 최소 수명이 가장 짧은 Case.",
        "보고서의 숫자는 계산 결과에서만 가져옵니다. 수명 자료가 없으면 등급 · 우선순위를 쓰지 않습니다.",
        "허용 응력을 넣지 않으면 안전율을 만들지 않습니다."
      ],
      "limits": [
        "기획자가 만든 Claude 아티팩트는 공개 링크가 열리지 않아 화면을 보지 못했습니다. 패들릿의 프롬프트와 엑셀 구조만으로 만들었습니다.",
        "보고서 문장은 규칙으로 만듭니다. AI 가 원인 분석이나 개선안을 쓰지 않습니다.",
        "Word 파일로는 내보내지 않습니다. 인쇄(PDF)와 엑셀입니다.",
        "S-N 선도 · Rainflow 로 손상을 직접 계산하지 않습니다. 계측 소프트웨어가 낸 Damage per hour 를 입력으로 씁니다.",
        "엑셀 안의 그림 · 차트(Gage Map 등)는 읽지 않습니다."
      ],
      "users": [
        "구조내구 · 계측 담당 엔지니어",
        "보고를 받는 팀장 · 경영진"
      ],
      "flow": [
        {
          "step": "엑셀 올리기",
          "desc": "시트 전부 읽기"
        },
        {
          "step": "표 찾기",
          "desc": "Max/Min · Damage · Case · Duration · 범례"
        },
        {
          "step": "계산",
          "desc": "범위 · Life · Total damage · Case 손상 · Case Life"
        },
        {
          "step": "순위 · 등급",
          "desc": "Top10 · Worst · 위험도"
        },
        {
          "step": "검산 · 알림",
          "desc": "파일 값 대조, 입력 확인"
        },
        {
          "step": "대시보드",
          "desc": "SVG 그래프 · 표"
        },
        {
          "step": "보고서",
          "desc": "6절 문장 · 인쇄 · 엑셀"
        }
      ]
    },
    "landing": {
      "company": {
        "name": "HD현대사이트솔루션",
        "en": "HD HYUNDAI SITE SOLUTION",
        "logo": "images/logo.png",
        "logoH": 24
      },
      "slides": [
        {
          "image": "images/slide-1.jpg",
          "tone": "dark"
        },
        {
          "image": "images/slide-2.jpg",
          "tone": "dark"
        },
        {
          "image": "images/slide-3.jpg",
          "tone": "dark"
        }
      ],
      "heroMode": "slide"
    }
  }
};
