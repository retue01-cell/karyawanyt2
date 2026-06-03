/**
 * Portal Karyawan - Shift Schedule (versi dengan auto-sync ke Google Sheets)
 */

const shiftSchedule = {
    employees: [],
    shifts: [],
    scheduleData: {},
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    filters: { department: '', search: '' },

    async init() {
        if (!auth.isAdmin()) { toast.error('Akses ditolak'); router.navigate('dashboard'); return; }
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
            
            // Ambil jadwal dari database (sheet ShiftSchedule) - sinkron dengan Portal Karyawan.xlsx
            const yearMonth = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
            const scheduleResult = await api.getShiftScheduleForMonth(yearMonth);
            if (scheduleResult.success) {
                this.scheduleData = scheduleResult.data || {};
            } else {
                this.scheduleData = {};
            }
            storage.set('shift_schedule', this.scheduleData);
            
            // Refresh shifts setelah load untuk memastikan data date terbaru dari database
            console.log('Shift Schedule: Data loaded successfully for', yearMonth);
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.employees = storage.get('admin_employees', []);
            this.shifts = storage.get('shifts', []);
            this.scheduleData = storage.get('shift_schedule', {});
        }
        
        const periodInput = document.getElementById('schedule-period');
        if (periodInput && !periodInput.value) {
            periodInput.value = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
        }
    },

    getDaysInMonth(month, year) { return new Date(year, month + 1, 0).getDate(); },
    getDayName(dayIndex) { return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dayIndex]; },

    getFilteredEmployees() {
        return this.employees.filter(emp => {
            const matchDept = !this.filters.department || emp.department === this.filters.department;
            const matchSearch = !this.filters.search || emp.name.toLowerCase().includes(this.filters.search) || emp.email.toLowerCase().includes(this.filters.search);
            return matchDept && matchSearch;
        });
    },

    getShiftsForDate(dateStr) {
        if (!dateStr) return this.shifts;
        return this.shifts.filter(shift => {
            if (!shift.date || shift.date === '') return true;
            return shift.date === dateStr;
        });
    },

    renderTable() {
        const headerRow = document.querySelector('#shift-schedule-table thead tr');
        const tbody = document.getElementById('shift-schedule-body');
        if (!headerRow || !tbody) return;
        const existingDateHeaders = headerRow.querySelectorAll('.date-header-col');
        existingDateHeaders.forEach(th => th.remove());
        const daysInMonth = this.getDaysInMonth(this.currentMonth, this.currentYear);
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const th = document.createElement('th');
            th.className = `date-header-col ${isWeekend ? 'weekend' : ''}`;
            th.innerHTML = `<div class="date-header ${isWeekend ? 'weekend' : ''}"><span class="date-day">${this.getDayName(dayOfWeek)}</span><span class="date-number">${day}</span></div>`;
            headerRow.appendChild(th);
        }
        tbody.innerHTML = '';
        const filteredEmployees = this.getFilteredEmployees();
        if (filteredEmployees.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${daysInMonth+1}" class="shift-schedule-empty"><i class="fas fa-users-slash"></i><p>Tidak ada karyawan</p></td></tr>`;
            return;
        }
        const key = `${this.currentYear}-${this.currentMonth+1}`;
        const monthData = this.scheduleData[key] || {};
        filteredEmployees.forEach(emp => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-employee-id', emp.id);
            const empCell = document.createElement('td');
            empCell.className = 'sticky-col';
            empCell.innerHTML = `<div class="employee-cell"><img src="${getAvatarUrl(emp)}" alt="${emp.name}" class="employee-avatar"><div class="employee-info"><span class="employee-name">${emp.name}</span><span class="employee-dept">${emp.department}</span></div></div>`;
            tr.appendChild(empCell);
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(this.currentYear, this.currentMonth, day);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const currentShift = (monthData[emp.id] && monthData[emp.id][day]) ? monthData[emp.id][day] : (isWeekend ? 'Libur' : '');
                
                const dateStr = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const validShifts = this.getShiftsForDate(dateStr);
                
                const td = document.createElement('td');
                td.className = `shift-select-cell ${isWeekend ? 'weekend' : ''}`;
                const select = document.createElement('select');
                select.className = `shift-select ${currentShift ? 'shift-' + currentShift.toLowerCase() : ''}`;
                select.setAttribute('data-employee-id', emp.id);
                select.setAttribute('data-day', day);
                let options = '<option value="">-</option>';
                validShifts.forEach(shift => {
                    options += `<option value="${shift.name}" ${currentShift === shift.name ? 'selected' : ''}>${shift.name}</option>`;
                });
                options += `<option value="Libur" ${currentShift === 'Libur' ? 'selected' : ''}>Libur</option>`;
                select.innerHTML = options;
                select.addEventListener('change', async (e) => { 
                    const newShift = e.target.value;
                    await this.updateShiftAndSave(emp.id, day, newShift);
                    select.className = `shift-select ${newShift ? 'shift-' + newShift.toLowerCase() : ''}`;
                    this.updateSummary();
                });
                td.appendChild(select);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
    },

    // Fungsi baru: update lokal + simpan ke database langsung (sinkron dengan Portal Karyawan.xlsx)
    async updateShiftAndSave(employeeId, day, shiftValue) {
        const key = `${this.currentYear}-${this.currentMonth+1}`;
        if (!this.scheduleData[key]) this.scheduleData[key] = {};
        if (!this.scheduleData[key][employeeId]) this.scheduleData[key][employeeId] = {};
        this.scheduleData[key][employeeId][day] = shiftValue;
        storage.set('shift_schedule', this.scheduleData);
        
        // Simpan ke database via API - sinkron dengan sheet ShiftSchedule di Google Sheets
        const date = `${key}-${String(day).padStart(2,'0')}`;
        try {
            const result = await api.saveShiftScheduleItem(employeeId, date, shiftValue);
            if (result && result.success) {
                toast.success(`Shift untuk tanggal ${date} telah disimpan ke database`);
                // Reload data shifts untuk memastikan sinkronisasi dengan sheet Shifts yang memiliki kolom date
                await this.loadData();
                this.renderTable();
            } else {
                toast.error(result?.error || 'Gagal menyimpan ke database');
            }
        } catch (error) {
            console.error('Error saving shift item:', error);
            toast.error('Gagal menyimpan ke database');
        }
    },

    async saveSchedule() {
        // Fungsi ini tetap ada untuk cadangan (misalnya simpan massal) - sinkron dengan Portal Karyawan.xlsx
        const saveBtn = document.getElementById('btn-save-schedule');
        if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        const key = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
        const monthData = this.scheduleData[key] || {};
        try {
            const result = await api.saveShiftScheduleBulk(key, monthData);
            if (result.success) {
                toast.success('Jadwal shift berhasil disimpan ke database!');
                // Reload data shifts untuk memastikan sinkronisasi penuh dengan database
                await this.loadData();
                this.renderTable();
                const fresh = await api.getShiftScheduleForMonth(key);
                if (fresh.success) this.scheduleData[key] = fresh.data;
            } else {
                toast.error(result.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error(error);
            toast.error('Gagal menyimpan jadwal');
        }
        if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Jadwal';
    },

    async copyFromLastMonth() {
        const lastMonth = this.currentMonth === 0 ? 11 : this.currentMonth - 1;
        const lastYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear;
        const lastKey = `${lastYear}-${String(lastMonth+1).padStart(2,'0')}`;
        const currentKey = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
        if (!confirm(`Salin jadwal dari bulan ${lastKey} ke ${currentKey}?`)) return;
        try {
            const result = await api.getShiftScheduleForMonth(lastKey);
            if (result.success && result.data) {
                this.scheduleData[currentKey] = JSON.parse(JSON.stringify(result.data));
                // Simpan semua item satu per satu ke database
                const monthData = this.scheduleData[currentKey];
                for (const userId in monthData) {
                    for (const day in monthData[userId]) {
                        const shift = monthData[userId][day];
                        const date = `${currentKey}-${String(day).padStart(2,'0')}`;
                        await api.saveShiftScheduleItem(userId, date, shift);
                    }
                }
                // Reload data untuk sinkronisasi dengan database
                await this.loadData();
                this.renderTable();
                this.updateSummary();
                toast.success('Jadwal berhasil disalin');
            } else {
                toast.error('Tidak ada data bulan lalu');
            }
        } catch (e) {
            toast.error('Gagal menyalin jadwal');
        }
    },

    updateSummary() {
        const key = `${this.currentYear}-${this.currentMonth+1}`;
        const monthData = this.scheduleData[key] || {};
        const filteredEmployees = this.getFilteredEmployees();
        let pagi = 0, siang = 0, malam = 0, libur = 0;
        filteredEmployees.forEach(emp => {
            const empData = monthData[emp.id] || {};
            Object.values(empData).forEach(shift => {
                if (shift === 'Pagi') pagi++;
                else if (shift === 'Siang') siang++;
                else if (shift === 'Malam') malam++;
                else if (shift === 'Libur') libur++;
            });
        });
        document.getElementById('summary-total-employees').textContent = filteredEmployees.length;
        document.getElementById('summary-pagi').textContent = pagi;
        document.getElementById('summary-siang').textContent = siang;
        document.getElementById('summary-malam').textContent = malam;
        document.getElementById('summary-libur').textContent = libur;
    },

    bindEvents() {
        const periodInput = document.getElementById('schedule-period');
        if (periodInput) periodInput.addEventListener('change', async (e) => { 
            const [year, month] = e.target.value.split('-').map(Number);
            this.currentYear = year;
            this.currentMonth = month - 1;
            await this.loadData();
            this.renderTable(); 
            this.updateSummary();
        });
        const deptFilter = document.getElementById('schedule-dept-filter');
        if (deptFilter) deptFilter.addEventListener('change', (e) => { this.filters.department = e.target.value; this.renderTable(); this.updateSummary(); });
        const searchInput = document.getElementById('schedule-employee-search');
        if (searchInput) searchInput.addEventListener('input', (e) => { this.filters.search = e.target.value.toLowerCase(); this.renderTable(); this.updateSummary(); });
        const saveBtn = document.getElementById('btn-save-schedule');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveSchedule());
        const copyBtn = document.getElementById('btn-copy-schedule');
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyFromLastMonth());
    }
};

window.initShiftSchedule = () => { shiftSchedule.init(); };
window.shiftSchedule = shiftSchedule;
