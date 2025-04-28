// === 0: GLOBAL VARIABLES & CONSTANTS START ===
let rosterHasUnsavedChanges = false;
const STANDARD_ROLES = [
    "Troppsjef", "NK Tropp", "Troppsfører (v/stab)", "Troppsfører (v/lag)", "Sanitet", "Samband",
    "Lagfører", "NK Lag", "MG1", "MG2", "Geværmann 1", "Geværmann 2", "Geværmann 3", "Geværmann 4",
    "Annet..." // Må være siste element for logikken
];
const DEFAULT_SQUADS = [
    { name: "Troppsstab" },
    { name: "Lag 1" },
    { name: "Lag 2" },
    { name: "Lag 3" },
    { name: "Lag 4" }
];
const DEFAULT_PERSONNEL = {
    "Troppsstab": [
        { role: "Troppsjef", name: "", rank: "" },
        { role: "NK Tropp", name: "", rank: "" },
        { role: "Troppsfører (v/stab)", name: "", rank: "" },
        { role: "Sanitet", name: "", rank: "" },
        { role: "Samband", name: "", rank: "" }
    ],
    "Lag 1": [
        { role: "Lagfører", name: "", rank: "" }, { role: "NK Lag", name: "", rank: "" },
        { role: "MG1", name: "", rank: "" }, { role: "MG2", name: "", rank: "" },
        { role: "Geværmann 1", name: "", rank: "" }, { role: "Geværmann 2", name: "", rank: "" },
        { role: "Geværmann 3", name: "", rank: "" }, { role: "Geværmann 4", name: "", rank: "" }
    ],
    "Lag 2": [ // Kopierer roller fra Lag 1 for enkelhets skyld
        { role: "Lagfører", name: "", rank: "" }, { role: "NK Lag", name: "", rank: "" },
        { role: "MG1", name: "", rank: "" }, { role: "MG2", name: "", rank: "" },
        { role: "Geværmann 1", name: "", rank: "" }, { role: "Geværmann 2", name: "", rank: "" },
        { role: "Geværmann 3", name: "", rank: "" }, { role: "Geværmann 4", name: "", rank: "" }
    ],
    "Lag 3": [
        { role: "Lagfører", name: "", rank: "" }, { role: "NK Lag", name: "", rank: "" },
        { role: "MG1", name: "", rank: "" }, { role: "MG2", name: "", rank: "" },
        { role: "Geværmann 1", name: "", rank: "" }, { role: "Geværmann 2", name: "", rank: "" },
        { role: "Geværmann 3", name: "", rank: "" }, { role: "Geværmann 4", name: "", rank: "" }
    ],
    "Lag 4": [
        { role: "Lagfører", name: "", rank: "" }, { role: "NK Lag", name: "", rank: "" },
        { role: "MG1", name: "", rank: "" }, { role: "MG2", name: "", rank: "" },
        { role: "Geværmann 1", name: "", rank: "" }, { role: "Geværmann 2", name: "", rank: "" },
        { role: "Geværmann 3", name: "", rank: "" }, { role: "Geværmann 4", name: "", rank: "" }
    ]
};
// === 0: GLOBAL VARIABLES & CONSTANTS END ===


// === 1: INITIALIZATION & DOM READY START ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Tropp KO Verktøy - Initialiserer...");
    try {
        await initDB();
        console.log("Database initialisert vellykket.");

        // Initialiser UI-moduler FØR event listeners settes opp
        initializeMapModule(); // <--- Nytt kall for kart

        initializeTabs(); // Setter opp fanebytte-logikk (inkl. ulagret sjekk)
        initializeEventListeners(); // Setter opp generelle listeners

        // Sjekk om default roster skal opprettes
        await checkAndCreateDefaultRoster();

        // Last inn data for initielt aktiv fane og deretter roster/logg i bakgrunnen
        await loadInitialData();

        console.log("Applikasjon klar.");

    } catch (error) {
        console.error("Kritisk feil under initialisering:", error);
        const mainContent = document.getElementById('app-content');
        if (mainContent) {
            mainContent.innerHTML = `<p style="color: red; font-weight: bold;">Kunne ikke initialisere applikasjonen. Feil: ${error}</p>`;
        }
    }
});

async function loadInitialData() {
    const activeTabButton = document.querySelector('.tab-button.active');
    let activeTabId = 'map'; // Default til kart hvis ingen er aktiv enda
    if (activeTabButton) {
        activeTabId = activeTabButton.getAttribute('data-tab');
    }
    // Last data for aktiv fane først (kan trigge map load hvis den er aktiv)
    await loadDataForTab(activeTabId);

    // Last Roster og Logg data uansett (i bakgrunnen)
    // Unngå å laste på nytt hvis de var den aktive fanen
    if (activeTabId !== 'roster') await loadRosterData();
    if (activeTabId !== 'log') await loadLogData();
}

// Funksjon for å laste data basert på fane-ID
async function loadDataForTab(tabId) {
    console.log(`Laster data for fane: ${tabId}`);
    try {
        switch (tabId) {
            case 'roster':
                await loadRosterData();
                break;
            case 'log':
                await loadLogData();
                break;
            case 'units':
                await loadUnitsData();
                break;
            case 'map':
                // Kall funksjonen i map.js for å laste kartet hvis modulen er klar
                if (typeof loadMapDataFromStorage === 'function') {
                     await loadMapDataFromStorage();
                 } else {
                     console.warn("loadMapDataFromStorage() er ikke tilgjengelig enda.");
                 }
                break;
            case 'ops':
                // await loadOpsViewData();
                 console.log("loadOpsViewData() ikke implementert enda.");
                break;
            // Ingen spesifikk data å laste for settings
        }
    } catch (error) {
        console.error(`Feil ved lasting av data for fane ${tabId}:`, error);
        logEvent(`Feil ved lasting av data for fane ${tabId}: ${error.message}`, 'Error');
    }
}
// === 1: INITIALIZATION & DOM READY END ===

// === 2: TAB SWITCHING LOGIC START ===
let pendingTabSwitch = null;

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const targetTabId = button.getAttribute('data-tab');
            const currentActiveButton = document.querySelector('.tab-button.active');
            const currentActiveTabId = currentActiveButton ? currentActiveButton.getAttribute('data-tab') : null;

            if (button.classList.contains('active')) return; // Ikke gjør noe ved klikk på aktiv fane

            // Sjekk for ulagrede roster-endringer FØR bytte
            if (currentActiveTabId === 'roster' && rosterHasUnsavedChanges) {
                pendingTabSwitch = targetTabId;
                showUnsavedChangesDialog();
                return; // Avbryt byttet foreløpig
            }

            // Bytt fane direkte hvis ingen ulagrede endringer
            await switchToTab(targetTabId);
        });
    });

     // Aktiver standardfanen (Kart) og last data
     const defaultTabButton = document.querySelector('.tab-button[data-tab="map"]');
     const defaultTabContent = document.getElementById('map-tab');
     if (defaultTabButton && defaultTabContent) {
         // Ikke legg til 'active' her, det gjøres i switchToTab for konsistens
         switchToTab('map'); // Bytt til kart-fanen og last data
     } else {
         // Fallback hvis standardfane ikke finnes
         const firstTabButton = document.querySelector('.tab-button');
         if (firstTabButton) {
             const firstTabId = firstTabButton.getAttribute('data-tab');
             switchToTab(firstTabId);
         }
     }
}

async function switchToTab(targetTabId) {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const targetButton = document.querySelector(`.tab-button[data-tab="${targetTabId}"]`);
    const targetTabContent = document.getElementById(`${targetTabId}-tab`);

    if (!targetButton || !targetTabContent) {
        console.error(`Kunne ikke finne knapp eller innhold for fane: ${targetTabId}`);
        return;
    }

    // Håndter modus-reset når man navigerer vekk fra Kart-fanen
    const currentActiveButton = document.querySelector('.tab-button.active');
    if (currentActiveButton && currentActiveButton.getAttribute('data-tab') === 'map') {
         if (typeof setInteractionMode === 'function') {
            setInteractionMode('view'); // Gå ut av add-modus
         }
    }


    // Fjern 'active' fra alle
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // Legg til 'active' til målet
    targetButton.classList.add('active');
    targetTabContent.classList.add('active');
    console.log(`Navigerte til fane: ${targetTabId}`);

    // Last inn data for den nye aktive fanen
    await loadDataForTab(targetTabId);

    pendingTabSwitch = null; // Nullstill eventuelt ventende bytte
}

function showUnsavedChangesDialog() {
    const confirmation = confirm("Du har ulagrede endringer i rosteren.\n\n" +
                                 "Trykk OK for å lagre endringene og bytte fane.\n" +
                                 "Trykk Avbryt for å forkaste endringene og bytte fane.");

    if (confirmation) { // Lagre
        console.log("Bruker valgte å lagre endringer før fanebytte.");
        handleSaveRosterChanges(true); // true = bytt fane etter lagring
    } else { // Forkast
        console.log("Bruker valgte å forkaste endringer før fanebytte.");
        discardRosterChangesAndSwitchTab();
    }
}

async function discardRosterChangesAndSwitchTab() {
    resetRosterUnsavedChanges();
    if (pendingTabSwitch) {
        // Last roster data på nytt for å fjerne de forkastede endringene fra UI
        await loadRosterData();
        // Bytt til den ventende fanen
        await switchToTab(pendingTabSwitch); // Bruk await her også
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

async function logEvent(message, type = 'System') {
    console.log(`[${type}] ${getCurrentTimestamp()} - ${message}`);
    try {
        await addLogEntry({
            entryText: message,
            timestamp: new Date().toISOString(),
            type: type
        });
        if (document.getElementById('log-tab')?.classList.contains('active')) {
            await loadLogData();
        }
    } catch (error) {
        console.error("Kunne ikke legge til hendelse i databaseloggen:", error);
    }
}

// Hjelpefunksjon for å markere at roster har ulagrede endringer
function setRosterUnsavedChanges(hasChanges) {
    rosterHasUnsavedChanges = hasChanges;
    const saveButton = document.getElementById('save-roster-changes-button');
    const statusMessage = document.getElementById('roster-status-message');
    if (saveButton) {
        saveButton.disabled = !hasChanges;
        if (hasChanges) {
             saveButton.textContent = 'Lagre Roster Endringer *'; // Indiker ulagrede endringer
            if(statusMessage) statusMessage.textContent = 'Ulagrede endringer.';
        } else {
             saveButton.textContent = 'Lagre Roster Endringer';
             if(statusMessage) statusMessage.textContent = 'Alle endringer lagret.';
        }
    }
}

function resetRosterUnsavedChanges() {
     setRosterUnsavedChanges(false);
     // Fjern 'changed' og 'new-row' klasser fra alle rader
     document.querySelectorAll('#roster-display tr.changed').forEach(row => row.classList.remove('changed'));
     document.querySelectorAll('#roster-display tr.new-row').forEach(row => row.classList.remove('new-row'));
     // Tilbakestill statusmelding
     const statusMessage = document.getElementById('roster-status-message');
     if(statusMessage) statusMessage.textContent = '';
}
// === 3: UTILITY FUNCTIONS END ===


// === 4: EVENT LISTENERS INITIALIZATION START ===
function initializeEventListeners() {
    // Roster tab
    document.getElementById('save-roster-changes-button')?.addEventListener('click', () => handleSaveRosterChanges(false)); // false = ikke bytt fane
    document.getElementById('add-new-squad-button')?.addEventListener('click', handleAddNewSquadUI);
    // Event listeners for input/select/knapper inne i roster-tabellen legges til i addRosterEventListeners()

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
    document.getElementById('create-default-roster-button')?.addEventListener('click', handleCreateDefaultRoster);


    // Map tab (Placeholder)
    // document.getElementById('map-upload')?.addEventListener('change', handleMapUpload);
    // document.getElementById('add-point-mode')?.addEventListener('click', toggleAddPointMode);

    // Units tab (Placeholder)
     document.getElementById('add-unit-button')?.addEventListener('click', handleAddUnitUI); // Endret fra showAddUnitForm
}
// === 4: EVENT LISTENERS INITIALIZATION END ===

// === 5: ROSTER LOGIC START ===
// --- 5.1: Default Roster ---
async function checkAndCreateDefaultRoster() {
    try {
        const squads = await getAllSquads();
        if (squads.length === 0) {
            console.log("Ingen lag funnet, oppretter standard roster...");
            await createDefaultRoster();
            logEvent("Standard roster (Troppsstab, Lag 1-4) opprettet.", "System");
            // Trenger ikke laste roster her, det gjøres i loadInitialData
        } else {
            console.log("Eksisterende lag funnet, hopper over oppretting av standard roster.");
        }
    } catch (error) {
        console.error("Feil ved sjekking/oppretting av default roster:", error);
        logEvent(`Feil ved oppretting av default roster: ${error.message}`, 'Error');
    }
}

async function handleCreateDefaultRoster() {
     if (confirm("Er du sikker på at du vil legge til standard lag (Troppsstab, Lag 1-4) og roller? Eksisterende lag med samme navn blir ikke påvirket, men personell legges kun til hvis laget er tomt.")) {
        console.log("Bruker ba om å opprette standard roster...");
        try {
            await createDefaultRoster(true); // true = force check/add even if some squads exist
            logEvent("Forsøkte å opprette/gjenopprette standard roster.", "System");
            alert("Standard roster opprettet/oppdatert der det var mulig.");
            await loadRosterData(); // Last inn roster på nytt
        } catch(error) {
             console.error("Feil ved manuell oppretting av default roster:", error);
             logEvent(`Feil ved manuell oppretting av default roster: ${error.message}`, 'Error');
             alert(`Kunne ikke opprette standard roster: ${error.message}`)
        }
     }
}


async function createDefaultRoster(forceCheck = false) {
    const existingSquads = await getAllSquads();
    const existingSquadMap = existingSquads.reduce((map, squad) => {
        map[squad.name] = squad;
        return map;
    }, {});

    for (const defaultSquad of DEFAULT_SQUADS) {
        let squadId;
        let squadIsNew = false;
        if (!existingSquadMap[defaultSquad.name]) {
            // Laget finnes ikke, opprett det
            try {
                squadId = await addSquad({ name: defaultSquad.name });
                existingSquadMap[defaultSquad.name] = { id: squadId, name: defaultSquad.name }; // Legg til i map for personell
                squadIsNew = true;
                console.log(`Opprettet default lag: ${defaultSquad.name} (ID: ${squadId})`);
            } catch (error) {
                console.error(`Kunne ikke opprette default lag ${defaultSquad.name}:`, error);
                continue; // Hopp til neste lag
            }
        } else if (forceCheck) {
             // Laget finnes, men vi tvinger sjekk (f.eks. fra knapp)
             squadId = existingSquadMap[defaultSquad.name].id;
             console.log(`Standard lag ${defaultSquad.name} (ID: ${squadId}) finnes allerede.`);
        } else {
            // Laget finnes, og vi oppretter ikke på nytt med mindre forceCheck=true
            continue;
        }


        // Legg til default personell KUN hvis laget er nytt ELLER hvis forceCheck=true OG laget er tomt
        const personnelDefaults = DEFAULT_PERSONNEL[defaultSquad.name] || [];
        if (personnelDefaults.length > 0 && (squadIsNew || forceCheck)) {
             // Sjekk om laget har personell fra før (kun relevant ved forceCheck)
             const currentPersonnel = await getPersonnelBySquad(squadId);
             if (squadIsNew || (forceCheck && currentPersonnel.length === 0)) {
                 console.log(`Legger til default personell for ${defaultSquad.name}...`);
                for (const person of personnelDefaults) {
                    try {
                        await addPersonnel({
                            squadId: squadId,
                            name: person.name || "", // Tomt navn som standard
                            rank: person.rank || "", // Tom grad som standard
                            role: person.role,
                            status: 'Tilstede',
                            availability: 'Hvile',
                            notes: ''
                        });
                    } catch (error) {
                        console.error(`Kunne ikke legge til default personell (${person.role}) i ${defaultSquad.name}:`, error);
                    }
                }
             } else if (forceCheck && currentPersonnel.length > 0) {
                 console.log(`Laget ${defaultSquad.name} har allerede personell, legger ikke til defaults.`);
             }
        }
    }
     resetRosterUnsavedChanges(); // Nullstill flagg etterpå
}

// --- 5.2: Rendering Roster UI ---
async function loadRosterData() {
    console.log("Laster roster data...");
    const displayDiv = document.getElementById('roster-display');
    if (!displayDiv) return;

    displayDiv.innerHTML = '<p>Laster...</p>';

    try {
        const squads = await getAllSquads();
        const personnel = await getAllPersonnel();

        // Sorter lag (Stab først, deretter alfabetisk/numerisk)
         squads.sort((a, b) => {
             if (a.name === "Troppsstab") return -1;
             if (b.name === "Troppsstab") return 1;
             return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
         });


        let rosterHtml = '';
        if (squads.length === 0) {
             rosterHtml = '<p>Ingen lag definert. Du kan legge til et nytt lag eller <a href="#" id="create-default-roster-link">opprette standardoppsettet</a>.</p>';
        } else {
            for (const squad of squads) {
                rosterHtml += `<div class="squad-section" data-squad-id="${squad.id}">`;
                rosterHtml += `<h3>${squad.name} <button class="delete-squad-btn" data-squad-id="${squad.id}" title="Slett lag ${squad.name}">🗑️</button></h3>`;
                const squadPersonnel = personnel.filter(p => p.squadId === squad.id);

                rosterHtml += `
                    <table class="roster-table">
                        <thead>
                            <tr>
                                <th>Navn</th>
                                <th>Grad</th>
                                <th>Stilling</th>
                                <th>Status</th>
                                <th>Tilgj.</th>
                                <th>Notater</th>
                                <th>Handlinger</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                if (squadPersonnel.length > 0) {
                    // Sorter personell etter en logisk rekkefølge? F.eks. rolle? La oss sortere etter ID foreløpig.
                     squadPersonnel.sort((a, b) => a.id - b.id);
                    squadPersonnel.forEach(p => {
                        rosterHtml += generatePersonnelRowHtml(p);
                    });
                } else {
                    rosterHtml += '<tr><td colspan="7"><i>Ingen personell i dette laget.</i></td></tr>';
                }

                rosterHtml += `</tbody></table>`;
                rosterHtml += `<button class="add-personnel-to-squad-btn" data-squad-id="${squad.id}">+ Legg til personell</button>`;
                rosterHtml += `</div><hr>`; // Slutt på squad-section og skillelinje
            }
        }

        displayDiv.innerHTML = rosterHtml;

         // Legg til event listener for "opprett standardoppsettet"-link hvis den finnes
         document.getElementById('create-default-roster-link')?.addEventListener('click', (e) => {
             e.preventDefault();
             handleCreateDefaultRoster();
         });

        addRosterEventListeners(); // Legg til listeners for input, select, knapper etc.
        // Ikke nullstill unsaved changes her, da brukeren ikke har gjort noe enda
        // setRosterUnsavedChanges(false); // Gjør dette ETTER en lagring eller forkasting

    } catch (error) {
        console.error("Feil ved lasting av roster data:", error);
        displayDiv.innerHTML = '<p style="color: red;">Kunne ikke laste roster.</p>';
        logEvent(`Feil ved lasting av roster: ${error.message}`, 'Error');
    }
}

function generatePersonnelRowHtml(personnelData, isNew = false) {
    const p = personnelData; // Kortere variabelnavn
    const personnelId = p.id || `new_${Date.now()}`; // Gi nye rader en midlertidig unik ID
    const rowClass = isNew ? 'new-row changed' : ''; // Merk nye rader for lagring/styling
    const isBorte = p.status === 'Borte';

    let roleOptionsHtml = STANDARD_ROLES.map(role => {
        // Hvis rollen fra dataen IKKE er en standard rolle, OG det er "Annet...", velg "Annet..."
        // Hvis rollen fra dataen ER en standard rolle, velg den.
        const isStandard = STANDARD_ROLES.includes(p.role);
        const selected = (role === 'Annet...' && !isStandard) || (role !== 'Annet...' && role === p.role);
        return `<option value="${role}" ${selected ? 'selected' : ''}>${role}</option>`;
    }).join('');

    // Vis custom role input hvis "Annet..." er valgt ELLER hvis rollen ikke er standard
    const showCustomRole = (p.role && !STANDARD_ROLES.includes(p.role)) || (p.role === 'Annet...');
    const customRoleValue = showCustomRole && p.role !== 'Annet...' ? p.role : (p.customRole || ''); // Bruk p.role hvis det er custom, ellers p.customRole

    return `
        <tr data-personnel-id="${personnelId}" class="${rowClass}" data-original-data='${JSON.stringify(p)}'>
            <td><input type="text" class="roster-input" data-field="name" value="${p.name || ''}" placeholder="Navn"></td>
            <td><input type="text" class="roster-input" data-field="rank" value="${p.rank || ''}" placeholder="Grad"></td>
            <td>
                <select class="roster-select role-select" data-field="role">
                    ${roleOptionsHtml}
                </select>
                <input type="text" class="roster-input custom-role-input" data-field="customRole" value="${customRoleValue}" placeholder="Annen stilling..." style="display: ${showCustomRole ? 'inline-block' : 'none'}; margin-top: 5px;">
            </td>
            <td>
                <select class="roster-select status-select" data-field="status">
                    <option value="Tilstede" ${p.status === 'Tilstede' ? 'selected' : ''}>Tilstede</option>
                    <option value="Borte" ${p.status === 'Borte' ? 'selected' : ''}>Borte</option>
                </select>
            </td>
            <td>
                 <select class="roster-select availability-select" data-field="availability" ${isBorte ? 'disabled' : ''}>
                    <option value="Hvile" ${p.availability === 'Hvile' ? 'selected' : ''}>Hvile</option>
                    <option value="Beredskap" ${p.availability === 'Beredskap' ? 'selected' : ''}>Beredskap</option>
                    <option value="Vakt" ${p.availability === 'Vakt' ? 'selected' : ''}>Vakt</option>
                    <option value="Utilgjengelig" ${p.availability === 'Utilgjengelig' || isBorte ? 'selected' : ''}>Utilgj.</option>
                </select>
            </td>
            <td>
                <input type="text" class="roster-input" data-field="notes" value="${p.notes || ''}" placeholder="Notat...">
            </td>
            <td>
                <button class="delete-personnel-btn" title="Slett personell">🗑️</button>
            </td>
        </tr>
    `;
}

// --- 5.3: Event Listeners for Roster UI Elements ---
function addRosterEventListeners() {
    const rosterDisplay = document.getElementById('roster-display');
    if (!rosterDisplay) return;

    rosterDisplay.querySelectorAll('.roster-input, .roster-select').forEach(element => {
        element.addEventListener('input', handleRosterInputChange); // 'input' fanger opp endringer raskere enn 'change' for tekstfelt
        if (element.tagName === 'SELECT') {
            element.addEventListener('change', handleRosterInputChange); // 'change' for select
        }
    });

    rosterDisplay.querySelectorAll('.delete-personnel-btn').forEach(button => {
        button.addEventListener('click', handleDeletePersonnel);
    });

    rosterDisplay.querySelectorAll('.delete-squad-btn').forEach(button => {
         button.addEventListener('click', handleDeleteSquad);
     });

     rosterDisplay.querySelectorAll('.add-personnel-to-squad-btn').forEach(button => {
         button.addEventListener('click', handleAddPersonnelUI);
     });
}

function handleRosterInputChange(event) {
    const element = event.target;
    const row = element.closest('tr');
    if (!row) return;

    row.classList.add('changed'); // Merk raden som endret
    setRosterUnsavedChanges(true); // Aktiver lagre-knappen og sett flagg

    // Spesialhåndtering for status -> availability
    if (element.classList.contains('status-select')) {
        const availabilitySelect = row.querySelector('.availability-select');
        if (availabilitySelect) {
            if (element.value === 'Borte') {
                availabilitySelect.value = 'Utilgjengelig';
                availabilitySelect.disabled = true;
            } else {
                availabilitySelect.disabled = false;
                // Gjenopprett forrige verdi? Eller sett til default? Setter til Hvile hvis den var Utilgjengelig.
                if (availabilitySelect.value === 'Utilgjengelig') {
                     availabilitySelect.value = 'Hvile';
                 }
            }
             // Merk raden som endret selv om bare availability endres som følge av status
             availabilitySelect.closest('tr')?.classList.add('changed');
        }
    }

     // Spesialhåndtering for Stilling -> Annet...
     if (element.classList.contains('role-select')) {
         const customRoleInput = row.querySelector('.custom-role-input');
         if (customRoleInput) {
             if (element.value === 'Annet...') {
                 customRoleInput.style.display = 'inline-block';
                 customRoleInput.focus(); // Sett fokus for enkel skriving
             } else {
                 customRoleInput.style.display = 'none';
                 customRoleInput.value = ''; // Tøm custom felt når standard velges
             }
         }
     }
}


// --- 5.4: Adding/Deleting Squads/Personnel UI ---
function handleAddNewSquadUI() {
    if (rosterHasUnsavedChanges) {
        alert("Du har ulagrede endringer i rosteren. Lagre eller forkast dem før du legger til et nytt lag.");
        return;
    }
    const squadName = prompt("Skriv inn navn for det nye laget:");
    if (squadName && squadName.trim()) {
        addNewSquad(squadName.trim());
    } else if (squadName !== null) { // Ikke null betyr at bruker ikke trykket Avbryt
        alert("Lagnavn kan ikke være tomt.");
    }
}

async function addNewSquad(squadName) {
    try {
         // Sjekk om lagnavnet allerede finnes
        const existingSquads = await getAllSquads();
        if (existingSquads.some(s => s.name.toLowerCase() === squadName.toLowerCase())) {
            alert(`Laget "${squadName}" finnes allerede.`);
            return;
        }

        const newSquadId = await addSquad({ name: squadName });
        logEvent(`Nytt lag "${squadName}" (ID: ${newSquadId}) lagt til.`, 'Roster');

        // Legg til HTML for det nye laget i UI uten å laste alt på nytt
        const displayDiv = document.getElementById('roster-display');
        if (displayDiv) {
            const newSquadHtml = `
                <div class="squad-section" data-squad-id="${newSquadId}">
                    <h3>${squadName} <button class="delete-squad-btn" data-squad-id="${newSquadId}" title="Slett lag ${squadName}">🗑️</button></h3>
                    <table class="roster-table">
                        <thead>
                            <tr><th>Navn</th><th>Grad</th><th>Stilling</th><th>Status</th><th>Tilgj.</th><th>Notater</th><th>Handlinger</th></tr>
                        </thead>
                        <tbody>
                            <tr><td colspan="7"><i>Ingen personell i dette laget.</i></td></tr>
                        </tbody>
                    </table>
                    <button class="add-personnel-to-squad-btn" data-squad-id="${newSquadId}">+ Legg til personell</button>
                </div><hr>`;
            displayDiv.insertAdjacentHTML('beforeend', newSquadHtml); // Legg til på slutten

            // Legg til event listeners for de nye knappene i det nye laget
            const newSquadSection = displayDiv.querySelector(`.squad-section[data-squad-id="${newSquadId}"]`);
             newSquadSection.querySelector('.delete-squad-btn')?.addEventListener('click', handleDeleteSquad);
             newSquadSection.querySelector('.add-personnel-to-squad-btn')?.addEventListener('click', handleAddPersonnelUI);
        }

    } catch (error) {
        console.error("Feil ved tillegging av nytt lag:", error);
        alert(`Kunne ikke legge til lag: ${error.message}`);
        logEvent(`Feil ved tillegging av lag "${squadName}": ${error.message}`, 'Error');
    }
}


function handleAddPersonnelUI(event) {
    const button = event.target;
    const squadId = Number(button.dataset.squadId);
    const squadSection = button.closest('.squad-section');
    const tableBody = squadSection?.querySelector('tbody');

    if (!squadId || !tableBody) {
        console.error("Kunne ikke finne lag ID eller tabell for å legge til personell.");
        return;
    }

    // Fjern "Ingen personell"-raden hvis den finnes
    const noPersonnelRow = tableBody.querySelector('td[colspan="7"]');
    if (noPersonnelRow) noPersonnelRow.closest('tr').remove();

    // Lag data for en ny, tom rad
    const newPersonnelData = {
        id: null, // Indikerer at dette er en ny person
        squadId: squadId,
        name: '', rank: '', role: STANDARD_ROLES[0], // Default til første rolle? Eller tom?
        status: 'Tilstede', availability: 'Hvile', notes: ''
    };

    // Generer HTML og legg til i tabellen
    const newRowHtml = generatePersonnelRowHtml(newPersonnelData, true); // true = isNew
    tableBody.insertAdjacentHTML('beforeend', newRowHtml);

    // Finn den nye raden og legg til event listeners
    const newRow = tableBody.lastElementChild;
    if (newRow) {
        newRow.querySelectorAll('.roster-input, .roster-select').forEach(element => {
            element.addEventListener('input', handleRosterInputChange);
            if (element.tagName === 'SELECT') {
                element.addEventListener('change', handleRosterInputChange);
            }
        });
        newRow.querySelector('.delete-personnel-btn')?.addEventListener('click', handleDeletePersonnel);
        // Sett fokus på første inputfelt i den nye raden
        newRow.querySelector('input[data-field="name"]')?.focus();
    }

    setRosterUnsavedChanges(true); // Merk at endringer er gjort
}

async function handleDeletePersonnel(event) {
    const button = event.target;
    const row = button.closest('tr');
    const personnelId = row.dataset.personnelId; // Kan være tall-ID eller "new_timestamp"

    if (!personnelId) {
        console.error("Kunne ikke finne personnelId for sletting.");
        return;
    }

    const personnelName = row.querySelector('input[data-field="name"]')?.value || 'Ny person';
    const isNewRow = row.classList.contains('new-row');

    if (confirm(`Er du sikker på at du vil slette ${personnelName}?`)) {
        if (isNewRow) {
            // Bare fjern raden fra UI, den er ikke lagret i DB enda
            row.remove();
            console.log("Fjernet ny, ulagret personellrad.");
            // Sjekk om det er noen andre endringer igjen
             const remainingChanges = document.querySelectorAll('#roster-display tr.changed').length;
             if (remainingChanges === 0) {
                 setRosterUnsavedChanges(false);
             }
        } else {
            // Slett fra databasen
            try {
                await deletePersonnel(Number(personnelId)); // Sørg for at ID er tall
                logEvent(`Personell "${personnelName}" (ID: ${personnelId}) slettet.`, 'Roster');
                row.remove(); // Fjern raden fra UI
                alert(`${personnelName} slettet.`);
                 // Sjekk om det er noen andre endringer igjen
                 const remainingChanges = document.querySelectorAll('#roster-display tr.changed').length;
                 if (remainingChanges === 0) {
                     setRosterUnsavedChanges(false);
                 }

                 // Sjekk om laget ble tomt, legg til "Ingen personell"-tekst
                 const tableBody = row.closest('tbody');
                 if (tableBody && tableBody.children.length === 0) {
                     tableBody.innerHTML = '<tr><td colspan="7"><i>Ingen personell i dette laget.</i></td></tr>';
                 }

            } catch (error) {
                console.error(`Feil ved sletting av personell ID ${personnelId}:`, error);
                alert(`Kunne ikke slette personell: ${error.message}`);
                logEvent(`Feil ved sletting av personell "${personnelName}" (ID: ${personnelId}): ${error.message}`, 'Error');
            }
        }
    }
}

async function handleDeleteSquad(event) {
     const button = event.target;
     const squadId = Number(button.dataset.squadId);
     const squadSection = button.closest('.squad-section');
     const squadNameElement = squadSection?.querySelector('h3');
     // Hent navn fra h3, fjern sletteknappen fra teksten
     const squadName = squadNameElement?.textContent.replace(button.textContent, '').trim() || `Lag ID ${squadId}`;

     if (!squadId || !squadSection) {
         console.error("Kunne ikke finne squadId eller seksjon for sletting.");
         return;
     }

     // Sjekk om det er personell i laget (fra UI er enklest her)
     const personnelRows = squadSection.querySelectorAll('tbody tr:not(:has(td[colspan="7"]))'); // Rader som IKKE er "Ingen personell"
     let confirmationMessage = `Er du sikker på at du vil slette laget "${squadName}"?`;
     if (personnelRows.length > 0) {
         confirmationMessage += `\n\nADVARSEL: Dette laget har ${personnelRows.length} personell. Disse vil bli slettet permanent sammen med laget.`;
     }

     if (confirm(confirmationMessage)) {
         try {
            // 1. Hent IDene til personell i laget fra databasen for å slette dem
            const personnelInSquad = await getPersonnelBySquad(squadId);
             let deleteCount = 0;
             for (const person of personnelInSquad) {
                 await deletePersonnel(person.id);
                 deleteCount++;
             }
            logEvent(`Slettet ${deleteCount} personell fra lag "${squadName}" (ID: ${squadId}).`, 'Roster');


             // 2. Slett selve laget
             await deleteSquad(squadId);
             logEvent(`Lag "${squadName}" (ID: ${squadId}) slettet.`, 'Roster');

             // 3. Fjern lagets HTML fra UI
             const hrSeparator = squadSection.nextElementSibling; // Finn <hr> etter seksjonen
             squadSection.remove();
             if (hrSeparator && hrSeparator.tagName === 'HR') {
                 hrSeparator.remove();
             }
             alert(`Lag "${squadName}" og tilhørende personell slettet.`);

              // Sjekk om det er noen andre endringer igjen
             const remainingChanges = document.querySelectorAll('#roster-display tr.changed').length;
             if (remainingChanges === 0) {
                 setRosterUnsavedChanges(false);
             }

             // Sjekk om det er noen lag igjen
             const remainingSquads = document.querySelectorAll('#roster-display .squad-section').length;
             if (remainingSquads === 0) {
                 document.getElementById('roster-display').innerHTML = '<p>Ingen lag definert. Du kan legge til et nytt lag eller <a href="#" id="create-default-roster-link">opprette standardoppsettet</a>.</p>';
                 // Legg til event listener for den nye linken
                 document.getElementById('create-default-roster-link')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleCreateDefaultRoster();
                 });
             }


         } catch (error) {
             console.error(`Feil ved sletting av lag ID ${squadId}:`, error);
             alert(`Kunne ikke slette lag: ${error.message}`);
             logEvent(`Feil ved sletting av lag "${squadName}" (ID: ${squadId}): ${error.message}`, 'Error');
         }
     }
 }

// --- 5.5: Saving Roster Changes ---
async function handleSaveRosterChanges(switchTabAfterSave = false) {
    console.log("Starter lagring av roster endringer...");
    const changedRows = document.querySelectorAll('#roster-display tr.changed');
    const statusMessage = document.getElementById('roster-status-message');
    if (statusMessage) statusMessage.textContent = 'Lagrer...';

    if (changedRows.length === 0) {
        console.log("Ingen endringer å lagre.");
        if (statusMessage) statusMessage.textContent = 'Ingen endringer å lagre.';
        setRosterUnsavedChanges(false); // Sikrer at knappen er deaktivert
         if (switchTabAfterSave && pendingTabSwitch) {
             switchToTab(pendingTabSwitch);
         }
        return;
    }

    let successCount = 0;
    let errorCount = 0;
    let newPersonnelCount = 0;
    let updatedPersonnelCount = 0;

    for (const row of changedRows) {
        const personnelId = row.dataset.personnelId;
        const isNewRow = row.classList.contains('new-row');
        const squadId = Number(row.closest('.squad-section')?.dataset.squadId);

        if (!squadId) {
            console.error("Kunne ikke finne squadId for rad:", row);
            errorCount++;
            continue;
        }

        // Hent verdier fra input/select
        const name = row.querySelector('input[data-field="name"]')?.value.trim() || '';
        const rank = row.querySelector('input[data-field="rank"]')?.value.trim() || '';
        const roleSelect = row.querySelector('select[data-field="role"]');
        const customRoleInput = row.querySelector('input[data-field="customRole"]');
        const status = row.querySelector('select[data-field="status"]')?.value;
        const availability = row.querySelector('select[data-field="availability"]')?.value;
        const notes = row.querySelector('input[data-field="notes"]')?.value.trim() || '';

        let finalRole = roleSelect.value;
        if (finalRole === 'Annet...') {
            finalRole = customRoleInput.value.trim() || 'Annet...'; // Bruk custom tekst, fallback til 'Annet...'
        }

        const personData = {
            squadId: squadId,
            name: name,
            rank: rank,
            role: finalRole,
            status: status,
            availability: availability,
            notes: notes
        };

         // Enkel validering: krev navn for å lagre
         if (!personData.name) {
             alert(`Personell i lag ID ${squadId} mangler navn. Kan ikke lagre.`);
             // Gi visuell indikasjon på raden?
             row.style.border = '2px solid red';
             errorCount++;
             continue; // Hopp til neste rad
         } else {
             row.style.border = ''; // Fjern eventuell feilmarkering
         }


        try {
            if (isNewRow) {
                // Legg til ny personell i DB
                const newId = await addPersonnel(personData);
                row.dataset.personnelId = newId; // Oppdater raden med den nye IDen fra DB
                row.classList.remove('new-row'); // Fjern 'new-row' klassen
                newPersonnelCount++;
                logEvent(`Nytt personell "${personData.name}" (ID: ${newId}) lagt til i lag ${squadId}.`, 'Roster');
            } else {
                // Oppdater eksisterende personell
                personData.id = Number(personnelId); // Legg til ID for oppdatering
                await updatePersonnel(personData);
                updatedPersonnelCount++;
                logEvent(`Personell "${personData.name}" (ID: ${personData.id}) oppdatert.`, 'Roster');
            }
            row.classList.remove('changed'); // Fjern 'changed' klassen etter vellykket lagring
            successCount++;
        } catch (error) {
            console.error(`Feil ved lagring av personell ${isNewRow ? '(ny)' : `ID ${personnelId}`}:`, error);
            logEvent(`Feil ved lagring av ${personData.name}: ${error.message}`, 'Error');
            errorCount++;
            // La 'changed' klassen stå slik at brukeren ser at det feilet?
             row.style.border = '2px solid orange'; // Indiker lagringsfeil
        }
    } // End for loop

    console.log(`Lagring fullført. Vellykket: ${successCount}, Feil: ${errorCount}. Nye: ${newPersonnelCount}, Oppdaterte: ${updatedPersonnelCount}.`);
    if (statusMessage) {
        let message = `Lagret ${successCount} endring(er).`;
        if (errorCount > 0) {
             message += ` ${errorCount} feilet (se konsoll/markerte rader).`;
        }
        statusMessage.textContent = message;
    }


    if (errorCount === 0) {
        setRosterUnsavedChanges(false); // Alle endringer lagret, deaktiver knapp
        if (switchTabAfterSave && pendingTabSwitch) {
            switchToTab(pendingTabSwitch);
        }
    } else {
        setRosterUnsavedChanges(true); // Noe feilet, la lagreknappen være aktiv
        alert(`Kunne ikke lagre ${errorCount} endring(er). Sjekk rader markert med oransje kantlinje og konsollen for detaljer.`);
         if (switchTabAfterSave) {
             // Ikke bytt fane hvis noe feilet
             console.log("Fanebytte avbrutt på grunn av lagringsfeil.");
             pendingTabSwitch = null; // Nullstill ventende bytte
         }
    }
}
// === 5: ROSTER LOGIC END ===

// === 6: LOG LOGIC START ===
// Ingen endringer i loadLogData eller handleAddManualLog her
async function loadLogData() {
    console.log("Laster logg data...");
    const logList = document.getElementById('log-list');
    const logDisplay = document.getElementById('log-display');
    if (!logList || !logDisplay) return;

     const loadingIndicator = logDisplay.querySelector('p');
     if (loadingIndicator) loadingIndicator.textContent = 'Laster logg...';
    logList.innerHTML = '';

    try {
        const entries = await getAllLogEntries();
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        if (entries.length === 0) {
            logList.innerHTML = '<li>Loggen er tom.</li>';
        } else {
            entries.forEach(entry => {
                const li = document.createElement('li');
                const timestamp = new Date(entry.timestamp).toLocaleString('no-NO', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                li.textContent = `[${timestamp}] [${entry.type || 'Ukjent'}] ${entry.entryText}`;
                logList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Feil ved lasting av logg:", error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        logList.innerHTML = '<li style="color: red;">Kunne ikke laste loggen.</li>';
    }
}

async function handleAddManualLog() {
    const input = document.getElementById('manual-log-entry');
    const entryText = input.value.trim();
    if (!entryText) return;

    try {
        await logEvent(entryText, 'Manuell');
        input.value = '';
    } catch (error) {
        console.error("Feil ved manuell loggføring:", error);
        alert("Kunne ikke legge til loggføring.");
    }
}
// === 6: LOG LOGIC END ===

// === 7: SETTINGS LOGIC START ===
// Ingen endringer i eksport/import/clear her, kun lagt til handler for ny knapp
async function handleExportData() {
    console.log("Starter eksport av data...");
    // ... (samme som før)
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
        importButton.style.display = 'inline-block';
    } else {
        importButton.style.display = 'none';
        if (file) {
            alert("Vennligst velg en gyldig .json fil.");
            event.target.value = null;
        }
    }
}

async function handleImportData() {
    const fileInput = document.getElementById('import-data-input');
    const file = fileInput.files[0];
    const importButton = document.getElementById('import-data-button');

    if (!file) { alert("Ingen fil valgt for import."); return; }
    if (!confirm("ADVARSEL: Import vil overskrive all eksisterende data. Er du sikker?")) { return; }

    console.log("Starter import av data...");
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const jsonData = event.target.result;
            const data = JSON.parse(jsonData);

            // Validering (enkel)
            const requiredStores = [STORE_SQUADS, STORE_ROSTER, STORE_UNITS, STORE_MAPDATA, STORE_LOG];
             for (const storeName of requiredStores) {
                 if (typeof data[storeName] === 'undefined') {
                     console.warn(`Importert data mangler object store: ${storeName}. Fortsetter import av resten.`);
                 } else if (!Array.isArray(data[storeName])) {
                      throw new Error(`Data for "${storeName}" i importfilen er ikke en liste (array).`);
                 }
             }

            await importAllData(data);

            console.log("Data importert vellykket.");
            logEvent("Data importert fra fil. Applikasjonen laster inn data på nytt.", "System");
            alert("Data importert vellykket! Applikasjonen vil nå laste inn data på nytt.");

            fileInput.value = null;
            importButton.style.display = 'none';
            resetRosterUnsavedChanges(); // Nullstill flagg i tilfelle import skjer mens roster er åpen

            // Last inn data på nytt
            await loadInitialData(); // Laster for aktiv fane + roster/logg


        } catch (error) {
            console.error("Feil under dataimport:", error);
            logEvent(`Feil under dataimport: ${error.message}`, "Error");
            alert(`Kunne ikke importere data: ${error.message}`);
            fileInput.value = null;
            importButton.style.display = 'none';
        }
    };

    reader.onerror = (event) => {
        console.error("Feil ved lesing av fil:", event.target.error);
        logEvent(`Feil ved lesing av importfil: ${event.target.error}`, "Error");
        alert("Kunne ikke lese den valgte filen.");
        fileInput.value = null;
        importButton.style.display = 'none';
    };

    reader.readAsText(file);
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
    hideClearDataConfirmation();

    try {
        await clearAllData();
        console.log("All data slettet.");
        logEvent("All lokal data slettet.", "System");
        alert("All lokal data er slettet!");
        resetRosterUnsavedChanges(); // Nullstill flagg

        // Last inn data på nytt (vil trigge default roster creation hvis den er tom)
        await checkAndCreateDefaultRoster();
        await loadInitialData();

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
// Endret litt for å passe med ny UI-tankegang
async function loadUnitsData() {
    console.log("Laster enhetsdata (poster/patruljer)...");
    const unitListDiv = document.getElementById('unit-list');
    if (!unitListDiv) return;
    unitListDiv.innerHTML = '<p>Laster enheter...</p>';
    try {
        const units = await getAllUnits();
        const squads = await getAllSquads();
        const squadMap = squads.reduce((map, squad) => { map[squad.id] = squad.name; return map; }, {});
        let unitsHtml = '';
        if (units.length === 0) {
            unitsHtml = '<p>Ingen enheter definert ennå.</p>';
        } else {
            units.forEach(unit => {
                unitsHtml += generateUnitItemHtml(unit, squadMap);
            });
        }
        unitListDiv.innerHTML = unitsHtml;
        addUnitEventListeners();
    } catch (error) {
        console.error("Feil ved lasting av enheter:", error);
        unitListDiv.innerHTML = '<p style="color: red;">Kunne ikke laste enheter.</p>';
        logEvent(`Feil ved lasting av enheter: ${error.message}`, 'Error');
    }
}

function generateUnitItemHtml(unit, squadMap) {
    const squadName = unit.assignedSquadId ? (squadMap[unit.assignedSquadId] || `Ukjent lag (ID: ${unit.assignedSquadId})`) : 'Ikke tildelt';
    // Mer detaljert visning kanskje?
    return `
        <div class="unit-item" data-unit-id="${unit.id}">
            <h4>${unit.name || 'Ukjent enhet'} (${unit.type || 'Ukjent type'})</h4>
            <p>Ansvarlig: ${squadName}</p>
            <p>Antall pers: ${unit.personnelCount || '?'}</p>
            <p>Status: ${unit.status || 'Ukjent'}</p>
            <p>Posisjon: ${unit.position ? `X:${unit.position.x}, Y:${unit.position.y}` : 'Ikke plassert'}</p>
             <!-- Knapper for rediger/slett/plasser på kart etc. -->
             <button class="edit-unit-btn" title="Rediger enhet">✏️</button>
             <button class="delete-unit-btn" title="Slett enhet">🗑️</button>
             <button class="place-unit-btn" title="Plasser/flytt på kart">📍</button>
        </div>
    `;
}

function addUnitEventListeners() {
    document.querySelectorAll('#unit-list .edit-unit-btn').forEach(btn => btn.addEventListener('click', handleEditUnitUI));
    document.querySelectorAll('#unit-list .delete-unit-btn').forEach(btn => btn.addEventListener('click', handleDeleteUnit));
    document.querySelectorAll('#unit-list .place-unit-btn').forEach(btn => btn.addEventListener('click', handlePlaceUnit));
}

function handleAddUnitUI() {
    // Skal vise et skjema/modal for å legge til en ny enhet
    console.log("handleAddUnitUI() - Vise skjema for ny enhet (ikke implementert)");
    // 1. Vis skjema (navn, type(post/patrulje), ansvarlig lag (dropdown), antall pers)
    // 2. Ved lagring, kall addUnit()
    // 3. Oppdater unit-list visningen
}

function handleEditUnitUI(event) {
    const unitId = event.target.closest('.unit-item')?.dataset.unitId;
    console.log(`handleEditUnitUI(${unitId}) - Vise redigeringsskjema (ikke implementert)`);
    // 1. Hent enhetsdata med getUnitById(unitId)
    // 2. Vis skjema/modal forhåndsutfylt med data
    // 3. Ved lagring, kall updateUnit()
    // 4. Oppdater visningen for denne enheten
}

async function handleDeleteUnit(event) {
    const unitId = event.target.closest('.unit-item')?.dataset.unitId;
    const unitName = event.target.closest('.unit-item')?.querySelector('h4')?.textContent || `Enhet ID ${unitId}`;
    if (!unitId) return;

    if (confirm(`Er du sikker på at du vil slette enhet "${unitName}"?`)) {
        try {
            await deleteUnit(Number(unitId));
            logEvent(`Enhet "${unitName}" (ID: ${unitId}) slettet.`, 'Unit');
            event.target.closest('.unit-item').remove(); // Fjern fra UI
             // Sjekk om listen ble tom
             const unitListDiv = document.getElementById('unit-list');
             if (unitListDiv && unitListDiv.children.length === 0) {
                 unitListDiv.innerHTML = '<p>Ingen enheter definert ennå.</p>';
             }
            alert(`Enhet "${unitName}" slettet.`);
        } catch (error) {
            console.error(`Feil ved sletting av enhet ID ${unitId}:`, error);
            alert(`Kunne ikke slette enhet: ${error.message}`);
            logEvent(`Feil ved sletting av enhet "${unitName}" (ID: ${unitId}): ${error.message}`, 'Error');
        }
    }
}

function handlePlaceUnit(event) {
    const unitId = event.target.closest('.unit-item')?.dataset.unitId;
     console.log(`handlePlaceUnit(${unitId}) - Aktiver kartmodus for plassering (ikke implementert)`);
    // 1. Bytt til Kart-fane (eller Ops-bilde fane?)
    // 2. Aktiver en "plasseringsmodus" for den valgte enheten
    // 3. La brukeren klikke på kartet
    // 4. Lagre posisjonen (x, y) i enhetsdataen via updateUnit()
    // 5. Oppdater visningen på kartet og i enhetslisten
}

// === 9: UNITS LOGIC (PLACEHOLDER) END ===


// === 10: OPS VIEW LOGIC (PLACEHOLDER) START ===
// async function loadOpsViewData() { console.log("Laster data for operasjonsbilde..."); }
// function refreshOpsView() { console.log("Oppdaterer operasjonsbilde visning..."); }
// === 10: OPS VIEW LOGIC (PLACEHOLDER) END ===
