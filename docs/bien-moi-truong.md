# Biến môi trường và cấu hình ngoài code

Mẫu nằm ở `.env.example`; giá trị thật để trong `.env.local` (đã gitignore) và trong **Vercel → Project → Settings → Environment Variables**.
Đổi biến trên Vercel xong phải **Redeploy** mới có hiệu lực. Không bao giờ commit giá trị thật.

## Lần cập nhật 10/11/2026 (đăng nhập Google, quản lý tài khoản nội bộ, RLS tra vai trò từ database)

**Không có biến môi trường MỚI.** Các tính năng này dùng lại biến có sẵn:

| Tính năng | Biến dùng | Ghi chú |
|---|---|---|
| Đăng nhập Google (`/login`) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Client ID/Secret của Google nằm ở Supabase Dashboard, không ở `.env` |
| Quản lý tài khoản nội bộ (`/admin/accounts`) | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Gọi Auth Admin API ở server |
| RLS tra vai trò từ database | (không dùng biến) | Là migration SQL, xem dưới |

**Thay đổi về ý nghĩa/độ nhạy (không đổi tên):**
- `SUPABASE_SECRET_KEY` giờ còn dùng để **tạo tài khoản và gán vai trò admin** qua giao diện. Lộ key này nghĩa là kẻ xấu tự tạo được admin, nên tuyệt đối không đặt tên bắt đầu bằng `NEXT_PUBLIC_`, không commit, không dán vào chat. Nghi ngờ lộ thì xoay key ở Supabase Dashboard → Project Settings → API Keys rồi cập nhật cả `.env.local` và Vercel.
- `SUPABASE_PUBLISHABLE_KEY` bắt buộc cho **mọi** kiểu đăng nhập (Google, magic link, admin email + mật khẩu). Thiếu thì đăng nhập báo "chưa được cấu hình".
- `NEXT_PUBLIC_SITE_URL` trên Vercel phải là `https://cong-tu-van-danh.vercel.app`. Bản chạy thật bỏ qua giá trị localhost, nhưng đừng để sai.

**Đã sửa trong `.env.example` (chỉ chú thích, không đổi giá trị):**
- Bỏ câu cũ "chỉ có UI mock, chưa cần các biến này".
- Mô tả admin: vai trò `admin` **hoặc** `nhan_vien`, thêm tài khoản ngay ở `/admin/accounts`.
- Thêm hai biến tuỳ chọn trước đây có trong code nhưng chưa ghi: `GEMINI_DOC_THINKING_LEVEL`, `GEMINI_ADVISOR_THINKING_LEVEL`.
- `SUPABASE_JWKS_URL` không còn được code đọc (để lại cũng không sao).

**Cần làm ở nơi khác (không phải biến môi trường):**
1. **Database:** migration `supabase/migrations/20261110090000_role_rls_read_role_from_database.sql` đã áp dụng lên project Supabase đang dùng (local và Vercel dùng chung một database nên không cần làm lại). Dựng project mới thì chạy lại toàn bộ thư mục `supabase/migrations/` theo thứ tự.
2. **Supabase → Authentication → Sign In / Providers → Google:** bật, nhập Client ID/Secret.
3. **Supabase → Authentication → URL Configuration:** Site URL `https://cong-tu-van-danh.vercel.app`; Redirect URLs có `https://cong-tu-van-danh.vercel.app/auth/callback` và `http://localhost:3000/auth/callback`.
4. **Google Cloud Console → OAuth consent screen:** nếu đang "Testing" thì thêm email người thử vào Test users, hoặc chuyển In production.
5. Tạo thêm tài khoản quản trị: vào `/admin/accounts` (admin), hoặc `node scripts/create-admin.mjs <email> [--role nhan_vien]`.

## Danh sách đầy đủ

### Bắt buộc
| Biến | Đặt ở | Dùng để |
|---|---|---|
| `SUPABASE_URL` | local + Vercel | Địa chỉ project Supabase |
| `SUPABASE_SECRET_KEY` | local + Vercel | Quyền server (bỏ qua RLS): chatbot, lưu hồ sơ do AI đọc, quản lý tài khoản, email/vai trò. **Bí mật** |
| `SUPABASE_PUBLISHABLE_KEY` | local + Vercel | Đăng nhập (Google, magic link, admin) và đọc dữ liệu công khai. Được phép lộ, quyền hạn bị RLS giới hạn |
| `GEMINI_API_KEY` | local + Vercel | Chatbot, đọc giấy tờ, trích xuất lead, gợi ý học bổng. **Bí mật** |

### Nên có
| Biến | Mặc định | Dùng để |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | địa chỉ website hiện tại | Link đăng nhập, link gửi khách, metadata |
| `QUOTE_WEBHOOK_URL` | (trống = không gửi) | Make.com nhận yêu cầu báo giá mới. https, **bí mật** |
| `QUOTE_APPROVED_WEBHOOK_URL` | (trống = nút Duyệt báo lỗi cấu hình) | Make.com nhận khi admin Duyệt. https, **bí mật** |
| `QUOTE_LOGIN_URL` | `<NEXT_PUBLIC_SITE_URL>/login` | Link đăng nhập gửi khách trong email duyệt |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model chatbot |

### Tuỳ chọn (có mặc định)
`GEMINI_DOC_MODEL`, `GEMINI_ADVISOR_MODEL`, `GEMINI_LEAD_MODEL`, `GEMINI_THINKING_LEVEL`, `GEMINI_DOC_THINKING_LEVEL`, `GEMINI_ADVISOR_THINKING_LEVEL`, `GEMINI_LEAD_THINKING_LEVEL`, `CHAT_RATE_LIMIT_PER_MIN` (10), `CHAT_GLOBAL_RATE_LIMIT_PER_MIN` (12).

### Chỉ để ghi nhớ trên máy bạn (code KHÔNG đọc, KHÔNG đặt lên Vercel)
`ADMIN_ACCOUNT_PASSWORD` (mật khẩu tài khoản admin của bạn), `SUPABASE_SMTP_APP_PASSWORD` (Gmail App Password; thật sự được nhập ở Supabase Dashboard → Authentication → SMTP Settings), `SUPABASE_JWKS_URL` (không còn dùng).
