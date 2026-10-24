# Ghi chú: cổng hồ sơ học viên, điểm chuẩn, học bổng (Module 1-6)

Cập nhật: 2026-10-24. Tóm tắt cách các phần hoạt động, chỗ nào dùng AI và chỗ nào chỉ dùng code thường, và cách kiểm tra lại.

## 1. Bốn kỹ thuật và chỗ dùng trong dự án

| Kỹ thuật | Là gì | Dùng ở đâu trong dự án | Vì sao chọn |
|---|---|---|---|
| **Đa phương thức** (multimodal) | Đưa file không phải chữ (PDF, ảnh) thẳng vào model để nó "nhìn" và đọc | `lib/document-extraction.ts`: gửi PDF bảng điểm, ảnh IELTS, ảnh CMND/hộ chiếu cho Gemini | Giấy tờ là ảnh/PDF, không có sẵn chữ để tự đọc |
| **Structured output** | Ép model trả JSON đúng schema (đúng trường, đúng kiểu), thay vì văn xuôi | Trích xuất giấy tờ (`SCHEMAS`), trích xuất lead (`lib/lead-extraction.ts`), câu trả lời cuối của advisor, trường `user_language` của chatbot | Code phía sau cần dữ liệu có cấu trúc để lưu và kiểm tra, không thể parse văn xuôi |
| **Function calling** | Ta mô tả cho model một "công cụ"; chính model quyết định có gọi không, gọi với tham số gì; ta chạy công cụ và trả kết quả lại để model kết luận | `lib/scholarship-advisor.ts`: công cụ `search_scholarships(school_name)` | Việc cần AI quyết định (tra cứu trường nào, học viên có hợp học bổng nào) và dữ liệu nằm ngoài model (database) |
| **Code thường** | Phép kiểm tra/tính toán xác định, không dùng AI | Đủ/thiếu/hợp lệ giấy tờ (`lib/portal-docs.ts`), đạt/chưa đạt điểm chuẩn (`lib/school-match.ts`), kiểm tra file (`lib/upload-validation.ts`), kiểm chứng đầu ra của AI (`lib/lead-sanitize.ts`) | Cần kết quả luôn đúng, lặp lại được và kiểm tra lại được; AI có thể sai hoặc "đoán" |

**Nguyên tắc rút ra:** AI dùng để *đọc* (giấy tờ), *trích xuất* (thành dữ liệu có cấu trúc) và *gợi ý* (học bổng). Mọi quyết định đúng/sai quan trọng (hồ sơ có hợp lệ không, có đạt điểm chuẩn không) do code quyết định trên dữ liệu AI đã trích xuất, và đầu ra của AI luôn bị kiểm tra trước khi tin (giá trị không hợp lệ thành `null`, học bổng AI nhắc tới phải có thật).

## 2. Luồng xử lý một hồ sơ

1. **Nộp file** (`POST /api/portal/documents`, mỗi request một file): kiểm tra dung lượng (≤ 4 MB, vì Vercel giới hạn body ~4.5 MB), định dạng thật bằng magic bytes (bảng điểm chỉ PDF; IELTS và CMND/hộ chiếu chỉ ảnh JPG/PNG/WebP). Sai thì từ chối ngay với lý do cụ thể, **không gọi AI và không ghi đè bản đã nộp**.
2. **Gemini đọc** (đa phương thức + structured output): bảng điểm → họ tên, ngày sinh, điểm tổng kết + thang điểm; IELTS → họ tên, Nghe/Đọc/Viết/Nói, Overall, ngày thi; CMND/hộ chiếu → họ tên, ngày sinh, số giấy tờ. Prompt yêu cầu để `null` nếu không đọc chắc chắn.
3. **Làm sạch** (`sanitizeDocFields`): ngày phải là ngày có thật, điểm band IELTS phải là 0-9 bước 0.5, thang điểm thuộc {4, 5, 10, 100}...; không hợp lệ thì `null`.
4. **Lưu** vào `student_profiles` + `student_documents` (Supabase, riêng tư). File gốc **không được lưu**.
5. **Kiểm tra đủ/thiếu/hợp lệ** (code thường) → banner và từng thẻ báo rõ thiếu gì, file nào cần nộp lại, vì sao.
6. **Chỉ khi hồ sơ đủ 3 giấy tờ hợp lệ**: so sánh điểm với từng trường (phép so sánh số) → hiển thị đạt/chưa đạt kèm số liệu hai vế.
7. **Nếu có trường đạt**: AI gợi ý học bổng bằng function calling, kết quả lưu đệm trong hồ sơ.

## 3. Quy tắc báo lỗi (Module 4)
- **Chưa nộp**: liệt kê từng giấy tờ còn thiếu.
- **Bị từ chối trước khi đọc**: sai định dạng (nêu loại cần và loại thực tế, kể cả file chữ đặt tên `.pdf`), file rỗng, quá lớn (nêu dung lượng và giới hạn).
- **Đọc được nhưng thiếu**: nêu đúng các trường không đọc được (không đổ lỗi cho trường đã đọc được); nếu không đọc được gì thì nói có thể ảnh mờ/thiếu sáng/cắt mép hoặc không phải đúng loại giấy tờ.
- **Đọc được nhưng đáng ngờ**: ngày ở tương lai, điểm tổng kết lớn hơn thang điểm, điểm Overall IELTS không khớp trung bình 4 kỹ năng.
- **Lỗi hệ thống** (Gemini bận/hết hạn mức): báo rõ là lỗi phía hệ thống, giấy tờ **không** bị coi là không hợp lệ và bản đã nộp được giữ nguyên.

## 4. Dữ liệu và bảo mật
- **Công khai** (`schools`, `scholarships`): RLS cho `anon`/`authenticated` chỉ SELECT; không có quyền ghi từ trình duyệt (đã kiểm chứng: INSERT/UPDATE/DELETE bằng publishable key đều bị từ chối).
- **Riêng tư** (`student_profiles`, `student_documents`, cùng `conversations`, `messages`, `leads`): RLS bật, `anon`/`authenticated` bị chặn hoàn toàn (đã kiểm chứng 401), chỉ `service_role` ở server truy cập. Hồ sơ học viên gắn với cookie httpOnly (DB lưu sha256), **chưa có đăng nhập** nên ai giữ cookie đó xem được hồ sơ; sẽ thay bằng Supabase Auth ở Tuần 6.
- Giấy tờ được gửi tới Google Gemini để đọc (giao diện có ghi rõ điều này).
- Khi gợi ý học bổng chỉ gửi cho AI các con số học tập, không gửi họ tên/ngày sinh/số giấy tờ.
- Giới hạn tần suất (in-memory, chỉ gần đúng trên serverless): tải giấy tờ 8 lần/phút/IP và 12/phút toàn site; gợi ý học bổng 4/phút/IP và 8/phút toàn site.

## 5. Kiểm thử đã làm
- **`npm test`**: 26 test cho logic thuần (làm sạch dữ liệu, đủ/thiếu/hợp lệ, so sánh điểm chuẩn ở các điểm biên, kiểm tra file, CSV, định dạng học bổng).
- **Qua API thật với giấy tờ GIẢ** (PDF bảng điểm, ảnh IELTS, ảnh căn cước tự sinh): đọc đúng từng trường; ảnh bị làm mờ, ảnh phong cảnh, bảng điểm thiếu dòng tổng kết, IELTS có điểm tổng sai đều được báo đúng lý do (Gemini trả về trống chứ không "bịa" số); file sai định dạng/rỗng/5 MB bị từ chối đúng.
- **Qua giao diện thật**: nộp từng bước, banner đổi theo từng lần nộp; hồ sơ đủ thì hiện đối chiếu 3/4 trường (GPA 8.2, IELTS 6.5) và AI tự gợi ý học bổng; hồ sơ còn nguyên sau khi tải lại trang; giao diện điện thoại không tràn.
- **Gợi ý học bổng (function calling)** với 4 hồ sơ: GPA 8.2/IELTS 6.5 → AI tra cứu Deakin, Swinburne, Auckland (bỏ qua Melbourne vì không đạt); GPA 3.5/4.0 (=8.75) → dùng đúng số quy đổi; GPA 9.2/IELTS 7.5 → tra cứu cả 4 trường, đủ điều kiện cả 4 học bổng (kể cả toàn phần); GPA 5.5/IELTS 5.0 → không trường nào đạt nên **không gọi AI**.

## 6. Triển khai trên Vercel
- Cần các biến: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (đã có) và nên thêm `SUPABASE_PUBLISHABLE_KEY` (dùng để đọc dữ liệu công khai với quyền tối thiểu; nếu quên, server tự dùng secret key và ghi cảnh báo).
- Tuỳ chọn: `GEMINI_DOC_MODEL`, `GEMINI_ADVISOR_MODEL` (mặc định `gemini-3.1-flash-lite`).
- Các route tải giấy tờ và gợi ý học bổng đặt `maxDuration = 60` giây vì AI có thể mất vài giây.

## 7. Hạn chế đã biết
- Chưa lưu file gốc (chưa có Supabase Storage) nên admin không xem lại được ảnh giấy tờ; chưa có trang admin xem hồ sơ học viên.
- Chưa kiểm tra chéo giữa các giấy tờ (ví dụ họ tên hoặc ngày sinh trên bảng điểm khác trên CMND) và chưa kiểm tra hạn 2 năm của IELTS.
- Chưa cho học viên xoá hồ sơ của mình; chưa có chính sách xoá dữ liệu cũ.
- Quy đổi GPA sang thang 10 là tuyến tính (không phải quy đổi chính thức của từng trường).
- Chưa hỗ trợ ảnh HEIC (iPhone) hay PDF cho IELTS/CMND.
- Bộ giấy tờ giả mới thử với bố cục đơn giản; giấy tờ thật (ảnh chụp nghiêng, có dấu mộc, nhiều trang) cần thử thêm.
