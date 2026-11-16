# Daily Tech Report — Repository Agent Guidelines

이 문서는 저장소 전체에 적용되는 아키텍처 원칙과 AI 협업 가드레일입니다.  
하위 디렉터리(`reports/`, `scripts/`) 작업 시에는 해당 폴더의 `AGENTS.md`도 함께 확인합니다.

## 1. 아키텍처 불변 원칙 (Anti-Fragility)
- **Zero-Build / Pure Web**: `index.html`, `app.js`, `style.css`는 순수 HTML/CSS/Vanilla JS만 유지합니다. npm, 번들러, 외부 JS 프레임워크를 추가하지 마세요.
- **단순성 우선 (Avoid Overfitting)**: 기존 헬퍼와 네이티브 웹 표준으로 해결 가능한 문제에 불필요한 추상화나 복잡한 우회 코드를 만들지 마세요.
- **단일 진실 공급원 (Single Source of Truth)**: 리포트 목록은 `reports/index.json`, 리포트 콘텐츠 규칙은 `REPORT_RULES.md`를 기준으로 삼습니다.

## 2. 작업 프로세스
1. **범위 확인 (Plan First)**: 수정 전 관련 파일과 기존 패턴을 먼저 읽고 최소 변경 단위를 정합니다.
2. **구현 (Minimal Diff)**: 요청 범위를 벗어나는 리팩토링이나 기존 주석·문서 훼손을 피합니다.
3. **결정적 검증 (Verification Gate)**: 작업 완료 전 반드시 `python3 scripts/verify_report.py`로 구조·인덱스 무결성을 확인합니다.
4. **자가 리뷰 (Self-Review)**: 작성한 코드/마크업에 중복 로직, 깨진 태그, 불필요한 복잡도가 없는지 한 번 더 점검합니다.

## 3. 완료 보고 형식 (Mental Model 유지)
작업 종료 시 사용자에게 다음 3가지를 간결히 요약 보고합니다.
- **무엇을 왜 바꿨는가** (변경 목적과 핵심 내용)
- **어디가 바뀌었는가** (수정·생성된 파일 경로)
- **무엇으로 검증했는가** (실행한 검증 명령과 실제 결과)
