/**
 * Portal Karyawan - Izin/Sakit
 */

const izin = {
    izinData: [],
    currentFile: null,
    filterStatus: '',
    isSubmitting: false, // flag untuk mencegah double submit

    async init() {
        loadingIndicator.show('Memuat data izin...');
        try {
            await this.loadIzinData();
            this.initForm();
            this.initFilters();
            this.renderIzinList();
            this.updateStats();
            const dateInput = document.getElementById('izin-date');
            if (dateInput) dateInput.valueAsDate = new Date();
        } catch (error) {
            console.error('Error initializing izin:', error);
            toast.error('Gagal memuat data izin');
        } finally {
            loadingIndicator.hide();
        }
    },

    async loadIzinData() {
        const currentUser = auth.getCurrentUser();
        const userId = currentUser?.id || 'demo-user';
        try {
            const result = auth.isAdmin() ? await api.getAllIzin() : await api.getIzin(userId);
            this.izinData = result.data || [];
        } catch (error) {
            console.error('Error loading izin:', error);
            this.izinData = storage.get('izin', []);
        }
    },

    initForm() {
        const form = document.getElementById('izin-form');
        const submitBtn = document.getElementById('btn-submit-izin');

        // Jika tombol verifikasi masih ada, ubah teks dan fungsinya
        const verifyBtn = document.getElementById('btn-verify-izin');
        if (verifyBtn) {
            verifyBtn.textContent = 'Kirim Pengajuan';
            verifyBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pengajuan';
            verifyBtn.onclick = () => this.handleSubmit();
        }

        const fileInput = document.getElementById('izin-document');
        const fileUpload = document.getElementById('file-upload');

        if (fileUpload && fileInput) {
            fileUpload.addEventListener('click', () => fileInput.click());
            fileUpload.addEventListener('dragover', (e) => { e.preventDefault(); fileUpload.classList.add('dragover'); });
            fileUpload.addEventListener('dragleave', () => { fileUpload.classList.remove('dragover'); });
            fileUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUpload.classList.remove('dragover');
                if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
            });
            fileInput.addEventListener('change', (e) => { if (e.target.files.length) this.handleFile(e.target.files[0]); });
        }

        const removeBtn = document.querySelector('.btn-remove-file');
        if (removeBtn) removeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.removeFile(); });

        this.initFilters();
    },

    initFilters() {
        const statusFilter = document.querySelector('.izin-history-card .select-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filterStatus = e.target.value === 'Semua Status' ? '' : e.target.value.toLowerCase();
                this.renderIzinList();
            });
        }
    },

    handleFile(file) {
        const maxSize = 5 * 1024 * 1024;
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (file.size > maxSize) { toast.error('File terlalu besar. Maksimum 5MB'); return; }
        if (!allowedTypes.includes(file.type)) { toast.error('Format file tidak didukung. Gunakan PDF, JPG, atau PNG'); return; }
        this.currentFile = file;
        const uploadArea = document.querySelector('.upload-area');
        const filePreview = document.getElementById('file-preview');
        const filename = filePreview?.querySelector('.filename');
        if (uploadArea) uploadArea.style.display = 'none';
        if (filePreview) filePreview.style.display = 'flex';
        if (filename) filename.textContent = file.name;
    },

    removeFile() {
        this.currentFile = null;
        const uploadArea = document.querySelector('.upload-area');
        const filePreview = document.getElementById('file-preview');
        const fileInput = document.getElementById('izin-document');
        if (uploadArea) uploadArea.style.display = 'block';
        if (filePreview) filePreview.style.display = 'none';
        if (fileInput) fileInput.value = '';
    },

    async handleSubmit() {
        // Cegah double submit
        if (this.isSubmitting) {
            console.warn('Form sedang diproses, abaikan klik ganda.');
            return;
        }

        const type = document.getElementById('izin-type')?.value;
        const date = document.getElementById('izin-date')?.value;
        const duration = document.getElementById('izin-duration')?.value;
        const reason = document.getElementById('izin-reason')?.value;

        if (!type || !date || !duration || !reason) {
            toast.error('Harap isi semua field yang wajib diisi!');
            return;
        }

        await this.submitIzin(type, date, duration, reason);
    },

    async submitIzin(type, date, duration, reason) {
        // Set flag dan nonaktifkan tombol
        this.isSubmitting = true;
        const submitBtn = document.querySelector('#izin-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
        }

        const typeLabels = {
            sick: 'Sakit',
            permission: 'Izin Penting',
            emergency: 'Keadaan Darurat',
            out_of_office: 'Dinas Luar'
        };
        const currentUser = auth.getCurrentUser();

        const izinEntry = {
            userId: currentUser?.id || 'demo-user',
            type: type,
            typeLabel: typeLabels[type] || type,
            date: date,
            duration: parseInt(duration),
            reason: reason,
            hasAttachment: !!this.currentFile,
            verificationPhoto: null,
            verificationLocation: null,
            verificationTimestamp: null
        };

        loadingIndicator.show('Mengirim pengajuan izin...');
        try {
            const result = await api.submitIzin(izinEntry);
            if (result.success) {
                this.izinData.unshift(result.data);
                toast.success('Pengajuan izin berhasil dikirim!');
                document.getElementById('izin-form')?.reset();
                this.removeFile();
                this.renderIzinList();
                this.updateStats();
            } else {
                toast.error(result.error || 'Gagal mengirim pengajuan izin');
            }
        } catch (error) {
            console.error('Error submitting izin:', error);
            toast.error('Terjadi kesalahan');
        } finally {
            loadingIndicator.hide();
            // Reset flag dan tombol
            this.isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pengajuan';
            }
        }
    },

    updateStats() {
        const pending = this.izinData.filter(i => i.status === 'pending').length;
        const approved = this.izinData.filter(i => i.status === 'approved').length;
        const rejected = this.izinData.filter(i => i.status === 'rejected').length;
        const pendingEl = document.getElementById('izin-pending-count');
        const approvedEl = document.getElementById('izin-approved-count');
        const rejectedEl = document.getElementById('izin-rejected-count');
        if (pendingEl) pendingEl.textContent = pending;
        if (approvedEl) approvedEl.textContent = approved;
        if (rejectedEl) rejectedEl.textContent = rejected;
    },

    renderIzinList() {
        const list = document.getElementById('izin-list');
        if (!list) return;

        let filteredData = this.izinData.filter(i => {
            if (!this.filterStatus) return true;
            if (this.filterStatus === 'menunggu') return i.status === 'pending';
            if (this.filterStatus === 'disetujui') return i.status === 'approved';
            if (this.filterStatus === 'ditolak') return i.status === 'rejected';
            return true;
        });

        if (filteredData.length === 0) {
            list.innerHTML = `<div class="empty-state" style="text-align:center;padding:var(--spacing-xl);color:var(--text-muted);"><i class="fas fa-inbox" style="font-size:3rem;margin-bottom:var(--spacing);"></i><p>${this.filterStatus ? 'Tidak ada pengajuan yang sesuai' : 'Belum ada pengajuan izin'}</p></div>`;
            return;
        }

        const sortedData = filteredData.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
        const icons = { sick: 'fa-heartbeat', permission: 'fa-hand-paper', emergency: 'fa-exclamation-triangle' };

        list.innerHTML = sortedData.map(izin => {
            const dateFormatted = dateTime.formatDate(new Date(izin.date), 'short');
            const deleteButton = izin.status === 'pending'
                ? `<button class="btn-icon-sm delete-btn" onclick="izin.deleteIzin(${izin.id})" title="Batalkan Pengajuan" style="background:rgba(239,68,68,0.1);color:#EF4444;"><i class="fas fa-trash"></i></button>`
                : '';

            return `
                <div class="izin-item" data-id="${izin.id}">
                    <div class="izin-icon ${izin.type}"><i class="fas ${icons[izin.type] || 'fa-file'}"></i></div>
                    <div class="izin-content">
                        <div class="izin-header-row">
                            <h4 class="izin-type">${izin.typeLabel}</h4>
                            <span class="izin-status ${izin.status}">${this.getStatusLabel(izin.status)}</span>
                        </div>
                        <div class="izin-details">
                            <span class="izin-date"><i class="fas fa-calendar"></i> ${dateFormatted} (${izin.duration} hari)</span>
                        </div>
                        <p class="izin-reason">${izin.reason}</p>
                        ${izin.hasAttachment ? `<span class="izin-attachment"><i class="fas fa-paperclip"></i> Lampiran tersedia</span>` : ''}
                    </div>
                    <div class="izin-actions" style="display:flex; gap:8px; align-items:center;">
                        ${deleteButton}
                    </div>
                </div>
            `;
        }).join('');
    },

    getStatusLabel(status) {
        const labels = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' };
        return labels[status] || status;
    },

    async deleteIzin(id) {
        if (!confirm('Batalkan pengajuan izin ini? Setelah dibatalkan tidak dapat dikembalikan.')) return;

        try {
            const result = await api.deleteIzin(id);
            if (result.success) {
                this.izinData = this.izinData.filter(i => i.id != id);
                this.renderIzinList();
                this.updateStats();
                toast.success('Pengajuan izin berhasil dibatalkan');
            } else {
                toast.error(result.error || 'Gagal membatalkan');
            }
        } catch (error) {
            console.error('Error deleting izin:', error);
            toast.error('Terjadi kesalahan');
        }
    },

    async approveIzin(id) { /* admin function */ },
    async rejectIzin(id) { /* admin function */ }
};

window.initIzin = () => { izin.init(); };
window.izin = izin;
