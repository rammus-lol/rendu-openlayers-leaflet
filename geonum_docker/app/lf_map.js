//Initialisation de la carte
let carte = L.map('carte').setView([45.719, 4.918], 2);

//Définition des fonds de carte (Base Layers)
let osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(carte);

let satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri'
});

//Variables pour les éléments UI
let rectangle = document.getElementById("rectangle");
let closeBtn = document.getElementById("closeBtn");

// Fonction pour ajuster la position du bouton
function ajusterPositionBouton() {
    if (closeBtn.classList.contains("open")) {
        let hauteurRectangle = rectangle.offsetHeight;
        closeBtn.style.bottom = (20 + hauteurRectangle - 15) + "px";
    } else {
        closeBtn.style.bottom = "20px";
    }
}

//Configuration des couleurs
    function getReactionColor(reaction) {
        const val = reaction ? reaction.toString().trim() : "NULL";
        switch (val) {
            case 'Not consulted': return '#3fa244';
            case 'Other': return '#fcc50d';
            case 'Limited consultation': return '#ff8000';
            case 'Free, Prior and Informed Consent (FPIC)': return '#d70e0e';
            case 'NULL':
            case '': return '#d3d3d3';
            default: return '#d3d3d3';
        }
    }

//Chargement des données via WFS (GeoJSON)
let urlGeoJSON = "http://localhost:8080/geoserver/Cabinet_de_juristes/ows?" +
    "service=WFS&version=1.0.0&request=GetFeature&" +
    "typeName=Cabinet_de_juristes:deals_&" +
    "outputFormat=application/json&" +
    "CQL_FILTER=indigenous_people_or_local_communities=true";


fetch(urlGeoJSON)
    .then(response => response.json())
    .then(data => {
        let dealsLayer = L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                const consultation = feature.properties.community_consultation;
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: getReactionColor(consultation),
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            /*application de l'écouteur pour mettre à jour la modale d'affichage
            * -id
            * -type de culture
            * -réaction*/
            onEachFeature: function (feature, layer) {
                layer.on('click', function (e) {
                    L.DomEvent.stopPropagation(e);
                    let props = feature.properties;

                    rectangle.innerHTML = `
                        <p><b>ID :</b> ${props.id}</p>
                        <p><b>Culture :</b> ${props.crops || 'Non renseigné'}</p>
                        <p><b>Réaction :</b> <span style="color:${getReactionColor(props.community_reaction)}">●</span> ${props.community_reaction || 'Non renseigné'}</p>
                    `;
                    closeBtn.classList.add("open");
                    rectangle.style.display = "flex"
                    setTimeout(ajusterPositionBouton, 10);
                });
            }
        }).addTo(carte);
// Ajout des couches
        let baseMaps = {
            "OpenStreetMap": osm,
            "Satellite": satellite
        };
        let overlays = {
            "transaction impliquant la présence de communauté autochtones": dealsLayer
        };
        L.control.layers(baseMaps, overlays).addTo(carte);
    })
    .catch(error => console.error('Erreur lors du chargement WFS:', error));

//Gestion du bouton de fermeture
closeBtn.addEventListener("click", function () {
    let isOpen = closeBtn.classList.contains("open");
    if (isOpen) {
        closeBtn.classList.remove("open");
        rectangle.style.display = "none";

    } else {
        closeBtn.classList.add("open");
        rectangle.style.display = "flex";

    }
    ajusterPositionBouton();
});

// Initialisation au chargement
ajusterPositionBouton();

let legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    let div = L.DomUtil.create('div', 'info legend');
    let grades = [
        'Not consulted',
        'Other',
        'Limited consultation',
        'Free, Prior and Informed Consent (FPIC)',
        'NULL'
    ];
    let labels = ['<strong>Légende :</strong><br>Statut de la consultation'];

    // Boucle à travers les catégories pour générer une étiquette avec un cercle de couleur
    for (let i = 0; i < grades.length; i++) {
        labels.push(
            '<i style="background:' + getReactionColor(grades[i]) + '"></i> ' +
            (grades[i] === 'NULL' ? 'Non renseigné' : grades[i])
        );
    }

    div.innerHTML = labels.join('<br>');
    return div;
};
legend.addTo(carte);

function initIntroModal() {
    const el = document.getElementById('introModal');
    if (!el) return;

    // Si bootstrap n'est pas encore chargé, on attend un peu
    if (typeof bootstrap === 'undefined') {
        setTimeout(initIntroModal, 100);
        return;
    }

    const intro = new bootstrap.Modal(el, {
        backdrop: true,
        keyboard: true
    });
    intro.show();
}

window.addEventListener('load', initIntroModal);