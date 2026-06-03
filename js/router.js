/**
 * Portal Karyawan - Modal Manager
 * Versi stabil dan teruji
 */

(function() {
    // Buat elemen modal jika belum ada
    function createModalStructure() {
        if (document.getElementById('dynamic-modal')) return;
        
        const modalHtml = `
            <div id="dynamic-modal" class="modal-overlay" style="display: none;">
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 id="modal-title">Modal</h3>
                        <button class="btn-close-modal" id="modal-close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div id="modal-body" class="modal-form" style="padding: var(--spacing-md); max-height: 70vh; overflow-y: auto;">
                        Konten akan ditampilkan di sini
                    </div>
                    <div id="modal-footer" class="modal-actions" style="padding: var(--spacing-md); border-top: 1px solid var(--border-color);">
                        <button class="btn-secondary" id="modal-cancel-btn">Tutup</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Inisialisasi modal
    function initModal() {
        createModalStructure();
        
        const overlay = document.getElementById('dynamic-modal');
        const closeBtn = document.getElementById('modal-close-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        
        if (closeBtn) {
            closeBtn.onclick = function() { closeModal(); };
        }
        if (cancelBtn) {
            cancelBtn.onclick = function() { closeModal(); };
        }
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) closeModal();
            });
        }
        
        window.modal = {
            show: function(title, content, buttons) {
                const titleEl = document.getElementById('modal-title');
                const bodyEl = document.getElementById('modal-body');
                const footerEl = document.getElementById('modal-footer');
                
                if (titleEl) titleEl.textContent = title || 'Informasi';
                if (bodyEl) bodyEl.innerHTML = content;
                
                // Atur tombol
                if (footerEl) {
                    footerEl.innerHTML = '';
                    if (buttons && buttons.length) {
                        buttons.forEach(btn => {
                            const button = document.createElement('button');
                            button.textContent = btn.label;
                            button.className = btn.class || 'btn-secondary';
                            button.onclick = function() {
                                if (btn.onClick) btn.onClick();
                                closeModal();
                            };
                            footerEl.appendChild(button);
                        });
                    } else {
                        const closeButton = document.createElement('button');
                        closeButton.textContent = 'Tutup';
                        closeButton.className = 'btn-secondary';
                        closeButton.onclick = function() { closeModal(); };
                        footerEl.appendChild(closeButton);
                    }
                }
                
                if (overlay) overlay.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            },
            close: function() {
                closeModal();
            }
        };
    }
    
    function closeModal() {
        const overlay = document.getElementById('dynamic-modal');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Jalankan inisialisasi saat DOM siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModal);
    } else {
        initModal();
    }
})();
