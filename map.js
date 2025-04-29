// === 0: ICON LIBRARY & DEFAULTS START ===
const ICON_LIBRARY = {
    'circle': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="currentColor"/></svg>`,
    'square': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="90" height="90" fill="currentColor"/></svg>`,
    'triangle': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 95,95 5,95" fill="currentColor"/></svg>`,
    'target': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="8"><circle cx="50" cy="50" r="45"/><circle cx="50" cy="50" r="25"/><path d="M50,5 V95 M5,50 H95"/></g></svg>`,
    'flag': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M10,95 V5 H70 L60,15 H70 L60,25 H90 V45 H70 L60,35 H70 L60,45 H10 Z" fill="currentColor" stroke="black" stroke-width="2"/></svg>`,
    'person': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="25" r="15" fill="currentColor"/><path d="M50,40 V70 M20,95 H80 M50,70 L25,90 M50,70 L75,90 M25,55 H75" stroke="currentColor" stroke-width="8" fill="none"/></svg>`,
    'vehicle': `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M10 70 Q 10 60, 20 60 H 80 Q 90 60, 90 70 V 80 H 10 Z M 20 60 V 40 H 80 V 60 M 30 80 V 90 H 40 V 80 Z M 60 80 V 90 H 70 V 80 Z" fill="currentColor" stroke="black" stroke-width="2"/></svg>`
};

const DEFAULT_POINT_ICON = 'circle';
const DEFAULT_POINT_COLOR = '#0000FF'; // Blå
const DEFAULT_POINT_SIZE = 16;
// === 0: ICON LIBRARY & DEFAULTS END ===


// === 1: MAP MODULE VARIABLES START ===
let mapCanvas = null;
let mapContext = null;
let mapImage = null;
let mapPoints = []; // Nå: { id, x, y, type, name, icon, color, size, locked, timestamp }
let currentMapId = 'mainMap';
let currentInteractionMode = 'view'; // 'view', 'add-point'
let isMapInitialized = false;
// Variables for remembering last used style
let lastUsedIcon = DEFAULT_POINT_ICON;
let lastUsedColor = DEFAULT_POINT_COLOR;
let lastUsedSize = DEFAULT_POINT_SIZE;
// Variables for point dragging
let isDragging = false;
let draggedPointId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
// Modal elements (kun for redigering nå)
let pointModalElement = null;
let currentlyEditingPointId = null;
// === 1: MAP MODULE VARIABLES END ===

// === 2: INITIALIZATION START ===
function initializeMapModule() {
    mapCanvas = document.getElementById('map-canvas');
    const mapDisplayArea = document.getElementById('map-display-area');
    const mapUploadInput = document.getElementById('map-upload');
    const addPointBtn = document.getElementById('add-point-mode');
    const addCheckpointBtn = document.getElementById('add-checkpoint-mode'); // Kan fjernes eller gjenbrukes

    // Modal (kun for redigering nå, men trenger referanser)
    pointModalElement = document.getElementById('point-modal');
    const savePointBtn = document.getElementById('save-point-button');
    const cancelPointBtn = document.getElementById('cancel-point-button');
    const pointIconSelect = document.getElementById('point-icon'); // Trengs for å fylle dropdown

    if (!mapCanvas || !mapDisplayArea || !mapUploadInput || !addPointBtn || !addCheckpointBtn || !pointModalElement || !savePointBtn || !cancelPointBtn || !pointIconSelect) {
        console.error("Kart-modul: Nødvendige HTML-elementer mangler.");
        return;
    }
    mapContext = mapCanvas.getContext('2d');

    // Fyll ikon-select dropdown (selv om den ikke brukes for å legge til nye)
    pointIconSelect.innerHTML = '';
    for (const iconName in ICON_LIBRARY) {
        const option = document.createElement('option');
        option.value = iconName;
        option.textContent = iconName.charAt(0).toUpperCase() + iconName.slice(1);
        pointIconSelect.appendChild(option);
    }

    // --- EVENT LISTENERS ---
    mapUploadInput.addEventListener('change', handleMapUpload);
    addPointBtn.addEventListener('click', () => setInteractionMode('add-point'));
    addCheckpointBtn.addEventListener('click', () => setInteractionMode('add-point')); // Begge gjør det samme

    // Klikk for å legge til punkt ELLER starte flytting
    mapCanvas.addEventListener('mousedown', handleMouseDown); // Endret fra 'click'
    mapCanvas.addEventListener('mousemove', handleMouseMove);
    mapCanvas.addEventListener('mouseup', handleMouseUp);
    mapCanvas.addEventListener('mouseleave', handleMouseLeave); // Stopp dragging hvis mus forlater canvas

    // Modal listeners (for redigering)
    savePointBtn.addEventListener('click', handleSavePointModal);
    cancelPointBtn.addEventListener('click', handleCancelPointModal);


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
            mapPoints = (mapData.points || []).map(p => ({
                ...p,
                icon: p.icon || DEFAULT_POINT_ICON,
                color: p.color || DEFAULT_POINT_COLOR,
                size: p.size || DEFAULT_POINT_SIZE,
                locked: p.locked || false, // Default til ulåst
                type: p.type || 'custom' // Default til 'custom'
            }));
            // Oppdater sist brukte stil basert på det siste punktet i listen (hvis det finnes)
            if (mapPoints.length > 0) {
                const lastPoint = mapPoints[mapPoints.length - 1];
                lastUsedIcon = lastPoint.icon;
                lastUsedColor = lastPoint.color;
                lastUsedSize = lastPoint.size;
                console.log("Sist brukte stil gjenopprettet:", lastUsedIcon, lastUsedColor, lastUsedSize);
            }

            loadImageOntoCanvas(mapData.imageData);
            updatePointList();
            setMapStatus(`Kart "${mapData.imageName || 'Lagret kart'}" lastet.`);
        } else {
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
// Ingen endringer her fra forrige versjon
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
        saveCurrentMapData(imageDataUrl, [], file.name)
            .then(() => {
                loadImageOntoCanvas(imageDataUrl);
                mapPoints = [];
                updatePointList();
                setMapStatus(`Kart "${file.name}" lastet opp.`);
                logEvent(`Nytt kart "${file.name}" lastet opp.`, 'Kart');
                event.target.value = null;
                setInteractionMode('view');
                // Nullstill sist brukte stil når nytt kart lastes
                lastUsedIcon = DEFAULT_POINT_ICON;
                lastUsedColor = DEFAULT_POINT_COLOR;
                lastUsedSize = DEFAULT_POINT_SIZE;
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
        drawPoints();
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
     // Nullstill sist brukte stil
     lastUsedIcon = DEFAULT_POINT_ICON;
     lastUsedColor = DEFAULT_POINT_COLOR;
     lastUsedSize = DEFAULT_POINT_SIZE;
}
// === 3: MAP IMAGE HANDLING END ===

// === 4: POINT HANDLING (DRAWING, DELETING, LIST) START ===
// drawPoints - Må kanskje legge til visuell indikasjon på flytting?
function drawPoints() {
    if (!mapContext || !mapImage) return;

    mapPoints.forEach(point => {
        const iconSvg = ICON_LIBRARY[point.icon] || ICON_LIBRARY[DEFAULT_POINT_ICON];
        const color = point.color || DEFAULT_POINT_COLOR;
        const size = point.size || DEFAULT_POINT_SIZE;
        const isBeingDragged = isDragging && point.id === draggedPointId;

        const svgImage = new Image();

        svgImage.onload = () => {
            mapContext.save(); // Lagre state før transformasjoner/opacity
            const drawX = point.x - size / 2;
            const drawY = point.y - size / 2;

            if (point.locked) {
                mapContext.globalAlpha = 0.6; // Gjør låste punkter litt gjennomsiktige
            }
            if (isBeingDragged) {
                 mapContext.globalAlpha = 0.7; // Gjør punktet litt gjennomsiktig under flytting
                 mapContext.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Skyggeeffekt
                 mapContext.shadowBlur = 5;
                 mapContext.shadowOffsetX = 2;
                 mapContext.shadowOffsetY = 2;
            }

            mapContext.drawImage(svgImage, drawX, drawY, size, size);

            // Tegn navn
            mapContext.globalAlpha = 1.0; // Full opacity for tekst (selv om punkt er låst/dratt)
            mapContext.shadowColor = 'transparent'; // Fjern skygge for tekst
            mapContext.fillStyle = 'black';
            mapContext.strokeStyle = 'white';
            mapContext.lineWidth = 2;
            mapContext.font = `${Math.max(10, size * 0.7)}px sans-serif`;
            const textX = point.x + size / 2 + 5;
            const textY = point.y + size / 4;
            mapContext.strokeText(point.name || `ID ${point.id}`, textX, textY);
            mapContext.fillText(point.name || `ID ${point.id}`, textX, textY);

            mapContext.restore(); // Gjenopprett state (opacity, shadow etc.)
        };
        svgImage.onerror = (e) => {
            console.error(`Kunne ikke laste SVG-ikon for punkt ${point.id}:`, e);
            mapContext.fillStyle = color;
            mapContext.beginPath();
            mapContext.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
            mapContext.fill();
        };
        try {
            const coloredSvg = iconSvg.replace(/currentColor/g, color);
            svgImage.src = "data:image/svg+xml;base64," + btoa(coloredSvg);
        } catch (e) {
             console.error("Feil ved konvertering av SVG til Data URL:", e);
             svgImage.onerror(e);
        }
    });
}

// updatePointList - Legg til låseknapp
function updatePointList() {
    const listElement = document.querySelector('#map-point-list ul');
    if (!listElement) return;

    listElement.innerHTML = '';
    if (mapPoints.length === 0) {
        listElement.innerHTML = '<li>Ingen punkter plottet ennå.</li>';
    } else {
        // Sorter punkter etter ID (eller navn?)
        mapPoints.sort((a, b) => a.id - b.id);

        mapPoints.forEach(point => {
            const li = document.createElement('li');
            li.dataset.pointId = point.id; // Legg til ID for referanse
            li.classList.toggle('locked-point-item', point.locked); // Klasse for styling av låste

            // Ikon preview
            const iconPreview = document.createElement('span');
            iconPreview.classList.add('point-list-preview'); // Klasse for styling
            iconPreview.style.width = `${DEFAULT_POINT_SIZE}px`;
            iconPreview.style.height = `${DEFAULT_POINT_SIZE}px`;
            const iconSvg = ICON_LIBRARY[point.icon] || ICON_LIBRARY[DEFAULT_POINT_ICON];
            const coloredSvg = iconSvg.replace(/currentColor/g, point.color || DEFAULT_POINT_COLOR);
            try {
                iconPreview.innerHTML = `<img src="data:image/svg+xml;base64,${btoa(coloredSvg)}" width="${DEFAULT_POINT_SIZE}" height="${DEFAULT_POINT_SIZE}" alt="${point.icon}">`;
            } catch { iconPreview.innerHTML = '?'; }

            // Tekst-info
            const textSpan = document.createElement('span');
            textSpan.textContent = ` ${point.name || `ID: ${point.id}`} (X: ${point.x.toFixed(0)}, Y: ${point.y.toFixed(0)}) - ${point.size}px`;
            textSpan.style.flexGrow = '1';
            if (point.locked) {
                textSpan.textContent += " (Låst)";
            }

            // Edit-knapp (Aktiverer modal)
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.title = 'Rediger punkt';
            editBtn.onclick = () => handleEditPoint(point.id); // Kall redigeringsfunksjon

             // Lock/Unlock-knapp
            const lockBtn = document.createElement('button');
            lockBtn.textContent = point.locked ? '🔓' : '🔒'; // Viser låst/ulåst ikon
            lockBtn.title = point.locked ? 'Lås opp punkt' : 'Lås punkt (hindrer flytting)';
            lockBtn.onclick = () => togglePointLock(point.id);

            // Delete-knapp
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Slett punkt';
            deleteBtn.onclick = () => handleDeletePoint(point.id);

            li.appendChild(iconPreview);
            li.appendChild(textSpan);
            li.appendChild(editBtn);
            li.appendChild(lockBtn); // La til låseknapp
            li.appendChild(deleteBtn);
            listElement.appendChild(li);
        });
    }
}


async function handleDeletePoint(pointId) {
    // Samme som før
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
    }
}

/**
 * Toggler låsestatus for et punkt.
 * @param {number} pointId ID-en til punktet.
 */
async function togglePointLock(pointId) {
     const point = mapPoints.find(p => p.id === pointId);
     if (!point) return;

     point.locked = !point.locked; // Toggle statusen
     console.log(`Punkt ${pointId} ${point.locked ? 'låst' : 'låst opp'}.`);

     updatePointList(); // Oppdater UI i listen
     // Trenger ikke tegne kartet på nytt med mindre vi har visuell indikasjon der

     try {
         await saveCurrentMapData(); // Lagre endringen
         logEvent(`Punkt "${point.name || point.id}" ${point.locked ? 'låst' : 'låst opp'}.`, 'Kart');
     } catch (error) {
         console.error(`Kunne ikke lagre låsestatus for punkt ${pointId}:`, error);
         // Reverser endringen i UI hvis lagring feilet?
         point.locked = !point.locked; // Reverser
         updatePointList();
         alert("Kunne ikke lagre endring av låsestatus.");
     }
 }
// === 4: POINT HANDLING (DRAWING, DELETING, LIST) END ===

// === 5: POINT CREATION, EDITING & DRAGGING START ===
function setInteractionMode(mode) {
    // Gå ut av modus hvis man klikker knappen på nytt?
    if (currentInteractionMode === mode && mode === 'add-point') {
        mode = 'view'; // Gå tilbake til view hvis man klikker add-point igjen
    }
    currentInteractionMode = mode;
    console.log(`Kart interaksjonsmodus satt til: ${mode}`);

    const addPointBtn = document.getElementById('add-point-mode');
    const addCheckpointBtn = document.getElementById('add-checkpoint-mode'); // Bør kanskje fjernes/endres

    addPointBtn.classList.remove('active-mode');
    addCheckpointBtn.classList.remove('active-mode'); // Fjern fra begge
    mapCanvas.style.cursor = 'default'; // Tilbakestill cursor

    if (mode === 'add-point') {
        addPointBtn.classList.add('active-mode'); // Fremhev kun én knapp
        mapCanvas.style.cursor = 'crosshair';
    }
}

function getCanvasCoordinates(event) {
    // Samme som før
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
    // Samme som før
    const statusElement = document.querySelector('#map-tab p:first-of-type');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? 'red' : 'inherit';
        statusElement.style.fontWeight = isError ? 'bold' : 'normal';
    }
}

/**
 * Håndterer mousedown: Enten starte flytting eller legge til nytt punkt.
 */
function handleMouseDown(event) {
    if (event.button !== 0) return; // Ignorer andre museknapper enn venstre

    const coords = getCanvasCoordinates(event);

    if (currentInteractionMode === 'add-point') {
        // Legg til nytt punkt med prompt (rask metode)
        addNewPointSimple(coords.x, coords.y);
        // Valgfritt: Gå tilbake til view-modus etter å ha lagt til?
        // setInteractionMode('view');
    } else if (currentInteractionMode === 'view') {
        // Prøv å starte flytting av et eksisterende punkt
        const clickedPoint = findPointAt(coords.x, coords.y);
        if (clickedPoint && !clickedPoint.locked) {
            isDragging = true;
            draggedPointId = clickedPoint.id;
            // Beregn offset fra punktets senter til museklikket
            dragOffsetX = coords.x - clickedPoint.x;
            dragOffsetY = coords.y - clickedPoint.y;
            mapCanvas.style.cursor = 'grabbing'; // Endre cursor under flytting
            console.log(`Starter flytting av punkt ${draggedPointId}`);
            drawMap(); // Tegn om for å vise eventuell dra-effekt
        } else if (clickedPoint && clickedPoint.locked) {
             console.log(`Forsøkte å flytte låst punkt ${clickedPoint.id}`);
             // Gi en visuell indikasjon? F.eks. en kort shake-animasjon? (Avansert)
             alert("Dette punktet er låst og kan ikke flyttes.");
        }
    }
}

/**
 * Håndterer mousemove: Flytter punktet hvis dragging er aktiv.
 */
function handleMouseMove(event) {
    if (!isDragging || draggedPointId === null) return;

    const point = mapPoints.find(p => p.id === draggedPointId);
    if (!point) { // Sikkerhetssjekk
        isDragging = false;
        return;
    }

    const coords = getCanvasCoordinates(event);
    // Oppdater punktets posisjon basert på musposisjon og initiell offset
    point.x = coords.x - dragOffsetX;
    point.y = coords.y - dragOffsetY;

    // Begrens til kartets grenser (selv om getCanvasCoordinates også gjør det)
    point.x = Math.max(0, Math.min(mapCanvas.width, point.x));
    point.y = Math.max(0, Math.min(mapCanvas.height, point.y));


    // Tegn kartet på nytt for å vise flyttingen (requestAnimationFrame er bedre for ytelse)
     requestAnimationFrame(drawMap);
    // drawMap(); // Enklere, men kan lugge
}

/**
 * Håndterer mouseup: Avslutter flytting og lagrer.
 */
async function handleMouseUp(event) {
    if (!isDragging || draggedPointId === null) return;

    console.log(`Avslutter flytting av punkt ${draggedPointId}`);
    isDragging = false;
    mapCanvas.style.cursor = 'default'; // Tilbakestill cursor

    // Finn det flyttede punktet for logging/oppdatering
    const movedPoint = mapPoints.find(p => p.id === draggedPointId);

    drawMap(); // Tegn en siste gang i normal tilstand
    updatePointList(); // Oppdater koordinatene i listen

    try {
        await saveCurrentMapData(); // Lagre den nye posisjonen
        if (movedPoint) {
            logEvent(`Punkt "${movedPoint.name || movedPoint.id}" flyttet til (X: ${movedPoint.x.toFixed(0)}, Y: ${movedPoint.y.toFixed(0)}).`, 'Kart');
        }
    } catch (error) {
        console.error(`Kunne ikke lagre ny posisjon for punkt ${draggedPointId}:`, error);
        alert("Kunne ikke lagre den nye posisjonen for punktet.");
        // Bør ideelt sett resette posisjonen hvis lagring feiler, men det krever å huske forrige posisjon.
    } finally {
        draggedPointId = null; // Nullstill uansett
    }
}

/**
 * Håndterer mouseleave: Avbryter flytting hvis musen forlater canvas.
 */
function handleMouseLeave(event) {
    if (isDragging) {
        console.log("Flytting avbrutt (mus forlot canvas).");
        // Vi kan velge å enten lagre der den er, eller resette til forrige posisjon.
        // For enkelhets skyld, lagrer vi der den er nå (samme som mouseup).
         handleMouseUp(event); // Kall mouseup for å lagre og rydde opp
    }
}


/**
 * Finner et punkt nær gitte koordinater.
 * @param {number} x X-koordinat.
 * @param {number} y Y-koordinat.
 * @returns {object|null} Punktobjektet hvis funnet, ellers null.
 */
function findPointAt(x, y) {
    const clickRadius = 15; // Hvor nærme man må klikke (i piksler) - bør kanskje skaleres med punktstørrelse?
    // Søk baklengs slik at punkter tegnet sist (og er øverst) sjekkes først
    for (let i = mapPoints.length - 1; i >= 0; i--) {
        const point = mapPoints[i];
        const pointSize = point.size || DEFAULT_POINT_SIZE;
        // Bruk en litt større radius enn selve punktet for enklere treff
        const hitRadius = Math.max(clickRadius, pointSize / 2 + 5);
        const dx = x - point.x;
        const dy = y - point.y;
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
            return point;
        }
    }
    return null; // Ingen punkt funnet
}

/**
 * Legger til et nytt punkt via prompt, bruker sist brukte stil.
 * @param {number} x X-koordinat
 * @param {number} y Y-koordinat
 */
async function addNewPointSimple(x, y) {
    const pointName = prompt(`Skriv inn navn for det nye punktet (bruker ikon: ${lastUsedIcon}, farge: ${lastUsedColor}, str: ${lastUsedSize}px):`, "");
    // Ikke avbryt hvis bruker trykker cancel, bare bruk tomt navn

    const newPoint = {
        id: Date.now(),
        x: x,
        y: y,
        type: 'custom',
        name: pointName ? pointName.trim() : "",
        icon: lastUsedIcon, // Bruk sist brukte
        color: lastUsedColor, // Bruk sist brukte
        size: lastUsedSize, // Bruk sist brukte
        locked: false, // Nye punkter er ulåst
        timestamp: new Date().toISOString()
    };

    mapPoints.push(newPoint);
    drawMap();
    updatePointList();

    try {
        await saveCurrentMapData();
        logEvent(`La til punkt "${newPoint.name || 'uten navn'}" (ID: ${newPoint.id}) på kartet med stil ${lastUsedIcon}/${lastUsedColor}/${lastUsedSize}px.`, 'Kart');
        // Oppdater sist brukte stil ETTER vellykket lagring
        lastUsedIcon = newPoint.icon;
        lastUsedColor = newPoint.color;
        lastUsedSize = newPoint.size;
    } catch (error) {
        console.error("Kunne ikke lagre nytt punkt (simple):", error);
        mapPoints.pop(); // Fjern fra UI ved feil
        drawMap();
        updatePointList();
        alert("Kunne ikke lagre det nye punktet.");
    }
}


// --- Modal funksjoner (for redigering) ---

/**
 * Viser modalen for å redigere et eksisterende punkt.
 * @param {number} pointId ID-en til punktet som skal redigeres.
 */
function handleEditPoint(pointId) {
    const point = mapPoints.find(p => p.id === pointId);
    if (!point) {
        console.error(`Punkt med ID ${pointId} ikke funnet for redigering.`);
        return;
    }

    if (isDragging) return; // Ikke åpne modal hvis man drar et punkt

    console.log(`Åpner modal for å redigere punkt ${pointId}`);
    currentlyEditingPointId = pointId; // Sett hvilket punkt vi redigerer

    // Fyll modalen med punktets data
    document.getElementById('point-name').value = point.name || '';
    document.getElementById('point-icon').value = point.icon || DEFAULT_POINT_ICON;
    document.getElementById('point-color').value = point.color || DEFAULT_POINT_COLOR;
    document.getElementById('point-size').value = point.size || DEFAULT_POINT_SIZE;
    document.getElementById('point-modal-title').textContent = 'Rediger punkt'; // Endre tittel

    // Sett opp preview listeners (som i showAddPointModal)
    const iconSelect = document.getElementById('point-icon');
    const colorInput = document.getElementById('point-color');
    const sizeInput = document.getElementById('point-size');
    iconSelect.removeEventListener('change', updatePointPreview);
    colorInput.removeEventListener('input', updatePointPreview);
    sizeInput.removeEventListener('input', updatePointPreview);
    iconSelect.addEventListener('change', updatePointPreview);
    colorInput.addEventListener('input', updatePointPreview);
    sizeInput.addEventListener('input', updatePointPreview);

    updatePointPreview(); // Oppdater preview med punktets data

    pointModalElement.style.display = 'block';
    document.getElementById('point-name').focus();
}

/**
 * Oppdaterer forhåndsvisningen av ikonet i modalen.
 */
function updatePointPreview() {
    // Samme som før
    const previewArea = document.getElementById('point-preview');
    const iconSelect = document.getElementById('point-icon');
    const colorInput = document.getElementById('point-color');
    const sizeInput = document.getElementById('point-size');
    const sizeLabel = document.getElementById('point-size-label');
    if (!previewArea || !iconSelect || !colorInput || !sizeInput) return;
    const iconName = iconSelect.value;
    const color = colorInput.value;
    const size = parseInt(sizeInput.value, 10) || DEFAULT_POINT_SIZE;
    sizeLabel.textContent = `(${size}px)`;
    const iconSvg = ICON_LIBRARY[iconName] || ICON_LIBRARY[DEFAULT_POINT_ICON];
    const coloredSvg = iconSvg.replace(/currentColor/g, color);
    try {
        const base64Svg = btoa(coloredSvg);
        previewArea.innerHTML = `<img src="data:image/svg+xml;base64,${base64Svg}" width="${size}" height="${size}" alt="Preview">`;
    } catch (e) {
        console.error("Feil ved generering av SVG preview:", e);
        previewArea.innerHTML = 'Feil';
    }
}


/**
 * Håndterer lagring fra punkt-modalen (NÅ FOR REDIGERING).
 */
async function handleSavePointModal() {
    if (!pointModalElement || currentlyEditingPointId === null) return;

    const point = mapPoints.find(p => p.id === currentlyEditingPointId);
    if (!point) {
        console.error(`Punkt med ID ${currentlyEditingPointId} ikke funnet under lagring.`);
        closePointModal();
        return;
    }

    // Hent oppdaterte verdier
    const name = document.getElementById('point-name').value.trim();
    const icon = document.getElementById('point-icon').value;
    const color = document.getElementById('point-color').value;
    const size = parseInt(document.getElementById('point-size').value, 10) || DEFAULT_POINT_SIZE;

    // Oppdater punkt-objektet direkte i mapPoints-arrayen
    point.name = name;
    point.icon = icon;
    point.color = color;
    point.size = size;
    // Beholder original timestamp, x, y, type, locked

    const originalId = currentlyEditingPointId; // Lagre ID for logging
    closePointModal(); // Lukk modal og nullstill state

    drawMap();
    updatePointList();

    try {
        await saveCurrentMapData();
        logEvent(`Punkt "${point.name || point.id}" (ID: ${originalId}) oppdatert.`, 'Kart');
        // Oppdater sist brukte stil ETTER vellykket lagring
        lastUsedIcon = point.icon;
        lastUsedColor = point.color;
        lastUsedSize = point.size;
    } catch (error) {
        console.error(`Kunne ikke lagre endringer for punkt ${originalId}:`, error);
        alert("Kunne ikke lagre endringene for punktet.");
        // Bør ideelt sett resette endringene i mapPoints-arrayen, men det krever mer state-håndtering.
    }
}

/**
 * Håndterer avbryt fra punkt-modalen.
 */
function handleCancelPointModal() {
    closePointModal();
    console.log("Modal (redigering) avbrutt.");
}

/**
 * Lukker modalen og rydder opp listeners/state.
 */
function closePointModal() {
     if (!pointModalElement) return;
     pointModalElement.style.display = 'none';
     currentlyEditingPointId = null; // Nullstill redigerings-ID

     // Fjern event listeners for live preview
     document.getElementById('point-icon')?.removeEventListener('change', updatePointPreview);
     document.getElementById('point-color')?.removeEventListener('input', updatePointPreview);
     document.getElementById('point-size')?.removeEventListener('input', updatePointPreview);
}
// === 5: POINT CREATION, EDITING & DRAGGING END ===


// === 6: DATA SAVING START ===
async function saveCurrentMapData(imageDataUrl = null, pointsToSave = null, imageName = null) {
    // Samme som før, men inkluderer 'locked' feltet
    const currentImageData = imageDataUrl || (mapImage ? mapImage.src : null);
    const currentPoints = (pointsToSave || mapPoints).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        type: p.type,
        name: p.name,
        icon: p.icon || DEFAULT_POINT_ICON,
        color: p.color || DEFAULT_POINT_COLOR,
        size: p.size || DEFAULT_POINT_SIZE,
        locked: p.locked || false, // Sørg for at locked lagres
        timestamp: p.timestamp
    }));
    const currentImageName = imageName || mapImage?.dataset?.fileName || 'Lagret kart'; // Prøv å få tak i navnet

    if (!currentImageData) {
        console.warn("saveCurrentMapData: Ingen bildedata å lagre.");
        return;
    }

    try {
        await saveMapData(currentMapId, currentImageData, currentPoints, currentImageName);
        console.log("Kartdata lagret til IndexedDB.");
    } catch (error) {
        console.error("Feil ved lagring av kartdata til storage:", error);
        logEvent(`Feil ved lagring av kartdata: ${error.message}`, 'Error');
        setMapStatus("Kunne ikke lagre kartendringer.", true);
        throw error;
    }
}
// === 6: DATA SAVING END ===
