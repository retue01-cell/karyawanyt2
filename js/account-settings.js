/**
 * Portal Karyawan - Account Settings Module
 * Handle employee self-service: change email and password
 */

const accountSettings = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        const formEmail = document.getElementById('form-change-email');
        if (formEmail) {
            formEmail.addEventListener('submit', (e) => this.handleChangeEmail(e));
        }

        const formPass = document.getElementById('form-change-password-account');
        if (formPass) {
            formPass.addEventListener('submit', (e) => this.handleChangePassword(e));
        }
    },

    async handleChangeEmail(e) {
        e.preventDefault();
        const newEmail = document.getElementById('new-email').value.trim();
        const password = document.getElementById('email-password').value;
        const currentUser = auth.getCurrentUser();

        if (!newEmail || !password) {
            toast.error('Semua field harus diisi');
            return;
        }

        try {
            loadingIndicator.show('Mengubah email...');
            const result = await api.updateEmployeeEmail(currentUser.id, newEmail, password);
            if (result.success) {
                // Update session
                currentUser.email = newEmail;
                storage.set('session', currentUser);
                toast.success('Email berhasil diubah! Silakan login kembali.');
                setTimeout(() => auth.handleLogout(), 2000);
            } else {
                toast.error(result.error || 'Gagal mengubah email');
            }
        } catch (err) {
            console.error('Change email error:', err);
            toast.error('Terjadi kesalahan');
        } finally {
            loadingIndicator.hide();
        }
    },

    async handleChangePassword(e) {
        e.preventDefault();
        const oldPwd = document.getElementById('old-pwd').value;
        const newPwd = document.getElementById('new-pwd').value;
        const confirmPwd = document.getElementById('confirm-pwd').value;
        const currentUser = auth.getCurrentUser();

        if (!oldPwd || !newPwd || !confirmPwd) {
            toast.error('Semua field harus diisi');
            return;
        }
        if (newPwd !== confirmPwd) {
            toast.error('Password baru tidak cocok');
            return;
        }
        if (newPwd.length < 4) {
            toast.error('Password minimal 4 karakter');
            return;
        }

        try {
            loadingIndicator.show('Mengubah password...');
            const result = await api.changePassword(currentUser.id, oldPwd, newPwd);
            if (result.success) {
                toast.success('Password berhasil diubah! Silakan login kembali.');
                setTimeout(() => auth.handleLogout(), 2000);
            } else {
                toast.error(result.error || 'Gagal mengubah password');
            }
        } catch (err) {
            console.error('Change password error:', err);
            toast.error('Terjadi kesalahan');
        } finally {
            loadingIndicator.hide();
        }
    }
};

window.initAccountSettings = () => accountSettings.init();
