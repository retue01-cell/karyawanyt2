/**
 * Portal Karyawan - Settings
 * Admin settings functionality - always sync with database, show error on failure
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
            // Ambil data settings dan shifts dari API
            const [settingsResult, shiftsResult] = await Promise.all([
                api.getSettings(),
                api.getShifts()
            ]);
            
            // Validasi response
            if (!settingsResult.success) {
                throw new Error(settingsResult.error || 'Gagal memuat pengaturan dari server');
            }
            if (!shiftsResult.success) {
                throw new Error(shiftsResult.error || 'Gagal memuat data shift dari server');
            }
            
            // Proses shifts
            this.shifts = (shiftsResult.data || []).map(shift => ({
                ...shift,
                startTime: this.normalizeTime(shift.startTime),
                endTime: this.normalizeTime(shift.endTime)
            }));
            
            const allSettings = settingsResult.data || {};
            
            // Set company info
            const companyNameInput = document.getElementById('company-name');
            const companyLogoInput = document.getElementById('company-logo');
            if (companyNameInput) companyNameInput.value = allSettings.company_name || '';
            if (companyLogoInput) companyLogoInput.value = allSettings.company_logo || '';
            
            // ========== HARI KERJA ==========
            let workdays = null;
            if (allSettings.working_days) {
                try {
                    workdays = JSON.parse(allSettings.working_days);
                } catch (e) {
                    console.error('Gagal parsing working_days:', e);
                    this.showDatabaseError('Format data working_days tidak valid di database');
                    return;
                }
            } else {
                this.showDatabaseError('Data working_days tidak ditemukan di database');
                return;
            }
            
            const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            
            // Terapkan data dari database ke checkbox
            days.forEach(day => {
                const el = document.getElementById(`day-${day}`);
                if (el) el.checked = workdays[day] === true;
            });
            console.log('Hari kerja dimuat dari database:', workdays);
            
            // ========== SETTING LAINNYA ==========
            if (allSettings.late_tolerance !== undefined) {
                const toleranceInput = document.getElementById('setting-late-tolerance');
                if (toleranceInput) toleranceInput.value = allSettings.late_tolerance;
            } else {
                this.showDatabaseError('Data late_tolerance tidak ditemukan di database');
                return;
            }
            
            const faceRecognition = (allSettings.face_recognition === 'true' || allSettings.face_recognition === true);
            const faceCheckbox = document.getElementById('setting-face-recognition');
            if (faceCheckbox) faceCheckbox.checked = faceRecognition;
            
            const locationTracking = (allSettings.location_tracking === 'true' || allSettings.location_tracking === true);
            const locationCheckbox = document.getElementById('setting-location-tracking');
            if (locationCheckbox) locationCheckbox.checked = locationTracking;
            
            toast.success('Pengaturan berhasil dimuat dari database');
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showDatabaseError(error.message || 'Terjadi kesalahan saat mengambil data dari server');
        }
    },
    
    // Menampilkan error di UI dan menyembunyikan form
    showDatabaseError(message) {
        const settingsContainer = document.querySelector('.settings-container');
        if (settingsContainer) {
            settingsContainer.innerHTML = `
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
    
    // Fungsi untuk mencoba memuat ulang
    retryLoad() {
        window.location.reload();
    },

    // Normalisasi waktu tanpa offset (karena data dari Google Sheets sudah dalam UTC)
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
            try {
                const d = new Date(str);
                // Gunakan UTC hours karena spreadsheet menyimpan waktu dalam UTC
                const h = String(d.getUTCHours()).padStart(2, '0');
                const m = String(d.getUTCMinutes()).padStart(2, '0');
                return h + ':' + m;
            } catch(e) {
                return '09:00';
            }
        }
        return str;
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
            if (el) workdays[day] = el.checked;
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
                    <input type="text" value="${this.escapeHtml(shift.name)}" placeholder="Nama Shift" 
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
            toast.success('Shift diperbarui di database');
        } catch (error) {
            console.error('Update shift error:', error);
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
