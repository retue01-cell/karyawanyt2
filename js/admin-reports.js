/**
 * Portal Karyawan - Admin Reports
 * Versi debugging untuk Rekap Cuti & Izin
 */

const adminReports = {
    rawAttendance: [],
    rawEmployees: [],
    rawLeaves: [],
    rawIzin: [],
    rawJournals: [],
    jurnalData: [],
    leaveData: [],

    filters: {
        attendance: { month: '', dept: '', status: '' },
        jurnal: { month: '', employee: '', status: '' },
        leave: { month: '', type: '', status: '' }
    },

    async initAttendanceReports() {
        if (!auth.isAdmin()) {
            toast.error('Akses ditolak');
            router.navigate('dashboard');
            return;
        }
        loadingIndicator.show('Memuat rekap absensi...');
        try {
            await this.loadData();                   // Ambil semua data (employees, attendance, dll)
            await departmentManager.populateSelects('report-dept-filter'); // Isi dropdown departemen
            this.bindAttendanceEvents();
            
            // Default filter ke bulan terkini
            const today = new Date();
            this.filters.attendance.month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            const monthInput = document.getElementById('attendance-month');
            if (monthInput) monthInput.value = this.filters.attendance.month;
            
            this.renderAttendanceReports();          // Render tabel
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat data');
        } finally {
            loadingIndicator.hide();
        }
    },
    async initJurnalReports() {
        if (!auth.isAdmin()) {
            toast.error('Akses ditolak');
            router.navigate('dashboard');
            return;
        }
        loadingIndicator.show('Memuat rekap jurnal...');
        try {
            await this.loadData();
            this.bindJurnalEvents();
            if (!this.filters.jurnal.month) {
                const today = new Date();
                this.filters.jurnal.month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                const monthInput = document.getElementById('jurnal-month');
                if (monthInput) monthInput.value = this.filters.jurnal.month;
            }
            this.renderJurnalReports();
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat data');
        } finally {
            loadingIndicator.hide();
        }
    },
    async initLeaveReports() {
        if (!auth.isAdmin()) {
            toast.error('Akses ditolak');
            router.navigate('dashboard');
            return;
        }
        loadingIndicator.show('Memuat rekap cuti & izin...');
        try {
            await this.loadData();
            this.bindLeaveEvents();
            // Default filter ke bulan terkini
            const today = new Date();
            this.filters.leave.month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            this.filters.leave.type = '';
            this.filters.leave.status = '';
            const monthInput = document.getElementById('leave-month');
            if (monthInput) monthInput.value = this.filters.leave.month;
            const typeInput = document.getElementById('leave-type-filter');
            if (typeInput) typeInput.value = '';
            const statusInput = document.getElementById('leave-status-filter');
            if (statusInput) statusInput.value = '';
            this.renderLeaveReports();
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat data');
        } finally {
            loadingIndicator.hide();
        }
    },

    async loadData() {
        try {
            console.log('🔄 Loading data from API...');
            const [empResult, jurnalResult, leaveResult, izinResult, attResult] = await Promise.all([
                api.getEmployees(),
                api.getAllJournals(),
                api.getAllLeaves(),
                api.getAllIzin(),
                api.getAllAttendance()
            ]);
            console.log('📡 API Results - Employees:', empResult);
            console.log('📡 API Results - Leaves:', leaveResult);
            console.log('📡 API Results - Izin:', izinResult);
            this.rawEmployees = empResult.data || [];
            this.rawJournals = jurnalResult.data || [];
            this.rawLeaves = leaveResult.data || [];
            this.rawIzin = izinResult.data || [];
            this.rawAttendance = attResult.data || [];

            console.log('=== DATA DARI API ===');
            console.log('📋 Employees:', this.rawEmployees.length, this.rawEmployees);
            console.log('📋 Leaves (raw):', this.rawLeaves.length, this.rawLeaves);
            console.log('📋 Izin (raw):', this.rawIzin.length, this.rawIzin);
        } catch (error) {
            console.error('❌ Load error:', error);
            this.rawEmployees = storage.get('admin_employees', []);
            this.rawJournals = storage.get('jurnals', []);
            this.rawLeaves = storage.get('leaves', []);
            this.rawIzin = storage.get('izin', []);
            this.rawAttendance = storage.get('attendance', []);
        }

        // Jika data dari API kosong, buat data dummy untuk testing (hapus nanti jika sudah berhasil)
        if (this.rawLeaves.length === 0 && this.rawIzin.length === 0 && this.rawEmployees.length > 0) {
            console.warn('⚠️ Tidak ada data cuti/izin dari API, membuat data dummy untuk debugging');
            const today = new Date().toISOString().split('T')[0];
            this.rawLeaves = [
                { id: 999, userId: this.rawEmployees[0]?.id, typeLabel: 'Cuti Tahunan', startDate: today, endDate: today, duration: 1, reason: 'Liburan keluarga', status: 'pending', appliedAt: new Date().toISOString() },
                { id: 998, userId: this.rawEmployees[1]?.id, typeLabel: 'Cuti Sakit', startDate: today, endDate: today, duration: 1, reason: 'Demam', status: 'approved', appliedAt: new Date().toISOString() }
            ];
            this.rawIzin = [
                { id: 997, userId: this.rawEmployees[0]?.id, typeLabel: 'Izin Penting', date: today, duration: 1, reason: 'Urusan keluarga', status: 'pending', appliedAt: new Date().toISOString() }
            ];
        }

        // Map employee names
        const empMap = new Map();
        this.rawEmployees.forEach(emp => {
            empMap.set(String(emp.id), { name: emp.name, department: emp.department });
        });

        // Jurnal data (tidak diubah)
        this.jurnalData = this.rawJournals.map(j => {
            const emp = empMap.get(String(j.userId)) || { name: 'Unknown', department: '-' };
            
            // Perbaikan parsing tanggal
            let journalDate = '';
            if (j.date) {
                // Coba sebagai objek Date
                if (typeof j.date === 'object' && j.date instanceof Date) {
                    journalDate = j.date.toISOString().split('T')[0];
                } 
                // Coba sebagai string YYYY-MM-DD
                else if (typeof j.date === 'string' && j.date.match(/^\d{4}-\d{2}-\d{2}/)) {
                    journalDate = j.date;
                }
                // Coba sebagai angka (timestamp) - validasi apakah masuk akal ( > 1e9)
                else if (typeof j.date === 'number' && j.date > 1000000000) {
                    journalDate = new Date(j.date).toISOString().split('T')[0];
                }
                // Jika tidak valid, gunakan updatedAt
                else if (j.updatedAt) {
                    journalDate = j.updatedAt.split('T')[0];
                }
            }
            if (!journalDate && j.updatedAt) journalDate = j.updatedAt.split('T')[0];
            if (!journalDate && j.createdAt) journalDate = j.createdAt.split('T')[0];
            
            return {
                id: j.id, userId: j.userId, date: journalDate,
                name: emp.name, department: emp.department,
                tasks: j.tasks || '-', achievements: j.achievements || '-',
                obstacles: j.obstacles || '-', plan: j.plan || '-',
                photo: j.photo || null,
                status: (j.tasks && j.tasks !== '-') ? 'filled' : 'empty',
                updatedAt: j.updatedAt
            };
        }).filter(j => j.date !== ''); // filter yang tidak punya tanggal valid
        this.jurnalData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        // Build leaveData (cuti + izin) dengan monthYear
        this.leaveData = [];
        console.log('📋 Processing rawLeaves:', this.rawLeaves.length, 'items');
        this.rawLeaves.forEach(l => {
            const emp = empMap.get(String(l.userId));
            if (emp) {
                let startDateStr = l.startDate;
                if (startDateStr && startDateStr.includes('T')) startDateStr = startDateStr.split('T')[0];
                const monthYear = startDateStr ? startDateStr.substring(0, 7) : '';
                this.leaveData.push({
                    id: l.id,
                    type: 'cuti',
                    typeLabel: l.typeLabel || this.getLeaveTypeLabel(l.type),
                    name: emp.name,
                    department: emp.department,
                    dates: l.startDate === l.endDate ? l.startDate : `${l.startDate} - ${l.endDate}`,
                    duration: l.duration,
                    reason: l.reason,
                    status: l.status,
                    monthYear: monthYear,
                    appliedAt: l.appliedAt
                });
            } else {
                console.warn(`⚠️ Leave dengan userId ${l.userId} tidak ditemukan di Employees`);
            }
        });
        console.log('📋 Processing rawIzin:', this.rawIzin.length, 'items');
        this.rawIzin.forEach(i => {
            const emp = empMap.get(String(i.userId));
            if (emp) {
                let dateStr = i.date;
                if (dateStr && dateStr.includes('T')) dateStr = dateStr.split('T')[0];
                const monthYear = dateStr ? dateStr.substring(0, 7) : '';
                this.leaveData.push({
                    id: i.id,
                    type: 'izin',
                    typeLabel: i.typeLabel || this.getIzinTypeLabel(i.type),
                    name: emp.name,
                    department: emp.department,
                    dates: dateStr,
                    duration: i.duration,
                    reason: i.reason,
                    status: i.status,
                    monthYear: monthYear,
                    appliedAt: i.appliedAt
                });
            } else {
                console.warn(`⚠️ Izin dengan userId ${i.userId} tidak ditemukan di Employees`);
            }
        });
        this.leaveData.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
        console.log('✅ Final leaveData (combined):', this.leaveData.length, 'items');
    },

    getLeaveTypeLabel(type) {
        const map = { annual: 'Cuti Tahunan', sick: 'Cuti Sakit', important: 'Cuti Penting', maternity: 'Cuti Melahirkan', other: 'Lainnya' };
        return map[type] || type;
    },
    getIzinTypeLabel(type) {
        const map = { sick: 'Sakit', permission: 'Izin Penting', emergency: 'Keadaan Darurat', out_of_office: 'Dinas Luar' };
        return map[type] || type;
    },
    getStatusClass(status) {
        const map = {
            'On Time': 'success',
            'Tepat': 'success',
            'Terlambat': 'warning',
            'Late': 'warning',
            'Early In': 'success',
            'Rajin': 'success',
            'Early Out': 'warning',
            'Late & Early Out': 'danger',
            'Incomplete': 'secondary',
            'Outside': 'info',
            'Lembur': 'info',
            'Cuti': 'info',
            'Cuti Tahunan': 'info',
            'Cuti Sakit': 'info',
            'Sakit': 'info',
            'Izin': 'info',
            'Izin Penting': 'info',
            'Keadaan Darurat': 'info',
            'Dinas Luar': 'info',
            'Alpha': 'danger',
            'Libur': 'secondary',
            'Tidak Hadir': 'warning'
        };
        return map[status] || 'secondary';
    },

    buildAttendanceDataForMonth(monthStr) {
        if (!monthStr) {
            const today = new Date();
            monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        }
        const [year, month] = monthStr.split('-');
        const monthAttendance = this.rawAttendance.filter(a => a.date && a.date.startsWith(monthStr));
        return this.rawEmployees.map(emp => {
            const empAtt = monthAttendance.filter(a => String(a.userId) === String(emp.id));
            let present = 0, late = 0;
            empAtt.forEach(a => {
                if (a.clockIn) {
                    present++;
                    // Gunakan status yang sesuai dengan backend: 'Terlambat' atau 'late'
                    if (a.status && (a.status.toLowerCase() === 'terlambat' || a.status.toLowerCase() === 'late')) late++;
                }
            });
            const empLeaves = this.rawLeaves.filter(l => String(l.userId) === String(emp.id) && l.status === 'approved');
            const empIzin = this.rawIzin.filter(i => String(i.userId) === String(emp.id) && i.status === 'approved');
            let leaveDays = 0;
            empLeaves.forEach(l => {
                const start = new Date(l.startDate);
                const end = new Date(l.endDate);
                const monthStart = new Date(year, parseInt(month) - 1, 1);
                const monthEnd = new Date(year, parseInt(month), 0);
                if (start <= monthEnd && end >= monthStart) leaveDays += parseInt(l.duration) || 1;
            });
            empIzin.forEach(i => {
                const izinDate = new Date(i.date);
                if (izinDate.getFullYear() == year && izinDate.getMonth() == parseInt(month) - 1) leaveDays += parseInt(i.duration) || 1;
            });
            return { name: emp.name, department: emp.department, present, late, absent: leaveDays, total: present + leaveDays };
        });
    },

    bindAttendanceEvents() {
        const btnExport = document.getElementById('btn-export-attendance');
        if (btnExport) btnExport.onclick = () => this.exportToExcel('attendance');
        const btnPrint = document.getElementById('btn-print-attendance');
        if (btnPrint) btnPrint.onclick = () => this.printReport('attendance');
        const month = document.getElementById('attendance-month');
        if (month) month.onchange = (e) => { this.filters.attendance.month = e.target.value; this.renderAttendanceReports(); };
        
        // Department filter event (already populated in initAttendanceReports)
        const dept = document.getElementById('report-dept-filter');
        if (dept) {
            dept.onchange = (e) => { this.filters.attendance.dept = e.target.value; this.renderAttendanceReports(); };
        }
        
        const status = document.getElementById('report-status-filter');
        if (status) status.onchange = (e) => { this.filters.attendance.status = e.target.value; this.renderAttendanceReports(); };
    },
    bindJurnalEvents() {
        const btnExport = document.getElementById('btn-export-jurnal');
        if (btnExport) btnExport.onclick = () => this.exportToExcel('jurnal');
        const btnPrint = document.getElementById('btn-print-jurnal');
        if (btnPrint) btnPrint.onclick = () => this.printReport('jurnal');
        const month = document.getElementById('jurnal-month');
        if (month) month.onchange = (e) => { this.filters.jurnal.month = e.target.value; this.renderJurnalReports(); };
        const emp = document.getElementById('jurnal-employee-filter');
        if (emp) {
            const employees = this.rawEmployees.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
            emp.innerHTML = '<option value="">Semua Karyawan</option>' + employees;
            emp.onchange = (e) => { this.filters.jurnal.employee = e.target.value; this.renderJurnalReports(); };
        }
        const status = document.getElementById('jurnal-status-filter');
        if (status) status.onchange = (e) => { this.filters.jurnal.status = e.target.value; this.renderJurnalReports(); };
    },
    bindLeaveEvents() {
        const btnExport = document.getElementById('btn-export-leave');
        if (btnExport) btnExport.onclick = () => this.exportToExcel('leave');
        const btnPrint = document.getElementById('btn-print-leave');
        if (btnPrint) btnPrint.onclick = () => this.printReport('leave');
        const month = document.getElementById('leave-month');
        if (month) month.onchange = (e) => {
            this.filters.leave.month = e.target.value;
            console.log('🔍 Filter month changed to:', this.filters.leave.month);
            this.renderLeaveReports();
        };
        const type = document.getElementById('leave-type-filter');
        if (type) type.onchange = (e) => {
            this.filters.leave.type = e.target.value;
            console.log('🔍 Filter type changed to:', this.filters.leave.type);
            this.renderLeaveReports();
        };
        const status = document.getElementById('leave-status-filter');
        if (status) status.onchange = (e) => {
            this.filters.leave.status = e.target.value;
            console.log('🔍 Filter status changed to:', this.filters.leave.status);
            this.renderLeaveReports();
        };
    },

    getFilteredAttendance() {
        let month = this.filters.attendance.month;
        if (!month) {
            const today = new Date();
            month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        }
        let data = this.buildAttendanceDataForMonth(month);
        if (this.filters.attendance.dept) data = data.filter(row => row.department === this.filters.attendance.dept);
        if (this.filters.attendance.status) {
            data = data.filter(row => {
                if (this.filters.attendance.status === 'present') return row.present > 0;
                if (this.filters.attendance.status === 'absent') return row.absent > 0;
                if (this.filters.attendance.status === 'late') return row.late > 0;
                return true;
            });
        }
        return data;
    },

    getFilteredJurnal() {
        let data = [...this.jurnalData];
        if (this.filters.jurnal.month) {
            data = data.filter(j => j.date && j.date.startsWith(this.filters.jurnal.month));
        }
        if (this.filters.jurnal.employee && this.filters.jurnal.employee !== '') {
            data = data.filter(j => j.name === this.filters.jurnal.employee);
        }
        if (this.filters.jurnal.status && this.filters.jurnal.status !== '') {
            data = data.filter(j => j.status === this.filters.jurnal.status);
        }
        return data;
    },

    getFilteredLeave() {
        let data = [...this.leaveData];
        // Filter hanya jika nilai filter tidak kosong
        if (this.filters.leave.month && this.filters.leave.month !== '') {
            data = data.filter(item => item.monthYear === this.filters.leave.month);
        }
        if (this.filters.leave.type && this.filters.leave.type !== '') {
            if (this.filters.leave.type === 'cuti') {
                data = data.filter(item => item.type === 'cuti');
            } else if (this.filters.leave.type === 'izin') {
                data = data.filter(item => item.type === 'izin');
            } else if (this.filters.leave.type === 'sakit') {
                data = data.filter(item => item.type === 'izin' && item.typeLabel && typeof item.typeLabel === 'string' && item.typeLabel.toLowerCase().includes('sakit'));
            }
        }
        if (this.filters.leave.status && this.filters.leave.status !== '') {
            data = data.filter(item => item.status === this.filters.leave.status);
        }
        console.log('📊 getFilteredLeave - filters:', this.filters.leave);
        console.log('📊 getFilteredLeave - leaveData count:', this.leaveData.length);
        console.log('📊 getFilteredLeave - filtered count:', data.length);
        return data;
    },

    renderAttendanceReports() {
        const tbody = document.getElementById('attendance-reports-body');
        if (!tbody) return;
        const data = this.getFilteredAttendance();
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px;">Tidak ada data</div></tr>';
            return;
        }
        tbody.innerHTML = data.map(row => `
            <tr>
                <td><div class="employee-info"><div class="employee-details"><span class="employee-name">${this.escapeHtml(row.name)}</span></div></div></td>
                <td>${this.escapeHtml(row.department)}</div>
                <td class="text-center" style="color:var(--color-success); font-weight:600;">${row.present}</div>
                <td class="text-center" style="color:var(--color-warning); font-weight:600;">${row.late}</div>
                <td class="text-center" style="color:var(--color-danger); font-weight:600;">${row.absent}</div>
                <td class="text-center">${row.total}</div>
                <td><button class="btn-action view" onclick="adminReports.viewAttendanceDetail('${this.escapeHtml(row.name)}')"><i class="fas fa-eye"></i></button></div>
            </tr>
        `).join('');
        const mobile = document.getElementById('attendance-mobile-cards');
        if (mobile) {
            mobile.innerHTML = data.map(row => `
                <div class="mobile-card">
                    <div class="mobile-card-header"><span class="mobile-card-title">${this.escapeHtml(row.name)}</span><span>${this.escapeHtml(row.department)}</span></div>
                    <div class="mobile-card-row"><span class="mobile-card-label">Hadir</span><span>${row.present}</span></div>
                    <div class="mobile-card-row"><span class="mobile-card-label">Telat</span><span>${row.late}</span></div>
                    <div class="mobile-card-row"><span class="mobile-card-label">Absen</span><span>${row.absent}</span></div>
                    <button class="btn-primary btn-sm" onclick="adminReports.viewAttendanceDetail('${this.escapeHtml(row.name)}')">Lihat Detail</button>
                </div>
            `).join('');
        }
    },

    renderJurnalReports() {
        const tbody = document.getElementById('jurnal-reports-body');
        if (!tbody) return;
        const data = this.getFilteredJurnal();
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px;">Tidak ada data jurnal untuk periode ini</div></tr>';
            const mobile = document.getElementById('jurnal-mobile-cards');
            if (mobile) mobile.innerHTML = '<div class="empty-state">Tidak ada data jurnal</div>';
            return;
        }
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.date || '-'}</div>
                <td>${this.escapeHtml(row.name)}</div>
                <td>${this.escapeHtml(row.department)}</div>
                <td>${row.tasks && typeof row.tasks === 'string' ? (row.tasks.length > 40 ? row.tasks.substring(0, 40) + '...' : row.tasks) : '-'}</td>
                <td>${row.photo ? `<img src="${row.photo}" class="jurnal-thumbnail" onclick="adminReports.viewPhoto('${row.photo}')" style="width:40px;height:40px;object-fit:cover;border-radius:6px;cursor:pointer;">` : '-'}</div>
                <td><span class="status-badge ${row.status}">${row.status === 'filled' ? 'Terisi' : 'Kosong'}</span></div>
                <td>
                    <button class="btn-action view" onclick="adminReports.viewJurnalDetail('${this.escapeHtml(row.name)}', '${row.date}')" title="Lihat"><i class="fas fa-eye"></i></button>
                    <button class="btn-action delete" onclick="adminReports.deleteJournalItem('${row.id}')" title="Hapus" style="background:rgba(239,68,68,0.1);color:#EF4444;"><i class="fas fa-trash"></i></button>
                 </div>
            </tr>
        `).join('');
        const mobile = document.getElementById('jurnal-mobile-cards');
        if (mobile) {
            mobile.innerHTML = data.map(row => `
                <div class="mobile-card">
                    <div class="mobile-card-header"><span class="mobile-card-title">${this.escapeHtml(row.name)}</span><span class="status-badge ${row.status}">${row.status === 'filled' ? 'Terisi' : 'Kosong'}</span></div>
                    <div class="mobile-card-row"><span>Tanggal:</span> ${row.date}</div>
                    <div class="mobile-card-row"><span>Departemen:</span> ${row.department}</div>
                    <div class="mobile-card-row"><span>Tugas:</span> ${row.tasks && typeof row.tasks === 'string' ? (row.tasks.length > 50 ? row.tasks.substring(0, 50) + '...' : row.tasks) : '-'}</div>
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <button class="btn-primary btn-sm" onclick="adminReports.viewJurnalDetail('${this.escapeHtml(row.name)}', '${row.date}')">Lihat</button>
                        <button class="btn-sm" style="background:#EF4444;color:white;" onclick="adminReports.deleteJournalItem('${row.id}')">Hapus</button>
                    </div>
                </div>
            `).join('');
        }
    },

    renderLeaveReports() {
        const tbody = document.getElementById('leave-reports-body');
        if (!tbody) {
            console.error('❌ Element leave-reports-body tidak ditemukan di DOM');
            return;
        }
        const data = this.getFilteredLeave();
        const statusLabels = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' };
        console.log('📊 Data untuk renderLeaveReports (setelah filter):', data.length, 'items');
        console.log('📊 leaveData total:', this.leaveData.length);
        console.log('📊 rawLeaves:', this.rawLeaves.length);
        console.log('📊 rawIzin:', this.rawIzin.length);
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:40px;">Tidak ada data cuti/izin untuk filter yang dipilih</div></tr>';
            const mobile = document.getElementById('leave-mobile-cards');
            if (mobile) mobile.innerHTML = '<div class="empty-state">Tidak ada data</div>';
            return;
        }
        tbody.innerHTML = data.map(item => {
            const approveReject = item.status === 'pending' ? `
                <button class="btn-action approve" style="background:rgba(16,185,129,0.1);color:#10B981;" onclick="adminReports.approveLeaveItem('${item.type}', ${item.id})" title="Setujui"><i class="fas fa-check"></i></button>
                <button class="btn-action reject" style="background:rgba(239,68,68,0.1);color:#EF4444;" onclick="adminReports.rejectLeaveItem('${item.type}', ${item.id})" title="Tolak"><i class="fas fa-times"></i></button>
            ` : '';
            const deleteBtn = `<button class="btn-action delete" style="background:rgba(239,68,68,0.1);color:#EF4444;" onclick="adminReports.deleteLeaveItem('${item.type}', ${item.id})" title="Hapus"><i class="fas fa-trash"></i></button>`;
            const viewBtn = `<button class="btn-action view" onclick="adminReports.viewLeaveDetail('${this.escapeHtml(item.name)}', '${item.type}', ${item.id})" title="Lihat"><i class="fas fa-eye"></i></button>`;
            return `
                <tr>
                    <td>${this.escapeHtml(item.name)}</div>
                    <td>${this.escapeHtml(item.department)}</div>
                    <td>${item.typeLabel}</div>
                    <td>${item.dates}</div>
                    <td>${item.duration} hari</div>
                    <td>${item.reason && typeof item.reason === 'string' ? (item.reason.length > 40 ? item.reason.substring(0, 40) + '...' : item.reason) : '-'}</td>
                    <td><span class="status-badge ${item.status}">${statusLabels[item.status]}</span></div>
                    <td>${approveReject}${deleteBtn}${viewBtn}</div>
                </tr>
            `;
        }).join('');

        const mobile = document.getElementById('leave-mobile-cards');
        if (mobile) {
            mobile.innerHTML = data.map(item => {
                const approveReject = item.status === 'pending' ? `
                    <button class="btn-sm" style="background:#10B981;color:white;" onclick="adminReports.approveLeaveItem('${item.type}', ${item.id})">Setujui</button>
                    <button class="btn-sm" style="background:#EF4444;color:white;" onclick="adminReports.rejectLeaveItem('${item.type}', ${item.id})">Tolak</button>
                ` : '';
                const deleteBtn = `<button class="btn-sm" style="background:#EF4444;color:white;" onclick="adminReports.deleteLeaveItem('${item.type}', ${item.id})">Hapus</button>`;
                const viewBtn = `<button class="btn-primary btn-sm" onclick="adminReports.viewLeaveDetail('${this.escapeHtml(item.name)}', '${item.type}', ${item.id})">Lihat</button>`;
                return `
                    <div class="mobile-card">
                        <div class="mobile-card-header"><span class="mobile-card-title">${this.escapeHtml(item.name)}</span><span class="status-badge ${item.status}">${statusLabels[item.status]}</span></div>
                        <div class="mobile-card-row"><span>Jenis:</span> ${item.typeLabel}</div>
                        <div class="mobile-card-row"><span>Tanggal:</span> ${item.dates}</div>
                        <div class="mobile-card-row"><span>Durasi:</span> ${item.duration} hari</div>
                        <div class="mobile-card-row"><span>Alasan:</span> ${item.reason && typeof item.reason === 'string' ? (item.reason.length > 50 ? item.reason.substring(0, 50) + '...' : item.reason) : '-'}</div>
                        <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                            ${approveReject}
                            ${deleteBtn}
                            ${viewBtn}
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    viewAttendanceDetail(name) {
        const emp = this.rawEmployees.find(e => e.name === name);
        if (!emp) { toast.error('Karyawan tidak ditemukan'); return; }
        
        let selectedMonth = this.filters.attendance.month;
        if (!selectedMonth) {
            const today = new Date();
            selectedMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        }
        const [year, month] = selectedMonth.split('-');
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        const attendanceRecords = this.rawAttendance.filter(a => String(a.userId) === String(emp.id) && a.date && a.date.startsWith(selectedMonth));
        const recordsMap = {};
        attendanceRecords.forEach(rec => { recordsMap[rec.date] = rec; });
        
        let tableRows = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const rec = recordsMap[dateStr];
            let statusHtml = '<span class="badge-status warning">Tidak Hadir</span>';
            let photoHtml = '-';
            
            if (rec && rec.clockIn) {
                // Gunakan mapping status sesuai backend
                const statusClass = this.getStatusClass(rec.status);
                const statusLabel = rec.status || 'Hadir';
                statusHtml = `<span class="badge-status ${statusClass}">${statusLabel}</span>`;

                // Cek apakah ada foto verifikasi
                if (rec.verificationPhoto && rec.verificationPhoto.startsWith('data:image')) {
                    photoHtml = `<button class="btn-action view" onclick="adminReports.viewPhoto(\'${rec.verificationPhoto.replace(/\'/g, "\\\\\\\'")}\')" title="Lihat Bukti Foto"><i class="fas fa-camera"></i></button>`;
                } else if (rec.verificationPhoto) {
                    // Mungkin berupa URL atau data yang sudah tercompress, coba tetap ditampilkan
                    photoHtml = `<button class="btn-action view" onclick="adminReports.viewPhoto(\'${rec.verificationPhoto.replace(/\'/g, "\\\\\\\'")}\')" title="Lihat Bukti Foto"><i class="fas fa-image"></i></button>`;
                }
            } else if (rec && (rec.status === 'Libur' || rec.status === 'libur')) {
                statusHtml = '<span class="badge-status secondary">Libur</span>';
            } else if (rec && rec.isBlocked && rec.status) {
                // Status untuk cuti/izin yang memblokir absensi
                const statusClass = this.getStatusClass(rec.status);
                statusHtml = `<span class="badge-status ${statusClass}">${rec.status}</span>`;
            }
            
            tableRows += `
                <tr>
                    <td class="text-center">${d}</td>
                    <td class="text-center">${dateStr}</td>
                    <td class="text-center">${rec ? rec.clockIn || '-' : '-'}</td>
                    <td class="text-center">${rec ? rec.clockOut || '-' : '-'}</td>
                    <td class="text-center">${statusHtml}</td>
                    <td class="text-center">${photoHtml}</td>
                </tr>
            `;
        }
        
        const formattedMonth = `${month}-${year}`;
        const modalContent = `
            <div style="max-height:60vh;overflow-y:auto;">
                <h4>Riwayat Absensi ${emp.name} - Bulan ${formattedMonth}</h4>
                <table class="history-table" style="width:100%;font-size:12px;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th>Clock In</th>
                            <th>Clock Out</th>
                            <th>Status</th>
                            <th>Bukti Foto</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
        this._showModal(`Detail Absensi: ${emp.name}`, modalContent);
    },

    viewJurnalDetail(name, date) {
        const jurnal = this.jurnalData.find(j => j.name === name && j.date === date);
        if (!jurnal) { toast.error('Jurnal tidak ditemukan'); return; }
        const photoHtml = jurnal.photo ? `
            <div style="margin-top:12px;">
                <img src="${jurnal.photo}" style="max-width:100%; max-height:200px; border-radius:8px; cursor:pointer;" onclick="window.open('${jurnal.photo}','_blank')">
            </div>
        ` : '';
        const content = `
            <div style="max-height:60vh; overflow-y:auto;">
                <p><strong>Nama:</strong> ${this.escapeHtml(jurnal.name)}</p>
                <p><strong>Departemen:</strong> ${this.escapeHtml(jurnal.department)}</p>
                <p><strong>Tanggal:</strong> ${date ? dateTime.formatDate(new Date(date), 'long') : 'Tidak ada tanggal'}</p>
                <hr>
                <p><strong>Tugas yang dikerjakan:</strong><br>${(jurnal.tasks || '-').replace(/\n/g, '<br>')}</p>
                <p><strong>Pencapaian:</strong><br>${(jurnal.achievements || '-').replace(/\n/g, '<br>')}</p>
                <p><strong>Kendala:</strong><br>${(jurnal.obstacles || '-').replace(/\n/g, '<br>')}</p>
                <p><strong>Rencana besok:</strong><br>${(jurnal.plan || '-').replace(/\n/g, '<br>')}</p>
                ${photoHtml}
            </div>
        `;
        this._showModal('Detail Jurnal', content);
    },

    viewLeaveDetail(name, type, id) {
        let item;
        if (type === 'cuti') item = this.rawLeaves.find(l => l.id == id);
        else item = this.rawIzin.find(i => i.id == id);
        if (!item) { toast.error('Data tidak ditemukan'); return; }
        const content = `
            <div style="max-height:60vh; overflow-y:auto;">
                <p><strong>Karyawan:</strong> ${this.escapeHtml(name)}</p>
                <p><strong>Jenis:</strong> ${type === 'cuti' ? 'Cuti' : 'Izin'}</p>
                <p><strong>Tanggal:</strong> ${item.startDate ? `${item.startDate} - ${item.endDate}` : item.date}</p>
                <p><strong>Durasi:</strong> ${item.duration} hari</p>
                <p><strong>Alasan:</strong><br>${item.reason || '-'}</p>
                ${item.verificationPhoto ? `<p><strong>Foto Verifikasi:</strong><br><img src="${item.verificationPhoto}" style="max-width:100%; max-height:200px; border-radius:8px;"></p>` : ''}
                <p><strong>Status:</strong> ${item.status === 'pending' ? 'Menunggu' : (item.status === 'approved' ? 'Disetujui' : 'Ditolak')}</p>
            </div>
        `;
        this._showModal('Detail Pengajuan', content);
    },

    viewPhoto(photoUrl) {
        if (window.modal && typeof window.modal.show === 'function') {
            window.modal.show('Foto', `<img src="${photoUrl}" style="max-width:100%; max-height:70vh;">`, [{ label: 'Tutup', class: 'btn-secondary', onClick: () => window.modal.close() }]);
        } else {
            window.open(photoUrl, '_blank');
        }
    },

    _showModal(title, content) {
        if (window.modal && typeof window.modal.show === 'function') {
            window.modal.show(title, content, [{ label: 'Tutup', class: 'btn-secondary', onClick: () => window.modal.close() }]);
        } else {
            const win = window.open('', '_blank', 'width=800,height=600');
            win.document.write(`
                <html><head><title>${title}</title></head><body style="font-family:Arial;padding:20px;">
                ${content}
                <button onclick="window.close()">Tutup</button>
                </body></html>
            `);
            win.document.close();
        }
    },

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
            } else toast.error(result.error || 'Gagal menyetujui');
        } catch (error) { toast.error('Terjadi kesalahan'); }
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
            } else toast.error(result.error || 'Gagal menolak');
        } catch (error) { toast.error('Terjadi kesalahan'); }
    },

    async deleteJournalItem(journalId) {
        if (!auth.isAdmin()) { toast.error('Akses ditolak'); return; }
        if (!confirm('Yakin ingin menghapus jurnal ini? Tindakan ini tidak dapat dibatalkan.')) return;
        try {
            const result = await api.deleteJournal(journalId);
            if (result && result.success) {
                toast.success('Jurnal berhasil dihapus');
                await this.loadData();
                this.renderJurnalReports();
            } else toast.error(result?.error || 'Gagal menghapus jurnal');
        } catch (error) { toast.error('Terjadi kesalahan saat menghapus'); }
    },

    async deleteLeaveItem(type, id) {
        if (!auth.isAdmin()) { toast.error('Akses ditolak'); return; }
        if (!confirm(`Yakin ingin menghapus pengajuan ${type === 'cuti' ? 'cuti' : 'izin'} ini?`)) return;
        try {
            let result;
            if (type === 'cuti') result = await api.deleteLeave(id);
            else result = await api.deleteIzin(id);
            if (result && result.success) {
                toast.success('Pengajuan berhasil dihapus');
                await this.loadData();
                this.renderLeaveReports();
            } else toast.error(result?.error || 'Gagal menghapus pengajuan');
        } catch (error) { toast.error('Terjadi kesalahan saat menghapus'); }
    },

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
        const rows = data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','));
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
    printReport(type) { window.print(); },

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
};

window.initAttendanceReports = () => adminReports.initAttendanceReports();
window.initJurnalReports = () => adminReports.initJurnalReports();
window.initLeaveReports = () => adminReports.initLeaveReports();
window.adminReports = adminReports;
