// Authentication utility for protected pages
// This file should be included in protected pages to handle authentication checks

/**
 * Check authentication status with the server
 */
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/status', {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (response.ok) {
      const data = await response.json();
      return data.authenticated;
    }
    return false;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

/**
 * Handle API responses and redirect to login if unauthorized
 */
function handleApiResponse(response) {
  if (response.status === 401) {
    // Unauthorized - redirect to login
    window.location.href = '/login';
    return false;
  }
  return true;
}

/**
 * Wrapper for fetch that automatically handles authentication
 */
async function authenticatedFetch(url, options = {}) {
  const defaultOptions = {
    ...options,
    credentials: 'include', // Always include cookies
  };

  const response = await fetch(url, defaultOptions);

  // Check if unauthorized
  if (response.status === 401) {
    window.location.href = '/login';
    return response;
  }

  return response;
}

/**
 * Logout function
 */
async function logout() {
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      window.location.href = data.redirect || '/login';
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Still redirect to login even if logout fails
    window.location.href = '/login';
  }
}

// Check authentication on page load for protected pages
document.addEventListener('DOMContentLoaded', async () => {
  // Only check if we're not on the login page
  if (!window.location.pathname.includes('/login')) {
    const isAuthenticated = await checkAuthStatus();
    if (!isAuthenticated) {
      window.location.href = '/login';
    }
  }
});

// Export functions for use in other scripts
window.authUtils = {
  checkAuthStatus,
  handleApiResponse,
  authenticatedFetch,
  logout,
};
