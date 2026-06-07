/**
 * Portal Karyawan - Cuti/Leave
 */

const cuti = {
    leaves: [],
    leaveBalance: 12,
    filterStatus: '',

    async init() {
        loadingIndicator.show('Memuat data cuti...');
        try {
            await this.loadLeaves();
            this.initForm();
            this.initFilters();
            this.renderLeaveList();
            this.updateStats();
        } catch (error) {
            console.error('Error initializing cuti:', error);
            toast.error('Gagal memuat data cuti');
        } finally {
            loadingIndicator.hide();
        }
    },

    async loadLeaves() {
        loadingIndicator.show('Mengambil daftar cuti...');
        try {
            const currentUser = auth.getCurrentUser();
            const userId = currentUser?.id || 'demo-user';
            const result = auth.isAdmin() ? await api.getAllLeaves() : await api.getLeaves(userId);
            this.leaves = result.data || [];
        } catch (error) {
            console.error('Error loading leaves:', error);
            this.leaves = storage.get('leaves', []);
        } finally {
            loadingIndicator.hide();
        }
        const savedBalance = storage.get('leaveBalance');
        if (savedBalance !== null) this.leaveBalance = savedBalance;
        this.updateBalanceDisplay();
    },

    initForm() {
        const form = document.getElementById('cuti-form');
        if (form) form.addEventListener('submit', (e) => this.handleSubmit(e));

        const startDate = document.getElementById('leave-start');
        const endDate = document.getElementById('leave-end');
        const duration = document.getElementById('leave-duration');

        const calculateDuration = () => {
            if (startDate.value && endDate.value) {
                const start = new Date(startDate.value);
                const end = new Date(endDate.value);
                const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                duration.value = diffDays > 0 ? `${diffDays} hari` : '0 hari';
            }
        };
        if (startDate) startDate.addEventListener('change', calculateDuration);
        if (endDate) endDate.addEventListener('change', calculateDuration);
    },

    async handleSubmit(e) {
        e.preventDefault();

        const type = document.getElementById('leave-type');
        const startDate = document.getElementById('leave-start');
        const endDate = document.getElementById('leave-end');
        const reason = document.getElementById('leave-reason');

        if (!type.value || !startDate.value || !endDate.value || !reason.value) {
            toast.error('Semua field harus diisi!');
            return;
        }

        const start = new Date(startDate.value);
        const end = new Date(endDate.value);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays <= 0) {
            toast.error('Tanggal selesai harus setelah tanggal mulai!');
            return;
        }

        if (type.value === 'annual' && diffDays > this.leaveBalance) {
            toast.error('Sisa cuti tidak mencukupi!');
            return;
        }

        const typeLabels = {
            annual: 'Cuti Tahunan',
            sick: 'Cuti Sakit',
            important: 'Cuti Penting',
            maternity: 'Cuti Melahirkan',
            other: 'Lainnya'
        };

        const currentUser = auth.getCurrentUser();
        const leaveData = {
            userId: currentUser?.id || 'demo-user',
            type: type.value,
            typeLabel: typeLabels[type.value],
            startDate: startDate.value,
            endDate: endDate.value,
            duration: diffDays,
            reason: reason.value
        };

        loadingIndicator.show('Mengirim pengajuan cuti...');
        try {
            const result = await api.submitLeave(leaveData);
            if (result.success) {
                this.leaves.unshift(result.data);
                if (type.value === 'annual') {
                    this.leaveBalance -= diffDays;
                    storage.set('leaveBalance', this.leaveBalance);
                    this.updateBalanceDisplay();
                }
                toast.success('Pengajuan cuti berhasil dikirim!');
            } else {
                toast.error(result.error || 'Gagal mengajukan cuti');
            }
        } catch (error) {
            console.error('Error submitting leave:', error);
            toast.error('Terjadi kesalahan');
        } finally {
            loadingIndicator.hide();
        }

        e.target.reset();
        document.getElementById('leave-duration').value = '';
        this.renderLeaveList();
        this.updateStats();
    },

    initFilters() {
        const statusFilter = document.querySelector('.cuti-history-card .select-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filterStatus = e.target.value === 'Semua Status' ? '' : e.target.value.toLowerCase();
                this.renderLeaveList();
            });
        }
    },

    updateBalanceDisplay() {
        const balanceEl = document.querySelector('.balance-value');
        if (balanceEl) balanceEl.textContent = this.leaveBalance;
    },

    updateStats() {
        const pending = this.leaves.filter(l => l.status === 'pending').length;
        const approved = this.leaves.filter(l => l.status === 'approved').length;
        const rejected = this.leaves.filter(l => l.status === 'rejected').length;
        const statValues = document.querySelectorAll('.leave-stats .stat-value');
        if (statValues.length >= 3) {
            statValues[0].textContent = pending;
            statValues[1].textContent = approved;
            statValues[2].textContent = rejected;
        }
    },

    renderLeaveList() {
        const list = document.getElementById('leave-list');
        if (!list) return;

        let filteredLeaves = this.leaves.filter(l => {
            if (!this.filterStatus) return true;
            if (this.filterStatus === 'menunggu') return l.status === 'pending';
            if (this.filterStatus === 'disetujui') return l.status === 'approved';
            if (this.filterStatus === 'ditolak') return l.status === 'rejected';
            return true;
        });

        if (filteredLeaves.length === 0) {
            list.innerHTML = `<div class="empty-state" style="text-align:center;padding:var(--spacing-xl);color:var(--text-muted);"><i class="fas fa-inbox" style="font-size:3rem;margin-bottom:var(--spacing);"></i><p>${this.filterStatus ? 'Tidak ada pengajuan yang sesuai' : 'Belum ada pengajuan cuti'}</p></div>`;
            return;
        }

        const sortedLeaves = filteredLeaves.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

        list.innerHTML = sortedLeaves.map(leave => {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const startFormatted = dateTime.formatDate(start, 'short');
            const endFormatted = dateTime.formatDate(end, 'short');
            let dateDisplay = startFormatted;
            if (leave.startDate !== leave.endDate) dateDisplay = `${startFormatted} - ${endFormatted}`;

            const icons = { annual: 'fa-umbrella-beach', sick: 'fa-heartbeat', important: 'fa-home', maternity: 'fa-baby', other: 'fa-question-circle' };

            const deleteButton = leave.status === 'pending'
                ? `<button class="btn-icon-sm delete-btn" onclick="cuti.deleteLeave(${leave.id})" title="Batalkan Pengajuan" style="background:rgba(239,68,68,0.1);color:#EF4444;"><i class="fas fa-trash"></i></button>`
                : '';

            return `
                <div class="leave-item" data-id="${leave.id}">
                    <div class="leave-icon"><i class="fas ${icons[leave.type] || 'fa-calendar'}"></i></div>
                    <div class="leave-content">
                        <div class="leave-header">
                            <h4 class="leave-type">${leave.typeLabel}</h4>
                            <span class="leave-status ${leave.status}">${this.getStatusLabel(leave.status)}</span>
                        </div>
                        <div class="leave-details">
                            <span class="leave-date"><i class="fas fa-calendar"></i> ${dateDisplay} (${leave.duration} hari)</span>
                        </div>
                        <p class="leave-reason">${leave.reason}</p>
                    </div>
                    <div class="leave-actions" style="display:flex; gap:8px; align-items:center;">
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

    async deleteLeave(id) {
        if (!confirm('Batalkan pengajuan cuti ini? Setelah dibatalkan tidak dapat dikembalikan.')) return;

        loadingIndicator.show('Membatalkan pengajuan cuti...');
        try {
            const result = await api.deleteLeave(id);
            if (result.success) {
                const deletedLeave = this.leaves.find(l => l.id == id);
                if (deletedLeave && deletedLeave.type === 'annual') {
                    this.leaveBalance += deletedLeave.duration;
                    storage.set('leaveBalance', this.leaveBalance);
                    this.updateBalanceDisplay();
                }
                this.leaves = this.leaves.filter(l => l.id != id);
                this.renderLeaveList();
                this.updateStats();
                toast.success('Pengajuan cuti berhasil dibatalkan');
            } else {
                toast.error(result.error || 'Gagal membatalkan');
            }
        } catch (error) {
            console.error('Error deleting leave:', error);
            toast.error('Terjadi kesalahan');
        } finally {
            loadingIndicator.hide();
        }
    },

    async approveLeave(id) { /* admin function, keep existing */ },
    async rejectLeave(id) { /* admin function, keep existing */ }
};

window.initCuti = () => { cuti.init(); };
window.cuti = cuti;
