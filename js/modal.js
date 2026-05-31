// modal.js - Modal manager
const modal = {
    overlay: null,
    init() {
        if (!document.getElementById('dynamic-modal')) {
            const html = `
                <div id="dynamic-modal" class="modal-overlay" style="display: none;">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3 id="modal-title">Modal</h3>
                            <button class="btn-close-modal" id="modal-close-btn"><i class="fas fa-times"></i></button>
                        </div>
                        <div id="modal-body" class="modal-form" style="padding:16px; max-height:70vh; overflow-y:auto;"></div>
                        <div id="modal-footer" class="modal-actions" style="padding:16px; border-top:1px solid #e2e8f0;">
                            <button class="btn-secondary" id="modal-cancel-btn">Tutup</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
        this.overlay = document.getElementById('dynamic-modal');
        document.getElementById('modal-close-btn')?.addEventListener('click', () => this.close());
        document.getElementById('modal-cancel-btn')?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    },
    show(title, content, buttons = null) {
        if (!this.overlay) this.init();
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = content;
        const footer = document.getElementById('modal-footer');
        footer.innerHTML = '';
        if (buttons && buttons.length) {
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.label;
                button.className = btn.class || 'btn-secondary';
                button.onclick = () => { if (btn.onClick) btn.onClick(); this.close(); };
                footer.appendChild(button);
            });
        } else {
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Tutup';
            closeBtn.className = 'btn-secondary';
            closeBtn.onclick = () => this.close();
            footer.appendChild(closeBtn);
        }
        this.overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },
    close() {
        if (this.overlay) this.overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
};
document.addEventListener('DOMContentLoaded', () => modal.init());
window.modal = modal;
