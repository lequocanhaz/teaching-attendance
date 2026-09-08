(() => {
  const sourceBody = document.getElementById('historyBody');
  const historyView = document.getElementById('view-history');
  const historyStats = document.getElementById('historyStats');
  if (!sourceBody || !historyView || !historyStats) return;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const STATUS_LABELS = {
    taught: 'Đã dạy',
    student_absent: 'Học sinh nghỉ',
    teacher_absent: 'Giáo viên nghỉ',
    makeup: 'Dạy bù',
    cancelled: 'Hủy buổi'
  };

  const style = document.createElement('style');
  style.textContent = `
    #view-history .history-source-table-auto{display:none!important}
    #view-history .history-student-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
    #view-history .history-student-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 13px;font-weight:800;color:var(--muted);cursor:pointer;white-space:nowrap}
    #view-history .history-student-chip.active{background:var(--accent);border-color:var(--accent);color:#fff}
    #view-history .history-grouped{display:grid;gap:16px}
    #view-history .student-history-panel{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:var(--shadow)}
    #view-history .student-history-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--line)}
    #view-history .student-history-name{font-size:20px;font-weight:900;margin:0}
    #view-history .student-history-subject{font-size:13px;color:var(--muted);margin-top:4px}
    #view-history .student-history-total{font-size:12px;font-weight:850;padding:7px 10px;border-radius:999px;background:var(--soft);white-space:nowrap}
    #view-history .student-history-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:12px 16px;background:#fafafa;border-bottom:1px solid var(--line)}
    #view-history .student-history-stat{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px}
    #view-history .student-history-stat strong{display:block;font-size:18px}
    #view-history .student-history-stat span{font-size:11px;color:var(--muted)}
    #view-history .student-history-scroll{overflow:auto}
    #view-history .student-history-table{width:100%;border-collapse:collapse;min-width:620px}
    #view-history .student-history-table th,#view-history .student-history-table td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left;font-size:13px}
    #view-history .student-history-table th{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;background:#fff}
    #view-history .student-history-table tr:last-child td{border-bottom:0}
    @media(max-width:760px){
      #view-history .student-history-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
      #view-history .history-student-tabs{flex-wrap:nowrap;overflow:auto;padding-bottom:4px}
    }
    @media(max-width:620px){
      #view-history .student-history-head{flex-direction:column}
    }
  `;
  document.head.appendChild(style);

  const headingText = historyView.querySelector('.section-head .muted');
  if (headingText) headingText.textContent = 'Lịch sử được chia riêng theo từng học sinh để dễ theo dõi số buổi đã dạy, nghỉ và dạy bù.';

  const tabs = document.createElement('div');
  tabs.className = 'history-student-tabs';
  tabs.setAttribute('aria-label', 'Chọn học sinh');

  const grouped = document.createElement('div');
  grouped.className = 'history-grouped';

  historyStats.insertAdjacentElement('afterend', grouped);
  historyStats.insertAdjacentElement('afterend', tabs);

  const sourceWrap = sourceBody.closest('.table-wrap');
  if (sourceWrap) sourceWrap.classList.add('history-source-table-auto');

  let selectedStudent = 'all';

  function statusFromPill(pill){
    if (!pill) return '';
    return Object.keys(STATUS_LABELS).find(s => pill.classList.contains(s)) || '';
  }

  function readRows(){
    return [...sourceBody.querySelectorAll('tr')].map(tr => {
      const cells = [...tr.querySelectorAll('td')];
      if (cells.length !== 5) return null;
      const name = cells[1].querySelector('strong')?.textContent?.trim();
      if (!name) return null;
      const subject = cells[1].querySelector('.muted')?.textContent?.trim() || '';
      const status = statusFromPill(cells[3].querySelector('.status-pill'));
      return {
        name,
        subject,
        date: cells[0].textContent.trim(),
        time: cells[2].textContent.trim(),
        status,
        note: cells[4].textContent.trim()
      };
    }).filter(Boolean);
  }

  const statCard = (number, label) => `
    <div class="student-history-stat">
      <strong>${number}</strong>
      <span>${label}</span>
    </div>`;

  function render(){
    const rows = readRows();
    const groups = new Map();
    rows.forEach(row => {
      if (!groups.has(row.name)) groups.set(row.name, []);
      groups.get(row.name).push(row);
    });

    const names = [...groups.keys()].sort((a,b) => a.localeCompare(b, 'vi'));
    if (selectedStudent !== 'all' && !groups.has(selectedStudent)) selectedStudent = 'all';

    tabs.innerHTML = names.length
      ? `<button class="history-student-chip ${selectedStudent === 'all' ? 'active' : ''}" data-student-index="all">Tất cả học sinh</button>` +
        names.map((name, index) => `<button class="history-student-chip ${selectedStudent === name ? 'active' : ''}" data-student-index="${index}">${esc(name)} <span style="opacity:.7">(${groups.get(name).length})</span></button>`).join('')
      : '';

    tabs.querySelectorAll('[data-student-index]').forEach(btn => {
      btn.onclick = () => {
        const value = btn.dataset.studentIndex;
        selectedStudent = value === 'all' ? 'all' : names[Number(value)];
        render();
      };
    });

    if (!rows.length) {
      grouped.innerHTML = '<div class="empty">Chưa có dữ liệu chấm công trong bộ lọc hiện tại.</div>';
      return;
    }

    const visibleNames = selectedStudent === 'all' ? names : [selectedStudent];
    grouped.innerHTML = visibleNames.map(name => {
      const list = groups.get(name) || [];
      const subjects = [...new Set(list.map(x => x.subject).filter(Boolean))];
      const taught = list.filter(x => x.status === 'taught').length;
      const makeup = list.filter(x => x.status === 'makeup').length;
      const studentAbsent = list.filter(x => x.status === 'student_absent').length;
      const teacherOrCancelled = list.filter(x => ['teacher_absent','cancelled'].includes(x.status)).length;

      return `<section class="student-history-panel">
        <div class="student-history-head">
          <div>
            <h3 class="student-history-name">${esc(name)}</h3>
            <div class="student-history-subject">${subjects.length ? subjects.map(esc).join(' · ') : 'Dạy thêm'}</div>
          </div>
          <div class="student-history-total">${list.length} ghi nhận</div>
        </div>
        <div class="student-history-stats">
          ${statCard(taught, 'Đã dạy')}
          ${statCard(makeup, 'Dạy bù')}
          ${statCard(studentAbsent, 'Học sinh nghỉ')}
          ${statCard(teacherOrCancelled, 'GV nghỉ / Hủy')}
          ${statCard(list.length, 'Tổng ghi nhận')}
        </div>
        <div class="student-history-scroll">
          <table class="student-history-table">
            <thead><tr><th>Ngày</th><th>Môn</th><th>Ca</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
            <tbody>${list.map(row => `<tr>
              <td>${esc(row.date)}</td>
              <td>${esc(row.subject || '—')}</td>
              <td>${esc(row.time)}</td>
              <td><span class="status-pill ${esc(row.status)}">${esc(STATUS_LABELS[row.status] || row.status)}</span></td>
              <td>${esc(row.note || '')}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </section>`;
    }).join('');
  }

  const observer = new MutationObserver(() => queueMicrotask(render));
  observer.observe(sourceBody, {childList:true, subtree:true});
  document.getElementById('historyMonth')?.addEventListener('change', () => setTimeout(render, 0));
  document.getElementById('historyStatus')?.addEventListener('change', () => setTimeout(render, 0));
  setTimeout(render, 50);
})();
