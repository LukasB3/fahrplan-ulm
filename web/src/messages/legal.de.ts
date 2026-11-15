type Section = { heading: string; text: string }

export const legalDe = {
  imprint: {
    title: 'Impressum',
    basis: 'Angaben gemäß § 5 DDG.',
    address: ['Lukas Bossert', 'Marienstraße 10', '89231 Neu-Ulm'],
    contactHeading: 'Kontakt',
    email: 'bossert.dev@gmail.com',
    sections: [
      {
        heading: 'Über dieses Projekt',
        text: 'Diese Seite ist ein privates, nicht kommerzielles Projekt. Sie ist kein Angebot der SWU Stadtwerke Ulm/Neu-Ulm, der Donau-Iller-Nahverkehrsverbund-GmbH (DING) oder der Städte Ulm und Neu-Ulm.',
      },
      {
        heading: 'Datenquellen',
        text: 'Haltestellen, Abfahrten und Fahrzeugpositionen: offene Daten der SWU Verkehr (api.swu.de, gtfs.swu.de). Verbindungen, Adresssuche und Meldungen: Fahrplanauskunft des DING.',
      },
      {
        heading: 'Keine Gewähr',
        text: 'Alle angezeigten Daten stammen von den genannten Quellen und werden automatisiert übernommen. Für ihre Richtigkeit, Vollständigkeit und Aktualität übernehme ich keine Gewähr. Verbindlich sind allein die Auskünfte der Verkehrsunternehmen.',
      },
    ] satisfies Section[],
  },
  privacy: {
    title: 'Datenschutz',
    lead: 'Diese Seite erhebt so wenige Daten wie möglich. Was verarbeitet wird und warum, steht hier. Verantwortlich ist die im Impressum genannte Person.',
    sections: [
      {
        heading: 'Hosting',
        text: 'Die Seite wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA gehostet. Beim Aufruf verarbeitet Vercel die von Ihrem Browser übermittelten Daten (IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser und Betriebssystem, verweisende Seite) in Server-Logs, um die Seite auszuliefern und abzusichern. Rechtsgrundlage ist mein berechtigtes Interesse am sicheren Betrieb der Website (Art. 6 Abs. 1 lit. f DSGVO).',
      },
      {
        heading: 'Fahrplandaten',
        text: 'Fahrplandaten kommen von meinem Server bei der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen. Dabei wird technisch bedingt Ihre IP-Adresse an diesen Anbieter übermittelt. Der Server hält sie nur kurz im Arbeitsspeicher, um Missbrauch zu begrenzen, und schreibt sie in kein Protokoll. Ich werte keine Zugriffe aus und führe keine Nutzerprofile. Rechtsgrundlage ist mein berechtigtes Interesse an der Bereitstellung der Auskunft (Art. 6 Abs. 1 lit. f DSGVO).',
      },
      {
        heading: 'Standort',
        text: 'Die Seite fragt Ihren Standort nur ab, wenn Sie das selbst auslösen und im Browser zustimmen. Der Standort wird derzeit nur auf Ihrem Gerät angezeigt und nicht übertragen.',
      },
      {
        heading: 'Spracheingabe',
        text: 'Wenn Sie die Spracheingabe starten, wandelt Ihr Browser die Sprache in Text um. Je nach Browser geschieht das auf dem Gerät oder beim Anbieter des Browsers (bei Safari Apple, bei Chrome Google); in diesem Fall wird die Aufnahme dorthin übertragen. Ohne Ihr Tippen auf das Mikrofon wird nichts aufgenommen.',
      },
      {
        heading: 'Cookies und Tracking',
        text: 'Diese Seite setzt keine Cookies, nutzt keine Analysewerkzeuge und erstellt keine Nutzerprofile.',
      },
      {
        heading: 'E-Mail',
        text: 'Wenn Sie mir eine E-Mail schreiben, verarbeite ich Ihre Adresse und Ihre Nachricht, um zu antworten (Art. 6 Abs. 1 lit. b und f DSGVO), und lösche sie, sobald sie nicht mehr benötigt werden.',
      },
      {
        heading: 'Ihre Rechte',
        text: 'Sie haben nach Art. 15 bis 21 DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde, zum Beispiel dem Bayerischen Landesamt für Datenschutzaufsicht. Zur Ausübung Ihrer Rechte schreiben Sie mir an die im Impressum genannte Adresse.',
      },
    ] satisfies Section[],
  },
}
