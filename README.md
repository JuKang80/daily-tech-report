# Daily Tech Report

> 매일 오전·오후 업데이트되는 한국어 테크 큐레이션: **GitHub Trending**, **GeekNews**, **AI · 신경과학 최신 논문** 요약

## 🌐 웹사이트 바로가기

- **데일리 리포트 메인**: https://jukang80.github.io/daily-tech-report/
- **즐겨찾기 모음**: https://jukang80.github.io/daily-tech-report/favorites.html
- **리포트 인덱스 (JSON)**: https://jukang80.github.io/daily-tech-report/reports/index.json

## 구성

1. **GitHub Trending Top 20**: 오늘의 인기 저장소 구체적 설명 및 실무 활용 방안
2. **GeekNews (`news.hada.io`) 인기 소식**: 주요 기술 뉴스·토론 핵심 요약 및 시사점
3. **최신 논문 (AI · 신경과학)**: Hugging Face Daily Papers, arXiv(`cs.AI`, `cs.LG`, `cs.CL`, `q-bio.NC`), bioRxiv, PubMed 초록 기반 요약

## 아키텍처 및 검증

- **Zero-Build / Pure Web**: `index.html`, `favorites.html`, `app.js`, `favorites.js`, `style.css`는 순수 HTML/CSS/Vanilla JS로 동작합니다.
- **리포트 인덱스 및 링크 검증**:
  ```bash
  python3 scripts/verify_report.py --check-index
  python3 scripts/verify_report.py reports/<YYYY-MM-DD>-<am|pm>.html
  ```
