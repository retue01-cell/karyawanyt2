/**
 * Portal Karyawan - Jurnal Kerja
 * Daily work journal functionality - dengan pencegahan double submit
 */

const jurnal = {
    currentDate: new Date(),
    jurnals: [],
    filter: '',
    sort: 'newest',
    currentPhoto: null,
    isSubmitting: false, // flag untuk mencegah double submit

    async init() {
        loadingIndicator.show('Memuat jurnal kerja...');
        try {
            await this.loadJurnals();
            this.initDateSelector();
            this.initForm();
            this.initFilters();
            this.initPhotoUpload();
            this.renderJurnalList();
            this.updateUI();
            this.updateSummary();
        } catch (error) {
            console.error('Error initializing jurnal:', error);
            toast.error('Gagal memuat jurnal');
        } finally {
            loadingIndicator.hide();
        }
    },

    async loadJurnals() {
        try {
            const currentUser = auth.getCurrentUser();
            const userId = currentUser?.id || 'demo-user';
            const result = await api.getJournals(userId);
            this.jurnals = result.data || [];
        } catch (error) {
            console.error('Error loading journals:', error);
            this.jurnals = storage.get('jurnals', []);
        }
    },

    initDateSelector() {
        const prevBtn = document.getElementById('prev-date');
        const nextBtn = document.getElementById('next-date');
        if (prevBtn) prevBtn.addEventListener('click', () => this.changeDate(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changeDate(1));
    },

    changeDate(direction) {
        this.currentDate.setDate(this.currentDate.getDate() + direction);
        this.updateUI();
    },

    initForm() {
        const form = document.getElementById('jurnal-form');
        if (form) {
            // Hapus event listener lama untuk mencegah duplikasi
            form.removeEventListener('submit', this._submitHandler);
            this._submitHandler = (e) => this.handleSubmit(e);
            form.addEventListener('submit', this._submitHandler);
        }
    },

    initFilters() {
        const searchInput = document.querySelector('.jurnal-history-card .search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filter = e.target.value.toLowerCase();
                this.renderJurnalList();
            });
        }
        const sortSelect = document.querySelector('.jurnal-history-card .select-filter');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sort = e.target.value === 'Terbaru' ? 'newest' : 'oldest';
                this.renderJurnalList();
            });
        }
    },

    initPhotoUpload() {
        const fileInput = document.getElementById('jurnal-photo');
        const uploadArea = document.getElementById('jurnal-upload-area');
        const filePreview = document.getElementById('jurnal-file-preview');
        const removeBtn = document.getElementById('jurnal-btn-remove-file');

        if (!fileInput || !uploadArea) return;

        // Hapus listener lama untuk mencegah duplikasi
        const newUploadArea = uploadArea.cloneNode(true);
        uploadArea.parentNode.replaceChild(newUploadArea, uploadArea);
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        const newRemoveBtn = removeBtn ? removeBtn.cloneNode(true) : null;
        if (removeBtn && newRemoveBtn) removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);

        newUploadArea.addEventListener('click', () => newFileInput.click());
        newUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); newUploadArea.classList.add('dragover'); });
        newUploadArea.addEventListener('dragleave', () => { newUploadArea.classList.remove('dragover'); });
        newUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            newUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) this.handlePhoto(e.dataTransfer.files[0]);
        });
        newFileInput.addEventListener('change', (e) => { if (e.target.files.length) this.handlePhoto(e.target.files[0]); });
        if (newRemoveBtn) newRemoveBtn.addEventListener('click', (e) => { e.stopPropagation(); this.removePhoto(); });
    },

    handlePhoto(file) {
        const maxSize = 5 * 1024 * 1024;
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (file.size > maxSize) { toast.error('Foto terlalu besar. Maksimum 5MB'); return; }
        if (!allowedTypes.includes(file.type)) { toast.error('Format file tidak didukung. Gunakan JPG atau PNG'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentPhoto = e.target.result;
            this.showPhotoPreview();
        };
        reader.readAsDataURL(file);
    },

    showPhotoPreview() {
        const uploadArea = document.getElementById('jurnal-upload-area');
        const filePreview = document.getElementById('jurnal-file-preview');
        const imagePreview = document.getElementById('jurnal-image-preview');
        if (uploadArea) uploadArea.style.display = 'none';
        if (filePreview) filePreview.style.display = 'block';
        if (imagePreview && this.currentPhoto) imagePreview.src = this.currentPhoto;
    },

    hidePhotoPreview() {
        const uploadArea = document.getElementById('jurnal-upload-area');
        const filePreview = document.getElementById('jurnal-file-preview');
        if (uploadArea) uploadArea.style.display = 'block';
        if (filePreview) filePreview.style.display = 'none';
    },

    removePhoto() {
        this.currentPhoto = null;
        const fileInput = document.getElementById('jurnal-photo');
        if (fileInput) fileInput.value = '';
        this.hidePhotoPreview();
    },

    async handleSubmit(e) {
        e.preventDefault();
        if (this.isSubmitting) {
            console.warn('Jurnal sedang diproses, abaikan.');
            return;
        }
        this.isSubmitting = true;

        // Disable tombol submit
        const submitBtn = document.querySelector('#jurnal-form button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        const dateStr = this.currentDate.toISOString().split('T')[0];
        const tasks = document.getElementById('jurnal-tasks').value.trim();
        const achievements = document.getElementById('jurnal-achievements').value.trim();
        const obstacles = document.getElementById('jurnal-obstacles').value.trim();
        const plan = document.getElementById('jurnal-plan').value.trim();

        const currentUser = auth.getCurrentUser();
        const jurnalData = {
            date: dateStr,
            userId: currentUser?.id || 'demo-user',
            tasks: tasks || '',
            achievements: achievements || '',
            obstacles: obstacles || '',
            plan: plan || '',
            photo: this.currentPhoto,
            updatedAt: new Date().toISOString()
        };

        loadingIndicator.show('Menyimpan jurnal...');
        try {
            const result = await api.saveJournal(jurnalData);
            if (result && result.success) {
                // Update local data
                const existingIndex = this.jurnals.findIndex(j => j.date === dateStr && String(j.userId) === String(jurnalData.userId));
                if (existingIndex >= 0) {
                    this.jurnals[existingIndex] = { ...this.jurnals[existingIndex], ...jurnalData };
                } else {
                    this.jurnals.unshift(jurnalData);
                }
                toast.success('Jurnal berhasil disimpan!');
                // Reset photo setelah sukses
                this.currentPhoto = null;
                this.hidePhotoPreview();
                this.renderJurnalList();
                this.updateSummary();
                this.updateStatusBadge('filled');
                this.updateUI();
            } else {
                toast.error(result?.error || 'Gagal menyimpan jurnal');
            }
        } catch (error) {
            console.error('Error saving journal:', error);
            toast.error('Terjadi kesalahan saat menyimpan jurnal');
        } finally {
            this.isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
            loadingIndicator.hide();
        }
    },

    updateUI() {
        const dateDisplay = document.getElementById('jurnal-current-date');
        if (dateDisplay) dateDisplay.textContent = dateTime.formatDate(this.currentDate, 'short');
        const dateStr = this.currentDate.toISOString().split('T')[0];
        const currentUser = auth.getCurrentUser();
        const userId = currentUser?.id;
        const jurnal = this.jurnals.find(j => j.date === dateStr && String(j.userId) === String(userId));

        const tasksEl = document.getElementById('jurnal-tasks');
        const achievementsEl = document.getElementById('jurnal-achievements');
        const obstaclesEl = document.getElementById('jurnal-obstacles');
        const planEl = document.getElementById('jurnal-plan');

        if (jurnal) {
            if (tasksEl) tasksEl.value = jurnal.tasks || '';
            if (achievementsEl) achievementsEl.value = jurnal.achievements || '';
            if (obstaclesEl) obstaclesEl.value = jurnal.obstacles || '';
            if (planEl) planEl.value = jurnal.plan || '';
            if (jurnal.photo) {
                this.currentPhoto = jurnal.photo;
                this.showPhotoPreview();
            } else {
                this.currentPhoto = null;
                this.hidePhotoPreview();
            }
            this.updateStatusBadge('filled');
        } else {
            if (tasksEl) tasksEl.value = '';
            if (achievementsEl) achievementsEl.value = '';
            if (obstaclesEl) obstaclesEl.value = '';
            if (planEl) planEl.value = '';
            this.currentPhoto = null;
            this.hidePhotoPreview();
            const today = new Date().toISOString().split('T')[0];
            if (dateStr === today) this.updateStatusBadge('empty');
            else if (dateStr > today) this.updateStatusBadge('pending');
            else this.updateStatusBadge('empty');
        }

        const form = document.getElementById('jurnal-form');
        if (form) {
            const today = new Date().toISOString().split('T')[0];
            const isFuture = dateStr > today;
            const submitBtn = form.querySelector('button[type="submit"]');
            Array.from(form.querySelectorAll('textarea')).forEach(textarea => { textarea.disabled = isFuture; });
            if (submitBtn) { submitBtn.disabled = isFuture; submitBtn.style.opacity = isFuture ? '0.5' : '1'; }
        }
    },

    updateStatusBadge(status) {
        const badge = document.getElementById('jurnal-status');
        if (!badge) return;
        badge.className = 'entry-status';
        if (status === 'filled') { badge.classList.add('filled'); badge.textContent = 'Tersimpan'; }
        else if (status === 'empty') { badge.classList.add('empty'); badge.textContent = 'Belum Diisi'; }
        else if (status === 'pending') { badge.classList.add('pending'); badge.textContent = 'Menunggu'; }
    },

    renderJurnalList() {
        const list = document.getElementById('jurnal-list');
        if (!list) return;
        let filteredJurnals = this.jurnals.filter(j => {
            if (!this.filter) return true;
            return j.tasks?.toLowerCase().includes(this.filter) || j.achievements?.toLowerCase().includes(this.filter);
        });
        filteredJurnals.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return this.sort === 'newest' ? dateB - dateA : dateA - dateB;
        });
        const recentJurnals = filteredJurnals.slice(0, 10);
        if (recentJurnals.length === 0) {
            list.innerHTML = `<div class="empty-state" style="text-align:center;padding:var(--spacing-xl);color:var(--text-muted);"><i class="fas fa-inbox" style="font-size:3rem;margin-bottom:var(--spacing);"></i><p>${this.filter ? 'Tidak ada jurnal yang sesuai' : 'Belum ada jurnal'}</p></div>`;
            return;
        }
        list.innerHTML = recentJurnals.map(j => {
            const date = new Date(j.date);
            const dayName = dateTime.formatDate(date, 'day');
            const day = date.getDate();
            const month = date.toLocaleDateString('id-ID', { month: 'short' });
            const preview = (j.tasks || '-').substring(0, 60);
            const hasPhoto = j.photo ? '<span class="photo-badge"><i class="fas fa-image"></i></span>' : '';
            return `
                <div class="jurnal-item">
                    <div class="jurnal-item-header">
                        <div class="jurnal-date"><span class="date-day">${day}</span><span class="date-month">${month}</span></div>
                        <div class="jurnal-meta"><span class="jurnal-day">${dayName}</span><span class="jurnal-time">${dateTime.formatTime(j.updatedAt || j.date)} ${hasPhoto}</span></div>
                    </div>
                    <div class="jurnal-content"><p class="jurnal-preview">${this.escapeHtml(preview)}</p></div>
                    <div class="jurnal-actions">
                        <button class="btn-icon-sm" title="Lihat Detail" onclick="jurnal.viewDetail('${j.date}')"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon-sm" title="Edit" onclick="jurnal.editJurnal('${j.date}')"><i class="fas fa-edit"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    },

    updateSummary() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthJurnals = this.jurnals.filter(j => {
            const date = new Date(j.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        const filledCount = monthJurnals.length;
        const today = new Date().getDate();
        const workingDaysPassed = Math.min(today, 26);
        let streak = 0;
        const sortedDates = [...this.jurnals].sort((a, b) => new Date(b.date) - new Date(a.date)).map(j => j.date);
        if (sortedDates.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            if (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr) {
                streak = 1;
                for (let i = 1; i < sortedDates.length; i++) {
                    const curr = new Date(sortedDates[i-1]);
                    const prev = new Date(sortedDates[i]);
                    const diff = (curr - prev) / (1000*60*60*24);
                    if (diff === 1) streak++;
                    else break;
                }
            }
        }
        const summaryItems = document.querySelectorAll('.summary-value');
        if (summaryItems.length >= 3) {
            summaryItems[0].textContent = filledCount;
            summaryItems[1].textContent = Math.max(0, workingDaysPassed - filledCount);
            summaryItems[2].textContent = streak;
        }
    },

    viewDetail(date) {
        const j = this.jurnals.find(j => j.date === date);
        if (!j) return;
        const photoHtml = j.photo ? `<div class="detail-photo"><label>Foto Lampiran:</label><img src="${j.photo}" alt="Foto jurnal" onclick="window.open('${j.photo}', '_blank')"></div>` : '';
        const modalContent = `
            <div class="jurnal-detail-modal">
                <h3>Detail Jurnal - ${dateTime.formatDate(new Date(date), 'long')}</h3>
                <div class="detail-section"><label>Tugas:</label><p>${(j.tasks || '-').replace(/\n/g, '<br>')}</p></div>
                <div class="detail-section"><label>Pencapaian:</label><p>${(j.achievements || '-').replace(/\n/g, '<br>')}</p></div>
                <div class="detail-section"><label>Kendala:</label><p>${(j.obstacles || '-').replace(/\n/g, '<br>')}</p></div>
                <div class="detail-section"><label>Rencana:</label><p>${(j.plan || '-').replace(/\n/g, '<br>')}</p></div>
                ${photoHtml}
            </div>
        `;
        modal.show('Detail Jurnal', modalContent, [
            { label: 'Tutup', class: 'btn-secondary', onClick: () => modal.close() },
            { label: 'Edit', class: 'btn-primary', onClick: () => { modal.close(); this.editJurnal(date); } }
        ]);
    },

    editJurnal(date) {
        this.currentDate = new Date(date);
        this.updateUI();
    },

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
};

window.initJurnal = () => { jurnal.init(); };
window.jurnal = jurnal;
