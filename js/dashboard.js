/**
 * Portal Karyawan - Dashboard
 * Dashboard functionality and charts
 */

const dashboard = {
    initialized: false,
    attendanceData: [],

    async init() {
        console.log('Dashboard init - start');
        
        // Periksa kesiapan user. Jika belum siap, jangan set initialized
        const currentUser = auth.getCurrentUser();
        if (!currentUser) {
            console.warn('Dashboard init ditangguhkan: Sesi pengguna belum dimuat.');
            return;
        }
        
        // Jalankan inisialisasi hanya jika halaman belum pernah di-init
        if (this.initialized) return;

        loadingIndicator.show('Memuat dashboard...');
        try {
            await this.loadData();
            // Refresh shift info dari API getTodayAttendance
            await this.refreshShiftInfo();
            // Update komponen lain
            this.updateWelcomeCard();
            this.updateStats();
            this.updateSessionInfo();
            this.updateProgressBar();

            this.initialized = true;
            console.log('Dashboard init - done');
        } finally {
            loadingIndicator.hide();
        }
    },

    async loadData() {
        try {
            const currentUser = auth.getCurrentUser();
            if (currentUser && currentUser.id) {
                // Fetch attendance data only
                const attResult = await api.getAttendance(currentUser.id);
                this.attendanceData = (attResult && attResult.success) ? attResult.data : [];
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.attendanceData = [];
        }
    },

    async refreshShiftInfo() {
        const currentUser = auth.getCurrentUser();
        if (!currentUser) {
            console.warn('User belum siap, coba lagi nanti');
            return;
        }
        try {
            const result = await api.getTodayAttendance(currentUser.id);
            if (result.success && result.data) {
                const shiftName = result.data.shift || 'Pagi';
                const shiftEl = document.getElementById('welcome-shift');
                if (shiftEl) {
                    const shifts = storage.get('shifts', []);
                    const shiftDetail = shifts.find(s => s.name === shiftName);
                    
                    if (shiftName === 'Libur') {
                        shiftEl.textContent = `Shift: Libur (Tidak ada jadwal)`;
                    } else if (shiftDetail) {
                        shiftEl.textContent = `Shift: ${shiftDetail.name} (${shiftDetail.startTime} - ${shiftDetail.endTime})`;
                    } else {
                        shiftEl.textContent = `Shift: ${shiftName}`;
                    }
                }
                // Update session
                auth.currentUser.shift = shiftName;
                const session = storage.get('session');
                if (session) { session.shift = shiftName; storage.set('session', session); }
                console.log(`Dashboard shift updated to: ${shiftName}`);
            }
        } catch (error) {
            console.error('Gagal ambil shift:', error);
        }
    },

    updateWelcomeCard() {
        // Hanya update greeting, jangan panggil refreshShiftInfo lagi di sini
        // (sudah dipanggil di init())
        const welcomeCard = document.querySelector('.welcome-card');
        const greetingEl = document.querySelector('.welcome-content h2');
        const iconEl = document.querySelector('.welcome-illustration i');

        if (!welcomeCard || !greetingEl) return;

        const hour = new Date().getHours();
        let greeting = 'Selamat Pagi';
        let icon = 'fa-sun';
        let className = 'morning';

        if (hour >= 11 && hour < 15) {
            greeting = 'Selamat Siang';
            icon = 'fa-sun';
            className = 'afternoon';
        } else if (hour >= 15 && hour < 18) {
            greeting = 'Selamat Sore';
            icon = 'fa-cloud-sun';
            className = 'evening';
        } else if (hour >= 18) {
            greeting = 'Selamat Malam';
            icon = 'fa-moon';
            className = 'evening';
        }

        const userName = auth.getCurrentUser()?.name?.split(' ')[0] || 'User';
        greetingEl.innerHTML = `${greeting}, <span id="welcome-name">${userName}</span>! 👋`;

        if (iconEl) {
            iconEl.className = `fas ${icon}`;
        }

        // Update card class for different gradient
        welcomeCard.className = `welcome-card ${className}`;
    },

    updateStats() {
        const attendance = this.attendanceData;

        // Calculate stats
        const total = Math.max(26, attendance.length); // Assuming min 26 working days base
        const present = attendance.filter(a => a.status === 'ontime').length;
        const late = attendance.filter(a => a.status === 'late').length;
        const absent = attendance.filter(a => a.status === 'absent').length;

        // Update donut chart values
        const presentPercent = total > 0 ? Math.round((present / total) * 100) : 0;

        // Update center text
        const donutValue = document.querySelector('.donut-value');
        if (donutValue) {
            donutValue.textContent = `${presentPercent}%`;
        }

        // Update legend
        const legendValues = document.querySelectorAll('.legend-value');
        if (legendValues.length >= 3) {
            legendValues[0].textContent = `${present} hari`;
            legendValues[1].textContent = `${late} hari`;
            legendValues[2].textContent = `${absent} hari`;
        }
    },

    updateSessionInfo() {
        // Get today's attendance
        const today = dateTime.getLocalDate();
        const attendance = this.attendanceData;
        const todayAttendance = attendance.find(a => a.date === today);

        const clockInEl = document.getElementById('dashboard-clock-in');
        const clockOutEl = document.getElementById('dashboard-clock-out');
        const durationEl = document.getElementById('dashboard-duration');

        if (clockInEl) clockInEl.textContent = '--:--';
        if (clockOutEl) clockOutEl.textContent = '--:--';
        if (durationEl) durationEl.textContent = '0j 0m';

        if (todayAttendance) {
            if (clockInEl) clockInEl.textContent = todayAttendance.clockIn || '--:--';
            if (clockOutEl) clockOutEl.textContent = todayAttendance.clockOut || '--:--';

            if (todayAttendance.clockIn && todayAttendance.clockOut && durationEl) {
                durationEl.textContent = dateTime.calculateDuration(
                    todayAttendance.clockIn,
                    todayAttendance.clockOut
                );
            }
        }
    },

    updateProgressBar() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour + (currentMinute / 60);

        // Assuming 8-hour work day from 8 AM to 5 PM
        const startHour = 8;
        const endHour = 17;
        const totalHours = endHour - startHour;

        let progress = ((currentTime - startHour) / totalHours) * 100;
        progress = Math.max(0, Math.min(100, progress));

        const progressFill = document.getElementById('work-progress');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
    }
};

// Global init function called by router
window.initDashboard = async () => {
    await dashboard.init();
};

// Ekspos objek dashboard ke global window agar dapat diakses dari main.js
window.dashboard = dashboard;

// Auto-update progress every minute
setInterval(() => {
    if (document.getElementById('page-dashboard')?.classList.contains('active')) {
        dashboard.updateProgressBar();
    }
}, 60000);
