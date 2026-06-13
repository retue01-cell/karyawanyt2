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
            this.renderWeeklyChart();
            await this.renderRecentActivities();

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

        // Hitung berdasarkan bulan berjalan
        const currentYearMonth = dateTime.getLocalDate().substring(0, 7);
        const monthlyAttendance = attendance.filter(a => a.date && a.date.startsWith(currentYearMonth));
        
        const present = monthlyAttendance.filter(a => a.clockIn && a.clockIn !== '').length;
        const late = monthlyAttendance.filter(a => 
            a.status && (a.status === 'Terlambat' || a.status === 'Late')
        ).length;
        const absent = monthlyAttendance.filter(a => {
            if (a.clockIn && a.clockIn !== '') return false;
            const status = (a.status || '').toLowerCase();
            return !status.includes('cuti') && !status.includes('izin') && status !== 'libur';
        }).length;

        const totalDays = monthlyAttendance.length;
        const presentPercent = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

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
            if (clockInEl) clockInEl.textContent = dateTime.normalizeTime(todayAttendance.clockIn) || '--:--';
            if (clockOutEl) clockOutEl.textContent = dateTime.normalizeTime(todayAttendance.clockOut) || '--:--';

            if (todayAttendance.clockIn && todayAttendance.clockOut && durationEl) {
                const duration = dateTime.calculateDuration(
                    todayAttendance.clockIn,
                    todayAttendance.clockOut
                );
                durationEl.textContent = duration;
            } else if (durationEl) {
                // Jika belum clock out, tampilkan 0j 0m
                durationEl.textContent = '0j 0m';
            }
        } else {
            // Jika tidak ada data hari ini, reset semua
            if (clockInEl) clockInEl.textContent = '--:--';
            if (clockOutEl) clockOutEl.textContent = '--:--';
            if (durationEl) durationEl.textContent = '0j 0m';
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
    },

    renderWeeklyChart() {
        const barChartContainer = document.querySelector('.bar-chart');
        if (!barChartContainer) return;

        // Ambil 7 hari terakhir (termasuk hari ini)
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const today = new Date();
        const weeklyData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = dateTime.getLocalDate(date);
            const dayName = days[date.getDay()];
            const attendance = this.attendanceData.find(a => a.date === dateStr);
            const isPresent = attendance && attendance.clockIn && attendance.clockIn !== '';
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            weeklyData.push({ day: dayName, present: isPresent, weekend: isWeekend });
        }

        // Render bar chart
        barChartContainer.innerHTML = weeklyData.map(day => `
            <div class="bar-item">
                <div class="bar-fill ${day.weekend ? 'weekend' : ''}" style="height: ${day.present ? '100%' : '0%'}; min-height: 4px;"></div>
                <span class="bar-label">${day.day}</span>
            </div>
        `).join('');
    },

    async renderRecentActivities() {
        const activityList = document.querySelector('.activity-list');
        if (!activityList) return;

        // Ambil 5 aktivitas terbaru dari attendance + jurnal
        const currentUser = auth.getCurrentUser();
        const userId = currentUser?.id;
        
        // Gabungkan data attendance dan jurnal
        let activities = [];
        
        // Dari attendance
        this.attendanceData.forEach(att => {
            if (att.clockIn) {
                const timeStr = dateTime.normalizeTime(att.clockIn);
                activities.push({
                    type: 'clock-in',
                    title: 'Clock In',
                    time: timeStr,
                    date: att.date,
                    timestamp: new Date(att.date + 'T' + (att.clockIn.includes(':') ? att.clockIn : att.clockIn.replace('.', ':') + ':00'))
                });
            }
            if (att.clockOut) {
                const timeStr = dateTime.normalizeTime(att.clockOut);
                activities.push({
                    type: 'clock-out',
                    title: 'Clock Out',
                    time: timeStr,
                    date: att.date,
                    timestamp: new Date(att.date + 'T' + (att.clockOut.includes(':') ? att.clockOut : att.clockOut.replace('.', ':') + ':00'))
                });
            }
        });
        
        // Dari jurnal (ambil dari API atau storage)
        try {
            const journalResult = await api.getJournals(userId);
            const journals = journalResult.data || [];
            journals.forEach(j => {
                if (j.tasks && j.tasks.trim() !== '') {
                    let journalDate = j.date || (j.updatedAt ? j.updatedAt.split('T')[0] : '');
                    let journalTime = j.updatedAt ? dateTime.formatTime(j.updatedAt) : '00:00';
                    if (journalDate) {
                        activities.push({
                            type: 'journal',
                            title: 'Mengisi Jurnal',
                            time: journalTime,
                            date: journalDate,
                            timestamp: new Date(journalDate + 'T' + journalTime)
                        });
                    }
                }
            });
        } catch(e) { 
            console.warn('Gagal ambil jurnal untuk aktivitas', e); 
        }
        
        // Urutkan berdasarkan timestamp terbaru, ambil 5
        activities.sort((a, b) => b.timestamp - a.timestamp);
        const recent = activities.slice(0, 5);
        
        if (recent.length === 0) {
            activityList.innerHTML = '<div class="empty-activity" style="text-align:center; padding:20px;">Belum ada aktivitas</div>';
            return;
        }
        
        activityList.innerHTML = recent.map(act => {
            const iconClass = act.type === 'clock-in' ? 'clock-in' : (act.type === 'clock-out' ? 'clock-out' : 'journal');
            const icon = act.type === 'clock-in' ? 'fa-sign-in-alt' : (act.type === 'clock-out' ? 'fa-sign-out-alt' : 'fa-book');
            const timeAgo = this.getTimeAgo(act.timestamp);
            return `
                <div class="activity-item">
                    <div class="activity-icon ${iconClass}"><i class="fas ${icon}"></i></div>
                    <div class="activity-content">
                        <p class="activity-title">${act.title}</p>
                        <p class="activity-time">${timeAgo}</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Baru saja';
        if (diffMins < 60) return `${diffMins} menit lalu`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} jam lalu`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'Kemarin';
        return `${diffDays} hari lalu`;
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
