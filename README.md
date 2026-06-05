# QC Report PWA (Frontend)

PWA รายงานสิ่งแปลกปลอม — static frontend สำหรับ GitHub Pages
เรียก backend (Google Apps Script) ผ่าน `fetch`

## สถาปัตยกรรม
```
[PWA นี้ - GitHub Pages]  --fetch-->  [Apps Script /exec]  -->  [Google Sheets + Drive]
   HTML + CSS + Vanilla JS              doGet/doPost API           ข้อมูล + รูป
```

## ไฟล์
| ไฟล์ | หน้าที่ |
|------|--------|
| `index.html` | ฟอร์ม + dashboard + QR (CSS inline, ไม่ต้อง build) |
| `manifest.json` | PWA manifest (ติดตั้งบนมือถือ) |
| `sw.js` | Service Worker (offline shell) |
| `icons/` | ไอคอน 192/512/maskable |

## การเชื่อม backend
`index.html` มี `var APP_URL = "https://script.google.com/macros/s/.../exec"`
เป็น Apps Script Web App ที่ตอบ:
- `GET ?action=getOptions` → dropdown options
- `GET ?action=getDashboard` → สรุป
- `POST {action:'saveReport', data:{...}}` → บันทึก (text/plain เลี่ยง CORS preflight)

> ถ้าเปลี่ยน Apps Script deployment URL ต้องแก้ `APP_URL` ในไฟล์นี้

## Deploy
push เข้า branch `main` → GitHub Pages auto-deploy
URL: `https://<user>.github.io/<repo>/`

## ทดสอบในเครื่อง
```
python -m http.server 8080
# เปิด http://localhost:8080
```
(Service Worker ต้องการ https หรือ localhost เท่านั้น)
