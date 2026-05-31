/**
 * Portal Karyawan - Shift Schedule
 * Employee shift schedule management for admin
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
            const [empResult, shiftResult, settingsRes] = await Promise.all([
                api.getEmployees(),
                api.getShifts(),
                api.getSettings()
            ]);
            this.employees = empResult.data || [];
            this.shifts = shiftResult.data || [];
            const loadedSchedules = {};
            if (settingsRes.success && settingsRes.data) {
                Object.keys(settingsRes.data).forEach(k => {
                    if (k.startsWith('shift_schedule_')) {
                        const monthKey = k.replace('shift_schedule_', '');
                        try { loadedSchedules[monthKey] = JSON.parse(settingsRes.data[k]); } catch(e) {}
                    }
                });
            }
            this.scheduleData = Object.keys(loadedSchedules).length ? loadedSchedules : storage.get('shift_schedule', {});
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.employees = storage.get('admin_employees', []);
            this.shifts = storage.get('shifts', []);
            this.scheduleData = storage.get('shift_schedule', {});
        }
        const monthSelect = document.getElementById('schedule-month');
        const yearSelect = document.getElementById('schedule-year');
        if (monthSelect) this.currentMonth = parseInt(monthSelect.value);
        if (yearSelect) this.currentYear = parseInt(yearSelect.value);
        this.generateSampleData();
    },

    generateSampleData() {
        const key = `${this.currentYear}-${this.currentMonth}`;
        if (!this.scheduleData[key]) this.scheduleData[key] = {};
        const daysInMonth = this.getDaysInMonth(this.currentMonth, this.currentYear);
        this.employees.forEach(emp => {
            if (!this.scheduleData[key][emp.id]) {
                this.scheduleData[key][emp.id] = {};
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(this.currentYear, this.currentMonth, day);
                    const dayOfWeek = date.getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        this.scheduleData[key][emp.id][day] = 'Libur';
                    } else {
                        const shifts = ['Pagi', 'Pagi', 'Pagi', 'Siang', 'Malam'];
                        this.scheduleData[key][emp.id][day] = shifts[Math.floor(Math.random() * shifts.length)];
                    }
                }
            }
        });
        storage.set('shift_schedule', this.scheduleData);
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
        const key = `${this.currentYear}-${this.currentMonth}`;
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
                const currentShift = monthData[emp.id]?.[day] || (isWeekend ? 'Libur' : '');
                const td = document.createElement('td');
                td.className = `shift-select-cell ${isWeekend ? 'weekend' : ''}`;
                const select = document.createElement('select');
                select.className = `shift-select ${currentShift ? 'shift-' + currentShift.toLowerCase() : ''}`;
                select.setAttribute('data-employee-id', emp.id);
                select.setAttribute('data-day', day);
                let options = '<option value="">-</option>';
                this.shifts.forEach(shift => { options += `<option value="${shift.name}" ${currentShift === shift.name ? 'selected' : ''}>${shift.name}</option>`; });
                options += `<option value="Libur" ${currentShift === 'Libur' ? 'selected' : ''}>Libur</option>`;
                select.innerHTML = options;
                select.addEventListener('change', (e) => { this.updateShift(emp.id, day, e.target.value); select.className = `shift-select ${e.target.value ? 'shift-' + e.target.value.toLowerCase() : ''}`; this.updateSummary(); });
                td.appendChild(select);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
    },

    updateShift(employeeId, day, shiftValue) {
        const key = `${this.currentYear}-${this.currentMonth}`;
        if (!this.scheduleData[key]) this.scheduleData[key] = {};
        if (!this.scheduleData[key][employeeId]) this.scheduleData[key][employeeId] = {};
        this.scheduleData[key][employeeId][day] = shiftValue;
        storage.set('shift_schedule', this.scheduleData);
    },

    async saveSchedule() {
        const saveBtn = document.getElementById('btn-save-schedule');
        if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        const key = `${this.currentYear}-${this.currentMonth}`;
        const monthData = this.scheduleData[key] || {};
        try {
            await api.saveSetting(`shift_schedule_${key}`, JSON.stringify(monthData));
            storage.set('shift_schedule', this.scheduleData);
            toast.success('Jadwal shift berhasil disimpan!');
        } catch (error) { toast.error('Gagal menyimpan'); }
        if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Jadwal';
    },

    copyFromLastMonth() {
        const lastMonth = this.currentMonth === 0 ? 11 : this.currentMonth - 1;
        const lastYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear;
        const lastKey = `${lastYear}-${lastMonth}`;
        const currentKey = `${this.currentYear}-${this.currentMonth}`;
        if (!this.scheduleData[lastKey]) { toast.error('Tidak ada data bulan lalu'); return; }
        if (confirm('Salin jadwal dari bulan lalu?')) {
            this.scheduleData[currentKey] = JSON.parse(JSON.stringify(this.scheduleData[lastKey]));
            storage.set('shift_schedule', this.scheduleData);
            this.renderTable();
            this.updateSummary();
            toast.success('Jadwal berhasil disalin');
        }
    },

    updateSummary() {
        const key = `${this.currentYear}-${this.currentMonth}`;
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
        const monthSelect = document.getElementById('schedule-month');
        if (monthSelect) monthSelect.addEventListener('change', (e) => { this.currentMonth = parseInt(e.target.value); this.renderTable(); this.updateSummary(); });
        const yearSelect = document.getElementById('schedule-year');
        if (yearSelect) yearSelect.addEventListener('change', (e) => { this.currentYear = parseInt(e.target.value); this.renderTable(); this.updateSummary(); });
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
