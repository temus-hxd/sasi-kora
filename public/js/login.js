// Login Form Handler
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');
  const userIdInput = document.getElementById('userId');
  const passwordInput = document.getElementById('password');
  const loginButton = loginForm.querySelector('button[type="submit"]');

  // Handle form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form values
    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    // Hide previous error messages
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';

    // Disable button during submission
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    try {
      // Send login request to server
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Server-side session is set via cookie
        // Redirect to main application
        window.location.href = data.redirect || '/';
      } else {
        // Show error message
        errorMessage.textContent =
          data.message || 'Invalid credentials. Please try again.';
        errorMessage.style.display = 'block';

        // Clear password field
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      errorMessage.textContent = 'An error occurred. Please try again later.';
      errorMessage.style.display = 'block';
    } finally {
      // Re-enable button
      loginButton.disabled = false;
      loginButton.textContent = 'Login';
    }
  });

  // Clear error message when user starts typing
  userIdInput.addEventListener('input', () => {
    if (errorMessage.style.display === 'block') {
      errorMessage.style.display = 'none';
    }
  });

  passwordInput.addEventListener('input', () => {
    if (errorMessage.style.display === 'block') {
      errorMessage.style.display = 'none';
    }
  });

  // Focus on user ID input on load
  userIdInput.focus();
});
