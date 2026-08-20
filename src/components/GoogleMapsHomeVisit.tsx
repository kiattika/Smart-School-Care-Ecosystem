import React from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Sparkles } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface GoogleMapsHomeVisitProps {
  location: { lat: number; lng: number } | null;
  studentName?: string;
  className?: string;
  onLocationSelect?: (latLng: { lat: number; lng: number }) => void;
}

export function GoogleMapsHomeVisit({
  location,
  studentName = 'บ้านนักเรียน',
  className = '',
  onLocationSelect
}: GoogleMapsHomeVisitProps) {
  const center = location || { lat: 17.6256, lng: 100.0993 }; // Default: Uttaradit (โรงเรียนอุตรดิตถ์)

  if (!hasValidKey) {
    return (
      <div className={`bg-[#0d131f] border border-slate-800 rounded-xl p-4 text-center ${className}`}>
        <div className="flex flex-col items-center justify-center p-4 text-slate-300">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-white text-sm mb-1">Google Maps Platform</h4>
          <p className="text-xs text-slate-400 mb-3 max-w-sm">
            {location 
              ? `พิกัดปัจจุบัน: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` 
              : 'ระบบพร้อมเชื่อมต่อ Google Maps Platform สำหรับแผนที่เยี่ยมบ้านนักเรียน'}
          </p>
          <div className="text-[11px] text-slate-400 bg-slate-900/80 border border-slate-700/60 rounded-lg p-2.5 text-left w-full space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> วิธีเปิดใช้งานแผนที่ Google Maps:
            </div>
            <div>1. เปิด <strong>Settings</strong> (⚙️ ไอคอนฟันเฟือง มุมขวาบน)</div>
            <div>2. เลือก <strong>Secrets</strong></div>
            <div>3. เพิ่ม <code>GOOGLE_MAPS_PLATFORM_KEY</code> แล้วใส่ API Key</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden border border-slate-700/80 shadow-md ${className}`} style={{ minHeight: '260px', height: '260px' }}>
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={center}
          defaultZoom={14}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          onClick={(e) => {
            if (e.detail.latLng && onLocationSelect) {
              onLocationSelect({
                lat: e.detail.latLng.lat,
                lng: e.detail.latLng.lng
              });
            }
          }}
        >
          {location && (
            <AdvancedMarker position={location} title={studentName}>
              <Pin background="#10b981" glyphColor="#ffffff" borderColor="#047857" />
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
