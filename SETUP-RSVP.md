# Nối form xác nhận → Google Sheet + Email (5 phút, làm 1 lần)

Thiệp là trang HTML tĩnh nên **không tự ghi Sheet hay gửi mail** được.
Dùng **Google Apps Script** làm cầu nối — miễn phí, cùng cách đã chạy tốt ở
trang đặt bánh Bá Trạng (`BA-draft/event_06`).

Kết quả: khách bấm "Gửi xác nhận" → **ghi 1 dòng vào Google Sheet** *và*
**gửi 1 email** về hộp thư.

---

## Bước 1 — Tạo Google Sheet
1. Vào https://sheets.new → đặt tên, vd *"Xác nhận đám hỏi 20.09.2026"*.
2. Để trống. Code tự tạo dòng tiêu đề.

## Bước 2 — Dán Apps Script
1. Trong Sheet đó: **Extensions → Apps Script**.
2. Xoá hết code mẫu trong `Code.gs`, **dán toàn bộ nội dung [`Code.gs`](Code.gs)** ở folder này.
3. Kiểm dòng đầu: `NOTIFY_EMAIL` đang là `hodacquang8182@gmail.com` — đổi nếu muốn nhận ở hộp thư khác.
4. Ctrl+S để lưu.

## Bước 3 — Deploy thành Web App
1. Góc phải trên: **Deploy → New deployment**.
2. Bánh răng ⚙ cạnh "Select type" → chọn **Web app**.
3. Cấu hình:
   - **Execute as:** `Me (email của bạn)`
   - **Who has access:** `Anyone` ← **bắt buộc**, để thiệp gọi được
4. **Deploy**.
5. Lần đầu sẽ hỏi cấp quyền → **Authorize access** → chọn tài khoản → "Advanced"
   → "Go to … (unsafe)" → **Allow**. (An toàn, script của chính mình.)
   Bước này cần thiết vì script phải có quyền **gửi mail thay bạn**.
6. Copy **Web app URL**, dạng:
   ```
   https://script.google.com/macros/s/AKfycb..................../exec
   ```

## Bước 4 — Dán link vào thiệp
Mở `index.html`, tìm trong khối `CONFIG`:
```js
rsvpEndpoint: "",
```
Dán link vừa copy vào:
```js
rsvpEndpoint: "https://script.google.com/macros/s/AKfycb..../exec",
```
Rồi copy file sang checkout và push:
```bash
cp index.html C:/QUANG.HO_IT/thiep-dinh-hon/index.html
cd C:/QUANG.HO_IT/thiep-dinh-hon && git add -A && git commit -m "chore: noi rsvp endpoint" && git push
```

## Bước 5 — Thử
**Thử phía Apps Script trước** (loại trừ lỗi mail/quyền):
- Trong Apps Script, chọn hàm `testRsvp` → **Run**.
- Sheet phải có 1 dòng mới, hộp thư phải có 1 email. Xong bước này mới sang thiệp.

**Rồi thử phía thiệp:**
- Mở https://quang-rh.github.io/thiep-dinh-hon/ → xuống mục "Xác nhận tham dự"
  → điền → Gửi.
- Sheet có dòng mới + email về là xong ✅.

Mở thẳng link `/exec` bằng trình duyệt phải thấy
`{"ok":true,"msg":"RSVP endpoint dam hoi is live"}` — nếu không thấy thì
deploy chưa đúng (thường do "Who has access" chưa đặt `Anyone`).

---

## Cột ghi vào Sheet
`Thời gian · Quý danh · Tham dự · Số người · Lời chúc`

## Khi sửa `Code.gs` thì phải deploy lại
**Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**.
Link `/exec` **giữ nguyên**, không phải dán lại vào thiệp.

> Sửa `index.html` (giao diện, nội dung) thì **không** cần đụng Apps Script.

## Lưu ý
- **Chưa dán `rsvpEndpoint`** thì thiệp vẫn báo "Cảm ơn Quý khách" nhưng
  **không ghi đi đâu**, kèm thêm dòng mời khách nhắn Zalo. Xác nhận in ra
  Console trình duyệt để kiểm khi dev.
- Gửi lỗi giữa đường (khách mất mạng) cũng hiện dòng mời nhắn Zalo đó —
  cố ý, để lời xác nhận không rơi vào hư không.
- Quota Apps Script free rất rộng (hàng nghìn lượt/ngày) — thừa cho một đám hỏi.
  Riêng `MailApp` giới hạn ~100 email/ngày với Gmail thường, vẫn thừa.
- Sheet và email là **hai đường độc lập**: mail lỗi thì dòng Sheet vẫn còn
  (đã bọc try/catch riêng), không mất dữ liệu.
