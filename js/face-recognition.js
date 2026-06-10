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

    init(action) {
        // Cegah inisialisasi ganda bersamaan
        if (this.isInitializing) {
            console.warn('Face recognition already initializing, skip');
            return;
        }
        this.isInitializing = true;
        
        // Bersihkan sesi sebelumnya
        this.cleanup();
        
        this.currentAction = action;
        this.photoCaptured = false;
        this.locationVerified = false;
        this.position = null;
        this.countdownTimer = null;
        
        // Update UI based on action
        this.updateActionTitle(action);
        
        // Beri waktu sedikit untuk DOM stabil
        setTimeout(() => {
            this.initCamera();
            this.initLocation();
            this.bindButtons();
            this.isInitializing = false;
        }, 100);
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

            this.video.onerror = (err) => {
                console.error('Video error:', err);
                toast.error('Gagal memuat kamera');
                const captureBtn = document.getElementById('btn-capture');
                if (captureBtn) captureBtn.disabled = true;
            };

        } catch (error) {
            console.error('Camera error:', error);
            toast.error('Tidak dapat mengakses kamera. Pastikan Anda memberikan izin kamera.');
            const captureBtn = document.getElementById('btn-capture');
            if (captureBtn) captureBtn.disabled = true;
            this.isInitializing = false;
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

                // Update map visualization dengan Leaflet
                if (mapEl) {
                    this.initMap(position);
                }

                this.checkCanSubmit();
            },
            (error) => {
                console.error('Location error:', error);

                // Fallback untuk testing di desktop/localhost
                this.position = {
                    coords: { latitude: -6.200000, longitude: 106.816666, accuracy: 100 } // Jakarta default
                };
                this.locationVerified = true;

                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-exclamation-circle" style="color:var(--color-warning);"></i> Simulasi Lokasi';
                }
                toast.warning('Menggunakan lokasi simulasi karena GPS gagal.');
                
                // Tampilkan fallback map
                if (mapEl) {
                    this.initMapFallback();
                }
                
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
        
        const bindSafe = (element, handler) => {
            if (!element) return;
            const newEl = element.cloneNode(true);
            element.parentNode?.replaceChild(newEl, element);
            newEl.addEventListener('click', (e) => { e.preventDefault(); handler(); });
            return newEl;
        };
        
        bindSafe(captureBtn, () => this.capturePhoto());
        bindSafe(retakeBtn, () => this.retakePhoto());
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
        // Hentikan semua track stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                if (track.readyState === 'live') track.stop();
            });
            this.stream = null;
        }
        
        // Bersihkan video element
        if (this.video) {
            if (this.video.srcObject) {
                this.video.srcObject = null;
            }
            this.video.pause();
            this.video.src = '';
            this.video.load();
        }
        
        // Reset container kamera ke struktur awal (tanpa video)
        const previewContainer = document.getElementById('camera-preview');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <video id="camera-video" autoplay playsinline style="display: none;"></video>
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
        
        // Reset referensi
        this.video = null;
        this.canvas = null;
        
        // Hentikan timer countdown jika ada
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        
        // === PERBAIKAN 3: Hancurkan map saat cleanup ===
        if (this.map) {
            try {
                this.map.remove();
            } catch(e) {}
            this.map = null;
        }
        
        this.isInitializing = false;
    }
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
