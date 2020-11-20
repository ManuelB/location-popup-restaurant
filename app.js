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

const layer = new deck.GeoJsonLayer({
    id: 'geojson-layer',
    pickable: true,
    stroked: false,
    filled: true,
    extruded: true,
    lineWidthScale: 20,
    lineWidthMinPixels: 2,
    getFillColor: [160, 160, 180, 200],
    getLineColor: d => [160, 160, 180, 200],
    getRadius: 100,
    getLineWidth: 1,
    getElevation: 30
});


// Create Deck.GL map
const deckMap = new deck.DeckGL({
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  initialViewState: {
    longitude: 13.302428631992042,
    latitude: 52.50131842240836,
    zoom: 15
  },
  layers: [layer],
  controller: true,
  onDragEnd: () => {
    let viewState = deckMap._getViewState();
    let bottomLeft=  [13.3, 52.5];
    let topRight = [ 13.35, 52.55];
    fetch("https://lz4.overpass-api.de/api/interpreter", {
        "body": "data=%5Bout%3Ajson%5D%5Btimeout%3A50%5D%3B%0A(%0A++nwr%5B%22amenity%22%3D%22parking%22%5D("+bottomLeft[1]+"%2C"+bottomLeft[0]+"%2C"+topRight[1]+"%2C"+topRight[0]+")%3B%0A)%3B%0Aout+body%3B%0A%3E%3B%0Aout+skel+qt%3B",
        "method": "POST"
    }).then(res => res.json()).then(oResult => {
        let aFeatures = oResult.elements
            .filter(oParking => ("lon" in oParking && "lat" in oParking))
            .map(oParking => {
            return {
                "type": "Feature",
                "geometry": {
                "type": "Point",
                "coordinates": [oParking.lon, oParking.lat]
                },
                "properties": {}
            };
        });

      let oGeoJsonCollection = {
          "type": "FeatureCollection",
          "features": aFeatures
      };
      layer.updateState(
        {
          props: {
            data:oGeoJsonCollection,
          },
          changeFlags:{ dataChanged: true}
        }
      );


    }).catch(e => {
        console.error(e);
    });
  }
});
