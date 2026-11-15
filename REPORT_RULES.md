# Daily Tech Report 작성 규칙

## 1. GitHub Trending
- 특정 관심 토픽/언어로 제한하지 않고, 주제 무관하게 흥미롭고 새로운 저장소를 고르게 소개한다.
- **중복/기노출 제외**: 최근 리포트에 이미 등장한 저장소는 `python3 scripts/verify_report.py --seen-repos 14`로 확인해 우선 제외한다.
- **신규 급상승 혼합**: 일반 GitHub Trending 외에 최근 14~30일 내 생성(`created:>YYYY-MM-DD`) + 스타 순 검색 결과를 적절히 섞어 이미 너무 유명한 대형 저장소만 반복되지 않도록 한다.
- **초대형 저장소 편중 방지**: 누적 스타 수가 과도하게 큰 기존 유명 저장소는 가급적 뒤로 미루거나 제외하고, 최근 성장률이 높은 저장소를 우선한다.

## 2. 최신 논문 (AI · 신경과학)
- 기억이나 검색 스니펫으로 URL을 추정하지 않고 **공식 API**로 메타데이터와 링크를 직접 조회한다.
  - **arXiv**: `export.arxiv.org/api/query` 결과의 `id` 기반 (`https://arxiv.org/abs/...`)
  - **bioRxiv / medRxiv**: `api.biorxiv.org/details/biorxiv/{start}/{end}` 결과의 정확한 `doi` 기반
  - **PubMed**: NCBI E-utilities (`esearch.fcgi` / `esummary.fcgi`)로 확인된 `PMID` 기반 (`https://pubmed.ncbi.nlm.nih.gov/{pmid}/`)
- 리포트 저장 후 반드시 링크 검증을 실행한다:
  ```bash
  python3 scripts/verify_report.py reports/<파일명>.html
  ```
