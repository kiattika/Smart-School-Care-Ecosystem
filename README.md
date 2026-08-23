# Smart School Care — Local Development & Firebase Emulator Suite

This application supports full local development with role-based access control (RBAC) and Firestore security rules using the **Firebase Emulator Suite**. This allows developers with personal accounts (e.g. `@gmail.com`) to test school-domain (`@utd.ac.th`) accounts, custom claims, and multi-role views without requiring live Google Workspace credentials.

---

## 1. Quick Start with Firebase Emulators

### Prerequisites
- Node.js 18+
- Java Runtime Environment (JRE 11+ recommended for Firebase Emulators)
- Dependencies installed: `npm install`

### Step 1: Opt into Emulator Mode in `.env`
In your local `.env` (or copy from `.env.example`):
```env
VITE_USE_FIREBASE_EMULATOR=true
```
When `VITE_USE_FIREBASE_EMULATOR=true` and in development mode (`import.meta.env.DEV`), the app will automatically connect `getAuth()` and `getFirestore()` to:
- **Auth Emulator**: `http://127.0.0.1:9099`
- **Firestore Emulator**: `127.0.0.1:8080`
- **Emulator UI**: `http://127.0.0.1:4000`

### Step 2: Start the Firebase Emulator Suite
Run the emulators with persistence enabled:
```bash
npm run emulators
```
*Note: The `--import=./emulator-data --export-on-exit` flag ensures your test data persists between restarts.*

### Step 3: Seed Test Accounts and Custom Claims
In a separate terminal, seed all 10 role accounts and test documents:
```bash
npm run seed:emulator
```

### Step 4: Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). The Login page will show a **Local Dev / Emulator Test Accounts** section where you can sign in with one click.

---

## 2. Seeded Test Accounts

> ⚠️ **Notice**: These credentials are strictly for **local development and testing with the Firebase Emulator Suite**. Do **NOT** use or reuse these credentials in production environments.

| Email | Role (Custom Claims) | Fixed Password | Role & Features Tested |
|---|---|---|---|
| `teacher.test@utd.ac.th` | `SUBJECT_TEACHER` | `test1234` | Period attendance, Gradebook, Class roll-call |
| `advisor.test@utd.ac.th` | `HOMEROOM_TEACHER`, `SUBJECT_TEACHER` | `test1234` | Homeroom ม.5/8, Morning assembly, Behavioral triage |
| `exec.test@utd.ac.th` | `EXECUTIVE` | `test1234` | School-wide KPI dashboard, Attendance analytics |
| `admin.test@utd.ac.th` | `SUPER_ADMIN`, `EXECUTIVE` | `test1234` | Period configuration, Staff management, Full access |
| `guidance.test@utd.ac.th` | `GUIDANCE_COUNSELOR` | `test1234` | Mental health assessments (PHQ-9, SDQ), Student counseling |
| `finance.test@utd.ac.th` | `FINANCE_STAFF` | `test1234` | Student fee receipts, Transaction audit |
| `infirmary.test@utd.ac.th` | `INFIRMARY_STAFF` | `test1234` | Infirmary check-in log, Student medical triage |
| `supervisor.test@utd.ac.th` | `INSTRUCTIONAL_SUPERVISOR` | `test1234` | Academic lesson evaluation, Teaching load reviews |
| `parent.test@gmail.com` | `PARENT` *(No staff role)* | `test1234` | Parent Portal for student #38501, Attendance & Behavior alerts |
| `student.test@utd.ac.th` | `STUDENT` | `test1234` | Student Portal, Self-assessments, Timetable |

---

## 3. Running Automated Tests

Run the security rules and application test suite:
```bash
npm test
```
Or execute tests directly against the running emulator suite:
```bash
npm run emulators:exec
```

---

## 4. Notes on Google Sign-In & Auth Emulators

- In local development with the emulator, **Email/Password authentication** is recommended because the emulator does not require real Google OAuth redirects or external identity providers.
- When `VITE_USE_FIREBASE_EMULATOR=false` or in production builds, the app strictly uses Google Workspace popup authentication (`GoogleAuthProvider`) restricted to `@utd.ac.th`.
