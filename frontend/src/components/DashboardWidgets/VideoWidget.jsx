import React, { useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';

export default function VideoWidget({ metadata, projectId, config }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    drawBoundingBoxes(metadata);
  }, [metadata]);

  const drawBoundingBoxes = (data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (data && (data.data || data.detections)) {
      // Filter detections by camera_id to ensure boxes match the stream
      // And check if this specific node has AI enabled (config.has_ai)
      const isMatchingCamera = config?.has_ai !== false && (!data.camera_id || data.camera_id === config?.stream_id);
      if (isMatchingCamera) {
        // Clear previous frame only if the metadata is for this camera
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const items = data.data || data.detections || [];
        const taskType = data.type || "detection";

        if (taskType === "detection") {
          items.forEach(det => {
            const [xmin, ymin, xmax, ymax] = det.bbox;
            const x = xmin * canvas.width;
            const y = ymin * canvas.height;
            const width = (xmax - xmin) * canvas.width;
            const height = (ymax - ymin) * canvas.height;

            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);

            ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.fillRect(x, y - 20, ctx.measureText(det.label).width + 40, 20);

            ctx.fillStyle = '#000000';
            ctx.font = '14px sans-serif';
            ctx.fontWeight = 'bold';
            ctx.fillText(`${det.label} (${det.confidence})`, x + 5, y - 5);
          });
        } else if (taskType === "classification") {
          items.forEach((cls, idx) => {
            const yPos = 30 + (idx * 30);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(10, yPos - 20, ctx.measureText(`${cls.label}: ${cls.confidence}`).width + 20, 25);
            ctx.fillStyle = '#00FF00';
            ctx.font = '18px sans-serif';
            ctx.fontWeight = 'bold';
            ctx.fillText(`${cls.label}: ${cls.confidence}`, 20, yPos - 2);
          });
        } else if (taskType === "pose") {
          // COCO skeleton connections: pairs of keypoint indices
          const SKELETON_CONNECTIONS = [
            [0,1],[0,2],[1,3],[2,4],           // Face
            [5,6],                              // Shoulders
            [5,7],[7,9],[6,8],[8,10],           // Arms
            [5,11],[6,12],[11,12],              // Torso
            [11,13],[13,15],[12,14],[14,16]     // Legs
          ];
          items.forEach(pose => {
            if (pose.type === "skeleton" && pose.points) {
              const pts = pose.points.map(pt => ({
                x: pt.x * canvas.width,
                y: pt.y * canvas.height,
                conf: pt.confidence
              }));
              // Draw bone lines first (behind dots)
              ctx.strokeStyle = '#00FF7F';
              ctx.lineWidth = 2;
              SKELETON_CONNECTIONS.forEach(([a, b]) => {
                if (pts[a] && pts[b] && pts[a].conf > 0.3 && pts[b].conf > 0.3) {
                  ctx.beginPath();
                  ctx.moveTo(pts[a].x, pts[a].y);
                  ctx.lineTo(pts[b].x, pts[b].y);
                  ctx.stroke();
                }
              });
              // Draw keypoint dots on top
              pts.forEach(pt => {
                if (pt.conf > 0.3) {
                  ctx.fillStyle = pt.conf > 0.6 ? '#00FFFF' : '#888888';
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
                  ctx.fill();
                }
              });
            }
          });
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-gray-800/80 px-3 py-2 flex items-center gap-2 border-b border-gray-700">
        <Camera size={16} className="text-blue-400" />
        <span className="text-sm font-semibold text-gray-200">{config?.title || 'Live Video Stream'}</span>
      </div>
      <div className="flex-1 relative bg-black">
        {!config?.dataPath ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm flex-col gap-2">
            <Camera size={32} className="text-gray-600" />
            <p>Please bind a video source in settings</p>
          </div>
        ) : projectId ? (
          <iframe 
            src={`http://${window.location.hostname}:8889/${projectId}_${config.stream_id || config.dataPath}/`}
            className="absolute inset-0 w-full h-full border-0 pointer-events-auto"
            title="Live Stream"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">No Project ID</div>
        )}
        <canvas 
          ref={canvasRef}
          width={1280} 
          height={720}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
}
