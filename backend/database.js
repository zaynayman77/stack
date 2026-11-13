const Database = require('better-sqlite3');
const path = require('path');

// Connect to SQLite database
const db = new Database(path.join(__dirname, 'stack.db'));

// Enable foreign key support
db.pragma('foreign_keys = ON');

// Create Departments table
db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
        department_id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_name TEXT NOT NULL UNIQUE,
        department_code TEXT NOT NULL UNIQUE,
        description TEXT
    );
`);

// Create Students table
db.exec(`
    CREATE TABLE IF NOT EXISTS students (
        student_id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_number TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone_number TEXT,
        department_id INTEGER NOT NULL,
        academic_year INTEGER NOT NULL
            CHECK (academic_year BETWEEN 1 AND 5),
        enrollment_status TEXT NOT NULL
            CHECK (
                enrollment_status IN (
                    'Active',
                    'Inactive',
                    'Graduated',
                    'Suspended'
                )
            ),
        date_of_birth TEXT,
        registration_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (department_id)
            REFERENCES departments(department_id)
            ON DELETE RESTRICT
    );
`);

// Insert example departments if database is empty
const departmentCount = db.prepare(
    'SELECT COUNT(*) AS count FROM departments'
).get();

if (departmentCount.count === 0) {

    const insertDepartment = db.prepare(`
        INSERT INTO departments
        (department_name, department_code, description)
        VALUES (?, ?, ?)
    `);

    const departments = [
        ['Computer Science', 'CS', 'Computer Science Department'],
        ['Engineering', 'ENG', 'Engineering Department'],
        ['Business Administration', 'BUS', 'Business Department'],
        ['Information Technology', 'IT', 'IT Department']
    ];

    const insertMany = db.transaction((items) => {
        for (const department of items) {
            insertDepartment.run(...department);
        }
    });

    insertMany(departments);
}

console.log('SQLite database connected successfully!');

module.exports = db;