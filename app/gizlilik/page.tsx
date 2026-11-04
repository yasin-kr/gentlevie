import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik", description: "GentleVie üyeliği, bülten aboneliği ve kişisel veriler hakkında bilgilendirme",
  alternates: { canonical: "/gizlilik" },
};

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const owner = process.env.SITE_OWNER_NAME?.trim() || "gentle vie";
  const contact = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "gentlevie@gmail.com";
  return <main className="privacy-page">
    <header className="reading-header section-shell">
      <Link href="/" className="wordmark">gentle vie</Link>
      <Link href="/#katil" className="reading-back">Siteye dön</Link>
    </header>
    <article className="privacy-copy">
      <p className="eyebrow">GİZLİLİK / 4 KASIM 2026</p>
      <h1>Bilgilerine<br /><em>özen gösteriyoruz</em></h1>
      <p>Bu sayfa, GentleVie üyeliği ve bülten aboneliği sırasında verdiğin bilgilerin kullanımını açıklar. Üyelik ve bülten birbirinden bağımsızdır; üye olmak bültene otomatik kayıt oluşturmaz.</p>
      <h2>İletişim</h2>
      <p>Bu sitenin ve kayıtların sorumlusu {owner}. Bilgilerinle ilgili soruların, düzeltme veya silme talebin için <a href={`mailto:${contact}`}>{contact}</a> adresine yazabilirsin.</p>
      <h2>Üyelik bilgileri</h2>
      <p>Üye olurken adın, e-posta adresin, gizlilik kabulün ve kayıt zamanı saklanır. Şifren açık metin olarak değil, doğrulamada kullanılan tek yönlü bir özet olarak tutulur. Hesabın, e-posta adresini doğruladıktan sonra kullanılabilir. Doğrulama ve şifre yenileme e-postaları hesap işlemlerini tamamlamak için gönderilir.</p>
      <p>Oturum bilgileri ve süresi ile, sunucuya ulaşan güvenilir bağlantı bilgisi mevcutsa IP adresi ve tarayıcı bilgisi, hesap güvenliği için işlenebilir. Süresi dolan oturum ve doğrulama kayıtları otomatik temizlenir.</p>
      <h2>Bülten tercihin</h2>
      <p>Bülten için e-posta adresin, isteğe bağlı adın, onayın ve kayıt zamanı tutulur. İzin kutusu başlangıçta boştur. Yeni yazı duyuruları ancak e-postayla gönderilen bağlantıdaki onayı tamamladıktan sonra gönderilir. Her duyurudaki ayrılma bağlantısıyla bülteni durdurabilirsin.</p>
      <p>Duyuruların gönderim durumu ve deneme sayısı, gönderimi yönetmek için saklanır. Ayrılınca yeni duyurular gönderilmez; kayıtlarının tamamen silinmesini iletişim adresimizden isteyebilirsin.</p>
      <h2>Güvenlik ve saklama</h2>
      <p>Kötüye kullanımı sınırlamak için isteklerden türetilen güvenlik değerleri kısa süreli tutulur. Bülten istek sınırı kayıtlarında ham IP adresi yerine gizli anahtarla üretilen bir özet kullanılır. Üye ve abonelik bilgileri, ilgili hesap veya abonelik sürdüğü müddetçe tutulur.</p>
      <h2>Saklama ve hizmet sağlayıcıları</h2>
      <p>Canlı hizmetin altyapısı Vercel ve MongoDB Atlas olarak hazırlanmıştır. E-postalar yapılandırılan e-posta hizmeti üzerinden gönderilir; gentle vie adresi için Gmail kullanılır. Bu sağlayıcılar hizmetin çalışması için bağlantı, depolama ve gönderim verilerini işleyebilir. Seçilen hizmet bölgelerine bağlı olarak veriler Türkiye dışında işlenebilir.</p>
      <h2>Tarayıcı tercihleri</h2>
      <p>Giriş yaptığında oturumunu sürdürmek için gerekli çerezler kullanılır. Hareketi azaltma tercihin tarayıcının yerel depolamasında tutulur. Reklam veya analiz çerezi kullanılmaz.</p>
      <Link href="/" className="understated-link">GentleVie&apos;ye dön</Link>
    </article>
  </main>;
}
