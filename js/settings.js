/**
 * Portal Karyawan - Settings
 * Admin settings functionality (with working days sync fix)
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
            
            // Proses shifts
            this.shifts = (shiftsResult.data || []).map(shift => ({
                ...shift,
                startTime: this.normalizeTime(shift.startTime),
                endTime: this.normalizeTime(shift.endTime)
            }));
            
            const allSettings = settingsResult.data || {};
            
            // Isi form company
            document.getElementById('company-name').value = allSettings.company_name || '';
            document.getElementById('company-logo').value = allSettings.company_logo || '';
            
            // ========== PERBAIKAN: Sinkronisasi Hari Kerja ==========
            let workdays = null;
            if (allSettings.working_days) {
                try {
                    workdays = JSON.parse(allSettings.working_days);
                } catch (e) {
                    console.error('Gagal parsing working_days dari database:', e);
                    workdays = null;
                }
            }
            
            const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            
            if (workdays) {
                // Data dari database tersedia -> terapkan ke checkbox
                days.forEach(day => {
                    const el = document.getElementById(`day-${day}`);
                    if (el) {
                        // Pastikan nilai boolean
                        el.checked = workdays[day] === true;
                    }
                });
                console.log('Hari kerja dimuat dari database:', workdays);
            } else {
                // Tidak ada data working_days di database -> gunakan nilai checkbox saat ini (default HTML)
                // lalu simpan ke database agar sinkron ke depan
                const currentWorkdays = {};
                days.forEach(day => {
                    const el = document.getElementById(`day-${day}`);
                    currentWorkdays[day] = el ? el.checked : false;
                });
                // Simpan ke database
                await api.saveSetting('working_days', JSON.stringify(currentWorkdays));
                // Simpan juga ke localStorage sebagai cadangan
                storage.set('working_days', currentWorkdays);
                console.log('Working days default telah disimpan ke database:', currentWorkdays);
            }
            // ========== AKHIR PERBAIKAN ==========
            
            // Setting lainnya (late_tolerance, face_recognition, location_tracking)
            if (allSettings.late_tolerance !== undefined) {
                document.getElementById('setting-late-tolerance').value = allSettings.late_tolerance;
            } else {
                // Default 15 menit jika tidak ada di database
                document.getElementById('setting-late-tolerance').value = 15;
            }
            
            if (allSettings.face_recognition !== undefined) {
                const isFace = allSettings.face_recognition === 'true' || allSettings.face_recognition === true;
                document.getElementById('setting-face-recognition').checked = isFace;
            } else {
                document.getElementById('setting-face-recognition').checked = true; // default true
            }
            
            if (allSettings.location_tracking !== undefined) {
                const isLoc = allSettings.location_tracking === 'true' || allSettings.location_tracking === true;
                document.getElementById('setting-location-tracking').checked = isLoc;
            } else {
                document.getElementById('setting-location-tracking').checked = true; // default true
            }
            
        } catch (error) {
            console.error('Error loading settings (fallback ke localStorage):', error);
            toast.error('Gagal memuat pengaturan dari server. Menggunakan data lokal.');
            
            // Fallback ke localStorage jika API benar-benar gagal
            const savedWorkdays = storage.get('working_days');
            if (savedWorkdays) {
                const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
                days.forEach(day => {
                    const el = document.getElementById(`day-${day}`);
                    if (el) el.checked = savedWorkdays[day] === true;
                });
            }
            
            // Fallback shifts
            this.shifts = storage.get('shifts', []);
            const company = storage.get('company', { name: '', logo: '' });
            document.getElementById('company-name').value = company.name;
            document.getElementById('company-logo').value = company.logo;
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
            try { 
                const d = new Date(str); 
                const h = String(d.getUTCHours()+7).padStart(2,'0'); 
                const m = String(d.getUTCMinutes()).padStart(2,'0'); 
                return h+':'+m; 
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
        await Promise.all([
            api.saveSetting('company_name', name),
            api.saveSetting('company_logo', logo)
        ]);
        storage.set('company', { name, logo });
        updateCompanyUI();
        toast.success('Informasi perusahaan disimpan');
    },

    async saveWorkdays() {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
        const workdays = {};
        days.forEach(day => {
            workdays[day] = document.getElementById(`day-${day}`).checked;
        });
        
        try {
            await api.saveSetting('working_days', JSON.stringify(workdays));
            // Simpan juga ke localStorage untuk fallback
            storage.set('working_days', workdays);
            toast.success('Hari kerja disimpan');
        } catch (error) {
            console.error('Gagal menyimpan working days ke server:', error);
            toast.error('Gagal menyimpan ke server, tetapi tersimpan di lokal');
            storage.set('working_days', workdays);
        }
    },

    async saveSystemSettings() {
        const lateTolerance = document.getElementById('setting-late-tolerance').value;
        const faceRecognition = document.getElementById('setting-face-recognition').checked;
        const locationTracking = document.getElementById('setting-location-tracking').checked;
        
        try {
            await Promise.all([
                api.saveSetting('late_tolerance', lateTolerance),
                api.saveSetting('face_recognition', String(faceRecognition)),
                api.saveSetting('location_tracking', String(locationTracking))
            ]);
            toast.success('Pengaturan sistem disimpan');
        } catch (error) {
            console.error('Gagal menyimpan sistem settings:', error);
            toast.error('Gagal menyimpan ke server');
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
        const result = await api.addShift(newShift);
        if (result.success) { 
            this.shifts.push(result.data); 
            this.renderShifts(); 
            toast.success('Shift ditambahkan'); 
        } else {
            toast.error(result.error || 'Gagal menambah shift');
        }
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
