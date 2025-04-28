// === 1: DATABASE CONFIGURATION START ===
const DB_NAME = 'TroppKO_DB';
const DB_VERSION = 1; // Øk dette tallet hvis du endrer strukturen (object stores, indexes)
let db; // Variabel for å holde database-instansen

// Definerer navn på object stores (tabeller)
const STORE_ROSTER = 'roster';
const STORE_SQUADS = 'squads';
const STORE_UNITS = 'units';
const STORE_MAPDATA = 'mapData';
const STORE_LOG = 'logEntries';
// === 1: DATABASE CONFIGURATION END ===

// === 2: DATABASE INITIALIZATION START ===
/**
 * Initialiserer IndexedDB-databasen.
 * Oppretter object stores hvis de ikke finnes eller ved versjonsoppgradering.
 * Returnerer et Promise som løses når databasen er klar, eller avvises ved feil.
 */
function initDB() {
    console.log("Initialiserer database...");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Databasefeil:", event.target.errorCode);
            reject("Database kunne ikke åpnes.");
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database åpnet vellykket:", db);
            resolve();
        };

        // Kjøres kun hvis versjonsnummeret er høyere enn eksisterende, eller hvis databasen ikke finnes
        request.onupgradeneeded = (event) => {
            console.log("Oppgraderer database...");
            db = event.target.result;
            const transaction = event.target.transaction; // Få transaksjonen fra eventet

             // Sjekk og opprett object stores
            if (!db.objectStoreNames.contains(STORE_SQUADS)) {
                const squadStore = db.createObjectStore(STORE_SQUADS, { keyPath: 'id', autoIncrement: true });
                squadStore.createIndex('nameIndex', 'name', { unique: true }); // Indeks for lagnavn
                console.log(`Object store ${STORE_SQUADS} opprettet.`);
            }

            if (!db.objectStoreNames.contains(STORE_ROSTER)) {
                const rosterStore = db.createObjectStore(STORE_ROSTER, { keyPath: 'id', autoIncrement: true });
                rosterStore.createIndex('squadIdIndex', 'squadId', { unique: false }); // For å hente personell per lag
                rosterStore.createIndex('nameIndex', 'name', { unique: false }); // Navn er ikke nødvendigvis unikt
                rosterStore.createIndex('statusIndex', 'status', { unique: false });
                rosterStore.createIndex('availabilityIndex', 'availability', { unique: false });
                console.log(`Object store ${STORE_ROSTER} opprettet.`);
             }

            if (!db.objectStoreNames.contains(STORE_UNITS)) {
                const unitStore = db.createObjectStore(STORE_UNITS, { keyPath: 'id', autoIncrement: true });
                unitStore.createIndex('typeIndex', 'type', { unique: false }); // 'Post' eller 'Patrulje'
                unitStore.createIndex('assignedSquadIdIndex', 'assignedSquadId', { unique: false });
                unitStore.createIndex('statusIndex', 'status', { unique: false }); // 'Stasjonær', 'I bevegelse' etc.
                console.log(`Object store ${STORE_UNITS} opprettet.`);
            }

            if (!db.objectStoreNames.contains(STORE_MAPDATA)) {
                // Bruker et fast ID for hovedkartet foreløpig, ikke autoIncrement
                const mapStore = db.createObjectStore(STORE_MAPDATA, { keyPath: 'id' });
                console.log(`Object store ${STORE_MAPDATA} opprettet.`);
             }

            if (!db.objectStoreNames.contains(STORE_LOG)) {
                const logStore = db.createObjectStore(STORE_LOG, { keyPath: 'id', autoIncrement: true });
                logStore.createIndex('timestampIndex', 'timestamp', { unique: false });
                logStore.createIndex('typeIndex', 'type', { unique: false }); // 'System', 'Manuell', 'Patrulje'
                console.log(`Object store ${STORE_LOG} opprettet.`);
            }

            // Viktig: Sørg for at transaksjonen fullføres før vi fortsetter
             transaction.oncomplete = () => {
                 console.log("Databaseoppgradering fullført.");
                 // Ikke kall resolve/reject her, det håndteres av onsuccess/onerror på selve requesten
             };
             transaction.onerror = (event) => {
                 console.error("Feil under databaseoppgradering:", event.target.error);
                 reject("Feil under databaseoppgradering.");
             };
        };
    });
}
// === 2: DATABASE INITIALIZATION END ===

// === 3: GENERIC CRUD HELPER FUNCTIONS START ===
/**
 * Generell funksjon for å legge til data i en object store.
 * @param {string} storeName Navnet på object store.
 * @param {object} data Objektet som skal lagres.
 * @returns {Promise<number>} Promise som løses med ID-en til det nye objektet.
 */
function addData(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database ikke initialisert.");
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);

        request.onsuccess = (event) => {
            resolve(event.target.result); // Returnerer nøkkelen (ID) til det nye objektet
        };
        request.onerror = (event) => {
            console.error(`Feil ved lagring i ${storeName}:`, event.target.error);
            reject(`Kunne ikke lagre data i ${storeName}.`);
        };
    });
}

/**
 * Generell funksjon for å hente all data fra en object store.
 * @param {string} storeName Navnet på object store.
 * @returns {Promise<Array<object>>} Promise som løses med en array av objekter.
 */
function getAllData(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database ikke initialisert.");
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onerror = (event) => {
            console.error(`Feil ved henting fra ${storeName}:`, event.target.error);
            reject(`Kunne ikke hente data fra ${storeName}.`);
        };
    });
}

/**
 * Generell funksjon for å hente ett enkelt objekt basert på ID.
 * @param {string} storeName Navnet på object store.
 * @param {*} key ID (nøkkel) for objektet som skal hentes.
 * @returns {Promise<object|undefined>} Promise som løses med objektet, eller undefined hvis ikke funnet.
 */
function getDataById(storeName, key) {
    // Konverter key til nummer hvis store bruker autoIncrement (som gir number-keys)
    // Unntak er mapData som bruker string-key ('mainMap').
    const numericKeyStores = [STORE_ROSTER, STORE_SQUADS, STORE_UNITS, STORE_LOG];
    const finalKey = numericKeyStores.includes(storeName) ? Number(key) : key;

    return new Promise((resolve, reject) => {
        if (!db) return reject("Database ikke initialisert.");
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(finalKey);

        request.onsuccess = (event) => {
            resolve(event.target.result); // Kan være undefined hvis nøkkelen ikke finnes
        };
        request.onerror = (event) => {
            console.error(`Feil ved henting av ID ${finalKey} fra ${storeName}:`, event.target.error);
            reject(`Kunne ikke hente data med ID ${finalKey} fra ${storeName}.`);
        };
    });
}


/**
 * Generell funksjon for å oppdatere et objekt i en object store.
 * Objektet MÅ inneholde nøkkelen (keyPath).
 * @param {string} storeName Navnet på object store.
 * @param {object} data Objektet som skal oppdateres (inkludert ID/nøkkel).
 * @returns {Promise<void>} Promise som løses når oppdateringen er vellykket.
 */
function updateData(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database ikke initialisert.");
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data); // put() både oppdaterer (hvis nøkkel finnes) og legger til (hvis ikke)

        request.onsuccess = () => {
            resolve();
        };
        request.onerror = (event) => {
            console.error(`Feil ved oppdatering i ${storeName}:`, event.target.error);
            reject(`Kunne ikke oppdatere data i ${storeName}.`);
        };
    });
}

/**
 * Generell funksjon for å slette et objekt fra en object store basert på ID.
 * @param {string} storeName Navnet på object store.
 * @param {*} key ID (nøkkel) for objektet som skal slettes.
 * @returns {Promise<void>} Promise som løses når slettingen er vellykket.
 */
function deleteData(storeName, key) {
    // Konverter key til nummer for stores som bruker autoIncrement
     const numericKeyStores = [STORE_ROSTER, STORE_SQUADS, STORE_UNITS, STORE_LOG];
     const finalKey = numericKeyStores.includes(storeName) ? Number(key) : key;

    return new Promise((resolve, reject) => {
        if (!db) return reject("Database ikke initialisert.");
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(finalKey);

        request.onsuccess = () => {
            resolve();
        };
        request.onerror = (event) => {
            console.error(`Feil ved sletting av ID ${finalKey} fra ${storeName}:`, event.target.error);
            reject(`Kunne ikke slette data med ID ${finalKey} fra ${storeName}.`);
        };
    });
}

/**
 * Generell funksjon for å slette all data fra en object store.
 * @param {string} storeName Navnet på object store.
 * @returns {Promise<void>} Promise som løses når tømming er vellykket.
 */
function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database ikke initialisert.");
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
            console.log(`Object store ${storeName} tømt.`);
            resolve();
        };
        request.onerror = (event) => {
            console.error(`Feil ved tømming av ${storeName}:`, event.target.error);
            reject(`Kunne ikke tømme ${storeName}.`);
        };
    });
}
// === 3: GENERIC CRUD HELPER FUNCTIONS END ===

// === 4: SPECIFIC DATA ACCESS FUNCTIONS (EXAMPLES) START ===
// Disse funksjonene bruker de generiske hjelperne, men gir et mer spesifikt API for resten av appen.

// --- Roster Functions ---
async function addPersonnel(personData) {
    // Validering av personData kan legges til her
    return addData(STORE_ROSTER, personData);
}
async function getAllPersonnel() {
    return getAllData(STORE_ROSTER);
}
async function getPersonnelById(id) {
    return getDataById(STORE_ROSTER, id);
}
async function updatePersonnel(personData) {
    if (!personData || typeof personData.id === 'undefined') {
        throw new Error("Oppdatering av personell krever et objekt med en 'id'.");
    }
    return updateData(STORE_ROSTER, personData);
}
async function deletePersonnel(id) {
    return deleteData(STORE_ROSTER, id);
}
async function getPersonnelBySquad(squadId) {
     return new Promise((resolve, reject) => {
         if (!db) return reject("Database ikke initialisert.");
         const transaction = db.transaction([STORE_ROSTER], 'readonly');
         const store = transaction.objectStore(STORE_ROSTER);
         const index = store.index('squadIdIndex');
         const request = index.getAll(Number(squadId)); // Sørg for at squadId er et tall

         request.onsuccess = (event) => {
             resolve(event.target.result);
         };
         request.onerror = (event) => {
             console.error(`Feil ved henting av personell for lag ${squadId}:`, event.target.error);
             reject(`Kunne ikke hente personell for lag ${squadId}.`);
         };
     });
}


// --- Squad Functions ---
async function addSquad(squadData) {
    return addData(STORE_SQUADS, squadData);
}
async function getAllSquads() {
    return getAllData(STORE_SQUADS);
}
async function getSquadById(id) {
    return getDataById(STORE_SQUADS, id);
}
async function updateSquad(squadData) {
     if (!squadData || typeof squadData.id === 'undefined') {
         throw new Error("Oppdatering av lag krever et objekt med en 'id'.");
     }
    return updateData(STORE_SQUADS, squadData);
}
async function deleteSquad(id) {
    // VIKTIG: Bør også håndtere hva som skjer med personell i laget som slettes.
    // F.eks. sette deres squadId til null eller flytte dem til et "Uten lag"-kategori.
    // Dette må implementeres i applikasjonslogikken (f.eks. i roster.js).
    console.warn(`Sletting av lag ${id}. Husk å håndtere personell i dette laget.`);
    return deleteData(STORE_SQUADS, id);
}

// --- Log Functions ---
async function addLogEntry(logData) {
    // Legg til timestamp hvis det mangler
    if (!logData.timestamp) {
        logData.timestamp = new Date().toISOString(); // ISO format for sortering
    }
    // Sørg for at type er satt
    logData.type = logData.type || 'Manuell'; // Standard til Manuell hvis ikke spesifisert
    return addData(STORE_LOG, logData);
}
async function getAllLogEntries() {
    // Henter og sorterer etter timestamp (nyeste først)
    const entries = await getAllData(STORE_LOG);
    return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
async function clearLog() {
    return clearStore(STORE_LOG);
}

// --- Map Data Functions ---
async function saveMapData(mapId, imageData, points) {
    const data = {
        id: mapId, // f.eks. 'mainMap'
        imageData: imageData, // Kan være Blob eller base64 string
        points: points || [] // Array av {x, y, type, name}
    };
    // Siden vi bruker et fast ID, vil updateData (put) fungere for både første lagring og oppdatering
    return updateData(STORE_MAPDATA, data);
}
async function getMapData(mapId) {
    return getDataById(STORE_MAPDATA, mapId);
}

// --- Unit Functions ---
async function addUnit(unitData) {
    return addData(STORE_UNITS, unitData);
}
async function getAllUnits() {
    return getAllData(STORE_UNITS);
}
async function getUnitById(id) {
    return getDataById(STORE_UNITS, id);
}
async function updateUnit(unitData) {
    if (!unitData || typeof unitData.id === 'undefined') {
        throw new Error("Oppdatering av enhet krever et objekt med en 'id'.");
    }
    return updateData(STORE_UNITS, unitData);
}
async function deleteUnit(id) {
    return deleteData(STORE_UNITS, id);
}

// --- Data Export/Import/Clear ---
async function exportAllData() {
    if (!db) throw new Error("Database ikke initialisert.");
    const exportData = {};
    const storeNames = [STORE_SQUADS, STORE_ROSTER, STORE_UNITS, STORE_MAPDATA, STORE_LOG];

    for (const storeName of storeNames) {
        try {
            exportData[storeName] = await getAllData(storeName);
        } catch (error) {
            console.error(`Kunne ikke eksportere data fra ${storeName}:`, error);
            exportData[storeName] = []; // Legg til tom array ved feil
        }
    }
    return exportData;
}

async function importAllData(data) {
    if (!db) throw new Error("Database ikke initialisert.");
    const storeNames = Object.keys(data); // Få stores fra importert data

    // Start med å tømme eksisterende stores som finnes i importdataen
    for (const storeName of storeNames) {
        if (db.objectStoreNames.contains(storeName)) {
            try {
                await clearStore(storeName);
                console.log(`Tømte ${storeName} før import.`);
            } catch (error) {
                console.error(`Kunne ikke tømme ${storeName} før import:`, error);
                throw new Error(`Feil ved tømming av ${storeName} under import.`);
            }
        } else {
            console.warn(`Importert data inneholder store "${storeName}" som ikke finnes i gjeldende databaseversjon. Ignoreres.`);
        }
    }

    // Importer data
    for (const storeName of storeNames) {
         if (db.objectStoreNames.contains(storeName) && Array.isArray(data[storeName])) {
            const items = data[storeName];
            // Bruker addData for hvert element for å håndtere autoIncrement riktig
            // (OBS: Dette vil generere nye IDs hvis store bruker autoIncrement)
            // En mer robust import ville kanskje beholde gamle IDs hvis mulig,
            // men det krever mer kompleks logikk for å unngå kollisjoner.
            // For mapData som har fast ID, er dette OK.
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
             let importCount = 0;
             for (const item of items) {
                 // For stores med autoIncrement, fjern ID slik at DB genererer ny
                 if ([STORE_ROSTER, STORE_SQUADS, STORE_UNITS, STORE_LOG].includes(storeName)) {
                     delete item.id;
                 }
                store.add(item); // Add er raskere enn put når vi vet det er nytt
                 importCount++;
             }
             await new Promise((resolve, reject) => { // Vent på at transaksjonen fullføres
                 transaction.oncomplete = resolve;
                 transaction.onerror = reject;
             });
            console.log(`Importerte ${importCount} elementer til ${storeName}.`);
         }
    }
    console.log("Datimport fullført.");
}


async function clearAllData() {
    if (!db) throw new Error("Database ikke initialisert.");
    const storeNames = Array.from(db.objectStoreNames); // Få alle stores i databasen
    for (const storeName of storeNames) {
        try {
            await clearStore(storeName);
        } catch (error) {
            console.error(`Kunne ikke tømme ${storeName}:`, error);
            // Fortsett til neste selv om en feiler? Eller kast feil? Kaster feil for nå.
            throw new Error(`Feil ved tømming av ${storeName}.`);
        }
    }
    console.log("All data slettet fra databasen.");
}

// === 4: SPECIFIC DATA ACCESS FUNCTIONS (EXAMPLES) END ===
