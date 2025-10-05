Dự án Chrome Extension “LingoTrans” — tiện ích dịch thuật dùng OpenAI API và các API OpenAI‑compatible, ưu tiên chất lượng, hỗ trợ self‑host từ MVP. Bạn đã có sẵn frontend (SidePanel: Translate/Rewrite/Settings, content floating button, open sidepanel action); phần này chuẩn hóa mục tiêu, hành vi, luồng UX, kiến trúc, yêu cầu kỹ thuật và tiêu chí kiểm thử/hoàn thành.

1) Mục tiêu và giá trị
- Một cú bôi đen là có bản dịch: nhanh, mượt, stream theo thời gian thực.
- Chất lượng ưu tiên: mặc định dùng model chất lượng cao, có chuyển nhanh sang model rẻ/nhanh khi cần.
- Giữ nguyên bố cục khi dịch toàn trang; không phá HTML/format.
- Linh hoạt nhà cung cấp: OpenAI, Azure OpenAI, OpenRouter, Together, Groq, vLLM/Ollama, server nội bộ (OpenAI‑compatible).
- Tùy biến prompt bằng biến/tagging, hỗ trợ glossary/style guide.

2) Tên sản phẩm và thông điệp
- Tên: LingoTrans.
- Tagline: Dịch mượt mà ngay trong trang, chất lượng cao, linh hoạt mô hình và hạ tầng.

3) Phạm vi chức năng MVP
- Dịch văn bản chọn lọc:
  - Bôi đen → icon nổi “Dịch” xuất hiện → click để dịch.
  - Context menu: nhấp phải → “Dịch đoạn bôi đen”.
  - Tùy chọn “Tự động dịch khi bôi đen”.
  - Kết quả hiển thị dạng popup mini, stream theo thời gian thực, có Copy, đổi ngôn ngữ đích nhanh.
- SidePanel:
  - Tab Dịch: chọn model, from-lang (Auto), to-lang, hoán đổi, ô input/output, Translate, Copy, Clear.
  - Tab Viết lại: nhập văn bản, chọn ngôn ngữ đích và tone (Neutral/Trang trọng/Thân mật/Ngắn gọn), nút Rewrite.
  - Tab Settings (frontend đã có): cấu hình provider, model, ngôn ngữ, templates, behavior.
- Dịch toàn bộ trang:
  - Kích hoạt từ popup/shortcut.
  - Chế độ mặc định: Thay thế trực tiếp (replace). Tùy chọn sau: hiển thị song song (original + translated).
  - Overlay tiến trình, hủy, hoàn tác. Giữ nguyên thẻ inline (liên kết, in nghiêng, đậm, code...).
- Nhà cung cấp và model:
  - Cấu hình base URL, API key, model, headers tùy chỉnh, protocol (Responses API hoặc Chat Completions).
  - Preset sẵn: OpenAI, Ollama (localhost), có Healthcheck.
- Ngôn ngữ:
  - From: Auto detect.
  - To: tự phát hiện theo ngôn ngữ trình duyệt (có thể đổi).
- Tùy biến prompt (tagging):
  - Template Translate/Rewrite với biến: {{source_text}}, {{target_language}}, {{source_language}}, {{tone}}, {{domain}}, {{preserve_html}}, {{glossary}}.
  - Lưu nhiều template, chọn áp dụng.
- Hiệu năng và trải nghiệm:
  - Streaming token tới UI; fallback nếu provider không hỗ trợ stream.
  - Cache/translation memory cơ bản để tránh dịch lặp.
  - Phím tắt: dịch vùng chọn, mở SidePanel, dịch toàn trang.

1) Luồng UX chi tiết
- Highlight nhanh:
  - Người dùng bôi đen → icon nổi hiển thị gần vùng chọn → click “Dịch”.
  - Nếu bật “Auto translate on select”, bôi đen xong sẽ dịch ngay.
  - Popup mini xuất hiện, stream kết quả, có Copy, đổi to-lang, “Pin to SidePanel”.
- SidePanel:
  - Tab Dịch: giao diện thân thuộc như Google Dịch; chọn model/from/to; swap; nhập; Translate; xem output; Copy; Clear.
  - Tab Viết lại: nhập; chọn to-lang + tone; Rewrite; Copy.
  - Tab Settings: quản trị provider, model, to-lang mặc định, behavior, templates, glossary.
- Dịch toàn trang:
  - Người dùng chọn “Dịch trang”.
  - Overlay hiện: thanh tiến trình %, nút Hủy, nút Hoàn tác (kích hoạt sau khi xong).
  - Nội dung dịch được thay thế trực tiếp, giữ inline markup; có thể Undo toàn bộ.

1) Tương thích nhà cung cấp (OpenAI‑compatible)
- Hỗ trợ ngay từ đầu: OpenAI (Responses API là mặc định), Azure OpenAI, OpenRouter, Together, Groq, vLLM/Ollama, server nội bộ.
- Cấu hình:
  - Base URL, API Key (Bearer), Model, Protocol (Responses hoặc Chat Completions), Headers tùy chỉnh.
- Preset:
  - OpenAI (model mặc định chất lượng cao).
  - Ollama (localhost) cho phát triển nội bộ.
- Healthcheck:
  - Cố gắng liệt kê models; nếu không, gọi yêu cầu ngắn “OK” để kiểm tra quyền và endpoint.
  - Hiển thị thông báo OK/Fail ngay trong Options.

1) Thiết lập mặc định (đã chốt)
- Ưu tiên chất lượng: model mặc định dùng bản chất lượng cao cho highlight/SidePanel.
- Dịch toàn trang: mặc định thay thế trực tiếp.
- Ngôn ngữ đích: tự phát hiện theo ngôn ngữ trình duyệt; người dùng có thể thay đổi nhanh trong popup/SidePanel.

1) Prompt templates khuyến nghị (dạng mô tả)
- Translate:
  - Chỉ dẫn: Dịch sang <target_language>, giữ nguyên nghĩa, giọng điệu, dấu câu, và markup nội dòng nếu có; không thêm giải thích; nếu có HTML, chỉ dịch phần văn bản hiển thị và giữ nguyên thẻ.
  - Biến sử dụng: <source_text>, <target_language>, <source_language>, <preserve_html>, <glossary>.
- Rewrite:
  - Chỉ dẫn: Viết lại đoạn <target_language> theo tone <tone>, giữ nguyên sự thật và ý nghĩa; không thêm giải thích.
  - Biến sử dụng: <source_text>, <tone>.
- Glossary:
  - Đặt quy tắc “must obey”: nếu thuật ngữ xuất hiện, dùng đúng bản dịch mục tiêu; đưa vào prompt hoặc hậu xử lý kiểm tra.

1) Dịch toàn trang: nguyên tắc kỹ thuật (mô tả)
- Duyệt DOM theo block (p, li, h1…; div đơn giản) để gom đoạn, bỏ qua script/style/ẩn.
- Giữ inline tags bằng placeholder mở/đóng để bảo toàn thuộc tính và cấu trúc; ví dụ liên kết, in nghiêng, đậm, code.
- Chia lô theo giới hạn ngữ cảnh, ghép nhiều block vào một batch với delimiter ổn định; yêu cầu model trả về theo cùng delimiter (để ánh xạ 1‑1).
- Ánh xạ lại placeholders vào HTML sau khi dịch, thay thế nội dung khối.
- Overlay tiến trình: phần trăm, hủy, hoàn tác toàn trang.
- Tùy chọn sau: MutationObserver dịch nội dung động (SPA), chế độ hiển thị song song.

1) Ngôn ngữ và trình bày
- Phát hiện ngôn ngữ nguồn tự động; cho phép khóa from-lang khi cần.
- RTL (Arabic/Hebrew): xử lý direction cho overlay/popup.
- CJK: không chèn khoảng trắng thừa, giữ dấu câu.

1)  Streaming và hiệu năng
- Stream token theo thời gian thực tới popup mini/SidePanel.
- Fallback “non-stream” nếu provider không hỗ trợ SSE.
- Parallel hóa nhẹ khi dịch cả trang (nhiều batch tuần tự hoặc song song có kiểm soát).
- Translation memory/cache: băm theo nội dung + to-lang + model + template; lưu cục bộ; tái sử dụng để tăng tốc và giảm chi phí.

1)  Lưu trữ, bảo mật, quyền riêng tư
- Lưu settings và cache cục bộ; không gửi telemetry mặc định.
- API key lưu cục bộ; có tùy chọn mã hóa bằng passphrase (ưu tiên thêm sau MVP).
- Không thu thập dữ liệu người dùng ngoài phạm vi dịch; tuân thủ quyền trang đang truy cập.
- Quyền extension: storage, activeTab, scripting, contextMenus, sidePanel, clipboardWrite; host_permissions toàn trang để dịch full-page.

1)  Phím tắt
- Dịch vùng chọn: Alt+T.
- Mở SidePanel: Alt+Shift+T.
- Dịch toàn trang: Alt+P.

1)  Xử lý lỗi và cạnh biên
- Quá hạn/429: retry backoff; gợi ý chuyển model rẻ/nhanh nếu cần.
- Đầu vào dài: chunk hóa + tiến trình + cảnh báo.
- Stream bị ngắt: fallback non‑stream, hiển thị thông báo.
- Đầu ra lệch delimiter: thử tự sửa cơ bản; nếu thất bại, hoàn tác và báo lỗi.
- Không đủ quyền host: xin quyền động hoặc hướng dẫn bật host_permissions.
- API key sai hoặc endpoint lỗi: Healthcheck trong Options báo chi tiết.

1)  Kiểm thử và tiêu chí hoàn thành
- Highlight:
  - Bôi đen văn bản ngắn → icon xuất hiện → kết quả dịch stream trong < 1 giây.
  - Context menu hoạt động, Copy kết quả OK.
  - Tùy chọn “Auto translate on select” dịch tự động và có thể tắt/bật từ popup.
- SidePanel:
  - Tab Dịch và Viết lại hoạt động với model mặc định; đổi model/from/to cho ra kết quả phù hợp.
  - Copy/Clear hoạt động; tone trong Rewrite cho ra khác biệt hợp lý.
- Dịch toàn trang:
  - Trên trang có thẻ inline (liên kết, in nghiêng, code), bản dịch giữ nguyên cấu trúc/thuộc tính.
  - Overlay hiển thị % chính xác; Hủy dừng tiến trình; Hoàn tác khôi phục nguyên trạng.
- Provider:
  - OpenAI preset chạy được; Ollama preset chạy cục bộ; Healthcheck báo OK/Fail đúng.
  - Chuyển đổi protocol Responses/Chat Completions vẫn dịch được.
- Ngôn ngữ:
  - To-lang mặc định theo UI browser; đổi trong popup/SidePanel hiệu lực ngay.
  - RTL/CJK hiển thị đúng.

1)  Lộ trình sau MVP
- Song song hóa nâng cao và MutationObserver cho SPA.
- Chế độ “hiển thị song song” cho full-page.
- Glossary/style guide UI hoàn chỉnh, kiểm tra tuân thủ hậu dịch.
- Lịch sử nâng cao, export/import cấu hình, profile theo domain.
- Mã hóa API key AES‑GCM bằng passphrase.

1)  Phạm vi đã có sẵn và tích hợp
- Frontend đã có: SidePanel (Translate/Rewrite/Settings), content floating button, open sidepanel action.
- Việc tích hợp cần đảm bảo:
  - Kênh stream token từ nền tảng dịch tới popup mini/SidePanel.
  - Options/Settings đồng bộ với Provider, Models, Templates, Behavior.
  - Popup quick switches: model, to-lang, auto-translate-on-select, nút Dịch trang, mở SidePanel.
  - Dịch toàn trang dùng overlay, thay thế trực tiếp, Undo.

Nếu muốn, tôi có thể chuyển phần mô tả Prompt Templates ở mục 7 thành bộ “câu lệnh chuẩn hóa” sẵn dùng (không mã) để bạn copy vào Settings/Templates của LingoTrans.