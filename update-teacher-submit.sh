#!/bin/bash
sed -i 's/teacherName: '"'"'ครู เอ'"'"'/teacherName: user?.displayName || '"'"'Unknown'"'"'/g' src/TeacherPortal.tsx
