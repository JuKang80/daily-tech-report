let reports = [];
const reportCache = new Map();
let activeAbortController = null;

function setStatusMessage(container, message) {
  const p = document.createElement('p');
  p.className = 'meta';
  p.textContent = message;
  container.replaceChildren(p);
}

function buildSidebar() {
  const listEl = document.getElementById('date-list');
  const fragment = document.createDocumentFragment();

  reports.forEach((report) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-btn';
    btn.dataset.id = report.id;

    const dateSpan = document.createElement('span');
    dateSpan.textContent = report.date;

    const slotSpan = document.createElement('span');
    slotSpan.textContent = report.slot;

    btn.append(dateSpan, slotSpan);
    li.appendChild(btn);
    fragment.appendChild(li);
  });

  listEl.replaceChildren(fragment);

  listEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.date-btn');
    if (!btn) return;
    const { id } = btn.dataset;
    const url = new URL(window.location);
    url.searchParams.set('report', id);
    window.history.pushState({}, '', url);
    selectReport(id);
  });
}

function updateActiveSidebar(activeId) {
  const buttons = document.querySelectorAll('#date-list .date-btn');
  buttons.forEach((btn) => {
    const isActive = btn.dataset.id === activeId;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'true');
    } else {
      btn.removeAttribute('aria-current');
    }
  });
}

function setupSectionToggles(container) {
  const headings = Array.from(container.querySelectorAll('.section-heading'));
  const grid = document.createElement('div');
  grid.className = 'report-grid';

  headings.forEach((heading, idx) => {
    const list = heading.nextElementSibling;
    if (!list || !list.classList.contains('hn-list')) return;

    const count = list.querySelectorAll('.hn-item').length;
    const listId = `section-list-${idx}`;
    list.id = listId;

    list.querySelectorAll('.hn-item').forEach((item) => {
      item.tabIndex = 0;
    });

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'section-toggle';
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', listId);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'section-toggle-title';
    titleSpan.textContent = heading.textContent.trim();

    const metaSpan = document.createElement('span');
    metaSpan.className = 'section-toggle-meta';

    const countSpan = document.createElement('span');
    countSpan.className = 'section-count';
    countSpan.textContent = String(count);

    const chevronSpan = document.createElement('span');
    chevronSpan.className = 'section-chevron';
    chevronSpan.setAttribute('aria-hidden', 'true');
    chevronSpan.textContent = '▾';

    metaSpan.append(countSpan, chevronSpan);
    btn.append(titleSpan, metaSpan);

    heading.textContent = '';
    heading.classList.add('is-collapsible');
    heading.appendChild(btn);

    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      list.classList.toggle('is-collapsed', expanded);
    });

    const column = document.createElement('section');
    column.className = 'report-column';
    column.append(heading, list);
    grid.appendChild(column);
  });

  if (grid.children.length > 0) {
    container.replaceChildren(grid);
  }
}

function openItemModal(item) {
  const modal = document.getElementById('item-modal');
  if (!modal) return;

  const rankEl = item.querySelector('.hn-rank');
  const tagEl = item.querySelector('.hn-tag');
  const linkEl = item.querySelector('.hn-link');
  const descEl = item.querySelector('.hn-desc');
  const useEl = item.querySelector('.hn-use');
  const detailEl = item.querySelector('.hn-detail-body');

  const modalRank = document.getElementById('modal-rank');
  const modalTag = document.getElementById('modal-tag');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const modalUse = document.getElementById('modal-use');
  const modalDetail = document.getElementById('modal-detail');
  const modalLink = document.getElementById('modal-link');

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
  if (href) {
    modalLink.href = href;
    modalLink.hidden = false;
  } else {
    modalLink.removeAttribute('href');
    modalLink.hidden = true;
  }

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }
}

function initModal() {
  const modal = document.getElementById('item-modal');
  const closeBtn = document.getElementById('modal-close');
  const contentEl = document.getElementById('report-content');
  if (!modal || !closeBtn || !contentEl) return;

  const closeModal = () => {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  };

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  contentEl.addEventListener('click', (event) => {
    const item = event.target.closest('.hn-item');
    if (!item) return;

    const anchor = event.target.closest('a.hn-link');
    if (anchor && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1)) {
      return;
    }

    event.preventDefault();
    openItemModal(item);
  });

  contentEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest('.hn-item');
    if (!item) return;

    const anchor = event.target.closest('a.hn-link');
    if (anchor && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) {
      return;
    }

    event.preventDefault();
    openItemModal(item);
  });
}

async function selectReport(id) {
  const item = reports.find((r) => r.id === id) || reports[0];
  if (!item) return;

  if (activeAbortController) {
    activeAbortController.abort();
  }
  const controller = new AbortController();
  activeAbortController = controller;

  updateActiveSidebar(item.id);
  document.getElementById('report-title').textContent = item.title;
  document.getElementById('report-meta').textContent = `${item.date} · ${item.slot}`;

  const contentEl = document.getElementById('report-content');
  try {
    let htmlText = reportCache.get(item.path);
    if (htmlText === undefined) {
      const res = await fetch(item.path, {
        signal: controller.signal,
        cache: 'no-cache',
      });
      if (!res.ok) throw new Error('Failed to load report');
      htmlText = await res.text();
      reportCache.set(item.path, htmlText);
    }

    if (controller.signal.aborted) return;
    contentEl.innerHTML = htmlText;
    setupSectionToggles(contentEl);
  } catch (err) {
    if (err.name === 'AbortError') return;
    setStatusMessage(contentEl, '리포트 본문을 불러오지 못했습니다.');
  } finally {
    if (activeAbortController === controller) {
      activeAbortController = null;
    }
  }
}

async function init() {
  initModal();
  const contentEl = document.getElementById('report-content');
  try {
    const res = await fetch('reports/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load report index');
    reports = await res.json();
    if (!reports.length) {
      setStatusMessage(contentEl, '아직 등록된 리포트가 없습니다.');
      return;
    }
    buildSidebar();
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('report');
    selectReport(requestedId || reports[0].id);
  } catch (err) {
    setStatusMessage(contentEl, '리포트 목록을 불러오지 못했습니다.');
  }
}

window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  selectReport(params.get('report') || (reports[0] && reports[0].id));
});

init();
