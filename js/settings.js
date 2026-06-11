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
        loadingIndicator.show('Memuat pengaturan...');
        await this.loadSettings();
        loadingIndicator.hide();
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

            // Location settings
            const latInput = document.getElementById('company-lat');
            const lngInput = document.getElementById('company-lng');
            const radiusInput = document.getElementById('company-radius');
            if (latInput) latInput.value = allSettings.company_lat || '';
            if (lngInput) lngInput.value = allSettings.company_lng || '';
            if (radiusInput) radiusInput.value = allSettings.company_radius || 100;

            // Contact & General info
            const addressInput = document.getElementById('company-address');
            const phoneInput = document.getElementById('company-phone');
            const emailInput = document.getElementById('company-email');
            const hoursInput = document.getElementById('company-hours');
            if (addressInput) addressInput.value = allSettings.company_address || '';
            if (phoneInput) phoneInput.value = allSettings.company_phone || '';
            if (emailInput) emailInput.value = allSettings.company_email || '';
            if (hoursInput) hoursInput.value = allSettings.company_hours || '';

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
            }

            // ========== SETTING LAINNYA ==========
            const earlyThreshold = (allSettings.early_in_threshold !== undefined && allSettings.early_in_threshold !== null) ? allSettings.early_in_threshold : '60';
            const diligentThreshold = (allSettings.diligent_threshold !== undefined && allSettings.diligent_threshold !== null) ? allSettings.diligent_threshold : '30';
            const lateTolerance = (allSettings.late_tolerance !== undefined && allSettings.late_tolerance !== null) ? allSettings.late_tolerance : 15;
            const outsideTolerance = (allSettings.outside_tolerance !== undefined && allSettings.outside_tolerance !== null) ? allSettings.outside_tolerance : 120;
            
            const earlyInput = document.getElementById('setting-early-threshold');
            const diligentInput = document.getElementById('setting-diligent-threshold');
            const toleranceInput = document.getElementById('setting-late-tolerance');
            const outsideInput = document.getElementById('setting-outside-tolerance');
            
            if (earlyInput) earlyInput.value = earlyThreshold;
            if (diligentInput) diligentInput.value = diligentThreshold;
            if (toleranceInput) toleranceInput.value = lateTolerance;
            if (outsideInput) outsideInput.value = outsideTolerance;

            const faceRecognition = (allSettings.face_recognition === 'true' || allSettings.face_recognition === true || allSettings.face_recognition === 'TRUE');
            const faceCheckbox = document.getElementById('setting-face-recognition');
            if (faceCheckbox) faceCheckbox.checked = faceRecognition;

            const locationTracking = (allSettings.location_tracking === 'true' || allSettings.location_tracking === true || allSettings.location_tracking === 'TRUE');
            const locationCheckbox = document.getElementById('setting-location-tracking');
            if (locationCheckbox) locationCheckbox.checked = locationTracking;

            // Load pengaturan tampilan login
            const loginLogoUrl = document.getElementById('login-logo-url');
            const loginCompanyName = document.getElementById('login-company-name-input');
            const loginTagline = document.getElementById('login-tagline');
            const logoShape = document.getElementById('logo-shape');
            const logoShadow = document.getElementById('logo-shadow');
            const loginAnimation = document.getElementById('login-animation');
            const loginLogoSize = document.getElementById('login-logo-size');
            const sidebarLogoSize = document.getElementById('sidebar-logo-size');

            if (loginLogoUrl) loginLogoUrl.value = allSettings.login_logo_url || '';
            if (loginCompanyName) loginCompanyName.value = allSettings.login_company_name || '';
            if (loginTagline) loginTagline.value = allSettings.login_tagline || '';
            if (logoShape) logoShape.value = allSettings.login_logo_shape || 'rounded-full';
            if (logoShadow) logoShadow.value = allSettings.login_logo_shadow || 'true';
            if (loginAnimation) loginAnimation.value = allSettings.login_animation_effect || 'float';
            if (loginLogoSize) loginLogoSize.value = allSettings.login_logo_size || '120';
            if (sidebarLogoSize) sidebarLogoSize.value = allSettings.sidebar_logo_size || '32';

            // Default leave balance
            const defaultLeaveBalance = allSettings.default_leave_balance || '12';
            const defaultBalanceInput = document.getElementById('default-leave-balance');
            if (defaultBalanceInput) defaultBalanceInput.value = defaultLeaveBalance;
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

        // Contact form
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => this.saveContactSettings(e));
        }

        // Location settings form
        const locationSettingsForm = document.getElementById('location-settings-form');
        if (locationSettingsForm) {
            locationSettingsForm.addEventListener('submit', (e) => this.saveLocationSettings(e));
        }

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

        // Login display form
        const loginDisplayForm = document.getElementById('login-display-form');
        if (loginDisplayForm) {
            loginDisplayForm.addEventListener('submit', (e) => this.saveLoginDisplaySettings(e));
        }

        // Default leave balance button
        const saveDefaultLeaveBtn = document.getElementById('btn-save-default-leave');
        if (saveDefaultLeaveBtn) {
            saveDefaultLeaveBtn.addEventListener('click', () => this.saveDefaultLeaveBalance());
        }
    },

    async saveCompany(e) {
        e.preventDefault();
        const name = document.getElementById('company-name').value;
        const logo = document.getElementById('company-logo').value;
        try {
            loadingIndicator.show('Menyimpan informasi perusahaan...');
            const results = await Promise.all([
                api.saveSetting('company_name', name),
                api.saveSetting('company_logo', logo)
            ]);
            loadingIndicator.hide();
            if (results.some(r => !r || !r.success)) throw new Error('Gagal menyimpan');
            
            // 🔥 Ambil ulang data terbaru dari server dan update storage + UI
            if (window.refreshCompanyData) {
                await window.refreshCompanyData();
            } else {
                // fallback: update manual dan panggil updateCompanyUI
                const company = storage.get('company', {});
                company.name = name;
                company.logo = logo;
                storage.set('company', company);
                if (window.updateCompanyUI) window.updateCompanyUI();
            }
            
            toast.success('Informasi perusahaan disimpan ke database');
        } catch (error) {
            loadingIndicator.hide();
            console.error(error);
            toast.error(error.message || 'Gagal menyimpan');
        }
    },

    async saveContactSettings(e) {
        e.preventDefault();
        const address = document.getElementById('company-address').value;
        const phone = document.getElementById('company-phone').value;
        const email = document.getElementById('company-email').value;
        const hours = document.getElementById('company-hours').value;

        try {
            loadingIndicator.show('Menyimpan pengaturan kontak...');
            const results = await Promise.all([
                api.saveSetting('company_address', address),
                api.saveSetting('company_phone', phone),
                api.saveSetting('company_email', email),
                api.saveSetting('company_hours', hours)
            ]);
            if (results.some(r => !r || !r.success)) throw new Error('Gagal menyimpan');
            
            // Refresh data perusahaan agar semua pengguna mendapat update
            if (window.refreshCompanyData) await window.refreshCompanyData();
            
            loadingIndicator.hide();
            toast.success('Pengaturan kontak berhasil disimpan!');
        } catch (error) {
            loadingIndicator.hide();
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
            loadingIndicator.show('Menyimpan hari kerja...');
            const result = await api.saveSetting('working_days', jsonString);
            loadingIndicator.hide();
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
            loadingIndicator.hide();
            console.error('[Settings] Save workdays error:', error);
            toast.error(error.message || 'Gagal menyimpan ke database');
        }
    },

    async saveSystemSettings() {
        const earlyThreshold = document.getElementById('setting-early-threshold').value;
        const diligentThreshold = document.getElementById('setting-diligent-threshold').value;
        const lateTolerance = document.getElementById('setting-late-tolerance').value;
        const outsideTolerance = document.getElementById('setting-outside-tolerance').value;
        const faceRecognition = document.getElementById('setting-face-recognition').checked;
        const locationTracking = document.getElementById('setting-location-tracking').checked;
        try {
            loadingIndicator.show('Menyimpan pengaturan sistem...');
            const results = await Promise.all([
                api.saveSetting('early_in_threshold', earlyThreshold),
                api.saveSetting('diligent_threshold', diligentThreshold),
                api.saveSetting('late_tolerance', lateTolerance),
                api.saveSetting('outside_tolerance', outsideTolerance),
                api.saveSetting('face_recognition', String(faceRecognition)),
                api.saveSetting('location_tracking', String(locationTracking))
            ]);
            loadingIndicator.hide();
            if (results.some(r => !r || !r.success)) throw new Error('Gagal menyimpan');
            toast.success('Pengaturan sistem disimpan ke database');
        } catch (error) {
            loadingIndicator.hide();
            console.error(error);
            toast.error(error.message || 'Gagal menyimpan');
        }
    },

    async saveLocationSettings(e) {
        e.preventDefault();
        const lat = parseFloat(document.getElementById('company-lat').value);
        const lng = parseFloat(document.getElementById('company-lng').value);
        const radius = parseInt(document.getElementById('company-radius').value);
        
        if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
            toast.error('Isi semua field dengan benar');
            return;
        }
        
        try {
            loadingIndicator.show('Menyimpan pengaturan lokasi...');
            const result = await api.request('saveLocationSettings', { lat, lng, radius });
            loadingIndicator.hide();
            if (!result || !result.success) throw new Error(result?.error || 'Gagal menyimpan');
            toast.success('Pengaturan lokasi disimpan');
        } catch (error) {
            loadingIndicator.hide();
            console.error(error);
            toast.error(error.message || 'Gagal menyimpan');
        }
    },

    async saveLoginDisplaySettings(e) {
        e.preventDefault();
        const logoUrl = document.getElementById('login-logo-url').value;
        const companyName = document.getElementById('login-company-name-input').value;
        const tagline = document.getElementById('login-tagline').value;
        const shape = document.getElementById('logo-shape').value;
        const shadow = document.getElementById('logo-shadow').value;
        const animation = document.getElementById('login-animation').value;
        const loginLogoSize = document.getElementById('login-logo-size').value;
        const sidebarLogoSize = document.getElementById('sidebar-logo-size').value;

        try {
            loadingIndicator.show('Menyimpan pengaturan tampilan...');
            const results = await Promise.all([
                api.saveSetting('login_logo_url', logoUrl),
                api.saveSetting('login_company_name', companyName),
                api.saveSetting('login_tagline', tagline),
                api.saveSetting('login_logo_shape', shape),
                api.saveSetting('login_logo_shadow', shadow),
                api.saveSetting('login_animation_effect', animation),
                api.saveSetting('login_logo_size', loginLogoSize),
                api.saveSetting('sidebar_logo_size', sidebarLogoSize)
            ]);
            if (results.some(r => !r || !r.success)) throw new Error('Gagal menyimpan');

            // Refresh data perusahaan agar semua pengguna mendapat update
            if (window.refreshCompanyData) await window.refreshCompanyData();
            
            loadingIndicator.hide();
            toast.success('Pengaturan tampilan berhasil disimpan!');
        } catch (error) {
            loadingIndicator.hide();
            toast.error(error.message);
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
            loadingIndicator.show('Menambahkan shift...');
            const result = await api.addShift(newShift);
            loadingIndicator.hide();
            if (!result || !result.success) throw new Error(result?.error || 'Gagal menambah shift');
            this.shifts.push(result.data);
            this.renderShifts();
            storage.set('shifts', this.shifts);
            toast.success('Shift ditambahkan ke database');
        } catch (error) {
            loadingIndicator.hide();
            console.error(error);
            toast.error(error.message);
        }
    },

    async updateShift(index, field, value) {
        if (!this.shifts[index]) return;
        const oldValue = this.shifts[index][field];
        this.shifts[index][field] = value;
        try {
            loadingIndicator.show('Memperbarui shift...');
            const updateData = { [field]: value };
            const result = await api.updateShift(this.shifts[index].id, updateData);
            loadingIndicator.hide();
            if (!result || !result.success) throw new Error(result?.error || 'Gagal update shift');
            storage.set('shifts', this.shifts);
            toast.success('Shift diperbarui di database');
        } catch (error) {
            loadingIndicator.hide();
            this.shifts[index][field] = oldValue;
            this.renderShifts();
            toast.error(error.message);
        }
    },

    async deleteShift(index) {
        if (!confirm('Hapus shift ini? Tindakan ini tidak dapat dibatalkan.')) return;
        try {
            loadingIndicator.show('Menghapus shift...');
            const result = await api.deleteShift(this.shifts[index].id);
            loadingIndicator.hide();
            if (!result || !result.success) throw new Error(result?.error || 'Gagal hapus shift');
            this.shifts.splice(index, 1);
            this.renderShifts();
            storage.set('shifts', this.shifts);
            toast.info('Shift dihapus dari database');
        } catch (error) {
            loadingIndicator.hide();
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
    },

    async saveDefaultLeaveBalance() {
        const value = document.getElementById('default-leave-balance').value;
        if (!value) {
            toast.error('Masukkan nilai cuti');
            return;
        }
        try {
            loadingIndicator.show('Menyimpan default cuti...');
            const result = await api.saveSetting('default_leave_balance', value);
            if (result.success) {
                toast.success('Default cuti disimpan');
            } else {
                toast.error(result.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('Save default leave error:', error);
            toast.error('Terjadi kesalahan');
        } finally {
            loadingIndicator.hide();
        }
    }
};

window.initSettings = () => { settings.init(); };
window.settings = settings;
