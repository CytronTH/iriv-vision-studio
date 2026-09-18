export const mockNodeData = {
  inputNode: { label: 'Input Source', source: 'rtsp://192.168.1.100/stream' },
  aiNode: { label: 'AI Model (YOLO)', model: 'yolov8n.hef' },
  logicNode: { label: 'Logic (person > 0)' },
  actionNode: { label: 'Action / Alert', url: 'https://notify-api.line.me/api/notify' },
  digitalInputNode: { label: 'Digital Input (Door Sensor)' },
  digitalOutputNode: { label: 'Digital Output (Door Lock)' },
  ledNode: { label: 'LED Driver' },
  buzzerNode: { label: 'Active Buzzer' },
  rs485Node: { label: 'RS485 Modbus', payload: '01 05 00 00 FF 00' },
  dashboardVideoNode: { label: 'Video Stream (Dashboard)' },
  dashboardMetricNode: { label: 'Number / Metric' },
  dashboardTextNode: { label: 'Text Value', defaultText: 'Door is closed' },
  dashboardLogNode: { label: 'Log History (Dashboard)' },
  dashboardChartNode: { label: 'Chart (Dashboard)' },
  debugNode: { label: 'Debug Node' }
};

export const nodeTutorials = {
  inputNode: {
    title: "Input Source",
    description: "โหนดเริ่มต้นสำหรับดึงภาพวิดีโอจากแหล่งข้อมูลต่างๆ เข้าสู่ระบบ",
    explanation: "โหนด Input Source เปรียบเสมือน 'ดวงตา' ของระบบ AI Pipeline โดยจะทำหน้าที่ดึงภาพวิดีโอแบบสด (Live Stream) ไม่ว่าจะเป็นจากกล้องวงจรปิด (CCTV) ผ่านโปรโตคอล RTSP, กล้อง USB บนตัวเครื่อง, หรือไฟล์วิดีโอ แล้วส่งต่อเฟรมภาพ (Video Frames) เหล่านั้นไปยังโหนด AI หรือโหนดแสดงผลอื่นๆ ทันที โดยที่ตัวมันเองไม่ต้องรับข้อมูลจากใคร",
    mockSettings: {
      options: [
        { id: 'video_file', label: 'ไฟล์วิดีโอ (Video File)', icon: 'video' },
        { id: 'cctv', label: 'กล้องวงจรปิด (CCTV / RTSP)', icon: 'cctv' },
        { id: 'onboard', label: 'กล้องบนตัวบอร์ด (On-board Camera)', icon: 'camera' }
      ],
      note: "หมายเหตุ: ในโหมดจำลอง (Wiki Sandbox) ระบบจะเตรียมวิดีโอพิเศษไว้ให้ทดสอบ 2 คลิป (สำหรับ Object Detection และ Pose Estimation) เพื่อป้องกันปัญหาการเข้าถึงกล้องจริง คุณสามารถเลือกเปลี่ยนคลิปใน Dropdown ด้านบนได้เลย"
    },
    supportedInputs: [],
    supportedOutputs: ['aiNode', 'dashboardVideoNode', 'debugNode']
  },
  aiNode: {
    title: "AI Model",
    description: "โหนดสำหรับประมวลผลภาพด้วยปัญญาประดิษฐ์ (AI)",
    input: {
      desc: "รับภาพวิดีโอ (Video Stream) จาก Input Source",
      example: "ต่อสายจาก Output ของ Input Source"
    },
    process: {
      desc: "รันโมเดล AI บนชิป NPU (Hailo-8L) เพื่อวิเคราะห์ภาพในแต่ละเฟรม เช่น ตรวจจับวัตถุ (Object Detection) หรือ ตรวจจับโครงร่าง (Pose Estimation)",
      example: "ใช้โมเดล YOLOv8 เพื่อค้นหาคน, รถ, หรือสุนัข"
    },
    output: {
      desc: "ข้อมูลอธิบายภาพ (AI Metadata) พร้อมพิกัดกรอบวัตถุและรายชื่อวัตถุที่พบ",
      example: "[ { label: 'person', confidence: 0.89, bbox: [...] } ]"
    },
    supportedInputs: ['inputNode'],
    supportedOutputs: ['logicNode', 'dashboardVideoNode', 'debugNode']
  },
  logicNode: {
    title: "Logic / Filter",
    description: "โหนดกำหนดเงื่อนไขตรรกะ เพื่อกรองข้อมูลจาก AI",
    input: {
      desc: "รับข้อมูล AI Metadata จาก AI Model",
      example: "ต่อสายจาก Output ของ AI Model"
    },
    process: {
      desc: "คัดกรองข้อมูลตามเงื่อนไขที่คุณตั้งไว้ เช่น ให้ทำงานเมื่อเจอ 'คน' มากกว่า 0 คน",
      example: "Label = 'person', Count > 0"
    },
    output: {
      desc: "สถานะความจริง (True / False) และจำนวนวัตถุที่นับได้ที่ผ่านเงื่อนไข",
      example: "{ value: true, count: 2 }"
    },
    supportedInputs: ['aiNode', 'digitalInputNode'],
    supportedOutputs: ['actionNode', 'digitalOutputNode', 'ledNode', 'buzzerNode', 'rs485Node', 'dashboardMetricNode', 'dashboardLogNode']
  },
  actionNode: {
    title: "Action / Alert",
    description: "โหนดสั่งการเมื่อเงื่อนไขเป็นจริง (True)",
    input: {
      desc: "รับสถานะ True/False จาก Logic Node",
      example: "ต่อสายจาก Output ของ Logic Node"
    },
    process: {
      desc: "เมื่อได้รับสัญญาณ True จะทำการส่งคำสั่งออกไปยังระบบภายนอก เช่น การแจ้งเตือน Webhook",
      example: "ส่ง HTTP POST ไปยังเซิร์ฟเวอร์ หรือ LINE Notify"
    },
    output: {
      desc: "ไม่ส่งออกข้อมูลไปยังโหนดอื่น (เป็นจุดสิ้นสุด)",
      example: "N/A"
    },
    supportedInputs: ['logicNode', 'digitalInputNode'],
    supportedOutputs: []
  },
  digitalInputNode: {
    title: "Digital Input",
    description: "โหนดรับสัญญาณไฟฟ้า (0V / 3.3V) จากภายนอก",
    input: {
      desc: "รับสัญญาณไฟฟ้าจริงจากฮาร์ดแวร์ภายนอก (ผ่านสายไฟเข้าพอร์ต DI)",
      example: "เซ็นเซอร์ประตู, สวิตช์ปุ่มกด"
    },
    process: {
      desc: "อ่านสถานะทางไฟฟ้าแบบดิจิทัล และแปลงเป็นค่า True (มีไฟ) หรือ False (ไม่มีไฟ)",
      example: "หากกดสวิตช์ จะอ่านค่าได้ True"
    },
    output: {
      desc: "สถานะความจริง (True / False) สำหรับส่งไปสั่งงาน Logic หรือ Action",
      example: "{ value: true }"
    },
    supportedInputs: [],
    supportedOutputs: ['logicNode', 'actionNode', 'dashboardTextNode', 'dashboardLogNode']
  },
  digitalOutputNode: {
    title: "Digital Output",
    description: "โหนดสั่งจ่ายไฟ (0V / 3.3V) ไปยังฮาร์ดแวร์ภายนอก",
    input: {
      desc: "รับสถานะ True/False จาก Logic Node",
      example: "ต่อสายจาก Output ของ Logic Node"
    },
    process: {
      desc: "เมื่อได้รับสัญญาณ True จะสั่งให้ชิปจ่ายไฟ 3.3V ออกไปยังพอร์ต DO ที่กำหนด (สลับสถานะเปิด/ปิดสวิตช์อิเล็กทรอนิกส์)",
      example: "สั่งทำงาน Relay เพื่อเปิดประตูอัตโนมัติ"
    },
    output: {
      desc: "ไม่ส่งข้อมูลในระบบ (สั่งการด้วยไฟฟ้าจริงออกนอกบอร์ด)",
      example: "N/A"
    },
    supportedInputs: ['logicNode', 'digitalInputNode'],
    supportedOutputs: []
  },
  ledNode: {
    title: "LED Driver",
    description: "โหนดควบคุมหลอดไฟ LED บนบอร์ด",
    input: {
      desc: "รับสถานะ True/False จาก Logic Node",
      example: "ต่อสายจาก Output ของ Logic Node"
    },
    process: {
      desc: "เมื่อได้รับสัญญาณ True จะสั่งจ่ายกระแสไฟฟ้าไปยังหลอด LED ตามระดับความสว่าง (Brightness) ที่คุณกำหนดผ่านระบบ PWM",
      example: "ไฟ LED ติดสว่าง 80% เมื่อพบคน"
    },
    output: {
      desc: "ไม่ส่งข้อมูลในระบบ (แสดงผลเป็นแสงไฟจริง)",
      example: "N/A"
    },
    supportedInputs: ['logicNode', 'digitalInputNode'],
    supportedOutputs: []
  },
  buzzerNode: {
    title: "Active Buzzer",
    description: "โหนดสร้างเสียงเตือน (Buzzer)",
    input: {
      desc: "รับสถานะ True/False จาก Logic Node",
      example: "ต่อสายจาก Output ของ Logic Node"
    },
    process: {
      desc: "เมื่อได้รับสัญญาณ True จะสั่งจ่ายกระแสไฟไปยังลำโพง Buzzer ทำให้เกิดเสียงดังเตือน ปี๊บๆ",
      example: "เสียงเตือนดัง 1 วินาที เมื่อมีผู้บุกรุก"
    },
    output: {
      desc: "ไม่ส่งข้อมูลในระบบ (แสดงผลเป็นเสียงจริง)",
      example: "N/A"
    },
    supportedInputs: ['logicNode', 'digitalInputNode'],
    supportedOutputs: []
  },
  rs485Node: {
    title: "RS485 Modbus",
    description: "โหนดสื่อสารกับอุปกรณ์อุตสาหกรรมด้วยโปรโตคอล RS485",
    input: {
      desc: "รับสถานะ True/False จาก Logic Node",
      example: "ต่อสายจาก Output ของ Logic Node"
    },
    process: {
      desc: "ส่งชุดข้อความ (Payload) เป็น String หรือ Hex ออกไปทางพอร์ต Serial RS485 เพื่อสื่อสารกับ PLC หรือเครื่องจักร",
      example: "ส่ง Hex: 01 05 00 00 FF 00 8C 3A"
    },
    output: {
      desc: "ไม่ส่งข้อมูลในระบบ (ส่งออกเป็นสัญญาณ Serial)",
      example: "N/A"
    },
    supportedInputs: ['logicNode', 'digitalInputNode'],
    supportedOutputs: []
  },
  dashboardVideoNode: {
    title: "Video Stream (Dashboard)",
    description: "โหนดแสดงภาพวิดีโอบน Live Dashboard",
    input: {
      desc: "รับภาพวิดีโอจาก Input Source (กล้อง) หรือภาพวิดีโอที่วาดกล่องแล้วจาก AI Model",
      example: "ต่อสายจาก AI Model"
    },
    process: {
      desc: "เตรียมช่องสัญญาณและแปลงรูปแบบวิดีโอให้สามารถไปปรากฏเป็น Video Widget บนหน้า Live Dashboard",
      example: "สตรีมภาพผลลัพธ์ผ่าน RTSP WebRTC"
    },
    output: {
      desc: "ส่งภาพไปยังหน้า Dashboard (ฝั่ง UI)",
      example: "N/A"
    },
    supportedInputs: ['aiNode', 'inputNode'],
    supportedOutputs: []
  },
  dashboardMetricNode: {
    title: "Number / Metric (Dashboard)",
    description: "โหนดแสดงตัวเลขสถิติบน Live Dashboard",
    input: {
      desc: "รับข้อมูลตัวเลข เช่น Count จาก Logic Node",
      example: "ต่อสายจาก Logic Node ที่นับจำนวนคน"
    },
    process: {
      desc: "ดึงข้อมูลจากเส้นทางที่กำหนด (Data Path) และนำไปผูกติดกับ Metric Widget เพื่อแสดงผลเป็นตัวเลขขนาดใหญ่ หรือกราฟบน Dashboard",
      example: "แสดงตัวเลขจำนวนคนเดินผ่านประตู"
    },
    output: {
      desc: "ส่งข้อมูลตัวเลขไปยังหน้า Dashboard (ฝั่ง UI)",
      example: "N/A"
    },
    supportedInputs: ['logicNode'],
    supportedOutputs: []
  },
  dashboardTextNode: {
    title: "Text Value (Dashboard)",
    description: "โหนดแสดงข้อความหรือสถานะบน Live Dashboard",
    input: {
      desc: "รับข้อมูลข้อความหรือสถานะจาก Logic Node หรือโหนดอื่นๆ",
      example: "ต่อสายจาก Logic Node เพื่อรับสถานะ"
    },
    process: {
      desc: "นำข้อความที่ได้รับมาแสดงผลเป็นตัวอักษรบน Widget ข้อความเดี่ยว (เช่น สถานะปกติ, มีผู้บุกรุก)",
      example: "แสดงข้อความ 'ประตูปิด' หรือ 'ประตูเปิด'"
    },
    output: {
      desc: "ส่งข้อมูลข้อความไปยังหน้า Dashboard (ฝั่ง UI)",
      example: "N/A"
    },
    supportedInputs: ['digitalInputNode', 'logicNode'],
    supportedOutputs: []
  },
  dashboardLogNode: {
    title: "Log History (Dashboard)",
    description: "โหนดบันทึกและแสดงประวัติเหตุการณ์ (Log) บน Live Dashboard",
    input: {
      desc: "รับสถานะหรือข้อความจาก Logic Node เมื่อมีเหตุการณ์เกิดขึ้น",
      example: "ต่อสายจาก Logic Node"
    },
    process: {
      desc: "เมื่อมีเหตุการณ์เกิดขึ้นตามเงื่อนไข (True) จะทำการส่งข้อความ (Message) พร้อมเวลา ไปบันทึกเรียงต่อกันเป็นประวัติ (Log) บน Dashboard",
      example: "พิมพ์ข้อความ '10:45 ตรวจพบผู้บุกรุก!' บนหน้าต่าง Log Widget"
    },
    output: {
      desc: "ส่งข้อมูลรายการ Log ไปยังหน้า Dashboard (ฝั่ง UI)",
      example: "N/A"
    },
    supportedInputs: ['logicNode', 'digitalInputNode'],
    supportedOutputs: []
  },
  dashboardChartNode: {
    title: "Chart (Dashboard)",
    description: "โหนดแสดงกราฟข้อมูลบน Live Dashboard",
    input: {
      desc: "รับข้อมูลประเภทอาร์เรย์ (Array) หรือประวัติ (History) จาก Counter หรือโหนดอื่นๆ",
      example: "ต่อสายจาก Counter Node"
    },
    process: {
      desc: "นำข้อมูลสถิติหรือประวัติมาพล็อตเป็นกราฟเส้นหรือกราฟแท่งบน Live Dashboard เพื่อดูแนวโน้ม (Trend)",
      example: "แสดงกราฟจำนวนรถที่วิ่งผ่านในแต่ละชั่วโมง"
    },
    output: {
      desc: "ส่งข้อมูลกราฟไปยังหน้า Dashboard (ฝั่ง UI)",
      example: "N/A"
    },
    supportedInputs: ['counterNode', 'flowCounterNode', 'logicNode'],
    supportedOutputs: []
  },
  debugNode: {
    title: "Debug Node",
    description: "โหนดสำหรับนักพัฒนาเพื่อทดสอบและตรวจสอบข้อมูล",
    input: {
      desc: "รับข้อมูลได้ทุกรูปแบบ (วิดีโอ, AI Metadata, Logic State)",
      example: "ต่อเพื่อแอบดูข้อมูลระหว่างทาง"
    },
    process: {
      desc: "จำลองตัวเองเป็นหน้าจอขนาดเล็กเพื่อวาดกรอบ Bounding Box พร้อมกับดึงข้อมูล Log ดิบลอยมาแสดงที่หน้าต่าง Debug Output (แถบด้านขวา)",
      example: "เช็คค่า JSON แบบ Realtime หรือเช็คภาพผลลัพธ์ AI บน Canvas"
    },
    output: {
      desc: "ไม่เปลี่ยนแปลงข้อมูลใดๆ (ทำหน้าที่เพียง Observer)",
      example: "N/A"
    },
    supportedInputs: ['aiNode', 'logicNode', 'inputNode', 'digitalInputNode'],
    supportedOutputs: ['logicNode', 'dashboardVideoNode', 'dashboardMetricNode', 'actionNode']
  },
  counterNode: {
    title: "Counter",
    description: "โหนดนับจำนวนสะสม (Accumulate) หรือหาค่าเฉลี่ย",
    input: {
      desc: "รับข้อมูลตัวเลข (เช่น Count) หรือสถานะจาก Logic Node",
      example: "รับค่า { count: 2 }"
    },
    process: {
      desc: "บวกสะสมค่าที่ได้รับในแต่ละเฟรม หรือนับเวลาที่เงื่อนไขเป็นจริง",
      example: "นับจำนวนคนเดินผ่านไปแล้วทั้งหมด 15 คน"
    },
    output: {
      desc: "ผลรวมของตัวเลข (Total Count) หรือค่าสถิติอื่นๆ",
      example: "{ total_count: 15 }"
    },
    supportedInputs: ['logicNode'],
    supportedOutputs: ['dashboardMetricNode', 'dashboardTextNode']
  },
  flowCounterNode: {
    title: "Flow Counter",
    description: "โหนดนับจำนวนคนหรือวัตถุที่เดินข้ามเส้น (Line Crossing)",
    input: {
      desc: "รับข้อมูล AI Metadata (พิกัดกล่อง) จาก AI Node",
      example: "ต่อสายจาก Output ของ AI Model"
    },
    process: {
      desc: "ตรวจสอบว่ามีพิกัดของวัตถุเคลื่อนที่ตัดผ่านเส้นสมมติที่ลากไว้หรือไม่ พร้อมจำแนกทิศทาง (เข้า/ออก)",
      example: "ลากเส้นหน้าประตู เพื่อพิจารณาคนเดินเข้า (In) และเดินออก (Out)"
    },
    output: {
      desc: "จำนวนวัตถุที่เดินผ่านเส้น แบ่งตามทิศทาง",
      example: "{ in: 5, out: 2, net: 3 }"
    },
    supportedInputs: ['aiNode'],
    supportedOutputs: ['dashboardMetricNode', 'actionNode']
  },
  shelfSlotMonitorNode: {
    title: "Shelf Monitor",
    description: "โหนดตรวจสอบสถานะช่องวางของบนชั้นวาง (Shelf Slot)",
    input: {
      desc: "รับข้อมูล AI Metadata จาก AI Node",
      example: "ต่อสายจาก AI Model ที่มีผลลัพธ์การตรวจจับสินค้า"
    },
    process: {
      desc: "เปรียบเทียบกล่องวัตถุ (Bounding Box) กับพื้นที่ช่องวางของ (ROIs) ที่กำหนดไว้ เพื่อดูว่าช่องไหนว่าง หรือช่องไหนมีของ",
      example: "ตรวจชั้นวางว่ามีสินค้ายี่ห้อ A วางอยู่ในช่องที่ 1 หรือไม่"
    },
    output: {
      desc: "สถานะของแต่ละช่องบนชั้นวาง (Occupied / Empty)",
      example: "{ slot_1: 'occupied', slot_2: 'empty' }"
    },
    supportedInputs: ['aiNode'],
    supportedOutputs: ['dashboardTextNode', 'actionNode']
  },
  forkliftZoneNode: {
    title: "Forklift Safety",
    description: "โหนดแจ้งเตือนความปลอดภัยเมื่อมีคนหรือวัตถุเข้าใกล้รถโฟล์คลิฟท์",
    input: {
      desc: "รับข้อมูล AI Metadata (พิกัดคนและรถโฟล์คลิฟท์) จาก AI Node",
      example: "ต่อสายจาก AI Model (เช่น YOLO) ที่เทรนมาเพื่อจับคนและรถ"
    },
    process: {
      desc: "คำนวณระยะห่างระหว่าง 'คน' กับ 'รถโฟล์คลิฟท์' หากมีคนเข้าไปในรัศมีอันตราย จะส่งสัญญาณแจ้งเตือนทันที",
      example: "หากคนอยู่ห่างจากรถ < 2 เมตร ให้ออกสถานะเตือนภัยอันตราย"
    },
    output: {
      desc: "สถานะความปลอดภัย และระยะห่างที่เกิดอันตราย",
      example: "{ status: 'danger', distance: 1.5 }"
    },
    supportedInputs: ['aiNode'],
    supportedOutputs: ['actionNode', 'buzzerNode', 'dashboardTextNode']
  },
  snapshotNode: {
    title: "Snapshot",
    description: "โหนดบันทึกภาพนิ่ง (Snapshot) เมื่อเกิดเหตุการณ์สำคัญ",
    input: {
      desc: "รับภาพวิดีโอจาก Input/AI และสัญญาณ Trigger จาก Logic/Action",
      example: "ต่อสาย Video จาก AI Node และสาย Trigger จาก Logic Node"
    },
    process: {
      desc: "เมื่อได้รับสัญญาณ Trigger (True) จะทำการแคปเจอร์เฟรมวิดีโอปัจจุบันและบันทึกลงในระบบ หรือส่งแจ้งเตือน",
      example: "ถ่ายภาพบันทึกหลักฐานเมื่อมีผู้บุกรุกตอน 22:00 น."
    },
    output: {
      desc: "เส้นทางรูปภาพ (Image Path) หรือ URL ของภาพที่ถูกบันทึกไว้ในระบบ",
      example: "{ image_url: '/snapshots/12345.jpg' }"
    },
    supportedInputs: ['inputNode', 'aiNode', 'logicNode', 'digitalInputNode'],
    supportedOutputs: ['actionNode', 'dashboardLogNode']
  }
};
