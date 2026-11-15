# Daily Tech Report 작성 규칙

## 0. 섹션별 개수 (총 30개)
1. **GitHub Trending**: 10개
2. **GeekNews**: 10개
3. **최신 논문**: 10개 (AI 5개 + 신경과학 5개)

## 1. GitHub Trending (10개)
- 특정 관심 토픽/언어로 제한하지 않고, 주제 무관하게 흥미롭고 새로운 저장소를 고르게 소개한다.
- **중복/기노출 제외**: 최근 리포트에 이미 등장한 저장소는 `python3 scripts/verify_report.py --seen-repos 14`로 확인해 우선 제외한다.
- **신규 급상승 혼합**: 일반 GitHub Trending 외에 최근 14~30일 내 생성(`created:>YYYY-MM-DD`) + 스타 순 검색 결과를 적절히 섞어 이미 너무 유명한 대형 저장소만 반복되지 않도록 한다.
- **초대형 저장소 편중 방지**: 누적 스타 수가 과도하게 큰 기존 유명 저장소는 가급적 뒤로 미루거나 제외하고, 최근 성장률이 높은 저장소를 우선한다.

## 2. GeekNews (10개)
- `news.hada.io` 인기 소식 상위 10개를 요약 및 활용 포인트와 함께 정리한다.

## 3. 최신 논문 (AI 5개 + 신경과학 5개)
- 기억이나 검색 스니펫으로 URL을 추정하지 않고 **공식 API**로 메타데이터와 링크를 직접 조회한다.
  - **arXiv**: `export.arxiv.org/api/query` 결과의 `id` 기반 (`https://arxiv.org/abs/...`)
  - **bioRxiv / medRxiv**: `api.biorxiv.org/details/biorxiv/{start}/{end}` 결과의 정확한 `doi` 기반
  - **PubMed**: NCBI E-utilities (`esearch.fcgi` / `esummary.fcgi`)로 확인된 `PMID` 기반 (`https://pubmed.ncbi.nlm.nih.gov/{pmid}/`)
- 리포트 저장 후 반드시 링크 검증을 실행한다:
  ```bash
  python3 scripts/verify_report.py reports/<파일명>.html
  ```

## 4. 항목별 상세 토글 (`자세히`) 마크업
모든 항목의 `.hn-body` 내부에 기본 요약(`.hn-desc`), 활용 포인트(`.hn-use`)와 함께 접힌 상태의 상세 설명(`.hn-detail`)을 3~4개 불릿으로 포함한다.
- **GitHub**: 주요 기능, 기술 스택/아키텍처, 주목할 포인트
- **GeekNews**: 글의 핵심 논점, 배경/맥락, 주요 반응
- **논문**: 문제 정의, 핵심 방법론, 주요 실험 결과/수치

```html
<details class="hn-detail">
  <summary>자세히</summary>
  <div class="hn-detail-body">
    <ul>
      <li><strong>핵심:</strong> ...</li>
      <li><strong>구조/방식:</strong> ...</li>
      <li><strong>포인트:</strong> ...</li>
    </ul>
  </div>
</details>
```
