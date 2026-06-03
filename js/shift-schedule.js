/**
 * Portal Karyawan - Shift Schedule
 * Employee shift schedule management for admin
 * Menggunakan API dan database, bukan storage lokal
 */

const shiftSchedule = {
    employees: [],
    shifts: [],
    scheduleData: {},
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    filters: { department: '', search: '' },

    async init() {
        if (!auth.isAdmin()) {
            toast.error('Akses ditolak');
            router.navigate('dashboard');
            return;
        }
        await this.loadData();
        this.bindEvents();
        this.renderTable();
        this.updateSummary();
    },

    async loadData() {
        try {
            const [empResult, shiftResult] = await Promise.all([
                api.getEmployees(),
                api.getShifts()
            ]);
            this.employees = empResult.data || [];
            this.shifts = shiftResult.data || [];
            
            // Set period filter to current month/year if not set
            const periodInput = document.getElementById('schedule-period');
            if (periodInput && !periodInput.value) {
                const periodValue = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
                periodInput.value = periodValue;
            }
            
            // Load schedule from API (not from storage)
            await this.loadSchedule();
            
        } catch (error) {
            console.error('Error loading schedule data:', error);
            toast.error('Gagal memuat data');
        }
    },

    async loadSchedule() {
        try {
            const result = await api.getSchedule(this.currentMonth + 1, this.currentYear);
            if (result && result.success) {
                this.scheduleData = result.data || {};
            } else {
                this.scheduleData = {};
                toast.warning('Tidak ada jadwal untuk bulan ini, akan diisi default');
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.scheduleData = {};
        }
    },

    getDaysInMonth(month, year) {
        return new Date(year, month + 1, 0).getDate();
    },

    getDayName(dayIndex) {
        return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dayIndex];
    },

    getFilteredEmployees() {
        return this.employees.filter(emp => {
            const matchDept = !this.filters.department || emp.department === this.filters.department;
            const matchSearch = !this.filters.search || 
                emp.name.toLowerCase().includes(this.filters.search) || 
                emp.email.toLowerCase().includes(this.filters.search);
            return matchDept && matchSearch;
        });
    },

    renderTable() {
        const headerRow = document.querySelector('#shift-schedule-table thead tr');
        const tbody = document.getElementById('shift-schedule-body');
        if (!headerRow || !tbody) return;

        // Hapus kolom tanggal yang lama
        const existingDateHeaders = headerRow.querySelectorAll('.date-header-col');
        existingDateHeaders.forEach(th => th.remove());

        const daysInMonth = this.getDaysInMonth(this.currentMonth, this.currentYear);
        
        // Buat header tanggal
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const th = document.createElement('th');
            th.className = `date-header-col ${isWeekend ? 'weekend' : ''}`;
            th.innerHTML = `<div class="date-header ${isWeekend ? 'weekend' : ''}">
                                <span class="date-day">${this.getDayName(dayOfWeek)}</span>
                                <span class="date-number">${day}</span>
                            </div>`;
            headerRow.appendChild(th);
        }

        // Kosongkan body
        tbody.innerHTML = '';
        const filteredEmployees = this.getFilteredEmployees();
        
        if (filteredEmployees.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${daysInMonth + 1}" class="shift-schedule-empty">
                                <i class="fas fa-users-slash"></i><p>Tidak ada karyawan</p></td></tr>`;
            return;
        }

        const monthData = this.scheduleData || {};
        
        filteredEmployees.forEach(emp => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-employee-id', emp.id);
            
            // Kolom karyawan (sticky)
            const empCell = document.createElement('td');
            empCell.className = 'sticky-col';
            empCell.innerHTML = `<div class="employee-cell">
                                    <img src="${getAvatarUrl(emp)}" alt="${emp.name}" class="employee-avatar">
                                    <div class="employee-info">
                                        <span class="employee-name">${this.escapeHtml(emp.name)}</span>
                                        <span class="employee-dept">${this.escapeHtml(emp.department)}</span>
                                    </div>
                                </div>`;
            tr.appendChild(empCell);
            
            // Loop setiap tanggal
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(this.currentYear, this.currentMonth, day);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                
                let currentShift = '';
                if (monthData[emp.id] && monthData[emp.id][day]) {
                    currentShift = monthData[emp.id][day];
                }
                // Jika tidak ada di scheduleData, tetap kosong, nanti default di backend saat simpan? 
                // Tapi untuk tampilan, kita tetap tampilkan default sementara (Libur jika weekend, else shift karyawan)
                if (!currentShift) {
                    if (isWeekend) currentShift = 'Libur';
                    else currentShift = emp.shift || 'Pagi';
                }
                
                const td = document.createElement('td');
                td.className = `shift-select-cell ${isWeekend ? 'weekend' : ''}`;
                
                const select = document.createElement('select');
                select.className = `shift-select ${currentShift ? 'shift-' + currentShift.toLowerCase() : ''}`;
                select.setAttribute('data-employee-id', emp.id);
                select.setAttribute('data-day', day);
                
                let options = '<option value="">-</option>';
                this.shifts.forEach(shift => {
                    options += `<option value="${this.escapeHtml(shift.name)}" ${currentShift === shift.name ? 'selected' : ''}>${this.escapeHtml(shift.name)}</option>`;
                });
                options += `<option value="Libur" ${currentShift === 'Libur' ? 'selected' : ''}>Libur</option>`;
                select.innerHTML = options;
                
                select.addEventListener('change', (e) => {
                    const newShift = e.target.value;
                    if (!this.scheduleData[emp.id]) this.scheduleData[emp.id] = {};
                    this.scheduleData[emp.id][day] = newShift;
                    select.className = `shift-select ${newShift ? 'shift-' + newShift.toLowerCase() : ''}`;
                    this.updateSummary();
                });
                
                td.appendChild(select);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
    },

    async saveSchedule() {
        const saveBtn = document.getElementById('btn-save-schedule');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        }
        
        try {
            const result = await api.saveSchedule({
                month: this.currentMonth + 1,
                year: this.currentYear,
                schedule: this.scheduleData
            });
            
            if (result && result.success) {
                toast.success(result.message || 'Jadwal shift berhasil disimpan!');
            } else {
                toast.error(result?.error || 'Gagal menyimpan jadwal');
            }
        } catch (error) {
            console.error('Error saving schedule:', error);
            toast.error('Terjadi kesalahan saat menyimpan');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Jadwal';
            }
        }
    },

    async copyFromLastMonth() {
        const lastMonth = this.currentMonth === 0 ? 11 : this.currentMonth - 1;
        const lastYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear;
        
        if (!confirm(`Salin jadwal dari bulan ${lastMonth+1}/${lastYear} ke bulan ${this.currentMonth+1}/${this.currentYear}?`)) {
            return;
        }
        
        try {
            const result = await api.getSchedule(lastMonth + 1, lastYear);
            if (result && result.success && Object.keys(result.data).length > 0) {
                // Salin data, namun perlu disesuaikan tanggalnya (bulan berbeda, tanggal tetap sama)
                const lastSchedule = result.data;
                const newSchedule = {};
                const daysInCurrentMonth = this.getDaysInMonth(this.currentMonth, this.currentYear);
                
                for (const [empId, daysObj] of Object.entries(lastSchedule)) {
                    newSchedule[empId] = {};
                    for (let day = 1; day <= daysInCurrentMonth; day++) {
                        // Jika bulan lalu punya data untuk tanggal yang sama, pakai, else default
                        if (daysObj[day]) {
                            newSchedule[empId][day] = daysObj[day];
                        } else {
                            // default: cek weekend
                            const date = new Date(this.currentYear, this.currentMonth, day);
                            const dayOfWeek = date.getDay();
                            if (dayOfWeek === 0 || dayOfWeek === 6) newSchedule[empId][day] = 'Libur';
                            else newSchedule[empId][day] = 'Pagi'; // fallback
                        }
                    }
                }
                this.scheduleData = newSchedule;
                this.renderTable();
                this.updateSummary();
                toast.success('Jadwal berhasil disalin. Jangan lupa klik Simpan.');
            } else {
                toast.error('Tidak ada data jadwal bulan lalu');
            }
        } catch (error) {
            console.error('Error copying schedule:', error);
            toast.error('Gagal menyalin jadwal');
        }
    },

    updateSummary() {
        const filteredEmployees = this.getFilteredEmployees();
        const daysInMonth = this.getDaysInMonth(this.currentMonth, this.currentYear);
        let pagi = 0, siang = 0, malam = 0, libur = 0;
        
        filteredEmployees.forEach(emp => {
            const empData = this.scheduleData[emp.id] || {};
            for (let day = 1; day <= daysInMonth; day++) {
                const shift = empData[day];
                if (shift === 'Pagi') pagi++;
                else if (shift === 'Siang') siang++;
                else if (shift === 'Malam') malam++;
                else if (shift === 'Libur') libur++;
            }
        });
        
        const totalEmployees = filteredEmployees.length;
        document.getElementById('summary-total-employees').textContent = totalEmployees;
        document.getElementById('summary-pagi').textContent = pagi;
        document.getElementById('summary-siang').textContent = siang;
        document.getElementById('summary-malam').textContent = malam;
        document.getElementById('summary-libur').textContent = libur;
    },

    bindEvents() {
        const periodInput = document.getElementById('schedule-period');
        if (periodInput) {
            periodInput.addEventListener('change', (e) => {
                const [year, month] = e.target.value.split('-').map(Number);
                this.currentYear = year;
                this.currentMonth = month - 1;
                this.loadSchedule().then(() => {
                    this.renderTable();
                    this.updateSummary();
                });
            });
        }
        
        const deptFilter = document.getElementById('schedule-dept-filter');
        if (deptFilter) {
            deptFilter.addEventListener('change', (e) => {
                this.filters.department = e.target.value;
                this.renderTable();
                this.updateSummary();
            });
        }
        
        const searchInput = document.getElementById('schedule-employee-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.renderTable();
                this.updateSummary();
            });
        }
        
        const saveBtn = document.getElementById('btn-save-schedule');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSchedule());
        }
        
        const copyBtn = document.getElementById('btn-copy-schedule');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyFromLastMonth());
        }
    },

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

window.initShiftSchedule = () => { shiftSchedule.init(); };
window.shiftSchedule = shiftSchedule;
