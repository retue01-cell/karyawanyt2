/**
 * Portal Karyawan - Settings
 * Admin settings functionality - fully sync with database
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
            
            if (!settingsResult.success) {
                throw new Error(settingsResult.error || 'Gagal memuat pengaturan');
            }
            if (!shiftsResult.success) {
                throw new Error(shiftsResult.error || 'Gagal memuat shift');
            }
            
            // Proses shifts - pastikan waktu dalam format HH:MM
            this.shifts = (shiftsResult.data || []).map(shift => ({
                id: shift.id,
                name: shift.name,
                startTime: this.normalizeTime(shift.startTime),
                endTime: this.normalizeTime(shift.endTime)
            }));
            
            // Simpan shifts ke storage agar dipakai modul lain (absensi, dashboard)
            if (this.shifts.length) {
                storage.set('shifts', this.shifts);
            }
            
            const allSettings = settingsResult.data || {};
            
            // Company info
            const companyNameInput = document.getElementById('company-name');
            const companyLogoInput = document.getElementById('company-logo');
            if (companyNameInput) companyNameInput.value = allSettings.company_name || '';
            if (companyLogoInput) companyLogoInput.value = allSettings.company_logo || '';
            
            // ========== WORKING DAYS ==========
            let workdays = null;
            if (allSettings.working_days) {
                try {
                    workdays = JSON.parse(allSettings.working_days);
                } catch (e) {
                    console.error('Parse working_days error:', e);
                }
            }
            
            const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            
            if (workdays) {
                // Data dari database ada -> terapkan ke checkbox
                days.forEach(day => {
                    const el = document.getElementById(`day-${day}`);
                    if (el) el.checked = workdays[day] === true;
                });
                console.log('Working days loaded from DB:', workdays);
            } else {
                // Default: semua hari kerja aktif (sesuai dengan data di Excel)
                const defaultWorkdays = {
                    senin: true, selasa: true, rabu: true, kamis: true,
                    jumat: true, sabtu: true, minggu: true
                };
                days.forEach(day => {
                    const el = document.getElementById(`day-${day}`);
                    if (el) el.checked = defaultWorkdays[day];
                });
                // Simpan ke database
                await api.saveSetting('working_days', JSON.stringify(defaultWorkdays));
                console.log('Default working days saved to DB');
                toast.info('Pengaturan hari kerja default ditambahkan ke database');
            }
            
            // ========== OTHER SETTINGS ==========
            // Late tolerance
            let lateTolerance = allSettings.late_tolerance;
            if (lateTolerance === undefined || lateTolerance === null) {
                lateTolerance = 15;
                await api.saveSetting('late_tolerance', lateTolerance);
            }
            const toleranceInput = document.getElementById('setting-late-tolerance');
            if (toleranceInput) toleranceInput.value = lateTolerance;
            
            // Face recognition
            let faceRecognition = allSettings.face_recognition;
            if (faceRecognition === undefined || faceRecognition === null) {
                faceRecognition = true;
                await api.saveSetting('face_recognition', String(faceRecognition));
            } else {
                faceRecognition = (faceRecognition === 'true' || faceRecognition === true);
            }
            const faceCheckbox = document.getElementById('setting-face-recognition');
            if (faceCheckbox) faceCheckbox.checked = faceRecognition;
            
            // Location tracking
            let locationTracking = allSettings.location_tracking;
            if (locationTracking === undefined || locationTracking === null) {
                locationTracking = true;
                await api.saveSetting('location_tracking', String(locationTracking));
            } else {
                locationTracking = (locationTracking === 'true' || locationTracking === true);
            }
            const locationCheckbox = document.getElementById('setting-location-tracking');
            if (locationCheckbox) locationCheckbox.checked = locationTracking;
            
            toast.success('Pengaturan berhasil dimuat dari database');
            
        } catch (error) {
            console.error('Load settings error:', error);
            this.showDatabaseError(error.message);
        }
    },
    
    showDatabaseError(message) {
        const container = document.querySelector('.settings-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="text-align:center; padding:var(--spacing-xl); background:rgba(239,68,68,0.1); border-radius:var(--border-radius); margin:var(--spacing);">
                    <i class="fas fa-database" style="font-size:3rem; color:var(--color-danger); margin-bottom:var(--spacing);"></i>
                    <h3 style="color:var(--color-danger);">Gagal Sinkronisasi Database</h3>
                    <p>${message}</p>
                    <p style="font-size:var(--font-size-sm); margin-top:var(--spacing);">Pastikan koneksi internet stabil dan database tersedia.</p>
                    <button class="btn-primary" onclick="settings.retryLoad()" style="margin-top:var(--spacing);">
                        <i class="fas fa-sync-alt"></i> Coba Lagi
                    </button>
                </div>
            `;
        }
        toast.error(message);
    },
    
    retryLoad() {
        window.location.reload();
    },

    // Normalisasi waktu: konversi "08:30:00" atau Date object menjadi "HH:MM"
    normalizeTime(val) {
        if (!val) return '09:00';
        // Jika sudah dalam format HH:MM
        if (/^\d{2}:\d{2}$/.test(val)) return val;
        // Jika dalam format HH:MM:SS (dari database Excel)
        if (/^\d{2}:\d{2}:\d{2}$/.test(val)) {
            return val.substring(0, 5);
        }
        // Jika berupa Date object
        if (val instanceof Date) {
            const h = String(val.getHours()).padStart(2, '0');
            const m = String(val.getMinutes()).padStart(2, '0');
            return h + ':' + m;
        }
        // Jika string mengandung T (ISO)
        if (typeof val === 'string' && val.includes('T')) {
            try {
                const d = new Date(val);
                // Gunakan UTC hours karena spreadsheet menyimpan waktu dalam UTC
                const h = String(d.getUTCHours()).padStart(2, '0');
                const m = String(d.getUTCMinutes()).padStart(2, '0');
                return h + ':' + m;
            } catch(e) {
                return '09:00';
            }
        }
        // Fallback: ambil 5 karakter pertama
        return String(val).substring(0, 5);
    },

    initForms() {
        const companyForm = document.getElementById('company-form');
        if (companyForm) companyForm.addEventListener('submit', (e) => this.saveCompany(e));
        
        const addShiftBtn = document.getElementById('btn-add-shift');
        if (addShiftBtn) addShiftBtn.addEventListener('click', () => this.addShift());
        
        const saveWorkdaysBtn = document.getElementById('btn-save-workdays');
        if (saveWorkdaysBtn) saveWorkdaysBtn.addEventListener('click', () => this.saveWorkdays());
        
        const saveSystemBtn = document.getElementById('btn-save-system');
        if (saveSystemBtn) saveSystemBtn.addEventListener('click', () => this.saveSystemSettings());
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
            if (results.some(r => !r || !r.success)) {
                throw new Error('Gagal menyimpan data perusahaan');
            }
            updateCompanyUI();
            toast.success('Informasi perusahaan disimpan ke database');
        } catch (error) {
            console.error('Save company error:', error);
            toast.error(error.message || 'Gagal menyimpan ke database');
        }
    },

    async saveWorkdays() {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
        const workdays = {};
        days.forEach(day => {
            const el = document.getElementById(`day-${day}`);
            workdays[day] = el ? el.checked : false;
        });
        try {
            const result = await api.saveSetting('working_days', JSON.stringify(workdays));
            if (!result || !result.success) {
                throw new Error(result?.error || 'Gagal menyimpan hari kerja');
            }
            toast.success('Hari kerja disimpan ke database');
        } catch (error) {
            console.error('Save workdays error:', error);
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
            if (results.some(r => !r || !r.success)) {
                throw new Error('Gagal menyimpan pengaturan sistem');
            }
            toast.success('Pengaturan sistem disimpan ke database');
        } catch (error) {
            console.error('Save system settings error:', error);
            toast.error(error.message || 'Gagal menyimpan ke database');
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
                <button type="button" class="btn-delete-shift" onclick="settings.deleteShift(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    async addShift() {
        const newShift = { name: 'Shift Baru', startTime: '09:00', endTime: '18:00' };
        try {
            const result = await api.addShift(newShift);
            if (!result || !result.success) {
                throw new Error(result?.error || 'Gagal menambah shift');
            }
            this.shifts.push(result.data);
            this.renderShifts();
            storage.set('shifts', this.shifts);
            toast.success('Shift ditambahkan ke database');
        } catch (error) {
            console.error('Add shift error:', error);
            toast.error(error.message || 'Gagal menambah shift');
        }
    },

    async updateShift(index, field, value) {
        if (!this.shifts[index]) return;
        const oldValue = this.shifts[index][field];
        this.shifts[index][field] = value;
        try {
            const result = await api.updateShift(this.shifts[index].id, { [field]: value });
            if (!result || !result.success) {
                throw new Error(result?.error || 'Gagal update shift');
            }
            storage.set('shifts', this.shifts);
            toast.success('Shift diperbarui di database');
        } catch (error) {
            // Kembalikan nilai lama
            this.shifts[index][field] = oldValue;
            this.renderShifts();
            toast.error(error.message || 'Gagal update shift');
        }
    },

    async deleteShift(index) {
        if (!confirm('Hapus shift ini? Tindakan ini tidak dapat dibatalkan.')) return;
        try {
            const result = await api.deleteShift(this.shifts[index].id);
            if (!result || !result.success) {
                throw new Error(result?.error || 'Gagal hapus shift');
            }
            this.shifts.splice(index, 1);
            this.renderShifts();
            storage.set('shifts', this.shifts);
            toast.info('Shift dihapus dari database');
        } catch (error) {
            console.error('Delete shift error:', error);
            toast.error(error.message || 'Gagal hapus shift');
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

// Global init function
window.initSettings = () => { settings.init(); };
window.settings = settings;
