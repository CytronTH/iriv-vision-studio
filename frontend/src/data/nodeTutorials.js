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
  debugNode: { label: 'Debug Node' }
};

export const nodeTutorials = {
  inputNode: {
    title: "Input Source",
    description: "โหนดเริ่มต้นสำหรับดึงภาพวิดีโอจากกล้องเข้าสู่ระบบ",
    input: {
      desc: "ไม่รับข้อมูลจากโหนดอื่น (เป็นจุดเริ่มต้น)",
      example: "N/A"
    },
    process: {
      desc: "เชื่อมต่อกับกล้องผ่านโปรโตคอล RTSP หรือเรียกใช้กล้อง USB/CSI บนบอร์ดโดยตรง เพื่อดึงภาพวิดีโอแบบสด (Live Stream) เข้ามาประมวลผล",
      example: "ตั้งค่า RTSP URL: rtsp://192.168.1.100:554/stream1"
    },
    output: {
      desc: "ภาพวิดีโอ (Video Frames) สำหรับส่งต่อให้โหนด AI หรือโหนดแสดงผล",
      example: "Video Stream"
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
  }
};
