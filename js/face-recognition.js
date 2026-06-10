/**
 * Portal Karyawan - Photo Capture & Location
 * Simple photo capture for attendance verification (no face recognition)
 */

// Global flag untuk menandai Leaflet sudah dicoba dimuat
let leafletLoadAttempted = false;

/**
 * Memastikan Leaflet tersedia, jika tidak akan mencoba load secara dinamis
 */
function ensureLeaflet(callback) {
    if (typeof L !== 'undefined') {
        callback();
        return;
    }
    if (leafletLoadAttempted) {
        // Jika sudah dicoba tapi gagal, langsung fallback
        console.warn('Leaflet previously failed to load, using fallback');
        callback(null, true);
        return;
    }
    leafletLoadAttempted = true;
    
    // Muat Leaflet CSS terlebih dahulu
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);
    
    // Muat Leaflet JS secara dinamis
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => {
        console.log('Leaflet loaded dynamically');
        callback();
    };
    script.onerror = () => {
        console.error('Failed to load Leaflet dynamically');
        callback(null, true);
    };
    document.head.appendChild(script);
}

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
    map: null, // Simpan referensi map instance
    
    init(action) {
        this.currentAction = action;
        this.photoCaptured = false;
        this.locationVerified = false;
        this.position = null;
        this.countdownTimer = null;
        this.map = null;

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
            this.initMapFallback('Browser tidak mendukung geolokasi');
            this.locationVerified = false;
            return;
        }

        const statusEl = document.getElementById('location-status');
        if (statusEl) {
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mendeteksi lokasi...';
            statusEl.classList.remove('verified');
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('Location success:', position.coords);
                this.position = position;
                this.locationVerified = true;
                
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Lokasi terverifikasi';
                    statusEl.classList.add('verified');
                }
                
                // Update info teks
                const infoEl = document.getElementById('location-info');
                if (infoEl) {
                    infoEl.style.display = 'block';
                    document.getElementById('location-coords').textContent = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                    document.getElementById('location-address').textContent = 'Lokasi valid';
                    document.getElementById('location-time').textContent = dateTime.getCurrentTime();
                    document.getElementById('location-accuracy').textContent = `±${Math.round(position.coords.accuracy)}m`;
                }
                
                // Panggil initMap yang sudah ditingkatkan
                this.initMap(position);
                this.checkCanSubmit();
            },
            (error) => {
                console.error('Geolocation error:', error);
                let reason = '';
                switch(error.code) {
                    case 1: reason = 'Izin lokasi ditolak. Berikan izin untuk melanjutkan.'; break;
                    case 2: reason = 'Posisi tidak tersedia. Coba lagi nanti.'; break;
                    case 3: reason = 'Waktu habis. Periksa sinyal GPS.'; break;
                    default: reason = 'Gagal mendapatkan lokasi.';
                }
                this.initMapFallback(reason);
                this.locationVerified = false;
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Lokasi gagal';
                    statusEl.style.color = 'var(--color-danger)';
                }
                toast.warning(reason);
                this.checkCanSubmit();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

    initMap(position) {
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer) {
            console.error('Map container not found');
            return;
        }
        
        // Tampilkan loading sementara
        mapContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><i class="fas fa-spinner fa-spin"></i> Memuat peta...</div>';
        
        ensureLeaflet((err, failed) => {
            if (failed || typeof L === 'undefined') {
                console.warn('Leaflet tidak tersedia, menggunakan static map fallback');
                this.initStaticMap(position);
                return;
            }
            
            // Pastikan container memiliki ukuran
            if (mapContainer.clientHeight === 0) {
                mapContainer.style.height = '200px';
            }
            mapContainer.innerHTML = '';
            
            // Delay untuk memastikan DOM siap
            setTimeout(() => {
                try {
                    const map = L.map(mapContainer).setView([position.coords.latitude, position.coords.longitude], 15);
                    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
                        subdomains: 'abcd',
                        maxZoom: 19
                    }).addTo(map);
                    
                    L.marker([position.coords.latitude, position.coords.longitude], {
                        title: 'Lokasi Anda'
                    }).addTo(map)
                    .bindPopup(`📍 Lokasi Anda<br>${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`)
                    .openPopup();
                    
                    L.circle([position.coords.latitude, position.coords.longitude], {
                        radius: position.coords.accuracy || 50,
                        color: '#3B82F6',
                        fillColor: '#3B82F6',
                        fillOpacity: 0.1
                    }).addTo(map);
                    
                    // Simpan referensi map jika diperlukan
                    this.map = map;
                    
                    // Panggil invalidateSize beberapa kali untuk memastikan peta ter-render dengan benar
                    // 1. Segera setelah inisialisasi
                    map.invalidateSize();
                    
                    // 2. Setelah tile layer selesai dimuat
                    tileLayer.on('load', () => {
                        map.invalidateSize();
                        console.log('Map invalidateSize dipanggil setelah tile layer loaded');
                    });
                    
                    // 3. Fallback dengan delay tambahan
                    setTimeout(() => {
                        map.invalidateSize();
                        console.log('Map invalidateSize dipanggil dengan timeout 300ms');
                    }, 300);
                    
                    // 4. Tambahan delay lebih lama untuk kasus render lambat
                    setTimeout(() => {
                        map.invalidateSize();
                        console.log('Map invalidateSize dipanggil dengan timeout 500ms');
                    }, 500);
                    
                    console.log('Map berhasil diinisialisasi dan invalidateSize dipanggil');
                } catch (err) {
                    console.error('Error creating map:', err);
                    this.initStaticMap(position); // Fallback ke static map
                }
            }, 100);
        });
    },

    initMapFallback(reason = 'Lokasi gagal diakses atau tidak tersedia') {
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer) return;
        
        // Tampilkan pesan error dengan tombol retry
        mapContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #f8fafc; color: #475569; text-align: center; padding: 20px;">
                <i class="fas fa-map-marker-alt fa-3x" style="margin-bottom: 12px; color: #ef4444;"></i>
                <p style="font-size: 14px; font-weight: 500; margin: 0 0 8px 0;">Peta Tidak Tersedia</p>
                <p style="font-size: 12px; margin: 0 0 16px 0;">${reason}</p>
                <button class="btn-sm btn-primary" onclick="faceRecognition.retryLocation()" style="padding: 6px 12px; background: #3B82F6; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-sync-alt"></i> Coba Lagi
                </button>
            </div>
        `;
    },

    // Method untuk retry location
    retryLocation() {
        // Reset status
        this.locationVerified = false;
        this.position = null;
        // Bersihkan container
        const mapContainer = document.getElementById('location-map');
        if (mapContainer) {
            mapContainer.innerHTML = '<div class="map-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Meminta akses lokasi...</p></div>';
        }
        // Panggil ulang initLocation
        this.initLocation();
    },

    // Fallback ke static map image jika Leaflet gagal total
    initStaticMap(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer) return;
        
        // Gunakan OpenStreetMap static image via staticmap.cloud (gratis, tanpa API key)
        const staticUrl = `https://maps.smaps.cloud/?center=${lat},${lng}&zoom=15&size=400x200&markers=${lat},${lng}`;
        
        mapContainer.innerHTML = `
            <div style="position:relative; height:100%; width:100%;">
                <img src="${staticUrl}" style="width:100%; height:100%; object-fit:cover;" alt="Peta lokasi" onerror="this.src='https://via.placeholder.com/400x200?text=Peta+Tidak+Tersedia'">
                <div style="position:absolute; bottom:8px; left:8px; background:rgba(0,0,0,0.6); color:white; padding:4px 8px; border-radius:4px; font-size:11px;">
                    ⚡ Akurasi: ±${Math.round(position.coords.accuracy)}m | ${lat.toFixed(4)}, ${lng.toFixed(4)}
                </div>
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
window.initStaticMap = (pos) => faceRecognition.initStaticMap(pos);
