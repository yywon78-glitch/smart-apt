# Smart Apt 프로젝트 공통 작업 지침

## ⚠️ 파일 수정 전 필수 백업 (예외 없음)

**어떤 파일이든 수정 전에 반드시 아래 순서를 지킨다.**

```
1. 백업
   cp public/pages/파일명.html  public/pages/versions/파일명_v버전_날짜.html
   cp public/js/파일명.js       public/js/versions/파일명_v버전_날짜.js

2. 버전 증가
   파일 내 <meta name="prog-version" content="X.X.X"> 올리기
   또는 JS 파일 상단 주석의 @version 올리기

3. 수정 시작
```

단 한 줄 수정, 태그 하나 제거라도 동일하게 적용한다.
백업 없이 파일을 수정하는 것은 **금지**다.

---

## 백업 대상 및 위치

| 대상 | 백업 위치 |
|------|-----------|
| `public/pages/*.html` | `public/pages/versions/파일명_v버전_날짜.html` |
| `public/js/*.js` | `public/js/versions/파일명_v버전_날짜.js` |
| `public/index.html` | `public/pages/versions/index_v버전_날짜.html` |
| `docs/*.html` | `docs/versions/파일명_v버전_날짜.html` |

---

## 현재 파일 버전

| 파일 | 버전 |
|------|------|
| index.html | v2.0.0 |
| 대시보드.html | v1.1.0 |
| 홈인벤토리.html | v5.1.0 |
| 홈인벤토리등록.html | v6.7.0 |
| 홈인벤토리구성도.html | v7.0.0 |
| 평면도.html | v1.4.0 |
| api-local.js | v1.0.0 |
| google-auth.js | v1.0.0 |
| drive.js | v1.1.0 |
| docs/db_to_local_plan.html | v3.0.0 |
| docs/revenue_model.html | v1.0.0 |

---

## 프로젝트 구조

- **SPA 쉘**: `public/index.html` (Google 로그인 → 메뉴 → 화면 동적 로드)
- **화면 파일**: `public/pages/*.html` (partial HTML, 무수정)
- **인증**: `public/js/google-auth.js` (Google OAuth 2.0)
- **Drive**: `public/js/drive.js` (개인 Google Drive 읽기/쓰기)
- **API**: `public/js/api-local.js` (fetch 인터셉터 — /api/* → Drive)
- **백업**: `public/pages/versions/`, `public/js/versions/`

## 서비스 목표

- GitHub Pages 정적 호스팅
- Google OAuth 로그인 → 개인별 독립 데이터
- 데이터는 각자 본인 Google Drive / SmartApt / db.json 에 저장
- 이미지는 Google Drive / SmartApt / fp_*.png 에 저장
- PC·핸드폰·다른 PC Google Drive 자동 동기화
- 운영자 비용 없음 (개인 Drive 15GB 사용)
- 기존 HTML 5개 무수정 (fetch 인터셉터 패턴)

## Google Cloud 설정 (최초 1회)

1. console.cloud.google.com → 새 프로젝트
2. Google Drive API 활성화
3. OAuth 2.0 클라이언트 ID 발급 (웹 애플리케이션)
4. `public/js/google-auth.js` 의 `_SMART_CLIENT_ID` 값 교체
5. 승인된 JavaScript 출처에 GitHub Pages URL 추가
