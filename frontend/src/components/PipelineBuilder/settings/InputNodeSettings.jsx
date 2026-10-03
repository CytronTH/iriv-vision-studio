import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function InputNodeSettings({ nodeId, data, onChange }) {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (data?.isWikiMode) {
      setCameras([
        { id: 'wiki_mock_obj_det', name: 'คลิปจำลอง (Object Detection)', type: 'file', path: 'public/videos/wiki_obj_det.mp4', is_enabled: true },
        { id: 'wiki_mock_pose', name: 'คลิปจำลอง (Pose Estimation)', type: 'file', path: 'public/videos/wiki_pose.mp4', is_enabled: true }
      ]);
      setLoading(false);
      return;
    }

    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setCameras(json.cameras || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch entities", err);
        setLoading(false);
      });
  }, [data?.isWikiMode]);

  const handleEntityChange = (e) => {
    const selectedId = e.target.value;
    const selectedCam = cameras.find(c => c.id === selectedId);
    onChange({ 
      entityId: selectedId,
      label: selectedCam ? selectedCam.name : data?.label
    });
  };

  const selectedCam = cameras.find(c => c.id === data?.entityId);
  const isFileSource = selectedCam?.type === 'file';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {isFileSource ? 'Video File' : 'Camera Entity'}
        </label>
        {loading ? (
          <div className="text-sm text-gray-500 py-1 dark:text-gray-500">Loading sources...</div>
        ) : (
          <select 
            className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 w-full dark:text-white"
            value={data?.entityId || ''}
            onChange={handleEntityChange}
          >
            <option value="" disabled>Select Source</option>
            {cameras.filter(c => c.type !== 'file').length > 0 && (
              <optgroup label="── Cameras ──">
                {cameras.filter(c => c.type !== 'file').map(cam => (
                  <option key={cam.id} value={cam.id}>
                    {cam.name}{cam.is_enabled === false ? ' (Disabled)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {cameras.filter(c => c.type === 'file').length > 0 && (
              <optgroup label="── Video Files ──">
                {cameras.filter(c => c.type === 'file').map(cam => (
                  <option key={cam.id} value={cam.id}>
                    📁 {cam.name}{cam.is_enabled === false ? ' (Disabled)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>
      
      {/* Preview */}
      {selectedCam && (
        <div className="text-xs text-gray-600 bg-gray-200 dark:bg-gray-800 p-3 rounded-md break-all border border-gray-300/50 dark:border-gray-700/50 dark:text-gray-400">
          <span className="text-blue-400 uppercase font-semibold mr-1">{selectedCam.type}:</span>
          <span className="truncate">{selectedCam.path?.split('/').pop() || selectedCam.path}</span>
        </div>
      )}

      {/* Disabled Warning */}
      {selectedCam && selectedCam.is_enabled === false && (
        <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 p-3 rounded-md">
          <AlertTriangle size={16} className="shrink-0 text-amber-400 mt-0.5" />
          <span>This camera is currently <strong>disabled</strong> in the Device Settings. No feed will be available.</span>
        </div>
      )}

      {/* File-only options */}
      {isFileSource && (
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-200/30 dark:bg-gray-800/30 flex flex-col gap-4 mt-2">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 dark:text-gray-500">Playback Options</div>

          <label className="text-sm text-gray-700 flex items-center justify-between cursor-pointer dark:text-gray-300">
            <span>Loop Video</span>
            <input
              type="checkbox"
              className="w-4 h-4 accent-blue-500 cursor-pointer"
              checked={data?.loop ?? true}
              onChange={(e) => onChange({ loop: e.target.checked })}
            />
          </label>

          {!(data?.loop ?? true) && (
            <label className="text-sm text-gray-700 flex items-center justify-between dark:text-gray-300">
              <span>Loop Count</span>
              <input
                type="number"
                min="1"
                className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-sm text-gray-900 focus:border-blue-500 outline-none w-32 dark:text-white"
                value={data?.loop_count ?? 1}
                onChange={(e) => onChange({ loop_count: parseInt(e.target.value) || 1 })}
              />
            </label>
          )}



          <label className="text-sm text-gray-700 flex items-center justify-between dark:text-gray-300">
            <span>Playback Speed</span>
            <select
              className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-sm text-gray-900 focus:border-blue-500 outline-none w-32 dark:text-white"
              value={data?.speed ?? '1.0'}
              onChange={(e) => onChange({ speed: e.target.value })}
            >
              <option value="0.5">0.5x (Slow)</option>
              <option value="1.0">1x (Normal)</option>
              <option value="2.0">2x (Fast)</option>
              <option value="4.0">4x (Ultra)</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
