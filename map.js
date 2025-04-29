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
    // Legg til filnavn i dataset for senere bruk ved lagring hvis originalt navn ikke finnes
    // Dette fungerer kanskje ikke på tvers av økter, men verdt et forsøk.
    // mapImage.dataset.fileName = document.getElementById('map-upload')?.files[0]?.name;
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
        // console.log("Kart tegnet på canvas."); // Kan fjernes for mindre støy i logg
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
function drawPoints() {
    if (!mapContext || !mapImage) return;

    mapPoints.forEach(point => {
        const iconSvg = ICON_LIBRARY[point.icon] || ICON_LIBRARY[DEFAULT_POINT_ICON];
        const color = point.color || DEFAULT_POINT_COLOR;
        const size = point.size || DEFAULT_POINT_SIZE;
        const isBeingDragged = isDragging && point.id === draggedPointId;

        const svgImage = new Image();

        // Viktig: onload og onerror MÅ defineres FØR man setter src
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

            // Tegn navn (kun hvis det finnes)
            if (point.name) {
                mapContext.globalAlpha = 1.0; // Full opacity for tekst
                mapContext.shadowColor = 'transparent'; // Fjern skygge for tekst
                mapContext.fillStyle = 'black';
                mapContext.strokeStyle = 'white';
                mapContext.lineWidth = 2;
                mapContext.font = `${Math.max(10, size * 0.7)}px sans-serif`;
                const textX = point.x + size / 2 + 5;
                const textY = point.y + size / 4;
                mapContext.strokeText(point.name, textX, textY); // Tegn outline først
                mapContext.fillText(point.name, textX, textY); // Tegn fylt tekst oppå
            }

            mapContext.restore(); // Gjenopprett state (opacity, shadow etc.)
        };
        svgImage.onerror = (e) => {
            console.error(`Kunne ikke laste SVG-ikon for punkt ${point.id}:`, e);
            // Fallback: Tegn en enkel sirkel hvis SVG feiler
            mapContext.fillStyle = color;
            mapContext.beginPath();
            mapContext.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
            mapContext.fill();
        };

        // Sett src ETTER at onload/onerror er definert
        try {
            const coloredSvg = iconSvg.replace(/currentColor/g, color);
            // Bruk btoa for å lage base64 data URL
            svgImage.src = "data:image/svg+xml;base64," + btoa(coloredSvg);
        } catch (e) {
             console.error("Feil ved konvertering av SVG til Data URL:", e);
             // Kall onerror manuelt hvis konvertering feiler, slik at fallback tegnes
             svgImage.onerror(e);
        }
    });
}

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
            let textContent = ` ${point.name || `ID: ${point.id}`} (X: ${point.x.toFixed(0)}, Y: ${point.y.toFixed(0)}) - ${point.size}px`;
             if (point.locked) {
                 textContent += " (Låst)";
             }
            textSpan.textContent = textContent;
            textSpan.style.flexGrow = '1'; // La teksten ta opp plassen


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
        // Bør legge punktet tilbake? La det være slettet fra UI.
    }
}

async function togglePointLock(pointId) {
     const point = mapPoints.find(p => p.id === pointId);
     if (!point) return;

     point.locked = !point.locked; // Toggle statusen
     console.log(`Punkt ${pointId} ${point.locked ? 'låst' : 'låst opp'}.`);

     updatePointList(); // Oppdater UI i listen
     drawMap(); // Tegn om kartet for å vise evt. visuell endring (opacity)

     try {
         await saveCurrentMapData(); // Lagre endringen
         logEvent(`Punkt "${point.name || point.id}" ${point.locked ? 'låst' : 'låst opp'}.`, 'Kart');
     } catch (error) {
         console.error(`Kunne ikke lagre låsestatus for punkt ${pointId}:`, error);
         // Reverser endringen i UI hvis lagring feilet
         point.locked = !point.locked;
         updatePointList();
         drawMap();
         alert("Kunne ikke lagre endring av låsestatus.");
     }
 }
// === 4: POINT HANDLING (DRAWING, DELETING, LIST) END ===

// === 5: POINT CREATION, EDITING & DRAGGING START ===
function setInteractionMode(mode) {
    if (currentInteractionMode === mode && mode === 'add-point') {
        mode = 'view';
    }
    currentInteractionMode = mode;
    console.log(`Kart interaksjonsmodus satt til: ${mode}`);

    const addPointBtn = document.getElementById('add-point-mode');
    const addCheckpointBtn = document.getElementById('add-checkpoint-mode');

    addPointBtn.classList.remove('active-mode');
    addCheckpointBtn?.classList.remove('active-mode'); // Sjekk om den finnes
    mapCanvas.style.cursor = 'default';

    if (mode === 'add-point') {
        addPointBtn.classList.add('active-mode');
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

function handleMouseDown(event) {
    if (event.button !== 0) return; // Kun venstre knapp
    const coords = getCanvasCoordinates(event);

    if (currentInteractionMode === 'add-point') {
        addNewPointSimple(coords.x, coords.y);
        // Ikke gå ut av modus automatisk, la bruker legge til flere.
    } else if (currentInteractionMode === 'view') {
        const clickedPoint = findPointAt(coords.x, coords.y);
        if (clickedPoint && !clickedPoint.locked) {
            isDragging = true;
            draggedPointId = clickedPoint.id;
            dragOffsetX = coords.x - clickedPoint.x;
            dragOffsetY = coords.y - clickedPoint.y;
            document.body.classList.add('dragging-point'); // Sett global cursor
            console.log(`Starter flytting av punkt ${draggedPointId}`);
            drawMap(); // Tegn om for dra-effekt
        } else if (clickedPoint && clickedPoint.locked) {
             console.log(`Forsøkte å flytte låst punkt ${clickedPoint.id}`);
             alert("Dette punktet er låst og kan ikke flyttes.");
        }
    }
}


function handleMouseMove(event) {
    if (!isDragging || draggedPointId === null) return;

    const point = mapPoints.find(p => p.id === draggedPointId);
    if (!point) { // Sikkerhetssjekk
        isDragging = false;
        document.body.classList.remove('dragging-point');
        return;
    }

    const coords = getCanvasCoordinates(event);
    point.x = coords.x - dragOffsetX;
    point.y = coords.y - dragOffsetY;
    point.x = Math.max(0, Math.min(mapCanvas.width, point.x));
    point.y = Math.max(0, Math.min(mapCanvas.height, point.y));

    // Bruk requestAnimationFrame for jevnere flytting
    requestAnimationFrame(drawMap);
}

async function handleMouseUp(event) {
    // Sjekk om vi faktisk dro et punkt
    const wasDragging = isDragging;
    const pointIdBeingDragged = draggedPointId;

    // Rydd opp dra-status FØR async operasjoner
    isDragging = false;
    draggedPointId = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
    document.body.classList.remove('dragging-point'); // Fjern global cursor

    if (!wasDragging || pointIdBeingDragged === null) return; // Hvis vi ikke dro, er vi ferdige

    console.log(`Avslutter flytting av punkt ${pointIdBeingDragged}`);

    const movedPoint = mapPoints.find(p => p.id === pointIdBeingDragged);

    // Tegn en siste gang i normal tilstand (uten dra-effekter)
    // Bruk requestAnimationFrame for å unngå konflikter med mouseMove
    requestAnimationFrame(() => {
        drawMap();
        updatePointList(); // Oppdater koordinatene i listen
    });

    // Lagre den nye posisjonen
    try {
        await saveCurrentMapData();
        if (movedPoint) {
            logEvent(`Punkt "${movedPoint.name || movedPoint.id}" flyttet til (X: ${movedPoint.x.toFixed(0)}, Y: ${movedPoint.y.toFixed(0)}).`, 'Kart');
        }
    } catch (error) {
        console.error(`Kunne ikke lagre ny posisjon for punkt ${pointIdBeingDragged}:`, error);
        alert("Kunne ikke lagre den nye posisjonen for punktet.");
        // Bør ideelt sett resette posisjonen, men det er komplekst.
    }
}


function handleMouseLeave(event) {
    if (isDragging) {
        console.log("Flytting avbrutt (mus forlot canvas). Lagrer nåværende posisjon.");
        handleMouseUp(event); // Kall mouseup for å lagre og rydde opp
    }
}


function findPointAt(x, y) {
    const clickRadius = 15;
    for (let i = mapPoints.length - 1; i >= 0; i--) {
        const point = mapPoints[i];
        const pointSize = point.size || DEFAULT_POINT_SIZE;
        const hitRadius = Math.max(clickRadius, pointSize / 2 + 5);
        const dx = x - point.x;
        const dy = y - point.y;
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
            return point;
        }
    }
    return null;
}

async function addNewPointSimple(x, y) {
    const pointName = prompt(`Nytt punkt navn (stil: ${lastUsedIcon}/${lastUsedColor}/${lastUsedSize}px):`, "");

    const newPoint = {
        id: Date.now(),
        x: x,
        y: y,
        type: 'custom',
        name: pointName ? pointName.trim() : "", // Tomt navn hvis bruker trykker OK uten å skrive
        icon: lastUsedIcon,
        color: lastUsedColor,
        size: lastUsedSize,
        locked: false,
        timestamp: new Date().toISOString()
    };

    mapPoints.push(newPoint);
    // Tegn KUN det nye punktet for raskere respons? Nei, hele kartet er tryggest.
    drawMap();
    updatePointList();

    try {
        await saveCurrentMapData();
        logEvent(`La til punkt "${newPoint.name || 'uten navn'}" (ID: ${newPoint.id}) på kartet med stil ${lastUsedIcon}/${lastUsedColor}/${lastUsedSize}px.`, 'Kart');
        // Ikke oppdater sist brukte stil her, det gjøres ved redigering.
    } catch (error) {
        console.error("Kunne ikke lagre nytt punkt (simple):", error);
        mapPoints.pop();
        drawMap();
        updatePointList();
        alert("Kunne ikke lagre det nye punktet.");
    }
}


// --- Modal funksjoner (for redigering) ---

function handleEditPoint(pointId) {
    const point = mapPoints.find(p => p.id === pointId);
    if (!point) return;
    if (isDragging) return;

    console.log(`Åpner modal for å redigere punkt ${pointId}`);
    currentlyEditingPointId = pointId;

    document.getElementById('point-name').value = point.name || '';
    document.getElementById('point-icon').value = point.icon || DEFAULT_POINT_ICON;
    document.getElementById('point-color').value = point.color || DEFAULT_POINT_COLOR;
    document.getElementById('point-size').value = point.size || DEFAULT_POINT_SIZE;
    document.getElementById('point-modal-title').textContent = 'Rediger punkt';

    // Sett opp preview listeners
    const iconSelect = document.getElementById('point-icon');
    const colorInput = document.getElementById('point-color');
    const sizeInput = document.getElementById('point-size');
    iconSelect.removeEventListener('change', updatePointPreview);
    colorInput.removeEventListener('input', updatePointPreview);
    sizeInput.removeEventListener('input', updatePointPreview);
    iconSelect.addEventListener('change', updatePointPreview);
    colorInput.addEventListener('input', updatePointPreview);
    sizeInput.addEventListener('input', updatePointPreview);

    updatePointPreview(); // Oppdater preview

    pointModalElement.style.display = 'block';
    document.getElementById('point-name').focus();
}

function updatePointPreview() {
    const previewArea = document.getElementById('point-preview');
    const iconSelect = document.getElementById('point-icon');
    const colorInput = document.getElementById('point-color');
    const sizeInput = document.getElementById('point-size');
    const sizeLabel = document.getElementById('point-size-label');
    if (!previewArea || !iconSelect || !colorInput || !sizeInput || !sizeLabel) return;
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

    // Oppdater punkt-objektet
    point.name = name;
    point.icon = icon;
    point.color = color;
    point.size = size;

    const originalId = currentlyEditingPointId;
    closePointModal(); // Lukk modal og nullstill state

    drawMap();
    updatePointList();

    try {
        await saveCurrentMapData();
        logEvent(`Punkt "${point.name || point.id}" (ID: ${originalId}) oppdatert.`, 'Kart');
        // Oppdater sist brukte stil ETTER vellykket redigering
        lastUsedIcon = point.icon;
        lastUsedColor = point.color;
        lastUsedSize = point.size;
        console.log("Sist brukte stil oppdatert til:", lastUsedIcon, lastUsedColor, lastUsedSize);
    } catch (error) {
        console.error(`Kunne ikke lagre endringer for punkt ${originalId}:`, error);
        alert("Kunne ikke lagre endringene for punktet.");
        // Resette endringer? Vanskelig uten mer state.
    }
}


function handleCancelPointModal() {
    closePointModal();
    console.log("Modal (redigering) avbrutt.");
}

function closePointModal() {
     if (!pointModalElement) return;
     pointModalElement.style.display = 'none';
     currentlyEditingPointId = null;

     // Fjern event listeners
     document.getElementById('point-icon')?.removeEventListener('change', updatePointPreview);
     document.getElementById('point-color')?.removeEventListener('input', updatePointPreview);
     document.getElementById('point-size')?.removeEventListener('input', updatePointPreview);
}
// === 5: POINT CREATION, EDITING & DRAGGING END ===


// === 6: DATA SAVING START ===
async function saveCurrentMapData(imageDataUrl = null, pointsToSave = null, imageName = null) {
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
        locked: p.locked || false,
        timestamp: p.timestamp || new Date().toISOString() // Legg til timestamp hvis det mangler
    }));
     // Prøv å hente filnavn fra mapImage.dataset hvis det finnes, ellers bruk 'Lagret kart'
    const currentImageName = imageName || mapImage?.dataset?.fileName || 'Lagret kart';

    if (!currentImageData) {
        console.warn("saveCurrentMapData: Ingen bildedata å lagre.");
        return;
    }

    try {
        // Kall den eksisterende saveMapData i storage.js (som vi definerte i map.js tidligere)
        await saveMapData(currentMapId, currentImageData, currentPoints, currentImageName);
        console.log("Kartdata lagret til IndexedDB.");
    } catch (error) {
        console.error("Feil ved lagring av kartdata til storage:", error);
        logEvent(`Feil ved lagring av kartdata: ${error.message}`, 'Error');
        setMapStatus("Kunne ikke lagre kartendringer.", true);
        throw error; // Kast feilen videre
    }
}

// Husk at saveMapData-funksjonen som faktisk snakker med storage.js ble definert i map.js i et tidligere svar.
// Den ser slik ut (trenger ikke endres):
// async function saveMapData(mapId, imageData, points, imageName) {
//     const data = {
//         id: mapId,
//         imageData: imageData,
//         points: points || [],
//         imageName: imageName || null,
//         lastSaved: new Date().toISOString()
//     };
//     return updateData(STORE_MAPDATA, data); // Bruker updateData fra storage.js
// }

// === 6: DATA SAVING END ===
