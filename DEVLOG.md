# 📖 Iriv Vision Studio - Development Log

ไฟล์นี้ใช้สำหรับบันทึกความคืบหน้าของการพัฒนาโปรเจ็กต์ ปัญหาที่พบ การตัดสินใจทางเทคนิค และแผนงานต่อไป เพื่อรักษาความต่อเนื่อง (Continuity) ในการทำงาน

---

<!-- คัดลอก Template ด้านล่างนี้ไปใช้สำหรับสร้าง Entry ใหม่ โดยให้วางไว้ด้านบนสุด (ต่อจากเส้นคั่นนี้) -->
<!-- 
## [YYYY-MM-DD] - สรุปงานสั้นๆ

### 🎯 เป้าหมาย (Goals)
- [ ] 

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- 

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** 
- **เหตุผล:** 

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- 

### ⏭️ ก้าวต่อไป (Next Steps)
- 
-->

## [2026-09-03] - ระบบ Storage Maintenance & Auto-Pruning ป้องกันดิสก์เต็ม

### 🎯 เป้าหมาย (Goals)
- [x] เพิ่มระบบบริหารจัดการพื้นที่จัดเก็บข้อมูล (Storage Maintenance) ทั้งประวัติ Logs และไฟล์ภาพ Snapshots
- [x] ป้องกันปัญหาฐานข้อมูล SQLite ขยายตัวจนกินพื้นที่ Flash/SD card ของ Raspberry Pi / Edge Device
- [x] เพิ่มหน้า UI ให้ผู้ใช้ตั้งค่านโยบาย Retention (อายุ Log) และสั่ง Run Cleanup ได้ด้วยตนเอง

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Backend Database (`backend/db/database.py` & `models.py`)**:
  - เพิ่มฟังก์ชัน `purge_old_logs()` ลบ EventLog เก่าตามอายุวัน และจำกัดจำนวน Record สูงสุด โดยลบเป็น Chunk ละ 500 rows ป้องกัน SQLite lock
  - ลบไฟล์ภาพ Snapshot บน Disk อัตโนมัติตาม Log ที่ถูกล้าง
  - เพิ่มฟังก์ชัน `get_db_stats()` ดึงขนาดไฟล์ `.sqlite`, `.sqlite-wal`, จำนวน records, และขนาดโฟลเดอร์ภาพ snapshots
  - ใส่ Index บน `timestamp`, `node_id`, `event_type`, `camera_id` ในโมเดลเพื่อความเร็วในการค้นหาและล้างข้อมูล
  - กำหนด Max Queue Size (10,000) ใน log queue ป้องกัน RAM ล้น
- **API Server (`backend/web_server/main.py`)**:
  - เพิ่ม Endpoint `GET /api/database/stats` และ `POST /api/database/maintenance/cleanup`
  - ปรับ `write_entities` และ `write_projects` เป็นแบบ Smart Upsert
  - เพิ่มการสั่ง `db.stop()` ใน Application Shutdown Event
- **Frontend UI (`frontend/src/components/LogsViewer.jsx`)**:
  - เพิ่ม Storage Maintenance Modal แสดงสรุปขนาด Database และ Disk usage ของ Snapshots
  - เพิ่มตัวเลือกกำหนด Retention Policy (7, 14, 30, 60 วัน), จำนวน Record สูงสุด, และ Checkbox สั่งลบไฟล์ภาพออกจากดิสก์

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ลบ SQLite rows เป็นชุดๆ (Batch of 500) และลบไฟล์รูปภาพออกจากดิสก์ไปพร้อมกัน
- **เหตุผล:** บน Edge device อย่าง Raspberry Pi การลบข้อมูลหลักแสนแถวในคำสั่งเดียวจะทำให้ SQLite lock เป็นเวลานานและกระทบ realtime pipeline การลบเป็น chunk จึงปลอดภัยและเสถียรกว่า

---

## [2026-08-14] - เปลี่ยนสถาปัตยกรรมเป็น Entity-Based System

### 🎯 เป้าหมาย (Goals)
- [x] อัปเกรดระบบจัดเก็บข้อมูลให้เป็นรูปแบบ "Entity" แบบที่ใช้ในระบบ VMS (Video Management System) มืออาชีพ
- [x] สร้างฐานข้อมูลจำลอง (JSON DB) สำหรับจัดเก็บ Camera, Model, และ Integration Entities
- [x] อัปเดต Node บน UI ทั้งหมดให้ไปดึงข้อมูลจาก Entity DB แทนการพิมพ์ Path หรือ URL ตรงๆ
- [x] ทำให้ Backend สามารถประกอบ GStreamer Pipeline และทำ Logic/Action ได้แบบไดนามิกเต็มรูปแบบ

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้างไฟล์ `backend/db/entities.json` สำหรับเก็บข้อมูลเริ่มต้น
- เพิ่ม API `GET /api/entities` และ `POST /api/entities` ใน `main.py`
- อัปเดต `InputNode`, `AINode`, และ `ActionNode` ให้ Fetch ข้อมูล Entity และสร้าง Dropdown ตัวเลือกอัตโนมัติ
- แก้ไข `pipeline_parser.py` ให้ใช้ `entityId` ในการค้นหาค่า Path และ Config 
- แก้ปัญหาโปรแกรมแครชเมื่อเลือก Model ผิด ด้วยการใส่โค้ด `os.path.exists()` เช็คไฟล์ `.hef` ก่อนเริ่ม GStreamer และมี Fallback กลับไปใช้ YOLOv8s รุ่นเริ่มต้นเสมอ
- เขียน Logic สำหรับ `object_count_gt` และ `label_equals`
- เพิ่มฟังก์ชันส่ง Webhook (`urllib.request`) ทำงานแบบ Thread ไม่บล็อคการประมวลผลวิดีโอ
- **[เพิ่มใหม่]** สร้างหน้า **Settings (Entity Management)** บน Frontend เพื่อให้จัดการ Database JSON ได้ผ่าน UI โดยตรง (CRUD เต็มรูปแบบ)

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ Entity ID ใน Pipeline Graph แทนการบันทึก URL ตรงๆ
- **เหตุผล:** หากมีการเปลี่ยน IP ของกล้อง ผู้ใช้แค่แก้ที่ส่วนกลาง (Settings) ครั้งเดียว กราฟทุกตัวที่ใช้ Entity นี้จะอัปเดตตามอัตโนมัติ และป้องกันเรื่อง Security (การโชว์ Token/Username) บนหน้า Canvas

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ยังไม่มี (ตอนนี้สามารถเพิ่มและลบ Entities ผ่านหน้า Settings ได้หมดแล้ว)

### ⏭️ ก้าวต่อไป (Next Steps)
- ทดสอบระบบภาพรวมและอาจจะพิจารณาการแสดงผล Bounding Box บน Live Dashboard จากข้อมูลที่ถูกยิงกลับมา

## [2026-08-14] - สร้าง Interactive Node Forms (UI to Backend)

### 🎯 เป้าหมาย (Goals)
- [x] อัปเดตโหนด AINode, LogicNode, ActionNode ให้มี Form ที่ใช้งานได้จริง
- [x] ผูกค่า Input ภายในโหนดเข้ากับระบบ Zustand Store
- [x] อัปเดต `pipeline_parser.py` ใน Backend ให้รับค่า Setting จาก JSON แทนการ hardcode

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- เพิ่ม `onChange` handler ใน `select` และ `input` ของทุกโหนดเพื่อเรียกใช้ `updateNodeData(id, ...)` จาก `usePipelineStore.js`
- อัปเดต Backend Parser ให้ดึงค่า `modelType`, `condition`, `value`, `actionType`, `target` ออกมาจาก Payload ของ React Flow เพื่อประกอบเป็น Dynamic Configuration
- อัปเดต `hailo_worker.py` ให้ตรวจสอบค่า logic rule โดยเช็ค `confidence_gt` แทนชื่อแบบเก่า

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้โครงสร้าง Zustand ภายใน Custom Node แทนการเก็บ State ยิบย่อย
- **เหตุผล:** ทำให้ข้อมูลของทุก Node กระจุกรวมอยู่ที่ส่วนกลาง เวลาที่ผู้ใช้กด Deploy Pipeline จะได้สามารถแพ็คข้อมูลทั้งหมดและยิง JSON ออกไปหา Backend ได้ทันทีโดยไม่ต้องไปไล่เก็บข้อมูลทีละ Node

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ยังไม่มี

### ⏭️ ก้าวต่อไป (Next Steps)
- พัฒนาระบบ Action (เช่น ส่ง Webhook แจ้งเตือน หรือคุม GPIO) และเตรียมระบบ Edge/Node Translation ให้ฉลาดขึ้น

## [2026-08-14] - สร้างระบบ Graph Translation (Backend Execution Engine)

### 🎯 เป้าหมาย (Goals)
- [x] สร้างตัวรับข้อมูลจาก UI JSON และแปลงเป็น Python Configuration
- [x] ทำให้ `HailoPipelineWorker` สามารถอัปเดต Pipeline และ Restart ตัวเองได้
- [x] นำข้อมูล Logic และ Action จากกราฟมาประยุกต์ใช้กับ Metadata แบบไดนามิก

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้าง `backend/ai_engine/pipeline_parser.py` ทำหน้าที่สกัดค่า `video_source`, `hef_path` และ กฎของ `logicNode`, `actionNode` ออกมาจาก JSON
- เพิ่มฟังก์ชัน `restart(config)` ใน `hailo_worker.py` เพื่อหยุด GStreamer ชั่วคราว, ดึง config ใหม่ไปสร้าง String แล้วสั่งรันใหม่
- แก้ไขฟังก์ชันสกัด Metadata (Pad Probe) ให้ทำงานร่วมกับ `logic_rules` หากความมั่นใจ (Confidence) ของวัตถุไม่ถึงเกณฑ์ที่ตั้งไว้ใน UI จะถูกกรองทิ้ง และหากผ่านเกณฑ์จะแสดง log ของ Action ที่ตั้งไว้

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้สถาปัตยกรรม Hybrid Execution
- **เหตุผล:** แทนที่จะแปลงเส้นเชือกใน UI ให้กลายเป็นคำสั่ง GStreamer 100% (ซึ่งซับซ้อนและเปราะบางมาก) เราเลือกให้ GStreamer จัดการเฉพาะ AI Inference (Hardware-level) แล้วผลักภาระของการเช็คเงื่อนไข (Logic) และการส่งคำสั่ง (Action) มาไว้ใน Callback ของ Python ทำให้เราสามารถเขียนเงื่อนไขแปลกๆ ได้อย่างยืดหยุ่นในอนาคต

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ปัจจุบันฟังก์ชัน Action ยังเป็นการปริ้นต์ข้อความลง Console (Logger) ต้องเชื่อมต่อกับระบบ GPIO หรือ Webhook จริงในเฟสต่อไป

### ⏭️ ก้าวต่อไป (Next Steps)
- ทำฟอร์ม Input บน Custom Node (Frontend) ให้สามารถพิมพ์ตั้งค่าต่างๆ ได้จริง (เช่น ใส่เลข 0.8 ในโหนด Logic และส่งไป Backend)

## [2026-08-14] - สร้าง No-Code Pipeline Builder UI (Phase 1)

### 🎯 เป้าหมาย (Goals)
- [x] สร้าง UI สำหรับ Pipeline Builder เพื่อให้ผู้ใช้ลากวาง Node จัดการ AI Workflow ได้
- [x] ออกแบบ Custom Nodes (Input, AI, Logic, Action) ให้ดูพรีเมียมและทันสมัย
- [x] แยกส่วนการทำงานระหว่าง Live Dashboard กับ Pipeline Builder ด้วย Tab Navigation

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- ปรับโครงสร้าง `App.jsx` ใหม่ เพิ่มระบบ Tab ด้านบนสุด เพื่อสลับหน้าไปมาได้
- สร้าง Component `PipelineBuilder.jsx` โดยใช้ไลบรารี `@xyflow/react` เป็นแกนหลัก
- สร้าง `Sidebar.jsx` พร้อมระบบ Drag-and-Drop ผ่าน HTML5 DataTransfer API
- ออกแบบ Custom Nodes 4 แบบ (`InputNode`, `AINode`, `LogicNode`, `ActionNode`) ด้วย Tailwind CSS สีสันสวยงาม (Gradients, Lucide Icons)

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** โฟกัสไปที่ Frontend UI อย่างเดียวก่อนในเฟสนี้
- **เหตุผล:** ระบบ Pipeline ของฝั่ง Backend GStreamer มีความซับซ้อนสูงมาก การแยกทำเฉพาะ UI ให้สมบูรณ์แบบก่อนจะช่วยให้เราเห็นภาพรวมของ Data Structure (JSON) ที่จะต้องส่งไปให้ Backend ประมวลผลได้ชัดเจนขึ้น

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ปัจจุบัน Node ต่างๆ ที่ลากวางและเชื่อมเส้นไว้ ยังเป็นเพียง "UI จำลอง" (Mockup) เท่านั้น ยังไม่ได้ถูกส่งไปแปลงเป็น GStreamer Pipeline จริงที่ฝั่ง Backend

### ⏭️ ก้าวต่อไป (Next Steps)
- สร้างระบบแปลงกราฟ (Graph Translation) จาก React Flow JSON ให้กลายเป็นคำสั่ง GStreamer เพื่อรันจริงๆ ใน Backend

## [2026-08-13] - แก้บั๊ก GStreamer & การตั้งค่าเครือข่ายจนระบบสมบูรณ์

### 🎯 เป้าหมาย (Goals)
- [x] แก้ปัญหาเชื่อมต่อ MediaMTX ไม่สำเร็จ
- [x] แก้ปัญหา `asyncio` Event Loop ของ Python Thread 
- [x] แก้ปัญหาหน้าเว็บ Vite ไม่เปิดรับการเชื่อมต่อจากภายนอก (LAN)

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- แก้ไข `hailo_worker.py`: ลบ `rtph264pay` ที่ซ้ำซ้อน และเพิ่ม `h264parse config-interval=1` เพื่อให้ `rtspclientsink` จับคู่สัญญาณกับ MediaMTX ได้สำเร็จตั้งแต่เฟรมแรก
- แก้ไข `web_server/main.py`: ปรับให้ตัวรับ Metadata จาก AI ดึง Event Loop หลักของ FastAPI มาใช้ ป้องกันแอปพลิเคชันพังจากการรันใน `Dummy-2` Thread
- แก้ไข `package.json` ฝั่ง Frontend: เพิ่ม flag `--host` ลงในคำสั่ง `npm run dev` เพื่อให้คอมพิวเตอร์อื่นในวงแลนเข้าถึง UI ได้
- ค้นพบและแก้ไขปัญหา Zombie Process ค้างในระบบด้วยการรัน `pkill -f uvicorn` และรีสตาร์ท MediaMTX ใหม่

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** เพิ่ม `config-interval=1` ลงใน H.264 parser
- **เหตุผล:** ระบบ Edge AI ที่รันบนกล้องจริง (IMX708) มักจะใช้เวลาเริ่มต้น (preroll) นาน การใช้คำสั่งนี้เป็นการบังคับให้ GStreamer พ่น Header วิดีโอ (SPS/PPS) ออกมาต่อเนื่อง ทำให้ระบบ WebRTC ของ MediaMTX มองเห็นสตรีมวิดีโอทันที ไม่ต้องรอนานจน Time out

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- 

### ⏭️ ก้าวต่อไป (Next Steps)
- ทำหน้า Pipeline Builder สำหรับลากวางตรรกะแบบ No-Code

## [2026-08-13] - ติดตั้งและเชื่อมต่อ Video Stream (MediaMTX)

### 🎯 เป้าหมาย (Goals)
- [x] ติดตั้งเซิร์ฟเวอร์ MediaMTX 
- [x] แก้ไข GStreamer Pipeline ให้สามารถส่งวิดีโอคู่ขนาน (Tee) ไปยัง AI Engine และ WebRTC ได้
- [x] ฝังวิดีโอสตรีมลงในหน้า React Dashboard

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- ดาวน์โหลดและติดตั้ง `mediamtx_v1.20.0` ไว้ที่โฟลเดอร์ `backend/mediamtx`
- แก้ไข `backend/ai_engine/hailo_worker.py` โดยเพิ่ม GStreamer `tee` เพื่อแยกภาพออกเป็น 2 กิ่ง กิ่งแรกส่งเข้า Hailo NPU และอีกกิ่งแปลงเป็น H.264 (x264enc) ส่งไปที่ MediaMTX ผ่าน RTSP (`rtsp://localhost:8554/cam`)
- แก้ไข `App.jsx` ให้ฝัง iframe ของ MediaMTX WebRTC (`http://localhost:8889/cam`) แทนที่ช่องว่างเดิม

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ `x264enc` (Software Encoding) แทน Hardware Encoder
- **เหตุผล:** บอร์ด Raspberry Pi 5 ถูกตัดฟีเจอร์ Hardware H.264 Encoder ออกไป การใช้ `x264enc` (ตั้งค่า ultrafast) จึงเป็นวิธีมาตรฐานที่สามารถทำงานได้

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ต้องเปิด MediaMTX ทิ้งไว้ตลอดเวลาเพื่อให้ Backend ส่งภาพเข้ามารับได้

### ⏭️ ก้าวต่อไป (Next Steps)
- ทำหน้า Pipeline Builder สำหรับลากวางตรรกะแบบ No-Code
## [2026-08-13] - สร้าง Frontend Dashboard (React + Vite)

### 🎯 เป้าหมาย (Goals)
- [x] ขึ้นโครงโปรเจกต์ React (Vite) สำหรับหน้า Dashboard
- [x] เขียนโค้ดเชื่อมต่อ WebSocket กับ Backend
- [x] สร้างระบบ Client-Side Canvas Overlay สำหรับวาด Bounding Box (Zero-Copy)

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้างโปรเจกต์ Vite React ในโฟลเดอร์ `frontend/`
- เขียนไฟล์ `App.jsx` ที่เชื่อมต่อ `ws://localhost:8000/ws/metadata`
- ใช้ HTML5 Canvas เพื่อวาดสี่เหลี่ยมพิกัด Bounding Box ทับลงบนพื้นที่เล่นวิดีโอ ช่วยลดภาระของ Edge Server

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ Tailwind CSS v4 สำหรับโครงสร้าง UI เพื่อให้แอปพลิเคชันสวยงาม (Rich Aesthetics)
- **เรื่องที่ตัดสินใจ:** ส่งพิกัด AI Metadata จาก Backend ในรูปแบบ Normalized Array แล้วมาคูณด้วยความกว้าง/ความสูงจริงของ Canvas ที่ฝั่ง Frontend เพื่อป้องกันสัดส่วนภาพผิดเพี้ยน

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ตอนนี้ช่องวิดีโอยังเป็นแค่ Placeholder ต้องรอเชื่อมต่อระบบ WebRTC / RTSP จาก MediaMTX เข้ามาจริงๆ

### ⏭️ ก้าวต่อไป (Next Steps)
- ทำหน้า Pipeline Builder สำหรับลากวางตรรกะแบบ No-Code
## [2026-08-13] - วางโครงสร้าง Backend Core (FastAPI)

### 🎯 เป้าหมาย (Goals)
- [x] สร้างโครงสร้างไฟล์สำหรับ `web_server` และจัดการ WebSocket
- [x] เตรียมไฟล์ Requirement เบื้องต้น

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้างไฟล์ `backend/requirements.txt`
- สร้างระบบ `websocket_manager.py` สำหรับเตรียมกระจาย JSON Metadata
- สร้าง Virtual Environment (`venv`) แบบ `--system-site-packages` พร้อมติดตั้ง requirements
- ร่างคลาส `HailoPipelineWorker` (`hailo_worker.py`) ที่ควบคุม GStreamer Pipeline และดึง Metadata แบบ Zero-Copy
- อัปเดต `main.py` โดยเชื่อมต่อ `HailoPipelineWorker` ผ่านระบบ Lifecycle Events (`lifespan`) และส่ง Metadata ข้าม Thread เข้าสู่ WebSocket Manager อย่างสมบูรณ์

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้โครงสร้างแบบ Asynchronous เต็มรูปแบบ
- **เหตุผล:** เพื่อรองรับการรับส่ง WebSocket ข้อมูล AI ที่มีความถี่สูงได้โดยไม่บล็อกการทำงาน (Non-blocking I/O) ตามที่ระบุไว้ในกฎ `.agents/rules/02_backend_rules.md`

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ยังไม่สามารถทดสอบระบบเชื่อมต่อได้จนกว่าจะมีการทำ AI Engine ส่งข้อมูลเข้ามา

### ⏭️ ก้าวต่อไป (Next Steps)
- ตั้งค่า Python Virtual Environment (`venv`) และพัฒนาส่วน `ai_engine` เพื่อเชื่อมต่อกล้องและ NPU ผ่าน Hailo GStreamer

## [2026-08-13] - เริ่มต้นระบบ Devlog

### 🎯 เป้าหมาย (Goals)
- [x] สร้างระบบบันทึกการพัฒนา (Devlog) สำหรับโปรเจ็กต์ `iriv-vision-studio`

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้างไฟล์ `DEVLOG.md` เป็นไฟล์หลักในการบันทึก
- สร้าง AI Rule ที่ `.agents/rules/devlog.md` เพื่อให้ AI (Antigravity) อ่านและช่วยเขียน Devlog โดยอัตโนมัติ

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** เลือกใช้ไฟล์ `DEVLOG.md` ไฟล์เดียวที่ root directory และเรียงลำดับจากใหม่ไปเก่า (Reverse Chronological)
- **เหตุผล:** เพื่อให้ง่ายต่อการค้นหา อ่าน และให้ AI ประมวลผลบริบทล่าสุดได้อย่างรวดเร็ว

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ยังไม่มี

### ⏭️ ก้าวต่อไป (Next Steps)
- เริ่มบันทึกความคืบหน้าของการพัฒนาฟีเจอร์ต่างๆ ใน `iriv-vision-studio` ลงในไฟล์นี้ในเซสชั่นถัดไป
