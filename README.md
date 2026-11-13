# Petal Peaks

Opuštajuća pixel art slagalica za telefon (uspravno), na srpskom i engleskom. Na leju 9×9 slažeš komade (kao u Tetrisu, ali ništa ne pada), a pun red, kolona ili kvadrat 3×3 procveta. Svaki nivo je markacija na planinskoj stazi, na svakih 10 je vrh sa kampom, a staza nema kraja. Junakinja je planinarka duge kovrdžave kose vezane u rep.

## Kako se igra

Dugme **?** postoji na svakom ekranu (u igri pauzira) i otvara uputstvo od 8 strana: za svaku temu piše ŠTA, KAKO i na šta da PAZIŠ, a iznad je animirani mini video. Iz uputstva se pušta **▶ DEMO** (igra sama sebe igra). Demo kreće i sam ako se naslovni ekran ne dira 20 sekundi. Prvi nivo je vođeni tutorijal.

- **Slaganje:** prevuci komad iz donjeg reda na leju. Zlatni okvir pokazuje šta će procvetati. Komadi se ne okreću.
- **Rast:** biljka raste dok je na leji, pupoljak → cvet (posle 3 poteza) → bujni grm (posle 7). Starija biljka daje više poena (10 / 20 / 35).
- **Kombo:** više redova odjednom množi poene.
- **Kiša:** cvetanje tri poteza zaredom donosi kišu i sve biljke porastu.
- **Pčele:** posle svakog cvetanja dolete pčele i ubrzaju rast drugih biljaka.
- **Prepreke:** kamen (od 31. nivoa i napukli kamen, koji traži dva čišćenja), plastika za reciklažu, korov koji se širi i pečurka koja daje +2 koraka.
- **Kompost:** komad koji ti ne odgovara prevučeš u kompost i dobiješ novi (3 puta po nivou).
- **Duboki udah:** drži dugme dok krug ne udahne i izdahne. Vraća poslednji potez, jednom po nivou.
- **Zvezdice:** 1 za prolaz, 2 i 3 ako ostane dosta koraka. Preostali koraci postaju bonus poeni.
- **Zen mod:** beskonačna leja bez ciljeva i koraka, igra se na rekord.

Na računaru: miš, **H** za uputstvo, **Esc** za pauzu, **U** za duboki udah.

## Staza

Šest predela po 10 nivoa, a posle Terasa kreće nova tura, teža: Livada, Brda lavande, Alpi, Paprat šuma, Kanjon i Terase. Svaki predeo ima svoje cveće (lavanda, mak, bela rada, suncokret, različak, runolist, kosmos, neven). Nivoi se generišu iz broja nivoa, pa je isti nivo uvek isti.

## Art

Sav art je pixel art nacrtan u kodu: `tools/make_art.py` (uz `tools/pix.py`) pravi sve slike u `assets/`, ikonice u `icons/` i `resources/`. Paleta je topla, u stilu 70-ih.

```
python3 tools/make_art.py          # sve
python3 tools/make_art.py tiles    # samo cveće, prepreke, leja
python3 tools/make_art.py ui bg    # UI, junakinja, kamp, pejzaži
```

Pregled svega u 6× uvećanju ide u `art/preview/` (nije u repou).

Font: [Jersey 10](https://github.com/scfried/soft-type-jersey) (SIL Open Font License, `fonts/OFL-Jersey10.txt`). Muzika i zvuci se sintetizuju uživo (WebAudio), bez audio fajlova.

## Pokretanje

```
python3 -m http.server 8000
```

pa otvori `http://localhost:8000`.

## Android

Svaki push na `main` pravi APK preko GitHub Actions i stavlja ga u release `latest`:

`https://github.com/gru-webdesign/petal-peaks/releases/latest/download/petal-peaks.apk`

Svi build-ovi su potpisani istim ključem (`tools/android/debug.keystore`), pa nova verzija može da se instalira preko stare bez gubljenja napretka. Za Google Play treba poseban, tajni ključ i AAB umesto APK-a.

Web verzija ide na GitHub Pages (`.github/workflows/pages.yml`). Ako se Pages ne uključi sam: Settings → Pages → Source: *GitHub Actions*.

## Struktura

| Putanja | Sadržaj |
| --- | --- |
| `index.html` | Stranica, canvas, fontovi, service worker |
| `src/game.js` | Igra: leja, komadi, cvetanje, rast, pčele, kiša, staza, kamp, uputstvo, demo, podešavanja |
| `src/levels.js` | Komadi, predeli i generator beskonačnih nivoa |
| `src/i18n.js` | Svi tekstovi na srpskom i engleskom, strane uputstva |
| `src/audio.js` | Lo-fi muzika, ptice, kiša i zvuci cvetanja (WebAudio) |
| `tools/make_art.py`, `tools/pix.py` | Generator celog pixel arta |
| `tools/build-web.mjs` | Kopira igru u `www/` za Capacitor i Pages |
