// Lien avec le fichier css
import './style.css';

// Import des librairies openlayers
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { ImageWMS } from 'ol/source';
import ImageLayer from 'ol/layer/Image';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Stroke, Style } from 'ol/style.js';
import { fromLonLat } from 'ol/proj';
import ScaleLine from 'ol/control/ScaleLine.js';
import 'ol-ext/dist/ol-ext.css';


// Configuration GeoServer (URLs et noms de couche)
const geoserverWms = 'http://localhost:8080/geoserver/Cabinet_de_juristes/wms';
const dealsLayerName = 'Cabinet_de_juristes:deals_';

const wfsDealsByCountry =
  'http://localhost:8080/geoserver/Cabinet_de_juristes/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Cabinet_de_juristes:worldadministrativeboundaries&outputFormat=application/json&srsName=EPSG:3857';
;

// Valeur du filtre CQL appliquer à l'ouverture de la carte
let currentCqlFilter = null;

// Liste des champs land_matrix_agri affichés dans la table d'attributs
const POPUP_FIELDS = [
  { field: 'id', label: 'Identifiant du contrat'},
  { field: 'surface_ha', label: 'Surface (ha)' },
  { field: 'country', label: 'Pays' },
  { field: 'negatives', label: 'Negatives' },
  { field: 'negative_impacts_for_local_communities', label: 'Impacts négatifs (communautés)' },
  { field: 'impact_environmental_degradation', label: 'Dégradation environnementale' },
  { field: 'impact_socio_economic', label: 'Impact socio-économique' },
  { field: 'impact_cultural_loss', label: 'Perte culturelle' },
  { field: 'impact_displacement', label: 'Déplacement' },
  { field: 'impact_eviction', label: 'Expulsion' },
  { field: 'impact_violence', label: 'Violence' },
  { field: 'impact_other', label: 'Autre impact' },
];

function formatValue(v) {
  // Convertit les valeurs en texte Oui ou Non
  if (v === true) return 'Oui';
  if (v === false) return 'Non';
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

function renderAttributes(properties) {
  // Remplit le tableau d'attributs avec les éléments des champs land_matrix_agri définis plus haut
  const tbody = document.getElementById('attributes-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  POPUP_FIELDS.forEach(({ field, label }) => {
    const tr = document.createElement('tr');

    const tdLabel = document.createElement('td');
    tdLabel.textContent = label;

    const tdValue = document.createElement('td');
    tdValue.textContent = formatValue(properties?.[field]);

    tr.appendChild(tdLabel);
    tr.appendChild(tdValue);
    tbody.appendChild(tr);
  });
}



// Couche de fond OpenStreetMap (tuiles)
const osmLayer = new TileLayer({
  source: new OSM(),
});

// Style pour la couche des pays
const polygonStyle = new Style({
  fill: new Fill({ color: 'rgba( 0, 113, 221, 0.20 )' }),
  stroke: new Stroke({ color: 'rgba( 255, 255, 255, 1.00 )'}),
});

// Couche ponctuelle des Deals
const sourceDeals = new ImageWMS({
  url: geoserverWms,
  params: {
    LAYERS: dealsLayerName,
    CQL_FILTER: null,
  },
  serverType: 'geoserver',
});

const layerDeals = new ImageLayer({
  title: 'Deals (WMS)',
  source: sourceDeals,
});

// WFS contenant la couche pays ayant au moins 1 deal
const worldadministrativeboundaries = new VectorSource({
  format: new GeoJSON(),
  url: wfsDealsByCountry,
});

const dealsbycountry = new VectorLayer({
  title: 'Deals par pays',
  source: worldadministrativeboundaries,
  style: polygonStyle,
});

// Place l'échelle en bas a droite
const scaleline = new ScaleLine({
  units: 'metric',
  bar: false,     // pas de barre visuelle épaisse
  steps: 4,
  text: true,     // affiche le texte sous la ligne
  minWidth: 80,
});


const map = new Map({
  target: 'map',
  layers: [osmLayer, dealsbycountry, layerDeals],
  controls: [scaleline],
  view: new View({
    center: fromLonLat([0, 0]),
    zoom: 2,
  }),
});

// Initialise le panneau d'attributs avec des valeurs vides
renderAttributes({});

//applique le CQL_FILTER sur la couche WMS
document.querySelectorAll('input[name="country"]').forEach((radio) => {
  radio.addEventListener('change', (event) => {
    const value = event.target.value;

    if (value === 'tous') {
      currentCqlFilter = null;
      sourceDeals.updateParams({ CQL_FILTER: null });
    } else {
      //construit un filtre CQL simple
      const safeValue = value.replace(/'/g, "''");
      currentCqlFilter = `country = '${safeValue}'`;
      sourceDeals.updateParams({ CQL_FILTER: currentCqlFilter });
    }

    // Force le WMS à recharger l'image avec le nouveau filtre
    sourceDeals.refresh();
  });
});


// Click simple sur la carte pour recuperer les attributs
map.on('singleclick', (event) => {
  renderAttributes({ country: 'Chargement…' });

  const view = map.getView();
  const resolution = view.getResolution();

  const params = {
    INFO_FORMAT: 'application/json',
    QUERY_LAYERS: dealsLayerName,
    FEATURE_COUNT: 10,
  };
  if (currentCqlFilter) params.CQL_FILTER = currentCqlFilter;

  // Construis l'URL GetFeatureInfo fourni par OpenLayers
  const url = sourceDeals.getFeatureInfoUrl(
    event.coordinate,
    resolution,
    view.getProjection(),
    params
  );

  console.log('GetFeatureInfo URL:', url);

  if (!url) {
    renderAttributes({ country: "Pas d'info (url null)" });
    return;
  }

  //affichage des attributs du premier feature
  fetch(url)
    .then((resp) => resp.json())
    .then((data) => {
      const feat = data?.features?.[0];
      if (!feat) {
        renderAttributes({ country: 'Aucune donnée au clic.' });
        return;
      }
      renderAttributes(feat.properties || {});
    })
    .catch((err) => {
      console.error('Erreur GetFeatureInfo :', err);
      renderAttributes({ country: 'Erreur (voir console).' });
    });
});

// Affiche la fenetre contextuelle d'accueil bootsrap
function showIntroModalWhenReady() {
  const el = document.getElementById('introModal');
  if (!el) return;
const intro = new window.bootstrap.Modal(el, { backdrop: true, keyboard: true });
  intro.show();
}

window.addEventListener('DOMContentLoaded', showIntroModalWhenReady);


// Legende
function updateLegendWms() {
  const img = document.getElementById('legend-wms');
  if (!img) return;

  // Construis une URL GetLegendGraphic ; on encode le CQL si présent
  const legendUrl =
    `${geoserverWms}?` +
    `SERVICE=WMS&REQUEST=GetLegendGraphic&FORMAT=image/png` +
    `&LAYER=${encodeURIComponent(dealsLayerName)}` +
    `&LEGEND_OPTIONS=fontName:Inter;fontSize:12;bgColor:0x111827;labelMargin:6` +
    (currentCqlFilter ? `&CQL_FILTER=${encodeURIComponent(currentCqlFilter)}` : '');

  img.src = legendUrl;
}

// Appel initial pour charger la légende WMS
updateLegendWms();

// Quand on change le filtre pays -> on recharge aussi la légende WMS
document.querySelectorAll('input[name="country"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    updateLegendWms();
  });
});


