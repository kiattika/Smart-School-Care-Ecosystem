#!/bin/bash
sed -i 's/Advisor Mode: ม.1\/1/Advisor Mode: {myRoom || '"'"'No Room'"'"'}/g' src/AdvisorPortal.tsx

# Replace `<main ...>` to conditionally render based on myRoom
sed -i 's/<main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">/{!myRoom ? (\n         <main className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-[#0b0d14]">\n            <div className="text-center space-y-4 max-w-sm">\n              <div className="w-16 h-16 bg-slate-800\/50 rounded-full flex items-center justify-center mx-auto mb-6">\n                <UserX className="w-8 h-8 text-slate-500" \/>\n              <\/div>\n              <h2 className="text-xl font-bold text-slate-300">ไม่ได้เป็นครูที่ปรึกษาในภาคเรียนนี้<\/h2>\n              <p className="text-slate-500 text-sm">คุณไม่มีข้อมูลการประจำชั้นในภาคเรียนนี้ หากข้อมูลผิดพลาดโปรดติดต่อผู้ดูแลระบบ<\/p>\n            <\/div>\n         <\/main>\n       ) : (\n       <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">/g' src/AdvisorPortal.tsx

sed -i 's/<\/div>\n    <\/div>\n  );\n}/<\/div>\n       )}\n    <\/div>\n  );\n}/g' src/AdvisorPortal.tsx

