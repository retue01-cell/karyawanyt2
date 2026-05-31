/**
 * Portal Karyawan - Admin Reports
 * Reports and exports for admin
 */

const adminReports = {
    attendanceData: [],
    jurnalData: [],
    leaveData: [],
    rawAttendance: [],
    rawEmployees: [],
    rawLeaves: [],
    rawIzin: [],
    filters: {
        attendance: { month: '', dept: '', status: '' },
        jurnal: { month: '', employee: '', status: '' },
        leave: { month: '', type: '', status: '' }
    },

    // ----------------------------------------------
    // INIT FUNCTIONS
    // ----------------------------------------------
    async initAttendanceReports() {
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }
        await this.loadData();
        this.bindAttendanceEvents();
        this.populateEmployeeFilter();
        this.renderAttendanceReports();
    },

    async initJurnalReports() {
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }
        await this.loadData();
        this.bindJurnalEvents();
        this.populateEmployeeFilter();
        this.renderJurnalReports();
    },

    async initLeaveReports() {
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }
        await this.loadData();
        this.bindLeaveEvents();
        this.renderLeaveReports();
    },

    // ----------------------------------------------
    // LOAD DATA FROM API / LOCAL STORAGE
    // ----------------------------------------------
    async loadData() {
        try {
            const [empResult, jurnalResult, leaveResult, izinResult, attResult] = await Promise.all([
                api.getEmployees(),
                api.getAllJournals(),
                api.getAllLeaves(),
                api.getAllIzin(),
                api.getAllAttendance()
            ]);
            this.rawEmployees = empResult.data || [];
            this.jurnalData = jurnalResult.data || [];
            this.rawLeaves = leaveResult.data || [];
            this.rawIzin = izinResult.data || [];
            this.rawAttendance = attResult.data || [];
        } catch (error) {
            console.error('Error loading report data:', error);
            this.rawEmployees = storage.get('admin_employees', []);
            this.jurnalData = storage.get('jurnals', []);
            this.rawLeaves = storage.get('leaves', []);
            this.rawIzin = storage.get('izin', []);
            this.rawAttendance = storage.get('attendance', []);
        }

        // Build attendance summary
        this.attendanceData = this.rawEmployees.map(emp => {
            const empAtt = this.rawAttendance.filter(a => String(a.userId) === String(emp.id));
            let present = 0, late = 0;
            empAtt.forEach(a => {
                if (a.clockIn) {
                    present++;
                    if (a.status && a.status.toLowerCase() === 'terlambat') late++;
                }
            });
            const empLeaves = this.rawLeaves.filter(l => String(l.userId) === String(emp.id) && l.status === 'approved');
            const empIzin = this.rawIzin.filter(i => String(i.userId) === String(emp.id) && i.status === 'approved');
            let leaveDays = 0;
            empLeaves.forEach(l => leaveDays += parseInt(l.duration) || 1);
            empIzin.forEach(i => leaveDays += parseInt(i.duration) || 1);
            return {
                name: emp.name,
                department: emp.department,
                present, late,
                absent: leaveDays,
                total: present + leaveDays
            };
        });

        // Build jurnal data (already done in previous version, but ensure completeness)
        // We'll keep jurnalData as is for rendering.

        // Build combined leave/izin data for reports
        this.leaveData = [];
        this.rawLeaves.forEach(l => {
            const emp = this.rawEmployees.find(e => String(e.id) === String(l.userId));
            if (!emp) return;
            this.leaveData.push({
                id: l.id,
                type: 'cuti',
                typeLabel: this.getLeaveTypeLabel(l.type),
                name: emp.name,
                department: emp.department,
                dates: l.startDate === l.endDate ? l.startDate : `${l.startDate} - ${l.endDate}`,
                duration: l.duration,
                reason: l.reason,
                status: l.status,
                appliedAt: l.appliedAt,
                userId: l.userId
            });
        });
        this.rawIzin.forEach(i => {
            const emp = this.rawEmployees.find(e => String(e.id) === String(i.userId));
            if (!emp) return;
            this.leaveData.push({
                id: i.id,
                type: 'izin',
                typeLabel: i.typeLabel || this.getIzinTypeLabel(i.type),
                name: emp.name,
                department: emp.department,
                dates: i.date,
                duration: i.duration,
                reason: i.reason,
                status: i.status,
                appliedAt: i.appliedAt,
                userId: i.userId
            });
        });
        this.leaveData.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
    },

    getLeaveTypeLabel(type) {
        const map = { annual: 'Cuti Tahunan', sick: 'Cuti Sakit', important: 'Cuti Penting', maternity: 'Cuti Melahirkan', other: 'Cuti Lainnya' };
        return map[type] || type;
    },
    getIzinTypeLabel(type) {
        const map = { sick: 'Sakit', permission: 'Izin Penting', emergency: 'Keadaan Darurat' };
        return map[type] || type;
    },

    populateEmployeeFilter() {
        const select = document.getElementById('jurnal-employee-filter');
        if (select) {
            select.innerHTML = '<option value="">Semua Karyawan</option>' +
                this.rawEmployees.map(emp => `<option value="${emp.name}">${emp.name}</option>`).join('');
        }
    },

    bindAttendanceEvents() {
        const exportBtn = document.getElementById('btn-export-attendance');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel('attendance'));
        const printBtn = document.getElementById('btn-print-attendance');
        if (printBtn) printBtn.addEventListener('click', () => this.printReport('attendance'));

        const monthFilter = document.getElementById('attendance-month');
        if (monthFilter) monthFilter.addEventListener('change', (e) => {
            this.filters.attendance.month = e.target.value;
            this.renderAttendanceReports();
        });
        const deptFilter = document.getElementById('report-dept-filter');
        if (deptFilter) deptFilter.addEventListener('change', (e) => {
            this.filters.attendance.dept = e.target.value;
            this.renderAttendanceReports();
        });
        const statusFilter = document.getElementById('report-status-filter');
        if (statusFilter) statusFilter.addEventListener('change', (e) => {
            this.filters.attendance.status = e.target.value;
            this.renderAttendanceReports();
        });
    },

    bindJurnalEvents() {
        const exportBtn = document.getElementById('btn-export-jurnal');
        const printBtn = document.getElementById('btn-print-jurnal');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel('jurnal'));
        if (printBtn) printBtn.addEventListener('click', () => this.printReport('jurnal'));

        const monthFilter = document.getElementById('jurnal-month');
        if (monthFilter) monthFilter.addEventListener('change', (e) => {
            this.filters.jurnal.month = e.target.value;
            this.renderJurnalReports();
        });
        const empFilter = document.getElementById('jurnal-employee-filter');
        if (empFilter) empFilter.addEventListener('change', (e) => {
            this.filters.jurnal.employee = e.target.value;
            this.renderJurnalReports();
        });
        const statusFilter = document.getElementById('jurnal-status-filter');
        if (statusFilter) statusFilter.addEventListener('change', (e) => {
            this.filters.jurnal.status = e.target.value;
            this.renderJurnalReports();
        });
    },

    bindLeaveEvents() {
        const exportBtn = document.getElementById('btn-export-leave');
        const printBtn = document.getElementById('btn-print-leave');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel('leave'));
        if (printBtn) printBtn.addEventListener('click', () => this.printReport('leave'));

        const monthFilter = document.getElementById('leave-month');
        if (monthFilter) monthFilter.addEventListener('change', (e) => {
            this.filters.leave.month = e.target.value;
            this.renderLeaveReports();
        });
        const typeFilter = document.getElementById('leave-type-filter');
        if (typeFilter) typeFilter.addEventListener('change', (e) => {
            this.filters.leave.type = e.target.value;
            this.renderLeaveReports();
        });
        const statusFilter = document.getElementById('leave-status-filter');
        if (statusFilter) statusFilter.addEventListener('change', (e) => {
            this.filters.leave.status = e.target.value;
            this.renderLeaveReports();
        });
    },

    getFilteredAttendance() {
        const selectedMonth = this.filters.attendance.month; // format YYYY-MM
        return this.attendanceData.filter(row => {
            const matchesDept = !this.filters.attendance.dept || row.department === this.filters.attendance.dept;
            const matchesStatus = !this.filters.attendance.status ||
                (this.filters.attendance.status === 'present' && row.present > 0) ||
                (this.filters.attendance.status === 'absent' && row.absent > 0) ||
                (this.filters.attendance.status === 'late' && row.late > 0);
            return matchesDept && matchesStatus;
        });
    },

    getFilteredJurnal() {
        const selectedMonth = this.filters.jurnal.month;
        let data = this.jurnalData;
        if (selectedMonth) {
            data = data.filter(j => j.date && j.date.startsWith(selectedMonth));
        }
        if (this.filters.jurnal.employee) {
            data = data.filter(j => j.name === this.filters.jurnal.employee);
        }
        if (this.filters.jurnal.status) {
            data = data.filter(j => j.status === this.filters.jurnal.status);
        }
        return data;
    },

    getFilteredLeave() {
        return this.leaveData.filter(item => {
            let matchesType = true;
            if (this.filters.leave.type) {
                if (this.filters.leave.type === 'cuti') matchesType = item.type === 'cuti';
                else if (this.filters.leave.type === 'izin') matchesType = item.type === 'izin';
                else if (this.filters.leave.type === 'sakit') matchesType = item.typeLabel.toLowerCase().includes('sakit');
            }
            const matchesStatus = !this.filters.leave.status || item.status === this.filters.leave.status;
            return matchesType && matchesStatus;
        });
    },

    // ========== RENDER ATTENDANCE ==========
    renderAttendanceReports() {
        const tbody = document.getElementById('attendance-reports-body');
        if (!tbody) return;
        const data = this.getFilteredAttendance();
        tbody.innerHTML = data.map(row => `
            <tr>
                <td><div class="employee-info"><div class="employee-details"><span class="employee-name">${row.name}</span></div></div></td>
                <td>${row.department}</td>
                <td class="text-center" style="color: var(--color-success); font-weight: 600;">${row.present}</td>
                <td class="text-center" style="color: var(--color-warning); font-weight: 600;">${row.late}</td>
                <td class="text-center" style="color: var(--color-danger); font-weight: 600;">${row.absent}</td>
                <td class="text-center">${row.total}</td>
                <td><button class="btn-action view" onclick="adminReports.viewAttendanceDetail('${row.name}')"><i class="fas fa-eye"></i></button></td>
            </tr>
        `).join('');
        // mobile cards
        const mobileContainer = document.getElementById('attendance-mobile-cards');
        if (mobileContainer) {
            mobileContainer.innerHTML = data.map(row => `
                <div class="mobile-card">
                    <div class="mobile-card-header"><span class="mobile-card-title">${row.name}</span><span>${row.department}</span></div>
                    <div class="mobile-card-row"><span class="mobile-card-label">Hadir</span><span style="color:var(--color-success);">${row.present}</span></div>
                    <div class="mobile-card-row"><span class="mobile-card-label">Telat</span><span style="color:var(--color-warning);">${row.late}</span></div>
                    <div class="mobile-card-row"><span class="mobile-card-label">Absen</span><span style="color:var(--color-danger);">${row.absent}</span></div>
                    <button class="btn-primary btn-sm" style="margin-top:8px;" onclick="adminReports.viewAttendanceDetail('${row.name}')">Lihat Detail</button>
                </div>
            `).join('');
        }
    },

    // ========== RENDER JURNAL ==========
    renderJurnalReports() {
        const tbody = document.getElementById('jurnal-reports-body');
        if (!tbody) return;
        const data = this.getFilteredJurnal();
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.date}</td>
                <td>${row.name}</td>
                <td>${row.department}</td>
                <td>${row.tasks.substring(0, 30)}${row.tasks.length > 30 ? '...' : ''}</td>
                <td>${row.photo ? `<img src="${row.photo}" class="jurnal-thumbnail" onclick="adminReports.viewPhoto('${row.photo}')" title="Klik untuk melihat">` : '-'}</td>
                <td><span class="status-badge ${row.status}">${row.status === 'filled' ? 'Terisi' : 'Kosong'}</span></td>
                <td><button class="btn-action view" onclick="adminReports.viewJurnalDetail('${row.name}', '${row.date}')"><i class="fas fa-eye"></i></button></td>
            </tr>
        `).join('');
    },

    // ========== RENDER LEAVE ==========
    renderLeaveReports() {
        const tbody = document.getElementById('leave-reports-body');
        if (!tbody) return;
        const data = this.getFilteredLeave();
        const statusLabels = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' };
        tbody.innerHTML = data.map(item => {
            const isPending = item.status === 'pending';
            const actionsHtml = isPending ?
                `<button class="btn-action approve" style="background:rgba(16,185,129,0.1);color:#10B981;" onclick="adminReports.approveLeaveItem('${item.type}', ${item.id})"><i class="fas fa-check"></i></button>
                 <button class="btn-action reject" style="background:rgba(239,68,68,0.1);color:#EF4444;" onclick="adminReports.rejectLeaveItem('${item.type}', ${item.id})"><i class="fas fa-times"></i></button>` :
                `<button class="btn-action view" onclick="adminReports.viewLeaveDetail('${item.name}', '${item.type}', ${item.id})"><i class="fas fa-eye"></i></button>`;
            return `
                <tr data-id="${item.id}">
                    <td>${item.name}</td>
                    <td>${item.department}</td>
                    <td>${item.typeLabel}</td>
                    <td>${item.dates}</td>
                    <td>${item.duration} hari</td>
                    <td>${item.reason.substring(0, 40)}${item.reason.length > 40 ? '...' : ''}</td>
                    <td><span class="status-badge ${item.status}">${statusLabels[item.status]}</span></td>
                    <td class="action-cell">${actionsHtml}</td>
                </tr>
            `;
        }).join('');
        // mobile cards
        const mobileContainer = document.getElementById('leave-mobile-cards');
        if (mobileContainer) {
            mobileContainer.innerHTML = data.map(item => {
                const isPending = item.status === 'pending';
                const actionsHtml = isPending ?
                    `<div style="display:flex; gap:8px; margin-top:8px;">
                        <button class="btn-action approve" style="flex:1;" onclick="adminReports.approveLeaveItem('${item.type}', ${item.id})"><i class="fas fa-check"></i> Setujui</button>
                        <button class="btn-action reject" style="flex:1;" onclick="adminReports.rejectLeaveItem('${item.type}', ${item.id})"><i class="fas fa-times"></i> Tolak</button>
                    </div>` :
                    `<button class="btn-primary btn-sm" style="margin-top:8px;" onclick="adminReports.viewLeaveDetail('${item.name}', '${item.type}', ${item.id})">Lihat Detail</button>`;
                return `
                    <div class="mobile-card">
                        <div class="mobile-card-header"><span class="mobile-card-title">${item.name}</span><span class="status-badge ${item.status}">${statusLabels[item.status]}</span></div>
                        <div class="mobile-card-row"><span class="mobile-card-label">Jenis</span><span>${item.typeLabel}</span></div>
                        <div class="mobile-card-row"><span class="mobile-card-label">Tanggal</span><span>${item.dates}</span></div>
                        <div class="mobile-card-row"><span class="mobile-card-label">Durasi</span><span>${item.duration} hari</span></div>
                        <div class="mobile-card-row"><span class="mobile-card-label">Alasan</span><span>${item.reason.substring(0, 60)}</span></div>
                        ${actionsHtml}
                    </div>
                `;
            }).join('');
        }
    },

    // ========== DETAIL ATTENDANCE (Rekap Absensi) ==========
    async viewAttendanceDetail(name) {
        const emp = this.rawEmployees.find(e => e.name === name);
        if (!emp) {
            toast.error('Karyawan tidak ditemukan');
            return;
        }
        const selectedMonth = this.filters.attendance.month || dateTime.getLocalDate().slice(0,7);
        const [year, month] = selectedMonth.split('-');
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        const attendanceRecords = this.rawAttendance.filter(a => String(a.userId) === String(emp.id) && a.date && a.date.startsWith(selectedMonth));
        const recordsMap = {};
        attendanceRecords.forEach(rec => { recordsMap[rec.date] = rec; });

        let tableRows = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const rec = recordsMap[dateStr];
            let statusHtml = '<span class="badge-status warning">Tidak Hadir</span>';
            if (rec && rec.clockIn) {
                const status = rec.status === 'ontime' ? 'success' : (rec.status === 'Terlambat' ? 'warning' : 'secondary');
                statusHtml = `<span class="badge-status ${status}">${rec.status === 'ontime' ? 'Hadir' : rec.status}</span>`;
            } else if (rec && rec.status === 'libur') {
                statusHtml = '<span class="badge-status secondary">Libur</span>';
            }
            tableRows += `<tr><td>${d}</td><td>${dateStr}</td><td>${rec ? rec.clockIn || '-' : '-'}</td><td>${rec ? rec.clockOut || '-' : '-'}</td><td>${statusHtml}</td></tr>`;
        }

        const modalContent = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <h4>Riwayat Absensi ${emp.name} - Bulan ${selectedMonth}</h4>
                <table class="history-table" style="width:100%; font-size:12px;">
                    <thead><tr><th>Tanggal</th><th>Clock In</th><th>Clock Out</th><th>Status</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
        modal.show(`Detail Absensi: ${emp.name}`, modalContent, [{ label: 'Tutup', class: 'btn-secondary', onClick: () => modal.close() }]);
    },

    // ========== DETAIL JURNAL (already exists but ensure it's fully functional) ==========
    viewJurnalDetail(name, date) {
        const jurnal = this.jurnalData.find(j => j.name === name && j.date === date);
        if (!jurnal) { toast.error('Data jurnal tidak ditemukan'); return; }
        const photoHtml = jurnal.photo ? `<div class="detail-photo-section"><label>Foto Lampiran:</label><img src="${jurnal.photo}" class="jurnal-photo-preview" onclick="window.open('${jurnal.photo}', '_blank')"></div>` : '';
        const content = `
            <div class="jurnal-detail-content">
                <div class="detail-row"><label>Nama:</label><p>${jurnal.name}</p></div>
                <div class="detail-row"><label>Departemen:</label><p>${jurnal.department}</p></div>
                <div class="detail-row"><label>Tanggal:</label><p>${dateTime.formatDate(new Date(jurnal.date), 'long')}</p></div>
                <div class="detail-section"><label>Tugas:</label><p>${jurnal.tasks?.replace(/\n/g, '<br>') || '-'}</p></div>
                <div class="detail-section"><label>Pencapaian:</label><p>${jurnal.achievements?.replace(/\n/g, '<br>') || '-'}</p></div>
                <div class="detail-section"><label>Kendala:</label><p>${jurnal.obstacles?.replace(/\n/g, '<br>') || '-'}</p></div>
                <div class="detail-section"><label>Rencana:</label><p>${jurnal.plan?.replace(/\n/g, '<br>') || '-'}</p></div>
                ${photoHtml}
            </div>
        `;
        modal.show('Detail Jurnal', content, [{ label: 'Tutup', class: 'btn-secondary', onClick: () => modal.close() }]);
    },

    // ========== DETAIL LEAVE / IZIN ==========
    viewLeaveDetail(name, type, id) {
        let item;
        if (type === 'cuti') {
            item = this.rawLeaves.find(l => l.id == id);
        } else {
            item = this.rawIzin.find(i => i.id == id);
        }
        if (!item) {
            toast.error('Data tidak ditemukan');
            return;
        }
        const content = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <div class="detail-row"><label>Karyawan:</label><p>${name}</p></div>
                <div class="detail-row"><label>Jenis:</label><p>${type === 'cuti' ? 'Cuti' : 'Izin'}</p></div>
                <div class="detail-row"><label>Tanggal:</label><p>${item.startDate ? `${item.startDate} s/d ${item.endDate}` : item.date}</p></div>
                <div class="detail-row"><label>Durasi:</label><p>${item.duration} hari</p></div>
                <div class="detail-section"><label>Alasan:</label><p>${item.reason}</p></div>
                ${item.verificationPhoto ? `<div class="detail-section"><label>Foto Verifikasi:</label><img src="${item.verificationPhoto}" style="max-width:100%; max-height:200px; border-radius:8px;"></div>` : ''}
                <div class="detail-row"><label>Status:</label><p>${item.status === 'pending' ? 'Menunggu' : (item.status === 'approved' ? 'Disetujui' : 'Ditolak')}</p></div>
            </div>
        `;
        modal.show('Detail Pengajuan', content, [{ label: 'Tutup', class: 'btn-secondary', onClick: () => modal.close() }]);
    },

    // ========== APPROVE / REJECT (existing) ==========
    async approveLeaveItem(type, id) {
        if (!auth.isAdmin()) return;
        try {
            let result;
            if (type === 'cuti') result = await api.approveLeave(id);
            else result = await api.approveIzin(id);
            if (result.success) {
                toast.success('Pengajuan disetujui!');
                await this.loadData();
                this.renderLeaveReports();
            } else toast.error(result.error || 'Gagal');
        } catch (error) { toast.error('Error'); }
    },
    async rejectLeaveItem(type, id) {
        if (!auth.isAdmin()) return;
        if (!confirm('Tolak pengajuan ini?')) return;
        try {
            let result;
            if (type === 'cuti') result = await api.rejectLeave(id);
            else result = await api.rejectIzin(id);
            if (result.success) {
                toast.info('Pengajuan ditolak');
                await this.loadData();
                this.renderLeaveReports();
            } else toast.error(result.error || 'Gagal');
        } catch (error) { toast.error('Error'); }
    },

    // ========== PHOTO VIEWER ==========
    viewPhoto(photoUrl) {
        if (!photoUrl) return;
        const content = `<div class="photo-viewer-modal"><img src="${photoUrl}" class="full-photo"></div>`;
        modal.show('Foto Lampiran', content, [
            { label: 'Tutup', class: 'btn-secondary', onClick: () => modal.close() },
            { label: 'Buka di Tab Baru', class: 'btn-primary', onClick: () => window.open(photoUrl, '_blank') }
        ]);
    },

    // ========== EXPORT / PRINT ==========
    exportToExcel(type) {
        let data = [], filename = '';
        switch (type) {
            case 'attendance': data = this.getFilteredAttendance(); filename = 'Rekap_Absensi.csv'; break;
            case 'jurnal': data = this.getFilteredJurnal(); filename = 'Rekap_Jurnal.csv'; break;
            case 'leave': data = this.getFilteredLeave(); filename = 'Rekap_Cuti_Izin.csv'; break;
        }
        const csv = this.convertToCSV(data);
        this.downloadFile(csv, filename, 'text/csv');
        toast.success(`Data berhasil diexport ke ${filename}`);
    },
    convertToCSV(data) {
        if (!data.length) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','));
        return [headers.join(','), ...rows].join('\n');
    },
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    printReport(type) { window.print(); }
};

// Global init functions
window.initAttendanceReports = () => { adminReports.initAttendanceReports(); };
window.initJurnalReports = () => { adminReports.initJurnalReports(); };
window.initLeaveReports = () => { adminReports.initLeaveReports(); };
window.adminReports = adminReports;
