/* eslint-disable react/no-unescaped-entities -- long-form prose with natural apostrophes/quotes; escaping each one buys nothing and harms readability */
import type { Metadata } from 'next';
import { BackLink } from './back-link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === 'fr';
  const title = isFr ? 'Confidentialité' : 'Privacy';
  const description = isFr
    ? 'Cargo est un coursier, pas un témoin. Aucun journal d’audit, aucune activité, aucun historique.'
    : 'Cargo is a courier, not a witness. No audit log, no activity feed, no history.';
  return {
    title,
    description,
    openGraph: { title: `${title} — Cargo`, description },
    twitter: { card: 'summary_large_image', title: `${title} — Cargo`, description },
  };
}

// Mirrors docs/PRIVACY.md. That file is the canonical contract; if the two
// diverge, the doc wins and this page is wrong. The FR variant is a courtesy
// translation — when in doubt, the EN text governs.
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<JSX.Element> {
  const { locale } = await params;
  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6">
          <BackLink />
        </div>
        {locale === 'fr' ? <PrivacyFr /> : <PrivacyEn />}
      </div>
    </main>
  );
}

function PrivacyEn(): JSX.Element {
  return (
    <article className="space-y-6 text-[14px] leading-relaxed text-ink">
      <header className="space-y-2">
        <h1 className="text-[24px] font-semibold leading-tight">Privacy</h1>
        <p className="text-muted italic">Cargo is a courier, not a witness.</p>
      </header>

      <p className="text-muted">
        This document is the load-bearing one. The product hinges on the invariants in it being
        absolute, not aspirational. If anything below conflicts with code or with another doc,
        the code is wrong — open an issue, don't relax this document.
      </p>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">What Cargo stores</h2>
        <p>A complete enumeration. If it's not here, it's not stored.</p>

        <h3 className="text-[15px] font-semibold pt-2">users (one row per Cargo account)</h3>
        <ul className="list-disc pl-5 space-y-1 text-muted">
          <li><span className="text-ink mono">id</span> — UUID v4, primary key, never exposed in the URL</li>
          <li><span className="text-ink mono">discord_id</span> — Discord snowflake. The only third-party identifier we hold.</li>
          <li><span className="text-ink mono">username</span> — Discord username, used by the recipient picker</li>
          <li><span className="text-ink mono">global_name</span> — Discord display name (nullable)</li>
          <li><span className="text-ink mono">avatar_url</span> — Discord CDN URL (nullable)</li>
          <li><span className="text-ink mono">locale</span> — <span className="mono">'en'</span> or <span className="mono">'fr'</span></li>
          <li><span className="text-ink mono">storage_used_bytes</span> — denormalized quota counter</li>
          <li><span className="text-ink mono">created_at</span></li>
        </ul>
        <p className="text-muted">No email. No phone. No IP at the user level. No <span className="mono">last_seen_at</span>.</p>

        <h3 className="text-[15px] font-semibold pt-2">transfers (one row per <em>currently-active</em> transfer)</h3>
        <p>
          A row exists from the moment the first tus chunk lands and is <strong>deleted entirely</strong>
          when the transfer ends — completion, expiry, or revocation. There is no soft-delete column.
          Columns: sender/recipient FKs (on-delete-set-null), filename, size, blob path, the wrapped
          DEK and its IV/tag, the content IV and final auth tag, status, timestamps.
        </p>
        <p>
          There is no <span className="mono">recipient_ip</span>, no <span className="mono">sender_ip</span>,
          no <span className="mono">download_count</span>, no <span className="mono">user_agent</span>,
          no <span className="mono">first_seen_at</span>. The filename is removed with the row.
        </p>

        <h3 className="text-[15px] font-semibold pt-2">download_sessions (ephemeral, in-process)</h3>
        <p>
          A row exists <strong>only while a download is in flight</strong>, used by the in-memory abuse
          detector. IP and user-agent are HMAC-SHA256 hashed with a <strong>per-process random salt</strong>
          that rotates on every restart, so hashes are un-correlatable across boots. The row is deleted
          the instant the response body ends.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">What Cargo does <em>not</em> store</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>No audit log</strong> of who sent what to whom. The schema has no such table — a migration introducing one is rejected in code review.</li>
          <li><strong>No download log.</strong> Download sessions are in-memory only and vanish at stream end.</li>
          <li><strong>No activity feed.</strong> There is no "Activity" page or endpoint.</li>
          <li><strong>No filenames</strong> after the transfer ends.</li>
          <li><strong>No content hash.</strong> The GCM auth tag verifies integrity and goes with the transfer row.</li>
          <li><strong>No IP addresses</strong> at the user or transfer level. Only short-lived salted hashes in <span className="mono">download_sessions</span>.</li>
          <li><strong>No user agents</strong> beyond those same short-lived hashes.</li>
          <li><strong>No geolocation, device fingerprint, anything else.</strong></li>
          <li><strong>No Auth.js sessions in the DB.</strong> JWT sessions only — the session lives in a signed cookie.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Application logs</h2>
        <p>
          <span className="mono">LOG_LEVEL=warning</span> in production. The logger has a{' '}
          <span className="mono">redact()</span> step that runs before any line is emitted. The only
          fields that reach stderr are a timestamp, level, event name, and a small numeric{' '}
          <span className="mono">ctx</span> shape — counters, error codes, reason tags. No user id, no
          transfer id, no filename, no IP, no handle is ever in <span className="mono">ctx</span>.
          Uncaught throws are logged as <span className="mono">{`{ evt: "uncaught", ctx: { class: "<error_class>" } }`}</span>,
          never the message or stack.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Retention</h2>
        <p>
          The link has a fixed <strong>1-hour lifetime</strong>. Within that window the recipient can
          download the file any number of times. At expiry, no new downloads are accepted — but any
          in-flight download is allowed to finish. The instant the last session ends past expiry, the
          transfer row and its blob are hard-deleted.
        </p>
        <p>
          Safety net: a <strong>24h hard cap</strong>. If a session never ends cleanly (half-open TCP,
          etc.), the cleanup worker tears the transfer down 24h after expiry regardless. The worker
          runs every 5 minutes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Account deletion</h2>
        <p>You type your <span className="mono">@handle</span> to confirm. Server-side:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Transfers where you are the sender are deleted entirely, blobs hard-deleted. Recipients see them disappear from the inbox — no "sender deleted their account" message, because the row is gone.</li>
          <li>Transfers where you are the recipient have <span className="mono">recipient_id</span> set to <span className="mono">NULL</span>. The sender sees "(recipient deleted their account)" in the Outbox; the transfer expires on the normal schedule.</li>
          <li>Your <span className="mono">users</span> row is deleted entirely — no soft-delete, no tombstone.</li>
          <li>The Auth.js JWT cookie is cleared and the response sets <span className="mono">Clear-Site-Data</span>.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Export my data</h2>
        <p>
          <span className="mono">GET /api/account/export</span> produces a small zip containing your
          profile and your currently-active transfers. That is the entire export. Nothing else exists
          to export.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Why this stance</h2>
        <p>
          Cargo runs on a single self-hosted box. The operator is also the user (or their close peer).
          The asymmetry between "what value an audit trail adds" — near zero, no compliance regime, no
          abuse-response team — and "what risk it carries" — a single compromise leaks
          who-sent-what-to-whom across an entire community — is so lopsided that the right answer is{' '}
          <strong>not to collect it</strong>.
        </p>
        <p>This document is the contract. The code matches it. The tests assert it. The UI surfaces it. Don't relax it.</p>
      </section>
    </article>
  );
}

function PrivacyFr(): JSX.Element {
  return (
    <article className="space-y-6 text-[14px] leading-relaxed text-ink">
      <header className="space-y-2">
        <h1 className="text-[24px] font-semibold leading-tight">Confidentialité</h1>
        <p className="text-muted italic">Cargo est un coursier, pas un témoin.</p>
      </header>

      <p className="text-muted">
        Ce document est celui qui porte le produit. Cargo repose sur le fait que les invariants
        ci-dessous sont absolus, pas des intentions. Si quoi que ce soit ci-dessous entre en conflit
        avec le code ou un autre document, c'est le code qui a tort — ouvrez une issue, ne relâchez
        pas ce document.
      </p>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Ce que Cargo stocke</h2>
        <p>Énumération complète. Si ce n'est pas listé ici, ce n'est pas stocké.</p>

        <h3 className="text-[15px] font-semibold pt-2">users (une ligne par compte Cargo)</h3>
        <ul className="list-disc pl-5 space-y-1 text-muted">
          <li><span className="text-ink mono">id</span> — UUID v4, clé primaire, jamais exposée dans l'URL</li>
          <li><span className="text-ink mono">discord_id</span> — snowflake Discord. Le seul identifiant tiers que nous conservons.</li>
          <li><span className="text-ink mono">username</span> — identifiant Discord, utilisé par le sélecteur de destinataire</li>
          <li><span className="text-ink mono">global_name</span> — nom d'affichage Discord (nullable)</li>
          <li><span className="text-ink mono">avatar_url</span> — URL du CDN Discord (nullable)</li>
          <li><span className="text-ink mono">locale</span> — <span className="mono">'en'</span> ou <span className="mono">'fr'</span></li>
          <li><span className="text-ink mono">storage_used_bytes</span> — compteur de quota dénormalisé</li>
          <li><span className="text-ink mono">created_at</span></li>
        </ul>
        <p className="text-muted">Pas d'e-mail. Pas de téléphone. Pas d'IP au niveau utilisateur. Pas de <span className="mono">last_seen_at</span>.</p>

        <h3 className="text-[15px] font-semibold pt-2">transfers (une ligne par transfert <em>actif</em>)</h3>
        <p>
          Une ligne existe à partir du premier chunk tus reçu et est{' '}
          <strong>supprimée intégralement</strong> à la fin du transfert — achèvement, expiration ou
          révocation. Aucune colonne de suppression douce. Colonnes : FK expéditeur/destinataire
          (on-delete-set-null), nom de fichier, taille, chemin du blob, DEK enveloppée avec son IV/tag,
          IV du contenu et tag d'authentification final, statut, horodatages.
        </p>
        <p>
          Pas de <span className="mono">recipient_ip</span>, pas de <span className="mono">sender_ip</span>,
          pas de <span className="mono">download_count</span>, pas de <span className="mono">user_agent</span>,
          pas de <span className="mono">first_seen_at</span>. Le nom de fichier disparaît avec la ligne.
        </p>

        <h3 className="text-[15px] font-semibold pt-2">download_sessions (éphémère, en mémoire)</h3>
        <p>
          Une ligne existe <strong>uniquement pendant un téléchargement en cours</strong>, utilisée par
          le détecteur d'abus en mémoire. L'IP et le user-agent sont hachés en HMAC-SHA256 avec un{' '}
          <strong>sel aléatoire par processus</strong> qui change à chaque redémarrage, donc les hachages
          sont incorrelables entre démarrages. La ligne est supprimée à l'instant où le corps de la
          réponse se termine.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Ce que Cargo <em>ne stocke pas</em></h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Aucun journal d'audit</strong> de qui a envoyé quoi à qui. Le schéma n'a aucune table de ce type — une migration qui en introduirait une est rejetée en revue de code.</li>
          <li><strong>Aucun journal de téléchargement.</strong> Les sessions de téléchargement existent uniquement en mémoire et disparaissent à la fin du flux.</li>
          <li><strong>Aucun fil d'activité.</strong> Il n'existe ni page ni endpoint "Activité".</li>
          <li><strong>Aucun nom de fichier</strong> après la fin du transfert.</li>
          <li><strong>Aucun hash du contenu.</strong> Le tag d'authentification GCM vérifie l'intégrité et part avec la ligne du transfert.</li>
          <li><strong>Aucune adresse IP</strong> au niveau utilisateur ou transfert. Uniquement des hachages salés et éphémères dans <span className="mono">download_sessions</span>.</li>
          <li><strong>Aucun user-agent</strong> au-delà de ces mêmes hachages éphémères.</li>
          <li><strong>Aucune géolocalisation, empreinte d'appareil, rien d'autre.</strong></li>
          <li><strong>Aucune session Auth.js en base.</strong> Sessions JWT uniquement — la session vit dans un cookie signé.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Journaux applicatifs</h2>
        <p>
          <span className="mono">LOG_LEVEL=warning</span> en production. Le logger applique une étape{' '}
          <span className="mono">redact()</span> avant toute écriture. Les seuls champs qui atteignent
          stderr sont un timestamp, un niveau, un nom d'événement et un petit objet{' '}
          <span className="mono">ctx</span> numérique — compteurs, codes d'erreur, raisons. Aucun
          identifiant utilisateur, ni de transfert, ni nom de fichier, ni IP, ni handle n'apparaît dans{' '}
          <span className="mono">ctx</span>. Les exceptions non capturées sont loggées sous la forme{' '}
          <span className="mono">{`{ evt: "uncaught", ctx: { class: "<error_class>" } }`}</span>,
          jamais le message ou la stack.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Rétention</h2>
        <p>
          Le lien a une <strong>durée de vie fixe d'1 heure</strong>. Dans cette fenêtre, le destinataire
          peut télécharger le fichier autant de fois qu'il le souhaite. À l'expiration, aucun nouveau
          téléchargement n'est accepté — mais tout téléchargement déjà en cours est autorisé à se
          terminer. Dès la fin de la dernière session passée l'expiration, la ligne du transfert et son
          blob sont supprimés définitivement.
        </p>
        <p>
          Filet de sécurité : un <strong>plafond dur de 24 h</strong>. Si une session ne se termine
          jamais proprement (TCP semi-ouvert, etc.), le worker de nettoyage démolit le transfert 24 h
          après l'expiration quoi qu'il arrive. Le worker tourne toutes les 5 minutes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Suppression du compte</h2>
        <p>Vous tapez votre <span className="mono">@handle</span> pour confirmer. Côté serveur :</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Les transferts dont vous êtes l'expéditeur sont supprimés intégralement, blobs effacés. Les destinataires les voient disparaître de leur boîte de réception — aucun message "l'expéditeur a supprimé son compte", parce que la ligne n'existe plus.</li>
          <li>Les transferts dont vous êtes le destinataire voient <span className="mono">recipient_id</span> mis à <span className="mono">NULL</span>. L'expéditeur voit "(destinataire a supprimé son compte)" dans ses Envoyés ; le transfert expire selon le calendrier normal.</li>
          <li>Votre ligne <span className="mono">users</span> est supprimée intégralement — pas de suppression douce, pas de tombstone.</li>
          <li>Le cookie JWT Auth.js est effacé et la réponse fixe <span className="mono">Clear-Site-Data</span>.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Exporter mes données</h2>
        <p>
          <span className="mono">GET /api/account/export</span> produit un petit zip contenant votre
          profil et vos transferts actuellement actifs. C'est l'export complet. Rien d'autre n'existe à
          exporter.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Pourquoi cette posture</h2>
        <p>
          Cargo tourne sur une seule machine auto-hébergée. L'opérateur est aussi l'utilisateur (ou son
          proche). L'asymétrie entre "ce qu'apporte un journal d'audit" — quasi rien, pas de régime de
          conformité, pas d'équipe de réponse aux abus — et "le risque qu'il porte" — une seule
          compromission révèle qui-a-envoyé-quoi-à-qui pour toute une communauté — est si déséquilibrée
          que la bonne réponse est <strong>de ne pas le collecter</strong>.
        </p>
        <p>
          Ce document est le contrat. Le code y correspond. Les tests l'assertent. L'UI le rend visible.
          Ne le relâchez pas.
        </p>
      </section>
    </article>
  );
}
