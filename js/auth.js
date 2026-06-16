/**
 * Portal Karyawan - Authentication
 * Handle login/logout and session management
 */

const auth = {
    currentUser: null,

    init() {
        // Check for existing session
        const session = storage.get('session');
        if (session) {
            this.currentUser = session;
            this.showApp();
        }

        // Login form handler
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Toggle password visibility
        const togglePassword = document.getElementById('toggle-password');
        if (togglePassword) {
            togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
        }

        // Logout button
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Tombol logout mobile (untuk tampilan mobile)
        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Profile click - open profile modal
        const userProfile = document.querySelector('.user-profile');
        if (userProfile) {
            // Make the user info area clickable (not the logout button)
            const userInfoArea = userProfile.querySelector('.user-info');
            const userAvatarArea = userProfile.querySelector('.user-avatar');
            if (userInfoArea) {
                userInfoArea.style.cursor = 'pointer';
                userInfoArea.addEventListener('click', () => this.openProfileModal());
            }
            if (userAvatarArea) {
                userAvatarArea.style.cursor = 'pointer';
                userAvatarArea.addEventListener('click', () => this.openProfileModal());
            }
        }
    },

    async handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const role = document.querySelector('input[name="role"]:checked').value;

        // Validate
        if (!email || !password) {
            toast.error('Email dan password harus diisi!');
            return;
        }

        // Show loading
        const submitBtn = e.target.querySelector('.btn-login');
        submitBtn.disabled = true;

        // Tampilkan overlay loading di tengah layar
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            // Opsional: ubah teks loading-nya khusus untuk login
            const textEl = loadingOverlay.querySelector('p');
            if (textEl) textEl.textContent = 'Memproses Login...';
            
            // Pastikan background agak transparan agar layar belakang masih terlihat samar
            loadingOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
            loadingOverlay.classList.add('active');
            loadingOverlay.style.display = 'flex';
        }

        try {
            const result = await api.login(email, password);

            let user;
            if (result.success && result.data) {
                // Backend mode - user from API (Employees or Users sheet)
                // Normalisasi role dari backend agar konsisten dengan frontend
                let rawRole = result.data.role || role;
                // Trim spasi dan ubah ke lowercase untuk menangani variasi input
                let normalizedRole = rawRole.trim().toLowerCase();
                if (normalizedRole === 'karyawan') {
                    normalizedRole = 'employee';
                }
                
                user = {
                    id: result.data.id,
                    email: result.data.email,
                    name: result.data.name,
                    role: normalizedRole,
                    department: result.data.department || '',
                    position: result.data.position || '',
                    shift: result.data.shift || '',
                    avatar: result.data.avatar || '',
                    loginTime: new Date().toISOString(),
                    readNotifs: result.data.readNotifs || '[]'
                };
                
                // VALIDASI ROLE: Bandingkan role yang dipilih dengan role yang sudah dinormalisasi
                if (normalizedRole !== role) {
                    const roleName = role === 'admin' ? 'Admin' : 'Karyawan';
                    const actualRoleName = normalizedRole === 'admin' ? 'Admin' : 'Karyawan';
                    toast.error(`Anda memilih login sebagai ${roleName}, tetapi akun ini memiliki role ${actualRoleName}. Silakan pilih role yang sesuai.`);
                    submitBtn.classList.remove('loading');
                    submitBtn.disabled = false;
                    return;
                }
            } else if (result.success && !result.data && !API_BASE_URL) {
                // Local-only fallback (no backend configured) - for testing only
                const displayName = email.split('@')[0] || 'User';
                user = {
                    id: 'user_' + Date.now(),
                    email: email,
                    name: role === 'admin' ? 'Admin (Local)' : displayName,
                    role: role,
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=F59E0B&color=fff`,
                    loginTime: new Date().toISOString()
                };
            } else {
                toast.error(result.error || 'Email atau password salah!');
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                return;
            }

            // Hapus currentPage dari storage untuk mencegah override navigasi
            storage.remove('currentPage');
            
            this.currentUser = user;
            storage.set('session', user);

            // Update UI
            this.updateUserUI();

            // Refresh company data from server
            if (window.refreshCompanyData) {
                await window.refreshCompanyData();
            }

            // Hapus schedule cache agar dipaksa refresh saat dashboard dibuka
            storage.remove('shift_schedule');

            // Ambil data shift dari API dan simpan ke storage
            const shiftsResult = await api.getShifts();
            if (shiftsResult.success && shiftsResult.data) {
                storage.set('shifts', shiftsResult.data);
            }

            // Show app
            this.showApp();

            toast.success(`Selamat datang, ${user.name}!`);
        } catch (error) {
            console.error('Login error:', error);
            toast.error('Terjadi kesalahan saat login');
        } finally {
            submitBtn.disabled = false;
            
            // Tutup dan sembunyikan overlay di tengah layar
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.remove('active');
                loadingOverlay.style.display = 'none';
                
                // Opsional: Kembalikan teks asli untuk keperluan splash screen di lain waktu
                const textEl = loadingOverlay.querySelector('p');
                if (textEl) textEl.textContent = 'Memuat Identitas Portal...';
            }
        }
    },

    handleLogout() {
        if (confirm('Apakah Anda yakin ingin logout?')) {
            // Reset absensi state jika ada
            if (window.absensi && typeof window.absensi.reset === 'function') {
                window.absensi.reset();
            }

            // Reset dashboard
            if (window.dashboard && typeof window.dashboard.reset === 'function') {
                window.dashboard.reset();
            }

            // Hapus data lokal
            storage.remove('leaveBalance');
            storage.remove('read_notifications');
            storage.remove('temp_overtime_started');

            this.currentUser = null;
            storage.remove('session');
            storage.remove('currentPage');

            this.showLogin();
            toast.info('Anda telah logout');
        }
    },

    showApp() {
        // Hapus currentPage yang tersimpan untuk mencegah override router
        storage.remove('currentPage');
        
        // Reset dashboard sebelum navigasi halaman
        if (window.dashboard && typeof window.dashboard.reset === 'function') {
            window.dashboard.reset();
        }
        
        const loginContainer = document.getElementById('login-container');
        const appContainer = document.getElementById('app-container');

        if (loginContainer && appContainer) {
            loginContainer.style.display = 'none';
            appContainer.classList.remove('hidden');

            // Update user UI first
            this.updateUserUI();

            // Show appropriate menu based on role
            const employeeMenu = document.getElementById('employee-menu');
            const adminMenu = document.getElementById('admin-menu-nav');
            const bottomNav = document.getElementById('bottom-nav');
            const toggleBtn = document.getElementById('sidebar-toggle-mobile');
            const body = document.body;

            if (this.currentUser && this.currentUser.role === 'admin') {
                // Set admin-mode class on body for mobile sidebar
                body.classList.add('admin-mode');
                body.classList.remove('employee-mode');
                
                // Show admin menu, hide employee menu
                if (employeeMenu) employeeMenu.classList.add('hidden');
                if (adminMenu) adminMenu.classList.remove('hidden');
                
                // Hide bottom nav for admin
                if (bottomNav) bottomNav.style.display = 'none';
                
                // Show hamburger toggle button for admin
                if (toggleBtn) toggleBtn.style.display = 'flex';

                // Navigate to admin dashboard
                router.navigate('admin-dashboard');
            } else {
                // Set employee-mode class on body
                body.classList.add('employee-mode');
                body.classList.remove('admin-mode');
                
                // Show employee menu, hide admin menu
                if (employeeMenu) employeeMenu.classList.remove('hidden');
                if (adminMenu) adminMenu.classList.add('hidden');
                
                // Show bottom nav for employee on mobile
                if (bottomNav) bottomNav.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
                
                // Hide hamburger toggle button for employee
                if (toggleBtn) toggleBtn.style.display = 'none';

                // Navigate to employee dashboard
                router.navigate('dashboard');
            }

            // Initialize mobile
            if (window.mobile) {
                window.mobile.handleResize();
            }

            // Bangunkan notifikasi otomatis setelah login
            if (window.notifications) {
                window.notifications.init();
            }
        }
    },

    showLogin() {
        const loginContainer = document.getElementById('login-container');
        const appContainer = document.getElementById('app-container');

        if (loginContainer && appContainer) {
            appContainer.classList.add('hidden');
            loginContainer.style.display = 'flex';
            
            // TAMBAHKAN SATU BARIS INI:
            loginContainer.style.opacity = '1';

            // Reset form
            const loginForm = document.getElementById('login-form');
            if (loginForm) loginForm.reset();
            
            // Refresh company data for login page display
            if (window.refreshCompanyData) {
                window.refreshCompanyData().then(() => {
                    if (window.updateCompanyUI) window.updateCompanyUI();
                    if (window.applyLoginDisplaySettings) window.applyLoginDisplaySettings();
                });
            }
            
            // Apply login display settings when showing login page
            if (window.applyLoginDisplaySettings) {
                window.applyLoginDisplaySettings();
            }
        }
    },

    updateUserUI() {
        if (!this.currentUser) return;

        // Update user info in sidebar
        const userNameEl = document.getElementById('user-name');
        const userRoleEl = document.getElementById('user-role');
        const userAvatarEl = document.getElementById('user-avatar');
        const welcomeNameEl = document.getElementById('welcome-name');

        if (userNameEl) userNameEl.textContent = this.currentUser.name;
        if (userRoleEl) userRoleEl.textContent = this.currentUser.role === 'admin' ? 'Administrator' : 'Karyawan';
        if (userAvatarEl) userAvatarEl.src = getAvatarUrl(this.currentUser);
        if (welcomeNameEl) welcomeNameEl.textContent = this.currentUser.name.split(' ')[0];
    },

    async openProfileModal() {
        const modal = document.getElementById('modal-profile');
        if (!modal) return;

        const user = this.currentUser;
        if (!user) return;

        // Set basic info
        document.getElementById('profile-avatar').src = getAvatarUrl(user);
        document.getElementById('profile-name').textContent = user.name || '-';
        document.getElementById('profile-email').textContent = user.email || '-';
        document.getElementById('profile-role').textContent = user.role === 'admin' ? 'Administrator' : 'Karyawan';

        // Employee-specific fields
        const empFields = document.getElementById('profile-employee-fields');
        if (user.role === 'karyawan' || user.role !== 'admin') {
            // Fetch profile from backend
            try {
                const result = await api.getEmployeeProfile(user.id);
                if (result.success && result.data) {
                    const profile = result.data;
                    document.getElementById('profile-department').textContent = profile.department || '-';
                    document.getElementById('profile-position').textContent = profile.position || '-';
                    document.getElementById('profile-shift').textContent = profile.shift || '-';
                }
            } catch (e) {
                document.getElementById('profile-department').textContent = user.department || '-';
                document.getElementById('profile-position').textContent = user.position || '-';
                document.getElementById('profile-shift').textContent = user.shift || '-';
            }
            if (empFields) empFields.style.display = 'block';
        } else {
            if (empFields) empFields.style.display = 'none';
        }

        // Clear password form
        document.getElementById('old-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';

        modal.style.display = 'flex';
    },

    async handleChangePassword() {
        const oldPwd = document.getElementById('old-password').value;
        const newPwd = document.getElementById('new-password').value;
        const confirmPwd = document.getElementById('confirm-password').value;

        if (!oldPwd || !newPwd || !confirmPwd) {
            toast.error('Semua field password harus diisi!');
            return;
        }
        if (newPwd !== confirmPwd) {
            toast.error('Password baru dan konfirmasi tidak cocok!');
            return;
        }
        if (newPwd.length < 4) {
            toast.error('Password minimal 4 karakter!');
            return;
        }

        try {
            const result = await api.changePassword(this.currentUser.id, oldPwd, newPwd);
            if (result.success) {
                toast.success('Password berhasil diubah!');
                document.getElementById('old-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
            } else {
                toast.error(result.error || 'Gagal mengubah password');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            toast.error('Terjadi kesalahan');
        }
    },

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('login-password');
        const toggleBtn = document.getElementById('toggle-password');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            passwordInput.type = 'password';
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    },

    isLoggedIn() {
        return this.currentUser !== null;
    },

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    getCurrentUser() {
        return this.currentUser;
    }
};

// Expose to global
window.auth = auth;
