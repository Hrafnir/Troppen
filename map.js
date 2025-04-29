// === 0: ICON LIBRARY & DEFAULTS START ===
const ICON_LIBRARY = {
    // Nøkkel: Ikonnavn (brukes i data), Verdi: SVG-streng
    // Sørg for at SVGene har viewBox og gjerne width/height="100%" for enkel skalering.
    // Bruk fill="currentColor" der fargen skal settes dynamisk.
    'circle': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="currentColor"/></svg>`,
    'square': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="90" height="90" fill="currentColor"/></svg>`,
    'triangle': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 95,95 5,95" fill="currentColor"/></svg>`,
    'target': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="8"><circle cx="50" cy="50" r="45"/><circle cx="50" cy="50" r="25"/><path d="M50,5 V95 M5,50 H95"/></g></svg>`, // Må kanskje justeres for fill
    'flag': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M10,95 V5 H70 L60,15 H70 L60,25 H90 V45 H70 L60,35 H70 L60,45 H10 Z" fill="currentColor" stroke="black" stroke-width="2"/></svg>`,
    'person': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="25" r="15" fill="currentColor"/><path d="M50,40 V70 M20,95 H80 M50,70 L25,90 M50,70 L75,90 M25,55 H75" stroke="currentColor" stroke-width="8" fill="none"/></svg>`, // Må kanskje justeres for fill/stroke
    'vehicle': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M10 70 Q 10 60, 20 60 H 80 Q 90 60, 90 70 V 80 H 10 Z M 20 60 V 40 H 80 V 60 M 30 80 V 90 H 40 V 80 Z M 60 80 V 90 H 70 V 80 Z" fill="currentColor" stroke="black" stroke-width="2"/></svg>` // Eksempel kjøretøy
    // Legg til flere ikoner etter behov
};

const DEFAULT_POINT_ICON = 'circle';
const DEFAULT_POINT_COLOR = '#0000FF'; // Blå
const DEFAULT_POINT_SIZE = 16; // Pikselstørrelse (diameter/bredde)
// === 0: ICON LIBRARY & DEFAULTS END ===


// === 1: MAP MODULE VARIABLES START ===
let mapCanvas = null;
let mapContext = null;
let mapImage = null; // Holder det lastede kartbildet
let mapPoints = []; // Nå: Array for { id, x, y, type, name, icon, color, size, timestamp }
let currentMapId = 'mainMap';
let currentInteractionMode = 'view';
let isMapInitialized = false;
let pendingPointCoords = null; // For å lagre koordinater mens modal vises
let pointModalElement = null; // Referanse til modalen
let pointModalCallback = null; // Funksjon som kalles når modalen lagres
// === 1: MAP MODULE VARIABLES END ===

// === 2: INITIALIZATION START ===
function initializeMapModule() {
    mapCanvas = document.getElementById('map-canvas');
    const mapDisplayArea = document.getElementById('map-display-area');
    const mapUploadInput = document.getElementById('map-upload');
    const addPointBtn = document.getElementById('add-point-mode'); // Gjenbruker denne knappen
    const addCheckpointBtn = document.getElementById('add-checkpoint-mode'); // Gjenbruker denne

    // Modal elementer
    pointModalElement = document.getElementById('point-modal');
    const savePointBtn = document.getElementById('save-point-button');
    const cancelPointBtn = document.getElementById('cancel-point-button');
    const pointIconSelect = document.getElementById('point-icon');

    if (!mapCanvas || !mapDisplayArea || !mapUploadInput || !addPointBtn || !addCheckpointBtn || !pointModalElement || !savePointBtn || !cancelPointBtn || !pointIconSelect) {
        console.error("Kart-modul: Nødvendige HTML-elementer mangler (inkludert modal).");
        return;
    }
    mapContext = mapCanvas.getContext('2d');

    // Fyll ikon-select dropdown
    pointIconSelect.innerHTML = ''; // Tøm
    for (const iconName in ICON_LIBRARY) {
        const option = document.createElement('option');
        option.value = iconName;
        option.textContent = iconName.charAt(0).toUpperCase() + iconName.slice(1); // Gjør navnet penere
        pointIconSelect.appendChild(option);
    }

    // Event Listeners
    mapUploadInput.addEventListener('change', handleMapUpload);
    addPointBtn.addEventListener('click', () => setInteractionMode('add-point')); // Endret modusnavn
    addCheckpointBtn.addEventListener('click', () => setInteractionMode('add-point')); // Begge knappene starter samme modus nå
    mapCanvas.addEventListener('click', handleCanvasClick);

    // Modal listeners
    savePointBtn.addEventListener('click', handleSavePointModal);
    cancelPointBtn.addEventListener('click', handleCancelPointModal);
    // Lukk modal hvis man klikker utenfor? (Mer avansert)
    // pointModalElement.addEventListener('click', (e) => { if (e.target === pointModalElement) handleCancelPointModal(); });


    console.log("Kart-modul initialisert.");
    isMapInitialized = true;
    loadMapDataFromStorage();
}

async function loadMapDataFromStorage() {
    if (!isMapInitialized) return;
    console.log(`Laster kartdata for ${currentMapId}...`);
    try {
        const mapData = await getMapData(currentMapId);
        if (mapData && mapData.imageData) {
            // Sørg for at punkter har defaultverdier hvis de mangler (for eldre data)
            mapPoints = (mapData.points || []).map(p => ({
                ...p,
                icon: p.icon || DEFAULT_POINT_ICON,
                color: p.color || DEFAULT_POINT_COLOR,
                size: p.size || DEFAULT_POINT_SIZE,
                type: p.type || 'fixed' // Behold type foreløpig
            }));
            loadImageOntoCanvas(mapData.imageData);
            updatePointList();
            setMapStatus(`Kart "${mapData.imageName || 'Lagret kart'}" lastet.`);
        } else {
            console.log("Ingen lagret kartdata funnet.");
            clearMapDisplay();
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
// (handleMapUpload, loadImageOntoCanvas, drawMap, clearMapDisplay - Samme som forrige korrigerte versjon)
function handleMapUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert("Vennligst velg en gyldig bildefil.");
        event.target.value = null;
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageDataUrl = e.target.result;
        saveCurrentMapData(imageDataUrl, [], file.name) // Lagre nytt bilde, nullstill punkter
            .then(() => {
                loadImageOntoCanvas(imageDataUrl);
                mapPoints = []; // Nullstill punkter
                updatePointList();
                setMapStatus(`Kart "${file.name}" lastet opp.`);
                logEvent(`Nytt kart "${file.name}" lastet opp.`, 'Kart');
                event.target.value = null;
                setInteractionMode('view');
            })
            .catch(error => {
                console.error("Kunne ikke lagre det nye kartbildet:", error);
                setMapStatus("Kunne ikke lagre kart.", true);
                event.target.value = null;
            });
    };
    reader.onerror = (e) => {
        console.error("Feil ved lesing av fil:", e);
        alert("Kunne ikke lese bildefilen.");
        setMapStatus("Feil ved lesing av kartfil.", true);
        event.target.value = null;
    };
    reader.readAsDataURL(file);
}

function loadImageOntoCanvas(imageDataUrl) {
    if (!mapContext) return;
    mapImage = new Image();
    mapImage.onload = () => {
        console.log(`Bildet lastet: ${mapImage.width}x${mapImage.height}`);
        drawMap();
    };
    mapImage.onerror = () => {
        console.error("Kunne ikke laste bilde fra data URL.");
        alert("En feil oppstod ved lasting av kartbildet.");
        setMapStatus("Feil ved visning av kart.", true);
        mapImage = null;
        clearMapDisplay();
    };
    mapImage.src = imageDataUrl;
}

function drawMap() {
    if (!mapContext || !mapCanvas) return;
    if (mapImage) {
        mapCanvas.width = mapImage.width;
        mapCanvas.height = mapImage.height;
        mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
        mapContext.drawImage(mapImage, 0, 0);
        drawPoints(); // Tegn punkter oppå
        console.log("Kart tegnet på canvas.");
    } else {
        clearMapDisplay();
        console.log("Ingen kartbilde å tegne.");
    }
}

function clearMapDisplay() {
     if (!mapContext || !mapCanvas) return;
     mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
     mapCanvas.width = 300;
     mapCanvas.height = 150;
     mapImage = null;
     mapPoints = [];
     updatePointList();
     setInteractionMode('view');
}
// === 3: MAP IMAGE HANDLING END ===

// === 4: POINT HANDLING START ===
/**
 * Tegner alle lagrede punkter på kartet med ikoner, farger og størrelser.
 */
 function drawPoints() {
    if (!mapContext || !mapImage) return;

    mapPoints.forEach(point => {
        const iconSvg = ICON_LIBRARY[point.icon] || ICON_LIBRARY[DEFAULT_POINT_ICON];
        const color = point.color || DEFAULT_POINT_COLOR;
        const size = point.size || DEFAULT_POINT_SIZE;

        // Erstatt farge i SVG-strengen (forenklet - antar fill="currentColor")
        // En mer robust løsning ville parse SVG-en eller bruke mer spesifikke attributter.
        const coloredSvg = iconSvg.replace(/currentColor/g, color);

        // Lag en Image fra SVG data URL for å tegne på canvas
        const svgImage = new Image();

        // Viktig: Må vente på at SVG-bildet er lastet før tegning
        // Dette kan gi litt "pop-in" effekt hvis det er mange unike ikoner/farger.
        // Optimalisering: Cache genererte Image-objekter basert på ikon+farge+størrelse.
        svgImage.onload = () => {
            // Tegn bildet sentrert på (point.x, point.y)
            const drawX = point.x - size / 2;
            const drawY = point.y - size / 2;
            mapContext.drawImage(svgImage, drawX, drawY, size, size);

            // Tegn navn ved siden av (justert for størrelse)
            mapContext.fillStyle = 'black'; // Alltid svart tekst? Eller bruke point.color?
            mapContext.strokeStyle = 'white'; // Hvit outline for lesbarhet
            mapContext.lineWidth = 2;
            mapContext.font = `${Math.max(10, size * 0.7)}px sans-serif`; // Skaler font litt med størrelse
            const textX = point.x + size / 2 + 5; // Litt til høyre for ikonet
            const textY = point.y + size / 4;    // Litt nedenfor midten vertikalt
             mapContext.strokeText(point.name || `ID ${point.id}`, textX, textY); // Tegn outline først
             mapContext.fillText(point.name || `ID ${point.id}`, textX, textY); // Tegn fylt tekst oppå
        };
        svgImage.onerror = (e) => {
            console.error(`Kunne ikke laste SVG-ikon for punkt ${point.id}:`, e);
            // Fallback: Tegn en enkel sirkel
            mapContext.fillStyle = color;
            mapContext.beginPath();
            mapContext.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
            mapContext.fill();
        };

        // Konverter SVG-strengen til base64 data URL
        try {
             const svgBlob = new Blob([coloredSvg], { type: 'image/svg+xml;charset=utf-8' });
             const url = URL.createObjectURL(svgBlob);
             svgImage.src = url;
             // Vi må rydde opp URLen etterpå, men onload/onerror kan fyre senere.
             // Dette er en potensiell minnelekkasje hvis det ikke håndteres.
             // En bedre løsning ville brukt `btoa` direkte hvis vi vet SVG er enkel nok.
             // svgImage.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(coloredSvg)));

             // La oss prøve btoa-metoden, den er synkron og unngår URL.createObjectURL
             svgImage.src = "data:image/svg+xml;base64," + btoa(coloredSvg);


        } catch (e) {
             console.error("Feil ved konvertering av SVG til Data URL:", e);
              svgImage.onerror(e); // Kall onerror manuelt ved feil
        }
    });
}


/**
 * Håndterer klikk på kart-canvas for å starte prosessen med å legge til punkt.
 * @param {MouseEvent} event Klikkeventet.
 */
function handleCanvasClick(event) {
    if (!mapImage) {
        alert("Du må laste opp et kartbilde før du kan legge til punkter.");
        return;
    }
    if (currentInteractionMode !== 'add-point') {
         console.log("Klikk på kart utenfor 'add-point'-modus, ignorerer.");
         // Senere: Implementer valg/info om eksisterende punkt her.
         return;
    }

    pendingPointCoords = getCanvasCoordinates(event); // Lagre koordinatene
    console.log("Åpner modal for å legge til nytt punkt ved", pendingPointCoords);
    showAddPointModal(pendingPointCoords.x, pendingPointCoords.y);
    setInteractionMode('view'); // Gå ut av add-modus mens modal vises
}

/**
 * Oppdaterer HTML-listen over plottede punkter, inkludert ikon-preview.
 */
function updatePointList() {
    const listElement = document.querySelector('#map-point-list ul');
    if (!listElement) return;

    listElement.innerHTML = '';
    if (mapPoints.length === 0) {
        listElement.innerHTML = '<li>Ingen punkter plottet ennå.</li>';
    } else {
        mapPoints.forEach(point => {
            const li = document.createElement('li');

            // Ikon preview
            const iconPreview = document.createElement('span');
            iconPreview.style.display = 'inline-block';
            iconPreview.style.width = `${DEFAULT_POINT_SIZE}px`; // Bruk default size for preview
            iconPreview.style.height = `${DEFAULT_POINT_SIZE}px`;
            iconPreview.style.marginRight = '8px';
            iconPreview.style.verticalAlign = 'middle';
            const iconSvg = ICON_LIBRARY[point.icon] || ICON_LIBRARY[DEFAULT_POINT_ICON];
            const coloredSvg = iconSvg.replace(/currentColor/g, point.color || DEFAULT_POINT_COLOR);
            // Bruk data-URL for å vise SVG i et img-element (enklere for liste)
            iconPreview.innerHTML = `<img src="data:image/svg+xml;base64,${btoa(coloredSvg)}" width="${DEFAULT_POINT_SIZE}" height="${DEFAULT_POINT_SIZE}" alt="${point.icon}">`;


            // Tekst-info
            const textSpan = document.createElement('span');
            textSpan.textContent = ` ${point.name || `ID: ${point.id}`} (X: ${point.x.toFixed(0)}, Y: ${point.y.toFixed(0)}) - ${point.size}px`;
            textSpan.style.flexGrow = '1'; // La teksten ta opp plassen

             // Edit-knapp (placeholder)
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.title = 'Rediger punkt (ikke implementert)';
            editBtn.style.marginLeft = '10px';
            editBtn.disabled = true; // Deaktivert foreløpig
            // editBtn.onclick = () => handleEditPoint(point.id);

            // Delete-knapp
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Slett punkt';
            deleteBtn.onclick = () => handleDeletePoint(point.id);

            li.appendChild(iconPreview);
            li.appendChild(textSpan);
            li.appendChild(editBtn);
            li.appendChild(deleteBtn);
            listElement.appendChild(li);
        });
    }
}


async function handleDeletePoint(pointId) {
    const pointIndex = mapPoints.findIndex(p => p.id === pointId);
    if (pointIndex === -1) return;

    const pointName = mapPoints[pointIndex].name || `ID ${pointId}`;
    if (!confirm(`Er du sikker på at du vil slette punkt "${pointName}"?`)) return;

    mapPoints.splice(pointIndex, 1);
    drawMap();
    updatePointList();

    try {
        await saveCurrentMapData();
        logEvent(`Punkt "${pointName}" slettet fra kartet.`, 'Kart');
    } catch (error) {
        console.error(`Kunne ikke lagre kartdata etter sletting av punkt ${pointId}:`, error);
        alert("Kunne ikke lagre endringen etter sletting av punkt.");
        // Bør legge punktet tilbake? For nå lar vi det være slettet fra UI.
    }
}
// === 4: POINT HANDLING END ===

// === 5: INTERACTION MODE & POINT MODAL START ===
/**
 * Setter gjeldende interaksjonsmodus for kartet.
 * @param {'view' | 'add-point'} mode Den nye modusen.
 */
function setInteractionMode(mode) {
    currentInteractionMode = mode;
    console.log(`Kart interaksjonsmodus satt til: ${mode}`);

    const addPointBtn = document.getElementById('add-point-mode');
    const addCheckpointBtn = document.getElementById('add-checkpoint-mode');

    addPointBtn.classList.remove('active-mode');
    addCheckpointBtn.classList.remove('active-mode');
    mapCanvas.style.cursor = 'default';

    if (mode === 'add-point') {
        addPointBtn.classList.add('active-mode');
        addCheckpointBtn.classList.add('active-mode');
        mapCanvas.style.cursor = 'crosshair';
    }
}

function getCanvasCoordinates(event) {
    if (!mapCanvas) return { x: 0, y: 0 };
    const rect = mapCanvas.getBoundingClientRect();
    const scaleX = mapCanvas.width / rect.width;
    const scaleY = mapCanvas.height / rect.height;
    const containerScrollX = mapCanvas.parentElement.scrollLeft || 0;
    const containerScrollY = mapCanvas.parentElement.scrollTop || 0;
    const x = (event.clientX - rect.left + containerScrollX) * scaleX;
    const y = (event.clientY - rect.top + containerScrollY) * scaleY;
    const boundedX = Math.max(0, Math.min(mapCanvas.width, x));
    const boundedY = Math.max(0, Math.min(mapCanvas.height, y));
    return { x: boundedX, y: boundedY };
}

function setMapStatus(message, isError = false) {
    const statusElement = document.querySelector('#map-tab p:first-of-type');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? 'red' : 'inherit';
        statusElement.style.fontWeight = isError ? 'bold' : 'normal';
    }
}

/**
 * Viser modalen for å legge til et nytt punkt og setter opp preview.
 * @param {number} x X-koordinat for det nye punktet.
 * @param {number} y Y-koordinat for det nye punktet.
 */
function showAddPointModal(x, y) {
    if (!pointModalElement) return;
    pendingPointCoords = { x, y }; // Lagre koordinater

    // Hent referanser til modal-inputs
    const nameInput = document.getElementById('point-name');
    const iconSelect = document.getElementById('point-icon');
    const colorInput = document.getElementById('point-color');
    const sizeInput = document.getElementById('point-size');
    const sizeLabel = document.getElementById('point-size-label');

    // Sett default verdier i modalen
    nameInput.value = '';
    iconSelect.value = DEFAULT_POINT_ICON;
    colorInput.value = DEFAULT_POINT_COLOR;
    sizeInput.value = DEFAULT_POINT_SIZE;
    sizeLabel.textContent = `(${DEFAULT_POINT_SIZE}px)`; // Oppdater label
    document.getElementById('point-modal-title').textContent = 'Legg til nytt punkt';

    // Sett opp event listeners for live preview (kun når modalen vises)
    // Fjern gamle listeners først for sikkerhets skyld
    iconSelect.removeEventListener('change', updatePointPreview);
    colorInput.removeEventListener('input', updatePointPreview);
    sizeInput.removeEventListener('input', updatePointPreview);
    // Legg til nye
    iconSelect.addEventListener('change', updatePointPreview);
    colorInput.addEventListener('input', updatePointPreview);
    sizeInput.addEventListener('input', updatePointPreview);


    // Oppdater preview med default verdier
    updatePointPreview();

    // Vis modalen
    pointModalElement.style.display = 'block';
    nameInput.focus();
}

/**
 * Oppdaterer forhåndsvisningen av ikonet i modalen.
 */
function updatePointPreview() {
    const previewArea = document.getElementById('point-preview');
    const iconSelect = document.getElementById('point-icon');
    const colorInput = document.getElementById('point-color');
    const sizeInput = document.getElementById('point-size');
    const sizeLabel = document.getElementById('point-size-label');

    if (!previewArea || !iconSelect || !colorInput || !sizeInput) return;

    const iconName = iconSelect.value;
    const color = colorInput.value;
    const size = parseInt(sizeInput.value, 10) || DEFAULT_POINT_SIZE;

    // Oppdater størrelseslabel
    sizeLabel.textContent = `(${size}px)`;

    const iconSvg = ICON_LIBRARY[iconName] || ICON_LIBRARY[DEFAULT_POINT_ICON];
    const coloredSvg = iconSvg.replace(/currentColor/g, color);

    try {
        // Bruk base64 data URL direkte i et img-tag for enkel visning
        const base64Svg = btoa(coloredSvg);
        previewArea.innerHTML = `<img src="data:image/svg+xml;base64,${base64Svg}" width="${size}" height="${size}" alt="Preview">`;
    } catch (e) {
        console.error("Feil ved generering av SVG preview:", e);
        previewArea.innerHTML = 'Feil'; // Vis feilmelding i preview
    }
}


/**
 * Håndterer lagring fra punkt-modalen.
 */
async function handleSavePointModal() {
    if (!pointModalElement || !pendingPointCoords) return;

    const name = document.getElementById('point-name').value.trim();
    const icon = document.getElementById('point-icon').value;
    const color = document.getElementById('point-color').value;
    const size = parseInt(document.getElementById('point-size').value, 10) || DEFAULT_POINT_SIZE;

    const newPoint = {
        id: Date.now(),
        x: pendingPointCoords.x,
        y: pendingPointCoords.y,
        type: 'custom',
        name: name,
        icon: icon,
        color: color,
        size: size,
        timestamp: new Date().toISOString()
    };

    mapPoints.push(newPoint);
    closePointModal(); // Kall felles lukkefunksjon

    drawMap();
    updatePointList();
    try {
        await saveCurrentMapData();
        logEvent(`La til punkt "${newPoint.name || 'uten navn'}" (ID: ${newPoint.id}) på kartet.`, 'Kart');
    } catch (error) {
        console.error("Kunne ikke lagre nytt punkt:", error);
        mapPoints.pop();
        drawMap();
        updatePointList();
        alert("Kunne ikke lagre det nye punktet.");
    }
}

/**
 * Håndterer avbryt fra punkt-modalen.
 */
function handleCancelPointModal() {
    closePointModal();
    console.log("Modal avbrutt.");
}

/**
 * Lukker modalen og rydder opp listeners/state.
 */
function closePointModal() {
     if (!pointModalElement) return;
     pointModalElement.style.display = 'none';
     pendingPointCoords = null;

     // Fjern event listeners for live preview for å unngå duplikater
     document.getElementById('point-icon')?.removeEventListener('change', updatePointPreview);
     document.getElementById('point-color')?.removeEventListener('input', updatePointPreview);
     document.getElementById('point-size')?.removeEventListener('input', updatePointPreview);
}
// === 5: INTERACTION MODE & POINT MODAL END ===

// === 6: DATA SAVING START ===
/**
 * Lagrer gjeldende kartbilde (hvis lastet) og punkter til IndexedDB.
 * @param {string} [imageDataUrl] Base64 data for bildet. Bruker mapImage hvis ikke gitt.
 * @param {Array} [pointsToSave] Array med punkter. Bruker mapPoints hvis ikke gitt.
 * @param {string} [imageName] Navnet på bildefilen.
 */
async function saveCurrentMapData(imageDataUrl = null, pointsToSave = null, imageName = null) {
    const currentImageData = imageDataUrl || (mapImage ? mapImage.src : null);
    // Sørg for at vi lagrer punkter med alle nye felter
    const currentPoints = (pointsToSave || mapPoints).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        type: p.type,
        name: p.name,
        icon: p.icon || DEFAULT_POINT_ICON,
        color: p.color || DEFAULT_POINT_COLOR,
        size: p.size || DEFAULT_POINT_SIZE,
        timestamp: p.timestamp
    }));
    const currentImageName = imageName || document.getElementById('map-upload')?.files[0]?.name || mapImage?.dataset?.fileName || 'Lagret kart';

    if (!currentImageData) {
        console.warn("saveCurrentMapData: Ingen bildedata å lagre.");
        return; // Ikke lagre hvis kart mangler
    }

    try {
        // Bruker den oppdaterte saveMapData i storage.js (trenger ikke endres, den lagrer objektet den får)
        await saveMapData(currentMapId, currentImageData, currentPoints, currentImageName);
        console.log("Kartdata lagret til IndexedDB.");
        // setRosterUnsavedChanges(false); // Kanskje ikke bruke denne for kart?
    } catch (error) {
        console.error("Feil ved lagring av kartdata til storage:", error);
        logEvent(`Feil ved lagring av kartdata: ${error.message}`, 'Error');
        setMapStatus("Kunne ikke lagre kartendringer.", true);
        throw error;
    }
}

// saveMapData i storage.js er generisk nok og trenger ikke endres her.
// Vi må bare sikre at vi sender inn riktig data til den.
// === 6: DATA SAVING END ===
