(function () {
  const STORAGE_KEY = 'dtr-favorites-v1';

  const CATEGORY_LABELS = {
    all: '전체',
    github: 'GitHub',
    geeknews: 'GeekNews',
    paper: '논문',
    other: '기타',
  };

  function loadFavorites() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(items) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch {
      window.alert('브라우저 저장 공간이 부족하거나 차단되어 즐겨찾기를 저장하지 못했습니다.');
      return false;
    }
  }

  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || '';
  }

  function getItemKey(url, reportId, title) {
    if (url) return url;
    return `${reportId || 'report'}::${title || ''}`;
  }

  function deriveCategory(sectionTitle) {
    const text = (sectionTitle || '').toLowerCase();
    if (text.includes('github')) return 'github';
    if (text.includes('geeknews')) return 'geeknews';
    if (text.includes('논문') || text.includes('arxiv')) return 'paper';
    return 'other';
  }

  function extractItemData(itemEl, reportMeta) {
    const rankEl = itemEl.querySelector('.hn-rank');
    const linkEl = itemEl.querySelector('.hn-link');
    const tagEl = itemEl.querySelector('.hn-tag');
    const descEl = itemEl.querySelector('.hn-desc');
    const useEl = itemEl.querySelector('.hn-use');
    const detailEl = itemEl.querySelector('.hn-detail-body');

    const title = linkEl ? linkEl.textContent.trim() : '';
    const url = linkEl ? (linkEl.getAttribute('href') || '').trim() : '';
    const column = itemEl.closest('.report-column');
    const heading = column
      ? (column.querySelector('.section-toggle-title') || column.querySelector('.section-heading'))
      : null;
    const section = heading ? heading.textContent.trim() : (itemEl.dataset.favSection || '');
    const reportId = (reportMeta && reportMeta.id) || itemEl.dataset.reportId || '';
    const reportDate = (reportMeta && reportMeta.date) || itemEl.dataset.reportDate || '';
    const reportSlot = (reportMeta && reportMeta.slot) || itemEl.dataset.reportSlot || '';

    return {
      key: itemEl.dataset.favKey || getItemKey(url, reportId, title),
      title,
      url,
      tag: tagEl ? tagEl.textContent.trim() : '',
      rank: rankEl ? rankEl.textContent.trim() : '',
      desc: descEl ? descEl.textContent.trim() : '',
      useText: useEl ? useEl.textContent.trim() : '',
      useHtml: useEl ? useEl.innerHTML : '',
      detailHtml: detailEl ? detailEl.innerHTML : '',
      section,
      category: itemEl.dataset.favCategory || deriveCategory(section),
      reportId,
      reportDate,
      reportSlot,
      savedAt: Date.now(),
    };
  }

  function isFavorited(key) {
    return loadFavorites().some((entry) => entry.key === key);
  }

  function toggleFavorite(itemData) {
    const items = loadFavorites();
    const index = items.findIndex((entry) => entry.key === itemData.key);
    let favorited;
    if (index >= 0) {
      items.splice(index, 1);
      favorited = false;
    } else {
      items.unshift(itemData);
      favorited = true;
    }
    if (!saveFavorites(items)) {
      return !favorited;
    }
    updateNavBadge(items.length);
    return favorited;
  }

  function removeFavorite(key) {
    const items = loadFavorites().filter((entry) => entry.key !== key);
    if (saveFavorites(items)) {
      updateNavBadge(items.length);
    }
    return items;
  }

  function clearFavorites() {
    if (saveFavorites([])) {
      updateNavBadge(0);
    }
  }

  function updateNavBadge(count) {
    const badge = document.getElementById('favorites-nav-count');
    if (!badge) return;
    const total = typeof count === 'number' ? count : loadFavorites().length;
    badge.textContent = String(total);
    badge.hidden = total === 0;
  }

  function updateFavButtonState(btn, favorited) {
    if (!btn) return;
    btn.classList.toggle('is-favorited', favorited);
    btn.setAttribute('aria-pressed', String(favorited));
    if (btn.id === 'modal-fav-btn') {
      btn.textContent = favorited ? '★ 즐겨찾기됨' : '☆ 즐겨찾기';
      btn.setAttribute('aria-label', favorited ? '즐겨찾기 해제' : '즐겨찾기 추가');
    } else {
      btn.textContent = favorited ? '★' : '☆';
      btn.setAttribute('aria-label', favorited ? '즐겨찾기 해제' : '즐겨찾기 추가');
      btn.title = favorited ? '즐겨찾기 해제' : '즐겨찾기에 추가';
    }
  }

  function decorateReportItems(container, reportMeta) {
    const favKeys = new Set(loadFavorites().map((entry) => entry.key));
    const items = container.querySelectorAll('.hn-item');

    items.forEach((itemEl) => {
      const linkEl = itemEl.querySelector('.hn-link');
      const title = linkEl ? linkEl.textContent.trim() : '';
      const url = linkEl ? (linkEl.getAttribute('href') || '').trim() : '';
      const key = getItemKey(url, reportMeta && reportMeta.id, title);
      itemEl.dataset.favKey = key;

      const titleRow = itemEl.querySelector('.hn-title-row');
      if (!titleRow) return;

      let favBtn = titleRow.querySelector('.fav-btn');
      if (!favBtn) {
        favBtn = document.createElement('button');
        favBtn.type = 'button';
        favBtn.className = 'fav-btn';
        titleRow.appendChild(favBtn);
      }

      updateFavButtonState(favBtn, favKeys.has(key));
    });
  }

  let activeModalItem = null;
  let activeReportMetaGetter = null;
  let activeOnFavoriteChange = null;

  function openItemModal(itemEl) {
    const modal = document.getElementById('item-modal');
    if (!modal) return;

    activeModalItem = itemEl;

    const rankEl = itemEl.querySelector('.hn-rank');
    const tagEl = itemEl.querySelector('.hn-tag');
    const linkEl = itemEl.querySelector('.hn-link');
    const descEl = itemEl.querySelector('.hn-desc');
    const useEl = itemEl.querySelector('.hn-use');
    const detailEl = itemEl.querySelector('.hn-detail-body');

    const modalRank = document.getElementById('modal-rank');
    const modalTag = document.getElementById('modal-tag');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const modalUse = document.getElementById('modal-use');
    const modalDetail = document.getElementById('modal-detail');
    const modalLink = document.getElementById('modal-link');
    const modalFavBtn = document.getElementById('modal-fav-btn');

    modalRank.textContent = rankEl ? rankEl.textContent.trim() : '';
    modalRank.hidden = !modalRank.textContent;

    modalTag.textContent = tagEl ? tagEl.textContent.trim() : '';
    modalTag.hidden = !modalTag.textContent;

    modalTitle.textContent = linkEl ? linkEl.textContent.trim() : '';
    modalDesc.textContent = descEl ? descEl.textContent.trim() : '';
    modalDesc.hidden = !modalDesc.textContent;

    if (useEl) {
      modalUse.replaceChildren(...Array.from(useEl.childNodes, (n) => n.cloneNode(true)));
      modalUse.hidden = false;
    } else {
      modalUse.replaceChildren();
      modalUse.hidden = true;
    }

    if (detailEl) {
      modalDetail.replaceChildren(...Array.from(detailEl.childNodes, (n) => n.cloneNode(true)));
      modalDetail.hidden = false;
    } else {
      modalDetail.replaceChildren();
      modalDetail.hidden = true;
    }

    const href = linkEl ? linkEl.getAttribute('href') : '';
    if (href && href !== '#') {
      modalLink.href = href;
      modalLink.hidden = false;
    } else {
      modalLink.removeAttribute('href');
      modalLink.hidden = true;
    }

    if (modalFavBtn) {
      const reportMeta = activeReportMetaGetter ? activeReportMetaGetter() : null;
      const key = itemEl.dataset.favKey || getItemKey(href, reportMeta && reportMeta.id, modalTitle.textContent);
      updateFavButtonState(modalFavBtn, isFavorited(key));
    }

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function initItemInteractions(container, options = {}) {
    const modal = document.getElementById('item-modal');
    const closeBtn = document.getElementById('modal-close');
    const modalFavBtn = document.getElementById('modal-fav-btn');
    if (!container) return;

    activeReportMetaGetter = options.getReportMeta || null;
    activeOnFavoriteChange = options.onFavoriteChange || null;

    const closeModal = () => {
      if (!modal) return;
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
      activeModalItem = null;
    };

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', closeModal);
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeModal();
        }
      });
    }

    if (modalFavBtn) {
      modalFavBtn.addEventListener('click', () => {
        if (!activeModalItem) return;
        const reportMeta = activeReportMetaGetter ? activeReportMetaGetter() : null;
        const data = extractItemData(activeModalItem, reportMeta);
        const favorited = toggleFavorite(data);
        updateFavButtonState(modalFavBtn, favorited);
        updateFavButtonState(activeModalItem.querySelector('.fav-btn'), favorited);
        if (activeOnFavoriteChange) {
          activeOnFavoriteChange(data, favorited);
        }
      });
    }

    container.addEventListener('click', (event) => {
      const favBtn = event.target.closest('.fav-btn');
      if (favBtn) {
        event.preventDefault();
        event.stopPropagation();
        const item = favBtn.closest('.hn-item');
        if (!item) return;
        const reportMeta = activeReportMetaGetter ? activeReportMetaGetter() : null;
        const data = extractItemData(item, reportMeta);
        const favorited = toggleFavorite(data);
        updateFavButtonState(favBtn, favorited);
        if (activeOnFavoriteChange) {
          activeOnFavoriteChange(data, favorited);
        }
        return;
      }

      const metaLink = event.target.closest('a.fav-source-link');
      if (metaLink) {
        return;
      }

      const item = event.target.closest('.hn-item');
      if (!item) return;

      const anchor = event.target.closest('a.hn-link');
      if (anchor && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1)) {
        return;
      }

      event.preventDefault();
      openItemModal(item);
    });

    container.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('.fav-btn, a.fav-source-link')) return;

      const item = event.target.closest('.hn-item');
      if (!item) return;

      const anchor = event.target.closest('a.hn-link');
      if (anchor && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) {
        return;
      }

      event.preventDefault();
      openItemModal(item);
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      updateNavBadge();
      if (container.id === 'report-content') {
        const reportMeta = activeReportMetaGetter ? activeReportMetaGetter() : null;
        decorateReportItems(container, reportMeta);
      }
    });
  }

  function formatSavedDate(timestamp) {
    if (!timestamp) return '';
    try {
      const d = new Date(timestamp);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day} 저장`;
    } catch {
      return '';
    }
  }

  function createFavoriteCard(entry) {
    const item = document.createElement('div');
    item.className = 'hn-item';
    item.tabIndex = 0;
    item.dataset.favKey = entry.key;
    item.dataset.favCategory = entry.category || 'other';
    item.dataset.favSection = entry.section || '';
    item.dataset.reportId = entry.reportId || '';
    item.dataset.reportDate = entry.reportDate || '';
    item.dataset.reportSlot = entry.reportSlot || '';

    const titleRow = document.createElement('div');
    titleRow.className = 'hn-title-row';

    if (entry.rank) {
      const rankSpan = document.createElement('span');
      rankSpan.className = 'hn-rank';
      rankSpan.textContent = entry.rank;
      titleRow.appendChild(rankSpan);
    }

    const link = document.createElement('a');
    link.className = 'hn-link';
    if (entry.url) {
      link.href = entry.url;
      link.target = '_blank';
      link.rel = 'noopener';
    }
    link.textContent = entry.title || '(제목 없음)';
    titleRow.appendChild(link);

    if (entry.tag) {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'hn-tag';
      tagSpan.textContent = entry.tag;
      titleRow.appendChild(tagSpan);
    }

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'fav-btn';
    updateFavButtonState(favBtn, true);
    titleRow.appendChild(favBtn);

    const body = document.createElement('div');
    body.className = 'hn-body';

    if (entry.desc) {
      const descP = document.createElement('p');
      descP.className = 'hn-desc';
      descP.textContent = entry.desc;
      body.appendChild(descP);
    }

    if (entry.useHtml) {
      const useP = document.createElement('p');
      useP.className = 'hn-use';
      useP.innerHTML = entry.useHtml;
      body.appendChild(useP);
    }

    if (entry.detailHtml) {
      const detailDiv = document.createElement('div');
      detailDiv.className = 'hn-detail-body';
      detailDiv.hidden = true;
      detailDiv.innerHTML = entry.detailHtml;
      body.appendChild(detailDiv);
    }

    const metaRow = document.createElement('div');
    metaRow.className = 'fav-item-meta';

    const catLabel = CATEGORY_LABELS[entry.category] || CATEGORY_LABELS.other;
    const catSpan = document.createElement('span');
    catSpan.className = 'fav-cat-pill';
    catSpan.textContent = catLabel;
    metaRow.appendChild(catSpan);

    if (entry.reportId) {
      const sourceLink = document.createElement('a');
      sourceLink.className = 'fav-source-link';
      sourceLink.href = `index.html?report=${encodeURIComponent(entry.reportId)}`;
      const label = [entry.reportDate, entry.reportSlot].filter(Boolean).join(' ') || entry.reportId;
      sourceLink.textContent = `${label} 리포트 ↗`;
      metaRow.appendChild(sourceLink);
    }

    const savedText = formatSavedDate(entry.savedAt);
    if (savedText) {
      const savedSpan = document.createElement('span');
      savedSpan.textContent = savedText;
      metaRow.appendChild(savedSpan);
    }

    body.appendChild(metaRow);
    item.append(titleRow, body);
    return item;
  }

  function initFavoritesPage() {
    const listEl = document.getElementById('favorites-content');
    if (!listEl) return;

    const metaEl = document.getElementById('favorites-meta');
    const searchInput = document.getElementById('favorites-search');
    const filterGroup = document.getElementById('favorites-filters');
    const exportBtn = document.getElementById('favorites-export-btn');
    const importBtn = document.getElementById('favorites-import-btn');
    const importInput = document.getElementById('favorites-import-input');
    const clearBtn = document.getElementById('favorites-clear-btn');

    let activeCategory = 'all';
    let searchQuery = '';

    function render() {
      const allItems = loadFavorites();
      updateNavBadge(allItems.length);

      if (exportBtn) {
        exportBtn.hidden = allItems.length === 0;
      }
      if (clearBtn) {
        clearBtn.hidden = allItems.length === 0;
      }

      const q = searchQuery.trim().toLowerCase();
      const filtered = allItems.filter((entry) => {
        if (activeCategory !== 'all' && (entry.category || 'other') !== activeCategory) {
          return false;
        }
        if (!q) return true;
        const useText = entry.useText || stripHtml(entry.useHtml);
        const haystack = [entry.title, entry.tag, entry.desc, useText, entry.section, entry.reportDate]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });

      if (metaEl) {
        const isFiltered = activeCategory !== 'all' || Boolean(q);
        metaEl.textContent = isFiltered
          ? `검색 결과 ${filtered.length}개 / 전체 ${allItems.length}개`
          : `저장된 항목 ${allItems.length}개`;
      }

      if (allItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'fav-empty';

        const p = document.createElement('p');
        p.textContent = '아직 저장된 즐겨찾기가 없습니다. 리포트에서 ☆ 버튼을 눌러 나중에 참고할 항목을 모아보세요.';

        const link = document.createElement('a');
        link.className = 'modal-open-link';
        link.href = 'index.html';
        link.textContent = '리포트 보러가기 →';

        empty.append(p, link);
        listEl.replaceChildren(empty);
        return;
      }

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'fav-empty';

        const p = document.createElement('p');
        p.textContent = '조건에 맞는 즐겨찾기 항목이 없습니다.';
        empty.appendChild(p);
        listEl.replaceChildren(empty);
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'fav-list';
      filtered.forEach((entry) => {
        grid.appendChild(createFavoriteCard(entry));
      });
      listEl.replaceChildren(grid);
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        render();
      });
    }

    if (filterGroup) {
      filterGroup.addEventListener('click', (event) => {
        const btn = event.target.closest('.fav-filter-btn');
        if (!btn) return;
        activeCategory = btn.dataset.category || 'all';
        filterGroup.querySelectorAll('.fav-filter-btn').forEach((b) => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', String(isActive));
        });
        render();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const items = loadFavorites();
        if (!items.length) return;
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `daily-tech-report-favorites-${today}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    }

    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });

      importInput.addEventListener('change', async () => {
        const file = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!file) return;

        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            throw new Error('Invalid format');
          }

          const existing = loadFavorites();
          const existingKeys = new Set(existing.map((entry) => entry.key));
          const added = [];

          parsed.forEach((raw) => {
            if (!raw || typeof raw !== 'object') return;
            const title = typeof raw.title === 'string' ? raw.title.trim() : '';
            const url = typeof raw.url === 'string' ? raw.url.trim() : '';
            if (!title && !url) return;

            const reportId = typeof raw.reportId === 'string' ? raw.reportId : '';
            const key = (typeof raw.key === 'string' && raw.key) || getItemKey(url, reportId, title);
            if (existingKeys.has(key)) return;
            existingKeys.add(key);

            const section = typeof raw.section === 'string' ? raw.section : '';
            added.push({
              key,
              title,
              url,
              tag: typeof raw.tag === 'string' ? raw.tag : '',
              rank: typeof raw.rank === 'string' ? raw.rank : '',
              desc: typeof raw.desc === 'string' ? raw.desc : '',
              useText: typeof raw.useText === 'string' ? raw.useText : '',
              useHtml: typeof raw.useHtml === 'string' ? raw.useHtml : '',
              detailHtml: typeof raw.detailHtml === 'string' ? raw.detailHtml : '',
              section,
              category: typeof raw.category === 'string' ? raw.category : deriveCategory(section),
              reportId,
              reportDate: typeof raw.reportDate === 'string' ? raw.reportDate : '',
              reportSlot: typeof raw.reportSlot === 'string' ? raw.reportSlot : '',
              savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now(),
            });
          });

          if (added.length > 0 && saveFavorites([...added, ...existing])) {
            render();
          }
          window.alert(`즐겨찾기 ${added.length}개를 가져왔습니다.`);
        } catch {
          window.alert('올바른 즐겨찾기 JSON 파일이 아닙니다.');
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!window.confirm('저장된 즐겨찾기를 모두 삭제할까요?')) return;
        clearFavorites();
        render();
      });
    }

    initItemInteractions(listEl, {
      onFavoriteChange: () => {
        render();
      },
    });

    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        render();
      }
    });

    render();
  }

  window.DTRFavorites = {
    loadFavorites,
    decorateReportItems,
    initItemInteractions,
    updateNavBadge,
  };

  updateNavBadge();
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      updateNavBadge();
    }
  });

  initFavoritesPage();
})();
