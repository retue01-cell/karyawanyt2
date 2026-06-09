/**
 * Portal Karyawan - Router
 * Simple SPA Router for vanilla JS
 */

const router = {
    currentPage: 'dashboard',
    routes: ['dashboard', 'absensi', 'face-recognition', 'izin', 'jurnal', 'cuti', 
             'admin-dashboard', 'employees', 'attendance-reports', 'jurnal-reports', 
             'leave-reports', 'shift-schedule', 'settings', 'account-settings'],
    
    init() {
        // Handle navigation clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    this.navigate(page);
                }
            });
        });
        
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.showPage(e.state.page, false);
            }
        });
        
        // Check for stored current page
        const storedPage = storage.get('currentPage');
        if (storedPage && this.routes.includes(storedPage)) {
            this.showPage(storedPage, false);
        }
    },
    
    navigate(page) {
        if (!this.routes.includes(page)) return;
        
        this.showPage(page, true);
        storage.set('currentPage', page);
    },
    
    showPage(page, pushState = true) {
        // Show loading indicator when switching pages
        if (window.loadingIndicator) {
            window.loadingIndicator.show('Memuat halaman...');
        }
        
        this.currentPage = page;
        
        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            absensi: 'Absensi',
            jurnal: 'Jurnal Kerja',
            cuti: 'Pengajuan Cuti',
            'shift-schedule': 'Jadwal Shift',
            settings: 'Settings'
        };
        
        const company = storage.get('company', { name: 'Portal Karyawan' });
        document.title = `${titles[page]} - ${company.name}`;
        
        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        // Show/hide pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Update page title in header
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = titles[page];
        }
        
        // Push state for browser history
        if (pushState) {
            history.pushState({ page }, titles[page], `#${page}`);
        }
        
        // Trigger page-specific init functions
        this.triggerPageInit(page);
        
        // Refresh company data when switching pages (without loading indicator)
        if (window.refreshCompanyData && !this._isRefreshing) {
            this._isRefreshing = true;
            window.refreshCompanyData().finally(() => { this._isRefreshing = false; });
        }
        
        // Scroll to top
        document.querySelector('.page-content').scrollTop = 0;
        
        // Hide loading indicator after page is loaded
        setTimeout(() => {
            if (window.loadingIndicator) {
                window.loadingIndicator.hide();
            }
        }, 300);
    },
    
    async triggerPageInit(page) {
        // Call init function for each page if exists
        switch(page) {
            case 'dashboard':
                if (window.initDashboard) {
                    await window.initDashboard();
                } else {
                    // fallback
                    if (window.dashboard && window.dashboard.refreshShiftInfo) {
                        await window.dashboard.refreshShiftInfo();
                    }
                }
                break;
            case 'absensi':
                // Reset flag initialized agar bisa diinisialisasi ulang saat navigasi ke halaman absensi
                if (window.absensi && typeof window.absensi.reset === 'function') {
                    window.absensi.reset();
                }
                if (window.initAbsensi) window.initAbsensi();
                break;
            case 'face-recognition':
                // Face recognition is initialized with action parameter
                break;
            case 'izin':
                if (window.initIzin) window.initIzin();
                break;
            case 'jurnal':
                if (window.initJurnal) window.initJurnal();
                break;
            case 'cuti':
                if (window.initCuti) window.initCuti();
                break;
            case 'admin-dashboard':
                if (window.initAdminDashboard) window.initAdminDashboard();
                break;
            case 'employees':
                if (window.initEmployees) window.initEmployees();
                break;
            case 'attendance-reports':
                if (window.initAttendanceReports) window.initAttendanceReports();
                break;
            case 'jurnal-reports':
                if (window.initJurnalReports) window.initJurnalReports();
                break;
            case 'leave-reports':
                if (window.initLeaveReports) window.initLeaveReports();
                break;
            case 'shift-schedule':
                if (window.initShiftSchedule) window.initShiftSchedule();
                break;
            case 'settings':
                if (window.initSettings) window.initSettings();
                break;
            case 'account-settings':
                if (window.initAccountSettings) window.initAccountSettings();
                break;
        }
        
        // Update mobile bottom nav
        if (window.mobile) {
            window.mobile.updateBottomNav(page);
        }
    }
};

// Initialize router on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    router.init();
});

// Expose to global
window.router = router;
