/**
 * Portal Karyawan - Dashboard
 * Dashboard functionality and charts
 */

const dashboard = {
    initialized: false,
    attendanceData: [],

    // Method baru untuk mengambil shift hari ini berdasarkan jadwal admin
    async getTodayShift() {
        const currentUser = auth.getCurrentUser();
        if (!currentUser) {
            console.warn('No current user in getTodayShift');
            return 'Pagi';
        }

        const userId = String(currentUser.id);
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = today.getDate();
        const key = `${year}-${month}`;

        console.log(`getTodayShift: key=${key}, userId=${userId}, day=${day}`);

        // Ambil jadwal dari storage
        let schedules = storage.get('shift_schedule', {});
        let monthData = schedules[key] || {};

        // Jika kosong, ambil dari API
        if (Object.keys(monthData).length === 0) {
            console.log('No schedule in storage for this month, fetching from API...');
            try {
                const result = await api.getShiftScheduleForMonth(key);
                if (result.success && result.data) {
                    schedules[key] = result.data;
                    storage.set('shift_schedule', schedules);
                    monthData = result.data;
                    console.log('Schedule fetched from API:', monthData);
                } else {
                    console.warn('API returned no data for shift schedule');
                }
            } catch (e) {
                console.error('Failed to fetch shift schedule from API:', e);
            }
        }

        // Cek apakah ada jadwal khusus untuk user ini di tanggal hari ini
        const userSchedule = monthData[userId];
        let shiftToday = null;
        if (userSchedule && userSchedule[day] && userSchedule[day] !== '') {
            shiftToday = userSchedule[day];
            console.log(`Found specific shift for day ${day}: ${shiftToday}`);
        }

        if (shiftToday) {
            return shiftToday;
        }

        // Fallback ke shift default dari profil karyawan
        const defaultShift = currentUser.shift || 'Pagi';
        console.log(`No specific shift found, using default: ${defaultShift}`);
        return defaultShift;
    },

    // Method untuk refresh tampilan shift di dashboard
    async refreshShiftInfo() {
        console.log('refreshShiftInfo called');
        const shiftName = await this.getTodayShift();
        const shiftEl = document.getElementById('welcome-shift');
        if (!shiftEl) {
            console.warn('welcome-shift element not found');
            return;
        }

        // Ambil detail jam shift dari daftar shifts (storage)
        const shifts = storage.get('shifts', []);
        const shiftDetail = shifts.find(s => s.name === shiftName);
        
        if (shiftName === 'Libur') {
            shiftEl.textContent = `Shift: Libur (Tidak ada jadwal)`;
        } else if (shiftDetail) {
            shiftEl.textContent = `Shift: ${shiftDetail.name} (${shiftDetail.startTime} - ${shiftDetail.endTime})`;
        } else {
            shiftEl.textContent = `Shift: ${shiftName}`;
        }
        
        // Simpan shift terbaru ke currentUser agar konsisten
        if (auth.currentUser) {
            auth.currentUser.shift = shiftName;
            // Update session storage
            const session = storage.get('session');
            if (session) {
                session.shift = shiftName;
                storage.set('session', session);
            }
        }
        
        console.log(`Dashboard shift updated to: ${shiftName}`);
    },

    async init() {
        console.log('Dashboard init - start');
        if (this.initialized) return;

        await this.loadData();
        // Refresh shift info (akan ambil dari API jika perlu)
        await this.refreshShiftInfo();
        // Update komponen lain
        this.updateWelcomeCard();
        this.updateStats();
        this.updateSessionInfo();
        this.updateProgressBar();

        this.initialized = true;
        console.log('Dashboard init - done');
    },

    async loadData() {
        try {
            const currentUser = auth.getCurrentUser();
            if (currentUser && currentUser.id) {
                // Fetch attendance and global settings concurrently
                const [attResult, settingsRes] = await Promise.all([
                    api.getAttendance(currentUser.id),
                    api.getSettings()
                ]);

                this.attendanceData = (attResult && attResult.success) ? attResult.data : [];

                // Sync global schedule shift mapping from Admin to this employee's local instance
                if (settingsRes && settingsRes.success && settingsRes.data) {
                    const globalSettings = settingsRes.data;
                    const loadedSchedules = {};
                    Object.keys(globalSettings).forEach(k => {
                        if (k.startsWith('shift_schedule_')) {
                            const monthKey = k.replace('shift_schedule_', '');
                            try {
                                loadedSchedules[monthKey] = JSON.parse(globalSettings[k]);
                            } catch (e) { }
                        }
                    });
                    if (Object.keys(loadedSchedules).length > 0) {
                        // Gabungkan dengan yang sudah ada, jangan timpa
                        const existing = storage.get('shift_schedule', {});
                        const merged = { ...existing, ...loadedSchedules };
                        storage.set('shift_schedule', merged);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.attendanceData = [];
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

// Auto-update progress every minute
setInterval(() => {
    if (document.getElementById('page-dashboard')?.classList.contains('active')) {
        dashboard.updateProgressBar();
    }
}, 60000);
