/**
 * Portal Karyawan - Main JavaScript
 * Utility functions and shared functionality
 */

// Storage Manager
const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    clear() {
        localStorage.clear();
    }
};

// Toast Notification System
const toast = {
    container: null,

    init() {
        this.container = document.getElementById('toast-container');
    },

    show(message, type = 'info', title = '', duration = 3000) {
        if (!this.container) this.init();

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const titles = {
            success: 'Berhasil',
            error: 'Error',
            warning: 'Peringatan',
            info: 'Info'
        };

        const toastEl = document.createElement('div');
        toastEl.className = `toast ${type}`;
        toastEl.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title || titles[type]}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.container.appendChild(toastEl);

        // Auto remove
        setTimeout(() => {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateX(100%)';
            setTimeout(() => toastEl.remove(), 300);
        }, duration);
    },

    success(message, title) {
        this.show(message, 'success', title);
    },

    error(message, title) {
        this.show(message, 'error', title);
    },

    warning(message, title) {
        this.show(message, 'warning', title);
    },

    info(message, title) {
        this.show(message, 'info', title);
    }
};

// Date & Time Utilities
const dateTime = {
    formatDate(date, format = 'full') {
        const d = new Date(date);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const dayName = days[d.getDay()];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();

        if (format === 'full') {
            return `${dayName}, ${day} ${month} ${year}`;
        } else if (format === 'short') {
            const monthShort = months[d.getMonth()] ? months[d.getMonth()].substring(0, 3) : '';
            return `${day} ${monthShort} ${year}`;
        } else if (format === 'day') {
            return dayName;
        }
        return `${day}/${d.getMonth() + 1}/${year}`;
    },

    formatTime(date) {
        const d = new Date(date);
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    },

    formatDateTime(date) {
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    getCurrentTime() {
        return new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    getCurrentDate() {
        return this.formatDate(new Date());
    },

    getLocalDate() {
        // Menggunakan timezone Asia/Jakarta untuk konsistensi dengan backend
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    },

    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 11) return 'Selamat Pagi';
        if (hour < 15) return 'Selamat Siang';
        if (hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    },

    calculateDuration(start, end) {
        if (!start || !end) return '0j 0m';
        
        // Konversi titik ke titik dua (format Indonesia ke format standar)
        const cleanStart = String(start).replace(/\./g, ':');
        const cleanEnd = String(end).replace(/\./g, ':');
        
        // Ambil hanya HH:MM (abaikan detik jika ada)
        const startStr = cleanStart.substring(0, 5);
        const endStr = cleanEnd.substring(0, 5);
        
        const startTime = new Date(`2000-01-01 ${startStr}`);
        const endTime = new Date(`2000-01-01 ${endStr}`);
        
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return '0j 0m';
        
        let diff = endTime - startTime;
        
        // Handle overnight shifts (if end time is less than start time, add 24 hours)
        if (diff < 0) {
            diff += 24 * 60 * 60 * 1000;
        }
        
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        
        return `${hours}j ${minutes}m`;
    }
};

// Form Utilities
const formUtils = {
    serialize(form) {
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        return data;
    },

    validate(form) {
        const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                isValid = false;
                input.classList.add('error');
                input.addEventListener('input', () => input.classList.remove('error'), { once: true });
            }
        });

        return isValid;
    },

    clear(form) {
        form.reset();
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    }
};

// Animation Utilities
const animations = {
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        element.style.transition = `opacity ${duration}ms ease`;

        requestAnimationFrame(() => {
            element.style.opacity = '1';
        });
    },

    fadeOut(element, duration = 300) {
        element.style.transition = `opacity ${duration}ms ease`;
        element.style.opacity = '0';

        setTimeout(() => {
            element.style.display = 'none';
        }, duration);
    },

    slideDown(element, duration = 300) {
        element.style.maxHeight = '0';
        element.style.overflow = 'hidden';
        element.style.transition = `max-height ${duration}ms ease`;

        requestAnimationFrame(() => {
            element.style.maxHeight = element.scrollHeight + 'px';
        });
    }
};

// Initialize default data
function initializeData() {
    // Company settings
    if (!storage.get('company')) {
        storage.set('company', {
            name: 'Portal Karyawan',
            logo: ''
        });
    }

    // Shifts
    if (!storage.get('shifts')) {
        storage.set('shifts', [
            { id: 1, name: 'Pagi', startTime: '08:00', endTime: '17:00' },
            { id: 2, name: 'Siang', startTime: '14:00', endTime: '23:00' },
            { id: 3, name: 'Malam', startTime: '23:00', endTime: '08:00' }
        ]);
    }

    // Dummy attendance data
    if (!storage.get('attendance')) {
        storage.set('attendance', [
            { date: '2026-03-06', shift: 'Pagi', clockIn: '07:55', clockOut: '17:15', status: 'ontime' },
            { date: '2026-03-05', shift: 'Pagi', clockIn: '08:10', clockOut: '17:05', status: 'late' },
            { date: '2026-03-04', shift: 'Pagi', clockIn: '07:50', clockOut: '17:20', status: 'ontime' }
        ]);
    }

    // Dummy jurnal data
    if (!storage.get('jurnals')) {
        storage.set('jurnals', [
            {
                date: '2026-03-06',
                tasks: 'Mengerjakan fitur dashboard, meeting dengan tim development',
                achievements: 'Selesai membuat komponen chart',
                obstacles: 'Kendala pada integrasi API',
                plan: 'Melanjutkan integrasi API'
            },
            {
                date: '2026-03-05',
                tasks: 'Fix bug pada modul absensi, update UI',
                achievements: 'Bug fixed',
                obstacles: '',
                plan: 'Testing'
            }
        ]);
    }

    // Dummy leave data
    if (!storage.get('leaves')) {
        storage.set('leaves', [
            {
                id: 1,
                type: 'annual',
                typeLabel: 'Cuti Tahunan',
                startDate: '2026-03-15',
                endDate: '2026-03-17',
                duration: 3,
                reason: 'Liburan keluarga',
                status: 'pending',
                appliedAt: '2026-03-01'
            },
            {
                id: 2,
                type: 'sick',
                typeLabel: 'Cuti Sakit',
                startDate: '2026-02-20',
                endDate: '2026-02-20',
                duration: 1,
                reason: 'Demam dan flu',
                status: 'approved',
                appliedAt: '2026-02-19'
            },
            {
                id: 3,
                type: 'important',
                typeLabel: 'Cuti Penting',
                startDate: '2026-02-10',
                endDate: '2026-02-10',
                duration: 1,
                reason: 'Urusan keluarga',
                status: 'rejected',
                appliedAt: '2026-02-08'
            }
        ]);
    }

    // Dummy izin data
    if (!storage.get('izin')) {
        storage.set('izin', []);
    }

    // Dummy admin employees data
    if (!storage.get('admin_employees')) {
        storage.set('admin_employees', [
            { id: 1, name: 'Ahmad Rizky', email: 'ahmad@company.com', department: 'IT', position: 'Developer', shift: 'Pagi', status: 'active', joinDate: '2024-01-15', avatar: 'https://ui-avatars.com/api/?name=Ahmad&background=3B82F6&color=fff' },
            { id: 2, name: 'Budi Santoso', email: 'budi@company.com', department: 'HR', position: 'HR Manager', shift: 'Pagi', status: 'active', joinDate: '2023-06-01', avatar: 'https://ui-avatars.com/api/?name=Budi&background=10B981&color=fff' },
            { id: 3, name: 'Citra Dewi', email: 'citra@company.com', department: 'Finance', position: 'Accountant', shift: 'Pagi', status: 'on-leave', joinDate: '2024-03-10', avatar: 'https://ui-avatars.com/api/?name=Citra&background=F59E0B&color=fff' },
            { id: 4, name: 'Dedi Pratama', email: 'dedi@company.com', department: 'Marketing', position: 'Marketing Staff', shift: 'Siang', status: 'active', joinDate: '2024-02-20', avatar: 'https://ui-avatars.com/api/?name=Dedi&background=EF4444&color=fff' },
            { id: 5, name: 'Eka Putri', email: 'eka@company.com', department: 'IT', position: 'UI/UX Designer', shift: 'Pagi', status: 'active', joinDate: '2024-01-05', avatar: 'https://ui-avatars.com/api/?name=Eka&background=8B5CF6&color=fff' },
            { id: 6, name: 'Fajar Nugraha', email: 'fajar@company.com', department: 'Operations', position: 'Supervisor', shift: 'Malam', status: 'inactive', joinDate: '2023-09-12', avatar: 'https://ui-avatars.com/api/?name=Fajar&background=6B7280&color=fff' }
        ]);
    }
}

// Update company name in UI
function updateCompanyUI() {
    const company = storage.get('company', { name: 'Portal Karyawan', logo: '', tagline: '' });
    const companyName = company.name || 'Portal Karyawan';
    const companyLogo = company.logo || '';
    const tagline = company.tagline || 'Kelola kehadiran & produktivitas dengan mudah';

    // Update title
    document.title = companyName;

    // Update teks nama perusahaan di halaman login
    const loginCompanyEl = document.getElementById('login-company-name');
    if (loginCompanyEl) loginCompanyEl.textContent = companyName;

    const footerCompanyEl = document.getElementById('footer-company');
    if (footerCompanyEl) footerCompanyEl.textContent = companyName;

    const sidebarBrandEl = document.getElementById('sidebar-brand');
    if (sidebarBrandEl) {
        sidebarBrandEl.textContent = companyName;
        sidebarBrandEl.title = companyName;
    }

    // Update tagline di halaman login
    const taglineEl = document.querySelector('.tagline');
    if (taglineEl) taglineEl.textContent = tagline;

    // Update LOGO di sidebar
    const sidebarLogoImg = document.getElementById('sidebar-logo-img');
    const sidebarLogoIcon = document.getElementById('sidebar-logo-icon');
    if (companyLogo && companyLogo.trim() !== '') {
        if (sidebarLogoImg) {
            sidebarLogoImg.src = companyLogo;
            sidebarLogoImg.style.display = 'inline-block';
        }
        if (sidebarLogoIcon) sidebarLogoIcon.style.display = 'none';
    } else {
        if (sidebarLogoImg) sidebarLogoImg.style.display = 'none';
        if (sidebarLogoIcon) sidebarLogoIcon.style.display = 'inline-block';
    }

    // Update LOGO di login page
    const loginLogoImg = document.getElementById('login-logo-img');
    const loginLogoIcon = document.getElementById('login-logo-icon');
    if (companyLogo && companyLogo.trim() !== '') {
        if (loginLogoImg) {
            loginLogoImg.src = companyLogo;
            loginLogoImg.style.display = 'block';
        }
        if (loginLogoIcon) loginLogoIcon.style.display = 'none';
    } else {
        if (loginLogoImg) loginLogoImg.style.display = 'none';
        if (loginLogoIcon) loginLogoIcon.style.display = 'flex';
    }

    // Update footer contact info
    const footerContact = document.getElementById('footer-contact');
    if (footerContact) {
        const address = storage.get('company_address', '');
        const phone = storage.get('company_phone', '');
        const hours = storage.get('company_hours', '');
        const parts = [];
        if (address) parts.push(address);
        if (phone) parts.push(`Telp: ${phone}`);
        if (hours) parts.push(hours);
        footerContact.textContent = parts.join(' | ');
    }
}

// Apply login display settings (logo shape, shadow, animation, size)
function applyLoginDisplaySettings() {
    const logoShape = storage.get('login_logo_shape', 'rounded-full');
    const hasShadow = storage.get('login_logo_shadow', true);
    const animation = storage.get('login_animation_effect', 'float');
    const loginLogoSize = storage.get('login_logo_size', '120');
    const sidebarLogoSize = storage.get('sidebar_logo_size', '32');
    
    // Apply size to login logo container (logo-core)
    const logoCore = document.querySelector('.logo-core');
    if (logoCore) {
        logoCore.style.width = `${loginLogoSize}px`;
        logoCore.style.height = `${loginLogoSize}px`;
        // Pastikan container tidak memiliki animasi
        logoCore.classList.remove('animate-float', 'animate-pulse');
    }
    
    // Apply size to sidebar logo
    const sidebarLogoImg = document.getElementById('sidebar-logo-img');
    if (sidebarLogoImg) {
        sidebarLogoImg.style.width = `${sidebarLogoSize}px`;
        sidebarLogoImg.style.height = `${sidebarLogoSize}px`;
    }
    
    // Apply shape, shadow, and animation to logo IMAGE only (not container)
    const loginLogoImg = document.getElementById('login-logo-img');
    if (loginLogoImg) {
        // Hapus class sebelumnya
        loginLogoImg.classList.remove('rounded-full', 'rounded-lg', 'rounded-none', 'shadow-lg', 'animate-float', 'animate-pulse');
        
        // Terapkan bentuk
        loginLogoImg.classList.add(logoShape);
        
        // Terapkan bayangan
        if (hasShadow) {
            loginLogoImg.classList.add('shadow-lg');
        }
        
        // 🔥 PERBAIKAN: Animasi hanya pada gambar, bukan container
        if (animation === 'float') {
            loginLogoImg.classList.add('animate-float');
        } else if (animation === 'pulse') {
            loginLogoImg.classList.add('animate-pulse');
        }
    }
    
    // Also apply shape and shadow to sidebar logo image
    if (sidebarLogoImg) {
        sidebarLogoImg.classList.remove('rounded-full', 'rounded-lg', 'rounded-none', 'shadow-lg');
        sidebarLogoImg.classList.add(logoShape);
        if (hasShadow) {
            sidebarLogoImg.classList.add('shadow-lg');
        }
    }
}

// Refresh company data from server and update UI
async function refreshCompanyData() {
    try {
        const [result, shiftsResult] = await Promise.all([
            api.getSettings(),
            api.getShifts() // Tarik konfigurasi shift terbaru sekaligus
        ]);
        
        if (result && result.success && result.data) {
            const company = {
                name: result.data.company_name || 'Portal Karyawan',
                logo: result.data.login_logo_url || result.data.company_logo || '',
                tagline: result.data.login_tagline || 'Kelola kehadiran & produktivitas dengan mudah',
                address: result.data.company_address || '',
                phone: result.data.company_phone || '',
                email: result.data.company_email || '',
                hours: result.data.company_hours || '',
                logoShape: result.data.login_logo_shape || 'rounded-full',
                logoShadow: result.data.login_logo_shadow === 'true',
                loginAnimation: result.data.login_animation_effect || 'float',
                loginLogoSize: result.data.login_logo_size || '120',
                sidebarLogoSize: result.data.sidebar_logo_size || '32'
            };
            storage.set('company', company);
            storage.set('company_address', company.address);
            storage.set('company_phone', company.phone);
            storage.set('company_email', company.email);
            storage.set('company_hours', company.hours);
            storage.set('login_tagline', company.tagline);
            // Simpan pengaturan tampilan login
            storage.set('login_logo_shape', company.logoShape);
            storage.set('login_logo_shadow', company.logoShadow);
            storage.set('login_animation_effect', company.loginAnimation);
            storage.set('login_logo_size', company.loginLogoSize);
            storage.set('sidebar_logo_size', company.sidebarLogoSize);
            
            // Simpan shift kerja yang diperbarui ke localStorage
            if (shiftsResult && shiftsResult.success && shiftsResult.data) {
                storage.set('shifts', shiftsResult.data);
            }
            
            updateCompanyUI();
            applyLoginDisplaySettings();
            console.log('Company data refreshed:', company.name, 'Logo:', company.logo);

            // 🔥 Refresh dashboard shift jika halaman dashboard sedang aktif
            if (window.dashboard && document.getElementById('page-dashboard')?.classList.contains('active')) {
                await window.dashboard.refreshShiftInfo();
            }
        }
    } catch (error) {
        console.error('Failed to refresh company data:', error);
    }
}

// Export ke global
window.refreshCompanyData = refreshCompanyData;

// DOM Ready
function onDOMReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadingIndicator.init();
    initializeData();
    updateCompanyUI();
    applyLoginDisplaySettings();

    // Refresh company data from server for login page display
    refreshCompanyData().then(() => {
        // After data refresh, update UI again with latest data
        updateCompanyUI();
        applyLoginDisplaySettings();
    });

    // Update time display
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
        setInterval(() => {
            const now = new Date();
            const time = timeEl.querySelector('.time');
            const date = timeEl.querySelector('.date');
            if (time) time.textContent = dateTime.formatTime(now);
            if (date) date.textContent = dateTime.formatDate(now);
        }, 1000);
    }
});

// Export for other modules
window.storage = storage;
window.toast = toast;
window.dateTime = dateTime;
window.formUtils = formUtils;
window.animations = animations;
window.updateCompanyUI = updateCompanyUI;
window.applyLoginDisplaySettings = applyLoginDisplaySettings;
window.onDOMReady = onDOMReady;

// Loading Indicator Manager (Global)
const loadingIndicator = {
    element: null,
    counter: 0,
    timer: null,
    minDisplayTime: 600, // Minimal 600ms agar tidak flicker
    
    init() {
        this.element = document.getElementById('loading-indicator');
    },
    
    show(message = 'Memproses data...') {
        if (!this.element) this.init();
        this.counter++;
        
        // Clear pending hide timer jika ada request baru
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.element) {
            const span = this.element.querySelector('span');
            if (span) span.textContent = message;
            this.element.classList.add('active');
        }
    },
    
    hide() {
        if (!this.element) this.init();
        this.counter--;
        
        if (this.counter <= 0) {
            this.counter = 0;
            // Delay hiding untuk memastikan minimum display time
            if (this.timer) clearTimeout(this.timer);
            
            this.timer = setTimeout(() => {
                if (this.element && this.counter === 0) {
                    this.element.classList.remove('active');
                }
                this.timer = null;
            }, this.minDisplayTime);
        }
    },

    forceHide() {
        this.counter = 0;
        if (this.timer) clearTimeout(this.timer);
        if (this.element) this.element.classList.remove('active');
    }
};

window.loadingIndicator = loadingIndicator;

// Department Manager (Global) - Menggunakan API
const departmentManager = {
    cache: [],
    
    async fetchDepartments() {
        console.log('[fetchDepartments] Memulai fetch departemen dari API');
        try {
            // Coba gunakan endpoint baru getDepartments jika tersedia
            if (api.getDepartments) {
                const result = await api.getDepartments();
                if (result.success && result.data) {
                    const departments = Array.isArray(result.data) ? result.data.sort() : [];
                    console.log('[fetchDepartments] Departemen unik dari API:', departments);
                    this.cache = departments;
                    return departments;
                }
            }
            
            // Fallback: ekstrak dari employees
            const result = await api.getEmployees();
            const employees = result.data || [];
            
            // Ekstrak departemen unik (case-insensitive, bersihkan spasi)
            const deptSet = new Set();
            employees.forEach(emp => {
                if (emp.department && typeof emp.department === 'string' && emp.department.trim() !== '') {
                    deptSet.add(emp.department.trim());
                }
            });
            
            const departments = Array.from(deptSet).sort();
            console.log('[fetchDepartments] Departemen unik dari employees:', departments);
            this.cache = departments;
            return departments;
        } catch (error) {
            console.error('[fetchDepartments] Gagal fetch departemen:', error);
            this.cache = [];
            return [];
        }
    },
    
    async populateSelects(selectors, currentValue = '') {
        const selects = Array.isArray(selectors) ? selectors : [selectors];
        
        // Pastikan cache terisi (bisa dari data sebelumnya atau fetch baru)
        if (this.cache.length === 0) {
            await this.fetchDepartments();
        }
        
        const departmentsToUse = (this.cache.length === 0) 
            ? ['IT', 'HR', 'Finance', 'Marketing', 'Operations'] 
            : this.cache;
        
        selects.forEach(selectorId => {
            const el = document.getElementById(selectorId);
            if (!el) {
                console.warn('[populateSelects] Elemen tidak ditemukan:', selectorId);
                return;
            }
            
            if (el.tagName.toLowerCase() === 'datalist') {
                el.innerHTML = '';
                departmentsToUse.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    el.appendChild(option);
                });
            } else if (el.tagName.toLowerCase() === 'select') {
                const currentVal = currentValue || el.value;
                el.innerHTML = '<option value="">-- Semua Departemen --</option>';
                departmentsToUse.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    el.appendChild(option);
                });
                if (currentVal && departmentsToUse.includes(currentVal)) {
                    el.value = currentVal;
                }
            }
        });
    },
    
    getDepartments() {
        return [...this.cache];
    },
    
    clearCache() {
        this.cache = [];
    }
};

window.departmentManager = departmentManager;
