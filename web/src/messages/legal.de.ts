// The legal pages. Both follow the outline shared with lukasbossert.com and the
// app generator: the same sections in the same order under the same ids, and
// the same words wherever the facts are the same. A change to a shared
// paragraph is made on all three sites.

// A part of a paragraph: text, a link to another site, or a link to one of the two pages.
export type Inline = string | { text: string; href: string } | { text: string; route: 'imprint' | 'privacy'; hash?: string }
// A line break inside a paragraph (an address) is a "\n".
export type Paragraph = string | Inline[]
export type Block = Paragraph | { list: Paragraph[] }
export type Section = { id: string; heading: string; body: Block[] }
export type LegalDoc = { title: string; sections: Section[]; updated: string }

// The section the sentence field links to.
export const askSectionId = 'sentence'

const address = 'Lukas Bossert\nMarienstraße 10\n89231 Neu-Ulm'
const email = 'bossert.dev@gmail.com'
const mail: Inline = { text: email, href: `mailto:${email}` }
const updated = 'Stand: November 2026'

const see = (text: string, hash: string): Inline => ({ text, route: 'privacy', hash })

const imprint: LegalDoc = {
  title: 'Impressum',
  updated,
  sections: [
    {
      id: 'provider',
      heading: 'Anbieter',
      body: ['Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV.', address],
    },
    {
      id: 'contact',
      heading: 'Kontakt',
      body: [['E-Mail: ', mail]],
    },
    {
      id: 'responsible',
      heading: 'Verantwortlich für den Inhalt',
      body: ['Lukas Bossert, Anschrift wie oben (§ 18 Abs. 2 MStV).'],
    },
    {
      id: 'about',
      heading: 'Über diese Website',
      body: [
        'Diese Website ist ein privates, nicht kommerzielles Projekt. Sie ist kein Angebot der SWU Stadtwerke Ulm/Neu-Ulm, der Donau-Iller-Nahverkehrsverbund-GmbH (DING) oder der Städte Ulm und Neu-Ulm.',
      ],
    },
    {
      id: 'sources',
      heading: 'Datenquellen',
      body: [
        {
          list: [
            'Haltestellen, Linien, Fahrplan, Abfahrten und Fahrzeugpositionen: offene Daten der SWU Verkehr (api.swu.de, gtfs.swu.de).',
            'Verbindungen, Ortssuche und Meldungen, die Abfahrten anderer Verkehrsunternehmen, spätere Abfahrten und der weitere Verlauf einer Fahrt: Fahrplanauskunft des DING.',
            'Karten: Stadia Maps, OpenMapTiles und die Mitwirkenden von OpenStreetMap.',
          ],
        },
      ],
    },
    {
      id: 'accuracy',
      heading: 'Keine Gewähr',
      body: [
        'Alle angezeigten Daten stammen von den genannten Quellen und werden automatisiert übernommen. Für ihre Richtigkeit, Vollständigkeit und Aktualität übernehme ich keine Gewähr. Verbindlich sind allein die Auskünfte der Verkehrsunternehmen.',
      ],
    },
    {
      id: 'liability',
      heading: 'Haftung für Inhalte und Links',
      body: [
        'Für meine eigenen Inhalte auf diesen Seiten bin ich nach den allgemeinen Gesetzen verantwortlich. Diese Website verlinkt auf Websites Dritter, auf deren Inhalte ich keinen Einfluss habe; für sie ist der jeweilige Anbieter verantwortlich. Erfahre ich von einem Rechtsverstoß, entferne ich den betreffenden Inhalt oder Link umgehend.',
      ],
    },
    {
      id: 'privacy',
      heading: 'Datenschutz',
      body: [['Welche Daten diese Website verarbeitet, steht in der ', { text: 'Datenschutzerklärung', route: 'privacy' }, '.']],
    },
  ],
}

const privacy: LegalDoc = {
  title: 'Datenschutz',
  updated,
  sections: [
    {
      id: 'summary',
      heading: 'Kurz gesagt',
      body: [
        'Diese Website erhebt so wenige Daten wie möglich. Sie setzt keine Cookies, nutzt keine Analysewerkzeuge, zeigt keine Werbung und erstellt keine Nutzerprofile.',
        'Daten fallen an, wenn Sie eine Seite aufrufen, eine Verbindung oder einen Ort suchen, einen Fahrtwunsch als Satz eingeben, Ihren Standort freigeben oder eine Karte öffnen. Was dabei geschieht, steht in den folgenden Abschnitten.',
      ],
    },
    {
      id: 'controller',
      heading: 'Verantwortlicher',
      body: ['Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:', address, ['E-Mail: ', mail]],
    },
    {
      id: 'visit',
      heading: 'Aufruf der Website',
      body: [
        'Diese Website wird von Vercel Inc. (Covina, Kalifornien, USA) ausgeliefert. Wenn Sie eine Seite aufrufen, verarbeitet Vercel die Daten, die Ihr Browser dabei übermittelt: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, Browser und Betriebssystem sowie die verweisende Seite. Das ist nötig, um die Seite auszuliefern und vor Angriffen zu schützen. Rechtsgrundlage ist mein berechtigtes Interesse an einem sicheren Betrieb der Website (Art. 6 Abs. 1 lit. f DSGVO).',
        [
          'Vercel verarbeitet diese Daten in eigener Verantwortung nach seiner Datenschutzerklärung (',
          { text: 'vercel.com/legal/privacy-policy', href: 'https://vercel.com/legal/privacy-policy' },
          ') und ist unter dem EU-US Data Privacy Framework zertifiziert. Ich selbst werte keine Zugriffe aus; die Protokolle, die Vercel mir anzeigt, reichen etwa eine Stunde zurück.',
        ],
      ],
    },
    {
      id: 'server',
      heading: 'Mein Server',
      body: [
        'Fahrplandaten, Abfahrten, Fahrzeugpositionen, Verbindungen und Meldungen kommen von meinem Server, den ich bei der Hetzner Online GmbH (Gunzenhausen) gemietet habe; er steht in Falkenstein in Deutschland. Bei jeder Anfrage erhält der Server technisch bedingt Ihre IP-Adresse. Er hält sie nur im Arbeitsspeicher, um die Zahl der Anfragen je Anschluss zu begrenzen und Missbrauch abzuwehren. Sie wird nicht auf die Festplatte geschrieben und geht spätestens verloren, wenn der Dienst neu startet. Rechtsgrundlage ist mein berechtigtes Interesse an einem stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO).',
        'Der Server führt kein Zugriffsprotokoll: Seine Protokolle enthalten weder IP-Adressen noch Suchbegriffe. Eine Ausnahme gibt es: Schlägt eine Anfrage fehl, weil der Dienst gerade neu startet, schreibt der vorgeschaltete Webserver einen Fehlereintrag mit IP-Adresse, Browserkennung und aufgerufener Adresse ins Systemprotokoll; bei der Ortssuche enthält diese Adresse den Suchbegriff. Das kommt selten vor. Die Einträge bleiben dort, bis das Protokoll überschrieben wird, was Monate dauern kann.',
        'Ich werte keine Zugriffe aus und führe keine Nutzerprofile.',
      ],
    },
    {
      id: 'search',
      heading: 'Verbindungs- und Ortssuche',
      body: [
        'Start, Ziel und Zeit einer Verbindungssuche sowie Ihre Eingaben in der Ortssuche werden an meinen Server übermittelt und von dort an die Fahrplanauskunft der Donau-Iller-Nahverkehrsverbund-GmbH (DING, Ulm) weitergegeben, die die Verbindung berechnet oder den Ort sucht. Solange Verbindungen für „jetzt“ angezeigt werden, fragt die Seite sie alle 45 Sekunden neu ab. Der DING sieht dabei meinen Server, nicht Ihre IP-Adresse.',
        'Mein Server hält Suchbegriffe und Ergebnisse ohne Bezug zu Ihnen im Arbeitsspeicher vor, damit gleiche Anfragen schneller beantwortet werden: Ortssuchen bis zu sieben Tage, Verbindungen etwa eine Minute. Danach werden sie nicht mehr verwendet und spätestens gelöscht, wenn der Dienst neu startet. Auf die Festplatte wird nichts geschrieben. Rechtsgrundlage ist mein berechtigtes Interesse an der Bereitstellung der Auskunft (Art. 6 Abs. 1 lit. f DSGVO).',
      ],
    },
    {
      id: askSectionId,
      heading: 'Fahrtwunsch in einem Satz',
      body: [
        [
          'Wenn Sie Ihren Fahrtwunsch als Satz eingeben oder sprechen, wird der Satz an meinen Server übermittelt, zusammen mit Ihrem Standort, falls Sie ihn zuvor als Start gewählt haben. Der Server gibt nur den Satz an Anthropic weiter; deren Sprachmodell Claude entnimmt ihm Start, Ziel und Zeit. Ihr Standort wird nicht an Anthropic übermittelt. Der Satz enthält aber, was Sie hineinschreiben, etwa eine Adresse. Orte, die im Satz genannt sind, sucht mein Server anschließend beim DING. Nennt der Satz keinen Start, fragt die Seite nach Ihrem Standort (siehe ',
          see('Standort', 'location'),
          ').',
        ],
        'Mein Vertragspartner ist die Anthropic Ireland, Limited (Dublin, Irland); verarbeitet werden die Texte bei der Anthropic, PBC in den USA. Anthropic arbeitet dabei in meinem Auftrag, verwendet die Texte nicht zum Training seiner Modelle und löscht sie in der Regel innerhalb von 30 Tagen. Die Übermittlung in die USA ist durch die Standardvertragsklauseln der Europäischen Kommission abgesichert. Ihre IP-Adresse erhält Anthropic nicht.',
        'Mein Server schreibt den Satz in kein Protokoll und nicht auf die Festplatte. Für gleiche Sätze merkt er sich das Ergebnis im Arbeitsspeicher, ohne Bezug zu Ihnen, und verwendet es bis zu einer Stunde. Außerdem zählt er je IP-Adresse, wie viele Sätze an einem Tag eingehen; dieser Zähler steht nur im Arbeitsspeicher und wird um Mitternacht geleert. Rechtsgrundlage ist mein berechtigtes Interesse an einer einfachen Bedienung (Art. 6 Abs. 1 lit. f DSGVO). Wer das nicht möchte, nutzt das Formular darüber: Es kommt ohne das Sprachmodell aus.',
      ],
    },
    {
      id: 'location',
      heading: 'Standort',
      body: [
        'Die Seite fragt Ihren Standort nur ab, wenn Sie das selbst auslösen und im Browser zustimmen: bei den Haltestellen in der Nähe, mit „Mein Standort“ als Start oder Ziel, mit dem Standortknopf der Karte oder mit einem Satz ohne Startangabe. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie über die Abfrage Ihres Browsers erteilen und in dessen Einstellungen jederzeit zurücknehmen können.',
        [
          'Für die Haltestellen in der Nähe werden die Entfernungen auf Ihrem Gerät berechnet; der Standort wird dabei nicht übertragen. Auch der Standortknopf der Karte überträgt ihn nicht an meinen Server; die Karte lädt dann allerdings Kartenausschnitte Ihrer Umgebung (siehe ',
          see('Karte', 'map'),
          '). Als Start oder Ziel einer Verbindung wird der genaue Standort wie jeder andere Ort an meinen Server und von dort an den DING übermittelt (siehe ',
          see('Verbindungs- und Ortssuche', 'search'),
          '). Auf Ihrem Gerät wird er nicht gespeichert.',
        ],
      ],
    },
    {
      id: 'speech',
      heading: 'Spracheingabe',
      body: [
        [
          'Wenn Sie die Spracheingabe starten, wandelt Ihr Browser die Sprache in Text um. Je nach Browser geschieht das auf dem Gerät oder beim Anbieter des Browsers (bei Safari Apple, bei Chrome Google); in diesem Fall wird die Aufnahme dorthin übertragen. Ohne Ihr Tippen auf das Mikrofon wird nichts aufgenommen. Sobald Sie aufhören zu sprechen, wird der erkannte Satz ohne weiteres Tippen abgeschickt und wie ein eingegebener Satz verarbeitet (siehe ',
          see('Fahrtwunsch in einem Satz', askSectionId),
          ').',
        ],
      ],
    },
    {
      id: 'map',
      heading: 'Karte',
      body: [
        [
          'Die Live-Karte und die kleinen Karten der Fußwege verwenden Kartendaten von Stadia Maps, Inc. (USA). Sie werden erst geladen, wenn Sie die Karte öffnen oder eine Verbindung aufklappen. Dabei überträgt Ihr Browser Ihre IP-Adresse, den angezeigten Kartenausschnitt und die Adresse dieser Website (fahrplan-ulm.de, nicht die einzelne Seite) an Stadia Maps. Die Karten der Fußwege zeigen die Umgebung von Start und Ziel. Stadia Maps protokolliert nach eigenen Angaben IP-Adresse, Zeitpunkt und verweisende Seite. Rechtsgrundlage ist mein berechtigtes Interesse an einer Kartendarstellung (Art. 6 Abs. 1 lit. f DSGVO). Näheres steht in der Datenschutzerklärung von Stadia Maps (',
          { text: 'stadiamaps.com/privacy-policy', href: 'https://stadiamaps.com/privacy-policy/' },
          ').',
        ],
      ],
    },
    {
      id: 'device',
      heading: 'Auf Ihrem Gerät gespeichert',
      body: [
        'Diese Website setzt keine Cookies. Im Speicher Ihres Browsers legt sie nur ab, was Sie selbst festlegen: die Haltestellen, die Sie als Favorit merken, die fünf zuletzt gewählten Orte und welche Meldungen Sie schon gesehen haben. Das ist nötig, um die von Ihnen gewünschte Funktion bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG).',
        'Diese Angaben bleiben auf dem Gerät. Ein zuletzt gewählter Ort wird nur übertragen, wenn Sie ihn erneut als Start oder Ziel wählen. Haben Sie Favoriten gemerkt, lädt die Seite die Meldungen und gleicht sie auf dem Gerät mit Ihren Favoriten ab; die Favoriten selbst werden dabei nicht übertragen. Alles verschwindet, wenn Sie die Websitedaten im Browser löschen.',
      ],
    },
    {
      id: 'recipients',
      heading: 'Empfänger und Übermittlung in Drittländer',
      body: [
        'Daten erhalten nur die Stellen, die in dieser Erklärung genannt sind:',
        {
          list: [
            'Vercel Inc., USA: liefert die Website aus.',
            'Hetzner Online GmbH, Deutschland: stellt den Server, von dem die Fahrplandaten kommen.',
            'Donau-Iller-Nahverkehrsverbund-GmbH (DING), Ulm: berechnet Verbindungen und sucht Orte; erhält Start, Ziel, Zeit und Suchbegriffe, nicht Ihre IP-Adresse.',
            'Anthropic Ireland, Limited, Irland, mit Anthropic, PBC, USA: liest Fahrtwünsche, die als Satz eingegeben werden.',
            'Stadia Maps, Inc., USA: liefert die Kartenausschnitte.',
            'Der Anbieter Ihres Browsers, zum Beispiel Apple oder Google: nur bei der Spracheingabe und je nach Browser.',
          ],
        },
        'Übermittlungen in die USA stützen sich auf das EU-US Data Privacy Framework, soweit der Empfänger dafür zertifiziert ist, und sonst auf die Standardvertragsklauseln der Europäischen Kommission.',
        'Zertifiziert ist Vercel; Anthropic und Stadia Maps verwenden Standardvertragsklauseln.',
      ],
    },
    {
      id: 'email',
      heading: 'E-Mail',
      body: [
        'Wenn Sie mir eine E-Mail schreiben, verarbeite ich Ihre Adresse und Ihre Nachricht, um zu antworten (Art. 6 Abs. 1 lit. b und f DSGVO), und lösche sie, sobald sie nicht mehr benötigt werden. Mein Postfach liegt bei Gmail, einem Dienst von Google (Google Ireland Limited, Dublin, Irland); Google ist unter dem EU-US Data Privacy Framework zertifiziert.',
      ],
    },
    {
      id: 'rights',
      heading: 'Ihre Rechte',
      body: [
        ['Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Um ein Recht auszuüben, genügt eine E-Mail an ', mail, '.'],
        'Eine Einwilligung, etwa in die Abfrage Ihres Standorts, können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO).',
        'Sie sind nicht verpflichtet, Daten anzugeben. Ohne die jeweils genannten Daten lässt sich aber die betreffende Funktion nicht nutzen. Eine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO findet nicht statt.',
        [
          'Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel beim Bayerischen Landesamt für Datenschutzaufsicht, Promenade 18, 91522 Ansbach (',
          { text: 'www.lda.bayern.de', href: 'https://www.lda.bayern.de' },
          ').',
        ],
      ],
    },
    {
      id: 'objection',
      heading: 'Widerspruchsrecht',
      body: [
        'Soweit ich Daten auf Grundlage eines berechtigten Interesses verarbeite (Art. 6 Abs. 1 lit. f DSGVO), können Sie dem jederzeit aus Gründen widersprechen, die sich aus Ihrer besonderen Situation ergeben (Art. 21 DSGVO). Ich verarbeite die Daten dann nicht weiter, es sei denn, es gibt zwingende schutzwürdige Gründe dafür. Auch hierfür genügt eine E-Mail.',
      ],
    },
  ],
}

export const legalDe = { imprint, privacy }
