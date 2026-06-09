/**
 * Portal Karyawan - Mobile Responsive
 * Mobile-specific functionality
 */

const mobile = {
    isMobile: false,
    
    init() {
        this.checkMobile();
        this.initBottomNav();
        this.handleResize();
        
        // Listen for resize events
        window.addEventListener('resize', () => this.handleResize());
    },
    
    checkMobile() {
        this.isMobile = window.innerWidth <= 768;
        return this.isMobile;
    },
    
    handleResize() {
        const wasMobile = this.isMobile;
        this.checkMobile();
        
        // Get current user role
        const isAdmin = auth.currentUser?.role === 'admin';
        
        // Toggle bottom nav - but not for admin
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            if (isAdmin) {
                // Admin: always hide bottom nav on mobile
                bottomNav.style.display = 'none';
            } else {
                // Employee: show on mobile, hide on desktop
                bottomNav.style.display = this.isMobile ? 'flex' : 'none';
            }
        }
        
        // Update sidebar visibility for non-admin users
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !isAdmin) {
            sidebar.style.display = this.isMobile ? 'none' : 'block';
        }
        
        // Update tables to cards on mobile
        this.updateTableViews();
    },
    
    initBottomNav() {
        const bottomNav = document.getElementById('bottom-nav');
        if (!bottomNav) return;
        
        const navItems = bottomNav.querySelectorAll('.bottom-nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    // Update active state
                    navItems.forEach(n => n.classList.remove('active'));
                    item.classList.add('active');
                    
                    // Navigate
                    router.navigate(page);
                }
            });
        });
    },
    
    updateTableViews() {
        // Convert tables to cards on mobile if needed
        const tableContainers = document.querySelectorAll('.table-responsive');
        
        tableContainers.forEach(container => {
            const table = container.querySelector('table');
            const mobileCards = container.nextElementSibling;
            
            if (table && mobileCards && mobileCards.classList.contains('mobile-cards')) {
                if (this.isMobile) {
                    container.style.display = 'none';
                    mobileCards.style.display = 'block';
                } else {
                    container.style.display = 'block';
                    mobileCards.style.display = 'none';
                }
            }
        });
    },
    
    // Update bottom nav active state based on current page
    updateBottomNav(page) {
        const bottomNav = document.getElementById('bottom-nav');
        if (!bottomNav) return;
        
        const navItems = bottomNav.querySelectorAll('.bottom-nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
    },
    
    // Initialize sidebar toggle for admin on mobile
    initAdminSidebarToggle() {
        const toggleBtn = document.getElementById('sidebar-toggle-mobile');
        const sidebar = document.getElementById('sidebar');
        if (!toggleBtn || !sidebar) return;
        
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });
        
        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && 
                !sidebar.contains(e.target) && 
                e.target !== toggleBtn &&
                !toggleBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
        
        // Close sidebar when clicking a nav link
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('open');
            });
        });
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    mobile.init();
    mobile.initAdminSidebarToggle();
});

// Expose
window.mobile = mobile;
