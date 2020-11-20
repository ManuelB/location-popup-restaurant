const INITIAL_VIEW_STATE = {
    longitude: 13.302428631992042,
    latitude: 52.50131842240836,
    zoom: 15
  }

carto.setDefaultAuth({
  username: 'julesmuc',
  apiKey: '57ad2b5fd65c30d57aa20fe4a4e64ae6ab8173d7'
});


// Add Mapbox GL for the basemap. It's not a requirement if you don't need a basemap.
const map = new mapboxgl.Map({
  container: 'map',
  interactive: false,
  style: carto.basemaps.voyager,
  center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
  zoom: INITIAL_VIEW_STATE.zoom
});

const parkingLotLayer = new deck.GeoJsonLayer({
    id: 'parking-lot-layer',
    pickable: true,
    stroked: false,
    filled: true,
    extruded: true,
    lineWidthScale: 20,
    lineWidthMinPixels: 2,
    getFillColor: [160, 160, 180, 200],
    getLineColor: d => [160, 160, 180, 200],
    getRadius: 5,
    getLineWidth: 1,
    getElevation: 2
});

const superMarketLayer = new deck.GeoJsonLayer({
  id: 'super-market-layer',
  pickable: true,
  stroked: false,
  filled: true,
  extruded: true,
  lineWidthScale: 20,
  lineWidthMinPixels: 2,
  getFillColor: [180, 30, 30, 200],
  getLineColor: d => [160, 160, 180, 200],
  getRadius: 5,
  getLineWidth: 1,
  getElevation: 20
});

let bottomLeft=  [13.3, 52.5];
let topRight = [ 13.35, 52.55];

function loadParkingLots() {
  let query= `data=[out:json][timeout:50];
  (
  ++nwr["amenity"="parking"](`+ bottomLeft[1] +`,`+ bottomLeft[0] +`,`+ topRight[1] +`,`+ topRight[0] +`);
  );
  out+body;
  >;
  out+skel+qt;`
  loadLayerWithOverpass(parkingLotLayer, encodeURI(query));
}
function loadSuperMarkets() {
  let query= `data=[out:json][timeout:50];
  (
  ++nwr["shop"="supermarket"](`+ bottomLeft[1] +`,`+ bottomLeft[0] +`,`+ topRight[1] +`,`+ topRight[0] +`);
  );
  out+body;
  >;
  out+skel+qt;`
  loadLayerWithOverpass(superMarketLayer, encodeURI(query));
}

function loadLayerWithOverpass(oLayer, oQuery) {
  let viewState = deckMap._getViewState();
  fetch("https://lz4.overpass-api.de/api/interpreter", {
      "body": oQuery,
      "method": "POST"
  }).then(res => res.json()).then(oResult => {
    oLayer.updateState(
      {
        props: {
          data:osmtogeojson(oResult),
        },
        changeFlags:{ dataChanged: true}
      }
    );
  }).catch(e => {
      console.error(e);
  });
}

// Create Deck.GL map
const deckMap = new deck.DeckGL({
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  initialViewState: {
    longitude: 13.302428631992042,
    latitude: 52.50131842240836,
    zoom: 15
  },
  layers: [parkingLotLayer, superMarketLayer],
  controller: true,
  onWebGLInitialized: () => {
    loadParkingLots();
    loadSuperMarkets();
  }/*,
  onDragEnd: () => {
    loadParkingLots();
    loadSuperMarkets();
  }*/
});
