/**
 * One-shot injector: adds the "Language & Region" settings-section keys to every
 * scripts/settings-i18n-<locale>-partial.mjs so the generated catalogs keep key parity
 * with the `en` table in src/services/settings/settingsI18n.ts.
 *
 * Idempotent: keys already present in a partial are left untouched.
 * Usage: node scripts/inject-language-region-keys.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TRANSLATIONS = {
  tr: {
    "nav.section.languageRegion": "Dil ve Bölge",
    "language.title": "Dil ve Bölge",
    "language.description": "Uygulama dilini seç; tarih, saat ve sayı biçimleri seçtiğin dile göre güncellenir.",
    "language.appLanguage": "Uygulama dili",
    "language.appLanguageHint": "Picom arayüz metinlerine uygulanır; kullanıcı içeriği asla çevrilmez.",
    "language.useSystem": "İşletim sistemi dilini kullan",
    "language.useSystemHint": "Açıkken Picom her açılışta sistem dilini yeniden algılar. Desteklenmeyen bir dilde İngilizce kullanılır.",
    "language.searchPlaceholder": "Dil ara",
    "language.searchAria": "Dil listesinde ara",
    "language.noResults": "“{query}” ile eşleşen dil yok.",
    "language.selected": "Seçili",
    "language.selectAria": "{name} dilini seç",
    "language.activeLocale": "Etkin locale",
    "language.previewTitle": "Biçim önizlemesi",
    "language.previewDate": "Tarih",
    "language.previewTime": "Saat",
    "language.previewNumber": "Sayı",
    "language.previewRelative": "Göreli zaman",
  },
  de: {
    "nav.section.languageRegion": "Sprache und Region",
    "language.title": "Sprache und Region",
    "language.description": "Wähle die App-Sprache; Datums-, Zeit- und Zahlenformate richten sich nach deiner Auswahl.",
    "language.appLanguage": "App-Sprache",
    "language.appLanguageHint": "Gilt für von Picom gesteuerte Oberflächentexte; Nutzerinhalte werden nie übersetzt.",
    "language.useSystem": "Systemsprache verwenden",
    "language.useSystemHint": "Wenn aktiviert, erkennt Picom die Systemsprache bei jedem Start neu. Bei nicht unterstützter Sprache wird Englisch verwendet.",
    "language.searchPlaceholder": "Sprache suchen",
    "language.searchAria": "In der Sprachliste suchen",
    "language.noResults": "Keine Sprache passt zu „{query}“.",
    "language.selected": "Ausgewählt",
    "language.selectAria": "Sprache {name} auswählen",
    "language.activeLocale": "Aktives Gebietsschema",
    "language.previewTitle": "Formatvorschau",
    "language.previewDate": "Datum",
    "language.previewTime": "Uhrzeit",
    "language.previewNumber": "Zahl",
    "language.previewRelative": "Relative Zeit",
  },
  fr: {
    "nav.section.languageRegion": "Langue et région",
    "language.title": "Langue et région",
    "language.description": "Choisissez la langue de l'application ; les formats de date, d'heure et de nombre suivent votre sélection.",
    "language.appLanguage": "Langue de l'application",
    "language.appLanguageHint": "S'applique aux textes d'interface gérés par Picom ; le contenu des utilisateurs n'est jamais traduit.",
    "language.useSystem": "Utiliser la langue du système",
    "language.useSystemHint": "Lorsque cette option est activée, Picom détecte à nouveau la langue du système à chaque démarrage. Si elle n'est pas prise en charge, l'anglais est utilisé.",
    "language.searchPlaceholder": "Rechercher une langue",
    "language.searchAria": "Rechercher dans la liste des langues",
    "language.noResults": "Aucune langue ne correspond à « {query} ».",
    "language.selected": "Sélectionnée",
    "language.selectAria": "Sélectionner la langue {name}",
    "language.activeLocale": "Paramètre régional actif",
    "language.previewTitle": "Aperçu des formats",
    "language.previewDate": "Date",
    "language.previewTime": "Heure",
    "language.previewNumber": "Nombre",
    "language.previewRelative": "Temps relatif",
  },
  es: {
    "nav.section.languageRegion": "Idioma y región",
    "language.title": "Idioma y región",
    "language.description": "Elige el idioma de la aplicación; los formatos de fecha, hora y número siguen tu selección.",
    "language.appLanguage": "Idioma de la aplicación",
    "language.appLanguageHint": "Se aplica a los textos de la interfaz de Picom; el contenido de los usuarios nunca se traduce.",
    "language.useSystem": "Usar el idioma del sistema",
    "language.useSystemHint": "Cuando está activado, Picom vuelve a detectar el idioma del sistema en cada inicio. Si no es compatible, se usa inglés.",
    "language.searchPlaceholder": "Buscar idioma",
    "language.searchAria": "Buscar en la lista de idiomas",
    "language.noResults": "Ningún idioma coincide con «{query}».",
    "language.selected": "Seleccionado",
    "language.selectAria": "Seleccionar el idioma {name}",
    "language.activeLocale": "Configuración regional activa",
    "language.previewTitle": "Vista previa de formatos",
    "language.previewDate": "Fecha",
    "language.previewTime": "Hora",
    "language.previewNumber": "Número",
    "language.previewRelative": "Tiempo relativo",
  },
  it: {
    "nav.section.languageRegion": "Lingua e area geografica",
    "language.title": "Lingua e area geografica",
    "language.description": "Scegli la lingua dell'app; i formati di data, ora e numero seguono la tua selezione.",
    "language.appLanguage": "Lingua dell'app",
    "language.appLanguageHint": "Si applica ai testi dell'interfaccia gestiti da Picom; i contenuti degli utenti non vengono mai tradotti.",
    "language.useSystem": "Usa la lingua di sistema",
    "language.useSystemHint": "Se attivo, Picom rileva di nuovo la lingua di sistema a ogni avvio. Se non è supportata, viene usato l'inglese.",
    "language.searchPlaceholder": "Cerca lingua",
    "language.searchAria": "Cerca nell'elenco delle lingue",
    "language.noResults": "Nessuna lingua corrisponde a \\\"{query}\\\".",
    "language.selected": "Selezionata",
    "language.selectAria": "Seleziona la lingua {name}",
    "language.activeLocale": "Impostazione locale attiva",
    "language.previewTitle": "Anteprima dei formati",
    "language.previewDate": "Data",
    "language.previewTime": "Ora",
    "language.previewNumber": "Numero",
    "language.previewRelative": "Tempo relativo",
  },
  pt: {
    "nav.section.languageRegion": "Idioma e região",
    "language.title": "Idioma e região",
    "language.description": "Escolha o idioma do aplicativo; os formatos de data, hora e número acompanham a sua seleção.",
    "language.appLanguage": "Idioma do aplicativo",
    "language.appLanguageHint": "Aplica-se aos textos de interface controlados pelo Picom; o conteúdo dos usuários nunca é traduzido.",
    "language.useSystem": "Usar o idioma do sistema",
    "language.useSystemHint": "Quando ativado, o Picom detecta novamente o idioma do sistema a cada inicialização. Se não houver suporte, o inglês é usado.",
    "language.searchPlaceholder": "Pesquisar idioma",
    "language.searchAria": "Pesquisar na lista de idiomas",
    "language.noResults": "Nenhum idioma corresponde a \\\"{query}\\\".",
    "language.selected": "Selecionado",
    "language.selectAria": "Selecionar o idioma {name}",
    "language.activeLocale": "Localidade ativa",
    "language.previewTitle": "Prévia dos formatos",
    "language.previewDate": "Data",
    "language.previewTime": "Hora",
    "language.previewNumber": "Número",
    "language.previewRelative": "Tempo relativo",
  },
  nl: {
    "nav.section.languageRegion": "Taal en regio",
    "language.title": "Taal en regio",
    "language.description": "Kies de taal van de app; datum-, tijd- en getalnotaties volgen je keuze.",
    "language.appLanguage": "Taal van de app",
    "language.appLanguageHint": "Geldt voor interfaceteksten van Picom; inhoud van gebruikers wordt nooit vertaald.",
    "language.useSystem": "Systeemtaal gebruiken",
    "language.useSystemHint": "Als dit aanstaat, detecteert Picom bij elke start opnieuw de systeemtaal. Bij een niet-ondersteunde taal wordt Engels gebruikt.",
    "language.searchPlaceholder": "Taal zoeken",
    "language.searchAria": "Zoeken in de talenlijst",
    "language.noResults": "Geen taal komt overeen met \\\"{query}\\\".",
    "language.selected": "Geselecteerd",
    "language.selectAria": "Taal {name} selecteren",
    "language.activeLocale": "Actieve landinstelling",
    "language.previewTitle": "Voorbeeld van notaties",
    "language.previewDate": "Datum",
    "language.previewTime": "Tijd",
    "language.previewNumber": "Getal",
    "language.previewRelative": "Relatieve tijd",
  },
  pl: {
    "nav.section.languageRegion": "Język i region",
    "language.title": "Język i region",
    "language.description": "Wybierz język aplikacji; formaty daty, godziny i liczb dostosują się do Twojego wyboru.",
    "language.appLanguage": "Język aplikacji",
    "language.appLanguageHint": "Dotyczy tekstów interfejsu Picom; treści użytkowników nigdy nie są tłumaczone.",
    "language.useSystem": "Użyj języka systemu",
    "language.useSystemHint": "Gdy ta opcja jest włączona, Picom przy każdym uruchomieniu ponownie wykrywa język systemu. Jeśli nie jest obsługiwany, używany jest angielski.",
    "language.searchPlaceholder": "Szukaj języka",
    "language.searchAria": "Szukaj na liście języków",
    "language.noResults": "Żaden język nie pasuje do „{query}”.",
    "language.selected": "Wybrany",
    "language.selectAria": "Wybierz język {name}",
    "language.activeLocale": "Aktywne ustawienia regionalne",
    "language.previewTitle": "Podgląd formatów",
    "language.previewDate": "Data",
    "language.previewTime": "Godzina",
    "language.previewNumber": "Liczba",
    "language.previewRelative": "Czas względny",
  },
  ru: {
    "nav.section.languageRegion": "Язык и регион",
    "language.title": "Язык и регион",
    "language.description": "Выберите язык приложения; форматы даты, времени и чисел изменятся в соответствии с выбором.",
    "language.appLanguage": "Язык приложения",
    "language.appLanguageHint": "Применяется к текстам интерфейса Picom; пользовательский контент никогда не переводится.",
    "language.useSystem": "Использовать язык системы",
    "language.useSystemHint": "Когда включено, Picom заново определяет язык системы при каждом запуске. Если язык не поддерживается, используется английский.",
    "language.searchPlaceholder": "Поиск языка",
    "language.searchAria": "Поиск по списку языков",
    "language.noResults": "Нет языков, соответствующих «{query}».",
    "language.selected": "Выбран",
    "language.selectAria": "Выбрать язык {name}",
    "language.activeLocale": "Активная локаль",
    "language.previewTitle": "Предпросмотр форматов",
    "language.previewDate": "Дата",
    "language.previewTime": "Время",
    "language.previewNumber": "Число",
    "language.previewRelative": "Относительное время",
  },
};

let touched = 0;
for (const [locale, entries] of Object.entries(TRANSLATIONS)) {
  const file = path.join(root, `scripts/settings-i18n-${locale}-partial.mjs`);
  if (!existsSync(file)) {
    console.log(`skip ${locale}: partial not present yet`);
    continue;
  }
  let source = readFileSync(file, "utf8");
  const additions = Object.entries(entries)
    .filter(([key]) => !source.includes(`"${key}":`))
    .map(([key, value]) => `  "${key}": "${value}",`);
  if (!additions.length) {
    console.log(`ok   ${locale}: already contains all Language & Region keys`);
    continue;
  }
  const lastBrace = source.lastIndexOf("};");
  if (lastBrace === -1) throw new Error(`could not find closing brace in ${file}`);
  source = `${source.slice(0, lastBrace)}${additions.join("\n")}\n${source.slice(lastBrace)}`;
  writeFileSync(file, source);
  touched += 1;
  console.log(`add  ${locale}: +${additions.length} keys`);
}

console.log(`Language & Region key injection complete (${touched} partial file(s) updated).`);
