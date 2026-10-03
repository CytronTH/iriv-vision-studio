export const nodeSimulators = {
  logicNode: { type: 'boolean-slider' },
  digitalInputNode: { type: 'boolean-toggle' },
  digitalOutputNode: { type: 'boolean-toggle' },
  ledNode: { type: 'boolean-toggle' },
  buzzerNode: { type: 'boolean-toggle' },
  dashboardMetricNode: { type: 'number-input' },
  dashboardTextNode: { type: 'text-input' },
  dashboardLogNode: { type: 'text-input' },
  counterNode: { type: 'number-slider' },
  flowCounterNode: { type: 'number-input' },
  forkliftZoneNode: { type: 'number-slider' },
  snapshotNode: { type: 'boolean-toggle' },
};

export const nodeUseCases = {
  inputNode: [{ title: 'ดึงภาพจากกล้องวงจรปิด', description: 'เชื่อมต่อกล้อง IP Camera ผ่าน RTSP เพื่อดึงภาพสด', videoUrl: 'REQUEST_VIDEO_URL' }],
  aiNode: [{ title: 'ตรวจจับคนบุกรุก', description: 'ใช้ AI โมเดลเพื่อหาตำแหน่งคนในภาพวิดีโอ', videoUrl: 'REQUEST_VIDEO_URL' }],
  logicNode: [
    { title: 'ตรวจจับคนบุกรุก (Presence Detection)', description: 'ตรวจสอบว่าพบคนในกล้องหรือไม่ (has("person")) พร้อมตั้ง Debounce 300ms เพื่อส่งสัญญาณแจ้งเตือน ไซเรน หรือเปิดไฟสปอตไลท์', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'ตรวจจับความแออัดคนเกิน 5 คน (Capacity Monitoring)', description: 'นับจำนวนคนในเฟรมว่าเกินพิกัดหรือไม่ (label_count("person") >= 5) เพื่อสั่งให้ระบบนับยอดหรือแจ้งเตือนเจ้าหน้าที่คุมพื้นที่', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'ตรวจจับความปลอดภัยร่วม (Co-occurrence Safety)', description: 'แจ้งเตือนทันทีเมื่อตรวจพบคนและรถยนต์/โฟล์คลิฟท์อยู่ในพื้นที่เดียวกันพร้อมกัน (has("person") and has("car")) เพื่อป้องกันอุบัติเหตุ', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'กรองความแม่นยำสูง (High Confidence Filter)', description: 'คัดกรองเฉพาะผลตรวจจับที่ AI มั่นใจเกิน 80% ขึ้นไป เพื่อลด False Positive ก่อนสั่งบันทึกภาพ Snapshot หรือส่ง LINE', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'ตรวจจับสิ่งผิดปกติ (Absence Detection)', description: 'ตรวจจับยานพาหนะหรือเครื่องจักรที่เปิดทำงานทิ้งไว้โดยไม่มีเจ้าหน้าที่คุม (has("car") and not has("person")) ต่อเนื่องเกิน 1 วินาที', videoUrl: 'REQUEST_VIDEO_URL' }
  ],
  actionNode: [{ title: 'ส่งข้อความ LINE Notify', description: 'ส่งรูปและข้อความแจ้งเตือนเข้ากลุ่ม LINE', videoUrl: 'REQUEST_VIDEO_URL' }],
  digitalInputNode: [{ title: 'สวิตช์เซ็นเซอร์ประตู', description: 'รับสัญญาณจากแม่เหล็กประตูว่าเปิดหรือปิดอยู่', videoUrl: 'REQUEST_VIDEO_URL' }],
  digitalOutputNode: [{ title: 'เปิดประตูอัตโนมัติ', description: 'สั่งจ่ายไฟให้รีเลย์เพื่อปลดล็อคแม่เหล็กไฟฟ้า', videoUrl: 'REQUEST_VIDEO_URL' }],
  ledNode: [{ title: 'ไฟเตือนสถานะกะพริบ', description: 'เปิดไฟสว่าง 100% เมื่อมีเหตุการณ์ผิดปกติ', videoUrl: 'REQUEST_VIDEO_URL' }],
  buzzerNode: [{ title: 'เสียงเตือนภัย', description: 'ส่งเสียงปี๊บดังเมื่อมีคนบุกรุกในยามวิกาล', videoUrl: 'REQUEST_VIDEO_URL' }],
  rs485Node: [{ title: 'สั่งงาน PLC ในโรงงาน', description: 'ส่งคำสั่ง Modbus ไปควบคุมให้สายพานหยุดทำงาน', videoUrl: 'REQUEST_VIDEO_URL' }],
  dashboardVideoNode: [{ title: 'แสดงภาพสด', description: 'ดูกล้องวงจรปิดพร้อมกรอบ AI (Bounding Box) บนหน้าเว็บ', videoUrl: 'REQUEST_VIDEO_URL' }],
  dashboardMetricNode: [{ title: 'แสดงจำนวนคนสุทธิ', description: 'แสดงตัวเลขขนาดใหญ่บน Dashboard เช่น จำนวนคนในร้าน', videoUrl: 'REQUEST_VIDEO_URL' }],
  dashboardTextNode: [{ title: 'แสดงสถานะเครื่องจักร', description: 'แสดงข้อความ "ทำงานปกติ" หรือ "เครื่องหยุด"', videoUrl: 'REQUEST_VIDEO_URL' }],
  dashboardLogNode: [{ title: 'ประวัติคนเข้าออก', description: 'แสดงรายการบันทึกเวลาคนเข้าออกแบบเรียงลำดับ', videoUrl: 'REQUEST_VIDEO_URL' }],
  debugNode: [{ title: 'ตรวจสอบข้อมูลดิบ', description: 'ดูข้อมูล JSON ที่ไหลผ่านระหว่างโหนดเพื่อใช้ตรวจสอบบั๊ก', videoUrl: 'REQUEST_VIDEO_URL' }],
  counterNode: [{ title: 'นับยอดของเสียสะสม (NG Counter)', description: 'นับสะสมจำนวนครั้งที่เงื่อนไขจาก Logic Node ตรวจพบของเสีย หรือนับรอบการเกิดสัญญาณเตือน', videoUrl: 'REQUEST_VIDEO_URL' }],
  flowCounterNode: [{ title: 'นับคนหรือวัตถุข้ามเส้นเข้า-ออก', description: 'ติดตามการเคลื่อนที่ของวัตถุและลากเส้นหน้าประตูหรือบนสายพานเพื่อนับจำนวนแบบไม่นับซ้ำ', videoUrl: 'REQUEST_VIDEO_URL' }],
  shelfSlotMonitorNode: [{ title: 'ตรวจจับของขาดชั้นวาง', description: 'ตรวจสอบว่าช่องไหนบนชั้นวางว่างอยู่บ้าง เพื่อแจ้งพนักงานเติมของ', videoUrl: 'REQUEST_VIDEO_URL' }],
  forkliftZoneNode: [{ title: 'แจ้งเตือนโฟล์คลิฟท์ใกล้คน', description: 'เมื่อรถโฟล์คลิฟท์ขับเข้าใกล้พนักงานในรัศมี 3 เมตร จะสั่งให้รถหยุดหรือส่งเสียงเตือน', videoUrl: 'REQUEST_VIDEO_URL' }],
  snapshotNode: [{ title: 'ถ่ายภาพทะเบียนรถ', description: 'บันทึกภาพนิ่งเมื่อมีรถขับผ่านเกตเวย์เพื่อเก็บเป็นหลักฐาน', videoUrl: 'REQUEST_VIDEO_URL' }]
};
