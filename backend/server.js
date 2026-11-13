const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Simulated staff credentials
const STAFF = {
    email: 'admin@stack.com',
    password: 'Admin123'
};

// Temporary login sessions
const sessions = new Set();

// ===============================
// AUTHENTICATION
// ===============================

// Login
app.post('/api/auth/login', (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required.'
        });
    }

    if (email !== STAFF.email || password !== STAFF.password) {
        return res.status(401).json({
            success: false,
            message: 'Incorrect email or password.'
        });
    }

    const token = crypto.randomUUID();

    sessions.add(token);

    res.json({
        success: true,
        message: 'Login successful.',
        token: token
    });
});

// Check login status
app.get('/api/auth/status', authenticate, (req, res) => {
    res.json({
        success: true,
        authenticated: true
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {

    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
        sessions.delete(token);
    }

    res.json({
        success: true,
        message: 'Logged out successfully.'
    });
});

// Authentication middleware
function authenticate(req, res, next) {

    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
        return res.status(401).json({
            success: false,
            message: 'Please log in first.'
        });
    }

    next();
}

// Protect all remaining API endpoints
app.use('/api', authenticate);


// ===============================
// DASHBOARD
// ===============================

// Dashboard statistics
app.get('/api/dashboard/stats', (req, res) => {

    const totalStudents = db.prepare(
        'SELECT COUNT(*) AS count FROM students'
    ).get().count;

    const activeStudents = db.prepare(
        "SELECT COUNT(*) AS count FROM students WHERE enrollment_status = 'Active'"
    ).get().count;

    const inactiveStudents = db.prepare(
        "SELECT COUNT(*) AS count FROM students WHERE enrollment_status = 'Inactive'"
    ).get().count;

    const graduatedStudents = db.prepare(
        "SELECT COUNT(*) AS count FROM students WHERE enrollment_status = 'Graduated'"
    ).get().count;

    const totalDepartments = db.prepare(
        'SELECT COUNT(*) AS count FROM departments'
    ).get().count;

    res.json({
        success: true,
        data: {
            totalStudents,
            activeStudents,
            inactiveStudents,
            graduatedStudents,
            totalDepartments
        }
    });
});

// Recently registered students
app.get('/api/dashboard/recent-students', (req, res) => {

    const students = db.prepare(`
        SELECT students.*, departments.department_name
        FROM students
        JOIN departments
        ON students.department_id = departments.department_id
        ORDER BY students.registration_date DESC,
                 students.student_id DESC
        LIMIT 5
    `).all();

    res.json({
        success: true,
        data: students
    });
});


// ===============================
// STUDENTS
// ===============================

// Get students with search, filters and sorting
app.get('/api/students', (req, res) => {

    const {
        search,
        department_id,
        status,
        academic_year,
        sort = 'student_id',
        order = 'ASC'
    } = req.query;

    const allowedSort = [
        'student_id',
        'student_number',
        'first_name',
        'last_name',
        'registration_date',
        'academic_year'
    ];

    if (!allowedSort.includes(sort)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid sorting field.'
        });
    }

    const sortOrder = order.toUpperCase();

    if (!['ASC', 'DESC'].includes(sortOrder)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid sorting order.'
        });
    }

    let sql = `
        SELECT students.*, departments.department_name
        FROM students
        JOIN departments
        ON students.department_id = departments.department_id
        WHERE 1 = 1
    `;

    const params = {};

    if (search) {
        sql += `
            AND (
                students.student_number LIKE @search
                OR students.first_name LIKE @search
                OR students.last_name LIKE @search
                OR students.email LIKE @search
            )
        `;

        params.search = `%${search}%`;
    }

    if (department_id) {
        sql += ' AND students.department_id = @department_id';
        params.department_id = department_id;
    }

    if (status) {
        sql += ' AND students.enrollment_status = @status';
        params.status = status;
    }

    if (academic_year) {
        sql += ' AND students.academic_year = @academic_year';
        params.academic_year = academic_year;
    }

    sql += ` ORDER BY students.${sort} ${sortOrder}`;

    const students = db.prepare(sql).all(params);

    res.json({
        success: true,
        count: students.length,
        data: students
    });
});


// Get one student
app.get('/api/students/:id', (req, res) => {

    const student = db.prepare(`
        SELECT students.*, departments.department_name
        FROM students
        JOIN departments
        ON students.department_id = departments.department_id
        WHERE students.student_id = ?
    `).get(req.params.id);

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Student not found.'
        });
    }

    res.json({
        success: true,
        data: student
    });
});


// Register new student
app.post('/api/students', (req, res) => {

    const {
        student_number,
        first_name,
        last_name,
        email,
        phone_number,
        department_id,
        academic_year,
        enrollment_status,
        date_of_birth,
        registration_date
    } = req.body;

    if (
        !student_number ||
        !first_name ||
        !last_name ||
        !email ||
        !department_id ||
        academic_year === undefined ||
        !enrollment_status ||
        !registration_date
    ) {
        return res.status(400).json({
            success: false,
            message: 'Please complete all required fields.'
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid email address.'
        });
    }

    if (
        !Number.isInteger(Number(academic_year)) ||
        Number(academic_year) < 1 ||
        Number(academic_year) > 5
    ) {
        return res.status(400).json({
            success: false,
            message: 'Academic year must be between 1 and 5.'
        });
    }

    const validStatuses = [
        'Active',
        'Inactive',
        'Graduated',
        'Suspended'
    ];

    if (!validStatuses.includes(enrollment_status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid enrollment status.'
        });
    }

    try {

        const result = db.prepare(`
            INSERT INTO students (
                student_number,
                first_name,
                last_name,
                email,
                phone_number,
                department_id,
                academic_year,
                enrollment_status,
                date_of_birth,
                registration_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            student_number.trim(),
            first_name.trim(),
            last_name.trim(),
            email.trim().toLowerCase(),
            phone_number || null,
            Number(department_id),
            Number(academic_year),
            enrollment_status,
            date_of_birth || null,
            registration_date
        );

        res.status(201).json({
            success: true,
            message: 'Student registered successfully.',
            student_id: result.lastInsertRowid
        });

    } catch (error) {

        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({
                success: false,
                message: 'Student number or email already exists.'
            });
        }

        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return res.status(400).json({
                success: false,
                message: 'Selected department does not exist.'
            });
        }

        throw error;
    }
});


// Update student
app.put('/api/students/:id', (req, res) => {

    const {
        student_number,
        first_name,
        last_name,
        email,
        phone_number,
        department_id,
        academic_year,
        enrollment_status,
        date_of_birth,
        registration_date
    } = req.body;

    if (
        !student_number ||
        !first_name ||
        !last_name ||
        !email ||
        !department_id ||
        academic_year === undefined ||
        !enrollment_status ||
        !registration_date
    ) {
        return res.status(400).json({
            success: false,
            message: 'Please complete all required fields.'
        });
    }

    const validStatuses = [
        'Active',
        'Inactive',
        'Graduated',
        'Suspended'
    ];

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !Number.isInteger(Number(academic_year)) ||
        Number(academic_year) < 1 ||
        Number(academic_year) > 5 ||
        !validStatuses.includes(enrollment_status)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Invalid student information.'
        });
    }

    try {

        const result = db.prepare(`
            UPDATE students SET
                student_number = ?,
                first_name = ?,
                last_name = ?,
                email = ?,
                phone_number = ?,
                department_id = ?,
                academic_year = ?,
                enrollment_status = ?,
                date_of_birth = ?,
                registration_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ?
        `).run(
            student_number.trim(),
            first_name.trim(),
            last_name.trim(),
            email.trim().toLowerCase(),
            phone_number || null,
            Number(department_id),
            Number(academic_year),
            enrollment_status,
            date_of_birth || null,
            registration_date,
            req.params.id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        res.json({
            success: true,
            message: 'Student updated successfully.'
        });

    } catch (error) {

        if (
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
            error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
        ) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate information or invalid department.'
            });
        }

        throw error;
    }
});


// Delete student
app.delete('/api/students/:id', (req, res) => {

    const result = db.prepare(
        'DELETE FROM students WHERE student_id = ?'
    ).run(req.params.id);

    if (result.changes === 0) {
        return res.status(404).json({
            success: false,
            message: 'Student not found.'
        });
    }

    res.json({
        success: true,
        message: 'Student deleted successfully.'
    });
});


// ===============================
// DEPARTMENTS
// ===============================

// Get all departments
app.get('/api/departments', (req, res) => {

    const departments = db.prepare(`
        SELECT
            departments.*,
            COUNT(students.student_id) AS student_count
        FROM departments
        LEFT JOIN students
        ON departments.department_id = students.department_id
        GROUP BY departments.department_id
        ORDER BY departments.department_name
    `).all();

    res.json({
        success: true,
        data: departments
    });
});


// Add department
app.post('/api/departments', (req, res) => {

    const { department_name, department_code, description } = req.body;

    if (!department_name?.trim() || !department_code?.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Department name and code are required.'
        });
    }

    try {

        const result = db.prepare(`
            INSERT INTO departments
            (department_name, department_code, description)
            VALUES (?, ?, ?)
        `).run(
            department_name.trim(),
            department_code.trim().toUpperCase(),
            description || null
        );

        res.status(201).json({
            success: true,
            message: 'Department added successfully.',
            department_id: result.lastInsertRowid
        });

    } catch (error) {

        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({
                success: false,
                message: 'Department name or code already exists.'
            });
        }

        throw error;
    }
});


// Update department
app.put('/api/departments/:id', (req, res) => {

    const { department_name, department_code, description } = req.body;

    if (!department_name?.trim() || !department_code?.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Department name and code are required.'
        });
    }

    try {

        const result = db.prepare(`
            UPDATE departments SET
                department_name = ?,
                department_code = ?,
                description = ?
            WHERE department_id = ?
        `).run(
            department_name.trim(),
            department_code.trim().toUpperCase(),
            description || null,
            req.params.id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Department not found.'
            });
        }

        res.json({
            success: true,
            message: 'Department updated successfully.'
        });

    } catch (error) {

        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({
                success: false,
                message: 'Department name or code already exists.'
            });
        }

        throw error;
    }
});


// Delete department
app.delete('/api/departments/:id', (req, res) => {

    try {

        const result = db.prepare(
            'DELETE FROM departments WHERE department_id = ?'
        ).run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Department not found.'
            });
        }

        res.json({
            success: true,
            message: 'Department deleted successfully.'
        });

    } catch (error) {

        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete a department containing students.'
            });
        }

        throw error;
    }
});

// Get one department
app.get('/api/departments/:id', (req, res) => {

    const department = db.prepare(`
        SELECT *
        FROM departments
        WHERE department_id = ?
    `).get(req.params.id);

    if (!department) {
        return res.status(404).json({
            success: false,
            message: 'Department not found.'
        });
    }

    res.json({
        success: true,
        data: department
    });

});

// ===============================
// ERROR HANDLING
// ===============================

// Handle unknown API endpoints
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found.'
    });
});

// General error handler
app.use((error, req, res, next) => {

    console.error(error);

    res.status(500).json({
        success: false,
        message: 'Internal server error.'
    });
});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

    console.log('==============================');
    console.log('       STACK SYSTEM');
    console.log('==============================');
    console.log(`Server running: http://localhost:${PORT}`);
    console.log('Database: SQLite');
    console.log('Status: Ready');
});