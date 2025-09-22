// Variables globales
let coursesCache = [];
let certificatesCache = [];
let usersCache = JSON.parse(localStorage.getItem('usersCache')) || [];
let adminStatsCache = {};
let adminCertificatesCache = [];
let currentView = 'graduate';
let currentCourseId = null;
let currentImageFile = null;
let currentUserId = null;
const urlParams = new URLSearchParams(window.location.search);
const viewParam = urlParams.get('view');

// Función para generar un token aleatorio (para magic links)
function generateRandomToken() {
  return 'token-' + Math.random().toString(36).substr(2, 9);
}

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

// Función para cargar los cursos desde Firestore
async function loadCoursesFromFirestore() {
  try {
    const coursesSnapshot = await dbUsers.collection('courses').get();
    coursesCache = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    localStorage.setItem('coursesCache', JSON.stringify(coursesCache));
    return coursesCache;
  } catch (error) {
    console.error("Error al cargar cursos desde Firestore:", error);
    showToast('error', 'Error', 'No se pudieron cargar los cursos desde Firestore.');
    const localCourses = localStorage.getItem('coursesCache');
    if (localCourses) {
      coursesCache = JSON.parse(localCourses);
    }
    return coursesCache;
  }
}

// Función para cargar cursos del usuario actual
async function loadUserCourses() {
  try {
    const userUID = localStorage.getItem('userUID');
    if (!userUID) return [];

    const user = usersCache.find(u => u.id === userUID);
    if (!user) return [];

    // Si el usuario no tiene cursos asignados, devolver array vacío
    if (!user.courses || user.courses.length === 0) return [];

    // Filtrar solo los cursos asignados al usuario
    return coursesCache.filter(course => user.courses.includes(course.id));
  } catch (error) {
    console.error("Error al cargar cursos del usuario:", error);
    return [];
  }
}
// Función para generar un ID único
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
    alert(`Error al generar el PDF para ${nombre}`);
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

    await saveCertificateToFirestore(id, userName, certificate.course.title, certificate.completionDate, hashHex);

    const baseUrl = 'https://wespark-download.onrender.com/download.html';
    const params = new URLSearchParams();
    params.append('id', id);
    params.append('nombre', userName);
    params.append('curso', certificate.course.title);
    params.append('fecha', certificate.completionDate);
    params.append('hashHex', hashHex);

    const downloadUrl = `${baseUrl}?${params.toString()}`;
    window.open(downloadUrl, '_blank');
  } catch (error) {
    console.error('Download error:', error);
    showToast('error', 'Download Failed', 'Failed to prepare certificate. Please try again.');
  } finally {
    hideLoading();
  }
}



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

// Función para migrar imágenes de blob a Base64
async function migrateBlobImagesToBase64() {
  await loadCoursesFromFirestore();
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
        await dbUsers.collection('courses').doc(course.id.toString()).update({
          image: base64
        });
      } catch (error) {
        console.error(`Error migrando imagen del curso ${course.id}:`, error);
      }
    }
  }
  await loadCoursesFromFirestore();
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
async function saveCourseAssignments(courseId, selectedUserIds) {
  try {
    showLoading();

    // Obtener la referencia del curso en Firestore
    const courseRef = dbUsers.collection('courses').doc(courseId);

    // Obtener los usuarios actualmente asignados al curso
    const courseDoc = await courseRef.get();
    const currentUsers = courseDoc.exists ? courseDoc.data().users || [] : [];

    // Identificar usuarios que deben ser agregados o removidos
    const usersToAdd = selectedUserIds.filter(userId => !currentUsers.includes(userId));
    const usersToRemove = currentUsers.filter(userId => !selectedUserIds.includes(userId));

    // Actualizar la lista de usuarios en el curso
    await courseRef.update({
      users: selectedUserIds,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Actualizar la lista de cursos para cada usuario
    for (const userId of usersToAdd) {
      const userRef = dbUsers.collection('users').doc(userId);
      await userRef.update({
        courses: firebase.firestore.FieldValue.arrayUnion(courseId),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    for (const userId of usersToRemove) {
      const userRef = dbUsers.collection('users').doc(userId);
      await userRef.update({
        courses: firebase.firestore.FieldValue.arrayRemove(courseId),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // Actualizar la caché local
    const updatedCourseIndex = coursesCache.findIndex(course => course.id === courseId);
    if (updatedCourseIndex !== -1) {
      coursesCache[updatedCourseIndex].users = selectedUserIds;
    }

    // Actualizar la caché de usuarios
    for (const userId of usersToAdd) {
      const userIndex = usersCache.findIndex(user => user.id === userId);
      if (userIndex !== -1) {
        usersCache[userIndex].courses = [...(usersCache[userIndex].courses || []), courseId];
      }
    }

    for (const userId of usersToRemove) {
      const userIndex = usersCache.findIndex(user => user.id === userId);
      if (userIndex !== -1) {
        usersCache[userIndex].courses = (usersCache[userIndex].courses || []).filter(id => id !== courseId);
      }
    }

    // Guardar en localStorage
    localStorage.setItem('coursesCache', JSON.stringify(coursesCache));
    localStorage.setItem('usersCache', JSON.stringify(usersCache));

    showToast('success', 'Course Updated', 'The course assignments have been updated successfully.');
  } catch (error) {
    console.error("Error updating course assignments:", error);
    showToast('error', 'Error', 'Failed to update course assignments. Check console for details.');
  } finally {
    hideLoading();
  }
}

document.getElementById('course-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  const title = document.getElementById('course-title').value;
  const description = document.getElementById('course-description').value;
  const duration = parseInt(document.getElementById('course-duration').value);
  const checkboxes = document.querySelectorAll('#course-users-checkboxes input[type="checkbox"]:checked');
  const selectedUserIds = Array.from(checkboxes).map(checkbox => checkbox.value);

  try {
    showLoading();

    if (currentCourseId) {
      // Editar curso existente
      await dbUsers.collection('courses').doc(currentCourseId.toString()).update({
        title: title,
        description: description,
        duration: duration,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Actualizar asignaciones de usuarios
      await saveCourseAssignments(currentCourseId, selectedUserIds);
    } else {
      // Crear nuevo curso
      const newCourseRef = dbUsers.collection('courses').doc();
      const newCourseId = newCourseRef.id;

      await newCourseRef.set({
        title: title,
        description: description,
        duration: duration,
        users: selectedUserIds,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Actualizar asignaciones de usuarios
      await saveCourseAssignments(newCourseId, selectedUserIds);
    }

    // Actualizar la caché local y la tabla de cursos
    await loadCoursesFromFirestore();
    displayCoursesTable();
    displayUsersTable();

    // Ocultar el formulario
    document.getElementById('course-form-container').classList.add('hidden');
  } catch (error) {
    console.error("Error saving course:", error);
    showToast('error', 'Error', 'Failed to save course. Check console for details.');
  } finally {
    hideLoading();
  }
});





// Función para eliminar curso
async function deleteCourse(courseId) {
  const isConfirmed = confirm("Are you sure you want to delete this course? This action cannot be undone.");
  if (!isConfirmed) return;
  try {
    showLoading();
    await dbUsers.collection('courses').doc(courseId.toString()).delete();

    // Eliminar el curso de los usuarios que lo tienen asignado
    for (const user of usersCache) {
      if (user.courses && user.courses.includes(courseId)) {
        const updatedCourses = user.courses.filter(id => id !== courseId);
        await dbUsers.collection('users').doc(user.id).update({
          courses: updatedCourses
        });
        // Actualizar caché local
        const userIndex = usersCache.findIndex(u => u.id === user.id);
        if (userIndex !== -1) usersCache[userIndex].courses = updatedCourses;
      }
    }

    coursesCache = coursesCache.filter(course => course.id !== courseId);
    localStorage.removeItem(`courseImage_${courseId}`);
    localStorage.setItem('coursesCache', JSON.stringify(coursesCache));
    displayCoursesTable();
    showToast('success', 'Course Deleted', 'The course has been deleted successfully.');
  } catch (error) {
    console.error("Error deleting course:", error);
    showToast('error', 'Error', 'Failed to delete course. Check console for details.');
  } finally {
    hideLoading();
  }
}

// Función para subir imagen
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

// Función para filtrar usuarios en el formulario de cursos
function filterCourseUsers() {
  const searchTerm = document.getElementById('course-users-search').value.toLowerCase();
  const container = document.getElementById('course-users-checkboxes');
  const allUsers = container.querySelectorAll('.checkbox-item');
  allUsers.forEach(userItem => {
    const label = userItem.querySelector('label');
    const userText = label.textContent.toLowerCase();
    if (userText.includes(searchTerm)) {
      userItem.style.display = 'flex';
    } else {
      userItem.style.display = 'none';
    }
  });
}

// Función para mostrar formulario de usuario
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
        await dbUsers.collection('users').doc(currentUserId).update({
          name: name,
          email: email,
          role: role,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('success', 'User Updated', 'The user has been updated successfully.');
        usersCache = usersCache.map(user => {
          if (user.id === currentUserId) {
            return { id: currentUserId, name, email, role, courses: user.courses || [] };
          }
          return user;
        });
      } else {
        const usersRef = dbUsers.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();
        if (!snapshot.empty) {
          showToast('error', 'Email in Use', 'This email is already registered.');
          return;
        }
        const newUserRef = await dbUsers.collection('users').add({
          name: name,
          email: email,
          role: role,
          courses: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        usersCache.push({
          id: newUserRef.id,
          name: name,
          email: email,
          role: role,
          courses: []
        });
        showToast('success', 'User Created', 'The user has been created successfully.');
      }
      localStorage.setItem('usersCache', JSON.stringify(usersCache));
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
    if (!user.courses) user.courses = [];
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
    await dbUsers.collection('users').doc(userId).delete();
    showToast('success', 'User Deleted', 'The user has been deleted successfully.');
    usersCache = usersCache.filter(user => user.id !== userId);
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
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Courses</th>
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
              <td style="padding: 0.75rem;">
                ${user.courses && user.courses.length > 0 ?
                  user.courses.map(courseId => {
                    const course = coursesCache.find(c => c.id === courseId);
                    return course ? course.title : 'Unknown';
                  }).join(', ') : 'None'}
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

// Función para mostrar tabla de cursos (admin)
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
                    `<button class="btn-users-count" onclick="showCourseUsers('${course.id}')">${userCount}</button>` :
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
                  <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; margin-right: 0.5rem;" onclick="editCourse('${course.id}')">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; color: var(--destructive); border-color: var(--destructive);" onclick="deleteCourse('${course.id}')">
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

// Función para mostrar cursos del usuario (NUEVA)
async function displayUserCourses() {
  const userCourses = await loadUserCourses();
  const grid = document.getElementById('certificates-grid');

  if (userCourses.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <i class="fas fa-tag" style="font-size: 3rem; color: var(--neutral-400); margin-bottom: 1rem;"></i>
        <h3 style="color: var(--neutral-800); margin-bottom: 0.5rem;">No courses assigned</h3>
        <p style="color: var(--neutral-600);">Contact your administrator to get access to courses.</p>
      </div>
    `;
    return;
  }

  const mockCertificates = userCourses.map(course => ({
    id: course.id,
    nombre: localStorage.getItem('userName') || 'User',
    certificateId: `WS-2025-${course.id.toString().padStart(3, '0')}`,
    completionDate: '2023-01-15',
    course: course
  }));

  certificatesCache = mockCertificates;
  grid.innerHTML = mockCertificates.map(cert => createCertificateCard(cert)).join('');
  updateGraduateStats(mockCertificates);
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
    label.innerHTML = `
      ${user.name} (${user.email})
      <br>
      <small style="color: var(--neutral-600);">
        Cursos: ${user.courses?.map(cid => {
          const course = coursesCache.find(c => c.id === cid);
          return course ? course.title : 'Unknown';
        }).join(', ') || 'None'}
      </small>
    `;
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

// Imagen por defecto en Base64
const defaultImageBase64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIiBmaWxsPSJub25lIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyNSIgY3k9IjI1IiByPSIyMCIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjI1IiB5PSIyNSIgZmlsbD0iI2RlZCI+Qy9zdGFnZTwvdGV4dD48L3N2Zz4=";

// Función para mostrar tabla de certificados (admin)
function displayAdminCertificatesTable(certificates = certificatesCache) {
  const container = document.getElementById('certificates-table-container');
  const validCertificates = certificates.filter(cert => cert && cert.id && cert.course && cert.nombre);

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
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Course</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Completion Date</th>
            <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${validCertificates.map(cert => {
            const course = coursesCache.find(c => c.id === cert.course.id);
            const courseTitle = course ? course.title : 'Unknown Course';
            const currentDate = new Date().toLocaleDateString();
            return `
              <tr style="border-bottom: 1px solid var(--neutral-200);">
                <td style="padding: 0.75rem; font-family: monospace; font-weight: 600;">WS-${cert.id}</td>
                <td style="padding: 0.75rem;">${courseTitle}</td>
                <td style="padding: 0.75rem;">${currentDate}</td>
                <td style="padding: 0.75rem;">
                  <button class="btn btn-outline" style="padding: 0.25rem 0.5rem;" onclick="downloadCertificate('${cert.id}')">
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
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');
  const userInfoSpan = document.querySelector('.user-info span');
  if (userName && userInfoSpan) {
    userInfoSpan.textContent = userName;
  } else if (userInfoSpan) {
    userInfoSpan.textContent = 'User';
  }
  const adminBtns = document.querySelectorAll('.nav-btn[data-view="admin"], .mobile-nav-btn[data-view="admin"]');
  const graduateBtns = document.querySelectorAll('.nav-btn[data-view="graduate"], .mobile-nav-btn[data-view="graduate"]');
  const verifierBtns = document.querySelectorAll('.nav-btn[data-view="verifier"], .mobile-nav-btn[data-view="verifier"]');
  if (userRole === 'admin') {
    graduateBtns.forEach(btn => btn.style.display = 'none');
    verifierBtns.forEach(btn => btn.style.display = 'none');
    if (viewParam) {
      showView(viewParam);
    } else {
      showView('admin');
    }
  } else if (userRole === 'graduate') {
    adminBtns.forEach(btn => btn.style.display = 'none');
    if (viewParam) {
      showView(viewParam);
    } else {
      showView('graduate');
    }
  } else {
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
function showView(viewName) {
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) {
    targetView.classList.add('active');
  }
  document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  loadViewData(viewName);
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
async function loadGraduateData() {
  showLoading();
  await displayUserCourses();
  hideLoading();
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
          <button class="btn btn-primary" onclick="downloadCertificate('${certificate.id}')">
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
  if (btnText && btnSpinner) {
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
    if (btnText && btnSpinner) {
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

// Función para obtener la URL base de la aplicación
function getBaseUrl() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://${window.location.hostname}:${window.location.port}`;
  } else if (window.location.hostname.includes('github.io')) {
    return 'https://most-improve123.github.io/LIMPPL';
  } else {
    return `https://${window.location.hostname}`;
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

function validateCsvStructure(data, type) {
  if (type === 'students') {
    const requiredFields = ['nombre', 'email', 'curso'];
    for (const row of data) {
      const missingFields = requiredFields.filter(field => !row[field]);
      if (missingFields.length > 0) {
        return { valid: false, message: `Faltan campos en la fila: ${JSON.stringify(row)}. Campos requeridos: ${missingFields.join(', ')}` };
      }
    }
  } else if (type === 'certificates') {
    const requiredFields = ['nombre', 'email', 'curso'];
    for (const row of data) {
      const missingFields = requiredFields.filter(field => !row[field]);
      if (missingFields.length > 0) {
        return { valid: false, message: `Faltan campos en la fila: ${JSON.stringify(row)}. Campos requeridos: ${missingFields.join(', ')}` };
      }
    }
  }
  return { valid: true };
}

// Función para importar CSV
async function importCsv() {
  const fileInput = document.getElementById('csv-file');
  const file = fileInput.files[0];
  if (!file) {
    showToast('error', 'No File Selected', 'Please select a CSV file to import.');
    return;
  }
  const importType = document.querySelector('input[name="import-type"]:checked').value;
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
    if (importType === 'students') {
      await importStudents(data);
    } else {
      await importCertificates(data);
    }
  } catch (error) {
    console.error('Error importing CSV:', error);
    showToast('error', 'Import Failed', error.message || 'An error occurred.');
  } finally {
    hideLoading();
    clearFile();
  }
}

// Función para generar un token aleatorio
function generateRandomToken() {
  return 'token-' + Math.random().toString(36).substr(2, 9);
}

// Función para enviar el magic link por correo electrónico
async function sendBrevoMagicLinkEmail(email, magicLink) {
  try {
    const response = await fetch('https://wespark-backend.onrender.com/send-magic-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, magicLink }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Error al enviar email a ${email}:`, errorData.error || 'Unknown error');
      return { success: false };
    }
    return await response.json();
  } catch (error) {
    console.error(`Error de red al enviar email a ${email}:`, error);
    return { success: false };
  }
}

// Función para generar contraseñas aleatorias
function generateRandomPassword() {
  return Math.random().toString(36).slice(-10);
}

// Función para importar estudiantes desde CSV
async function importStudents(studentsData) {
  const zip = new JSZip();
  const defaultDate = new Date().toISOString().split('T')[0];
  let successCount = 0;
  let errorCount = 0;
  for (const row of studentsData) {
    try {
      const { nombre, email, curso: courseName } = row;
      if (!nombre || !email || !courseName) {
        console.warn(`Faltan datos en la fila: ${JSON.stringify(row)}. Se omitirá.`);
        errorCount++;
        continue;
      }
      const course = coursesCache.find(c => c.title.toLowerCase() === courseName.toLowerCase());
      if (!course) {
        console.warn(`Curso no encontrado: ${courseName}. Se omitirá.`);
        errorCount++;
        continue;
      }
      const usersRef = dbUsers.collection('users');
      const query = usersRef.where('email', '==', email);
      const snapshot = await query.get();
      let userId;
      if (!snapshot.empty) {
        userId = snapshot.docs[0].id;
        const userData = snapshot.docs[0].data();
        const userCourses = userData.courses || [];
        if (!userCourses.includes(course.id)) {
          userCourses.push(course.id);
          await usersRef.doc(userId).update({
            courses: userCourses,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Curso "${courseName}" asignado a estudiante existente: ${email}`);
        } else {
          console.log(`Estudiante ${email} ya tiene el curso "${courseName}"`);
        }
      } else {
        const userCredential = await auth.createUserWithEmailAndPassword(
          email,
          generateRandomPassword()
        );
        userId = userCredential.user.uid;
        await usersRef.doc(userId).set({
          name: nombre,
          email: email,
          role: 'graduate',
          courses: [course.id],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const token = generateRandomToken();
        const magicLink = `${getBaseUrl()}/login.html?token=${token}&email=${encodeURIComponent(email)}`;
        await sendBrevoMagicLinkEmail(email, magicLink);
        console.log(`Nuevo estudiante creado: ${email} con curso "${courseName}"`);
      }
      const certificateId = generateUniqueId();
      const hashHex = await generateHash(certificateId);
      const pdfBlob = await generarPDFIndividual(nombre, courseName, defaultDate, certificateId, hashHex);
      zip.file(`certificado_${certificateId}.pdf`, pdfBlob);
      successCount++;
    } catch (error) {
      console.error(`Error procesando estudiante ${row.email}:`, error);
      errorCount++;
    }
  }
  if (successCount > 0) {
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'certificados_estudiantes.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  showToast(
    successCount > 0 ? 'success' : 'error',
    'Import Results',
    `Success: ${successCount} | Errors: ${errorCount}`
  );
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
  await loadUsers();
  await loadCoursesFromFirestore();
  displayUsersTable();
  displayCoursesTable();

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

      try {
        showLoading();

        if (currentCourseId) {
          // Editar curso existente en Firestore
          await dbUsers.collection('courses').doc(currentCourseId.toString()).update({
            title: title,
            description: description,
            duration: duration,
            image: imageBase64,
            users: selectedUsers,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          // Actualizar coursesCache
          coursesCache = coursesCache.map(c => {
            if (c.id === currentCourseId) {
              return {
                ...c,
                title,
                description,
                duration,
                image: imageBase64,
                users: selectedUsers
              };
            }
            return c;
          });

          // Actualizar los usuarios asignados al curso
          const previousCourse = coursesCache.find(c => c.id === currentCourseId);
          const previousUsers = previousCourse ? previousCourse.users || [] : [];

          // Quitar curso de usuarios deseleccionados
          for (const userId of previousUsers) {
            if (!selectedUsers.includes(userId)) {
              const user = usersCache.find(u => u.id === userId);
              if (user) {
                const updatedCourses = (user.courses || []).filter(id => id !== currentCourseId);
                await dbUsers.collection('users').doc(userId).update({ courses: updatedCourses });
                // Actualizar caché local
                const userIndex = usersCache.findIndex(u => u.id === userId);
                if (userIndex !== -1) usersCache[userIndex].courses = updatedCourses;
              }
            }
          }

          // Añadir curso a usuarios seleccionados
          for (const userId of selectedUsers) {
            const user = usersCache.find(u => u.id === userId);
            if (user) {
              const updatedCourses = user.courses ? [...user.courses] : [];
              if (!updatedCourses.includes(currentCourseId)) {
                updatedCourses.push(currentCourseId);
                await dbUsers.collection('users').doc(userId).update({ courses: updatedCourses });
                // Actualizar caché local
                const userIndex = usersCache.findIndex(u => u.id === userId);
                if (userIndex !== -1) usersCache[userIndex].courses = updatedCourses;
              }
            }
          }

        } else {
          // Crear nuevo curso en Firestore
          const newCourseRef = dbUsers.collection('courses').doc();
          const newCourseId = newCourseRef.id;

          await newCourseRef.set({
            title: title,
            description: description,
            duration: duration,
            image: imageBase64,
            users: selectedUsers,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          // Añadir el nuevo curso a coursesCache
          coursesCache.push({
            id: newCourseId,
            title: title,
            description: description,
            duration: duration,
            image: imageBase64,
            users: selectedUsers
          });

          // Asignar el curso a los usuarios seleccionados
          for (const userId of selectedUsers) {
            const user = usersCache.find(u => u.id === userId);
            if (user) {
              const updatedCourses = user.courses ? [...user.courses, newCourseId] : [newCourseId];
              await dbUsers.collection('users').doc(userId).update({ courses: updatedCourses });
              // Actualizar caché local
              const userIndex = usersCache.findIndex(u => u.id === userId);
              if (userIndex !== -1) usersCache[userIndex].courses = updatedCourses;
            }
          }
        }

        // Guardar en localStorage
        localStorage.setItem('coursesCache', JSON.stringify(coursesCache));
        localStorage.setItem('usersCache', JSON.stringify(usersCache));

        // Actualizar la tabla de cursos
        displayCoursesTable();
        displayUsersTable();

        // Ocultar el formulario
        document.getElementById('course-form-container').classList.add('hidden');
        showToast('success', 'Course Saved', 'The course has been saved successfully.');

      } catch (error) {
        console.error("Error saving course:", error);
        showToast('error', 'Error', 'Failed to save course. Check console for details.');
      } finally {
        hideLoading();
      }
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
    showView(viewParam);
  } else if (userRole === 'admin') {
    showView('admin');
  } else {
    showView('graduate');
  }

  loadInitialData();
});
