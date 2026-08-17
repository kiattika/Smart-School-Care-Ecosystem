import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Cloud Function Trigger: onDocumentCreated for 'attendance_records/{recordId}'
 * 
 * This trigger fires whenever a new homeroom attendance record is created.
 * It loops through the students in the record:
 * - If status is LATE: deducts -2 points from behaviorScore.
 * - If status is ABSENT: deducts -5 points from behaviorScore.
 * 
 * It performs these updates atomically inside a Firestore transaction:
 * 1. Decrements behaviorScore on the student's document in the 'students' collection.
 * 2. Writes a discipline log to the 'discipline_logs' collection.
 * 3. Sends a push-styled notification document to 'parent_notifications'.
 * 
 * NEW: Threshold Trigger Logic
 * - If behaviorScore < 80: Sends a warning card/notification "คะแนนพฤติกรรมเริ่มลดลง" (orange).
 * - If behaviorScore < 70:
 *   • Updates riskLevel = 'CRITICAL' in the student's document.
 *   • Automatically creates a conference document in collection 'parent_conferences'.
 */
export const processHomeroomDeductions = onDocumentCreated(
  {
    document: "attendance_records/{recordId}",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No snapshot data available for attendance record.");
      return;
    }

    const recordData = snapshot.data();
    if (!recordData) {
      console.log("Attendance record document has no data.");
      return;
    }

    const recordId = event.params.recordId;
    const date = recordData.date || new Date().toISOString().split("T")[0];
    const room = recordData.room || "ม.5/8";
    const checkedByName = recordData.checkedByName || "ครูประจำชั้น";
    const studentsRecord = recordData.students || {};

    console.log(`Processing homeroom attendance record '${recordId}' for room ${room}, date: ${date}`);

    const studentIds = Object.keys(studentsRecord);
    if (studentIds.length === 0) {
      console.log("No students found in this attendance record.");
      return;
    }

    const firestore = admin.firestore();

    // Iterate through all students in the record and run deductions for LATE and ABSENT statuses
    for (const studentId of studentIds) {
      const status = studentsRecord[studentId];

      if (status !== "LATE" && status !== "ABSENT") {
        // No deduction needed for PRESENT or LEAVE
        continue;
      }

      const deduction = status === "LATE" ? -2 : -5;
      console.log(`Applying behavioral deduction for student '${studentId}': Status = ${status}, Points = ${deduction}`);

      try {
        await firestore.runTransaction(async (transaction) => {
          const studentRef = firestore.collection("students").doc(studentId);
          const studentDoc = await transaction.get(studentRef);

          let currentScore = 100;
          let studentName = `นักเรียนรหัส ${studentId}`;
          let parentId = `parent_${studentId}`; // Fallback parent relationship identifier
          let existingRiskLevel = "LOW";

          if (studentDoc.exists) {
            const studentData = studentDoc.data() || {};
            if (typeof studentData.behaviorScore === "number") {
              currentScore = studentData.behaviorScore;
            } else if (typeof studentData.behaviorScore === "string") {
              currentScore = parseInt(studentData.behaviorScore, 10) || 100;
            }
            studentName = studentData.fullName || studentData.name || studentName;
            parentId = studentData.parentId || parentId;
            existingRiskLevel = studentData.riskLevel || "LOW";
          } else {
            console.warn(`Student document 'students/${studentId}' does not exist. Creating behavior profile with base score of 100.`);
            // Set base document if not exists to avoid broken references
            transaction.set(studentRef, {
              studentId,
              name: studentName,
              behaviorScore: 100,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }

          const newScore = Math.max(0, currentScore + deduction);

          // Prepare updates for student document
          const studentUpdates: any = {
            behaviorScore: newScore,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          // If behaviorScore < 70, set riskLevel to 'CRITICAL'
          if (newScore < 70) {
            studentUpdates.riskLevel = "CRITICAL";
          }

          // 1. Update behaviorScore and possibly riskLevel in 'students' collection
          transaction.update(studentRef, studentUpdates);

          // Also check and update matching 'student_analytics' document if it exists, to keep data perfectly in sync
          const analyticsRef = firestore.collection("student_analytics").doc(studentId);
          const analyticsDoc = await transaction.get(analyticsRef);
          if (analyticsDoc.exists) {
            transaction.update(analyticsRef, {
              behaviorScore: newScore,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } else {
            transaction.set(analyticsRef, {
              studentId,
              behaviorScore: newScore,
              subjectAttendanceRate: 100,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }

          // 2. Save a detailed behavior deduction log to 'discipline_logs'
          const disciplineLogRef = firestore.collection("discipline_logs").doc();
          const reason = status === "LATE" ? "มาสายกิจกรรมโฮมรูม" : "ขาดกิจกรรมโฮมรูม";
          
          transaction.set(disciplineLogRef, {
            studentId: studentId,
            studentName: studentName,
            type: "deduction",
            points: deduction,
            reason: reason,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            date: date,
            recordedBy: checkedByName,
            referenceRecordId: recordId
          });

          // 3. Create normal attendance/deduction notification
          const notificationRef = firestore.collection("parent_notifications").doc();
          const statusTextTranslation = status === "LATE" ? "มาสาย" : "ขาดเรียน";
          const alertTitle = `แจ้งเตือนพฤติกรรม: น้อง${studentName} ${statusTextTranslation}`;
          const alertMessage = `แจ้งเตือนจากระบบดูแลช่วยเหลือนักเรียนประจำวันที่ ${date}: น้อง${studentName} มีสถานะ "${statusTextTranslation}" ในกิจกรรมโฮมรูมเช้านี้ ส่งผลให้ถูกหักคะแนนพฤติกรรม ${deduction} คะแนน โดยขณะนี้คะแนนพฤติกรรมคงเหลือทั้งหมด ${newScore} คะแนน`;

          transaction.set(notificationRef, {
            parentId: parentId,
            studentId: studentId,
            studentName: studentName,
            title: alertTitle,
            message: alertMessage,
            status: "unread",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            pointsDeducted: deduction,
            remainingScore: newScore,
            attendanceStatus: status,
            date: date
          });

          // THRESHOLD ALERT: Warning State (< 80 points)
          if (newScore < 80) {
            const warningNotificationRef = firestore.collection("parent_notifications").doc();
            transaction.set(warningNotificationRef, {
              parentId: parentId,
              studentId: studentId,
              studentName: studentName,
              title: "⚠️ คะแนนพฤติกรรมเริ่มลดลง",
              message: `แจ้งเตือนความประพฤติ: คะแนนพฤติกรรมของน้อง${studentName} ลดลงต่ำกว่าเกณฑ์เฝ้าระวัง (ปัจจุบันเหลือ ${newScore} คะแนน) กรุณาช่วยตักเตือนและติดตามอย่างใกล้ชิดค่ะ`,
              status: "unread",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              type: "warning",
              pointsDeducted: 0,
              remainingScore: newScore,
              attendanceStatus: "LATE_WARNING",
              date: date
            });
          }

          // THRESHOLD ALERT: Critical State (< 70 points)
          if (newScore < 70) {
            const conferenceRef = firestore.collection("parent_conferences").doc(`conf_${studentId}_${date}`);
            transaction.set(conferenceRef, {
              studentId: studentId,
              studentName: studentName,
              parentId: parentId,
              status: "PENDING",
              title: "นัดหมายพบฝ่ายปกครอง (คะแนนต่ำกว่า 70 คะแนน)",
              message: `เนื่องจากคะแนนพฤติกรรมคงเหลือของน้อง${studentName} อยู่ในระดับวิกฤต (ปัจจุบันเหลือ ${newScore} คะแนน) ซึ่งต่ำกว่าเกณฑ์ของโรงเรียน เพื่อดูแลช่วยเหลือนักเรียนอย่างมีประสิทธิภาพ ทางฝ่ายปกครองจึงจำเป็นต้องขอสัญญานัดหมายเพื่อพูดคุยปรับทัศนคติร่วมกัน`,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              remainingScore: newScore,
              scheduledDate: null,
              scheduledTime: null,
              availableSlots: [
                "วันจันทร์ 09:00 - 10:00 น.",
                "วันอังคาร 10:30 - 11:30 น.",
                "วันพุธ 13:00 - 14:00 น.",
                "วันพฤหัสบดี 14:30 - 15:30 น.",
                "วันศุกร์ 13:30 - 14:30 น."
              ],
              notes: ""
            }, { merge: true });
          }
        });

        console.log(`Successfully completed deduction, logging, and parent notification for student '${studentId}'`);
      } catch (error) {
        console.error(`Error processing deduction transaction for student '${studentId}':`, error);
      }
    }
  }
);
