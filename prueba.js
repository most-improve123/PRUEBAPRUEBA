// Variables globales
let coursesCache = JSON.parse(localStorage.getItem('coursesCache')) || [];
let certificatesCache = [];
let usersCache = JSON.parse(localStorage.getItem('usersCache')) || [];
let adminStatsCache = {};
let adminCertificatesCache = [];
let currentView = 'graduate';
let currentCourseId = null;
let currentImageFile = null;
let currentUserId = null;


// Función para cerrar sesión
function logout() {
  auth.signOut().then(() => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = 'login.html';
  }).catch((error) => {
    console.error("Error al cerrar sesión:", error);
  });
}

// Función para cargar usuarios desde Firestore
async function loadUsers() {
  try {
    const usersSnapshot = await dbUsers.collection('users').get();
    usersCache = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log("Usuarios cargados desde Firestore:", usersCache);
  } catch (error) {
    console.error("Error al cargar usuarios desde Firestore:", error);
    usersCache = [];
  }
}

// Función para guardar los cursos en localStorage
function saveCoursesToLocalStorage() {
  localStorage.setItem('coursesCache', JSON.stringify(coursesCache));
}

// Función para cargar los cursos desde localStorage
function loadCoursesFromLocalStorage() {
  const savedCourses = localStorage.getItem('coursesCache');
  if (savedCourses) {
    coursesCache = JSON.parse(savedCourses);
  }
}

// Función para generar un ID único
function generateUniqueId() {
  return 'WS-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

// Función para generar un hash
async function generateHash(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Función para guardar información del certificado en Firestore
async function saveCertificateToFirestore(id, nombre, curso, fecha, hashHex) {
  try {
    const fechaActual = new Date().toISOString().split('T')[0];
    await dbCertificates.collection('certificates').add({
      id: id,
      nombre: nombre,
      curso: curso,
      fecha: fechaActual,
      hash: hashHex,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log("Certificado guardado con éxito en Firestore");
  } catch (error) {
    console.error("Error al guardar el certificado en Firestore:", error);
    if (error.code === "permission-denied") {
      alert("No tienes permisos para guardar el certificado. Por favor, contacta al administrador.");
    } else {
      alert("Error al guardar el certificado. Por favor, inténtalo de nuevo más tarde.");
    }
  }
}

// Función para generar el enlace del código QR
function generateQRCodeLink(id) {
  return 'https://static.wixstatic.com/media/a687f1_d41ce5e63188472fbf07f5d14db3c63e~mv2.png';
}

// Función para generar PDF individual
async function generarPDFIndividual(nombre, curso, fecha, id, hashHex) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4' });
  const robotoRegularUrl = 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf';
  const robotoBoldUrl = 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf';
  const loadAndRegisterFont = async (url, fontName, fontStyle) => {
    const response = await fetch(url);
    const fontData = await response.arrayBuffer();
    
    const base64Font = btoa(
      new Uint8Array(fontData).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
    doc.addFileToVFS(`${fontName}.ttf`, base64Font);
    doc.addFont(`${fontName}.ttf`, fontName, fontStyle);
  };
  
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };
  try {
    await loadAndRegisterFont(robotoRegularUrl, 'Roboto', 'normal');
    await loadAndRegisterFont(robotoBoldUrl, 'Roboto', 'bold');
    const fondoURL = 'https://static.wixstatic.com/media/a687f1_6daa751a4aac4a418038ae37f20db004~mv2.jpg';
    const fondo = await loadImage(fondoURL);
    const qrUrl = generateQRCodeLink(id);
    const qrImage = await loadImage(qrUrl);
    doc.addImage(fondo, 'JPEG', 0, 0, 850, 595);
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(37);
    doc.setTextColor(0, 0, 0);
    doc.text(`${curso}`, 425, 130, { align: 'center' });
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(35);
    doc.setTextColor(255, 255, 255);
    doc.text(`${nombre}`, 425, 190, { align: 'center' });
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    const text = "WeSpark certifies that you have completed our future-ready learning experience designed to build practical";
    doc.text(doc.splitTextToSize(text, 700), 80, 250);
    const text1 = "skills for real-world impact. This certificate celebrates your participation in our interactive, innovation-focused";
    doc.text(doc.splitTextToSize(text1, 700), 80, 270);
    doc.text("training. Now go out there and release your inner genius!", 260, 290);
    const fechaActual = new Date();
    const dia = String(fechaActual.getDate()).padStart(2, '0');
    const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
    const anio = fechaActual.getFullYear();
    const fechaFormateada = `${dia}.${mes}.${anio}`;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(`San Salvador, ${fechaFormateada}`, 340, 320);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`ID: ${id}`, 4, 15);
    doc.text(`Hash: ${hashHex}`, 263, 585);
    doc.addImage(qrImage, 'PNG', 124, 460, 100, 100);
    return doc.output('blob');
  } catch (error) {
    console.error("Error al generar PDF:", error);
    alert(`⚠️ Error al generar el PDF para ${nombre}`);
    throw error;
  }
}

// Función para descargar certificado
async function downloadCertificate(certificateId) {
    showLoading();
    try {
        const certificate = certificatesCache.find(cert => cert.id == certificateId);
        if (!certificate) throw new Error('Certificate not found');

        const id = generateUniqueId();
        const hashHex = await generateHash(id);
        const userName = localStorage.getItem('userName') || certificate.nombre;

        // Guardar en Firestore (opcional)
        await saveCertificateToFirestore(id, userName, certificate.course.title, certificate.completionDate, hashHex);

        // Construir la URL para download.html
        const baseUrl = 'https://wespark-download.onrender.com/download.html';
        const params = new URLSearchParams();
        params.append('id', id);
        params.append('nombre', userName);
        params.append('curso', certificate.course.title);
        params.append('fecha', certificate.completionDate);
        params.append('hashHex', hashHex);

        const downloadUrl = `${baseUrl}?${params.toString()}`;

        // Abrir en una nueva pestaña (fuera del iframe de Wix)
        window.open(downloadUrl, '_blank');

    } catch (error) {
        console.error('Download error:', error);
        showToast('error', 'Download Failed', 'Failed to prepare certificate. Please try again.');
    } finally {
        hideLoading();
    }
}
// Función para agregar curso
function addCourse() {
  currentCourseId = null;
  currentImageFile = null;
  document.getElementById('course-form-title').textContent = 'Add Course';
  document.getElementById('course-form').reset();
  document.getElementById('course-image-preview').style.display = 'none';
  document.getElementById('course-form-container').classList.remove('hidden');
  loadUsersIntoCourseForm();
}

// Función para editar curso
function editCourse(courseId) {
  const course = coursesCache.find(c => c.id === courseId);
  if (course) {
    currentCourseId = courseId;
    currentImageFile = null;
    document.getElementById('course-form-title').textContent = 'Edit Course';
    document.getElementById('course-title').value = course.title;
    document.getElementById('course-description').value = course.description;
    document.getElementById('course-duration').value = course.duration;
    const savedImageUrl = localStorage.getItem(`courseImage_${courseId}`);
    if (savedImageUrl) {
      document.getElementById('course-image-preview').src = savedImageUrl;
      document.getElementById('course-image-preview').style.display = 'block';
    } else {
      document.getElementById('course-image-preview').style.display = 'none';
    }
    loadUsersIntoCourseForm();
    if (course.users) {
      course.users.forEach(userId => {
        const checkbox = document.querySelector(`#course-users-checkboxes input[value="${userId}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }
    document.getElementById('course-form-container').classList.remove('hidden');
  }
}

async function uploadImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Image = e.target.result;
      resolve(base64Image);
    };
    reader.readAsDataURL(file);
  });
}

// Función para eliminar curso
function deleteCourse(courseId) {
  localStorage.removeItem(`courseImage_${courseId}`);
  coursesCache = coursesCache.filter(course => course.id !== courseId);
  saveCoursesToLocalStorage();
  displayCoursesTable();
}

// Función para mostrar formulario de usuario
// Función para mostrar formulario de usuario (modificada para guardar en Firestore)
function showUserForm(userId = null) {
  currentUserId = userId;
  const formTitle = document.getElementById('user-form-title');
  const formContainer = document.getElementById('user-form-container');
  const form = document.getElementById('user-form');

  if (!form || !formContainer) {
    console.error("El formulario de usuarios no se encontró en el DOM.");
    return;
  }

  form.reset();

  if (userId !== null) {
    // Modo edición: cargar datos del usuario
    const user = usersCache.find(u => u.id === userId);
    if (user) {
      document.getElementById('user-name').value = user.name || '';
      document.getElementById('user-email').value = user.email || '';
      document.getElementById('user-role').value = user.role || 'graduate';
      formTitle.textContent = 'Edit User';
    } else {
      console.error(`User with ID ${userId} not found.`);
      showToast('error', 'User Not Found', 'The user you are trying to edit does not exist.');
      return;
    }
  } else {
    formTitle.textContent = 'Add User';
  }

  formContainer.classList.remove('hidden');

  form.onsubmit = async function(e) {
    e.preventDefault();
    const nameInput = form.querySelector('#user-name');
    const emailInput = form.querySelector('#user-email');
    const roleInput = form.querySelector('#user-role');

    if (!nameInput || !emailInput || !roleInput) {
      console.error("Uno o más elementos del formulario no se encontraron.");
      showToast('error', 'Form Error', 'Form elements not found.');
      return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const role = roleInput.value;

    if (!name || !email) {
      showToast('error', 'Invalid Data', 'Name and email are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('error', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      showLoading();

      if (currentUserId !== null) {
        // Modo edición: actualizar usuario en Firestore
        await dbUsers.collection('users').doc(currentUserId).update({
          name: name,
          email: email,
          role: role,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('success', 'User Updated', 'The user has been updated successfully.');

        // Actualizar usersCache
        usersCache = usersCache.map(user => {
          if (user.id === currentUserId) {
            return { id: currentUserId, name, email, role };
          }
          return user;
        });

      } else {
        // Modo creación: verificar si el email ya existe
        const usersRef = dbUsers.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (!snapshot.empty) {
          showToast('error', 'Email in Use', 'This email is already registered.');
          return;
        }

        // Crear usuario en Firestore (sin autenticación, solo datos)
        const newUserRef = await dbUsers.collection('users').add({
          name: name,
          email: email,
          role: role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Añadir a usersCache con el ID generado por Firestore
        usersCache.push({
          id: newUserRef.id,
          name: name,
          email: email,
          role: role
        });

        showToast('success', 'User Created', 'The user has been created successfully.');
      }

      // Guardar en localStorage (opcional, para compatibilidad con tu código actual)
      localStorage.setItem('usersCache', JSON.stringify(usersCache));

      // Actualizar la tabla
      displayUsersTable();
      hideUserForm();

    } catch (error) {
      console.error("Error saving user:", error);
      showToast('error', 'Error', 'Failed to save user. Check console for details.');
    } finally {
      hideLoading();
    }
  };
}

// Función para ocultar formulario de usuario
function hideUserForm() {
  document.getElementById('user-form-container').classList.add('hidden');
}

// Función para validar usuarios
function validateUsers() {
  usersCache = usersCache.map(user => {
    if (!user.id) user.id = Math.floor(Math.random() * 1000000);
    if (!user.name) user.name = 'Unknown';
    if (!user.email) user.email = 'unknown@example.com';
    if (!user.role) user.role = 'graduate';
    if (!user.createdAt) user.createdAt = new Date().toISOString();
    return user;
  });
  localStorage.setItem('usersCache', JSON.stringify(usersCache));
}

// Función para cargar usuarios desde localStorage
function loadUsersFromLocalStorage() {
  const savedUsers = localStorage.getItem('usersCache');
  if (savedUsers) {
    usersCache = JSON.parse(savedUsers);
  } else {
    usersCache = [];
  }
  validateUsers();
}

// Función para eliminar usuario
async function deleteUser(userId) {
  const isConfirmed = confirm("Are you sure you want to delete this user? This action cannot be undone.");
  if (!isConfirmed) return;

  try {
    showLoading();
    // 1. Eliminar en Firestore
    await dbUsers.collection('users').doc(userId).delete();

    // 2. Eliminar en Firebase Authentication
    // Solo funciona si el usuario actual es administrador y tiene permisos
    // (No es seguro hacerlo desde el frontend en producción)
    await auth.currentUser.delete(); // Esto eliminaría al usuario actual, no al usuario con userId
    // Para eliminar a otro usuario, necesitas Firebase Admin SDK en un backend
    // Alternativa: Usar una función de Firebase (Cloud Function) para eliminar al usuario

    // 3. Eliminar de usersCache
    usersCache = usersCache.filter(user => user.id !== userId);

    showToast('success', 'User Deleted', 'The user has been deleted successfully.');
    displayUsersTable();
  } catch (error) {
    console.error("Error deleting user:", error);
    showToast('error', 'Error', 'Failed to delete user. Check console for details.');
  } finally {
    hideLoading();
  }
}

// Función para cancelar formulario de curso
function cancelCourseForm() {
  document.getElementById('course-form-container').classList.add('hidden');
}

// Función para mostrar tabla de usuarios
function displayUsersTable(users = usersCache) {
  const container = document.getElementById('users-table-container');
  if (users.length === 0) {
    container.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p>No users found.</p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--neutral-200);">
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Name</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Email</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Role</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Created</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr style="border-bottom: 1px solid var(--neutral-200);">
              <td style="padding: 0.75rem;">${user.name || 'Undefined'}</td>
              <td style="padding: 0.75rem;">${user.email || 'Undefined'}</td>
              <td style="padding: 0.75rem;">
                <span class="badge" style="background-color: ${user.role === 'admin' ? 'var(--purple)' : 'var(--secondary-green)'}; color: white;">
                  ${user.role || 'Undefined'}
                </span>
              </td>
              <td style="padding: 0.75rem;">${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Undefined'}</td>
              <td style="padding: 0.75rem;">
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; margin-right: 0.5rem;" onclick="showUserForm('${user.id}')">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; color: var(--destructive); border-color: var(--destructive);" onclick="showConfirmationToast('${user.id}')">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Función para mostrar tabla de cursos
function displayCoursesTable(courses = coursesCache) {
  const container = document.getElementById('courses-table-container');
  if (courses.length === 0) {
    container.innerHTML = `<div class="text-center" style="padding: 2rem;"><p>No courses found.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--neutral-200);">
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Title</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Description</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Duration</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Users</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Image</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${courses.map(course => {
            const imageSrc = course.image || defaultImageBase64;
            const userCount = course.users ? course.users.length : 0;
            return `
              <tr style="border-bottom: 1px solid var(--neutral-200);">
                <td style="padding: 0.75rem; font-weight: 600;">${course.title}</td>
                <td style="padding: 0.75rem; max-width: 300px;">${course.description}</td>
                <td style="padding: 0.75rem;">${course.duration} hours</td>
                <td style="padding: 0.75rem;">
                  ${userCount > 0 ?
                    `<button class="btn-users-count" onclick="showCourseUsers(${course.id})">${userCount}</button>` :
                    '<span style="color: var(--neutral-600);">None</span>'
                  }
                </td>
                <td style="padding: 0.75rem;">
                  <img
                    src="${imageSrc}"
                    alt="${course.title}"
                    style="width: 50px; height: auto; max-height: 50px;"
                    onerror="this.src='${defaultImageBase64}';"
                  >
                </td>
                <td style="padding: 0.75rem;">
                  <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; margin-right: 0.5rem;" onclick="editCourse(${course.id})">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; color: var(--destructive); border-color: var(--destructive);" onclick="deleteCourse(${course.id})">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Función para eliminar curso
function deleteCourse(courseId) {
  localStorage.removeItem(`courseImage_${courseId}`);
  coursesCache = coursesCache.filter(course => course.id !== courseId);
  saveCoursesToLocalStorage();
  displayCoursesTable();
}

// Función para cargar usuarios en el formulario de cursos
function loadUsersIntoCourseForm() {
  const container = document.getElementById('course-users-checkboxes');
  container.innerHTML = '';
  usersCache.forEach(user => {
    const checkboxItem = document.createElement('div');
    checkboxItem.className = 'checkbox-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `user-${user.id}`;
    checkbox.value = user.id;
    const label = document.createElement('label');
    label.htmlFor = `user-${user.id}`;
    label.textContent = `${user.name} (${user.email})`;
    checkboxItem.appendChild(checkbox);
    checkboxItem.appendChild(label);
    container.appendChild(checkboxItem);
  });
  if (currentCourseId) {
    const course = coursesCache.find(c => c.id === currentCourseId);
    if (course?.users) {
      course.users.forEach(userId => {
        const checkbox = document.querySelector(`#user-${userId}`);
        if (checkbox) checkbox.checked = true;
      });
    }
  }
}

// Función para mostrar los usuarios del curso en un modal
function showCourseUsers(courseId) {
  const course = coursesCache.find(c => c.id === courseId);
  if (!course) return;

  if (!course.users || course.users.length === 0) {
    showToast('warning', 'No Users', 'This course has no participants.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'course-users-modal';
  modal.innerHTML = `
    <div class="course-users-modal-content">
      <div class="course-users-modal-header">
        <h3>Participants in ${course.title}</h3>
        <button class="course-users-modal-close" onclick="closeCourseUsersModal(this)">&times;</button>
      </div>
      <ul class="course-users-list">
        ${course.users.map(userId => {
          const user = usersCache.find(u => u.id == userId);
          return `<li>${user ? user.name : 'Unknown User'}</li>`;
        }).join('')}
      </ul>
    </div>
  `;
  document.body.appendChild(modal);
}

// Función para cerrar el modal
function closeCourseUsersModal(button) {
  const modal = button.closest('.course-users-modal');
  if (modal) modal.remove();
}

// Función para migrar imágenes de blob a Base64
async function migrateBlobImagesToBase64() {
  for (const course of coursesCache) {
    if (course.image && course.image.startsWith('blob:')) {
      try {
        const response = await fetch(course.image);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        course.image = base64;
      } catch (error) {
        console.error(`Error migrando imagen del curso ${course.id}:`, error);
        course.image = defaultImageBase64;
      }
    }
  }
  saveCoursesToLocalStorage();
}

// Imagen por defecto en Base64
const defaultImageBase64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIiBmaWxsPSJub25lIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyNSIgY3k9IjI1IiByPSIyMCIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjI1IiB5PSIyNSIgZmlsbD0iI2RlZCI+Qy9zdGFnZTwvdGV4dD48L3N2Zz4=";

// Función para mostrar tabla de certificados (admin)
function displayAdminCertificatesTable(certificates = certificatesCache) {
  const container = document.getElementById('certificates-table-container');
  const validCertificates = certificates.filter(cert =>
    cert && cert.id && cert.course && cert.nombre
  );
  if (validCertificates.length === 0) {
    container.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p>No certificates found.</p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--neutral-200);">
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Certificate ID</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Student</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Course</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Completion Date</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${validCertificates.map(cert => {
            const course = coursesCache.find(c => c.id === cert.course.id);
            const courseTitle = course ? course.title : 'Unknown Course';
            // Genera la fecha actual en formato local
            const currentDate = new Date().toLocaleDateString();
            return `
              <tr style="border-bottom: 1px solid var(--neutral-200);">
                <td style="padding: 0.75rem; font-family: monospace; font-weight: 600;">WS-${cert.id}</td>
                <td style="padding: 0.75rem;">${localStorage.getItem('userName') || cert.nombre}</td>
                <td style="padding: 0.75rem;">${courseTitle}</td>
                <td style="padding: 0.75rem;">${currentDate}</td> <!-- Fecha actual -->
                <td style="padding: 0.75rem;">
                  <button class="btn btn-outline" style="padding: 0.25rem 0.5rem;" onclick="downloadCertificate(${cert.id})">
                    <i class="fas fa-download"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Función para cargar datos de administrador
function loadAdminData() {
  showLoading();
  setTimeout(() => {
    const mockStats = { totalUsers: usersCache.length, totalCourses: coursesCache.length, totalCertificates: 25 };
    adminStatsCache = mockStats;
    updateAdminStats(mockStats);
    displayUsersTable();
    displayCoursesTable();
    displayAdminCertificatesTable();
    hideLoading();
  }, 500);
}

// Función para actualizar estadísticas de administrador
function updateAdminStats() {
  // Calcula el total de certificados según la cantidad en certificatesCache
  const totalCertificates = certificatesCache.length;
  document.getElementById('admin-total-users').textContent = usersCache.length || 0;
  document.getElementById('admin-total-courses').textContent = coursesCache.length || 0;
  document.getElementById('admin-total-certificates').textContent = totalCertificates || 0;
}

// Función para mostrar toast de confirmación
let userIdToDelete = null;
function showConfirmationToast(userId) {
  userIdToDelete = userId;
  const container = document.getElementById('confirmation-toast-container');
  container.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = 'toast warning';
  toast.innerHTML = `
    <div class="toast-header">
      <i class="fas fa-exclamation-triangle"></i>
      <div class="toast-title">Confirm Deletion</div>
    </div>
    <div class="toast-description">Are you sure you want to delete this user? This action cannot be undone.</div>
    <div class="toast-actions">
      <button class="btn btn-outline" id="cancel-delete-toast">Cancel</button>
      <button class="btn btn-primary" id="confirm-delete-toast">Delete</button>
    </div>
  `;
  container.appendChild(toast);
  document.getElementById('cancel-delete-toast').addEventListener('click', () => {
    container.innerHTML = '';
    userIdToDelete = null;
  });
  document.getElementById('confirm-delete-toast').addEventListener('click', async () => {
    container.innerHTML = '';
    if (!userIdToDelete) return;
    try {
      showLoading();
      console.log("Intentando eliminar al usuario con ID:", userIdToDelete);
      await dbUsers.collection('users').doc(userIdToDelete).delete();
      showToast('success', 'User Deleted', 'The user has been deleted successfully.');
      usersCache = usersCache.filter(user => user.id !== userIdToDelete);
      displayUsersTable();
    } catch (error) {
      console.error("Error deleting user:", error);
      showToast('error', 'Error', 'Failed to delete user. Check console for details.');
    } finally {
      hideLoading();
      userIdToDelete = null;
    }
  });
}

// Función para inicializar la aplicación
// En prueba.js, dentro de initializeApp()
function initializeApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      console.log("Usuario autenticado:", user.uid);
      localStorage.setItem('userUID', user.uid);
    } else {
      console.log("No hay usuario autenticado.");
    }
  });

  setupNavigation();
  setupTabs();
  setupFileUpload();

  const urlParams = new URLSearchParams(window.location.search);
  const uidFromUrl = urlParams.get('uid');
  const viewParam = urlParams.get('view');

  if (uidFromUrl) {
    localStorage.setItem('userUID', uidFromUrl);
    console.log("UID del usuario desde la URL:", uidFromUrl);
  }

  const userUID = localStorage.getItem('userUID');
  console.log("UID del usuario en localStorage (prueba.js):", userUID);

  if (!userUID) {
    console.error("No se encontró el UID del usuario en localStorage.");
    showToast('error', 'Error', 'No se encontró el UID del usuario. Por favor, inicia sesión de nuevo.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return;
  }

  const certificateId = urlParams.get('certificateId');
  if (certificateId) {
    showView('verifier');
    document.getElementById('certificate-id').value = certificateId;
    setTimeout(() => verifyCertificate(), 100);
  }

  // Cargar el nombre del usuario en el header
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');
  const userInfoSpan = document.querySelector('.user-info span');

  if (userName && userInfoSpan) {
    userInfoSpan.textContent = userName;
  } else if (userInfoSpan) {
    userInfoSpan.textContent = 'User';
  }

  // Ocultar/mostrar pestañas según el rol del usuario
  const adminBtns = document.querySelectorAll('.nav-btn[data-view="admin"], .mobile-nav-btn[data-view="admin"]');
  const graduateBtns = document.querySelectorAll('.nav-btn[data-view="graduate"], .mobile-nav-btn[data-view="graduate"]');
  const verifierBtns = document.querySelectorAll('.nav-btn[data-view="verifier"], .mobile-nav-btn[data-view="verifier"]');

  if (userRole === 'admin') {
    // Para admin: ocultar pestañas de graduate y verifier
    graduateBtns.forEach(btn => btn.style.display = 'none');
    verifierBtns.forEach(btn => btn.style.display = 'none');
    // Mostrar vista de admin por defecto
    if (viewParam) {
      showView(viewParam);
    } else {
      showView('admin');
    }
  } else if (userRole === 'graduate') {
    // Para graduate: ocultar pestaña de admin
    adminBtns.forEach(btn => btn.style.display = 'none');
    // Mostrar vista de graduate por defecto
    if (viewParam) {
      showView(viewParam);
    } else {
      showView('graduate');
    }
  } else {
    // Rol no reconocido: mostrar solo graduate por defecto
    adminBtns.forEach(btn => btn.style.display = 'none');
    if (viewParam) {
      showView(viewParam);
    } else {
      showView('graduate');
    }
  }

  loadInitialData();
}

// Función para configurar navegación
function setupNavigation() {
  showView('graduate');
}

// Función para mostrar vista
// Función para mostrar la vista correspondiente (admin, graduate, verifier)
function showView(viewName) {
  // Ocultar todas las vistas
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  // Mostrar la vista seleccionada
  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Actualizar los botones de navegación
  document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Cargar datos según la vista
  loadViewData(viewName);

  // Scroll al inicio de la página
  window.scrollTo(0, 0);
}

// Función para cargar datos de vista
function loadViewData(viewName) {
  switch(viewName) {
    case 'graduate':
      loadGraduateData();
      break;
    case 'verifier':
      break;
    case 'admin':
      loadAdminData();
      break;
  }
}

// Función para cargar datos de graduado
function loadGraduateData() {
  showLoading();
  setTimeout(() => {
    const mockCertificates = coursesCache.map(course => ({
      id: course.id,
      nombre: 'John Doe',
      certificateId: `WS-2025-${course.id.toString().padStart(3, '0')}`,
      completionDate: '2023-01-15',
      course: course
    }));
    certificatesCache = mockCertificates;
    displayCertificates(mockCertificates);
    updateGraduateStats(mockCertificates);
    hideLoading();
  }, 500);
}

// Función para mostrar certificados
function displayCertificates(certificates = certificatesCache) {
  const grid = document.getElementById('certificates-grid');
  if (!certificates || certificates.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <i class="fas fa-tag" style="font-size: 3rem; color: var(--neutral-400); margin-bottom: 1rem;"></i>
        <h3 style="color: var(--neutral-800); margin-bottom: 0.5rem;">No certificates yet</h3>
        <p style="color: var(--neutral-600);">Complete a course to earn your first certificate!</p>
      </div>
    `;
    return;
  }
  grid.innerHTML = certificates.map(cert => createCertificateCard(cert)).join('');
}

// Función para crear tarjeta de certificado
function createCertificateCard(certificate) {
  const completionDate = new Date(certificate.completionDate).toLocaleDateString();
  const courseThumbnail = certificate.course?.image;
  const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(certificate.course.title)}&organizationId=13993759&issueYear=2025&issueMonth=6&certUrl=https://l3v145431.github.io/Verificate.github.io/&certificateUrl=${encodeURIComponent(window.location.href)}&certificateId=${encodeURIComponent(certificate.id)}`;
  return `
    <div class="certificate-card">
      ${courseThumbnail ? `
        <div class="certificate-thumbnail">
          <img src="${courseThumbnail}" alt="${certificate.course.title}" onerror="this.parentElement.style.display='none'">
        </div>
      ` : ''}
      <div class="certificate-body">
        <div class="certificate-header-content">
          <div class="certificate-icon-wrapper"></div>
          <div class="badge">Completed</div>
        </div>
        <h3 class="certificate-title">${certificate.course.title}</h3>
        <p class="certificate-description">${certificate.course.description}</p>
        <div class="certificate-meta">
          <span>Completed: ${completionDate}</span>
          <span>${certificate.course.duration} hours</span>
        </div>
        <div class="certificate-actions">
          <button class="btn btn-primary" onclick="downloadCertificate(${certificate.id})">
            <i class="fas fa-download"></i> Download PDF
          </button>
          <a href="${linkedInUrl}" target="_blank" class="btn btn-linkedin">
            <i class="fab fa-linkedin"></i> Add to LinkedIn
          </a>
        </div>
      </div>
    </div>
  `;
}

// Función para actualizar estadísticas de graduado
function updateGraduateStats(certificates) {
  const totalCertificates = certificates?.length || 0;
  const totalHours = certificates?.reduce((sum, cert) => sum + cert.course.duration, 0) || 0;
  document.getElementById('total-certificates').textContent = totalCertificates;
  document.getElementById('total-hours').textContent = totalHours;
}

// Función para verificar certificado
// Función para verificar certificado
async function verifyCertificate(certificateId = null) {
  let idToVerify = certificateId;
  if (!idToVerify) {
    idToVerify = document.getElementById('certificate-id').value.trim();
  }
  if (!idToVerify) {
    showToast('error', 'Certificate ID Required', 'Please enter a certificate ID or hash to verify.');
    return;
  }
  const btnText = document.querySelector('.verify-btn-text');
  const btnSpinner = document.querySelector('.verify-btn-spinner');
  if (btnText && btnSpinner) { // Validar que existan
    btnText.classList.add('hidden');
    btnSpinner.classList.add('active');
  }
  try {
    const certificatesRef = dbCertificates.collection('certificates');
    const snapshotById = await certificatesRef.where('id', '==', idToVerify).get();
    const snapshotByHash = await certificatesRef.where('hash', '==', idToVerify).get();
    if (snapshotById.empty && snapshotByHash.empty) {
      displayVerificationError();
      showToast('error', 'Certificate Not Found', 'The certificate ID or hash was not found in our system.');
      return;
    }
    let certificateData;
    if (!snapshotById.empty) {
      snapshotById.forEach(doc => {
        certificateData = doc.data();
      });
    } else {
      snapshotByHash.forEach(doc => {
        certificateData = doc.data();
      });
    }
    displayVerificationResult(certificateData);
    showToast('success', 'Certificate Verified', 'This certificate is valid and authentic.');
  } catch (error) {
    console.error("Error verifying certificate: ", error);
    showToast('error', 'Verification Failed', 'An error occurred while verifying the certificate.');
  } finally {
    if (btnText && btnSpinner) { // Validar que existan
      btnText.classList.remove('hidden');
      btnSpinner.classList.remove('active');
    }
  }
}

// Función para mostrar resultado de verificación
function displayVerificationResult(certificate) {
  const resultContainer = document.getElementById('verification-result');
  const completionDate = certificate.fecha ? new Date(certificate.fecha).toLocaleDateString() : 'N/A';
  resultContainer.innerHTML = `
    <div class="verification-result">
      <div class="verification-success">
        <div class="verification-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <h2>Certificate Verified</h2>
        <p>This certificate is valid and authentic</p>
      </div>
      <div class="certificate-details">
        <div class="certificate-preview">
          <div class="certificate-preview-header">
            <div class="certificate-preview-user">
              <div class="certificate-preview-avatar">
                <i class="fas fa-graduation-cap"></i>
              </div>
              <div class="certificate-preview-info">
                <h3>${certificate.nombre || 'N/A'}</h3>
                <p>Certificate Holder</p>
              </div>
            </div>
          </div>
          <div class="certificate-data">
            <div class="data-row">
              <span class="data-label">Certificate ID</span>
              <span class="data-value">${certificate.id || 'N/A'}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Course</span>
              <span class="data-value">${certificate.curso || 'N/A'}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Completion Date</span>
              <span class="data-value">${completionDate}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Status</span>
              <span class="data-value" style="color: var(--secondary-green);">
                <i class="fas fa-shield-alt"></i> Verified
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  resultContainer.classList.remove('hidden');
}

// Función para mostrar error de verificación
function displayVerificationError() {
  const resultContainer = document.getElementById('verification-result');
  resultContainer.innerHTML = `
    <div class="verification-result">
      <div class="verification-success">
        <div class="verification-icon" style="background-color: var(--destructive); background-opacity: 0.1;">
          <i class="fas fa-times-circle" style="color: var(--destructive);"></i>
        </div>
        <h2 style="color: var(--destructive);">Certificate Not Found</h2>
        <p>The certificate ID or hash was not found in our system. Please check the ID or hash and try again.</p>
      </div>
    </div>
  `;
  resultContainer.classList.remove('hidden');
}

// Función para configurar pestañas
function setupTabs() {
  document.querySelectorAll('.tab-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      showTab(tabName);
    });
  });
}

// Función para mostrar pestaña
function showTab(tabName) {
  document.querySelectorAll('.tab-trigger').forEach(trigger => {
    trigger.classList.toggle('active', trigger.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
  loadTabData(tabName);
}

// Función para cargar datos de pestaña
function loadTabData(tabName) {
  switch(tabName) {
    case 'users':
      displayUsersTable();
      break;
    case 'courses':
      displayCoursesTable();
      break;
    case 'certificates':
      displayAdminCertificatesTable();
      break;
  }
}

// Función para configurar carga de archivos
function setupFileUpload() {
  const uploadArea = document.getElementById('file-upload-area');
  const fileInput = document.getElementById('csv-file');
  const importBtn = document.getElementById('import-btn');
  if (!uploadArea || !fileInput) return;
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--primary)';
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--neutral-200)';
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--neutral-200)';
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'text/csv') {
      handleFileSelection(files[0]);
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });
}

// Función para manejar selección de archivo
function handleFileSelection(file) {
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const uploadArea = document.getElementById('file-upload-area');
  const importBtn = document.getElementById('import-btn');
  fileName.textContent = file.name;
  uploadArea.style.display = 'none';
  fileInfo.classList.remove('hidden');
  importBtn.disabled = false;
}

// Función para limpiar archivo
function clearFile() {
  const fileInfo = document.getElementById('file-info');
  const uploadArea = document.getElementById('file-upload-area');
  const importBtn = document.getElementById('import-btn');
  const fileInput = document.getElementById('csv-file');
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  uploadArea.style.display = 'block';
  importBtn.disabled = true;
}

// Función para importar CSV
async function importCsv() {
  const fileInput = document.getElementById('csv-file');
  const file = fileInput.files[0];
  if (!file) {
    showToast('error', 'No File Selected', 'Please select a CSV file to import.');
    return;
  }
  showLoading();
  try {
    const results = await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: resolve,
        error: reject
      });
    });
    const data = results.data;
    const zip = new JSZip();
    const defaultDate = '2025-07-01';
    for (const row of data) {
      let { nombre, curso, fecha } = row;
      if (!fecha) {
        fecha = defaultDate;
        console.warn(`La fecha no estaba definida para ${nombre}, se asignó la fecha por defecto: ${defaultDate}`);
      }
      const id = generateUniqueId();
      const hashHex = await generateHash(id);
      const pdfBlob = await generarPDFIndividual(nombre, curso, fecha, id, hashHex);
      await saveCertificateToFirestore(id, nombre, curso, fecha, hashHex);
      zip.file(`certificado_${id}.pdf`, pdfBlob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'certificados.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('success', 'Certificates Generated', 'The certificates have been generated and downloaded successfully.');
  } catch (error) {
    console.error('Error importing CSV:', error);
    showToast('error', 'Import Failed', 'An error occurred while importing the CSV file.');
  } finally {
    hideLoading();
    clearFile();
  }
}

// Función para mostrar loading
function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

// Función para ocultar loading
function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

// Función para mostrar toast
function showToast(type, title, description = '') {
  const container = document.getElementById('toast-container');
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

// Función para cargar datos iniciales
function loadInitialData() {
  loadGraduateData();
}

// Función para filtrar usuarios según el término de búsqueda
function filterUsersTable(searchTerm) {
  const term = searchTerm.toLowerCase();
  const filteredUsers = usersCache.filter(user =>
    user.name.toLowerCase().includes(term) ||
    user.email.toLowerCase().includes(term) ||
    user.role.toLowerCase().includes(term)
  );
  displayUsersTable(filteredUsers);
}

// Función para filtrar cursos según el término de búsqueda
function filterCoursesTable(searchTerm) {
  const term = searchTerm.toLowerCase();
  const filteredCourses = coursesCache.filter(course =>
    course.title.toLowerCase().includes(term) ||
    course.description.toLowerCase().includes(term) ||
    course.duration.toString().includes(term)
  );
  displayCoursesTable(filteredCourses);
}

function filterCertificatesTable(searchTerm) {
  const term = searchTerm.toLowerCase();
  const filteredCertificates = certificatesCache.filter(cert => {
    // Asegúrate de que el ID del certificado incluya "ws-" al comparar
    const certId = cert.id ? `ws-${String(cert.id).toLowerCase()}` : '';
    const idMatch = certId.includes(term);
    return idMatch;
  });
  displayAdminCertificatesTable(filteredCertificates);
}


// Función para configurar event listeners
function setupEventListeners() {
  document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.target.dataset.view;
      if (view) showView(view);
    });
  });
  const certInput = document.getElementById('certificate-id');
  if (certInput) {
    certInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        verifyCertificate();
      }
    });
  }
  document.addEventListener('input', (e) => {
    if (e.target.id === 'users-search') {
      filterUsersTable(e.target.value);
    } else if (e.target.id === 'courses-search') {
      filterCoursesTable(e.target.value);
    } else if (e.target.id === 'certificates-search') {
      filterCertificatesTable(e.target.value);
    }
  });
}

// Evento DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
  await loadUsers(); // Espera a que los usuarios se carguen
  loadCoursesFromLocalStorage();
  displayUsersTable();
  displayCoursesTable(); // Ahora usersCache está cargado

  const courseForm = document.getElementById('course-form');
  if (courseForm) {
    courseForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const title = document.getElementById('course-title').value;
      const description = document.getElementById('course-description').value;
      const duration = parseInt(document.getElementById('course-duration').value);
      const checkboxes = document.querySelectorAll('#course-users-checkboxes input[type="checkbox"]:checked');
      const selectedUsers = Array.from(checkboxes).map(checkbox => checkbox.value);
      const imageInput = document.getElementById('course-image');
      let imageBase64 = '';

      if (imageInput.files.length > 0) {
        const file = imageInput.files[0];
        imageBase64 = await uploadImage(file);
      } else if (currentCourseId) {
        const course = coursesCache.find(c => c.id === currentCourseId);
        if (course) {
          imageBase64 = course.image || '';
        }
      }

      if (currentCourseId) {
        // Editar curso existente
        coursesCache = coursesCache.map(c => {
          if (c.id === currentCourseId) {
            return {
              ...c,
              title,
              description,
              duration,
              image: imageBase64,
              users: selectedUsers // Guardar los usuarios seleccionados
            };
          }
          return c;
        });
      } else {
        // Crear nuevo curso
        const newId = coursesCache.length > 0 ? Math.max(...coursesCache.map(c => c.id)) + 1 : 1;
        coursesCache.push({
          id: newId,
          title,
          description,
          duration,
          image: imageBase64,
          users: selectedUsers // Guardar los usuarios seleccionados
        });
      }

      saveCoursesToLocalStorage();
      displayCoursesTable();
      loadGraduateData();
      document.getElementById('course-form-container').classList.add('hidden');
    });
  } else {
    console.error('Course form not found in the DOM.');
  }

  initializeApp();
  setupEventListeners();

  const userName = localStorage.getItem('userName');
  const logoutButton = document.querySelector('.logout-btn');
  if (!userName) {
    if (logoutButton) logoutButton.style.display = 'none';
  } else {
    document.querySelector('.user-info span').textContent = userName;
  }

  const userRole = localStorage.getItem('userRole');
  const adminBtns = document.querySelectorAll('.nav-btn[data-view="admin"], .mobile-nav-btn[data-view="admin"]');
  const graduateBtns = document.querySelectorAll('.nav-btn[data-view="graduate"], .mobile-nav-btn[data-view="graduate"]');
  const verifierBtns = document.querySelectorAll('.nav-btn[data-view="verifier"], .mobile-nav-btn[data-view="verifier"]');
  if (viewParam) {
    showView(viewParam); // Mostrar la vista especificada en la URL (admin o graduate)
  } else if (userRole === 'admin') {
    showView('admin'); // Mostrar panel de admin si el rol es admin
  } else {
    showView('graduate'); // Mostrar panel de graduate por defecto
  }

  loadInitialData();
});
