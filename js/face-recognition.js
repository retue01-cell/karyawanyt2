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
    isInitializing: false,
    map: null,
    locationSettings: null,      // untuk menyimpan setting toko
    locationUpdateInterval: null, // untuk update waktu

    async init(action) {
        if (this.isInitializing) {
            console.warn('Face recognition already initializing, skip');
            return;
        }
        this.isInitializing = true;
        
        // Bersihkan stream dan map sebelumnya
        this.cleanup();
        
        // Tunggu 200ms agar stream benar-benar dilepas browser
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Reset UI ke keadaan awal (tombol ambil foto muncul)
        this.resetUI();
        
        this.currentAction = action;
        this.photoCaptured = false;
        this.locationVerified = false;
        this.position = null;
        this.countdownTimer = null;
        
        // Update UI based on action
        this.updateActionTitle(action);
        
        // Ambil setting lokasi toko dari backend
        try {
            await this.loadLocationSettings();
        } catch(e) {
            console.warn('Gagal ambil setting lokasi:', e);
            this.locationSettings = null;
        }
        
        this.initCamera();
        this.initLocation();
        this.bindButtons();
        this.isInitializing = false;
    },

    async loadLocationSettings() {
        try {
            const result = await api.request('getLocationSettings');
            if (result.success) {
                this.locationSettings = result.data;
            } else {
                this.locationSettings = null;
            }
        } catch (e) {
            console.warn('Gagal ambil setting lokasi:', e);
            this.locationSettings = null;
        }
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
        // Ambil ulang elemen setelah cleanup (bisa jadi DOM berubah)
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');

        if (!this.video) {
            console.error('Video element not found');
            toast.error('Elemen kamera tidak ditemukan');
            this.isInitializing = false;
            return;
        }

        // Hapus stream lama jika masih menempel
        if (this.video.srcObject) {
            const oldStream = this.video.srcObject;
            if (oldStream && oldStream.getTracks) {
                oldStream.getTracks().forEach(track => track.stop());
            }
            this.video.srcObject = null;
        }

        // Tampilkan video (hilangkan style none)
        this.video.style.display = 'block';

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            this.video.srcObject = this.stream;

            this.video.onloadedmetadata = () => {
                const captureBtn = document.getElementById('btn-capture');
                if (captureBtn) {
                    captureBtn.disabled = false;
                }
                this.video.play().catch(e => console.warn('Video play error:', e));
            };

        } catch (error) {
            console.error('Camera error:', error);
            // Hanya tampilkan toast jika error bukan NotReadableError (kamera sibuk sementara)
            if (error.name !== 'NotReadableError') {
                toast.error('Tidak dapat mengakses kamera. Pastikan Anda memberikan izin kamera.');
            } else {
                console.warn('Camera temporarily busy, please retry');
            }
            const captureBtn = document.getElementById('btn-capture');
            if (captureBtn) captureBtn.disabled = true;
            this.isInitializing = false;
        }
    },

    initLocation() {
        if (!navigator.geolocation) {
            toast.error('Browser Anda tidak mendukung geolokasi');
            this.updateLocationStatusUI('not_supported', 'Browser tidak support GPS');
            return;
        }

        const statusEl = document.getElementById('location-status');
        const infoEl = document.getElementById('location-info');
        const mapEl = document.getElementById('location-map');

        // Mulai update waktu realtime (setiap 1 detik)
        this.startLocationTimeUpdater();

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.position = position;
                
                // Validasi lokasi terhadap setting toko
                const isValid = this.validateLocation(position);
                
                if (isValid) {
                    this.locationVerified = true;
                    this.updateLocationStatusUI('verified', 'Lokasi Valid');
                } else {
                    this.locationVerified = false;
                    this.updateLocationStatusUI('invalid', 'Lokasi Tidak Valid');
                }

                // Update info lokasi
                if (infoEl) {
                    infoEl.style.display = 'block';
                    const coordsEl = document.getElementById('location-coords');
                    const addressEl = document.getElementById('location-address');
                    const accuracyEl = document.getElementById('location-accuracy');
                    
                    if (coordsEl) {
                        coordsEl.textContent = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                    }
                    if (addressEl) {
                        addressEl.textContent = isValid ? '✓ Lokasi dalam radius toko' : '✗ Di luar radius toko';
                    }
                    if (accuracyEl) {
                        accuracyEl.textContent = `±${Math.round(position.coords.accuracy)} m`;
                    }
                }

                // Inisialisasi peta (dengan perbaikan sebelumnya)
                this.initMap(position);
                this.checkCanSubmit();
            },
            (error) => {
                console.error('Location error:', error);
                this.locationVerified = false;
                this.updateLocationStatusUI('error', 'Gagal dapat lokasi');
                
                // Fallback untuk testing (opsional)
                if (window.location.hostname === 'localhost') {
                    const fallbackPos = { coords: { latitude: -6.200000, longitude: 106.816666, accuracy: 100 } };
                    this.position = fallbackPos;
                    const isValid = this.validateLocation(fallbackPos);
                    this.locationVerified = isValid;
                    this.updateLocationStatusUI(isValid ? 'verified' : 'invalid', isValid ? 'Lokasi Valid (simulasi)' : 'Lokasi Tidak Valid (simulasi)');
                    this.initMap(fallbackPos);
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    },

    validateLocation(position) {
        if (!this.locationSettings || !this.locationSettings.lat || !this.locationSettings.lng) {
            // Jika admin belum setting lokasi toko, anggap valid (atau bisa juga false)
            console.warn('Location settings not set, skipping validation');
            return true; // atau false sesuai kebijakan
        }
        
        const R = 6371e3;
        const φ1 = position.coords.latitude * Math.PI/180;
        const φ2 = this.locationSettings.lat * Math.PI/180;
        const Δφ = (this.locationSettings.lat - position.coords.latitude) * Math.PI/180;
        const Δλ = (this.locationSettings.lng - position.coords.longitude) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        const radius = this.locationSettings.radius || 100;
        return distance <= radius;
    },

    updateLocationStatusUI(status, message) {
        const statusEl = document.getElementById('location-status');
        if (!statusEl) return;
        
        if (status === 'verified') {
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
            statusEl.classList.add('verified');
            statusEl.classList.remove('invalid', 'error');
        } else if (status === 'invalid') {
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> ' + message;
            statusEl.classList.add('invalid');
            statusEl.classList.remove('verified', 'error');
        } else if (status === 'error') {
            statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + message;
            statusEl.classList.add('error');
            statusEl.classList.remove('verified', 'invalid');
        } else {
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + message;
        }
    },

    startLocationTimeUpdater() {
        // Update waktu setiap detik
        if (this.locationUpdateInterval) clearInterval(this.locationUpdateInterval);
        this.locationUpdateInterval = setInterval(() => {
            const timeEl = document.getElementById('location-time');
            if (timeEl) {
                timeEl.textContent = dateTime.normalizeTime(dateTime.getCurrentTime());
            }
        }, 1000);
    },

    bindButtons() {
        const captureBtn = document.getElementById('btn-capture');
        const retakeBtn = document.getElementById('btn-retake');
        const confirmBtn = document.getElementById('btn-confirm-attendance');
        
        const bindSafe = (element, handler) => {
            if (!element) return;
            const newEl = element.cloneNode(true);
            element.parentNode?.replaceChild(newEl, element);
            newEl.addEventListener('click', (e) => { e.preventDefault(); handler(); });
            return newEl;
        };
        
        bindSafe(captureBtn, () => this.capturePhoto());
        bindSafe(retakeBtn, async () => { await this.retakePhoto(); });
        bindSafe(confirmBtn, () => this.confirmAttendance());
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

    async retakePhoto() {
        // Matikan stream lama
        this.cleanup();
        // Reset UI ke awal
        this.resetUI();
        // Mulai ulang kamera dengan delay agar stream benar-benar dilepas
        await new Promise(resolve => setTimeout(resolve, 200));
        this.initCamera();
        this.initLocation(); // lokasi tetap bisa diambil ulang
        this.bindButtons();
    },

    resetUI() {
        // Reset tombol
        const captureBtn = document.getElementById('btn-capture');
        const retakeBtn = document.getElementById('btn-retake');
        const confirmBtn = document.getElementById('btn-confirm-attendance');
        
        if (captureBtn) {
            captureBtn.style.display = 'flex';
            captureBtn.disabled = true; // akan aktif setelah video ready
        }
        if (retakeBtn) {
            retakeBtn.style.display = 'none';
            retakeBtn.disabled = false;
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
        
        // Reset preview container ke struktur awal (tanpa foto)
        const preview = document.getElementById('camera-preview');
        if (preview) {
            // Hanya reset jika perlu, jangan hancurkan video element yang sedang dipakai
            const existingVideo = preview.querySelector('#camera-video');
            if (!existingVideo) {
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
            } else {
                // Hapus gambar hasil capture jika ada
                const capturedImg = preview.querySelector('img');
                if (capturedImg) capturedImg.remove();
                // Pastikan video muncul
                existingVideo.style.display = 'block';
                const overlay = preview.querySelector('.face-overlay');
                if (overlay) overlay.style.display = 'flex';
            }
        }
        
        // Hapus status verifikasi
        const statusDiv = document.getElementById('verification-status');
        if (statusDiv) statusDiv.classList.remove('show');
        
        // Reset flag
        this.photoCaptured = false;
        this.currentPhoto = null;
        // Jangan reset locationVerified di sini, biar tetap menunggu lokasi baru
        
        // Hapus interval update waktu jika ada
        if (this.locationUpdateInterval) {
            clearInterval(this.locationUpdateInterval);
            this.locationUpdateInterval = null;
        }
    },

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                if (track.readyState === 'live') track.stop();
            });
            this.stream = null;
        }
        
        // Bersihkan video element juga
        if (this.video) {
            if (this.video.srcObject) {
                this.video.srcObject = null;
            }
            this.video.pause();
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

    initMap(position) {
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer) return;

        // === PERBAIKAN 1: Hancurkan map sebelumnya ===
        if (this.map) {
            try {
                this.map.remove();
            } catch(e) {
                console.warn('Gagal menghapus map lama:', e);
            }
            this.map = null;
        }

        // Bersihkan container
        mapContainer.innerHTML = '';
        
        // Buat peta Leaflet (tambahkan opsi zoom control untuk debugging)
        const map = L.map(mapContainer, {
            zoomControl: true,
            fadeAnimation: false  // hindari efek fade yang bisa ganggu
        }).setView([position.coords.latitude, position.coords.longitude], 15);
        
        // Tile layer (peta dasar) dari CartoDB
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
        
        // Marker lokasi user
        const userMarker = L.marker([position.coords.latitude, position.coords.longitude], {
            title: 'Lokasi Anda'
        }).addTo(map);
        
        userMarker.bindPopup(`
            <strong>📍 Lokasi Anda</strong><br>
            ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}<br>
            Akurasi: ±${Math.round(position.coords.accuracy)} m
        `).openPopup();
        
        // Lingkaran akurasi GPS
        L.circle([position.coords.latitude, position.coords.longitude], {
            radius: position.coords.accuracy,
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);
        
        // Simpan instance map untuk keperluan lain (opsional)
        this.map = map;
        
        // === PERBAIKAN 2: invalidateSize dengan delay lebih andal ===
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
            }
        }, 200);
        
        // Tambahkan event listener untuk resize window
        window.addEventListener('resize', () => {
            if (this.map) this.map.invalidateSize();
        });
    },

    initMapFallback() {
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer) return;
        mapContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #e5e7eb; color: #6b7280; flex-direction: column;">
                <i class="fas fa-map-marker-alt fa-2x" style="margin-bottom: 8px;"></i>
                <p style="font-size: 14px;">Tidak dapat menampilkan peta</p>
                <p style="font-size: 12px;">Lokasi gagal diakses atau tidak tersedia</p>
            </div>
        `;
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
        // Hentikan stream kamera
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        // Bersihkan video element
        if (this.video) {
            if (this.video.srcObject) {
                this.video.srcObject = null;
            }
            this.video.pause();
            this.video.src = '';
            this.video.load(); // Reset internal state video element
        }
        // Hancurkan map
        if (this.map) {
            try { this.map.remove(); } catch(e) {}
            this.map = null;
        }
        // Hentikan interval update waktu
        if (this.locationUpdateInterval) {
            clearInterval(this.locationUpdateInterval);
            this.locationUpdateInterval = null;
        }
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    },
};

// Global init function
window.initFaceRecognition = (action) => {
    faceRecognition.init(action);
};

// Event visibilitychange untuk menghemat resource saat tab tidak aktif
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.faceRecognition) {
        // Hentikan stream kamera
        if (window.faceRecognition.stream) {
            window.faceRecognition.stream.getTracks().forEach(track => track.stop());
            window.faceRecognition.stream = null;
        }
        if (window.faceRecognition.video) {
            window.faceRecognition.video.srcObject = null;
        }
        // Cleanup map
        if (window.faceRecognition.map) {
            try {
                window.faceRecognition.map.remove();
            } catch(e) {}
            window.faceRecognition.map = null;
        }
    }
});

// Expose
window.faceRecognition = faceRecognition;
