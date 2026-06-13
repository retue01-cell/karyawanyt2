/**
 * Portal Karyawan - Dashboard
 * Dashboard functionality and charts
 */

const dashboard = {
    initialized: false,
    attendanceData: [],
    leavesData: [],
    izinData: [],
    currentPeriod: 'current', // 'current' atau 'last'

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
            this.setupPeriodSelector();
            this.updateStats(this.currentPeriod);
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

    setupPeriodSelector() {
        const selectEl = document.querySelector('.select-period');
        if (!selectEl) return;
        
        selectEl.addEventListener('change', (e) => {
            this.currentPeriod = e.target.value === 'Bulan Lalu' ? 'last' : 'current';
            this.updateStats(this.currentPeriod);
        });
        
        // Set nilai awal
        selectEl.value = this.currentPeriod === 'last' ? 'Bulan Lalu' : 'Bulan Ini';
    },

    async loadData() {
        try {
            const currentUser = auth.getCurrentUser();
            if (currentUser && currentUser.id) {
                // Fetch attendance data only
                const attResult = await api.getAttendance(currentUser.id);
                this.attendanceData = (attResult && attResult.success) ? attResult.data : [];
                
                // Fetch leaves data
                const leavesResult = await api.getLeaves(currentUser.id);
                this.leavesData = (leavesResult && leavesResult.success) ? leavesResult.data : [];
                
                // Fetch izin data
                const izinResult = await api.getIzin(currentUser.id);
                this.izinData = (izinResult && izinResult.success) ? izinResult.data : [];
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.attendanceData = [];
            this.leavesData = [];
            this.izinData = [];
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

    updateStats(period = 'current') {
        const attendance = this.attendanceData;
        const currentUser = auth.getCurrentUser();
        
        // Tentukan bulan yang akan dihitung
        let targetDate = new Date();
        if (period === 'last') {
            targetDate.setMonth(targetDate.getMonth() - 1);
        }
        
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth(); // 0-indexed
        const currentYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        // Filter data untuk bulan yang dipilih
        const monthlyAttendance = attendance.filter(a => a.date && a.date.startsWith(currentYearMonth));
        
        // Hitung total hari dalam bulan (tanpa filter weekend - sama seperti admin)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Tentukan batas akhir perhitungan
        let lastDayToCount = daysInMonth;
        
        // Jika bulan ini, batasi hanya sampai hari ini (tidak menghitung hari masa depan)
        if (period === 'current') {
            const today = new Date();
            if (today.getFullYear() === year && today.getMonth() === month) {
                lastDayToCount = today.getDate();
            }
        }
        
        // Cek join date - jika bulan pertama bergabung, mulai dari tanggal join
        let startDay = 1;
        if (currentUser && currentUser.joinDate) {
            const joinDate = new Date(currentUser.joinDate);
            if (joinDate.getFullYear() === year && joinDate.getMonth() === month) {
                startDay = joinDate.getDate();
                // Jika join date setelah lastDayToCount, tidak ada data
                if (startDay > lastDayToCount) {
                    // Bulan sebelum join - tampilkan 0
                    const donutValue = document.querySelector('.donut-value');
                    if (donutValue) donutValue.textContent = '0%';
                    const legendValues = document.querySelectorAll('.legend-value');
                    if (legendValues.length >= 3) {
                        legendValues[0].textContent = '0 hari';
                        legendValues[1].textContent = '0 hari';
                        legendValues[2].textContent = '0 hari';
                    }
                    return;
                }
            }
        }
        
        // Total hari kalender yang dihitung (sama seperti logika admin)
        const totalDays = lastDayToCount - startDay + 1;
        
        // Hitung kehadiran (hadir jika ada clockIn)
        const present = monthlyAttendance.filter(a => a.clockIn && a.clockIn !== '').length;
        
        // Hitung terlambat
        const late = monthlyAttendance.filter(a => 
            a.status && (a.status === 'Terlambat' || a.status === 'Late')
        ).length;
        
        // Hitung cuti/izin yang approved (hanya yang jatuh dalam rentang tanggal yang dihitung)
        const approvedLeaves = this.leavesData.filter(l => {
            if (l.status !== 'approved') return false;
            const leaveStart = new Date(l.startDate);
            const leaveEnd = new Date(l.endDate);
            
            // Cek apakah cuti berada dalam bulan dan rentang tanggal yang dihitung
            if (leaveStart.getFullYear() !== year || leaveStart.getMonth() !== month) return false;
            
            const startDayNum = leaveStart.getDate();
            const endDayNum = leaveEnd.getDate();
            
            // Hitung durasi yang masuk dalam rentang
            let overlapDays = 0;
            for (let d = startDayNum; d <= endDayNum; d++) {
                if (d >= startDay && d <= lastDayToCount) {
                    overlapDays++;
                }
            }
            return overlapDays > 0;
        }).reduce((total, l) => {
            const leaveStart = new Date(l.startDate);
            const leaveEnd = new Date(l.endDate);
            const startDayNum = leaveStart.getDate();
            const endDayNum = leaveEnd.getDate();
            
            let overlapDays = 0;
            for (let d = startDayNum; d <= endDayNum; d++) {
                if (d >= startDay && d <= lastDayToCount) {
                    overlapDays++;
                }
            }
            return total + overlapDays;
        }, 0);
        
        const approvedIzin = this.izinData.filter(i => {
            if (i.status !== 'approved') return false;
            const izinDate = new Date(i.date);
            if (izinDate.getFullYear() !== year || izinDate.getMonth() !== month) return false;
            
            const izinDay = izinDate.getDate();
            return izinDay >= startDay && izinDay <= lastDayToCount;
        }).reduce((total, i) => total + (parseInt(i.duration) || 1), 0);
        
        // Alpha = Total hari - Hadir - Cuti Approved - Izin Approved (sama seperti admin)
        const absent = Math.max(0, totalDays - present - approvedLeaves - approvedIzin);
        
        // Persentase kehadiran
        const denominator = totalDays > 0 ? totalDays : 1;
        const presentPercent = denominator > 0 ? Math.round((present / denominator) * 100) : 0;

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

        // =========================================================
        // UPDATE POTONGAN GRAFIK SVG DONUT CHART
        // =========================================================
        
        // 1. Ambil elemen SVG lingkaran dari grafik
        const circlePresent = document.querySelector('.donut-fill.present');
        const circleLate = document.querySelector('.donut-fill.late');
        const circleAbsent = document.querySelector('.donut-fill.absent');

        // 2. Tentukan jumlah untuk setiap kategori (mutually exclusive)
        // present = semua yang clockIn (termasuk yang late)
        // late = subset dari present yang terlambat
        // absent = alpha (tidak hadir tanpa keterangan)
        const onTimeAmount = present; // Semua yang hadir
        const lateAmount = late;      // Yang terlambat
        const absentAmount = absent;  // Alpha

        const totalGraph = onTimeAmount + lateAmount + absentAmount;

        // Matematika SVG: Keliling lingkaran dengan r=40 (rumus: 2 * Math.PI * 40 ≈ 251.327)
        const circ = 251.327;

        if (totalGraph > 0 && circlePresent && circleLate && circleAbsent) {
            // 3. Hitung proporsi persentase panjang garis (dash) masing-masing
            const presentDash = (onTimeAmount / totalGraph) * circ;
            const lateDash = (lateAmount / totalGraph) * circ;
            const absentDash = (absentAmount / totalGraph) * circ;

            // 4. Hitung posisi titik mulai/offset (negatif agar bersambung searah jarum jam)
            // Ditambahkan gap '- 2' agar ada jarak visual kecil pemisah berwarna putih
            const presentOffset = 0;
            const lateOffset = -presentDash - (presentDash > 0 && lateDash > 0 ? 2 : 0);
            const absentOffset = lateOffset - lateDash - ((lateDash > 0 || presentDash > 0) && absentDash > 0 ? 2 : 0);

            // 5. Terapkan update CSS style ke elemen Circle SVG
            circlePresent.style.strokeDasharray = `${presentDash} ${circ}`;
            circlePresent.style.strokeDashoffset = presentOffset;

            circleLate.style.strokeDasharray = `${lateDash} ${circ}`;
            circleLate.style.strokeDashoffset = lateOffset;

            circleAbsent.style.strokeDasharray = `${absentDash} ${circ}`;
            circleAbsent.style.strokeDashoffset = absentOffset;

        } else if (circlePresent && circleLate && circleAbsent) {
            // Jika tidak ada hari kerja yang bisa dihitung (total = 0), hapus semua potongan grafik
            circlePresent.style.strokeDasharray = `0 ${circ}`;
            circleLate.style.strokeDasharray = `0 ${circ}`;
            circleAbsent.style.strokeDasharray = `0 ${circ}`;
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

        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const weeklyData = [];
        
        // 1. Dapatkan tanggal hari Senin untuk minggu ini
        const today = new Date();
        const currentDay = today.getDay();
        const diffToMonday = currentDay === 0 ? -6 : (1 - currentDay); 
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() + diffToMonday);
        
        // 2. Loop dari Senin (0) sampai Minggu (6)
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            
            const dateStr = dateTime.getLocalDate(date);
            const dayName = days[date.getDay()];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            // Ambil referensi kehadiran hari tersebut
            const attendance = this.attendanceData.find(a => a.date === dateStr);
            const status = attendance ? String(attendance.status || '').toLowerCase() : '';
            
            const isCuti = status.includes('cuti') || status.includes('libur');
            const isIzin = status.includes('izin') || status.includes('sakit');
            const isPresent = attendance && attendance.clockIn && attendance.clockIn !== '';
            
            // 3. Kalkulasi tinggi batang grafik proporsional
            let heightPercent = 0;
            if (isCuti || isIzin) {
                heightPercent = 100; // Cuti/Izin tampil penuh
            } else if (isPresent) {
                let startMins = 0;
                let endMins = 0;
                
                // Parsing jam clock in
                const startStr = dateTime.normalizeTime(attendance.clockIn);
                const [startH, startM] = startStr.split(':').map(Number);
                startMins = startH * 60 + startM;
                
                // Parsing jam clock out
                if (attendance.clockOut && attendance.clockOut !== '') {
                    const endStr = dateTime.normalizeTime(attendance.clockOut);
                    const [endH, endM] = endStr.split(':').map(Number);
                    endMins = endH * 60 + endM;
                } else if (dateStr === dateTime.getLocalDate(new Date())) {
                    // Jika hari ini dan belum clock out tutup durasi dengan jam sekarang
                    const now = new Date();
                    endMins = now.getHours() * 60 + now.getMinutes();
                } else {
                    // Jika di masa lalu belum clock out tapi status present (lupa absen)
                    endMins = startMins + (4 * 60); // Asumsi 4 jam minimal
                }
                
                let diffMins = endMins - startMins;
                if (diffMins < 0) diffMins += 24 * 60; // Antisipasi shift malam
                
                // Asumsi standar 9 jam kerja = 540 menit sebagai 100% tinggi
                heightPercent = Math.min(100, Math.round((diffMins / 540) * 100));
            }
            
            // 4. Mapping custom class untuk membedakan representasi visual
            let fillClass = '';
            if (isCuti) fillClass = 'leave';
            else if (isIzin) fillClass = 'izin';
            else if (isWeekend && !isPresent) fillClass = 'weekend';
            
            weeklyData.push({ 
                day: dayName, 
                height: heightPercent, 
                fillClass: fillClass 
            });
        }

        // 5. Render HTML Bar ke dalam container
        barChartContainer.innerHTML = weeklyData.map(day => `
            <div class="bar-item" title="${day.height}%">
                <div class="bar-fill ${day.fillClass}" style="height: ${day.height}%; min-height: ${day.height > 0 ? '4px' : '0'};"></div>
                <span class="bar-label">${day.day}</span>
            </div>
        `).join('');
    },


    async renderRecentActivities() {
        const activityList = document.querySelector('.activity-list');
        if (!activityList) return;

        const currentUser = auth.getCurrentUser();
        const userId = currentUser?.id;
        
        // Gabungkan data attendance, jurnal, leaves, dan izin
        let activities = [];
        
        // Dari attendance - Clock In dan Clock Out
        this.attendanceData.forEach(att => {
            if (att.clockIn && att.clockIn !== '') {
                try {
                    const timeStr = dateTime.normalizeTime(att.clockIn);
                    // Sanitasi waktu untuk mencegah Invalid Date
                    const cleanTime = timeStr.substring(0, 5);
                    const timestamp = new Date(att.date + 'T' + cleanTime + ':00');
                    if (!isNaN(timestamp.getTime())) {
                        activities.push({
                            type: 'clock-in',
                            title: 'Clock In',
                            time: timeStr,
                            date: att.date,
                            timestamp: timestamp
                        });
                    }
                } catch(e) { console.warn('Error parsing clock-in:', e); }
            }
            if (att.clockOut && att.clockOut !== '') {
                try {
                    const timeStr = dateTime.normalizeTime(att.clockOut);
                    const cleanTime = timeStr.substring(0, 5);
                    const timestamp = new Date(att.date + 'T' + cleanTime + ':00');
                    if (!isNaN(timestamp.getTime())) {
                        activities.push({
                            type: 'clock-out',
                            title: 'Clock Out',
                            time: timeStr,
                            date: att.date,
                            timestamp: timestamp
                        });
                    }
                } catch(e) { console.warn('Error parsing clock-out:', e); }
            }
        });
        
        // Dari jurnal - gunakan storage untuk performa lebih baik
        try {
            const journals = storage.get('jurnals', []);
            journals.forEach(j => {
                if (j.tasks && j.tasks.trim() !== '') {
                    try {
                        let journalDate = j.date || (j.updatedAt ? j.updatedAt.split('T')[0] : '');
                        let journalTime = '00:00';
                        
                        if (j.updatedAt) {
                            journalTime = dateTime.formatTime(j.updatedAt);
                        } else if (j.createdAt) {
                            journalTime = dateTime.formatTime(j.createdAt);
                        }
                        
                        if (journalDate) {
                            const cleanTime = journalTime.substring(0, 5);
                            const timestamp = new Date(journalDate + 'T' + cleanTime + ':00');
                            if (!isNaN(timestamp.getTime())) {
                                activities.push({
                                    type: 'journal',
                                    title: 'Mengisi Jurnal',
                                    time: journalTime,
                                    date: journalDate,
                                    timestamp: timestamp
                                });
                            }
                        }
                    } catch(e) { console.warn('Error parsing journal:', e); }
                }
            });
        } catch(e) { 
            console.warn('Gagal ambil jurnal dari storage', e); 
        }
        
        // Dari Leaves (Cuti) - tambahkan aktivitas pengajuan cuti
        this.leavesData.forEach(leave => {
            if (leave.appliedAt) {
                try {
                    const timestamp = new Date(leave.appliedAt + 'T00:00:00');
                    if (!isNaN(timestamp.getTime())) {
                        const statusLabel = leave.status === 'approved' ? 'Disetujui' : (leave.status === 'rejected' ? 'Ditolak' : 'Pending');
                        activities.push({
                            type: 'leave',
                            title: `Pengajuan ${leave.typeLabel || 'Cuti'} (${statusLabel})`,
                            time: '--:--',
                            date: leave.appliedAt,
                            timestamp: timestamp
                        });
                    }
                } catch(e) { console.warn('Error parsing leave:', e); }
            }
        });
        
        // Dari Izin - tambahkan aktivitas pengajuan izin
        this.izinData.forEach(izin => {
            if (izin.appliedAt || izin.date) {
                try {
                    const applyDate = izin.appliedAt || izin.date;
                    const timestamp = new Date(applyDate + 'T00:00:00');
                    if (!isNaN(timestamp.getTime())) {
                        const statusLabel = izin.status === 'approved' ? 'Disetujui' : (izin.status === 'rejected' ? 'Ditolak' : 'Pending');
                        activities.push({
                            type: 'izin',
                            title: `Pengajuan Izin (${statusLabel})`,
                            time: '--:--',
                            date: applyDate,
                            timestamp: timestamp
                        });
                    }
                } catch(e) { console.warn('Error parsing izin:', e); }
            }
        });
        
        // Urutkan berdasarkan timestamp terbaru, ambil 5
        activities.sort((a, b) => b.timestamp - a.timestamp);
        const recent = activities.slice(0, 5);
        
        if (recent.length === 0) {
            activityList.innerHTML = '<div class="empty-activity" style="text-align:center; padding:20px;">Belum ada aktivitas</div>';
            return;
        }
        
        activityList.innerHTML = recent.map(act => {
            let iconClass = '';
            let icon = '';
            
            switch(act.type) {
                case 'clock-in':
                    iconClass = 'clock-in';
                    icon = 'fa-sign-in-alt';
                    break;
                case 'clock-out':
                    iconClass = 'clock-out';
                    icon = 'fa-sign-out-alt';
                    break;
                case 'journal':
                    iconClass = 'journal';
                    icon = 'fa-book';
                    break;
                case 'leave':
                    iconClass = 'leave';
                    icon = 'fa-plane';
                    break;
                case 'izin':
                    iconClass = 'izin';
                    icon = 'fa-file-alt';
                    break;
                default:
                    iconClass = '';
                    icon = 'fa-clock';
            }
            
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
