/**
 * Thiệp đám hỏi Đắc Quang & Trúc Nhi — nhận xác nhận tham dự từ thiệp web,
 * ghi vào Google Sheet + gửi email báo về hộp thư.
 *
 * Làm y theo cách đã chạy tốt ở trang đặt bánh Bá Trạng (BA-draft/event_06).
 *
 * CÁCH DÙNG (chi tiết trong SETUP-RSVP.md):
 *  1. Tạo 1 Google Sheet mới.
 *  2. Extensions → Apps Script → dán toàn bộ file này, ghi đè Code.gs.
 *  3. Deploy → New deployment → type "Web app"
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  4. Copy "Web app URL" (kết thúc bằng /exec) → dán vào CONFIG.rsvpEndpoint
 *     trong index.html.
 */

/* =========================================================================
   CẤU HÌNH — sửa 2 dòng này
   ========================================================================= */
var NOTIFY_EMAIL = "hodacquang8182@gmail.com";   // nơi nhận email báo. Nhiều người: ngăn bằng dấu phẩy.
var EVENT_NAME   = "Đám hỏi Đắc Quang & Trúc Nhi";

var HEADERS = ['Thời gian', 'Quý danh', 'Tham dự', 'Số người', 'Lời chúc'];

function doPost(e) {
  // Khoá: nhiều khách xác nhận cùng lúc thì xếp hàng ghi tuần tự, không đè mất dòng.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    var data  = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date(),
      data.name    || '',
      data.attend  || '',
      Number(data.guests) || 1,
      data.message || ''
    ]);

    // Ghi xong nhả khoá sớm, khách kế tiếp ghi ngay, không phải chờ gửi mail.
    lock.releaseLock();

    // Lỗi gửi mail KHÔNG được làm mất dòng đã ghi Sheet.
    try { notifyOwner(data); } catch (mailErr) { /* bỏ qua */ }

    return json({ ok: true });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* đã nhả ở trên */ }
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/** Gửi email báo có khách vừa xác nhận. */
function notifyOwner(data) {
  if (!NOTIFY_EMAIL) return;

  var name   = data.name    || '(không ghi tên)';
  var attend = data.attend  || '';
  var guests = Number(data.guests) || 1;
  var msg    = data.message || '';

  // Đi hay không đi thì đổi màu cho nhìn phát biết ngay.
  var di = attend.indexOf('không') < 0;
  var mau = di ? '#6B7A52' : '#A5715E';

  var subject = (di ? '✓ ' : '✕ ') + name + ' · ' + attend + ' · ' + guests + ' người';

  var html =
  '<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;border:1px solid #E7E3D3;border-radius:12px;overflow:hidden;background:#F6F4EC">' +
    '<div style="background:' + mau + ';color:#F6F4EC;padding:16px 20px">' +
      '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85">' + EVENT_NAME + '</div>' +
      '<div style="font-size:20px;font-weight:bold;margin-top:3px">Có khách vừa xác nhận</div>' +
    '</div>' +
    '<div style="padding:18px 20px">' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;color:#3D4030">' +
        '<tr><td style="padding:7px 10px;color:#6E7159;width:110px">Quý danh</td>' +
            '<td style="padding:7px 10px;font-size:17px"><b>' + name + '</b></td></tr>' +
        '<tr><td style="padding:7px 10px;color:#6E7159">Tham dự</td>' +
            '<td style="padding:7px 10px;color:' + mau + '"><b>' + attend + '</b></td></tr>' +
        '<tr><td style="padding:7px 10px;color:#6E7159">Số người</td>' +
            '<td style="padding:7px 10px"><b>' + guests + '</b></td></tr>' +
        '<tr><td style="padding:7px 10px;color:#6E7159">Lời chúc</td>' +
            '<td style="padding:7px 10px;font-style:italic">' + (msg || '—') + '</td></tr>' +
      '</table>' +
      '<div style="margin-top:16px;padding:12px;background:#EFECE0;border-radius:8px;font-size:13px;color:#6E7159">' +
        'Dòng này cũng đã được ghi vào Google Sheet.</div>' +
    '</div>' +
  '</div>';

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    htmlBody: html,
    name: EVENT_NAME
  });
}

/** Mở link /exec bằng trình duyệt để kiểm tra Web App đã sống chưa. */
function doGet() {
  return json({ ok: true, msg: 'RSVP endpoint dam hoi is live' });
}

/** Chạy tay 1 lần để thử: ghi 1 dòng mẫu + gửi 1 email mẫu. */
function testRsvp() {
  var demo = {
    name: 'Khách Thử',
    attend: 'Vâng, tôi sẽ đến',
    guests: 2,
    message: 'Chúc hai bạn trăm năm hạnh phúc!'
  };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(), demo.name, demo.attend, demo.guests, demo.message]);
  notifyOwner(demo);
}

/** (tuỳ chọn) chạy tay 1 lần để tạo dòng tiêu đề đẹp. */
function setupHeader() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sheet.clear();
  sheet.appendRow(HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}
