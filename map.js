// === 1: MAP MODULE VARIABLES START ===
let mapCanvas = null;
let mapContext = null;
let mapImage = null; // Holder det lastede kartbildet
let mapPoints = []; // Array for { id, x, y, type: 'fixed' | 'checkpoint', name, timestamp }
let currentMapId = 'mainMap'; // Foreløpig støtter vi kun ett kart
let currentInteractionMode = 'view'; // 'view', 'add-fixed', 'add-checkpoint'
let isMapInitialized = false;
// === 1: MAP MODULE VARIABLES END ===

// === 2: INITIALIZATION START ===
/**
 * Initialiserer Kart-modulen. Henter referanser og setter opp event listeners.
 */
function initializeMapModule() {
    mapCanvas = document.getElementById('map-canvas');
    const mapDisplayArea = document.getElementById('map-display-area');
    const mapUploadInput = document.getElementById('map-upload');
    const addPointBtn = document.getElementById('add-point-mode');
    const addCheckpointBtn = document.getElementById('add-checkpoint-mode');

    if (!mapCanvas || !mapDisplayArea || !mapUploadInput || !addPointBtn || !addCheckpointBtn) {
        console.error("Kart-modul: Nødvendige HTML-elementer mangler.");
        return;
    }
    mapContext = mapCanvas.getContext('2d');

    // Event Listeners
    mapUploadInput.addEventListener('change', handleMapUpload);
    addPointBtn.addEventListener('click', () => setInteractionMode('add-fixed'));
    addCheckpointBtn.addEventListener('click', () => setInteractionMode('add-checkpoint'));
    mapCanvas.addEventListener('click', handleCanvasClick);
    // Legg til listener for å gå tilbake til 'view' modus om man klikker utenfor knappene?
    // document.addEventListener('click', (e) => {
    //     if (!mapCanvas.contains(e.target) && !addPointBtn.contains(e.target) && !addCheckpointBtn.contains(e.target)) {
    //         setInteractionMode('view');
    //     }
    // });

    console.log("Kart-modul initialisert.");
    isMapInitialized = true;
    // Prøv å laste eksisterende kartdata ved oppstart
    loadMapDataFromStorage();
}

/**
 * Laster kartdata (bilde + punkter) fra IndexedDB.
 */
async function loadMapDataFromStorage() {
    if (!isMapInitialized) return;
    console.log(`Laster kartdata for ${currentMapId}...`);
    try {
        const mapData = await getMapData(currentMapId);
        if (mapData && mapData.imageData) {
            mapPoints = mapData.points || []; // Last punkter
            loadImageOntoCanvas(mapData.imageData); // Last og tegn bildet
            updatePointList(); // Oppdater listen med punkter
            setMapStatus(`Kart "${mapData.imageName || 'Lagret kart'}" lastet.`);
        } else {
            console.log("Ingen lagret kartdata funnet.");
            clearMapDisplay(); // Tøm visningen hvis ingen data finnes
            setMapStatus("Ingen kart lastet. Last opp et bilde.");
        }
    } catch (error) {
        console.error("Feil ved lasting av kartdata fra storage:", error);
        logEvent(`Feil ved lasting av kartdata: ${error.message}`, 'Error');
        setMapStatus("Feil ved lasting av kart.", true);
    }
}
// === 2: INITIALIZATION END ===

// === 3: MAP IMAGE HANDLING START ===
/**
 * Håndterer valg av kartbilde fra filinput.
 * @param {Event} event Input change event.
 */
function handleMapUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert("Vennligst velg en gyldig bildefil.");
        // Nullstill inputfeltet hvis filen er ugyldig
         event.target.value = null;
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageDataUrl = e.target.result; // Base64 data URL

        // --- KORRIGERING HER ---
        // Kall saveCurrentMapData, ikke saveMapDataToStorage
        saveCurrentMapData(imageDataUrl, [], file.name)
            .then(() => {
                loadImageOntoCanvas(imageDataUrl); // Vis det nye bildet
                mapPoints = []; // Nullstill punkter for nytt kart
                updatePointList();
                setMapStatus(`Kart "${file.name}" lastet opp.`);
                logEvent(`Nytt kart "${file.name}" lastet opp.`, 'Kart');
                 // Nullstill filinput etter vellykket opplasting
                 event.target.value = null;
                 setInteractionMode('view'); // Gå til view mode
            })
            .catch(error => {
                console.error("Kunne ikke lagre det nye kartbildet:", error);
                setMapStatus("Kunne ikke lagre kart.", true);
                 // Nullstill filinput ved feil også
                 event.target.value = null;
            });
        // --- SLUTT PÅ KORRIGERING ---
    };
    reader.onerror = (e) => {
        console.error("Feil ved lesing av fil:", e);
        alert("Kunne ikke lese bildefilen.");
        setMapStatus("Feil ved lesing av kartfil.", true);
        // Nullstill filinput ved feil
         event.target.value = null;
    };
    reader.readAsDataURL(file); // Les filen som Base64
}

/**
 * Laster en Base64-streng som et bilde og tegner det på canvas.
 * @param {string} imageDataUrl Base64 data URL for bildet.
 */
function loadImageOntoCanvas(imageDataUrl) {
    if (!mapContext) return;
    mapImage = new Image();
    mapImage.onload = () => {
        console.log(`Bildet lastet: ${mapImage.width}x${mapImage.height}`);
        drawMap(); // Tegn kartet og punkter når bildet er klart
    };
    mapImage.onerror = () => {
        console.error("Kunne ikke laste bilde fra data URL.");
        alert("En feil oppstod ved lasting av kartbildet.");
        setMapStatus("Feil ved visning av kart.", true);
        mapImage = null; // Nullstill hvis feil
        clearMapDisplay();
    };
    mapImage.src = imageDataUrl;
}

/**
 * Tegner kartbildet (hvis lastet) og alle punkter på canvas.
 */
function drawMap() {
    if (!mapContext || !mapCanvas) return;

    if (mapImage) {
        // Sett canvas størrelse lik bildets størrelse
        mapCanvas.width = mapImage.width;
        mapCanvas.height = mapImage.height;
        // Sørg for at containeren justerer seg (CSS håndterer max-width/height/scroll)
        // Fjernet style-setting herfra, bør håndteres primært av CSS for containeren.
        // mapCanvas.style.maxWidth = `${mapImage.width}px`;
        // mapCanvas.style.maxHeight = `${mapImage.height}px`;

        // Tegn bakgrunnsbildet
        mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height); // Tøm først
        mapContext.drawImage(mapImage, 0, 0);
        // Tegn punktene oppå
        drawPoints();
        console.log("Kart tegnet på canvas.");
    } else {
        // Ikke noe bilde, bare tøm canvas
        clearMapDisplay();
        console.log("Ingen kartbilde å tegne.");
    }
}

/**
 * Tømmer kart-canvas og nullstiller relatert info.
 */
function clearMapDisplay() {
     if (!mapContext || !mapCanvas) return;
     mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
     // Sett en standard størrelse? Eller la den være 0?
     mapCanvas.width = 300; // Default liten størrelse
     mapCanvas.height = 150;
     // Fjernet style-setting herfra også.
     // mapCanvas.style.maxWidth = '100%';
     // mapCanvas.style.maxHeight = '400px'; // Tilbake til default CSS
     mapImage = null;
     mapPoints = [];
     updatePointList();
     setInteractionMode('view'); // Tilbakestill modus
}
// === 3: MAP IMAGE HANDLING END ===

// === 4: POINT HANDLING START ===
/**
 * Tegner alle lagrede punkter på kartet.
 */
function drawPoints() {
    if (!mapContext || !mapImage) return; // Trenger kontekst og bilde for å tegne

    mapPoints.forEach(point => {
        mapContext.beginPath();
        const pointRadius = 5; // Størrelse på punktet

        if (point.type === 'fixed') {
            mapContext.fillStyle = 'blue'; // Blå sirkel for faste punkter
            mapContext.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
            mapContext.fill();
        } else if (point.type === 'checkpoint') {
            mapContext.fillStyle = 'red'; // Rød firkant for sjekkpunkter
            mapContext.fillRect(point.x - pointRadius, point.y - pointRadius, pointRadius * 2, pointRadius * 2);
        } else {
             mapContext.fillStyle = 'grey'; // Grå for ukjent type
             mapContext.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
            mapContext.fill();
        }

        // Legg til navn ved siden av punktet
        mapContext.fillStyle = 'black';
        mapContext.font = '12px sans-serif';
        mapContext.fillText(point.name || `Punkt ${point.id}`, point.x + pointRadius + 3, point.y + pointRadius);
    });
}

/**
 * Håndterer klikk på kart-canvas for å legge til punkter.
 * @param {MouseEvent} event Klikkeventet.
 */
function handleCanvasClick(event) {
    if (!mapImage) {
        alert("Du må laste opp et kartbilde før du kan legge til punkter.");
        return;
    }
    if (currentInteractionMode === 'view') {
        console.log("Klikk på kart i view-modus, ignorerer.");
        // Senere: Kan brukes til å velge/vise info om eksisterende punkter?
        return;
    }
    if (currentInteractionMode === 'add-fixed' || currentInteractionMode === 'add-checkpoint') {
        const coords = getCanvasCoordinates(event);
        const pointType = (currentInteractionMode === 'add-fixed') ? 'fixed' : 'checkpoint';
        const pointTypeName = (pointType === 'fixed') ? 'fast punkt' : 'sjekkpunkt';

        const pointName = prompt(`Skriv inn navn for det nye ${pointTypeName} (eller la stå tomt):`, "");
        // Ikke avbryt hvis bruker trykker cancel, bare bruk tomt navn

        const newPoint = {
            id: Date.now(), // Enkel unik ID (kan forbedres)
            x: coords.x,
            y: coords.y,
            type: pointType,
            name: pointName ? pointName.trim() : "", // Bruk trimmet navn eller tom streng
            timestamp: new Date().toISOString()
        };

        mapPoints.push(newPoint);
        drawMap(); // Tegn kartet på nytt med det nye punktet
        updatePointList(); // Oppdater HTML-listen
        saveCurrentMapData() // Lagre endringene (bilde + punkter) til DB
            .then(() => {
                logEvent(`La til ${pointTypeName} "${newPoint.name || 'uten navn'}" (ID: ${newPoint.id}) på kartet.`, 'Kart');
            })
            .catch(error => {
                 console.error("Kunne ikke lagre nytt punkt:", error);
                 // Bør vi fjerne punktet fra arrayen igjen hvis lagring feiler? Ja.
                 mapPoints.pop(); // Fjern det siste punktet
                 drawMap(); // Tegn på nytt uten punktet
                 updatePointList();
            });

        // Gå tilbake til view-modus etter å ha lagt til ett punkt? Eller la bruker legge til flere?
        // setInteractionMode('view'); // <-- Aktiver denne hvis du vil ha ett klikk = ett punkt
    }
}

/**
 * Oppdaterer HTML-listen over plottede punkter.
 */
function updatePointList() {
    const listElement = document.querySelector('#map-point-list ul');
    if (!listElement) return;

    listElement.innerHTML = ''; // Tøm listen
    if (mapPoints.length === 0) {
        listElement.innerHTML = '<li>Ingen punkter plottet ennå.</li>';
    } else {
        mapPoints.forEach(point => {
            const li = document.createElement('li');
            const typeText = point.type === 'fixed' ? 'Fast pkt.' : 'Sjekkpkt.';
            li.textContent = `[${typeText}] ${point.name || `ID: ${point.id}`} (X: ${point.x.toFixed(0)}, Y: ${point.y.toFixed(0)})`;
            // Legg til sletteknapp for punkt
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Slett punkt';
            deleteBtn.style.marginLeft = '10px';
            deleteBtn.style.padding = '2px 5px';
            deleteBtn.onclick = () => handleDeletePoint(point.id);
            li.appendChild(deleteBtn);
            listElement.appendChild(li);
        });
    }
}

/**
 * Sletter et punkt fra kartet og listen.
 * @param {number} pointId ID-en til punktet som skal slettes.
 */
async function handleDeletePoint(pointId) {
    const pointIndex = mapPoints.findIndex(p => p.id === pointId);
    if (pointIndex === -1) {
        console.warn(`Punkt med ID ${pointId} ikke funnet for sletting.`);
        return;
    }

    const pointName = mapPoints[pointIndex].name || `ID ${pointId}`;
    if (!confirm(`Er du sikker på at du vil slette punkt "${pointName}"?`)) {
        return;
    }

    mapPoints.splice(pointIndex, 1); // Fjern fra array
    drawMap(); // Tegn kartet på nytt
    updatePointList(); // Oppdater listen

    try {
        await saveCurrentMapData(); // Lagre endringen til DB
        logEvent(`Punkt "${pointName}" slettet fra kartet.`, 'Kart');
    } catch (error) {
        console.error(`Kunne ikke lagre kartdata etter sletting av punkt ${pointId}:`, error);
        // Bør kanskje legge punktet tilbake hvis lagring feilet? Mer komplekst.
        alert("Kunne ikke lagre endringen etter sletting av punkt.");
    }
}
// === 4: POINT HANDLING END ===

// === 5: INTERACTION MODE & STATUS START ===
/**
 * Setter gjeldende interaksjonsmodus for kartet.
 * @param {'view' | 'add-fixed' | 'add-checkpoint'} mode Den nye modusen.
 */
function setInteractionMode(mode) {
    currentInteractionMode = mode;
    console.log(`Kart interaksjonsmodus satt til: ${mode}`);

    // Oppdater UI (knapper og cursor)
    const addPointBtn = document.getElementById('add-point-mode');
    const addCheckpointBtn = document.getElementById('add-checkpoint-mode');

    // Reset stiler
    addPointBtn.classList.remove('active-mode');
    addCheckpointBtn.classList.remove('active-mode');
    mapCanvas.style.cursor = 'default'; // Standard peker

    // Sett aktiv stil
    if (mode === 'add-fixed') {
        addPointBtn.classList.add('active-mode');
        mapCanvas.style.cursor = 'crosshair';
    } else if (mode === 'add-checkpoint') {
        addCheckpointBtn.classList.add('active-mode');
        mapCanvas.style.cursor = 'crosshair';
    }
    // Hvis mode === 'view', er ingen knapper aktive og cursor er default
}

/**
 * Hjelpefunksjon for å konvertere museklikk-koordinater til canvas-koordinater.
 * @param {MouseEvent} event Museklikkeventet.
 * @returns {{x: number, y: number}} Koordinatene relative til canvas top-left.
 */
function getCanvasCoordinates(event) {
    if (!mapCanvas) return { x: 0, y: 0 };
    const rect = mapCanvas.getBoundingClientRect();
    // Juster for skalering hvis canvas er skalert i CSS
    const scaleX = mapCanvas.width / rect.width;
    const scaleY = mapCanvas.height / rect.height;
    // Juster for scroll på siden OG scroll inne i map-display-area
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const containerScrollX = mapCanvas.parentElement.scrollLeft || 0;
    const containerScrollY = mapCanvas.parentElement.scrollTop || 0;


    const x = (event.clientX - rect.left + containerScrollX) * scaleX;
    const y = (event.clientY - rect.top + containerScrollY) * scaleY;

    // Sørg for at koordinatene er innenfor canvas bounds
    const boundedX = Math.max(0, Math.min(mapCanvas.width, x));
    const boundedY = Math.max(0, Math.min(mapCanvas.height, y));

    // console.log(`Click: client(${event.clientX}, ${event.clientY}), rect(${rect.left}, ${rect.top}), scroll(${scrollX}, ${scrollY}), containerScroll(${containerScrollX}, ${containerScrollY}), scale(${scaleX}, ${scaleY}) => canvas(${x.toFixed(1)}, ${y.toFixed(1)}) => bounded(${boundedX.toFixed(1)}, ${boundedY.toFixed(1)})`);


    return { x: boundedX, y: boundedY };
}

/**
 * Setter statusmeldingen for kart-fanen.
 * @param {string} message Meldingen som skal vises.
 * @param {boolean} isError Om meldingen er en feilmelding (gir rød farge).
 */
function setMapStatus(message, isError = false) {
    const statusElement = document.querySelector('#map-tab p:first-of-type'); // Finner den første <p> i map-tab
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? 'red' : 'inherit';
        statusElement.style.fontWeight = isError ? 'bold' : 'normal';
    }
}
// === 5: INTERACTION MODE & STATUS END ===

// === 6: DATA SAVING START ===
/**
 * Lagrer gjeldende kartbilde (hvis lastet) og punkter til IndexedDB.
 * @param {string} [imageDataUrl] Base64 data for bildet. Bruker mapImage hvis ikke gitt.
 * @param {Array} [pointsToSave] Array med punkter. Bruker mapPoints hvis ikke gitt.
 * @param {string} [imageName] Navnet på bildefilen.
 */
async function saveCurrentMapData(imageDataUrl = null, pointsToSave = null, imageName = null) {
    const currentImageData = imageDataUrl || (mapImage ? mapImage.src : null);
    const currentPoints = pointsToSave || mapPoints;
    const currentImageName = imageName || document.getElementById('map-upload').files[0]?.name || 'Lagret kart'; // Prøv å hente filnavn

    if (!currentImageData) {
        // Ikke lagre hvis det ikke er noe bilde å lagre
        // Vi kan potensielt lagre bare punkter hvis ønskelig, men logikken antar et kart.
        console.warn("saveCurrentMapData: Ingen bildedata å lagre.");
        // Skal vi slette eksisterende kartdata hvis bildet fjernes? Kanskje ikke.
        // await deleteData(STORE_MAPDATA, currentMapId); // Vurder dette.
        return;
    }

    try {
        await saveMapData(currentMapId, currentImageData, currentPoints, currentImageName);
        console.log("Kartdata lagret til IndexedDB.");
        setRosterUnsavedChanges(false); // Bruker denne for å indikere "lagret" status generelt
    } catch (error) {
        console.error("Feil ved lagring av kartdata til storage:", error);
        logEvent(`Feil ved lagring av kartdata: ${error.message}`, 'Error');
        setMapStatus("Kunne ikke lagre kartendringer.", true);
        throw error; // Kast feilen videre slik at f.eks. handleCanvasClick kan reagere
    }
}

/**
 * Oppdaterer saveMapData i storage.js for å inkludere filnavn (overskriver forrige funksjon)
 * @param {string} mapId ID for kartet (f.eks. 'mainMap')
 * @param {string} imageData Base64 string for bildet
 * @param {Array} points Array av punktobjekter
 * @param {string} imageName Navnet på bildefilen
 * @returns {Promise<void>}
 */
async function saveMapData(mapId, imageData, points, imageName) {
    const data = {
        id: mapId,
        imageData: imageData,
        points: points || [],
        imageName: imageName || null, // Lagre navnet på bildet
        lastSaved: new Date().toISOString() // Lagre tidspunkt for siste lagring
    };
    // updateData (put) vil overskrive eksisterende data for denne mapId'en
    return updateData(STORE_MAPDATA, data);
}
// === 6: DATA SAVING END ===
