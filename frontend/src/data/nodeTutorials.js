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
    supportedOutputs: ['logicNode', 'flowCounterNode', 'dashboardVideoNode', 'debugNode']
  },
  logicNode: {
    title: "Logic / Filter",
    description: "โหนดประเมินเงื่อนไขตรรกะ เพื่อคัดกรองผลการตรวจจับจาก AI (Object Detection) หรือ Digital Input แล้วส่งออกสถานะ True / False",
    explanation: "โหนด Logic / Filter ทำหน้าที่เสมือน 'สมองตัดสินใจ' (Rule Evaluator) ของระบบ AI Pipeline โดยรับข้อมูล Metadata ผลลัพธ์การตรวจจับจาก AI Node (เช่น Bounding Box, Label, Confidence) ในแต่ละเฟรม แล้วนำมาตรวจสอบกับเงื่อนไขตรรกะที่คุณกำหนดไว้ หากเงื่อนไขเป็นจริง ระบบจะส่งสัญญาณ True เพื่อสั่งการโหนดถัดไป เช่น สั่งถ่าย Snapshot, สั่งเปิด Buzzer/LED, ส่งแจ้งเตือนภายนอก หรือเพิ่มค่านับใน Counter พร้อมระบบ Debounce ที่ช่วยป้องกันสัญญาณกระพริบ (Flicker) และลด False Alarm ในงาน Computer Vision",
    input: {
      desc: "รับข้อมูล AI Metadata (ผลลัพธ์ Object Detection) จาก AI Model หรือสัญญาณดิจิทัลจาก Digital Input",
      example: "{ payload: { detections: [{ label: 'person', confidence: 0.88, bbox: [...] }], count: 1, labels: ['person'] } }"
    },
    process: {
      desc: "ประเมินเงื่อนไขตรรกะ (เช่น has('person'), label_count('person') >= 2) รองรับทั้งการลากวางบล็อกสำเร็จรูป (Equation Builder) และการเขียนสูตร Python (Code Editor) พร้อมการหน่วงเวลา Debounce",
      example: "has(\"person\") and label_confidence(\"person\") >= 0.80  (Debounce: 300 ms)"
    },
    output: {
      desc: "ส่งออกสถานะความจริง (True / False) เพื่อนำไปสั่งงานโหนด Action, Hardware Output หรือ Dashboard",
      example: "{ payload: true, metadata: { camera_id: 'cam_1', timestamp: 1727100000.12 } }"
    },
    supportedInputs: ['aiNode', 'digitalInputNode'],
    supportedOutputs: ['actionNode', 'digitalOutputNode', 'ledNode', 'buzzerNode', 'rs485Node', 'dashboardMetricNode', 'dashboardLogNode', 'snapshotNode', 'counterNode'],
    guide: {
      modes: [
        {
          id: 'equation',
          name: 'Equation Builder (โหมดลากวางบล็อก)',
          badge: 'เหมาะสำหรับผู้เริ่มต้น',
          desc: 'สร้างเงื่อนไขโดยการคลิกหรือลากบล็อกชิปคำสั่งมาวางใน Equation Box ระบบจะดึง Class ทั้งหมดจากโมเดล AI ที่เชื่อมต่ออยู่มาสร้างเป็นบล็อกให้อัตโนมัติ เช่น Has person, Count person, Conf. person และบล็อกตรรกะ AND, OR, NOT, เปรียบเทียบตัวเลข'
        },
        {
          id: 'code',
          name: 'Code Editor (โหมดเขียน Python Expression)',
          badge: 'ยืดหยุ่นขั้นสูง',
          desc: 'เขียนสูตรเงื่อนไขตรรกะแบบไพธอนได้โดยตรงในช่อง Textarea รองรับตัวดำเนินการ and, or, not, วงเล็บจัดกลุ่มเงื่อนไข และฟังก์ชัน Built-in ต่างๆ เหมาะสำหรับงานที่มีตรรกะเงื่อนไขซับซ้อน'
        }
      ],
      variables: [
        { name: 'has("label")', type: 'bool', desc: 'ตรวจสอบว่าพบวัตถุชนิดนั้นในเฟรมหรือไม่ (คืนค่า True/False)', example: 'has("person")' },
        { name: 'label_count("label")', type: 'int', desc: 'นับจำนวนวัตถุเฉพาะคลาสนั้นในเฟรม', example: 'label_count("person") >= 2' },
        { name: 'count', type: 'int', desc: 'จำนวนวัตถุทั้งหมดที่ตรวจพบในเฟรม (ทุกคลาสรวมกัน)', example: 'count > 0' },
        { name: 'confidence', type: 'float', desc: 'ค่าความมั่นใจสูงสุดของทุกวัตถุในเฟรม (ช่วง 0.0 - 1.0)', example: 'confidence >= 0.80' },
        { name: 'label_confidence("label")', type: 'float', desc: 'ค่าความมั่นใจสูงสุดของวัตถุคลาสนั้น', example: 'label_confidence("person") > 0.75' },
        { name: 'all_labels("A", "B")', type: 'bool', desc: 'ตรวจสอบว่าพบวัตถุทั้งสองชนิดพร้อมกันในเฟรม', example: 'all_labels("person", "car")' },
        { name: 'any_label("A", "B")', type: 'bool', desc: 'ตรวจสอบว่าพบวัตถุอย่างน้อยหนึ่งชนิดที่ระบุ', example: 'any_label("forklift", "truck")' },
        { name: 'msg["payload"]', type: 'list / dict', desc: 'ออบเจ็กต์ข้อมูล Detections ดิบทั้งหมดจาก AI', example: 'len(msg["payload"]) > 0' }
      ],
      debounce: {
        title: 'การตั้งค่า Debounce (ms) เพื่อลด False Trigger',
        desc: 'ในระบบตรวจจับด้วยภาพ (Computer Vision) วัตถุอาจกระพริบ (Flicker) หลุดเฟรมไป 1 เฟรม หรือมีสิ่งแปลกปลอมผ่านกล้องเพียงเสี้ยววินาที การตั้งค่า Debounce เช่น 300 - 1000 ms จะช่วยหน่วงเวลาให้แน่ใจว่าเงื่อนไขต้องคงสถานะ True ต่อเนื่องกันตามเวลาที่กำหนด จึงจะเริ่มส่งสัญญาณ True ออกไปสั่งการโหนดถัดไป ช่วยขจัดปัญหาการแจ้งเตือนผิดพลาดได้อย่างมีประสิทธิภาพ'
      },
      flowControl: {
        title: 'การควบคุมการไหลของข้อมูล (Output Trigger Mode & Cooldown)',
        desc: 'เนื่องจาก AI Node ส่งข้อมูลออกมาระดับ 25-30 FPS การเลือกโหมด On Change (ส่งเฉพาะเมื่อสถานะเปลี่ยน) หรือ Rising Edge (ส่งเมื่อเป็นจริงครั้งแรก) ร่วมกับการตั้ง Cooldown (ms) จะช่วยตัดปัญหาข้อมูลไหลทะลักและป้องกันการยิงสั่ง Action ซ้ำซ้อนได้อย่างสมบูรณ์แบบ'
      },
      recipes: [
        {
          title: '1. ตรวจจับคนบุกรุกพื้นที่ (Presence Detection)',
          expr: 'has("person")',
          debounce: 300,
          desc: 'ส่งสัญญาณ True ทันทีที่มีคนเข้ามาในกล้องต่อเนื่องเกิน 300ms',
          downstream: 'Buzzer, LED, Snapshot'
        },
        {
          title: '2. ตรวจจับคนหนาแน่นเกินกำหนด (Capacity Limit)',
          expr: 'label_count("person") >= 5',
          debounce: 500,
          desc: 'แจ้งเตือนเมื่อมีจำนวนคนในพื้นที่ตั้งแต่ 5 คนขึ้นไป',
          downstream: 'Dashboard Metric, Action (Line Notify)'
        },
        {
          title: '3. ตรวจจับความปลอดภัยร่วม (คน + รถโฟล์คลิฟท์/รถยนต์)',
          expr: 'has("person") and has("car")',
          debounce: 200,
          desc: 'แจ้งเตือนเหตุการณ์อันตรายเมื่อคนและยานพาหนะเข้ามาอยู่ในเฟรมเดียวกัน',
          downstream: 'Buzzer, Digital Output (Relay สั่งหยุดเครื่อง)'
        },
        {
          title: '4. กรองเฉพาะผลตรวจจับความแม่นยำสูง (High Confidence)',
          expr: 'has("person") and label_confidence("person") >= 0.80',
          debounce: 300,
          desc: 'กรองเอาเฉพาะการตรวจจับที่ AI มั่นใจเกิน 80% ขึ้นไป เพื่อลด False Alarm',
          downstream: 'Snapshot, Action'
        },
        {
          title: '5. ตรวจสอบสิ่งผิดปกติที่ขาดหายไป (Absence Detection)',
          expr: 'has("car") and not has("person")',
          debounce: 1000,
          desc: 'ตรวจพบรถจอดอยู่แต่ไม่มีคนขับควบคุมต่อเนื่องนานเกิน 1 วินาที',
          downstream: 'Dashboard Log, Snapshot'
        }
      ]
    }
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
    description: "โหนดแสดงตัวเลขสถิติบน Live Dashboard (Grafana Style)",
    explanation: "โหนดตัวเลขแบบใหม่ รองรับการปรับแต่งขั้นสูงระดับ Grafana สามารถแสดงตัวเลขขนาดใหญ่พร้อมกราฟขนาดย่อม (Sparkline) พื้นหลัง เพื่อดูเทรนด์การเปลี่ยนแปลงได้ทันที รองรับการตั้งค่าสีตามช่วงเงื่อนไข (Threshold) และสามารถดึงข้อมูลย้อนหลัง (History) จาก Database มาสร้างกราฟ Sparkline ได้อัตโนมัติ",
    input: {
      desc: "รับข้อมูลตัวเลข เช่น Count จาก Counter Node หรือ Logic Node",
      example: "ต่อสายจาก Counter Node ที่นับยอดสะสมของคนผ่านประตู"
    },
    process: {
      desc: "ข้อมูลจะถูกบันทึกลง Database (ตาราง metrics) และถูกนำไปแสดงผลบน Metric Widget รองรับการกำหนดหน่วย (Prefix/Suffix) เช่น 'คน', '%' และตั้งค่า Threshold เพื่อเปลี่ยนสีเมื่อค่าเกินพิกัด",
      example: "แสดงตัวเลขพร้อมหน่วย 'คน' และเปลี่ยนเป็นสีแดงเมื่อยอดเกิน 50 คน พร้อมกราฟ Sparkline 10 นาทีล่าสุด"
    },
    output: {
      desc: "ส่งข้อมูลตัวเลขไปยังหน้า Dashboard (ฝั่ง UI)",
      example: "N/A"
    },
    supportedInputs: ['logicNode', 'counterNode', 'flowCounterNode'],
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
    explanation: "โหนดกราฟเต็มรูปแบบที่สามารถคิวรี (Query) ข้อมูลจาก Database (ตาราง metrics) มาพล็อตเป็นกราฟเส้น (Line Chart) หรือกราฟแท่ง (Bar Chart) รองรับการตั้งค่าช่วงเวลา (Time Range) เพื่อดูข้อมูลย้อนหลัง หรือดูแบบ Real-time",
    input: {
      desc: "รับข้อมูลประเภทตัวเลขจาก Counter หรือโหนดอื่นๆ เพื่อบันทึกลงฐานข้อมูลเป็นอนุกรมเวลา (Time-series)",
      example: "ต่อสายจาก Counter Node"
    },
    process: {
      desc: "ระบบจะเก็บค่าพร้อม Timestamp ลงฐานข้อมูล SQLite และเมื่อเปิด Dashboard จะคิวรีข้อมูลมาพล็อตเป็นกราฟตามกรอบเวลาที่เลือกไว้ (เช่น 1 ชั่วโมงล่าสุด, 24 ชั่วโมงล่าสุด)",
      example: "แสดงกราฟเส้นจำนวนรถที่วิ่งผ่านแยกย้อนหลัง 12 ชั่วโมง"
    },
    output: {
      desc: "แสดงกราฟบนหน้า Dashboard (ฝั่ง UI)",
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
    title: "Event Counter",
    description: "โหนดนับจำนวนเหตุการณ์สะสม (Discrete Event Counter) จากการเปลี่ยนสถานะของสัญญาณ (Edge Triggering)",
    input: {
      desc: "รับสัญญาณเชิงตรรกะ (True / False) จาก Logic Node หรือเซ็นเซอร์ดิจิทัล",
      example: "{ payload: true, metadata: { camera_id: 'cam_1' } }"
    },
    process: {
      desc: "ตรวจจับจังหวะการเปลี่ยนสถานะของสัญญาณ (Rising Edge: False ➔ True หรือ Falling Edge: True ➔ False) แล้วเพิ่มค่านับสะสมขึ้น 1 ครั้ง",
      example: "เมื่อ Logic ตรวจพบชิ้นงาน NG (สัญญาณเปลี่ยนเป็น True) ให้นับเพิ่ม 1 ครั้งสะสมในยอดรวม"
    },
    output: {
      desc: "ตัวเลขจำนวนครั้งที่เกิดเหตุการณ์สะสม (Total Count)",
      example: "15"
    },
    supportedInputs: ['logicNode', 'digitalInputNode'],
    supportedOutputs: ['dashboardMetricNode', 'dashboardTextNode', 'actionNode']
  },
  flowCounterNode: {
    title: "Flow Counter",
    description: "โหนดนับจำนวนคนหรือวัตถุที่เคลื่อนที่ตัดผ่านเส้น (Line Crossing) หรือเข้าพื้นที่ (Zone ROI) พร้อมระบบติดตามป้องกันนับซ้ำ",
    input: {
      desc: "รับข้อมูล AI Metadata (ผลลัพธ์การตรวจจับ Bounding Box) จาก AI Model โดยตรง",
      example: "ต่อสายตรงจาก AI Model เพื่อดึงรายการวัตถุที่ตรวจจับได้"
    },
    process: {
      desc: "ใช้ระบบ Centroid Tracking ติดตามวัตถุแต่ละชิ้นข้ามเฟรมแบบมี Tracking ID เพื่อป้องกันการนับซ้ำ และตรวจการตัดเส้นหรือเข้าเขตพื้นที่",
      example: "ลากเส้นหน้าประตูเพื่อนับคนเดินเข้า-ออก หรือลากเส้นบนสายพานเพื่อนับจำนวนสินค้าแยกตามประเภท (Class)"
    },
    output: {
      desc: "จำนวนยอดนับรวม (Total) และแจกแจงแยกตามประเภท Class พร้อมบันทึกลงฐานข้อมูลประวัติ",
      example: "{ total: 15, counts: { person: 10, car: 5 }, newly_counted: 1 }"
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
    description: "โหนดบันทึกภาพนิ่ง (Snapshot) พร้อมเก็บประวัติลง Database",
    explanation: "บันทึกภาพนิ่งจากวิดีโอทันทีเมื่อได้รับสัญญาณทริกเกอร์ พร้อมจัดเก็บ Metadata และรูปภาพลงใน Snapshot Storage ซึ่งสามารถเข้าไปดู ย้อนกลับ บริหารจัดการ หรือลบ (ลบรูปจากดิสก์และเรคคอร์ดจาก DB) ได้ผ่านหน้า Snapshot Gallery",
    input: {
      desc: "รับสัญญาณ Trigger (True/False) จาก Logic หรือ Action Node",
      example: "ต่อสายจาก Logic Node เมื่อเงื่อนไขเป็นจริง (เช่น นับคนได้เกิน 5 คน) เพื่อสั่งถ่ายภาพ"
    },
    process: {
      desc: "เมื่อได้รับสัญญาณ Trigger (True) จะทำการแคปเจอร์เฟรมวิดีโอปัจจุบัน, ระบุ Timestamp, และบันทึกประวัติเหตุการณ์ลงตาราง snapshots ใน Database แบบอัตโนมัติ",
      example: "ถ่ายภาพบันทึกหลักฐานเมื่อมีผู้บุกรุกตอน 22:00 น. และเก็บบันทึกลงฐานข้อมูลเพื่อเปิดดูทีหลัง"
    },
    output: {
      desc: "เส้นทางรูปภาพ (Image Path) หรือ URL ของภาพที่ถูกบันทึกไว้ในระบบ",
      example: "{ id: 102, image_url: '/snapshots/172778888.jpg', created_at: '2026-09-30...' }"
    },
    supportedInputs: ['logicNode', 'digitalInputNode', 'actionNode'],
    supportedOutputs: ['actionNode', 'dashboardLogNode']
  }
};
