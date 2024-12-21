const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
    alert('Login successful!');
    window.location.href = 'dashboard.html';
  } catch (error) {
    alert(error.message);
  }
});
