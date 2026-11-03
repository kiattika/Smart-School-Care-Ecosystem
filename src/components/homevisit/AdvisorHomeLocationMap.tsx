import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, ExternalLink, Loader2, Users } from 'lucide-react';
import { Student, StudentHomeLocation } from '../../types';
import { subscribeStudentHomeLocationsByRoom } from '../../services/firestoreService';

/**
 * แผนที่รวมพิกัดบ้านนักเรียนทั้งห้อง — สำหรับครูที่ปรึกษาวางแผนออกเยี่ยมบ้าน
 * ดึงจาก student_home_locations (query filter homeroomClass → firestore.rules ให้เฉพาะครูที่ปรึกษาห้องนั้น)
 * รูปเปิดผ่าน download URL ที่เก็บใน doc (storage.rules ไม่ต้อง cross-check)
 */

const pinIcon = L.divIcon({
  className: 'advisor-home-pin',
  html: `<div style="background:#10b981;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #10b981;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function AdvisorHomeLocationMap({ homeroomClass, students }: { homeroomClass?: string; students: Student[] }) {
  const [locs, setLocs] = useState<StudentHomeLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!homeroomClass) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeStudentHomeLocationsByRoom(homeroomClass, (rows) => {
      setLocs(rows);
      setLoading(false);
    });
    return unsub;
  }, [homeroomClass]);

  const nameOf = useMemo(() => {
    const m = new Map(students.map(s => [s.studentId, s.fullName || s.name]));
    return (sid: string) => m.get(sid) || `เลขประจำตัว ${sid}`;
  }, [students]);
  const studentOf = useMemo(() => new Map(students.map(s => [s.studentId, s])), [students]);

  const center = useMemo<[number, number]>(() => {
    if (locs.length === 0) return [17.6251, 100.0932]; // อุตรดิตถ์ (ใช้เฉพาะตอนไม่มีหมุดให้แสดง — แผนที่ไม่ถูก render)
    const lat = locs.reduce((a, l) => a + l.latitude, 0) / locs.length;
    const lng = locs.reduce((a, l) => a + l.longitude, 0) / locs.length;
    return [lat, lng];
  }, [locs]);

  const locByStudent = useMemo(() => new Map(locs.map(l => [l.studentId, l])), [locs]);
  const sortedStudents = useMemo(() => [...students].sort((a, b) => (Number(a.studentNo) || 0) - (Number(b.studentNo) || 0)), [students]);
  const recorded = useMemo(() => sortedStudents.filter(st => locByStudent.has(st.studentId)).map(st => ({ st, loc: locByStudent.get(st.studentId)! })), [sortedStudents, locByStudent]);
  const notRecorded = useMemo(() => sortedStudents.filter(st => !locByStudent.has(st.studentId)), [sortedStudents, locByStudent]);
  const withLoc = locs.length;
  const total = students.length;

  if (!homeroomClass) {
    return (
      <div className="p-4 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        บัญชีนี้ยังไม่ได้กำหนดห้องที่ปรึกษา — ไม่สามารถแสดงพิกัดบ้านนักเรียนได้
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-400" /> พิกัดบ้านนักเรียน ห้อง {homeroomClass}
        </h3>
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> บันทึกพิกัดแล้ว {withLoc}/{total} คน
        </span>
      </div>

      {loading ? (
        <div className="h-[420px] rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center justify-center text-slate-500 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดพิกัด…
        </div>
      ) : withLoc === 0 ? (
        <div className="h-[220px] rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 flex items-center justify-center text-slate-500 text-sm text-center px-6">
          ยังไม่มีนักเรียนบันทึกพิกัดบ้าน — แจ้งให้นักเรียนเข้าไปบันทึกที่เมนู “พิกัดบ้าน” ในหน้านักเรียน
        </div>
      ) : (
        <div className="h-[420px] rounded-2xl border border-white/10 overflow-hidden isolate">
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', backgroundColor: '#05070a' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            {locs.map(l => (
              <Marker key={l.studentId} position={[l.latitude, l.longitude]} icon={pinIcon}>
                {/* เลื่อนเมาส์ไปที่หมุดแล้วเห็นข้อมูลนักเรียนทันที (ไม่ต้องคลิก) — ไม่มีข้อมูล = แสดง "-" */}
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  {(() => {
                    const st = studentOf.get(l.studentId);
                    return (
                      <div className="text-xs font-sans leading-5 min-w-[170px]">
                        <div className="font-bold text-sm">{nameOf(l.studentId)}</div>
                        <div>เลขที่: {st?.studentNo || '-'}</div>
                        <div>ชื่อเล่น: {st?.nickname || '-'}</div>
                        <div>เบอร์โทร (ผู้ปกครอง): {st?.parentMobile || '-'}</div>
                        <div>พิกัด: {l.latitude.toFixed(6)}, {l.longitude.toFixed(6)}</div>
                      </div>
                    );
                  })()}
                </Tooltip>
                <Popup>
                  <div className="p-1 font-sans min-w-[180px]">
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{nameOf(l.studentId)}</h4>
                    {l.landmarkNotes && <p className="text-xs text-slate-600 mb-1">{l.landmarkNotes}</p>}
                    {l.photoUrls.length > 0 && (
                      <div className="flex gap-1 my-1 flex-wrap">
                        {l.photoUrls.slice(0, 4).map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer">
                            <img src={u} alt="" className="w-12 h-12 object-cover rounded border border-slate-300" />
                          </a>
                        ))}
                      </div>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 font-semibold flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="w-3 h-3" /> เปิดเส้นทางใน Google Maps
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" id="home-location-lists">
          <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3">
            <div className="text-xs font-bold text-slate-200 mb-2">บันทึกพิกัดแล้ว ({recorded.length} คน) — ข้อมูลที่นักเรียนกรอกเอง</div>
            {recorded.length === 0 ? <div className="text-xs text-slate-500">ยังไม่มี</div> : (
              <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                {recorded.map(({ st, loc }) => (
                  <li key={st.studentId} className="text-xs text-slate-200 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-bold">เลขที่ {st.studentNo || '-'}</span>
                    <span>{st.fullName || st.name}{st.nickname ? ` (${st.nickname})` : ''}</span>
                    <span className="font-mono text-indigo-300">{loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}</span>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">นำทาง</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3">
            <div className="text-xs font-bold text-slate-200 mb-2">ยังไม่บันทึกพิกัดบ้าน ({notRecorded.length} คน)</div>
            {notRecorded.length === 0 ? <div className="text-xs text-slate-500">บันทึกครบทุกคนแล้ว</div> : (
              <ul className="space-y-1 max-h-60 overflow-y-auto">
                {notRecorded.map(st => (
                  <li key={st.studentId} className="text-xs text-slate-300">
                    <span className="font-bold">เลขที่ {st.studentNo || '-'}</span> {st.fullName || st.name}{st.nickname ? ` (${st.nickname})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
