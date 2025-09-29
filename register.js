// Configuración de Firebase (existente)
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

// Función para mostrar el loading spinner
function showLoading() {
  let loadingElement = document.getElementById('loading');
  if (!loadingElement) {
    loadingElement = document.createElement('div');
    loadingElement.id = 'loading';
    loadingElement.className = 'loading';
    loadingElement.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingElement);
  }
  loadingElement.classList.remove('hidden');
}

// Función para ocultar el loading spinner
function hideLoading() {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.classList.add('hidden');
  }
}

// Función para mostrar mensajes toast
function showToast(type, title, description = '') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
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
  toastContainer.appendChild(toast);

  // Eliminar el toast después de 5 segundos
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
}

// Manejo del formulario de registro
// Manejo del formulario de registro
document.getElementById('register-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;

  // Validación de contraseña
  if (password.length < 6) {
    showToast('error', 'Registration Failed', 'Password should be at least 6 characters.');
    return;
  }

  showLoading();

  try {
    const usersRef = db.collection('users');

    // Verificar si el correo ya está registrado
    const emailQuery = usersRef.where('email', '==', email).limit(1);
    const emailSnapshot = await emailQuery.get();

    if (!emailSnapshot.empty) {
      showToast('error', 'Email already in use', 'This email is already registered. Please use another email.');
      hideLoading();
      return;
    }

    // Verificar si el nombre ya está registrado
    const nameQuery = usersRef.where('name', '==', name).limit(1);
    const nameSnapshot = await nameQuery.get();

    if (!nameSnapshot.empty) {
      showToast('error', 'Name already in use', 'This name is already registered. Please use another name.');
      hideLoading();
      return;
    }

    // Crear usuario en Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Guardar datos adicionales en Firestore
    await db.collection('users').doc(user.uid).set({
      name: name,
      email: email,
      role: role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('success', 'Registration Successful', 'You have successfully registered. Please sign in.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  } catch (error) {
    console.error("Error signing up:", error);
    showToast('error', 'Registration Failed', error.message);
  } finally {
    hideLoading();
  }
});
