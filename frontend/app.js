// ===================================
// STACK - MAIN JAVASCRIPT
// ===================================

const API = '/api';

let editingStudent = false;

let notificationTimer;


// ===================================
// API REQUEST FUNCTION
// ===================================

async function apiRequest(endpoint, options = {}) {

    const token = localStorage.getItem('stackToken');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {

        response = await fetch(API + endpoint, {
            ...options,
            headers
        });

    } catch (error) {

        throw new Error('Cannot connect to STACK server.');

    }

    const data = await response.json();

    if (!response.ok) {

        if (response.status === 401) {
            logout();
        }

        throw new Error(data.message || 'Something went wrong.');

    }

    return data;
}


// ===================================
// NOTIFICATIONS
// ===================================

function notify(message, type = 'success') {

    const notification = document.getElementById('notification');

    notification.textContent = message;

    notification.className = 'notification show';

    if (type === 'error') {
        notification.classList.add('error');
    }

    clearTimeout(notificationTimer);

    notificationTimer = setTimeout(() => {

        notification.classList.remove('show');

    }, 3000);
}


// ===================================
// LOGIN
// ===================================

const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async (e) => {

    e.preventDefault();

    const email = document.getElementById('loginEmail').value;

    const password = document.getElementById('loginPassword').value;

    const errorElement = document.getElementById('loginError');

    errorElement.textContent = '';

    try {

        const result = await apiRequest('/auth/login', {
            method: 'POST',

            body: JSON.stringify({
                email,
                password
            })
        });

        localStorage.setItem('stackToken', result.token);

        showApplication();

    } catch (error) {

        errorElement.textContent = error.message;

    }

});


// ===================================
// AUTHENTICATION CHECK
// ===================================

async function checkLogin() {

    const token = localStorage.getItem('stackToken');

    if (!token) {
        showLogin();
        return;
    }

    try {

        await apiRequest('/auth/status');

        showApplication();

    } catch (error) {

        showLogin();

    }

}


function showLogin() {

    document.getElementById('loginPage').classList.remove('hidden');

    document.getElementById('app').classList.add('hidden');

}


async function showApplication() {

    document.getElementById('loginPage').classList.add('hidden');

    document.getElementById('app').classList.remove('hidden');

    navigate('dashboard');

    await loadDashboard();

    await loadDepartments();

}


// ===================================
// LOGOUT
// ===================================

async function logout() {

    const token = localStorage.getItem('stackToken');

    if (token) {

        try {

            await apiRequest('/auth/logout', {
                method: 'POST'
            });

        } catch (error) {

            console.error(error);

        }

    }

    localStorage.removeItem('stackToken');

    showLogin();

}

document.getElementById('logoutBtn').addEventListener('click', logout);


// ===================================
// NAVIGATION
// ===================================

function navigate(page) {

    document.querySelectorAll('.page').forEach(section => {

        section.classList.add('hidden');

    });

    const selectedPage = document.getElementById(page);

    if (!selectedPage) return;

    selectedPage.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(button => {

        button.classList.toggle(
            'active',
            button.dataset.page === page
        );

    });

    const titles = {
        dashboard: 'Dashboard',
        students: 'Student Records',
        register: 'Register Student',
        departments: 'Departments',
        settings: 'Settings'
    };

    document.getElementById('pageTitle').textContent = titles[page];

    if (page === 'students') {
        loadStudents();
    }

    if (page === 'departments') {
        loadDepartments();
    }

    if (page === 'register' && !editingStudent) {
        document.getElementById('registrationDate').value =
            new Date().toISOString().split('T')[0];
    }

    window.scrollTo(0, 0);

}


// Sidebar navigation
document.querySelectorAll('.nav-item').forEach(button => {

    button.addEventListener('click', () => {

        navigate(button.dataset.page);

    });

});


// Quick navigation buttons
document.querySelectorAll('[data-go]').forEach(button => {

    button.addEventListener('click', () => {

        editingStudent = false;

        if (button.dataset.go === 'register') {
            resetStudentForm();
        }

        navigate(button.dataset.go);

    });

});


// ===================================
// DASHBOARD
// ===================================

async function loadDashboard() {

    try {

        const stats = await apiRequest('/dashboard/stats');

        const data = stats.data;

        document.getElementById('totalStudents').textContent =
            data.totalStudents;

        document.getElementById('activeStudents').textContent =
            data.activeStudents;

        document.getElementById('inactiveStudents').textContent =
            data.inactiveStudents;

        document.getElementById('totalDepartments').textContent =
            data.totalDepartments;


        const recent = await apiRequest(
            '/dashboard/recent-students'
        );

        const tbody = document.getElementById('recentStudents');

        tbody.innerHTML = '';

        if (recent.data.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="5">No students registered yet.</td>
                </tr>
            `;

            return;
        }

        recent.data.forEach(student => {

            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${escapeHTML(student.student_number)}</td>
                <td>${escapeHTML(student.first_name)} ${escapeHTML(student.last_name)}</td>
                <td>${escapeHTML(student.department_name)}</td>
                <td>${escapeHTML(student.registration_date)}</td>
                <td>${statusBadge(student.enrollment_status)}</td>
            `;

            tbody.appendChild(row);

        });

    } catch (error) {

        notify(error.message, 'error');

    }

}


// ===================================
// HTML ESCAPING
// ===================================

function escapeHTML(value) {

    return String(value ?? '').replace(/[&<>"']/g, character => ({

        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'

    })[character]);

}


// ===================================
// STATUS BADGE
// ===================================

function statusBadge(status) {

    const validStatuses = [
        'Active',
        'Inactive',
        'Graduated',
        'Suspended'
    ];

    if (!validStatuses.includes(status)) {
        status = 'Inactive';
    }

    return `
        <span class="status ${status.toLowerCase()}">
            ${escapeHTML(status)}
        </span>
    `;

}


// ===================================
// STUDENT RECORDS
// ===================================

async function loadStudents() {

    const search = document.getElementById('studentSearch').value;

    const department = document.getElementById('departmentFilter').value;

    const status = document.getElementById('statusFilter').value;

    const year = document.getElementById('yearFilter').value;

    const params = new URLSearchParams();

    if (search) params.append('search', search);

    if (department) params.append('department_id', department);

    if (status) params.append('status', status);

    if (year) params.append('academic_year', year);

    try {

        const result = await apiRequest(
            `/students?${params.toString()}`
        );

        const tbody = document.getElementById('studentsTable');

        tbody.innerHTML = '';

        if (result.data.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7">No students found.</td>
                </tr>
            `;

            return;
        }

        result.data.forEach(student => {

            const row = document.createElement('tr');

            row.innerHTML = `

                <td>${escapeHTML(student.student_number)}</td>

                <td>
                    ${escapeHTML(student.first_name)}
                    ${escapeHTML(student.last_name)}
                </td>

                <td>${escapeHTML(student.email)}</td>

                <td>${escapeHTML(student.department_name)}</td>

                <td>Year ${escapeHTML(student.academic_year)}</td>

                <td>${statusBadge(student.enrollment_status)}</td>

                <td>

                    <button
                        class="action-btn edit-btn"
                        data-action="edit"
                        data-id="${student.student_id}">
                        Edit
                    </button>

                    <button
                        class="action-btn delete-btn"
                        data-action="delete"
                        data-id="${student.student_id}">
                        Delete
                    </button>

                </td>

            `;

            tbody.appendChild(row);

        });

    } catch (error) {

        notify(error.message, 'error');

    }

}


// Search
let searchTimer;

document.getElementById('studentSearch')
    .addEventListener('input', () => {

        clearTimeout(searchTimer);

        searchTimer = setTimeout(loadStudents, 300);

    });


// Filters
[
    'departmentFilter',
    'statusFilter',
    'yearFilter'
].forEach(id => {

    document.getElementById(id)
        .addEventListener('change', loadStudents);

});


// ===================================
// STUDENT EDIT AND DELETE
// ===================================

document.getElementById('studentsTable')
    .addEventListener('click', async (e) => {

        const button = e.target.closest('button[data-action]');

        if (!button) return;

        const id = button.dataset.id;

        if (button.dataset.action === 'edit') {

            await editStudent(id);

        }

        if (button.dataset.action === 'delete') {

            await deleteStudent(id);

        }

    });


// Edit student
async function editStudent(id) {

    try {

        const result = await apiRequest(`/students/${id}`);

        const student = result.data;

        editingStudent = true;

        navigate('register');

        document.getElementById('formTitle').textContent =
            'Edit Student';

        document.getElementById('saveStudent').textContent =
            'Update Student';

        document.getElementById('studentId').value =
            student.student_id;

        document.getElementById('studentNumber').value =
            student.student_number;

        document.getElementById('firstName').value =
            student.first_name;

        document.getElementById('lastName').value =
            student.last_name;

        document.getElementById('studentEmail').value =
            student.email;

        document.getElementById('phoneNumber').value =
            student.phone_number || '';

        document.getElementById('department').value =
            student.department_id;

        document.getElementById('academicYear').value =
            student.academic_year;

        document.getElementById('enrollmentStatus').value =
            student.enrollment_status;

        document.getElementById('dateOfBirth').value =
            student.date_of_birth || '';

        document.getElementById('registrationDate').value =
            student.registration_date;

    } catch (error) {

        notify(error.message, 'error');

    }

}


// Delete student
async function deleteStudent(id) {

    const confirmed = confirm(
        'Are you sure you want to delete this student? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {

        const result = await apiRequest(`/students/${id}`, {
            method: 'DELETE'
        });

        notify(result.message);

        await loadStudents();

        await loadDashboard();

    } catch (error) {

        notify(error.message, 'error');

    }

}


// ===================================
// REGISTER AND UPDATE STUDENT
// ===================================

const studentForm = document.getElementById('studentForm');

studentForm.addEventListener('submit', async (e) => {

    e.preventDefault();

    const id = document.getElementById('studentId').value;

    const student = {

        student_number:
            document.getElementById('studentNumber').value.trim(),

        first_name:
            document.getElementById('firstName').value.trim(),

        last_name:
            document.getElementById('lastName').value.trim(),

        email:
            document.getElementById('studentEmail').value.trim(),

        phone_number:
            document.getElementById('phoneNumber').value.trim(),

        department_id:
            document.getElementById('department').value,

        academic_year:
            Number(document.getElementById('academicYear').value),

        enrollment_status:
            document.getElementById('enrollmentStatus').value,

        date_of_birth:
            document.getElementById('dateOfBirth').value || null,

        registration_date:
            document.getElementById('registrationDate').value

    };

    try {

        const result = await apiRequest(
            id ? `/students/${id}` : '/students',
            {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(student)
            }
        );

        notify(result.message);

        editingStudent = false;

        resetStudentForm();

        navigate('students');

        await loadDashboard();

    } catch (error) {

        notify(error.message, 'error');

    }

});


// Reset form
function resetStudentForm() {

    studentForm.reset();

    document.getElementById('studentId').value = '';

    document.getElementById('formTitle').textContent =
        'Register New Student';

    document.getElementById('saveStudent').textContent =
        'Register Student';

    document.getElementById('registrationDate').value =
        new Date().toISOString().split('T')[0];

    editingStudent = false;

}


// Cancel button
document.getElementById('cancelForm')
    .addEventListener('click', () => {

        resetStudentForm();

        navigate('students');

    });


// ===================================
// DEPARTMENTS
// ===================================

async function loadDepartments() {

    try {

        const result = await apiRequest('/departments');

        const departments = result.data;

        const table = document.getElementById('departmentsTable');

        const select = document.getElementById('department');

        const filter = document.getElementById('departmentFilter');

        const selectedDepartment = select.value;

        const selectedFilter = filter.value;

        table.innerHTML = '';

        select.innerHTML = `
            <option value="">Select Department</option>
        `;

        filter.innerHTML = `
            <option value="">All Departments</option>
        `;

        departments.forEach(department => {

            const row = document.createElement('tr');

            row.innerHTML = `

                <td>${escapeHTML(department.department_code)}</td>

                <td>${escapeHTML(department.department_name)}</td>

                <td>${escapeHTML(department.description || '-')}</td>

                <td>${department.student_count}</td>

                <td>

                    <button
                        class="action-btn edit-btn"
                        data-action="edit"
                        data-id="${department.department_id}">
                        Edit
                    </button>

                    <button
                        class="action-btn delete-btn"
                        data-action="delete"
                        data-id="${department.department_id}">
                        Delete
                    </button>

                </td>

            `;

            table.appendChild(row);


            const option = document.createElement('option');

            option.value = department.department_id;

            option.textContent = department.department_name;

            select.appendChild(option);


            const filterOption = document.createElement('option');

            filterOption.value = department.department_id;

            filterOption.textContent = department.department_name;

            filter.appendChild(filterOption);

        });

        select.value = selectedDepartment;

        filter.value = selectedFilter;

        if (departments.length === 0) {

            table.innerHTML = `
                <tr>
                    <td colspan="5">No departments found.</td>
                </tr>
            `;

        }

    } catch (error) {

        notify(error.message, 'error');

    }

}


// ===================================
// DEPARTMENT DIALOG
// ===================================

const departmentDialog =
    document.getElementById('departmentDialog');

const departmentForm =
    document.getElementById('departmentForm');

document.getElementById('addDepartmentBtn')
    .addEventListener('click', () => {

        departmentForm.reset();

        document.getElementById('departmentId').value = '';

        document.getElementById('departmentDialogTitle')
            .textContent = 'Add Department';

        departmentDialog.showModal();

    });


document.getElementById('closeDepartmentDialog')
    .addEventListener('click', () => {

        departmentDialog.close();

    });


// Add or update department
departmentForm.addEventListener('submit', async (e) => {

    e.preventDefault();

    const id = document.getElementById('departmentId').value;

    const department = {

        department_name:
            document.getElementById('departmentName').value.trim(),

        department_code:
            document.getElementById('departmentCode').value.trim(),

        description:
            document.getElementById('departmentDescription').value.trim()

    };

    try {

        const result = await apiRequest(
            id ? `/departments/${id}` : '/departments',
            {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(department)
            }
        );

        departmentDialog.close();

        notify(result.message);

        await loadDepartments();

        await loadDashboard();

    } catch (error) {

        notify(error.message, 'error');

    }

});


// Department edit and delete
document.getElementById('departmentsTable')
    .addEventListener('click', async (e) => {

        const button = e.target.closest('button[data-action]');

        if (!button) return;

        const id = button.dataset.id;

        if (button.dataset.action === 'edit') {

            try {

                const result = await apiRequest(`/departments/${id}`);

                const department = result.data;

                document.getElementById('departmentId').value =
                    department.department_id;

                document.getElementById('departmentName').value =
                    department.department_name;

                document.getElementById('departmentCode').value =
                    department.department_code;

                document.getElementById('departmentDescription').value =
                    department.description || '';

                document.getElementById('departmentDialogTitle')
                    .textContent = 'Edit Department';

                departmentDialog.showModal();

            } catch (error) {

                notify(error.message, 'error');

            }

        }


        if (button.dataset.action === 'delete') {

            const confirmed = confirm(
                'Are you sure you want to delete this department?'
            );

            if (!confirmed) return;

            try {

                const result = await apiRequest(`/departments/${id}`, {
                    method: 'DELETE'
                });

                notify(result.message);

                await loadDepartments();

                await loadDashboard();

            } catch (error) {

                notify(error.message, 'error');

            }

        }

    });


// ===================================
// START APPLICATION
// ===================================

checkLogin();