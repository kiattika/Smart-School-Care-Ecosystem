#!/bin/bash

# We will use parseThaiSchedule from lib/utils
sed -i 's/import { cn } from ".\/lib\/utils";/import { cn, parseThaiSchedule } from ".\/lib\/utils";/g' src/TeacherPortal.tsx
sed -i 's/import { AttendanceStatus, Course } from '\''.\/types'\'';/import { AttendanceStatus, Course, GlobalCourse } from '\''.\/types'\'';/g' src/TeacherPortal.tsx

