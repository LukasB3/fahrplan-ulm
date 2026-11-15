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
        heading: 'Verbindungssuche',
        text: 'Start, Ziel und Zeit einer Verbindungssuche sowie Ihre Eingaben in der Adresssuche werden an meinen Server übermittelt und von dort an die Fahrplanauskunft der Donau-Iller-Nahverkehrsverbund-GmbH (DING) weitergegeben, die die Verbindung berechnet. Der DING sieht dabei meinen Server, nicht Ihre IP-Adresse. Mein Server speichert die Anfragen nicht; Antworten werden für kurze Zeit ohne Bezug zu Ihnen zwischengespeichert. Rechtsgrundlage ist mein berechtigtes Interesse an der Bereitstellung der Auskunft (Art. 6 Abs. 1 lit. f DSGVO).',
      },
      {
        heading: 'Fahrtwunsch in einem Satz',
        text: 'Wenn Sie Ihren Fahrtwunsch als Satz eingeben oder sprechen, wird dieser Satz an meinen Server übermittelt und von dort an die Anthropic PBC (San Francisco, USA) weitergegeben. Deren Sprachmodell Claude entnimmt dem Satz Start, Ziel und Zeit. Ihr Standort und Ihre gespeicherten Orte werden nicht an Anthropic übermittelt; der Satz enthält aber, was Sie hineinschreiben, etwa eine Adresse. Mein Server speichert und protokolliert den Satz nicht. Für gleiche Sätze merkt er sich das Ergebnis bis zu einer Stunde ohne Bezug zu Ihnen. Rechtsgrundlage ist mein berechtigtes Interesse an einer einfachen Bedienung (Art. 6 Abs. 1 lit. f DSGVO). Wer das nicht möchte, nutzt das Formular darunter: Es kommt ohne das Sprachmodell aus.',
      },
      {
        heading: 'Standort',
        text: 'Die Seite fragt Ihren Standort nur ab, wenn Sie das selbst auslösen und im Browser zustimmen. Für die Haltestellen in der Nähe werden die Entfernungen auf Ihrem Gerät berechnet; der Standort wird dabei nicht übertragen. Wählen Sie „Mein Standort“ als Start oder Ziel einer Verbindung, wird er wie jeder andere Ort für die Verbindungssuche übermittelt (siehe oben) und nicht gespeichert.',
      },
      {
        heading: 'Karte',
        text: 'Die Live-Karte und die kleinen Karten der Fußwege verwenden Kartendaten von Stadia Maps, Inc. (USA). Sie werden erst geladen, wenn Sie die Karte öffnen oder eine Verbindung aufklappen. Dabei überträgt Ihr Browser Ihre IP-Adresse, den angezeigten Kartenausschnitt und die Adresse dieser Seite an Stadia Maps. Rechtsgrundlage ist mein berechtigtes Interesse an einer Kartendarstellung (Art. 6 Abs. 1 lit. f DSGVO). Näheres steht in der Datenschutzerklärung von Stadia Maps unter stadiamaps.com/privacy-policy.',
      },
      {
        heading: 'Favoriten und gespeicherte Orte',
        text: 'Haltestellen, die Sie als Favorit merken, Ihre Orte „Zuhause“ und „Arbeit“, die zuletzt gewählten Orte und welche Meldungen Sie schon gesehen haben, werden nur im Speicher Ihres Browsers auf diesem Gerät abgelegt. Das ist nötig, um die von Ihnen gewünschte Funktion bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG). Übertragen werden sie nur, wenn Sie sie als Start oder Ziel einer Verbindung wählen. Sie verschwinden, wenn Sie die Websitedaten im Browser löschen.',
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
