import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

/**
 * Triggered automatically upon new Firebase User creation
 * Assigns roles from the staff/whitelist collection into custom user claims
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const email = user.email?.toLowerCase();
  const uid = user.uid;

  if (!email) {
    console.warn(`User ${uid} created without email.`);
    return;
  }

  try {
    let roles: string[] = [];

    // 1. Check if user exists in staff collection by UID or email
    const staffDoc = await db.collection('staff').doc(uid).get();
    if (staffDoc.exists) {
      roles = staffDoc.data()?.roles || [];
    } else {
      const emailQuery = await db.collection('staff').where('email', '==', email).limit(1).get();
      if (!emailQuery.empty) {
        roles = emailQuery.docs[0].data()?.roles || [];
      }
    }

    // 2. Default domain policy: staff @utd.ac.th defaults to SUBJECT_TEACHER if not specified
    if (roles.length === 0) {
      if (email.endsWith('@utd.ac.th') || email.endsWith('@school.ac.th')) {
        roles = ['SUBJECT_TEACHER'];
      } else {
        roles = ['STUDENT'];
      }
    }

    // Set custom claims securely on the Auth token
    await auth.setCustomUserClaims(uid, {
      roles: roles,
      primaryRole: roles[0] || 'SUBJECT_TEACHER',
      emailVerified: user.emailVerified || email.endsWith('@utd.ac.th')
    });

    console.log(`Successfully assigned custom claims for user ${email} (${uid}):`, roles);
  } catch (error) {
    console.error(`Failed to assign custom user claims for ${uid}:`, error);
  }
});

/**
 * Callable HTTPS Cloud Function to assign roles directly by an authorized Super Admin
 */
export const assignUserRole = functions.https.onCall(async (data, context) => {
  // 1. Verify caller is authenticated and has SUPER_ADMIN role
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerRoles = (context.auth.token.roles as string[]) || [];
  if (!callerRoles.includes('SUPER_ADMIN')) {
    throw new functions.https.HttpsError('permission-denied', 'Only SUPER_ADMIN can assign user roles.');
  }

  const { targetUid, roles, targetEmail } = data;
  if (!targetUid || !Array.isArray(roles)) {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid and roles array are required.');
  }

  try {
    // 2. Update staff profile in Firestore
    await db.collection('staff').doc(targetUid).set({
      roles,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
      email: targetEmail || ''
    }, { merge: true });

    // 3. Set custom user claims via Admin Auth SDK
    await auth.setCustomUserClaims(targetUid, {
      roles: roles,
      primaryRole: roles[0] || 'SUBJECT_TEACHER'
    });

    return { success: true, targetUid, roles };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
