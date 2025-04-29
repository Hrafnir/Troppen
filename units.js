// === 1: UNIT MODULE VARIABLES START ===
let unitModalElement = null;
let unitListElement = null;
let currentlyEditingUnitId = null; // Holder ID for enheten som redigeres
let availableSquads = []; // Cache for lag-listen
// === 1: UNIT MODULE VARIABLES END ===


// === 2: INITIALIZATION START ===
/**
 * Initialiserer Enheter-modulen. Henter referanser og setter opp listeners.
 */
function initializeUnitsModule() {
    unitModalElement = document.getElementById('unit-modal');
    unitListElement = document.getElementById('unit-list');
    const addUnitBtn = document.getElementById('add-unit-button'); // Knappen i Enheter-fanen
    const saveUnitBtn = document.getElementById('save-unit-button'); // Knapp i modal
    const cancelUnitBtn = document.getElementById('cancel-unit-button'); // Knapp i modal
    const unitTypeSelect = document.getElementById('unit-type'); // Type dropdown i modal

    if (!unitModalElement || !unitListElement || !addUnitBtn || !saveUnitBtn || !cancelUnitBtn || !unitTypeSelect) {
        console.error("Enheter-modul: Nødvendige HTML-elementer mangler.");
        return;
    }

    // Fyll ikon-select (gjenbruker fra map.js)
    const unitIconSelect = document.getElementById('unit-icon');
    if (unitIconSelect) {
        unitIconSelect.innerHTML = '';
        for (const iconName in ICON_LIBRARY) {
            const option = document.createElement('option');
            option.value = iconName;
            option.textContent = iconName.charAt(0).toUpperCase() + iconName.slice(1);
            unitIconSelect.appendChild(option);
        }
    }

    // Event Listeners
    addUnitBtn.addEventListener('click', handleAddUnitUI);
    saveUnitBtn.addEventListener('click', handleSaveUnitModal);
    cancelUnitBtn.addEventListener('click', handleCancelUnitModal);
    unitTypeSelect.addEventListener('change', toggleObservationFields); // Vis/skjul obs-felter

    // Listeners for input i modalen (f.eks. for preview) kan legges til i showUnitModal
    document.getElementById('unit-icon')?.addEventListener('change', updateUnitPreview);
    document.getElementById('unit-color')?.addEventListener('input', updateUnitPreview);
    document.getElementById('unit-size')?.addEventListener('input', updateUnitPreview);

    console.log("Enheter-modul initialisert.");
    // Last inn enhetsdata når modulen er klar (gjøres via app.js -> loadDataForTab)
}
// === 2: INITIALIZATION END ===


// === 3: UNIT LIST DISPLAY START ===
/**
 * Laster enhetsdata og oppdaterer listen i UI.
 */
async function loadUnitsData() {
    if (!unitListElement) return;
    console.log("Laster enhetsdata...");
    unitListElement.innerHTML = '<p>Laster enheter...</p>';

    try {
        const units = await getAllUnits();
        availableSquads = await getAllSquads(); // Hent ferske lagdata

        // Sorter enheter (f.eks. etter navn)
        units.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (units.length === 0) {
            unitListElement.innerHTML = '<p>Ingen enheter definert ennå.</p>';
        } else {
            const squadMap = availableSquads.reduce((map, squad) => {
                map[squad.id] = squad.name;
                return map;
            }, {});
            unitListElement.innerHTML = units.map(unit => generateUnitItemHtml(unit, squadMap)).join('');
            // Legg til event listeners for knappene i listen
            addUnitListEventListeners();
        }
    } catch (error) {
        console.error("Feil ved lasting av enheter:", error);
        unitListElement.innerHTML = '<p style="color: red;">Kunne ikke laste enheter.</p>';
        logEvent(`Feil ved lasting av enheter: ${error.message}`, 'Error');
    }
}

/**
 * Genererer HTML for ett enkelt enhetselement i listen.
 * @param {object} unit Enhetsobjektet.
 * @param {object} squadMap Mapping fra squad ID til navn.
 * @returns {string} HTML-streng for enheten.
 */
function generateUnitItemHtml(unit, squadMap) {
    const squadName = unit.assignedSquadId ? (squadMap[unit.assignedSquadId] || `Ukjent lag (ID: ${unit.assignedSquadId})`) : 'Ikke tildelt';
    const typeText = unit.type === 'Post' ? 'Post' : (unit.type === 'Patrol' ? 'Patrulje' : 'Ukjent type');
    const positionText = (unit.x !== undefined && unit.y !== undefined) ? `(X: ${unit.x.toFixed(0)}, Y: ${unit.y.toFixed(0)})` : '(Ikke plassert)';

    // Ikon preview
    const iconPreviewHtml = (() => {
        const iconSvg = ICON_LIBRARY[unit.icon || DEFAULT_UNIT_ICON];
        const color = unit.color || DEFAULT_UNIT_COLOR;
        if (!iconSvg) return '?';
        try {
            const coloredSvg = iconSvg.replace(/currentColor/g, color);
            return `<img src="data:image/svg+xml;base64,${btoa(coloredSvg)}" width="16" height="16" alt="${unit.icon}" style="vertical-align: middle; margin-right: 5px;">`;
        } catch { return '?'; }
    })();


    return `
        <div class="unit-item" data-unit-id="${unit.id}">
             <h4>${iconPreviewHtml}${unit.name || 'Ukjent enhet'} (${typeText})</h4>
             <p>Ansvarlig: ${squadName} | Antall: ${unit.personnelCount || '?'} | Posisjon: ${positionText}</p>
             ${unit.type === 'Post' ? `<p>Obs: ${unit.observationAngle ?? '-'}° / ${unit.observationFOV ?? '-'}° FOV</p>` : ''}
             <div>
                 <button class="edit-unit-btn" title="Rediger enhet">✏️ Rediger</button>
                 <button class="place-unit-btn" title="Plasser/flytt enhet på Operasjonsbilde">📍 Plasser</button>
                 <button class="delete-unit-btn" title="Slett enhet">🗑️ Slett</button>
             </div>
        </div>
    `;
}

/**
 * Legger til event listeners for knappene i enhetslisten.
 */
function addUnitListEventListeners() {
    unitListElement.querySelectorAll('.edit-unit-btn').forEach(btn => {
        const unitId = btn.closest('.unit-item')?.dataset.unitId;
        if (unitId) btn.onclick = () => handleEditUnitUI(Number(unitId));
    });
    unitListElement.querySelectorAll('.delete-unit-btn').forEach(btn => {
        const unitId = btn.closest('.unit-item')?.dataset.unitId;
        if (unitId) btn.onclick = () => handleDeleteUnit(Number(unitId));
    });
    unitListElement.querySelectorAll('.place-unit-btn').forEach(btn => {
        const unitId = btn.closest('.unit-item')?.dataset.unitId;
        if (unitId) btn.onclick = () => handlePlaceUnitRequest(Number(unitId)); // Sender forespørsel
    });
}
// === 3: UNIT LIST DISPLAY END ===


// === 4: ADD/EDIT UNIT MODAL START ===
/**
 * Viser modal for å legge til en ny enhet.
 */
function handleAddUnitUI() {
    currentlyEditingUnitId = null; // Sikrer at vi legger til ny
    showUnitModal(); // Kall felles funksjon for å vise modal
}

/**
 * Viser modal for å redigere en eksisterende enhet.
 * @param {number} unitId ID for enheten som skal redigeres.
 */
async function handleEditUnitUI(unitId) {
    try {
        const unit = await getUnitById(unitId);
        if (!unit) {
            alert(`Fant ikke enhet med ID ${unitId}.`);
            return;
        }
        currentlyEditingUnitId = unitId; // Sett ID for redigering
        showUnitModal(unit); // Kall felles funksjon med enhetsdata
    } catch (error) {
        console.error(`Feil ved henting av enhet ${unitId} for redigering:`, error);
        alert("Kunne ikke hente enhetsdata for redigering.");
    }
}

/**
 * Viser modalen, fyller den med data (hvis gitt), og setter opp listeners.
 * @param {object} [unitData=null] Data for enheten som skal redigeres, eller null for ny.
 */
async function showUnitModal(unitData = null) {
    if (!unitModalElement) return;

    // Hent ferske lagdata hvis de ikke er cachet
    if (!availableSquads || availableSquads.length === 0) {
        try {
             availableSquads = await getAllSquads();
        } catch (error) {
             console.error("Kunne ikke hente lagliste for enhetsmodal:", error);
             alert("Feil: Kunne ikke laste listen over lag.");
             return; // Ikke vis modal uten lagliste
        }
    }

    // Fyll dropdown for ansvarlig lag
    const squadSelect = document.getElementById('unit-assignedSquadId');
    squadSelect.innerHTML = '<option value="">-- Ikke tildelt --</option>'; // Start med blank
    availableSquads.forEach(squad => {
        const option = document.createElement('option');
        option.value = squad.id;
        option.textContent = squad.name;
        squadSelect.appendChild(option);
    });

    // Sett verdier i modalen
    document.getElementById('unit-modal-title').textContent = unitData ? 'Rediger enhet' : 'Legg til ny enhet';
    document.getElementById('unit-name').value = unitData?.name || '';
    document.getElementById('unit-type').value = unitData?.type || 'Post'; // Default til Post
    squadSelect.value = unitData?.assignedSquadId || '';
    document.getElementById('unit-personnelCount').value = unitData?.personnelCount || '';
    document.getElementById('unit-icon').value = unitData?.icon || DEFAULT_UNIT_ICON;
    document.getElementById('unit-color').value = unitData?.color || DEFAULT_UNIT_COLOR;
    document.getElementById('unit-size').value = unitData?.size || DEFAULT_UNIT_SIZE;
    // Observasjonsfelter (settes basert på type)
    document.getElementById('unit-observationAngle').value = unitData?.observationAngle ?? DEFAULT_OBS_ANGLE; // Bruk ?? for å håndtere 0
    document.getElementById('unit-observationFOV').value = unitData?.observationFOV ?? DEFAULT_OBS_FOV;

    toggleObservationFields(); // Sørg for at riktige felter vises basert på type
    updateUnitPreview(); // Oppdater preview

    // Vis modalen
    unitModalElement.style.display = 'block';
    document.getElementById('unit-name').focus();
}

/**
 * Viser eller skjuler observasjonsfeltene basert på valgt enhetstype.
 */
function toggleObservationFields() {
    const unitType = document.getElementById('unit-type')?.value;
    const obsFieldsDiv = document.getElementById('observation-fields');
    if (obsFieldsDiv) {
        obsFieldsDiv.style.display = (unitType === 'Post') ? 'block' : 'none';
    }
}

/**
 * Oppdaterer forhåndsvisningen av ikonet i enhetsmodalen.
 */
function updateUnitPreview() {
    const previewArea = document.getElementById('unit-preview');
    const iconSelect = document.getElementById('unit-icon');
    const colorInput = document.getElementById('unit-color');
    const sizeInput = document.getElementById('unit-size');

    if (!previewArea || !iconSelect || !colorInput || !sizeInput) return;

    const iconName = iconSelect.value;
    const color = colorInput.value;
    const size = parseInt(sizeInput.value, 10) || DEFAULT_UNIT_SIZE;
    const iconSvg = ICON_LIBRARY[iconName] || ICON_LIBRARY[DEFAULT_UNIT_ICON]; // Fallback

    if (!iconSvg) {
        previewArea.innerHTML = 'Feil';
        return;
    }

    const coloredSvg = iconSvg.replace(/currentColor/g, color);
    try {
        const base64Svg = btoa(coloredSvg);
        previewArea.innerHTML = `<img src="data:image/svg+xml;base64,${base64Svg}" width="${size}" height="${size}" alt="Preview">`;
    } catch (e) {
        console.error("Feil ved generering av SVG preview (unit):", e);
        previewArea.innerHTML = 'Feil';
    }
}


/**
 * Håndterer lagring fra enhetsmodalen (både ny og redigering).
 */
async function handleSaveUnitModal() {
    // Hent verdier fra skjema
    const name = document.getElementById('unit-name').value.trim();
    const type = document.getElementById('unit-type').value;
    const assignedSquadId = document.getElementById('unit-assignedSquadId').value ? Number(document.getElementById('unit-assignedSquadId').value) : null;
    const personnelCount = document.getElementById('unit-personnelCount').value ? Number(document.getElementById('unit-personnelCount').value) : null;
    const icon = document.getElementById('unit-icon').value;
    const color = document.getElementById('unit-color').value;
    const size = parseInt(document.getElementById('unit-size').value, 10) || DEFAULT_UNIT_SIZE;

    // Hent observasjonsdata KUN hvis type er 'Post'
    let observationAngle = null;
    let observationFOV = null;
    if (type === 'Post') {
        observationAngle = document.getElementById('unit-observationAngle').value !== '' ? Number(document.getElementById('unit-observationAngle').value) : DEFAULT_OBS_ANGLE;
        observationFOV = document.getElementById('unit-observationFOV').value !== '' ? Number(document.getElementById('unit-observationFOV').value) : DEFAULT_OBS_FOV;
    }

    if (!name) {
        alert("Navn på enhet må fylles ut.");
        return;
    }

    const unitData = {
        name: name,
        type: type,
        assignedSquadId: assignedSquadId,
        personnelCount: personnelCount,
        icon: icon,
        color: color,
        size: size,
        observationAngle: observationAngle,
        observationFOV: observationFOV,
        // x, y, timestamp settes ved lagring/oppdatering eller hentes fra eksisterende
    };

    try {
        let message = '';
        if (currentlyEditingUnitId !== null) {
            // Redigerer eksisterende enhet
            unitData.id = currentlyEditingUnitId;
            // Hent eksisterende posisjon for å beholde den
            const existingUnit = await getUnitById(currentlyEditingUnitId);
            unitData.x = existingUnit?.x; // Kan være undefined hvis ikke plassert
            unitData.y = existingUnit?.y;
            unitData.timestamp = new Date().toISOString(); // Oppdater timestamp

            await updateUnit(unitData);
            message = `Enhet "${name}" (ID: ${unitData.id}) oppdatert.`;
        } else {
            // Legger til ny enhet
            unitData.timestamp = new Date().toISOString();
            // Posisjon (x, y) settes ikke her, men når enheten plasseres på kartet.
            const newId = await addUnit(unitData);
            message = `Ny enhet "${name}" (ID: ${newId}) lagt til.`;
        }

        logEvent(message, 'Enhet');
        closeUnitModal();
        await loadUnitsData(); // Last listen på nytt for å vise endringer
        // Oppdater Operasjonsbilde også hvis den er aktiv?
        if (document.getElementById('ops-tab')?.classList.contains('active')) {
            // Antar at ops.js har en funksjon for dette
            if (typeof refreshOpsView === 'function') refreshOpsView();
        }

    } catch (error) {
        console.error("Feil ved lagring av enhet:", error);
        alert(`Kunne ikke lagre enhet: ${error.message}`);
        logEvent(`Feil ved lagring av enhet "${name}": ${error.message}`, 'Error');
    }
}

/**
 * Håndterer avbryt fra enhetsmodalen.
 */
function handleCancelUnitModal() {
    closeUnitModal();
    console.log("Enhetsmodal avbrutt.");
}

/**
 * Lukker enhetsmodalen og rydder opp.
 */
function closeUnitModal() {
    if (!unitModalElement) return;
    unitModalElement.style.display = 'none';
    currentlyEditingUnitId = null;
}
// === 4: ADD/EDIT UNIT MODAL END ===


// === 5: DELETE UNIT START ===
/**
 * Sletter en enhet etter bekreftelse.
 * @param {number} unitId ID for enheten som skal slettes.
 */
async function handleDeleteUnit(unitId) {
    try {
        const unit = await getUnitById(unitId); // Hent for å få navnet
        const unitName = unit?.name || `Enhet ID ${unitId}`;

        if (!confirm(`Er du sikker på at du vil slette enhet "${unitName}"?`)) {
            return;
        }

        await deleteUnit(unitId);
        logEvent(`Enhet "${unitName}" (ID: ${unitId}) slettet.`, 'Enhet');
        await loadUnitsData(); // Last listen på nytt

        // Oppdater Operasjonsbilde også hvis den er aktiv?
         if (document.getElementById('ops-tab')?.classList.contains('active')) {
             if (typeof refreshOpsView === 'function') refreshOpsView();
         }

    } catch (error) {
        console.error(`Feil ved sletting av enhet ID ${unitId}:`, error);
        alert(`Kunne ikke slette enhet: ${error.message}`);
        logEvent(`Feil ved sletting av enhet (ID: ${unitId}): ${error.message}`, 'Error');
    }
}
// === 5: DELETE UNIT END ===


// === 6: PLACE/MOVE UNIT REQUEST START ===
/**
 * Håndterer klikk på "Plasser"-knappen i listen.
 * Sender forespørsel til ops.js (eller annen modul som håndterer kartet).
 * @param {number} unitId ID for enheten som skal plasseres/flyttes.
 */
function handlePlaceUnitRequest(unitId) {
    console.log(`Forespørsel om å plassere/flytte enhet ${unitId}`);
    // Bytt til Operasjonsbilde-fanen
    const opsTabButton = document.querySelector('.tab-button[data-tab="ops"]');
    if (opsTabButton) {
        opsTabButton.click(); // Simuler klikk for å bytte fane
        // Gi beskjed til ops.js om å starte plasseringsmodus
        // Dette krever at ops.js eksponerer en funksjon, f.eks. startPlacingUnitMode
        if (typeof startPlacingUnitMode === 'function') {
             // Vent litt for å sikre at fanen er byttet og kartet initialisert?
             setTimeout(() => startPlacingUnitMode(unitId), 100);
        } else {
             console.warn("Funksjonen startPlacingUnitMode() er ikke tilgjengelig.");
             alert("Kan ikke starte plasseringsmodus (funksjon mangler).");
        }
    } else {
        alert("Fant ikke Operasjonsbilde-fanen.");
    }
}
// === 6: PLACE/MOVE UNIT REQUEST END ===
