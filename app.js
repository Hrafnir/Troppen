// === 1: INITIALIZATION & DOM READY START ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("Tropp KO Verktøy - Initialiserer...");
    initializeTabs();
    // Senere: Kall initialiseringsfunksjoner for hver modul
    // initializeRoster();
    // initializeMap();
    // initializeUnits();
    // initializeOpsView();
    // initializeLog();
    // initializeSettings();
    console.log("Applikasjon klar.");
});
// === 1: INITIALIZATION & DOM READY END ===

// === 2: TAB SWITCHING LOGIC START ===
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.getAttribute('data-tab');

            // Fjern 'active' klassen fra alle knapper og innholdsseksjoner
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Legg til 'active' klassen til klikket knapp og tilhørende innhold
            button.classList.add('active');
            const targetTabContent = document.getElementById(`${targetTabId}-tab`);
            if (targetTabContent) {
                targetTabContent.classList.add('active');
                console.log(`Navigerte til fane: ${targetTabId}`);
                // Her kan vi legge til logikk som skal kjøre når en spesifikk fane åpnes,
                // f.eks. oppdatere kartvisning når man går til Operasjonsbilde.
                 if (targetTabId === 'ops') {
                    // refreshOpsView(); // Eksempel
                 }
            } else {
                console.error(`Kunne ikke finne innhold for fane: ${targetTabId}-tab`);
            }
        });
    });
     // Viser den første fanen som standard (Kart i dette tilfellet)
     const defaultTab = document.querySelector('.tab-button[data-tab="map"]');
     if (defaultTab) {
         defaultTab.click(); // Simulerer et klikk for å aktivere den
     }
}
// === 2: TAB SWITCHING LOGIC END ===

// === 3: UTILITY FUNCTIONS START ===
// Hjelpefunksjoner kan legges her etter hvert
function getCurrentTimestamp() {
    const now = new Date();
    // Formaterer til DD.MM.YYYY HH:MM:SS
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Måneder er 0-indeksert
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}
// === 3: UTILITY FUNCTIONS END ===

// === 4: PLACEHOLDER FUNCTIONS FOR MODULE INITIALIZATION START ===
// Disse funksjonene vil bli fylt ut når vi lager de respektive modulene.
// function initializeRoster() { console.log("Initialiserer Roster..."); }
// function initializeMap() { console.log("Initialiserer Kart..."); }
// function initializeUnits() { console.log("Initialiserer Enheter..."); }
// function initializeOpsView() { console.log("Initialiserer Operasjonsbilde..."); }
// function initializeLog() { console.log("Initialiserer Logg..."); }
// function initializeSettings() { console.log("Initialiserer Innstillinger..."); }
// function refreshOpsView() { console.log("Oppdaterer Operasjonsbilde..."); }
// === 4: PLACEHOLDER FUNCTIONS FOR MODULE INITIALIZATION END ===
