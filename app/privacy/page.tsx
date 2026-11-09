import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư — DuHoc24",
  description: "DuHoc24 thu thập những thông tin nào, dùng để làm gì, lưu ở đâu và cách yêu cầu xoá dữ liệu của bạn.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

// Trang tĩnh, công khai. Nội dung phải khớp với những gì sản phẩm thực sự làm: sửa tại đây khi thêm cách thu thập dữ liệu hay bên xử lý mới.
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="text-3xl font-medium tracking-tight">Chính sách quyền riêng tư</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cập nhật lần cuối: 10/11/2026</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          DuHoc24 là dịch vụ tiếp nhận và xử lý hồ sơ du học. Trang này nói ngắn gọn chúng tôi thu thập thông tin gì của bạn, dùng để làm gì, lưu ở đâu và
          bạn yêu cầu xoá dữ liệu bằng cách nào.
        </p>

        <Section title="1. Thông tin chúng tôi thu thập">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-foreground">Tài khoản đăng nhập:</span> nếu bạn đăng nhập bằng Google, chúng tôi nhận email, tên hiển thị và
              ảnh đại diện của tài khoản Google đó (chúng tôi không nhận mật khẩu Google của bạn); nếu bạn nhận link qua email, chúng tôi chỉ lưu địa chỉ email đó.
            </li>
            <li>
              <span className="font-medium text-foreground">Form báo giá:</span> họ tên, email, quốc gia muốn du học, bậc học và gói dịch vụ bạn chọn.
            </li>
            <li>
              <span className="font-medium text-foreground">Chatbot tư vấn:</span> nội dung cuộc trò chuyện, gồm cả thông tin bạn tự nhập vào khung chat
              (như họ tên, email, số điện thoại).
            </li>
            <li>
              <span className="font-medium text-foreground">Giấy tờ bạn tải lên:</span> bảng điểm, chứng chỉ IELTS, CMND/CCCD hoặc hộ chiếu. Hệ thống đọc
              file và chỉ lưu thông tin trích xuất (họ tên, ngày sinh, điểm số, số giấy tờ); <span className="font-medium text-foreground">file gốc không được lưu</span>.
            </li>
            <li>
              <span className="font-medium text-foreground">Cookie cần thiết:</span> cookie giữ phiên đăng nhập và cookie nhận diện cuộc trò chuyện với
              chatbot. Chúng tôi không dùng cookie quảng cáo.
            </li>
          </ul>
        </Section>

        <Section title="2. Chúng tôi dùng thông tin để làm gì">
          <p>
            Để xử lý hồ sơ du học của bạn: gửi báo giá, tư vấn, kiểm tra giấy tờ, đối chiếu điểm chuẩn và gợi ý học bổng, liên hệ với bạn qua email về yêu cầu
            của bạn. Chúng tôi không bán dữ liệu của bạn và không dùng vào mục đích quảng cáo của bên thứ ba.
          </p>
        </Section>

        <Section title="3. Dữ liệu được lưu ở đâu">
          <p>
            Dữ liệu được lưu trong cơ sở dữ liệu <span className="font-medium text-foreground">Supabase</span> (máy chủ đặt tại Tokyo, Nhật Bản). Chỉ nhân
            viên DuHoc24 được cấp quyền mới xem được dữ liệu quản trị; học viên chỉ xem được hồ sơ của chính mình.
          </p>
          <p>Để vận hành dịch vụ, một số thông tin được chuyển qua các bên xử lý sau:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Vercel: chạy website.</li>
            <li>Google: xác thực khi bạn chọn đăng nhập bằng Google.</li>
            <li>Google Gemini: đọc giấy tờ bạn tải lên và trả lời trong chatbot (nội dung liên quan được gửi tới Google để xử lý).</li>
            <li>Make.com và dịch vụ gửi email: gửi email báo giá và email mời đăng nhập (gồm họ tên, email, gói dịch vụ).</li>
          </ul>
        </Section>

        <Section title="4. Xoá dữ liệu và quyền của bạn">
          <p>
            Bạn có thể yêu cầu xem hoặc xoá dữ liệu của mình bất cứ lúc nào bằng cách gửi email tới{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary underline-offset-4 hover:underline">
              {CONTACT_EMAIL}
            </a>{" "}
            từ địa chỉ email bạn đã dùng, nêu rõ yêu cầu. Chúng tôi sẽ xoá tài khoản, hồ sơ, giấy tờ đã trích xuất, yêu cầu báo giá và nội dung trò chuyện
            liên quan đến bạn, rồi báo lại cho bạn.
          </p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
