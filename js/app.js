/**
 * Sham Course Institute - Student Course Registration System
 * Client-Side Application Logic & State Controller
 */

// Application State
const AppState = {
    currentTab: 'dashboard',
    students: [],
    courses: [],
    registrations: [],
    stats: null,
    searchDebounce: null
};

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFilters();
    checkDatabaseHealth();
    loadAllData();
});

// ----------------- Navigation Controller -----------------
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            if (tab) switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    AppState.currentTab = tabName;

    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update active tab pane
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`tab-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    // Update topbar titles
    const headings = {
        dashboard: {
            title: 'Dashboard Overview',
            sub: 'Real-time enrollment insights & relational database management'
        },
        courses: {
            title: 'Course Catalog & Curriculum',
            sub: 'Explore active university courses, prerequisites, and seat availability'
        },
        students: {
            title: 'Students Directory',
            sub: 'Manage student enrollments, academic records, and credit limits'
        },
        registrations: {
            title: 'Registrations Desk',
            sub: 'Audit log of all student-course registrations and grade records'
        },
        workbench: {
            title: 'MySQL Workbench Integration',
            sub: 'Database schema, live tables, and copy-paste SQL workbench queries'
        }
    };

    if (headings[tabName]) {
        document.getElementById('pageHeading').textContent = headings[tabName].title;
        document.getElementById('pageSubHeading').textContent = headings[tabName].sub;
    }

    // Refresh tab content if necessary
    if (tabName === 'dashboard') loadStats();
    if (tabName === 'courses') loadCourses();
    if (tabName === 'students') loadStudents();
    if (tabName === 'registrations') loadRegistrations();
}

// ----------------- Database Health & Status -----------------
async function checkDatabaseHealth() {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.status === 'online') {
            document.getElementById('dbNameLabel').textContent = data.database;
            document.getElementById('dbStatusBadge').title = `Connected to MySQL: ${data.database} (${data.version})`;
        } else {
            document.getElementById('dbNameLabel').textContent = 'Disconnected';
            showToast('MySQL database is not reachable. Check .env config', 'error');
        }
    } catch (e) {
        document.getElementById('dbNameLabel').textContent = 'Offline';
    }
}

// ----------------- Data Loaders -----------------
async function loadAllData() {
    await Promise.all([
        loadStats(),
        loadCourses(),
        loadStudents(),
        loadRegistrations()
    ]);
}

// 1. Load Analytics / Stats
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const json = await res.json();
        if (!json.success) return;

        const data = json.data;
        AppState.stats = data;

        // Render KPI Counters
        document.getElementById('kpiTotalStudents').textContent = data.total_students || 0;
        document.getElementById('kpiTotalCourses').textContent = data.total_courses || 0;
        document.getElementById('kpiActiveRegistrations').textContent = data.active_enrollments || 0;
        document.getElementById('kpiFillRate').textContent = `${data.fill_percentage || 0}%`;
        document.getElementById('kpiSeatsOccupied').textContent = `${data.total_occupied} / ${data.total_capacity} Seats Taken`;

        // Render Sidebar Pills
        document.getElementById('navStudentsCount').textContent = data.total_students || 0;
        document.getElementById('navCoursesCount').textContent = data.total_courses || 0;
        document.getElementById('navRegCount').textContent = data.total_registrations || 0;

        // Render Popular Courses Tracker
        renderPopularCourses(data.popularCourses || []);

        // Render Recent Registrations Stream
        renderRecentRegistrations(data.recentRegistrations || []);

        // Render Interactive Analytics Charts (Chart.js)
        renderAnalyticsCharts(data);
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

// Chart.js Instances
let deptChartInstance = null;
let capacityChartInstance = null;

function renderAnalyticsCharts(data) {
    if (typeof Chart === 'undefined') return;

    // 1. Department Enrollment Distribution Doughnut Chart
    const deptCanvas = document.getElementById('deptDistributionChart');
    if (deptCanvas) {
        const deptCtx = deptCanvas.getContext('2d');
        if (deptChartInstance) {
            deptChartInstance.destroy();
        }

        const deptLabels = (data.deptBreakdown || []).map(d => d.department);
        const deptCounts = (data.deptBreakdown || []).map(d => d.student_count);

        deptChartInstance = new Chart(deptCtx, {
            type: 'doughnut',
            data: {
                labels: deptLabels.length ? deptLabels : ['Computer Science', 'Data Science', 'AI', 'IT', 'EE'],
                datasets: [{
                    data: deptCounts.length ? deptCounts : [2, 1, 1, 1, 1],
                    backgroundColor: [
                        '#2563eb', // Blue
                        '#7c3aed', // Purple
                        '#059669', // Emerald
                        '#d97706', // Amber
                        '#0891b2', // Cyan
                        '#e11d48'  // Rose
                    ],
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 14,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw} Students`
                        }
                    }
                },
                cutout: '62%'
            }
        });
    }

    // 2. Course Capacity vs Enrolled Seats Bar Chart
    const capCanvas = document.getElementById('capacityComparisonChart');
    if (capCanvas) {
        const capCtx = capCanvas.getContext('2d');
        if (capacityChartInstance) {
            capacityChartInstance.destroy();
        }

        const courses = (data.popularCourses && data.popularCourses.length > 0) 
            ? data.popularCourses 
            : (AppState.courses || []).slice(0, 5);

        const labels = courses.map(c => c.course_code);
        const enrolled = courses.map(c => c.enrolled_count);
        const capacity = courses.map(c => c.max_capacity);

        capacityChartInstance = new Chart(capCtx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['CS-101', 'DS-204', 'CS-302', 'AI-401'],
                datasets: [
                    {
                        label: 'Enrolled Students',
                        data: enrolled.length ? enrolled : [3, 2, 2, 2],
                        backgroundColor: '#2563eb',
                        borderRadius: 6
                    },
                    {
                        label: 'Total Capacity',
                        data: capacity.length ? capacity : [35, 30, 40, 25],
                        backgroundColor: '#e2e8f0',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: "'JetBrains Mono', monospace", size: 11, weight: 600 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 14,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 }
                        }
                    }
                }
            }
        });
    }
}

function renderPopularCourses(courses) {
    const container = document.getElementById('dashboardPopularCourses');
    if (!courses || courses.length === 0) {
        container.innerHTML = `<div class="empty-state">No courses registered yet.</div>`;
        return;
    }

    container.innerHTML = courses.map(c => {
        let barColor = 'progress-green';
        if (c.fill_percent >= 90) barColor = 'progress-red';
        else if (c.fill_percent >= 70) barColor = 'progress-amber';

        return `
            <div class="capacity-item">
                <img src="${c.thumbnail_url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=100'}" alt="${c.course_code}" class="cap-img" onerror="this.src='https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=100'">
                <div class="cap-details">
                    <div class="cap-header">
                        <div>
                            <span class="cap-code">${c.course_code}</span>
                            <span class="cap-title"> · ${c.course_title}</span>
                        </div>
                        <span class="badge ${c.fill_percent >= 100 ? 'status-dropped' : 'badge-dept'}">
                            ${c.enrolled_count}/${c.max_capacity} Seats
                        </span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar ${barColor}" style="width: ${Math.min(c.fill_percent, 100)}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentRegistrations(regs) {
    const container = document.getElementById('dashboardRecentRegistrations');
    if (!regs || regs.length === 0) {
        container.innerHTML = `<div class="empty-state">No recent enrollments logged.</div>`;
        return;
    }

    container.innerHTML = regs.map(r => {
        return `
            <div class="recent-reg-item">
                <img src="${r.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" alt="${r.first_name}" class="reg-avatar" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'">
                <div class="reg-info">
                    <div class="reg-name">${r.first_name} ${r.last_name} <span class="roll-badge">${r.roll_no}</span></div>
                    <div class="reg-course">${r.course_code} · ${r.course_title}</div>
                </div>
                <span class="status-pill status-${(r.status || 'Enrolled').toLowerCase()}">${r.status}</span>
            </div>
        `;
    }).join('');
}

// 2. Load Courses
async function loadCourses() {
    try {
        const search = document.getElementById('courseSearchInput')?.value || '';
        const dept = document.getElementById('courseDeptFilter')?.value || 'All';
        const semester = document.getElementById('courseSemesterFilter')?.value || 'All';

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (dept !== 'All') params.append('department', dept);
        if (semester !== 'All') params.append('semester', semester);

        const res = await fetch(`/api/courses?${params.toString()}`);
        const json = await res.json();
        if (!json.success) return;

        AppState.courses = json.data;
        renderCoursesCards(json.data);
    } catch (err) {
        console.error('Error fetching courses:', err);
    }
}

function renderCoursesCards(courses) {
    const container = document.getElementById('coursesCardsContainer');
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5" style="grid-column: 1 / -1;">
                <i class="fa-solid fa-book-open" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 1rem;"></i>
                <h3>No courses found</h3>
                <p style="color: #64748b;">Try adjusting your search criteria or add a new course.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = courses.map(c => {
        const isFull = c.available_seats <= 0;
        let progressClass = 'progress-green';
        if (c.fill_percentage >= 90) progressClass = 'progress-red';
        else if (c.fill_percentage >= 70) progressClass = 'progress-amber';

        return `
            <div class="course-card">
                <div class="course-cover">
                    <img src="${c.thumbnail_url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600'}" alt="${c.course_title}" onerror="this.src='https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600'">
                    <div class="course-badges-overlay">
                        <span class="badge badge-code">${c.course_code}</span>
                        <span class="badge badge-credits"><i class="fa-solid fa-award"></i> ${c.credits} Credits</span>
                    </div>
                </div>
                <div class="course-body">
                    <span class="course-dept-label">${c.department}</span>
                    <h3 class="course-title">${c.course_title}</h3>
                    <p class="course-desc">${c.description || 'Comprehensive curriculum with practical assignments and lecture series.'}</p>
                    
                    <div class="course-meta-list">
                        <div class="course-meta-item">
                            <i class="fa-solid fa-chalkboard-user"></i>
                            <span>${c.instructor_name}</span>
                        </div>
                        <div class="course-meta-item">
                            <i class="fa-regular fa-clock"></i>
                            <span>${c.schedule || 'Flexible Schedule'}</span>
                        </div>
                        <div class="course-meta-item">
                            <i class="fa-solid fa-location-dot"></i>
                            <span>${c.classroom || 'Lab A'}</span>
                        </div>
                    </div>

                    <div class="course-capacity-bar">
                        <div class="cap-text-flex">
                            <span>Seat Capacity: ${c.enrolled_count} / ${c.max_capacity}</span>
                            <span class="${isFull ? 'text-rose' : 'text-emerald'}">
                                ${isFull ? 'Course Full' : `${c.available_seats} Seats Left`}
                            </span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-bar ${progressClass}" style="width: ${Math.min(c.fill_percentage, 100)}%"></div>
                        </div>
                    </div>

                    <div class="course-actions">
                        <button class="btn btn-primary btn-sm flex-1" onclick="openEnrollForCourse(${c.course_id})" ${isFull ? 'disabled' : ''}>
                            <i class="fa-solid fa-plus-circle"></i> ${isFull ? 'Full' : 'Enroll'}
                        </button>
                        <button class="btn btn-outline btn-sm btn-icon" onclick="viewCourseRoster(${c.course_id})" title="View Enrolled Students">
                            <i class="fa-solid fa-users"></i>
                        </button>
                        <button class="btn btn-outline btn-sm btn-icon" onclick="editCourse(${c.course_id})" title="Edit Course">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-outline btn-sm btn-icon text-rose" onclick="deleteCourse(${c.course_id}, '${c.course_code}')" title="Delete Course">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 3. Load Students
async function loadStudents() {
    try {
        const search = document.getElementById('studentSearchInput')?.value || '';
        const dept = document.getElementById('studentDeptFilter')?.value || 'All';
        const status = document.getElementById('studentStatusFilter')?.value || 'All';

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (dept !== 'All') params.append('department', dept);
        if (status !== 'All') params.append('status', status);

        const res = await fetch(`/api/students?${params.toString()}`);
        const json = await res.json();
        if (!json.success) return;

        AppState.students = json.data;
        renderStudentsTable(json.data);
    } catch (err) {
        console.error('Error fetching students:', err);
    }
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!students || students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No students matching criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map(s => {
        return `
            <tr>
                <td>
                    <div class="student-col" onclick="viewStudentProfile(${s.student_id})" style="cursor:pointer;" title="View Student Academic File">
                        <img src="${s.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" alt="${s.first_name}" class="table-avatar" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'">
                        <div class="student-names">
                            <strong>${s.first_name} ${s.last_name} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.7rem; color:#3b82f6; margin-left:3px;"></i></strong>
                            <small>${s.email}</small>
                        </div>
                    </div>
                </td>
                <td><span class="roll-badge">${s.roll_no}</span></td>
                <td>${s.department}</td>
                <td>Sem ${s.semester}</td>
                <td><span class="cgpa-pill"><i class="fa-solid fa-star"></i> ${parseFloat(s.cgpa).toFixed(2)}</span></td>
                <td>
                    <strong>${s.enrolled_courses_count} courses</strong>
                    <small style="display:block; color:#64748b;">${s.total_credits} Credits Total</small>
                </td>
                <td><span class="status-pill status-active">${s.status}</span></td>
                <td class="text-right">
                    <button class="btn btn-outline btn-sm btn-icon" onclick="viewStudentProfile(${s.student_id})" title="View Student File">
                        <i class="fa-solid fa-id-card-clip text-blue"></i>
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="printRegistrationSlip(${s.student_id})" title="Print Registration Slip">
                        <i class="fa-solid fa-file-invoice"></i> Slip
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="openEnrollForStudent(${s.student_id})" title="Register Course">
                        <i class="fa-solid fa-plus-circle text-emerald"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon" onclick="editStudent(${s.student_id})" title="Edit Student">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon text-rose" onclick="deleteStudent(${s.student_id}, '${s.first_name}')" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 4. Load Registrations
async function loadRegistrations() {
    try {
        const search = document.getElementById('regSearchInput')?.value || '';
        const status = document.getElementById('regStatusFilter')?.value || 'All';

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (status !== 'All') params.append('status', status);

        const res = await fetch(`/api/registrations?${params.toString()}`);
        const json = await res.json();
        if (!json.success) return;

        AppState.registrations = json.data;
        renderRegistrationsTable(json.data);
    } catch (err) {
        console.error('Error fetching registrations:', err);
    }
}

function renderRegistrationsTable(regs) {
    const tbody = document.getElementById('registrationsTableBody');
    if (!regs || regs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">No registration records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = regs.map(r => {
        const dateStr = new Date(r.registration_date).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        return `
            <tr>
                <td class="font-mono">#${r.registration_id}</td>
                <td>${dateStr}</td>
                <td>
                    <div class="student-col">
                        <img src="${r.student_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="table-avatar" style="width:32px; height:32px;">
                        <strong>${r.student_name}</strong>
                    </div>
                </td>
                <td><span class="roll-badge">${r.roll_no}</span></td>
                <td>
                    <strong style="color:var(--primary);">${r.course_code}</strong> · ${r.course_title}
                </td>
                <td><strong>${r.credits}</strong> cr</td>
                <td><span class="status-pill status-${(r.status || 'Enrolled').toLowerCase()}">${r.status}</span></td>
                <td><strong>${r.grade || 'In Progress'}</strong></td>
                <td><small style="color:#64748b;">${r.remarks || 'Regular Registration'}</small></td>
                <td class="text-right">
                    <button class="btn btn-outline btn-sm btn-icon" onclick="openEditRegModal(${r.registration_id}, '${r.status}', '${r.grade || 'In Progress'}', '${r.remarks || ''}')" title="Update Status / Grade">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon text-rose" onclick="dropRegistration(${r.registration_id}, '${r.student_name}', '${r.course_code}')" title="Drop Registration">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ----------------- Filter Listeners -----------------
function initFilters() {
    // Course Search debounce
    document.getElementById('courseSearchInput')?.addEventListener('input', () => {
        clearTimeout(AppState.searchDebounce);
        AppState.searchDebounce = setTimeout(loadCourses, 250);
    });
    document.getElementById('courseDeptFilter')?.addEventListener('change', loadCourses);
    document.getElementById('courseSemesterFilter')?.addEventListener('change', loadCourses);

    // Student Search debounce
    document.getElementById('studentSearchInput')?.addEventListener('input', () => {
        clearTimeout(AppState.searchDebounce);
        AppState.searchDebounce = setTimeout(loadStudents, 250);
    });
    document.getElementById('studentDeptFilter')?.addEventListener('change', loadStudents);
    document.getElementById('studentStatusFilter')?.addEventListener('change', loadStudents);

    // Registration search debounce
    document.getElementById('regSearchInput')?.addEventListener('input', () => {
        clearTimeout(AppState.searchDebounce);
        AppState.searchDebounce = setTimeout(loadRegistrations, 250);
    });
    document.getElementById('regStatusFilter')?.addEventListener('change', loadRegistrations);
}

// ----------------- Modal Handlers -----------------
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// Close modals when clicking overlay background
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ----------------- 1. Course Enrollment Wizard -----------------
async function openEnrollModal(preselectedStudentId = null, preselectedCourseId = null) {
    const studentSelect = document.getElementById('enrollStudentSelect');
    const courseSelect = document.getElementById('enrollCourseSelect');

    // Populate Students
    studentSelect.innerHTML = `<option value="">-- Choose Student --</option>` +
        AppState.students.map(s => `
            <option value="${s.student_id}" ${preselectedStudentId == s.student_id ? 'selected' : ''}>
                ${s.first_name} ${s.last_name} (${s.roll_no} - ${s.department})
            </option>
        `).join('');

    // Populate Courses
    courseSelect.innerHTML = `<option value="">-- Choose Course --</option>` +
        AppState.courses.map(c => `
            <option value="${c.course_id}" ${preselectedCourseId == c.course_id ? 'selected' : ''} ${c.available_seats <= 0 ? 'disabled' : ''}>
                ${c.course_code} - ${c.course_title} (${c.available_seats} seats available)
            </option>
        `).join('');

    onEnrollStudentChange();
    onEnrollCourseChange();
    openModal('enrollModal');
}

function openEnrollForCourse(courseId) {
    openEnrollModal(null, courseId);
}

function openEnrollForStudent(studentId) {
    openEnrollModal(studentId, null);
}

function onEnrollStudentChange() {
    const studentId = document.getElementById('enrollStudentSelect').value;
    const hint = document.getElementById('enrollStudentHint');
    if (!studentId) {
        hint.textContent = 'Select a student to view their current credit load.';
        return;
    }

    const s = AppState.students.find(x => x.student_id == studentId);
    if (s) {
        hint.innerHTML = `<strong>${s.first_name} ${s.last_name}</strong>: Currently enrolled in <strong>${s.enrolled_courses_count} courses</strong> (${s.total_credits} credits registered).`;
    }
}

function onEnrollCourseChange() {
    const courseId = document.getElementById('enrollCourseSelect').value;
    const preview = document.getElementById('enrollCoursePreview');
    const submitBtn = document.getElementById('btnSubmitEnroll');

    if (!courseId) {
        preview.style.display = 'none';
        submitBtn.disabled = false;
        return;
    }

    const c = AppState.courses.find(x => x.course_id == courseId);
    if (c) {
        preview.style.display = 'block';
        const isFull = c.available_seats <= 0;
        submitBtn.disabled = isFull;

        preview.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${c.course_code}: ${c.course_title}</strong>
                    <div style="font-size:0.8rem; color:#475569; margin-top:2px;">
                        <i class="fa-solid fa-chalkboard-user"></i> ${c.instructor_name} · 
                        <i class="fa-regular fa-clock"></i> ${c.schedule} · 
                        <i class="fa-solid fa-award"></i> ${c.credits} Credits
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${isFull ? 'status-dropped' : 'status-enrolled'}">
                        ${c.enrolled_count}/${c.max_capacity} Seats
                    </span>
                    <small style="display:block; margin-top:2px;">${isFull ? 'Closed' : `${c.available_seats} Available`}</small>
                </div>
            </div>
        `;
    }
}

async function handleEnrollSubmit(e) {
    e.preventDefault();
    const student_id = document.getElementById('enrollStudentSelect').value;
    const course_id = document.getElementById('enrollCourseSelect').value;
    const academic_semester = document.getElementById('enrollSemester').value;
    const remarks = document.getElementById('enrollRemarks').value;

    try {
        const res = await fetch('/api/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id, course_id, academic_semester, remarks })
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('enrollModal');
            loadAllData();
        } else {
            showToast(data.message || 'Enrollment failed', 'error');
        }
    } catch (err) {
        showToast('Network error processing enrollment', 'error');
    }
}

// ----------------- 2. Student CRUD -----------------
function openStudentModal(editStudent = null) {
    const form = document.getElementById('studentForm');
    form.reset();

    const title = document.getElementById('studentModalTitle');
    const editIdInput = document.getElementById('studentEditId');

    if (editStudent) {
        title.textContent = 'Edit Student Profile';
        editIdInput.value = editStudent.student_id;
        document.getElementById('studentRollNo').value = editStudent.roll_no;
        document.getElementById('studentRollNo').disabled = true; // Roll no is immutable key
        document.getElementById('studentFirstName').value = editStudent.first_name;
        document.getElementById('studentLastName').value = editStudent.last_name;
        document.getElementById('studentEmail').value = editStudent.email;
        document.getElementById('studentPhone').value = editStudent.phone;
        document.getElementById('studentDepartment').value = editStudent.department;
        document.getElementById('studentSemester').value = editStudent.semester;
        document.getElementById('studentCgpa').value = editStudent.cgpa;
        document.getElementById('studentAvatarUrl').value = editStudent.avatar_url;
        document.getElementById('studentStatus').value = editStudent.status;
    } else {
        title.textContent = 'Add New Student';
        editIdInput.value = '';
        document.getElementById('studentRollNo').disabled = false;
        // Auto-generate next roll number
        const nextNum = (AppState.students.length + 1).toString().padStart(3, '0');
        document.getElementById('studentRollNo').value = `STU-2026-${nextNum}`;
        document.getElementById('studentAvatarUrl').value = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300';
    }

    openModal('studentModal');
}

function pickAvatar(url) {
    document.getElementById('studentAvatarUrl').value = url;
}

function editStudent(id) {
    const s = AppState.students.find(x => x.student_id == id);
    if (s) openStudentModal(s);
}

async function handleStudentSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('studentEditId').value;

    const payload = {
        roll_no: document.getElementById('studentRollNo').value,
        first_name: document.getElementById('studentFirstName').value,
        last_name: document.getElementById('studentLastName').value,
        email: document.getElementById('studentEmail').value,
        phone: document.getElementById('studentPhone').value,
        department: document.getElementById('studentDepartment').value,
        semester: parseInt(document.getElementById('studentSemester').value, 10),
        cgpa: parseFloat(document.getElementById('studentCgpa').value),
        avatar_url: document.getElementById('studentAvatarUrl').value,
        status: document.getElementById('studentStatus').value
    };

    try {
        const url = editId ? `/api/students/${editId}` : '/api/students';
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('studentModal');
            loadAllData();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Network error saving student', 'error');
    }
}

async function deleteStudent(id, name) {
    if (!confirm(`Are you sure you want to delete student ${name}? All course registrations for this student will be removed.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadAllData();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Error deleting student', 'error');
    }
}

// ----------------- 3. Course CRUD -----------------
function openCourseModal(editCourse = null) {
    const form = document.getElementById('courseForm');
    form.reset();

    const title = document.getElementById('courseModalTitle');
    const editIdInput = document.getElementById('courseEditId');

    if (editCourse) {
        title.textContent = 'Edit Course Curriculum';
        editIdInput.value = editCourse.course_id;
        document.getElementById('courseCode').value = editCourse.course_code;
        document.getElementById('courseCode').disabled = true;
        document.getElementById('courseTitle').value = editCourse.course_title;
        document.getElementById('courseDepartment').value = editCourse.department;
        document.getElementById('courseCredits').value = editCourse.credits;
        document.getElementById('courseCapacity').value = editCourse.max_capacity;
        document.getElementById('courseInstructor').value = editCourse.instructor_name;
        document.getElementById('courseSchedule').value = editCourse.schedule;
        document.getElementById('courseClassroom').value = editCourse.classroom;
        document.getElementById('courseSemester').value = editCourse.semester;
        document.getElementById('courseStatus').value = editCourse.status;
        document.getElementById('courseDescription').value = editCourse.description;
        document.getElementById('courseThumbnailUrl').value = editCourse.thumbnail_url;
    } else {
        title.textContent = 'Add New Course';
        editIdInput.value = '';
        document.getElementById('courseCode').disabled = false;
        document.getElementById('courseThumbnailUrl').value = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600';
    }

    openModal('courseModal');
}

function pickCover(url) {
    document.getElementById('courseThumbnailUrl').value = url;
}

function editCourse(id) {
    const c = AppState.courses.find(x => x.course_id == id);
    if (c) openCourseModal(c);
}

async function handleCourseSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('courseEditId').value;

    const payload = {
        course_code: document.getElementById('courseCode').value,
        course_title: document.getElementById('courseTitle').value,
        department: document.getElementById('courseDepartment').value,
        credits: parseInt(document.getElementById('courseCredits').value, 10),
        max_capacity: parseInt(document.getElementById('courseCapacity').value, 10),
        instructor_name: document.getElementById('courseInstructor').value,
        schedule: document.getElementById('courseSchedule').value,
        classroom: document.getElementById('courseClassroom').value,
        semester: parseInt(document.getElementById('courseSemester').value, 10),
        status: document.getElementById('courseStatus').value,
        description: document.getElementById('courseDescription').value,
        thumbnail_url: document.getElementById('courseThumbnailUrl').value
    };

    try {
        const url = editId ? `/api/courses/${editId}` : '/api/courses';
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('courseModal');
            loadAllData();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Network error saving course', 'error');
    }
}

async function deleteCourse(id, code) {
    if (!confirm(`Are you sure you want to delete course ${code}? All students registered in this course will be unlinked.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadAllData();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Error deleting course', 'error');
    }
}

// ----------------- 4. Registrations Desk Operations -----------------
function openEditRegModal(id, status, grade, remarks) {
    document.getElementById('editRegId').value = id;
    document.getElementById('editRegStatus').value = status || 'Enrolled';
    document.getElementById('editRegGrade').value = grade || 'In Progress';
    document.getElementById('editRegRemarks').value = remarks || '';
    document.getElementById('editRegSubtitle').textContent = `Registration Record #${id}`;
    openModal('editRegModal');
}

async function handleUpdateRegSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editRegId').value;
    const payload = {
        status: document.getElementById('editRegStatus').value,
        grade: document.getElementById('editRegGrade').value,
        remarks: document.getElementById('editRegRemarks').value
    };

    try {
        const res = await fetch(`/api/registrations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('editRegModal');
            loadAllData();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Error updating registration', 'error');
    }
}

async function dropRegistration(id, studentName, courseCode) {
    if (!confirm(`Are you sure you want to drop ${studentName} from ${courseCode}?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadAllData();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Error dropping registration', 'error');
    }
}

// ----------------- 5. Course Enrolled Students Roster Modal -----------------
async function viewCourseRoster(courseId) {
    try {
        const res = await fetch(`/api/courses/${courseId}`);
        const json = await res.json();
        if (!json.success) return;

        const { course, students } = json.data;
        document.getElementById('csModalTitle').textContent = `${course.course_code}: Class Roster`;
        document.getElementById('csModalSubtitle').textContent = `${course.course_title} · ${students.length} of ${course.max_capacity} Seats Occupied`;

        const tbody = document.getElementById('csModalTableBody');
        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No students currently enrolled in this course.</td></tr>`;
        } else {
            tbody.innerHTML = students.map(s => {
                const dateStr = new Date(s.registration_date).toLocaleDateString();
                return `
                    <tr>
                        <td>
                            <div class="student-col">
                                <img src="${s.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="table-avatar" style="width:32px; height:32px;">
                                <strong>${s.full_name}</strong>
                            </div>
                        </td>
                        <td><span class="roll-badge">${s.roll_no}</span></td>
                        <td>${s.department}</td>
                        <td>${dateStr}</td>
                        <td><span class="status-pill status-${(s.reg_status || 'Enrolled').toLowerCase()}">${s.reg_status}</span></td>
                        <td><strong>${s.grade || 'In Progress'}</strong></td>
                    </tr>
                `;
            }).join('');
        }

        openModal('courseStudentsModal');
    } catch (err) {
        showToast('Failed to load course roster', 'error');
    }
}

// ----------------- 6. Printable Registration Slip -----------------
async function printRegistrationSlip(studentId) {
    try {
        const res = await fetch(`/api/registrations/slip/${studentId}`);
        const json = await res.json();
        if (!json.success) {
            showToast(json.message || 'Error loading slip', 'error');
            return;
        }

        const { student, courses, totalCredits } = json.data;

        document.getElementById('slipTimestamp').textContent = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        // Student Info
        document.getElementById('slipStudentInfo').innerHTML = `
            <div class="slip-info-item">
                <strong>Student Full Name</strong>
                <span>${student.first_name} ${student.last_name}</span>
            </div>
            <div class="slip-info-item">
                <strong>Roll / Registration ID</strong>
                <span class="font-mono">${student.roll_no}</span>
            </div>
            <div class="slip-info-item">
                <strong>Department</strong>
                <span>${student.department}</span>
            </div>
            <div class="slip-info-item">
                <strong>Current Semester / CGPA</strong>
                <span>Semester ${student.semester} (CGPA: ${parseFloat(student.cgpa).toFixed(2)})</span>
            </div>
            <div class="slip-info-item">
                <strong>Email Address</strong>
                <span>${student.email}</span>
            </div>
            <div class="slip-info-item">
                <strong>Account Status</strong>
                <span style="color:#059669;">Verified Active</span>
            </div>
        `;

        // Courses Table
        const tbody = document.getElementById('slipCoursesBody');
        if (courses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-3">No active course registrations found for this student.</td></tr>`;
        } else {
            tbody.innerHTML = courses.map((c, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td class="font-mono"><strong>${c.course_code}</strong></td>
                    <td>${c.course_title}</td>
                    <td>${c.department}</td>
                    <td>${c.instructor_name}</td>
                    <td>${c.schedule}</td>
                    <td><strong>${c.credits}</strong></td>
                </tr>
            `).join('');
        }

        document.getElementById('slipTotalCredits').innerHTML = `<strong>${totalCredits} Credits</strong>`;
        openModal('slipModal');
    } catch (err) {
        showToast('Failed to generate registration slip', 'error');
    }
}

// ----------------- 7. Copy SQL Snippets -----------------
function copySnippet(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast('SQL snippet copied to clipboard! Paste into MySQL Workbench', 'info');
    });
}

// ----------------- 8. CSV Exporters -----------------
function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${fileName} successfully!`, 'success');
}

function exportStudentsCSV() {
    if (!AppState.students || AppState.students.length === 0) {
        showToast('No student records to export', 'error');
        return;
    }
    const headers = ['Roll Number', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Semester', 'CGPA', 'Enrolled Courses', 'Total Credits', 'Status'];
    const rows = AppState.students.map(s => [
        `"${s.roll_no}"`,
        `"${s.first_name}"`,
        `"${s.last_name}"`,
        `"${s.email}"`,
        `"${s.phone}"`,
        `"${s.department}"`,
        s.semester,
        s.cgpa,
        s.enrolled_courses_count,
        s.total_credits,
        `"${s.status}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(csv, `Sham_Institute_Students_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportCoursesCSV() {
    if (!AppState.courses || AppState.courses.length === 0) {
        showToast('No course records to export', 'error');
        return;
    }
    const headers = ['Course Code', 'Course Title', 'Department', 'Credits', 'Instructor', 'Schedule', 'Classroom', 'Max Capacity', 'Enrolled Seats', 'Available Seats', 'Fill %', 'Status'];
    const rows = AppState.courses.map(c => [
        `"${c.course_code}"`,
        `"${c.course_title}"`,
        `"${c.department}"`,
        c.credits,
        `"${c.instructor_name}"`,
        `"${c.schedule}"`,
        `"${c.classroom}"`,
        c.max_capacity,
        c.enrolled_count,
        c.available_seats,
        `"${c.fill_percentage}%"`,
        `"${c.status}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(csv, `Sham_Institute_Courses_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportRegistrationsCSV() {
    if (!AppState.registrations || AppState.registrations.length === 0) {
        showToast('No registration records to export', 'error');
        return;
    }
    const headers = ['Reg ID', 'Registration Date', 'Roll Number', 'Student Name', 'Department', 'Course Code', 'Course Title', 'Credits', 'Status', 'Grade', 'Remarks'];
    const rows = AppState.registrations.map(r => [
        r.registration_id,
        `"${new Date(r.registration_date).toLocaleDateString()}"`,
        `"${r.roll_no}"`,
        `"${r.student_name}"`,
        `"${r.student_department}"`,
        `"${r.course_code}"`,
        `"${r.course_title}"`,
        r.credits,
        `"${r.status}"`,
        `"${r.grade}"`,
        `"${r.remarks || ''}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(csv, `Sham_Institute_Registrations_${new Date().toISOString().slice(0, 10)}.csv`);
}

// ----------------- 9. Real-time Sync & Student Dossier -----------------
async function syncDatabase(manual = false) {
    const icon = document.getElementById('syncIcon');
    if (icon) icon.classList.add('spin-anim');

    await checkDatabaseHealth();
    await loadAllData();

    setTimeout(() => {
        if (icon) icon.classList.remove('spin-anim');
        if (manual) showToast('Live database synchronized with MySQL Server 8.0!', 'success');
    }, 600);
}

async function viewStudentProfile(studentId) {
    try {
        const res = await fetch(`/api/students/${studentId}`);
        const json = await res.json();
        if (!json.success) {
            showToast('Unable to load student profile', 'error');
            return;
        }

        const { student, registrations, enrolled_credits } = json.data;

        document.getElementById('spModalTitle').textContent = `${student.first_name} ${student.last_name}`;
        document.getElementById('spModalSubtitle').textContent = `Roll No: ${student.roll_no} · ${student.department}`;

        document.getElementById('spModalBody').innerHTML = `
            <div class="student-dossier-hero">
                <img src="${student.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}" alt="${student.first_name}" class="dossier-avatar" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'">
                <div class="dossier-info">
                    <h3>${student.first_name} ${student.last_name}</h3>
                    <p><i class="fa-regular fa-envelope"></i> ${student.email} · <i class="fa-solid fa-phone"></i> ${student.phone}</p>
                    <div class="dossier-tags">
                        <span class="badge badge-dept">${student.department}</span>
                        <span class="roll-badge">${student.roll_no}</span>
                        <span class="status-pill status-active">${student.status}</span>
                    </div>
                </div>
            </div>

            <div class="dossier-stat-strip">
                <div class="dossier-stat-box">
                    <small>Academic CGPA</small>
                    <strong style="color:#d97706;"><i class="fa-solid fa-star"></i> ${parseFloat(student.cgpa).toFixed(2)}</strong>
                </div>
                <div class="dossier-stat-box">
                    <small>Current Term</small>
                    <strong style="color:#2563eb;">Semester ${student.semester}</strong>
                </div>
                <div class="dossier-stat-box">
                    <small>Registered Load</small>
                    <strong style="color:#059669;">${enrolled_credits} Credits</strong>
                </div>
            </div>

            <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.75rem;">Enrolled Courses Timeline (${registrations.length})</h4>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Course Title</th>
                            <th>Instructor</th>
                            <th>Schedule</th>
                            <th>Credits</th>
                            <th>Status</th>
                            <th>Grade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${registrations.length === 0 ? `<tr><td colspan="7" class="text-center py-3">No active course registrations for this student.</td></tr>` : 
                        registrations.map(r => `
                            <tr>
                                <td class="font-mono"><strong>${r.course_code}</strong></td>
                                <td>${r.course_title}</td>
                                <td>${r.instructor_name}</td>
                                <td><small>${r.schedule}</small></td>
                                <td><strong>${r.credits}</strong> cr</td>
                                <td><span class="status-pill status-${(r.reg_status || 'Enrolled').toLowerCase()}">${r.reg_status}</span></td>
                                <td><strong>${r.grade || 'In Progress'}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('spModalFooter').innerHTML = `
            <button type="button" class="btn btn-light" onclick="closeModal('studentProfileModal')">Close</button>
            <button type="button" class="btn btn-secondary" onclick="closeModal('studentProfileModal'); printRegistrationSlip(${student.student_id});">
                <i class="fa-solid fa-print"></i> Print Slip
            </button>
            <button type="button" class="btn btn-primary" onclick="closeModal('studentProfileModal'); openEnrollForStudent(${student.student_id});">
                <i class="fa-solid fa-plus-circle"></i> Register Course
            </button>
        `;

        openModal('studentProfileModal');
    } catch (err) {
        showToast('Error loading student profile', 'error');
    }
}

// ----------------- Toast Utility -----------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
