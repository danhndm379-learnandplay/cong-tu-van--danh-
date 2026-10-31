# Ghi chú: đăng nhập bằng magic link

Cập nhật: 2026-10-31. Trang `/login`: người dùng nhập email, nhận một link qua email, bấm vào link là đăng nhập xong (không cần mật khẩu).

## 1. Luồng hoạt động
1. `/login` → nhập email → Server Action `sendMagicLinkAction` (`app/login/actions.ts`) kiểm tra email, giới hạn tần suất rồi gọi `supabase.auth.signInWithOtp` (Supabase gửi email qua Gmail SMTP đã cấu hình).
2. Người dùng bấm link trong email → Supabase xác thực → chuyển về `/auth/callback` (`app/auth/callback/route.ts`) → đổi `code` (hoặc `token_hash`) thành phiên đăng nhập, ghi cookie rồi chuyển tới `/portal`.
3. Phiên lưu trong cookie `sb-<project>-auth-token` (httpOnly, không đọc được bằng JavaScript). `proxy.ts` làm mới token trước khi `/portal` và `/login` render. Nút "Đăng xuất" ở đầu `/portal` (`signOutAction`).

**Cổng hồ sơ yêu cầu đăng nhập và hồ sơ gắn với tài khoản:** chưa đăng nhập mà vào `/portal` thì bị chuyển sang `/login`; mỗi tài khoản chỉ xem được hồ sơ của chính mình nhờ RLS ở database (xem mục 6).

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
- Chưa làm: hạn chế ai được đăng nhập cổng học viên (hiện bất kỳ email nào cũng tạo được tài khoản). Admin có đăng nhập riêng bằng email + mật khẩu (mục 7).

## 6. RLS cho hồ sơ học viên (mỗi người chỉ xem hồ sơ của mình)
- Migration `20261031080000_student_profiles_row_level_security.sql`: thêm `student_profiles.user_id` (unique, xoá tài khoản thì hồ sơ và giấy tờ xoá theo), bỏ cột `owner_token_hash` cũ.
- Policy: `anon` không có quyền; `authenticated` chỉ SELECT và chỉ hàng của mình (`user_id = (select auth.uid())`; giấy tờ thì kiểm tra hồ sơ chứa nó thuộc về mình). Không ai ngoài server (secret key) ghi được, kể cả vào hồ sơ của chính mình, để không ai tự sửa điểm số do AI đọc.
- Trong code, hồ sơ được ĐỌC bằng phiên đăng nhập của người dùng (role `authenticated`) nên Postgres tự lọc; GHI bằng secret key với `userId` lấy từ phiên đã xác thực, không lấy từ dữ liệu client gửi.
- Kiểm tra: `node scripts/check-rls.mjs` (chạy trên database thật, tạo rồi xoá 2 người dùng thử, không gửi email): đọc chéo hồ sơ và giấy tờ bằng đúng id đều rỗng, mọi thao tác ghi bị 403, chưa đăng nhập bị 401, các bảng riêng tư khác (`leads`, `conversations`, `messages`, `quote_requests`) vẫn bị chặn với người đã đăng nhập.
- Lưu ý khi triển khai: migration đã xoá cột `owner_token_hash`, nên bản code cũ (dùng cookie) không đọc được hồ sơ nữa. Phải deploy code mới cùng lúc (hoặc ngay sau) khi áp dụng migration.

## 7. Đăng nhập admin bằng email + mật khẩu
- Trang `/admin/login`; tài khoản KHÔNG tự đăng ký được, do đội tạo sẵn: `node scripts/create-admin.mjs <email>` (chạy trên database thật, in mật khẩu ngẫu nhiên MỘT lần; thêm `--password "<mk>"` để tự chọn, tối thiểu 12 ký tự; `--force` nếu email đã có tài khoản học viên và muốn cấp quyền admin cho nó).
- Admin = tài khoản có `app_metadata.role = "admin"`. Chỉ server (secret key) hoặc Supabase Dashboard sửa được trường này. TUYỆT ĐỐI không dùng `user_metadata` để phân quyền vì người dùng tự sửa được.
- Vì endpoint đăng ký của Supabase vẫn mở (học viên cần nó để đăng nhập magic link), người lạ vẫn tạo được tài khoản thường, nhưng không có vai trò admin nên không vào được `/admin`.
- Mọi `/admin/*` (trừ `/admin/login`) bị `proxy.ts` chặn sớm; trang, Server Action và route xuất CSV tự kiểm tra lại. Chưa đăng nhập hoặc không phải admin thì chuyển sang `/admin/login`.
- Thêm thành viên: chạy lại script với email của họ. Thu hồi: Supabase Dashboard → Authentication → Users → xoá tài khoản (hoặc xoá `role` khỏi app_metadata).
- Đổi mật khẩu hiện chưa có giao diện: đặt lại trong Supabase Dashboard → Authentication → Users → chọn người dùng, hoặc chạy script với `--force --password "<mk mới>"`.
- Đã bỏ `ADMIN_PASSWORD` / `ADMIN_USER` (HTTP Basic). Có thể xoá hai biến này trên Vercel nếu đã đặt.

## 8. Hai vai trò: admin và nhân viên (RLS theo vai trò)
| | Admin | Nhân viên |
|---|---|---|
| Xem yêu cầu báo giá, hội thoại, lead, hồ sơ học viên, xuất CSV | ✔ | ✔ |
| Duyệt / từ chối yêu cầu báo giá | ✔ | ✘ |
| Trích xuất lead | ✔ | ✘ |
| Xoá hội thoại | ✔ | ✘ |
| Sửa thông tin giấy tờ của học viên | ✔ | ✘ |
| Xoá hồ sơ học viên | ✔ | ✘ |

- Vai trò lưu ở **App Metadata** (`app_metadata.role` = `admin` hoặc `nhan_vien`). Tạo tài khoản: `node scripts/create-admin.mjs <email>` (admin) hoặc `node scripts/create-admin.mjs <email> --role nhan_vien`. Hoặc gán bằng SQL Editor:
  `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"nhan_vien"}'::jsonb where email = 'a@b.com';`
- **Ba lớp chặn** với nhân viên: (1) giao diện không hiện nút sửa/xoá; (2) Server Action/route tự kiểm tra và từ chối; (3) **database (RLS)** từ chối mọi INSERT/UPDATE/DELETE nếu token không có vai trò admin, nên dù nhân viên gọi thẳng REST của Supabase bằng token của chính họ cũng không sửa/xoá được (đã kiểm chứng: `node scripts/check-role-rls.mjs`, 78/78).
- Muốn RLS có tác dụng thì thao tác sửa/xoá phải chạy bằng phiên của người dùng, không phải secret key; xem CLAUDE.md mục "RLS theo VAI TRÒ".
- Đổi vai trò chỉ có hiệu lực sau khi người đó đăng nhập lại (vai trò nằm trong token, tối đa ~1 giờ).
- Học viên đăng nhập bằng magic link không có vai trò nên không vào được `/admin` và không đọc được dữ liệu quản trị.
