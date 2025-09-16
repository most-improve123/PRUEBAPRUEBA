// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB43ne5sv_2-CzPC-GoNbBM5uNGiTHlQ0Q",
  authDomain: "users-ab3e0.firebaseapp.com",
  projectId: "users-ab3e0",
  storageBucket: "users-ab3e0.firebasestorage.app",
  messagingSenderId: "466535430209",
  appId: "1:466535430209:web:4e49fde0578fb037042ec0"
};
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Funciones utilitarias
function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function generateRandomToken() {
  return crypto.randomUUID();
}

async function checkIfEmailExists(email) {
  try {
    const usersRef = db.collection('users');
    const query = usersRef.where('email', '==', email).limit(1);
    const snapshot = await query.get();
    return !snapshot.empty;
  } catch (error) {
    console.error("Error verifying email:", error);
    return false;
  }
}

function getBaseUrl() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://${window.location.hostname}:${window.location.port}`;
  } else if (window.location.hostname.includes('github.io')) {
    return 'https://most-improve123.github.io/LIMPPL';
  } else {
    return `https://${window.location.hostname}`;
  }
}

// Función para enviar magic link
async function sendMagicLink() {
  const email = document.getElementById('magic-link-email').value;
  if (!email) {
    showToast('error', 'Email required', 'Please enter your email address.');
    return;
  }

  const sendButton = document.querySelector('#magic-link-modal .btn-primary');
  sendButton.disabled = true;
  sendButton.textContent = 'Checking...';

  try {
    showLoading();
    // Verificar si el correo existe en Firestore
    const usersRef = db.collection('users');
    const query = usersRef.where('email', '==', email).limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      showToast('error', 'Unregistered email', 'This email is not registered. Please sign up first.');
      return; // Detener si el correo no está registrado
    }

    sendButton.textContent = 'Sending...';
    const token = generateRandomToken();
    localStorage.setItem('magicLinkToken', token);
    localStorage.setItem('magicLinkEmail', email);

    const baseUrl = getBaseUrl();
    const magicLink = `${baseUrl}/login.html?token=${token}&email=${encodeURIComponent(email)}`;

    await sendBrevoMagicLinkEmail(email, magicLink);
    showToast('success', 'Magic link sent', 'Check your email to sign in.');
    document.getElementById('magic-link-modal').classList.add('hidden');
  } catch (error) {
    console.error("Error sending magic link:", error);
    showToast('error', 'Error', error.message);
  } finally {
    hideLoading();
    sendButton.disabled = false;
    sendButton.textContent = 'Send magic link';
  }
}

// Función para enviar email con Brevo
async function sendBrevoMagicLinkEmail(email, magicLink) {
  try {
    const response = await fetch('https://wespark-backend.onrender.com/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, magicLink }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error sending email');
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Función para recuperar contraseña
function sendPasswordResetEmail() {
  const email = document.getElementById('recovery-email').value;
  if (!email) {
    showToast('error', 'Email required', 'Please enter your email address.');
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast('success', 'Email sent', 'Check your inbox to reset your password.');
      document.getElementById('forgot-password-modal').classList.add('hidden');
    })
    .catch(error => {
      console.error("Error sending recovery email:", error);
      showToast('error', 'Error', error.message);
    });
}

// Función para mostrar toasts
function showToast(type, title, description = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-header">
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <div class="toast-title">${title}</div>
    </div>
    ${description ? `<div class="toast-description">${description}</div>` : ''}
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Manejo de modales y eventos
document.addEventListener('DOMContentLoaded', function() {
  // Modal de magic link
  const magicLinkRequestMain = document.getElementById('magic-link-request-main');
  const magicLinkModal = document.getElementById('magic-link-modal');
  const closeMagicLinkModal = document.getElementById('close-magic-link-modal');

  if (magicLinkRequestMain && magicLinkModal && closeMagicLinkModal) {
    magicLinkRequestMain.addEventListener('click', (e) => {
      e.preventDefault();
      magicLinkModal.classList.remove('hidden');
    });

    closeMagicLinkModal.addEventListener('click', () => {
      magicLinkModal.classList.add('hidden');
    });
  }

  // Modal de login tradicional
  const showTraditionalLogin = document.getElementById('show-traditional-login');
  const traditionalLoginModal = document.getElementById('traditional-login-modal');
  const closeTraditionalLoginModal = document.getElementById('close-traditional-login-modal');

  if (showTraditionalLogin && traditionalLoginModal && closeTraditionalLoginModal) {
    showTraditionalLogin.addEventListener('click', (e) => {
      e.preventDefault();
      traditionalLoginModal.classList.remove('hidden');
    });

    closeTraditionalLoginModal.addEventListener('click', () => {
      traditionalLoginModal.classList.add('hidden');
    });
  }

  // Modal de recuperación de contraseña
  const forgotPasswordLink = document.getElementById('forgot-password-link');
  const forgotPasswordModal = document.getElementById('forgot-password-modal');
  const closeForgotPasswordModal = document.getElementById('close-forgot-password-modal');

  if (forgotPasswordLink && forgotPasswordModal && closeForgotPasswordModal) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      forgotPasswordModal.classList.remove('hidden');
    });

    closeForgotPasswordModal.addEventListener('click', () => {
      forgotPasswordModal.classList.add('hidden');
    });
  }

  // Verificar token en URL (magic link)
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const email = urlParams.get('email');

  if (token && email) {
    const storedToken = localStorage.getItem('magicLinkToken');
    const storedEmail = localStorage.getItem('magicLinkEmail');

    // Dentro de la verificación del token del magic link
if (token === storedToken && email === storedEmail) {
  db.collection('users').where('email', '==', email).limit(1).get()
    .then(querySnapshot => {
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        localStorage.setItem('userName', userData.name || email.split('@')[0]); // Prioriza el nombre de Firestore
        localStorage.setItem('userRole', userData.role || 'graduate');
      } else {
        localStorage.setItem('userName', email.split('@')[0]); // Fallback si no existe el usuario
        localStorage.setItem('userRole', 'graduate');
      }
      const simulatedUID = 'brevo-' + email.split('@')[0] + '-' + Date.now();
      localStorage.setItem('userUID', simulatedUID);
      showToast('success', 'Successful login', 'Welcome!');
      setTimeout(() => window.location.href = 'prueba.html', 2000);
    })

    .catch(error => {
          console.error("Error getting user role:", error);
          localStorage.setItem('userName', email.split('@')[0]);
          localStorage.setItem('userRole', 'graduate');
          const simulatedUID = 'brevo-' + email.split('@')[0] + '-' + Date.now();
          localStorage.setItem('userUID', simulatedUID);
          showToast('success', 'Successful login', 'Welcome!');
          setTimeout(() => window.location.href = 'prueba.html', 2000);
        });
    } else {
      showToast('error', 'Invalid link', 'The magic link is not valid or has expired.');
    }
  }

  // Manejo del formulario de login tradicional
  document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('traditional-email').value;
  const password = document.getElementById('traditional-password').value;

  showLoading();
  try {
    // Verificar si el usuario existe en Firestore (opcional, pero recomendado)
    const usersRef = db.collection('users');
    const query = usersRef.where('email', '==', email).limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      showToast('error', 'User Not Found', 'This email is not registered.');
      return; // Detener si el correo no está registrado
    }

    // Proceder con el login en Firebase Auth
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Verificar que el usuario exista en Firestore (por si acaso)
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      showToast('error', 'User Not Found', 'This account no longer exists.');
      setTimeout(() => window.location.href = 'error.html', 2000);
      return;
    }

    const userData = userDoc.data();
    localStorage.setItem('userName', userData.name || email.split('@')[0]);
    localStorage.setItem('userRole', userData.role);
    localStorage.setItem('userUID', user.uid);

    showToast('success', 'Login successful!', 'Welcome back.');
    setTimeout(() => window.location.href = 'prueba.html', 2000);
  } catch (error) {
    console.error("Login error:", error);
    showToast('error', 'Login error', error.message);
  } finally {
    hideLoading();
  }
});

});
