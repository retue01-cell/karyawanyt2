/**
 * Portal Karyawan - Settings
 * Admin settings - pure sync with database, no auto-save
 * Menambahkan dukungan kolom date pada shift
 */

const settings = {
    shifts: [],

    async init() {
        if (!auth.isAdmin()) {
            toast.error('Akses ditolak');
            router.navigate('dashboard');
            return;
        }
        await this.loadSettings();
        this.initForms();
        this.renderShifts();
    },

    async loadSettings() {
        try {
            const [settingsResult, shiftsResult] = await Promise.all([
                api.getSettings(),
                api.getShifts()
            ]);

            if (!settingsResult.success) throw new Error('Gagal memuat pengaturan');
            if (!shiftsResult.success) throw new Error('Gagal memuat shift');

            // Proses shifts (termasuk date)
            this.shifts = (shiftsResult.data || []).map(shift => ({
                id: shift.id,
                name: shift.name,
                startTime: this.normalizeTime(shift.startTime),
                endTime: this.normalizeTime(shift.endTime),
                date: shift.date || ''
            }));
            storage.set('shifts', this.shifts);

            const allSettings = settingsResult.data || {};

            // Company info
            const companyNameInput = document.getElementById('company-name');
            const companyLogoInput = document.getElementById('company-logo');
            if (companyNameInput) companyNameInput.value = allSettings.company_name || '';
            if (companyLogoInput) companyLogoInput.value = allSettings.company_logo || '';

            // ========== WORKING DAYS ==========
            const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            let rawWorkingDays = allSettings.working_days;
            console.log('[Settings] Raw working_days from API:', rawWorkingDays);

            let workdays = null;
            if (rawWorkingDays) {
                if (typeof rawWorkingDays === 'string') {
                    try {
                        workdays = JSON.parse(rawWorkingDays);
                    } catch (e) {
                        console.error('[Settings] Parse error:', e);
                    }
                } else if (typeof rawWorkingDays === 'object') {
                    workdays = rawWorkingDays;
                }
            }

            // Hapus error div sebelumnya
            const existingErr = document.querySelector('.workdays-error');
            if (existingErr) existingErr.remove();

            if (workdays && typeof workdays === 'object') {
                days.forEach(day => {
                    const chk = document.getElementById(`day-${day}`);
                    if (chk) {
                        chk.checked = workdays[day] === true;
                    }
                });
                console.log('[Settings] Applied workdays from DB:', workdays);
                toast.success('Hari kerja dimuat dari database');
            } else {
                console.warn('[Settings] Working days tidak valid atau kosong');
                const container = document.querySelector('.working-days');
                if (container && !document.querySelector('.workdays-error')) {
                    const errDiv = document.createElement('div');
                    errDiv.className = 'workdays-error';
                    errDiv.style.cssText = 'background:#FEF2F2; color:#DC2626; padding:8px; border-radius:8px; margin-bottom:16px; font-size:13px;';
                    errDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Data hari kerja belum ada di database. Silakan atur checkbox di bawah lalu klik "Simpan Hari Kerja".';
                    container.prepend(errDiv);
                }
                days.forEach(day => {
                    const chk = document.getElementById(`day-${day}`);
                    if (chk) chk.checked = false;
                });
                toast.warning('Data hari kerja belum ada, silakan simpan terlebih dahulu');
            }

            // ========== SETTING LAINNYA ==========
            const lateTolerance = (allSettings.late_tolerance !== undefined && allSettings.late_tolerance !== null) ? allSettings.late_tolerance : 15;
            const toleranceInput = document.getElementById('setting-late-tolerance');
            if (toleranceInput) toleranceInput.value = lateTolerance;

            const faceRecognition = (allSettings.face_recognition === 'true' || allSettings.face_recognition === true || allSettings.face_recognition === 'TRUE');
            const faceCheckbox = document.getElementById('setting-face-recognition');
            if (faceCheckbox) faceCheckbox.checked = faceRecognition;

            const locationTracking = (allSettings.location_tracking === 'true' || allSettings.location_tracking === true || allSettings.location_tracking === 'TRUE');
            const locationCheckbox = document.getElementById('setting-location-tracking');
            if (locationCheckbox) locationCheckbox.checked = locationTracking;

            toast.success('Pengaturan berhasil dimuat');
        } catch (error) {
            console.error('[Settings] Load error:', error);
            this.showError(error.message);
        }
    },

    showError(message) {
        const container = document.querySelector('.settings-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="padding:40px; text-align:center;">
                    <i class="fas fa-database fa-3x" style="color:#EF4444;"></i>
                    <h3>Gagal Sinkronisasi Database</h3>
                    <p>${message}</p>
                    <button class="btn-primary" onclick="location.reload()">Coba Lagi</button>
                </div>
            `;
        }
        toast.error(message);
    },

    normalizeTime(val) {
        if (!val) return '09:00';
        let timeStr = '';
        if (typeof val === 'string') {
            if (val.includes(':')) {
                let parts = val.split(':');
                let hour = parseInt(parts[0], 10);
                let minute = parseInt(parts[1], 10);
                if (isNaN(hour)) hour = 9;
                if (isNaN(minute)) minute = 0;
                timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            } else {
                timeStr = '09:00';
            }
        } else if (val instanceof Date) {
            const hour = val.getHours();
            const minute = val.getMinutes();
            timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        } else {
            timeStr = '09:00';
        }
        return timeStr;
    },

    initForms() {
        const companyForm = document.getElementById('company-form');
        if (companyForm) companyForm.addEventListener('submit', (e) => this.saveCompany(e));

        const addShiftBtn = document.getElementById('btn-add-shift');
        if (addShiftBtn) addShiftBtn.addEventListener('click', () => this.addShift());

        const saveWorkdaysBtn = document.getElementById('btn-save-workdays');
        if (saveWorkdaysBtn) {
            const newBtn = saveWorkdaysBtn.cloneNode(true);
            saveWorkdaysBtn.parentNode.replaceChild(newBtn, saveWorkdaysBtn);
            newBtn.addEventListener('click', () => this.saveWorkdays());
        }

        const saveSystemBtn = document.getElementById('btn-save-system');
        if (saveSystemBtn) {
            const newBtn = saveSystemBtn.cloneNode(true);
            saveSystemBtn.parentNode.replaceChild(newBtn, saveSystemBtn);
            newBtn.addEventListener('click', () => this.saveSystemSettings());
        }
    },

    async saveCompany(e) {
        e.preventDefault();
        const name = document.getElementById('company-name').value;
        const logo = document.getElementById('company-logo').value;
        try {
            const results = await Promise.all([
                api.saveSetting('company_name', name),
                api.saveSetting('company_logo', logo)
            ]);
            if (results.some(r => !r || !r.success)) throw new Error('Gagal menyimpan');
            updateCompanyUI();
            toast.success('Informasi perusahaan disimpan ke database');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Gagal menyimpan');
        }
    },

    async saveWorkdays() {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
        const workdays = {};
        days.forEach(day => {
            const chk = document.getElementById(`day-${day}`);
            workdays[day] = chk ? chk.checked : false;
        });
        const jsonString = JSON.stringify(workdays);
        console.log('[Settings] Saving workdays:', workdays, jsonString);

        try {
            const result = await api.saveSetting('working_days', jsonString);
            if (!result || !result.success) throw new Error(result?.error || 'Gagal menyimpan');

            toast.success('Hari kerja disimpan ke database');

            // Verifikasi
            const verify = await api.getSettings();
            if (verify.success && verify.data.working_days) {
                let saved = verify.data.working_days;
                if (typeof saved === 'string') saved = JSON.parse(saved);
                if (JSON.stringify(saved) === jsonString) {
                    toast.success('Verifikasi berhasil');
                } else {
                    toast.warning('Data tersimpan tidak sesuai, coba refresh');
                }
            }
            const errDiv = document.querySelector('.workdays-error');
            if (errDiv) errDiv.remove();
        } catch (error) {
            console.error('[Settings] Save workdays error:', error);
            toast.error(error.message || 'Gagal menyimpan ke database');
        }
    },

    async saveSystemSettings() {
        const lateTolerance = document.getElementById('setting-late-tolerance').value;
        const faceRecognition = document.getElementById('setting-face-recognition').checked;
        const locationTracking = document.getElementById('setting-location-tracking').checked;
        try {
            const results = await Promise.all([
                api.saveSetting('late_tolerance', lateTolerance),
                api.saveSetting('face_recognition', String(faceRecognition)),
                api.saveSetting('location_tracking', String(locationTracking))
            ]);
            if (results.some(r => !r || !r.success)) throw new Error('Gagal menyimpan');
            toast.success('Pengaturan sistem disimpan ke database');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Gagal menyimpan');
        }
    },

    renderShifts() {
        const container = document.getElementById('shifts-list');
        if (!container) return;
        if (this.shifts.length === 0) {
            container.innerHTML = '<p class="empty-state">Belum ada shift</p>';
            return;
        }
        container.innerHTML = this.shifts.map((shift, index) => `
            <div class="shift-item" data-index="${index}">
                <div class="shift-input-group">
                    <label>Nama Shift</label>
                    <input type="text" value="${this.escapeHtml(shift.name)}" 
                           onchange="settings.updateShift(${index}, 'name', this.value)">
                </div>
                <div class="shift-input-group">
                    <label>Jam Masuk</label>
                    <input type="time" value="${shift.startTime}" 
                           onchange="settings.updateShift(${index}, 'startTime', this.value)">
                </div>
                <div class="shift-input-group">
                    <label>Jam Pulang</label>
                    <input type="time" value="${shift.endTime}" 
                           onchange="settings.updateShift(${index}, 'endTime', this.value)">
                </div>
                <div class="shift-input-group">
                    <label>Tanggal Berlaku (Opsional)</label>
                    <input type="date" value="${shift.date || ''}" 
                           onchange="settings.updateShift(${index}, 'date', this.value)">
                </div>
                <button type="button" class="btn-delete-shift" onclick="settings.deleteShift(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    async addShift() {
        const newShift = { name: 'Shift Baru', startTime: '09:00', endTime: '18:00', date: '' };
        try {
            const result = await api.addShift(newShift);
            if (!result || !result.success) throw new Error(result?.error || 'Gagal menambah shift');
            this.shifts.push(result.data);
            this.renderShifts();
            storage.set('shifts', this.shifts);
            toast.success('Shift ditambahkan ke database');
        } catch (error) {
            console.error(error);
            toast.error(error.message);
        }
    },

    async updateShift(index, field, value) {
        if (!this.shifts[index]) return;
        const oldValue = this.shifts[index][field];
        this.shifts[index][field] = value;
        try {
            const updateData = { [field]: value };
            const result = await api.updateShift(this.shifts[index].id, updateData);
            if (!result || !result.success) throw new Error(result?.error || 'Gagal update shift');
            storage.set('shifts', this.shifts);
            toast.success('Shift diperbarui di database');
        } catch (error) {
            this.shifts[index][field] = oldValue;
            this.renderShifts();
            toast.error(error.message);
        }
    },

    async deleteShift(index) {
        if (!confirm('Hapus shift ini? Tindakan ini tidak dapat dibatalkan.')) return;
        try {
            const result = await api.deleteShift(this.shifts[index].id);
            if (!result || !result.success) throw new Error(result?.error || 'Gagal hapus shift');
            this.shifts.splice(index, 1);
            this.renderShifts();
            storage.set('shifts', this.shifts);
            toast.info('Shift dihapus dari database');
        } catch (error) {
            console.error(error);
            toast.error(error.message);
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

window.initSettings = () => { settings.init(); };
window.settings = settings;
