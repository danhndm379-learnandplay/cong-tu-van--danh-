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

## 8. Persona thu thập lead (2026-10-11)
- Prompt mới do người dùng cung cấp (trợ lý tư vấn du học, luồng 7 bước, 1 câu hỏi/lượt, 2-3 câu/lượt, không nói chi phí trừ khi được hỏi, không cam kết đậu visa/học bổng). Nằm ở `lib/chatbot-prompt.ts` (tách khỏi `app/api/chat/route.ts`); thông tin dịch vụ/trụ sở/hotline ở hằng `companyInfo` trong cùng file.
- Bộ QnA (`lib/chatbot-qna.ts`) vẫn được giữ làm nguồn sự thật về DuHoc24 và vẫn đưa vào prompt; quy tắc cũ "luôn trả lời, không từ chối, câu ngoài QnA dùng kiến thức chung kèm ghi chú tham khảo" và "trả lời đúng ngôn ngữ khách" được giữ.
- Đã kiểm thử 4 luồng (Việt đầy đủ, Việt bị hỏi xen chi phí/visa, Anh đầy đủ, khách từ chối để lại thông tin): đúng thứ tự bước, mỗi lượt một câu hỏi, không nêu giá, không cam kết visa, đúng ngôn ngữ, tôn trọng khi khách từ chối. Dữ liệu test (tên/email/sđt giả) đã xoá khỏi DB.
- **Lưu ý riêng tư:** bot giờ thu thập họ tên, email, số điện thoại và các thông tin này nằm trong bảng `messages`. `/admin/conversations` hiện KHÔNG cần đăng nhập và ai cũng xoá được → số điện thoại/email của khách có thể bị người lạ xem. Cần đặt `ADMIN_PASSWORD` trên Vercel trước khi chạy thật.
- Chưa có bảng `leads` riêng: thông tin liên hệ chỉ nằm trong nội dung hội thoại, chưa được trích thành trường có cấu trúc. Bot cũng không đặt lịch được, chỉ hướng dẫn gọi hotline hoặc đến trụ sở.

## 9. Trích xuất lead bằng Gemini (2026-10-12)
- Trang chi tiết cuộc trò chuyện có thẻ "Thông tin lead" và nút "Trích xuất lead"/"Trích xuất lại". Trích xuất: tên, email, số điện thoại, nước du học, bậc học, ngành, availability, đặt lịch tư vấn (Có/Không/Chưa rõ), ghi chú, chất lượng lead (Good/OK/Spam) kèm lý do. Hiện cảnh báo khi cuộc trò chuyện có tin nhắn mới sau lần trích xuất.
- Model `gemini-3.1-flash-lite` (env `GEMINI_LEAD_MODEL`), temperature 0, thinking LOW, structured output. Prompt ở `lib/lead-extraction.ts`: coi bản ghi là dữ liệu (chống prompt injection), chỉ lấy lời KHÁCH, "đặt lịch" chỉ true khi khách chủ động xin/đồng ý.
- Lưu ở bảng `leads` (migration `20261012001247_create_leads_table.sql`): unique theo cuộc trò chuyện, RLS bật + chặn anon/authenticated (đã kiểm chứng 401), xoá cuộc trò chuyện thì xoá lead (cascade, đã kiểm chứng).
- `sanitizeLead` (`lib/lead-sanitize.ts`) kiểm chứng đầu ra: email/sđt phải xuất hiện trong lời khách, "good" bắt buộc có liên hệ. 19 test trực tiếp bằng Node đều qua.
- Đã kiểm thử 5 tình huống thật qua Server Action: lead tốt đầy đủ (good, đặt lịch Có), spam (spam), khách mơ hồ (ok), khách thử lừa model + hỏi hotline (không lấy email giả/hotline, ok, ghi chú nêu hành vi thử nghiệm), khách từ chối (ok, đặt lịch Không). Giao diện desktop + điện thoại ổn. Dữ liệu test đã xoá.
- Không tự chạy khi mở trang (tránh tốn quota/bị lạm dụng) và chưa tự chạy sau mỗi cuộc trò chuyện. Giới hạn 6 lần/phút/IP, 10 lần/phút toàn site.
- **Riêng tư:** lead chứa tên/email/số điện thoại của khách. Khi chưa đặt `ADMIN_PASSWORD`, ai biết URL `/admin/conversations` đều xem/xoá/kích hoạt trích xuất được. Cần bật đăng nhập trước khi có khách thật.
- Chưa có: tự động trích xuất khi cuộc trò chuyện kết thúc (đã có danh sách/lọc theo chất lượng và xuất CSV ở mục 10).
- (Đã sửa ở mục 10) Quan sát cũ: chatbot từng nói "đã ghi nhận lịch hẹn" dù không đặt lịch được.

## 10. Danh sách có chất lượng lead, lọc, xuất CSV; siết prompt đặt lịch (2026-10-12)
- **Prompt:** thêm quy tắc "VỀ ĐẶT LỊCH" (`lib/chatbot-prompt.ts`): hệ thống chưa có chức năng đặt lịch nên bot không được nói/ngụ ý đã đặt/ghi nhận/xác nhận/giữ chỗ lịch hẹn kể cả khi khách nêu rõ ngày giờ; chỉ hướng dẫn gọi hotline hoặc đến trụ sở để chốt lịch. Đã test 8 lượt (Việt + Anh, kể cả khách hỏi "lịch của mình được đặt chưa?"): 0 vi phạm.
- **Danh sách `/admin/conversations`:** cột "Chất lượng lead" (Good/OK/Spam hoặc "Chưa trích xuất"), bộ lọc Tất cả/Good/OK/Spam/Chưa trích xuất (`?quality=`, giữ khi phân trang), nút "Xuất CSV lead". Trên điện thoại hiện dạng thẻ có nhãn chất lượng.
- **Database:** migration `20261012002800_conversation_list_with_lead_quality.sql` thay RPC `list_conversations_for_admin` (thêm `lead_quality`, tham số `p_quality` mặc định null nên mã cũ gọi 2 tham số vẫn chạy) và thêm `count_conversations_for_admin`; cả hai chỉ service_role gọi được (đã kiểm chứng 401 với publishable key, advisor sạch).
- **Xuất CSV:** `/admin/conversations/export[?quality=good|ok|spam]` → file `leads-YYYY-MM-DD[-quality].csv`, 15 cột tiếng Việt, BOM UTF-8, tối đa 5000 dòng, giới hạn 6 lần/phút/IP. Ô bắt đầu bằng = @ (hoặc + - không phải số điện thoại) được chèn dấu nháy đơn để chống formula injection (`lib/leads-csv.ts`, 21 test trực tiếp bằng Node đều qua). Khi bật `ADMIN_PASSWORD` thì route này cũng bị khoá (đã kiểm chứng 401/200). Lưu ý: Excel có thể bỏ số 0 đầu của số điện thoại khi mở CSV; hãy dùng Data → From Text/CSV và chọn cột là Text.
- **Dữ liệu thử được GIỮ LẠI theo yêu cầu** để xem trên trang admin: 8 cuộc có tiền tố `LEAD-TEST` ở tin đầu (7 đã trích xuất: 2 Good, 3 OK, 2 Spam; 1 chưa trích xuất) chứa tên/email/số điện thoại GIẢ. Xoá bằng nút "Xoá" hoặc SQL: `delete from public.conversations where id in (select conversation_id from public.messages where role=user and content like LEAD-TEST%)`.
- **Biến môi trường trên Vercel:** code chỉ cần `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (do `@supabase/server` đọc) và `GEMINI_API_KEY`; `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWKS_URL`, `NEXT_PUBLIC_*` hiện không dùng tới. Tuỳ chọn: `GEMINI_MODEL`, `GEMINI_LEAD_MODEL`, `ADMIN_PASSWORD`/`ADMIN_USER`, `CHAT_RATE_LIMIT_PER_MIN`, `CHAT_GLOBAL_RATE_LIMIT_PER_MIN`.
