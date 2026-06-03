/**
 * Portal Karyawan - Admin Employees
 * Employee management for admin (with Edit password)
 */

const adminEmployees = {
    employees: [],
    currentPage: 1,
    perPage: 10,
    filters: {
        search: '',
        department: '',
        status: ''
    },
    currentEditId: null,
    isSubmitting: false,

    async init() {
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses!');
            router.navigate('dashboard');
            return;
        }

        loadingIndicator.show('Memuat data karyawan...');
        await this.loadEmployees();
        this.bindEvents();
        this.renderTable();
        this.renderMobileCards();
        this.updatePaginationInfo();
        loadingIndicator.hide();
    },

    async loadEmployees() {
        try {
            const result = await api.getEmployees();
            this.employees = result.data || [];
        } catch (error) {
            console.error('Error loading employees:', error);
            this.employees = storage.get('admin_employees', []);
        }
    },

    bindEvents() {
        // Search filter
        const searchInput = document.getElementById('employee-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.currentPage = 1;
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
            });
        }

        // Department filter
        const deptFilter = document.getElementById('dept-filter');
        if (deptFilter) {
            // Populate department options dynamically
            departmentManager.populateSelects('dept-filter');
            deptFilter.addEventListener('change', (e) => {
                this.filters.department = e.target.value;
                this.currentPage = 1;
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.currentPage = 1;
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
            });
        }

        // Add employee button
        const addBtn = document.getElementById('btn-add-employee');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }

        // Close modal (add)
        const closeBtn = document.getElementById('btn-close-modal');
        const cancelBtn = document.getElementById('btn-cancel-add');
        const modal = document.getElementById('modal-add-employee');

        if (closeBtn) closeBtn.addEventListener('click', () => this.hideAddModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideAddModal());
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideAddModal();
            });
        }

        // Form submit (add)
        const form = document.getElementById('form-add-employee');
        if (form) {
            form.addEventListener('submit', (e) => this.handleAddEmployee(e));
        }

        // Set default date for add modal
        const joinDateInput = document.getElementById('emp-join-date');
        if (joinDateInput) {
            joinDateInput.valueAsDate = new Date();
        }

        // ========== EDIT MODAL EVENTS ==========
        const editModal = document.getElementById('modal-edit-employee');
        const closeEditBtn = document.getElementById('btn-close-edit-modal');
        const cancelEditBtn = document.getElementById('btn-cancel-edit');
        const editForm = document.getElementById('form-edit-employee');

        if (closeEditBtn) closeEditBtn.addEventListener('click', () => this.hideEditModal());
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => this.hideEditModal());
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) this.hideEditModal();
            });
        }
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEditEmployee(e));
        }
    },

    getFilteredEmployees() {
        return this.employees.filter(emp => {
            const matchesSearch = !this.filters.search ||
                emp.name.toLowerCase().includes(this.filters.search) ||
                emp.email.toLowerCase().includes(this.filters.search) ||
                emp.position.toLowerCase().includes(this.filters.search);
            const matchesDept = !this.filters.department || emp.department === this.filters.department;
            const matchesStatus = !this.filters.status || emp.status === this.filters.status;
            return matchesSearch && matchesDept && matchesStatus;
        });
    },

    renderTable() {
        const tbody = document.getElementById('employees-table-body');
        if (!tbody) return;

        const filtered = this.getFilteredEmployees();
        const start = (this.currentPage - 1) * this.perPage;
        const paginated = filtered.slice(start, start + this.perPage);

        if (paginated.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: var(--spacing-xl);">Tidak ada data karyawan</div></tr>`;
            return;
        }

        tbody.innerHTML = paginated.map(emp => `
            <tr>
                <td>
                    <div class="employee-info">
                        <div class="employee-avatar">
                            <img src="${getAvatarUrl(emp)}" alt="${emp.name}">
                        </div>
                        <div class="employee-details">
                            <span class="employee-name">${this.escapeHtml(emp.name)}</span>
                            <span class="employee-email">${this.escapeHtml(emp.email)}</span>
                        </div>
                    </div>
                 </div>
                <td>EMP${String(emp.id).padStart(3, '0')}</div>
                <td>${this.escapeHtml(emp.department)}</div>
                <td>${this.escapeHtml(emp.position)}</div>
                <td>${this.escapeHtml(emp.shift)}</div>
                <td><span class="status-badge ${emp.status}">${this.getStatusLabel(emp.status)}</span></div>
                <td>
                    <button class="btn-action view" onclick="adminEmployees.viewEmployee(${emp.id})" title="Lihat">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action edit" onclick="adminEmployees.editEmployee(${emp.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" onclick="adminEmployees.deleteEmployee(${emp.id})" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                 </div>
            </tr>
        `).join('');

        this.updatePagination(filtered.length);
    },

    renderMobileCards() {
        const container = document.getElementById('employees-mobile-cards');
        if (!container) return;

        const filtered = this.getFilteredEmployees();
        const start = (this.currentPage - 1) * this.perPage;
        const paginated = filtered.slice(start, start + this.perPage);

        container.innerHTML = paginated.map(emp => `
            <div class="mobile-card">
                <div class="mobile-card-header">
                    <div class="employee-info">
                        <div class="employee-avatar">
                            <img src="${getAvatarUrl(emp)}" alt="${emp.name}">
                        </div>
                        <div class="employee-details">
                            <span class="employee-name">${this.escapeHtml(emp.name)}</span>
                            <span class="employee-email">${this.escapeHtml(emp.email)}</span>
                        </div>
                    </div>
                    <span class="status-badge ${emp.status}">${this.getStatusLabel(emp.status)}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">ID</span>
                    <span class="mobile-card-value">EMP${String(emp.id).padStart(3, '0')}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Departemen</span>
                    <span class="mobile-card-value">${this.escapeHtml(emp.department)}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Jabatan</span>
                    <span class="mobile-card-value">${this.escapeHtml(emp.position)}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Shift</span>
                    <span class="mobile-card-value">${this.escapeHtml(emp.shift)}</span>
                </div>
                <div style="margin-top: var(--spacing); display: flex; gap: var(--spacing-xs);">
                    <button class="btn-action view" onclick="adminEmployees.viewEmployee(${emp.id})" style="flex: 1;">
                        <i class="fas fa-eye"></i> Lihat
                    </button>
                    <button class="btn-action edit" onclick="adminEmployees.editEmployee(${emp.id})" style="flex: 1;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `).join('');
    },

    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.perPage);
        const paginationButtons = document.querySelector('.pagination-buttons');
        if (paginationButtons) {
            let buttonsHtml = `<button class="btn-page" ${this.currentPage === 1 ? 'disabled' : ''} onclick="adminEmployees.goToPage(${this.currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
            for (let i = 1; i <= totalPages; i++) {
                buttonsHtml += `<button class="btn-page ${i === this.currentPage ? 'active' : ''}" onclick="adminEmployees.goToPage(${i})">${i}</button>`;
            }
            buttonsHtml += `<button class="btn-page" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="adminEmployees.goToPage(${this.currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
            paginationButtons.innerHTML = buttonsHtml;
        }
        this.updatePaginationInfo();
    },

    updatePaginationInfo() {
        const filtered = this.getFilteredEmployees();
        const start = (this.currentPage - 1) * this.perPage + 1;
        const end = Math.min(start + this.perPage - 1, filtered.length);
        const info = document.querySelector('.pagination-info');
        if (info) {
            info.textContent = `Menampilkan ${filtered.length > 0 ? start : 0}-${end} dari ${filtered.length} karyawan`;
        }
    },

    goToPage(page) {
        const filtered = this.getFilteredEmployees();
        const totalPages = Math.ceil(filtered.length / this.perPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderTable();
            this.renderMobileCards();
        }
    },

    getStatusLabel(status) {
        const labels = { 'active': 'Aktif', 'on-leave': 'Cuti', 'inactive': 'Non-Aktif' };
        return labels[status] || status;
    },

    async showAddModal() {
        const modal = document.getElementById('modal-add-employee');
        if (modal) {
            // Populate department datalist dynamically BEFORE showing modal
            console.log('[showAddModal] Memulai populate dept-list');
            await departmentManager.populateSelects('dept-list');
            console.log('[showAddModal] Selesai populate dept-list, cache:', departmentManager.cache);
            
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            this.isSubmitting = false;
            const submitBtn = document.querySelector('#form-add-employee button[type="submit"]');
            if (submitBtn) submitBtn.disabled = false;
            const pwdField = document.getElementById('emp-password');
            const confirmField = document.getElementById('emp-confirm-password');
            if (pwdField) pwdField.value = '';
            if (confirmField) confirmField.value = '';
        }
    },

    hideAddModal() {
        const modal = document.getElementById('modal-add-employee');
        const form = document.getElementById('form-add-employee');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (form) {
            form.reset();
            const joinDateInput = document.getElementById('emp-join-date');
            if (joinDateInput) joinDateInput.valueAsDate = new Date();
        }
        this.isSubmitting = false;
    },

    async handleAddEmployee(e) {
        e.preventDefault();
        if (this.isSubmitting) {
            toast.warning('Sedang memproses, harap tunggu');
            return;
        }
        this.isSubmitting = true;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        const name = document.getElementById('emp-name').value.trim();
        const email = document.getElementById('emp-email').value.trim();
        const password = document.getElementById('emp-password').value.trim();
        const confirmPassword = document.getElementById('emp-confirm-password').value.trim();
        const department = document.getElementById('emp-department').value.trim();
        const position = document.getElementById('emp-position').value.trim();
        const shift = document.getElementById('emp-shift').value;
        const status = document.getElementById('emp-status').value;
        const joinDate = document.getElementById('emp-join-date').value;

        if (!name || !email || !password || !confirmPassword || !department || !position || !shift || !status || !joinDate) {
            toast.error('Semua field harus diisi!');
            this.isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        if (password.length < 4) {
            toast.error('Password minimal 4 karakter');
            this.isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Password dan konfirmasi password tidak cocok');
            this.isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        const employeeData = { name, email, password, department, position, shift, status, joinDate };

        try {
            loadingIndicator.show('Menyimpan data karyawan...');
            const result = await api.addEmployee(employeeData);
            loadingIndicator.hide();
            if (result && result.success) {
                this.employees.unshift(result.data);
                this.updateDeptFilterOptions(department);
                this.hideAddModal();
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
                toast.success(`Karyawan ${name} berhasil ditambahkan!`);
            } else {
                toast.error(result?.error || 'Gagal menambahkan karyawan');
            }
        } catch (error) {
            loadingIndicator.hide();
            console.error('Error adding employee:', error);
            toast.error('Terjadi kesalahan');
        } finally {
            this.isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    updateDeptFilterOptions(newDept) {
        const deptFilter = document.getElementById('dept-filter');
        if (deptFilter) {
            const existingOptions = Array.from(deptFilter.options).map(opt => opt.value);
            if (!existingOptions.includes(newDept)) {
                const option = document.createElement('option');
                option.value = newDept;
                option.textContent = newDept;
                deptFilter.appendChild(option);
            }
        }
        const deptList = document.getElementById('dept-list');
        if (deptList) {
            const existingOptions = Array.from(deptList.options).map(opt => opt.value);
            if (!existingOptions.includes(newDept)) {
                const option = document.createElement('option');
                option.value = newDept;
                deptList.appendChild(option);
            }
        }
    },

    getRandomColor() {
        const colors = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899', '06B6D4'];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    viewEmployee(id) {
        const emp = this.employees.find(e => e.id == id);
        if (emp) {
            alert(`Detail Karyawan:\n\nNama: ${emp.name}\nEmail: ${emp.email}\nDepartemen: ${emp.department}\nJabatan: ${emp.position}\nShift: ${emp.shift}\nStatus: ${this.getStatusLabel(emp.status)}\nBergabung: ${emp.joinDate}`);
        }
    },

    async editEmployee(id) {
        const emp = this.employees.find(e => e.id == id);
        if (!emp) {
            toast.error('Data karyawan tidak ditemukan');
            return;
        }
        this.currentEditId = id;
        document.getElementById('edit-emp-name').value = emp.name;
        document.getElementById('edit-emp-email').value = emp.email;
        document.getElementById('edit-emp-position').value = emp.position;
        document.getElementById('edit-emp-shift').value = emp.shift;
        document.getElementById('edit-emp-status').value = emp.status;
        document.getElementById('edit-emp-join-date').value = emp.joinDate || '';
        // Kosongkan field password
        document.getElementById('edit-emp-password').value = '';
        document.getElementById('edit-emp-confirm-password').value = '';
        
        // Populate department datalist dynamically and set current value AFTER populating
        console.log('[editEmployee] Memulai populate dept-list-edit untuk:', emp.department);
        await departmentManager.populateSelects('dept-list-edit', emp.department);
        console.log('[editEmployee] Selesai populate, cache:', departmentManager.cache);
        
        // Set nilai departemen setelah datalist terisi
        const deptInput = document.getElementById('edit-emp-department');
        if (deptInput && emp.department) {
            deptInput.value = emp.department;
            console.log('[editEmployee] Nilai departemen diset ke:', emp.department);
        }
        
        const modal = document.getElementById('modal-edit-employee');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    hideEditModal() {
        const modal = document.getElementById('modal-edit-employee');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        this.currentEditId = null;
    },

    async handleEditEmployee(e) {
        e.preventDefault();
        if (!this.currentEditId) return;

        const name = document.getElementById('edit-emp-name').value.trim();
        const email = document.getElementById('edit-emp-email').value.trim();
        const department = document.getElementById('edit-emp-department').value.trim();
        const position = document.getElementById('edit-emp-position').value.trim();
        const shift = document.getElementById('edit-emp-shift').value;
        const status = document.getElementById('edit-emp-status').value;
        const joinDate = document.getElementById('edit-emp-join-date').value;
        const newPassword = document.getElementById('edit-emp-password').value.trim();
        const confirmPassword = document.getElementById('edit-emp-confirm-password').value.trim();

        if (newPassword && newPassword.length < 4) {
            toast.error('Password minimal 4 karakter');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('Password dan konfirmasi tidak cocok');
            return;
        }

        const updateData = { name, email, department, position, shift, status, joinDate };
        if (newPassword) {
            updateData.password = newPassword;
        }

        try {
            loadingIndicator.show('Memperbarui data karyawan...');
            const result = await api.updateEmployee(this.currentEditId, updateData);
            loadingIndicator.hide();
            if (result && result.success) {
                const index = this.employees.findIndex(e => e.id == this.currentEditId);
                if (index !== -1) {
                    this.employees[index] = { ...this.employees[index], ...updateData };
                }
                this.hideEditModal();
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
                toast.success(`Karyawan ${name} berhasil diperbarui!`);
            } else {
                toast.error(result?.error || 'Gagal memperbarui karyawan');
            }
        } catch (error) {
            loadingIndicator.hide();
            console.error('Error updating employee:', error);
            toast.error('Terjadi kesalahan');
        }
    },

    async deleteEmployee(id) {
        if (confirm('Apakah Anda yakin ingin menghapus karyawan ini?')) {
            try {
                loadingIndicator.show('Menghapus karyawan...');
                await api.deleteEmployee(id);
                loadingIndicator.hide();
                this.employees = this.employees.filter(e => e.id != id);
                this.renderTable();
                this.renderMobileCards();
                this.updatePaginationInfo();
                toast.success('Karyawan berhasil dihapus');
            } catch (error) {
                loadingIndicator.hide();
                console.error('Error deleting employee:', error);
                toast.error('Gagal menghapus karyawan');
            }
        }
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

window.initEmployees = () => { adminEmployees.init(); };
window.adminEmployees = adminEmployees;
