#!/bin/bash
sed -i 's/import { useStore } from '"'"'.\/store'"'"';/import { useStore } from '"'"'.\/store'"'"';\nimport { GlobalCourse } from '"'"'.\/types'"'"';/g' src/AdminPortal.tsx
