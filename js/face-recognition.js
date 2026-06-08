/**
 * Portal Karyawan - Photo Capture & Location
 * Simple photo capture for attendance verification (no face recognition)
 */

const faceRecognition = {
    video: null,
    canvas: null,
    stream: null,
    currentAction: null,
    photoCaptured: false,
    locationVerified: false,
    position: null,
    countdownTimer: null,
    countdownSeconds: 3,

    init(action) {
        this.currentAction = action;
        this.photoCaptured = false;
        this.locationVerified = false;
        this.position = null;
        this.countdownTimer = null;

        // Update UI based on action
        this.updateActionTitle(action);

        // Initialize camera
        this.initCamera();

        // Initialize location
        this.initLocation();

        // Bind buttons
        this.bindButtons();
    },

    updateActionTitle(action) {
        const titles = {
            'clock-in': { title: 'Clock In - Ambil Foto', subtitle: 'Ambil foto untuk bukti absensi Clock In' },
            'clock-out': { title: 'Clock Out - Ambil Foto', subtitle: 'Ambil foto untuk bukti absensi Clock Out' },
            'break': { title: 'Istirahat - Ambil Foto', subtitle: 'Ambil foto untuk mulai istirahat' },
            'after-break': { title: 'Selesai Istirahat - Ambil Foto', subtitle: 'Ambil foto untuk kembali bekerja' },
            'overtime': { title: 'Lembur - Ambil Foto', subtitle: 'Ambil foto untuk mulai lembur' },
            'izin': { title: 'Pengajuan Izin - Ambil Foto', subtitle: 'Ambil foto untuk pengajuan izin' }
        };

        const titleEl = document.getElementById('face-rec-title');
        const subtitleEl = document.getElementById('face-rec-subtitle');

        if (titles[action]) {
            if (titleEl) titleEl.textContent = titles[action].title;
            if (subtitleEl) subtitleEl.textContent = titles[action].subtitle;
        }
    },

    async initCamera() {
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');

        if (!this.video) return;

        try {
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            this.video.srcObject = this.stream;

            // Enable capture button when video is ready
            this.video.onloadedmetadata = () => {
                const captureBtn = document.getElementById('btn-capture');
                if (captureBtn) {
                    captureBtn.disabled = false;
                }
            };

        } catch (error) {
            console.error('Camera error:', error);
            toast.error('Tidak dapat mengakses kamera. Pastikan Anda memberikan izin kamera.');
        }
    },

    initLocation() {
        if (!navigator.geolocation) {
            toast.error('Browser Anda tidak mendukung geolokasi');
            return;
        }

        const statusEl = document.getElementById('location-status');
        const infoEl = document.getElementById('location-info');
        const mapEl = document.getElementById('location-map');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.position = position;
                this.locationVerified = true;

                // Update status
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Terverifikasi';
                    statusEl.classList.add('verified');
                }

                // Show location info
                if (infoEl) {
                    infoEl.style.display = 'block';

                    const coordsEl = document.getElementById('location-coords');
                    const addressEl = document.getElementById('location-address');
                    const timeEl = document.getElementById('location-time');
                    const accuracyEl = document.getElementById('location-accuracy');

                    if (coordsEl) {
                        coordsEl.textContent = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                    }
                    if (addressEl) {
                        addressEl.textContent = 'Lokasi Valid';
                    }
                    if (timeEl) {
                        timeEl.textContent = dateTime.getCurrentTime();
                    }
                    if (accuracyEl) {
                        accuracyEl.textContent = `±${Math.round(position.coords.accuracy)}m`;
                    }
                }

                // Update map visualization
                if (mapEl) {
                    mapEl.innerHTML = `
                        <div class="map-container">
                            <div class="map-marker"></div>
                            <div style="position: absolute; bottom: 10px; left: 10px; background: rgba(255,255,255,0.9); padding: 8px; border-radius: 6px; font-size: 12px;">
                                <i class="fas fa-map-marker-alt" style="color: var(--color-primary);"></i>
                                Lokasi Valid
                            </div>
                        </div>
                    `;
                }

                this.checkCanSubmit();
            },
            (error) => {
                console.error('Location error:', error);

                // Fallback for testing on desktop/localhost
                this.position = {
                    coords: { latitude: -6.200000, longitude: 106.816666, accuracy: 100 } // Jakarta default
                };
                this.locationVerified = true;

                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-exclamation-circle" style="color:var(--color-warning);"></i> Simulasi Lokasi';
                }
                toast.warning('Menggunakan lokasi simulasi karena GPS gagal.');
                this.checkCanSubmit();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    },

    bindButtons() {
        const captureBtn = document.getElementById('btn-capture');
        const retakeBtn = document.getElementById('btn-retake');
        const confirmBtn = document.getElementById('btn-confirm-attendance');

        if (captureBtn) {
            const newCaptureBtn = captureBtn.cloneNode(true);
            captureBtn.parentNode.replaceChild(newCaptureBtn, captureBtn);
            newCaptureBtn.addEventListener('click', (e) => { e.preventDefault(); this.capturePhoto(); });
        }

        if (retakeBtn) {
            const newRetakeBtn = retakeBtn.cloneNode(true);
            retakeBtn.parentNode.replaceChild(newRetakeBtn, retakeBtn);
            newRetakeBtn.addEventListener('click', (e) => { e.preventDefault(); this.retakePhoto(); });
        }

        if (confirmBtn) {
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            newConfirmBtn.addEventListener('click', (e) => { e.preventDefault(); this.confirmAttendance(); });
        }
    },

    capturePhoto() {
        if (!this.video || !this.canvas) return;

        const ctx = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(this.video, 0, 0);

        // Stop camera immediately (no fake verification delay)
        this.stopCamera();

        // Show captured photo with preview
        const preview = document.getElementById('camera-preview');
        if (preview) {
            preview.innerHTML = `
                <img src="${this.canvas.toDataURL('image/jpeg', 0.8)}" class="captured-photo" alt="Captured">
                <div class="verification-status show" id="verification-status">
                    <div class="status-icon">
                        <i class="fas fa-camera"></i>
                    </div>
                    <p>Foto Tersimpan</p>
                </div>
            `;
        }

        // Update buttons
        const captureBtn = document.getElementById('btn-capture');
        const retakeBtn = document.getElementById('btn-retake');

        if (captureBtn) captureBtn.style.display = 'none';
        if (retakeBtn) retakeBtn.style.display = 'flex';

        this.photoCaptured = true;
        this.checkCanSubmit();
    },

    retakePhoto() {
        this.photoCaptured = false;

        // Reset preview
        const preview = document.getElementById('camera-preview');
        if (preview) {
            preview.innerHTML = `
                <video id="camera-video" autoplay playsinline></video>
                <canvas id="camera-canvas" style="display: none;"></canvas>
                <div class="face-overlay" id="face-overlay">
                    <div class="face-frame">
                        <div class="face-corner top-left"></div>
                        <div class="face-corner top-right"></div>
                        <div class="face-corner bottom-left"></div>
                        <div class="face-corner bottom-right"></div>
                    </div>
                    <div class="face-guide">
                        <i class="fas fa-camera"></i>
                        <p>Posisikan wajah di dalam frame</p>
                    </div>
                </div>
            `;
        }

        // Update buttons
        const captureBtn = document.getElementById('btn-capture');
        const retakeBtn = document.getElementById('btn-retake');

        if (captureBtn) {
            captureBtn.style.display = 'flex';
            captureBtn.disabled = true;
        }
        if (retakeBtn) retakeBtn.style.display = 'none';

        // Reinitialize camera
        this.initCamera();
        this.checkCanSubmit();
    },

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    },

    checkCanSubmit() {
        const confirmBtn = document.getElementById('btn-confirm-attendance');
        if (confirmBtn) {
            confirmBtn.disabled = !(this.photoCaptured && this.locationVerified);
        }
    },

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // meter
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    async confirmAttendance() {
        if (!this.photoCaptured || !this.locationVerified) {
            toast.error('Harap ambil foto dan verifikasi lokasi terlebih dahulu!');
            return;
        }

        // Ambil pengaturan lokasi toko dari backend
        let locationSettings;
        try {
            const result = await api.request('getLocationSettings');
            if (result.success) {
                locationSettings = result.data;
            } else {
                throw new Error('Gagal mengambil pengaturan lokasi');
            }
        } catch (error) {
            console.error('Location settings error:', error);
            toast.warning('Tidak dapat memverifikasi lokasi toko, lanjutkan tanpa validasi radius');
            locationSettings = { lat: 0, lng: 0, radius: 999999 };
        }

        const companyLat = locationSettings.lat;
        const companyLng = locationSettings.lng;
        const radius = locationSettings.radius;

        // Validasi hanya jika koordinat toko sudah diatur
        if (companyLat && companyLng && companyLat !== 0 && companyLng !== 0) {
            const distance = this.calculateDistance(
                this.position.coords.latitude,
                this.position.coords.longitude,
                companyLat,
                companyLng
            );

            if (distance > radius) {
                toast.error(`Anda berada di luar radius toko (${Math.round(distance)}m > ${radius}m). Absensi gagal!`);
                return;
            }

            toast.success(`Lokasi valid (${Math.round(distance)}m dari toko)`);
            
            // Simpan jarak ke data lokasi
            if (!this.attendanceData) this.attendanceData = {};
            this.attendanceData.distance = distance;
        } else {
            toast.warning('Admin belum mengatur koordinat toko, melewati validasi lokasi');
        }

        // Save data with compressed photo (JPEG 0.8 quality)
        const attendanceData = {
            action: this.currentAction,
            timestamp: new Date().toISOString(),
            location: {
                latitude: this.position.coords.latitude,
                longitude: this.position.coords.longitude,
                accuracy: this.position.coords.accuracy,
                distance: this.attendanceData.distance || 0
            },
            photo: this.canvas ? this.canvas.toDataURL('image/jpeg', 0.8) : null
        };

        // Store temporary data
        storage.set('temp_attendance', attendanceData);

        // Process based on action
        toast.success('Foto berhasil disimpan!');

        // Wrap in async IIFE to allow awaiting the process before navigating
        (async () => {
            try {
                if (this.currentAction === 'izin') {
                    if (window.izin) {
                        await window.izin.submitWithVerification(attendanceData);
                    }
                    setTimeout(() => router.navigate('izin'), 500);
                } else {
                    if (window.absensi) {
                        await window.absensi.processWithVerification(this.currentAction, attendanceData);
                    }
                    setTimeout(() => router.navigate('absensi'), 500);
                }
            } catch (error) {
                console.error('Processing error:', error);
                toast.error('Terjadi kesalahan saat memproses data.');
            }
        })();
    },

    // Cleanup when leaving page
    cleanup() {
        this.stopCamera();
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }
};

// Global init function
window.initFaceRecognition = (action) => {
    faceRecognition.init(action);
};

// Cleanup on page change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        faceRecognition.cleanup();
    }
});

// Expose
window.faceRecognition = faceRecognition;
