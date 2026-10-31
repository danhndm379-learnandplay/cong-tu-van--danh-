# Ghi chú: đăng nhập bằng magic link

Cập nhật: 2026-10-31. Trang `/login`: người dùng nhập email, nhận một link qua email, bấm vào link là đăng nhập xong (không cần mật khẩu).

## 1. Luồng hoạt động
1. `/login` → nhập email → Server Action `sendMagicLinkAction` (`app/login/actions.ts`) kiểm tra email, giới hạn tần suất rồi gọi `supabase.auth.signInWithOtp` (Supabase gửi email qua Gmail SMTP đã cấu hình).
2. Người dùng bấm link trong email → Supabase xác thực → chuyển về `/auth/callback` (`app/auth/callback/route.ts`) → đổi `code` (hoặc `token_hash`) thành phiên đăng nhập, ghi cookie rồi chuyển tới `/portal`.
3. Phiên lưu trong cookie `sb-<project>-auth-token` (httpOnly, không đọc được bằng JavaScript). `proxy.ts` làm mới token trước khi `/portal` và `/login` render. Nút "Đăng xuất" ở đầu `/portal` (`signOutAction`).

Đăng nhập chưa thay đổi quyền truy cập: `/portal` vẫn mở cho mọi người và hồ sơ học viên vẫn gắn với cookie `duhoc24_student` của trình duyệt (chưa gắn vào tài khoản đăng nhập). Việc đó là bước tiếp theo.

## 2. Việc phải làm trong Supabase Dashboard (code không làm thay được)
**Authentication → URL Configuration**
- **Site URL**: `https://cong-tu-van-danh.vercel.app`
- **Redirect URLs** (thêm cả hai):
  - `https://cong-tu-van-danh.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (để thử trên máy)

Không thêm thì link trong email sẽ về sai chỗ (về Site URL mặc định, thường là `localhost:3000`).

**Tuỳ chọn, nên làm sau khi đã deploy: cho phép mở link ở thiết bị khác.** Mặc định link chỉ dùng được trên CÙNG trình duyệt đã bấm "Gửi link" (luồng PKCE cần cookie ở trình duyệt đó). Khách hay yêu cầu link trên máy tính nhưng mở email trên điện thoại, nên sửa mẫu email ở **Authentication → Emails → Templates**, ở CẢ HAI mẫu **Magic Link** và **Confirm signup** (người dùng mới nhận mẫu Confirm signup), đặt link thành:

```html
<h2>Đăng nhập DuHoc24</h2>
<p>Bấm vào link bên dưới để đăng nhập (link chỉ dùng được một lần):</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Đăng nhập</a></p>
```

`{{ .SiteURL }}` luôn là địa chỉ Site URL ở trên, nên với mẫu này link luôn trỏ về bản chính thức (không thử được trên localhost).

## 3. Biến môi trường
| Biến | Ghi chú |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | **Bắt buộc** cho đăng nhập (trước đây `SUPABASE_PUBLISHABLE_KEY` chỉ là khuyến nghị). Thiếu thì `/login` báo "chưa được cấu hình". Phải có trên Vercel. |
| `QUOTE_LOGIN_URL` | Link đăng nhập gửi cho khách trong email mời. Trên Vercel đặt `https://cong-tu-van-danh.vercel.app/login`. Để trống thì dùng `<NEXT_PUBLIC_SITE_URL>/login` hoặc địa chỉ website hiện tại. |
| `NEXT_PUBLIC_SITE_URL` | Nếu có đặt trên Vercel thì PHẢI là địa chỉ thật, không để `http://localhost:3000` (giá trị trong `.env.example`). |

## 4. Cập nhật email mời trong Make.com (Tuần 5)
Code đã gửi sẵn trường **`loginUrl`** trong webhook "đã duyệt" (`https://hook.eu1.make.com/7qak…`), nên link luôn trỏ tới `/login`. Trong Make:
1. Mở scenario "đã duyệt" → module gửi email.
2. Thay link demo cũ (nếu đã gõ cứng) bằng biến **`loginUrl`** lấy từ module Webhook (ví dụ `{{1.loginUrl}}`), để sau này đổi `QUOTE_LOGIN_URL` thì không phải sửa Make.
3. Gợi ý nội dung:
   - Tiêu đề: `Yêu cầu của bạn đã được duyệt — đăng nhập vào cổng hồ sơ DuHoc24`
   - Nội dung: `Chào {{1.customerName}}, yêu cầu báo giá của bạn đã được duyệt. Bấm vào link để vào cổng hồ sơ: {{1.loginUrl}}. Tại trang đăng nhập, nhập CHÍNH email này ({{1.email}}), hệ thống sẽ gửi tiếp một link đăng nhập (không cần mật khẩu).`
4. Bấm "Run once", duyệt một yêu cầu thử trên `/admin/requests` rồi kiểm tra email nhận được và link mở đúng trang đăng nhập.

Lưu ý: link trong email mời là link chung tới trang đăng nhập; khách vẫn phải nhập email để nhận magic link riêng.

## 5. Bảo mật và giới hạn
- Magic link tới bất kỳ email nào đều bị giới hạn: 5 lần/phút/IP, 1 lần/phút/email, 25 lần/giờ toàn site (Supabase mặc định 30 email/giờ khi dùng SMTP riêng; Gmail cá nhân tối đa 500 email/ngày). Bộ giới hạn nằm trong bộ nhớ nên trên serverless chỉ gần đúng.
- Trang luôn trả lời giống nhau dù email đã có tài khoản hay chưa (không lộ email nào đã đăng ký). Hiện BẤT KỲ email nào cũng đăng nhập được (Supabase tự tạo người dùng); muốn chỉ cho khách đã được duyệt đăng nhập thì cần kiểm tra thêm với bảng `quote_requests`.
- `?next=` ở callback chỉ nhận đường dẫn nội bộ (`safeNextPath`), chặn open redirect.
- Cookie phiên đặt `httpOnly` (và `secure` ở production).
- Link trong email là dùng một lần; một số hệ thống quét thư có thể "bấm thử" trước và làm link hết hạn, khi đó nhập lại email để nhận link mới.
- Chưa làm: gắn `student_profiles` vào tài khoản, bắt buộc đăng nhập để vào `/portal`, phân quyền admin bằng tài khoản (admin vẫn dùng `ADMIN_PASSWORD` tuỳ chọn).
