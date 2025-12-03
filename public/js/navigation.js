// Navigation Screen Handler
document.addEventListener('DOMContentLoaded', () => {
  const avatarCard = document.getElementById('avatarCard');
  const trainingHubCard = document.getElementById('trainingHubCard');
  const logoutButton = document.getElementById('logoutButton');

  // Navigate to Avatar Roleplay
  if (avatarCard) {
    avatarCard.addEventListener('click', () => {
      window.location.href = '/avatar';
    });
  }

  // Navigate to Training Hub
  if (trainingHubCard) {
    trainingHubCard.addEventListener('click', () => {
      window.location.href = '/training-hub';
    });
  }

  // Logout handler (only if logout button exists)
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

  // Add keyboard navigation support
  if (avatarCard) {
    avatarCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        avatarCard.click();
      }
    });

    // Make cards focusable for accessibility
    avatarCard.setAttribute('tabindex', '0');
    avatarCard.setAttribute('role', 'button');
    avatarCard.setAttribute('aria-label', 'Navigate to Avatar Roleplay');
  }

  if (trainingHubCard) {
    trainingHubCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trainingHubCard.click();
      }
    });

    trainingHubCard.setAttribute('tabindex', '0');
    trainingHubCard.setAttribute('role', 'button');
    trainingHubCard.setAttribute('aria-label', 'Navigate to Training Hub');
  }
});
