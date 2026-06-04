// A Map ideális, mert könnyen hozzáadhatunk elemeket, és automatikusan kezeli a duplikációkat.
const selectedAccessories = new Map();

// 1. Összevont AJAX függvény (GET és POST egyben)
// Egy Promise-szal tér vissza:
function ajaxRequest(url, method = "GET", payload = null) {
  return new Promise((resolve, reject) => {
    // Hagyományos XMLHttpRequest (XHR)
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    //JSON formátumú választ várunk.
    xhr.responseType = "json";

    // Ha küldünk adatot (pl. POST kérésnél), beállítjuk a megfelelő fejlécet
    if (payload) {
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    // Amikor a szerver válaszol...
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response); // Visszaadjuk a kapott adatot.
      } else {
        // Hiba esetén elutasítjuk a Promise-t a szerver hibaüzenetével.
        reject(new Error(xhr.response?.message || `${method} ${url} failed with status ${xhr.status}`));
      }
    };
    
    // Hálózati hiba (pl. megszakadt internet) esetén is hibát dobunk.
    xhr.onerror = () => reject(new Error(`${method} ${url} failed`));
    
    // Elküldjük a kérést. Ha van adat (payload), azt szöveggé (JSON) alakítjuk, ha nincs, null-t küldünk.
    xhr.send(payload ? JSON.stringify(payload) : null);
  });
}

// Táblázat adatainak dinamikus betöltése és renderelése a HTML-be.
async function loadComparisonTable() {
  // Megkeressük a táblázat helyét a HTML-ben.
  const target = document.querySelector("#comparisonTable");
  // Ha nincs ilyen elem az oldalon, a függvény azonnal leáll (így nem okoz hibát más oldalakon).
  if (!target) return;

  // Amíg várunk az adatra, betöltő szöveget jelenítünk meg a felhasználónak.
  target.innerHTML = '<p class="table-loading">Táblázat betöltése...</p>';

  try {
    // Lekérjük a JSON fájlt a szerverről.
    const data = await ajaxRequest("data/site.json");
    
    // Végigmegyünk az adatokon (map)
    const rowsHtml = data.comparison.rows.map(row => `
      <div class="comparison-row">
        <div class="comparison-cell">${row.feature}</div>
        <div class="comparison-cell ${row.legacyTone || ""}">${row.legacy}</div>
        <div class="comparison-cell success">${row.matrix}</div>
      </div>
    `).join("");

    // Felépítjük a táblázat fejlécét
    target.innerHTML = `
      <div class="comparison-row header">
        <div class="comparison-cell">Funkció</div>
        <div class="comparison-cell">Hagyományos<br>1000lm lámpa</div>
        <div class="comparison-cell">Bicikli Lámpa<br>Pro Max</div>
      </div>
      ${rowsHtml}
    `;
  } catch (error) {
    // Ha bármilyen hiba történik (pl. nincs meg a JSON fájl), kiírjuk a hibaüzenetet a HTML-be és a konzolra.
    target.innerHTML = '<p class="table-loading error">A táblázat betöltése nem sikerült.</p>';
    console.error(error);
  }
}

// Görgetésre megjelenő effektek (pl. Fade-in, Slide-up) beállítása.
function setupReveal() {
  // Az IntersectionObserver azt figyeli, hogy egy elem beér-e a látható képernyőre.
  const observer = new IntersectionObserver((entries) => {
    // Csak azokra az elemekre fókuszálunk, amik épp megjelentek a képernyőn.
    entries.filter(e => e.isIntersecting).forEach(entry => {
      // Ráteszünk egy osztályt, ami a CSS-ben elindítja az animációt.
      entry.target.classList.add("is-visible");
      // Miután egyszer megjelent, levesszük róla a figyelőt, így spórolunk a böngésző erőforrásaival.
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18 }); 

  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
}


function setupParallax() {
  const targets = document.querySelectorAll("[data-parallax]");
  if (!targets.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;
  // Figyeljük a görgetést...
  window.addEventListener("scroll", () => {
    if (ticking) return;
    

    requestAnimationFrame(() => {
      const center = window.innerHeight / 2; // A képernyő függőleges közepe.
      
      targets.forEach(target => {
        const rect = target.getBoundingClientRect();
        // Kiszámoljuk a távolságot a középponttól, szorozva az elem saját parallax sebességével.
        const distance = (rect.top + rect.height / 2 - center) * Number(target.dataset.parallax);
        // CSS transform segítségével eltoljuk az elemet Y tengelyen.
        target.style.transform = `translateY(${distance.toFixed(2)}px)`;
      });
      ticking = false; // Engedélyezzük a következő számítást.
    });
    ticking = true;
  }, { passive: true }); 
}

// Előrendelési űrlap kezelése és validálása.
function setupPreorderForm() {
  const form = document.querySelector("#preorderForm");
  if (!form) return;

  // Hivatkozások elmentése a fontosabb DOM elemekre.
  const status = document.querySelector("#formStatus");
  const emailInput = document.querySelector("#email");
  const emailError = document.querySelector("#emailError");
  const button = form.querySelector("button");

  // Regex alapú ellenőrzés: megnézi, hogy az email forma megfelelő-e (tartalmaz @-ot, pontot, stb.).
  const validateEmail = (email) => 
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Az email cím formátuma nem megfelelő.";

 
  const setEmailError = (message) => {
    emailError.textContent = message;
    emailInput.setAttribute("aria-invalid", message ? "true" : "false");
  };


  emailInput.addEventListener("input", () => {
    if (emailError.textContent) setEmailError(validateEmail(emailInput.value.trim()));
  });

  // Amikor a felhasználó rányom a "Küldés" gombra...
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // Megakadályozzuk az oldal tényleges újratöltését.
    status.textContent = "";
    status.classList.remove("error");

    // Kiolvassuk az űrlapból a megadott emailt
    const email = new FormData(form).get("email").toString().trim();
    const error = validateEmail(email);

    // Ha hibás az email, kiírjuk a hibát
    if (error) {
      setEmailError(error);
      return emailInput.focus();
    }

    setEmailError(""); 
    button.disabled = true; // Letiltjuk a gombot, hogy ne lehessen kétszer rákattintani amíg tölt.
    button.textContent = "Küldés...";

    try {
      // POST kéréssel beküldjük az adatokat a backendnek.
      const response = await ajaxRequest("/api/preorders", "POST", {
        email,
        product: "Bicikli Lámpa Pro",
        // A globális Map-ből egy sima JavaScript tömböt csinálunk a küldéshez.
        accessories: Array.from(selectedAccessories.values()),
        source: "landing-page"
      });
      // Siker esetén kiírjuk a szerver üzenetét, és alaphelyzetbe állítjuk az űrlapot.
      status.textContent = response.message || "Sikeres előrendelési érdeklődés.";
      form.reset();
    } catch (error) {
      // Szerver vagy hálózati hiba kezelése.
      status.textContent = "A POST kérés nem sikerült. Indítsd el a helyi szervert: node server.js";
      status.classList.add("error");
    } finally {

      button.disabled = false;
      button.textContent = "Előrendel";
    }
  });
}


function setupAccessoryReservations() {
  document.querySelector("#accessories")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-accessory]");
    if (!button) return; 

    const { accessory, price } = button.dataset;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Mentés...";

    try {

      await ajaxRequest("/api/preorders", "POST", {
        type: "accessory", accessory, price, product: "Bicikli Lámpa Pro", source: "accessory-card"
      });

      // Sikeres szerverválasz után elmentjük a kiegészítőt a fájl tetején létrehozott globális Map-be.
      selectedAccessories.set(accessory, { title: accessory, price });
      

      button.classList.add("is-added");
      button.textContent = "Kosárban";
    } catch (error) {
      button.textContent = "Hiba";
      setTimeout(() => button.textContent = originalText, 1600);
    } finally {
      setTimeout(() => button.disabled = false, 500);
    }
  });
}

// DOMContentLoaded: Ez az esemény akkor fut le, amikor a böngésző már teljesen 
// beolvasta a HTML-t (de a képeket pl. még nem). Itt indítjuk el a funkciókat, 
// ezzel elkerülve, hogy a JavaScript olyan elemeket keressen, amik még nincsenek az oldalon.
document.addEventListener("DOMContentLoaded", () => {
  loadComparisonTable();
  setupAccessoryReservations();
  setupReveal();
  setupParallax();
  setupPreorderForm();
});

// Tematikus "Hackelő" Easter Egg - Hosszan nyomvatartásra (Long Press)
(function() {
  let pressTimer;

  // Megvárjuk, amíg a DOM betölt, hogy biztosan meglegyen a logó
  document.addEventListener("DOMContentLoaded", () => {
    // Megkeressük a fejlécben lévő kis kerek brand-mark logót
    const logo = document.querySelector(".site-header .brand-mark");
    if (!logo) return;

    // Beállítjuk a kurzort, hogy látszódjon: trükkös elem
    logo.style.cursor = "help";

    // Egérrel való kattintás kezdete
    logo.addEventListener("mousedown", startPress);
    logo.addEventListener("mouseup", cancelPress);
    logo.addEventListener("mouseleave", cancelPress);

    // Érintőképernyővel (mobil) való érintés kezdete
    logo.addEventListener("touchstart", startPress, { passive: true });
    logo.addEventListener("touchend", cancelPress);
    logo.addEventListener("touchcancel", cancelPress);
  });

  function startPress(e) {
    // Ha 2.5 másodpercig folyamatosan nyomva tartja, elindul a hackelés
    pressTimer = setTimeout(() => {
      triggerHackEffects();
    }, 2500);
  }

  function cancelPress() {
    clearTimeout(pressTimer);
  }

  function triggerHackEffects() {
    // Dinamikusan felépítjük a hacker terminál felületet
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = '#050505';
    overlay.style.zIndex = '99999';
    overlay.style.fontFamily = "'Courier New', Courier, monospace";
    overlay.style.color = '#00ff33';
    overlay.style.padding = '40px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.fontSize = '18px';
    overlay.style.lineHeight = '1.6';
    overlay.style.textShadow = '0 0 5px #00ff33';
    
    const consoleBox = document.createElement('div');
    overlay.appendChild(consoleBox);
    document.body.appendChild(overlay);
    
    // Blokkoljuk az eredeti oldal görgetését
    document.body.style.overflow = 'hidden';

    // Sci-fi/Hack parancsok a projekt kontextusában (Node.js szerver port és Neural engine)
    const lines = [
      "> WARNING: LOGO CORRUPTION DETECTED...",
      "> INITIATING BACKDOOR EXPLOIT VIA PORT 4173...",
      "> BRUTEFORCING BIKEHUD MATRIX LED FIRMWARE... [OK]",
      "> OVERRIDING NEURAL ENGINE ACCELERATION KERNEL...",
      "> INJECTING SANHILZON PAYLOAD INTO THE RESERVATIONS CORE...",
      "> EXTRACTING SOURCE REPOSITORY: [████████████████████] 100%",
      "> SYSTEM COMPROMISED. ACCESS GRANTED. REDIRECTING..."
    ];

    let currentLine = 0;

    function printLine() {
      if (currentLine < lines.length) {
        const p = document.createElement('p');
        p.style.margin = '0 0 12px 0';
        consoleBox.appendChild(p);
        
        let charIndex = 0;
        const text = lines[currentLine];
        
        function typeChar() {
          if (charIndex < text.length) {
            p.textContent += text[charIndex];
            charIndex++;
            setTimeout(typeChar, 10); // Karakterek gépelési sebessége
          } else {
            currentLine++;
            // A folyamatjelző csík után tartsunk egy drámaibb szünetet
            const delay = currentLine === 6 ? 1000 : 250; 
            setTimeout(printLine, delay);
          }
        }
        typeChar();
      } else {
        // Átirányítás a cél URL-re
        setTimeout(() => {
          window.location.href = 'https://github.com/BudaiSamuel-dev/Sanhilzon';
        }, 500);
      }
    }

    printLine();
  }
})();