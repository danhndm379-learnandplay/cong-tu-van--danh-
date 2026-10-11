# Ghi chú: chatbot Gemini + lưu hội thoại vào Supabase

Cập nhật: 2026-10-11. Tóm tắt những gì đã làm trong phần chatbot, để người sau (hoặc chính mình) đọc lại.

## 1. Chatbot trả lời bằng Gemini
- Model mặc định `gemini-3.5-flash-lite` (đổi bằng `GEMINI_MODEL`). Tên model Gemini hay bị Google retire (`gemini-2.5-flash` đã trả 404).
- Prompt nằm ở `app/api/chat/route.ts`; bộ hỏi–đáp ở `lib/chatbot-qna.ts`.
  - Câu khớp bộ QnA → trả lời đúng theo bộ QnA.
  - Câu ngoài bộ → trả lời bằng kiến thức chung, ghi rõ "thông tin tham khảo, không phải chính thức của DuHoc24", kèm hướng dẫn liên hệ.
  - Câu không liên quan du học → trả lời ngắn rồi mời quay lại chủ đề.
  - Cấm khẳng định điều gì về dịch vụ DuHoc24 ngoài những gì bộ QnA nêu rõ.
- Trả lời đúng ngôn ngữ người dùng: model phải khai báo `user_language` trước rồi mới viết `reply` (structured output JSON). Việt/Anh ổn định; Nhật/Hàn với model lite còn sai.
- Rate limit trong bộ nhớ (`lib/rate-limit.ts`): 10 req/phút/IP, 12 req/phút toàn site (gói free Gemini chỉ cho 15 req/phút). Trên Vercel chỉ mang tính gần đúng.
- Lỗi trả về dạng mã (`rate_limited`, `upstream_busy`, `storage_error`...), widget tra thông điệp song ngữ ở `lib/chatbot-config.ts`.
- Khung chat luôn tự cuộn xuống đáy (cuộn tức thì, không dùng smooth).

## 2. Lưu hội thoại vào Supabase (dữ liệu riêng tư)
Project: `BT DLLT - Cong tiep nhan ho so` (`vftutmrvxacyykwlpqlc`, ap-northeast-1). Migration: `supabase/migrations/20261010064239_create_private_chat_tables.sql`.

- Bảng `conversations` (id, `visitor_token_hash`, channel, created_at, last_message_at) và `messages` (id, conversation_id, role `user|bot`, content ≤ 4000, created_at). Trigger cập nhật `last_message_at`.
- **RLS bật** cho cả hai bảng; `anon`/`authenticated` bị thu hồi mọi quyền và có policy `using (false)`; chỉ `service_role` truy cập được. Đã kiểm chứng: gọi REST API bằng publishable key → `401 permission denied` cho đọc/thêm/xóa. Advisor bảo mật không báo gì.
- Mọi truy cập DB đi qua `lib/chat-store.ts` (`import "server-only"`, `createAdminClient` của `@supabase/server/core`, cần `SUPABASE_URL` + `SUPABASE_SECRET_KEY`).
- Khách nhận diện bằng cookie httpOnly `duhoc24_visitor` (token ngẫu nhiên, 1 năm). DB chỉ lưu sha256 của token.
- `GET /api/chat` trả lịch sử của khách; `POST /api/chat` nhận **một** `{ message }`, lấy lịch sử từ DB (không tin lịch sử từ trình duyệt), gọi Gemini, lưu cả hai tin, trả lại đúng các dòng đã lưu. Nếu lưu lỗi thì không trả lời (báo `storage_error`).
- Widget không dùng `localStorage`; chỉ giữ tạm câu đang gửi và thông báo lỗi.

## 3. Đã kiểm thử
- API: gửi/đọc lại, khách khác thấy rỗng, cookie giả thấy rỗng, cách gửi cũ bị 400, tiếng Việt lưu đúng, trigger chạy.
- Trình duyệt: gửi → tải lại trang → mở chat → lịch sử vẫn còn (đọc từ DB).
- Dữ liệu test đã được xóa khỏi DB.

## 4. Lưu ý quan trọng
- `/admin/conversations` đọc dữ liệu thật của khách và hiện KHÔNG yêu cầu đăng nhập (mục 6). Đừng bỏ `proxy.ts`/`requireAdmin()` để còn bật lại được; nên bật `ADMIN_PASSWORD` trước khi có khách thật.
- Chưa có đăng nhập nên hội thoại gắn với cookie trình duyệt, chưa gắn tài khoản. Chưa có chính sách xóa dữ liệu cũ.
- `SUPABASE_SECRET_KEY` bỏ qua RLS: không đặt tên bắt đầu bằng `NEXT_PUBLIC_`, không commit.
- Key Gemini cũ từng xuất hiện trong file `.env (2).example` (đã gỡ khỏi lịch sử git trước khi push) và trong transcript làm việc; cân nhắc đổi key.

## 5. Trạng thái deploy (Vercel: cong-tu-van-danh.vercel.app)
- Chatbot lưu hội thoại vào Supabase trên site thật: ĐÃ XONG và đã kiểm chứng (đã thêm biến SUPABASE_URL, SUPABASE_SECRET_KEY trên Vercel).
- Trang xem hội thoại (mục 6) mới làm xong ở máy local; chưa push/deploy. Đăng nhập đang TẮT theo yêu cầu: sau khi deploy, ai biết URL `/admin/conversations` cũng đọc được hội thoại của khách. Muốn bật lại: đặt `ADMIN_PASSWORD` trên Vercel và Redeploy.

## 6. Trang xem hội thoại thật cho admin (2026-10-11)
- `/admin/conversations`: danh sách 20 cuộc/trang (bắt đầu, hoạt động gần nhất, số tin nhắn, câu hỏi đầu tiên của khách). `/admin/conversations/[id]`: toàn bộ tin nhắn của một cuộc, phân biệt Khách/Chatbot, kèm giờ (giờ Việt Nam).
- Dữ liệu đọc qua `lib/chat-store.ts` (`listConversationsForAdmin`, `getConversationForAdmin`) và RPC `public.list_conversations_for_admin` (migration `supabase/migrations/20261011021204_...`); RPC bị thu hồi quyền với anon/authenticated, chỉ service_role gọi được (đã kiểm chứng: publishable key → 401).
- **Đăng nhập tuỳ chọn (HTTP Basic Auth)**, hiện TẮT (cập nhật 2026-10-11 theo yêu cầu: chưa cần authentication/phân quyền). Chỉ bật khi đặt `ADMIN_PASSWORD`; khi bật, `proxy.ts` chặn `/admin/conversations/**` bằng hộp thoại đăng nhập và mỗi trang tự gọi `requireAdmin()` (`lib/admin-guard.ts`); so sánh mật khẩu bằng sha256 + timingSafeEqual. Đã kiểm thử cả hai trạng thái. `/admin` có `robots: noindex` (không phải bảo vệ). Thay bằng Supabase Auth ở Tuần 6.
- Các trang admin khác (requests, schools, profiles) vẫn dùng mock data và chưa có đăng nhập. Đã xoá dữ liệu giả `conversations` khỏi `lib/mock-data.ts`.
- Đã kiểm thử: không đăng nhập / sai mật khẩu / sai user / request kiểu RSC đều 401; đúng mật khẩu 200; id sai hoặc không tồn tại 404; `page=abc|-5|999` không lỗi; kiểm tra giao diện bằng trình duyệt; dữ liệu test đã xoá (chỉ còn cuộc "hello" thật).
- Khi bật đăng nhập: Basic Auth không có đăng xuất/phân quyền và không giới hạn số lần thử sai (proxy không chia sẻ bộ nhớ nên limiter in-memory không đáng tin ở đây) — dùng mật khẩu dài, ngẫu nhiên.

## 7. Xoá cuộc trò chuyện (2026-10-11)
- Nút "Xoá" ở danh sách và "Xoá cuộc trò chuyện" ở trang chi tiết, có bước xác nhận ("Xoá vĩnh viễn"/"Huỷ"). Xoá xong danh sách tự cập nhật; từ trang chi tiết thì quay về danh sách.
- Cài bằng Server Action `deleteConversationAction` (`app/admin/conversations/actions.ts`) → `deleteConversationForAdmin` (`lib/chat-store.ts`). Xoá vĩnh viễn; tin nhắn xoá theo nhờ `on delete cascade` (đã kiểm tra: không còn tin nhắn mồ côi).
- Quyền: `checkAdminWrite()` (`lib/admin-guard.ts`) chạy trong action (Server Action là endpoint công khai nên không dựa vào việc ẩn nút). Chưa đặt `ADMIN_PASSWORD` thì ai cũng xoá được (theo yêu cầu, chưa cần đăng nhập); đặt rồi thì phải đăng nhập (không/sai mật khẩu → 401).
- Id sai hoặc không tồn tại → báo "Không tìm thấy cuộc trò chuyện", không lỗi. Khách đang mở chat trên trình duyệt: tin nhắn kế tiếp sẽ tạo cuộc trò chuyện mới (cuộc cũ đã mất).
- **Rủi ro khi chưa bật đăng nhập:** ai biết URL `/admin/conversations` đều xoá được mọi hội thoại. Nên đặt `ADMIN_PASSWORD` trước khi có khách thật.
