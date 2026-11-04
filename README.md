# gentle vie — The Art of Living Well

Next.js App Router, React ve TypeScript ile hazırlanmış editoryal portföy projesi. Mobil yerleşimler, kaydırmaya bağlı sahneler, erişilebilir menü, hareket tercihi, ayrı makale sayfaları ve paylaşım görseli içerir. MongoDB; üyelik, bülten aboneliği, yönetici yazıları ve duyuru kuyruğunu saklar.

Üyelik ve bülten birbirinden bağımsızdır; üye olmak bültene otomatik kayıt oluşturmaz. Veritabanı ve SMTP yapılandırılmadan gerçek üyelik, abonelik ve e-posta akışları çalışmaz. Ana sayfa ile üç örnek makale görüntülenebilir.

## Yerelde çalıştırma

Node.js **24.x** ve npm kullanılır:

```sh
npm ci
npm run dev
```

[http://localhost:3000](http://localhost:3000) adresini aç. `npm run dev` bu proje için doğru geliştirme komutudur. Yeni bağımlılık eklemek veya kilit dosyasını bilinçli güncellemek için `npm install` kullanılır. Üretimde Vercel derlemesi ya da `npm run build` ardından `npm start` kullanılır.

`.env.example` dosyasını `.env.local` adıyla kopyalayıp kendi değerlerini doldur; mevcut `.env.local` dosyanın üzerine yazma. Değerler değiştiğinde sunucuyu yeniden başlat. Tarayıcı adresi ile `SITE_URL` aynı kökeni kullanmalıdır.

| Komut | İşlev |
| --- | --- |
| `npm run dev` | Geliştirme sunucusunu 3000 portunda başlatır |
| `npm run typecheck` | Next.js rota tiplerini ve TypeScript kodunu denetler |
| `npm test` | Doğrulama, yetki, bülten ve içerik şeması testlerini çalıştırır |
| `npm run build` | Yayın derlemesini oluşturur |
| `npm start` | Önceden oluşturulmuş derlemeyi çalıştırır |
| `npm run check` | Tip kontrolü, testler ve derlemeyi sırayla çalıştırır |
| `npm run check:deploy` | Üretim ortamı değerlerinin varlığını ve biçimini denetler |
| `npm run deploy:preview` | Vercel CLI ile önizleme oluşturur |
| `npm run deploy` | Vercel CLI ile üretime yayınlar |

`check:deploy`, `.env.local` varsa okur ve yalnızca değişken adlarıyla durumlarını gösterir. Veritabanı veya SMTP bağlantısı kurmaz; e-posta göndermez. Üretim için HTTPS beklediğinden `http://localhost:3000` bu kontrolden geçmez.

GitHub'a taşındığında `.github/workflows/check.yml`, push ve pull request işlemlerinde Node.js 24 ile aynı tip kontrolünü, testleri ve derlemeyi çalıştırır. Gerçek veritabanı veya e-posta sırları bu kontroller için gerekmez.

## Ortam değişkenleri

| Değişken | Kullanım |
| --- | --- |
| `SITE_URL` | Üretimde gerçek HTTPS kök adresi; canonical bağlantılar, e-posta bağlantıları ve origin kontrolleri. Alt yol, sorgu veya fragment içermez. Yerelde `http://localhost:3000` kullanılır. |
| `MONGODB_URI` | Sunucuya özel MongoDB Atlas bağlantı dizesi |
| `MONGODB_DB` | Veritabanı adı; varsayılan `gentlevie` |
| `RATE_LIMIT_SECRET` | En az 32 karakterlik rastgele gizli değer; bülten sınırlandırması ve ayrılma imzaları |
| `BETTER_AUTH_SECRET` | En az 32 karakterlik ayrı bir rastgele gizli değer; üyelik oturumları |
| `SITE_OWNER_NAME` | `/gizlilik` sayfasında görünen sorumlu adı; `gentle vie` |
| `PRIVACY_CONTACT_EMAIL` | Herkese açık gizlilik ve silme talebi adresi; `gentlevie@gmail.com` |
| `ADMIN_EMAIL` | E-postası doğrulanmış hesabı yönetime kabul edilen adres; `gentlevie@gmail.com` |
| `SMTP_HOST` | E-posta sunucusu; örnekte `smtp.gmail.com` |
| `SMTP_PORT` | TLS için `465` veya STARTTLS için `587` |
| `SMTP_USER` | SMTP kullanıcı adı |
| `SMTP_PASS` | SMTP hizmet şifresi; Gmail kullanılıyorsa uygulama şifresi |
| `SMTP_FROM` | Gönderen adı ve adresi; örnekte `gentle vie <gentlevie@gmail.com>` |

Gizli değerleri `.env.local` veya sağlayıcının ortam değişkeni alanında sakla. `.env.local` Git’e eklenmez. Bağlantı dizelerini ve anahtarları istemci koduna, ekran görüntülerine veya README’ye koyma; bunlarda `NEXT_PUBLIC_` öneki kullanma. `.env.example` yalnızca örnek alanları içerir.

Gmail ile SMTP kullanmak için hesabında iki adımlı doğrulamayı açıp uygulamaya özel bir uygulama şifresi oluştur. Normal Google hesabı şifresini kullanma. Bazı hesaplarda bu seçenek kullanılamaz; ayrı bir SMTP hizmeti yapılandırılabilir. [Google uygulama şifresi belgesi](https://support.google.com/accounts/answer/185833?hl=EN)

1. [Google hesabının güvenlik sayfasında](https://myaccount.google.com/security) **2 Adımlı Doğrulama** durumunu kontrol et; kapalıysa hesabındaki yönergelerle etkinleştir.
2. [Uygulama şifreleri](https://myaccount.google.com/apppasswords) sayfasında uygulama adı olarak **GentleVie** yazıp şifreyi oluştur.
3. Oluşan şifreyi boşluksuz şekilde yerel `.env.local` dosyasındaki `SMTP_PASS=` alanına ekle. Sohbete veya ekran görüntüsüne koyma.
4. Canlı yayın için aynı değeri Vercel projesinin **Production** ortam değişkenlerine ekle. Yerel sunucuyu yeniden başlat; Vercel ayarını değiştirdiğinde yeniden yayın oluştur.

## MongoDB Atlas

Atlas'ın **Free** kümesi küçük geliştirme ve kavram kanıtlama projelerinde kullanılabilir; kaynak ve özellik sınırları vardır. [MongoDB Atlas Free küme belgeleri](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)

1. Kendi Atlas projen içinde bir küme oluştur.
2. Yalnızca uygulama veritabanında `readWrite` yetkisi olan ayrı bir veritabanı kullanıcısı oluştur.
3. IP erişim listesini geliştirme adresin ve yayın ortamının ihtiyaç duyduğu erişimle sınırla. Vercel'in kullanılabilir ağ seçeneklerine göre erişimi yapılandır.
4. Node.js bağlantı dizesini `MONGODB_URI`, veritabanı adını `MONGODB_DB` olarak kaydet.

İndeksler ilgili hizmet ilk kullanıldığında oluşturulur. `subscribers` benzersiz e-postaları; `user`, `session`, `account`, `verification` üyelik verilerini; `posts` taslak ve yayınları; `newsletter_deliveries` duyuru durumlarını saklar. İstek sınırlandırma ve süreli oturum kayıtları için TTL indeksleri kullanılır. Better Auth MongoDB işlemlerinde Atlas'ın transaction desteği kullanılır.

Gerçek Atlas bağlantısı, kullanıcı yetkileri ve indeks oluşturma işlemi canlı ortamda ayrıca doğrulanmalıdır. Bellek içi birim testleri bu entegrasyon kontrolünün yerine geçmez.

## Üyelik ve yönetim

- `/uyelik`: e-posta/şifreyle kayıt, giriş, doğrulama e-postasını yeniden isteme ve şifre yenileme isteği.
- `/sifre-yenile`: e-postayla gelen bağlantı üzerinden yeni şifre belirleme.
- `/hesabim`: oturum bilgileri ve çıkış.
- `/yonetim`: yalnızca `ADMIN_EMAIL` ile eşleşen, e-postası doğrulanmış hesap için içerik ve duyuru yönetimi.

İlk yönetici hesabını normal üyelik formundan oluşturup e-postasını doğrula. Aynı adresi doğrulamadan kaydetmek yönetim yetkisi sağlamaz. Üyelik şifreleri 12–128 karakter aralığındadır; gizlilik kabulü sunucuda da zorunludur. Oturumlar HTTP-only çerezlerle yönetilir. Doğrulama bağlantısı bir saat, şifre yenileme bağlantısı 30 dakika geçerlidir. Kimlik doğrulama istekleri MongoDB üzerinde sınırlandırılır.

Yönetimde başlık, alt başlık, benzersiz ASCII adres, kategori, üç mevcut görselden biri ve düz metin paragraflar girilir. HTML çalıştırılmaz. Yeni yazı varsayılan olarak taslaktır; ayrı bir işlemle yayınlanabilir. İlk üç örnek yazının adresleri korunur. Bu sürüm yeni yazı oluşturma ve yayınlamayı destekler; mevcut yazıyı düzenleme, silme veya dosya yükleme arayüzü içermez.

`GET /api/admin/posts` özel listeyi, `POST` yeni taslak/yayını, `PATCH` taslağı yayınlamayı sağlar. API; doğrulanmış yönetici oturumu, yazma işlemlerinde aynı origin, JSON gövdesi ve 64 KB sınırı uygular. Ziyaretçiler yalnızca yayınlanmış yazıları `/journal/[slug]` üzerinden okuyabilir. MongoDB erişilemezse üç yerel örnek makale erişilebilir kalır.

## Bülten ve duyurular

`POST /api/subscriptions`, aynı kökenden gelen `application/json` isteğini kabul eder:

```json
{
  "email": "reader@example.com",
  "consent": true,
  "name": "Okur",
  "website": ""
}
```

`email` ve `consent: true` zorunludur; `name` isteğe bağlı, `website` boş bırakılan bot alanıdır. En fazla 4 KB gövde kabul edilir; beklenmeyen alanlar reddedilir. 10 dakikalık pencerede en fazla beş istek kabul edilir. Vercel'in güvenilir IP başlığından HMAC anahtarı türetilir; bülten kayıtlarına ham IP yazılmaz. `429` yanıtı `Retry-After` başlığı içerir. Depolama başarısızsa başarı yanıtı verilmez.

Abone önce doğrulanmamış olarak kaydedilir. SMTP üzerinden 24 saat geçerli onay bağlantısı gönderilir; okur `/bulten/onay` sayfasındaki butonla onaylar. E-posta bağlantısını yalnızca açmak kayıt durumunu değiştirmez. Duyurular yalnızca onaylı ve ayrılmamış abonelere gider. İmzalı ayrılma bağlantısı `/bulten/ayril` sayfasında ayrıca onaylanır. Üyelik doğrulaması, bülten onayının yerine geçmez.

Yazıyı yayınlarken **Bülten abonelerine duyur** varsayılan olarak kapalıdır. Seçildiğinde alıcı başına kayıt `newsletter_deliveries` kuyruğuna eklenir; yayınlama isteği toplu e-posta göndermez. Sonradan yazı listesindeki **Duyuruyu sıraya al** da kullanılabilir. Aynı yazı/abone çiftini yeniden kuyruğa almak ikinci kayıt oluşturmaz.

**Duyuruları gönder**, yönetim sayfası açıkken kuyruğu istek başına bir e-posta göndererek işler. Sayfa, sıradaki istekleri gönderim tamamlanana kadar başlatır. Bu sürümde cron veya sürekli arka plan göndericisi yoktur. Başarısız teslimler en fazla üç kez denenir. SMTP sağlayıcısının kabul yanıtı ağda kaybolursa yeniden denemede aynı e-posta tekrarlanabilir; kesin tek teslim garantisi verilmez. Gönderimden önce abonelik durumu yeniden kontrol edilir.

## Vercel ile yayınlama

Vercel **Hobby**, kişisel ve ticari olmayan projeler için ücretsizdir; kullanım sınırları geçerlidir. Vercel, Atlas ve SMTP hizmetlerinin toplam kullanımı için sınırsız ücretsiz çalışma garantisi yoktur. [Vercel Hobby belgeleri](https://vercel.com/docs/plans/hobby)

1. Kendi hesabında oturum açıp projeyi bağla:

   ```sh
   npx vercel@latest login
   npx vercel@latest link
   ```

2. Vercel ayarlarında framework **Next.js**, Node.js **24.x**, kök klasör bu proje olmalıdır. Statik çıktı klasörü seçme; API ve oturum işlemleri sunucuda çalışır.
3. Production ortamına yukarıdaki değişkenleri ekle. `SITE_URL`, Vercel'in verdiği gerçek üretim alan adı veya bağladığın özel alan adı olmalıdır. Preview testi için ayrı veritabanı ve o önizlemenin gerçek kökenini kullan; origin kontrolünü gevşetme.
4. `npm run check` ile kodu, `npm run check:deploy` ile yüklediğin değerlerin biçimini denetle. İkinci komut Vercel panelindeki kayıtları veya hizmet bağlantılarını doğrulamaz.
5. Önizleme oluştur:

   ```sh
   npm run deploy:preview
   ```

6. Atlas ve SMTP bağlantılarını kendi test hesabınla doğruladıktan sonra üretime yayınla:

   ```sh
   npm run deploy
   ```

CLI'nin döndürdüğü gerçek adresi kullan. Ortam değişkenleri değiştiğinde yeniden yayın oluştur. Production ve Preview değerleri ayrı yönetilir; projeyi daha sonra bir Git deposuna bağlayabilirsin.

Yayın kontrolünde ana sayfa, makaleler, `/gizlilik`, `/sitemap.xml`, `/robots.txt` ve `/opengraph-image` adreslerini aç. Kendi hesabınla kayıt/doğrulama/giriş/şifre yenileme; ayrı bülten onayı ve ayrılma; bir taslağın yayınlanması ve test abonesine duyuru gönderimi akışlarını doğrula. Bu adımlar tamamlanmadan e-posta teslimi veya canlı veritabanı bağlantısı doğrulanmış sayılmaz.

LinkedIn ve portföyde gerçek canlı adresi ve ekran görüntülerini paylaş. Proje kapsamını “Next.js, TypeScript, MongoDB, doğrulanmış üyelik, bülten ve içerik yönetimi içeren editoryal web uygulaması” olarak açıklayabilirsin.

## Kaynak yapısı

| Yol | Sorumluluk |
| --- | --- |
| `app/` | Sayfalar, metadata, üyelik ve yönetim API rotaları |
| `components/` | Menü, sahneler, formlar, editör, SVG oklar ve paylaşım |
| `lib/articles.ts` | Üç yerel örnek makale ve kalıcı adresleri |
| `lib/posts.ts`, `lib/post-schema.ts` | MongoDB içerik erişimi ve doğrulama |
| `lib/auth.ts`, `lib/auth-config.ts` | Better Auth, yönetici kontrolü ve yapılandırma |
| `lib/subscriptions.ts`, `lib/subscription-schema.ts` | Abonelik istekleri ve doğrulama |
| `lib/newsletter.ts`, `lib/newsletter-tokens.ts` | Çift onay, ayrılma ve duyuru kuyruğu |
| `lib/email.ts`, `lib/mongodb.ts` | Sunucuya özel SMTP ve veritabanı erişimi |
| `public/assets/` | Yerel WebP görseller, SVG ve yazı tipleri |
| `tests/` | Şema, yetki ve istek davranışı testleri |
| `scripts/check-deploy.ts` | Gizli değerleri göstermeyen yapılandırma denetimi |
| `legacy/` | İlk HTML/CSS/JS sürümü; mevcut uygulamanın ve yayın paketinin dışında |

İlk üç makale editoryal örnek içeriktir; görseller üretilmiş konsept görselleridir. `public/assets/font-license.txt` lisans dosyasını koru. Gerçek bağlantı bilgileri ve yayın adresi depoya dahil değildir.
