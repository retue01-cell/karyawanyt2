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

    // Fungsi untuk menampilkan/menyembunyikan loading indicator di pojok kanan atas
    showLoading() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.classList.add('active');
    },

    hideLoading() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.classList.remove('active');
    },

    async init() {
        if (!auth.isAdmin()) { toast.error('Akses ditolak'); router.navigate('dashboard'); return; }
        this.showLoading();
        try {
            await this.loadData();                         // Ambil employees, shifts, schedule
            await departmentManager.populateSelects('schedule-dept-filter'); // Isi dropdown departemen
            this.bindEvents();
            this.renderTable();
            this.updateSummary();
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat jadwal shift');
        } finally {
            this.hideLoading();
        }
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
            // Gunakan format YYYY-MM (dengan leading zero) agar konsisten dengan backend
            const yearMonth = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
            const scheduleResult = await api.getShiftScheduleForMonth(yearMonth);
            if (scheduleResult.success && scheduleResult.data) {
                this.scheduleData[yearMonth] = scheduleResult.data;
            } else {
                this.scheduleData[yearMonth] = {};
            }
            storage.set('shift_schedule', this.scheduleData);
            
            console.log('Shift Schedule: Data loaded successfully for', yearMonth, this.scheduleData[yearMonth]);
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.employees = storage.get('admin_employees', []);
            this.shifts = storage.get('shifts', []);
            const yearMonth = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
            this.scheduleData = storage.get('shift_schedule', {});
            if (!this.scheduleData[yearMonth]) {
                this.scheduleData[yearMonth] = {};
            }
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
        // Kembalikan semua shift dari database (dinamis)
        return this.shifts;
    },

    renderTable() {
        const headerRow = document.querySelector('#shift-schedule-table thead tr');
        const tbody = document.getElementById('shift-schedule-body');
        if (!headerRow || !tbody) return;
        
        // Clear existing date headers
        const existingDateHeaders = headerRow.querySelectorAll('.date-header-col');
        existingDateHeaders.forEach(th => th.remove());
        
        const daysInMonth = this.getDaysInMonth(this.currentMonth, this.currentYear);
        
        // Create date headers
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
        
        // Use consistent key format: YYYY-MM (with leading zero for month to match backend)
        const key = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
        const monthData = this.scheduleData[key] || {};
        
        console.log('renderTable:', key, 'monthData:', monthData);
        
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
                
                // Tentukan shift hari ini: gunakan kustomisasi jadwal jika ada di database; 
                // jika tidak ada, gunakan shift default dari profil karyawan (emp.shift)
                const currentShift = (monthData[emp.id] && typeof monthData[emp.id][day] !== 'undefined' && monthData[emp.id][day] !== '') 
                    ? monthData[emp.id][day] 
                    : (emp.shift || 'Pagi');
                
                const td = document.createElement('td');
                td.className = `shift-select-cell ${isWeekend ? 'weekend' : ''}`;
                const select = document.createElement('select');
                select.className = `shift-select ${currentShift ? 'shift-' + currentShift.toLowerCase() : ''}`;
                select.setAttribute('data-employee-id', emp.id);
                select.setAttribute('data-day', day);
                
                // Build options dengan shift dinamis dari database
                let options = '<option value="">-</option>';
                this.shifts.forEach(shift => {
                    const shiftName = shift.name;
                    options += `<option value="${shiftName}" ${currentShift === shiftName ? 'selected' : ''}>${shiftName}</option>`;
                });
                // Tambahkan opsi "Libur" jika tidak ada di shifts
                if (!this.shifts.some(s => s.name === 'Libur')) {
                    options += `<option value="Libur" ${currentShift === 'Libur' ? 'selected' : ''}>Libur</option>`;
                }
                
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
        const key = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
        if (!this.scheduleData[key]) this.scheduleData[key] = {};
        if (!this.scheduleData[key][employeeId]) this.scheduleData[key][employeeId] = {};
        this.scheduleData[key][employeeId][day] = shiftValue || "";
        storage.set('shift_schedule', this.scheduleData);
        
        // Simpan ke database via API - sinkron dengan sheet ShiftSchedule di Google Sheets
        const date = `${key}-${String(day).padStart(2,'0')}`;
        this.showLoading();
        try {
            const result = await api.saveShiftScheduleItem(employeeId, date, shiftValue || "");
            if (result && result.success) {
                toast.success(`Shift untuk tanggal ${date} telah disimpan ke database`);
                // Update data lokal dari server untuk memastikan tampilan sesuai dengan database
                const fresh = await api.getShiftScheduleForMonth(key);
                if (fresh.success && fresh.data) {
                    this.scheduleData[key] = fresh.data;
                    storage.set('shift_schedule', this.scheduleData);
                }
                // Render ulang tabel tanpa reload penuh
                this.renderTable();
                this.updateSummary();
            } else {
                toast.error(result?.error || 'Gagal menyimpan ke database');
            }
        } catch (error) {
            console.error('Error saving shift item:', error);
            toast.error('Gagal menyimpan ke database');
        } finally {
            this.hideLoading();
        }
    },

    async saveSchedule() {
        // Fungsi ini tetap ada untuk cadangan (misalnya simpan massal) - sinkron dengan Portal Karyawan.xlsx
        const saveBtn = document.getElementById('btn-save-schedule');
        if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        this.showLoading();
        const key = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
        const monthData = this.scheduleData[key] || {};
        try {
            const result = await api.saveShiftScheduleBulk(key, monthData);
            if (result.success) {
                toast.success('Jadwal shift berhasil disimpan ke database!');
                // Refresh data dari database untuk memastikan tampilan sesuai
                const fresh = await api.getShiftScheduleForMonth(key);
                if (fresh.success && fresh.data) {
                    this.scheduleData[key] = fresh.data;
                    storage.set('shift_schedule', this.scheduleData);
                }
                // Render ulang tabel tanpa reload penuh
                this.renderTable();
                this.updateSummary();
            } else {
                toast.error(result.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error(error);
            toast.error('Gagal menyimpan jadwal');
        } finally {
            this.hideLoading();
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Jadwal';
        }
    },

    async copyFromLastMonth() {
        const lastMonth = this.currentMonth === 0 ? 11 : this.currentMonth - 1;
        const lastYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear;
        const lastKey = `${lastYear}-${String(lastMonth+1).padStart(2,'0')}`;
        const currentKey = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
        if (!confirm(`Salin jadwal dari bulan ${lastKey} ke ${currentKey}?`)) return;
        this.showLoading();
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
                // Refresh data dari database untuk memastikan tampilan sesuai
                const fresh = await api.getShiftScheduleForMonth(currentKey);
                if (fresh.success && fresh.data) {
                    this.scheduleData[currentKey] = fresh.data;
                    storage.set('shift_schedule', this.scheduleData);
                }
                // Render ulang tanpa reload penuh
                this.renderTable();
                this.updateSummary();
                toast.success('Jadwal berhasil disalin');
            } else {
                toast.error('Tidak ada data bulan lalu');
            }
        } catch (e) {
            toast.error('Gagal menyalin jadwal');
        } finally {
            this.hideLoading();
        }
    },

    updateSummary() {
        const key = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
        const monthData = this.scheduleData[key] || {};
        const filteredEmployees = this.getFilteredEmployees();
        const daysInMonth = this.getDaysInMonth(this.currentMonth, this.currentYear);
        let pagi = 0, siang = 0, malam = 0, libur = 0;
        
        filteredEmployees.forEach(emp => {
            const empData = monthData[emp.id] || {};
            for (let day = 1; day <= daysInMonth; day++) {
                // Terapkan logika fallback yang sama pada perhitungan statistik ringkasan
                const shift = (typeof empData[day] !== 'undefined' && empData[day] !== '') 
                    ? empData[day] 
                    : (emp.shift || 'Pagi');
                    
                if (shift === 'Pagi') pagi++;
                else if (shift === 'Siang') siang++;
                else if (shift === 'Malam') malam++;
                else if (shift === 'Libur') libur++;
            }
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
            // Reset scheduleData untuk bulan ini agar dipaksa load ulang dari server
            const key = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}`;
            delete this.scheduleData[key];
            this.showLoading();
            try {
                await this.loadData();
                this.renderTable(); 
                this.updateSummary();
            } finally {
                this.hideLoading();
            }
        });
        const deptFilter = document.getElementById('schedule-dept-filter');
        if (deptFilter) {
            // Event handler only (already populated in init())
            deptFilter.addEventListener('change', (e) => { 
                this.filters.department = e.target.value; 
                this.renderTable(); 
                this.updateSummary(); 
            });
        }
        const searchInput = document.getElementById('schedule-employee-search');
        if (searchInput) searchInput.addEventListener('input', (e) => { 
            this.filters.search = e.target.value.toLowerCase(); 
            this.renderTable(); 
            this.updateSummary(); 
        });
        const saveBtn = document.getElementById('btn-save-schedule');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveSchedule());
        const copyBtn = document.getElementById('btn-copy-schedule');
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyFromLastMonth());
    }
};

window.initShiftSchedule = () => { shiftSchedule.init(); };
window.shiftSchedule = shiftSchedule;
