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

// Función para enviar el enlace mágico
async function sendMagicLink() {
  const email = document.getElementById('magic-link-email').value;
  if (!email) {
    showToast('error', 'Correo requerido', 'Por favor ingresa tu correo electrónico.');
    return;
  }
  try {
    showLoading();
    const token = generateRandomToken();
    localStorage.setItem('magicLinkToken', token);
    localStorage.setItem('magicLinkEmail', email);
    console.log('Token guardado en localStorage:', localStorage.getItem('magicLinkToken'));
    console.log('Email guardado en localStorage:', localStorage.getItem('magicLinkEmail'));
    const magicLink = `${window.location.origin}/login.html?token=${token}&email=${encodeURIComponent(email)}`;
    console.log('URL del enlace mágico:', magicLink);
    await sendBrevoMagicLinkEmail(email, magicLink);
    showToast('success', 'Enlace enviado', 'Revisa tu correo para iniciar sesión.');
    document.getElementById('magic-link-modal').classList.add('hidden');
  } catch (error) {
    console.error("Error al enviar el enlace mágico:", error);
    showToast('error', 'Error', error.message);
  } finally {
    hideLoading();
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
      throw new Error(data.error || 'Error al enviar el correo.');
    }

    console.log("Correo enviado con éxito:", data);
    return data;
  } catch (error) {
    console.error("Error al enviar el correo:", error);
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
      console.log('Token y email coinciden. Redirigiendo...');
      showToast('success', 'Inicio de sesión exitoso', '¡Bienvenido!');

      // Obtener el rol del usuario desde Firestore
      const usersRef = db.collection('users');
      const query = usersRef.where('email', '==', email).limit(1);

      query.get().then((querySnapshot) => {
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          localStorage.setItem('userName', email.split('@')[0]);
          localStorage.setItem('userRole', userData.role);
          setTimeout(() => {
            window.location.href = 'prueba.html';
          }, 2000);
        } else {
          localStorage.setItem('userName', email.split('@')[0]);
          localStorage.setItem('userRole', 'graduate');
          setTimeout(() => {
            window.location.href = 'prueba.html';
          }, 2000);
        }
      }).catch((error) => {
        console.error("Error al obtener el rol del usuario:", error);
        localStorage.setItem('userName', email.split('@')[0]);
        localStorage.setItem('userRole', 'graduate');
        setTimeout(() => {
          window.location.href = 'prueba.html';
        }, 2000);
      });
    } else {
      console.log('Token o email no coinciden.');
      showToast('error', 'Enlace inválido', 'El enlace mágico no es válido o ha expirado.');
    }
  }
});

// Función para enviar el correo de recuperación de contraseña
function sendPasswordResetEmail() {
  const email = document.getElementById('recovery-email').value;
  if (!email) {
    showToast('error', 'Correo requerido', 'Por favor ingresa tu correo electrónico.');
    return;
  }
  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast('success', 'Correo enviado', 'Revisa tu bandeja de entrada para restablecer tu contraseña.');
      document.getElementById('forgot-password-modal').classList.add('hidden');
    })
    .catch((error) => {
      console.error("Error al enviar el correo de recuperación:", error);
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
      showToast('success', '¡Inicio de sesión exitoso!', 'Bienvenido de vuelta.');
      setTimeout(() => {
        window.location.href = 'prueba.html';
      }, 2000);
    })
    .catch((error) => {
      console.error("Error signing in: ", error);
      showToast('error', 'Error de inicio de sesión', error.message);
    });
});