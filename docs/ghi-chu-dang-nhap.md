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

- Vai trò lưu ở **App Metadata** (`app_metadata.role` = `admin` hoặc `nhan_vien`). Tạo tài khoản: `node scripts/create-admin.mjs <email>` (admin) hoặc `node scripts/create-admin.mjs <email> --role nhan_vien`. Email đã có tài khoản (vd. học viên) thì thêm `--force` để cấp/đổi vai trò (script cũng đặt mật khẩu mới). **Vai trò phải gán bằng code/script này**, không sửa tay trên Supabase Dashboard vì ở đó không chỉnh được raw JSON của App Metadata.
- **Ba lớp chặn** với nhân viên: (1) giao diện không hiện nút sửa/xoá; (2) Server Action/route tự kiểm tra và từ chối; (3) **database (RLS)** từ chối mọi INSERT/UPDATE/DELETE nếu người gọi không phải admin (tra vai trò HIỆN TẠI trong database, xem dưới), nên dù nhân viên gọi thẳng REST của Supabase bằng token của chính họ cũng không sửa/xoá được (đã kiểm chứng: `node scripts/check-role-rls.mjs`, 78/78).
- Muốn RLS có tác dụng thì thao tác sửa/xoá phải chạy bằng phiên của người dùng, không phải secret key; xem CLAUDE.md mục "RLS theo VAI TRÒ".
- **Đổi vai trò, khoá hoặc xoá tài khoản có hiệu lực NGAY ở mọi lớp**, kể cả khi người đó còn giữ token cũ (token sống tới ~1 giờ). Các chính sách RLS không đọc vai trò trong token nữa mà gọi hàm `private.staff_role()` (migration `20261110090000_role_rls_read_role_from_database.sql`), hàm này tra `auth.users` của người đang gọi và trả null nếu tài khoản bị khoá (`banned_until`) hoặc đã xoá. Hàm nằm ở schema `private` (không lộ thành API), chỉ trả vai trò của chính người gọi. Đã kiểm chứng bằng `node scripts/check-account-admin.mjs` (17 kiểm tra: hạ quyền, khoá, xoá đều chặn ngay bằng token cũ).
- **Quản lý tài khoản trong dashboard:** admin vào `/admin/accounts` (mục "Tài khoản nội bộ" ở menu, nhân viên không thấy) để xem danh sách, đổi vai trò và thêm tài khoản email + mật khẩu (tự nhập ≥ 12 ký tự hoặc bấm "Tạo mật khẩu ngẫu nhiên"; mật khẩu chỉ hiện một lần sau khi tạo). Không tự đổi vai trò của mình, không hạ admin cuối cùng, email đã là tài khoản học viên thì bị từ chối. Script `create-admin.mjs` vẫn dùng được khi cần cấp vai trò cho email có sẵn (`--force`). Kiểm chứng giả định với Supabase Auth: `node scripts/check-account-admin.mjs`.
- Học viên đăng nhập bằng magic link không có vai trò nên không vào được `/admin` và không đọc được dữ liệu quản trị.

## 9. Đăng nhập bằng Google
- Trên `/login` có nút **Đăng nhập bằng Google** (trên cùng) và ô nhận link qua email (bên dưới). Bấm nút Google → chọn tài khoản Google → quay về `/auth/callback` → vào `/portal`. Không có ô nhập mật khẩu ở phía site.
- Code: `components/auth/google-button.tsx` + Server Action `signInWithGoogleAction` (`app/login/actions.ts`), dùng chung `/auth/callback` với link email. Luôn hiện bảng chọn tài khoản (`prompt=select_account`).
- Email mời trong Make (`loginUrl`) trỏ tới `/login`, tức trang có nút Google; trong Make chỉ cần dùng biến `loginUrl`, không phải sửa gì khi trang đăng nhập đổi.
- **Danh sách kiểm tra cấu hình** (không nằm trong code):
  1. Supabase → Authentication → Sign In / Providers → **Google: bật**, nhập Client ID và Client Secret (đã kiểm tra: Supabase báo Google bật và Google chấp nhận client).
  2. Google Cloud Console → Credentials → OAuth client → **Authorized redirect URIs** có `https://<project-ref>.supabase.co/auth/v1/callback` (đã kiểm tra: không báo `redirect_uri_mismatch`).
  3. Supabase → Authentication → URL Configuration: **Site URL** `https://cong-tu-van-danh.vercel.app` và **Redirect URLs** có `https://cong-tu-van-danh.vercel.app/auth/callback` và `http://localhost:3000/auth/callback`. Thiếu thì sau khi chọn tài khoản Google, Supabase đưa về Site URL (thường là trang chủ kèm `?code=`) thay vì `/auth/callback` và đăng nhập không hoàn tất.
  4. Google Cloud Console → OAuth consent screen: nếu trạng thái là **Testing** thì chỉ các **Test users** được liệt kê mới đăng nhập được (người khác thấy "Access blocked"). Trước demo hãy thêm email người thử vào Test users hoặc chuyển sang In production.
- Cùng email với tài khoản đã có (vd. học viên đã đăng nhập bằng link email, hoặc tài khoản admin) thì Supabase gộp Google vào cùng tài khoản: cùng hồ sơ, và nếu tài khoản đó có vai trò admin/nhân viên thì phiên Google cũng có vai trò đó.
- Dữ liệu nhận từ Google: email, tên hiển thị, ảnh đại diện (lưu trong Supabase Auth, site chỉ dùng email). Đã ghi vào `/privacy`.
