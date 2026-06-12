/**
 * Portal Karyawan - Absensi
 * Attendance/Clock In-Out functionality
 */

const absensi = {
    currentState: 'waiting', // waiting, clocked-in, on-break, completed
    attendanceData: {},
    liveClockInterval: null,
    isInitialized: false,
    processing: false,

    async init() {
        // Selalu muat ulang data setiap kali halaman absensi dibuka
        // untuk memastikan sinkronisasi dengan server
        console.log('Initializing absensi page...');
        loadingIndicator.show('Memuat data absensi...');
        try {
            await this.loadTodayAttendance();
            await this.loadAttendanceHistory();
            console.log('Current state:', this.currentState);
            console.log('Attendance data:', this.attendanceData);
            this.initLiveClock();
            this.initButtons();
            this.renderTimeline();
            this.updateUI();
            // isInitialized tidak lagi digunakan agar data selalu fresh

            // Debug button state
            setTimeout(() => {
                const btnClockIn = document.getElementById('btn-clock-in');
                if (btnClockIn) {
                    console.log('Clock In button - disabled:', btnClockIn.disabled);
                    console.log('Clock In button - visible:', btnClockIn.offsetParent !== null);
                }
            }, 100);
        } catch (error) {
            console.error('Error initializing absensi:', error);
            // Jangan tampilkan toast error untuk error non-kritis saat inisialisasi
            // Error ini biasanya terjadi karena refresh data yang gagal, bukan kegagalan utama
        } finally {
            loadingIndicator.hide();
        }
    },

    async loadTodayAttendance() {
        const currentUser = auth.getCurrentUser();
        const userId = currentUser?.id || 'demo-user';
        try {
            const [result, settingsRes] = await Promise.all([
                api.getTodayAttendance(userId),
                api.getSettings()
            ]);

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
                    storage.set('shift_schedule', loadedSchedules);
                }
            }

            let todayAttendance = result?.data || {};

            // CEK APAKAH HARI INI DIBLOKIR (cuti/izin)
            if (todayAttendance.isBlocked) {
                this.currentState = 'blocked';
                this.attendanceData = todayAttendance;
                this.updateUIBlocked();
                return;
            }

            if (!todayAttendance.date) {
                const today = dateTime.getLocalDate();
                // Backend sudah mengirim shift yang benar (dengan fallback: ShiftSchedule -> Employees -> 'Pagi')
                // Jadi kita langsung gunakan shift dari backend
                let currentShift = todayAttendance.shift || currentUser?.shift || 'Pagi';

                // Automated shift lookup from admin schedule (fallback tambahan di sisi frontend)
                try {
                    const stringUserId = String(userId);
                    const schedules = storage.get('shift_schedule', {});
                    const todayObj = new Date();
                    const currentYear = todayObj.getFullYear();
                    const currentMonth = todayObj.getMonth();
                    const currentDay = todayObj.getDate();
                    const key = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;

                    console.log('Absen Shift Sync - Key:', key, 'UserId:', stringUserId, 'Day:', currentDay);

                    if (schedules[key] && schedules[key][stringUserId]) {
                        const assignedShift = schedules[key][stringUserId][currentDay];
                        console.log('Absen Shift Sync - Found Shift:', assignedShift);
                        if (assignedShift && assignedShift !== '') {
                            currentShift = assignedShift;
                        }
                    } else {
                        console.log('Absen Shift Sync - Missing Schedule key or User record.');
                    }
                } catch (e) {
                    console.error('Error reading shift schedule:', e);
                }

                todayAttendance = {
                    date: today,
                    shift: currentShift,
                    clockIn: null,
                    clockOut: null,
                    breakStart: null,
                    breakEnd: null,
                    overtimeStart: null,
                    status: 'waiting'
                };
            }

            // Ensure null values are explicitly set (not undefined)
            todayAttendance.clockIn = (todayAttendance.clockIn === '' || todayAttendance.clockIn === undefined) ? null : todayAttendance.clockIn;
            todayAttendance.clockOut = (todayAttendance.clockOut === '' || todayAttendance.clockOut === undefined) ? null : todayAttendance.clockOut;
            todayAttendance.breakStart = (todayAttendance.breakStart === '' || todayAttendance.breakStart === undefined) ? null : todayAttendance.breakStart;
            todayAttendance.breakEnd = (todayAttendance.breakEnd === '' || todayAttendance.breakEnd === undefined) ? null : todayAttendance.breakEnd;
            todayAttendance.overtimeStart = (todayAttendance.overtimeStart === '' || todayAttendance.overtimeStart === undefined) ? null : todayAttendance.overtimeStart;

            this.attendanceData = todayAttendance;

            // Update tampilan shift
            this.updateShiftDisplay();

            // Determine current state
            if (todayAttendance.shift === 'Libur' && !todayAttendance.clockIn) {
                this.currentState = 'libur';
            } else if (todayAttendance.clockOut) {
                this.currentState = 'completed';
            } else if (todayAttendance.breakStart && !todayAttendance.breakEnd) {
                this.currentState = 'on-break';
            } else if (todayAttendance.clockIn) {
                this.currentState = 'clocked-in';
            } else {
                this.currentState = 'waiting';
            }

            console.log('Loaded attendance for today:', todayAttendance.date, this.attendanceData);
        } catch (error) {
            console.error('Error loading attendance:', error);
        }
    },

    async loadAttendanceHistory() {
        try {
            const result = await api.getAllAttendance();
            const allData = result.data || [];

            // Filter by current user
            const currentUser = auth.getCurrentUser();
            const userId = currentUser?.id || 'demo-user';
            const historyData = allData.filter(d => String(d.userId) === String(userId));

            this.renderHistory(historyData);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    },

    renderHistory(historyData) {
        const tbody = document.getElementById('attendance-history');
        if (!tbody) return;

        if (historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Belum ada riwayat absensi.</td></tr>';
            return;
        }

        // Mapping status ke badge
        const getStatusBadge = (status) => {
            if (!status) return '<span class="badge-status secondary">Waiting</span>';
            
            const s = status.toLowerCase();
            const map = {
                'on time': { class: 'success', label: 'On Time' },
                'tepat': { class: 'success', label: 'Tepat Waktu' },
                'tepat waktu': { class: 'success', label: 'Tepat Waktu' },
                'ontime': { class: 'success', label: 'On Time' },
                'early in': { class: 'info', label: 'Early In' },
                'rajin': { class: 'success', label: 'Rajin' },
                'terlambat': { class: 'warning', label: 'Terlambat' },
                'late': { class: 'warning', label: 'Terlambat' },
                'late & early out': { class: 'danger', label: 'Late & Early Out' },
                'early out': { class: 'warning', label: 'Early Out' },
                'outside': { class: 'danger', label: 'Outside' },
                'lembur': { class: 'warning', label: 'Lembur' },
                'incomplete': { class: 'secondary', label: 'Incomplete' },
                'alpha': { class: 'danger', label: 'Alpha' },
                'cuti': { class: 'info', label: 'Cuti' },
                'cuti tahunan': { class: 'info', label: 'Cuti' },
                'cuti sakit': { class: 'info', label: 'Cuti Sakit' },
                'sakit': { class: 'info', label: 'Sakit' },
                'izin': { class: 'info', label: 'Izin' },
                'izin penting': { class: 'info', label: 'Izin Penting' },
                'keadaan darurat': { class: 'info', label: 'Keadaan Darurat' },
                'dinas luar': { class: 'info', label: 'Dinas Luar' },
                'libur': { class: 'secondary', label: 'Libur' },
                'waiting': { class: 'secondary', label: 'Menunggu' }
            };
            
            for (const [key, val] of Object.entries(map)) {
                if (s === key) {
                    return `<span class="badge-status ${val.class}">${val.label}</span>`;
                }
            }
            // Fallback: tampilkan status asli
            return `<span class="badge-status secondary">${status}</span>`;
        };

        tbody.innerHTML = historyData.slice(0, 10).map(record => {
            // Calculate duration using the shared utility function
            let duration = '--';
            if (record.clockIn && record.clockOut) {
                duration = dateTime.calculateDuration(record.clockIn, record.clockOut);
            }

            // Format date to local standard UI string
            const [y, m, d] = record.date.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
            const dateStr = `${d} ${months[parseInt(m) - 1] || m} ${y}`;

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${record.shift || '-'}</td>
                    <td>${dateTime.normalizeTime(record.clockIn) || '--:--'}</td>
                    <td>${dateTime.normalizeTime(record.clockOut) || '--:--'}</td>
                    <td>${duration}</td>
                    <td>${getStatusBadge(record.status)}</td>
                </tr>
            `;
        }).join('');
    },

    initLiveClock() {
        // Clear existing interval
        if (this.liveClockInterval) {
            clearInterval(this.liveClockInterval);
        }

        const updateClock = () => {
            const clockEl = document.getElementById('live-clock');
            const dateEl = document.getElementById('live-date');

            if (clockEl) {
                clockEl.textContent = dateTime.getCurrentTime();
            }
            if (dateEl) {
                dateEl.textContent = dateTime.getCurrentDate();
            }
        };

        updateClock();
        this.liveClockInterval = setInterval(updateClock, 1000);
    },

    initButtons() {
        // Hapus listener lama pada setiap tombol dengan cloning + replace
        const btnClockIn = document.getElementById('btn-clock-in');
        if (btnClockIn) {
            const newBtn = btnClockIn.cloneNode(true);
            btnClockIn.parentNode.replaceChild(newBtn, btnClockIn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleClockIn();
            });
            newBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleClockIn();
            });
        }

        // Break
        const btnBreak = document.getElementById('btn-break');
        if (btnBreak) {
            const newBtn = btnBreak.cloneNode(true);
            btnBreak.parentNode.replaceChild(newBtn, btnBreak);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleBreak();
            });
            newBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleBreak();
            });
        }

        // After Break
        const btnAfterBreak = document.getElementById('btn-after-break');
        if (btnAfterBreak) {
            const newBtn = btnAfterBreak.cloneNode(true);
            btnAfterBreak.parentNode.replaceChild(newBtn, btnAfterBreak);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleAfterBreak();
            });
            newBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleAfterBreak();
            });
        }

        // Overtime
        const btnOvertime = document.getElementById('btn-overtime');
        if (btnOvertime) {
            const newBtn = btnOvertime.cloneNode(true);
            btnOvertime.parentNode.replaceChild(newBtn, btnOvertime);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleOvertime();
            });
            newBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleOvertime();
            });
        }

        // Clock Out
        const btnClockOut = document.getElementById('btn-clock-out');
        if (btnClockOut) {
            const newBtn = btnClockOut.cloneNode(true);
            btnClockOut.parentNode.replaceChild(newBtn, btnClockOut);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleClockOut();
            });
            newBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleClockOut();
            });
        }
    },

    handleClockIn() {
        if (this.processing) return;
        if (this.attendanceData.clockIn) return;

        this.processing = true;
        // Navigate to face recognition first
        router.navigate('face-recognition');
        setTimeout(() => {
            if (window.faceRecognition) {
                window.faceRecognition.init('clock-in');
            }
            this.processing = false;
        }, 100);
    },

    handleBreak() {
        if (this.processing) return;
        // CEK TAMBAHAN: Jika sudah clock out, tolak aksi
        if (this.attendanceData.clockOut && this.attendanceData.clockOut !== '') {
            toast.warning('Anda sudah clock out hari ini. Tidak dapat memulai istirahat.');
            return;
        }
        if (!this.attendanceData.clockIn || this.attendanceData.breakStart) return;

        this.processing = true;
        // Navigate to face recognition
        router.navigate('face-recognition');
        setTimeout(() => {
            if (window.faceRecognition) {
                window.faceRecognition.init('break');
            }
            this.processing = false;
        }, 100);
    },

    handleAfterBreak() {
        if (this.processing) return;
        // CEK TAMBAHAN: Jika sudah clock out, tolak aksi
        if (this.attendanceData.clockOut && this.attendanceData.clockOut !== '') {
            toast.warning('Anda sudah clock out hari ini. Tidak dapat menyelesaikan istirahat.');
            return;
        }
        if (!this.attendanceData.breakStart || this.attendanceData.breakEnd) return;

        this.processing = true;
        // Navigate to face recognition
        router.navigate('face-recognition');
        setTimeout(() => {
            if (window.faceRecognition) {
                window.faceRecognition.init('after-break');
            }
            this.processing = false;
        }, 100);
    },

    handleOvertime() {
        // Cek flag storage terlebih dahulu untuk mencegah double klik meski processing belum set
        if (storage.get('temp_overtime_started')) {
            toast.warning('Anda sudah memulai lembur hari ini.');
            return;
        }
        if (this.processing) return;
        // CEK TAMBAHAN: Jika sudah clock out, tolak aksi
        if (this.attendanceData.clockOut && this.attendanceData.clockOut !== '') {
            toast.warning('Anda sudah clock out hari ini. Tidak dapat memulai lembur.');
            return;
        }
        // CEK TAMBAHAN: Jika sudah lembur, tolak aksi
        if (this.attendanceData.overtimeStart && this.attendanceData.overtimeStart !== '') {
            toast.warning('Anda sudah memulai lembur hari ini.');
            return;
        }
        if (!this.attendanceData.clockIn) return;

        this.processing = true;
        
        // Disable tombol overtime secara manual segera untuk mencegah klik kedua
        const btnOvertime = document.getElementById('btn-overtime');
        if (btnOvertime) {
            btnOvertime.disabled = true;
        }
        
        // Navigate to face recognition
        router.navigate('face-recognition');
        setTimeout(() => {
            if (window.faceRecognition) {
                window.faceRecognition.init('overtime');
            }
            this.processing = false;
        }, 100);
    },

    handleClockOut() {
        if (this.processing) return;
        // CEK TAMBAHAN: Jika sudah clock out, tolak aksi
        if (this.attendanceData.clockOut && this.attendanceData.clockOut !== '') {
            toast.warning('Anda sudah clock out hari ini.');
            return;
        }
        if (!this.attendanceData.clockIn) return;

        this.processing = true;
        // Navigate to face recognition
        router.navigate('face-recognition');
        setTimeout(() => {
            if (window.faceRecognition) {
                window.faceRecognition.init('clock-out');
            }
            this.processing = false;
        }, 100);
    },

    // Process attendance after face recognition verification
    async processWithVerification(action, verificationData) {
        // CEK TAMBAHAN: Validasi ulang status clockOut sebelum memproses aksi apapun
        if (this.attendanceData.clockOut && this.attendanceData.clockOut !== '') {
            toast.warning('Anda sudah clock out hari ini. Tidak dapat melakukan aksi ini.');
            return;
        }

        const now = new Date();
        const timeStr = dateTime.formatTime(now);
        
        // Simpan state asli untuk rollback jika gagal
        const originalData = JSON.parse(JSON.stringify(this.attendanceData));
        const originalState = this.currentState;

        try {
            switch (action) {
                case 'clock-in':
                    this.attendanceData.clockIn = timeStr;
                    this.attendanceData.status = 'ontime';
                    this.currentState = 'clocked-in';
                    toast.success(`Clock In berhasil: ${timeStr}`);
                    break;
                case 'break':
                    this.attendanceData.breakStart = timeStr;
                    this.currentState = 'on-break';
                    toast.info(`Mulai istirahat: ${timeStr}`);
                    break;
                case 'after-break':
                    this.attendanceData.breakEnd = timeStr;
                    this.currentState = 'clocked-in';
                    toast.success(`Selesai istirahat: ${timeStr}`);
                    break;
                case 'overtime':
                    this.attendanceData.overtimeStart = timeStr;
                    // Simpan flag ke storage untuk mencegah double klik bahkan jika data belum tersimpan ke server
                    storage.set('temp_overtime_started', true);
                    toast.info(`Mulai lembur: ${timeStr}`);
                    break;
                case 'clock-out':
                    this.attendanceData.clockOut = timeStr;
                    this.currentState = 'completed';
                    toast.success(`Clock Out berhasil: ${timeStr}`);
                    break;
            }

            // Save verification data - gunakan field name yang dikenali backend
            this.attendanceData.verificationPhoto = verificationData.photo || null;
            this.attendanceData.verificationLocation = verificationData.location ? JSON.stringify(verificationData.location) : '';
            this.attendanceData.verificationTimestamp = verificationData.timestamp || new Date().toISOString();

            // Simpan ke server
            await this.saveAttendance();

            // Jika berhasil, update UI dan bersihkan temp
            this.updateUI();
            this.renderTimeline();
            storage.remove('temp_attendance');

            // Refresh dashboard setelah absensi untuk update statistik
            if (window.dashboard) {
                try {
                    await window.dashboard.loadData();
                    window.dashboard.updateStats();
                    window.dashboard.updateSessionInfo();
                } catch (e) {
                    console.error('Error refreshing dashboard:', e);
                }
            }

            // Refresh shift info setelah clock out untuk konsistensi dashboard
            // Gunakan try-catch terpisah agar error refresh tidak mengganggu flow utama
            if (action === 'clock-out' && window.dashboard) {
                try {
                    await window.dashboard.refreshShiftInfo();
                } catch (refreshError) {
                    console.warn('Gagal refresh shift info (non-critical):', refreshError);
                    // Jangan tampilkan error atau rollback karena ini hanya refresh UI
                }
            }
        } catch (error) {
            console.error('Gagal menyimpan absensi:', error);
            // Rollback state ke kondisi semula
            this.attendanceData = originalData;
            this.currentState = originalState;
            // Hapus flag overtime jika rollback
            if (action === 'overtime') {
                storage.remove('temp_overtime_started');
            }
            // Jangan tampilkan toast error, cukup log untuk debugging
            // Error ini akan tercatat di console untuk debugging
        }
    },

    async saveAttendance() {
        const currentUser = auth.getCurrentUser();
        this.attendanceData.userId = currentUser?.id || 'demo-user';

        loadingIndicator.show('Menyimpan data absensi...');
        try {
            const result = await api.saveAttendance(this.attendanceData);
            if (result && result.success && result.data) {
                // Gabungkan data server dengan data lokal, jangan timpa sepenuhnya
                // Ini penting agar clockOut yang baru diset tidak hilang
                this.attendanceData = { ...this.attendanceData, ...result.data };
            } else {
                throw new Error(result?.error || 'Gagal menyimpan absensi');
            }
        } catch (error) {
            console.error('Error saving attendance:', error);
            throw error;
        } finally {
            loadingIndicator.hide();
        }
    },

    updateUI() {
        // Update status ring
        const statusRing = document.querySelector('.status-ring');
        const statusText = document.querySelector('.status-text');
        const statusSubtext = document.querySelector('.status-subtext');

        if (statusRing) {
            statusRing.className = 'status-ring';

            // Cek apakah status dari backend adalah Outside atau Lembur
            const isOutside = this.attendanceData && this.attendanceData.status && 
                              this.attendanceData.status.toLowerCase() === 'outside';
            const isLembur = this.attendanceData && this.attendanceData.status && 
                             this.attendanceData.status.toLowerCase() === 'lembur';

            switch (this.currentState) {
                case 'blocked':
                    statusRing.classList.add('completed');
                    if (statusText) statusText.textContent = this.attendanceData.shift || 'Tidak Bekerja';
                    if (statusSubtext) statusSubtext.textContent = `Anda sedang ${this.attendanceData.status} pada hari ini. Tidak dapat melakukan absensi.`;
                    break;
                case 'libur':
                    statusRing.classList.add('waiting'); // Reuse waiting style or custom if desired
                    if (statusText) statusText.textContent = 'Hari Libur';
                    if (statusSubtext) statusSubtext.textContent = 'Anda tidak memiliki jadwal kerja hari ini.';
                    break;
                case 'waiting':
                    if (isOutside) {
                        statusRing.classList.add('completed');
                        if (statusText) statusText.textContent = 'Outside Shift';
                        if (statusSubtext) statusSubtext.textContent = 'Anda melakukan absensi di luar jam kerja.';
                    } else {
                        statusRing.classList.add('waiting');
                        if (statusText) statusText.textContent = 'Siap Clock In';
                        if (statusSubtext) statusSubtext.textContent = 'Tekan tombol di bawah untuk memulai';
                    }
                    break;
                case 'clocked-in':
                    if (isOutside) {
                        statusRing.classList.add('completed');
                        if (statusText) statusText.textContent = 'Outside Shift';
                        if (statusSubtext) statusSubtext.textContent = 'Anda melakukan absensi di luar jam kerja.';
                    } else {
                        statusRing.classList.add('active');
                        if (statusText) statusText.textContent = 'Sedang Bekerja';
                        if (statusSubtext) statusSubtext.textContent = 'Semangat bekerja!';
                    }
                    break;
                case 'on-break':
                    statusRing.classList.add('on-break');
                    if (statusText) statusText.textContent = 'Sedang Istirahat';
                    if (statusSubtext) statusSubtext.textContent = 'Nikmati waktu istirahat Anda';
                    break;
                case 'completed':
                    if (isOutside) {
                        statusRing.classList.add('completed');
                        if (statusText) statusText.textContent = 'Outside Shift';
                        if (statusSubtext) statusSubtext.textContent = 'Anda melakukan absensi di luar jam kerja.';
                    } else if (isLembur) {
                        statusRing.classList.add('completed');
                        if (statusText) statusText.textContent = 'Lembur';
                        if (statusSubtext) statusSubtext.textContent = 'Anda melakukan lembur melebihi jam kerja.';
                    } else {
                        statusRing.classList.add('completed');
                        if (statusText) statusText.textContent = 'Selesai Bekerja';
                        if (statusSubtext) statusSubtext.textContent = 'Terima kasih atas kerja kerasnya!';
                    }
                    break;
            }
        }

        // Update buttons - Logika disable tombol yang lebih detail
        const btnClockIn = document.getElementById('btn-clock-in');
        const btnBreak = document.getElementById('btn-break');
        const btnAfterBreak = document.getElementById('btn-after-break');
        const btnOvertime = document.getElementById('btn-overtime');
        const btnClockOut = document.getElementById('btn-clock-out');

        // Jika dalam keadaan blocked (cuti/izin), nonaktifkan semua tombol
        if (this.currentState === 'blocked') {
            [btnClockIn, btnBreak, btnAfterBreak, btnOvertime, btnClockOut].forEach(btn => {
                if (btn) btn.disabled = true;
            });
            return;
        }

        const isClockedIn = this.attendanceData.clockIn && this.attendanceData.clockIn !== '';
        const isClockedOut = this.attendanceData.clockOut && this.attendanceData.clockOut !== '';
        const isBreakStarted = this.attendanceData.breakStart && this.attendanceData.breakStart !== '';
        const isBreakEnded = this.attendanceData.breakEnd && this.attendanceData.breakEnd !== '';
        const isOvertimeStarted = this.attendanceData.overtimeStart && this.attendanceData.overtimeStart !== '';

        // Clock In button: disabled jika sudah clock in atau sudah clock out
        if (btnClockIn) {
            const isLibur = this.currentState === 'libur';
            btnClockIn.disabled = isClockedIn || isLibur || isClockedOut;

            if (isClockedIn) {
                btnClockIn.classList.add('completed');
                const timeEl = document.getElementById('clock-in-time');
                if (timeEl) timeEl.textContent = dateTime.normalizeTime(this.attendanceData.clockIn);
            } else if (isLibur) {
                btnClockIn.classList.add('completed');
            } else {
                btnClockIn.classList.remove('completed');
            }
        }

        // Break button: disabled jika belum clock in, sudah break, atau sudah clock out
        if (btnBreak) {
            btnBreak.disabled = !isClockedIn || isBreakStarted || isClockedOut;
            if (isBreakStarted) {
                btnBreak.classList.add('completed');
                document.getElementById('break-time').textContent = dateTime.normalizeTime(this.attendanceData.breakStart);
            }
        }

        // After Break button: PRIORITAS - disabled jika sudah clock out, belum break start, sudah break end, atau sudah overtime
        if (btnAfterBreak) {
            btnAfterBreak.disabled = isClockedOut || !isBreakStarted || isBreakEnded || isOvertimeStarted;
            if (isBreakEnded) {
                btnAfterBreak.classList.add('completed');
                document.getElementById('after-break-time').textContent = dateTime.normalizeTime(this.attendanceData.breakEnd);
            }
        }

        // Overtime button: PRIORITAS - disabled jika sudah clock out, belum clock in, atau sudah mulai overtime
        if (btnOvertime) {
            btnOvertime.disabled = isClockedOut || !isClockedIn || isOvertimeStarted;
            if (isOvertimeStarted) {
                btnOvertime.classList.add('completed');
                document.getElementById('overtime-time').textContent = dateTime.normalizeTime(this.attendanceData.overtimeStart);
            }
        }

        // Clock Out button: disabled jika belum clock in atau sudah clock out
        if (btnClockOut) {
            btnClockOut.disabled = !isClockedIn || isClockedOut;
            if (isClockedOut) {
                btnClockOut.classList.add('completed');
                document.getElementById('clock-out-time').textContent = dateTime.normalizeTime(this.attendanceData.clockOut);
            }
        }
    },

    updateUIBlocked() {
        // Method khusus untuk menampilkan UI saat diblokir (cuti/izin)
        this.updateUI();
    },

    updateShiftDisplay() {
        const shiftNameEl = document.getElementById('current-shift-name');
        const shiftTimeEl = document.getElementById('current-shift-time');
        if (!shiftNameEl || !shiftTimeEl) return;

        const shiftName = this.attendanceData.shift || 'Pagi';
        shiftNameEl.textContent = shiftName;

        // Cari jam kerja shift dari storage (shifts)
        const shifts = storage.get('shifts', []);
        const shiftDetail = shifts.find(s => s.name === shiftName);
        if (shiftDetail) {
            shiftTimeEl.textContent = `${shiftDetail.startTime} - ${shiftDetail.endTime}`;
        } else {
            // Fallback default
            shiftTimeEl.textContent = '08:00 - 17:00';
        }
    },

    renderTimeline() {
        const timeline = document.getElementById('attendance-timeline');
        if (!timeline) return;

        const items = timeline.querySelectorAll('.timeline-item');

        items.forEach(item => {
            const type = item.dataset.type;
            const timeEl = item.querySelector('.timeline-time');

            item.className = 'timeline-item pending';

            switch (type) {
                case 'clock-in':
                    if (this.attendanceData.clockIn) {
                        item.classList.remove('pending');
                        item.classList.add('completed');
                        if (timeEl) timeEl.textContent = dateTime.normalizeTime(this.attendanceData.clockIn);
                    }
                    break;
                case 'break':
                    if (this.attendanceData.breakStart) {
                        item.classList.remove('pending');
                        item.classList.add('completed');
                        if (timeEl) timeEl.textContent = dateTime.normalizeTime(this.attendanceData.breakStart);
                    }
                    break;
                case 'after-break':
                    if (this.attendanceData.breakEnd) {
                        item.classList.remove('pending');
                        item.classList.add('completed');
                        if (timeEl) timeEl.textContent = dateTime.normalizeTime(this.attendanceData.breakEnd);
                    }
                    break;
                case 'clock-out':
                    if (this.attendanceData.clockOut) {
                        item.classList.remove('pending');
                        item.classList.add('completed');
                        if (timeEl) timeEl.textContent = dateTime.normalizeTime(this.attendanceData.clockOut);
                    }
                    break;
            }
        });

        // Set active state for current
        if (this.currentState === 'clocked-in' && !this.attendanceData.clockOut) {
            const activeItem = timeline.querySelector('.timeline-item.completed:last-child');
            if (activeItem && activeItem.nextElementSibling) {
                activeItem.nextElementSibling.classList.add('active');
            }
        } else if (this.currentState === 'on-break') {
            const breakItem = timeline.querySelector('[data-type="break"]');
            if (breakItem) {
                breakItem.classList.remove('completed');
                breakItem.classList.add('active');
            }
        }
    },

    // Reset method untuk membersihkan state saat logout atau navigasi keluar
    reset() {
        this.processing = false;
        if (this.liveClockInterval) {
            clearInterval(this.liveClockInterval);
            this.liveClockInterval = null;
        }
        this.currentState = 'waiting';
        this.attendanceData = {};
        // Hapus flag overtime saat reset
        storage.remove('temp_overtime_started');
        // isInitialized tidak lagi digunakan, tapi biarkan field ini ada untuk kompatibilitas
    }
};

// Global init function
window.initAbsensi = () => {
    absensi.init();
};

window.absensi = absensi;
