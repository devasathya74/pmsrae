// Firebase Configuration and Initialization
// Police Modern School - Firebase Setup

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC44UWR3RIeMeIG-pXkyPxvjPyn3GWA6oQ",
    authDomain: "pms25bn.firebaseapp.com",
    projectId: "pms25bn",
    storageBucket: "pms25bn.firebasestorage.app",
    messagingSenderId: "220014739322",
    appId: "1:220014739322:web:71ad71e4991d29cb7360c3",
    measurementId: "G-8BD9FCNCB2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
let analytics = null;
isSupported().then(supported => {
    if (supported) {
        analytics = getAnalytics(app);
    }
}).catch(e => console.warn("Analytics not supported:", e));

// Export Firebase services
export {
    app,
    auth,
    db,
    storage,
    analytics,
    // Auth functions
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,

    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    // Firestore functions
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    // Storage functions
    ref,
    uploadBytes,
    getDownloadURL
};

// Helper Functions

// Authentication Helper
export const authHelper = {
    // Login user
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.code, errorMessage: error.message };
        }
    },

    // Register new user
    async register(email, password, userData) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save additional user data to Firestore
            await setDoc(doc(db, 'users', user.uid), {
                email: email,
                createdAt: new Date().toISOString(),
                role: userData.role || 'student', // Use provided role or default to 'student'
                ...userData
            });

            return { success: true, user: user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Logout user
    async logout() {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Create Account (Secondary) - For Admin to create users without logging out
    async createSecondaryAccount(email, password, userData) {
        let secondaryApp = null;
        try {
            // Initialize a secondary app instance
            secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            // Create user in secondary app
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const user = userCredential.user;

            // Save data to MAIN Firestore (using main 'db' reference)
            // 1. Save to users collection (Role Management)
            await setDoc(doc(db, 'users', user.uid), {
                email: email,
                name: userData.name,
                role: userData.role, // 'teacher' or 'student'
                createdAt: new Date().toISOString()
            });

            // 2. Return UID so we can use it in 'teachers' collection
            // Cleanup
            await signOut(secondaryAuth);
            // We don't delete the app here instantly as it might cause issues, fetching it next time is fine or let it verify garbage collection.
            // Actually, safe to delete:
            // await deleteApp(secondaryApp); // deleteApp needs import, skipping for now to avoid complexity

            return { success: true, uid: user.uid };
        } catch (error) {
            console.error("Secondary Auth Error:", error);
            return { success: false, error: error.message };
        }
    },

    // Get current user
    getCurrentUser() {
        return auth.currentUser;
    },

    // Check auth state
    onAuthChange(callback) {
        return onAuthStateChanged(auth, callback);
    }
};

// Firestore Helper
export const firestoreHelper = {
    // Add document
    async addDocument(collectionName, data) {
        try {
            const docRef = await addDoc(collection(db, collectionName), {
                ...data,
                createdAt: new Date().toISOString()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Get all documents
    async getDocuments(collectionName, conditions = null) {
        try {
            let q = collection(db, collectionName);

            if (conditions) {
                q = query(q, ...conditions);
            }

            const querySnapshot = await getDocs(q);
            const documents = [];
            querySnapshot.forEach((doc) => {
                documents.push({ id: doc.id, ...doc.data() });
            });

            return { success: true, data: documents };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Get single document
    async getDocument(collectionName, docId) {
        try {
            const docRef = doc(db, collectionName, docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
            } else {
                return { success: false, error: 'Document not found' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Get paginated documents
    async getPaginatedData(collectionName, pageSize = 20, lastDoc = null, orderByField = 'createdAt') {
        try {
            let q;
            if (lastDoc) {
                q = query(collection(db, collectionName), orderBy(orderByField, 'desc'), startAfter(lastDoc), limit(pageSize));
            } else {
                q = query(collection(db, collectionName), orderBy(orderByField, 'desc'), limit(pageSize));
            }

            const querySnapshot = await getDocs(q);
            const data = [];
            let lastVisible = null;

            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
                lastVisible = doc;
            });

            return {
                success: true,
                data: data,
                lastDoc: lastVisible,
                hasMore: data.length === pageSize
            };
        } catch (error) {
            console.error("Error getting paginated documents: ", error);
            // Fallback for no index/orderBy support
            try {
                let qFallback = query(collection(db, collectionName), limit(pageSize));
                if (lastDoc) {
                    qFallback = query(collection(db, collectionName), startAfter(lastDoc), limit(pageSize));
                }
                const snapshot = await getDocs(qFallback);
                const fallbackData = [];
                let fallbackLast = null;
                snapshot.forEach(doc => {
                    fallbackData.push({ id: doc.id, ...doc.data() });
                    fallbackLast = doc;
                });
                return { success: true, data: fallbackData, lastDoc: fallbackLast, hasMore: fallbackData.length === pageSize };
            } catch (e2) {
                return { success: false, error: e2.message };
            }
        }
    },

    // Update document
    async updateDocument(collectionName, docId, data) {
        try {
            const docRef = doc(db, collectionName, docId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Delete document
    async deleteDocument(collectionName, docId) {
        try {
            await deleteDoc(doc(db, collectionName, docId));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Get collection by simple query
    async getCollectionByQuery(collectionName, field, operator, value) {
        try {
            const q = query(collection(db, collectionName), where(field, operator, value));
            const querySnapshot = await getDocs(q);
            const data = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
            });
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Set document (with custom ID)
    async setDocument(collectionName, docId, data) {
        try {
            await setDoc(doc(db, collectionName, docId), {
                ...data,
                updatedAt: new Date().toISOString()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase configuration
const supabaseUrl = 'https://cdbkqpywptbjbkazyqcy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkYmtxcHl3cHRiamJrYXp5cWN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMTEwODIsImV4cCI6MjA4NTU4NzA4Mn0.yw_ohvKVOBx3xg0BwYoDkldJh5w0TjjlDGPWcgDsbXA';
const supabase = createClient(supabaseUrl, supabaseKey);

// Storage Helper (Moved to Supabase)
export const storageHelper = {
    // Upload file to specific bucket and folder
    async uploadFile(file, path, bucket = 'admissions') {
        try {
            const { data, error } = await supabase
                .storage
                .from(bucket)
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase
                .storage
                .from(bucket)
                .getPublicUrl(path);

            return { success: true, url: publicUrl };
        } catch (error) {
            console.error("Supabase Upload Error:", error);
            return { success: false, error: error.message };
        }
    },

    // Get file URL from specific bucket
    async getFileURL(path, bucket = 'admissions') {
        try {
            const { data: { publicUrl } } = supabase
                .storage
                .from(bucket)
                .getPublicUrl(path);

            return { success: true, url: publicUrl };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Upload to students folder
    async uploadStudentFile(file, filename) {
        const path = `students/${filename}`;
        return await this.uploadFile(file, path, 'admissions');
    },

    // Upload to teachers folder
    async uploadTeacherFile(file, filename) {
        const path = `teachers/${filename}`;
        return await this.uploadFile(file, path, 'admissions');
    },

    // Upload admission document (PDF)
    async uploadAdmissionDocument(file, filename) {
        const path = `admissions/documents/${filename}`;
        return await this.uploadFile(file, path, 'admissions');
    },

    // Upload admission image (student photo)
    async uploadAdmissionImage(file, filename) {
        const path = `admissions/images/${filename}`;
        return await this.uploadFile(file, path, 'admissions');
    }
};

// Admission Form Helper
export const admissionHelper = {
    // Submit admission form
    async submitAdmission(formData, files) {
        try {
            console.log('Starting admission submission...');
            console.log('Files received:', Object.keys(files));

            // Get student name and create sanitized filename
            const studentName = formData.student_name || formData.scholarName || 'student';
            // Sanitize name: remove special chars, replace spaces with underscore, lowercase
            const sanitizedName = studentName
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 50); // Limit length

            console.log('Student name for files:', sanitizedName);

            // Upload documents if provided
            const uploadedFiles = {};

            // Upload documents to admissions/documents folder
            if (files.birthCertificate) {
                console.log('Uploading birth certificate...');
                const ext = files.birthCertificate.name.split('.').pop();
                const result = await storageHelper.uploadAdmissionDocument(
                    files.birthCertificate,
                    `${sanitizedName}_birth_certificate.${ext}`
                );
                if (result.success) {
                    uploadedFiles.birthCertificate = result.url;
                    console.log('Birth certificate uploaded:', result.url);
                } else {
                    console.error('Birth certificate upload failed:', result.error);
                }
            }

            if (files.aadharCard) {
                console.log('Uploading aadhar card...');
                const ext = files.aadharCard.name.split('.').pop();
                const result = await storageHelper.uploadAdmissionDocument(
                    files.aadharCard,
                    `${sanitizedName}_aadhar_card.${ext}`
                );
                if (result.success) {
                    uploadedFiles.aadharCard = result.url;
                    console.log('Aadhar card uploaded:', result.url);
                } else {
                    console.error('Aadhar card upload failed:', result.error);
                }
            }

            if (files.casteCertificate) {
                console.log('Uploading caste certificate...');
                const ext = files.casteCertificate.name.split('.').pop();
                const result = await storageHelper.uploadAdmissionDocument(
                    files.casteCertificate,
                    `${sanitizedName}_caste_certificate.${ext}`
                );
                if (result.success) {
                    uploadedFiles.casteCertificate = result.url;
                    console.log('Caste certificate uploaded:', result.url);
                } else {
                    console.error('Caste certificate upload failed:', result.error);
                }
            }

            if (files.domicileCertificate) {
                console.log('Uploading domicile certificate...');
                const ext = files.domicileCertificate.name.split('.').pop();
                const result = await storageHelper.uploadAdmissionDocument(
                    files.domicileCertificate,
                    `${sanitizedName}_domicile_certificate.${ext}`
                );
                if (result.success) {
                    uploadedFiles.domicileCertificate = result.url;
                    console.log('Domicile certificate uploaded:', result.url);
                } else {
                    console.error('Domicile certificate upload failed:', result.error);
                }
            }

            // Upload student photo to admissions/images folder
            if (files.photo) {
                console.log('Uploading student photo...');
                const ext = files.photo.name.split('.').pop();
                const result = await storageHelper.uploadAdmissionImage(
                    files.photo,
                    `${sanitizedName}_photo.${ext}`
                );
                if (result.success) {
                    uploadedFiles.photo = result.url;
                    console.log('Photo uploaded:', result.url);
                } else {
                    console.error('Photo upload failed:', result.error);
                }
            }

            console.log('All uploads completed. Uploaded files:', uploadedFiles);

            // Save admission data to Firestore
            // Generate Custom Registration Number (PMS-XXXXX)
            const regNum = 'PMS-' + Math.floor(10000 + Math.random() * 90000);

            // Save admission data to Firestore
            const admissionData = {
                ...formData,
                documents: uploadedFiles,
                status: 'pending',
                submittedAt: new Date().toISOString(),
                registrationNumber: regNum, // Save explicitly as a field too
                id: regNum // Save ID within the document for easier retrieval
            };

            console.log('Saving to Firestore with registration number:', regNum);
            // Use setDoc to create document with custom ID instead of addDocument
            await setDoc(doc(db, 'admissions', regNum), admissionData);
            console.log('Admission saved successfully!');

            return { success: true, id: regNum };
        } catch (error) {
            console.error('Admission submission error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get admission status
    async getAdmissionStatus(admissionId) {
        return await firestoreHelper.getDocument('admissions', admissionId);
    }
};

// Contact Form Helper
export const contactHelper = {
    // Submit contact form
    async submitContact(formData) {
        try {
            const result = await firestoreHelper.addDocument('contacts', {
                ...formData,
                status: 'new',
                read: false
            });
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// Analytics Helper
export const analyticsHelper = {
    // Log custom event
    logEvent(eventName, eventParams = {}) {
        if (analytics) {
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js')
                .then(({ logEvent }) => {
                    logEvent(analytics, eventName, eventParams);
                });
        }
    },

    // Log page view
    logPageView(pageName) {
        this.logEvent('page_view', { page_name: pageName });
    }
};

console.log('Firebase initialized successfully!');
