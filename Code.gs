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
   CẤU HÌNH
   ========================================================================= */
// Nơi nhận email báo. Muốn nhiều người thì ngăn bằng dấu phẩy, ví dụ:
//   "Btnhi95@gmail.com, hodacquang8182@gmail.com"
var NOTIFY_EMAIL = "Btnhi95@gmail.com";
var EVENT_NAME   = "Đám hỏi Đắc Quang & Trúc Nhi";
var EVENT_DATE   = "Chủ Nhật, 20.09.2026";
var TIMEZONE     = "Asia/Ho_Chi_Minh";

var HEADERS = ['Thời gian', 'Quý danh', 'Tham dự', 'Số người', 'Lời chúc'];

/* -- bảng màu, lấy theo tông thiệp để email và thiệp cùng một bộ -- */
var C_GREEN = '#6B7A52';
var C_DARK  = '#4F5C3C';
var C_GOLD  = '#B89B5E';
var C_CREAM = '#F6F4EC';
var C_CRM2  = '#EFECE0';
var C_LINE  = '#E7E3D3';
var C_INK   = '#3D4030';
var C_SOFT  = '#6E7159';
var C_MISS  = '#A5715E';   // màu cho trường hợp không đến được

/* Font cho email. KHÔNG dùng Georgia: nó THIẾU glyph tiếng Việt precomposed
   (ế ề ễ) nên "đến" render thành "đế´n" — dấu rời ra, đã kiểm chứng bằng ảnh.
   Palatino/Times đều có đủ và đều là font sẵn trên máy nên email client nào
   cũng hiển thị được (webfont thì Gmail lược bỏ). */
var F_SERIF = "'Palatino Linotype','Book Antiqua',Palatino,'Times New Roman',Times,serif";
var F_SANS  = "Arial,Helvetica,sans-serif";

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

    var now = new Date();
    sheet.appendRow([
      now,
      data.name    || '',
      data.attend  || '',
      Number(data.guests) || 1,
      data.message || ''
    ]);

    // Ghi xong nhả khoá sớm, khách kế tiếp ghi ngay, không phải chờ gửi mail.
    lock.releaseLock();

    // Lỗi gửi mail KHÔNG được làm mất dòng đã ghi Sheet.
    try { notifyOwner(data, now, sheet); } catch (mailErr) { /* bỏ qua */ }

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

/** Đếm tổng số lời nhận + tổng số người, để email nào cũng thấy được bức tranh chung. */
function tinhTong(sheet) {
  var t = { nhan: 0, nguoi: 0, tu_choi: 0 };
  try {
    var n = sheet.getLastRow();
    if (n < 2) return t;
    var rows = sheet.getRange(2, 3, n - 1, 2).getValues();   // cột Tham dự + Số người
    for (var i = 0; i < rows.length; i++) {
      var di = String(rows[i][0] || '').toLowerCase().indexOf('không') < 0;
      if (di) { t.nhan++; t.nguoi += Number(rows[i][1]) || 1; }
      else    { t.tu_choi++; }
    }
  } catch (err) { /* đếm lỗi thì thôi, không được làm chết email */ }
  return t;
}

/** Gửi email báo có khách vừa xác nhận. */
function notifyOwner(data, when, sheet) {
  if (!NOTIFY_EMAIL) return;

  var name   = data.name    || '(không ghi tên)';
  var attend = data.attend  || '';
  var guests = Number(data.guests) || 1;
  var msg    = data.message || '';
  var luc    = Utilities.formatDate(when || new Date(), TIMEZONE, 'HH:mm · dd/MM/yyyy');

  var di   = attend.toLowerCase().indexOf('không') < 0;
  var mau  = di ? C_GREEN : C_MISS;
  var dau  = di ? '✓' : '✕';
  var tong = sheet ? tinhTong(sheet) : null;

  var sheetUrl = '';
  try { sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl(); } catch (err) {}

  var subject = dau + ' ' + name + ' · ' + (di ? guests + ' người' : 'không đến được');

  // Dòng xem trước trong hộp thư (ẩn trong nội dung email).
  var preheader = attend + ' · ' + guests + ' người' + (msg ? ' · "' + msg.slice(0, 60) + '"' : '');

  function hang(nhan, giatri) {
    return '<tr>' +
      '<td style="padding:9px 0;color:' + C_SOFT + ';font-size:13px;width:120px;' +
        'border-bottom:1px solid ' + C_LINE + '">' + nhan + '</td>' +
      '<td style="padding:9px 0;color:' + C_INK + ';font-size:15px;font-weight:bold;' +
        'border-bottom:1px solid ' + C_LINE + '">' + giatri + '</td>' +
    '</tr>';
  }

  var khoiLoiChuc = msg
    ? '<div style="margin:18px 0 0;padding:14px 16px;background:' + C_CRM2 + ';' +
        'border-left:3px solid ' + C_GOLD + ';border-radius:0 6px 6px 0">' +
        '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + C_GOLD + '">Lời chúc</div>' +
        '<div style="margin-top:6px;font-family:' + F_SERIF + ';font-style:italic;font-size:15px;' +
          'line-height:1.6;color:' + C_INK + '">“' + msg + '”</div>' +
      '</div>'
    : '';

  var khoiTong = tong
    ? '<div style="margin:20px 0 0;padding:14px 16px;background:' + C_CREAM + ';' +
        'border:1px solid ' + C_LINE + ';border-radius:8px">' +
        '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + C_SOFT + '">Tổng đến nay</div>' +
        '<div style="margin-top:6px;font-family:' + F_SERIF + ';font-size:20px;color:' + C_DARK + '">' +
          '<b>' + tong.nhan + '</b> lời nhận' +
          ' &nbsp;·&nbsp; <b>' + tong.nguoi + '</b> người' +
          (tong.tu_choi ? ' &nbsp;·&nbsp; <span style="font-size:15px;color:' + C_MISS + '">' +
            tong.tu_choi + ' không đến được</span>' : '') +
        '</div>' +
      '</div>'
    : '';

  var nutSheet = sheetUrl
    ? '<div style="margin:20px 0 0;text-align:center">' +
        '<a href="' + sheetUrl + '" style="display:inline-block;background:' + C_GREEN + ';color:#ffffff;' +
          'text-decoration:none;font-size:14px;padding:11px 26px;border-radius:40px">' +
          'Mở danh sách trong Google Sheet</a>' +
      '</div>'
    : '';

  var html =
  '<div style="margin:0;padding:22px 12px;background:#EDEADE">' +
    // dòng xem trước, ẩn khỏi nội dung nhìn thấy
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + preheader + '</div>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
      'style="max-width:540px;margin:0 auto;width:100%;background:#ffffff;border:1px solid ' + C_LINE + ';' +
      'border-radius:12px;overflow:hidden">' +
      '<tr><td style="background:' + mau + ';padding:20px 24px">' +
        '<div style="font-family:' + F_SANS + ';font-size:11px;letter-spacing:3px;' +
          'text-transform:uppercase;color:rgba(255,255,255,.8)">' + EVENT_NAME + '</div>' +
        '<div style="font-family:' + F_SERIF + ';font-size:21px;color:#ffffff;margin-top:5px">' +
          'Có khách vừa xác nhận</div>' +
      '</td></tr>' +
      '<tr><td style="padding:24px">' +
        // tên + trạng thái
        '<div style="text-align:center;padding-bottom:20px;border-bottom:1px solid ' + C_LINE + '">' +
          '<div style="font-family:' + F_SERIF + ';font-size:27px;color:' + C_DARK + ';line-height:1.3">' +
            name + '</div>' +
          '<div style="margin-top:10px">' +
            '<span style="display:inline-block;background:' + mau + ';color:#ffffff;' +
              'font-family:' + F_SANS + ';font-size:13px;padding:6px 16px;border-radius:40px">' +
              dau + '&nbsp; ' + attend + '</span>' +
          '</div>' +
        '</div>' +
        // chi tiết
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
          'style="width:100%;margin-top:8px;font-family:' + F_SANS + '">' +
          hang('Số người', guests) +
          hang('Gửi lúc', luc) +
          hang('Ngày lễ', EVENT_DATE) +
        '</table>' +
        khoiLoiChuc +
        khoiTong +
        nutSheet +
      '</td></tr>' +
      '<tr><td style="background:' + C_CREAM + ';padding:14px 24px;text-align:center;' +
        'font-family:' + F_SANS + ';font-size:11.5px;color:' + C_SOFT + '">' +
        'Gửi tự động từ thiệp mời · dòng này cũng đã được ghi vào Google Sheet' +
      '</td></tr>' +
    '</table>' +
  '</div>';

  // Bản chữ thuần cho ứng dụng mail không hiện HTML.
  var plain =
    dau + ' ' + name + '\n' +
    attend + ' · ' + guests + ' người\n' +
    'Gửi lúc: ' + luc + '\n' +
    (msg ? 'Lời chúc: ' + msg + '\n' : '') +
    (tong ? '\nTổng đến nay: ' + tong.nhan + ' lời nhận · ' + tong.nguoi + ' người\n' : '') +
    (sheetUrl ? '\nDanh sách: ' + sheetUrl : '');

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    body: plain,
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
    message: 'Chúc hai bạn trăm năm hạnh phúc, sớm có tin vui!'
  };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var now = new Date();
  sheet.appendRow([now, demo.name, demo.attend, demo.guests, demo.message]);
  notifyOwner(demo, now, sheet);
}

/** Thử riêng email "không đến được" để xem màu/nhãn đổi đúng chưa. */
function testRsvpVang() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  notifyOwner({
    name: 'Khách Vắng', attend: 'Rất tiếc, tôi không đến được',
    guests: 1, message: 'Xin phép vắng, chúc hai bạn hạnh phúc.'
  }, new Date(), sheet);
}

/** (tuỳ chọn) chạy tay 1 lần để tạo dòng tiêu đề đẹp. */
function setupHeader() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sheet.clear();
  sheet.appendRow(HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}
