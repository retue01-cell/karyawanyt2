/**
 * Portal Karyawan - Settings
 * Admin settings functionality
 */

const settings = {
    shifts: [],
    formsInitialized: false,

    async init() {
        if (!auth.isAdmin()) { toast.error('Akses ditolak'); router.navigate('dashboard'); return; }
        await this.loadSettings();
        this.renderShifts();
        this.initForms();
    },

    async loadSettings() {
        try {
            const [settingsResult, shiftsResult] = await Promise.all([api.getSettings(), api.getShifts()]);
            this.shifts = (shiftsResult.data || []).map(shift => ({
                ...shift,
                startTime: this.normalizeTime(shift.startTime),
                endTime: this.normalizeTime(shift.endTime)
            }));
            const allSettings = settingsResult.data || {};
            document.getElementById('company-name').value = allSettings.company_name || '';
            document.getElementById('company-logo').value = allSettings.company_logo || '';
            const workdays = allSettings.working_days ? JSON.parse(allSettings.working_days) : null;
            if (workdays) {
                const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
                days.forEach(day => { const el = document.getElementById(`day-${day}`); if (el) el.checked = workdays[day] !== false; });
            }
            if (allSettings.late_tolerance !== undefined) document.getElementById('setting-late-tolerance').value = allSettings.late_tolerance;
            if (allSettings.face_recognition !== undefined) document.getElementById('setting-face-recognition').checked = allSettings.face_recognition === 'true' || allSettings.face_recognition === true;
            if (allSettings.location_tracking !== undefined) document.getElementById('setting-location-tracking').checked = allSettings.location_tracking === 'true' || allSettings.location_tracking === true;
        } catch (error) {
            console.error(error);
            this.shifts = storage.get('shifts', []);
            const company = storage.get('company', { name: '', logo: '' });
            document.getElementById('company-name').value = company.name;
            document.getElementById('company-logo').value = company.logo;
            // Load working days from local storage as fallback
            const workdays = storage.get('working_days', { senin: true, selasa: true, rabu: true, kamis: true, jumat: true, sabtu: false, minggu: false });
            const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            days.forEach(day => { const el = document.getElementById(`day-${day}`); if (el) el.checked = workdays[day] !== false; });
        }
    },

    normalizeTime(val) {
        if (!val) return '09:00';
        if (/^\d{2}:\d{2}$/.test(val)) return val;
        if (val instanceof Date) {
            const h = String(val.getHours()).padStart(2, '0');
            const m = String(val.getMinutes()).padStart(2, '0');
            return h + ':' + m;
        }
        const str = String(val);
        if (str.includes('T')) {
            try { const d = new Date(str); const h = String(d.getUTCHours()+7).padStart(2,'0'); const m = String(d.getUTCMinutes()).padStart(2,'0'); return h+':'+m; } catch(e) { return '09:00'; }
        }
        return str;
    },

    initForms() {
        if (this.formsInitialized) return;
        this.formsInitialized = true;
        
        const companyForm = document.getElementById('company-form');
        if (companyForm) {
            companyForm.removeEventListener('submit', this._saveCompanyHandler);
            this._saveCompanyHandler = (e) => this.saveCompany(e);
            companyForm.addEventListener('submit', this._saveCompanyHandler);
        }
        
        const addShiftBtn = document.getElementById('btn-add-shift');
        if (addShiftBtn) {
            addShiftBtn.removeEventListener('click', this._addShiftHandler);
            this._addShiftHandler = () => this.addShift();
            addShiftBtn.addEventListener('click', this._addShiftHandler);
        }
        
        const saveWorkdaysBtn = document.getElementById('btn-save-workdays');
        if (saveWorkdaysBtn) {
            saveWorkdaysBtn.removeEventListener('click', this._saveWorkdaysHandler);
            this._saveWorkdaysHandler = () => this.saveWorkdays();
            saveWorkdaysBtn.addEventListener('click', this._saveWorkdaysHandler);
        }
        
        const saveSystemBtn = document.getElementById('btn-save-system');
        if (saveSystemBtn) {
            saveSystemBtn.removeEventListener('click', this._saveSystemHandler);
            this._saveSystemHandler = () => this.saveSystemSettings();
            saveSystemBtn.addEventListener('click', this._saveSystemHandler);
        }
    },

    async saveCompany(e) {
        e.preventDefault();
        const name = document.getElementById('company-name').value;
        const logo = document.getElementById('company-logo').value;
        await Promise.all([api.saveSetting('company_name', name), api.saveSetting('company_logo', logo)]);
        storage.set('company', { name, logo });
        updateCompanyUI();
        toast.success('Informasi perusahaan disimpan');
    },

    async saveWorkdays() {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
        const workdays = {};
        let hasUncheckedDays = false;
        
        days.forEach(day => { 
            const el = document.getElementById(`day-${day}`);
            const isChecked = el ? el.checked : true;
            workdays[day] = isChecked;
            if (!isChecked) hasUncheckedDays = true;
        });
        
        await api.saveSetting('working_days', JSON.stringify(workdays));
        storage.set('working_days', workdays);
        
        // Update all shift schedules: set non-working days to 'Libur'
        this.updateSchedulesForWorkdaysChange(workdays);
        
        toast.success('Hari kerja disimpan');
    },

    updateSchedulesForWorkdaysChange(workdays) {
        const dayMap = { 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6, 'minggu': 0 };
        const scheduleData = storage.get('shift_schedule', {});
        let hasChanges = false;
        
        Object.keys(scheduleData).forEach(monthKey => {
            const monthData = scheduleData[monthKey];
            const [year, month] = monthKey.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            
            Object.keys(monthData).forEach(empId => {
                const empSchedule = monthData[empId];
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month - 1, day);
                    const dayOfWeek = date.getDay();
                    const dayName = Object.keys(dayMap).find(key => dayMap[key] === dayOfWeek);
                    
                    if (dayName && workdays[dayName] === false) {
                        if (empSchedule[day] !== 'Libur') {
                            empSchedule[day] = 'Libur';
                            hasChanges = true;
                        }
                    }
                }
            });
        });
        
        if (hasChanges) {
            storage.set('shift_schedule', scheduleData);
            // Refresh the current view if we're on the shift schedule page
            if (window.shiftSchedule) {
                window.shiftSchedule.renderTable();
                window.shiftSchedule.updateSummary();
            }
            toast.info('Jadwal shift otomatis diperbarui untuk hari yang bukan hari kerja');
        }
    },

    async saveSystemSettings() {
        const lateTolerance = document.getElementById('setting-late-tolerance').value;
        const faceRecognition = document.getElementById('setting-face-recognition').checked;
        const locationTracking = document.getElementById('setting-location-tracking').checked;
        await Promise.all([
            api.saveSetting('late_tolerance', lateTolerance),
            api.saveSetting('face_recognition', String(faceRecognition)),
            api.saveSetting('location_tracking', String(locationTracking))
        ]);
        toast.success('Pengaturan sistem disimpan');
    },

    renderShifts() {
        const container = document.getElementById('shifts-list');
        if (!container) return;
        if (this.shifts.length === 0) { container.innerHTML = '<p class="empty-state">Belum ada shift</p>'; return; }
        container.innerHTML = this.shifts.map((shift, index) => `
            <div class="shift-item" data-index="${index}">
                <div class="shift-input-group"><label>Nama Shift</label><input type="text" value="${shift.name}" placeholder="Nama Shift" onchange="settings.updateShift(${index}, 'name', this.value)"></div>
                <div class="shift-input-group"><label>Jam Masuk</label><input type="time" value="${shift.startTime}" onchange="settings.updateShift(${index}, 'startTime', this.value)"></div>
                <div class="shift-input-group"><label>Jam Pulang</label><input type="time" value="${shift.endTime}" onchange="settings.updateShift(${index}, 'endTime', this.value)"></div>
                <button type="button" class="btn-delete-shift" onclick="settings.deleteShift(${index})"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
    },

    async addShift() {
        const newShift = { name: 'Shift Baru', startTime: '09:00', endTime: '18:00' };
        const result = await api.addShift(newShift);
        if (result.success) { this.shifts.push(result.data); this.renderShifts(); toast.success('Shift ditambahkan'); }
    },

    async updateShift(index, field, value) {
        if (this.shifts[index]) {
            this.shifts[index][field] = value;
            await api.updateShift(this.shifts[index].id, { [field]: value });
            toast.success('Shift diperbarui');
        }
    },

    async deleteShift(index) {
        if (confirm('Hapus shift ini?')) {
            await api.deleteShift(this.shifts[index].id);
            this.shifts.splice(index, 1);
            this.renderShifts();
            toast.info('Shift dihapus');
        }
    }
};

window.initSettings = () => { settings.init(); };
window.settings = settings;
