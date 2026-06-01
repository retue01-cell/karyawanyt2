/**
 * Portal Karyawan - Settings
 * Admin settings functionality - fully sync with database (Excel)
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
            
            // Proses shifts - konversi format waktu "HH:MM:SS" ke "HH:MM"
            this.shifts = (shiftsResult.data || []).map(shift => ({
                id: shift.id,
                name: shift.name,
                startTime: this.normalizeTime(shift.startTime),
                endTime: this.normalizeTime(shift.endTime)
            }));
            
            if (this.shifts.length) {
                storage.set('shifts', this.shifts);
            }
            
            const allSettings = settingsResult.data || {};
            
            // Company info
            const companyNameInput = document.getElementById('company-name');
            const companyLogoInput = document.getElementById('company-logo');
            if (companyNameInput) companyNameInput.value = allSettings.company_name || '';
            if (companyLogoInput) companyLogoInput.value = allSettings.company_logo || '';
            
            // ========== WORKING DAYS (HARI KERJA) ==========
            const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            const workdaysRaw = allSettings.working_days;
            
            console.log('Raw working_days dari database:', workdaysRaw);
            
            let workdays = null;
            if (workdaysRaw && typeof workdaysRaw === 'string') {
                // Coba parse JSON, mungkin ada spasi atau newline
                let jsonStr = workdaysRaw.trim();
                // Hapus karakter BOM jika ada
                if (jsonStr.charCodeAt(0) === 0xFEFF) jsonStr = jsonStr.slice(1);
                try {
                    workdays = JSON.parse(jsonStr);
                    console.log('Parsing berhasil:', workdays);
                } catch (e) {
                    console.error('Parse error:', e);
                    // Coba perbaiki: ganti kutip tidak standar
                    try {
                        const fixed = jsonStr.replace(/'/g, '"');
                        workdays = JSON.parse(fixed);
                        console.log('Parsing dengan perbaikan kutip berhasil:', workdays);
                    } catch (e2) {
                        console.error('Gagal juga:', e2);
                        workdays = null;
                    }
                }
            } else if (workdaysRaw && typeof workdaysRaw === 'object') {
                workdays = workdaysRaw;
                console.log('Langsung object:', workdays);
            }
            
            if (workdays && typeof workdays === 'object') {
                // Data valid -> terapkan ke checkbox
                days.forEach(day => {
                    const el = document.getElementById(`day-${day}`);
                    if (el) {
                        const val = workdays[day];
                        el.checked = (val === true || val === 'true' || val === 1);
                    }
                });
                console.log('Hari kerja berhasil dimuat dari database:', workdays);
                // Hapus pesan error jika ada
                const errorDiv = document.querySelector('.workdays-error');
                if (errorDiv) errorDiv.remove();
                toast.success('Hari kerja dimuat dari database');
            } else {
                // Data tidak valid, tampilkan error permanen
                console.error('Working days tidak valid:', workdaysRaw);
                const workdaysContainer = document.querySelector('.working-days');
                if (workdaysContainer && !document.querySelector('.workdays-error')) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'workdays-error';
                    errorDiv.style.cssText = 'background:rgba(239,68,68,0.1); color:#EF4444; padding:8px; border-radius:8px; margin-bottom:16px; font-size:13px;';
                    errorDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Data hari kerja di database rusak atau tidak valid. Silakan perbaiki format JSON di sheet Settings.';
                    workdaysContainer.prepend(errorDiv);
                }
                toast.error('Data hari kerja tidak valid, periksa database');
            }
            
            // ========== SETTING LAINNYA ==========
            let lateTolerance = allSettings.late_tolerance;
            if (lateTolerance === undefined || lateTolerance === null) {
                lateTolerance = 15;
            }
            const toleranceInput = document.getElementById('setting-late-tolerance');
            if (toleranceInput) toleranceInput.value = lateTolerance;
            
            let faceRecognition = allSettings.face_recognition;
            if (faceRecognition === undefined || faceRecognition === null) {
                faceRecognition = true;
            } else {
                faceRecognition = (faceRecognition === 'true' || faceRecognition === true || faceRecognition === 'TRUE');
            }
            const faceCheckbox = document.getElementById('setting-face-recognition');
            if (faceCheckbox) faceCheckbox.checked = faceRecognition;
            
            let locationTracking = allSettings.location_tracking;
            if (locationTracking === undefined || locationTracking === null) {
                locationTracking = true;
            } else {
                locationTracking = (locationTracking === 'true' || locationTracking === true || locationTracking === 'TRUE');
            }
            const locationCheckbox = document.getElementById('setting-location-tracking');
            if (locationCheckbox) locationCheckbox.checked = locationTracking;
            
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

    normalizeTime(val) {
        if (!val) return '09:00';
        if (/^\d{2}:\d{2}$/.test(val)) return val;
        if (/^\d{2}:\d{2}:\d{2}$/.test(val)) {
            return val.substring(0, 5);
        }
        if (val instanceof Date) {
            const h = String(val.getHours()).padStart(2, '0');
            const m = String(val.getMinutes()).padStart(2, '0');
            return h + ':' + m;
        }
        if (typeof val === 'string' && val.includes('T')) {
            try {
                const d = new Date(val);
                const h = String(d.getUTCHours()).padStart(2, '0');
                const m = String(d.getUTCMinutes()).padStart(2, '0');
                return h + ':' + m;
            } catch(e) {
                return '09:00';
            }
        }
        return String(val).substring(0, 5);
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
        
        console.log('Menyimpan working days:', workdays);
        
        try {
            const jsonString = JSON.stringify(workdays);
            const result = await api.saveSetting('working_days', jsonString);
            
            if (!result || !result.success) {
                throw new Error(result?.error || 'Gagal menyimpan hari kerja');
            }
            
            toast.success('Hari kerja disimpan ke database');
            
            // Verifikasi dengan membaca ulang
            const verifyResult = await api.getSettings();
            if (verifyResult.success && verifyResult.data.working_days) {
                let saved = null;
                try {
                    saved = JSON.parse(verifyResult.data.working_days);
                } catch(e) {
                    console.error('Verifikasi parse error:', e);
                }
                if (saved && JSON.stringify(saved) === jsonString) {
                    toast.success('Verifikasi berhasil: data tersimpan permanen');
                } else {
                    toast.warning('Data tersimpan tidak sesuai, coba refresh halaman');
                }
            }
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
