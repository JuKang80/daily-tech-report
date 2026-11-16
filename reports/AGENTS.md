# `reports/` — 리포트 작성 및 인덱스 관리 규칙

이 폴더에서 리포트 HTML 프래그먼트와 `index.json`을 생성·수정할 때 적용되는 규칙입니다.  
세부 큐레이션 기준과 카테고리 개수는 루트의 `../REPORT_RULES.md`를 따릅니다.

## 1. 파일 명명 및 인덱스 규격
- **파일명**: `YYYY-MM-DD-<am|pm>.html` (오전 `am`, 오후 `pm`)
- **`reports/index.json`**: 새 리포트 메타데이터(`id`, `date`, `slot`, `title`, `path`)를 배열 **최상단**에 추가합니다.
- `sitemap.xml` 및 `llms.txt`의 최신 리포트 링크도 함께 동기화합니다.

## 2. 필수 HTML 프래그먼트 구조
- 완전한 HTML 문서(`<html>`, `<head>`, `<body>`)가 아닌 **프래그먼트**로 작성합니다.
- 3개의 `.section-heading`과 각 섹션의 `.hn-list`를 유지합니다.
- 모든 항목(`.hn-item`)은 다음 클래스를 빠짐없이 포함해야 합니다:
  - `.hn-title-row` > `.hn-rank`, `a.hn-link`, `.hn-tag`
  - `.hn-body` > `.hn-desc` (GitHub/GeekNews는 `.hn-use` 포함)

## 3. 중복 방지 및 검증 게이트
- 작성 전 기존 노출 항목을 확인해 중복을 피합니다:
  ```bash
  python3 scripts/verify_report.py --seen-repos 14
  python3 scripts/verify_report.py --seen-papers 14
  ```
- 저장 후 반드시 구조·인덱스·링크 검증을 통과해야 합니다:
  ```bash
  python3 scripts/verify_report.py --check-index
  python3 scripts/verify_report.py reports/<파일명>.html
  ```
