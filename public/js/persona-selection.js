// Persona Selection Screen Handler
document.addEventListener('DOMContentLoaded', () => {
  const personaCards = document.querySelectorAll('.persona-card');
  const backButton = document.getElementById('backButton');

  // Modal elements
  const modal = document.getElementById('infoModal');
  const modalBody = document.getElementById('modalBody');
  const modalClose = modal.querySelector('.modal-close');
  const modalOverlay = modal.querySelector('.modal-overlay');

  // Handle more info button clicks
  personaCards.forEach((card) => {
    const moreInfoButton = card.querySelector('.more-info-button');
    const expandedContent = card.querySelector('.card-expanded-content');

    if (moreInfoButton && expandedContent) {
      moreInfoButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click

        // Copy content to modal
        modalBody.innerHTML = expandedContent.innerHTML;

        // Set up tab switching functionality
        const tabButtons = modalBody.querySelectorAll('.tab-button');
        const tabContents = modalBody.querySelectorAll('.tab-content');

        tabButtons.forEach((button) => {
          button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach((btn) => btn.classList.remove('active'));
            tabContents.forEach((content) =>
              content.classList.remove('active')
            );

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = modalBody.querySelector(`#tab-${targetTab}`);
            if (targetContent) {
              targetContent.classList.add('active');
            }
          });
        });

        // Show modal
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      });
    }
  });

  // Close modal function
  const closeModal = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  // Handle modal close button
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  // Handle overlay click
  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeModal);
  }

  // Handle Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // Handle persona selection via Select Scenario button
  personaCards.forEach((card) => {
    const selectButton = card.querySelector('.select-scenario-button');

    if (selectButton) {
      selectButton.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent any card-level events

        const persona = card.getAttribute('data-persona');

        // Store selected persona in localStorage
        localStorage.setItem('selectedPersona', persona);

        // Clear all previously loaded prompts and reload initial prompts
        try {
          console.log('🔄 Reloading prompts for new scenario...');
          const response = await fetch('/api/emotional-state/reload-prompts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              language: 'en', // Default to 'en', can be made dynamic if needed
            }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Prompts reloaded:', data.message);
          } else {
            console.warn('⚠️ Failed to reload prompts, continuing anyway');
          }
        } catch (error) {
          console.error('❌ Error reloading prompts:', error);
          // Continue anyway - prompts will be loaded on first use
        }

        // Redirect to avatar page
        window.location.href = '/avatar';
      });
    }
  });

  // Handle back button
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  // Handle logout button
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      if (window.authUtils && window.authUtils.logout) {
        await window.authUtils.logout();
      } else {
        // Fallback logout
        try {
          const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
          });

          if (response.ok) {
            window.location.href = '/login';
          }
        } catch (error) {
          console.error('Logout error:', error);
          window.location.href = '/login';
        }
      }
    });
  }
});
