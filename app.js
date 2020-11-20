var parkingLotRTree = new rbush();
var superMarketRTree = new rbush();

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

const ICON_MAPPING = {
  marker: {x: 0, y: 0, width: 128, height: 128, mask: true}
};

const optimizedLocationLayer = new deck.IconLayer({
  id: 'optimized-location-layer',
  pickable: true,
  // iconAtlas and iconMapping are required
  // getIcon: return a string
  iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
  iconMapping: ICON_MAPPING,
  getIcon: d => 'marker',
  sizeScale: 15,
  getPosition: d => d.coordinates,
  getSize: d => 5,
  getColor: d => [100, 140, 0],
  //data: [{"name":"Lafayette (LAFY)","code":"LF","address":"3601 Deer Hill Road, Lafayette CA 94549","entries":"3481","exits":"3616","coordinates":[-122.123801,37.893394]},
  //{"name":"12th St. Oakland City Center (12TH)","code":"12","address":"1245 Broadway, Oakland CA 94612","entries":"13418","exits":"13547","coordinates":[-122.271604,37.803664]} ],
  //highlightedObjectIndex: 1
});

let bottomLeft=  [13.3, 52.5];
let topRight = [ 13.35, 52.55];

let displayLoaderCounter=0;

function showLoader(){
  displayLoaderCounter ++;
  if(displayLoaderCounter > 0 ){
    document.getElementById("loader").style.display="initial";
  }
}

function hideLoader(){
  displayLoaderCounter --;
  if(displayLoaderCounter <= 0){
    document.getElementById("loader").style.display="none";
  }
}

function loadParkingLots() {
  let query= `data=[out:json][timeout:50];
  (
  ++nwr["amenity"="parking"](`+ bottomLeft[1] +`,`+ bottomLeft[0] +`,`+ topRight[1] +`,`+ topRight[0] +`);
  );
  out+body;
  >;
  out+skel+qt;`
  loadLayerWithOverpass(parkingLotLayer, encodeURI(query), parkingLotRTree);
}
function loadSuperMarkets() {
  let query= `data=[out:json][timeout:50];
  (
  ++nwr["shop"="supermarket"](`+ bottomLeft[1] +`,`+ bottomLeft[0] +`,`+ topRight[1] +`,`+ topRight[0] +`);
  );
  out+body;
  >;
  out+skel+qt;`
  loadLayerWithOverpass(superMarketLayer, encodeURI(query), superMarketRTree);
}

function loadLayerWithOverpass(oLayer, oQuery, oRIndex) {
  let viewState = deckMap._getViewState();
  showLoader();
  fetch("https://lz4.overpass-api.de/api/interpreter", {
      "body": oQuery,
      "method": "POST"
  }).then(res => res.json()).then(oResult => {
    let oFeatureCollection = osmtogeojson(oResult);

    for(let oFeature of oFeatureCollection.features) {
      if(oFeature.geometry.type == "Point") {
        oRIndex.insert({
          "minX": oFeature.geometry.coordinates[0],
          "minY": oFeature.geometry.coordinates[1],
          "maxX": oFeature.geometry.coordinates[0],
          "maxY": oFeature.geometry.coordinates[1],
          "feature": oFeature
        });
      }
    }

    oLayer.updateState(
      {
        props: {
          data: oFeatureCollection,
        },
        changeFlags:{ dataChanged: true}
      }
    );
    hideLoader();
  }).catch(e => {
      console.error(e);
  });
}

function optimizeLocation(start, rTree) {
    const scorePoint = tf.tensor1d([start[0], start[1]]).variable();
    // finds the closest parking lot
    // calculate distance
    // TODO:
    // use cumulative normal distribution function for judging distance
    // - very close -> very good
    // - far away -> we don't care
    const scoreOfCurrentCoordinates = function () {
        let pointCoordinates = [scorePoint.dataSync()[0], scorePoint.dataSync()[1]];
        let closestFeature = knn(rTree, pointCoordinates[0],  pointCoordinates[1], 1);
        if(closestFeature) {
            // distance to start point
            var squaredDifference = tf.squaredDifference(scorePoint, tf.tensor1d(closestFeature[0].feature.geometry.coordinates)).sum().sqrt();
            return squaredDifference;
        } else {
            return tf.tensor1d([Infinity]);
        }
    };

    const learningRate = 10;
    const optimizer = tf.train.sgd(learningRate);
    for (let i = 0; i < 20; i++) {
        optimizer.minimize(scoreOfCurrentCoordinates);
    }

    var optimizedLocation = scorePoint.dataSync();

    return optimizedLocation;

}

// Create Deck.GL map
const deckMap = new deck.DeckGL({
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  initialViewState: {
    longitude: 13.302428631992042,
    latitude: 52.50131842240836,
    zoom: 15
  },
  layers: [parkingLotLayer, superMarketLayer, optimizedLocationLayer],
  controller: true,
  onWebGLInitialized: () => {
    loadParkingLots();
    loadSuperMarkets();
  },
  onDragEnd: () => {
    let start = [deckMap._getViewState().longitude, deckMap._getViewState().latitude];
    let optimizedLocation = optimizeLocation(start, superMarketRTree);
    alert(optimizedLocation);
    /*nextOldProps = (optimizedLocationLayer.props == undefined ? { iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png'} : optimizedLocationLayer.props);
    optimizedLocationLayer.updateState({
      props: {
        "data": [{"coordinates": optimizedLocation}]
      },
      oldProps: nextOldProps,
      changeFlags:{ dataChanged: true}
    })*/
    //loadParkingLots();
    //loadSuperMarkets();
  }
});