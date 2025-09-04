// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB43ne5sv_2-CzPC-GoNbBM5uNGiTHlQ0Q",
  authDomain: "users-ab3e0.firebaseapp.com",
  projectId: "users-ab3e0",
  storageBucket: "users-ab3e0.firebasestorage.app",
  messagingSenderId: "466535430209",
  appId: "1:466535430209:web:4e49fde0578fb037042ec0"
};
// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
// Función para mostrar loading
function showLoading() {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) loadingElement.classList.remove('hidden');
}
// Función para ocultar loading
function hideLoading() {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) loadingElement.classList.add('hidden');
}
// Función para generar un token aleatorio
function generateRandomToken() {
  return crypto.randomUUID();
}

// Función para verificar si el correo existe en Firestore
async function checkIfEmailExists(email) {
  try {
    const usersRef = db.collection('users');
    const query = usersRef.where('email', '==', email).limit(1);
    const snapshot = await query.get();
    return !snapshot.empty;
  } catch (error) {
    console.error("Error verifying the email:", error);
    return false;
  }
}

// Función para enviar el enlace mágico
// Función para obtener la URL base según el entorno
function getBaseUrl() {
  // Si estás en localhost (desarrollo)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://${window.location.hostname}:${window.location.port}`;
  }
  // Si estás en GitHub Pages (producción)
  else if (window.location.hostname.includes('github.io')) {
    return 'https://most-improve123.github.io/LIMPPL';
  }
  // Para otros dominios (Render, Vercel, etc.)
  else {
    return `https://${window.location.hostname}`;
  }
}

// Función para enviar el enlace mágico (actualizada)
async function sendMagicLink() {
  const email = document.getElementById('magic-link-email').value;
  if (!email) {
    showToast('error', 'Email required', 'Please enter your email address.');
    return;
  }

  // Deshabilitar el botón para evitar múltiples clics
  const sendButton = document.querySelector('#magic-link-modal .btn-primary');
  sendButton.disabled = true;
  sendButton.textContent = 'Checking...';

  try {
    showLoading();

    // Verificar si el correo existe en Firestore
    const emailExists = await checkIfEmailExists(email);

    if (!emailExists) {
      showToast('error', 'Unregistered email', 'The email is not registered. Please register first.');
      return;
    }

    sendButton.textContent = 'Sending...';
    const token = generateRandomToken();
    localStorage.setItem('magicLinkToken', token);
    localStorage.setItem('magicLinkEmail', email);

    // Generar el enlace mágico con la URL base correcta
    const baseUrl = getBaseUrl();
    const magicLink = `${baseUrl}/login.html?token=${token}&email=${encodeURIComponent(email)}`;

    await sendBrevoMagicLinkEmail(email, magicLink);
    showToast('success', 'Link sent', 'Check your email to log in.');
    document.getElementById('magic-link-modal').classList.add('hidden');
  } catch (error) {
    console.error("Error sending the magic link:", error);
    showToast('error', 'Error', error.message);
  } finally {
    hideLoading();
    // Volver a habilitar el botón
    sendButton.disabled = false;
    sendButton.textContent = 'Send magic link';
  }
}
// Función para enviar el correo con Brevo
async function sendBrevoMagicLinkEmail(email, magicLink) {
  try {
    const response = await fetch('https://wespark-backend.onrender.com/send-magic-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, magicLink }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Error sending the email.');
    }
    console.log("Email sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error sending the email:", error);
    throw error;
  }
}
// Manejo del modal de enlace mágico y recuperación de contraseña
document.addEventListener('DOMContentLoaded', function() {
  // Modal de recuperación de contraseña
  const forgotPasswordLink = document.getElementById('forgot-password-link');
  const modal = document.getElementById('forgot-password-modal');
  const closeModal = document.querySelector('.close-modal');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', function(e) {
      e.preventDefault();
      modal.classList.remove('hidden');
    });
  }
  if (closeModal) {
    closeModal.addEventListener('click', function() {
      modal.classList.add('hidden');
    });
  }
  // Modal de enlace mágico
  const magicLinkRequest = document.getElementById('magic-link-request');
  const magicLinkModal = document.getElementById('magic-link-modal');
  const closeMagicLinkModal = magicLinkModal.querySelector('.close-modal');
  if (magicLinkRequest) {
    magicLinkRequest.addEventListener('click', function(e) {
      e.preventDefault();
      magicLinkModal.classList.remove('hidden');
    });
  }
  if (closeMagicLinkModal) {
    closeMagicLinkModal.addEventListener('click', function() {
      magicLinkModal.classList.add('hidden');
    });
  }
  // Verifica si hay un token en la URL al cargar la página
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const email = urlParams.get('email');
  console.log('Token en URL:', token);
  console.log('Email en URL:', email);
  if (token && email) {
    const storedToken = localStorage.getItem('magicLinkToken');
    const storedEmail = localStorage.getItem('magicLinkEmail');
    console.log('Token almacenado:', storedToken);
    console.log('Email almacenado:', storedEmail);
    if (token === storedToken && email === storedEmail) {
      console.log('Token y email coinciden. Guardando datos en localStorage...');

      // Obtener el rol del usuario desde Firestore
      const usersRef = db.collection('users');
      const query = usersRef.where('email', '==', email).limit(1);

      query.get().then((querySnapshot) => {
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          localStorage.setItem('userName', email.split('@')[0]);
          localStorage.setItem('userRole', userData.role);

          // Generar un UID simulado para mantener compatibilidad con prueba.js
          const simulatedUID = 'brevo-' + email.split('@')[0] + '-' + Date.now();
          localStorage.setItem('userUID', simulatedUID);
        } else {
          localStorage.setItem('userName', email.split('@')[0]);
          localStorage.setItem('userRole', 'graduate');

          // Generar un UID simulado para mantener compatibilidad con prueba.js
          const simulatedUID = 'brevo-' + email.split('@')[0] + '-' + Date.now();
          localStorage.setItem('userUID', simulatedUID);
        }

        showToast('success', 'Successful login', 'Welcome!');
        setTimeout(() => {
          window.location.href = 'prueba.html';
        }, 2000);
      }).catch((error) => {
        console.error("Error al obtener el rol del usuario:", error);

        // Si hay un error, asigna valores por defecto
        localStorage.setItem('userName', email.split('@')[0]);
        localStorage.setItem('userRole', 'graduate');

        // Generar un UID simulado para mantener compatibilidad con prueba.js
        const simulatedUID = 'brevo-' + email.split('@')[0] + '-' + Date.now();
        localStorage.setItem('userUID', simulatedUID);

        showToast('success', 'Successful login', 'Welcome!');
        setTimeout(() => {
          window.location.href = 'prueba.html';
        }, 2000);
      });
    } else {
      console.log('Token o email no coinciden.');
      showToast('error', 'Invalid link', 'The magic link is not valid or has expired.');
    }
  }
});
// Función para enviar el correo de recuperación de contraseña
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
    .catch((error) => {
      console.error("Error sending the recovery email:", error);
      showToast('error', 'Error', error.message);
    });
}
// Función para mostrar mensajes toast
function showToast(type, title, description = '') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.error("Toast container not found");
    return;
  }
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
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
}
// Manejo del formulario de login
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(() => {
      return auth.signInWithEmailAndPassword(email, password);
    })
    .then(async (userCredential) => {
      const user = userCredential.user;
      console.log("UID del usuario autenticado:", user.uid);
      localStorage.setItem('userUID', user.uid);
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        localStorage.setItem('userName', userData.name);
        localStorage.setItem('userRole', userData.role);
      }
      showToast('success', 'Login successful!', 'Welcome back.');
      setTimeout(() => {
        window.location.href = 'prueba.html';
      }, 2000);
    })
    .catch((error) => {
      console.error("Error signing in: ", error);
      showToast('error', 'Login error', error.message);
    });
});
