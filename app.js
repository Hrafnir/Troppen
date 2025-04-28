// === 1: INITIALIZATION & DOM READY START ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Tropp KO Verktøy - Initialiserer...");
    try {
        await initDB(); // Initialiser databasen FØRST
        console.log("Database initialisert vellykket.");

        initializeTabs();
        initializeEventListeners(); // Sett opp event listeners for knapper etc.

        // Last inn data for de ulike fanene
        await loadRosterData(); // Viktig å laste data etter DB er klar
        await loadLogData();
        // Senere:
        // await loadMapData();
        // await loadUnitsData();
        // await loadOpsViewData(); // Kan være en kombinasjon av map/units

        console.log("Applikasjon klar.");

    } catch (error) {
        console.error("Kritisk feil under initialisering:", error);
        // Vis en feilmelding til brukeren i UI?
        const mainContent = document.getElementById('app-content');
        if (mainContent) {
            mainContent.innerHTML = `<p style="color: red; font-weight: bold;">Kunne ikke initialisere applikasjonen. Databasefeil: ${error}</p>`;
        }
    }
});
// === 1: INITIALIZATION & DOM READY END ===

// === 2: TAB SWITCHING LOGIC START ===
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const targetTabContent = document.getElementById(`${targetTabId}-tab`);
            if (targetTabContent) {
                targetTabContent.classList.add('active');
                console.log(`Navigerte til fane: ${targetTabId}`);
                // Trigger oppdatering av innhold ved fanebytte om nødvendig
                switch (targetTabId) {
                    case 'roster':
                        loadRosterData(); // Oppdater roster visning
                        break;
                    case 'log':
                        loadLogData(); // Oppdater logg visning
                        break;
                    case 'ops':
                        // refreshOpsView(); // Oppdater operasjonsbildet
                        break;
                     case 'map':
                        // initializeMapIfNeeded(); // Initialiser kart-lerretet hvis det ikke er gjort
                        break;
                     case 'units':
                         loadUnitsData(); // Oppdater enhetslisten
                         break;
                }
            } else {
                console.error(`Kunne ikke finne innhold for fane: ${targetTabId}-tab`);
            }
        });
    });

     // Aktiver standardfanen (Kart) programmert
     const defaultTabButton = document.querySelector('.tab-button[data-tab="map"]');
     const defaultTabContent = document.getElementById('map-tab');
     if (defaultTabButton && defaultTabContent) {
         defaultTabButton.classList.add('active');
         defaultTabContent.classList.add('active');
         console.log("Aktiverte standardfane: map");
     } else {
         // Fallback hvis standardfane ikke finnes
         const firstTabButton = document.querySelector('.tab-button');
         if (firstTabButton) {
             firstTabButton.click();
         }
     }
}
// === 2: TAB SWITCHING LOGIC END ===

// === 3: UTILITY FUNCTIONS START ===
function getCurrentTimestamp(includeSeconds = true) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    let timestamp = `${day}.${month}.${year} ${hours}:${minutes}`;
    if (includeSeconds) {
        const seconds = String(now.getSeconds()).padStart(2, '0');
        timestamp += `:${seconds}`;
    }
    return timestamp;
}

// Funksjon for å logge hendelser internt i appen OG til databasen
async function logEvent(message, type = 'System') {
    console.log(`[${type}] ${getCurrentTimestamp()} - ${message}`);
    try {
        await addLogEntry({
            entryText: message,
            timestamp: new Date().toISOString(), // Bruk ISO for sortering i DB
            type: type
        });
        // Oppdater loggvisningen hvis loggfanen er aktiv
        if (document.getElementById('log-tab')?.classList.contains('active')) {
            await loadLogData();
        }
    } catch (error) {
        console.error("Kunne ikke legge til hendelse i databaseloggen:", error);
    }
}
// === 3: UTILITY FUNCTIONS END ===


// === 4: EVENT LISTENERS INITIALIZATION START ===
function initializeEventListeners() {
    // Roster tab
    document.getElementById('add-squad-button')?.addEventListener('click', handleAddSquad);
    document.getElementById('add-personnel-button')?.addEventListener('click', handleAddPersonnel);
    // Event listeners for redigering/sletting av personell/lag legges til dynamisk når rosteren rendres

    // Log tab
    document.getElementById('add-log-button')?.addEventListener('click', handleAddManualLog);
    document.getElementById('manual-log-entry')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddManualLog();
    });


    // Settings tab
    document.getElementById('export-data-button')?.addEventListener('click', handleExportData);
    document.getElementById('import-data-input')?.addEventListener('change', handleImportFileSelected);
    document.getElementById('import-data-button')?.addEventListener('click', handleImportData);
    document.getElementById('clear-data-button')?.addEventListener('click', showClearDataConfirmation);
    document.getElementById('confirm-clear-data')?.addEventListener('click', handleClearAllData);
    document.getElementById('cancel-clear-data')?.addEventListener('click', hideClearDataConfirmation);

    // Map tab (Eksempel - vi lager map.js senere)
    // document.getElementById('map-upload')?.addEventListener('change', handleMapUpload);
    // document.getElementById('add-point-mode')?.addEventListener('click', toggleAddPointMode);

    // Units tab (Eksempel - vi lager units.js senere)
    // document.getElementById('add-unit-button')?.addEventListener('click', showAddUnitForm);
}
// === 4: EVENT LISTENERS INITIALIZATION END ===

// === 5: ROSTER LOGIC START ===
// Funksjoner for å håndtere Roster-data og UI
async function loadRosterData() {
    console.log("Laster roster data...");
    const displayDiv = document.getElementById('roster-display');
    const squadSelect = document.getElementById('new-personnel-squad');
    if (!displayDiv || !squadSelect) return;

    displayDiv.innerHTML = '<p>Laster...</p>'; // Tømmer gammelt innhold og viser lasteindikator
    squadSelect.innerHTML = '<option value="">Velg lag...</option>'; // Tømmer select

    try {
        const squads = await getAllSquads();
        const personnel = await getAllPersonnel();

        // Fyll dropdown for lag i "Legg til personell"-skjemaet
        squads.sort((a, b) => a.name.localeCompare(b.name)); // Sorter lag alfabetisk
        squads.forEach(squad => {
            const option = document.createElement('option');
            option.value = squad.id;
            option.textContent = squad.name;
            squadSelect.appendChild(option);
        });

        // Bygg opp HTML for roster-visning (f.eks. tabeller per lag)
        let rosterHtml = '';
        if (squads.length === 0) {
             rosterHtml = '<p>Ingen lag definert ennå. Legg til lag over.</p>';
        } else {
            for (const squad of squads) {
                rosterHtml += `<h3>${squad.name} <button class="delete-squad-btn" data-squad-id="${squad.id}" title="Slett lag ${squad.name}">🗑️</button></h3>`; // Legg til sletteknapp for lag
                const squadPersonnel = personnel.filter(p => p.squadId === squad.id);
                if (squadPersonnel.length > 0) {
                    rosterHtml += `
                        <table>
                            <thead>
                                <tr>
                                    <th>Navn</th>
                                    <th>Grad</th>
                                    <th>Stilling</th>
                                    <th>Status</th>
                                    <th>Tilgjengelighet</th>
                                    <th>Notater</th>
                                    <th>Handlinger</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    squadPersonnel.sort((a, b) => a.name.localeCompare(b.name)); // Sorter personell i laget
                    squadPersonnel.forEach(p => {
                        rosterHtml += `
                            <tr data-personnel-id="${p.id}">
                                <td>${p.name || 'Mangler navn'}</td>
                                <td>${p.rank || '-'}</td>
                                <td>${p.role || '-'}</td>
                                <td>
                                    <select class="status-select" data-field="status">
                                        <option value="Tilstede" ${p.status === 'Tilstede' ? 'selected' : ''}>Tilstede</option>
                                        <option value="Borte" ${p.status === 'Borte' ? 'selected' : ''}>Borte</option>
                                    </select>
                                </td>
                                <td>
                                     <select class="status-select availability-select" data-field="availability" ${p.status === 'Borte' ? 'disabled' : ''}>
                                        <option value="Hvile" ${p.availability === 'Hvile' ? 'selected' : ''}>Hvile</option>
                                        <option value="Beredskap" ${p.availability === 'Beredskap' ? 'selected' : ''}>Beredskap</option>
                                        <option value="Vakt" ${p.availability === 'Vakt' ? 'selected' : ''}>Vakt</option>
                                        <option value="Utilgjengelig" ${p.availability === 'Utilgjengelig' || p.status === 'Borte' ? 'selected' : ''}>Utilgjengelig</option>
                                    </select>
                                </td>
                                <td>
                                    <input type="text" class="notes-input" value="${p.notes || ''}" placeholder="Perm til...">
                                </td>
                                <td>
                                    <button class="save-personnel-btn" title="Lagre endringer">💾</button>
                                    <button class="delete-personnel-btn" title="Slett personell">🗑️</button>
                                </td>
                            </tr>
                        `;
                    });
                    rosterHtml += `</tbody></table>`;
                } else {
                    rosterHtml += '<p>Ingen personell i dette laget.</p>';
                }
                rosterHtml += '<hr>'; // Skillelinje mellom lag
            }
        }


        displayDiv.innerHTML = rosterHtml;
        // Legg til event listeners for de nye knappene og select-boksene i roster-tabellen
        addRosterEventListeners();

    } catch (error) {
        console.error("Feil ved lasting av roster data:", error);
        displayDiv.innerHTML = '<p style="color: red;">Kunne ikke laste roster.</p>';
        logEvent(`Feil ved lasting av roster: ${error.message}`, 'Error');
    }
}


async function handleAddSquad() {
    const nameInput = document.getElementById('new-squad-name');
    const squadName = nameInput.value.trim();
    if (!squadName) {
        alert("Lagnavn kan ikke være tomt.");
        return;
    }

    try {
        // Sjekk om lagnavnet allerede finnes
        const existingSquads = await getAllSquads();
        if (existingSquads.some(s => s.name.toLowerCase() === squadName.toLowerCase())) {
            alert(`Laget "${squadName}" finnes allerede.`);
            return;
        }

        const newSquadId = await addSquad({ name: squadName });
        logEvent(`Lag "${squadName}" (ID: ${newSquadId}) lagt til.`, 'Roster');
        nameInput.value = ''; // Tøm inputfeltet
        await loadRosterData(); // Oppdater visningen
    } catch (error) {
        console.error("Feil ved tillegging av lag:", error);
        alert(`Kunne ikke legge til lag: ${error.message}`);
        logEvent(`Feil ved tillegging av lag "${squadName}": ${error.message}`, 'Error');
    }
}

async function handleAddPersonnel() {
    const nameInput = document.getElementById('new-personnel-name');
    const rankInput = document.getElementById('new-personnel-rank');
    const roleInput = document.getElementById('new-personnel-role');
    const squadSelect = document.getElementById('new-personnel-squad');

    const name = nameInput.value.trim();
    const rank = rankInput.value.trim();
    const role = roleInput.value.trim();
    const squadId = squadSelect.value ? Number(squadSelect.value) : null; // squadId skal være tall

    if (!name || !squadId) {
        alert("Navn og tilhørende lag må fylles ut.");
        return;
    }

    const personData = {
        name: name,
        rank: rank,
        role: role,
        squadId: squadId,
        status: 'Tilstede', // Standard status
        availability: 'Hvile', // Standard tilgjengelighet
        notes: ''
    };

    try {
        const newPersonnelId = await addPersonnel(personData);
        logEvent(`Personell "${name}" (ID: ${newPersonnelId}) lagt til i lag ID: ${squadId}.`, 'Roster');

        // Tøm skjema
        nameInput.value = '';
        rankInput.value = '';
        roleInput.value = '';
        squadSelect.value = '';

        await loadRosterData(); // Oppdater visningen
    } catch (error) {
        console.error("Feil ved tillegging av personell:", error);
        alert(`Kunne ikke legge til personell: ${error.message}`);
        logEvent(`Feil ved tillegging av personell "${name}": ${error.message}`, 'Error');
    }
}

function addRosterEventListeners() {
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', handlePersonnelStatusChange);
    });
     document.querySelectorAll('.notes-input').forEach(input => {
         // Vi lagrer notater kun når man trykker lagre-knappen for raden
         // Men vi kan legge til 'input' event listener hvis vi vil lagre fortløpende (mer komplekst)
     });
    document.querySelectorAll('.save-personnel-btn').forEach(button => {
        button.addEventListener('click', handleSavePersonnelChanges);
    });
    document.querySelectorAll('.delete-personnel-btn').forEach(button => {
        button.addEventListener('click', handleDeletePersonnel);
    });
     document.querySelectorAll('.delete-squad-btn').forEach(button => {
         button.addEventListener('click', handleDeleteSquad);
     });
}

function handlePersonnelStatusChange(event) {
    const select = event.target;
    const row = select.closest('tr');
    const availabilitySelect = row.querySelector('.availability-select');

    // Hvis status settes til "Borte", sett Tilgjengelighet til "Utilgjengelig" og disable den
    if (select.dataset.field === 'status' && select.value === 'Borte') {
        if (availabilitySelect) {
            availabilitySelect.value = 'Utilgjengelig';
            availabilitySelect.disabled = true;
        }
    }
    // Hvis status settes til "Tilstede", enable Tilgjengelighet-select
    else if (select.dataset.field === 'status' && select.value === 'Tilstede') {
        if (availabilitySelect) {
            availabilitySelect.disabled = false;
             // Gjenopprett kanskje forrige verdi? Eller sett til Hvile? Setter til Hvile for nå.
             if (availabilitySelect.value === 'Utilgjengelig') {
                 availabilitySelect.value = 'Hvile';
             }
        }
    }
     // Visuell indikasjon på at endring er gjort men ikke lagret? F.eks. endre bakgrunn på rad.
     // row.style.backgroundColor = 'lightyellow'; // Eksempel
}

async function handleSavePersonnelChanges(event) {
    const button = event.target;
    const row = button.closest('tr');
    const personnelId = Number(row.dataset.personnelId);

    if (!personnelId) {
        console.error("Kunne ikke finne personnelId for raden.");
        alert("En feil oppstod under lagring.");
        return;
    }

    // Hent oppdaterte verdier fra input-feltene og select-boksene i raden
    const statusSelect = row.querySelector('.status-select[data-field="status"]');
    const availabilitySelect = row.querySelector('.availability-select[data-field="availability"]');
    const notesInput = row.querySelector('.notes-input');
    // Vi kan også legge til redigering av navn, grad, stilling hvis ønskelig,
    // men det krever å bytte ut teksten med input-felt ved klikk. Foreløpig lagrer vi bare status/notater.

    const updatedData = {
        id: personnelId,
        status: statusSelect.value,
        availability: availabilitySelect.value,
        notes: notesInput.value.trim()
    };

    try {
        // Hent eksisterende data for å unngå å overskrive felter som ikke er i updatedData
        const existingData = await getPersonnelById(personnelId);
        if (!existingData) throw new Error(`Personell med ID ${personnelId} ikke funnet.`);

        // Slå sammen eksisterende data med oppdaterte verdier
        const dataToSave = { ...existingData, ...updatedData };

        await updatePersonnel(dataToSave);
        logEvent(`Endringer for personell ID ${personnelId} (${existingData.name}) lagret. Status: ${dataToSave.status}, Tilgj.: ${dataToSave.availability}, Notat: "${dataToSave.notes}"`, 'Roster');
        alert("Endringer lagret.");
        // row.style.backgroundColor = ''; // Fjern eventuell visuell indikasjon

    } catch (error) {
        console.error(`Feil ved lagring av endringer for personell ID ${personnelId}:`, error);
        alert(`Kunne ikke lagre endringer: ${error.message}`);
        logEvent(`Feil ved lagring for personell ID ${personnelId}: ${error.message}`, 'Error');
    }
}


async function handleDeletePersonnel(event) {
    const button = event.target;
    const row = button.closest('tr');
    const personnelId = Number(row.dataset.personnelId);
    const personnelName = row.cells[0].textContent; // Hent navnet fra første celle

    if (!personnelId) {
        console.error("Kunne ikke finne personnelId for sletting.");
        return;
    }

    if (confirm(`Er du sikker på at du vil slette ${personnelName}?`)) {
        try {
            await deletePersonnel(personnelId);
            logEvent(`Personell "${personnelName}" (ID: ${personnelId}) slettet.`, 'Roster');
            row.remove(); // Fjern raden fra tabellen
            alert(`${personnelName} slettet.`);
            // Trenger ikke laste hele rosteren på nytt, bare fjerner raden
        } catch (error) {
            console.error(`Feil ved sletting av personell ID ${personnelId}:`, error);
            alert(`Kunne ikke slette personell: ${error.message}`);
            logEvent(`Feil ved sletting av personell "${personnelName}" (ID: ${personnelId}): ${error.message}`, 'Error');
        }
    }
}

async function handleDeleteSquad(event) {
     const button = event.target;
     const squadId = Number(button.dataset.squadId);
     const squadName = button.closest('h3').textContent.replace(' 🗑️', '').trim(); // Hent navn fra h3

     if (!squadId) {
         console.error("Kunne ikke finne squadId for sletting.");
         return;
     }

     // Sjekk om det er personell i laget
     const personnelInSquad = await getPersonnelBySquad(squadId);
     let confirmationMessage = `Er du sikker på at du vil slette laget "${squadName}"?`;
     if (personnelInSquad.length > 0) {
         confirmationMessage += `\n\nADVARSEL: Dette laget har ${personnelInSquad.length} personell. Disse vil bli stående uten lagtilknytning.`;
     }

     if (confirm(confirmationMessage)) {
         try {
             // 1. Oppdater personell i laget til å ikke ha squadId lenger
             for (const person of personnelInSquad) {
                 person.squadId = null; // Eller en annen verdi som indikerer 'uten lag'
                 await updatePersonnel(person);
             }
             logEvent(`Fjernet lagtilknytning for ${personnelInSquad.length} personell fra lag "${squadName}".`, 'Roster');

             // 2. Slett selve laget
             await deleteSquad(squadId);
             logEvent(`Lag "${squadName}" (ID: ${squadId}) slettet.`, 'Roster');
             alert(`Lag "${squadName}" slettet.`);
             await loadRosterData(); // Last rosteren på nytt for å reflektere endringene

         } catch (error) {
             console.error(`Feil ved sletting av lag ID ${squadId}:`, error);
             alert(`Kunne ikke slette lag: ${error.message}`);
             logEvent(`Feil ved sletting av lag "${squadName}" (ID: ${squadId}): ${error.message}`, 'Error');
         }
     }
 }

// === 5: ROSTER LOGIC END ===

// === 6: LOG LOGIC START ===
async function loadLogData() {
    console.log("Laster logg data...");
    const logList = document.getElementById('log-list');
    const logDisplay = document.getElementById('log-display');
    if (!logList || !logDisplay) return;

    // Vis lasteindikator mens data hentes
     const loadingIndicator = logDisplay.querySelector('p');
     if (loadingIndicator) loadingIndicator.textContent = 'Laster logg...';
    logList.innerHTML = ''; // Tøm listen

    try {
        const entries = await getAllLogEntries(); // Henter sortert (nyeste først) fra storage.js

        if (loadingIndicator) loadingIndicator.style.display = 'none'; // Skjul lasteindikator

        if (entries.length === 0) {
            logList.innerHTML = '<li>Loggen er tom.</li>';
        } else {
            entries.forEach(entry => {
                const li = document.createElement('li');
                // Formater timestamp fra ISO til leselig format
                const timestamp = new Date(entry.timestamp).toLocaleString('no-NO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                li.textContent = `[${timestamp}] [${entry.type || 'Ukjent'}] ${entry.entryText}`;
                // Gi ulike stiler basert på type?
                // if(entry.type === 'Error') li.style.color = 'red';
                // if(entry.type === 'Patrulje') li.style.fontWeight = 'bold';
                logList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Feil ved lasting av logg:", error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        logList.innerHTML = '<li style="color: red;">Kunne ikke laste loggen.</li>';
        // Ikke logg denne feilen til DB for å unngå loop hvis DB feiler
    }
}


async function handleAddManualLog() {
    const input = document.getElementById('manual-log-entry');
    const entryText = input.value.trim();

    if (!entryText) {
        alert("Loggføring kan ikke være tom.");
        return;
    }

    try {
        // Bruker logEvent som logger til konsoll OG database
        await logEvent(entryText, 'Manuell');
        input.value = ''; // Tøm inputfeltet
        // loadLogData() kalles automatisk av logEvent hvis loggfanen er aktiv
    } catch (error) {
        console.error("Feil ved manuell loggføring:", error);
        alert("Kunne ikke legge til loggføring.");
        // Ikke logg denne feilen til DB for å unngå loop
    }
}
// === 6: LOG LOGIC END ===

// === 7: SETTINGS LOGIC START ===
async function handleExportData() {
    console.log("Starter eksport av data...");
    try {
        const data = await exportAllData();
        const jsonData = JSON.stringify(data, null, 2); // Formattert JSON
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `troppko_backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log("Data eksportert til fil.");
        logEvent("Data eksportert til fil.", "System");
        alert("Data eksportert vellykket!");

    } catch (error) {
        console.error("Feil under dataeksport:", error);
        logEvent(`Feil under dataeksport: ${error.message}`, "Error");
        alert(`Kunne ikke eksportere data: ${error.message}`);
    }
}

function handleImportFileSelected(event) {
    const file = event.target.files[0];
    const importButton = document.getElementById('import-data-button');
    if (file && file.type === "application/json") {
        importButton.style.display = 'inline-block'; // Vis importknapp
        importButton.dataset.file = file; // Lagre filreferanse (teknisk sett ikke mulig, men vi trenger bare filen når knappen trykkes)
    } else {
        importButton.style.display = 'none';
        if (file) { // Hvis en fil er valgt, men ikke er JSON
            alert("Vennligst velg en gyldig .json fil.");
            event.target.value = null; // Nullstill filinput
        }
    }
}

async function handleImportData() {
    const fileInput = document.getElementById('import-data-input');
    const file = fileInput.files[0];
    const importButton = document.getElementById('import-data-button');

    if (!file) {
        alert("Ingen fil valgt for import.");
        return;
    }

    if (!confirm("ADVARSEL: Import vil overskrive all eksisterende data. Er du sikker på at du vil fortsette?")) {
        return;
    }

    console.log("Starter import av data...");
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const jsonData = event.target.result;
            const data = JSON.parse(jsonData);

            // Validering av data? Sjekk om nødvendige stores finnes etc.
            // Dette er en enkel sjekk, kan utvides
             const requiredStores = [STORE_SQUADS, STORE_ROSTER, STORE_UNITS, STORE_MAPDATA, STORE_LOG];
             let missingStores = [];
             for (const storeName of requiredStores) {
                 if (typeof data[storeName] === 'undefined') {
                     // Tillat at stores mangler, men gi en advarsel?
                     console.warn(`Importert data mangler object store: ${storeName}. Fortsetter import av resten.`);
                     // Eller avbryt importen:
                     // missingStores.push(storeName);
                 } else if (!Array.isArray(data[storeName])) {
                      throw new Error(`Data for "${storeName}" i importfilen er ikke en liste (array).`);
                 }
             }
             // if (missingStores.length > 0) {
             //     throw new Error(`Importfilen mangler nødvendige data-seksjoner: ${missingStores.join(', ')}`);
             // }


            await importAllData(data); // Kall funksjonen i storage.js

            console.log("Data importert vellykket.");
            logEvent("Data importert fra fil. Applikasjonen lastes på nytt.", "System");
            alert("Data importert vellykket! Applikasjonen vil nå laste inn data på nytt.");

            // Nullstill filinput og skjul importknapp
            fileInput.value = null;
            importButton.style.display = 'none';

            // Last inn data på nytt i alle relevante moduler
            await loadRosterData();
            await loadLogData();
            // await loadMapData();
            // await loadUnitsData();
            // await loadOpsViewData();

        } catch (error) {
            console.error("Feil under dataimport:", error);
            logEvent(`Feil under dataimport: ${error.message}`, "Error");
            alert(`Kunne ikke importere data: ${error.message}\n\nSjekk at filen er en gyldig JSON-eksport fra dette verktøyet.`);
            // Nullstill filinput og skjul importknapp ved feil også
            fileInput.value = null;
            importButton.style.display = 'none';
        }
    };

    reader.onerror = (event) => {
        console.error("Feil ved lesing av fil:", event.target.error);
        logEvent(`Feil ved lesing av importfil: ${event.target.error}`, "Error");
        alert("Kunne ikke lese den valgte filen.");
        // Nullstill filinput og skjul importknapp
        fileInput.value = null;
        importButton.style.display = 'none';
    };

    reader.readAsText(file); // Les filen som tekst
}


function showClearDataConfirmation() {
    document.getElementById('clear-data-button').style.display = 'none';
    document.getElementById('clear-data-confirmation').style.display = 'inline';
}

function hideClearDataConfirmation() {
    document.getElementById('clear-data-button').style.display = 'inline-block';
    document.getElementById('clear-data-confirmation').style.display = 'none';
}

async function handleClearAllData() {
    console.log("Starter sletting av all data...");
    hideClearDataConfirmation(); // Skjul bekreftelsesknappene

    try {
        await clearAllData(); // Kall funksjonen i storage.js
        console.log("All data slettet.");
        logEvent("All lokal data slettet.", "System");
        alert("All lokal data er slettet!");

        // Last inn data på nytt (som nå vil være tomt)
        await loadRosterData();
        await loadLogData();
        // await loadMapData();
        // await loadUnitsData();
        // await loadOpsViewData();

    } catch (error) {
        console.error("Feil under sletting av data:", error);
        logEvent(`Feil under sletting av data: ${error.message}`, "Error");
        alert(`Kunne ikke slette all data: ${error.message}`);
    }
}
// === 7: SETTINGS LOGIC END ===


// === 8: MAP LOGIC (PLACEHOLDER) START ===
// async function loadMapData() { console.log("Laster kartdata..."); }
// function handleMapUpload(event) { console.log("Kartfil valgt:", event.target.files[0]); }
// function toggleAddPointMode() { console.log("Bytter modus for å legge til punkt"); }
// === 8: MAP LOGIC (PLACEHOLDER) END ===

// === 9: UNITS LOGIC (PLACEHOLDER) START ===
async function loadUnitsData() {
    console.log("Laster enhetsdata (poster/patruljer)...");
    const unitListDiv = document.getElementById('unit-list');
    if (!unitListDiv) return;

    unitListDiv.innerHTML = '<p>Laster enheter...</p>';

    try {
        const units = await getAllUnits();
        let unitsHtml = '';
        if (units.length === 0) {
            unitsHtml = '<p>Ingen enheter definert ennå.</p>';
        } else {
             // Hent lagnavn for å vise i listen
             const squads = await getAllSquads();
             const squadMap = squads.reduce((map, squad) => {
                 map[squad.id] = squad.name;
                 return map;
             }, {});

            units.forEach(unit => {
                const squadName = unit.assignedSquadId ? (squadMap[unit.assignedSquadId] || `Ukjent lag (ID: ${unit.assignedSquadId})`) : 'Ikke tildelt';
                unitsHtml += `
                    <div class="unit-item" data-unit-id="${unit.id}">
                        <h4>${unit.name || 'Ukjent enhet'} (${unit.type || 'Ukjent type'})</h4>
                        <p>Ansvarlig: ${squadName}</p>
                        <p>Antall pers: ${unit.personnelCount || '?'}</p>
                        <p>Status: ${unit.status || 'Ukjent'}</p>
                        <!-- Legg til knapper for rediger/slett senere -->
                         <button class="edit-unit-btn" title="Rediger enhet">✏️</button>
                         <button class="delete-unit-btn" title="Slett enhet">🗑️</button>
                    </div>
                `;
            });
        }
        unitListDiv.innerHTML = unitsHtml;
        // Legg til event listeners for rediger/slett knapper her
        addUnitEventListeners();

    } catch (error) {
        console.error("Feil ved lasting av enheter:", error);
        unitListDiv.innerHTML = '<p style="color: red;">Kunne ikke laste enheter.</p>';
        logEvent(`Feil ved lasting av enheter: ${error.message}`, 'Error');
    }
}

function addUnitEventListeners() {
    // document.querySelectorAll('.edit-unit-btn').forEach(btn => btn.addEventListener('click', handleEditUnit));
    // document.querySelectorAll('.delete-unit-btn').forEach(btn => btn.addEventListener('click', handleDeleteUnit));
}
// function showAddUnitForm() { console.log("Viser skjema for å legge til enhet"); }
// === 9: UNITS LOGIC (PLACEHOLDER) END ===


// === 10: OPS VIEW LOGIC (PLACEHOLDER) START ===
// async function loadOpsViewData() { console.log("Laster data for operasjonsbilde..."); }
// function refreshOpsView() { console.log("Oppdaterer operasjonsbilde visning..."); }
// === 10: OPS VIEW LOGIC (PLACEHOLDER) END ===
