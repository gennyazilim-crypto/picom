import { useEffect, useState } from "react";
import { AppIcon } from "../AppIcon";
import { publisherProgramService } from "../../services/publisher/publisherProgramService";
import type {
  PublisherApplicationEligibility,
  PublisherApplicationSummary,
  PublisherApplicationType,
} from "../../services/publisher/publisherProgramTypes";
import "./publisherProgram.css";

type Props = Readonly<{
  onClose: () => void;
  onOpenDashboard?: () => void;
}>;

function eligibilityMessage(eligibility: PublisherApplicationEligibility): string {
  const paths = eligibility.eligibilityPaths ?? [];
  if (!eligibility.eligible) {
    return "Henüz başvuru koşullarını karşılamıyorsunuz. Aşağıdaki yollardan birini tamamladığınızda form açılır.";
  }
  if (paths.includes("follower_threshold") && paths.includes("community_founder_threshold")) {
    return "Her iki başvuru kriterini de karşılıyorsunuz. Başvurunuzu gönderebilirsiniz.";
  }
  if (paths.includes("follower_threshold")) {
    return "Takipçi kriterini karşıladınız. Creator / Publisher başvurusu yapabilirsiniz.";
  }
  if (paths.includes("community_founder_threshold")) {
    return "Topluluk kurucusu kriterini karşıladınız. Creator / Publisher başvurusu yapabilirsiniz.";
  }
  return "Başvuru koşulları karşılandı.";
}

function formatCount(value: number): string {
  return value.toLocaleString("tr-TR");
}

function closerPathLabel(followerRemaining: number, communityRemaining: number): string {
  if (followerRemaining === communityRemaining) {
    return "İki yol da benzer uzaklıkta; hangisi size uygunsa onu büyütün.";
  }
  if (followerRemaining < communityRemaining) {
    return "Şu an takipçi yolu sayısal olarak daha yakın.";
  }
  return "Şu an sahip olduğunuz en büyük topluluk yolu daha yakın.";
}

function CriterionTrack({
  label,
  current,
  required,
  detail,
  met,
}: Readonly<{
  label: string;
  current: number;
  required: number;
  detail: string;
  met: boolean;
}>) {
  const ratio = required > 0 ? Math.min(1, current / required) : 0;
  const percent = Math.round(ratio * 100);
  const remaining = Math.max(0, required - current);

  return (
    <article className={`publisher-track${met ? " is-met" : ""}`} aria-label={label}>
      <div className="publisher-track__top">
        <div>
          <p className="publisher-track__label">{label}</p>
          <p className="publisher-track__detail">{detail}</p>
        </div>
        <span className={`publisher-track__badge${met ? " is-met" : ""}`}>
          {met ? "Karşılandı" : `${percent}%`}
        </span>
      </div>
      <div
        className="publisher-track__meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={Math.min(current, required)}
        aria-label={`${label} ilerlemesi`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="publisher-track__footer">
        <strong>
          {formatCount(current)} / {formatCount(required)}
        </strong>
        <span>{met ? "Bu yol açık" : `Kalan ${formatCount(remaining)}`}</span>
      </div>
    </article>
  );
}

export function PublisherApplicationWorkspace({ onClose, onOpenDashboard }: Props) {
  const [eligibility, setEligibility] = useState<PublisherApplicationEligibility | null>(null);
  const [applications, setApplications] = useState<PublisherApplicationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applicationType, setApplicationType] = useState<PublisherApplicationType>("creator");
  const [displayName, setDisplayName] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [canBroadcast, setCanBroadcast] = useState(false);

  async function refresh() {
    setError(null);
    const [elig, apps, state] = await Promise.all([
      publisherProgramService.getEligibility(),
      publisherProgramService.listOwnApplications(),
      publisherProgramService.getProgramState(),
    ]);
    if (!elig.ok) {
      setError(elig.error);
      return;
    }
    setEligibility(elig.data);
    if (apps.ok) setApplications(apps.data);
    if (state.ok) setCanBroadcast(state.data.canBroadcast);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSubmit() {
    if (!eligibility?.eligible) return;
    setBusy(true);
    setError(null);
    const result = await publisherProgramService.submitApplication({
      applicationType,
      displayPublisherName: displayName,
      shortBio,
      companyName: applicationType === "publisher" ? companyName : null,
      categories: ["general"],
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  const followerCount = eligibility?.activeFollowerCount ?? 0;
  const memberCount = eligibility?.largestOwnedCommunityActiveMemberCount ?? 0;
  const followerRequired = eligibility?.requiredFollowerCount ?? 5000;
  const communityRequired = eligibility?.requiredCommunityMemberCount ?? 3000;
  const paths = eligibility?.eligibilityPaths ?? [];
  const followerMet = paths.includes("follower_threshold") || followerCount >= followerRequired;
  const communityMet = paths.includes("community_founder_threshold") || memberCount >= communityRequired;
  const followerRemaining = Math.max(0, followerRequired - followerCount);
  const communityRemaining = Math.max(0, communityRequired - memberCount);

  return (
    <section className="publisher-program-shell publisher-program-shell--application" aria-label="Creator Publisher application">
      <header className="publisher-program-header">
        <div className="publisher-program-header__copy">
          <div className="publisher-eyebrow-row">
            <p className="publisher-eyebrow">Publisher Program</p>
            {eligibility ? (
              <span className={`publisher-status-chip${eligibility.eligible ? " is-ready" : ""}`}>
                {eligibility.eligible ? "Başvuruya hazır" : "Eşik altı"}
              </span>
            ) : null}
          </div>
          <h1>Creator / Publisher başvurusu</h1>
          <p className="publisher-program-header__lede">
            Picom Live Now’da kamuya açık yayın yapmak için Creator veya Publisher onayı gerekir. Uygunluk sunucu
            tarafında hesaplanır; bu ekrandaki sayaçlar bilgilendirme içindir, yetki kaynağı değildir.
          </p>
        </div>
        <div className="publisher-header-actions">
          <button type="button" className="publisher-ghost" onClick={() => void refresh()} aria-label="Uygunluğu yenile">
            <AppIcon name="refresh" size="sm" />
            Yenile
          </button>
          {canBroadcast && onOpenDashboard ? (
            <button type="button" className="publisher-primary" onClick={onOpenDashboard}>
              Dashboard
            </button>
          ) : null}
          <button type="button" className="publisher-ghost" onClick={onClose}>
            Kapat
          </button>
        </div>
      </header>

      {error ? (
        <p className="publisher-error" role="alert">
          {error}
        </p>
      ) : null}

      {!eligibility ? (
        <div className="publisher-panel publisher-panel--loading" aria-live="polite">
          <span className="publisher-loading-dot" aria-hidden="true" />
          Uygunluk kontrol ediliyor…
        </div>
      ) : (
        <div className="publisher-program-layout">
          <div className="publisher-program-main">
            <section className="publisher-panel publisher-snapshot" aria-labelledby="publisher-snapshot-title">
              <div className="publisher-snapshot__head">
                <div>
                  <h2 id="publisher-snapshot-title">Canlı uygunluk özeti</h2>
                  <p>{eligibilityMessage(eligibility)}</p>
                </div>
                <time dateTime={eligibility.evaluatedAt} className="publisher-eligibility__time">
                  Son kontrol · {new Date(eligibility.evaluatedAt).toLocaleString("tr-TR")}
                </time>
              </div>
              <dl className="publisher-snapshot__grid">
                <div>
                  <dt>Aktif takipçi</dt>
                  <dd>
                    {formatCount(followerCount)}
                    <span> / {formatCount(followerRequired)}</span>
                  </dd>
                </div>
                <div>
                  <dt>En büyük sahip olunan topluluk</dt>
                  <dd>
                    {formatCount(memberCount)}
                    <span> / {formatCount(communityRequired)}</span>
                  </dd>
                </div>
                <div>
                  <dt>Sayılan topluluk</dt>
                  <dd className="publisher-snapshot__text">
                    {eligibility.largestOwnedCommunityName?.trim() || "Henüz sayılacak bir topluluk yok"}
                  </dd>
                </div>
                <div>
                  <dt>Hesap / yayın engeli</dt>
                  <dd className="publisher-snapshot__text">
                    {eligibility.hasActiveLiveBan
                      ? "Aktif live ban — başvuru veya yayın engellenir"
                      : eligibility.accountActive === false
                        ? "Hesap aktif değil"
                        : "Hesap uygun görünüyor"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="publisher-panel publisher-eligibility" aria-labelledby="publisher-eligibility-title">
              <div className="publisher-eligibility__intro">
                <div>
                  <h2 id="publisher-eligibility-title">Başvuru yolları</h2>
                  <p>
                    Tek yol yeterli. Üye sayıları farklı topluluklar arasında birleştirilmez; yalnızca{" "}
                    <strong>owner</strong> olduğunuz en büyük aktif topluluk sayılır.
                  </p>
                </div>
              </div>

              <div className="publisher-tracks" role="list">
                <CriterionTrack
                  label="Takipçi yolu"
                  current={followerCount}
                  required={followerRequired}
                  detail="Aktif Picom takipçi eşiği · sunucu sayımı"
                  met={followerMet}
                />
                <div className="publisher-tracks__or" aria-hidden="true">
                  <span>VEYA</span>
                </div>
                <CriterionTrack
                  label="Topluluk kurucusu yolu"
                  current={memberCount}
                  required={communityRequired}
                  detail={
                    eligibility.largestOwnedCommunityName
                      ? `${eligibility.largestOwnedCommunityName} · aktif üye (owner)`
                      : "En büyük sahip olunan topluluk · aktif üye (owner)"
                  }
                  met={communityMet}
                />
              </div>
            </section>

            {applications.length > 0 ? (
              <section className="publisher-panel" aria-labelledby="publisher-apps-title">
                <h2 id="publisher-apps-title">Başvurularınız</h2>
                <ul className="publisher-app-list">
                  {applications.map((app) => (
                    <li key={app.id}>
                      <div>
                        <strong>{app.displayPublisherName}</strong>
                        <span>
                          {app.applicationType} · {app.status}
                          {app.submittedAt
                            ? ` · ${new Date(app.submittedAt).toLocaleDateString("tr-TR")}`
                            : ""}
                        </span>
                      </div>
                      <AppIcon name="chevronRight" size="sm" />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {eligibility.eligible ? (
              <form
                className="publisher-panel publisher-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onSubmit();
                }}
              >
                <div className="publisher-form__intro">
                  <h2>Başvuru formu</h2>
                  <p>Onay sonrası Live Now yayın kimliğiniz bu bilgilerle eşlenir. İnceleme ekibi gönderdiğiniz metni görür.</p>
                </div>
                <label>
                  Başvuru türü
                  <select
                    value={applicationType}
                    onChange={(event) => setApplicationType(event.target.value as PublisherApplicationType)}
                  >
                    <option value="creator">Creator (bireysel)</option>
                    <option value="publisher">Publisher (kurumsal)</option>
                  </select>
                </label>
                <label>
                  Yayıncı adı
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Görünen yayın adı"
                  />
                </label>
                <label>
                  Kısa tanıtım
                  <textarea
                    value={shortBio}
                    onChange={(event) => setShortBio(event.target.value)}
                    required
                    minLength={20}
                    maxLength={2000}
                    rows={5}
                    placeholder="İzleyicilere kim olduğunuzu ve ne yayınladığınızı kısaca anlatın"
                  />
                </label>
                {applicationType === "publisher" ? (
                  <label>
                    Şirket / kurum adı
                    <input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={160}
                    />
                  </label>
                ) : null}
                <button type="submit" className="publisher-primary publisher-form__submit" disabled={busy}>
                  {busy ? "Gönderiliyor…" : "Başvuruyu gönder"}
                </button>
              </form>
            ) : (
              <section className="publisher-panel publisher-next" aria-labelledby="publisher-next-title">
                <h2 id="publisher-next-title">Nasıl ilerlersiniz</h2>
                <p>{closerPathLabel(followerRemaining, communityRemaining)}</p>
                <div className="publisher-next__grid">
                  <article>
                    <h3>Takipçi yolunu büyütmek</h3>
                    <p>
                      Aktif takipçi eşiğine {formatCount(followerRemaining)} kişi kaldı. Pasif veya silinmiş hesaplar
                      sayılmaz; sunucu aktif profil kurallarını uygular.
                    </p>
                  </article>
                  <article>
                    <h3>Topluluk yolunu büyütmek</h3>
                    <p>
                      {eligibility.largestOwnedCommunityName
                        ? `“${eligibility.largestOwnedCommunityName}” için `
                        : "Sahip olduğunuz en büyük topluluk için "}
                      {formatCount(communityRemaining)} aktif üye daha gerekir. Kurucu olsanız bile üyelik satırı ve
                      aktif profil şarttır; topluluklar arası birleştirme yoktur.
                    </p>
                  </article>
                </div>
              </section>
            )}
          </div>

          <aside className="publisher-program-aside" aria-label="Program özeti">
            <section className="publisher-aside-card">
              <p className="publisher-aside-kicker">Onay sonrası</p>
              <h2>Ne açılır?</h2>
              <ul className="publisher-aside-list">
                <li>Creator / Publisher rozeti ve yayıncı profili</li>
                <li>Picom Live Now’da kamuya açık keşif görünürlüğü</li>
                <li>Yayın başlatma kapısı (aktif rozet + onaylı başvuru)</li>
                <li>İnceleme ve güvenlik kurallarına bağlı yayın sürdürme</li>
              </ul>
            </section>

            <section className="publisher-aside-card">
              <p className="publisher-aside-kicker">Süreç</p>
              <h2>Başvuru akışı</h2>
              <ol className="publisher-aside-steps">
                <li>
                  Eşiklerden <strong>birini</strong> tamamlayın
                </li>
                <li>Başvuru formunu gönderin</li>
                <li>İnceleme: uygunluk riski ve içerik politikası kontrolü</li>
                <li>Onay → rozet; red / ek bilgi istenirse burada görünür</li>
              </ol>
            </section>

            <section className="publisher-aside-card publisher-aside-card--muted">
              <p className="publisher-aside-kicker">Sayım kuralları</p>
              <h2>Ne sayılır?</h2>
              <ul className="publisher-aside-list">
                <li>
                  Takipçi: <strong>{formatCount(followerRequired)}</strong> aktif takipçi
                </li>
                <li>
                  Topluluk: sahip olduğunuz bir toplulukta <strong>{formatCount(communityRequired)}</strong> aktif üye
                </li>
                <li>Owner kaynağı: communities.owner_id</li>
                <li>Üye birleştirme yok · progress bar yetki değildir</li>
              </ul>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
