// Admin Dashboard JavaScript
// Handles all CRUD operations for students, teachers, admissions, and notifications

import { authHelper, firestoreHelper, analyticsHelper, storageHelper, collection, query, where, getDocs, orderBy, limit, addDoc, db, auth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from './firebase-config.js';

// Global state
let allAdmissions = [];
let allStudents = [];
let allTeachers = [];
let allMessages = [];
let allNotifications = [];
let currentEditingStudent = null;
let currentEditingTeacher = null;

// Helper: Toast Notification
window.showToast = function (type, message) {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-y-0 ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`;
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span class="font-bold">${message}</span>
        </div>
    `;
    document.body.appendChild(toast);

    // Animate out
    setTimeout(() => {
        toast.classList.add('-translate-y-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Roll Number Edit Logic
let editingRollId = null;

window.openRollNoModal = function (id, currentVal) {
    editingRollId = id;
    const input = document.getElementById('edit-roll-input');
    input.value = currentVal === '-' ? '' : currentVal;
    document.getElementById('roll-no-modal').classList.remove('hidden');
    setTimeout(() => input.focus(), 100);
}

window.closeRollNoModal = function () {
    document.getElementById('roll-no-modal').classList.add('hidden');
    editingRollId = null;
}

window.saveRollNo = async function () {
    if (!editingRollId) return;

    const newVal = document.getElementById('edit-roll-input').value.trim();
    const btn = document.querySelector('#roll-no-modal button:last-child');
    const originalText = btn.innerHTML;

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        // Update Firestore
        const result = await firestoreHelper.updateDocument('students', editingRollId, { rollNumber: newVal });

        if (result.success) {
            // Optimistic Local Update
            const student = allStudents.find(s => s.id === editingRollId);
            if (student) {
                student.rollNumber = newVal;
                // Refresh current view
                student.rollNumber = newVal;
                // Refresh current view (All loaded students)
                displayStudents(allStudents);
            }
            closeRollNoModal();
            showToast('success', 'Roll Number updated successfully');
        } else {
            showToast('error', 'Failed to update Roll Number');
        }
    } catch (error) {
        console.error('Error updating roll no:', error);
        showToast('error', 'An error occurred');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Initialize dashboard
export async function initDashboard() {
    // Check authentication
    authHelper.onAuthChange(async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const userDoc = await firestoreHelper.getDocument('users', user.uid);
        if (userDoc.success) {
            const userData = userDoc.data;
            const role = userData.role;

            if (role !== 'admin' && role !== 'principal') {
                alert('Access Denied! आपके पास इस पेज को देखने की अनुमति नहीं है।');
                window.location.href = '../index.html';
                return;
            }

            document.getElementById('user-name').textContent = userData.name || user.email;
            document.getElementById('admin-name').textContent = userData.name || 'Admin';

            await loadAllData();
        } else {
            alert('User data not found!');
            await authHelper.logout();
            window.location.href = 'login.html';
        }
    });

    // Setup event listeners
    setupEventListeners();

    // Check for tab parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab) {
        switchTab(tab);
    }
}

// Guard flag to prevent duplicate event listener registration
let eventListenersSetup = false;

// Setup all event listeners
function setupEventListeners() {
    // Prevent duplicate event listener registration
    if (eventListenersSetup) {
        console.log('Event listeners already setup, skipping...');
        return;
    }
    eventListenersSetup = true;
    // Logout
    // Logout listener removed - handled by onclick in dropdown

    // Make helpers available globally
    window.authHelper = authHelper;
    window.firestoreHelper = firestoreHelper;
    window.storageHelper = storageHelper; // Just in case


    // Form Listeners - Use arrow functions to ensure the handler is resolved at call time or ensure defined.
    // Ideally, functions should be defined before this runs, or we rely on window.functionName if defined earlier.
    // Since setupEventListeners is called at the end (inside initDashboard), all window.* assignments should have run by then?
    // Wait, initDashboard is called at the end. Top level assignments run immediately.
    // 'window.handleTeacherSubmit = ...' is at line 572 (top level). So it will be defined when initDashboard runs.

    // Form Listeners - EXPLICITLY REMOVED to prevent double submission.
    // The forms already have onsubmit="handle...Submit(event)" in the HTML.
    // adding addEventListener here causes the handler to run TWICE.

    document.getElementById('notification-form').addEventListener('submit', (e) => handleNotificationSubmit(e));
    // handleNotificationSubmit was async function handleNotificationSubmit... which is hoisted in module scope? 
    // Wait, modules invoke rigorous mode.
    // function decls are hoisted to top of module.
    // So handleNotificationSubmit is available.
    // But handleStudentSubmit and handleTeacherSubmit are window assignments, so they are available after execution reaches their lines.

    // Monitoring Sub-tabs
    window.switchMonitorTab = function (type) {
        const attBtn = document.getElementById('tab-monitor-attendance');
        const resBtn = document.getElementById('tab-monitor-results');
        const attView = document.getElementById('monitor-view-attendance');
        const resView = document.getElementById('monitor-view-results');

        if (type === 'attendance') {
            attBtn.className = "px-4 py-2 rounded-md bg-blue-100 text-blue-700 font-medium";
            resBtn.className = "px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50";
            attView.classList.remove('hidden');
            resView.classList.add('hidden');
            loadClassAttendance();
        } else {
            resBtn.className = "px-4 py-2 rounded-md bg-blue-100 text-blue-700 font-medium";
            attBtn.className = "px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50";
            resView.classList.remove('hidden');
            attView.classList.add('hidden');
            loadClassResults();
        }
    }

    // Quick Navigation
    window.quickNav = function (destination) {
        if (destination === 'attendance') {
            switchTab('monitoring');
            switchMonitorTab('attendance');
            const el = document.getElementById('monitoring-tab');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else if (destination === 'academics') {
            switchTab('monitoring');
            switchMonitorTab('results');
            const el = document.getElementById('monitoring-tab');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else if (destination === 'reports') {
            switchTab('teacher-reports');
            const el = document.getElementById('teacher-reports-tab');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Report Sub-tabs Logic
    window.switchReportTab = function (type) {
        const tabs = ['feedback', 'student', 'teacher'];
        tabs.forEach(t => {
            const btn = document.getElementById(`btn-report-${t}`);
            const view = document.getElementById(`view-report-${t === 'feedback' ? 'feedback' : (t === 'student' ? 'student-classwise' : 'teacher-classwise')}`);
            
            if (t === type || (type === 'student-classwise' && t === 'student') || (type === 'teacher-classwise' && t === 'teacher')) {
                if (btn) btn.className = "px-5 py-2 rounded-md bg-blue-100 text-blue-700 font-bold shadow-sm transition-all";
                if (view) view.classList.remove('hidden');
            } else {
                if (btn) btn.className = "px-5 py-2 rounded-md text-gray-600 hover:bg-gray-50 font-semibold transition-all";
                if (view) view.classList.add('hidden');
            }
        });

        if (type === 'feedback') loadTeacherReports();
        if (type === 'teacher-classwise' || type === 'teacher') displayTeacherClassReport();
    };

    // Student Class-wise Report
    window.generateStudentClassReport = function () {
        const className = document.getElementById('report-student-class-select').value;
        const tbody = document.getElementById('report-student-tbody');
        if (!className) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400 italic">Select a class to view report</td></tr>';
            return;
        }

        const filtered = allStudents.filter(s => s.class === className);
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500 font-semibold">No students found in this class</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(s => `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3">${s.rollNumber || '-'}</td>
                <td class="px-4 py-3 font-bold text-blue-900">${s.studentName || '-'}</td>
                <td class="px-4 py-3">${s.fatherName || '-'}</td>
                <td class="px-4 py-3">${s.mobile || '-'}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded-full text-xs font-bold ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${s.status || 'active'}
                    </span>
                </td>
            </tr>
        `).join('');
    };

    // Teacher Class-wise Report
    window.displayTeacherClassReport = function () {
        const tbody = document.getElementById('report-teacher-tbody');
        if (!tbody) return;

        if (allTeachers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading teacher assignments...</td></tr>';
            return;
        }

        // Sort by assigned class
        const sortedTeachers = [...allTeachers].sort((a, b) => {
            if (!a.assignedClass) return 1;
            if (!b.assignedClass) return -1;
            return a.assignedClass.localeCompare(b.assignedClass);
        });

        tbody.innerHTML = sortedTeachers.map(t => `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 font-bold text-blue-800">${t.assignedClass ? formatClass(t.assignedClass) : 'Not Assigned'}</td>
                <td class="px-4 py-3 font-semibold">${t.name || '-'}</td>
                <td class="px-4 py-3 text-sm">${t.subject || t.qualification || '-'}</td>
                <td class="px-4 py-3 text-sm">${t.mobile || t.email || '-'}</td>
            </tr>
        `).join('');
    };

    // Export Functions
    window.exportStudentClassReport = function () {
        const className = document.getElementById('report-student-class-select').value;
        if (!className) return alert('Please select a class first');
        const filtered = allStudents.filter(s => s.class === className);
        // Reuse export logic but for filtered list
        const headers = ['Roll No', 'Name', 'Father Name', 'Mobile', 'Status'];
        const csv = headers.join(',') + '\\n' + filtered.map(s => `"${s.rollNumber || ''}","${s.studentName || ''}","${s.fatherName || ''}","${s.mobile || ''}","${s.status || 'active'}"`).join('\\n');
        downloadCSV(csv, `student_report_${className}.csv`);
    };

    window.exportTeacherClassReport = function () {
        const headers = ['Class', 'Teacher Name', 'Subject', 'Contact'];
        const csv = headers.join(',') + '\\n' + allTeachers.map(t => `"${t.assignedClass || 'None'}","${t.name || ''}","${t.subject || ''}","${t.mobile || ''}"`).join('\\n');
        downloadCSV(csv, `teacher_class_report.csv`);
    };

    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }
}


// Global state for monitoring
let monitoringData = { students: [] };

// 1. Teacher Reports
async function loadTeacherReports() {
    console.log("Loading teacher reports...");
    const tbody = document.getElementById('teacher-reports-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">Loading...</td></tr>';

    try {
        const msgsRef = collection(db, 'messages');
        // Removed orderBy to avoid needing a composite index. Sorting in client-side instead.
        const q = query(msgsRef, where('type', '==', 'teacher_report'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No reports found.</td></tr>';
            return;
        }

        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by date descending (newest first)
        reports.sort((a, b) => new Date(b.date) - new Date(a.date));

        tbody.innerHTML = reports.map(data => {
            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm">${new Date(data.date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 text-sm font-semibold">${data.fromName || 'Unknown'}</td>
                    <td class="px-6 py-4 text-sm">${data.fromClass ? 'Class ' + data.fromClass : '-'}</td>
                    <td class="px-6 py-4 text-sm">${data.subject || '-'}</td>
                    <td class="px-6 py-4 text-sm max-w-xs truncate" title="${data.message}">${data.message || '-'}</td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="deleteTeacherReport('${data.id}')" class="text-red-600 hover:text-red-800 transition-colors" title="Delete Report">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading teacher reports:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
}

window.deleteTeacherReport = async function (id) {
    if (confirm('Are you sure you want to delete this report?')) {
        const result = await firestoreHelper.deleteDocument('messages', id);
        if (result.success) {
            alert('Report deleted successfully');
            loadTeacherReports();
        } else {
            alert('Error deleting report: ' + result.error);
        }
    }
};

// 2. Class Monitoring
window.loadClassMonitoringData = async function () {
    // Check which tab is active and use the appropriate class selector
    const attView = document.getElementById('monitor-view-attendance');
    const resView = document.getElementById('monitor-view-results');

    let className;
    if (resView && !resView.classList.contains('hidden')) {
        // Results tab is active, use its class selector
        className = document.getElementById('monitor-results-class-select').value;
    } else {
        // Attendance tab is active (or default), use its class selector
        className = document.getElementById('monitor-class-select').value;
    }

    if (!className) return;

    // Fetch students for this class once
    const result = await firestoreHelper.getDocuments('students', [where('class', '==', className)]);
    if (result.success) {
        monitoringData.students = result.data;
        // Trigger reload of active view
        if (attView && !attView.classList.contains('hidden')) {
            loadClassAttendance();
        } else {
            loadClassResults();
        }
    }
};

window.loadClassAttendance = async function () {
    const className = document.getElementById('monitor-class-select').value;
    const date = document.getElementById('monitor-attendance-date').value;
    const tbody = document.getElementById('monitor-attendance-body');

    if (!className || !date) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="px-6 py-4 text-center text-gray-500">Please select class and date.</td></tr>';
        return;
    }

    if (monitoringData.students.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="px-6 py-4 text-center text-gray-500">No students in this class.</td></tr>';
        return;
    }

    if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="px-6 py-4 text-center">Loading attendance...</td></tr>';

    try {
        const docId = `${className}_${date}`;
        const attDoc = await firestoreHelper.getDocument('attendance', docId);

        let records = {};
        if (attDoc.success) {
            records = attDoc.data.records || {};
            const pCount = document.getElementById('monitor-present-count');
            const aCount = document.getElementById('monitor-absent-count');
            if (pCount) pCount.textContent = attDoc.data.presentCount || 0;
            if (aCount) aCount.textContent = (monitoringData.students.length - (attDoc.data.presentCount || 0));
        } else {
            const pCount = document.getElementById('monitor-present-count');
            const aCount = document.getElementById('monitor-absent-count');
            if (pCount) pCount.textContent = '0';
            if (aCount) aCount.textContent = '0';
        }

        if (tbody) {
            tbody.innerHTML = monitoringData.students.map(student => {
                const status = records[student.id] || 'absent';
                const statusDisplay = attDoc.success
                    ? (status === 'present'
                        ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">Present</span>'
                        : '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">Absent</span>')
                    : '<span class="text-gray-400 text-xs italic">Not Marked</span>';

                return `
                    <tr class="border-b">
                        <td class="px-6 py-4">${student.studentName || student.name}</td>
                        <td class="px-6 py-4">${statusDisplay}</td>
                    </tr>
                `;
            }).join('');
        }

    } catch (e) {
        console.error(e);
    }
};

window.loadClassResults = async function () {
    // Use Results tab's own class selector
    const className = document.getElementById('monitor-results-class-select')?.value;
    const examName = document.getElementById('monitor-exam-select')?.value;
    const tbody = document.getElementById('monitor-results-body');

    if (!className) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Please select a class.</td></tr>';
        return;
    }

    if (!examName) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Please select an exam.</td></tr>';
        return;
    }

    // Show loading
    if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Loading results...</td></tr>';

    try {
        // Fetch students for this class
        const result = await firestoreHelper.getDocuments('students', [where('class', '==', className)]);

        if (!result.success || result.data.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">No students found in this class.</td></tr>';
            return;
        }

        const students = result.data;
        const examKey = examName.replace(/\s+/g, '_');

        if (tbody) {
            tbody.innerHTML = students.map(student => {
                let marks = '-';
                let details = '-';
                if (student.examMarks && student.examMarks[examKey]) {
                    marks = `<span class="font-bold text-blue-700">${student.examMarks[examKey].percentage}%</span>`;
                    details = `<span class="text-xs text-gray-500">Updated: ${new Date(student.examMarks[examKey].updatedAt).toLocaleDateString()}</span>`;
                }

                return `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="px-6 py-4 font-medium">${student.studentName || student.name}</td>
                        <td class="px-6 py-4">${marks}</td>
                        <td class="px-6 py-4">${details}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading results:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-red-500">Error loading results</td></tr>';
    }
};


// Load all data
async function loadAllData() {
    await Promise.all([
        loadAdmissions(),
        loadStudents(),
        loadTeachers(),
        loadMessages(),
        loadNotifications()
    ]);
    updateStats();
    if (typeof loadRecentFees === 'function') loadRecentFees();
}

// ========== STUDENTS MANAGEMENT ==========

async function loadStudents() {
    console.log('Loading students progressively...');
    const tbody = document.getElementById('students-table-body');
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500"><div class="flex flex-col items-center"><i class="fas fa-spinner fa-spin text-3xl mb-3 text-blue-600"></i><span>Loading students...</span></div></td></tr>';

    allStudents = [];
    let lastDoc = null;
    let hasMore = true;
    let isFirstChunk = true;

    try {
        while (hasMore) {
            // Load chunk
            const result = await firestoreHelper.getPaginatedData('students', 20, lastDoc);

            if (result.success) {
                const chunk = result.data;
                lastDoc = result.lastDoc;
                hasMore = result.hasMore;

                if (isFirstChunk) {
                    // Clear loading message and render first chunk
                    tbody.innerHTML = '';
                    allStudents = chunk;
                    displayStudents(chunk, false); // append = false (replace)
                    isFirstChunk = false;
                } else {
                    // Append subsequent chunks
                    allStudents = [...allStudents, ...chunk];
                    displayStudents(chunk, true); // append = true
                }

                // If it's the very first chunk and empty
                if (allStudents.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No students found</td></tr>';
                    return;
                }

                // Small delay to allow UI to update and not block main thread
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else {
                console.error("Error loading students chunk:", result.error);
                hasMore = false;
                if (isFirstChunk) {
                    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Error: ${result.error}</td></tr>`;
                }
            }
        }
    } catch (error) {
        console.error("Critical error in loadStudents:", error);
    }
}

function displayStudents(students, append = false) {
    const tbody = document.getElementById('students-table-body');

    const rowsHtml = students.map(student => `
        <tr class="border-b hover:bg-gray-50 animate-fade-in">
            <td class="px-6 py-4">
                <img src="${student.photo || '../assets/images/logo.png'}" alt="Student" 
                     class="w-10 h-10 rounded-full object-cover border border-gray-200"
                     loading="lazy">
            </td>
            <td class="px-6 py-4">${student.admissionId || student.rollNumber || 'N/A'}</td>
            <td class="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors group" onclick="openRollNoModal('${student.id}', '${student.rollNumber || ''}')" title="Click to Edit Roll No">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-blue-900">${student.rollNumber !== student.admissionId ? (student.rollNumber || '-') : '-'}</span>
                    <i class="fas fa-pencil-alt text-xs text-gray-400 group-hover:text-blue-600"></i>
                </div>
            </td>
            <td class="px-6 py-4 font-semibold">${student.studentName || 'N/A'}</td>
            <td class="px-6 py-4">${formatClass(student.class)}</td>
            <td class="px-6 py-4">${student.fatherName || 'N/A'}</td>
            <td class="px-6 py-4">${student.mobile || 'N/A'}</td>
            <td class="px-6 py-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${student.status || 'active'}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <button onclick="window.open('print-student.html?id=${student.id}', '_blank')" class="text-green-600 hover:text-green-800 mr-3" title="Download Form PDF">
                    <i class="fas fa-file-pdf"></i>
                </button>
                <button onclick="editStudent('${student.id}')" class="text-blue-600 hover:text-blue-800 mr-3" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteStudent('${student.id}')" class="text-red-600 hover:text-red-800" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (append) {
        tbody.insertAdjacentHTML('beforeend', rowsHtml);
    } else {
        tbody.innerHTML = rowsHtml;
    }
}

window.openAddStudentModal = function () {
    // Redirect to admission form with source parameter
    window.location.href = 'admission.html?source=admin';
};

window.closeStudentModal = function () {
    document.getElementById('student-modal').classList.add('hidden');
    currentEditingStudent = null;
};

window.editStudent = async function (id) {
    // Redirect to admission form with student ID for editing
    window.location.href = `admission.html?source=admin&studentId=${id}`;
};

window.handleStudentSubmit = async function (e) {
    e.preventDefault();

    const studentData = {
        studentName: document.getElementById('student-name').value,
        rollNumber: document.getElementById('student-roll').value,
        class: document.getElementById('student-class').value,
        dob: document.getElementById('student-dob').value,
        gender: document.getElementById('student-gender').value,
        fatherName: document.getElementById('student-father').value,
        motherName: document.getElementById('student-mother').value,
        mobile: document.getElementById('student-mobile').value,
        email: document.getElementById('student-email').value,
        address: document.getElementById('student-address').value,
        updatedAt: new Date().toISOString()
    };

    // Handle File Upload
    const photoFile = document.getElementById('student-photo').files[0];
    if (photoFile) {
        const uploadResult = await storageHelper.uploadFile(photoFile, `students/${Date.now()}_${photoFile.name}`);
        if (uploadResult.success) {
            studentData.photo = uploadResult.url;
        } else {
            alert('Failed to upload photo: ' + uploadResult.error);
            return;
        }
    }

    const studentId = document.getElementById('student-id').value;

    if (studentId) {
        // Update existing student
        const result = await firestoreHelper.updateDocument('students', studentId, studentData);
        if (result.success) {
            alert('Student updated successfully!');
            closeStudentModal();
            await loadStudents();
        } else {
            alert('Error updating student: ' + result.error);
        }
    } else {
        // Add new student
        studentData.createdAt = new Date().toISOString();
        const result = await firestoreHelper.addDocument('students', studentData);
        if (result.success) {
            alert('Student added successfully!');
            closeStudentModal();
            await loadStudents();
        } else {
            alert('Error adding student: ' + result.error);
        }
    }
}

window.deleteStudent = async function (id) {
    if (!confirm('Are you sure you want to delete this student?')) return;

    const result = await firestoreHelper.deleteDocument('students', id);
    if (result.success) {
        alert('Student deleted successfully!');
        await loadStudents();
    } else {
        alert('Error deleting student: ' + result.error);
    }
};

window.searchStudents = function () {
    const query = document.getElementById('student-search').value.toLowerCase();
    const classFilter = document.getElementById('class-filter').value;

    let filtered = allStudents;

    if (classFilter !== 'all') {
        filtered = filtered.filter(s => s.class === classFilter);
    }

    if (query) {
        filtered = filtered.filter(s =>
            (s.studentName && s.studentName.toLowerCase().includes(query)) ||
            (s.rollNumber && s.rollNumber.toLowerCase().includes(query)) ||
            (s.mobile && s.mobile.includes(query))
        );
    }

    displayStudents(filtered);
};

window.filterStudents = function () {
    searchStudents(); // Reuse search function
};

window.exportStudents = function () {
    if (allStudents.length === 0) {
        alert('No students to export!');
        return;
    }

    // Create CSV
    const headers = ['Serial No', 'Roll No', 'Name', 'Class', 'DOB', 'Gender', 'Father Name', 'Mother Name', 'Mobile', 'Email', 'Address', 'Status'];
    const rows = allStudents.map(s => [
        s.admissionId || '',
        s.rollNumber !== s.admissionId ? (s.rollNumber || '') : '',
        s.studentName || '',
        formatClass(s.class),
        s.dob || '',
        s.gender || '',
        s.fatherName || '',
        s.motherName || '',
        s.mobile || '',
        s.email || '',
        s.address || '',
        s.status || ''
    ]);

    let csv = headers.join(',') + '\\n';
    rows.forEach(row => {
        csv += row.map(field => `"${field}"`).join(',') + '\\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
};

// ========== TEACHERS MANAGEMENT ==========

async function loadTeachers() {
    console.log('Loading teachers progressively...');
    const tbody = document.getElementById('teachers-table-body');
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500"><div class="flex flex-col items-center"><i class="fas fa-spinner fa-spin text-3xl mb-3 text-blue-600"></i><span>Loading teachers...</span></div></td></tr>';

    allTeachers = [];
    let lastDoc = null;
    let hasMore = true;
    let isFirstChunk = true;

    try {
        while (hasMore) {
            // Load chunk
            const result = await firestoreHelper.getPaginatedData('teachers', 20, lastDoc);

            if (result.success) {
                const chunk = result.data;
                lastDoc = result.lastDoc;
                hasMore = result.hasMore;

                if (isFirstChunk) {
                    // Clear loading message and render first chunk
                    tbody.innerHTML = '';
                    allTeachers = chunk;
                    displayTeachers(chunk, false); // append = false
                    isFirstChunk = false;
                } else {
                    // Append chunks
                    allTeachers = [...allTeachers, ...chunk];
                    displayTeachers(chunk, true); // append = true
                }

                if (allTeachers.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No teachers found</td></tr>';
                    return;
                }

                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else {
                console.error("Error loading teachers chunk:", result.error);
                hasMore = false;
                if (isFirstChunk) {
                    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Error: ${result.error}</td></tr>`;
                }
            }
        }
    } catch (error) {
        console.error("Critical error in loadTeachers:", error);
    }
}

function displayTeachers(teachers, append = false) {
    const tbody = document.getElementById('teachers-table-body');

    const rowsHtml = teachers.map(teacher => `
        <tr class="border-b hover:bg-gray-50 animate-fade-in">
            <td class="px-6 py-4">
                <img src="${teacher.photo || '../assets/images/logo.png'}" alt="Teacher" 
                     class="w-10 h-10 rounded-full object-cover border border-gray-200"
                     loading="lazy">
            </td>
            <td class="px-6 py-4 font-semibold">${teacher.name || 'N/A'}</td>
            <td class="px-6 py-4">${teacher.email || 'N/A'}</td>
            <td class="px-6 py-4">${teacher.mobile || 'N/A'}</td>
            <td class="px-6 py-4 font-semibold">${teacher.subject || 'N/A'}</td>
            <td class="px-6 py-4 font-bold text-green-700">₹${teacher.salary || 0}</td>
            <td class="px-6 py-4">
                ${teacher.assignedClass ? `<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">${formatClass(teacher.assignedClass)}</span>` : '-'}
            </td>
            <td class="px-6 py-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${teacher.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${teacher.status || 'active'}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <button onclick="editTeacher('${teacher.id}')" class="text-blue-600 hover:text-blue-800 mr-3" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="generateSalarySlip('${teacher.id}')" class="text-green-600 hover:text-green-800 mr-3" title="Generate Salary Slip">
                    <i class="fas fa-file-invoice-dollar"></i>
                </button>
                <button onclick="deleteTeacher('${teacher.id}')" class="text-red-600 hover:text-red-800" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (append) {
        tbody.insertAdjacentHTML('beforeend', rowsHtml);
    } else {
        tbody.innerHTML = rowsHtml;
    }
}

// Generate Salary Slip Placeholder
window.generateSalarySlip = function (id) {
    const teacher = allTeachers.find(t => t.id === id);
    if (!teacher) return;
    alert(`Generating Salary Slip for ${teacher.name}... (Feature coming soon)`);
}

// Global Preview Function
window.previewImage = function (input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById(previewId).src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
};




// Duplicate editStudent function removed - using the complete version at line 393

window.handleStudentSubmit = async function (e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

    try {
        const studentData = {
            rollNumber: document.getElementById('student-roll').value,
            studentName: document.getElementById('student-name').value,
            class: document.getElementById('student-class').value,
            dob: document.getElementById('student-dob').value,
            gender: document.getElementById('student-gender').value,
            fatherName: document.getElementById('student-father').value,
            motherName: document.getElementById('student-mother').value,
            mobile: document.getElementById('student-mobile').value,
            email: document.getElementById('student-email').value,
            address: document.getElementById('student-address').value,
            admissionDate: document.getElementById('student-admission-date').value,
            updatedAt: new Date().toISOString()
        };

        const studentId = document.getElementById('student-id').value;
        const photoFile = document.getElementById('student-photo').files[0];

        // Handle File Upload
        if (photoFile) {
            const uploadResult = await storageHelper.uploadFile(photoFile, `students/${Date.now()}_${photoFile.name}`);
            if (uploadResult.success) {
                studentData.photo = uploadResult.url;
            } else {
                throw new Error('Failed to upload photo: ' + uploadResult.error);
            }
        }

        let result;
        if (studentId) {
            result = await firestoreHelper.updateDocument('students', studentId, studentData);
        } else {
            studentData.createdAt = new Date().toISOString();
            result = await firestoreHelper.addDocument('students', studentData);
        }

        if (result.success) {
            // Show success UI immediately without alert blocking
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce';
            successMsg.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Saved Successfully!';
            document.body.appendChild(successMsg);

            setTimeout(() => successMsg.remove(), 3000);

            document.getElementById('student-modal').classList.add('hidden');
            loadStudents();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
};

window.openAddTeacherModal = function () {
    currentEditingTeacher = null;
    document.getElementById('teacher-modal-title').textContent = 'Add Teacher';
    document.getElementById('teacher-form').reset();
    document.getElementById('teacher-id').value = '';
    document.getElementById('teacher-preview').src = '../assets/images/logo.png'; // Reset preview
    document.getElementById('teacher-modal').classList.remove('hidden');
};

window.editTeacher = async function (id) {
    const teacher = allTeachers.find(t => t.id === id);
    if (!teacher) return;

    currentEditingTeacher = teacher;
    document.getElementById('teacher-modal-title').textContent = 'Edit Teacher';
    document.getElementById('teacher-id').value = teacher.id;
    document.getElementById('teacher-name').value = teacher.name || '';
    document.getElementById('teacher-email').value = teacher.email || '';
    document.getElementById('teacher-mobile').value = teacher.mobile || '';
    document.getElementById('teacher-qualification').value = teacher.qualification || '';
    document.getElementById('teacher-subject').value = teacher.subject || '';
    document.getElementById('teacher-assigned-class').value = teacher.assignedClass || '';
    document.getElementById('teacher-joining-date').value = teacher.joiningDate || '';
    document.getElementById('teacher-salary').value = teacher.salary || '';
    document.getElementById('teacher-preview').src = teacher.photo || '../assets/images/logo.png'; // Set preview

    document.getElementById('teacher-modal').classList.remove('hidden');
};

window.handleTeacherSubmit = async function (e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

    try {
        const teacherData = {
            name: document.getElementById('teacher-name').value,
            email: document.getElementById('teacher-email').value,
            mobile: document.getElementById('teacher-mobile').value,
            qualification: document.getElementById('teacher-qualification').value,
            subject: document.getElementById('teacher-subject').value,
            assignedClass: document.getElementById('teacher-assigned-class').value,
            salary: parseFloat(document.getElementById('teacher-salary').value) || 0,
            joiningDate: document.getElementById('teacher-joining-date').value,
            status: 'active',
            updatedAt: new Date().toISOString()
        };

        const password = document.getElementById('teacher-password').value;
        const teacherId = document.getElementById('teacher-id').value;
        const photoFile = document.getElementById('teacher-photo').files[0];

        // Handle File Upload
        if (photoFile) {
            const uploadResult = await storageHelper.uploadFile(photoFile, `teachers/${Date.now()}_${photoFile.name}`);
            if (uploadResult.success) {
                teacherData.photo = uploadResult.url;
            } else {
                throw new Error('Failed to upload photo: ' + uploadResult.error);
            }
        }

        if (teacherId) {
            // Update existing teacher
            const result = await firestoreHelper.updateDocument('teachers', teacherId, teacherData);
            if (result.success) {
                showSuccessToast('Teacher updated successfully!');
                closeTeacherModal();
                loadTeachers(); // Don't await, let it load in background
            } else {
                throw new Error('Error updating teacher: ' + result.error);
            }
        } else {
            // Add new teacher AND Create Auth Account
            if (!password) {
                throw new Error('Password is required for new teachers!');
            }

            teacherData.createdAt = new Date().toISOString();

            // 1. Create Auth Account
            const authResult = await authHelper.createSecondaryAccount(teacherData.email, password, {
                name: teacherData.name,
                role: 'teacher'
            });

            if (authResult.success) {
                // 2. Add to 'teachers' collection with the real UID
                teacherData.uid = authResult.uid;
                const result = await firestoreHelper.addDocument('teachers', teacherData);

                if (result.success) {
                    showSuccessToast('Teacher Account Created!');
                    closeTeacherModal();
                    loadTeachers();
                } else {
                    throw new Error('Account created but failed to save profile: ' + result.error);
                }
            } else {
                throw new Error('Error creating login account: ' + authResult.error);
            }
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Helper for consistency
function showSuccessToast(message) {
    const successMsg = document.createElement('div');
    successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce';
    successMsg.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 3000);
}

window.deleteTeacher = async function (id) {
    if (!confirm('Are you sure you want to delete this teacher?')) return;

    const result = await firestoreHelper.deleteDocument('teachers', id);
    if (result.success) {
        alert('Teacher deleted successfully!');
        await loadTeachers();
    } else {
        alert('Error deleting teacher: ' + result.error);
    }
};

window.searchTeachers = function () {
    const query = document.getElementById('teacher-search').value.toLowerCase();

    const filtered = allTeachers.filter(t =>
        (t.name && t.name.toLowerCase().includes(query)) ||
        (t.email && t.email.toLowerCase().includes(query)) ||
        (t.mobile && t.mobile.includes(query)) ||
        (t.subject && t.subject.toLowerCase().includes(query))
    );

    displayTeachers(filtered);
};

// ========== ADMISSIONS MANAGEMENT ==========

async function loadAdmissions() {
    console.log('Loading admissions progressively...');
    const container = document.getElementById('admissions-list');
    container.innerHTML = '<div class="text-gray-500 text-center py-8"><i class="fas fa-spinner fa-spin text-2xl mb-2 text-blue-600"></i><p>Loading admissions...</p></div>';

    allAdmissions = [];
    let lastDoc = null;
    let hasMore = true;
    let isFirstChunk = true;

    try {
        while (hasMore) {
            const result = await firestoreHelper.getPaginatedData('admissions', 15, lastDoc, 'submittedAt');

            if (result.success) {
                const chunk = result.data;
                lastDoc = result.lastDoc;
                hasMore = result.hasMore;

                // Stop if no data returned
                if (result.data.length === 0) {
                    hasMore = false;
                }

                if (isFirstChunk) {
                    // container.innerHTML = ''; // Don't clear here, let displayAdmissions handle it or clear before loop
                    allAdmissions = chunk;

                    // Filter based on current dropdown selection
                    const currentFilter = document.getElementById('admission-filter').value;
                    const filteredChunk = currentFilter === 'all' ? chunk : chunk.filter(a => a.status === currentFilter);

                    if (filteredChunk.length > 0) {
                        displayAdmissions(filteredChunk, false);
                    } else {
                        document.getElementById('admissions-list').innerHTML = `<p class="text-gray-500 text-center py-8">No ${currentFilter !== 'all' ? currentFilter : ''} admissions found</p>`;
                    }

                    displayRecentActivity();
                    isFirstChunk = false;
                } else {
                    allAdmissions = [...allAdmissions, ...chunk];

                    // Filter based on current dropdown selection
                    const currentFilter = document.getElementById('admission-filter').value;
                    const filteredChunk = currentFilter === 'all' ? chunk : chunk.filter(a => a.status === currentFilter);

                    if (filteredChunk.length > 0) {
                        displayAdmissions(filteredChunk, true);
                    }
                }

                if (allAdmissions.length === 0) {
                    document.getElementById('admissions-list').innerHTML = '<p class="text-gray-500 text-center py-8">No admissions found</p>';
                    return;
                }

                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else {
                console.error("Error loading admissions chunk:", result.error);
                hasMore = false;
                if (isFirstChunk) {
                    document.getElementById('admissions-list').innerHTML = `<p class="text-red-500 text-center py-8">Error: ${result.error}</p>`;
                }
            }
        }
    } catch (error) {
        console.error("Critical error in loadAdmissions:", error);
    }
}

function displayAdmissions(admissions, append = false) {
    const container = document.getElementById('admissions-list');

    const html = admissions.map(admission => `
        <div class="bg-white border-2 border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow animate-fade-in block mb-4">
            <div class="flex justify-between items-start mb-4">
                <div class="flex-1">
                    <h4 class="text-lg font-bold text-gray-800">${admission.student_name || 'N/A'}</h4>
                    <div class="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                        <p><i class="fas fa-graduation-cap mr-2"></i>Class: ${admission.class || 'N/A'}</p>
                        <p><i class="fas fa-calendar mr-2"></i>DOB: ${admission.dob ? admission.dob.split('-').reverse().join('/') : 'N/A'}</p>
                        <p><i class="fas fa-phone mr-2"></i>${admission.mobile || 'N/A'}</p>
                        <p><i class="fas fa-envelope mr-2"></i>${admission.email || 'N/A'}</p>
                    </div>
                    <p class="text-sm text-gray-600 mt-2"><i class="fas fa-user mr-2"></i>Father: ${admission.father_name || 'N/A'}</p>
                </div>
                <div class="text-right ml-4">
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${admission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            admission.status === 'approved' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
        }">
                        ${admission.status || 'pending'}
                    </span>
                    <p class="text-xs text-gray-500 mt-2">
                        ${new Date(admission.submittedAt || admission.createdAt).toLocaleDateString('hi-IN')}
                    </p>
                </div>
            </div>
            <div class="flex gap-2">
                ${admission.status === 'pending' ? `
                    <button onclick="updateAdmissionStatus('${admission.id}', 'approved')" 
                        class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                        <i class="fas fa-check mr-1"></i>Approve
                    </button>
                    <button onclick="updateAdmissionStatus('${admission.id}', 'rejected')" 
                        class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
                        <i class="fas fa-times mr-1"></i>Reject
                    </button>
                ` : ''}
                <button onclick="viewAdmissionDetails('${admission.id}')" 
                    class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                    <i class="fas fa-eye mr-1"></i>View Details
                </button>
            </div>
        </div>
    `).join('');

    if (append) {
        container.insertAdjacentHTML('beforeend', html);
    } else {
        container.innerHTML = html;
    }
}

window.updateAdmissionStatus = async function (id, status) {
    if (!confirm(`Are you sure you want to ${status} this application?`)) return;

    const result = await firestoreHelper.updateDocument('admissions', id, { status });
    if (result.success) {
        // If approved, create student record
        if (status === 'approved') {
            const admission = allAdmissions.find(a => a.id === id);
            if (admission) {
                await createStudentFromAdmission(admission);
            }
        }
        alert(`Application ${status} successfully!`);
        await loadAdmissions();
        await loadStudents();
    } else {
        alert('Error updating status: ' + result.error);
    }
};

async function createStudentFromAdmission(admission) {
    const studentData = {
        studentName: admission.student_name,
        rollNumber: '', // Manual assignment required
        serialNumber: admission.id, // Display ID (PMS-XXXXX)
        class: admission.class,
        dob: admission.dob,
        gender: admission.gender || '',
        fatherName: admission.father_name,
        fatherOccupation: admission.father_occupation || '',
        fatherCompany: admission.father_company || '', // key from form submission
        fatherPost: admission.father_post || '',
        motherName: admission.mother_name,
        motherOccupation: admission.mother_occupation || '',
        mobile: admission.mobile,
        email: admission.email,
        address: admission.address,
        postalAddress: admission.postal_address || '', // check admission keys
        guardianName: admission.guardian_name || '',
        guardianAddress: admission.guardian_address || '',
        guardianRelation: admission.guardian_relation || '',
        lastSchool: admission.lastInst || admission.last_school || '',
        motherTongue: admission.tongue || admission.mother_tongue || '',
        religion: admission.religion || '',
        durationOfStay: admission.stayUp || admission.duration_of_stay || '',

        // Documents
        photo: admission.documents?.photo || '',
        birthCertificate: admission.documents?.birthCertificate || '',
        aadharCard: admission.documents?.aadharCard || '',
        casteCert: admission.documents?.casteCert || '',
        domicileCert: admission.documents?.domicileCert || '',

        admissionId: admission.id, // Link back to admission
        status: 'active',
        createdAt: new Date().toISOString()
    };

    await firestoreHelper.addDocument('students', studentData);
}

// Admission Modal Functions
window.closeAdmissionModal = function () {
    document.getElementById('admission-modal').classList.add('hidden');
};

window.viewAdmissionDetails = function (id) {
    // Check for mobile device (width < 768px)
    if (window.innerWidth < 768) {
        // Create toast element
        const toast = document.createElement('div');
        // Added style z-index explicitly to ensure it overrides everything
        toast.style.zIndex = '999999';
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white px-6 py-4 rounded-full shadow-2xl text-center min-w-[280px] animate-fade-in flex items-center justify-center gap-3 border border-gray-700 backdrop-blur-sm';
        toast.innerHTML = `
            <i class="fas fa-desktop text-yellow-400 text-xl"></i>
            <div>
                <p class="font-bold text-sm">कृपया डेस्कटॉप मोड ऑन करें</p>
            </div>
        `;
        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => toast.remove(), 500);
        }, 3000);

        // Continue to open modal (removed return)
    }

    const admission = allAdmissions.find(a => a.id === id);
    if (!admission) return;

    // Populate Fields
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '-';
    };

    set('preview-name', admission.student_name);
    set('preview-class', admission.class);
    set('preview-dob', admission.dob ? admission.dob.split('-').reverse().join('/') : 'N/A');
    set('preview-father', admission.father_name);
    set('preview-father-occ', admission.father_occupation);
    set('preview-mother', admission.mother_name);
    set('preview-mother-occ', admission.mother_occupation);
    set('preview-mobile', admission.mobile);
    set('preview-email', admission.email);
    set('preview-address', admission.address);
    set('preview-prev-school', admission.previous_school || 'N/A');

    // Status Banner Updates
    const statusSpan = document.getElementById('modal-status');
    const banner = document.getElementById('modal-status-banner');
    statusSpan.textContent = (admission.status || 'Pending').toUpperCase();

    // Style banner based on status
    banner.className = `p-4 rounded-lg border-l-4 mb-6 flex justify-between items-center ${admission.status === 'approved' ? 'bg-green-100 border-green-500 text-green-800' :
        admission.status === 'rejected' ? 'bg-red-100 border-red-500 text-red-800' :
            'bg-yellow-100 border-yellow-500 text-yellow-800'
        }`;

    // Images
    const docs = admission.documents || {};
    const setupImg = (imgId, linkId, url, defaultText) => {
        const img = document.getElementById(imgId);
        const link = document.getElementById(linkId);
        if (url) {
            img.src = url;
            link.href = url;
            link.classList.remove('pointer-events-none', 'opacity-50');
        } else {
            img.src = 'https://via.placeholder.com/150?text=Not+Uploaded';
            link.removeAttribute('href');
            link.classList.add('pointer-events-none', 'opacity-50');
        }
    };

    setupImg('preview-photo', 'preview-photo', docs.photo); // Photo is just an img, no link wrapper in my HTML but I'll fix if needed. Actually photo is raw img.
    // Correction for photo:
    const photoImg = document.getElementById('preview-photo');
    if (docs.photo) photoImg.src = docs.photo;
    else photoImg.src = 'https://via.placeholder.com/150?text=No+Photo';

    setupImg('preview-img-birth', 'preview-link-birth', docs.birthCertificate);
    setupImg('preview-img-aadhar', 'preview-link-aadhar', docs.aadharCard);

    // Actions
    const bottomActions = document.getElementById('modal-actions-bottom');
    const topActions = document.getElementById('modal-actions-top');

    // Clear previous actions
    bottomActions.innerHTML = '';
    topActions.innerHTML = '';

    const closeBtn = `<button onclick="closeAdmissionModal()" class="px-6 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 font-bold text-white">Close Preview</button>`;

    if (admission.status === 'pending') {
        const actions = `
            <div class="flex gap-4">
                <button onclick="updateAdmissionStatus('${admission.id}', 'rejected'); closeAdmissionModal()" 
                    class="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-white shadow-md">
                    <i class="fas fa-times mr-2"></i>Reject Application
                </button>
                <button onclick="updateAdmissionStatus('${admission.id}', 'approved'); closeAdmissionModal()" 
                    class="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-bold text-white shadow-md">
                    <i class="fas fa-check mr-2"></i>Approve & Admit
                </button>
            </div>
        `;
        bottomActions.innerHTML = closeBtn + actions;
        topActions.innerHTML = `<span class="bg-blue-600 text-white text-xs px-2 py-1 rounded">Action Required</span>`;
    } else {
        bottomActions.innerHTML = closeBtn;
    }

    document.getElementById('admission-modal').classList.remove('hidden');
};

window.filterAdmissions = function () {
    const filter = document.getElementById('admission-filter').value;
    const filtered = filter === 'all' ? allAdmissions : allAdmissions.filter(a => a.status === filter);
    displayAdmissions(filtered);
};

function displayRecentActivity() {
    const container = document.getElementById('recent-activity');
    const recent = allAdmissions.slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No recent activity</p>';
        return;
    }

    container.innerHTML = recent.map(admission => `
        <div class="border-b pb-3">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-semibold text-gray-800">${admission.student_name || 'N/A'}</p>
                    <p class="text-sm text-gray-600">Applied for Class ${admission.class || 'N/A'}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${admission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            admission.status === 'approved' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
        }">
                    ${admission.status || 'pending'}
                </span>
            </div>
        </div>
    `).join('');
}

// ========== MESSAGES MANAGEMENT ==========

async function loadMessages() {
    console.log('Loading messages progressively...');
    const container = document.getElementById('messages-list');
    container.innerHTML = '<div class="text-gray-500 text-center py-8"><i class="fas fa-spinner fa-spin text-2xl mb-2 text-blue-600"></i><p>Loading messages...</p></div>';

    allMessages = [];
    let lastDoc = null;
    let hasMore = true;
    let isFirstChunk = true;

    try {
        while (hasMore) {
            const result = await firestoreHelper.getPaginatedData('contacts', 25, lastDoc);

            if (result.success) {
                const chunk = result.data;
                lastDoc = result.lastDoc;
                hasMore = result.hasMore;

                if (isFirstChunk) {
                    container.innerHTML = '';
                    allMessages = chunk;
                    displayMessages(chunk, false);
                    isFirstChunk = false;
                } else {
                    allMessages = [...allMessages, ...chunk];
                    displayMessages(chunk, true);
                }

                if (allMessages.length === 0) {
                    container.innerHTML = '<p class="text-gray-500 text-center py-8">No messages yet</p>';
                    return;
                }

                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else {
                console.error("Error loading messages chunk:", result.error);
                hasMore = false;
                if (isFirstChunk) {
                    container.innerHTML = `<p class="text-red-500 text-center py-8">Error: ${result.error}</p>`;
                }
            }
        }
    } catch (error) {
        console.error("Critical error in loadMessages:", error);
    }
}

function displayMessages(messages, append = false) {
    const container = document.getElementById('messages-list');

    const html = messages.map(msg => `
        <div class="bg-white border-2 border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow animate-fade-in block mb-4 ${!msg.read ? 'border-l-4 border-l-blue-600' : ''}">
            <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                    <h4 class="font-bold text-gray-800">${msg.name || 'Anonymous'}</h4>
                    <p class="text-sm text-gray-600">
                        <i class="fas fa-envelope mr-2"></i>${msg.email || 'N/A'}
                        <i class="fas fa-phone ml-4 mr-2"></i>${msg.phone || 'N/A'}
                    </p>
                </div>
                <div class="text-right">
                    ${!msg.read ? '<span class="bg-blue-600 text-white px-2 py-1 rounded text-xs">New</span>' : ''}
                    <p class="text-xs text-gray-500 mt-1">
                        ${new Date(msg.createdAt).toLocaleDateString('hi-IN')}
                    </p>
                </div>
            </div>
            <p class="text-gray-700 mb-3">${msg.message || 'No message'}</p>
            <div class="flex gap-2">
                ${!msg.read ? `
                    <button onclick="markAsRead('${msg.id}')" 
                        class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                        <i class="fas fa-check mr-1"></i>Mark as Read
                    </button>
                ` : ''}
                <button onclick="deleteMessage('${msg.id}')" 
                    class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
                    <i class="fas fa-trash mr-1"></i>Delete
                </button>
            </div>
        </div>
    `).join('');

    if (append) {
        container.insertAdjacentHTML('beforeend', html);
    } else {
        container.innerHTML = html;
    }
}

window.markAsRead = async function (id) {
    const result = await firestoreHelper.updateDocument('contacts', id, { read: true });
    if (result.success) {
        await loadMessages();
    }
};

window.deleteMessage = async function (id) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    const result = await firestoreHelper.deleteDocument('contacts', id);
    if (result.success) {
        alert('Message deleted successfully!');
        await loadMessages();
    }
};

window.filterMessages = function () {
    const filter = document.getElementById('message-filter').value;
    const filtered = filter === 'all' ? allMessages :
        filter === 'new' ? allMessages.filter(m => !m.read) :
            allMessages.filter(m => m.read);
    displayMessages(filtered);
};

// ========== NOTIFICATIONS MANAGEMENT ==========

async function loadNotifications() {
    console.log('Loading notifications progressively...');
    const container = document.getElementById('notifications-list');
    container.innerHTML = '<div class="text-gray-500 text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</div>';

    allNotifications = [];
    let lastDoc = null;
    let hasMore = true;
    let isFirstChunk = true;

    try {
        while (hasMore) {
            const result = await firestoreHelper.getPaginatedData('notifications', 20, lastDoc);

            if (result.success) {
                const chunk = result.data;
                lastDoc = result.lastDoc;
                hasMore = result.hasMore;

                if (isFirstChunk) {
                    container.innerHTML = '';
                    allNotifications = chunk;
                    displayNotifications(chunk, false);
                    isFirstChunk = false;
                } else {
                    allNotifications = [...allNotifications, ...chunk];
                    displayNotifications(chunk, true);
                }

                if (allNotifications.length === 0) {
                    container.innerHTML = '<p class="text-gray-500 text-center py-4">No notifications yet</p>';
                    return;
                }

                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else {
                console.error("Error loading notifications chunk:", result.error);
                hasMore = false;
                if (isFirstChunk) {
                    container.innerHTML = '<p class="text-gray-500 text-center py-4">No notifications yet</p>';
                }
            }
        }
    } catch (error) {
        console.error("Critical error in loadNotifications:", error);
    }
}

function displayNotifications(notifications, append = false) {
    const container = document.getElementById('notifications-list');

    const html = notifications.map(notif => `
        <div class="bg-white border-2 border-gray-200 rounded-lg p-4 flex justify-between items-start animate-fade-in mb-3">
            <div class="flex items-center gap-3">
                <i class="fas ${notif.icon || 'fa-bell'} text-yellow-500 text-xl mt-1"></i>
                <p class="text-gray-800">${notif.message}</p>
            </div>
            <button onclick="deleteNotification('${notif.id}')" 
                class="text-red-600 hover:text-red-800 ml-2">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    if (append) {
        container.insertAdjacentHTML('beforeend', html);
    } else {
        container.innerHTML = html;
    }
}

async function handleNotificationSubmit(e) {
    e.preventDefault();

    const icon = document.getElementById('notif-icon').value;
    const message = document.getElementById('notif-message').value;

    const result = await firestoreHelper.addDocument('notifications', {
        icon: icon,
        message: message,
        active: true
    });

    if (result.success) {
        alert('Notification added successfully!');
        e.target.reset();
        await loadNotifications();
    } else {
        alert('Error adding notification: ' + result.error);
    }
}

window.deleteNotification = async function (id) {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    const result = await firestoreHelper.deleteDocument('notifications', id);
    if (result.success) {
        alert('Notification deleted successfully!');
        await loadNotifications();
    }
};

// ========== UTILITY FUNCTIONS ==========

function formatClass(cls) {
    const classMap = {
        'lkg': 'LKG',
        'ukg': 'UKG',
        '1': '1',
        '2': '2',
        '3': '3',
        '4': '4',
        '5': '5',
        '6': '6',
        '7': '7',
        '8': '8'
    };
    return classMap[cls] || cls;
}

function updateNotificationDots() {
    // 1. Check pending admissions
    const pendingAdmissions = allAdmissions.filter(a => a.status === 'pending').length;
    const admissionBadge = document.getElementById('nav-admissions-badge');
    if (admissionBadge) {
        if (pendingAdmissions > 0) {
            admissionBadge.classList.remove('hidden');
        } else {
            admissionBadge.classList.add('hidden');
        }
    }

    // 2. Check pending messages
    // Assuming messages have a 'read' status, otherwise count all or implement logic later
    // For now, if there are any messages, let's treat new ones since last session as notification worthy
    // Or just show dot if there are any messages (simple version)
    // Better: Show dot if count > 0 (since we don't have read status yet)
    // Actually, let's stick to showing dot if there are pending items of some sort
    // For messages, we'll just check if total > 0 for now as 'unread' logic isn't fully built
    const messageBadge = document.getElementById('nav-messages-badge');
    if (messageBadge) {
        if (allMessages.length > 0) { // Ideally filter by !msg.read
            messageBadge.classList.remove('hidden');
        } else {
            messageBadge.classList.add('hidden');
        }
    }
}

function updateStats() {
    document.getElementById('total-admissions').textContent = allAdmissions.length;
    document.getElementById('pending-admissions').textContent = allAdmissions.filter(a => a.status === 'pending').length;
    document.getElementById('total-contacts').textContent = allMessages.length;
    document.getElementById('total-students').textContent = allStudents.length;

    // Update sidebar dots whenever stats update
    updateNotificationDots();
}

// Consolidated Tab Switching Function
window.switchTab = function (tab) {
    // 1. Hide all tab content sections
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    // 2. Clear active state from all navigation buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // 3. Show the requested tab content
    const content = document.getElementById(`${tab}-tab`);
    if (content) {
        content.classList.add('active');
        // Scroll to top of content area on mobile
        if (window.innerWidth < 768) window.scrollTo({ top: 300, behavior: 'smooth' });
    }

    // 4. Highlight the matching nav button
    // Try finding by exact onclick match (most reliable for our static structure)
    let btn = document.querySelector(`button[onclick*="switchTab('${tab}')"]`);
    
    // Fallback: search within .tab-btn class for text content or fuzzy onclick
    if (!btn) {
        const allTabBtns = document.querySelectorAll('.tab-btn');
        btn = Array.from(allTabBtns).find(b => 
            b.onclick?.toString().includes(`'${tab}'`) || 
            b.textContent.toLowerCase().includes(tab.split('-')[0])
        );
    }

    if (btn) btn.classList.add('active');

    // 5. Special handlers for specific tabs
    if (tab === 'teacher-reports') {
        if (typeof loadTeacherReports === 'function') loadTeacherReports();
    }
    
    // If we're on dashboard, maybe refresh stats
    if (tab === 'dashboard' && typeof updateStats === 'function') {
        updateStats();
    }
};

// Initialize on load
initDashboard();


// Monitoring Sub-tabs
// Log page view
analyticsHelper.logPageView('admin_dashboard');

// ========== FEE MANAGEMENT FUNCTIONS ==========
// Helper to extract student name from various possible database keys
const getStudentDisplayName = (s) => {
    if (!s) return 'Unknown Student';
    return s.studentName || s.name || s.student_name || s.scholarName || s.fullName || 'Unknown';
};

// Helper to extract roll number from various possible database keys
const getStudentDisplayRoll = (s) => {
    if (!s) return 'No Roll';
    return s.rollNumber || s.rollNo || s.roll_no || s.admissionId || 'No Roll';
};

window.openAddFeeModal = function () {
    document.getElementById('add-fee-modal').classList.remove('hidden');
    document.getElementById('fee-year').value = new Date().getFullYear();
    // Reset form
    document.getElementById('add-fee-form').reset();
    document.getElementById('fee-student-id').innerHTML = '<option value="">First Select Class</option>';
};

window.closeAddFeeModal = function () {
    document.getElementById('add-fee-modal').classList.add('hidden');
};

window.populateFeeStudentList = function () {
    const classVal = document.getElementById('fee-class-select').value;
    const studentSelect = document.getElementById('fee-student-id');
    
    if (!classVal) {
        studentSelect.innerHTML = '<option value="">First Select Class</option>';
        return;
    }

    const filtered = allStudents.filter(s => s.class && s.class.toLowerCase() === classVal.toLowerCase());
    
    if (filtered.length === 0) {
        studentSelect.innerHTML = '<option value="">No students in this class</option>';
        return;
    }

    studentSelect.innerHTML = '<option value="">Select Student</option>' + 
        filtered.sort((a,b) => getStudentDisplayName(a).localeCompare(getStudentDisplayName(b)))
        .map(s => `<option value="${s.id}">${getStudentDisplayName(s)} (${getStudentDisplayRoll(s)})</option>`)
        .join('');
};

window.handleFeeSubmit = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('save-fee-btn');
    const originalText = btn.innerHTML;
    
    const studentId = document.getElementById('fee-student-id').value;
    const classVal = document.getElementById('fee-class-select').value;
    const month = document.getElementById('fee-month').value;
    const year = parseInt(document.getElementById('fee-year').value);
    const amount = parseFloat(document.getElementById('fee-amount').value);

    // Find student for history record
    const student = allStudents.find(s => s.id === studentId);
    const studentName = getStudentDisplayName(student);

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        await addDoc(collection(db, 'fees'), {
            studentId,
            studentName,
            class: classVal,
            month,
            year,
            amount,
            submittedAt: new Date().toISOString(),
            timestamp: new Date()
        });

        window.showToast('success', 'Fee Record Saved Successfully!');
        closeAddFeeModal();
        loadRecentFees(); // Refresh dashboard table
    } catch (error) {
        console.error("Fee saving error:", error);
        window.showToast('error', 'Error: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.openViewFeeModal = function () {
    document.getElementById('view-fee-modal').classList.remove('hidden');
    loadFeeHistory();
};

window.closeViewFeeModal = function () {
    document.getElementById('view-fee-modal').classList.add('hidden');
};

window.loadFeeHistory = async function () {
    const tbody = document.getElementById('fee-history-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

    try {
        const q = query(collection(db, 'fees'), orderBy('timestamp', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        window.allFeeRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFeeHistory(window.allFeeRecords);
    } catch (error) {
        console.error("Error loading history:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
};

window.renderFeeHistory = function (records) {
    const tbody = document.getElementById('fee-history-tbody');
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500">No records found.</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(r => `
        <tr class="border-b hover:bg-gray-50">
            <td class="px-6 py-4 font-bold uppercase">${r.class}</td>
            <td class="px-6 py-4 font-semibold text-blue-900">${r.studentName || 'Unknown Student'}</td>
            <td class="px-6 py-4">${r.month} ${r.year}</td>
            <td class="px-6 py-4 font-bold text-green-700">₹${r.amount}</td>
            <td class="px-6 py-4 text-gray-500 text-xs">${new Date(r.submittedAt).toLocaleDateString()}</td>
        </tr>
    `).join('');
};

window.filterFeeHistory = function () {
    const classFilter = document.getElementById('view-fee-class').value;
    const searchVal = document.getElementById('view-fee-search').value.toLowerCase();
    
    let filtered = window.allFeeRecords || [];
    
    if (classFilter) {
        filtered = filtered.filter(r => r.class === classFilter);
    }
    
    if (searchVal) {
        filtered = filtered.filter(r => 
            r.studentName.toLowerCase().includes(searchVal) || 
            r.class.toLowerCase().includes(searchVal)
        );
    }
    
    renderFeeHistory(filtered);
};

window.loadRecentFees = async function () {
    const container = document.getElementById('recent-fees-tbody');
    if (!container) return;

    const classFilter = document.getElementById('recent-fee-class-filter')?.value;
    
    try {
        let q;
        // Simplified query to avoid index requirement for now if filter is not used
        if (!classFilter) {
            q = query(collection(db, 'fees'), orderBy('timestamp', 'desc'), limit(10));
        } else {
            // This might still error if index is missing, but it's what was requested
            q = query(collection(db, 'fees'), where('class', '==', classFilter), orderBy('timestamp', 'desc'), limit(10));
        }

        const snapshot = await getDocs(q);
        const fees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (fees.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No recent transactions.</td></tr>';
            return;
        }

        container.innerHTML = fees.map(f => `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3">
                    <div class="font-bold text-gray-800">${f.studentName || 'Unknown Student'}</div>
                    <div class="text-xs text-gray-500 uppercase">Class ${f.class}</div>
                </td>
                <td class="px-4 py-3 text-gray-600">${f.month} ${f.year}</td>
                <td class="px-4 py-3 font-bold text-green-600">₹${f.amount}</td>
                <td class="px-4 py-3 text-right text-xs text-gray-400">
                    ${new Date(f.submittedAt).toLocaleDateString()}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Error loading recent fees:", error);
    }
};

// Update switchTab to include loadRecentFees
const originalSwitchTab = window.switchTab;
window.switchTab = function (tab) {
    if (originalSwitchTab) originalSwitchTab(tab);
    if (tab === 'fees') {
        loadRecentFees();
    }
};

// ========== GLOBAL MODAL FUNCTIONS ==========
window.closeTeacherModal = function () {
    const modal = document.getElementById('teacher-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('teacher-form').reset();
        document.getElementById('teacher-preview').src = '../assets/images/logo/logo.png';
        currentEditingTeacher = null;
    }
};

window.openAddTeacherModal = function () {
    const modal = document.getElementById('teacher-modal');
    if (modal) {
        document.getElementById('teacher-form').reset();
        document.getElementById('teacher-id').value = '';
        document.getElementById('teacher-preview').src = '../assets/images/logo/logo.png';
        document.getElementById('teacher-modal-title').textContent = 'Add Teacher';
        // Reset specific fields
        document.getElementById('teacher-password').placeholder = 'Set login password';

        modal.classList.remove('hidden');
    }
};

// Ensure other modals also have their close functions if not defined
if (!window.closeStudentModal) {
    window.closeStudentModal = function () {
        document.getElementById('student-modal').classList.add('hidden');
        document.getElementById('student-form').reset();
        document.getElementById('student-preview').src = '../assets/images/logo/logo.png';
        currentEditingStudent = null;
        document.getElementById('student-modal-title').textContent = 'Add Student';
    };
}

// User Profile & Password Management
window.toggleUserDropdown = function () {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('hidden');
    // Close if clicked outside
    if (!dropdown.classList.contains('hidden')) {
        document.addEventListener('click', closeDropdownOnClickOutside);
    } else {
        document.removeEventListener('click', closeDropdownOnClickOutside);
    }
}

function closeDropdownOnClickOutside(e) {
    const dropdown = document.getElementById('user-dropdown');
    const button = document.querySelector('button[onclick="toggleUserDropdown()"]');
    if (!dropdown.contains(e.target) && !button.contains(e.target)) {
        dropdown.classList.add('hidden');
        document.removeEventListener('click', closeDropdownOnClickOutside);
    }
}

window.openChangePasswordModal = function () {
    document.getElementById('user-dropdown').classList.add('hidden'); // Close dropdown
    const modal = document.getElementById('change-password-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        document.getElementById('password-modal-content').classList.remove('scale-95', 'opacity-0');
        document.getElementById('password-modal-content').classList.add('scale-100', 'opacity-100');
    }, 10);
    document.getElementById('change-password-form').reset();
}

window.closeChangePasswordModal = function () {
    const content = document.getElementById('password-modal-content');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        const modal = document.getElementById('change-password-modal');
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 300);
}

window.togglePasswordVisibility = function (id) {
    const input = document.getElementById(id);
    const icon = input.parentElement.querySelector('i.fa-eye') || input.parentElement.querySelector('i.fa-eye-slash');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

window.handlePasswordChange = async function (e) {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const btn = document.getElementById('save-password-btn');

    if (newPassword !== confirmPassword) {
        showToast('error', 'New passwords do not match!');
        return;
    }

    if (newPassword.length < 6) {
        showToast('error', 'Password must be at least 6 characters.');
        return;
    }

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        btn.disabled = true;

        const user = auth.currentUser;
        if (!user) {
            showToast('error', 'User not authenticated. Please login again.');
            setTimeout(() => authHelper.logout(), 2000);
            return;
        }

        // 1. Re-authenticate
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // 2. Update Password
        await updatePassword(user, newPassword);

        showToast('success', 'Password updated successfully!');
        closeChangePasswordModal();

    } catch (error) {
        console.error("Password Update Error:", error);
        let msg = 'Failed to update password.';
        if (error.code === 'auth/wrong-password') msg = 'Current password is incorrect.';
        if (error.code === 'auth/requires-recent-login') msg = 'Please logout and login again to proceed.';
        showToast('error', msg);
    } finally {
        btn.innerHTML = '<span>Update Password</span><i class="fas fa-arrow-right text-xs"></i>';
        btn.disabled = false;
    }
}

// Ensure user email is shown in dropdown
auth.onAuthStateChanged(user => {
    if (user) {
        const emailEl = document.getElementById('dropdown-user-email');
        if (emailEl) emailEl.textContent = user.email;
    }
});
// ========== LEDGER & EXPENSES ==========

const FEE_STRUCTURE = {
    'lkg': 600,
    'ukg': 600,
    '1': 700,
    '2': 700,
    '3': 700,
    '4': 800,
    '5': 800,
    '6': 900,
    '7': 900,
    '8': 900
};

window.openLedgerModal = async function() {
    document.getElementById('ledger-modal').classList.remove('hidden');
    await calculateLedgerData();
};

window.closeLedgerModal = function() {
    document.getElementById('ledger-modal').classList.add('hidden');
};

window.openExpenseModal = function() {
    document.getElementById('expense-modal').classList.remove('hidden');
};

window.closeExpenseModal = function() {
    document.getElementById('expense-modal').classList.add('hidden');
    document.getElementById('expense-form').reset();
};

window.handleExpenseSubmit = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const expenseData = {
        description: document.getElementById('exp-desc').value,
        amount: parseFloat(document.getElementById('exp-amount').value),
        date: new Date().toISOString(),
        type: 'other'
    };

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        const result = await firestoreHelper.addDocument('expenses', expenseData);
        if(result.success) {
            showSuccessToast('Expense recorded!');
            closeExpenseModal();
            calculateLedgerData(); // Refresh ledger
        } else {
            throw new Error(result.error);
        }
    } catch(err) {
        alert('Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

async function calculateLedgerData() {
    const classBody = document.getElementById('ledger-class-body');
    classBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Calculating financials...</td></tr>';

    try {
        // 1. Calculate Income from Students
        const studentsByClass = {};
        allStudents.forEach(s => {
            const cls = (s.class || 'unknown').toLowerCase();
            studentsByClass[cls] = (studentsByClass[cls] || 0) + 1;
        });

        let totalAnnualIncome = 0;
        let rowsHtml = '';

        const classes = ['lkg', 'ukg', '1', '2', '3', '4', '5', '6', '7', '8'];
        
        classes.forEach(cls => {
            const count = studentsByClass[cls] || 0;
            const monthlyFee = FEE_STRUCTURE[cls] || 800;
            const miscCharge = 2000;
            
            // Formula: (Students * MonthlyFee * 12) + (Students * 2000)
            const annualIncome = (count * monthlyFee * 12) + (count * miscCharge);
            totalAnnualIncome += annualIncome;

            rowsHtml += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="px-4 py-3 font-bold uppercase">${cls}</td>
                    <td class="px-4 py-3 text-right">${count}</td>
                    <td class="px-4 py-3 text-right">₹${monthlyFee}</td>
                    <td class="px-4 py-3 text-right">₹${count * miscCharge}</td>
                    <td class="px-4 py-3 text-right font-bold text-blue-900">₹${annualIncome.toLocaleString()}</td>
                </tr>
            `;
        });

        classBody.innerHTML = rowsHtml;

        // 2. Fetch Other Expenses
        const expenseResult = await firestoreHelper.getDocuments('expenses');
        let otherExpenseTotal = 0;
        if(expenseResult.success) {
            otherExpenseTotal = expenseResult.data.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        }

        // 3. Calculate Teacher Salaries (Annual)
        // Note: we fetch allTeachers during loadAllData
        const totalMonthlySalaries = allTeachers.reduce((sum, t) => sum + (parseFloat(t.salary) || 0), 0);
        const annualSalaries = totalMonthlySalaries * 12;

        const totalExpenses = annualSalaries + otherExpenseTotal;
        const netBalance = totalAnnualIncome - totalExpenses;

        // Update UI
        document.getElementById('ledger-total-income').innerText = `₹${totalAnnualIncome.toLocaleString()}`;
        document.getElementById('ledger-total-expense').innerText = `₹${totalExpenses.toLocaleString()}`;
        document.getElementById('ledger-other-expense').innerText = `₹${otherExpenseTotal.toLocaleString()}`;
        document.getElementById('ledger-net-balance').innerText = `₹${netBalance.toLocaleString()}`;
        
        const balanceEl = document.getElementById('ledger-net-balance');
        balanceEl.className = `text-2xl font-bold ${netBalance >= 0 ? 'text-green-800' : 'text-red-600'}`;

    } catch (error) {
        console.error('Ledger calculation error:', error);
        classBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-500">Error calculating financials. Check console.</td></tr>';
    }
}
