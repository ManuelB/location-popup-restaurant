

const parkingLotRTree = new rbush();
const superMarketRTree = new rbush();
const sectionText = document.getElementById("SECTIONID");
const parkingText = document.getElementById("INFOPARKING");
const backButton = document.getElementById("back-id");
const forwardButton = document.getElementById("forward-id");

const INITIAL_VIEW_STATE = {
  longitude: 13.302428631992042,
  latitude: 52.50131842240836,
  zoom: 15
}

// Add Mapbox GL for the basemap. It's not a requirement if you don't need a basemap.
const map = new mapboxgl.Map({
  container: 'map',
  interactive: false,
  style: carto.basemaps.voyager,
  center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
  zoom: INITIAL_VIEW_STATE.zoom
});

const getParkingSpaceInfo = evt => {
  let parkingSpotInfos = evt.object.properties;
  const factory = new jsts.geom.GeometryFactory();
  let coord = evt.object.geometry.coordinates[0].map(e => new jsts.geom.Coordinate(e[0], e[1]));
  //console.log(coord);
  let areaParkingSpot = factory.createPolygon(coord).getArea();
  if (parkingSpotInfos) {
    let txt ="";
    // for (const element of Object.keys(parkingSpotInfos)) {
    //   txt += element;
    // }
    Object.entries(parkingSpotInfos).forEach(([key,value]) => {
      txt += `<li>${key}: ${value}</li>`
    })
    parkingText.innerHTML =  JSON.stringify(parkingSpotInfos, undefined, 2);

    let areaqm = areaParkingSpot * 1000000000;
    parkingText.innerHTML = `<ul>${txt}</ul>`+ `Größe: ${areaqm} m²`;
  }
}
const parkingLotLayer = new deck.GeoJsonLayer({
  id: 'parking-lot-layer',
  pickable: true,
  stroked: false,
  filled: true,
  extruded: true,
  lineWidthScale: 20,
  lineWidthMinPixels: 2,
  getFillColor: [160, 160, 180, 200],
  getLineColor: _ => [160, 160, 180, 200],
  getRadius: 5,
  getLineWidth: 1,
  getElevation: 2,
  onClick: evt => getParkingSpaceInfo(evt)
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
  getLineColor: _ => [160, 160, 180, 200],
  getRadius: 5,
  getLineWidth: 1,
  getElevation: 20
});

const ICON_MAPPING = {
  marker: {
    x: 0,
    y: 0,
    width: 128,
    height: 128,
    mask: true,
    anchorX: -64,
    anchory: -64
  }
};
const getMapIcon = () => {
  return 'marker';
}

const getCoordinates = d => {
  // debugger;
  return d.coordinates;
}



let bottomLeft = [13.3, 52.5];
let topRight = [13.35, 52.55];

let displayLoaderCounter = 0;

function showLoader() {
  displayLoaderCounter++;
  if (displayLoaderCounter > 0) {
    document.getElementById("loader").style.display = "initial";
  }
}

function hideLoader() {
  displayLoaderCounter--;
  if (displayLoaderCounter <= 0) {
    document.getElementById("loader").style.display = "none";
  }
}

function loadParkingLots() {
  let query = `data=[out:json][timeout:50];
  (
  ++nwr["amenity"="parking"](`+ bottomLeft[1] + `,` + bottomLeft[0] + `,` + topRight[1] + `,` + topRight[0] + `);
  );
  out+body;
  >;
  out+skel+qt;`
  loadLayerWithOverpass(parkingLotLayer, encodeURI(query), parkingLotRTree);
}
function loadSuperMarkets() {
  let query = `data=[out:json][timeout:50];
  (
  ++nwr["shop"="supermarket"](`+ bottomLeft[1] + `,` + bottomLeft[0] + `,` + topRight[1] + `,` + topRight[0] + `);
  );
  out+body;
  >;
  out+skel+qt;`
  loadLayerWithOverpass(superMarketLayer, encodeURI(query), superMarketRTree);
}

function loadLayerWithOverpass(oLayer, oQuery, oRIndex) {
  showLoader();
  fetch("https://lz4.overpass-api.de/api/interpreter", {
    "body": oQuery,
    "method": "POST"
  }).then(res => res.json()).then(oResult => {
    let oFeatureCollection = osmtogeojson(oResult);

    for (let oFeature of oFeatureCollection.features) {
      if (oFeature.geometry.type == "Point") {
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
        changeFlags: { dataChanged: true }
      }
    );
    hideLoader();
  }).catch(e => {
    console.error(e);
  });
}
let intermediateOptimizationPoints = [];

function optimizeLocation(start, rTree) {
  const scorePoint = tf.tensor1d([start[0], start[1]]).variable();
  intermediateOptimizationPoints = [];
  // finds the closest parking lot
  // calculate distance
  // TODO:
  // use cumulative normal distribution function for judging distance
  // - very close -> very good
  // - far away -> we don't care
  const scoreOfCurrentCoordinates = _ => {
    let pointCoordinates = [scorePoint.dataSync()[0], scorePoint.dataSync()[1]];
    intermediateOptimizationPoints.push(pointCoordinates);
    let closestFeature = knn(rTree, pointCoordinates[0], pointCoordinates[1], 1);
    if (closestFeature) {
      // distance to start point
      var squaredDifference = tf.squaredDifference(scorePoint, tf.tensor1d(closestFeature[0].feature.geometry.coordinates)).sum().sqrt();
      return squaredDifference;
    } else {
      return tf.tensor1d([Infinity]);
    }
  };

  const learningRate = 0.001;
  const optimizer = tf.train.sgd(learningRate);
  for (let i = 0; i < 100; i++) {
    optimizer.minimize(scoreOfCurrentCoordinates);
  }

  var optimizedLocation = scorePoint.dataSync();

  return optimizedLocation;

}


// Create Deck.GL map
let deckMap = new deck.DeckGL({
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  initialViewState: {
    longitude: 13.302428631992042,
    latitude: 52.50131842240836,
    zoom: 15
  },
  layers: [parkingLotLayer, superMarketLayer],
  controller: true,
  onViewStateChange: ({ viewState }) => {
    map.jumpTo({
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      bearing: viewState.bearing,
      pitch: viewState.pitch
    });
  },
  onWebGLInitialized: () => {
    loadParkingLots();
    loadSuperMarkets();
  },
  onDragEnd: () => {
    let start = [map.getCenter().lng, map.getCenter().lat];
    let optimizedLocation = optimizeLocation(start, superMarketRTree);
    sectionText.innerText = `Current optimized location ${optimizedLocation[0]}:${optimizedLocation[1]} `;
    let optimizedLocationLayer = new deck.IconLayer({
      id: 'optimized-location-layer',
      pickable: true,
      // iconAtlas and iconMapping are required
      // getIcon: return a string
      iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
      iconMapping: ICON_MAPPING,
      getIcon: getMapIcon,
      sizeScale: 15,
      getPosition: getCoordinates,
      getSize: _ => 5,
      getColor: _ => [100, 140, 0],
      data: [{ "coordinates": optimizedLocation }]
    });

    deckMap.setProps({
      layers: [parkingLotLayer, superMarketLayer, optimizedLocationLayer]
    });
    //loadParkingLots();
    //loadSuperMarkets();
  },
  /*shouldUpdateState: (props, oldProps, context, changeFlags) =>{
      alert("Redrawing is done");
  }*/
});
let currentPoint = 0;
backButton.addEventListener("click", _ => {
  currentPoint--;
  flyToPoint(currentPoint);
});

forwardButton.addEventListener("click", _ => {
  currentPoint++
  flyToPoint(currentPoint);
})

const flyToPoint = currentIndex => {
  let currentPoint2 = intermediateOptimizationPoints[currentIndex];
 if (currentPoint2) {
   deckMap.setProps({
     viewState: {
       longitude: currentPoint2[0],
       latitude: currentPoint2[1],
       zoom: 20,
       pitch: 0,
       bearing: 0,
       transitionInterpolator: new deck.FlyToInterpolator(),
       transitionDuration: 'auto'
     }
   });
 }
}
