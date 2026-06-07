/**
 * Portal Karyawan - Admin Dashboard
 * Admin dashboard with employee statistics
 */

const adminDashboard = {
    employees: [],
    attendance: [],
    leaves: [],
    izin: [],
    todayAttendanceList: [],

    async init() {
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }
        loadingIndicator.show('Memuat dashboard admin...');
        try {
            await this.loadData();
            this.updateStats();
            this.renderRecentActivity();
            this.renderPresentEmployees();
        } catch (error) {
            console.error('Error initializing admin dashboard:', error);
            toast.error('Gagal memuat dashboard admin');
        } finally {
            loadingIndicator.hide();
        }
    },

    async loadData() {
        try {
            const [empResult, attResult, leaveResult, izinResult] = await Promise.all([
                api.getEmployees(),
                api.getAllAttendance(),
                api.getAllLeaves(),
                api.getAllIzin()
            ]);
            this.employees = empResult.data || [];
            this.attendance = attResult.data || [];
            this.leaves = leaveResult.data || [];
            this.izin = izinResult.data || [];

            // Hitung karyawan yang sudah datang hari ini
            const todayStr = dateTime.getLocalDate();
            this.todayAttendanceList = this.attendance.filter(a => a.date === todayStr && a.clockIn);
            console.log('Karyawan datang hari ini:', this.todayAttendanceList);

            // Jika data kosong, gunakan dummy untuk demo
            if (this.employees.length === 0) {
                console.warn('Data karyawan kosong, gunakan data dummy');
                this.employees = [
                    { id: 1, name: 'Ahmad Rizky', email: 'ahmad@company.com', department: 'IT', position: 'Developer', shift: 'Pagi', status: 'active', joinDate: '2024-01-15', avatar: 'https://ui-avatars.com/api/?name=Ahmad&background=3B82F6&color=fff' },
                    { id: 2, name: 'Budi Santoso', email: 'budi@company.com', department: 'HR', position: 'HR Manager', shift: 'Pagi', status: 'active', joinDate: '2023-06-01', avatar: 'https://ui-avatars.com/api/?name=Budi&background=10B981&color=fff' },
                    { id: 3, name: 'Citra Dewi', email: 'citra@company.com', department: 'Finance', position: 'Accountant', shift: 'Pagi', status: 'on-leave', joinDate: '2024-03-10', avatar: 'https://ui-avatars.com/api/?name=Citra&background=F59E0B&color=fff' },
                    { id: 4, name: 'Dedi Pratama', email: 'dedi@company.com', department: 'Marketing', position: 'Marketing Staff', shift: 'Siang', status: 'active', joinDate: '2024-02-20', avatar: 'https://ui-avatars.com/api/?name=Dedi&background=EF4444&color=fff' },
                    { id: 5, name: 'Eka Putri', email: 'eka@company.com', department: 'IT', position: 'UI/UX Designer', shift: 'Pagi', status: 'active', joinDate: '2024-01-05', avatar: 'https://ui-avatars.com/api/?name=Eka&background=8B5CF6&color=fff' }
                ];
            }
        } catch (error) {
            console.error('Error loading admin data:', error);
            this.employees = storage.get('admin_employees', []);
            this.attendance = storage.get('attendance', []);
            this.leaves = storage.get('leaves', []);
            this.izin = storage.get('izin', []);
        }
    },

    updateStats() {
        const totalEmployees = this.employees.length;
        const todayStr = dateTime.getLocalDate();
        const todayAttendance = this.attendance.filter(a => a.date === todayStr);
        let presentToday = 0;
        let lateToday = 0;
        todayAttendance.forEach(att => {
            if (att.clockIn) {
                presentToday++;
                if (att.status && att.status.toLowerCase() === 'terlambat') lateToday++;
            }
        });
        const onLeave = this.leaves.filter(l => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr).length +
            this.izin.filter(i => i.status === 'approved' && i.date === todayStr).length;
        const absentToday = Math.max(0, totalEmployees - presentToday - onLeave);
        const pendingLeaves = this.leaves.filter(l => l.status === 'pending').length;
        const pendingIzin = this.izin.filter(i => i.status === 'pending').length;
        const totalPending = pendingLeaves + pendingIzin;

        const els = {
            'total-employees': totalEmployees,
            'present-today': presentToday,
            'absent-today': absentToday,
            'late-today': lateToday,
            'on-leave': onLeave,
            'pending-requests': totalPending
        };
        Object.entries(els).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) this.animateNumber(el, parseInt(el.textContent) || 0, value);
        });
    },

    animateNumber(element, start, end) {
        const duration = 1000;
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (end - start) * easeOutQuart);
            element.textContent = current;
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    },

    renderRecentActivity() {
        const container = document.getElementById('admin-recent-activity');
        if (!container) return;
        const activities = [
            { user: 'Ahmad Rizky', action: 'Clock In', time: '5 menit yang lalu', avatar: 'https://ui-avatars.com/api/?name=Ahmad&background=3B82F6&color=fff' },
            { user: 'Budi Santoso', action: 'Mengajukan Cuti', time: '15 menit yang lalu', avatar: 'https://ui-avatars.com/api/?name=Budi&background=10B981&color=fff' },
            { user: 'Citra Dewi', action: 'Mengisi Jurnal', time: '30 menit yang lalu', avatar: 'https://ui-avatars.com/api/?name=Citra&background=F59E0B&color=fff' },
            { user: 'Dedi Pratama', action: 'Clock Out', time: '1 jam yang lalu', avatar: 'https://ui-avatars.com/api/?name=Dedi&background=EF4444&color=fff' },
            { user: 'Eka Putri', action: 'Izin Sakit', time: '2 jam yang lalu', avatar: 'https://ui-avatars.com/api/?name=Eka&background=8B5CF6&color=fff' }
        ];
        container.innerHTML = activities.map(act => `
            <div class="activity-item">
                <div class="activity-avatar"><img src="${act.avatar}" alt="${act.user}"></div>
                <div class="activity-content"><p class="activity-text"><strong>${act.user}</strong> ${act.action}</p><span class="activity-time">${act.time}</span></div>
            </div>
        `).join('');
    },

    renderPresentEmployees() {
        const container = document.getElementById('admin-present-users');
        if (!container) return;

        // Map attendance records ke employee data
        const presentUsers = this.todayAttendanceList.map(att => {
            const emp = this.employees.find(e => String(e.id) === String(att.userId));
            return emp || { name: 'Unknown', department: '', avatar: '', id: att.userId };
        }).filter(emp => emp.name !== 'Unknown');

        const presentCount = presentUsers.length;
        const countEl = document.getElementById('present-count');
        if (countEl) countEl.textContent = presentCount;

        if (presentUsers.length === 0) {
            container.innerHTML = '<div class="empty-state" style="text-align:center; padding:var(--spacing);">Belum ada karyawan yang datang hari ini.</div>';
            return;
        }

        container.innerHTML = presentUsers.map(user => `
            <div class="online-user-item">
                <div class="user-status-dot" style="background: var(--color-success);"></div>
                <div class="activity-avatar"><img src="${getAvatarUrl(user)}" alt="${user.name}"></div>
                <div class="activity-content">
                    <p class="activity-text"><strong>${this.escapeHtml(user.name)}</strong></p>
                    <span class="activity-time">${user.department || '-'}</span>
                </div>
            </div>
        `).join('');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.initAdminDashboard = () => { adminDashboard.init(); };
window.adminDashboard = adminDashboard;
