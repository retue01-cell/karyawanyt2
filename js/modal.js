/**
 * Portal Karyawan - Modal Manager
 * Dynamic modal dialog system
 */

const modal = {
    overlay: null,
    container: null,
    closeCallback: null,

    init() {
        // Create modal structure if not exists
        if (!document.getElementById('dynamic-modal')) {
            const modalHTML = `
                <div id="dynamic-modal" class="modal-overlay" style="display: none;">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3 id="modal-title">Modal Title</h3>
                            <button class="btn-close-modal" id="modal-close-btn">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div id="modal-body" class="modal-form" style="padding: var(--spacing-md); max-height: 70vh; overflow-y: auto;">
                            Modal content here
                        </div>
                        <div id="modal-footer" class="modal-actions" style="padding: var(--spacing-md); border-top: 1px solid var(--border-color);">
                            <button class="btn-secondary" id="modal-cancel-btn">Tutup</button>
                            <button class="btn-primary" id="modal-confirm-btn" style="display: none;">OK</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.overlay = document.getElementById('dynamic-modal');
        this.container = this.overlay?.querySelector('.modal-container');
        this.bindEvents();
    },

    bindEvents() {
        const closeBtn = document.getElementById('modal-close-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }
        if (cancelBtn) {
            cancelBtn.onclick = () => this.close();
        }
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                if (this.confirmHandler) this.confirmHandler();
                this.close();
            };
        }

        // Close when clicking overlay
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });
        }
    },

    /**
     * Show modal dialog
     * @param {string} title - Modal title
     * @param {string|HTMLElement} content - HTML string or DOM element
     * @param {Array} buttons - Array of button configs { label, class, onClick }
     */
    show(title, content, buttons = null) {
        if (!this.overlay) this.init();

        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body');
        const footerEl = document.getElementById('modal-footer');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        if (titleEl) titleEl.textContent = title || 'Info';
        if (bodyEl) {
            if (typeof content === 'string') {
                bodyEl.innerHTML = content;
            } else {
                bodyEl.innerHTML = '';
                bodyEl.appendChild(content);
            }
        }

        // Custom buttons
        if (buttons && Array.isArray(buttons) && footerEl) {
            // Clear existing buttons except the default ones
            const defaultBtns = [cancelBtn, confirmBtn];
            footerEl.querySelectorAll('button').forEach(btn => {
                if (!defaultBtns.includes(btn)) btn.remove();
            });

            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.label;
                button.className = btn.class || 'btn-secondary';
                button.onclick = () => {
                    if (btn.onClick) btn.onClick();
                    if (btn.closeOnClick !== false) this.close();
                };
                footerEl.appendChild(button);
            });
            
            // Show/hide default buttons
            if (confirmBtn) confirmBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = buttons.some(b => b.label === 'Tutup') ? 'none' : 'inline-flex';
        } else {
            // Default: only close button
            if (confirmBtn) confirmBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        }

        this.overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    close() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (this.closeCallback) {
            this.closeCallback();
            this.closeCallback = null;
        }
    },

    setConfirmHandler(handler) {
        this.confirmHandler = handler;
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) confirmBtn.style.display = 'inline-flex';
    },

    isOpen() {
        return this.overlay && this.overlay.style.display === 'flex';
    }
};

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    modal.init();
});

// Expose to global
window.modal = modal;
